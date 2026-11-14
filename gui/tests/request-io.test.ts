// GU-04 / AR-04: request.json written by the GUI has the CLI/MCP shape and is checked by
// core validateRequest only.
import assert from "node:assert/strict";
import { test } from "node:test";
import { defaults, explainerStyles, mimeTypeFor, validateForm, validateRequest, type MotionForm } from "../../src/core/index.ts";
import {
  assetsFor, attachmentsToReselect, checkComplete, choiceIssues, choiceProbe, duplicateNames, errorLines, parseRequestText,
  requestFilename, requestFor, requestText,
} from "../src/lib/request-io.ts";

const file = (name: string, body = "x") => Object.assign(new Blob([body]), { name });
const explainer: MotionForm = { ...defaults, title: "虹", description: "説明", audience: "中高生" };

test("assetsFor keeps the upstream mode filter and takes MIME types from core, not File.type", () => {
  const picked = { sources: [file("a.PDF")], character: file("c.glb"), secondCharacter: file("d.glb"), bgm: file("b.wav"), music: file("m.wav") };
  const solo = assetsFor(explainer, picked);
  assert.deepEqual(Object.keys(solo).filter((key) => solo[key as keyof typeof solo]), ["sources", "character", "bgm"]);
  assert.equal(solo.sources[0].type, mimeTypeFor("a.PDF"));
  const duo = assetsFor({ ...explainer, characterMode: "duo" }, picked);
  assert.equal(duo.secondCharacter?.name, "d.glb");
  const mv = assetsFor({ ...explainer, videoMode: "mv" }, picked);
  assert.equal(mv.music?.name, "m.wav");
  assert.equal(mv.character, undefined);
  assert.equal(mv.bgm, undefined);
});

test("requestFor writes {form, assets} with bare file names and passes the core shape check", () => {
  const assets = assetsFor(explainer, { sources: [file("資料 1.pdf")], bgm: file("bgm.mp3") });
  const request = requestFor(explainer, assets);
  assert.deepEqual(Object.keys(request), ["form", "assets"]);
  assert.deepEqual(request.assets, { sources: ["資料 1.pdf"], bgm: "bgm.mp3" });
  assert.deepEqual(request.form, explainer);
  const checked = validateRequest(JSON.parse(requestText(request)), { phase: "shape" });
  assert.ok(checked.ok);
  assert.deepEqual(checked.value.form, explainer);
  assert.ok(requestText(request).endsWith("}\n"));
});

test("checkComplete equals core validateForm (same messages, same function as CLI/MCP)", () => {
  const empty = checkComplete(defaults, { sources: [] });
  assert.equal(empty.ok, false);
  assert.ok(!empty.ok && empty.error.code === "E_FORM_INVALID");
  assert.deepEqual(!empty.ok && errorLines(empty.error), validateForm(defaults, { sources: [] }));
  assert.ok(checkComplete(explainer, { sources: [] }).ok);
});

test("parseRequestText accepts a BOM and reports JSON and shape errors with pointers", () => {
  const ok = parseRequestText("﻿" + JSON.stringify({ form: { title: "t" } }));
  assert.ok(ok.ok && ok.value.form.title === "t" && ok.value.form.fps === defaults.fps);
  const broken = parseRequestText("{");
  assert.ok(!broken.ok && broken.error.code === "E_INPUT_INVALID");
  const unknown = parseRequestText(JSON.stringify({ form: { nope: 1 }, extra: true }));
  assert.ok(!unknown.ok);
  const lines = !unknown.ok ? errorLines(unknown.error) : [];
  assert.ok(lines.some((line) => line.startsWith("/form/nope")));
  assert.ok(lines.some((line) => line.startsWith("/extra")));
  assert.ok(lines.at(-1)!.length > 0, "the hint is shown");
});

test("attachmentsToReselect lists the names an imported request refers to, for the current mode", () => {
  const assets = { sources: ["materials/a.pdf", "b.png"], character: "models\\c.glb", secondCharacter: "d.glb", bgm: "e.wav", music: "f.wav" };
  assert.deepEqual(attachmentsToReselect(explainer, assets).map((entry) => entry.name), ["a.pdf", "b.png", "c.glb", "e.wav"]);
  assert.deepEqual(attachmentsToReselect({ ...explainer, characterMode: "duo" }, assets).map((entry) => entry.name), ["a.pdf", "b.png", "c.glb", "d.glb", "e.wav"]);
  assert.deepEqual(attachmentsToReselect({ ...explainer, videoMode: "mv" }, assets).map((entry) => entry.name), ["a.pdf", "b.png", "f.wav"]);
});

test("file names: request file name follows the title; duplicate attachment names are reported", () => {
  assert.equal(requestFilename(explainer), "虹.request.json");
  assert.equal(requestFilename({ ...explainer, title: " " }), "request.request.json");
  assert.equal(requestFilename({ ...explainer, title: "a/b:c" }), "b-c.request.json");
  assert.deepEqual(duplicateNames({ form: {}, assets: { sources: ["x.png", "x.png"], character: "c.glb", secondCharacter: "c.glb" } }), ["x.png", "c.glb"]);
});

test("parseRequestText rejects unknown values of fixed-choice keys with pointers, but keeps unfinished input importable (M4R R1)", () => {
  const bad = parseRequestText(JSON.stringify({ form: { title: "test", description: "test", audience: "test", styleMode: "unknown" } }));
  assert.ok(!bad.ok && bad.error.code === "E_INPUT_INVALID");
  const lines = !bad.ok ? errorLines(bad.error) : [];
  assert.ok(lines.some((line) => line.startsWith("/form/styleMode：\"unknown\"")), lines.join("\n"));
  const many = parseRequestText(JSON.stringify({ form: {
    videoMode: "film", characterMode: "trio", voiceEngine: "x", characterPosition: "top", tempo: "x", energy: "x",
    motionAmount: "x", biimUsage: "x", characterUsage: "x", evidencePolicy: "x", secondCharacter: { position: "middle" },
  } }));
  assert.deepEqual(!many.ok && (many.error.details as { pointer: string }[]).map((entry) => entry.pointer), [
    "/form/videoMode", "/form/characterMode", "/form/voiceEngine", "/form/characterPosition", "/form/tempo", "/form/energy",
    "/form/motionAmount", "/form/biimUsage", "/form/characterUsage", "/form/evidencePolicy", "/form/secondCharacter/position",
  ]);
  // Unfinished or not yet valid input (empty title, out-of-range numbers, mixed + portrait) still imports.
  for (const form of [{}, { title: "" }, { durationSec: 1 }, { styleMode: "mixed", width: 1080, height: 1920 }, { videoMode: "mv" }])
    assert.ok(parseRequestText(JSON.stringify({ form })).ok, JSON.stringify(form));
});

test("choiceIssues takes the accepted values from core, not from a GUI list", () => {
  assert.deepEqual(validateForm(choiceProbe, { sources: [], music: { name: "p.wav", data: new Uint8Array(1), size: 1, type: "audio/wav" } }), []);
  for (const mode of Object.keys(explainerStyles)) assert.deepEqual(choiceIssues({ ...defaults, styleMode: mode as MotionForm["styleMode"] }), []);
  for (const videoMode of ["explanation", "mv"] as const) assert.deepEqual(choiceIssues({ ...defaults, videoMode }), []);
  assert.equal(choiceIssues({ ...defaults, styleMode: "toString" as MotionForm["styleMode"] }).length, 1);
});
