#!/bin/sh
# QML-runtime corpus. Requires qt6-declarative (`qml` / `qml6` / `qmlscene`).
# Linux CI installs it; macOS skips with an explicit message.

set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT/tests"

QML=""
for c in qml6 qml qmlscene; do
  if command -v "$c" >/dev/null 2>&1; then
    QML="$c"
    break
  fi
done

if [ -z "$QML" ]; then
  echo "skip qml corpus: no qml6/qml/qmlscene on PATH (install qt6-declarative on Linux CI)"
  if [ "${REQUIRE_QML:-}" = "1" ]; then
    exit 1
  fi
  exit 0
fi

LOG=$(mktemp)
set +e
"$QML" EngineTest.qml >"$LOG" 2>&1
STATUS=$?
set -e
cat "$LOG"
if grep -q "FAIL " "$LOG"; then
  echo "qml corpus reported FAIL"
  exit 1
fi
if ! grep -q "passed" "$LOG" && [ "$STATUS" -ne 0 ]; then
  echo "qml runner failed (exit $STATUS)"
  exit 1
fi
echo "ok  qml corpus via $QML"
rm -f "$LOG"
