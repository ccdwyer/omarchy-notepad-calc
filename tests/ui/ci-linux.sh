#!/bin/bash
# Linux CI entry for UI + demo + soak. Run inside unshare --net.
# Discovers Nix Quickshell, bootstraps grabToImage goldens if missing,
# then independently recaptures and diffs. Soak is one hour.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
cd "$ROOT"

if [ -f "$HOME/.nix-profile/etc/profile.d/nix.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nix-profile/etc/profile.d/nix.sh"
fi

export REQUIRE_QML_UI=1
export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-offscreen}"
export NOTEPAD_CALC_UI_ARTIFACT_DIR="${NOTEPAD_CALC_UI_ARTIFACT_DIR:-/tmp/notepad-calc-ui-captures}"

# shellcheck disable=SC1091
. "$ROOT/tests/ui/setup-qml-env.sh"

if [ -z "${QS_QML_ROOT:-}" ] || [ ! -f "$QS_QML_ROOT/Quickshell/qmldir" ]; then
  echo "FAIL Nix Quickshell QML module path not exported; cannot import Quickshell"
  exit 1
fi

gold_ok=1
for f in demo-1x.png demo-1p25x.png demo-2x.png \
         longline-1x.png longline-1p25x.png longline-2x.png \
         emoji-1x.png emoji-1p25x.png emoji-2x.png \
         url-1x.png url-1p25x.png url-2x.png; do
  if [ ! -f "$ROOT/tests/goldens/ui/$f" ]; then
    gold_ok=0
  fi
done

if [ "$gold_ok" -eq 0 ]; then
  echo "bootstrapping tests/goldens/ui from Panel.qml Item.grabToImage"
  UPDATE_UI_GOLDENS=1 "$ROOT/tests/ui/run.sh"
fi

"$ROOT/tests/ui/run.sh"
"$ROOT/tests/ui/demo.sh"
"$ROOT/tests/ui/soak.sh"
