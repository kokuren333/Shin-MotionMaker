"""16x16 design data for the Shin-MotionMaker original UI icons (Apache-2.0).

DATA ONLY: every icon is 16 strings of 16 characters. Pixels are written into
the CyberSprite projects (`../<name>.csprite`) by `build_icons.py`, which calls
the CyberSprite CLI `draw_rows` op. The .csprite projects are the originals;
this file records how they were first drawn so the set can be rebuilt.

The reused CyberSprite icons are NOT listed here: they are copied unmodified
from CyberSprite and must never be redrawn by this tool.

Design characters (mapped to palette indices of ui-icons.gpl in build_icons.py):
  .  transparent        #  ink (outline, 1px)   k  ink-soft
  d  trace-deep         c  trace (cyan)         s  trace-soft
  w  white              g  warn gold            r  error red
  v  agent violet       p  agent-soft violet

Rules inherited from CyberSprite assets/ui/icons/README.md: 1px ink outline,
content inside the 14x14 box (1..14), status colours (g, r) only on status
icons, shape carries the meaning (never colour alone). None of the original
icons below uses g or r.
"""

from __future__ import annotations

W = H = 16
ALLOWED = set(".#dcswgrvkp")


def grid(rows: list[str]) -> list[str]:
    assert len(rows) == H, len(rows)
    for i, r in enumerate(rows):
        assert len(r) == W, (i, r, len(r))
        assert set(r) <= ALLOWED, (i, r)
    # content box 1..14: row/column 0 and 15 stay transparent
    assert rows[0] == "." * W and rows[15] == "." * W, "rows 0/15 must be empty"
    assert all(r[0] == "." and r[15] == "." for r in rows), "columns 0/15 must be empty"
    return list(rows)


# ------------------------------------------------------------ app mark
# A cyan tile (CyberSprite family) with a white ball that leaves speed lines
# and a track underneath: "things that move".
APP = grid(
    [
        "................",
        "..############..",
        ".#cccccccccccc#.",
        ".#cccccc###ccc#.",
        ".#cwwwc#www#cc#.",
        ".#cccc#wwwww#c#.",
        ".#wwwc#wwwww#c#.",
        ".#cccc#wwwww#c#.",
        ".#cwwwc#www#cc#.",
        ".#cccccc###ccc#.",
        ".#cccccccccccc#.",
        ".#cddddddddddc#.",
        ".#cccccccccccc#.",
        ".#cccccccccccc#.",
        "..############..",
        "................",
    ]
)

# ------------------------------------------------------------ modes
# MV: two beamed eighth notes (music first).
MODE_MV = grid(
    [
        "................",
        "................",
        "......#######...",
        "......#ccccc#...",
        "......#######...",
        "......#.....#...",
        "......#.....#...",
        "......#.....#...",
        "......#.....#...",
        "......#.....#...",
        "...####..####...",
        "..#ccc#.#ccc#...",
        "..#ccc#.#ccc#...",
        "...###...###....",
        "................",
        "................",
    ]
)

# Explainer: a board on an easel with a rising bar chart (understanding first).
MODE_EXPLAINER = grid(
    [
        "................",
        ".......##.......",
        ".##############.",
        ".#wwwwwwwwwwww#.",
        ".#wwwwwwwwwddw#.",
        ".#wwwwwwwwwddw#.",
        ".#wwwwwwddwddw#.",
        ".#wwwwwwddwddw#.",
        ".#wwwddwddwddw#.",
        ".#wwwddwddwddw#.",
        ".#wwwddwddwddw#.",
        ".##############.",
        "....#..##..#....",
        "...#...##...#...",
        "..#....##....#..",
        "................",
    ]
)

# ------------------------------------------------------------ styles
# The four style modes share one frame (same outline, same white face) and
# differ only in the glyph, so none of them looks primary.


def _framed(glyph: list[str]) -> list[str]:
    """glyph: 10 rows x 10 cols placed at x3..12, y3..12 inside a white frame."""
    assert len(glyph) == 10 and all(len(r) == 10 for r in glyph)
    rows = ["." * W]
    rows.append("..############..")
    rows.append(".#wwwwwwwwwwww#.")
    for g in glyph:
        rows.append(".#w" + g.replace(".", "w") + "w#.")
    rows.append(".#wwwwwwwwwwww#.")
    rows.append("..############..")
    rows.append("." * W)
    return grid(rows)


# The four glyphs are kept at a similar ink weight (about 45-56 non-white pixels),
# use only trace-deep / trace / trace-soft (no ink inside the frame), and come from
# different shape families, so no option reads as primary or highlighted (GU-07).
# None of them uses a sparkle / star, which UIs use as a "new / recommended" badge.

# biim: a caption bar above and below the picture (the Biim frame motif).
STYLE_BIIM = _framed(
    [
        "..........",
        "dddddddddd",
        "..........",
        "..cccccc..",
        "..cccccc..",
        "..cccccc..",
        "..cccccc..",
        "..........",
        "dddddddddd",
        "dddddddddd",
    ]
)

