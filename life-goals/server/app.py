"""Flask-бэкенд «Приоритеты» — личная канбан-доска целей.

Один пользователь, без аутентификации. Отдаёт статику клиента и JSON-API.
Запуск: python3 app.py (порт берётся из PORT, по умолчанию 5051).
"""

import os
from pathlib import Path

from flask import Flask, g, jsonify, request, send_from_directory

from db import get_db, init_db

BASE_DIR = Path(__file__).parent
CLIENT_DIR = BASE_DIR.parent / "client"

TIMEFRAMES = ("today", "week", "month", "none")
ARCHIVE_AFTER_DAYS = 7

# Задача «активна» (видна на доске), если она не выполнена, либо выполнена
# меньше 7 дней назад — тогда она ещё висит в трее «Выполнено за неделю».
CARD_ACTIVE_SQL = (
    "(cards.done = 0 OR cards.done_at IS NULL "
    "OR datetime(cards.done_at) > datetime('now', '-{} days'))"
).format(ARCHIVE_AFTER_DAYS)

app = Flask(__name__, static_folder=None)
# Обложки направлений грузятся как data URL — запросы бывают увесистыми.
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024
init_db()


def db():
    if "db" not in g:
        g.db = get_db()
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def rows(cursor):
    return [dict(r) for r in cursor.fetchall()]


def one(cursor):
    row = cursor.fetchone()
    return dict(row) if row else None


# --------------------------------------------------------------------------- #
#  Статика клиента                                                             #
# --------------------------------------------------------------------------- #

@app.get("/")
def index():
    return send_from_directory(CLIENT_DIR, "index.html")


@app.get("/static/<path:filename>")
def static_files(filename):
    return send_from_directory(CLIENT_DIR / "static", filename)


# --------------------------------------------------------------------------- #
#  Доска и архив                                                               #
# --------------------------------------------------------------------------- #

@app.get("/api/board")
def get_board():
    categories = rows(db().execute(
        "SELECT * FROM categories WHERE archived_at IS NULL ORDER BY sort_order, id"
    ))
    cards = rows(db().execute(
        f"""
        SELECT cards.* FROM cards
        JOIN categories ON categories.id = cards.category_id
        WHERE categories.archived_at IS NULL AND {CARD_ACTIVE_SQL}
        ORDER BY cards.sort_order, cards.id
        """
    ))
    goals = rows(db().execute(
        """
        SELECT goals.* FROM goals
        JOIN categories ON categories.id = goals.category_id
        WHERE categories.archived_at IS NULL
        ORDER BY goals.sort_order, goals.id
        """
    ))
    return jsonify({"categories": categories, "cards": cards, "goals": goals})


@app.get("/api/archive")
def get_archive():
    categories = rows(db().execute(
        "SELECT * FROM categories WHERE archived_at IS NOT NULL ORDER BY archived_at DESC, id"
    ))
    cards = rows(db().execute(
        """
        SELECT cards.*, categories.name AS category_name, categories.emoji AS category_emoji
        FROM cards
        JOIN categories ON categories.id = cards.category_id
        WHERE cards.done = 1
        ORDER BY cards.done_at DESC, cards.id DESC
        """
    ))
    return jsonify({"categories": categories, "cards": cards})


# --------------------------------------------------------------------------- #
#  Направления                                                                #
# --------------------------------------------------------------------------- #

@app.post("/api/categories")
def create_category():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Название обязательно"}), 400
    emoji = (data.get("emoji") or "").strip()
    max_order = db().execute(
        "SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories"
    ).fetchone()["m"]
    cur = db().execute(
        "INSERT INTO categories (emoji, name, sort_order) VALUES (?, ?, ?)",
        (emoji, name, max_order + 1),
    )
    db().commit()
    return jsonify(one(db().execute(
        "SELECT * FROM categories WHERE id = ?", (cur.lastrowid,)
    ))), 201


