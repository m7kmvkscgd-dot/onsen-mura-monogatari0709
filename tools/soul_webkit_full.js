// 本物のプレイ経路での回想フロー検証: クエストテスト→questroute8層→確定戦闘→口上→実攻撃で撃破→回想
const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto("https://onsen-mura-monogatari.pages.dev/", { waitUntil: "load" });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const g = document.getElementById("openingTapGate"); if (g) g.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  await page.waitForTimeout(1000);
  await page.waitForSelector("#titleQuestTestBtn", { timeout: 8000 });
  await page.evaluate(() => document.getElementById("titleQuestTestBtn").click());
  await page.waitForTimeout(600);
  await page.selectOption("#questTestSelect", "kagegui_sakazuki");
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById("questTestStartBtn").click());
  await page.waitForTimeout(1200);
  const st1 = await page.evaluate(() => ({ stage: currentStage, floor: currentFloor, route: currentQuestRouteId }));
  console.log("出発:", JSON.stringify(st1));
  // 7層へ直接移動して「進む」で8層到達=確定戦闘
  await page.evaluate(() => { currentFloor = 7; renderDungeon(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.getElementById("advanceBtn").click());
  console.log("8層へ前進、遭遇演出待ち…");
  await page.waitForTimeout(4000);
  const preOverlay = await page.evaluate(() => !!document.querySelector(".pre-battle-lines-overlay"));
  console.log("口上オーバーレイ:", preOverlay);
  if (preOverlay) {
    await page.evaluate(() => document.querySelector(".pre-battle-lines-overlay").click());
    await page.waitForTimeout(400);
    await page.evaluate(() => { const o = document.querySelector(".pre-battle-lines-overlay"); if (o) o.click(); });
    await page.waitForTimeout(800);
  }
  const st2 = await page.evaluate(() => ({ battle: !!battle, enemies: battle ? battle.enemies.map((e) => e.id + ":" + e.hp) : null }));
  console.log("戦闘状態:", JSON.stringify(st2));
  // ボスHPを1にして、実際のUI操作(攻撃→対象タップ)で仕留める
  await page.evaluate(() => { battle.enemies.forEach((e) => { e.hp = 1; }); renderBattleScreen(); });
  const attacked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("#actionGrid button")];
    const atk = btns.find((b) => b.textContent.includes("攻撃"));
    if (!atk) return { ok: false, labels: btns.map((b) => b.textContent) };
    atk.click();
    return { ok: true };
  });
  console.log("攻撃ボタン:", JSON.stringify(attacked));
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const card = document.querySelector("#enemyRow .enemy-card");
    if (card) card.click();
  });
  console.log("対象選択→撃破待ち…");
  await page.waitForTimeout(4000);
  const snap = async (t) => {
    const s = await page.evaluate(() => ({
      battle: !!battle,
      soulLine: (document.querySelector(".soul-line") || {}).textContent || "無",
      btn: !!document.getElementById("soulStoryBtn"),
      cont: !!document.getElementById("battleContinueBtn"),
      gridLabels: [...document.querySelectorAll("#actionGrid button")].map((b) => b.textContent),
    }));
    console.log(`[撃破+${t}ms]`, JSON.stringify(s));
    return s;
  };
  const sA = await snap(4000);
  await page.waitForTimeout(2500);
  const sB = await snap(6500);
  await page.screenshot({ path: "tmp/soul_full_victory.png" });
  if (sB.btn) {
    await page.evaluate(() => document.getElementById("soulStoryBtn").click());
    await page.waitForTimeout(700);
    console.log("viewer:", JSON.stringify(await page.evaluate(() => ({ display: document.getElementById("soulStoryOverlay").style.display, text: document.getElementById("soulStoryText").textContent }))));
    await page.screenshot({ path: "tmp/soul_full_viewer.png" });
  }
  console.log("JSエラー:", errors.length ? errors.join(" / ") : "なし");
  await browser.close();
})();
