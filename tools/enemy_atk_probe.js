// 敵の通常攻撃(案A)+大技(案C)の実機フロー検証: 敵先手で戦闘→通常攻撃の着弾同期、
// 大技はbigAttackCountdown=0を仕込んで溜め→解放→赤ビネットまで通す
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
  // 通常攻撃: 敵先手
  await page.evaluate(() => {
    const e = instantiateEnemyById("yaken");
    e.spd = 99; e.bigAttackCountdown = 99;
    startBattle([e], null, "通常攻撃検証！");
  });
  await page.waitForTimeout(2100); // DOTなし→600ms後に攻撃開始、着弾310ms
  const t1 = await page.evaluate(() => (document.getElementById("battleLog").textContent || "").slice(-60));
  console.log("normal-attack log:", JSON.stringify(t1));
  // 大技: カウント0を仕込んで手番を回す
  await page.evaluate(() => {
    const e = battle.enemies[0];
    e.hp = e.maxHp;
    e.bigAttackCountdown = 0; e.bigAttackPending = true;
    battle.order = [e]; battle.orderIndex = 0;
    processNext();
  });
  await page.waitForTimeout(900); // 溜めの最中(620ms+)
  await page.screenshot({ path: "../tmp/bigatk_charge.png" });
  const mid = await page.evaluate(() => ({
    dimOn: (() => { const d = document.querySelector(".big-atk-dim"); return d ? d.classList.contains("on") : false; })(), // 暗転廃止後は常にfalseであること
    auraExists: !!document.querySelector(".big-atk-aura"),
  }));
  console.log("charge-mid:", JSON.stringify(mid));
  await page.waitForTimeout(1200); // 解放+着弾後
  await page.screenshot({ path: "../tmp/bigatk_after.png" });
  const after = await page.evaluate(() => ({
    dimOff: (() => { const d = document.querySelector(".big-atk-dim"); return !d || !d.classList.contains("on"); })(),
    auraGone: !document.querySelector(".big-atk-aura"),
    logTail: (document.getElementById("battleLog").textContent || "").slice(-70),
  }));
  console.log("after:", JSON.stringify(after));
  console.log("errors:", errors.length ? errors : "none");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
