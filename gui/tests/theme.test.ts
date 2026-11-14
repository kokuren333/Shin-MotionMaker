// TS-08 / GU-08: the token copy equals the CyberSprite source, colour literals live only in
// tokens.css (with the documented exceptions), and the family shape rules hold.
//
// Exceptions to "colours only in tokens.css" (GU-08):
// - index.html <meta name="theme-color">: an HTML attribute cannot read CSS variables; it must
//   equal --cs-board.
// - User data (subtitle colours) reaches the DOM as runtime values from the form, never as
//   literals in GUI source; the output-spec Biim colours live in tokens.css part 2.
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { createProject, defaults } from "../../src/core/index.ts";
import biimStandard from "../../src/core/data/biim-standard.json" with { type: "json" };
import { block, gui, read, repository, walk } from "./tokens.ts";

const tokens = read(gui, "src", "theme", "tokens.css");
const source = read(repository, "tests", "fixtures", "cybersprite-tokens-20f787d.css");
const BIIM = "/* @biim biim-standard-v1 */\n:root";

test("tokens.css carries the CyberSprite source (20f787d) byte for byte as part 1", () => {
  assert.ok(tokens.includes(source), "the verbatim copy is embedded unchanged");
  assert.match(tokens.slice(0, tokens.indexOf(source)), /20f787d/);
});

test("every --cs-* and --ui-* declaration of both theme blocks equals the source", () => {
  for (const selector of [":root", ':root[data-contrast="high"]']) {
    const pick = (css: string) => [...block(css, selector)].filter(([name]) => /^--(cs|ui)-/.test(name));
    assert.deepEqual(pick(tokens), pick(source), selector);
  }
  const base = [...block(source, ":root").keys()].filter((name) => name.startsWith("--cs-"));
  assert.equal(base.length, 15, "the 15 base tokens");
  assert.equal(block(tokens, ':root[data-contrast="high"]').get("--cs-trace"), "#0B2A3A");
});

test("the only extra colours are the Biim frame of the output spec", () => {
  assert.deepEqual(Object.fromEntries(block(tokens, BIIM)), {
    "--biim-bg": biimStandard.colors.background,
    "--biim-line": biimStandard.colors.border,
    "--biim-text": biimStandard.colors.note,
    "--biim-stroke": createProject(defaults, { sources: [] }).characters[0].subtitle_outline.toUpperCase(),
  });
  const rest = tokens.replace(source, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const literals = [...rest.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((match) => match[0]);
  assert.equal(literals.length, 4, "part 2 holds exactly the four Biim values");
  assert.doesNotMatch(rest, /--(?:cs|ui)-[\w-]+\s*:/, "no family token is redefined outside part 1");
});

const hex = /#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?\b/i;
const functional = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const named = /^(?:white|black|red|green|blue|gray|grey|silver|yellow|orange|purple|pink|navy|teal|maroon|olive|lime|aqua|fuchsia|transparent|cyan|magenta)$/i;

export function cssColourLiterals(css: string): string[] {
  const hits: string[] = [];
  for (const [, property, value] of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([\w-]+)\s*:\s*([^;{}]+);/g)) {
    if (/^(?:font-family|--font-[\w-]*|src|content)$/.test(property)) continue;
    if (hex.test(value) || functional.test(value) || value.split(/[\s,()]+/).some((word) => named.test(word)))
      hits.push(`${property}: ${value.trim()}`);
  }
  return hits;
}

test("no colour literal outside tokens.css", () => {
  const offenders: string[] = [];
  for (const file of walk(path.join(gui, "src"))) {
    if (file === "theme/tokens.css") continue;
    const body = read(gui, "src", file);
    if (file.endsWith(".css")) offenders.push(...cssColourLiterals(body).map((hit) => `${file}: ${hit}`));
    else if (/\.tsx?$/.test(file))
      for (const [, , literal] of body.matchAll(/(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g))
        if (hex.test(literal) || functional.test(literal) || named.test(literal.trim())) offenders.push(`${file}: ${literal}`);
  }
  assert.deepEqual(offenders, []);
  const html = read(gui, "index.html");
  assert.deepEqual([...html.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((match) => match[0]),
    [block(tokens, ":root").get("--cs-board")], "index.html: only theme-color, equal to --cs-board");
});

test("the colour scanner itself detects literals", () => {
  assert.equal(cssColourLiterals("a { color: #fff; }").length, 1);
  assert.equal(cssColourLiterals("a { background: rgb(1 2 3); }").length, 1);
  assert.equal(cssColourLiterals("a { border: 1px solid white; }").length, 1);
  assert.equal(cssColourLiterals("a { color: var(--ui-text); white-space: nowrap; font-family: \"Segoe UI\"; }").length, 0);
});

test("family shape rules: no shadow, ramp, blur, rounding, motion, or text under 12px", () => {
  const css = read(gui, "src", "style.css").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(css, /box-shadow|text-shadow|drop-shadow|gradient\(|blur\(|backdrop-filter/);
  for (const match of css.matchAll(/border-radius\s*:\s*([^;]+);/g)) assert.equal(match[1].trim(), "0");
  for (const match of css.matchAll(/(?:^|[\s;{])((?:transition|animation)(?:-[\w-]+)?)\s*:\s*([^;]+);/gm))
    assert.match(match[2], /^none(?:\s|$)/, `nothing animates: ${match[1]}: ${match[2]}`);
  assert.doesNotMatch(css, /@keyframes/);
  for (const match of css.matchAll(/font-size\s*:\s*([^;]+);/g)) {
    const value = match[1].trim();
    assert.doesNotMatch(value, /(?:\d(?:r?em)|%)$/, `px only: ${value}`);
    const px = value.match(/^(\d+)px$/);
    if (px) assert.ok(Number(px[1]) >= 12, `>= 12px: ${value}`);
  }
  for (const match of css.matchAll(/--(?:bm-fs[\w-]*)\s*:\s*(\d+)px/g)) assert.ok(Number(match[1]) >= 12);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
