// 「3体=絶対1行」+レイアウト非崩壊の実機幅検証(iPhone13/SE/最小320px)
const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const widths = [
    { name: 'iPhone13フル(390x844)', vp: { width: 390, height: 844 } },
    { name: 'iPhone13バー表示相当(390x664)', vp: { width: 390, height: 664 } },
    { name: 'バー全展開相当(390x527)', vp: { width: 390, height: 527 } },
    { name: 'SEバー表示相当(375x553)', vp: { width: 375, height: 553 } },
    { name: '最小(320x480)', vp: { width: 320, height: 480 } },
  ];
  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: w.vp, userAgent: devices["iPhone 13"].userAgent, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
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
    await page.waitForTimeout(2200);
    const st = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("#enemyRow .enemy-card")];
      const tops = cards.map((c) => Math.round(c.getBoundingClientRect().top));
      const oneRow = new Set(tops).size === 1;
      const log = document.getElementById("battleLog").getBoundingClientRect();
      const rowRect = document.getElementById("enemyRow").getBoundingClientRect();
      const firstCard = cards[0].getBoundingClientRect();
      const party = document.getElementById("battlePartyBar").getBoundingClientRect();
      const actions = document.querySelector(".battle-actions").getBoundingClientRect();
      return {
        cardCount: cards.length, oneRow, tops,
        logBottom: Math.round(log.bottom), cardTop: Math.round(firstCard.top),
        cardBottom: Math.round(firstCard.bottom), partyTop: Math.round(party.top),
        actionsBottom: Math.round(actions.bottom), innerH: window.innerHeight,
        overlapLogCard: log.bottom > firstCard.top,
        overlapCardParty: firstCard.bottom > party.top,
        actionsOffscreen: actions.bottom > window.innerHeight + 1,
      };
    });
    console.log(w.name, JSON.stringify(st));
    await page.screenshot({ path: `tmp/verify_${w.vp.width}.png` });
    console.log(w.name, "JSエラー:", errors.length ? errors.join(" / ") : "なし");
    await ctx.close();
  }
  await browser.close();
})();
