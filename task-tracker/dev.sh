#!/bin/bash
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
source "$NVM_DIR/nvm.sh"
cd "$(dirname "$0")"
exec npm run dev
