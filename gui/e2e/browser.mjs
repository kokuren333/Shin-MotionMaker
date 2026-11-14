// Dependency-free browser harness for e2e and screenshots (GU-15, GU-17, TS-08).
// Serves the Pages build under a sub-path and drives a headless Chrome / Edge through
// the DevTools Protocol with Node's built-in WebSocket. Ported from BiimMotion
// tools/ui-shots.mjs (262c798). A missing browser is an explicit failure, never a skip.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const BASE = "/Shin-MotionMaker/";
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".ttf": "font/ttf", ".woff2": "font/woff2", ".ico": "image/x-icon",
};

/** Static server that answers only under BASE, like GitHub Pages for a project site. */
export function serve(dist, base = BASE) {
  const root = path.resolve(dist);
  const requests = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    requests.push(url.pathname);
    if (!url.pathname.startsWith(base)) {
      response.writeHead(404);
      return response.end();
    }
    let file = path.normalize(path.join(root, decodeURIComponent(url.pathname.slice(base.length))));
    if (file !== root && !file.startsWith(root + path.sep)) {
      response.writeHead(403);
      return response.end();
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) {
      response.writeHead(404);
      return response.end();
    }
    response.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
    response.end(fs.readFileSync(file));
  });
  return new Promise((done) => server.listen(0, "127.0.0.1", () =>
    done({ server, requests, url: `http://127.0.0.1:${server.address().port}${base}` })));
}

