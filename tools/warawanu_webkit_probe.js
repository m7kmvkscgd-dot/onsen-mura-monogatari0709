// 笑わぬ祭の面売り: 本番URLでの通し検証(WebKit/iPhone13相当)
// クエストテスト→ルート出発→BGMキー→8層で口上→フレームレスボス→三面替えの狐面発動まで
const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("https://onsen-mura-monogatari.pages.dev/", { waitUntil: "load" });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const g = document.getElementById("openingTapGate"); if (g) g.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  await page.waitForSelector("#titleQuestTestBtn", { timeout: 8000 });
  await page.evaluate(() => document.getElementById("titleQuestTestBtn").click());
  await page.waitForTimeout(600);
  await page.selectOption("#questTestSelect", "hyakumenshi_utsuro");
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById("questTestStartBtn").click());
  await page.waitForTimeout(1500);
  const st1 = await page.evaluate(() => ({ stage: currentStage, floor: currentFloor, route: currentQuestRouteId, bgm: currentBgmKey, flavor: dungeonLogLines.some((l) => l.includes("紙風車だけが一つも回っていない")) }));
  console.log("出発:", JSON.stringify(st1));
  await page.screenshot({ path: "tmp/warawanu_route.png" });
  await page.evaluate(() => { currentFloor = 7; renderDungeon(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.getElementById("advanceBtn").click());
  await page.waitForTimeout(4000);
  const pre = await page.evaluate(() => !!document.querySelector(".pre-battle-lines-overlay"));
  console.log("口上オーバーレイ:", pre);
  if (pre) {
    await page.screenshot({ path: "tmp/warawanu_prebattle.png" });
    await page.evaluate(() => document.querySelector(".pre-battle-lines-overlay").click());
    await page.waitForTimeout(400);
    await page.evaluate(() => { const o = document.querySelector(".pre-battle-lines-overlay"); if (o) o.click(); });
    await page.waitForTimeout(1200);
  }
  const st2 = await page.evaluate(() => ({
    bgm: currentBgmKey,
    enemies: battle ? battle.enemies.map((e) => e.id) : null,
    frameless: !!document.querySelector(".enemy-card.frameless"),
    formId: battle ? battle.enemies[0].__formId : null,
    formAnnounce: battleLogLines.some((l) => l.includes("駆け回る者の顔にいたしましょう")),
    gimmickAnnounce: battleLogLines.some((l) => l.includes("百枚の面が一斉に鳴った")),
  }));
  console.log("ボス戦:", JSON.stringify(st2));
  await page.waitForTimeout(800);
  await page.screenshot({ path: "tmp/warawanu_boss.png" });
  console.log("JSエラー:", errors.length ? errors.join(" / ") : "なし");
  await browser.close();
})();
