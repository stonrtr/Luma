"""SQLite storage for «Приоритеты».

Единственная БД — файл board.db рядом с этим модулем. ORM нет: работаем сырым
SQL через стандартный sqlite3. Схема создаётся и мигрируется в init_db(), которая
идемпотентна и вызывается при каждом старте приложения.
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "board.db"

# Начальные направления — добавляются только если таблица categories пуста,
# то есть при самом первом запуске (или после полного сброса базы).
SEED_CATEGORIES = [
    ("❤️", "Здоровье"),
    ("💰", "Финансы"),
    ("🇬🇧", "Английский"),
    ("💼", "Карьера"),
    ("🏆", "Спорт"),
    ("🎤", "Ораторское"),
    ("🧠", "Развитие"),
    ("🎮", "Хобби"),
]


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # ON DELETE CASCADE для goals/cards работает только при включённых внешних ключах.
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS categories (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            emoji            TEXT    NOT NULL DEFAULT '',
            name             TEXT    NOT NULL,
            background_image TEXT    NOT NULL DEFAULT '',
            sort_order       INTEGER NOT NULL DEFAULT 0,
            archived_at      TEXT
        );

        CREATE TABLE IF NOT EXISTS goals (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
            text        TEXT    NOT NULL,
            done        INTEGER NOT NULL DEFAULT 0,
            sort_order  INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS cards (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
            timeframe   TEXT    NOT NULL CHECK (timeframe IN ('today','week','month','none')),
            done        INTEGER NOT NULL DEFAULT 0,
            done_at     TEXT,
            title       TEXT    NOT NULL,
            sort_order  INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_cards_category  ON cards (category_id);
        CREATE INDEX IF NOT EXISTS idx_goals_category  ON goals (category_id);
        """
    )

    count = conn.execute("SELECT COUNT(*) AS c FROM categories").fetchone()["c"]
    if count == 0:
        for i, (emoji, name) in enumerate(SEED_CATEGORIES):
            conn.execute(
                "INSERT INTO categories (emoji, name, sort_order) VALUES (?, ?, ?)",
                (emoji, name, i),
            )

    conn.commit()
    conn.close()
