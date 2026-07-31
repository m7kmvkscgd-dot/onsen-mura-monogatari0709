// コマンド2×2+逃げる小ボタンの実挙動検証(実機相当の可視高さ664)
const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, userAgent: devices["iPhone 13"].userAgent, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("https://onsen-mura-monogatari.pages.dev/", { waitUntil: "load" });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const g = document.getElementById("openingTapGate"); if (g) g.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  await page.waitForSelector("#titleTestBtn", { timeout: 8000 });
  await page.evaluate(() => document.getElementById("titleTestBtn").click());
  await page.waitForTimeout(1200);
  await page.evaluate(() => { startBattle([instantiateEnemyById("yaken"), instantiateEnemyById("kodama"), instantiateEnemyById("bake_danuki")]); });
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => {
    const grid = [...document.querySelectorAll("#actionGrid button")].map((b) => b.textContent);
    const flee = document.getElementById("battleFleeBtn").getBoundingClientRect();
    const party = document.getElementById("battlePartyBar").getBoundingClientRect();
    const actions = document.querySelector(".battle-actions").getBoundingClientRect();
    return { grid, fleeVisible: document.getElementById("battleFleeBtn").style.display !== "none",
      fleeTop: Math.round(flee.top), partyTop: Math.round(party.top),
      fleeAboveParty: flee.bottom <= party.top + 4, actionsBottom: Math.round(actions.bottom), innerH: window.innerHeight };
  });
  console.log("配置:", JSON.stringify(st));
  await page.screenshot({ path: "tmp/flee_c_layout.png" });
  // 逃げるボタンを実際に押す→逃走準備が始まる
  await page.evaluate(() => document.getElementById("battleFleeBtn").click());
  await page.waitForTimeout(600);
  const st2 = await page.evaluate(() => ({ fleeing: fieldParty.some((c) => c.fleeState === "preparing" || c.fleeState === "fled"), log: battleLogLines.slice(-2) }));
  console.log("逃走:", JSON.stringify(st2));
  console.log("JSエラー:", errors.length ? errors.join(" / ") : "なし");
  await browser.close();
})();
