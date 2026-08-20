#!/bin/bash
# Linux CI entry for UI + demo + soak. Run inside unshare --net.
# Discovers Nix Quickshell. Pixel-diffs temp grabToImage captures against
# committed tests/goldens/ui (missing golden fails; no same-run bootstrap).
# Soak is one hour.
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

"$ROOT/tests/ui/run.sh"
"$ROOT/tests/ui/demo.sh"
"$ROOT/tests/ui/soak.sh"
