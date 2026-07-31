const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await page.goto("https://onsen-mura-monogatari.pages.dev/", { waitUntil: "load" });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { const g = document.getElementById("openingTapGate"); if (g) g.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); });
  await page.waitForTimeout(800);
  const st = await page.evaluate(() => ({
    gainReady: typeof openingGainNode !== "undefined" && !!openingGainNode,
    gainValue: typeof openingGainNode !== "undefined" && openingGainNode ? openingGainNode.gain.value : null,
    ctxState: typeof bgmAudioCtx !== "undefined" && bgmAudioCtx ? bgmAudioCtx.state : null,
    playing: !document.getElementById("openingBgmAudio").paused,
  }));
  console.log(JSON.stringify(st));
  await browser.close();
})();
