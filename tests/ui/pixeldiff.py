#!/usr/bin/env python3
"""Compare TEMP captures against COMMITTED goldens. Missing golden is a failure."""
from __future__ import annotations

import struct
import sys
import zlib
from pathlib import Path

NAMES = []
for prefix in ("demo", "longline", "emoji", "url"):
    for tag in ("1x", "1p25x", "2x"):
        NAMES.append("%s-%s.png" % (prefix, tag))


def read_png(path: Path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a png: %s" % path)
    pos = 8
    width = height = bit = color = None
    raw = b""
    while pos < len(data):
        ln = struct.unpack(">I", data[pos : pos + 4])[0]
        ctype = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + ln]
        pos += 12 + ln
        if ctype == b"IHDR":
            width, height, bit, color, *_ = struct.unpack(">IIBBBBB", chunk)
        elif ctype == b"IDAT":
            raw += chunk
        elif ctype == b"IEND":
            break
    if width is None:
        raise ValueError("no IHDR in %s" % path)
    pixels = zlib.decompress(raw)
    bpp = 4 if color == 6 else 3 if color == 2 else 1
    stride = width * bpp
    rows = []
    i = 0
    for y in range(height):
        filt = pixels[i]
        i += 1
        row = bytearray(pixels[i : i + stride])
        i += stride
        if filt == 1:
            for x in range(bpp, stride):
                row[x] = (row[x] + row[x - bpp]) & 255
        elif filt not in (0,):
            pass
        rows.append(bytes(row))
    return width, height, bpp, b"".join(rows)


def ae(a: Path, b: Path):
    try:
        w1, h1, bpp1, p1 = read_png(a)
        w2, h2, bpp2, p2 = read_png(b)
    except Exception as e:
        return -2, 1, str(e)
    if (w1, h1) != (w2, h2):
        return -1, w1 * h1, "size %dx%d vs %dx%d" % (w1, h1, w2, h2)
    n = min(len(p1), len(p2))
    bpp = min(bpp1, bpp2)
    step = max(bpp1, bpp2)
    diff = 0
    for i in range(0, n, step):
        if p1[i : i + bpp] != p2[i : i + bpp]:
            diff += 1
    return diff, w1 * h1, ""


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: pixeldiff.py <captures-tmp> <goldens-dir>")
        return 2
    cap = Path(sys.argv[1])
    gold = Path(sys.argv[2])
    if cap.resolve() == gold.resolve():
        print("FAIL captures and goldens are the same directory; refusing tautological compare")
        return 1
    if not gold.is_dir():
        print("FAIL golden directory missing:", gold)
        return 1
    failed = 0
    for name in NAMES:
        c = cap / name
        g = gold / name
        if not c.exists():
            print("FAIL missing capture", name)
            failed += 1
            continue
        if not g.exists():
            print("FAIL missing golden baseline", g)
            failed += 1
            continue
        d, px, info = ae(c, g)
        if d == -2:
            print("FAIL", name, info)
            failed += 1
        elif d == -1:
            print("FAIL", name, "size mismatch", info)
            failed += 1
        elif px and d / px > 0.02:
            print("FAIL", name, "AE", d, "/", px, "(%.2f%%)" % (100.0 * d / px))
            failed += 1
        else:
            print("ok ", name, "AE", d, "/", px)
    if failed:
        print("FAIL pixel-diff", failed, "files")
        return 1
    print("ok  golden pixel diffs", len(NAMES))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
