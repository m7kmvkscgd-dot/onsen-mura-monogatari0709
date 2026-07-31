// 本番の戦闘で味方KO演出(膝折れフェード+療養テキスト+控え登場0.7秒の間)を検証するprobe
const { webkit, devices } = require("playwright");
const path = require("path");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text()); });
  await page.goto("https://onsen-mura-monogatari.pages.dev/", { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = document.getElementById("openingTapGate"); if (g) g.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); });
  await page.waitForTimeout(2800);
  await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  await page.waitForTimeout(1600);
  await page.evaluate(() => document.getElementById("titleTestBtn").click());
  await page.waitForTimeout(1200);
  const setup = await page.evaluate(() => {
    const e = instantiateEnemyById("yaken");
    e.spd = 0;
    startBattle([e], null, "KO検証: 野犬が現れた！");
    // 控えがいなければ3人目の複製で用意する(表示検証用)
    if (!reserveFieldMember) {
      const src = fieldParty[fieldParty.length - 1];
      reserveFieldMember = JSON.parse(JSON.stringify(src));
      reserveFieldMember.id = "probe_reserve";
      reserveFieldMember.name = "控え検証";
      reserveFieldMember.status = "active";
    }
    return { party: fieldParty.map((c) => c.name), reserve: reserveFieldMember.name };
  });
  console.log("setup:", JSON.stringify(setup));
  await page.waitForTimeout(1500);
  // 先頭の味方を戦闘不能にして実際の死亡処理を通す
  await page.evaluate(() => {
    const victim = fieldParty[0];
    victim.hp = 0;
    const newly = handleFieldDeaths();
    window.__koDone = false;
    autoDeployReserveIfNeeded(newly, () => { window.__koDone = true; });
    window.__koStart = performance.now();
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join("..", "tmp", "ko_real_mid.png") });
  const mid = await page.evaluate(() => ({
    barCards: document.querySelectorAll("#battlePartyBar .party-member").length,
    noteShown: !!document.querySelector(".ally-ko-note"),
    noteText: (document.querySelector(".ally-ko-note") || {}).textContent || "",
    done: window.__koDone,
  }));
  console.log("t=700ms:", JSON.stringify(mid));
  await page.waitForTimeout(1100); // t=1.8s: 倒れ演出終了、控えはまだ(間の最中)
  const pause = await page.evaluate(() => ({
    barCards: document.querySelectorAll("#battlePartyBar .party-member").length,
    done: window.__koDone,
  }));
  console.log("t=1800ms:", JSON.stringify(pause));
  await page.waitForTimeout(900); // t=2.7s: 2200ms経過後→控えが走り込み済みのはず
  await page.screenshot({ path: path.join("..", "tmp", "ko_real_after.png") });
  const after = await page.evaluate(() => ({
    barCards: document.querySelectorAll("#battlePartyBar .party-member").length,
    reserveOnField: fieldParty.some((c) => c.id === "probe_reserve"),
    victimStatus: fieldParty[0] ? fieldParty[0].status : "?",
    logTail: (document.getElementById("battleLog").textContent || "").slice(-80),
  }));
  console.log("t=2700ms:", JSON.stringify(after));
  console.log("errors:", errors.length ? errors : "none");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
