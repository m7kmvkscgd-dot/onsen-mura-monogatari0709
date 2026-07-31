// WebKit(Safari系エンジン)スモークテスト(2026-07-31導入)。
// Playwright WebKitをiPhone 13相当(ビューポート/UA/タッチ/devicePixelRatio)でエミュレートし、
// 本番URLを起動→タイトル→テストモード→DOT停止演出つきの戦闘、まで自動で流して
// JSエラーの有無・演出の実行状態・スクリーンショットを取得する。
// 注意: これは「WebKitエンジンでの検証」であり本物のiOS Safariと完全同一ではない
// (iOS固有の音声制限・アドレスバー連動ビューポート・タッチ細部は再現しない)。
// それでもBlink(Chrome)では再現しないWebKit系のCSS/JS挙動差はここで拾える。
// 実行方法: cd C:\温泉村物語\tools && node webkit_smoke.js [スクショ出力ディレクトリ]
const { webkit, devices } = require("playwright");
const path = require("path");
const fs = require("fs");

const OUT = process.argv[2] || path.join(__dirname, "webkit_shots");
const URL = "https://onsen-mura-monogatari.pages.dev/";

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text()); });

  console.log("起動中:", URL);
  await page.goto(URL, { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(1500);
  // オープニングのタップゲート→タイトル演出→メニュー表示
  await page.evaluate(() => { const g = document.getElementById("openingTapGate"); if (g) g.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); });
  await page.waitForTimeout(2800);
  await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(OUT, "webkit_title.png") });
  console.log("タイトル画面OK");

  // テストモードで出発→即、DOT持ちの敵(先手)との戦闘を直接開始する
  await page.evaluate(() => document.getElementById("titleTestBtn").click());
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const e = instantiateEnemyById("yaken");
    e.spd = 99; // 敵先手で即・敵ターン(DOT停止演出)を観測する
    e.burnTurns = 2;
    e.poison = 3;
    startBattle([e], null, "WebKit検証: 野犬が現れた！");
  });
  // 炎上表示中(暗転260ms〜、炎上ステップは約1.34秒)
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, "webkit_dot_burn.png") });
  // 毒表示中(1.6秒〜約2.6秒)
  await page.waitForTimeout(1100);
  await page.screenshot({ path: path.join(OUT, "webkit_dot_poison.png") });
  // 敵の行動完了後
  await page.waitForTimeout(2600);
  await page.screenshot({ path: path.join(OUT, "webkit_after_attack.png") });
  const state = await page.evaluate(() => ({
    dimOffAfter: !document.getElementById("battleDotStopDim").classList.contains("on"),
    enemyBurnConsumed: battle && battle.enemies[0].burnTurns === 1 && battle.enemies[0].poison === 2,
    allyDamaged: fieldParty.some((c) => c.hp < c.maxHp),
    logTail: (document.getElementById("battleLog").textContent || "").slice(-120),
  }));
  console.log("戦闘状態:", JSON.stringify(state));
  console.log("JSエラー:", errors.length === 0 ? "なし" : errors.join("\n"));
  await browser.close();
  const ok = errors.length === 0 && state.dimOffAfter && state.enemyBurnConsumed && state.allyDamaged;
  console.log(ok ? "✅ WebKitスモーク通過" : "❌ WebKitスモーク失敗");
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error("❌ 実行例外:", e.message); process.exit(1); });
