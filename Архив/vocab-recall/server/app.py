import hmac
import os
import random
import secrets
from datetime import datetime, timedelta
from pathlib import Path

from flask import (
    Flask,
    g,
    jsonify,
    redirect,
    render_template_string,
    request,
    send_from_directory,
    session,
)

from db import DATA_DIR, get_db, init_db

BASE_DIR = Path(__file__).parent
CLIENT_DIR = BASE_DIR.parent / "client"

DEFAULT_NEW_CARDS_PER_DAY = "15"

SECRET_KEY_PATH = DATA_DIR / "secret.key"
if SECRET_KEY_PATH.exists():
    FLASK_SECRET = SECRET_KEY_PATH.read_text().strip()
else:
    FLASK_SECRET = secrets.token_hex(32)
    SECRET_KEY_PATH.write_text(FLASK_SECRET)

PASSWORD_PATH = DATA_DIR / "password.txt"


def load_password():
    env_password = os.environ.get("APP_PASSWORD")
    if env_password:
        return env_password
    if PASSWORD_PATH.exists():
        return PASSWORD_PATH.read_text().strip()
    generated = secrets.token_urlsafe(9)
    PASSWORD_PATH.write_text(generated)
    print(
        f"[vocab-recall] Сгенерирован пароль для входа: {generated}\n"
        f"  (сохранён в {PASSWORD_PATH}; свой пароль можно задать через переменную окружения APP_PASSWORD)"
    )
    return generated


APP_PASSWORD = load_password()

app = Flask(__name__, static_folder=None)
app.secret_key = FLASK_SECRET
app.permanent_session_lifetime = timedelta(days=30)
init_db()


def db():
    if "db" not in g:
        g.db = get_db()
    return g.db


@app.teardown_appcontext
def close_db(exc):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def row_to_dict(row):
    return dict(row)


def now_str():
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


def get_setting(key, default=None):
    row = db().execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def set_setting(key, value):
    db().execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, str(value)),
    )
    db().commit()


# ---------- auth ----------

LOGIN_HTML = """
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Вход — Vocab Recall</title>
<link rel="stylesheet" href="/static/style.css">
</head>
<body>
<div class="login-wrap">
  <form class="login-box card-box" method="post">
    <h1>Vocab Recall</h1>
    <p class="subtitle">Введи пароль для входа</p>
    <input type="password" name="password" placeholder="Пароль" autofocus required />
    {% if error %}<div class="error-msg">{{ error }}</div>{% endif %}
    <button type="submit" class="primary">Войти</button>
  </form>
</div>
</body>
</html>
"""


@app.before_request
def require_login():
    if request.path == "/login" or request.path.startswith("/static/"):
        return
    if not session.get("authed"):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Требуется вход"}), 401
        return redirect("/login")


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        if hmac.compare_digest(request.form.get("password", ""), APP_PASSWORD):
            session.clear()
            session["authed"] = True
            session.permanent = True
            return redirect("/")
        error = "Неверный пароль"
    return render_template_string(LOGIN_HTML, error=error)


@app.post("/logout")
def logout():
    session.clear()
    return "", 204


# ---------- SM-2 spaced repetition ----------

def apply_review(card, quality):
    """Standard SM-2. quality: 0 (again) .. 5 (perfect)."""
    ease = card["ease_factor"]
    interval = card["interval_days"]
    reps = card["repetitions"]
    lapses = card["lapses"]

    if quality < 3:
        reps = 0
        interval = 1
        lapses += 1
    else:
        if reps == 0:
            interval = 1
        elif reps == 1:
            interval = 6
        else:
            interval = round(interval * ease)
        reps += 1

    ease = max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))

    db().execute(
        """
        UPDATE cards SET
            ease_factor = ?, interval_days = ?, repetitions = ?, lapses = ?,
            due_at = datetime('now', ? || ' days'),
            last_reviewed_at = datetime('now'),
            first_reviewed_at = COALESCE(first_reviewed_at, datetime('now'))
        WHERE id = ?
        """,
        (ease, interval, reps, lapses, interval, card["id"]),
    )
    db().commit()


# ---------- static client ----------

@app.route("/")
def index():
    return send_from_directory(CLIENT_DIR, "index.html")


@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory(CLIENT_DIR / "static", filename)


# ---------- lessons ----------

@app.get("/api/lessons")
def list_lessons():
    rows = db().execute(
        """
        SELECT lessons.*,
            (SELECT COUNT(*) FROM cards WHERE cards.lesson_id = lessons.id) AS card_count,
            (SELECT COUNT(*) FROM cards WHERE cards.lesson_id = lessons.id
                AND cards.first_reviewed_at IS NOT NULL
                AND cards.due_at <= datetime('now')) AS due_count
        FROM lessons
        ORDER BY lessons.created_at DESC, lessons.id DESC
        """
    ).fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@app.post("/api/lessons")