@app.patch("/api/categories/<int:cat_id>")
def update_category(cat_id):
    data = request.get_json(force=True) or {}
    current = one(db().execute("SELECT * FROM categories WHERE id = ?", (cat_id,)))
    if not current:
        return jsonify({"error": "Не найдено"}), 404

    fields = {}
    if "name" in data:
        name = (data["name"] or "").strip()
        if not name:
            return jsonify({"error": "Название обязательно"}), 400
        fields["name"] = name
    if "emoji" in data:
        fields["emoji"] = (data["emoji"] or "").strip()
    if "background_image" in data:
        fields["background_image"] = (data["background_image"] or "").strip()
    if "sort_order" in data:
        fields["sort_order"] = int(data["sort_order"])

    if fields:
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        db().execute(
            f"UPDATE categories SET {set_clause} WHERE id = ?",
            (*fields.values(), cat_id),
        )
        db().commit()
    return jsonify(one(db().execute(
        "SELECT * FROM categories WHERE id = ?", (cat_id,)
    )))


@app.delete("/api/categories/<int:cat_id>")
def archive_category(cat_id):
    db().execute(
        "UPDATE categories SET archived_at = datetime('now') WHERE id = ?", (cat_id,)
    )
    db().commit()
    return "", 204


@app.post("/api/categories/<int:cat_id>/restore")
def restore_category(cat_id):
    current = one(db().execute("SELECT * FROM categories WHERE id = ?", (cat_id,)))
    if not current:
        return jsonify({"error": "Не найдено"}), 404
    db().execute("UPDATE categories SET archived_at = NULL WHERE id = ?", (cat_id,))
    db().commit()
    return jsonify(one(db().execute(
        "SELECT * FROM categories WHERE id = ?", (cat_id,)
    )))


@app.delete("/api/categories/<int:cat_id>/purge")
def purge_category(cat_id):
    # goals/cards уходят каскадом (PRAGMA foreign_keys = ON в get_db).
    db().execute("DELETE FROM categories WHERE id = ?", (cat_id,))
    db().commit()
    return "", 204


# --------------------------------------------------------------------------- #
#  Цели направления                                                           #
# --------------------------------------------------------------------------- #

