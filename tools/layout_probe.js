const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("https://onsen-mura-monogatari.pages.dev/mock_battle_layout.html", { waitUntil: "load" });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 4; i++) {
    await page.evaluate((idx) => { document.querySelectorAll("#patternBar button")[idx].click(); }, i);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `tmp/layout_${["A","B","C","D"][i]}.png` });
  }
  console.log("JSエラー:", errors.length ? errors.join(" / ") : "なし");
  await browser.close();
})();
