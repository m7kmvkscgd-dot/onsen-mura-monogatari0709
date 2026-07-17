// ============ dialogues.js: 外部テキストファイル(assets/dialogues/*.txt)からの掛け合いセリフ読み込み ============
// セリフ本文はコードに一切書かず、専用のテキストファイルを起動時にfetchして読み込む。
// audio.js(assets/sfx/*.oggを事前デコードするsfxBuffers)と同じ設計思想: 読み込みが完了するまでは
// 該当カテゴリのデータが空のまま扱われ、まだ届いていなくてもゲーム全体は止めずに静かにno-opする。
//
// カテゴリを増やしたい時(野営会話/ボス前会話/帰還時会話/温泉会話など)は、
// ① assets/dialogues/dialogue_◯◯.txt を同じテキスト形式で追加
// ② 下のPAIRED_DIALOGUE_FILESに1行追加
// の2点だけで良い。コード側のパース・検索ロジックは共通のまま増やせる。
//
// テキストファイルの形式(1エントリ、区切りは空行または"---"どちらでもよい):
//   ID:001
//   PAIR:性格A|性格B
//
//   A:性格Aのキャラが言うセリフ
//   B:性格Bのキャラが言うセリフ
//
// PAIR:の左側(A)が必ず先に、右側(B)が必ず後に喋る想定(effects.js側のplayPairedDialogueExchange参照)。
// 検索(pairedDialoguesForPair)は組み合わせの順序を問わない(「優しい|熱血」で登録されていても
// 「熱血」「優しい」の順で問い合わせて取得できる)。

const PAIRED_DIALOGUE_FILES = {
  banter: "assets/dialogues/dialogue_banter.txt", // お笑い寄りの掛け合い(旧peaceカテゴリのトリガーがこちらを参照するよう差し替え済み、dungeon.jsのmaybeTriggerPeaceDialogue参照)
  crit: "assets/dialogues/dialogue_crit.txt", // 会心ヒット時のかけ声+仲間の反応
  tired: "assets/dialogues/dialogue_tired.txt", // 疲弊時の掛け合い(MOOD行付き。ストレス50〜99のキャラを含むペア限定、dungeon.jsのmaybeTriggerTiredDialogue参照)
  // 今後追加予定: camp: "assets/dialogues/dialogue_camp.txt"(野営会話)、
  // bossPre: "assets/dialogues/dialogue_boss_pre.txt"(ボス前会話)、
  // homecoming: "assets/dialogues/dialogue_homecoming.txt"(帰還時会話)、
  // onsen: "assets/dialogues/dialogue_onsen.txt"(温泉会話)
};

// categoryKey -> { list: [全エントリ], byPairKey: { "正規化キー": [該当エントリ] } }
const pairedDialogueStore = {};

// 性格2つから正規化した組み合わせキーを作る(順序を問わず同じキーになる)。
// PEACE_DIALOGUES時代のpeacePairKey()と同じロジックだが、カテゴリ非依存の共通ヘルパーとして
// ここに置く(今後のカテゴリ追加でも同じ関数をそのまま使い回せる)
function dialoguePairKey(p1, p2) {
  return [p1, p2].sort().join("|");
}

// テキスト1ファイル分をパースしてエントリ配列にする。ID:/PAIR:/A:/B:以外の行(空行・"---"・
// コメント的な自由記述)は無視するので、区切り記法の細かい表記ゆれがあっても壊れにくい
function parsePairedDialogueText(raw) {
  const lines = raw.split(/\r?\n/);
  const entries = [];
  let cur = null;
  const pushIfComplete = () => {
    if (cur && cur.id && cur.pA && cur.pB && cur.lineA && cur.lineB) entries.push(cur);
  };
  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (line.startsWith("ID:")) {
      pushIfComplete();
      cur = { id: line.slice(3).trim(), pA: null, pB: null, lineA: null, lineB: null, lineA2: null, mood: null };
    } else if (line.startsWith("PAIR:") && cur) {
      const parts = line.slice(5).trim().split("|");
      cur.pA = (parts[0] || "").trim();
      cur.pB = (parts[1] || "").trim();
    } else if (line.startsWith("MOOD:") && cur) {
      // 疲弊時の掛け合い(tired)用: bothTired / aTiredBEnergetic / aEnergeticBTired のいずれか。
      // MOOD行を持たないカテゴリ(banter/crit)ではnullのまま(既存の動作に影響しない)
      cur.mood = line.slice(5).trim();
    } else if (line.startsWith("A:") && cur) {
      // 2つ目のA:行(A→B→Aの3行掛け合いのオチ)はlineA2として別枠で持つ。
      // Bより前のA:はlineA(1行目)、Bより後のA:はlineA2(3行目)
      if (cur.lineB != null) cur.lineA2 = line.slice(2).trim();
      else cur.lineA = line.slice(2).trim();
    } else if (line.startsWith("B:") && cur) {
      cur.lineB = line.slice(2).trim();
    }
  });
  pushIfComplete();
  return entries;
}

