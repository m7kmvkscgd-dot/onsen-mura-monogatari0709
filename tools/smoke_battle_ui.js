// ゲームUIのスモークテスト(2026-07-26作成、108項目): jsdomで実DOM+実ゲームスクリプト全体を
// 読み込み、戦闘UIの差分更新・交代/回復UX・かばう×大技などの挙動を検証する。
// 実行方法: cd C:\温泉村物語\tools && npm install && node smoke_battle_ui.js
// (描画タイミング・アニメーションの見た目はjsdomでは検証できない。そこは実機確認が必要)
// テスト本体は smoke_body.js(ゲームスクリプトと同じevalスコープで実行され、bare識別子で
// ゲームのlet/constに触れる)。新しいUI改修をしたらここにケースを足していく。
// 各ファイルのトップレベルconst/letを共有させるため、全スクリプト+テスト本体を1回のevalで流す
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

// ---- ブラウザ専用APIのスタブ ----
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

const scripts = ["data.js", "dialogues.js", "engine.js", "save.js", "state.js", "audio.js", "ui.js", "effects.js", "skills.js", "items.js", "battle.js", "dungeon.js", "camp.js", "town.js", "umimura.js", "title.js"];
let gameCode = "";
for (const s of scripts) gameCode += fs.readFileSync(path.join(ROOT, s), "utf8") + "\n";
const testBody = fs.readFileSync(path.join(__dirname, "smoke_body.js"), "utf8");

window.__failed = null;
try {
  window.eval(gameCode + "\n" + testBody);
} catch (e) {
  console.error("❌ 実行例外:", e.message, "\n", (e.stack || "").split("\n").slice(0, 6).join("\n"));
  process.exit(1);
}
process.exit(window.__failed === 0 ? 0 : 1);
