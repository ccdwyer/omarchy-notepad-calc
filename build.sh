#!/bin/sh
# Build notepad-calc-rates. QML falls back to compat/rates-refresh.sh (curl)
# and then to the bundled data/rates.json snapshot, so a failed build is not
# fatal at runtime.

set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
SRC="$ROOT/src/rates-refresh"
OUT="$ROOT/bin"

mkdir -p "$OUT"
chmod +x "$ROOT/compat/rates-refresh.sh" 2>/dev/null || true

if ! command -v cargo >/dev/null 2>&1; then
  echo "build.sh: cargo not found; installing POSIX fallback as bin/notepad-calc-rates" >&2
  cp "$ROOT/compat/rates-refresh.sh" "$OUT/notepad-calc-rates"
  chmod +x "$OUT/notepad-calc-rates"
  echo "build.sh: wrote $OUT/notepad-calc-rates (shell fallback)"
  exit 0
fi

if ! cargo build --release --manifest-path "$SRC/Cargo.toml"; then
  echo "build.sh: cargo build failed; installing POSIX fallback" >&2
  cp "$ROOT/compat/rates-refresh.sh" "$OUT/notepad-calc-rates"
  chmod +x "$OUT/notepad-calc-rates"
  echo "build.sh: wrote $OUT/notepad-calc-rates (shell fallback)"
  exit 0
fi

BIN="$SRC/target/release/notepad-calc-rates"
if [ ! -x "$BIN" ]; then
  echo "build.sh: release binary missing after cargo build" >&2
  exit 1
fi
cp "$BIN" "$OUT/notepad-calc-rates"
chmod +x "$OUT/notepad-calc-rates"
echo "build.sh: wrote $OUT/notepad-calc-rates"
