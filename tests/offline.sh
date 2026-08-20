#!/bin/sh
# Node engine corpus with networking disabled. Does NOT load Panel.qml.
# The fresh-machine Quickshell demo is tests/ui/demo.sh (Linux CI only).

set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

export NOTEPAD_CALC_OFFLINE=1
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy

if [ "$(uname -s)" = "Linux" ] && command -v unshare >/dev/null 2>&1; then
  if unshare --net --map-root-user true >/dev/null 2>&1; then
    unshare --net --map-root-user sh -c 'ip link set lo up 2>/dev/null || true; node tests/run.js'
    echo "ok  offline engine corpus (unshare --net)"
    exit 0
  fi
fi

node tests/run.js
echo "ok  offline engine corpus (no network calls in tests; namespace unavailable)"
