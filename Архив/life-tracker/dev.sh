#!/bin/bash
# Запуск додатку. Просто виконай:  ./dev.sh
# Відкриється на http://localhost:3300  (вхід: admin@worksection.local / Password1!)
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
cd "$(dirname "$0")" || exit 1
exec npm run dev
