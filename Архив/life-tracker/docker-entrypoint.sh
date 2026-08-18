#!/bin/sh
# Запуск в контейнере: применяем схему к Postgres, создаём админа, стартуем Next.
set -e

echo "→ prisma db push (создание/обновление схемы в Postgres)"
npx prisma db push --schema=./prisma/schema.prisma

echo "→ ensure admin (идемпотентно, из ADMIN_* env)"
npx tsx scripts/ensure-admin.ts || echo "  ensure-admin пропущен/ошибка — продолжаем"

echo "→ next start на порту ${PORT:-3100}"
exec npx next start -p "${PORT:-3100}" -H 0.0.0.0
