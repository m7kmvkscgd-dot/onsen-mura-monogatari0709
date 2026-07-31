// 回想が流れない報告の再現調査: 本物のvictory()を実時間スケールで通し、
// 魂の一言→ボタン出現→ビューアの各段が実際に動くかを観測する
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");
const ROOT = "C:/温泉村物語";
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const vc = new VirtualConsole();
vc.on("log", (...a) => console.log(...a));
vc.on("error", (...a) => console.error("PAGE ERROR:", ...a));
vc.on("jsdomError", (e) => console.error("jsdomError:", e.message));
const dom = new JSDOM(html, { url: "http://localhost:8127/", pretendToBeVisual: true, runScripts: "outside-only", virtualConsole: vc });
const { window } = dom;
window.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
window.HTMLMediaElement.prototype.pause = function () {};
window.HTMLMediaElement.prototype.load = function () {};
window.AudioContext = window.AudioContext || function () { return { createGain: () => ({ connect: () => {}, gain: { value: 1 } }), createMediaElementSource: () => ({ connect: () => {} }), resume: () => Promise.resolve(), state: "running", destination: {} }; };
window.webkitAudioContext = window.AudioContext;
window.fetch = () => Promise.resolve({ ok: false, text: () => Promise.resolve(""), json: () => Promise.resolve({}) });
if (!window.Element.prototype.animate) window.Element.prototype.animate = function () { return { onfinish: null, cancel() {}, finished: Promise.resolve() }; };
if (!window.Element.prototype.getAnimations) window.Element.prototype.getAnimations = () => [];
window.HTMLImageElement.prototype.decode = function () { return Promise.resolve(); };
window.scrollTo = () => {};
const scripts = ["data.js", "dialogues.js", "engine.js", "save.js", "state.js", "audio.js", "ui.js", "effects.js", "skills.js", "items.js", "battle.js", "gimmicks.js", "dungeon.js", "camp.js", "town.js", "umimura.js", "raid.js", "title.js"];
let code = "";
for (const s of scripts) code += fs.readFileSync(path.join(ROOT, s), "utf8") + "\n";
code += `
state = defaultState();
fieldParty = [createCharacter("侍", "samurai", state.classUpgrades), createCharacter("槍", "spearman", state.classUpgrades), createCharacter("狩", "hunter", state.classUpgrades)];
fieldParty.forEach((c) => { c.__allies = fieldParty; });
reserveFieldMember = null;
const boss = instantiateEnemyById("kagegui_sakazuki");
battle = { enemies: [boss], order: [], orderIndex: 0, actingId: null, actingEnemyId: null, goldMult: 1, justAppeared: true, omamoriUsed: {}, omikujiGuaranteedCritsLeft: 0, swapCooldown: 0, roundsTotal: 3, presence: {} };
boss.__enemyAllies = [boss];
initBattleGimmicks();
renderBattleScreen();
boss.hp = 0;
renderBattleScreen();
console.log("[t=0] victory()呼び出し");
victory();
const log = (t) => {
  const line = document.querySelector(".soul-line");
  const btn = document.getElementById("soulStoryBtn");
  const cont = document.getElementById("battleContinueBtn");
  console.log("[t=" + t + "ms] soul-line=" + (line ? JSON.stringify(line.textContent) : "無") + " btn=" + (btn ? "有" : "無") + " continueBtn=" + (cont ? "有" : "無") + " battle=" + (battle ? "有" : "null"));
};
setTimeout(() => log(500), 500);
setTimeout(() => log(1000), 1000);
setTimeout(() => log(2000), 2000);
setTimeout(() => log(3100), 3100);
setTimeout(() => {
  log(3500);
  const btn = document.getElementById("soulStoryBtn");
  if (!btn) { console.log("❌ ボタンが出ない"); window.__done = true; return; }
  btn.click();
  const viewer = document.getElementById("soulStoryOverlay");
  const textEl = document.getElementById("soulStoryText");
  console.log("[t=3500] viewer=" + viewer.style.display + " text=" + JSON.stringify(textEl.textContent));
  window.__done = true;
}, 3500);
`;
window.__done = false;
try { window.eval(code); } catch (e) { console.error("実行例外:", e.message, "\n", (e.stack || "").split("\n").slice(0, 10).join("\n")); process.exit(1); }
const t0 = Date.now();
const poll = setInterval(() => {
  if (window.__done) { clearInterval(poll); process.exit(0); }
  if (Date.now() - t0 > 15000) { console.error("タイムアウト"); clearInterval(poll); process.exit(1); }
}, 100);
