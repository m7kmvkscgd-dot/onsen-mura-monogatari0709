// WebKit実エンジンで本番の魂の回想フローを検証する(soul_repro.jsのWebKit版)
const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("https://onsen-mura-monogatari.pages.dev/", { waitUntil: "load" });
  await page.waitForTimeout(1500);
  // タイトル画面をスキップして直接戦闘状態を組み、本物のvictory()を呼ぶ
  await page.evaluate(() => {
    state = defaultState();
    fieldParty = [createCharacter("侍", "samurai", state.classUpgrades), createCharacter("槍", "spearman", state.classUpgrades), createCharacter("狩", "hunter", state.classUpgrades)];
    fieldParty.forEach((c) => { c.__allies = fieldParty; });
    reserveFieldMember = null;
    showScreen("screen-battle");
    const boss = instantiateEnemyById("kagegui_sakazuki");
    battle = { enemies: [boss], order: [], orderIndex: 0, actingId: null, actingEnemyId: null, goldMult: 1, justAppeared: true, omamoriUsed: {}, omikujiGuaranteedCritsLeft: 0, swapCooldown: 0, roundsTotal: 3, presence: {} };
    boss.__enemyAllies = [boss];
    initBattleGimmicks();
    renderBattleScreen();
    boss.hp = 0;
    renderBattleScreen();
    victory();
  });
  const snap = async (t) => {
    const s = await page.evaluate(() => ({
      soulLine: (document.querySelector(".soul-line") || {}).textContent || "無",
      btn: !!document.getElementById("soulStoryBtn"),
      cont: !!document.getElementById("battleContinueBtn"),
    }));
    console.log(`[t=${t}ms]`, JSON.stringify(s));
    return s;
  };
  await page.waitForTimeout(1000); await snap(1000);
  await page.waitForTimeout(2200); const s3 = await snap(3200);
  if (s3.btn) {
    await page.evaluate(() => document.getElementById("soulStoryBtn").click());
    await page.waitForTimeout(600);
    const v = await page.evaluate(() => ({
      display: document.getElementById("soulStoryOverlay").style.display,
      text: document.getElementById("soulStoryText").textContent,
      imgVisible: document.getElementById("soulStoryImage").style.display !== "none",
    }));
    console.log("viewer:", JSON.stringify(v));
    await page.screenshot({ path: "tmp/soul_probe_viewer.png" });
    // タップ送り: ゲート明け後にもう1文
    await page.waitForTimeout(900);
    await page.evaluate(() => document.getElementById("soulStoryOverlay").click());
    await page.waitForTimeout(300);
    console.log("2文目後:", JSON.stringify(await page.evaluate(() => document.getElementById("soulStoryText").textContent)));
  }
  console.log("JSエラー:", errors.length ? errors.join(" / ") : "なし");
  await browser.close();
})();
