import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "board.db"

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
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            emoji TEXT NOT NULL DEFAULT '',
            name TEXT NOT NULL,
            background_image TEXT NOT NULL DEFAULT '',
            sort_order INTEGER NOT NULL DEFAULT 0,
            archived_at TEXT
        );

        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            done INTEGER NOT NULL DEFAULT 0,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
            timeframe TEXT NOT NULL CHECK(timeframe IN ('today','week','month','none')),
            done INTEGER NOT NULL DEFAULT 0,
            done_at TEXT,
            title TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        """
    )

    # BEGIN IMMEDIATE serializes this migration against other processes racing
    # to run it concurrently (e.g. the dev-server reloader restarting mid-edit).
    conn.execute("BEGIN IMMEDIATE")

    cat_columns = [r["name"] for r in conn.execute("PRAGMA table_info(categories)").fetchall()]
    if "background_image" not in cat_columns:
        conn.execute("ALTER TABLE categories ADD COLUMN background_image TEXT NOT NULL DEFAULT ''")
    if "archived_at" not in cat_columns:
        conn.execute("ALTER TABLE categories ADD COLUMN archived_at TEXT")
    if "goal" in cat_columns:
        rows = conn.execute("SELECT id, goal FROM categories WHERE goal IS NOT NULL AND trim(goal) != ''").fetchall()
        for row in rows:
            conn.execute(
                "INSERT INTO goals (category_id, text, done, sort_order) VALUES (?, ?, 0, 0)",
                (row["id"], row["goal"]),
            )
        conn.execute("ALTER TABLE categories DROP COLUMN goal")

    card_columns = [r["name"] for r in conn.execute("PRAGMA table_info(cards)").fetchall()]
    if "status" in card_columns:
        if "done" not in card_columns:
            conn.execute("ALTER TABLE cards ADD COLUMN done INTEGER NOT NULL DEFAULT 0")
        conn.execute("UPDATE cards SET done = CASE WHEN status = 'done' THEN 1 ELSE 0 END")
        conn.execute("ALTER TABLE cards DROP COLUMN status")
    if "done_at" not in card_columns:
        conn.execute("ALTER TABLE cards ADD COLUMN done_at TEXT")
        conn.execute("UPDATE cards SET done_at = updated_at WHERE done = 1")

    count = conn.execute("SELECT COUNT(*) AS c FROM categories").fetchone()["c"]
    if count == 0:
        for i, (emoji, name) in enumerate(SEED_CATEGORIES):
            conn.execute(
                "INSERT INTO categories (emoji, name, sort_order) VALUES (?, ?, ?)",
                (emoji, name, i),
            )
    conn.commit()
    conn.close()
