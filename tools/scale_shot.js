const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("https://onsen-mura-monogatari.pages.dev/", { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = document.getElementById("openingTapGate"); if (g) g.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); });
  await page.waitForTimeout(2800);
  await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  await page.waitForTimeout(1600);
  await page.evaluate(() => document.getElementById("titleTestBtn").click());
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const es = [instantiateEnemyById("bake_danuki"), instantiateEnemyById("kappa"), instantiateEnemyById("hitotsume_kozo")];
    es.forEach((e) => { e.spd = 0; });
    startBattle(es, null, "スケール検証！");
  });
  await page.waitForTimeout(1800);
  const info = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll(".enemy-card img.card-portrait-img")];
    return imgs.map((i) => ({ w: Math.round(i.getBoundingClientRect().width), scale: i.closest(".enemy-card").style.getPropertyValue("--clear-scale") }));
  });
  console.log(JSON.stringify(info), "errors:", errors.length ? errors : "none");
  await page.screenshot({ path: "../tmp/scale_trio.png" });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
