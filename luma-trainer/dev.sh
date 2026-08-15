#!/bin/bash
cd "$(dirname "$0")"
export DATABASE_URL="file:$(pwd)/prisma/luma.db"
exec npm run dev -- -p 3400
