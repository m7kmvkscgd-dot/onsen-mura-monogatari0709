// enemy_editor.html の「エクスポート」で出力したテキストを data.js に反映し、
// enemy_editor.html 自身の埋め込みベースライン(ENEMY_DATA)も同時に最新化するスクリプト。
// 使い方: node pipeline/apply_enemy_editor_export.js <エクスポートを保存したテキストファイル>
//
// 注意: 反映後のENEMIES/ENEMY_WEAKNESSは1敵=2〜3行のコンパクト形式で再生成されるため、
// 元のdata.jsにあった手書きのセクション見出しコメント(// ---- 序盤 ---- 等)や
// 個々の敵の設計意図コメントは失われる。数値・構造は完全に保持される。
// (2026-07-21: 「道の出現確率」機能自体をエディタ・エクスポート双方から削除したのに合わせ、
// このスクリプトのPATH_DEFS/dungeon.js関連の処理も撤去した)

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_JS = path.join(ROOT, "data.js");
const EDITOR_HTML = path.join(ROOT, "enemy_editor.html");

// マーカー直後が"{"(オブジェクト)でも"["(配列、ENEMIES_REMOVED等)でも対応する
function findBraceBlock(content, marker) {
  const start = content.indexOf(marker);
  if (start === -1) return null;
  const openIdx = content.indexOf("=", start) + 1;
  let i = openIdx;
  while (/\s/.test(content[i])) i++;
  const open = content[i];
  const close = open === "{" ? "}" : open === "[" ? "]" : null;
  if (!close) return null;
  const braceStart = i;
  let depth = 0, end = braceStart;
  for (; i < content.length; i++) {
    if (content[i] === open) depth++;
    else if (content[i] === close) { depth--; if (depth === 0) { end = i; break; } }
  }
  let semiEnd = end + 1;
  if (content[semiEnd] === ";") semiEnd++;
  return { start, braceStart, end, semiEnd, objectText: content.slice(braceStart, end + 1) };
}

function extractConst(content, varName) {
  const block = findBraceBlock(content, `const ${varName} =`);
  if (!block) throw new Error(`could not find const ${varName} in given content`);
  const fn = new Function(`return (${block.objectText});`);
  return { value: fn(), block };
}

function replaceConstBlock(content, varName, newBodyText) {
  const block = findBraceBlock(content, `const ${varName} =`);
  if (!block) throw new Error(`could not find const ${varName} to replace`);
  const before = content.slice(0, block.start);
  const after = content.slice(block.semiEnd);
  return `${before}const ${varName} = {\n${newBodyText}\n};${after}`;
}

// ---- コンパクトなJSオブジェクトリテラル文字列化(キーはクォートなし) ----
function jsLit(v) {
  if (Array.isArray(v)) return `[${v.map(jsLit).join(", ")}]`;
  if (v && typeof v === "object") {
    return `{ ${Object.keys(v).map((k) => `${k}: ${jsLit(v[k])}`).join(", ")} }`;
  }
  if (typeof v === "string") return JSON.stringify(v);
  return String(v);
}

const ENEMY_FLAG_KEYS = ["isPlant", "isBoss", "questOnly", "isMidBoss", "isFlying", "isSwarm"];
const ENEMY_STAT_KEYS = ["hp", "atk", "def", "spd", "goldMin", "goldMax", "xp", "minFloor", "maxFloor"];

function serializeEnemy(id, e) {
  const parts = [`id: ${jsLit(id)}`, `ja: ${jsLit(e.ja)}`, `image: ${jsLit(e.image)}`];
  if (e.stage && e.stage !== "forest") parts.push(`stage: ${jsLit(e.stage)}`);
  ENEMY_STAT_KEYS.forEach((k) => parts.push(`${k}: ${jsLit(e[k])}`));
  ENEMY_FLAG_KEYS.forEach((k) => { if (e[k]) parts.push(`${k}: true`); });
  const extraLines = [];
  if (e.bigAttack) extraLines.push(`bigAttack: ${jsLit(e.bigAttack)}`);
  if (e.extraBigAttacks && e.extraBigAttacks.length) extraLines.push(`extraBigAttacks: ${jsLit(e.extraBigAttacks)}`);
  if (e.bigAttackCycle) extraLines.push(`bigAttackCycle: ${jsLit(e.bigAttackCycle)}`);
  if (e.onHitInflict) extraLines.push(`onHitInflict: ${jsLit(e.onHitInflict)}`);
  if (e.statusImmune && e.statusImmune.length) extraLines.push(`statusImmune: ${jsLit(e.statusImmune)}`);
  let out = `  ${id}: { ${parts.join(", ")}`;
  if (extraLines.length > 0) {
    out += `,\n    ${extraLines.join(",\n    ")} },`;
  } else {
    out += " },";
  }
  return out;
}

