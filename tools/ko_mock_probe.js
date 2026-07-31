const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, userAgent: devices["iPhone 13"].userAgent, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("https://onsen-mura-monogatari.pages.dev/mock_ko_anim.html", { waitUntil: "load" });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { pattern = "B"; renderCtrl(); document.getElementById("playBtn").click(); });
  await page.waitForTimeout(1100);
  await page.screenshot({ path: "../tmp/ko_mock_mid.png" });
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => ({ cards: document.querySelectorAll("#partyBar .pm").length, last: document.querySelector("#partyBar .pm:last-child .nm").textContent }));
  console.log(JSON.stringify(st));
  await page.screenshot({ path: "../tmp/ko_mock_after.png" });
  console.log("JSエラー:", errors.length ? errors.join(" / ") : "なし");
  await browser.close();
})();
