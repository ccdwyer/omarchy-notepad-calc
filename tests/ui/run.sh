#!/bin/sh
# CI-only UI captures. Skips on machines without qml/qt.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
OUT="$ROOT/tests/goldens/ui"
mkdir -p "$OUT" "$ROOT/tests/ui/out"

QML="${QML_BIN:-}"
if [ -z "$QML" ]; then
  for c in qml6 qml qmlscene; do
    if command -v "$c" >/dev/null 2>&1; then QML="$c"; break; fi
  done
fi
if [ -n "${QML_BIN:-}" ]; then
  if [ -x "$QML_BIN" ]; then
    QML="$QML_BIN"
    PATH="$(CDPATH= cd -- "$(dirname "$QML_BIN")" && pwd):$PATH"
  fi
fi

if [ -z "$QML" ]; then
  echo "skip ui test: no qml runtime (CI-only on Linux with qt6-declarative)"
  if [ "${REQUIRE_QML_UI:-}" = "1" ]; then exit 1; fi
  exit 0
fi

export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-offscreen}"
export NOTEPAD_CALC_TEST=1
export QML2_IMPORT_PATH="$ROOT/tests/stubs${QML2_IMPORT_PATH:+:$QML2_IMPORT_PATH}"
export QML_IMPORT_PATH="$QML2_IMPORT_PATH"

mkdir -p /tmp/notepad-calc-ci-home/.local/share/notepad-calc/sheets
cp "$ROOT/data/first-run.calc" /tmp/notepad-calc-ci-home/.local/share/notepad-calc/sheets/battlestation.calc

LOG=$(mktemp)
set +e
"$QML" -I "$ROOT" -I "$ROOT/tests/stubs" "$ROOT/tests/ui/UiTest.qml" >"$LOG" 2>&1
STATUS=$?
set -e
cat "$LOG"
if grep -q "FAIL " "$LOG"; then
  echo "ui test reported FAIL"
  exit 1
fi
if [ "$STATUS" -ne 0 ]; then
  echo "ui qml exit $STATUS"
  exit 1
fi
if ! grep -q "ok  ui panel grabs" "$LOG"; then
  echo "ui test missing completion marker"
  exit 1
fi

python3 "$ROOT/tests/ui/pixeldiff.py" "$OUT" "$OUT"
echo "ok  ui pixel diffs"
