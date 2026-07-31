const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("https://onsen-mura-monogatari.pages.dev/mock_ally_attack.html", { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(1200);
  for (const n of ["cur", "A", "B", "C"]) {
    await page.evaluate((n) => { playing = false; document.querySelector(`#ctrl button[data-n="${n}"]`).click(); }, n);
    if (n === "C") { await page.waitForTimeout(300); await page.screenshot({ path: "../tmp/ally_mock_C.png" }); await page.waitForTimeout(500); }
    else await page.waitForTimeout(800);
  }
  console.log("errors:", errors.length ? errors : "none");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
