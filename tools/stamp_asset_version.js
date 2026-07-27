// index.htmlが参照するローカルのcss/jsに ?v=<タイムスタンプ> を付け直すキャッシュバスティング用スクリプト。
// iOS Safariはリロードしてもcss/jsのキャッシュを使い回すことがあり、「デプロイしたのに実機だけ古い」
// 事故が繰り返し起きたため導入(2026-07-27、大規模戦の敵カード縮小CSSが実機だけ反映されない事故が契機)。
// URL自体が変われば全ブラウザで確実にキャッシュミスになる。
// 使い方: デプロイ前に  node tools/stamp_asset_version.js  を実行してからコミット→デプロイする
// (CLAUDE.mdのデプロイ手順参照)
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const target = path.join(ROOT, "index.html");
let html = fs.readFileSync(target, "utf8");
const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12); // 例: 202607271410
let count = 0;
// href/srcで参照されるローカルの .css / .js だけが対象(http(s)://の外部URLは対象外)。
// 既存の ?v=... は付け直す
html = html.replace(/(?<=(?:href|src)=")(?!https?:\/\/)([^"?]+\.(?:css|js))(\?v=[^"]*)?(?=")/g, (m, file) => {
  count++;
  return `${file}?v=${stamp}`;
});
fs.writeFileSync(target, html);
console.log(`stamped ${count} asset refs with ?v=${stamp}`);
