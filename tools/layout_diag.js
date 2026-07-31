const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await page.goto("https://onsen-mura-monogatari.pages.dev/", { waitUntil: "load" });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const g = document.getElementById("openingTapGate"); if (g) g.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  await page.waitForSelector("#titleTestBtn", { timeout: 8000 });
  await page.evaluate(() => document.getElementById("titleTestBtn").click());
  await page.waitForTimeout(1200);
  await page.evaluate(() => { startBattle([instantiateEnemyById("yaken"), instantiateEnemyById("kodama"), instantiateEnemyById("bake_danuki")]); });
  await page.waitForTimeout(2200);
  const st = await page.evaluate(() => {
    const row = document.getElementById("enemyRow");
    const rs = getComputedStyle(row);
    const bt = row.closest(".battle-top");
    const cards = [...row.querySelectorAll(".enemy-card")].map((c) => {
      const cs = getComputedStyle(c);
      const img = c.querySelector("img.card-portrait-img");
      const is = img ? getComputedStyle(img) : null;
      const widest = [...c.querySelectorAll("*")].reduce((m, el) => Math.max(m, el.getBoundingClientRect().width), 0);
      return { w: c.getBoundingClientRect().width, top: Math.round(c.getBoundingClientRect().top),
        pad: cs.padding, border: cs.borderWidth, imgW: img ? img.getBoundingClientRect().width : null, imgCssW: is ? is.width : null,
        cls: c.className, widestChild: Math.round(widest) };
    });
    return {
      btClass: bt.className, rowPos: rs.position, rowTop: rs.top, rowW: row.getBoundingClientRect().width,
      rowRectTop: Math.round(row.getBoundingClientRect().top), rowPadding: rs.padding, gap: rs.gap,
      innerH: window.innerHeight, vhBase: document.documentElement.clientHeight,
      cards,
    };
  });
  console.log(JSON.stringify(st, null, 1));
  await browser.close();
})();
