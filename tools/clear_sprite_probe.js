// 透過立ち絵テスト: 本番のテストモードで序盤10体のframeless表示を確認+本番プレイ非影響を確認
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
  await page.waitForSelector("#titleTestBtn", { timeout: 8000 });
  await page.evaluate(() => document.getElementById("titleTestBtn").click());
  await page.waitForTimeout(1500);
  // テストモードの森で、代表5体との戦闘を直接組む(見た目の確認用)
  await page.evaluate(() => {
    startBattle([instantiateEnemyById("yaken"), instantiateEnemyById("kodama"), instantiateEnemyById("bake_danuki")]);
  });
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => ({
    testMode: testModeActive,
    frameless: [...document.querySelectorAll(".enemy-card")].map((c) => c.classList.contains("frameless")),
    imgs: battle.enemies.map((e) => e.image),
  }));
  console.log("テストモード戦闘:", JSON.stringify(st));
  await page.screenshot({ path: "tmp/clear_sprites_test.png" });
  // 2枚目: 別の3体
  await page.evaluate(() => {
    battle = null;
    startBattle([instantiateEnemyById("kappa"), instantiateEnemyById("onibi"), instantiateEnemyById("kamaitachi")]);
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "tmp/clear_sprites_test2.png" });
  console.log("JSエラー:", errors.length ? errors.join(" / ") : "なし");
  await browser.close();
})();
