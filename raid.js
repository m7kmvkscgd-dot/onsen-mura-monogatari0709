// ============ raid.js: 村襲撃システム(2026-07-28) ============
// 設計の確定事項(ユーザー合意):
// - 明朝型: 襲撃は常に「襲撃日の朝が村で訪れた瞬間」に発生する。寝る(宿泊)でも待機(⌛️)でも、
//   朝(5:30)を跨いだら発生する(踏み倒し防止)。時間単位のカウントダウンは出さない
// - 遠征中に襲撃日が来た場合は帰還まで延期し、帰還後に村で最初の朝を迎えた時に発生する
//   (野営の朝=遠征中なので発生しない。村での宿泊/待機だけが朝トリガーの対象)
// - 敗北=村レベル-1(下限1)。解禁済みの施設は残る(二重罰回避、村レベルだけ下がる)
// - ウェーブはRAID_CONFIG(data.js)の村レベル別プールから重み付き抽選。未設定レベルは下位へフォールバック
// - 襲撃戦は控えなしの大規模戦(名簿からレベル上位最大5人が自動で防衛に立つ)+バリケード(永続耐久)
// - 村レベル連動の日次収入(村Lv×DAILY_INCOME_PER_LEVEL G/日)もこのファイルで精算する

// 朝の基準時刻(分)。宿泊/野営の起床時刻(5:30)と同じ値にしてあり、「その日の朝を迎えたか」の判定に使う
const RAID_MORNING_MINUTES = 5 * 60 + 30;

// 「最後に朝(5:30)を迎えた日」を返す。時計がまだ5:30より前なら、迎えたのは前日の朝まで。
// 宿泊/待機の前後でこの値を比べれば「その操作で朝を跨いだか」が分かる
function lastMorningIndex() {
  const clock = state.clockMinutes != null ? state.clockMinutes : PHASE_START_MINUTES[state.timeOfDay || "day"];
  return clock >= RAID_MORNING_MINUTES ? (state.dayCount || 1) : (state.dayCount || 1) - 1;
}
// 襲撃日を迎えているか(=村で次の朝が来たら襲撃戦が始まる状態か)。
// 遠征中に襲撃日が過ぎた場合もこの判定がtrueのまま持ち越されるので、帰還後の朝に自動で発生する
function raidIsDue() {
  return state.nextRaidDay != null && lastMorningIndex() >= state.nextRaidDay;
}
// 宿泊すると襲撃戦が始まるか(宿泊は必ず翌朝=dayCount+1の朝を迎える)
function lodgingWillTriggerRaid() {
  return state.nextRaidDay != null && (state.dayCount || 1) + 1 >= state.nextRaidDay;
}
// 時間スキップ(⌛️)でmin分進めた場合に襲撃戦が始まるか(朝5:30を跨ぎ、かつその朝が襲撃日以降か)
function timeSkipWillTriggerRaid(min) {
  if (state.nextRaidDay == null) return false;
  const total = (state.clockMinutes || 0) + min;
  const afterDay = (state.dayCount || 1) + (total >= 1440 ? 1 : 0);
  const afterClock = total % 1440;
  const afterIdx = afterClock >= RAID_MORNING_MINUTES ? afterDay : afterDay - 1;
  return afterIdx > lastMorningIndex() && afterIdx >= state.nextRaidDay;
}

