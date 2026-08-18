#!/bin/bash
cd "$(dirname "$0")"
export DATABASE_URL="file:$(pwd)/prisma/recall.db"
exec npm run dev -- -p 3600
