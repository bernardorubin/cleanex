"""Generate CleanEx's app icon: a breaker switch thrown to ON.

Pure stdlib — renders at 4x and box-downsamples for antialiasing, then encodes
a PNG by hand. No dependencies, fully deterministic.
"""

import struct
import zlib

SS = 4  # supersample factor

GRAPHITE = (0x2C, 0x2C, 0x29)
BONE = (0xE6, 0xE4, 0xDD)
AMBER = (0xD2, 0x66, 0x0A)
RULE = (0xC7, 0xC4, 0xBB)


def rounded_rect(px, w, h, x0, y0, x1, y1, r, color):
    """Fill a rounded rectangle. Coordinates are in supersampled space."""
    for y in range(max(0, int(y0)), min(h, int(y1) + 1)):
        for x in range(max(0, int(x0)), min(w, int(x1) + 1)):
            # Distance from the nearest corner circle centre
            cx = min(max(x, x0 + r), x1 - r)
            cy = min(max(y, y0 + r), y1 - r)
            dx = x - cx
            dy = y - cy
            if dx * dx + dy * dy <= r * r:
                px[y * w + x] = color


def render(size):
    w = h = size * SS
    px = [GRAPHITE] * (w * h)

    s = SS * size / 1024.0  # scale factor from 1024-space

    def R(x0, y0, x1, y1, r, color):
        rounded_rect(px, w, h, x0 * s, y0 * s, x1 * s, y1 * s, r * s, color)

    # Bone plate — the breaker's face, filling most of the icon
    R(232, 140, 792, 884, 72, BONE)

    # The switch window, cut into the plate
    R(330, 244, 694, 790, 44, GRAPHITE)

    # The flag, thrown down = ON. Sized to carry the icon at 60pt, where the
    # plate and window collapse to shapes and only the amber still reads.
    R(366, 470, 658, 754, 30, AMBER)

    # The finger ridge across the toggle — the one detail that says "switch"
    # rather than "fill level" at medium size.
    R(410, 556, 614, 578, 11, GRAPHITE)

    # Downsample
    out = bytearray()
    for y in range(size):
        out.append(0)  # PNG filter type 0
        for x in range(size):
            r = g = b = 0
            for dy in range(SS):
                row = (y * SS + dy) * w
                for dx in range(SS):
                    c = px[row + x * SS + dx]
                    r += c[0]
                    g += c[1]
                    b += c[2]
            n = SS * SS
            out += bytes((r // n, g // n, b // n))
    return bytes(out)


def chunk(tag, data):
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path, size):
    raw = render(size)
    # Color type 2 = truecolour RGB, no alpha (iOS icons must be opaque)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(png)
    print(f"{path}  {size}x{size}  {len(png):,} bytes")


import sys

write_png(sys.argv[1], int(sys.argv[2]))
