const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, userAgent: devices["iPhone 13"].userAgent, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("https://onsen-mura-monogatari.pages.dev/mock_command_layout.html", { waitUntil: "load" });
  await page.waitForTimeout(1500);
  for (const p of ["A", "B", "C"]) {
    await page.evaluate((pp) => { pos = pp; render(); }, p);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `tmp/cmd_pos${p}.png` });
  }
  console.log("JSエラー:", errors.length ? errors.join(" / ") : "なし");
  await browser.close();
})();
