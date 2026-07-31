// 初回攻撃ヒット時に敵カードが上へズレる現象の再現・計測probe
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
    const e = instantiateEnemyById("yaken");
    e.spd = 0; e.hp = 9999; e.maxHp = 9999;
    startBattle([e], null, "ズレ検証: 野犬が現れた！");
  });
  await page.waitForTimeout(1600);
  const before = await page.evaluate(() => {
    const card = document.querySelector(".enemy-card");
    const row = document.getElementById("enemyRow") || document.querySelector(".enemy-row");
    const log = document.getElementById("battleLog");
    return {
      cardTop: card.getBoundingClientRect().top,
      rowTop: row ? row.getBoundingClientRect().top : null,
      rowStyleTop: row ? getComputedStyle(row).top : null,
      logBottom: log.getBoundingClientRect().bottom,
      logLines: log.textContent.length,
    };
  });
  await page.screenshot({ path: "../tmp/shift_before.png" });
  // 攻撃ボタンで1発目を当てる
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("#actionGrid button")];
    const atk = btns.find((b) => b.textContent.includes("攻撃"));
    atk.click();
  });
  await page.waitForTimeout(400);
  // 敵ターゲット選択が要るかもしれない
  await page.evaluate(() => {
    const card = document.querySelector(".enemy-card.targetable");
    if (card) card.click();
  });
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => {
    const card = document.querySelector(".enemy-card");
    const row = document.getElementById("enemyRow") || document.querySelector(".enemy-row");
    const log = document.getElementById("battleLog");
    return {
      cardTop: card.getBoundingClientRect().top,
      rowTop: row ? row.getBoundingClientRect().top : null,
      rowStyleTop: row ? getComputedStyle(row).top : null,
      logBottom: log.getBoundingClientRect().bottom,
      logLines: log.textContent.length,
    };
  });
  await page.screenshot({ path: "../tmp/shift_after.png" });
  console.log("before:", JSON.stringify(before));
  console.log("after :", JSON.stringify(after));
  console.log("cardTop delta:", after.cardTop - before.cardTop);
  console.log("errors:", errors.length ? errors : "none");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
