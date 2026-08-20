#!/usr/bin/env python3
"""Pixel-diff PNG captures. Stdlib only. Used in CI after UiTest.qml grabs."""
from __future__ import annotations

import struct
import sys
import zlib
from pathlib import Path


def read_png(path: Path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a png: %s" % path)
    pos = 8
    width = height = None
    raw = b""
    while pos < len(data):
        ln = struct.unpack(">I", data[pos : pos + 4])[0]
        ctype = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + ln]
        pos += 12 + ln
        if ctype == b"IHDR":
            width, height, bit, color, *_ = struct.unpack(">IIBBBBB", chunk)
            if bit != 8 or color not in (2, 6):
                raise ValueError("need 8-bit RGB/RGBA %s" % path)
        elif ctype == b"IDAT":
            raw += chunk
        elif ctype == b"IEND":
            break
    pixels = zlib.decompress(raw)
    bpp = 4 if color == 6 else 3
    stride = width * bpp
    rows = []
    i = 0
    for y in range(height):
        i += 1
        rows.append(pixels[i : i + stride])
        i += stride
    return width, height, bpp, b"".join(rows)


def ae(a: Path, b: Path) -> tuple[int, int, int]:
    w1, h1, bpp1, p1 = read_png(a)
    w2, h2, bpp2, p2 = read_png(b)
    if (w1, h1) != (w2, h2):
        return -1, w1 * h1, 0
    n = min(len(p1), len(p2))
    bpp = min(bpp1, bpp2)
    diff = 0
    px = w1 * h1
    for i in range(0, n, max(bpp1, bpp2)):
        if p1[i : i + bpp] != p2[i : i + bpp]:
            diff += 1
    return diff, px, w1


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: pixeldiff.py <captures-dir> [goldens-dir]")
        return 2
    cap = Path(sys.argv[1])
    gold = Path(sys.argv[2]) if len(sys.argv) > 2 else cap.parent / "goldens" / "ui"
    pngs = sorted(cap.glob("*.png"))
    if len(pngs) < 12:
        print("FAIL expected 12 captures, got", len(pngs))
        return 1
    names = {p.name for p in pngs}
    for prefix in ("demo", "longline", "emoji", "url"):
        for tag in ("1x", "1p25x", "2x"):
            fn = "%s-%s.png" % (prefix, tag)
            if fn not in names:
                print("FAIL missing", fn)
                return 1

    def pick(name):
        return cap / name

    w1 = read_png(pick("demo-1x.png"))[0]
    w2 = read_png(pick("demo-2x.png"))[0]
    if w2 < int(w1 * 1.5):
        print("FAIL 2x width", w2, "not larger than 1x", w1)
        return 1
    d, px, _ = ae(pick("demo-1x.png"), pick("longline-1x.png"))
    if d == 0:
        print("FAIL demo vs longline are identical")
        return 1
    d, px, _ = ae(pick("emoji-1x.png"), pick("url-1x.png"))
    if d == 0:
        print("FAIL emoji vs url are identical")
        return 1
    print("ok  scale and uniqueness pixel diffs")

    if gold.exists():
        compared = 0
        for p in pngs:
            g = gold / p.name
            if not g.exists():
                continue
            d, px, _ = ae(p, g)
            if d < 0:
                print("FAIL size mismatch", p.name)
                return 1
            if px and d / px > 0.02:
                print("FAIL", p.name, "AE", d, "/", px)
                return 1
            compared += 1
        print("ok  golden pixel diffs", compared)
    else:
        print("ok  no committed goldens yet; uniqueness diffs only")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
