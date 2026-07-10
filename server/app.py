import datetime
import functools
import os
import re
import secrets
import smtplib
from email.mime.text import MIMEText
from pathlib import Path

import jwt
from flask import Flask, g, jsonify, redirect, request, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash

import google_sync
from db import get_db, init_db

BASE_DIR = Path(__file__).parent
CLIENT_DIR = BASE_DIR.parent / "client"
DATA_DIR = Path(os.environ.get("DATA_DIR", BASE_DIR))
DATA_DIR.mkdir(parents=True, exist_ok=True)
SECRET_KEY_PATH = DATA_DIR / "secret.key"
ENV_PATH = BASE_DIR / ".env"

ARCHIVE_AFTER_DAYS = 7


def load_env_file(path):
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


load_env_file(ENV_PATH)

if SECRET_KEY_PATH.exists():
    SECRET_KEY = SECRET_KEY_PATH.read_text().strip()
else:
    SECRET_KEY = secrets.token_hex(32)
    SECRET_KEY_PATH.write_text(SECRET_KEY)

app = Flask(__name__, static_folder=None)
init_db()

STATUSES = {"ideas", "todo", "doing", "paused", "done"}
PRIORITIES = {1, 2, 3, 4, 5}
PLANNED_MINUTES_OPTIONS = {5, 15, 30, 60, 90, 120, 180}
PASSWORD_RULES = re.compile(r"^(?=.*[A-ZА-ЯІЇЄ])(?=.*[^A-Za-zА-Яа-яІіЇїЄє0-9]).{8,}$")
TIME_RULE = re.compile(r"^([01][0-9]|2[0-3]):[0-5][0-9]$")
WORK_HOURS_START = "09:00"
WORK_HOURS_END = "20:00"


def validate_start_time(value):
    """Returns None if valid (or empty), else an error message."""
    if not value:
        return None
    if not TIME_RULE.match(value):
        return "Неприпустимий формат часу"
    if not (WORK_HOURS_START <= value <= WORK_HOURS_END):
        return "Час початку має бути в межах робочого часу (09:00–20:00)"
    return None

NOT_ARCHIVED_SQL = (
    "NOT (status = 'done' AND done_at IS NOT NULL "
    f"AND datetime(done_at) <= datetime('now', '-{ARCHIVE_AFTER_DAYS} days'))"
)
ARCHIVED_SQL = (
    "status = 'done' AND done_at IS NOT NULL "
    f"AND datetime(done_at) <= datetime('now', '-{ARCHIVE_AFTER_DAYS} days')"
)


# ---------- email ----------

