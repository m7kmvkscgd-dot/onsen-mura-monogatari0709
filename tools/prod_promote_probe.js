// 本採用検証: テストモードOFF相当で透過スプライト+シームレス遷移が効いているか
const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("https://onsen-mura-monogatari.pages.dev/", { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = document.getElementById("openingTapGate"); if (g) g.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); });
  await page.waitForTimeout(2800);
  await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  await page.waitForTimeout(1600);
  await page.evaluate(() => document.getElementById("titleTestBtn").click());
  await page.waitForTimeout(1200);
  const res = await page.evaluate(() => {
    testModeActive = false; // 本番プレイ相当に落として検証
    const e = instantiateEnemyById("bake_danuki");
    e.spd = 0;
    startBattle([e], null, "本採用検証！");
    return {
      img: e.image, frameless: e.frameless, scale: e.spriteScale,
      seamless: document.querySelector(".battle-top").classList.contains("seamless-entry"),
    };
  });
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => ({
    cardFrameless: !!document.querySelector(".enemy-card.frameless"),
    clearScaleVar: document.querySelector(".enemy-card").style.getPropertyValue("--clear-scale"),
  }));
  console.log(JSON.stringify(res), JSON.stringify(after), "errors:", errors.length ? errors : "none");
  await page.screenshot({ path: "../tmp/prod_promote.png" });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
