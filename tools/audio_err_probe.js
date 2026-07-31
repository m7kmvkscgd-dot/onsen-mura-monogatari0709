const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto("https://onsen-mura-monogatari.pages.dev/", { waitUntil: "load" });
  await page.waitForTimeout(800);
  const st = await page.evaluate(() => {
    const out = { el: !!document.getElementById("openingBgmAudio") };
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      out.AC = !!AC;
      const c = new AC();
      out.ctxOk = true;
      try { const s = c.createMediaElementSource(document.getElementById("bgmAudio")); out.bgmSrc = "ok"; }
      catch (e) { out.bgmSrc = e.name + ":" + e.message; }
      try { const s2 = c.createMediaElementSource(document.getElementById("openingBgmAudio")); out.openSrc = "ok"; }
      catch (e) { out.openSrc = e.name + ":" + e.message; }
    } catch (e) { out.ctxErr = e.name + ":" + e.message; }
    // 本体の状態
    out.bgmGain = typeof bgmGainNode !== "undefined" ? String(!!bgmGainNode) : "undef";
    return out;
  });
  console.log(JSON.stringify(st), "pageErrors:", pageErrors.join(" / ") || "なし");
  await browser.close();
})();
