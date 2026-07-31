const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, userAgent: devices["iPhone 13"].userAgent, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  await page.goto("https://onsen-mura-monogatari.pages.dev/", { waitUntil: "load" });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const g = document.getElementById("openingTapGate"); if (g) g.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  await page.waitForSelector("#titleTestBtn", { timeout: 8000 });
  await page.evaluate(() => document.getElementById("titleTestBtn").click());
  await page.waitForTimeout(1200);
  await page.evaluate(() => { queueEncounterBattle([instantiateEnemyById("yaken"), instantiateEnemyById("kodama"), instantiateEnemyById("bake_danuki")], null, null, null); });
  await page.waitForTimeout(2400);
  const st = await page.evaluate(() => ({
    gap: getComputedStyle(document.getElementById("battlePartyBar")).gap,
    screenAnimName: getComputedStyle(document.getElementById("screen-battle")).animationName, inlineAnim: document.getElementById("screen-battle").getAttribute("style"),
  }));
  console.log(JSON.stringify(st));
  await page.screenshot({ path: "../tmp/seamless_final.png" });
  await browser.close();
})();
