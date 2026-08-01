// 音量エディタ(audio_editor.html)の回帰テスト(2026-08-02):
// ①BGM_TRACKS(audio.js)とBGM_ITEMS(エディタ)のキー・ファイル・基準値の完全一致
// ②スライダーstep=0.01(0.56/0.96等の基準値が丸められない)
// ③試聴がWeb Audio経路で、焼き込み済みファイルはvol÷bakedのゲインになる(二重減衰解消)
// 実行方法: cd C:\温泉村物語\tools && node audio_editor_test.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = "C:\\温泉村物語";
const audioJs = fs.readFileSync(path.join(ROOT, "audio.js"), "utf8");
const editorHtml = fs.readFileSync(path.join(ROOT, "audio_editor.html"), "utf8");
const errors = [];
const ok = (cond, msg) => { if (!cond) { errors.push(msg); console.error("  ✗ " + msg); } };

// ---- ① キー照合: audio.jsのBGM_TRACKSをvmで評価して取り出す ----
const tracksMatch = audioJs.match(/const BGM_TRACKS = \{[\s\S]*?\n\};/);
const BGM_TRACKS = vm.runInNewContext(tracksMatch[0].replace("const BGM_TRACKS =", "(") .replace(/;\s*$/, ")"));
// ゲーム側のキー別実効音量(bgmVolumeForKey相当)をaudio.jsの定数から再現する
const num = (name) => Number(audioJs.match(new RegExp(`const ${name} = ([0-9.]+)`))[1]);
const BASE = num("BGM_BASE_VOLUME"), COAST = num("COAST_BGM_VOLUME_MULT"), TOWN = num("TOWN_DAY_BGM_VOLUME_MULT"), NB = num("NORMAL_BATTLE_BGM_VOLUME_MULT");
const expectedVol = (key) => {
  if (key === "coast" || key === "coast_night" || key === "coast_battle") return Math.min(1, BASE * COAST);
  if (key === "dungeon") return 1;
  if (key === "dungeon_night") return Math.min(1, BASE * NB);
  if (key === "town") return BASE * TOWN;
  return BASE;
};

const dom = new JSDOM(editorHtml, {
  url: "http://localhost:8127/audio_editor.html",
  runScripts: "outside-only",
  pretendToBeVisual: true,
  virtualConsole: new VirtualConsole().on("error", () => {}),
});
const { window } = dom;
const bufferSources = [];
window.AudioContext = function () {
  const ctx = {
    state: "running",
    destination: { __dest: true },
    resume: () => Promise.resolve(),
    createGain() { const g = { gain: { value: 1 }, connect(t) { g.__to = t; return t; } }; return g; },
    createBufferSource() {
      const s = { buffer: null, loop: false, __started: false, connect(t) { s.__to = t; return t; }, start() { s.__started = true; }, stop() { s.__stopped = true; } };
      bufferSources.push(s);
      return s;
    },
    decodeAudioData: () => Promise.resolve({ __decoded: true }),
  };
  return ctx;
};
window.webkitAudioContext = window.AudioContext;
const fetched = [];
window.fetch = (url) => { fetched.push(String(url)); return Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }); };
window.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
window.HTMLMediaElement.prototype.pause = function () {};

const scriptSrc = editorHtml.match(/<script>([\s\S]*)<\/script>/)[1];
// evalスコープのトップレベルconstは別のevalから見えないため、同じeval内でwindowへ書き出す
window.eval(scriptSrc + "\nwindow.__EDITOR = { BGM_ITEMS, CHANNEL_ITEMS };");

