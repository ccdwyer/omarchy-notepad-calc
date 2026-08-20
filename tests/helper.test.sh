#!/bin/sh
# Off-device helper tests: parse a fixture XML, no network.

set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
FIX="$ROOT/tests/fixtures/ecb-daily.xml"
OUT="${TMPDIR:-/tmp}/notepad-calc-test-rates.json"
SH="$ROOT/compat/rates-refresh.sh"

chmod +x "$SH"
"$SH" fetch --xml "$FIX" --out "$OUT"

grep -q '"date": "2026-08-18"' "$OUT"
grep -q '"USD": 1.1600' "$OUT"
grep -q '"base": "EUR"' "$OUT"
echo "ok  helper shell parse"

if [ -x "$ROOT/bin/notepad-calc-rates" ]; then
  "$ROOT/bin/notepad-calc-rates" fetch --xml "$FIX" --out "$OUT"
  grep -q '"date": "2026-08-18"' "$OUT"
  echo "ok  helper binary parse"
else
  echo "skip helper binary (not built)"
fi