@app.post("/api/categories/<int:cat_id>/goals")
def create_goal(cat_id):
    data = request.get_json(force=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Текст обязателен"}), 400
    if not one(db().execute("SELECT id FROM categories WHERE id = ?", (cat_id,))):
        return jsonify({"error": "Направление не найдено"}), 400
    max_order = db().execute(
        "SELECT COALESCE(MAX(sort_order), -1) AS m FROM goals WHERE category_id = ?",
        (cat_id,),
    ).fetchone()["m"]
    cur = db().execute(
        "INSERT INTO goals (category_id, text, done, sort_order) VALUES (?, ?, 0, ?)",
        (cat_id, text, max_order + 1),
    )
    db().commit()
    return jsonify(one(db().execute(
        "SELECT * FROM goals WHERE id = ?", (cur.lastrowid,)
    ))), 201


@app.patch("/api/goals/<int:goal_id>")
def update_goal(goal_id):
    data = request.get_json(force=True) or {}
    if not one(db().execute("SELECT id FROM goals WHERE id = ?", (goal_id,))):
        return jsonify({"error": "Не найдено"}), 404

    fields = {}
    if "text" in data:
        text = (data["text"] or "").strip()
        if not text:
            return jsonify({"error": "Текст обязателен"}), 400
        fields["text"] = text
    if "done" in data:
        fields["done"] = 1 if data["done"] else 0

    if fields:
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        db().execute(
            f"UPDATE goals SET {set_clause} WHERE id = ?",
            (*fields.values(), goal_id),
        )
        db().commit()
    return jsonify(one(db().execute(
        "SELECT * FROM goals WHERE id = ?", (goal_id,)
    )))


@app.delete("/api/goals/<int:goal_id>")
def delete_goal(goal_id):
    db().execute("DELETE FROM goals WHERE id = ?", (goal_id,))
    db().commit()
    return "", 204


# --------------------------------------------------------------------------- #
#  Задачи                                                                     #
# --------------------------------------------------------------------------- #

@app.post("/api/cards")
def create_card():
    data = request.get_json(force=True) or {}
    title = (data.get("title") or "").strip()
    category_id = data.get("category_id")
    timeframe = data.get("timeframe")
    if not title:
        return jsonify({"error": "Текст обязателен"}), 400
    if timeframe not in TIMEFRAMES:
        return jsonify({"error": "Некорректный срок"}), 400
    if not one(db().execute("SELECT id FROM categories WHERE id = ?", (category_id,))):
        return jsonify({"error": "Направление не найдено"}), 400
    max_order = db().execute(
        "SELECT COALESCE(MAX(sort_order), -1) AS m FROM cards "
        "WHERE category_id = ? AND timeframe = ?",
        (category_id, timeframe),
    ).fetchone()["m"]
    cur = db().execute(
        "INSERT INTO cards (category_id, timeframe, done, title, sort_order) "
        "VALUES (?, ?, 0, ?, ?)",
        (category_id, timeframe, title, max_order + 1),
    )
    db().commit()
    return jsonify(one(db().execute(
        "SELECT * FROM cards WHERE id = ?", (cur.lastrowid,)
    ))), 201


@app.patch("/api/cards/<int:card_id>")
def update_card(card_id):
    data = request.get_json(force=True) or {}
    current = one(db().execute("SELECT * FROM cards WHERE id = ?", (card_id,)))
    if not current:
        return jsonify({"error": "Не найдено"}), 404

    fields = {}
    if "title" in data:
        title = (data["title"] or "").strip()
        if not title:
            return jsonify({"error": "Текст обязателен"}), 400
        fields["title"] = title
    if "done" in data:
        fields["done"] = 1 if data["done"] else 0
    if "timeframe" in data:
        if data["timeframe"] not in TIMEFRAMES:
            return jsonify({"error": "Некорректный срок"}), 400
        fields["timeframe"] = data["timeframe"]
    if "category_id" in data:
        if not one(db().execute(
            "SELECT id FROM categories WHERE id = ?", (data["category_id"],)
        )):
            return jsonify({"error": "Направление не найдено"}), 400
        fields["category_id"] = data["category_id"]

    # Перенос в другую ячейку (смена направления/срока) — ставим карточку
    # в конец новой ячейки, пересчитывая sort_order.
    if "timeframe" in fields or "category_id" in fields:
        new_cat = fields.get("category_id", current["category_id"])
        new_tf = fields.get("timeframe", current["timeframe"])
        max_order = db().execute(
            "SELECT COALESCE(MAX(sort_order), -1) AS m FROM cards "
            "WHERE category_id = ? AND timeframe = ? AND id != ?",
            (new_cat, new_tf, card_id),
        ).fetchone()["m"]
        fields["sort_order"] = max_order + 1

    if fields:
        set_parts = [f"{k} = ?" for k in fields]
        values = list(fields.values())
        # done_at ставим/сбрасываем в момент смены статуса — по нему идёт
        # обратный отсчёт 7 дней в трее «Выполнено за неделю».
        if "done" in fields:
            set_parts.append(
                "done_at = datetime('now')" if fields["done"] else "done_at = NULL"
            )
        values.append(card_id)
        db().execute(
            f"UPDATE cards SET {', '.join(set_parts)} WHERE id = ?", values
        )
        db().commit()

    return jsonify(one(db().execute(
        "SELECT * FROM cards WHERE id = ?", (card_id,)
    )))


@app.delete("/api/cards/<int:card_id>")
def delete_card(card_id):
    db().execute("DELETE FROM cards WHERE id = ?", (card_id,))
    db().commit()
    return "", 204


@app.errorhandler(413)
def too_large(_e):
    return jsonify({"error": "Файл слишком большой (максимум 8 МБ)"}), 413


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5051))
    app.run(host="0.0.0.0", port=port, debug=True)