(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const BGM_ITEMS = window.__EDITOR.BGM_ITEMS;
  const CHANNEL_ITEMS = window.__EDITOR.CHANNEL_ITEMS;
  const editorKeys = new Set(BGM_ITEMS.map((i) => i.key));
  const trackKeys = new Set(Object.keys(BGM_TRACKS));
  const missing = [...trackKeys].filter((k) => !editorKeys.has(k));
  const extra = [...editorKeys].filter((k) => !trackKeys.has(k));
  ok(missing.length === 0, `エディタに無いBGMキー: ${missing.join(",")}`);
  ok(extra.length === 0, `ゲームに無いBGMキー: ${extra.join(",")}`);
  for (const item of BGM_ITEMS) {
    ok(item.file === BGM_TRACKS[item.key], `${item.key}のファイル(エディタ${item.file} / ゲーム${BGM_TRACKS[item.key]})`);
    ok(Math.abs(item.vol - expectedVol(item.key)) < 0.005, `${item.key}の基準値(エディタ${item.vol} / ゲーム${expectedVol(item.key)})`);
  }
  // boss_battle_climaxとraid_battleは同ファイル別キーとして両方載っていること
  ok(editorKeys.has("boss_battle_climax") && editorKeys.has("raid_battle"), "同ファイル別キー(climax/raid)が両方掲載");

  // その他タブの基準値: ゲーム実値(lodging0.5/camp0.5/ambient0.45/cave最終0.4(baked0.4)/opening0.5(baked0.5))
  const ch = Object.fromEntries(CHANNEL_ITEMS.map((i) => [i.key, i]));
  ok(ch.lodging.vol === 0.5 && ch.camp.vol === 0.5 && ch.ambient.vol === 0.45, "lodging/camp/ambientの基準値");
  ok(ch.cave_ambient && ch.cave_ambient.vol === 0.4 && ch.cave_ambient.baked === 0.4, "洞窟は最終40%・焼き込み40%");
  ok(ch.opening.vol === 0.5 && ch.opening.baked === 0.5, "openingは50%・焼き込み50%");

  // ---- ② step=0.01と1%基準値の保持 ----
  const sliders = window.document.querySelectorAll('input[type="range"]');
  ok(sliders.length > 0 && [...sliders].every((s) => s.step === "0.01"), "全スライダーがstep=0.01");
  const townRow = window.document.querySelector('.row[data-key="town"]');
  ok(townRow.querySelector('input[type="range"]').value === "0.56", `town基準値0.56がスライダーに保持(${townRow.querySelector("input").value})`);
  ok(townRow.querySelector(".val").textContent === "56%", "town表示が56%");

  // ---- ③ 試聴: opening(焼き込み0.5)の試聴ゲインは0.5÷0.5=1.0(二重減衰しない) ----
  // その他タブへ切り替えてopeningの▶を押す
  [...window.document.querySelectorAll(".tab")].find((t) => t.dataset.sec === "channels").click();
  const openingRow = window.document.querySelector('.row[data-key="opening"]');
  openingRow.querySelector('[data-act="play"]').click();
  await sleep(100);
  const src = bufferSources[bufferSources.length - 1];
  ok(!!src && src.__started && src.loop === true, "opening試聴がバッファ再生(ループ)");
  ok(src.__to && src.__to.gain && Math.abs(src.__to.gain.value - 1.0) < 0.001, `opening試聴ゲイン=1.0(実際${src && src.__to && src.__to.gain.value})`);
  ok(fetched.some((u) => u.includes("opening_bgm.mp3")), "openingのファイルをfetchした");
  // 再選択(キャッシュ利用=再fetchしない)と停止
  openingRow.querySelector('[data-act="play"]').click(); // 停止
  const fetchCount = fetched.filter((u) => u.includes("opening_bgm.mp3")).length;
  openingRow.querySelector('[data-act="play"]').click(); // 再再生
  await sleep(100);
  ok(fetched.filter((u) => u.includes("opening_bgm.mp3")).length === fetchCount, "再選択でファイルを再取得しない(キャッシュ)");
  ok(src.__stopped, "前の試聴ソースは停止されている");
  // 洞窟行: 最終40%÷焼き込み40%=1.0
  const caveRow = window.document.querySelector('.row[data-key="cave_ambient"]');
  caveRow.querySelector('[data-act="play"]').click();
  await sleep(100);
  const caveSrc = bufferSources[bufferSources.length - 1];
  ok(Math.abs(caveSrc.__to.gain.value - 1.0) < 0.001, `洞窟試聴ゲイン=1.0(実際${caveSrc.__to.gain.value})`);
  // 再生中にスライダーを動かすと試聴ゲインがリアルタイムに追従する(20%÷焼き込み40%=0.5)
  const caveSlider = caveRow.querySelector('input[type="range"]');
  caveSlider.value = "0.2";
  caveSlider.dispatchEvent(new window.Event("input", { bubbles: true }));
  ok(Math.abs(caveSrc.__to.gain.value - 0.5) < 0.001, `スライダー追従: 20%でゲイン0.5(実際${caveSrc.__to.gain.value})`);
  ok(caveRow.querySelector(".val").textContent === "20%", "スライダー追従: 表示も20%");

  if (errors.length === 0) console.log("✅ audio_editor_test: 全チェック通過");
  else console.error(`❌ audio_editor_test: ${errors.length}件失敗`);
  process.exit(errors.length === 0 ? 0 : 1);
})().catch((e) => { console.error("❌ 例外:", e.message, (e.stack || "").split("\n").slice(0, 6).join("\n")); process.exit(1); });