def create_lesson():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Название урока обязательно"}), 400
    cur = db().execute("INSERT INTO lessons (name) VALUES (?)", (name,))
    db().commit()
    row = db().execute("SELECT * FROM lessons WHERE id = ?", (cur.lastrowid,)).fetchone()
    result = row_to_dict(row)
    result["card_count"] = 0
    result["due_count"] = 0
    return jsonify(result), 201


@app.patch("/api/lessons/<int:lesson_id>")
def update_lesson(lesson_id):
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Название урока обязательно"}), 400
    row = db().execute("SELECT id FROM lessons WHERE id = ?", (lesson_id,)).fetchone()
    if not row:
        return jsonify({"error": "Урок не найден"}), 404
    db().execute("UPDATE lessons SET name = ? WHERE id = ?", (name, lesson_id))
    db().commit()
    row = db().execute("SELECT * FROM lessons WHERE id = ?", (lesson_id,)).fetchone()
    return jsonify(row_to_dict(row))


@app.delete("/api/lessons/<int:lesson_id>")
def delete_lesson(lesson_id):
    db().execute("DELETE FROM lessons WHERE id = ?", (lesson_id,))
    db().commit()
    return "", 204


# ---------- cards ----------

@app.get("/api/lessons/<int:lesson_id>/cards")
def list_cards(lesson_id):
    rows = db().execute(
        "SELECT * FROM cards WHERE lesson_id = ? ORDER BY created_at DESC, id DESC",
        (lesson_id,),
    ).fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@app.post("/api/lessons/<int:lesson_id>/cards")
