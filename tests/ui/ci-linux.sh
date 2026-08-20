#!/bin/bash
# Linux CI entry for UI + demo + soak. Run inside unshare --net.
# Discovers Nix Quickshell. If committed goldens are missing, generate them
# with UPDATE_UI_GOLDENS=1 (artifact bootstrap) and skip pixel-diff with a
# warning. Once tests/goldens/ui/*.png are committed, pixel-diff is a real
# gate against those baselines (not a same-run tautology). Soak is one hour.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
cd "$ROOT"
GOLD="$ROOT/tests/goldens/ui"

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
  if [ ! -f "$GOLD/$f" ]; then
    gold_ok=0
  fi
done

need_commit=0
if [ "$gold_ok" -eq 0 ]; then
  echo "WARN committed UI goldens missing; generating Item.grabToImage captures for artifacts"
  UPDATE_UI_GOLDENS=1 "$ROOT/tests/ui/run.sh"
  need_commit=1
else
  "$ROOT/tests/ui/run.sh"
fi

"$ROOT/tests/ui/demo.sh"
"$ROOT/tests/ui/soak.sh"

if [ "$need_commit" -eq 1 ]; then
  echo "FAIL visual gate is not pinned in git."
  echo "Bootstrap: download artifact notepad-calc-ui-captures, copy the 12 PNGs"
  echo "into tests/goldens/ui/, commit, and the next CI run will pixel-diff."
  exit 1
fi
