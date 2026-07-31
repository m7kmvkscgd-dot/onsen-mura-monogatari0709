const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await page.goto("https://onsen-mura-monogatari.pages.dev/", { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = document.getElementById("openingTapGate"); if (g) g.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); });
  await page.waitForTimeout(2800);
  await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  await page.waitForTimeout(1600);
  await page.evaluate(() => document.getElementById("titleTestBtn").click());
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const e = instantiateEnemyById("yaken");
    e.spd = 0; e.hp = 9999; e.maxHp = 9999;
    startBattle([e], null, "ズレ検証: 野犬が現れた！");
  });
  await page.waitForTimeout(1600);
  const dump = () => {
    const card = document.querySelector(".enemy-card");
    return {
      cardH: Math.round(card.getBoundingClientRect().height),
      kids: [...card.children].map((el) => `${el.className}:${Math.round(el.getBoundingClientRect().height)}`),
    };
  };
  const before = await page.evaluate(dump);
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("#actionGrid button")];
    btns.find((b) => b.textContent.includes("攻撃")).click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const c = document.querySelector(".enemy-card.targetable"); if (c) c.click(); });
  await page.waitForTimeout(2500);
  const after = await page.evaluate(dump);
  console.log("before:", JSON.stringify(before, null, 1));
  console.log("after :", JSON.stringify(after, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
