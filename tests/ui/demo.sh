#!/bin/sh
# CI-only fresh-machine acceptance: install plugin to $DEST, load BarWidget.qml from there.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)

if [ "${REQUIRE_QML_UI:-}" != "1" ] && ! command -v qml6 >/dev/null 2>&1 && ! command -v qml >/dev/null 2>&1; then
  echo "skip demo: no qml runtime (CI-only)"
  exit 0
fi

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
  echo "FAIL no qml runtime"
  exit 1
fi
if [ "${REQUIRE_QML_UI:-}" = "1" ]; then
  if ! command -v quickshell >/dev/null 2>&1 && ! ls "$HOME/.nix-profile/lib"/qt-*/qml/Quickshell/qmldir >/dev/null 2>&1; then
    echo "FAIL real Quickshell is required for the fresh-machine acceptance run"
    exit 1
  fi
fi

FRESH=$(mktemp -d)
export HOME="$FRESH"
export XDG_DATA_HOME="$FRESH/.local/share"
export XDG_CONFIG_HOME="$FRESH/.config"
export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-offscreen}"
export NOTEPAD_CALC_TEST=1
# Theme tokens only. Real Quickshell FileView/Process — not unit-stubs.
export QML2_IMPORT_PATH="$ROOT/tests/stubs${QML2_IMPORT_PATH:+:$QML2_IMPORT_PATH}"
export QML_IMPORT_PATH="$QML2_IMPORT_PATH"

ID="io.github.chris.notepad-calc"
DEST="$HOME/.config/omarchy/plugins/$ID"
mkdir -p "$DEST"
cp "$ROOT/manifest.json" "$DEST/"
cp "$ROOT/Panel.qml" "$ROOT/BarWidget.qml" "$ROOT/RatesRefresh.qml" "$DEST/"
cp -R "$ROOT/js" "$ROOT/data" "$DEST/"
mkdir -p "$HOME/.config/omarchy"
# One entry: bar widget in the bar layout. Not also in plugins[].
cat > "$HOME/.config/omarchy/shell.json" <<EOF
{
  "version": 1,
  "bar": {
    "id": "omarchy.bar",
    "layout": {
      "right": [{ "id": "$ID", "defaultCurrency": "USD" }]
    }
  }
}
EOF

LOG=$(mktemp)
set +e
"$QML" -I "$DEST" -I "$ROOT/tests/stubs" "$ROOT/tests/ui/DemoTest.qml" "$DEST" >"$LOG" 2>&1
STATUS=$?
set -e
cat "$LOG"
if grep -q "FAIL " "$LOG"; then
  echo "FAIL fresh-machine demo"
  exit 1
fi
if [ "$STATUS" -ne 0 ]; then
  echo "FAIL demo qml exit $STATUS"
  exit 1
fi
if ! grep -q "ok  fresh-machine offline demo" "$LOG"; then
  echo "FAIL demo completion marker missing"
  exit 1
fi
echo "ok  installed plugin tree $DEST loaded via BarWidget.qml"
