#!/bin/sh
# CI-only UI captures. Writes PNGs to a TEMP dir, diffs against committed goldens.
# Goldens must be Linux Item.grabToImage captures of Panel.qml chrome — not stand-ins.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
GOLD="$ROOT/tests/goldens/ui"

# shellcheck disable=SC1091
. "$ROOT/tests/ui/setup-qml-env.sh"

if [ "${REQUIRE_QML_UI:-}" != "1" ] && [ -z "${QML_BIN:-}" ]; then
  echo "skip ui test: no qml runtime (CI-only on Linux)"
  exit 0
fi

if [ -z "${QML_BIN:-}" ]; then
  echo "FAIL no qml runtime (acceptance is Linux CI with qt6-declarative + Quickshell)"
  exit 1
fi

if [ "${REQUIRE_QML_UI:-}" = "1" ]; then
  if [ -z "${QS_QML_ROOT:-}" ] || [ ! -f "$QS_QML_ROOT/Quickshell/qmldir" ]; then
    echo "FAIL real Quickshell QML module is required for UI acceptance (stubs are unit-only)"
    exit 1
  fi
fi

case ":${QML2_IMPORT_PATH:-}:" in
  *unit-stubs*)
    echo "FAIL tests/unit-stubs must not be on the UI acceptance import path"
    exit 1
    ;;
esac

export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-offscreen}"
export NOTEPAD_CALC_TEST=1

CAP=$(mktemp -d)
trap 'rm -rf "$CAP"' EXIT

I_FLAGS="-I $ROOT"
if [ -n "${QS_QML_ROOT:-}" ]; then
  I_FLAGS="$I_FLAGS -I $QS_QML_ROOT"
fi
I_FLAGS="$I_FLAGS -I $ROOT/tests/stubs"

LOG=$(mktemp)
set +e
# shellcheck disable=SC2086
"$QML_BIN" $I_FLAGS "$ROOT/tests/ui/UiTest.qml" "$CAP" >"$LOG" 2>&1
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

CAPTURE_COUNT=$(ls -1 "$CAP"/*.png 2>/dev/null | wc -l | tr -d ' ')
if [ "$CAPTURE_COUNT" -lt 12 ]; then
  echo "FAIL expected 12 captures in temp dir, got $CAPTURE_COUNT"
  exit 1
fi

if [ -n "${NOTEPAD_CALC_UI_ARTIFACT_DIR:-}" ]; then
  mkdir -p "$NOTEPAD_CALC_UI_ARTIFACT_DIR"
  cp "$CAP"/*.png "$NOTEPAD_CALC_UI_ARTIFACT_DIR/"
fi

if [ "${UPDATE_UI_GOLDENS:-}" = "1" ]; then
  mkdir -p "$GOLD"
  cp "$CAP"/*.png "$GOLD/"
  echo "updated goldens in $GOLD from Item.grabToImage"
  exit 0
fi

python3 "$ROOT/tests/ui/pixeldiff.py" "$CAP" "$GOLD"
echo "ok  ui pixel diffs vs committed goldens"
