// 攻撃の全過程(選択→対象→解決→敵の手番→次の手番)で味方バー/敵列/逃げるの位置が動かないか実測
const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, userAgent: devices["iPhone 13"].userAgent, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("https://onsen-mura-monogatari.pages.dev/", { waitUntil: "load" });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const g = document.getElementById("openingTapGate"); if (g) g.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  await page.waitForSelector("#titleTestBtn", { timeout: 8000 });
  await page.evaluate(() => document.getElementById("titleTestBtn").click());
  await page.waitForTimeout(1200);
  await page.evaluate(() => { startBattle([instantiateEnemyById("yaken"), instantiateEnemyById("kodama")]); });
  await page.waitForTimeout(2500);
  // 3秒間、120ms間隔で位置をサンプリングしながら攻撃を実行する
  await page.evaluate(() => {
    window.__samples = [];
    window.__sampler = setInterval(() => {
      const p = document.getElementById("battlePartyBar").getBoundingClientRect().top;
      const e = document.getElementById("enemyRow").getBoundingClientRect().top;
      const f = document.getElementById("battleFleeBtn").getBoundingClientRect().top;
      window.__samples.push([Math.round(p), Math.round(e), Math.round(f)]);
    }, 120);
  });
  // 攻撃→最初の敵を対象に
  await page.evaluate(() => { const b = [...document.querySelectorAll("#actionGrid button")].find((x) => x.textContent === "攻撃"); if (b) b.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const c = document.querySelector("#enemyRow .enemy-card.targetable"); if (c) c.click(); });
  await page.waitForTimeout(4000);
  const res = await page.evaluate(() => {
    clearInterval(window.__sampler);
    const s = window.__samples;
    const uniq = (i) => [...new Set(s.map((x) => x[i]))];
    return { count: s.length, partyTops: uniq(0), enemyTops: uniq(1), fleeTops: uniq(2) };
  });
  console.log(JSON.stringify(res));
  await page.screenshot({ path: "tmp/stability_after.png" });
  console.log("JSエラー:", errors.length ? errors.join(" / ") : "なし");
  await browser.close();
})();
