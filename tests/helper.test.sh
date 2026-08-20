#!/bin/sh
# Off-device helper tests: parse a fixture XML, no network.

set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
FIX="$ROOT/tests/fixtures/ecb-daily.xml"
OUT="${TMPDIR:-/tmp}/notepad-calc-test-rates.json"
SH="$ROOT/compat/rates-refresh.sh"

chmod +x "$SH"
"$SH" fetch --xml "$FIX" --out "$OUT"

grep -q '"date": "2026-08-18"' "$OUT"
grep -q '"USD": 1.1600' "$OUT"
grep -q '"base": "EUR"' "$OUT"
echo "ok  helper shell parse"

if [ -x "$ROOT/bin/notepad-calc-rates" ]; then
  "$ROOT/bin/notepad-calc-rates" fetch --xml "$FIX" --out "$OUT"
  grep -q '"date": "2026-08-18"' "$OUT"
  echo "ok  helper binary parse"
else
  echo "skip helper binary (not built)"
fi

EMPTY="$ROOT/tests/fixtures/ecb-empty-cubes.xml"
KEEP=$(mktemp)
cp "$OUT" "$KEEP"
set +e
"$SH" fetch --xml "$EMPTY" --out "$KEEP"
EMPTY_ST=$?
set -e
if [ "$EMPTY_ST" -eq 0 ]; then
  echo "FAIL shell helper accepted XML with a date and zero currencies"
  exit 1
fi
grep -q '"USD": 1.1600' "$KEEP"
echo "ok  empty-cube XML rejected (cached snapshot kept)"
if [ -x "$ROOT/bin/notepad-calc-rates" ]; then
  set +e
  "$ROOT/bin/notepad-calc-rates" fetch --xml "$EMPTY" --out "$KEEP"
  BIN_ST=$?
  set -e
  if [ "$BIN_ST" -eq 0 ]; then
    echo "FAIL rust helper accepted XML with a date and zero currencies"
    exit 1
  fi
  grep -q '"USD": 1.1600' "$KEEP"
  echo "ok  rust helper rejects empty cubes"
fi
rm -f "$KEEP"

# Bar-widget IpcHandler is the bind path; root still exposes summon/hide/toggle
# so a loaded entry point can dispatch them too.
ROOT_QML=$(awk 'BEGIN{p=1} /IpcHandler/{p=0} p' "$ROOT/BarWidget.qml")
echo "$ROOT_QML" | grep -q 'function summon('
echo "$ROOT_QML" | grep -q 'function hide('
echo "$ROOT_QML" | grep -q 'function toggle('
echo "ok  BarWidget root summon/hide/toggle"

if grep -q 'claimAuto' "$ROOT/BarWidget.qml" "$ROOT/js/Binds.js"; then
  echo "FAIL claimAuto still present (first-load auto-install)"
  exit 1
fi
if grep -q 'installBinds("auto")' "$ROOT/BarWidget.qml"; then
  echo "FAIL BarWidget still auto-installs binds"
  exit 1
fi
grep -q 'Set hotkey' "$ROOT/BarWidget.qml"
echo "ok  no first-load auto-install; Set hotkey is opt-in"

BINDHOME=$(mktemp -d)
export XDG_CONFIG_HOME="$BINDHOME/config"
mkdir -p "$XDG_CONFIG_HOME/hypr"
printf '%s\n' '-- other binds' 'o.bind("SUPER + Q", "Quit", "true")' >"$XDG_CONFIG_HOME/hypr/bindings.lua"
python3 "$ROOT/compat/install-binds.py" io.github.chris.notepad-calc 'o.bind("SUPER + N", "Notepad Calc", "true")'
grep -q 'BEGIN io.github.chris.notepad-calc' "$XDG_CONFIG_HOME/hypr/bindings.lua"
grep -q 'SUPER + Q' "$XDG_CONFIG_HOME/hypr/bindings.lua"
python3 "$ROOT/compat/install-binds.py" io.github.chris.notepad-calc --remove
if grep -q 'BEGIN io.github.chris.notepad-calc' "$XDG_CONFIG_HOME/hypr/bindings.lua"; then
  echo "FAIL install-binds.py --remove left the marked block"
  exit 1
fi
grep -q 'SUPER + Q' "$XDG_CONFIG_HOME/hypr/bindings.lua"
unset XDG_CONFIG_HOME
rm -rf "$BINDHOME"
echo "ok  install-binds.py write and remove keep other binds"

# Archive-based submission must not include gitignored review logs, bin/, or target/.
# Use `git archive` (see pack.sh); never tar the working tree.
for p in \
  bin/notepad-calc-rates \
  src/rates-refresh/target/ \
  .fix_prompt_r5.md \
  .gpt_review_r5.md \
  .review_prompt5.md \
  .serena/
do
  printf '%s\n' "$p" | git -C "$ROOT" check-ignore -q --stdin || {
    echo "FAIL $p is not gitignored (would leak into a working-tree archive)"
    exit 1
  }
done
echo "ok  gitignore excludes bin/target/review logs"

LIST=$(mktemp)
git -C "$ROOT" archive --format=tar HEAD | tar -t >"$LIST"
if grep -E '^(bin/|src/rates-refresh/target/|\.serena/|\.fix_prompt|\.gpt_review|\.review_prompt|\.impl_prompt)' "$LIST"; then
  echo "FAIL git archive contains excluded submission junk"
  rm -f "$LIST"
  exit 1
fi
rm -f "$LIST"
echo "ok  git archive excludes bin/target/review logs"

# PNG filters 2–4 must reconstruct (not leave encoded bytes).
python3 - <<'PY'
from pathlib import Path
import struct, zlib, sys
sys.path.insert(0, "tests/ui")
import pixeldiff

def png(filt, w, h, rgb):
    raw = bytearray()
    prev = bytes(w * 3)
    for y in range(h):
        raw.append(filt)
        row = bytearray()
        for x in range(w):
            row.extend(rgb(x, y))
        recon = bytes(row)
        if filt == 0:
            raw.extend(recon)
        elif filt == 2:
            raw.extend(bytes((recon[i] - prev[i]) & 255 for i in range(len(recon))))
        else:
            raise SystemExit("bad filt")
        prev = recon
    comp = zlib.compress(bytes(raw), 9)
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", comp) + chunk(b"IEND", b"")

p = Path("/tmp/nc-filter2.png")
p.write_bytes(png(2, 4, 3, lambda x, y: (10 * x, 20 * y, 30)))
w, h, bpp, pix = pixeldiff.read_png(p)
assert (w, h, bpp) == (4, 3, 3)
# y=1, x=2 -> (20, 20, 30)
i = 1 * 12 + 2 * 3
assert pix[i:i+3] == bytes([20, 20, 30]), pix[i:i+3]
print("ok  png filter 2 reconstructs")
PY

python3 - <<'PY'
from pathlib import Path
py = Path("tools/tzgen.py").read_text()
js = Path("js/tz.js").read_text()
needles = [
    "if (candidates.length === 1) return candidates[0]",
    "if (utc == null) return null",
    "seen[String(utc)]",
]
for n in needles:
    if n not in py or n not in js:
        raise SystemExit("FAIL tzgen.py/js/tz.js missing DST gap-fold handling: " + n)
print("ok  tzgen.py regeneration-parity (DST gap/fold)")
PY
