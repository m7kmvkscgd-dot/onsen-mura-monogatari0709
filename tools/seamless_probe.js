// シームレス戦闘遷移の実挙動検証: 探索→進む→‼️→(暗転なし)ズーム入り→戦闘、勝利相当→逆再生
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
  // 実経路で遭遇させる: queueEncounterBattle→‼️→startBattle
  await page.evaluate(() => { queueEncounterBattle([instantiateEnemyById("yaken"), instantiateEnemyById("kodama")], null, null, null); });
  await page.waitForTimeout(300);
  const cue = await page.evaluate(() => document.getElementById("encounterCue").style.display);
  console.log("‼️表示:", cue);
  await page.waitForTimeout(1400); // 一拍→戦闘開始
  await page.waitForTimeout(300); // ズーム途中
  const mid = await page.evaluate(() => ({
    zoom: document.getElementById("battleBg").style.getPropertyValue("--battle-zoom"),
    camY: document.getElementById("battlePartyBar").style.getPropertyValue("--party-cam-y"),
    seamlessCls: document.querySelector(".battle-top").classList.contains("seamless-entry"),
  }));
  console.log("ズーム途中:", JSON.stringify(mid));
  await page.waitForTimeout(600);
  const done = await page.evaluate(() => ({
    zoom: document.getElementById("battleBg").style.getPropertyValue("--battle-zoom"),
    camY: document.getElementById("battlePartyBar").style.getPropertyValue("--party-cam-y"),
    camS: document.getElementById("battlePartyBar").style.getPropertyValue("--party-cam-s"),
  }));
  console.log("ズーム完了:", JSON.stringify(done));
  await page.screenshot({ path: "tmp/seamless_in.png" });
  // 逃走で探索へ戻る(逆再生の確認)
  await page.evaluate(() => { battle.enemies.forEach((e) => { e.hp = 0; }); });
  await page.evaluate(() => { // 勝利→戻る相当: escapeBattleで戻す(逆再生フックは共通)
    escapeBattle();
  });
  await page.waitForTimeout(200);
  const outMid = await page.evaluate(() => ({
    screen: document.querySelector(".screen.active").id,
    dungeonZoom: document.getElementById("dungeonBgInner").style.transform,
    camY: document.getElementById("dungeonPartyBar").style.getPropertyValue("--party-cam-y"),
  }));
  console.log("逆再生途中:", JSON.stringify(outMid));
  await page.waitForTimeout(800);
  const outDone = await page.evaluate(() => ({
    dungeonZoom: document.getElementById("dungeonBgInner").style.transform,
    camY: document.getElementById("dungeonPartyBar").style.getPropertyValue("--party-cam-y"),
  }));
  console.log("逆再生完了:", JSON.stringify(outDone));
  console.log("JSエラー:", errors.length ? errors.join(" / ") : "なし");
  await browser.close();
})();
