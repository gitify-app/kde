#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
mkdir -p dist
rm -f dist/gitify.kwinscript
cd gitify
python3 -m zipfile -c ../dist/gitify.kwinscript metadata.json contents
printf 'Built dist/gitify.kwinscript\n'
