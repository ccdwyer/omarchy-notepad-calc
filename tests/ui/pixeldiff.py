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
    prev = bytearray(stride)
    for y in range(height):
        filt = pixels[i]
        i += 1
        raw_row = bytearray(pixels[i : i + stride])
        i += stride
        row = bytearray(stride)
        if filt == 0:
            row[:] = raw_row
        elif filt == 1:
            for x in range(stride):
                a = row[x - bpp] if x >= bpp else 0
                row[x] = (raw_row[x] + a) & 255
        elif filt == 2:
            for x in range(stride):
                row[x] = (raw_row[x] + prev[x]) & 255
        elif filt == 3:
            for x in range(stride):
                a = row[x - bpp] if x >= bpp else 0
                row[x] = (raw_row[x] + ((a + prev[x]) // 2)) & 255
        elif filt == 4:
            for x in range(stride):
                a = row[x - bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x - bpp] if x >= bpp else 0
                row[x] = (raw_row[x] + _paeth(a, b, c)) & 255
        else:
            raise ValueError("unsupported png filter %s in %s" % (filt, path))
        rows.append(bytes(row))
        prev = row
    return width, height, bpp, b"".join(rows)


def _paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def is_standin(path: Path) -> bool:
    """True for gen_goldens-style rasters (every sampled scanline is one RGB)."""
    try:
        w, h, bpp, pixels = read_png(path)
    except Exception:
        return False
    if w < 2 or h < 2 or bpp < 3:
        return False
    stride = w * bpp
    if len(pixels) < stride * h:
        return False
    uniform = 0
    checked = 0
    step = max(h // 24, 1)
    for y in range(0, h, step):
        row = pixels[y * stride : (y + 1) * stride]
        pix0 = row[:bpp]
        checked += 1
        if row == pix0 * w:
            uniform += 1
        else:
            return False
    return checked > 0 and uniform == checked


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
        if is_standin(g):
            print("FAIL", name, "golden is a synthetic stand-in, not a grabToImage capture")
            failed += 1
            continue
        if is_standin(c):
            print("FAIL", name, "capture is a synthetic stand-in, not a grabToImage capture")
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
