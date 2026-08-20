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

# Quattro shell call invokes methods on the loaded entry point (BarWidget root),
# not only on a nested IpcHandler.
ROOT_QML=$(awk 'BEGIN{p=1} /IpcHandler/{p=0} p' "$ROOT/BarWidget.qml")
echo "$ROOT_QML" | grep -q 'function summon('
echo "$ROOT_QML" | grep -q 'function hide('
echo "$ROOT_QML" | grep -q 'function toggle('
echo "ok  BarWidget root summon/hide/toggle"

# Archive-based submission must not include gitignored review logs, bin/, or target/.
# Use `git archive` (see pack.sh); never tar the working tree.
for p in \
  bin/notepad-calc-rates \
  src/rates-refresh/target/ \
  .fix_prompt_r5.md \
  .gpt_review_r5.md \
  .review_prompt5.md \
  .serena/
do
  printf '%s\n' "$p" | git -C "$ROOT" check-ignore -q --stdin || {
    echo "FAIL $p is not gitignored (would leak into a working-tree archive)"
    exit 1
  }
done
echo "ok  gitignore excludes bin/target/review logs"

LIST=$(mktemp)
git -C "$ROOT" archive --format=tar HEAD | tar -t >"$LIST"
if grep -E '^(bin/|src/rates-refresh/target/|\.serena/|\.fix_prompt|\.gpt_review|\.review_prompt|\.impl_prompt)' "$LIST"; then
  echo "FAIL git archive contains excluded submission junk"
  rm -f "$LIST"
  exit 1
fi
rm -f "$LIST"
echo "ok  git archive excludes bin/target/review logs"
