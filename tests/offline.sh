#!/bin/sh
# Node engine corpus with networking disabled. Does NOT load Panel.qml.
# The fresh-machine Quickshell demo is tests/ui/demo.sh (Linux CI only).
# Fail closed: never report success for an unrestricted run.

set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

export NOTEPAD_CALC_OFFLINE=1
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy

fail_iso() {
  echo "FAIL cannot establish network isolation (unshare --net)."
  echo "Refusing an unrestricted run — this script is isolation evidence only."
  echo "On macOS use: node tests/run.js"
  exit 1
}

if [ "$(uname -s)" != "Linux" ]; then
  fail_iso
fi
if ! command -v unshare >/dev/null 2>&1; then
  fail_iso
fi

if unshare --net --map-root-user true >/dev/null 2>&1; then
  unshare --net --map-root-user sh -c 'ip link set lo up 2>/dev/null || true; node tests/run.js'
  echo "ok  offline engine corpus (unshare --net)"
  exit 0
fi

if command -v sudo >/dev/null 2>&1 && sudo unshare --net true >/dev/null 2>&1; then
  sudo unshare --net sh -c "ip link set lo up 2>/dev/null || true; cd '$ROOT' && node tests/run.js"
  echo "ok  offline engine corpus (sudo unshare --net)"
  exit 0
fi

fail_iso
