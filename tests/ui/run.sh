#!/bin/sh
# CI-only UI captures. Writes PNGs to a TEMP dir, diffs against committed goldens.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
GOLD="$ROOT/tests/goldens/ui"

require_qml() {
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
    echo "FAIL no qml runtime (acceptance is Linux CI with qt6-declarative)"
    exit 1
  fi
}

require_quickshell() {
  if command -v quickshell >/dev/null 2>&1; then return 0; fi
  if ls "$HOME/.nix-profile/lib"/qt-*/qml/Quickshell/qmldir >/dev/null 2>&1; then return 0; fi
  if find /nix/store "$HOME/.nix-profile" /usr/lib -name qmldir 2>/dev/null | grep -q '/Quickshell/qmldir'; then return 0; fi
  echo "FAIL real Quickshell is required for UI acceptance (stubs are unit-only)"
  exit 1
}

if [ "${REQUIRE_QML_UI:-}" != "1" ] && ! command -v qml6 >/dev/null 2>&1 && ! command -v qml >/dev/null 2>&1; then
  echo "skip ui test: no qml runtime (CI-only on Linux)"
  exit 0
fi

require_qml
if [ "${REQUIRE_QML_UI:-}" = "1" ]; then
  require_quickshell
fi

export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-offscreen}"
export NOTEPAD_CALC_TEST=1
# Omarchy theme tokens only — do NOT import tests/unit-stubs/Quickshell.
export QML2_IMPORT_PATH="$ROOT/tests/stubs${QML2_IMPORT_PATH:+:$QML2_IMPORT_PATH}"
export QML_IMPORT_PATH="$QML2_IMPORT_PATH"

CAP=$(mktemp -d)
trap 'rm -rf "$CAP"' EXIT

LOG=$(mktemp)
set +e
"$QML" -I "$ROOT" -I "$ROOT/tests/stubs" "$ROOT/tests/ui/UiTest.qml" "$CAP" >"$LOG" 2>&1
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

if [ "${UPDATE_UI_GOLDENS:-}" = "1" ]; then
  mkdir -p "$GOLD"
  cp "$CAP"/*.png "$GOLD/"
  echo "updated goldens in $GOLD"
  exit 0
fi

python3 "$ROOT/tests/ui/pixeldiff.py" "$CAP" "$GOLD"
echo "ok  ui pixel diffs vs committed goldens"
