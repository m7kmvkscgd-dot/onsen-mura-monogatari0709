// enemy_editor.html の「エクスポート」で出力したテキストを data.js / dungeon.js に反映し、
// enemy_editor.html 自身の埋め込みベースライン(ENEMY_DATA/PATH_DATA)も同時に最新化するスクリプト。
// 使い方: node pipeline/apply_enemy_editor_export.js <エクスポートを保存したテキストファイル>
//
// 注意: 反映後のENEMIES/ENEMY_WEAKNESS/各PATH_DEFSは1敵=2〜3行のコンパクト形式で再生成されるため、
// 元のdata.js/dungeon.jsにあった手書きのセクション見出しコメント(// ---- 序盤 ---- 等)や
// 個々の敵の設計意図コメントは失われる。数値・構造は完全に保持される。

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_JS = path.join(ROOT, "data.js");
const DUNGEON_JS = path.join(ROOT, "dungeon.js");
const EDITOR_HTML = path.join(ROOT, "enemy_editor.html");

const PATH_VAR_NAMES = [
  "PATH_DEFS", "CAVE_PATH_DEFS", "COAST_PATH_DEFS", "RUINS_PATH_DEFS", "GATE_PATH_DEFS",
  "CASTLE_PATH_DEFS", "VALLEY_PATH_DEFS", "BAMBOO_PATH_DEFS", "SHUGENDO_PATH_DEFS", "YAMA_PATH_DEFS",
];
const STAGE_BY_VAR = {
  PATH_DEFS: "forest", CAVE_PATH_DEFS: "cave", COAST_PATH_DEFS: "coast", RUINS_PATH_DEFS: "ruins",
  GATE_PATH_DEFS: "gate", CASTLE_PATH_DEFS: "castle", VALLEY_PATH_DEFS: "valley", BAMBOO_PATH_DEFS: "bamboo",
  SHUGENDO_PATH_DEFS: "shugendo", YAMA_PATH_DEFS: "yama",
};
const PATH_KEY_ORDER = ["rindou", "kemono", "kurai", "shizuka", "komorebi", "hikaru", "fuon", "kamikakushi"];

function findBraceBlock(content, marker) {
  const start = content.indexOf(marker);
  if (start === -1) return null;
  const braceStart = content.indexOf("{", start);
  let depth = 0, end = braceStart;
  for (let i = braceStart; i < content.length; i++) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  let semiEnd = end + 1;
  if (content[semiEnd] === ";") semiEnd++;
  return { start, braceStart, end, semiEnd, objectText: content.slice(braceStart, end + 1) };
}

function extractConst(content, varName) {
  const block = findBraceBlock(content, `const ${varName} = {`);
  if (!block) throw new Error(`could not find const ${varName} in given content`);
  const fn = new Function(`return (${block.objectText});`);
  return { value: fn(), block };
}

function replaceConstBlock(content, varName, newBodyText) {
  const block = findBraceBlock(content, `const ${varName} = {`);
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

  const { value: newEnemies } = extractConst(exportText, "ENEMIES");
  const { value: newWeakness } = extractConst(exportText, "ENEMY_WEAKNESS");
  const newPathByVar = {};
  PATH_VAR_NAMES.forEach((v) => { newPathByVar[v] = extractConst(exportText, v).value; });

  // ---- 差分サマリ(適用前に表示) ----
  let dataJs = fs.readFileSync(DATA_JS, "utf8");
  const { value: oldEnemies } = extractConst(dataJs, "ENEMIES");
  const oldIds = new Set(Object.keys(oldEnemies));
  const newIds = new Set(Object.keys(newEnemies));
  const added = [...newIds].filter((id) => !oldIds.has(id));
  const removed = [...oldIds].filter((id) => !newIds.has(id));
  const changed = [...newIds].filter((id) => oldIds.has(id) && sortedJson(oldEnemies[id]) !== sortedJson(newEnemies[id]));
  console.log(`追加: ${added.length}体 ${added.join(", ")}`);
  console.log(`削除: ${removed.length}体 ${removed.join(", ")}`);
  console.log(`変更: ${changed.length}体 ${changed.join(", ")}`);

  // ---- data.js 更新 ----
  dataJs = replaceConstBlock(dataJs, "ENEMIES", serializeEnemies(newEnemies));
  dataJs = replaceConstBlock(dataJs, "ENEMY_WEAKNESS", serializeWeakness(newWeakness));
  fs.writeFileSync(DATA_JS, dataJs);

  // ---- dungeon.js 更新 ----
  let dungeonJs = fs.readFileSync(DUNGEON_JS, "utf8");
  PATH_VAR_NAMES.forEach((v) => {
    dungeonJs = replaceConstBlock(dungeonJs, v, serializePathDefs(newPathByVar[v]));
  });
  fs.writeFileSync(DUNGEON_JS, dungeonJs);

  // ---- enemy_editor.html の埋め込みベースラインを再生成 ----
  const enemyDataOut = {};
  Object.keys(newEnemies).forEach((id) => {
    enemyDataOut[id] = Object.assign({}, newEnemies[id]);
    if (newWeakness[id]) enemyDataOut[id].weakness = newWeakness[id];
  });
  const pathDataOut = {};
  PATH_VAR_NAMES.forEach((v) => { pathDataOut[STAGE_BY_VAR[v]] = newPathByVar[v]; });

  let editorHtml = fs.readFileSync(EDITOR_HTML, "utf8");
  editorHtml = editorHtml.replace(
    /const ENEMY_DATA = \{.*?\};\n/s,
    `const ENEMY_DATA = ${JSON.stringify(enemyDataOut)};\n`
  );
  editorHtml = editorHtml.replace(
    /const PATH_DATA = \{.*?\};\n/s,
    `const PATH_DATA = ${JSON.stringify(pathDataOut)};\n`
  );
  fs.writeFileSync(EDITOR_HTML, editorHtml);

  console.log("data.js / dungeon.js / enemy_editor.html を更新しました。");
}

main();
