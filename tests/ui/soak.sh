#!/bin/sh
# CI-only 500-line keystroke soak. Samples RSS of the qml process.
# Duration: first numeric arg or NOTEPAD_CALC_SOAK_MS (default 3600000).
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
MS="${1:-${NOTEPAD_CALC_SOAK_MS:-3600000}}"

QML="${QML_BIN:-}"
if [ -z "$QML" ]; then
  for c in qml6 qml qmlscene; do
    if command -v "$c" >/dev/null 2>&1; then QML="$c"; break; fi
  done
fi
if [ -n "${QML_BIN:-}" ] && [ -x "$QML_BIN" ]; then
  QML="$QML_BIN"
  PATH="$(CDPATH= cd -- "$(dirname "$QML_BIN")" && pwd):$PATH"
fi
if [ -z "$QML" ]; then
  echo "skip soak: no qml runtime (CI-only)"
  if [ "${REQUIRE_QML_UI:-}" = "1" ]; then exit 1; fi
  exit 0
fi

export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-offscreen}"
export NOTEPAD_CALC_TEST=1
export QML2_IMPORT_PATH="$ROOT/tests/stubs${QML2_IMPORT_PATH:+:$QML2_IMPORT_PATH}"
export QML_IMPORT_PATH="$QML2_IMPORT_PATH"
mkdir -p /tmp/notepad-calc-ci-home/.local/share/notepad-calc

LOG=$(mktemp)
"$QML" -I "$ROOT" -I "$ROOT/tests/stubs" "$ROOT/tests/ui/SoakTest.qml" "$MS" >"$LOG" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT

START_KB=""
i=0
while kill -0 "$PID" 2>/dev/null; do
  if [ -r "/proc/$PID/status" ]; then
    KB=$(awk '/VmRSS:/{print $2}' "/proc/$PID/status")
    if [ -z "$START_KB" ] && [ -n "$KB" ]; then START_KB=$KB; fi
    END_KB=$KB
  fi
  i=$((i + 1))
  if [ "$i" -gt $((MS / 100 + 50)) ]; then
    echo "FAIL soak watchdog exceeded"
    cat "$LOG"
    exit 1
  fi
  sleep 0.1
done
wait "$PID" || true
cat "$LOG"

if ! grep -q "ok  soak keystroke replay finished" "$LOG"; then
  echo "FAIL soak completion marker missing"
  exit 1
fi
if ! grep -q "SOAK_LINES " "$LOG"; then
  echo "FAIL soak did not report line count"
  exit 1
fi
LINES=$(awk '/SOAK_LINES/{print $2}' "$LOG" | tail -n 1)
if [ "${LINES:-0}" -lt 500 ]; then
  echo "FAIL soak lines $LINES"
  exit 1
fi

ATTEMPTS=$(grep -c "RATES_ATTEMPT " "$LOG" || true)
if [ "$ATTEMPTS" -gt 1 ]; then
  echo "FAIL refresh journal: $ATTEMPTS attempts (want <= 1)"
  exit 1
fi
echo "ok  refresh journal attempts=$ATTEMPTS"

if [ -n "${START_KB:-}" ] && [ -n "${END_KB:-}" ]; then
  GROWTH=$((END_KB - START_KB))
  echo "RSS start=${START_KB}kB end=${END_KB}kB growth=${GROWTH}kB"
  if [ "$GROWTH" -gt 5120 ]; then
    echo "FAIL RSS growth ${GROWTH}kB exceeds 5MB"
    exit 1
  fi
  echo "ok  soak RSS growth ${GROWTH}kB < 5MB"
else
  echo "WARN no /proc RSS (non-Linux); skipped numeric RSS gate"
fi
echo "ok  soak"
