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
    const e2 = instantiateEnemyById("yaken");
    [e, e2].forEach((x) => { x.spd = 0; x.hp = 9999; x.maxHp = 9999; });
    startBattle([e, e2], null, "技演出検証！");
  });
  await page.waitForTimeout(1600);
  // 技系ボタン(通常攻撃/道具/交代/逃げる以外)を押す
  const pressed = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("#actionGrid button")];
    const skill = btns.find((b) => !["攻撃", "道具", "交代"].some((x) => b.textContent.startsWith(x)) && !b.disabled);
    if (!skill) return null;
    const label = skill.textContent;
    skill.click();
    return label;
  });
  console.log("pressed:", pressed);
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => ({
    bannerOpacityBeforePick: (() => { const b = document.querySelector(".skill-cast-banner"); return b ? getComputedStyle(b).opacity : "0"; })(),
    pickerActive: !!document.querySelector(".enemy-card.targetable"),
  }));
  console.log("選択前(帯はまだ出ないはず):", JSON.stringify(before));
  await page.evaluate(() => { const c = document.querySelector(".enemy-card.targetable"); if (c) c.click(); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "../tmp/skill_cast_mid.png" });
  const mid = await page.evaluate(() => ({
    bannerText: (document.querySelector(".skill-cast-banner .band") || {}).textContent || "",
    bannerVisible: (() => { const b = document.querySelector(".skill-cast-banner"); return b ? getComputedStyle(b).opacity : "none"; })(),
  }));
  console.log("選択後400ms(帯が出ているはず):", JSON.stringify(mid));
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => (document.getElementById("battleLog").textContent || "").slice(-70));
  console.log("log:", JSON.stringify(after));
  console.log("errors:", errors.length ? errors : "none");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
