#!/usr/bin/env python3
"""Write committed baseline PNGs for tests/goldens/ui/.

These are deterministic stand-in rasters (unique per fixture/scale) so the
repo has real PNG baselines. Linux CI compares Qt grabToImage captures
against them. Refresh from CI artifacts:

    UPDATE_UI_GOLDENS=1 tests/ui/run.sh
"""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "tests" / "goldens" / "ui"

SCALES = [("1x", 980, 640), ("1p25x", 1225, 800), ("2x", 1960, 1280)]
SHEETS = {
    "demo": (26, 27, 38),
    "longline": (40, 50, 70),
    "emoji": (80, 40, 50),
    "url": (30, 60, 50),
}


def png_rgb(w: int, h: int, rgb) -> bytes:
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        r, g, b = rgb(y)
        raw.extend(bytes([r, g, b]) * w)
    compressed = zlib.compress(bytes(raw), 9)
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, base in SHEETS.items():
        for tag, w, h in SCALES:
            def rgb(y, base=base, tag=tag, name=name, h=h):
                band = (y * 8 // max(h, 1)) % 8
                return (
                    (base[0] + band * 12 + (ord(tag[0]) * 3)) % 220 + 20,
                    (base[1] + band * 9 + len(name) * 7) % 220 + 20,
                    (base[2] + band * 5 + w % 50) % 220 + 20,
                )
            path = OUT / ("%s-%s.png" % (name, tag))
            path.write_bytes(png_rgb(w, h, rgb))
            print("wrote", path, w, "x", h)


if __name__ == "__main__":
    main()
