"""Lay out the exported icon PNGs on review sheets (review evidence only, draws no icon pixel).

Reads gui/public/icons/manifest.json and the PNGs it lists, and writes one sheet per scale
(x1 and x4). Each sheet has a light half (--cs-board) and a dark half (--cs-ink), with the
original icons and the reused icons in separate rows. Colours are the CyberSprite --cs-*
token values (theme "Circuit White / Solder Mask", normal theme).

Needs Pillow; run it with the CyberSprite environment, from the repo root:
  uv run --project <CyberSprite> --no-sync python assets/ui/icons/tools/contact_sheet.py <out dir>
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parents[4]
MANIFEST = REPO / "gui" / "public" / "icons" / "manifest.json"

# --cs-* token values (CyberSprite gui/src/theme/tokens.css, normal theme)
CS_BOARD = "#EEF6F8"
CS_PANEL = "#FFFFFF"
CS_INK = "#0B2A3A"
CS_INK_SOFT = "#43606E"
CS_TRACE_SOFT = "#BFEFF9"

PER_ROW = 13


def sheet(groups: list[tuple[str, list[tuple[str, Image.Image]]]], scale: int) -> Image.Image:
    cell = 16 * scale
    gap = max(8, 4 * scale)
    label_h = 12
    pad = 12
    rows = []
    for title, items in groups:
        rows.append(("title", title))
        for i in range(0, len(items), PER_ROW):
            rows.append(("icons", items[i : i + PER_ROW]))
    col_w = cell + gap if scale > 1 else max(cell + gap, 34)
    half_w = pad * 2 + PER_ROW * col_w
    row_h = {"title": 16, "icons": cell + gap + (label_h if scale > 1 else 0)}
    height = pad * 2 + sum(row_h[k] for k, _ in rows)
    img = Image.new("RGB", (half_w * 2, height), CS_PANEL)
    d = ImageDraw.Draw(img)
    for half, (bg, fg) in enumerate([(CS_BOARD, CS_INK), (CS_INK, CS_TRACE_SOFT)]):
        x0 = half * half_w
        d.rectangle([x0, 0, x0 + half_w - 1, height - 1], fill=bg)
        y = pad
        for kind, data in rows:
            if kind == "title":
                d.text((x0 + pad, y + 2), data, fill=fg)
                y += row_h["title"]
                continue
            for j, (name, icon) in enumerate(data):
                x = x0 + pad + j * col_w
                big = icon.resize((cell, cell), Image.NEAREST) if scale > 1 else icon
                img.paste(big, (x, y), big)
                if scale > 1:
                    d.text((x, y + cell + 2), name[:12], fill=fg)
            y += row_h["icons"]
    return img


def main() -> int:
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    m = json.loads(MANIFEST.read_text(encoding="utf-8"))
    groups: dict[str, list[tuple[str, Image.Image]]] = {
        "shin-motionmaker-original": [],
        "cybersprite-reuse": [],
    }
    order = [
        "app", "mode-mv", "mode-explainer", "style-biim", "style-anime", "style-motion",
        "style-mixed", "gate", "advisory", "ghost-check", "job-zip", "cli", "mcp",
    ]
    icons = sorted(m["icons"], key=lambda e: (order.index(e["name"]) if e["name"] in order else 99,
                                              e["name"]))
    for e in icons:
        im = Image.open(REPO / e["png"]).convert("RGBA")
        groups[e["origin"]].append((e["name"], im))
    titled = [
        ("original (Shin-MotionMaker)", groups["shin-motionmaker-original"]),
        ("reused (CyberSprite a00433c)", groups["cybersprite-reuse"]),
    ]
    for scale in (1, 4):
        sheet(titled, scale).save(out / f"contact-sheet-x{scale}.png")
    # status row for PH-03: advisory next to info / warning / error / validate-ok / gate
    by = {e["name"]: Image.open(REPO / e["png"]).convert("RGBA") for e in icons}
    status = [(n, by[n]) for n in ("advisory", "info", "validate-ok", "gate", "warning", "error")]
    sheet([("status family (PH-03): advisory vs info / ok / gate / warning / error", status)],
          4).save(out / "contact-sheet-status-x4.png")
    print(json.dumps({"out": str(out), "icons": len(icons)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