def create_card(lesson_id):
    lesson = db().execute("SELECT id FROM lessons WHERE id = ?", (lesson_id,)).fetchone()
    if not lesson:
        return jsonify({"error": "Урок не найден"}), 404
    data = request.get_json(force=True) or {}
    phrase = (data.get("phrase") or "").strip()
    translation = (data.get("translation") or "").strip()
    note = (data.get("note") or "").strip()
    if not phrase or not translation:
        return jsonify({"error": "Фраза и перевод обязательны"}), 400
    cur = db().execute(
        "INSERT INTO cards (lesson_id, phrase, translation, note) VALUES (?, ?, ?, ?)",
        (lesson_id, phrase, translation, note),
    )
    db().commit()
    row = db().execute("SELECT * FROM cards WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(row_to_dict(row)), 201


@app.patch("/api/cards/<int:card_id>")
def update_card(card_id):
    row = db().execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
    if not row:
        return jsonify({"error": "Карточка не найдена"}), 404
    data = request.get_json(force=True) or {}
    fields = {}
    if "phrase" in data:
        phrase = (data["phrase"] or "").strip()
        if not phrase:
            return jsonify({"error": "Фраза обязательна"}), 400
        fields["phrase"] = phrase
    if "translation" in data:
        translation = (data["translation"] or "").strip()
        if not translation:
            return jsonify({"error": "Перевод обязателен"}), 400
        fields["translation"] = translation
    if "note" in data:
        fields["note"] = (data["note"] or "").strip()
    if fields:
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        db().execute(f"UPDATE cards SET {set_clause} WHERE id = ?", (*fields.values(), card_id))
        db().commit()
    row = db().execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
    return jsonify(row_to_dict(row))


@app.delete("/api/cards/<int:card_id>")
def delete_card(card_id):
    db().execute("DELETE FROM cards WHERE id = ?", (card_id,))
    db().commit()
    return "", 204


# ---------- review / study ----------

@app.get("/api/review/queue")
def review_queue():
    scope = request.args.get("scope", "due")
    if scope == "lesson":
        lesson_id = request.args.get("lesson_id")
        if not lesson_id:
            return jsonify({"error": "lesson_id обязателен для scope=lesson"}), 400
        rows = db().execute(
            "SELECT * FROM cards WHERE lesson_id = ? ORDER BY RANDOM()", (lesson_id,)
        ).fetchall()
        return jsonify([row_to_dict(r) for r in rows])

    review_rows = db().execute(
        "SELECT * FROM cards WHERE first_reviewed_at IS NOT NULL AND due_at <= datetime('now')"
    ).fetchall()
    introduced_today = db().execute(
        "SELECT COUNT(*) AS c FROM cards WHERE date(first_reviewed_at) = date('now')"
    ).fetchone()["c"]
    daily_limit = int(get_setting("new_cards_per_day", DEFAULT_NEW_CARDS_PER_DAY))
    remaining = max(0, daily_limit - introduced_today)
    new_rows = []
    if remaining > 0:
        new_rows = db().execute(
            "SELECT * FROM cards WHERE first_reviewed_at IS NULL ORDER BY created_at ASC LIMIT ?",
            (remaining,),
        ).fetchall()

    combined = [row_to_dict(r) for r in review_rows] + [row_to_dict(r) for r in new_rows]
    random.shuffle(combined)
    return jsonify(combined)


@app.post("/api/cards/<int:card_id>/review")
def review_card(card_id):
    row = db().execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
    if not row:
        return jsonify({"error": "Карточка не найдена"}), 404
    data = request.get_json(force=True) or {}
    quality = data.get("quality")
    if quality is None or not isinstance(quality, int) or not (0 <= quality <= 5):
        return jsonify({"error": "quality должен быть числом от 0 до 5"}), 400
    apply_review(row, quality)
    updated = db().execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
    return jsonify(row_to_dict(updated))


@app.get("/api/stats")
def stats():
    total = db().execute("SELECT COUNT(*) AS c FROM cards").fetchone()["c"]
    due = db().execute(
        "SELECT COUNT(*) AS c FROM cards WHERE first_reviewed_at IS NOT NULL AND due_at <= datetime('now')"
    ).fetchone()["c"]
    new_waiting = db().execute(
        "SELECT COUNT(*) AS c FROM cards WHERE first_reviewed_at IS NULL"
    ).fetchone()["c"]
    introduced_today = db().execute(
        "SELECT COUNT(*) AS c FROM cards WHERE date(first_reviewed_at) = date('now')"
    ).fetchone()["c"]
    learned = db().execute(
        "SELECT COUNT(*) AS c FROM cards WHERE repetitions >= 2"
    ).fetchone()["c"]
    daily_limit = int(get_setting("new_cards_per_day", DEFAULT_NEW_CARDS_PER_DAY))
    new_available_now = min(new_waiting, max(0, daily_limit - introduced_today))
    return jsonify(
        {
            "total": total,
            "due": due,
            "learned": learned,
            "new_waiting": new_waiting,
            "introduced_today": introduced_today,
            "new_cards_per_day": daily_limit,
            "available_now": due + new_available_now,
        }
    )


# ---------- settings ----------

@app.get("/api/settings")
def get_settings():
    return jsonify({"new_cards_per_day": int(get_setting("new_cards_per_day", DEFAULT_NEW_CARDS_PER_DAY))})


@app.patch("/api/settings")
def update_settings():
    data = request.get_json(force=True) or {}
    if "new_cards_per_day" in data:
        try:
            value = int(data["new_cards_per_day"])
        except (TypeError, ValueError):
            return jsonify({"error": "new_cards_per_day должен быть числом"}), 400
        if value < 0:
            return jsonify({"error": "new_cards_per_day не может быть отрицательным"}), 400
        set_setting("new_cards_per_day", value)
    return jsonify({"new_cards_per_day": int(get_setting("new_cards_per_day", DEFAULT_NEW_CARDS_PER_DAY))})


# ---------- export / import ----------

@app.get("/api/export")
def export_data():
    lessons = [row_to_dict(r) for r in db().execute("SELECT * FROM lessons ORDER BY id").fetchall()]
    cards = [row_to_dict(r) for r in db().execute("SELECT * FROM cards ORDER BY id").fetchall()]
    return jsonify({"exported_at": now_str(), "lessons": lessons, "cards": cards})


@app.post("/api/import")
def import_data():
    data = request.get_json(force=True) or {}
    lessons = data.get("lessons") or []
    cards = data.get("cards") or []

    id_map = {}
    for lesson in lessons:
        name = (lesson.get("name") or "Без названия").strip() or "Без названия"
        cur = db().execute("INSERT INTO lessons (name) VALUES (?)", (name,))
        id_map[lesson.get("id")] = cur.lastrowid

    imported_cards = 0
    for card in cards:
        new_lesson_id = id_map.get(card.get("lesson_id"))
        phrase = (card.get("phrase") or "").strip()
        translation = (card.get("translation") or "").strip()
        if not new_lesson_id or not phrase or not translation:
            continue
        db().execute(
            """
            INSERT INTO cards (
                lesson_id, phrase, translation, note, ease_factor, interval_days,
                repetitions, lapses, due_at, last_reviewed_at, first_reviewed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_lesson_id,
                phrase,
                translation,
                card.get("note") or "",
                card.get("ease_factor", 2.5),
                card.get("interval_days", 0),
                card.get("repetitions", 0),
                card.get("lapses", 0),
                card.get("due_at") or now_str(),
                card.get("last_reviewed_at"),
                card.get("first_reviewed_at"),
            ),
        )
        imported_cards += 1
    db().commit()
    return jsonify({"lessons_imported": len(id_map), "cards_imported": imported_cards})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5052))
    app.run(host="0.0.0.0", port=port, debug=True)
