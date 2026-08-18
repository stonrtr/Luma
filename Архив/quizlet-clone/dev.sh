#!/bin/bash
cd "$(dirname "$0")"
exec npm run dev -- -p 3200
