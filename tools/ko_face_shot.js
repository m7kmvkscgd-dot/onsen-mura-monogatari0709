const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await page.goto("https://onsen-mura-monogatari.pages.dev/", { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = document.getElementById("openingTapGate"); if (g) g.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); });
  await page.waitForTimeout(2800);
  await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  await page.waitForTimeout(1600);
  await page.evaluate(() => document.getElementById("titleTestBtn").click());
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const e = instantiateEnemyById("yaken");
    e.spd = 0;
    startBattle([e], null, "KO検証: 野犬が現れた！");
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    fieldParty[0].hp = 0;
    const newly = handleFieldDeaths();
    autoDeployReserveIfNeeded(newly, () => {});
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "../tmp/ko_face_mid.png", clip: { x: 0, y: 270, width: 390, height: 240 } });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