# anime: a character face (hair with bangs, large eyes): the cast acts the explanation.
STYLE_ANIME = _framed(
    [
        "..dddddd..",
        ".dddddddd.",
        "ddd.dd.ddd",
        "dd......dd",
        "d.dd..dd.d",
        "d.dd..dd.d",
        "d.cc..cc.d",
        "d........d",
        "d...cc...d",
        "dd......dd",
    ]
)

# motion: one square shown as onion-skin steps along a diagonal (faint -> solid):
# shapes moving.
STYLE_MOTION = _framed(
    [
        "......dddd",
        "......dddd",
        "......dddd",
        "...cccdddd",
        "...cccc...",
        "...cccc...",
        "ssscccc...",
        "ssss......",
        "ssss......",
        "ssss......",
    ]
)

# mixed: one picture split in two halves (Biim sections and other sections in one video).
STYLE_MIXED = _framed(
    [
        "..........",
        "..ddddddd.",
        ".c.dddddd.",
        ".cc.ddddd.",
        ".ccc.dddd.",
        ".cccc.ddd.",
        ".ccccc.dd.",
        ".cccccc.d.",
        ".ccccccc..",
        "..........",
    ]
)

# ------------------------------------------------------------ checks
# Gate (pass / fail): a boom barrier. A squat cabinet, a striped arm leaving it at
# mid height, and a rest post under the arm tip, so it does not read as a flag at x1.
GATE = grid(
    [
        "................",
        "................",
        "................",
        "................",
        "................",
        "..####..........",
        "..#dd#..........",
        "..#dd##########.",
        "..#dd#wwddwwdd#.",
        "..#dd##########.",
        "..#dd#.......#..",
        "..#dd#.......#..",
        ".#dddd#......#..",
        ".######.....###.",
        "................",
        "................",
    ]
)

# Advisory: a calm speech bubble with three dots. No gold, no red, no
# triangle or octagon, so it never reads as warning or error (PH-03).
ADVISORY = grid(
    [
        "................",
        "................",
        "................",
        "..############..",
        ".#ssssssssssss#.",
        ".#ssssssssssss#.",
        ".#ssddsddsddss#.",
        ".#ssddsddsddss#.",
        ".#ssssssssssss#.",
        ".#ssssssssssss#.",
        "..##ss########..",
        "...#s#..........",
        "...##...........",
        "...#............",
        "................",
        "................",
    ]
)

# Ghost check: a ghost under a magnifier.
GHOST_CHECK = grid(
    [
        "................",
        "...#####........",
        "..#wwwww#.......",
        ".#wwwwwww#......",
        ".#wwwwwww#......",
        ".#ww#w#ww#......",
        ".#ww#w#ww#......",
        ".#wwwwwww###....",
        ".#wwwwww#sss#...",
        ".#wwwwww#sss#...",
        ".#wwwwww#sss#...",
        ".#ww#w#ww###....",
        "..##.#.##..##...",
        "............##..",
        ".............#..",
        "................",
    ]
)

# ------------------------------------------------------------ job & entries
# Job (ZIP): a page with a zipper and a pull tab.
JOB_ZIP = grid(
    [
        "................",
        "..########......",
        "..#ww#www##.....",
        "..#www#ww#s#....",
        "..#ww#www#ss#...",
        "..#www#ww####...",
        "..#ww#wwwwww#...",
        "..#www#wwwww#...",
        "..#ww#wwwwww#...",
        "..#w####wwww#...",
        "..#w#dd#wwww#...",
        "..#w#dd#wwww#...",
        "..#w####wwww#...",
        "..#wwwwwwwww#...",
        "..###########...",
        "................",
    ]
)

# CLI: a terminal window with a prompt and a cursor.
CLI = grid(
    [
        "................",
        "................",
        ".##############.",
        ".#dddddddddddd#.",
        ".##############.",
        ".#wwwwwwwwwwww#.",
        ".#w##wwwwwwwww#.",
        ".#ww##wwwwwwww#.",
        ".#www##wwwwwww#.",
        ".#ww##wwwwwwww#.",
        ".#w##ww####www#.",
        ".#wwwwwwwwwwww#.",
        ".##############.",
        "................",
        "................",
        "................",
    ]
)

# MCP: a plug with two prongs and a cable (an agent-side connector).
MCP = grid(
    [
        "................",
        "...###....###...",
        "...#s#....#s#...",
        "...#s#....#s#...",
        "..############..",
        "..#cccccccccc#..",
        "..#cwwccccccc#..",
        "..#cccccccccc#..",
        "..#cccccccccc#..",
        "...#cccccccc#...",
        "....#cccccc#....",
        ".....######.....",
        "......#cc#......",
        "......#cc#......",
        "......#cc#......",
        "................",
    ]
)


def all_icons() -> dict[str, list[str]]:
    return {
        "app": APP,
        "mode-mv": MODE_MV,
        "mode-explainer": MODE_EXPLAINER,
        "style-biim": STYLE_BIIM,
        "style-anime": STYLE_ANIME,
        "style-motion": STYLE_MOTION,
        "style-mixed": STYLE_MIXED,
        "gate": GATE,
        "advisory": ADVISORY,
        "ghost-check": GHOST_CHECK,
        "job-zip": JOB_ZIP,
        "cli": CLI,
        "mcp": MCP,
    }