function buildPairedDialogueIndex(entries) {
  const list = entries.map((e) => Object.assign({ pairKey: dialoguePairKey(e.pA, e.pB) }, e));
  const byPairKey = {};
  list.forEach((e) => { (byPairKey[e.pairKey] = byPairKey[e.pairKey] || []).push(e); });
  return { list, byPairKey };
}

// 起動時に全カテゴリのテキストファイルを読み込む。個別のファイルが見つからない/壊れていても
// (JSONと違ってパース自体が例外を投げない設計なので)他のカテゴリの読み込みは止めない
function loadPairedDialogueFile(categoryKey, path) {
  fetch(path)
    .then((res) => res.text())
    .then((text) => { pairedDialogueStore[categoryKey] = buildPairedDialogueIndex(parsePairedDialogueText(text)); })
    .catch(() => {}); // 読み込みに失敗した場合、そのカテゴリはpairedDialogueStoreに登録されないまま
    // →pairedDialoguesForPair()が空配列を返すだけで、ゲーム側は「今回は掛け合いが無かった」扱いになる
}
Object.keys(PAIRED_DIALOGUE_FILES).forEach((key) => loadPairedDialogueFile(key, PAIRED_DIALOGUE_FILES[key]));

// 指定カテゴリ・性格2つに一致する掛け合い候補を返す(順序を問わない)。
// 該当ファイルが未読み込み/存在しない/該当組み合わせが無い場合は空配列を返す
function pairedDialoguesForPair(categoryKey, p1, p2) {
  const store = pairedDialogueStore[categoryKey];
  if (!store) return [];
  return store.byPairKey[dialoguePairKey(p1, p2)] || [];
}

// PAIR形式のファイルだが、peaceのような「特定の2人の組み合わせで固定の1つの会話」ではなく、
// A側・B側それぞれが実質「その性格の持ちセリフ」でしかない場合に使う(例: dialogue_crit.txt=
// 会心ヒットのかけ声(A)+仲間の反応(B)。かけ声はA本人の性格だけで決まり、反応も相手の性格だけで決まる、
// というデータになっている)。組み合わせの相手を問わず、指定した性格がその役割(A側/B側)に
// 登場する全エントリからslot("A"→lineA、"B"→lineB)の文言だけを集めて返す(重複除去あり)
function soloPersonalityLines(categoryKey, personality, slot) {
  const store = pairedDialogueStore[categoryKey];
  if (!store) return [];
  const key = slot === "A" ? "pA" : "pB";
  const lineKey = slot === "A" ? "lineA" : "lineB";
  const lines = store.list.filter((e) => e[key] === personality).map((e) => e[lineKey]);
  return [...new Set(lines)];
}

// ============ 単独発言型のセリフ(ペア形式ではなく、性格ごとに1行だけ喋るカテゴリ用) ============
// 例: かばう(槍士がかばうボタンを押した時の一言)。今後の「通常セリフ」(戦闘開始/瀕死/撃破時など、
// 旧DIALOGUE_LINESが担っていた単独発言の各種イベント)もこの仕組みに乗せられる。
// テキスト形式(「・」で始まらない行が性格名の見出し、以降の「・」始まりの行がその性格のセリフ、
// 空行や見出し行の切り替わりで次の性格へ):
//   優しい
//   ・大丈夫だよ！
//   ・任せて！
//
//   熱血
//   ・私が壁になる！！
//   ...
const SOLO_DIALOGUE_FILES = {
  guard: "assets/dialogues/dialogue_guard.txt", // 槍士「かばう」使用時の一言
};
const soloDialogueStore = {}; // categoryKey -> { 性格: [セリフ, ...] }

function parseSoloDialogueText(raw) {
  const lines = raw.split(/\r?\n/);
  const result = {};
  let currentPersonality = null;
  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    if (line.startsWith("・")) {
      if (!currentPersonality) return; // 性格見出しより前に出てきた「・」行は無視(壊れたデータ対策)
      (result[currentPersonality] = result[currentPersonality] || []).push(line.slice(1).trim());
    } else {
      currentPersonality = line;
    }
  });
  return result;
}

function loadSoloDialogueFile(categoryKey, path) {
  fetch(path)
    .then((res) => res.text())
    .then((text) => { soloDialogueStore[categoryKey] = parseSoloDialogueText(text); })
    .catch(() => {}); // 読み込み失敗時はそのカテゴリのセリフが出ないだけで、ゲーム全体は止めない
}
Object.keys(SOLO_DIALOGUE_FILES).forEach((key) => loadSoloDialogueFile(key, SOLO_DIALOGUE_FILES[key]));

// 指定カテゴリ・性格に一致するセリフ候補を返す。未読み込み/該当性格が無い場合は空配列
function soloDialogueLines(categoryKey, personality) {
  const store = soloDialogueStore[categoryKey];
  if (!store) return [];
  return store[personality] || [];
}
