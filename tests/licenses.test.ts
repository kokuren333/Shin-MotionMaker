import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkLicenses, selectLicense, supportsPlatform } from "../tools/check-licenses.mjs";

test("DC-05 license policy rejects copyleft and unknown expressions and selects jszip MIT", () => {
  for (const license of [undefined, "GPL-3.0", "LGPL-2.1", "AGPL-3.0", "UNLICENSED", "(MIT OR GPL-3.0-or-later)"])
    assert.throws(() => selectLicense("fixture", license));
  assert.equal(selectLicense("jszip", "(MIT OR GPL-3.0-or-later)"), "MIT");
  assert.equal(selectLicense("pako", "(MIT AND Zlib)"), "MIT AND Zlib");
  for (const license of ["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0"])
    assert.equal(selectLicense("fixture", license), license);
  const musl = { os: ["linux"], cpu: ["x64"], libc: ["musl"] };
  assert.equal(supportsPlatform(musl, "linux", "x64", "glibc"), false);
  assert.equal(supportsPlatform(musl, "linux", "x64", "musl"), true);
  assert.equal(supportsPlatform(musl, "win32", "x64"), false);
  assert.equal(supportsPlatform({ os: ["!win32"] }, "win32", "x64"), false);
});

test("DC-05 inventories nested GUI development dependencies and uninstalled platform packages", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "smm-license-"));
  t.after(async () => {
    if (path.dirname(root) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("smm-license-")) throw Error("Unexpected cleanup target");
    await fs.rm(root, { recursive: true, force: true });
  });
  const relative = "gui/node_modules/fixture";
  await fs.mkdir(path.join(root, relative), { recursive: true });
  await fs.writeFile(path.join(root, relative, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0", license: "MIT" }));
  await fs.writeFile(path.join(root, relative, "LICENSE"), "MIT fixture license");
  const packages = {
    "": { license: "Apache-2.0" },
    "gui": { license: "Apache-2.0" },
    "node_modules/@shin-motionmaker/gui": { link: true, resolved: "gui" },
    [relative]: { version: "1.0.0", license: "MIT", dev: true },
    "node_modules/platform-fixture": { version: "1.0.0", license: "ISC", optional: true, os: ["fixture-os"] },
  };
  const writeLock = () => fs.writeFile(path.join(root, "package-lock.json"), JSON.stringify({ packages }));
  await writeLock();
  const inventory = await checkLicenses(root);
  assert.equal(inventory.packages.length, 2);
  const fixture = inventory.packages.find((entry) => entry.name === "fixture")!;
  assert.equal(fixture.development, true);
  assert.match(fixture.files[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(inventory.packages.find((entry) => entry.name === "platform-fixture")?.evidence, "platform-optional-lockfile");
  packages[relative].license = "GPL-3.0";
  await writeLock();
  await assert.rejects(checkLicenses(root), /未許可/);
  packages[relative].license = "MIT";
  await writeLock();
  await fs.unlink(path.join(root, relative, "LICENSE"));
  await assert.rejects(checkLicenses(root), /LICENSE 本文/);
  await fs.rm(path.join(root, relative), { recursive: true });
  await assert.rejects(checkLicenses(root), { code: "ENOENT" });
});
