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
  await page.evaluate(() => { queueEncounterBattle([instantiateEnemyById("yaken")], null, null, null); });
  await page.waitForTimeout(2500);
  // 勝利させる
  await page.evaluate(() => { battle.enemies.forEach((e) => { e.hp = 0; }); victory(); });
  await page.waitForTimeout(1500);
  // 「戻る」を押した直後800msをrAFでサンプリング
  await page.evaluate(() => {
    window.__flash = [];
    const t0 = performance.now();
    const tick = () => {
      const sd = document.getElementById("screen-dungeon");
      const sb = document.getElementById("screen-battle");
      const cs = getComputedStyle(sd);
      window.__flash.push({
        t: Math.round(performance.now() - t0),
        sdActive: sd.classList.contains("active"),
        sdOp: cs.opacity,
        sdAnim: cs.animationName,
        sbActive: sb.classList.contains("active"),
        bgOp: getComputedStyle(document.getElementById("dungeonBg")).opacity,
        innerT: document.getElementById("dungeonBgInner").style.transform,
      });
      if (performance.now() - t0 < 800) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    document.getElementById("battleContinueBtn").click();
  });
  await page.waitForTimeout(1200);
  const samples = await page.evaluate(() => window.__flash);
  // opacityが1未満の瞬間だけ抜き出し
  const dips = samples.filter((s) => Number(s.sdOp) < 1);
  console.log("サンプル数:", samples.length, "opacity<1の瞬間:", dips.length);
  console.log("先頭5サンプル:", JSON.stringify(samples.slice(0, 5)));
  if (dips.length) console.log("dip詳細:", JSON.stringify(dips.slice(0, 6)));
  console.log("JSエラー:", errors.length ? errors.join(" / ") : "なし");
  await browser.close();
})();
