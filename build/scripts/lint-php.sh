#!/bin/sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
command -v php >/dev/null 2>&1 || { echo 'PHP is required for lint.' >&2; exit 1; }
LIST="$(mktemp)"
trap 'rm -f "$LIST"' EXIT HUP INT TERM
find "$ROOT/src" "$ROOT/build" -path '*/node_modules' -prune -o -type f -name '*.php' -print > "$LIST"
while IFS= read -r file; do php -l "$file" >/dev/null || exit 1; done < "$LIST"
echo 'PHP syntax: PASS'
