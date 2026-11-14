"""Draw, validate and export the Shin-MotionMaker UI icons with the CyberSprite CLI.

Development tool. Not used by tests or CI (CI never needs CyberSprite: the PNGs
and manifest.json are committed).

Steps (each can be run alone):
  draw      original icons only (icon_grids.all_icons()): `new` when missing,
            name the palette, then one `draw_rows` transaction when the pixels
            differ from the design. Reused CyberSprite icons are never drawn.
  validate  `validate` on every .csprite (reused and original).
  export    `export image` of every .csprite to gui/public/icons/<name>.png,
            the favicon (app, x2) to gui/public/favicon.png, then
            gui/public/icons/manifest.json.
  render    `render` x1 and x4 of every icon into --renders DIR (review only).

The CyberSprite checkout is given by --cybersprite DIR or the CYBERSPRITE_DIR
environment variable. Its existing .venv is used (`uv run --no-sync`), and
nothing inside it is written. All projects and outputs live in this repo.

Usage (from the repo root):
  python assets/ui/icons/tools/build_icons.py --cybersprite <CyberSprite> draw validate export
  python assets/ui/icons/tools/build_icons.py --cybersprite <CyberSprite> render --renders <dir>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
ICONS = HERE.parent
REPO = ICONS.parents[2]
sys.path.insert(0, str(HERE))
import icon_grids  # noqa: E402

PALETTE_REL = "assets/ui/icons/ui-icons.gpl"
ICONS_REL = "assets/ui/icons"
OUT_REL = "gui/public/icons"
FAVICON_REL = "gui/public/favicon.png"
FAVICON_SCALE = 2
LAYER = "icon"
REUSE_COMMIT = "a00433c"
REUSE_AUTHOR = "Claude Opus 5.5 (CyberSprite M8 / e2e test 02)"
ORIGINAL_AUTHOR = "Claude Opus 5.5"
PALETTE_NAMES = [
    "transparent",
    "ink",
    "trace-deep",
    "trace",
    "trace-soft",
    "white",
    "warn",
    "error",
    "agent",
    "ink-soft",
    "agent-soft",
]
SYM = {
    ".": ".",
    "#": "1",
    "d": "2",
    "c": "3",
    "s": "4",
    "w": "5",
    "g": "6",
    "r": "7",
    "v": "8",
    "k": "9",
    "p": "a",
}

CS_DIR: Path


def csp(*args: str, stdin: str | None = None) -> dict:
    # The CLI only writes under its working directory, so it always runs from the repo root
    # with repo-relative paths.
    cmd = ["uv", "run", "--project", str(CS_DIR), "--no-sync", "cybersprite", "--quiet", *args]
    p = subprocess.run(
        cmd, input=stdin, capture_output=True, text=True, encoding="utf-8", cwd=REPO
    )
    try:
        out = json.loads(p.stdout)
    except json.JSONDecodeError:
        raise RuntimeError(f"{' '.join(args)} -> exit {p.returncode}\n{p.stdout}\n{p.stderr}")
    out["_exit"] = p.returncode
    return out


def all_names() -> list[str]:
    return sorted(p.name[: -len(".csprite")] for p in ICONS.glob("*.csprite"))


def proj(name: str) -> str:
    return f"{ICONS_REL}/{name}.csprite"


def draw_one(name: str, rows: list[str]) -> dict:
    log = {"name": name, "created": False, "drawn": False}
    if not (ICONS / f"{name}.csprite").exists():
        r = csp(
            "new", proj(name), "--size", "16x16", "--palette", PALETTE_REL,
            "--name", name, "--layer-name", LAYER,
        )
        if not r["ok"]:
            raise RuntimeError(f"new {name}: {r}")
        log["created"] = True
    pal = csp("-p", proj(name), "palette", "show")["result"]["colors"]
    if [c["name"] for c in pal] != PALETTE_NAMES:
        tx = {
            "label": "name ui palette",
            "ops": [
                {
                    "op": "set_palette",
                    "args": {
                        "colors": [c["color"][:7] for c in pal],
                        "names": {str(i): n for i, n in enumerate(PALETTE_NAMES)},
                    },
                }
            ],
        }
        r = csp("-p", proj(name), "apply", "-", "--preview", "none", stdin=json.dumps(tx))
        if not r["ok"]:
            raise RuntimeError(f"name palette {name}: {r}")
    want = ["".join(SYM[c] for c in row) for row in rows]
    cur = csp(
        "-p", proj(name), "pixels", "--layer", LAYER, "--frame", "0",
        "--rect", "0,0,16,16", "--as", "sym",
    )
    have = cur["result"]["rows"] if cur["ok"] else None
    if have != want:
        tx = {
            "label": f"draw icon {name}",
            "ops": [
                {
                    "op": "draw_rows",
                    "args": {
                        "layer": LAYER, "frame": 0, "x": 0, "y": 0,
                        "format": "sym", "rows": want,
                    },
                }
            ],
        }
        r = csp("-p", proj(name), "apply", "-", "--preview", "none", stdin=json.dumps(tx))
        if not r["ok"]:
            raise RuntimeError(f"apply {name}: {r}")
        log["drawn"] = True
        log["delta"] = {k: r["validation"].get(k) for k in ("ok", "errors", "warnings")}
    return log


def validate_one(name: str) -> dict:
    v = csp("-p", proj(name), "validate")
    res = v["result"]
    return {
        "name": name,
        "validate_ok": res["ok"],
        "counts": res["counts"],
        "issues": [(i["rule"], i["level"], i["message"]) for i in res["issues"]],
    }


def export_one(name: str, out_rel: str, scale: int) -> dict:
    r = csp(
        "-p", proj(name), "export", "image", "--out", out_rel,
        "--scale", str(scale), "--compression", "stored",
    )
    res = r.get("result") or {}
    f = (res.get("files") or [{}])[0]
    size = 16 * scale
    ok = (
        r["ok"] and res.get("validation_ok") is True and res.get("verified") is True
        and f.get("width") == size and f.get("height") == size
    )
    if not ok:
        raise RuntimeError(f"export {name} -> {out_rel}: {json.dumps(r, ensure_ascii=False)}")
    return {
        "name": name, "out": out_rel, "validation_ok": res["validation_ok"],
        "verified": res["verified"], "width": f["width"], "height": f["height"],
    }


def sha256(rel: str) -> str:
    return hashlib.sha256((REPO / rel).read_bytes()).hexdigest()


def cybersprite_version() -> dict:
    p = subprocess.run(
        ["uv", "run", "--project", str(CS_DIR), "--no-sync", "cybersprite", "--version"],
        capture_output=True, text=True, encoding="utf-8",
    )
    version = p.stdout.strip().split()[-1]
    g = subprocess.run(
        ["git", "-C", str(CS_DIR), "rev-parse", "--short=7", "HEAD"],
        capture_output=True, text=True, encoding="utf-8",
    )
    return {"version": version, "commit": g.stdout.strip()}


def last_changed(name: str) -> str:
    g = subprocess.run(
        ["git", "-C", str(CS_DIR), "log", "-1", "--format=%h", REUSE_COMMIT, "--",
         f"assets/ui/icons/{name}.csprite"],
        capture_output=True, text=True, encoding="utf-8",
    )
    return g.stdout.strip()


def write_manifest(names: list[str]) -> None:
    originals = set(icon_grids.all_icons())
    cs = cybersprite_version()
    icons = []
    for name in names:
        files = [{"path": f"{OUT_REL}/{name}.png", "scale": 1, "width": 16, "height": 16}]
        if name == "app":
            files.append({"path": FAVICON_REL, "scale": FAVICON_SCALE,
                          "width": 16 * FAVICON_SCALE, "height": 16 * FAVICON_SCALE})
        for f in files:
            f["sha256"] = sha256(f["path"])
        entry = {
            "name": name,
            "origin": "shin-motionmaker-original" if name in originals else "cybersprite-reuse",
            "source": f"{ICONS_REL}/{name}.csprite",
            "source_sha256": sha256(f"{ICONS_REL}/{name}.csprite/project.json"),
            "author": ORIGINAL_AUTHOR if name in originals else REUSE_AUTHOR,
            "cybersprite": cs,
            "png": files[0]["path"],
            "sha256": files[0]["sha256"],
            "files": files,
        }
        if name not in originals:
            entry["source_repo"] = "kokuren333/CyberSprite"
            entry["source_commit"] = REUSE_COMMIT
            entry["source_last_changed_commit"] = last_changed(name)
            entry["modified"] = False
        icons.append(entry)
    manifest = {
        "format": "shin-motionmaker-icons",
        "version": 1,
        "palette": PALETTE_REL,
        "size_policy": {
            "rule": "gui/public/icons/ 直下の PNG はすべて 16x16（scale 1）。"
                    "16x16 以外の PNG は icons/ の外にだけ置き、files[].scale で倍率を明記する"
                    "（寸法は 16 x scale の整数倍）。",
            "exceptions": [
                {"path": FAVICON_REL, "icon": "app", "scale": FAVICON_SCALE,
                 "reason": "favicon の大きい版（整数倍の書き出し）"}
            ],
        },
        "export": {
            "command": "cybersprite -p <source> export image --out <png> --scale <n> --compression stored",
            "note": "stored は決定論の PNG。同じ原本と同じ CyberSprite から同じバイトになる。",
        },
        "icons": icons,
    }
    out = REPO / OUT_REL / "manifest.json"
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
                   newline="\n")


def main() -> int:
    global CS_DIR
    ap = argparse.ArgumentParser()
    ap.add_argument("steps", nargs="+", choices=["draw", "validate", "export", "render"])
    ap.add_argument("--cybersprite", type=Path, default=os.environ.get("CYBERSPRITE_DIR"))
    ap.add_argument("--renders", type=Path)
    ap.add_argument("--only")
    ap.add_argument("--jobs", type=int, default=6)
    a = ap.parse_args()
    if not a.cybersprite:
        ap.error("--cybersprite or CYBERSPRITE_DIR is required")
    CS_DIR = a.cybersprite.resolve()
    keep = set(a.only.split(",")) if a.only else None
    rc = 0
    with ThreadPoolExecutor(a.jobs) as ex:
        if "draw" in a.steps:
            designs = {k: v for k, v in icon_grids.all_icons().items() if not keep or k in keep}
            for lg in ex.map(lambda kv: draw_one(*kv), designs.items()):
                print(json.dumps({"step": "draw", **lg}, ensure_ascii=False))
        names = [n for n in all_names() if not keep or n in keep]
        if "validate" in a.steps:
            for lg in ex.map(validate_one, names):
                print(json.dumps({"step": "validate", **lg}, ensure_ascii=False))
                rc |= 0 if lg["validate_ok"] else 1
        if "export" in a.steps:
            (REPO / OUT_REL).mkdir(parents=True, exist_ok=True)
            jobs = [(n, f"{OUT_REL}/{n}.png", 1) for n in names]
            if "app" in names:
                jobs.append(("app", FAVICON_REL, FAVICON_SCALE))
            for lg in ex.map(lambda j: export_one(*j), jobs):
                print(json.dumps({"step": "export", **lg}, ensure_ascii=False))
            if not keep:
                write_manifest(names)
                print(json.dumps({"step": "manifest", "icons": len(names)}))
        if "render" in a.steps:
            if not a.renders:
                ap.error("render needs --renders DIR")
            renders = a.renders.resolve()

            def render(job):
                name, scale = job
                d = renders / f"x{scale}"
                d.mkdir(parents=True, exist_ok=True)
                rel = os.path.relpath(d / f"{name}.png", REPO).replace(os.sep, "/")
                r = csp("-p", proj(name), "render", "--frame", "0", "--scale", str(scale),
                        "--out", rel)
                if not r["ok"]:
                    raise RuntimeError(f"render {name}: {r}")
                return name, scale

            for name, scale in ex.map(render, [(n, s) for n in names for s in (1, 4)]):
                print(json.dumps({"step": "render", "name": name, "scale": scale}))
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
