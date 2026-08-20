#!/bin/sh
# Submission tarball from git HEAD. Excludes gitignored review logs, bin/,
# Rust target/, and other local artifacts. Do not tar the working tree.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
OUT="${1:-$ROOT/notepad-calc-src.tar.gz}"
git -C "$ROOT" archive --format=tar.gz --prefix=notepad-calc/ -o "$OUT" HEAD
echo "wrote $OUT"
