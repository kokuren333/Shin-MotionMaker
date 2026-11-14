// GU-16: body text contrast >= 4.5:1, computed from the tokens for both theme blocks.
import assert from "node:assert/strict";
import { test } from "node:test";
import { block, contrast, gui, read, resolve, themes } from "./tokens.ts";

const css = read(gui, "src", "theme", "tokens.css");
const biim = block(css, "/* @biim biim-standard-v1 */\n:root");
// [text token, background token, where the pair appears in style.css]
const pairs: [string, string, string][] = [
  ["--ui-text", "--cs-panel", "panels, inputs, dialog"],
  ["--ui-text", "--cs-board", "page background, disabled inputs and style cards"],
  ["--ui-text", "--cs-pad", "buttons, advice blocks, code and command boxes"],
  ["--ui-text", "--ui-pad-hover", "hovered buttons, choices and style cards"],
  ["--ui-text", "--ui-pad-on-bg", "ZIP button, passed gate verdict, readiness marks"],
  ["--ui-text", "--ui-sel-bg", "selected mode and style, import note"],
  ["--ui-ph-text-on", "--ui-ph-bg-on", "active table-of-contents item, selected tab"],
  ["--ui-text", "--ui-error-bg", "failed gate verdict and rows, error notes"],
  ["--ui-text", "--ui-warn-bg", "warn surface of the family theme"],
  ["--ui-text-soft", "--cs-panel", "helper text"],
  ["--ui-text-soft", "--cs-board", "disabled text"],
  ["--ui-text-soft", "--cs-pad", "helper text inside advice blocks"],
  ["--ui-text-soft", "--ui-sel-bg", "style hints on the selected card"],
];

for (const [name, theme] of Object.entries(themes(css))) {
  test(`${name} theme: every text pair reaches 4.5:1`, () => {
    for (const [fg, bg, where] of pairs) {
      const ratio = contrast(resolve(theme, theme.get(fg)!), resolve(theme, theme.get(bg)!));
      assert.ok(ratio >= 4.5, `${fg} on ${bg} (${where}): ${ratio.toFixed(2)}`);
    }
  });
}

test("Biim preview motif text reaches 4.5:1", () => {
  for (const fg of ["--biim-text", "--biim-line", "--biim-stroke"])
    assert.ok(contrast(biim.get(fg)!, biim.get("--biim-bg")!) >= 4.5, fg);
});

test("the contrast helper matches known WCAG values", () => {
  assert.equal(contrast("#FFFFFF", "#000000").toFixed(1), "21.0");
  assert.equal(contrast("#777777", "#FFFFFF").toFixed(2), "4.48");
});
