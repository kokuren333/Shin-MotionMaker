// App-level helpers shared by the e2e suite and the screenshot script.
import { MV_INPUT, asset } from "./fixtures.mjs";

/** Mark the element found by a JS expression with data-e2e=<name> and return its selector. */
export async function tag(page, expression, name) {
  const found = await page.evaluate(`(() => { const el = (${expression}); if (!el) return false; el.dataset.e2e = ${JSON.stringify(name)}; return true; })()`);
  if (!found) throw new Error(`要素が見つかりません: ${name}`);
  return `[data-e2e="${name}"]`;
}

/** The control inside a <label> whose own leading text equals the title. */
export const byLabel = (page, title, control = "select, input, textarea") => tag(page,
  `[...document.querySelectorAll("label")].find((label) => label.firstChild && label.firstChild.textContent.trim() === ${JSON.stringify(title)})?.querySelector(${JSON.stringify(control)})`,
  `label-${title}`);
export const byPlaceholder = (page, start) => tag(page,
  `[...document.querySelectorAll("textarea, input")].find((el) => (el.placeholder || "").startsWith(${JSON.stringify(start)}))`,
  `ph-${start.slice(0, 12)}`);
export const byAria = (label) => `[aria-label=${JSON.stringify(label)}]`;

export async function fillByLabel(page, title, value) { await page.fill(await byLabel(page, title), value); }
export async function fillByPlaceholder(page, start, value) { await page.fill(await byPlaceholder(page, start), value); }

export async function chooseMode(page, mode) {
  await page.click(`input[name="videoMode"][value="${mode}"]`);
  await page.waitFor(`document.querySelector('input[name="videoMode"][value="${mode}"]').checked`, `制作モード ${mode}`);
}

export async function fillConcept(page, { title, description, audience }) {
  await page.fill("#concept input[maxlength='200']", title);
  await page.fill("#concept textarea[required]", description);
  await page.fill(".concept-row input[required]", audience);
}

export async function fillMv(page) {
  await chooseMode(page, "mv");
  await fillConcept(page, MV_INPUT);
  await fillByPlaceholder(page, "例：夜の街", MV_INPUT.musicMood);
  await fillByPlaceholder(page, "歌詞を改行", MV_INPUT.musicLyrics);
  await page.setFiles(byAria("MVの完成音源を選択"), [asset("song.wav")]);
  await page.waitFor("[...document.querySelectorAll('.readiness li.done')].some((li) => li.textContent.includes('完成音源'))", "音源の尺の読み取り");
}

/** Export request.json through the UI and parse it. */
export async function exportRequest(page) {
  const file = await page.download(() => page.clickText(".agent-entrances button", "request.json を書き出す"));
  return { name: file.name, request: JSON.parse(file.data.toString("utf8")), bytes: file.data };
}

export const text = (page, selector) => page.evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? null`);
export const count = (page, selector) => page.evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
export const horizontalOverflow = (page) => page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth");
