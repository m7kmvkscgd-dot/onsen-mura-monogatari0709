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
  // 3体frameless編成(テストモードの透過差し替え)でサイズ検証
  await page.evaluate(() => {
    const es = [instantiateEnemyById("yaken"), instantiateEnemyById("yaken"), instantiateEnemyById("yaken")];
    es.forEach((e) => { e.spd = 0; });
    startBattle(es, null, "サイズ検証: 野犬の群れ！");
  });
  await page.waitForTimeout(1800);
  const size = await page.evaluate(() => {
    const row = document.getElementById("enemyRow");
    const cards = [...row.querySelectorAll(".enemy-card")];
    const imgs = cards.map((c) => c.querySelector("img.card-portrait-img"));
    const tops = cards.map((c) => Math.round(c.getBoundingClientRect().top));
    const bottoms = cards.map((c) => Math.round(c.getBoundingClientRect().bottom));
    const pbar = document.getElementById("battlePartyBar");
    const pTop = Math.round(pbar.getBoundingClientRect().top);
    return {
      allFrameless: row.classList.contains("all-frameless"),
      imgW: imgs.map((i) => Math.round(i.getBoundingClientRect().width)),
      oneRow: new Set(tops).size === 1,
      cardBottomMax: Math.max(...bottoms),
      partyBarTop: pTop,
      hpBarW: Math.round(cards[0].querySelector(".hp-with-warning, .hpbar-track").getBoundingClientRect().width),
    };
  });
  console.log("size:", JSON.stringify(size));
  await page.screenshot({ path: "../tmp/size_3mobs.png" });
  // KOフロー: 倒れ→カード畳み→消滅→控え登場
  await page.evaluate(() => {
    fieldParty[0].hp = 0;
    const newly = handleFieldDeaths();
    autoDeployReserveIfNeeded(newly, () => {});
  });
  await page.waitForTimeout(1000);
  const t1 = await page.evaluate(() => document.querySelectorAll("#battlePartyBar .party-member").length);
  await page.waitForTimeout(1000); // t=2.0s: 畳み完了(1.85s)後
  const t2 = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("#battlePartyBar .party-member")];
    return { count: cards.length, hidden: cards.filter((c) => c.style.display === "none").length };
  });
  await page.waitForTimeout(1300); // t=3.3s: 控え登場(2.55s)後
  await page.screenshot({ path: "../tmp/ko_after_collapse.png" });
  const t3 = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("#battlePartyBar .party-member")];
    return { ids: cards.map((c) => c.dataset.id).length, visible: cards.filter((c) => c.style.display !== "none").length, names: cards.map((c) => c.querySelector(".nm").textContent) };
  });
  console.log("t=1.0s cards:", t1, " t=2.0s:", JSON.stringify(t2), " t=3.3s:", JSON.stringify(t3));
  console.log("errors:", errors.length ? errors : "none");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