// 次回襲撃までの日数を抽選する(最短〜最長の等確率。旧形式repeatEveryDaysのエクスポートにも対応)
function rollRaidIntervalDays() {
  const sch = RAID_CONFIG.schedule || {};
  const min = sch.repeatMinDays != null ? sch.repeatMinDays : (sch.repeatEveryDays || 7);
  const max = sch.repeatMaxDays != null ? sch.repeatMaxDays : (sch.repeatEveryDays || min);
  const lo = Math.min(min, max), hi = Math.max(min, max);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

// ============ カウントダウンバッジ(町ヘッダー+出発準備画面) ============
// モックmock_raid_countdown.htmlでユーザー確認済みのデザイン: 3日以上=通常/2日=黄(warn)/
// 残り1日以下=「明朝、襲撃！」赤点滅(danger)。「あと1日」「当日」表記は存在しない(明朝型のため)
const RAID_BADGE_SHOW_DAYS = 4; // カウントダウンバッジは残りこの日数以下になってから表示(常時表示はうるさい、ユーザー指示2026-07-28。5→4日に再調整)
function updateRaidBadge(el) {
  if (!el) return;
  const left = state.nextRaidDay != null ? state.nextRaidDay - (state.dayCount || 1) : null;
  if (left == null || left > RAID_BADGE_SHOW_DAYS) { el.style.display = "none"; return; }
  el.style.display = "";
  el.className = "raid-badge" + (left <= 1 ? " danger" : left === 2 ? " warn" : "");
  el.textContent = left <= 1 ? "👹 明朝、襲撃！" : `👹 襲撃まで${left}日`;
}

// ============ 日次収入(村Lv×5G/日) ============
// 前回精算日からの経過日数×村レベル×単価をまとめて支払う。どこで日数が過ぎても(宿泊・待機・遠征)
// 取りこぼしが出ないよう、絶対日数の差分方式にしてある。呼び出しは各村のトップ画面描画時
function settleDailyIncome() {
  if (state.lastIncomeDay == null) state.lastIncomeDay = state.dayCount || 1;
  const days = (state.dayCount || 1) - state.lastIncomeDay;
  if (days <= 0) return 0;
  const amount = days * (state.houseLevel || 1) * DAILY_INCOME_PER_LEVEL;
  state.gold += amount;
  state.lastIncomeDay = state.dayCount || 1;
  saveState();
  return amount;
}
// 町のゴールドバッジの横に「+◯G 村の収入」を一瞬だけ浮かせる小さな演出(town.cssの.town-income-pop)
function showTownIncomePopup(amount) {
  if (amount <= 0) return;
  const anchor = document.getElementById("townGold");
  if (!anchor || !anchor.parentElement) return;
  const old = anchor.parentElement.querySelector(".town-income-pop");
  if (old) old.remove();
  const pop = document.createElement("span");
  pop.className = "town-income-pop";
  pop.textContent = `+${amount}G 村の収入`;
  anchor.parentElement.appendChild(pop);
  setTimeout(() => pop.remove(), 2600);
}

// ============ バリケード(永続耐久) ============
function barricadeMaxHp() {
  const lv = state.barricadeLevel || 0;
  return lv > 0 ? BARRICADE_TIERS[lv - 1].hp : 0;
}
// 修理に必要な素材: 失った耐久の割合×その段階の建築素材、の各素材切り上げ(ユーザー指定の耐久比例方式)。
// 例: 木の柵(木5)が耐久40/100なら 5×0.6=3 → 木3。無傷ならnull(修理不要)
function barricadeRepairMats() {
  const lv = state.barricadeLevel || 0;
  const max = barricadeMaxHp();
  if (lv <= 0 || max <= 0) return null;
  const missing = Math.max(0, max - (state.barricadeHp || 0));
  if (missing <= 0) return null;
  const base = BARRICADE_TIERS[lv - 1].mats;
  const ratio = missing / max;
  const mats = {};
  Object.keys(base).forEach((id) => { mats[id] = Math.ceil(base[id] * ratio); });
  return mats;
}
function repairBarricade() {
  const mats = barricadeRepairMats();
  if (!mats || !matsCostOk(mats)) return false;
  consumeMatsCost(mats);
  state.barricadeHp = barricadeMaxHp();
  saveState();
  return true;
}

// ============ 投石器(2026-07-29) ============
// 襲撃戦のラウンド終了ごとに、地上の敵(isFlyingでない生存個体)からランダムに1体選んで自動で
// 投石攻撃する。威力は「村レベル=槍士の同レベル攻撃力」として通常攻撃と同じ式(rollBasicAttack)
// で計算する(村レベルはHOUSE_MAX_LEVEL=7が上限のため、キャラクターのレベル成長式をそのまま
// 流用しても破綻しない)。地上の敵が1体もいない(全滅済み、または敵が全員飛行)時は不発になる。
// battle.jsのnextRound()から、ラウンドが1つ完了した直後(次のラウンドの手番順を組む前)に呼ばれる
// 戻り値: 投擲演出の所要ms(発動しなかった時は0)。battle.jsのnextRound側がこの時間だけ
// 次ラウンドの手番開始を待つ(=着弾でダメージが確定してから手番順が組まれる)
function fireCatapultOnRoundEnd() {
  if (!raidBattleActive || (state.catapultLevel || 0) <= 0) return 0;
  const groundTargets = aliveEnemies().filter((e) => !e.isFlying);
  if (groundTargets.length === 0) {
    // 対象がいない時も黙って不発にせず理由をログに出す(「投石器が機能してない」と見えてしまった
    // 実機報告2026-07-29への対応。敵が全員飛行=コウモリ等だけの場面で毎ラウンド出るのは
    // 情報として正しいのでそのまま)
    if (aliveEnemies().length > 0) blog("投石器は空を飛ぶ敵に狙いを付けられない…！");
    return 0;
  }
  const target = groundTargets[Math.floor(Math.random() * groundTargets.length)];
  const atk = Math.round(CLASSES.spearman.atk * (1 + ((state.houseLevel || 1) - 1) * 0.075));
  const dmg = rollBasicAttack(atk, target.def);
  const applyHit = () => {
    if (!battle) return; // 演出中に戦闘が終わっていたら何もしない(保険)
    target.hp = Math.max(0, target.hp - dmg);
    blog(`投石器が${target.label}に岩を撃ち込んだ！${dmg}のダメージ！`);
    popupOn(target.instanceId, `-${dmg}`, "dmg");
    renderBattleScreen(); // HPバー反映+撃破していればリアクション起動
  };
  // 投擲演出(effects.js、モック移植2026-07-29)。カードが見つからない場合は演出なしの即時適用
  const card = document.querySelector(`#enemyRow .enemy-card[data-id="${target.instanceId}"]`);
  if (!card || typeof playCatapultStoneFx !== "function") { applyHit(); return 0; }
  playCatapultStoneFx(card, applyHit);
  return 950; // 飛翔620ms+着弾の余韻
}

// ============ ウェーブ抽選 ============
// その時点の村レベルのプールから重み付きで1候補を選ぶ。プール未設定のレベルは下位レベルへ
// フォールバック(raid_editor.htmlの設計契約)。全レベル未設定ならnull(襲撃は発生せず次回へ順延)
function pickRaidWave() {
  for (let lv = state.houseLevel || 1; lv >= 1; lv--) {
    const pool = RAID_CONFIG.pools[String(lv)];
    if (!pool || pool.length === 0) continue;
    const total = pool.reduce((s, w) => s + (Number(w.weight) || 0), 0);
    if (total <= 0) return pool[0];
    let r = Math.random() * total;
    for (const cand of pool) {
      r -= Number(cand.weight) || 0;
      if (r < 0) return cand;
    }
    return pool[pool.length - 1];
  }
  return null;
}

// ============ 迎撃準備画面(襲撃日の朝に出す) ============
// ユーザー指示(2026-07-28): 防衛隊はプレイヤーが選べること・回復薬等の買い物もできること。
// 出発準備画面(screen-party-select)を「襲撃モード」で使い回す: 支度(物資購入)+鍛冶屋+
// 防衛隊選択(最大RAID_PARTY_MAX人・控えなし)+赤い「迎え撃つ」ボタン。町へは戻れない
// (明朝型=目覚めた瞬間に襲撃のため当日の町画面は無い)。renderTown()はraidPrepPendingを見て
// この画面へリダイレクトするので、リロードしても踏み倒せない
// 防衛隊の人数制限(ユーザー指示2026-07-28): 基本は最大4人。見張り台を建てていれば5人目の枠が開くが、
// その枠=見張り台に立つ支援射撃要員のため、5人編成には狩人か砲術士が最低1人含まれている必要がある
// (5人の中の狩人/砲術士が見張り台担当。現状は特殊な挙動は無く通常の5人目として戦闘参加する)
const RAID_PARTY_BASE_MAX = 4;
const RAID_WATCHTOWER_CLASSES = ["hunter", "gunner"];
function raidPartyMax() {
  return (state.watchtowerLevel || 0) > 0 ? RAID_PARTY_BASE_MAX + 1 : RAID_PARTY_BASE_MAX;
}
function isRaidWatchtowerClass(c) {
  return !!c && RAID_WATCHTOWER_CLASSES.includes(c.classId);
}
// 5人編成として成立するか(=狩人か砲術士が最低1人いるか)。4人以下は無条件で成立
function raidPartyCompositionOk(chars) {
  return chars.length <= RAID_PARTY_BASE_MAX || chars.some(isRaidWatchtowerClass);
}
let raidDefenderIds = []; // 迎撃準備画面で選択中の防衛隊(キャラid)。初期値はレベル上位
function showRaidPrep() {
  state.raidPrepPending = true;
  saveState();
  // 初期選択: 選出可能(ロスト/入浴中を除く)な仲間からレベル上位最大4人。プレイヤーが自由に組み替えられる。
  // 見張り台があれば5人目も自動で埋める(4人の中に狩人/砲術士がいれば残りのレベル最上位を、
  // いなければ残りから狩人/砲術士のレベル最上位を。どちらも居なければ4人のまま)
  const now = absoluteGameMinutes();
  const avail = state.roster
    .filter((c) => isAvailable(c, now))
    .sort((a, b) => (b.level || 1) - (a.level || 1));
  const picked = avail.slice(0, RAID_PARTY_BASE_MAX);
  if (raidPartyMax() > RAID_PARTY_BASE_MAX) {
    const rest = avail.slice(RAID_PARTY_BASE_MAX);
    const fifth = picked.some(isRaidWatchtowerClass) ? rest[0] : rest.find(isRaidWatchtowerClass);
    if (fifth) picked.push(fifth);
  }
  raidDefenderIds = picked.map((c) => c.id);
  renderPartySelect();
  showScreen("screen-party-select");
}

// ============ 襲撃戦の開始/終了 ============
// 大規模戦テスト(title.js)で検証済みの起動手順を実データで行う。探索(enterDungeon)は経由しない:
// startBattle()自身が画面遷移(screen-battle)とBGM開始を行うため、fieldPartyと演出フックを
// 直接セットするだけでよい。勝敗処理はbattle.jsのvictory()/defeat()がraidBattleActiveで分岐する
let raidBattleActive = false; // 襲撃戦中フラグ(battle.js/engine.jsが参照)
let raidWatchtowerCharId = null; // 見張り台担当(5人編成時の選択順で最初の狩人/砲術士)のキャラid。カードの高所表示(ui.js/battle.css)に使う。挙動は他の4人と同じ(ユーザー確定2026-07-28)
// 多段ウェーブ(2026-07-29): 1回の襲撃候補が複数ウェーブ(RAID_CONFIGのwaves配列)を持てる。
// 1波目はstartRaidBattleFromPrep()で通常の戦闘開始に使い、2波目以降はここに積んでおいて
// battle.jsのnextRound()/processNext()が「全滅したが次ウェーブが控えている」場面で
// raidTryAdvanceWave()を呼び、湧かせて同じ戦闘のまま続行する(町へは戻らない)
let raidWaveQueue = [];
let raidCurrentWaveNum = 1; // ログ表示用(第◯波)
function raidTryAdvanceWave() {
  if (!raidBattleActive || raidWaveQueue.length === 0) return false;
  const nextWave = raidWaveQueue.shift();
  const spawned = [];
  (nextWave.enemies || []).forEach((row) => {
    for (let i = 0; i < (row.count || 0); i++) {
      const e = instantiateEnemyById(row.id);
      if (e) spawned.push(e);
    }
  });
  if (spawned.length === 0) return raidTryAdvanceWave(); // 空ウェーブ(設計ミス対策)は飛ばして次を試す
  // 前の波の死体カードの枠を畳む: 通常戦闘の差分レンダラーは「敵が死んでも枠を残す」仕様
  // (残った敵の並びが詰まって動かないため)だが、ウェーブ切り替え時は前の波が全滅済みなので、
  // 枠を残すと新しい波のカードが見えない死体枠の右に押し込まれて「縮む+右寄り」になる
  // (実機バグ2026-07-29)。battle.enemiesからは外さない(勝利時のgold/xp集計が全ウェーブ分を
  // 走査するため)。__clearedWaveはrenderBattleScreenのvisibleEnemiesフィルタが見る表示専用フラグ
  battle.enemies.forEach((e) => { if (e.hp <= 0) e.__clearedWave = true; });
  battle.enemies = battle.enemies.concat(spawned);
  battle.justAppeared = true; // 新しい波のカードにも戦闘開始時と同じ出現演出を付ける
  raidCurrentWaveNum++;
  blog(`第${raidCurrentWaveNum}波が押し寄せてきた！`);
  renderBattleScreen();
  return true;
}
function startRaidBattleFromPrep() {
  const defenders = raidDefenderIds.map((id) => getRosterChar(id)).filter(Boolean);
  if (defenders.length === 0) {
    showInfoModal("防衛隊を1人以上選んでください");
    return;
  }
  // 選択時にもガードしているが、開戦時にも最終チェック(人数上限と5人編成の見張り台条件)
  if (defenders.length > raidPartyMax() || !raidPartyCompositionOk(defenders)) {
    showInfoModal(`5人編成には見張り台に立つ狩人か砲術士が必要です(最大${raidPartyMax()}人)`);
    return;
  }
  const wave = pickRaidWave();
  if (!wave || !wave.waves || wave.waves.length === 0) {
    // プールが空(設計データ未投入)なら発生させず次回へ順延する
    state.raidPrepPending = false;
    state.nextRaidDay = (state.dayCount || 1) + rollRaidIntervalDays();
    saveState();
    renderTown();
    return;
  }
  // 見張り台担当を確定(5人編成時のみ。選択順で最初の狩人/砲術士=迎撃準備画面の🏹タグと同じ決め方)。
  // 高所のやぐら表示は右端が映えるため、担当を隊列の末尾へ回す(戦闘の手番順はspd依存なので影響なし)
  raidWatchtowerCharId = null;
  if (defenders.length > RAID_PARTY_BASE_MAX) {
    const wt = defenders.find(isRaidWatchtowerClass);
    if (wt) {
      raidWatchtowerCharId = wt.id;
      defenders.splice(defenders.indexOf(wt), 1);
      defenders.push(wt);
    }
  }
  raidBattleActive = true;
  fieldParty = defenders;
  reserveFieldMember = null;
  fieldParty.forEach((c) => { c.kishinkaUsed = false; }); // 鬼神化は襲撃戦でも1回使える(遠征とは別枠扱い)
  stopTownBgm();
  // 襲撃戦の見た目と音(大規模戦テストで確定した演出フック一式)
  battleBgOverrideSet = BG_SETS.departure; // 背景=村の出発画面(村の入り口で迎え撃つ)
  battleBgmOverrideKey = "raid_battle";
  massBattleSizingForced = true; // 敵カードは頭数に関係なく縮小サイズで統一
  resetRaidBarricade(state.barricadeHp || 0); // 柵は建築済みかつ耐久が残っている時だけ立つ(永続耐久)
  updateSceneBackgrounds();
  // 候補(wave)は複数ウェーブ(wave.waves)を持てる。1波目だけ確定出現させ、2波目以降は
  // raidWaveQueueに積んでおき、全滅の代わりにraidTryAdvanceWave()が湧かせる
  // (raid_editor.htmlのエクスポート形式もwaves配列を持つ、旧形式のenemies直書きは廃止)
  raidCurrentWaveNum = 1;
  raidWaveQueue = wave.waves.slice(1);
  const raiders = [];
  wave.waves[0].enemies.forEach((row) => {
    for (let i = 0; i < (row.count || 0); i++) {
      const e = instantiateEnemyById(row.id);
      if (e) raiders.push(e);
    }
  });
  startBattle(raiders, null, "村が襲撃された！迎え撃て！");
}
// 襲撃戦の後始末(勝敗どちらでも通る)。演出フックの解除・柵耐久の永続化・次回襲撃の予約・敗北ペナルティ
function finishRaidBattle(won) {
  raidBattleActive = false;
  raidWatchtowerCharId = null; // 高所表示の解除(ui.jsのrenderPartyBarが次の描画でクラスを外す)
  raidWaveQueue = []; // 途中敗北等で残っていた未消化ウェーブは破棄する
  state.raidPrepPending = false; // 迎撃準備状態を解除(戦闘中リロードはフラグが残っているため準備画面からやり直しになる=踏み倒し不可)
  state.barricadeHp = Math.max(0, raidBarricadeHp); // 戦闘中に受けた柵ダメージを持ち帰る(修理は建築画面)
  battleBgOverrideSet = null;
  battleBgmOverrideKey = null;
  massBattleSizingForced = false;
  resetRaidBarricade(0);
  state.nextRaidDay = (state.dayCount || 1) + rollRaidIntervalDays(); // 次回は最短〜最長からランダム(日数をばらけさせる、ユーザー指示2026-07-28)
  if (!won) state.houseLevel = Math.max(1, (state.houseLevel || 1) - 1); // 敗北=村レベル低下。建築済み施設はそのまま残す(ユーザー確定)
  saveState();
}