function serializeEnemies(enemies) {
  return Object.keys(enemies).map((id) => serializeEnemy(id, enemies[id])).join("\n");
}
function serializeWeakness(weaknessMap) {
  return Object.keys(weaknessMap).map((id) => `  ${id}: ${jsLit(weaknessMap[id])},`).join("\n");
}
function serializePathDefs(pathObj) {
  return PATH_KEY_ORDER.map((k) => `  ${k}: ${jsLit(pathObj[k])},`).join("\n");
}

// キーの並び順の違い(内容は同じ)を「変更」に数えないよう、比較専用にキーを再帰的にソートする
function sortedJson(v) {
  if (Array.isArray(v)) return `[${v.map(sortedJson).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${sortedJson(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("使い方: node pipeline/apply_enemy_editor_export.js <エクスポートテキストファイル>");
    process.exit(1);
  }
  const exportText = fs.readFileSync(inputPath, "utf8");

  // エクスポートは「変更・追加された分だけ」の差分(2026-07-21〜)。
  // 現在のdata.jsのENEMIES/ENEMY_WEAKNESSに対して、この差分をマージして反映する
  const { value: changedEnemies } = extractConst(exportText, "ENEMIES_CHANGED");
  const removedIds = extractConst(exportText, "ENEMIES_REMOVED").value;
  const { value: changedWeakness } = extractConst(exportText, "ENEMY_WEAKNESS_CHANGED");
  const removedWeaknessIds = extractConst(exportText, "ENEMY_WEAKNESS_REMOVED").value;

  let dataJs = fs.readFileSync(DATA_JS, "utf8");
  const { value: oldEnemies } = extractConst(dataJs, "ENEMIES");
  const { value: oldWeakness } = extractConst(dataJs, "ENEMY_WEAKNESS");

  const mergedEnemies = Object.assign({}, oldEnemies);
  const added = [], changed = [];
  Object.keys(changedEnemies).forEach((id) => {
    if (oldEnemies[id]) changed.push(id); else added.push(id);
    mergedEnemies[id] = changedEnemies[id];
  });
  removedIds.forEach((id) => { delete mergedEnemies[id]; });

  const mergedWeakness = Object.assign({}, oldWeakness);
  Object.keys(changedWeakness).forEach((id) => { mergedWeakness[id] = changedWeakness[id]; });
  removedWeaknessIds.forEach((id) => { delete mergedWeakness[id]; });

  // ---- 差分サマリ(適用前に表示) ----
  console.log(`追加: ${added.length}体 ${added.join(", ")}`);
  console.log(`削除: ${removedIds.length}体 ${removedIds.join(", ")}`);
  console.log(`変更: ${changed.length}体 ${changed.join(", ")}`);

  // ---- data.js 更新 ----
  dataJs = replaceConstBlock(dataJs, "ENEMIES", serializeEnemies(mergedEnemies));
  dataJs = replaceConstBlock(dataJs, "ENEMY_WEAKNESS", serializeWeakness(mergedWeakness));
  fs.writeFileSync(DATA_JS, dataJs);

  // ---- enemy_editor.html の埋め込みベースラインを再生成 ----
  const enemyDataOut = {};
  Object.keys(mergedEnemies).forEach((id) => {
    enemyDataOut[id] = Object.assign({}, mergedEnemies[id]);
    if (mergedWeakness[id]) enemyDataOut[id].weakness = mergedWeakness[id];
  });

  let editorHtml = fs.readFileSync(EDITOR_HTML, "utf8");
  editorHtml = editorHtml.replace(
    /const ENEMY_DATA = \{.*?\};\n/s,
    `const ENEMY_DATA = ${JSON.stringify(enemyDataOut)};\n`
  );
  fs.writeFileSync(EDITOR_HTML, editorHtml);

  console.log("data.js / enemy_editor.html を更新しました。");
}

main();
