const { webkit, devices } = require("playwright");
(async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("https://onsen-mura-monogatari.pages.dev/mock_battle_layout_editor.html", { waitUntil: "load" });
  await page.waitForTimeout(1500);
  // 敵2をタップ選択→ドラッグ移動をポインタイベントで再現
  const el = await page.evaluateHandle(() => document.querySelector('[data-key="e1"]'));
  const box = await el.asElement().boundingBox();
  const sx = box.x + box.width / 2, sy = box.y + box.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 40, sy + 60, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const st1 = await page.evaluate(() => ({ sel: document.getElementById("selLabel").textContent, off: JSON.parse(localStorage.getItem("battleLayoutEditor_v1")).enemyOffsets[1].map(Math.round) }));
  console.log("ドラッグ後:", JSON.stringify(st1));
  // ±ボタンでサイズ変更
  await page.evaluate(() => { document.getElementById("plus").click(); document.getElementById("plus").click(); });
  await page.waitForTimeout(300);
  const st2 = await page.evaluate(() => ({ size: JSON.parse(localStorage.getItem("battleLayoutEditor_v1")).enemySize, out: document.getElementById("out").textContent.slice(0, 60) }));
  console.log("サイズ変更後:", JSON.stringify(st2));
  await page.screenshot({ path: "tmp/editor_probe.png" });
  // UI隠す
  await page.evaluate(() => document.getElementById("hideBtn").click());
  await page.waitForTimeout(300);
  await page.screenshot({ path: "tmp/editor_hidden.png" });
  console.log("JSエラー:", errors.length ? errors.join(" / ") : "なし");
  await browser.close();
})();
