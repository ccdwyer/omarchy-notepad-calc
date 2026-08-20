#!/bin/sh
# CI-only fresh-machine offline demo: empty HOME, install plugin, run battlestation.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)

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
  echo "skip demo: no qml runtime (CI-only)"
  if [ "${REQUIRE_QML_UI:-}" = "1" ]; then exit 1; fi
  exit 0
fi

FRESH=$(mktemp -d)
export HOME="$FRESH"
export XDG_DATA_HOME="$FRESH/.local/share"
export XDG_CONFIG_HOME="$FRESH/.config"
export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-offscreen}"
export NOTEPAD_CALC_TEST=1
export QML2_IMPORT_PATH="$ROOT/tests/stubs"
export QML_IMPORT_PATH="$QML2_IMPORT_PATH"

ID="io.github.chris.notepad-calc"
DEST="$HOME/.config/omarchy/plugins/$ID"
mkdir -p "$DEST"
# Install the plugin tree without copying tests/build artifacts.
cp "$ROOT/manifest.json" "$DEST/"
cp "$ROOT/Panel.qml" "$ROOT/BarWidget.qml" "$ROOT/RatesRefresh.qml" "$DEST/"
cp -R "$ROOT/js" "$ROOT/data" "$DEST/"
mkdir -p "$HOME/.config/omarchy"
cat > "$HOME/.config/omarchy/shell.json" <<EOF
{
  "version": 1,
  "bar": {
    "id": "omarchy.bar",
    "layout": {
      "right": [{ "id": "$ID", "defaultCurrency": "USD" }]
    }
  },
  "plugins": [{ "id": "$ID", "defaultCurrency": "USD" }]
}
EOF

LOG=$(mktemp)
set +e
"$QML" -I "$DEST" -I "$ROOT/tests/stubs" "$ROOT/tests/ui/DemoTest.qml" >"$LOG" 2>&1
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
echo "ok  plugin installed to $DEST and demo ran offline"