def send_invite_email(to_email, to_name, inviter_name, invite_link):
    host = os.environ.get("SMTP_HOST")
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASSWORD")
    sender = os.environ.get("SMTP_FROM") or user

    if not host or not user or not password:
        raise RuntimeError("SMTP не налаштовано: задайте SMTP_HOST/SMTP_USER/SMTP_PASSWORD у server/.env")

    subject = "Запрошення до команди — top superfoods"
    body = (
        f"Вітаємо, {to_name}!\n\n"
        f"{inviter_name} запросив(ла) вас приєднатися до команди top superfoods.\n\n"
        f"Перейдіть за посиланням, щоб створити пароль і розпочати роботу:\n{invite_link}\n"
    )
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to_email

    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=10) as smtp:
            smtp.login(user, password)
            smtp.sendmail(sender, [to_email], msg.as_string())
    else:
        with smtplib.SMTP(host, port, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(user, password)
            smtp.sendmail(sender, [to_email], msg.as_string())


# ---------- helpers ----------

def make_token(user_id):
    payload = {
        "user_id": user_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def login_required(view):
    @functools.wraps(view)
    def wrapped(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify(error="Токен відсутній"), 401
        token = auth.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        except jwt.PyJWTError:
            return jsonify(error="Токен недійсний або прострочений"), 401
        db = get_db()
        user = db.execute("SELECT * FROM users WHERE id = ?", (payload["user_id"],)).fetchone()
        db.close()
        if not user:
            return jsonify(error="Користувача не знайдено"), 401
        g.user = user
        return view(*args, **kwargs)
    return wrapped


def user_public(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "is_admin": bool(row["is_admin"]),
    }


def task_public(row):
    return {
        "id": row["id"],
        "owner_id": row["owner_id"],
        "title": row["title"],
        "description": row["description"],
        "status": row["status"],
        "priority": row["priority"],
        "start_date": row["start_date"],
        "start_time": row["start_time"],
        "due_date": row["due_date"],
        "planned_minutes": row["planned_minutes"],
        "position": row["position"],
        "done_at": row["done_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def call_public(row):
    return {
        "id": row["id"],
        "owner_id": row["owner_id"],
        "title": row["title"],
        "call_date": row["call_date"],
        "start_time": row["start_time"],
        "end_time": row["end_time"],
    }


def invite_public(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "created_at": row["created_at"],
    }


def resolve_target_user(db, requester, requested_id):
    """Returns the user_id whose data should be accessed, or None if not allowed."""
    if requested_id is None or requested_id == requester["id"]:
        return requester["id"]
    if not requester["is_admin"]:
        return None
    target = db.execute("SELECT manager_id FROM users WHERE id = ?", (requested_id,)).fetchone()
    if target and target["manager_id"] == requester["id"]:
        return requested_id
    return None


# ---------- auth routes ----------
# Публічної реєстрації немає: акаунти створюються лише через запрошення
# адміністратора (POST /api/invites) або скриптом server/bootstrap_admin.py
# для самого першого адміністратора (або через /api/setup/bootstrap-admin,
# якщо немає shell-доступу до сервера — див. README).

@app.post("/api/setup/bootstrap-admin")
def bootstrap_admin_remote():
    expected = os.environ.get("BOOTSTRAP_SECRET")
    if not expected:
        return jsonify(error="BOOTSTRAP_SECRET не задано на сервері"), 403
    provided = request.headers.get("X-Setup-Secret") or (request.get_json(silent=True) or {}).get("secret")
    if provided != expected:
        return jsonify(error="Немає доступу"), 403

    db = get_db()
    existing_admin = db.execute("SELECT id FROM users WHERE is_admin = 1 LIMIT 1").fetchone()
    if existing_admin:
        db.close()
        return jsonify(error="Адміністратор вже існує"), 409

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not name or not email:
        db.close()
        return jsonify(error="Вкажіть ім'я та email"), 400
    if not PASSWORD_RULES.match(password):
        db.close()
        return jsonify(error="Пароль має містити мінімум 8 символів, 1 велику літеру і 1 спецсимвол"), 400
    if db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone():
        db.close()
        return jsonify(error="Користувач з таким email вже існує"), 409

    db.execute(
        "INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, 1)",
        (name, email, generate_password_hash(password, method="pbkdf2:sha256")),
    )
    db.commit()
    db.close()
    return jsonify(ok=True), 201


@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    db.close()
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify(error="Невірний email або пароль"), 401
    return jsonify(token=make_token(user["id"]), user=user_public(user))


@app.get("/api/auth/me")
@login_required
def me():
    return jsonify(user=user_public(g.user))


# ---------- team routes ----------

@app.get("/api/team")
@login_required
def team():
    if not g.user["is_admin"]:
        return jsonify(team=[])
    db = get_db()
    rows = db.execute(
        "SELECT id, name, email FROM users WHERE manager_id = ? ORDER BY name", (g.user["id"],)
    ).fetchall()
    db.close()
    return jsonify(team=[dict(r) for r in rows])


# ---------- invites ----------

@app.post("/api/invites")
@login_required
def create_invite():
    if not g.user["is_admin"]:
        return jsonify(error="Запрошувати нових учасників може лише адміністратор"), 403

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    if not name or not email:
        return jsonify(error="Вкажіть ім'я та email"), 400

    db = get_db()
    existing_user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if existing_user:
        db.close()
        return jsonify(error="Користувач з таким email вже існує"), 409

    pending = db.execute(
        "SELECT 1 FROM invites WHERE email = ? AND accepted_at IS NULL", (email,)
    ).fetchone()
    if pending:
        db.close()
        return jsonify(error="Запрошення для цього email вже надіслано"), 409

    token = secrets.token_urlsafe(32)
    invite_link = f"{request.host_url.rstrip('/')}/?invite={token}"
    try:
        send_invite_email(email, name, g.user["name"], invite_link)
    except Exception as exc:
        db.close()
        return jsonify(error=f"Не вдалося надіслати лист: {exc}"), 502

    cur = db.execute(
        "INSERT INTO invites (name, email, token, invited_by) VALUES (?, ?, ?, ?)",
        (name, email, token, g.user["id"]),
    )
    db.commit()
    invite = db.execute("SELECT * FROM invites WHERE id = ?", (cur.lastrowid,)).fetchone()
    db.close()
    return jsonify(status="invited", invite=invite_public(invite)), 201


@app.get("/api/invites/<token>")
def get_invite(token):
    db = get_db()
    invite = db.execute(
        """SELECT i.*, u.name AS inviter_name FROM invites i
           JOIN users u ON u.id = i.invited_by WHERE i.token = ?""",
        (token,),
    ).fetchone()
    db.close()
    if not invite or invite["accepted_at"]:
        return jsonify(error="Запрошення недійсне або вже використане"), 404
    return jsonify(invite={
        "name": invite["name"],
        "email": invite["email"],
        "inviter_name": invite["inviter_name"],
    })


@app.post("/api/invites/<token>/accept")
def accept_invite(token):
    data = request.get_json(silent=True) or {}
    password = data.get("password") or ""

    db = get_db()
    invite = db.execute("SELECT * FROM invites WHERE token = ?", (token,)).fetchone()
    if not invite or invite["accepted_at"]:
        db.close()
        return jsonify(error="Запрошення недійсне або вже використане"), 404

    if not PASSWORD_RULES.match(password):
        db.close()
        return jsonify(error="Пароль має містити мінімум 8 символів, 1 велику літеру і 1 спецсимвол"), 400

    existing_user = db.execute("SELECT * FROM users WHERE email = ?", (invite["email"],)).fetchone()
    if existing_user:
        user_id = existing_user["id"]
    else:
        cur = db.execute(
            "INSERT INTO users (name, email, password_hash, manager_id) VALUES (?, ?, ?, ?)",
            (invite["name"], invite["email"], generate_password_hash(password, method="pbkdf2:sha256"), invite["invited_by"]),
        )
        user_id = cur.lastrowid

    db.execute("UPDATE invites SET accepted_at = datetime('now') WHERE id = ?", (invite["id"],))
    db.commit()
    user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    db.close()
    return jsonify(token=make_token(user_id), user=user_public(user))


# ---------- board / task routes ----------

@app.get("/api/board")
@login_required
def get_board():
    db = get_db()
    requested_id = request.args.get("user_id", type=int)
    target_id = resolve_target_user(db, g.user, requested_id)
    if target_id is None:
        db.close()
        return jsonify(error="Немає доступу"), 403

    rows = db.execute(
        f"SELECT * FROM tasks WHERE owner_id = ? AND {NOT_ARCHIVED_SQL} ORDER BY position ASC, created_at ASC",
        (target_id,),
    ).fetchall()
    db.close()
    return jsonify(tasks=[task_public(r) for r in rows], owner_id=target_id)


@app.get("/api/board/archived")
@login_required
def get_archived():
    db = get_db()
    requested_id = request.args.get("user_id", type=int)
    target_id = resolve_target_user(db, g.user, requested_id)
    if target_id is None:
        db.close()
        return jsonify(error="Немає доступу"), 403

    rows = db.execute(
        f"SELECT * FROM tasks WHERE owner_id = ? AND {ARCHIVED_SQL} ORDER BY done_at DESC",
        (target_id,),
    ).fetchall()
    db.close()
    return jsonify(tasks=[task_public(r) for r in rows])


@app.post("/api/tasks")
@login_required
def create_task():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify(error="Вкажіть назву завдання"), 400
    status = data.get("status") or "ideas"
    if status not in STATUSES:
        return jsonify(error="Неприпустимий статус"), 400
    if status != "ideas" and (not data.get("start_date") or not data.get("due_date")):
        return jsonify(error="Для цього статусу потрібно вказати дату початку і дедлайн"), 400

    priority = data.get("priority", 3)
    try:
        priority = int(priority)
    except (TypeError, ValueError):
        return jsonify(error="Неприпустимий пріоритет"), 400
    if priority not in PRIORITIES:
        return jsonify(error="Неприпустимий пріоритет"), 400

    planned_minutes = data.get("planned_minutes")
    if planned_minutes is not None:
        try:
            planned_minutes = int(planned_minutes)
        except (TypeError, ValueError):
            return jsonify(error="Неприпустимий план по часу"), 400
        if planned_minutes not in PLANNED_MINUTES_OPTIONS:
            return jsonify(error="Неприпустимий план по часу"), 400

    start_time = data.get("start_time")
    time_error = validate_start_time(start_time)
    if time_error:
        return jsonify(error=time_error), 400

    db = get_db()
    target_id = resolve_target_user(db, g.user, data.get("user_id"))
    if target_id is None:
        db.close()
        return jsonify(error="Немає доступу"), 403

    max_pos = db.execute(
        "SELECT COALESCE(MAX(position), -1) AS m FROM tasks WHERE owner_id = ? AND status = ?",
        (target_id, status),
    ).fetchone()["m"]

    done_at = datetime.datetime.utcnow().isoformat(timespec="seconds") if status == "done" else None

    cur = db.execute(
        """INSERT INTO tasks (owner_id, title, description, status, priority, start_date, start_time, due_date, planned_minutes, position, done_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            target_id,
            title,
            (data.get("description") or "").strip(),
            status,
            priority,
            data.get("start_date"),
            start_time,
            data.get("due_date"),
            planned_minutes,
            max_pos + 1,
            done_at,
        ),
    )
    db.commit()
    task = db.execute("SELECT * FROM tasks WHERE id = ?", (cur.lastrowid,)).fetchone()
    google_sync.sync_task_to_google(db, task)
    task = db.execute("SELECT * FROM tasks WHERE id = ?", (cur.lastrowid,)).fetchone()
    db.close()
    return jsonify(task=task_public(task)), 201


def _get_task_and_check(db, requester, task_id):
    task = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not task:
        return None
    target_id = resolve_target_user(db, requester, task["owner_id"])
    if target_id != task["owner_id"]:
        return None
    return task


@app.patch("/api/tasks/<int:task_id>")
@login_required
def update_task(task_id):
    data = request.get_json(silent=True) or {}
    db = get_db()
    task = _get_task_and_check(db, g.user, task_id)
    if not task:
        db.close()
        return jsonify(error="Не знайдено"), 404

    fields = {}
    if "title" in data:
        title = (data.get("title") or "").strip()
        if not title:
            db.close()
            return jsonify(error="Назва не може бути порожньою"), 400
        fields["title"] = title
    if "description" in data:
        fields["description"] = data.get("description") or ""
    if "status" in data:
        if data["status"] not in STATUSES:
            db.close()
            return jsonify(error="Неприпустимий статус"), 400
        fields["status"] = data["status"]
        if data["status"] == "done" and task["status"] != "done":
            fields["done_at"] = datetime.datetime.utcnow().isoformat(timespec="seconds")
        elif data["status"] != "done" and task["status"] == "done":
            fields["done_at"] = None
    if "priority" in data:
        try:
            priority = int(data.get("priority"))
        except (TypeError, ValueError):
            db.close()
            return jsonify(error="Неприпустимий пріоритет"), 400
        if priority not in PRIORITIES:
            db.close()
            return jsonify(error="Неприпустимий пріоритет"), 400
        fields["priority"] = priority
    if "start_date" in data:
        fields["start_date"] = data.get("start_date")
    if "start_time" in data:
        time_error = validate_start_time(data.get("start_time"))
        if time_error:
            db.close()
            return jsonify(error=time_error), 400
        fields["start_time"] = data.get("start_time")
    if "due_date" in data:
        fields["due_date"] = data.get("due_date")
    if "planned_minutes" in data:
        planned_minutes = data.get("planned_minutes")
        if planned_minutes is not None:
            try:
                planned_minutes = int(planned_minutes)
            except (TypeError, ValueError):
                db.close()
                return jsonify(error="Неприпустимий план по часу"), 400
            if planned_minutes not in PLANNED_MINUTES_OPTIONS:
                db.close()
                return jsonify(error="Неприпустимий план по часу"), 400
        fields["planned_minutes"] = planned_minutes
    if "position" in data:
        fields["position"] = data.get("position")
    if "user_id" in data and data["user_id"] is not None:
        new_owner = resolve_target_user(db, g.user, data["user_id"])
        if new_owner is None:
            db.close()
            return jsonify(error="Немає доступу до цього виконавця"), 403
        fields["owner_id"] = new_owner

    final_status = fields.get("status", task["status"])
    final_start_date = fields.get("start_date", task["start_date"])
    final_due_date = fields.get("due_date", task["due_date"])
    if final_status != "ideas" and (not final_start_date or not final_due_date):
        db.close()
        return jsonify(error="Для цього статусу потрібно вказати дату початку і дедлайн"), 400

    if fields:
        fields["updated_at"] = datetime.datetime.utcnow().isoformat(timespec="seconds")
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        db.execute(f"UPDATE tasks SET {set_clause} WHERE id = ?", (*fields.values(), task_id))
        db.commit()

    updated = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    google_sync.sync_task_to_google(db, updated)
    updated = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    db.close()
    return jsonify(task=task_public(updated))


@app.delete("/api/tasks/<int:task_id>")
@login_required
def delete_task(task_id):
    db = get_db()
    task = _get_task_and_check(db, g.user, task_id)
    if not task:
        db.close()
        return jsonify(error="Не знайдено"), 404
    google_sync.delete_task_event(db, task)
    db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    db.commit()
    db.close()
    return jsonify(ok=True)


def _add_minutes(hhmm, minutes):
    h, m = map(int, hhmm.split(":"))
    total = h * 60 + m + minutes
    total = max(0, min(total, 23 * 60 + 59))
    return f"{total // 60:02d}:{total % 60:02d}"


@app.get("/api/availability")
@login_required
def get_availability():
    db = get_db()
    requested_id = request.args.get("user_id", type=int)
    target_id = resolve_target_user(db, g.user, requested_id)
    if target_id is None:
        db.close()
        return jsonify(error="Немає доступу"), 403

    date = request.args.get("date")
    if not date:
        db.close()
        return jsonify(error="Вкажіть дату"), 400
    exclude_task_id = request.args.get("exclude_task_id", type=int)

    calls = db.execute(
        "SELECT title, start_time, end_time FROM calls WHERE owner_id = ? AND call_date = ?",
        (target_id, date),
    ).fetchall()

    task_query = "SELECT id, title, start_time, planned_minutes FROM tasks WHERE owner_id = ? AND start_date = ? AND start_time IS NOT NULL"
    params = [target_id, date]
    if exclude_task_id:
        task_query += " AND id != ?"
        params.append(exclude_task_id)
    tasks = db.execute(task_query, params).fetchall()
    db.close()

    busy = []
    for c in calls:
        busy.append({"title": c["title"], "start_time": c["start_time"], "end_time": c["end_time"], "type": "call"})
    for t in tasks:
        duration = t["planned_minutes"] or 30
        busy.append({
            "title": t["title"],
            "start_time": t["start_time"],
            "end_time": _add_minutes(t["start_time"], duration),
            "type": "task",
        })

    return jsonify(busy=busy)


# ---------- calls routes ----------

@app.get("/api/calls")
@login_required
def list_calls():
    db = get_db()
    requested_id = request.args.get("user_id", type=int)
    target_id = resolve_target_user(db, g.user, requested_id)
    if target_id is None:
        db.close()
        return jsonify(error="Немає доступу"), 403

    week_start = request.args.get("week_start")
    week_end = request.args.get("week_end")
    if week_start and week_end:
        rows = db.execute(
            "SELECT * FROM calls WHERE owner_id = ? AND call_date BETWEEN ? AND ? ORDER BY call_date, start_time",
            (target_id, week_start, week_end),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM calls WHERE owner_id = ? ORDER BY call_date, start_time", (target_id,)
        ).fetchall()
    db.close()
    return jsonify(calls=[call_public(r) for r in rows])


@app.post("/api/calls")
@login_required
def create_call():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    call_date = data.get("call_date")
    start_time = data.get("start_time")
    end_time = data.get("end_time")
    if not title or not call_date or not start_time or not end_time:
        return jsonify(error="Вкажіть назву, дату та час початку/кінця дзвінка"), 400

    db = get_db()
    target_id = resolve_target_user(db, g.user, data.get("user_id"))
    if target_id is None:
        db.close()
        return jsonify(error="Немає доступу"), 403

    cur = db.execute(
        "INSERT INTO calls (owner_id, title, call_date, start_time, end_time) VALUES (?, ?, ?, ?, ?)",
        (target_id, title, call_date, start_time, end_time),
    )
    db.commit()
    call = db.execute("SELECT * FROM calls WHERE id = ?", (cur.lastrowid,)).fetchone()
    db.close()
    return jsonify(call=call_public(call)), 201


def _get_call_and_check(db, requester, call_id):
    call = db.execute("SELECT * FROM calls WHERE id = ?", (call_id,)).fetchone()
    if not call:
        return None
    target_id = resolve_target_user(db, requester, call["owner_id"])
    if target_id != call["owner_id"]:
        return None
    return call


@app.patch("/api/calls/<int:call_id>")
@login_required
def update_call(call_id):
    data = request.get_json(silent=True) or {}
    db = get_db()
    call = _get_call_and_check(db, g.user, call_id)
    if not call:
        db.close()
        return jsonify(error="Не знайдено"), 404

    fields = {}
    for key in ("title", "call_date", "start_time", "end_time"):
        if key in data:
            fields[key] = data[key]

    if fields:
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        db.execute(f"UPDATE calls SET {set_clause} WHERE id = ?", (*fields.values(), call_id))
        db.commit()

    updated = db.execute("SELECT * FROM calls WHERE id = ?", (call_id,)).fetchone()
    db.close()
    return jsonify(call=call_public(updated))


@app.delete("/api/calls/<int:call_id>")
@login_required
def delete_call(call_id):
    db = get_db()
    call = _get_call_and_check(db, g.user, call_id)
    if not call:
        db.close()
        return jsonify(error="Не знайдено"), 404
    db.execute("DELETE FROM calls WHERE id = ?", (call_id,))
    db.commit()
    db.close()
    return jsonify(ok=True)


# ---------- google calendar routes ----------

def make_google_state(user_id):
    payload = {
        "user_id": user_id,
        "purpose": "google_connect",
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=10),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


@app.get("/api/google/status")
@login_required
def google_status():
    db = get_db()
    row = db.execute(
        "SELECT connected_at FROM google_accounts WHERE user_id = ?", (g.user["id"],)
    ).fetchone()
    db.close()
    return jsonify(
        configured=google_sync.is_configured(),
        connected=bool(row),
        connected_at=row["connected_at"] if row else None,
    )


@app.get("/api/google/connect")
def google_connect():
    if not google_sync.is_configured():
        return (
            "<p style='font-family:sans-serif;padding:40px;text-align:center'>"
            "Google OAuth ще не налаштовано на сервері (потрібні GOOGLE_CLIENT_ID / "
            "GOOGLE_CLIENT_SECRET у server/.env).<br><br>"
            "<a href='/'>← Повернутися</a></p>",
            500,
        )
    token = request.args.get("token", "")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload["user_id"]
    except jwt.PyJWTError:
        return jsonify(error="Недійсний токен"), 401

    flow = google_sync.build_flow()
    state = make_google_state(user_id)
    auth_url, _ = flow.authorization_url(
        access_type="offline", include_granted_scopes="true", prompt="consent", state=state
    )
    return redirect(auth_url)


@app.get("/api/google/callback")
def google_callback():
    state = request.args.get("state", "")
    code = request.args.get("code")
    try:
        payload = jwt.decode(state, SECRET_KEY, algorithms=["HS256"])
        user_id = payload["user_id"]
    except jwt.PyJWTError:
        return redirect("/?google_status=error")
    if not code:
        return redirect("/?google_status=error")

    try:
        flow = google_sync.build_flow()
        flow.fetch_token(code=code)
        db = get_db()
        google_sync.save_credentials(db, user_id, flow.credentials)
        db.close()
    except Exception as exc:
        print(f"[google_sync] OAuth callback failed: {exc}")
        return redirect("/?google_status=error")

    return redirect("/?google_status=connected")


@app.post("/api/google/disconnect")
@login_required
def google_disconnect():
    db = get_db()
    db.execute("DELETE FROM google_accounts WHERE user_id = ?", (g.user["id"],))
    db.commit()
    db.close()
    return jsonify(ok=True)


@app.get("/api/google/busy")
@login_required
def google_busy():
    db = get_db()
    requested_id = request.args.get("user_id", type=int)
    target_id = resolve_target_user(db, g.user, requested_id)
    if target_id is None:
        db.close()
        return jsonify(error="Немає доступу"), 403

    date = request.args.get("date")
    if not date:
        db.close()
        return jsonify(error="Вкажіть дату"), 400

    creds = google_sync.get_credentials_for_user(db, target_id)
    db.close()
    if not creds:
        return jsonify(connected=False, busy=[])

    try:
        busy = google_sync.get_freebusy_for_day(creds, date)
    except Exception as exc:
        return jsonify(error=f"Не вдалося отримати дані Google Calendar: {exc}"), 502
    return jsonify(connected=True, busy=busy)


# ---------- static frontend ----------

@app.get("/")
@app.get("/<path:path>")
def serve_client(path="index.html"):
    full = CLIENT_DIR / path
    if not full.exists() or full.is_dir():
        path = "index.html"
    return send_from_directory(CLIENT_DIR, path)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
