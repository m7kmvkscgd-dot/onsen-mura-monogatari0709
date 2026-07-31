// ボスギミック機構(gimmicks.js)+ボステスト(title.js)の単体テスト(2026-07-31)。
// smoke_battle_ui.jsと同じ方式: jsdomで実DOM+実ゲームスクリプト全体を読み込み、
// テスト本体(boss_gimmick_body.js)を同じevalスコープで実行する。
// 実行方法: cd C:\温泉村物語\tools && node boss_gimmick_test.js
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

window.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
window.HTMLMediaElement.prototype.pause = function () {};
window.HTMLMediaElement.prototype.load = function () {};
window.AudioContext = window.AudioContext || function () {
  return { createGain: () => ({ connect: () => {}, gain: { value: 1 } }), createMediaElementSource: () => ({ connect: () => {} }), resume: () => Promise.resolve(), state: "running", destination: {} };
};
window.webkitAudioContext = window.AudioContext;
window.fetch = () => Promise.resolve({ ok: false, text: () => Promise.resolve(""), json: () => Promise.resolve({}) });
if (!window.Element.prototype.animate) {
  window.Element.prototype.animate = function () { return { onfinish: null, cancel() {}, finished: Promise.resolve() }; };
}
if (!window.Element.prototype.getAnimations) window.Element.prototype.getAnimations = () => [];
window.HTMLImageElement.prototype.decode = function () { return Promise.resolve(); };
window.scrollTo = () => {};

const scripts = ["data.js", "dialogues.js", "engine.js", "save.js", "state.js", "audio.js", "ui.js", "effects.js", "skills.js", "items.js", "battle.js", "gimmicks.js", "dungeon.js", "camp.js", "town.js", "umimura.js", "raid.js", "title.js"];
let gameCode = "";
for (const s of scripts) gameCode += fs.readFileSync(path.join(ROOT, s), "utf8") + "\n";
const testBody = fs.readFileSync(path.join(__dirname, "boss_gimmick_body.js"), "utf8");

window.__failed = null;
try {
  window.eval(gameCode + "\n" + testBody);
} catch (e) {
  console.error("❌ 実行例外:", e.message, "\n", (e.stack || "").split("\n").slice(0, 8).join("\n"));
  process.exit(1);
}
process.exit(window.__failed === 0 ? 0 : 1);
