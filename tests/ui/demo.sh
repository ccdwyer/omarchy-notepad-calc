#!/bin/sh
# CI-only fresh-machine acceptance: install plugin to $DEST, load BarWidget.qml from there.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)

# shellcheck disable=SC1091
. "$ROOT/tests/ui/setup-qml-env.sh"

if [ "${REQUIRE_QML_UI:-}" != "1" ] && [ -z "${QML_BIN:-}" ]; then
  echo "skip demo: no qml runtime (CI-only)"
  exit 0
fi

if [ -z "${QML_BIN:-}" ]; then
  echo "FAIL no qml runtime"
  exit 1
fi
if [ "${REQUIRE_QML_UI:-}" = "1" ]; then
  if [ -z "${QS_QML_ROOT:-}" ] || [ ! -f "$QS_QML_ROOT/Quickshell/qmldir" ]; then
    echo "FAIL real Quickshell QML module is required for the fresh-machine acceptance run"
    exit 1
  fi
fi

case ":${QML2_IMPORT_PATH:-}:" in
  *unit-stubs*)
    echo "FAIL tests/unit-stubs must not be on the demo acceptance import path"
    exit 1
    ;;
esac

FRESH=$(mktemp -d)
export HOME="$FRESH"
export XDG_DATA_HOME="$FRESH/.local/share"
export XDG_CONFIG_HOME="$FRESH/.config"
export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-offscreen}"
export NOTEPAD_CALC_TEST=1

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

I_FLAGS="-I $DEST"
if [ -n "${QS_QML_ROOT:-}" ]; then
  I_FLAGS="$I_FLAGS -I $QS_QML_ROOT"
fi
I_FLAGS="$I_FLAGS -I $ROOT/tests/stubs"

LOG=$(mktemp)
set +e
# shellcheck disable=SC2086
"$QML_BIN" $I_FLAGS "$ROOT/tests/ui/DemoTest.qml" "$DEST" >"$LOG" 2>&1
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
