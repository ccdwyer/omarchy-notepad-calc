#!/bin/sh
# QML-runtime corpus. Requires qt6-declarative (`qml` / `qml6` / `qmlscene`).
# Linux CI installs it and must set REQUIRE_QML=1. macOS skips.

set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT/tests"

QML="${QML_BIN:-}"
if [ -n "${QML_BIN:-}" ]; then
  if [ -x "$QML_BIN" ]; then
    QML="$QML_BIN"
    PATH="$(CDPATH= cd -- "$(dirname "$QML_BIN")" && pwd)${PATH:+:$PATH}"
    export PATH
  elif command -v "$QML_BIN" >/dev/null 2>&1; then
    QML="$QML_BIN"
  fi
fi
if [ -z "$QML" ]; then
  for c in qml6 qml qmlscene; do
    if command -v "$c" >/dev/null 2>&1; then
      QML="$c"
      break
    fi
  done
fi

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
if [ "$STATUS" -ne 0 ]; then
  echo "qml runner failed (exit $STATUS)"
  exit 1
fi
if ! grep -q "corpus cases" "$LOG"; then
  echo "qml corpus missing completion marker"
  exit 1
fi
if ! grep -q "0 failed" "$LOG"; then
  echo "qml corpus did not report 0 failed"
  exit 1
fi
TOTAL=$(sed -n 's/.*(\([0-9][0-9]*\) corpus cases).*/\1/p' "$LOG" | tail -n 1)
if [ "${TOTAL:-0}" -lt 200 ]; then
  echo "qml corpus too small: $TOTAL"
  exit 1
fi
echo "ok  qml corpus via $QML"
rm -f "$LOG"
