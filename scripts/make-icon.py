"""Generate CleanEx's app icon: the capacity gauge, draining.

The app's own signature object rather than a category metaphor. DESIGN.md
specifies the capacity reading as "a tick-marked bar, not a ring — a panel
gauge reads in ticks", and that strip is the first thing a user sees inside the
app, so the icon is the product's face rather than a picture of cleaning.

Four ticks, not twenty-four: at 60pt on a home screen only chunky shapes
survive, and a fine-grained gauge collapses into a grey smear. One graphite
tick still used, one amber coming back, two outlined and free — a gauge
draining left to right.

Bone ground rather than graphite. A home screen is a wall of saturated and dark
icons; an off-white square carrying one precise instrument mark reads as
measuring equipment, which is both more findable and truer to DESIGN.md's
light-first stance.

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


# Geometry in 1024-space.
#
# The vessel is portrait at roughly 1:2.2 — phone proportions. That matters:
# the same gauge drawn as a horizontal track reads as a battery, which is the
# wrong promise for a storage app. Upright, filled from the bottom, it reads as
# "your phone, this full", which is the mental model the user already has.
BODY_L, BODY_R = 300, 724
BODY_T, BODY_B = 104, 920
BODY_RAD = 84
WALL = 42  # vessel wall thickness

PAD = 26  # breathing room between wall and segments
SEG_GAP = 20
SEG_RAD = 18


def render(size):
    w = h = size * SS
    px = [BONE] * (w * h)  # bone ground, full bleed — iOS masks the corners

    s = SS * size / 1024.0  # scale factor from 1024-space

    def R(x0, y0, x1, y1, r, color):
        rounded_rect(px, w, h, x0 * s, y0 * s, x1 * s, y1 * s, r * s, color)

    # The vessel: draw the graphite body, then knock the middle back out to
    # bone so the wall is perfectly even on all four sides.
    R(BODY_L, BODY_T, BODY_R, BODY_B, BODY_RAD, GRAPHITE)
    R(
        BODY_L + WALL,
        BODY_T + WALL,
        BODY_R - WALL,
        BODY_B - WALL,
        BODY_RAD - WALL / 2,
        BONE,
    )

    # Four level segments, stacked and filling from the bottom the way a tank
    # does. Two filled, two left bone — the phone as it is *after* the app has
    # done its job, not as it is when the user opens it in a panic.
    seg_l = BODY_L + WALL + PAD
    seg_r = BODY_R - WALL - PAD
    top = BODY_T + WALL + PAD
    bottom = BODY_B - WALL - PAD
    seg_h = (bottom - top - 3 * SEG_GAP) / 4

    def seg(i):  # 0 is the bottom of the stack
        b = bottom - i * (seg_h + SEG_GAP)
        return b - seg_h, b

    # Segment 0 — space still in use.
    t, b = seg(0)
    R(seg_l, t, seg_r, b, SEG_RAD, GRAPHITE)

    # Segment 1 — the space coming back, sitting at the waterline where it is
    # about to leave. The only saturated mark in the icon, so it is the last
    # thing to survive as the icon shrinks.
    t, b = seg(1)
    R(seg_l, t, seg_r, b, SEG_RAD, AMBER)

    # Segments 2 and 3 stay bone: free space, drawn by not drawing.

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