export function findBrowser() {
  const env = process.env;
  const candidates = [
    env.CHROME_PATH,
    process.platform === "win32" && `${env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
    process.platform === "win32" && `${env["PROGRAMFILES(X86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
    process.platform === "win32" && `${env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    process.platform === "win32" && `${env["PROGRAMFILES(X86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
    process.platform === "win32" && `${env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
    process.platform === "darwin" && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(
    "e2e に使うブラウザ（Chrome・Chromium・Edge）が見つかりません。CHROME_PATH に実行ファイルのパスを設定してください。" +
    "この検査はブラウザが無い環境でも省略せず、失敗として扱います。");
  return found;
}

export async function launchBrowser() {
  if (typeof WebSocket !== "function") throw new Error(`Node ${process.version} には WebSocket がありません。Node 22 以上を使ってください。`);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "smm-e2e-profile-"));
  const child = spawn(findBrowser(), [
    "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--hide-scrollbars",
    "--force-color-profile=srgb", "--lang=ja-JP", "--font-render-hinting=none",
    ...(process.platform === "linux" ? ["--no-sandbox", "--disable-dev-shm-usage"] : []),
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"], shell: false });
  const endpoint = await new Promise((done, fail) => {
    let log = "";
    const timer = setTimeout(() => fail(new Error(`ブラウザが起動しませんでした。\n${log}`)), 30000);
    child.stderr.on("data", (data) => {
      log += data;
      const match = log.match(/DevTools listening on (ws[^\s]+)/);
      if (match) { clearTimeout(timer); done(match[1]); }
    });
    child.on("exit", (code) => { clearTimeout(timer); fail(new Error(`ブラウザが終了しました（${code}）。\n${log}`)); });
  });
  const cdp = new Cdp(endpoint);
  await cdp.ready;
  return {
    cdp,
    async close() {
      try { await cdp.send("Browser.close"); } catch { /* already closed */ }
      cdp.close();
      await new Promise((done) => { if (child.exitCode !== null) done(); else { child.once("exit", done); setTimeout(done, 5000); } });
      try { child.kill(); } catch { /* gone */ }
      // Helper processes of the browser may hold the profile for a moment on Windows.
      for (let attempt = 0; attempt < 10; attempt++) {
        try { fs.rmSync(profile, { recursive: true, force: true }); break; }
        catch { await sleep(300); }
      }
    },
  };
}

class Cdp {
  constructor(endpoint) {
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Set();
    this.socket = new WebSocket(endpoint);
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { done, fail } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) fail(new Error(`${message.error.message} ${message.error.data ?? ""}`));
        else done(message.result);
      } else if (message.method) for (const listener of this.listeners) listener(message);
    });
    this.ready = new Promise((done, fail) => {
      this.socket.addEventListener("open", done, { once: true });
      this.socket.addEventListener("error", fail, { once: true });
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((done, fail) => this.pending.set(id, { done, fail }));
  }
  on(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  close() { this.socket.close(); }
}

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * Open one page in a fresh browser context.
 * @param {{ width?: number, height?: number, downloads?: string, reducedMotion?: boolean }} options
 */
export async function openPage(cdp, url, { width = 1440, height = 900, downloads, reducedMotion = false } = {}) {
  const { browserContextId } = await cdp.send("Target.createBrowserContext");
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => cdp.send(method, params, sessionId);
  const consoleErrors = [];
  const failedRequests = [];
  const completedDownloads = new Map();
  const off = cdp.on((message) => {
    if (message.sessionId === sessionId) {
      if (message.method === "Runtime.exceptionThrown")
        consoleErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error")
        consoleErrors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
      if (message.method === "Log.entryAdded" && message.params.entry.level === "error")
        consoleErrors.push(`${message.params.entry.text} ${message.params.entry.url ?? ""}`);
      if (message.method === "Network.responseReceived" && message.params.response.status >= 400)
        failedRequests.push(`${message.params.response.status} ${message.params.response.url}`);
    }
    if (message.method === "Browser.downloadWillBegin")
      completedDownloads.set(message.params.guid, { name: message.params.suggestedFilename, done: false });
    if (message.method === "Browser.downloadProgress" && message.params.state === "completed") {
      const entry = completedDownloads.get(message.params.guid);
      if (entry) entry.done = true;
    }
  });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");
  await send("DOM.enable");
  if (downloads) {
    fs.mkdirSync(downloads, { recursive: true });
    await cdp.send("Browser.setDownloadBehavior", {
      behavior: "allowAndName", downloadPath: downloads, browserContextId, eventsEnabled: true,
    });
  }
  await cdp.send("Browser.grantPermissions", {
    permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"], browserContextId,
    origin: new URL(url).origin,
  }).catch(() => {});
  // Always emulate: hosts with OS animations disabled (CI runners) otherwise report "reduce".
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reducedMotion ? "reduce" : "no-preference" }] });

  const page = {
    send, sessionId, consoleErrors, failedRequests,
    async resize(w, h) {
      const mobile = w < 600;
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
      await send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
    },
    async goto(target) {
      const loaded = new Promise((done) => {
        const stop = cdp.on((message) => {
          if (message.sessionId === sessionId && message.method === "Page.loadEventFired") { stop(); done(); }
        });
      });
      await send("Page.navigate", { url: target });
      await loaded;
    },
    async evaluate(expression) {
      const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
      if (result.exceptionDetails)
        throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      return result.result.value;
    },
    async waitFor(expression, label = expression, timeout = 15000) {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        if (await page.evaluate(`Boolean(${expression})`)) return;
        await sleep(80);
      }
      throw new Error(`待機がタイムアウトしました: ${label}`);
    },
    /** Set a React-controlled input / textarea / select and fire the events React listens to. */
    async fill(selector, value) {
      await page.evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error("not found: " + ${JSON.stringify(selector)});
        const proto = Object.getPrototypeOf(el);
        Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(String(value))});
        el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
      })()`);
    },
    async click(selector) {
      await page.evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error("not found: " + ${JSON.stringify(selector)});
        el.click();
      })()`);
    },
    async clickText(selector, text) {
      await page.evaluate(`(() => {
        const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((node) => node.textContent.includes(${JSON.stringify(text)}));
        if (!el) throw new Error("not found: " + ${JSON.stringify(selector)} + " " + ${JSON.stringify(text)});
        el.click();
      })()`);
    },
    async setFiles(selector, files) {
      const { root } = await send("DOM.getDocument", { depth: 0 });
      const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector });
      if (!nodeId) throw new Error(`not found: ${selector}`);
      await send("DOM.setFileInputFiles", { nodeId, files: files.map((file) => path.resolve(file)) });
    },
    async key(key, { shift = false } = {}) {
      const codes = { Tab: 9, Escape: 27, Enter: 13, " ": 32 };
      const base = { key, code: key === " " ? "Space" : key, windowsVirtualKeyCode: codes[key], nativeVirtualKeyCode: codes[key], modifiers: shift ? 8 : 0 };
      await send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...base });
      await send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
    },
    async reveal(selector) {
      await page.evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error("not found: " + ${JSON.stringify(selector)});
        const body = el.closest(".region-body");
        if (body && body.scrollHeight > body.clientHeight && getComputedStyle(body).overflowY !== "visible") {
          body.scrollTop = el.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 8;
          return;
        }
        window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 110);
      })()`);
    },
    async settle() {
      await page.evaluate("document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))");
      await sleep(250);
    },
    async screenshot(file) {
      await page.settle();
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(data, "base64"));
    },
    /** Wait for a finished download and return its bytes and suggested name. */
    async download(trigger, timeout = 60000) {
      const before = new Set(completedDownloads.keys());
      await trigger();
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        for (const [guid, entry] of completedDownloads)
          if (!before.has(guid) && entry.done)
            return { name: entry.name, data: fs.readFileSync(path.join(downloads, guid)) };
        await sleep(100);
      }
      throw new Error("ダウンロードが完了しませんでした。");
    },
    async close() {
      off();
      await cdp.send("Target.closeTarget", { targetId }).catch(() => {});
      await cdp.send("Target.disposeBrowserContext", { browserContextId }).catch(() => {});
    },
  };
  await page.resize(width, height);
  await page.goto(url);
  await page.waitFor("document.querySelector('form.studio') && document.querySelector('.download-button')", "画面の表示");
  return page;
}
