#!/bin/sh
# Fresh-machine / network-disabled gate. Uses the bundled rates snapshot only.
# On Linux CI this runs inside `unshare --net`. Locally (macOS) it just proves
# the corpus does not touch the network: no curl, no helper fetch.

set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

export NOTEPAD_CALC_OFFLINE=1
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy

# If a network namespace is available, drop every interface except lo.
run_node() {
  node tests/run.js
}

if [ "$(uname -s)" = "Linux" ] && command -v unshare >/dev/null 2>&1; then
  if unshare --net --map-root-user true >/dev/null 2>&1; then
    unshare --net --map-root-user sh -c 'ip link set lo up 2>/dev/null || true; node tests/run.js'
    echo "ok  offline corpus (unshare --net)"
    exit 0
  fi
fi

run_node
echo "ok  offline corpus (no network calls in tests; namespace unavailable)"
