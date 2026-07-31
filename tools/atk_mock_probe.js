const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("https://onsen-mura-monogatari.pages.dev/mock_enemy_attack.html", { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(1200);
  for (const n of ["cur", "A", "B", "C", "D", "E"]) {
    await page.evaluate((n) => { playing = false; document.querySelector(`#ctrl button[data-n="${n}"]`).click(); }, n);
    if (n === "C") { await page.waitForTimeout(1250); await page.screenshot({ path: "../tmp/atk_mock_C.png" }); }
    else if (n === "D") { await page.waitForTimeout(1450); await page.screenshot({ path: "../tmp/atk_mock_D.png" }); }
    else await page.waitForTimeout(1300);
  }
  console.log("errors:", errors.length ? errors : "none");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
