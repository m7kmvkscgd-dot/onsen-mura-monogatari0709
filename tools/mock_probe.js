const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("https://onsen-mura-monogatari.pages.dev/mock_clear_size.html", { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "tmp/mock_default.png" });
  // スライダーを動かして反映されるか確認(サイズ160へ)
  await page.evaluate(() => { const s = document.getElementById("size"); s.value = 160; s.dispatchEvent(new Event("input")); });
  await page.waitForTimeout(600);
  const st = await page.evaluate(() => ({
    imgW: document.querySelector("#enemyRow img").style.width,
    out: document.getElementById("out").textContent.slice(0, 80),
    saved: !!localStorage.getItem("clearSizeMock_v1"),
  }));
  console.log(JSON.stringify(st));
  await page.screenshot({ path: "tmp/mock_size160.png" });
  console.log("JSエラー:", errors.length ? errors.join(" / ") : "なし");
  await browser.close();
})();
