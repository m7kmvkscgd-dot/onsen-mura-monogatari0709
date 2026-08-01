// 実ブラウザ(Chromium)での音声グラフ構築の煙テスト(2026-08-02 aux移行)。
// jsdomスタブでは分からない「本物のWeb Audio APIでの構築成否」と起動時JSエラーの有無だけを見る。
// 実行方法: ローカルサーバー(8127)起動中に cd tools && node audio_ctx_probe.js
const { chromium } = require("playwright");
(async () => {
  // インストール済みリビジョン(chromium-1228)を直接指定(playwrightパッケージ期待版とのズレ回避)
  const browser = await chromium.launch({ executablePath: "C:\\Users\\keiic\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe" });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto("http://localhost:8127/", { waitUntil: "load" });
  await page.waitForTimeout(1200);
  await page.mouse.click(200, 300); // 最初のユーザー操作(unlockAudio)
  await page.waitForTimeout(600);
  const st = await page.evaluate(() => ({
    bgmCtx: typeof bgmAudioCtx !== "undefined" && !!bgmAudioCtx && bgmAudioCtx.state,
    bgmGain: !!bgmGainNode,
    ambientCtx: !!ambientAudioCtx && ambientAudioCtx.state,
    ambientGain: !!ambientGainNode,
    openingCtx: !!openingAudioCtx && openingAudioCtx.state,
    openingGain: !!openingGainNode,
    sfxCtx: !!sfxAudioCtx && sfxAudioCtx.state,
    lodgingBufGain: !!lodgingBufGain,
    campBufGain: !!campBufGain,
    auxLodging: !!auxBuffers.lodging,
    auxCamp: !!auxBuffers.camp,
    openingGainValue: openingGainNode ? openingGainNode.gain.value : null,
    ambientGainValue: ambientGainNode ? ambientGainNode.gain.value : null,
  }));
  console.log(JSON.stringify(st, null, 1));
  console.log("pageErrors:", pageErrors.join(" / ") || "なし");
  await browser.close();
  const okAll = st.bgmGain && st.ambientGain && st.openingGain && st.lodgingBufGain && st.campBufGain && pageErrors.length === 0;
  console.log(okAll ? "✅ 実ブラウザ構築OK" : "❌ 構築に問題あり");
  process.exit(okAll ? 0 : 1);
})();
