import sys

from werkzeug.security import generate_password_hash

from app import PASSWORD_RULES
from db import get_db, init_db


def main():
    if len(sys.argv) != 4:
        print("Використання: python3 bootstrap_admin.py <ім'я> <email> <пароль>")
        sys.exit(1)

    name, email, password = sys.argv[1], sys.argv[2].strip().lower(), sys.argv[3]

    if not PASSWORD_RULES.match(password):
        print("Пароль має містити мінімум 8 символів, 1 велику літеру і 1 спецсимвол")
        sys.exit(1)

    init_db()
    db = get_db()
    existing = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        print(f"Користувач з email {email} вже існує.")
        sys.exit(1)

    db.execute(
        "INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, 1)",
        (name, email, generate_password_hash(password, method="pbkdf2:sha256")),
    )
    db.commit()
    db.close()
    print(f"Створено адміністратора {email}. Тепер можна увійти і запрошувати нових учасників команди.")


if __name__ == "__main__":
    main()
