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

// ============ カウントダウンバッジ(町ヘッダー+出発準備画面) ============
// モックmock_raid_countdown.htmlでユーザー確認済みのデザイン: 3日以上=通常/2日=黄(warn)/
// 残り1日以下=「明朝、襲撃！」赤点滅(danger)。「あと1日」「当日」表記は存在しない(明朝型のため)
function updateRaidBadge(el) {
  if (!el) return;
  if (state.nextRaidDay == null) { el.style.display = "none"; return; }
  const left = state.nextRaidDay - (state.dayCount || 1);
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

// ============ 襲撃戦の開始/終了 ============
// 大規模戦テスト(title.js)で検証済みの起動手順を実データで行う。探索(enterDungeon)は経由しない:
// startBattle()自身が画面遷移(screen-battle)とBGM開始を行うため、fieldPartyと演出フックを
// 直接セットするだけでよい。勝敗処理はbattle.jsのvictory()/defeat()がraidBattleActiveで分岐する
let raidBattleActive = false; // 襲撃戦中フラグ(battle.js/engine.jsが参照)
function startRaidBattle() {
  const wave = pickRaidWave();
  // 次回予約は開始時点で済ませる(戦闘中リロードでの踏み倒しはraidIsDueが拾い直すが、
  // 勝敗処理側での予約漏れが起きないよう終了時にも同じ値を上書きする)
  if (!wave) {
    // プールが空(設計データ未投入)なら発生させず次回へ順延する
    state.nextRaidDay = (state.dayCount || 1) + RAID_CONFIG.schedule.repeatEveryDays;
    saveState();
    renderTown();
    return;
  }
  // 防衛隊: 名簿からレベル上位最大5人が自動で立つ(控えなし)。編成画面は挟まない
  // (明朝の急襲という設定+襲撃戦は「村の総力戦」のため。人数が5人未満なら全員)
  const defenders = state.roster.slice().sort((a, b) => (b.level || 1) - (a.level || 1)).slice(0, 5);
  if (defenders.length === 0) return; // 名簿が空(通常はゲームオーバー済みで到達しない)
  raidBattleActive = true;
  fieldParty = defenders;
  reserveFieldMember = null;
  stopTownBgm();
  // 襲撃戦の見た目と音(大規模戦テストで確定した演出フック一式)
  battleBgOverrideSet = BG_SETS.departure; // 背景=村の出発画面(村の入り口で迎え撃つ)
  battleBgmOverrideKey = "raid_battle";
  massBattleSizingForced = true; // 敵カードは頭数に関係なく縮小サイズで統一
  resetRaidBarricade(state.barricadeHp || 0); // 柵は建築済みかつ耐久が残っている時だけ立つ(永続耐久)
  updateSceneBackgrounds();
  const raiders = [];
  wave.enemies.forEach((row) => {
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
  state.barricadeHp = Math.max(0, raidBarricadeHp); // 戦闘中に受けた柵ダメージを持ち帰る(修理は建築画面)
  battleBgOverrideSet = null;
  battleBgmOverrideKey = null;
  massBattleSizingForced = false;
  resetRaidBarricade(0);
  state.nextRaidDay = (state.dayCount || 1) + RAID_CONFIG.schedule.repeatEveryDays;
  if (!won) state.houseLevel = Math.max(1, (state.houseLevel || 1) - 1); // 敗北=村レベル低下。建築済み施設はそのまま残す(ユーザー確定)
  saveState();
}
