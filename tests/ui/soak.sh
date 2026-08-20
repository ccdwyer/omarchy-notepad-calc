#!/bin/sh
# CI-only 500-line keystroke soak. Samples RSS of the qml process.
# Duration: first numeric arg or NOTEPAD_CALC_SOAK_MS (default 3600000 = 1 hour).
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
MS="${1:-${NOTEPAD_CALC_SOAK_MS:-3600000}}"

# shellcheck disable=SC1091
. "$ROOT/tests/ui/setup-qml-env.sh"

if [ "${REQUIRE_QML_UI:-}" != "1" ] && [ -z "${QML_BIN:-}" ]; then
  echo "skip soak: no qml runtime (CI-only)"
  exit 0
fi

if [ -z "${QML_BIN:-}" ]; then
  echo "skip soak: no qml runtime (CI-only)"
  if [ "${REQUIRE_QML_UI:-}" = "1" ]; then exit 1; fi
  exit 0
fi

if [ "${REQUIRE_QML_UI:-}" = "1" ]; then
  if [ -z "${QS_QML_ROOT:-}" ] || [ ! -f "$QS_QML_ROOT/Quickshell/qmldir" ]; then
    echo "FAIL real Quickshell QML module is required for soak acceptance"
    exit 1
  fi
fi

case ":${QML2_IMPORT_PATH:-}:" in
  *unit-stubs*)
    echo "FAIL tests/unit-stubs must not be on the soak acceptance import path"
    exit 1
    ;;
esac

export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-offscreen}"
export NOTEPAD_CALC_TEST=1
mkdir -p /tmp/notepad-calc-ci-home/.local/share/notepad-calc

I_FLAGS="-I $ROOT"
if [ -n "${QS_QML_ROOT:-}" ]; then
  I_FLAGS="$I_FLAGS -I $QS_QML_ROOT"
fi
I_FLAGS="$I_FLAGS -I $ROOT/tests/stubs"

LOG=$(mktemp)
# shellcheck disable=SC2086
"$QML_BIN" $I_FLAGS "$ROOT/tests/ui/SoakTest.qml" "$MS" >"$LOG" 2>&1 &
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
if [ "$ATTEMPTS" -lt 1 ]; then
  echo "FAIL refresh journal: daily attempt path never ran"
  exit 1
fi
if [ "$ATTEMPTS" -gt 1 ]; then
  echo "FAIL refresh journal: $ATTEMPTS attempts (want exactly 1)"
  exit 1
fi
echo "ok  refresh journal attempts=$ATTEMPTS (exactly 1)"

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
echo "ok  soak ${MS}ms"
