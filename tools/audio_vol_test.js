// 音量経路(2026-08-02 aux4チャンネルWeb Audio移行)の回帰テスト。
// スタブAudioContextでゲーム全スクリプトをロードし、GainNodeの値・Context構成・
// 宿泊/野営/環境音/オープニングの音量フローを検証する(dot_stop_test.jsと同じ実行方式)。
// 実行方法: cd C:\温泉村物語\tools && node audio_vol_test.js
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = "C:\\温泉村物語";
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const vc = new VirtualConsole();
vc.on("log", (...a) => console.log(...a));
vc.on("error", (...a) => console.error(...a));
vc.on("warn", () => {});
vc.on("jsdomError", (e) => console.error("jsdomError:", e.message));
const dom = new JSDOM(html, { url: "http://localhost:8127/", pretendToBeVisual: true, runScripts: "outside-only", virtualConsole: vc });
const { window } = dom;

window.HTMLMediaElement.prototype.play = function () { this.__paused = false; return Promise.resolve(); };
window.HTMLMediaElement.prototype.pause = function () { this.__paused = true; };
window.HTMLMediaElement.prototype.load = function () {};
Object.defineProperty(window.HTMLMediaElement.prototype, "paused", { get() { return this.__paused !== false; } });

// AudioContextスタブ: 生成されたContext/Gain/BufferSource/MediaElementSourceを全部記録する
const AUDIO_TRACE = { contexts: [] };
window.__AUDIO_TRACE = AUDIO_TRACE;
window.AudioContext = function () {
  const ctx = {
    state: "running",
    destination: { __dest: true },
    __mediaSources: [],
    __gains: [],
    __bufferSources: [],
    resume() { return Promise.resolve(); },
    createGain() {
      const g = { gain: { value: 1 }, connect(t) { g.__to = t; return t; } };
      ctx.__gains.push(g);
      return g;
    },
    createMediaElementSource(el) {
      const s = { __el: el, connect(t) { s.__to = t; return t; } };
      ctx.__mediaSources.push(s);
      return s;
    },
    createBufferSource() {
      const s = { buffer: null, loop: false, onended: null, __started: false, __stopped: false,
        connect(t) { s.__to = t; return t; },
        start() { s.__started = true; },
        stop() { s.__stopped = true; if (s.onended) s.onended(); } };
      ctx.__bufferSources.push(s);
      return s;
    },
    decodeAudioData(data) { return Promise.resolve({ __decoded: true, duration: 1 }); },
  };
  AUDIO_TRACE.contexts.push(ctx);
  return ctx;
};
window.webkitAudioContext = window.AudioContext;
window.fetch = (url) => Promise.resolve({
  ok: true,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  text: () => Promise.resolve(""),
  json: () => Promise.resolve({}),
});
if (!window.Element.prototype.animate) {
  window.Element.prototype.animate = function () { return { onfinish: null, cancel() {}, finished: Promise.resolve() }; };
}
if (!window.Element.prototype.getAnimations) window.Element.prototype.getAnimations = () => [];
window.HTMLImageElement.prototype.decode = function () { return Promise.resolve(); };
window.scrollTo = () => {};

const scripts = ["data.js", "dialogues.js", "engine.js", "save.js", "state.js", "audio.js", "ui.js", "effects.js", "skills.js", "items.js", "battle.js", "gimmicks.js", "dungeon.js", "camp.js", "town.js", "umimura.js", "raid.js", "title.js"];
let gameCode = "";
for (const s of scripts) gameCode += fs.readFileSync(path.join(ROOT, s), "utf8") + "\n";
const testBody = fs.readFileSync(path.join(__dirname, "audio_vol_body.js"), "utf8");

window.__failed = null;
try {
  window.eval(gameCode + "\n" + testBody);
} catch (e) {
  console.error("❌ 実行例外:", e.message, "\n", (e.stack || "").split("\n").slice(0, 8).join("\n"));
  process.exit(1);
}
const startedAt = Date.now();
const poll = setInterval(() => {
  if (window.__failed !== null) {
    clearInterval(poll);
    process.exit(window.__failed === 0 ? 0 : 1);
  }
  if (Date.now() - startedAt > 30000) {
    console.error("❌ タイムアウト: テストが完了しませんでした");
    clearInterval(poll);
    process.exit(1);
  }
}, 100);
