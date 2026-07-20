// ============ dungeon.js: 深淵の森/海岸探索(進む・進路選択・エンカウント・瀕死救出・帰還) ============
// ============ ダンジョン ============
// 海の村/山伏の里から「元来た道を歩いて戻る」場合の特別な帰還モード(2026-07-19)。
// 通常の帰還(オート帰還、0階層に着くまで無操作で進み続ける)とは違い、こちらは普通の
// 探索と同じく1回のボタン操作で1階層だけ進む(ユーザー指示: 「急に帰還のオートモードが
// 始まるのはおかしい、あくまで進むじゃないと」)。stageEntryStackが1回popされる
// (=村の直前のステージまで戻る)たびに自動的に解除される。有効な間は里に戻るボタンが
// 「(村名)に戻る」に変わり、押すとその場で村へ引き返せる(オート帰還の確認モーダルは出さない)
let manualRetreatMode = false;
let manualRetreatHomeVillage = null; // "umimura" | "yamabushi" など、引き返す先の村のcurrentStage名
const VILLAGE_STAGE_DISPLAY_NAME = { umimura: "海の村", yamabushi: "山伏の里" };
let currentFloor = 0;
// 連続戦闘のストレス軽減(ピティ制)用カウンター。直近の戦闘から何階層経過したかを数え、
// rollEncounter()の戦闘率補正に使う(下記PITY_*定数参照)。99は「しばらく戦闘していない」扱いの
// 初期値(=通常倍率からスタート、いきなり抑制も確定発生もされない)
let floorsSinceLastBattle = 99;
// 開発者用デバッグモード。町トップのゴールド表示を4回連続タップすると切り替わる(town.js参照)。
// 敵ゼロのエリア(廃城下町/門/古城/渓流/光る竹林/修験道/山など)の下地・背景を戦闘無しで
// 歩いて確認したい時のためのもの。セーブはせず、リロードすれば常にfalseへ戻る
let debugNoEncounters = false;
let currentStage = "forest"; // "forest"(深淵の森) | "coast"(海岸) | "cave"(洞窟) | "ruins"(廃城下町) | "gate"(門) | "castle"(古城) | "valley"(渓流) | "bamboo"(光る竹林) | "shugendo"(修験道) | "yama"(山)。
// forest/coastは町の出発ボタンで選び、enterDungeon()〜帰還/全滅まで有効。それ以外は
// STAGE_CHAIN_NEXT(下記)で繋がった中継ステージで、前のステージの最深部から自動的に切り替わり、
// 0階層(=出口)まで帰還すると元のステージ・階層へ自動的に戻る(moveOneFloor/stageEntryStack参照)
function currentStageName() {
  return currentStage === "coast" ? "海岸" : currentStage === "cave" ? "洞窟"
    : currentStage === "ruins" ? "廃城下町" : currentStage === "gate" ? "門" : currentStage === "castle" ? "古城"
    : currentStage === "valley" ? "渓流" : currentStage === "bamboo" ? "光る竹林"
    : currentStage === "shugendo" ? "修験道" : currentStage === "yama" ? "山"
    : "深淵の森";
}
// 中継ステージへ入った時、直前のステージ・階層を積んでおく(0階層まで帰還した時にpopして戻るための橋渡し)。
// 森→洞窟の1本だけだった頃はcaveEntryFloorという単一変数だったが、洞窟→廃城下町→門→古城と
// 中継が連鎖するようになったため、スタック形式に一般化した
let stageEntryStack = [];
const VALID_STAGES = ["forest", "coast", "cave", "ruins", "gate", "castle", "ruinsforest", "valley", "bamboo", "shugendo", "yama"];

// ============ 遠征状態の永続化(2026-07-18) ============
// 従来、階層・パーティ・帰還中フラグ等の遠征状態はメモリ上にしか無く、探索中にページを
// リロードすると常に町へ戻れてしまっていた(=危険になったら更新で無傷離脱でき、パーマデスが
// 骨抜きになるというユーザー報告のバグ)。saveState()のたびに遠征スナップショットを
// state.expeditionへ書き込み、タイトルの「続きから」で遠征の途中から再開させる。
// 戦闘中のリロードだけは「戦いから逃げ出した」扱いで全員にストレスの代償を払わせる
// (戦闘そのものの復元はしない。リロードで敵を消す行為をノーコストにしないための措置)
let expeditionActive = false;
function collectExpeditionSnapshot() {
  if (!expeditionActive) { state.expedition = null; return; }
  state.expedition = {
    active: true,
    stage: currentStage,
    floor: currentFloor,
    stageEntryStack,
    retreating,
    floorsSinceLastBattle,
    ruinsforestDestination,
    inBattle: typeof battle !== "undefined" && !!battle,
    fieldPartyIds: fieldParty.map((c) => c.id),
    reserveId: reserveFieldMember ? reserveFieldMember.id : null,
    advGoldEarned,
    advXpGained,
    advLevelBefore,
    advQuestCompleted,
    jizoBlessingActive,
    warashiLuckActive,
    koOniRepayFloorsLeft,
    seenEventIds: [...expeditionSeenEventIds],
  };
}
// 遠征の終了(帰還完了/全滅)時に呼ぶ。スナップショットを消して「次回は町から」に戻す
function clearExpeditionSnapshot() {
  expeditionActive = false;
  state.expedition = null;
}
// タイトルの「続きから」用: セーブに遠征中スナップショットがあれば探索画面へ直接復帰する。
// 再開できた場合はtrueを返す(呼び出し元は町へ行かない)
function resumeExpeditionFromSave() {
  const snap = state.expedition;
  if (!snap || !snap.active) return false;
  currentStage = VALID_STAGES.includes(snap.stage) ? snap.stage : "forest";
  currentFloor = Math.max(1, snap.floor || 1);
  stageEntryStack = Array.isArray(snap.stageEntryStack) ? snap.stageEntryStack : [];
  retreating = !!snap.retreating;
  floorsSinceLastBattle = snap.floorsSinceLastBattle != null ? snap.floorsSinceLastBattle : 99;
  ruinsforestDestination = snap.ruinsforestDestination || null;
  fieldParty = (snap.fieldPartyIds || []).map(getRosterChar).filter((c) => c && c.status !== "lost");
  reserveFieldMember = snap.reserveId ? getRosterChar(snap.reserveId) : null;
  // 稼働できる仲間が誰も居ない(全員瀕死/ロスト)なら再開のしようがないので、諦めて町へ
  if (fieldParty.filter((c) => c.status === "active").length === 0) {
    clearExpeditionSnapshot();
    saveState();
    return false;
  }
  expeditionActive = true;
  advGoldEarned = snap.advGoldEarned || 0;
  advXpGained = snap.advXpGained || {};
  advLevelBefore = snap.advLevelBefore || {};
  advQuestCompleted = snap.advQuestCompleted || null;
  jizoBlessingActive = !!snap.jizoBlessingActive;
  warashiLuckActive = !!snap.warashiLuckActive;
  koOniRepayFloorsLeft = snap.koOniRepayFloorsLeft || 0;
  expeditionSeenEventIds = new Set(snap.seenEventIds || []);
  resetPeaceDialogueState();
  dungeonLogLines = [];
  document.getElementById("dungeonLog").innerHTML = "";
  stopTownBgm();
  showScreen("screen-dungeon");
  renderDungeon();
  dlog(`${currentStageName()}・${currentFloor}層目から冒険を再開した。`);
  if (snap.inBattle) {
    // 戦闘中のリロード: 敵は消えるが、逃走と同じストレスの代償を全員が払う。
    // また通常は戦闘終了処理で行われる後始末(かばう構え解除・石長比売の御守の一時HPボーナス
    // 差し引き)がリロードで飛ばされているため、ここで代わりに行う
    fieldParty.forEach((c) => {
      if (c.status === "active") {
        c.fatigue = Math.min(FATIGUE_MAX, (c.fatigue || 0) + FLEE_STRESS_PENALTY);
        popupOn(c.id, String(FLEE_STRESS_PENALTY), "stress");
      }
    });
    if (typeof clearGuardState === "function") clearGuardState(fieldParty);
    if (typeof clearOmamoriIwanagaBonus === "function") clearOmamoriIwanagaBonus(fieldParty);
    dlog(`戦いの最中に隙を見て逃げ出した…。(全員ストレス+${FLEE_STRESS_PENALTY})`);
    renderDungeon();
  }
  saveState();
  return true;
}
// ステージごとの最高到達階層を更新する。前進(moveOneFloor)とenterDungeon(1層目突入)からのみ呼び、
// 帰還中の後退では呼ばない(currentFloorが減る側なので自然にMath.maxで無視される想定だが、念のため明示)
function recordMaxFloorReached() {
  state.maxFloorReached = state.maxFloorReached || { forest: 0, coast: 0, cave: 0 };
  if (currentFloor > (state.maxFloorReached[currentStage] || 0)) state.maxFloorReached[currentStage] = currentFloor;
}
let fieldParty = []; // 現在ダンジョンに出ているキャラのライブ参照配列(戦闘に出る最大4人。5人目は下記reserveFieldMember)
// 5人編成で出発した時の5人目(交代要員)。戦闘には参加せず、
// 探索中はいつでも自由にfieldPartyの誰かと交代でき、戦闘中は①行動中のキャラが自分のターンを
// 消費して手動で交代する、②誰かが瀕死になった瞬間に「交代しますか？」のポップアップで交代する、の2経路がある。
// 瀕死のキャラがこの枠に入ることもあるが、その場合も「歩けない」ため戦闘終了後は通常通り担いで
// 救出する必要がある(この枠にいるだけでは救出したことにならない)。
// 「助っ人の札」アイテムは廃止したため、現状maxActivePartySize()が常に4を返し5人編成には
// 到達しないが、この仕組み自体は将来別の解禁方法で使う想定でそのまま残してある
let reserveFieldMember = null;
let advGoldEarned = 0; // 今回の冒険で稼いだ合計ゴールド(帰還時のリザルト画面用、enterDungeon()でリセット)
let advXpGained = {}; // 今回の冒険でキャラごとに得た経験値の合計(characterId -> xp、同じくリザルト画面用)
let advLevelBefore = {}; // 今回の冒険開始時点のレベル(characterId -> level)。リザルト画面でレベルアップを分かりやすく表示するための比較用
let advQuestCompleted = null; // 今回の冒険で奉行所の依頼を達成した場合{title, gold, xp}(リザルト画面用、enterDungeon()でリセット)
let retreating = false; // 里に戻る途中(進むボタンが「帰還」になり、階層を1つずつ下って歩いて帰る)
// ============ ボス追撃モード: ボス/中ボスがHPが一定以下になると瀕死のまま逃走し、以後どのフロアでも
// 一定確率で追いつく(討伐依頼のchasing/carryHpと同じ仕組みを、通常の(討伐依頼ではない)ボス/中ボスにも
// 適用したもの)。里に戻る(finishRetreat)か新しい遠征を始める(enterDungeon)と「追撃モード」自体は
// 終了する(この遠征内で追いかけ続ける緊張感は次の遠征には持ち越さない)が、見送った(捕まえられずに
// 終わった)場合はその時点のHPをstate.woundedBosses(engine.js)に記録し、以後は時間経過で少しずつ
// 回復しながら通常のボス枠として再出現する(recordBossWoundIfPursuing参照)
// null | { enemyId, hp, maxHp, stage } ※stageは発生した場所(forest/coast)を覚えておき、
// 別ステージに移動した場合は再遭遇の対象にならないようにする(dungeon.js側の判定で参照)
let bossPursuit = null;
// 追撃モードのまま(捕まえずに)遠征が終わった時、手負いのHPをstate.woundedBossesへ記録してから
// bossPursuitをクリアする。討伐して倒しきった場合(battle.jsのvictory())はここを通らず、
// 単にbossPursuit=nullするだけで良い(回復すべき「手負いの記録」自体が発生しないため)
function recordBossWoundIfPursuing() {
  if (bossPursuit) {
    state.woundedBosses = state.woundedBosses || {};
    state.woundedBosses[bossPursuit.enemyId] = { hp: bossPursuit.hp, maxHp: bossPursuit.maxHp, fledAtMinutes: absoluteGameMinutes() };
  }
  bossPursuit = null;
}
// ============ オート帰還: 「帰還」ボタンを押した後は無操作で0階層まで自動的に進み続ける ============
// 背景ズームは1階層ごとにリセットせず、帰還開始時の階層〜0階層まで連続的に拡大し続ける(1階層=1秒)。
// 戦闘/茶屋/瀕死発見のいずれかが起きると暗転を挟んで一時停止する(時刻変化は例外で自動再開、
// 財宝発見はユーザー指示によりそもそも一時停止せずオート帰還を継続する)。
// 画面を任意にタップすると即座に手動操作へ戻せる
const AUTO_RETREAT_TICK_MS = 1000; // 1階層につき1秒
const AUTO_RETREAT_ZOOM_PER_FLOOR = 0.08; // 1階層あたりのズーム増分(通常の1回分の歩行演出=buildWalkKeyframesと同じ値)
const AUTO_RETREAT_CUT_FADE_MS = 400; // 時刻変化/茶屋/瀕死発見で一旦区切る時の暗転フェード時間
let autoRetreatActive = false;
let autoRetreatStartFloor = 0; // ズームの基準(この階層をscale(1)として、0階層でscale(1+ZOOM_PER_FLOOR*ここ)になる)
let autoRetreatTimer = null;
let lastFloorMoveOutcome = null; // rollEncounter()が"battle"/"gold"/"silent"/"kamikakushi"を記録する(オート帰還が結果を見て次の一時停止要否を判断するため。ただしgoldは一時停止しない)

// ============ 戦闘後の平和な掛け合い: 「戦闘に勝利する→その後1回だけ発火可能」のサイクルで管理する状態 ============
// (他の探索限定の変数と同じくstateには保存しない)
let peaceDialogueLocked = true; // true=発火不可(まだ一度も勝利していない、または前回の勝利後に発火済み)
// 疲弊時の掛け合い=お疲れ雑談(tiredカテゴリ)用。peaceと同じ「勝利→1回だけ発火可」のサイクルだが、
// ストレス条件が正反対(peaceは全員49以下、tiredは話者に50〜99のキャラを含む)のため
// 同時に条件を満たすことはなく、ロックだけ独立に持つ
let tiredDialogueLocked = true;
// 同じ遠征の中で同じセリフ(エントリ)が二度発火しないようにするための既出記録。
// banter(平和な掛け合い)とtired(お疲れ雑談)の両カテゴリ共通で「カテゴリ:ID」のキーを貯め、
// 遠征開始/里への帰還/全滅時(=resetPeaceDialogueStateの呼び出し箇所)にリセットする。
// 野営ではリセットしない(野営はロックを解くだけで、遠征自体は続いているため)
let expeditionSpokenDialogueKeys = new Set();
function resetPeaceDialogueState() {
  peaceDialogueLocked = true; // 遠征開始時点では1回も勝利していないので発火不可
  tiredDialogueLocked = true;
  expeditionSpokenDialogueKeys = new Set();
  // 探索イベントの遠征内状態も同じライフサイクル(遠征開始/里への帰還/全滅)でリセットする
  resetExpeditionEventState();
}
// 戦闘に勝利するたび(battle.jsのvictory()から)呼ぶ。これで次に条件を満たした瞬間1回だけ発火できるようになる
function unlockPeaceDialogueAfterVictory() {
  peaceDialogueLocked = false;
  tiredDialogueLocked = false;
}

function applyOmikujiExpeditionStart() {
  fieldParty.forEach((c) => {
    if (c.passives) c.passives.sharedSurviveFatal = null;
  });
  if (state.omikujiEffect === "daikichi") {
    const guard = { used: false };
    fieldParty.forEach((c) => {
      c.passives = c.passives || {};
      c.passives.sharedSurviveFatal = guard;
    });
  }
  state.omikujiFirstStrikePending = state.omikujiEffect === "shokichi";
  state.omikujiGuaranteedCritsLeft = state.omikujiEffect === "kichi" ? 3 : 0;
}
// 遠征が終わった(里に帰った/全滅した)タイミングで、次の遠征専用だったおみくじ効果を消費し終える
function clearOmikujiExpeditionEffect() {
  state.omikujiEffect = null;
  state.omikujiFirstStrikePending = false;
  state.omikujiGuaranteedCritsLeft = 0;
}

function enterDungeon() {
  currentFloor = 1;
  retreating = false;
  ruinsforestDestination = null;
  recordBossWoundIfPursuing(); // 通常はfinishRetreat()で既に処理済みのはずだが、念のための保険
  recordMaxFloorReached();
  pruneActiveParty();
  fieldParty = state.activePartyIds.map(getRosterChar).filter((c) => c && c.status === "active");
  // 5人選んでいた場合、5人目(最後に選んだ人)は交代要員として控えに回る
  // (現状maxActivePartySize()が常に4を返すため到達しないが、仕組みとして残してある)
  if (fieldParty.length >= 5) {
    reserveFieldMember = fieldParty.pop();
  } else {
    reserveFieldMember = null;
  }
  fieldParty.forEach((c) => { c.carryingId = null; }); // 前回の冒険の担ぎ状態が万が一残っていないよう保険でリセット
  fieldParty.forEach((c) => applyOnsenHpBuffOnDeparture(c)); // 温泉バフ「ぽかぽか」(最大HP+7%)をこの遠征分だけ加算する
  if (reserveFieldMember) applyOnsenHpBuffOnDeparture(reserveFieldMember);
  applyOmikujiExpeditionStart();
  advGoldEarned = 0;
  advXpGained = {};
  advLevelBefore = {};
  advQuestCompleted = null;
  resetPeaceDialogueState();
  fieldParty.forEach((c) => { advLevelBefore[c.id] = c.level; });
  dungeonLogLines = [];
  // dungeonLogLines(配列)を空にするだけでは前回の遠征のログ行がDOMに残ったままになる
  // (appendTypewriterLogは行を追加するだけで、#dungeonLog自体をクリアしない設計のため。
  // #battleLogは戦闘開始のたびにstartBattle()でinnerHTMLごとクリアされるので同じ対処をする)
  document.getElementById("dungeonLog").innerHTML = "";
  // 新しい冒険のたびに曲を最初から再生する(前回の続きから再開しないようにする)。夜専用曲も含めて両方リセットする
  bgmPositions.dungeon = 0;
  bgmPositions.dungeon_night = 0;
  bgmPositions.coast = 0;
  bgmPositions.coast_night = 0;
  bgmPositions.coast_battle = 0;
  bgmPositions.valley = 0;
  bgmPositions.valley_night = 0;
  stopTownBgm();
  showScreen("screen-dungeon");
  renderDungeon();
  dlog(`${currentStageName()}に入った。`);
  // 遠征状態の永続化を開始する(以後saveState()のたびにstate.expeditionへ書き込まれる)
  expeditionActive = true;
  saveState();
}

let dungeonLogLines = [];
function dlog(msg) {
  dungeonLogLines.push(msg);
  appendTypewriterLog("dungeonLog", "dungeonLogArrow", msg);
}

// ストレス段階に応じた落書き風オーバーレイ画像(無ければnull)
// 交代要員(reserveFieldMember)は控えに入っている間は画面上のアイコン表示に含めない
// (5人編成でも常時表示されるアイコンは4つのまま。交代ボタンを押した時のピッカーでのみ姿を見せる)
function visibleFieldParty() {
  return fieldParty.filter((c) => c.status !== "critical" || c.carriedBy);
}
function renderDungeon() {
  hideStatusTooltip(); // 再描画でアイコン要素が作り直されるため、表示中の説明ツールチップが宙に浮かないよう消しておく
  document.getElementById("floorBadgeText").textContent = `${currentFloor}層目`;
  document.getElementById("dungeonTimeBadge").textContent = `${TIME_PHASE_LABEL[state.timeOfDay || "day"]} ${formatClockTime(state.clockMinutes)}`;
  updateQuestTargetBadge();
  updateBossPursuitBadge();
  renderPartyBar("dungeonPartyBar", visibleFieldParty());
  document.getElementById("dungeonLog").style.display = "";
  // 担ぐ/見送るの選択中に道具ボタン等を使うとrenderDungeon()が呼ばれ、そのままだと
  // criticalAlertが空になって選択肢が消えたまま二度と出てこなくなっていたバグの修正。
  // 表示中だったアラート/担ぎ手選択があれば、消さずに同じ内容を再表示する
  if (activeCriticalAlert) {
    if (activeCriticalAlert.screen === "carryPicker") showCarryPicker(activeCriticalAlert.critical, activeCriticalAlert.onResolved);
    else showCriticalAlert(activeCriticalAlert.critical, activeCriticalAlert.onResolved);
  } else {
    document.getElementById("criticalAlert").innerHTML = "";
  }
  // 森は「虫の声」、海岸は「波音」のアンビエントを、探索中・戦闘中を通して流し続ける(playAmbientBgm内でstage判定)。
  // BGM(森:dungeon系/海岸:coast/coast_battle)はこれとは別チャンネル(bgmAudio)で、startBattleでのみ切り替わり、
  // stopBattleBgmで探索用に戻る。どちらのチャンネルも戦闘中に止めない
  playAmbientBgm();
  // 中ボス/ボスから逃げて追いかけられている間はボス曲を鳴らし続けたいため、その間は
  // 探索用BGMへ上書きし直さない(isBossBgmActive、shouldKeepBossBgmOnFleeと同じ仕組み)
  if ((currentStage === "coast" || currentStage === "valley") && !isBossBgmActive()) playExplorationAreaBgm();
  updateSceneBackgrounds(); // 探索中の時計が時間帯の境界を跨いだ時に、背景がその場で切り替わるように
  // 村からの手動帰還中(manualRetreatMode)は、通常の「帰還」ラベルではなく引き続き「進む」の
  // ままにする(ユーザー指示: あくまで進むという操作感のまま)。里に戻るボタンも隠さず、
  // 「(村名)に戻る」に差し替えてその場で村へ引き返せるようにする
  document.getElementById("advanceBtn").textContent = (retreating && !manualRetreatMode) ? "帰還" : "進む";
  document.getElementById("advanceBtn").classList.toggle("retreat-active", retreating && !manualRetreatMode);
  if (manualRetreatMode) {
    document.getElementById("retreatBtn").style.display = "";
    document.getElementById("retreatBtn").textContent = `${VILLAGE_STAGE_DISPLAY_NAME[manualRetreatHomeVillage] || "村"}に戻る`;
  } else {
    document.getElementById("retreatBtn").style.display = retreating ? "none" : "";
    document.getElementById("retreatBtn").textContent = "里に戻る";
  }
  // 進む/里に戻るのdisabledは、進路選択(showPathChoice)や瀕死アラート(showCriticalAlert)、
  // 移動演出(playDungeonMoveTransition)など複数箇所が個別にtrue/falseを設定する分散管理になっており、
  // 稀にdisabled=trueのまま解除されずに残ってしまうと次の遠征に持ち越されて「進む/里に戻るが
  // 押せなくなる」不具合になる(押せるのは道具だけ、という報告と一致)。renderDungeon()は
  // 探索画面に戻るたびに必ず呼ばれる場所のため、瀕死アラート表示中でない限りここで強制的に
  // 解除し、どんな経路で壊れても次の描画で自己修復するようにする。
  // ただしオート帰還が進行中(autoRetreatActive)の間は例外: rollEncounter()の「静かな通路」/
  // 「財宝発見」分岐がtickの途中でrenderDungeon()を呼ぶため、ここで無条件に再有効化してしまうと
  // オート帰還中でも「帰還」ボタン(退避時のadvanceBtn)がタップ可能になり、押すたびに
  // stopAutoRetreat()→startAutoRetreat()が連続発火して1tick=1秒のペースを無視した多重進行が
  // 起きてしまう(「オート帰還中に重複して帰還ボタンが押せる」不具合の原因)。startAutoRetreat()/
  // stopAutoRetreat()自身が既にdisabledを正しく管理しているため、進行中はここで触れない。
  // 【不具合の根本原因】進路選択(showPathChoice)/茶屋の2択(showTeahouseOffer)/探索イベント
  // (showDungeonEvent)はいずれも"path-choice-active"をbodyに付けてadvanceBtn等を無効化するが、
  // このクラス自体はactiveCriticalAlertとは別管理の変数のため、この判定に含まれていなかった。
  // その結果、選択パネルが開いたまま(まだ選ばれていない)状態でも、何らかの理由でrenderDungeon()が
  // 再度呼ばれると(道具ボタンの副作用等、277行目のコメント参照)ここで無条件にdisabledが
  // falseへ戻ってしまい、パネルの下でまだ有効なままのadvanceBtnを連打すると
  // showPathChoiceが二重に呼ばれて抽選が上書きされる(選択肢が2回抽選されて変わって見える)
  // 不具合の原因になっていた。選択パネル表示中はここでも解除しないようにして塞ぐ
  if (!activeCriticalAlert && !autoRetreatActive && !document.body.classList.contains("path-choice-active")) {
    document.getElementById("advanceBtn").disabled = false;
    document.getElementById("retreatBtn").disabled = false;
  }
  document.getElementById("dungeonPotionBtn").textContent = `回復薬(${state.inventory.potion || 0})`;
  document.getElementById("dungeonPotionBtn").disabled = (state.inventory.potion || 0) <= 0;
  // 道具: 野営具/温泉卵/茶屋の菓子をまとめて選ぶメニュー。いずれも0個の時だけ無効化する
  document.getElementById("dungeonToolsBtn").disabled = (state.inventory.campingKit || 0) <= 0 && totalOnsenEggCount() <= 0 && TEAHOUSE_SNACK_IDS.every((id) => (state.inventory[id] || 0) <= 0);
  // 治癒の術: 僧侶がパーティにいる時だけボタンを表示し、MPが足りない時は無効化する
  const dungeonPriests = fieldParty.filter((c) => c.status === "active" && c.classId === "priest");
  const healCost = abilityMpCost("heal");
  const healBtn = document.getElementById("dungeonHealBtn");
  if (dungeonPriests.length === 0) {
    healBtn.style.display = "none";
  } else {
    healBtn.style.display = "";
    healBtn.textContent = `治癒の術(MP${healCost})`;
    healBtn.disabled = !dungeonPriests.some((c) => c.mp >= healCost);
  }
  // 交代: 控え(reserveFieldMember)が健在(瀕死でない)の時だけ表示。探索中はいつでも無償で交代できる
  const swapBtn = document.getElementById("dungeonSwapBtn");
  swapBtn.style.display = reserveFieldMember && reserveFieldMember.status === "active" ? "" : "none";
  positionActionsBelowPartyBar("dungeonPartyBar", ".bottom-actions");
}

// fieldPartyの誰か(activeMember)と控え(reserveFieldMember)を入れ替える共通処理。
// 探索中のボタン/戦闘中の手動交代/瀕死時の自動交代提案、いずれもこれを使う。
// ログの出し方(dlog/blog)は呼び出し元ごとに違うため引数で受け取る
function swapReserveMember(activeMember, log) {
  const idx = fieldParty.indexOf(activeMember);
  if (idx === -1 || !reserveFieldMember) return null;
  const incoming = reserveFieldMember;
  // 控えに下がるキャラの変化の術/鷹を呼ぶは、控え中も効果が残り続けるのは不自然なためここで解除する
  if (activeMember.transformForm) {
    const formName = TRANSFORM_FORMS[activeMember.transformForm].ja;
    revertTransform(activeMember);
    if (log) log(`${activeMember.name}は控えに下がり、${formName}の姿から人間に戻った。`);
  }
  if (activeMember.hawkTurnsLeft > 0) {
    clearHawkState([activeMember]);
    if (log) log(`${activeMember.name}の鷹は姿を消した。`);
  }
  fieldParty[idx] = incoming;
  reserveFieldMember = activeMember;
  if (log) log(`${incoming.name}が${activeMember.name}と交代した。`);
  return incoming;
}
// 探索中(戦闘外): 交代要員がいる間はいつでも自由に、ターン等の概念なしに交代できる。
// 誰かを担いでいる最中のキャラは交代候補から除外する(担いでいる相手の行き場が無くなるため)
document.getElementById("dungeonSwapBtn").onclick = () => {
  if (!reserveFieldMember || reserveFieldMember.status !== "active") return;
  const targets = fieldParty.filter((c) => c.status === "active" && !c.transformForm && !c.carryingId);
  if (targets.length === 0) { showInfoModal("交代できる仲間がいません(全員ふさがっています)"); return; }
  pendingAllyPick = (t) => {
    pendingAllyPick = null;
    closeDungeonTargetPicker();
    swapReserveMember(t, dlog);
    saveState();
    renderDungeon();
  };
  renderDungeon();
  DUNGEON_BOTTOM_BTN_IDS.forEach((id) => { document.getElementById(id).style.display = "none"; });
  const picker = document.getElementById("dungeonTargetPicker");
  picker.style.display = "flex";
  picker.innerHTML = `
    <p style="width:100%;margin:0;font-size:0.82rem;"><strong>誰と${reserveFieldMember.name}を交代させますか？</strong></p>
    ${targets.map((c) => `<button class="big" data-target-id="${c.id}">${c.name} (${c.hp}/${c.maxHp})</button>`).join("")}
    <button class="big" id="cancelDungeonTargetBtn">やめる</button>
  `;
  targets.forEach((c) => {
    picker.querySelector(`button[data-target-id="${c.id}"]`).onclick = () => {
      if (!pendingAllyPick) return; // 既に別経路(味方イラスト直接タップ等)で選択済みなら無視する(二重行動防止)
      pendingAllyPick = null;
      closeDungeonTargetPicker();
      swapReserveMember(c, dlog);
      saveState();
      renderDungeon();
    };
  });
  document.getElementById("cancelDungeonTargetBtn").onclick = () => {
    pendingAllyPick = null;
    closeDungeonTargetPicker();
  };
  positionActionsBelowPartyBar("dungeonPartyBar", ".bottom-actions");
};

// 探索中(戦闘外)に回復薬/治癒の術の対象を選ぶ共通ヘルパー。戦闘中と同様、上の味方イラストを
// 直接タップしても選べる(pendingAllyPick、renderPartyBar側で処理)し、下のテキストボタンからも選べる。
// 選択肢は#criticalAlert(画面上部)ではなく味方バーの下の.bottom-actionsに出す。上部に出すと
// 選択肢が増えた時に味方イラストへ重なってタップを奪ってしまう(実際に発生したバグ)ため、
// 戦闘画面の対象選択(味方バーの下に出る)と同じ位置関係に揃えてある
const DUNGEON_BOTTOM_BTN_IDS = ["advanceBtn", "retreatBtn", "dungeonPotionBtn", "dungeonHealBtn", "dungeonToolsBtn", "dungeonSwapBtn"];
function closeDungeonTargetPicker() {
  const picker = document.getElementById("dungeonTargetPicker");
  picker.style.display = "none";
  picker.innerHTML = "";
  DUNGEON_BOTTOM_BTN_IDS.forEach((id) => { document.getElementById(id).style.display = ""; });
  renderDungeon();
}
function pickDungeonAllyTarget(promptText, onPicked) {
  const targets = fieldParty.filter((c) => c.status === "active" && !c.transformForm);
  pendingAllyPick = (t) => {
    pendingAllyPick = null;
    closeDungeonTargetPicker();
    onPicked(t);
  };
  renderDungeon(); // 味方イラストにtargetableハイライトを反映
  DUNGEON_BOTTOM_BTN_IDS.forEach((id) => { document.getElementById(id).style.display = "none"; });
  const picker = document.getElementById("dungeonTargetPicker");
  picker.style.display = "flex";
  picker.innerHTML = `
    <p style="width:100%;margin:0;font-size:0.82rem;"><strong>${promptText}</strong></p>
    ${targets.map((c) => `<button class="big" data-target-id="${c.id}">${c.name} (${c.hp}/${c.maxHp})</button>`).join("")}
    <button class="big" id="cancelDungeonTargetBtn">やめる</button>
  `;
  targets.forEach((c) => {
    picker.querySelector(`button[data-target-id="${c.id}"]`).onclick = () => {
      if (!pendingAllyPick) return; // 既に別経路(味方イラスト直接タップ等)で選択済みなら無視する(二重行動防止)
      pendingAllyPick = null;
      closeDungeonTargetPicker();
      onPicked(c);
    };
  });
  document.getElementById("cancelDungeonTargetBtn").onclick = () => {
    pendingAllyPick = null;
    closeDungeonTargetPicker();
  };
  positionActionsBelowPartyBar("dungeonPartyBar", ".bottom-actions");
}

// 探索中(戦闘外)にも回復薬を使えるように。対象は生存中の仲間から選ぶ
document.getElementById("dungeonPotionBtn").onclick = () => {
  if ((state.inventory.potion || 0) <= 0) return;
  pickDungeonAllyTarget(`誰に回復薬(残り${state.inventory.potion})を使いますか？`, (c) => {
    consumePotion();
    usePotion(c, dlog);
    playSfx("heal");
    maybeSpeakHealed(c);
    saveState();
    renderDungeon();
  });
};

// 探索中(戦闘外)にも僧侶の治癒の術を使えるように。MPが足りる僧侶を自動で術者にする
document.getElementById("dungeonHealBtn").onclick = () => {
  const healCost = abilityMpCost("heal");
  const caster = fieldParty.find((c) => c.status === "active" && c.classId === "priest" && c.mp >= healCost);
  if (!caster) return;
  pickDungeonAllyTarget("誰に治癒の術を使いますか？", (target) => {
    useAbility(caster, target, "heal", dlog);
    playSfx("heal");
    saveState();
    renderDungeon();
  });
};

// 探索中の「道具」ボタン: 野営具(野営を始める)/温泉卵/所持中の茶屋の菓子(誰か1人がその場で回復)を
// まとめて選ぶメニュー。回復薬/治癒の術と同じ.bottom-actions→dungeonTargetPickerの仕組みを流用する
document.getElementById("dungeonToolsBtn").onclick = () => {
  DUNGEON_BOTTOM_BTN_IDS.forEach((id) => { document.getElementById(id).style.display = "none"; });
  const picker = document.getElementById("dungeonTargetPicker");
  picker.style.display = "flex";
  const campCount = state.inventory.campingKit || 0;
  const eggCount = totalOnsenEggCount();
  // 所持している(=茶屋で買った)菓子だけをボタンとして出す。8種すべてを常に並べると
  // 持っていない物まで選択肢に見えてしまい煩雑なため
  const ownedSnackIds = TEAHOUSE_SNACK_IDS.filter((id) => (state.inventory[id] || 0) > 0);
  // 野営具は旅支度屋を建てるまでボタン自体を出さない(未所持でも灰色ボタンとして見えると、
  // 建物を建てる前からアイテムの存在を知ってしまう=ネタバレになるため)
  picker.innerHTML = `
    <p style="width:100%;margin:0;font-size:0.82rem;"><strong>道具を選んでください</strong></p>
    ${state.travelPrepShopLevel ? `<button class="big" id="toolsCampBtn" ${campCount <= 0 ? "disabled" : ""}>野営具(${campCount})</button>` : ""}
    <button class="big" id="toolsEggBtn" ${eggCount <= 0 ? "disabled" : ""}>温泉卵(${eggCount})</button>
    ${ownedSnackIds.map((id) => `<button class="big" data-tool-snack-id="${id}">${ITEMS[id].ja}(${state.inventory[id]})</button>`).join("")}
    <button class="big" id="cancelDungeonToolsBtn">やめる</button>
  `;
  if (state.travelPrepShopLevel) {
    document.getElementById("toolsCampBtn").onclick = () => {
      if (campCount <= 0) return;
      closeDungeonTargetPicker();
      startCampFromTools();
    };
  }
  document.getElementById("toolsEggBtn").onclick = () => {
    if (eggCount <= 0) return;
    pickDungeonAllyTarget(`誰が温泉卵(残り${totalOnsenEggCount()})を使いますか？`, (target) => {
      consumeOnsenEggFromInventory();
      playSfx("heal");
      useOnsenEgg(target, dlog);
      saveState();
      renderDungeon();
    });
  };
  ownedSnackIds.forEach((id) => {
    document.querySelector(`button[data-tool-snack-id="${id}"]`).onclick = () => {
      if ((state.inventory[id] || 0) <= 0) return;
      const item = ITEMS[id];
      pickDungeonAllyTarget(`誰に${item.ja}を食べさせますか？`, (target) => {
        state.inventory[id]--;
        playSfx("heal");
        useTeahouseSnack(item, target, dlog);
        maybeSpeakHealed(target);
        saveState();
        renderDungeon();
      });
    };
  });
  document.getElementById("cancelDungeonToolsBtn").onclick = () => {
    closeDungeonTargetPicker();
  };
  positionActionsBelowPartyBar("dungeonPartyBar", ".bottom-actions");
};

// 「進む」「里に戻る」共通の1歩分の移動演出。背景画像(#dungeonBg)だけをscale/translateYで
// 前進しているように動かし、序盤だけ小さくランダムに揺らして足音の衝撃を表現する。
// アニメーション完了後に画面を暗転させ、真っ暗になったタイミングでactualLogic(実際のフロア移動/
// イベント抽選/画面遷移など、既存のゲームロジックそのまま)を実行してからフェードインする
const MOVE_ANIM_MS = 750; // ユーザー指示で従来(500ms)の1.5倍に
const MOVE_FADE_MS = 600;
function buildWalkKeyframes(animMs) {
  const totalScale = 0.08; // scale(1.00) -> scale(1.08)
  const totalY = -10; // translateY(0px) -> translateY(-10px)
  const jitterEndOffset = animMs > 0 ? Math.min(1, 150 / animMs) : 0; // 揺れは最初の約0.15秒だけ
  const jitterSteps = 4;
  const frames = [{ transform: "translate(0px, 0px) scale(1)", offset: 0 }];
  for (let i = 1; i <= jitterSteps; i++) {
    const offset = (jitterEndOffset * i) / jitterSteps;
    const baseScale = 1 + totalScale * offset;
    const baseY = totalY * offset;
    const jitterX = (Math.random() * 2 - 1) * 1.5; // 1〜2px程度のランダムな揺れ
    const jitterY = (Math.random() * 2 - 1) * 1.5;
    frames.push({ transform: `translate(${jitterX.toFixed(2)}px, ${(baseY + jitterY).toFixed(2)}px) scale(${baseScale.toFixed(4)})`, offset });
  }
  frames.push({ transform: `translate(0px, ${totalY}px) scale(${1 + totalScale})`, offset: 1 });
  return frames;
}
// 通常の「進む」(帰還は別途オート帰還システムを使うため、ここを通るのは進む方向のみ)。
// 歩行ズーム→暗転→ロジック実行→明転、の1階層分のワンショット演出
function playDungeonMoveTransition(actualLogic) {
  const animMs = MOVE_ANIM_MS;
  const fadeMs = MOVE_FADE_MS;
  const bg = document.getElementById("dungeonBgInner"); // 中央寄せを担う親(#dungeonBg)ではなく画像だけの内側レイヤーを動かす
  const overlay = document.getElementById("moveTransitionBlack");
  const advanceBtnEl = document.getElementById("advanceBtn");
  const retreatBtnEl = document.getElementById("retreatBtn");
  advanceBtnEl.disabled = true;
  retreatBtnEl.disabled = true;
  // 移動演出中はUI一式(メッセージウィンドウ/キャラ表示/HPバー/ボタン/階層表示)を薄くする
  // (背景は対象外、CSSのbody.dungeon-move-active側で不透明度のみtransitionさせる。ユーザー指示、2026-07-21)
  document.body.classList.add("dungeon-move-active");
  // 安全策: 帰還の連続ズーム(autoRetreatZoomAnim)がまだ片付けられずに残っていた場合の保険
  // (通常finishRetreat()で片付け済みのはずだが、念のためここでも歩行ズームの開始前に必ず
  // 素の状態にしておく。cancel()と直後のanimate()はどちらも同期処理で描画を挟まないため、
  // 途中経過が一瞬見えることはない)
  if (autoRetreatZoomAnim) { autoRetreatZoomAnim.cancel(); autoRetreatZoomAnim = null; }
  playSfx(footstepSfxName());
  const moveAnim = bg.animate(buildWalkKeyframes(animMs), { duration: animMs, easing: "ease-in-out", fill: "forwards" });
  let proceeded = false;
  function proceedToNext() {
    if (proceeded) return;
    proceeded = true;
    overlay.style.display = "block";
    const fadeOut = overlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fadeMs, easing: "ease", fill: "forwards" });
    fadeOut.onfinish = () => {
      fadeOut.cancel();
      overlay.style.opacity = "1";
      moveAnim.cancel();
      bg.style.transform = ""; // 暗転しきったところで背景の変形をリセット(新しい背景はactualLogic内のrenderDungeon等が反映する)
      actualLogic();
      // UIの薄さは画面が真っ黒な間(見えない状態)に解除を開始する。fadeMs(600ms)>UI側のopacity
      // transition(200ms)のため、暗転画面が明けきる頃には確実にUIが完全な不透明へ戻っている
      // (ユーザー指示: 「暗転画面があけたらもうUIの透明完全に解除しといて」)
      document.body.classList.remove("dungeon-move-active");
      const fadeIn = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fadeMs, easing: "ease", fill: "forwards" });
      fadeIn.onfinish = () => {
        fadeIn.cancel();
        overlay.style.opacity = "0";
        overlay.style.display = "none";
        advanceBtnEl.disabled = false;
        retreatBtnEl.disabled = false;
      };
    };
  }
  moveAnim.onfinish = proceedToNext;
  setTimeout(proceedToNext, animMs + 200); // 安全策: onfinishが発火しない場合でも止まらないように
}

// ============ オート帰還 ============
// 完全に停止する(ボタンを再有効化し、タイマー/フラグをリセットする)。手動タップでのキャンセル、
// 戦闘開始・茶屋・瀕死発見などの割り込み、0階層到達(finishRetreat経由)、いずれからも呼ばれる
function stopAutoRetreat() {
  autoRetreatActive = false;
  clearTimeout(autoRetreatTimer);
  autoRetreatTimer = null;
  // cancel()ではなくpause(): 停止した瞬間の拡大率のまま止めておく(cancel()だと即座にscale(1)へ
  // 巻き戻ってしまい、タップでの手動キャンセル等のたびに背景が一瞬縮んで見える不具合になる)。
  // 次にstartAutoRetreatZoomAnimation()が呼ばれた時点でこのアニメーションは改めてcancel()される
  if (autoRetreatZoomAnim) autoRetreatZoomAnim.pause();
  document.getElementById("advanceBtn").disabled = false;
  document.getElementById("retreatBtn").disabled = false;
}
// 暗転→(黒目の間にafterBlackを実行)→明転、という「区切り」の演出。財宝発見/時刻変化/茶屋/瀕死発見で使う。
// 通常のplayDungeonMoveTransitionと違い歩行ズームは伴わない(ズームは呼び出し元が別途管理しているため)
// onFullyDone: 省略可。明転まで完全に終わった後に呼ばれる(afterBlackは暗転中に呼ばれる点と区別)
function playAutoRetreatCutFade(afterBlack, onFullyDone) {
  const overlay = document.getElementById("moveTransitionBlack");
  overlay.style.display = "block";
  const fadeOut = overlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: AUTO_RETREAT_CUT_FADE_MS, easing: "ease", fill: "forwards" });
  fadeOut.onfinish = () => {
    fadeOut.cancel();
    overlay.style.opacity = "1";
    afterBlack();
    const fadeIn = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: AUTO_RETREAT_CUT_FADE_MS, easing: "ease", fill: "forwards" });
    fadeIn.onfinish = () => {
      fadeIn.cancel();
      overlay.style.opacity = "0";
      overlay.style.display = "none";
      if (onFullyDone) onFullyDone();
    };
  };
}
// 戦闘開始時用: 既にscreen-battleへ切り替わった後の画面に対し、黒→透明のフェードインだけ重ねる
// (startBattle()自体がgameroll側の都合で即座に画面遷移してしまうため、事前に止めて暗転してから
// 遷移させることができない。代わりに遷移直後の画面を一瞬黒で覆ってから明かすことで同じ「暗転して
// 戦闘になる」体感に近づけている)
function flashFromBlackOverCurrentScreen() {
  const overlay = document.getElementById("moveTransitionBlack");
  overlay.style.display = "block";
  overlay.style.opacity = "1";
  const fadeIn = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: AUTO_RETREAT_CUT_FADE_MS, easing: "ease", fill: "forwards" });
  fadeIn.onfinish = () => {
    fadeIn.cancel();
    overlay.style.opacity = "0";
    overlay.style.display = "none";
  };
}
const AUTO_RETREAT_TIMEOFDAY_FADE_MS = 900; // オート帰還中に時刻が変わった時、背景画像そのものをクロスフェードする時間
// オート帰還中に時刻が変わった時、暗転を挟まず背景画像同士をクロスフェードする。
// moveOneFloor()内のrenderDungeon()→updateSceneBackgrounds()が、この関数を呼ぶ時点で既に
// #dungeonBgInnerの背景を新しい時刻の絵へ瞬時に差し替え済みなので、まずfromEl(#dungeonBgInner)を
// 一旦「差し替わる前」の絵に戻してから、toEl(#dungeonBgInner2)を新しい絵でフェードインさせる
// (この2行は同期処理でブラウザの再描画より前に終わるため、瞬時に差し替わった瞬間が見えることはない)。
// toElにはfromElの現在のズーム倍率(WAAPIで継続中のtransform)をそのままコピーしてから重ねることで、
// クロスフェード中に拡大率がズレて見えないようにしている
// 【不具合対策】上記のtoElへのコピーは「その瞬間だけの静止画」だが、fromEl側のズーム
// (autoRetreatZoomAnim)はクロスフェード中も止めずに動き続けていたため、900ms後にクロスフェードが
// 完了してfromEl側に新しい絵が焼き込まれ直す瞬間、「静止していたtoElの拡大率」から
// 「900ms分ズームが進んだfromElの拡大率」へ一気にジャンプし、背景が一瞬カクつくように見えていた
// (900msは1階層ぶんのズーム時間(1000ms)にほぼ相当するため、ジャンプ幅が体感できるレベルだった)。
// クロスフェード中だけズームを一時停止し(stopAutoRetreat()と同じくpause()で拡大率を保ったまま
// 止める)、完了後に再開することでfromEl側の拡大率もこの間ずっと静止させ、ジャンプを無くす。
// クロスフェード中に手動タップ等でオート帰還自体が中断されていた場合はautoRetreatActiveが
// falseになっているため、誤って再開しない
function crossfadeDungeonBgForTimeOfDay(prevTimeOfDay, callback) {
  const fromEl = document.getElementById("dungeonBgInner");
  const toEl = document.getElementById("dungeonBgInner2");
  if (autoRetreatZoomAnim) autoRetreatZoomAnim.pause();
  fromEl.style.backgroundImage = `url('${currentAreaBgSet()[prevTimeOfDay]}')`;
  toEl.style.transform = getComputedStyle(fromEl).transform;
  crossfadeBg(fromEl, toEl, currentAreaBgSet()[state.timeOfDay || "day"], AUTO_RETREAT_TIMEOFDAY_FADE_MS, () => {
    if (autoRetreatZoomAnim && autoRetreatActive) autoRetreatZoomAnim.play();
    if (callback) callback();
  });
}
// 帰還開始階層〜0階層までのズームを「1本の連続したアニメーション」として管理する。
// 以前は1tick(1秒)ごとに新しいアニメーションを作り直して繋いでいたが、setTimeoutの発火が
// 数msでもずれると、前のアニメーションがfill:forwardsで止まった状態と次のアニメーションの
// 開始との間にわずかな空白ができ、「階層が下がるごとに一瞬ズームが止まる」ように見えていた。
// 開始階層〜0階層ぶんの時間(階層数×AUTO_RETREAT_TICK_MS)を一括で1本のアニメーションにし、
// ブラウザのコンポジタ側で滑らかに再生させることでtickの発火タイミングに依存しないようにした
let autoRetreatZoomAnim = null;
function startAutoRetreatZoomAnimation() {
  if (autoRetreatZoomAnim) autoRetreatZoomAnim.cancel();
  if (autoRetreatStartFloor <= 0) { autoRetreatZoomAnim = null; return; }
  const bg = document.getElementById("dungeonBgInner");
  const toScale = 1 + AUTO_RETREAT_ZOOM_PER_FLOOR * autoRetreatStartFloor;
  const totalDuration = autoRetreatStartFloor * AUTO_RETREAT_TICK_MS;
  autoRetreatZoomAnim = bg.animate([{ transform: "scale(1)" }, { transform: `scale(${toScale.toFixed(4)})` }], { duration: totalDuration, easing: "linear", fill: "forwards" });
}
function scheduleNextAutoRetreatTick() {
  if (!autoRetreatActive) return;
  autoRetreatTimer = setTimeout(runAutoRetreatTick, AUTO_RETREAT_TICK_MS);
}
// 1階層分の移動を実行し、結果(戦闘/財宝/時刻変化/何も無し)を見て次のtickを続けるか一時停止するか決める
function performAutoRetreatFloorMove(enterTeahouse) {
  const prevTimeOfDay = state.timeOfDay;
  lastFloorMoveOutcome = null;
  playSfx(footstepSfxName());
  moveOneFloor(null, enterTeahouse);
  if (!autoRetreatActive) return; // queueCriticalAlerts側等で既に停止済み
  if (!retreating) return; // 0階層に到達しfinishRetreat()済み(stopAutoRetreatもそちらで呼ばれる)
  if (battle) { // 戦闘開始。画面は既にscreen-battleへ切り替わっている
    stopAutoRetreat();
    flashFromBlackOverCurrentScreen();
    return;
  }
  if (state.timeOfDay !== prevTimeOfDay) {
    // 時刻変化は暗転を挟まず、背景画像同士をクロスフェードしてからオート帰還を継続する
    // (他の割り込みと違い停止しない)
    crossfadeDungeonBgForTimeOfDay(prevTimeOfDay, () => { if (autoRetreatActive) scheduleNextAutoRetreatTick(); });
    return;
  }
  scheduleNextAutoRetreatTick();
}
function runAutoRetreatTick() {
  if (!autoRetreatActive) return;
  if (fieldParty.every((c) => c.hp <= 0 || c.status !== "active")) { stopAutoRetreat(); return; }
  const targetFloor = currentFloor - 1;
  if (teahouseOfferedForFloor(targetFloor)) {
    playAutoRetreatCutFade(() => {
      stopAutoRetreat();
      showTeahouseOffer(
        () => moveOneFloor(null, true),
        () => moveOneFloor(null)
      );
    });
    return;
  }
  performAutoRetreatFloorMove(false);
}
function startAutoRetreat() {
  if (autoRetreatActive || !retreating) return;
  autoRetreatActive = true;
  autoRetreatStartFloor = currentFloor;
  document.getElementById("advanceBtn").disabled = true;
  document.getElementById("retreatBtn").disabled = true;
  startAutoRetreatZoomAnimation();
  runAutoRetreatTick();
}
// オート帰還中は画面のどこをタップしても即座に手動操作へ戻せる
document.getElementById("screen-dungeon").addEventListener("pointerdown", () => {
  if (autoRetreatActive) stopAutoRetreat();
});

// 「里に戻る」を押すと、確認後すぐにオート帰還が始まる(以後は0階層に着くまで無操作で進み続ける。
// 戦闘/財宝発見/茶屋/瀕死発見が起きた時と、任意のタイミングでの画面タップだけが一時停止のきっかけになる)
// 村からの手動帰還中(manualRetreatMode)は、確認モーダルを挟まずその場で村へ引き返す
// (ユーザー指示、2026-07-19: 「帰還するを押したら海の村に戻る」)
function returnToManualRetreatVillage() {
  stageEntryStack.push({ stage: currentStage, floor: currentFloor });
  retreating = false;
  const village = manualRetreatHomeVillage;
  manualRetreatMode = false;
  manualRetreatHomeVillage = null;
  currentStage = village;
  currentFloor = 1;
  saveState();
  if (village === "umimura") { renderUmiMura(); showScreen("screen-umimura"); }
  else if (village === "yamabushi") { renderYamabushi(); showScreen("screen-yamabushi"); }
}
document.getElementById("retreatBtn").onclick = () => {
  if (manualRetreatMode) {
    returnToManualRetreatVillage();
    return;
  }
  if (fieldParty.every((c) => c.hp <= 0 || c.status !== "active")) {
    showInfoModal("行動できる仲間がいません");
    return;
  }
  showConfirmModal("里に戻りますか？", [
    {
      label: "はい",
      className: "big danger",
      onClick: () => {
        // 瀕死の仲間を担いでいる(=ピンチで帰還を決めた)かどうかで別のセリフ枠を抽選する
        const alive = fieldParty.filter((c) => c.status === "active");
        const isCarrying = fieldParty.some((c) => c.carryingId);
        if (alive.length > 0) {
          if (isCarrying) { if (Math.random() < DIALOGUE_CHANCE.retreatPinch) trySpeak(alive[Math.floor(Math.random() * alive.length)], "retreatPinch"); }
          else { if (Math.random() < DIALOGUE_CHANCE.retreat) trySpeak(alive[Math.floor(Math.random() * alive.length)], "retreat"); }
        }
        retreating = true;
        dlog("引き返すことにした。ここから階層を下って里へ戻る。");
        // 確定した瞬間に一度暗転→明転を挟んでからオート帰還を始める。これが無いと、直前まで
        // 奥へ向かって拡大していた背景がそのまま帰還のズームにも引き継がれ、里に戻るはずなのに
        // 画面上はまだ奥へ進んでいるように見えてしまう(向きが変わった区切りを付けるための暗転)
        document.getElementById("advanceBtn").disabled = true;
        document.getElementById("retreatBtn").disabled = true;
        playAutoRetreatCutFade(() => {}, () => { startAutoRetreat(); });
      },
    },
    { label: "いいえ", className: "big" },
  ]);
};

function finishRetreat() {
  stopAutoRetreat(); // オート帰還中に0階層へ到達した場合のクリーンアップ(タイマー解除・ボタン再有効化)
  // 【不具合対策】帰還の連続ズーム(autoRetreatZoomAnim)はstopAutoRetreat()では意図的にpause()の
  // みで止める(手動キャンセル時に一瞬縮んで見えるのを防ぐため)。しかし帰還そのものが完了した
  // 今はもう不要なので、ここでcancel()して背景の変形を完全にリセットする。これをしないと、
  // 次の遠征開始後「進む」を押した時に、まだ残っていた古いズームと新しい歩行ズームが競合し、
  // 一瞬「引きの画像にスナップしてからズームする」という不自然な見た目になっていた
  if (autoRetreatZoomAnim) { autoRetreatZoomAnim.cancel(); autoRetreatZoomAnim = null; }
  document.getElementById("dungeonBgInner").style.transform = "";
  stopAmbientBgm();
  stopCoastAreaBgm();
  retreating = false;
  clearExpeditionSnapshot(); // 帰還完了。リロードしても次からは町スタートに戻る
  recordBossWoundIfPursuing(); // 里に戻った時点で追撃モードは終了。追撃中だったなら手負いのHPを記録する(見送った扱い)
  deliverCarriedAllies();
  fieldParty.forEach((c) => clearOnsenBuff(c)); // 遠征が終わったので温泉バフも失効させる
  clearOmikujiExpeditionEffect();
  resetPeaceDialogueState();
  dlog("里に戻った。");
  // 破綻寸前パーティ救済クエスト(薬草摘み): 薬草を持ったまま無事に里へ戻れたら達成
  if (state.rescueQuestAccepted && state.rescueQuestItemObtained) {
    state.gold += RESCUE_QUEST_DEF.rewardGold;
    advGoldEarned += RESCUE_QUEST_DEF.rewardGold; // リザルト画面の「収穫」にも反映されるよう、他の金銭報酬と同じ集計に加算する
    state.rescueQuestAccepted = false;
    state.rescueQuestItemObtained = false;
    dlog(`${RESCUE_QUEST_DEF.itemName}を無事に届けた！謝礼${RESCUE_QUEST_DEF.rewardGold}Gを受け取った。`);
  }
  toggleTimeOfDay();
  // 里に帰るたびに町の曲を続きからではなく最初から再生する。時間帯によってtown/town_dawn/town_nightの
  // どのBGMキーが実際に使われるか変わるため、3つとも記憶位置をリセットしておく
  bgmPositions.town = 0;
  bgmPositions.town_dawn = 0;
  bgmPositions.town_night = 0;
  playVictoryBanner(() => {
    renderResultScreen(() => {
      renderTown();
    });
  });
}

// 探索中、1階層進む/戻るごとに生存中の仲間のHPを少しだけ回復させる(歩きながらの自然回復)
function healPartyOnFloorMove() {
  fieldParty.forEach((c) => {
    if (c.status === "active" && c.hp > 0) c.hp = Math.min(c.maxHp, c.hp + 1);
  });
}
// 1階層分の移動処理(進む/帰還どちらも共通)。retreatBtn(里に戻る最初の一押し)からも
// advanceBtn(2回目以降の帰還)からも同じロジックで1階層動けるようにするための共通関数
function moveOneFloor(pathBias, enterTeahouse) {
  // 福禄寿の御守: 探索で「進む」(帰還中の「帰還」ボタンも含む、同じボタンのため)を押すたびに全員を少し回復
  if (hasOmamori("fukurokuju")) {
    fieldParty.forEach((c) => { if (c.status === "active") c.hp = Math.min(c.maxHp, c.hp + 2); });
  }
  if (retreating) {
    advanceFatigue(fieldParty, FATIGUE_PER_FLOOR_RETREAT); // 帰還中も1階ごとに疲労が半分だけ溜まる(ユーザー指示)
    currentFloor--;
    if (currentFloor <= 0 && stageEntryStack.length > 0) {
      // 中継ステージの出口(0階層)を抜けて、直前のステージ・階層へ戻る(洞窟→森、廃城下町→洞窟、
      // 門→廃城下町、古城→門、の各リンクで共通)。帰還自体はまだ終わっておらず、そのまま
      // 手前のステージ側のカウントダウンが続く(retreatingフラグは維持したまま)
      const leavingValley = currentStage === "valley"; // 渓流専用フィールド曲(bgmAudio)を抜ける瞬間に止めるため
      const prev = stageEntryStack.pop();
      currentStage = prev.stage;
      currentFloor = prev.floor;
      if (leavingValley) stopValleyAreaBgm();
      // 村からの手動帰還中(manualRetreatMode)は、1回popした時点で「村の直前のステージまで
      // 戻ってきた」=目的地に到着したとみなし、以後は通常の探索(自由に進む/オート帰還)に戻す
      if (manualRetreatMode) {
        manualRetreatMode = false;
        manualRetreatHomeVillage = null;
        retreating = false;
      }
    }
    saveState(); // 遠征スナップショットの階層を最新に保つ(リロード再開用)
    healPartyOnFloorMove();
    advanceExplorationClock(MINUTES_PER_FLOOR_RETREAT);
    // 【不具合対策】海の村/山伏の里は温泉村ではない「中継の村」だが、以前はここでの判定が
    // manualRetreatMode(村の画面から明示的に「歩いて引き返す」を選んだ場合)専用だったため、
    // 修験道/山/海岸など村の奥から普通に(退避モードの)「里に戻る」を押した場合はこの村を
    // 素通りし、stageEntryStackを最後までポップし続けて温泉村までノンストップで帰ってしまっていた。
    // manualRetreatModeかどうかに関わらず、ポップした先が中継の村ならここで必ず一度足を止める
    if (VILLAGE_STAGE_DISPLAY_NAME[currentStage]) {
      retreating = false;
      manualRetreatMode = false;
      manualRetreatHomeVillage = null;
      stopAutoRetreat();
      // 【不具合対策】この村の直前が海岸/渓流だった場合、それぞれの探索用フィールド曲(bgmAudio)が
      // 流れっぱなしのままだった(元々はここで足を止めずfinishRetreat()まで素通りしていたため
      // stopCoastAreaBgm()が確実に呼ばれていたが、村で足を止めるようになった今はここでも
      // 明示的に止めないと村の画面の裏で鳴り続けてしまう)
      stopAmbientBgm();
      stopCoastAreaBgm();
      stopValleyAreaBgm();
      saveState();
      dlog(`${VILLAGE_STAGE_DISPLAY_NAME[currentStage]}に戻ってきた。`);
      if (currentStage === "umimura") { renderUmiMura(); showScreen("screen-umimura"); }
      else if (currentStage === "yamabushi") { renderYamabushi(); showScreen("screen-yamabushi"); }
      return;
    }
    if (currentFloor <= 0) {
      saveState();
      finishRetreat();
      return;
    }
  } else {
    advanceFatigue(fieldParty); // 往路は1階ごとに1溜まる(帰路はFATIGUE_PER_FLOOR_RETREATで半分)
    if (pathBias === CAVE_FORK_KEY) {
      // 森の分かれ道で「洞窟」を選んだ: 森側のこの階層を覚えておき、洞窟1層目から数え直す
      stageEntryStack.push({ stage: currentStage, floor: currentFloor + 1 });
      currentStage = "cave";
      currentFloor = 1;
      pathBias = null; // CAVE_FORK_KEYは実際の道キーではないため、以降の抽選には渡さない(通常抽選と同じ扱いにする)
    } else if (pathBias === VALLEY_FORK_KEY) {
      // 森の分かれ道で「渓流」を選んだ: 森側のこの階層を覚えておき、渓流1層目から数え直す
      stageEntryStack.push({ stage: currentStage, floor: currentFloor + 1 });
      currentStage = "valley";
      currentFloor = 1;
      pathBias = null;
    } else if (pathBias === RUINSFOREST_TO_RUINS_KEY) {
      // 少し森の出口の分かれ道で「廃城下町へ」を選んだ: 少し森側のこの階層(最深部)を覚えておき、
      // 廃城下町1層目から数え直す
      stageEntryStack.push({ stage: currentStage, floor: currentFloor });
      currentStage = "ruins";
      currentFloor = 1;
      pathBias = null;
    } else if (currentFloor >= (STAGE_CHAIN_MAX[currentStage] || Infinity) && STAGE_CHAIN_NEXT[currentStage]) {
      // 中継ステージの最深部からの自動継続(洞窟→少し森→廃城下町→門、渓流→光る竹林)。選択の余地の
      // ない一本道のため、showPathChoiceは経由せず、advanceBtn.onclick側からここへ直接来る
      if (currentStage === "valley") stopValleyAreaBgm(); // 渓流専用フィールド曲を、光る竹林へ抜ける瞬間に止める
      if (currentStage === "cave") ruinsforestDestination = null; // 少し森へ入り直すたび、行き先の選択をまっさらに戻す
      stageEntryStack.push({ stage: currentStage, floor: currentFloor });
      currentStage = STAGE_CHAIN_NEXT[currentStage];
      currentFloor = 1;
    } else {
      currentFloor++;
    }
    saveState(); // 遠征スナップショットの階層を最新に保つ(リロード再開用)
    recordMaxFloorReached();
    healPartyOnFloorMove();
    advanceExplorationClock(MINUTES_PER_FLOOR_FORWARD);
    maybeSpeakOnFloorAdvance();
  }
  // ダンジョン内を歩き回っている間も時計は進んでいるので、町へ帰る/宿泊する時だけでなく
  // ここでも瀕死ロスト判定を行う(担がれている間は消化されない)
  tickCriticalExpiry(state.roster, absoluteGameMinutes());
  checkQuestDeadline(); // 受注中の依頼が期限切れになっていないか確認する
  // 破綻寸前パーティ救済クエスト(薬草摘み): 受注中に森の対象階層へ到達したら、戦闘/宝箱の抽選とは
  // 独立して確定でキーアイテムを入手する(帰り道で通り過ぎても再入手はしない)
  if (!retreating && currentStage === "forest" && state.rescueQuestAccepted && !state.rescueQuestItemObtained && currentFloor === RESCUE_QUEST_DEF.targetFloor) {
    state.rescueQuestItemObtained = true;
    dlog(`${RESCUE_QUEST_DEF.itemName}を見つけた！大切に持ち帰ろう。`);
  }
  saveState();

  const criticalHereList = state.roster.filter((c) => c.status === "critical" && c.criticalFloor === currentFloor && (c.criticalStage || "forest") === currentStage && !c.carriedBy);
  renderDungeon();
  const arrive = enterTeahouse ? enterTeahouseFromDungeon : () => resolveFloorArrival(pathBias);
  if (criticalHereList.length > 0) {
    queueCriticalAlerts(criticalHereList, arrive);
    return;
  }
  arrive();
}
// 受注中の依頼があり、かつその対象フロアに到達した場合は通常の抽選より優先して確定でその群れと戦闘になる。
// 一度そこから逃げた(chasing:true)依頼は、以後どのフロアでも(進む/帰還どちらでも)一定確率で
// 追いかけてきて再度戦闘になる(大猪で「逃げても無駄」の緊張感を作るための仕組み)
function tryForceQuestEncounter() {
  const q = state.acceptedQuest;
  if (!q || currentStage !== "forest") return false;
  const isFirstEncounter = !retreating && currentFloor === q.targetFloor;
  const isChaseEncounter = q.chasing && Math.random() < CHASE_ENCOUNTER_CHANCE;
  if (!isFirstEncounter && !isChaseEncounter) return false;
  const enemies = [];
  for (let i = 0; i < q.count; i++) enemies.push(instantiateEnemyById(q.enemyId));
  // 追跡による再戦(isChaseEncounter)の場合、前回逃げた時点のHPをそのまま引き継ぐ(markQuestChasingIfFled参照)。
  // 全回復した状態で出現し直すと「逃げても意味がない」緊張感の代わりに「毎回振り出しに戻る」不公平感になるため
  if (isChaseEncounter && q.carryHp) {
    enemies.forEach((e, i) => { if (q.carryHp[i] != null) e.hp = Math.min(q.carryHp[i], e.maxHp); });
    // 追いついた再戦は、逃げた時点で既にBOSS_FLEE_HP_RATIO以下のHPで出現し得る。何もしないと
    // renderBattleScreen()の判定でその場即座にまた自動逃走してしまう(ボス追撃モードと同じ地雷、
    // tryForceBossPursuitEncounter参照)ため、追いついた以上はこのインスタンスはもう自主逃走しない
    enemies.forEach((e) => { e.__hasFledPursuit = true; });
  }
  enemies.forEach((e) => { e.isQuestTarget = true; }); // 敵カードに🎯マークと金色パルス枠を出すための目印
  const def = QUEST_DEFS[q.questKey];
  const encounterText = isChaseEncounter && def.chaseText ? def.chaseText : null;
  startBattle(enemies, null, encounterText);
  battle.questKey = q.questKey; // victory()でこの戦闘がどの依頼の討伐対象だったと判定するための目印
  // 依頼の討伐対象を発見した特別な一言(性格ごとに10種、確実に発言させる)
  const alive = aliveField();
  if (alive.length > 0) trySpeak(alive[Math.floor(Math.random() * alive.length)], "questTargetFound");
  return true;
}
// ボス追撃モード中、フロア移動のたびに一定確率で追いつき再戦になる(討伐依頼のtryForceQuestEncounterと
// 同じ仕組み)。討伐依頼と違い出現階層の縛りは無く、bossPursuitが発生したステージと同じステージでのみ
// 有効(森で発生した追撃は森だけ、海岸へ移動していれば追いつかない)
function tryForceBossPursuitEncounter() {
  const p = bossPursuit;
  if (!p || p.stage !== currentStage) return false;
  if (Math.random() >= BOSS_PURSUIT_ENCOUNTER_CHANCE) return false;
  const enemy = instantiateEnemyById(p.enemyId);
  enemy.hp = Math.min(p.hp, enemy.maxHp); // 逃げた時点の(手負いの)HPを引き継ぐ
  // 追いついた再戦の敵は、逃げた時点で既にBOSS_FLEE_HP_RATIO以下のHPで出現する(=何もしなければ
  // renderBattleScreen()の判定でその場即座にまた逃走してしまい、プレイヤーが一度も攻撃できない
  // まま無限に「追いつく→即逃げる」を繰り返すことになる)。追いついた以上は追い詰めた扱いとし、
  // このインスタンスはもう自主逃走しない(倒すか、プレイヤー側が改めて逃げるかの二択になる)
  enemy.__hasFledPursuit = true;
  const def = ENEMIES[p.enemyId];
  startBattle([enemy], null, `${def.ja}に追いついた！`);
  battle.bossPursuitEnemyId = p.enemyId; // victory()でこの戦闘が追撃対象だったと判定するための目印
  const alive = aliveField();
  if (alive.length > 0) trySpeak(alive[Math.floor(Math.random() * alive.length)], "questTargetFound");
  return true;
}
function resolveFloorArrival(pathBias) {
  if (tryForceQuestEncounter()) return;
  if (tryForceBossPursuitEncounter()) return;
  rollEncounter(pathBias);
}
// 探索画面に、受注中の依頼の討伐対象と残り層数(or 追跡中)を常時表示するバッジ
function updateQuestTargetBadge() {
  const badge = document.getElementById("questTargetBadge");
  const q = state.acceptedQuest;
  if (!q || currentStage !== "forest") {
    badge.style.visibility = "hidden";
    return;
  }
  const enemyDef = ENEMIES[q.enemyId];
  let distanceText;
  if (q.chasing) {
    distanceText = "追跡中";
  } else {
    const diff = q.targetFloor - currentFloor;
    distanceText = diff > 0 ? `あと${diff}層` : diff === 0 ? "この階に…！" : `${Math.abs(diff)}層通り過ぎた`;
  }
  badge.style.visibility = "visible";
  badge.textContent = `🎯 ${enemyDef.ja}討伐: ${distanceText}`;
}
// 探索画面に、ボス追撃モード中だけ「追撃中！」バッジを表示する(討伐依頼のバッジと同じ枠組み)
function updateBossPursuitBadge() {
  const badge = document.getElementById("bossPursuitBadge");
  if (!bossPursuit || bossPursuit.stage !== currentStage) {
    badge.style.visibility = "hidden";
    return;
  }
  const enemyDef = ENEMIES[bossPursuit.enemyId];
  badge.style.visibility = "visible";
  badge.textContent = `🔥 追撃中！ ${enemyDef.ja}`;
}
// 茶屋(建築済みの時、深淵の森20層(TEA_HOUSE_FLOOR)に着く時だけ確定で立ち寄れる。進む/帰還どちらの方向でも
// その階へ向かう時は毎回この判定が通るため、行きと帰りに二回立ち寄ることもできる)
function teahouseOfferedForFloor(floor) {
  return currentStage === "forest" && (state.teaHouseLevel || 0) > 0 && floor === TEA_HOUSE_FLOOR;
}
// 開発者モード: 探索画面のフロア表示(◯層目)を5回連打すると、飛びたい階層を直接指定してジャンプできる。
// 町の所持金チート(townTimeLabel連打)と同じDEV_TAP_REQUIRED/DEV_TAP_WINDOW_MS(town.js)を流用し、
// 実際に指定階へ渡るのはmoveOneFloor等の歩行演出を一切通さずcurrentFloorを直接書き換えるだけ
// (茶屋のような特定階のテストを毎回歩いて確認する手間を省くための開発用機能)
let devFloorTapCount = 0;
let devFloorTapLastAt = 0;
function handleDevFloorBadgeTap() {
  const now = Date.now();
  devFloorTapCount = (now - devFloorTapLastAt <= DEV_TAP_WINDOW_MS) ? devFloorTapCount + 1 : 1;
  devFloorTapLastAt = now;
  if (devFloorTapCount >= DEV_TAP_REQUIRED) {
    devFloorTapCount = 0;
    const input = prompt(`ジャンプする階層を入力してください(現在:${currentFloor}層目)`);
    if (input === null) return;
    const target = parseInt(input, 10);
    if (!Number.isFinite(target) || target < 1) { showInfoModal("正しい階層数を入力してください"); return; }
    currentFloor = target;
    saveState(); // 遠征スナップショットの階層を最新に保つ(リロード再開用)
    retreating = false;
    recordMaxFloorReached();
    saveState();
    renderDungeon();
  }
}
document.getElementById("floorBadge").addEventListener("touchend", (e) => {
  e.preventDefault();
  handleDevFloorBadgeTap();
}, { passive: false });
document.getElementById("floorBadge").addEventListener("click", handleDevFloorBadgeTap);
document.getElementById("advanceBtn").onclick = () => {
  if (fieldParty.every((c) => c.hp <= 0 || c.status !== "active")) {
    showInfoModal("行動できる仲間がいません");
    return;
  }
  const targetFloor = retreating ? currentFloor - 1 : currentFloor + 1;
  // 村からの手動帰還中(manualRetreatMode)は、オート帰還を再開せず、普通の探索と同じく
  // 1回のボタン操作で1階層だけ進める(ユーザー指示、2026-07-19)
  if (retreating && manualRetreatMode) {
    playDungeonMoveTransition(() => moveOneFloor(null));
    return;
  }
  // 通常の帰還中(retreating)は、一時停止していたオート帰還を再開するだけ(茶屋の選択肢や割り込み処理は
  // すべてrunAutoRetreatTick/performAutoRetreatFloorMove側で扱う)
  if (retreating) {
    startAutoRetreat();
    return;
  }
  // 門の最深部(1層)は、選択の余地のない一本道の継続ではなく「古城の鍵が無いと通れない」固定の
  // 行き止まりにしてある(ユーザー指示、2026-07-19)。鍵の入手経路(幽霊船を検討中)ができるまでは
  // 古城へは実質到達できない
  if (currentStage === "gate" && targetFloor > STAGE_CHAIN_MAX.gate) {
    showInfoModal("門は固く閉ざされている…古城の鍵が無ければ通れない。引き返そう。");
    return;
  }
  // 光る竹林の最深部は、少し森のような分岐ではなく、そのまま山伏の里(村)へ自動的に到着する
  if (currentStage === "bamboo" && targetFloor > STAGE_CHAIN_MAX.bamboo) {
    playDungeonMoveTransition(() => arriveAtYamabushi());
    return;
  }
  // 瓦礫の洞窟を抜けた先の「少し森」の2層目で、「廃城下町へ」/「海の村へ」の2択に分かれる
  // (世界地図エディタのJSONで確定、2026-07-21: 最深部ではなく2層目に分岐点を前倒しし、
  // 選んだ後は残りの層を普通に歩き切った先で自動到着する形に変更)
  if (currentStage === "ruinsforest" && targetFloor === RUINSFOREST_FORK_FLOOR && !ruinsforestDestination) {
    showConfirmModal("道が分かれている。どちらへ向かう？", [
      {
        label: "廃城下町へ", className: "big primary",
        onClick: () => {
          ruinsforestDestination = "ruins";
          dlog("🏚️廃城下町へ続く道を進むことにした。");
          playDungeonMoveTransition(() => moveOneFloor(null));
        },
      },
      {
        label: "海の村へ", className: "big primary",
        onClick: () => {
          ruinsforestDestination = "umimura";
          dlog("⛵海の村へ続く道を進むことにした。");
          playDungeonMoveTransition(() => moveOneFloor(null));
        },
      },
    ], null, "scene-fork-panel");
    return;
  }
  // 少し森の最深部: 2層目で選んだ行き先へ、選択肢を出さず自動的に到着する
  if (currentStage === "ruinsforest" && targetFloor > STAGE_CHAIN_MAX.ruinsforest) {
    if (ruinsforestDestination === "umimura") {
      playDungeonMoveTransition(() => arriveAtUmiMura());
    } else {
      dlog("🏚️廃城下町へ足を踏み入れた。");
      playDungeonMoveTransition(() => moveOneFloor(RUINSFOREST_TO_RUINS_KEY));
    }
    return;
  }
  // 中継ステージ(洞窟/少し森/廃城下町/渓流/光る竹林/修験道)の最深部へ進もうとした場合は、
  // 選択肢を出さず自動的に次のステージへ切り替える(森からの分かれ道と違い、選ぶ余地のない
  // 一本道の継続のため)。古城/山(STAGE_CHAIN_NEXTに次が無い)だけは、現時点で用意している
  // 一番奥のため引き返すしかない
  const chainMax = STAGE_CHAIN_MAX[currentStage];
  if (chainMax != null && targetFloor > chainMax) {
    if (STAGE_CHAIN_NEXT[currentStage]) {
      dlog(`${STAGE_CHAIN_ENTER_LOG[currentStage]}`);
      playDungeonMoveTransition(() => moveOneFloor(null));
      return;
    }
    showInfoModal("これより奥はまだ道が見えない…引き返そう。");
    return;
  }
  const offerTeahouse = teahouseOfferedForFloor(targetFloor);
  // 受注中の依頼の対象階へ確定で到達する時は、道の分岐を選んでも結果(討伐対象との戦闘)が変わらないため
  // 選択肢自体を単一の「目標接近！」に差し替える(茶屋の階と重なる稀なケースは既存の茶屋2択を優先し、
  // このフラグは立てない)
  const q = state.acceptedQuest;
  const questApproach = !offerTeahouse && q && currentStage === "forest" && targetFloor === q.targetFloor;
  // 深淵の森10層目(CAVE_FORK_FLOOR)へ進む時だけ、洞窟への分かれ道を追加の選択肢として出す
  const offerCaveFork = !offerTeahouse && !questApproach && currentStage === "forest" && targetFloor === CAVE_FORK_FLOOR;
  // 深淵の森21層目(VALLEY_FORK_FLOOR、20層目の次)へ進む時だけ、渓流への分かれ道を追加の選択肢として出す
  const offerValleyFork = !offerTeahouse && !questApproach && currentStage === "forest" && targetFloor === VALLEY_FORK_FLOOR;
  showPathChoice((pathBias) => {
    if (pathBias === TEAHOUSE_PATH_KEY) {
      playDungeonMoveTransition(() => moveOneFloor(null, true));
      return;
    }
    if (pathBias === QUEST_APPROACH_KEY) {
      playDungeonMoveTransition(() => moveOneFloor(null));
      return;
    }
    if (pathBias === CAVE_FORK_KEY) {
      dlog("🕳️洞窟へ足を踏み入れた。");
      playDungeonMoveTransition(() => moveOneFloor(CAVE_FORK_KEY));
      return;
    }
    if (pathBias === VALLEY_FORK_KEY) {
      dlog("🎋渓流へ足を踏み入れた。");
      playDungeonMoveTransition(() => moveOneFloor(VALLEY_FORK_KEY));
      return;
    }
    const chosen = currentPathDefs()[pathBias];
    if (chosen) dlog(`${chosen.icon}${chosen.label}を選んだ。`);
    playDungeonMoveTransition(() => moveOneFloor(pathBias));
  }, offerTeahouse, questApproach, offerCaveFork, offerValleyFork);
};

// スレイ・ザ・スパイア風の「進む前に道を選ぶ」システム。選んだ道ごとに戦闘/財宝/静寂の出現率を
// 傾ける(battle/gold値、残りが静寂)。フロア構成自体を分岐させる本格的なマップ化ではなく、
// 既存の抽選ロジックに「狙った方向へ振れる」選択肢を挟むだけの軽量版。
// 各道のbattle/gold率、ambushChance(暗い道の奇襲)、goldMult(暗い道の獲得金増)は
// キーごとに1本化し、出現の重み(NORMAL_PATH_WEIGHTS/ONE_CHOICE_PATH_WEIGHTS)とは分離してある
const PATH_DEFS = {
  rindou: { icon: "🌲", label: "林道", battle: 0.35, gold: 0.20 }, // 戦闘だるさ軽減の全体調整で60%→35%(2026-07-18、階層1.5倍化とセット)
  kemono: { icon: "🐾", label: "獣道", battle: 0.60, gold: 0.15 },
  kurai: { icon: "🌑", label: "暗い道", battle: 0.70, gold: 0.10, ambushChance: 0.5, goldMult: 1.5 },
  shizuka: { icon: "🍃", label: "静かな道", battle: 0.10, gold: 0.25 },
  komorebi: { icon: "🌿", label: "木漏れ日の道", battle: 0.15, gold: 0.30 },
  hikaru: { icon: "💰", label: "何かが光る道", battle: 0.10, gold: 0.90 },
  fuon: { icon: "👁️", label: "不穏な道", battle: 1.00, gold: 0.00 },
  kamikakushi: { icon: "✨", label: "神隠しの道", battle: 0.00, gold: 0.00 },
};
// 海岸ステージ版の進路(キーは共通、アイコン/ラベルだけ海のテーマに差し替え。battle/gold等の数値は森と完全に同じ)
const COAST_PATH_DEFS = {
  rindou: { icon: "🏝️", label: "砂浜", battle: 0.35, gold: 0.20 }, // 林道と同値に(2026-07-18の全体調整)
  kemono: { icon: "🪨", label: "岩場", battle: 0.60, gold: 0.15 },
  kurai: { icon: "🌊", label: "波打ち際", battle: 0.70, gold: 0.10, ambushChance: 0.5, goldMult: 1.5 },
  shizuka: { icon: "🐚", label: "静かな砂浜", battle: 0.10, gold: 0.25 },
  komorebi: { icon: "🐟", label: "潮溜まり", battle: 0.15, gold: 0.30 },
  hikaru: { icon: "💰", label: "何かが光る道", battle: 0.10, gold: 0.90 },
  fuon: { icon: "👁️", label: "不穏な砂浜", battle: 1.00, gold: 0.00 },
  kamikakushi: { icon: "✨", label: "幻の島", battle: 0.00, gold: 0.00 },
};
// 洞窟ステージ版の進路(キーは共通、アイコン/ラベルだけ洞窟のテーマに差し替え。battle/gold等の数値は森と完全に同じ)
const CAVE_PATH_DEFS = {
  rindou: { icon: "🕳️", label: "広い坑道", battle: 0.35, gold: 0.20 },
  kemono: { icon: "🪨", label: "岩肌の道", battle: 0.60, gold: 0.15 },
  kurai: { icon: "🌑", label: "闇だまり", battle: 0.70, gold: 0.10, ambushChance: 0.5, goldMult: 1.5 },
  shizuka: { icon: "💧", label: "水音のする道", battle: 0.10, gold: 0.25 },
  komorebi: { icon: "🍄", label: "光る苔の道", battle: 0.15, gold: 0.30 },
  hikaru: { icon: "💰", label: "何かが光る道", battle: 0.10, gold: 0.90 },
  fuon: { icon: "👁️", label: "獣の唸る道", battle: 1.00, gold: 0.00 },
  kamikakushi: { icon: "✨", label: "涸れた縦穴", battle: 0.00, gold: 0.00 },
};
// 廃城下町/門/古城(2026-07-19、下地の歩行テスト用)。敵データがまだ無いため、暫定的に全てbattle:0
// にしてある(戦闘が発生してもpickEncounterForFloorが空を返し安全に素通りする作りにはなっているが、
// このステージ群は敵実装前提のため念のため道の抽選側でも確定で0にしている)。敵データが揃ったら
// 森・洞窟と同じ配分のbattle値に戻す想定
const RUINS_PATH_DEFS = {
  rindou: { icon: "🏘️", label: "表通り", battle: 0, gold: 0.20 },
  kemono: { icon: "🚪", label: "路地裏", battle: 0, gold: 0.15 },
  kurai: { icon: "🏚️", label: "崩れた屋敷", battle: 0, gold: 0.10 },
  shizuka: { icon: "🍂", label: "静かな中庭", battle: 0, gold: 0.25 },
  komorebi: { icon: "🌿", label: "苔むした石段", battle: 0, gold: 0.30 },
  hikaru: { icon: "💰", label: "何かが光る蔵", battle: 0, gold: 0.90 },
  fuon: { icon: "👁️", label: "不穏な路地", battle: 0, gold: 0.00 },
  kamikakushi: { icon: "✨", label: "消えた辻", battle: 0, gold: 0.00 },
};
const GATE_PATH_DEFS = {
  rindou: { icon: "⛩️", label: "正門前", battle: 0, gold: 0.20 },
  kemono: { icon: "🚪", label: "脇道", battle: 0, gold: 0.15 },
  kurai: { icon: "🔒", label: "閉ざされた小門", battle: 0, gold: 0.10 },
  shizuka: { icon: "🍂", label: "静かな門前", battle: 0, gold: 0.25 },
  komorebi: { icon: "🌿", label: "苔むした門柱", battle: 0, gold: 0.30 },
  hikaru: { icon: "💰", label: "何かが光る門番所", battle: 0, gold: 0.90 },
  fuon: { icon: "👁️", label: "不穏な門", battle: 0, gold: 0.00 },
  kamikakushi: { icon: "✨", label: "消えた門", battle: 0, gold: 0.00 },
};
const CASTLE_PATH_DEFS = {
  rindou: { icon: "🏯", label: "大広間", battle: 0, gold: 0.20 },
  kemono: { icon: "🚪", label: "廊下", battle: 0, gold: 0.15 },
  kurai: { icon: "🌑", label: "暗い座敷", battle: 0, gold: 0.10 },
  shizuka: { icon: "🍂", label: "静かな庭", battle: 0, gold: 0.25 },
  komorebi: { icon: "🌿", label: "障子の間", battle: 0, gold: 0.30 },
  hikaru: { icon: "💰", label: "何かが光る宝物庫", battle: 0, gold: 0.90 },
  fuon: { icon: "👁️", label: "不穏な部屋", battle: 0, gold: 0.00 },
  kamikakushi: { icon: "✨", label: "消えた回廊", battle: 0, gold: 0.00 },
};
const VALLEY_PATH_DEFS = {
  rindou: { icon: "🏞️", label: "広い川辺", battle: 0, gold: 0.20 },
  kemono: { icon: "🪨", label: "岩伝いの道", battle: 0, gold: 0.15 },
  kurai: { icon: "🌊", label: "深い淵", battle: 0, gold: 0.10 },
  shizuka: { icon: "💧", label: "静かな瀬", battle: 0, gold: 0.25 },
  komorebi: { icon: "🌿", label: "苔むした岩場", battle: 0, gold: 0.30 },
  hikaru: { icon: "💰", label: "何かが光る淵", battle: 0, gold: 0.90 },
  fuon: { icon: "👁️", label: "不穏な水音", battle: 0, gold: 0.00 },
  kamikakushi: { icon: "✨", label: "消えた瀬", battle: 0, gold: 0.00 },
};
const BAMBOO_PATH_DEFS = {
  rindou: { icon: "🎋", label: "広い竹の道", battle: 0, gold: 0.20 },
  kemono: { icon: "🌱", label: "細い竹林の道", battle: 0, gold: 0.15 },
  kurai: { icon: "🌑", label: "光の届かぬ茂み", battle: 0, gold: 0.10 },
  shizuka: { icon: "🍃", label: "静まり返った竹林", battle: 0, gold: 0.25 },
  komorebi: { icon: "✨", label: "淡く光る竹の道", battle: 0, gold: 0.30 },
  hikaru: { icon: "💰", label: "何かが光る竹林", battle: 0, gold: 0.90 },
  fuon: { icon: "👁️", label: "不穏な竹のざわめき", battle: 0, gold: 0.00 },
  kamikakushi: { icon: "✨", label: "消えた竹の道", battle: 0, gold: 0.00 },
};
const SHUGENDO_PATH_DEFS = {
  rindou: { icon: "⛩️", label: "広い参道", battle: 0, gold: 0.20 },
  kemono: { icon: "🪨", label: "岩場の細道", battle: 0, gold: 0.15 },
  kurai: { icon: "🌑", label: "崖沿いの難路", battle: 0, gold: 0.10 },
  shizuka: { icon: "💧", label: "滝の見える小道", battle: 0, gold: 0.25 },
  komorebi: { icon: "🌿", label: "苔むした石段", battle: 0, gold: 0.30 },
  hikaru: { icon: "💰", label: "何かが光る祠", battle: 0, gold: 0.90 },
  fuon: { icon: "👁️", label: "不穏な行者道", battle: 0, gold: 0.00 },
  kamikakushi: { icon: "✨", label: "消えた参道", battle: 0, gold: 0.00 },
};
const YAMA_PATH_DEFS = {
  rindou: { icon: "⛰️", label: "広い尾根道", battle: 0, gold: 0.20 },
  kemono: { icon: "🐾", label: "獣道", battle: 0, gold: 0.15 },
  kurai: { icon: "🌑", label: "険しい崖道", battle: 0, gold: 0.10 },
  shizuka: { icon: "🍃", label: "静かな稜線", battle: 0, gold: 0.25 },
  komorebi: { icon: "🌲", label: "巨木の並ぶ道", battle: 0, gold: 0.30 },
  hikaru: { icon: "💰", label: "何かが光る岩陰", battle: 0, gold: 0.90 },
  fuon: { icon: "👁️", label: "不穏な山道", battle: 0, gold: 0.00 },
  kamikakushi: { icon: "✨", label: "消えた尾根道", battle: 0, gold: 0.00 },
};
function currentPathDefs() {
  return currentStage === "coast" ? COAST_PATH_DEFS : currentStage === "cave" ? CAVE_PATH_DEFS
    : currentStage === "ruins" ? RUINS_PATH_DEFS : currentStage === "gate" ? GATE_PATH_DEFS
    : currentStage === "castle" ? CASTLE_PATH_DEFS : currentStage === "valley" ? VALLEY_PATH_DEFS
    : currentStage === "bamboo" ? BAMBOO_PATH_DEFS : currentStage === "shugendo" ? SHUGENDO_PATH_DEFS
    : currentStage === "yama" ? YAMA_PATH_DEFS : PATH_DEFS;
}
// 進路選択カードの短い情景描写(演出用の雰囲気テキストのみ。battle/gold等の数値には一切影響しない)
const PATH_FLAVOR = {
  rindou: "木々に囲まれた広い道", kemono: "草木が生い茂っている", kurai: "危険な気配が漂う",
  shizuka: "静かな竹林が続く", komorebi: "木漏れ日が差し込む小道", hikaru: "何かが遠くで光っている",
  fuon: "得体の知れない気配がする", kamikakushi: "空気が違う…",
};
const CAVE_PATH_FLAVOR = {
  rindou: "岩肌に囲まれた広い通路", kemono: "ゴツゴツした岩場が続く", kurai: "危険な気配が漂う",
  shizuka: "かすかな水音が響いてくる", komorebi: "淡く光る苔に包まれた道", hikaru: "何かが暗闇で光っている",
  fuon: "獣の唸り声が聞こえる", kamikakushi: "空気が違う…",
};
const COAST_PATH_FLAVOR = {
  rindou: "波の音が心地よい浜辺", kemono: "足場の悪い岩場が続く", kurai: "危険な気配が漂う",
  shizuka: "静かな砂浜が広がる", komorebi: "小さな生き物がいる潮溜まり", hikaru: "何かが波間で光っている",
  fuon: "得体の知れない気配がする", kamikakushi: "見えるはずのない島影…",
};
const RUINS_PATH_FLAVOR = {
  rindou: "朽ちた家々が立ち並ぶ通り", kemono: "荒れ果てた路地裏", kurai: "今にも崩れ落ちそうな屋敷",
  shizuka: "雑草に埋もれた静かな中庭", komorebi: "苔むした石段が続く", hikaru: "蔵の奥で何かが光っている",
  fuon: "得体の知れない気配がする", kamikakushi: "空気が違う…",
};
const GATE_PATH_FLAVOR = {
  rindou: "巨大な門がそびえ立つ", kemono: "門の脇に伸びる細道", kurai: "固く閉ざされた小さな門",
  shizuka: "静まり返った門前", komorebi: "苔むした門柱が並ぶ", hikaru: "門番所の奥で何かが光っている",
  fuon: "得体の知れない気配がする", kamikakushi: "空気が違う…",
};
const CASTLE_PATH_FLAVOR = {
  rindou: "荒れ果てた大広間", kemono: "薄暗い廊下が続く", kurai: "灯りの消えた座敷",
  shizuka: "静まり返った庭園", komorebi: "破れた障子の間", hikaru: "宝物庫の奥で何かが光っている",
  fuon: "得体の知れない気配がする", kamikakushi: "空気が違う…",
};
const VALLEY_PATH_FLAVOR = {
  rindou: "清らかな流れが続く広い川辺", kemono: "岩を伝って進む道", kurai: "底の見えない深い淵",
  shizuka: "水音だけが響く静かな瀬", komorebi: "苔むした岩場が続く", hikaru: "淵の底で何かが光っている",
  fuon: "得体の知れない気配がする", kamikakushi: "空気が違う…",
};
const BAMBOO_PATH_FLAVOR = {
  rindou: "青々とした竹に囲まれた広い道", kemono: "竹の間を縫う細い道", kurai: "光の届かない深い茂み",
  shizuka: "物音一つしない静かな竹林", komorebi: "竹の節目が淡く光っている", hikaru: "竹林の奥で何かが光っている",
  fuon: "得体の知れない気配がする", kamikakushi: "空気が違う…",
};
const SHUGENDO_PATH_FLAVOR = {
  rindou: "石畳が続く広い参道", kemono: "岩場に沿った細い道", kurai: "崖沿いの危うい難路",
  shizuka: "滝の音だけが響く小道", komorebi: "苔むした石段が続く", hikaru: "祠の奥で何かが光っている",
  fuon: "得体の知れない気配がする", kamikakushi: "空気が違う…",
};
const YAMA_PATH_FLAVOR = {
  rindou: "見晴らしの良い尾根道", kemono: "獣の踏み跡が続く", kurai: "切り立った険しい崖道",
  shizuka: "風だけが吹き抜ける稜線", komorebi: "巨木が立ち並ぶ道", hikaru: "岩陰で何かが光っている",
  fuon: "得体の知れない気配がする", kamikakushi: "空気が違う…",
};
function currentPathFlavor() {
  return currentStage === "coast" ? COAST_PATH_FLAVOR : currentStage === "cave" ? CAVE_PATH_FLAVOR
    : currentStage === "ruins" ? RUINS_PATH_FLAVOR : currentStage === "gate" ? GATE_PATH_FLAVOR
    : currentStage === "castle" ? CASTLE_PATH_FLAVOR : currentStage === "valley" ? VALLEY_PATH_FLAVOR
    : currentStage === "bamboo" ? BAMBOO_PATH_FLAVOR : currentStage === "shugendo" ? SHUGENDO_PATH_FLAVOR
    : currentStage === "yama" ? YAMA_PATH_FLAVOR : PATH_FLAVOR;
}
// 2択/3択で使う通常プールの出現の重み(重複ありの抽選=同じ道が2つとも出ることもある)
const NORMAL_PATH_WEIGHTS = {
  rindou: 45, kemono: 30, kurai: 7.6, shizuka: 3.52,
  komorebi: 3.2, hikaru: 3.2, fuon: 2, kamikakushi: 0.48, // ユーザー指示で神隠しの道の重みを2倍(0.24→0.48)
};
// 洞窟の1択の時だけ使う重み。森・海岸と違い「不穏な道」を底上げする演出はせず、NORMAL_PATH_WEIGHTSと
// 同じ配分をそのまま使う(ユーザー指示: 洞窟では不穏な道のブーストなし)
const CAVE_ONE_CHOICE_PATH_WEIGHTS = NORMAL_PATH_WEIGHTS;
// 1択専用プール: 静かな道を除外し、不穏な道の重みを引き上げて「避けて通れない恐怖」を演出
// (不穏な道がこのプール内でちょうど15%のシェアになるよう他の重みから逆算した値)
const ONE_CHOICE_PATH_WEIGHTS = {
  rindou: 45, kemono: 30, kurai: 7.6,
  komorebi: 3.2, hikaru: 3.2, kamikakushi: 0.48, fuon: 15.75, // 神隠しの道の重みを2倍(0.24→0.48)
};
// 1〜2択の出現割合(1択15%/2択85%)。ユーザー指示で3択を廃止し、3択が占めていた15%分は
// そのまま2択側に回した(旧: 1択15%/2択70%/3択15%)。1択の時だけONE_CHOICE_PATH_WEIGHTSを使う。
// 洞窟だけは圧迫感を出すため逆転させ、1択80%/2択20%にする(ユーザー指示、2026-07-19)
function pickPathChoiceCount() {
  const r = Math.random();
  if (currentStage === "cave") return r < 0.8 ? 1 : 2;
  return r < 0.15 ? 1 : 2;
}
// おみくじの効果を進路の重みに反映する。中吉なら不穏な道を候補から除外し、
// 吉なら神隠しの道の重みを大きく引き上げる。それ以外はそのまま(元のオブジェクトは書き換えない)
const OMIKUJI_KAMIKAKUSHI_BOOST_WEIGHT = 8;
function omikujiAdjustedWeights(baseWeights) {
  if (state.omikujiEffect === "chukichi" && baseWeights.fuon !== undefined) {
    const w = Object.assign({}, baseWeights);
    delete w.fuon;
    return w;
  }
  if (state.omikujiEffect === "kichi" && baseWeights.kamikakushi !== undefined) {
    const w = Object.assign({}, baseWeights);
    w.kamikakushi = OMIKUJI_KAMIKAKUSHI_BOOST_WEIGHT;
    return w;
  }
  return baseWeights;
}
// 重み付き抽選(重複あり)で1つキーを選ぶ
function weightedPickPathKey(weights) {
  const keys = Object.keys(weights);
  const total = keys.reduce((s, k) => s + weights[k], 0);
  const r = Math.random() * total;
  let acc = 0;
  for (const k of keys) { acc += weights[k]; if (r < acc) return k; }
  return keys[keys.length - 1];
}
// 進む→進路選択が出たら、その場のキャンセル(戻る)は無くし、選ぶまで後戻りできない設計にしてある。
// 唯一の代替行動として「道具」(野営具/温泉卵)だけをこのパネル内で完結させて使えるようにする。
// 温泉卵を使った場合は再抽選せず同じ選択肢に戻し(picked配列を使い回す)、野営具を使った場合は
// そのまま野営へ抜ける(=道が選ばれなかったことになるが、キャンセルではなく別行動を選んだ扱い)
const TEAHOUSE_PATH_KEY = "__teahouse__"; // 通常の進路キーとは別枠の特別な選択肢(茶屋)を表す番人値
const QUEST_APPROACH_KEY = "__quest_approach__"; // 討伐対象の階に確定で到達する時専用の番人値(道の選択自体が無意味になるため単一選択肢にする)
const CAVE_FORK_KEY = "__cave_fork__"; // 深淵の森の分かれ道で「洞窟」を選んだ時専用の番人値
const CAVE_FORK_FLOOR = 10; // 深淵の森でこの階に進む時、洞窟への分かれ道を追加の選択肢として提示する
// 森→渓流の分かれ道(2026-07-19、ユーザー指示で20層目の次(21層目)に変更)。洞窟の分かれ道
// (10層目)とは異なる階にしてあるため、特別枠が2つ重なって3択になる(ユーザー指示で3択は廃止済み)
// 心配はない
const VALLEY_FORK_KEY = "__valley_fork__"; // 深淵の森の分かれ道で「渓流」を選んだ時専用の番人値
const VALLEY_FORK_FLOOR = 21; // 深淵の森でこの階に進む時、渓流への分かれ道を追加の選択肢として提示する
// 洞窟の最深部(2〜7層=浅い層、8〜15層=深い層、と敵データを15層までしか用意していないため、
// それより奥はまだ用意がなく進めない。この先(沼/城下町など)は未定なので、15層で足止めする
const CAVE_MAX_FLOOR = 15;
// 少し森の出口の分かれ道で「廃城下町へ」を選んだ時専用の番人値(手描き地図の指示、2026-07-19:
// 瓦礫の洞窟→少し森(3層)→ここで廃城下町/海の村に分岐、という形に変更。廃城下町自体は
// 内部で分岐しない一本道になり、最深部で門(古城方向)へ自動的に突き当たる)
const RUINSFOREST_TO_RUINS_KEY = "__ruinsforest_to_ruins__";
// 少し森の2層目で「廃城下町へ/海の村へ」を選ばせ、残りの層を歩き切った先で選んだ方に自動到着する
// 方式に変更(ユーザー指示、2026-07-21: 世界地図エディタのJSONで「2層目で分岐」に確定)。
// ここで選んだ行き先を覚えておく番人値。cave→ruinsforestへ切り替わるたび・新しい遠征の開始時にnullへ戻す
let ruinsforestDestination = null; // null | "ruins" | "umimura"
const RUINSFOREST_FORK_FLOOR = 2;
// 洞窟→少し森→(分岐)→廃城下町→門、渓流→光る竹林の中継チェーン(2026-07-19)。各ステージの
// 最深部に到達すると、選択の余地なく自動的に次のステージへ切り替わる(森からの分かれ道のような
// player choice ではない)。階層数は敵データがまだ揃っていない段階の仮決め(下地の歩行テスト用)。
// 古城/門/山はSTAGE_CHAIN_NEXTに次を持たないため、現時点で用意している一番奥として足止めされる
const RUINS_MAX_FLOOR = 12; // 廃城下町(仮)
const GATE_MAX_FLOOR = 1; // 門(仮。古城の鍵が無いと通れない固定の行き止まり)
const CASTLE_MAX_FLOOR = 10; // 古城(仮。鍵の入手経路ができるまでは実質未到達)
const RUINSFOREST_MAX_FLOOR = 4; // 瓦礫の洞窟を抜けた先の「少し森」(4層。2層目で廃城下町/海の村に分岐し、残りを歩き切った先で自動到着)
const VALLEY_MAX_FLOOR = 10; // 渓流(仮)
const BAMBOO_MAX_FLOOR = 10; // 光る竹林(仮。最深部で山伏の里(村)へ自動到着する)
const SHUGENDO_MAX_FLOOR = 10; // 修験道(仮)
const YAMA_MAX_FLOOR = 20; // 山(仮。長めのエリア想定のため他より多め。前半/後半で背景を切り替える(yamaBgSetForCurrentState参照))
const YAMA_STAGE2_FLOOR = 11; // この階から山ステージ2の背景に切り替わる
// 海岸(2026-07-19、ユーザー指示で既存の海岸ステージを15層に縮めて海の村からの出発先として使う)
const COAST_MAX_FLOOR = 15;
const STAGE_CHAIN_NEXT = { cave: "ruinsforest", ruins: "gate", valley: "bamboo", shugendo: "yama" };
const STAGE_CHAIN_MAX = { cave: CAVE_MAX_FLOOR, ruins: RUINS_MAX_FLOOR, gate: GATE_MAX_FLOOR, castle: CASTLE_MAX_FLOOR, ruinsforest: RUINSFOREST_MAX_FLOOR, valley: VALLEY_MAX_FLOOR, bamboo: BAMBOO_MAX_FLOOR, shugendo: SHUGENDO_MAX_FLOOR, yama: YAMA_MAX_FLOOR, coast: COAST_MAX_FLOOR };
const STAGE_CHAIN_ENTER_LOG = { cave: "🌲森が少しだけ戻ってきた。", ruins: "🚪古城へ続く門にたどり着いた。", valley: "🎋光る竹林へ足を踏み入れた。", shugendo: "⛰️山へ足を踏み入れた。" };
const KAMIKAKUSHI_REVEAL_MS = 900; // 神隠しの道の「顕現」演出の長さ。この間は誤タップ防止のため選べない
function showPathChoice(onChosen, offerTeahouse, questApproach, offerCaveFork, offerValleyFork) {
  const div = document.getElementById("criticalAlert");
  // このポップアップの下に隠れているはずの探索ログが透けて見えてしまうため、表示中は非表示にする(showCriticalAlertと同じ対処)
  document.getElementById("dungeonLog").style.display = "none";
  let picked;
  if (questApproach) {
    // 受注中の依頼の対象階へ進む時は、道の分岐(battle/gold率の傾き)がどれを選んでも確定でその群れと
    // 戦闘になり選択が無意味になるため、通常の抽選は行わず「目標接近！」の単一選択肢だけを出す
    picked = [QUEST_APPROACH_KEY];
  } else {
    let count = pickPathChoiceCount();
    // 洞窟/渓流への分かれ道は、通常の道を選ぶという選択肢自体を必ず残す必要がある
    // (でないと分かれ道一択を強制されてしまう)。pickPathChoiceCountが1択を返した場合はここで2択に底上げする
    if ((offerCaveFork || offerValleyFork) && count < 2) count = 2;
    const oneChoiceWeights = currentStage === "cave" ? CAVE_ONE_CHOICE_PATH_WEIGHTS : ONE_CHOICE_PATH_WEIGHTS;
    const weights = omikujiAdjustedWeights(count === 1 ? oneChoiceWeights : NORMAL_PATH_WEIGHTS);
    picked = [];
    // 茶屋/洞窟/渓流への分かれ道は通常の抽選プールとは別枠で確定で1枠に加えるが、他の階と
    // 同じ1〜3択の分布(pickPathChoiceCount)からはみ出させない(以前は常に+1して2〜4択になり、
    // 実質「必ず3択」に偏って見えていた)。その分を差し引いた残りの枠数だけ通常の道を抽選し、
    // 特別枠は常に先頭に来るようunshiftする
    const extraSlots = (offerTeahouse ? 1 : 0) + (offerCaveFork ? 1 : 0) + (offerValleyFork ? 1 : 0);
    const normalPickCount = Math.max(0, count - extraSlots);
    for (let i = 0; i < normalPickCount; i++) picked.push(weightedPickPathKey(weights));
    // 洞窟の選択肢だけはカードの右側(配列の末尾、グリッドの最後の列)に出るようにする(ユーザー指示、2026-07-21)
    if (offerCaveFork) picked.push(CAVE_FORK_KEY);
    if (offerValleyFork) picked.unshift(VALLEY_FORK_KEY);
    if (offerTeahouse) picked.unshift(TEAHOUSE_PATH_KEY);
  }
  document.body.classList.add("path-choice-active");
  // 進路選択が出ている間は下部の行動ボタン(進む/里に戻る/回復薬/道具等)を完全に無効化し、
  // 選択肢のカードか、このパネル内の道具ボタン以外から抜けられないようにする
  DUNGEON_BOTTOM_BTN_IDS.forEach((id) => { document.getElementById(id).disabled = true; });

  function closePathChoice() {
    document.body.classList.remove("path-choice-active");
    div.innerHTML = "";
    document.getElementById("dungeonLog").style.display = "";
    // ボタンの有効/無効はこの後必ず呼ばれるrenderDungeon()(moveOneFloor経由、または野営から戻った時)側で
    // 所持品状況に応じて正しく再設定されるため、ここでは一律のdisabled解除はしない
  }

  // 進路選択中は道具(回復薬/野営具/温泉卵)を使えない(テンポを落とさず「どちらへ進むか」だけに
  // 集中させる意図的な仕様。道具自体は探索画面下部の既存「道具」ボタンから引き続き使用可能)
  function renderCards() {
    const flavor = currentPathFlavor();
    div.innerHTML = `
      <div class="path-choice-panel path-tags-panel${picked.length === 3 ? " path-tags-triple" : ""}${picked.length === 1 ? " path-tags-single" : ""}">
        <p class="path-choice-title">${questApproach ? "🎯 目標接近！" : "進路選択"}</p>
        <div class="path-choice-cards path-tags-stack${picked.length === 3 ? " path-tags-triple" : ""}${picked.length === 1 ? " path-tags-single" : ""}">
          ${picked.map((key, idx) => {
            const isTeahouse = key === TEAHOUSE_PATH_KEY;
            const isQuestApproach = key === QUEST_APPROACH_KEY;
            const isCaveFork = key === CAVE_FORK_KEY;
            const isValleyFork = key === VALLEY_FORK_KEY;
            const isKamikakushi = key === "kamikakushi";
            const isHikaru = key === "hikaru";
            const p = isTeahouse ? { icon: "🍡", label: "茶屋" } : isQuestApproach ? { icon: "🎯", label: "接近する" } : isCaveFork ? { icon: "🕳️", label: "洞窟" } : isValleyFork ? { icon: "🎋", label: "渓流" } : currentPathDefs()[key];
            const desc = isTeahouse ? "一休みできる茶屋が見える" : isQuestApproach ? "獲物の気配が急速に近づいてくる…" : isCaveFork ? "岩肌に空いた洞窟の入り口が見える" : isValleyFork ? "水音のする細い道が分かれている" : (flavor[key] || "");
            let extraClass = "";
            if (isTeahouse) extraClass = " path-tag-teahouse";
            else if (isCaveFork) extraClass = " path-tag-cave";
            else if (isValleyFork) extraClass = " path-tag-cave";
            else if (isKamikakushi) extraClass = " path-tag-kamikakushi path-tag-revealing";
            else if (isHikaru) extraClass = " path-tag-hikaru";
            let sparkles = "";
            if (isTeahouse) sparkles = '<span class="path-tag-sparkle s1">✨</span><span class="path-tag-sparkle s2">✨</span><span class="path-tag-sparkle s3">✨</span>';
            else if (isKamikakushi) sparkles = '<span class="path-tag-sparkle s1">✨</span><span class="path-tag-sparkle s2">✨</span><span class="path-tag-sparkle s3">✨</span><span class="path-tag-sparkle s4">✨</span>';
            else if (isHikaru) sparkles = '<span class="path-tag-sparkle s1">✨</span><span class="path-tag-sparkle s2">✨</span><span class="path-tag-sparkle s3">✨</span>';
            return `
              ${idx > 0 ? '<span class="path-tag-rope" aria-hidden="true"></span>' : ""}
              <button class="path-card path-tag${extraClass}" data-idx="${idx}" style="--i:${idx}">
                ${sparkles}
                <span class="path-card-icon">${p.icon}</span>
                <span class="path-tag-text">
                  <span class="path-card-label">${p.label}</span>
                  <span class="path-card-desc">${desc}</span>
                </span>
              </button>
            `;
          }).join("")}
        </div>
      </div>
    `;
    const stack = div.querySelector(".path-tags-stack");
    picked.forEach((key, idx) => {
      const btn = div.querySelector(`button[data-idx="${idx}"]`);
      const isKamikakushi = key === "kamikakushi";
      // 神隠しの道は「顕現」演出(光の帯が横切る)が終わるまで誤タップ防止のため選べないようにする。
      // ネイティブのdisabled属性は使わない(ブラウザ既定の減光スタイルが演出の見た目を邪魔するため)。
      // 代わりにクラスの有無だけで判定し、演出用CSSアニメーションと選択可否を同期させる
      if (isKamikakushi) {
        setTimeout(() => { btn.classList.remove("path-tag-revealing"); }, KAMIKAKUSHI_REVEAL_MS);
      }
      btn.onclick = () => {
        if (stack.classList.contains("path-tags-locked")) return;
        if (isKamikakushi && btn.classList.contains("path-tag-revealing")) return;
        stack.classList.add("path-tags-locked");
        stack.querySelectorAll(".path-tag").forEach((el) => {
          el.classList.add(el === btn ? "path-tag-selected" : "path-tag-fading");
        });
        setTimeout(() => {
          closePathChoice();
          onChosen(key);
        }, 170);
      };
    });
  }

  renderCards();
}

// 帰還中に茶屋の階へ差し掛かった時専用の2択(茶屋に立ち寄る/素通りする)。帰還中は通常の進路選択
// (道の分岐)自体を出さない仕様のため、showPathChoiceの重み付き抽選プールは使わず固定2択にしてある
function showTeahouseOffer(onEnter, onSkip) {
  const div = document.getElementById("criticalAlert");
  document.getElementById("dungeonLog").style.display = "none";
  document.body.classList.add("path-choice-active");
  DUNGEON_BOTTOM_BTN_IDS.forEach((id) => { document.getElementById(id).disabled = true; });
  function close() {
    document.body.classList.remove("path-choice-active");
    div.innerHTML = "";
    document.getElementById("dungeonLog").style.display = "";
  }
  div.innerHTML = `
    <div class="path-choice-panel path-tags-panel">
      <p class="path-choice-title">帰り道</p>
      <div class="path-choice-cards path-tags-stack">
        <button class="path-card path-tag" data-idx="0" style="--i:0">
          <span class="path-card-icon">🍡</span>
          <span class="path-tag-text">
            <span class="path-card-label">茶屋</span>
            <span class="path-card-desc">一休みできる茶屋が見える</span>
          </span>
        </button>
        <span class="path-tag-rope" aria-hidden="true"></span>
        <button class="path-card path-tag" data-idx="1" style="--i:1">
          <span class="path-card-icon">🚶</span>
          <span class="path-tag-text">
            <span class="path-card-label">素通りする</span>
            <span class="path-card-desc">そのまま帰り道を進む</span>
          </span>
        </button>
      </div>
    </div>
  `;
  const stack = div.querySelector(".path-tags-stack");
  const btns = Array.from(div.querySelectorAll(".path-tag"));
  const handlers = [onEnter, onSkip];
  btns.forEach((btn, idx) => {
    btn.onclick = () => {
      if (stack.classList.contains("path-tags-locked")) return;
      stack.classList.add("path-tags-locked");
      btns.forEach((el) => el.classList.add(el === btn ? "path-tag-selected" : "path-tag-fading"));
      setTimeout(() => { close(); handlers[idx](); }, 170);
    };
  });
}

// ============ 探索イベント(進んだ先で出会う「何か」) ============
// フロア到着抽選に「イベント」枠を追加する(戦闘/財宝の確率は変えず、静寂の取り分から削る)。
// 同じイベントは1遠征に1回まで(expeditionSeenEventIds、平和セリフの重複防止と同じ方式)。
// 静か系の道(静かな道/木漏れ日の道)はイベント率が高く、「静か系=イベント狙い」の個性を持たせる
const DUNGEON_EVENT_CHANCE = 0.12;
const DUNGEON_EVENT_CHANCE_QUIET = 0.18;
const JIZO_COST = 30;
const MERCHANT_HEAL_COST = 50;
let expeditionSeenEventIds = new Set();
let jizoBlessingActive = false; // 地蔵の加護: この遠征中1回だけ、倒れる一撃をHP1でこらえる(engine.jsの被ダメ処理で消費)
let warashiLuckActive = false; // 座敷わらしの幸運: この遠征中、財宝発見率1.5倍(rollEncounterで参照)
let koOniRepayFloorsLeft = 0; // 傷ついた小鬼の恩返しまでの残りフロア数(静かな通路に着くたび1減り、0で恩返し)
function resetExpeditionEventState() {
  expeditionSeenEventIds = new Set();
  jizoBlessingActive = false;
  warashiLuckActive = false;
  koOniRepayFloorsLeft = 0;
}
// 財宝の基準額(rollEncounterの財宝発見と同じ式)。イベントの金銭報酬はこれの倍数で決める
function eventTreasureBase() {
  const treasureMax = (currentStage === "coast" ? 6 : 5) + currentFloor;
  const treasureMin = Math.max(1, Math.round(treasureMax * 0.5));
  return treasureMin + Math.floor(Math.random() * (treasureMax - treasureMin + 1));
}
function grantEventGold(g) {
  state.gold += g;
  advGoldEarned += g;
  saveState();
  playSfx("coin");
  showTreasurePopup(g);
}
// 化け長持/天狗など「その階層に合った強さの敵」を土台にした特別な敵を作るための抽選。
// pickEnemyForFloor(mode未指定)はボスも稀に混ざるため、通常敵を引くまで数回引き直す
function pickEventEnemyBase(floor) {
  for (let i = 0; i < 8; i++) {
    const e = pickEnemyForFloor(floor, undefined, currentStage);
    if (e && !e.isBoss && !e.isMidBoss) return e;
  }
  return pickEnemyForFloor(1, undefined, currentStage);
}
function startEventBattle(enemies, pathDef, encounterText) {
  playSfx("big_attack_warning");
  startBattle(enemies, pathDef, encounterText);
  flashFromBlackOverCurrentScreen(); // イベント選択は明転後のタップなので、戦闘への切り替わりに暗転の区切りを入れる
}
// 各イベントの定義。choices()を都度呼ぶことで、所持金など「その瞬間の状態」でラベル/可否を出し分ける
const DUNGEON_EVENTS = [
  {
    id: "jizo", title: "苔むしたお地蔵さま", image: "assets/events/jizo.png",
    flavor: "古いお地蔵さまが佇んでいる。前に賽銭箱が置かれている。",
    choices: () => [
      {
        icon: "🙏", label: `賽銭を入れる(${JIZO_COST}G)`, desc: "旅の無事を祈る", disabled: state.gold < JIZO_COST || jizoBlessingActive,
        disabledMsg: jizoBlessingActive ? "この遠征ではもう加護を受けている" : "お金が足りません",
        onPick: () => {
          state.gold -= JIZO_COST;
          jizoBlessingActive = true;
          playSfx("coin");
          dlog("賽銭を納め、深く祈った。お地蔵さまが微笑んだ…気がする。(この遠征中一度だけ、倒れる一撃をこらえる)");
          saveState();
          renderDungeon();
        },
      },
      { icon: "🚶", label: "手を合わせるだけ", desc: "気持ちだけ置いていく", onPick: () => { dlog("静かに手を合わせ、先へ進んだ。"); renderDungeon(); } },
    ],
  },
  {
    id: "mimic", title: "道端の長持", image: "assets/events/treasure_chest.png",
    flavor: "立派な長持が置き捨てられている。…何かがおかしい気がする。",
    choices: () => [
      {
        icon: "🔓", label: "開けてみる", desc: "財宝か、それとも…",
        onPick: () => {
          if (Math.random() < 0.7) {
            const g = eventTreasureBase() * 2;
            dlog(`長持には財宝が詰まっていた！${g}Gを手に入れた！`);
            grantEventGold(g);
            renderDungeon();
          } else {
            const e = pickEventEnemyBase(currentFloor);
            e.id = "bake_nagamochi";
            e.ja = "化け長持";
            e.label = "化け長持";
            e.image = "assets/events/mimic.png";
            e.maxHp = Math.round(e.maxHp * 1.4);
            e.hp = e.maxHp;
            e.atk = Math.round(e.atk * 1.15);
            e.goldMin = Math.round((e.goldMin || 5) * 3);
            e.goldMax = Math.round((e.goldMax || 10) * 3);
            e.xp = Math.round((e.xp || 5) * 1.5);
            dlog("長持が牙を剥いた！化け長持だ！");
            startEventBattle([e], null, "長持が牙を剥いた！化け長持だ！");
          }
        },
      },
      { icon: "🚶", label: "置いていく", desc: "触らぬ神に祟りなし", onPick: () => { dlog("長持には触れず、そっと通り過ぎた。"); renderDungeon(); } },
    ],
  },
  {
    id: "merchant", title: "旅の薬売り", image: "assets/events/merchant.png",
    flavor: "行商人が店を広げている。「山値段ですがね、命には代えられますまい」",
    choices: () => [
      {
        icon: "🧺", label: `手当てを頼む(${MERCHANT_HEAL_COST}G)`, desc: "全員のHPが全回復", disabled: state.gold < MERCHANT_HEAL_COST,
        disabledMsg: "お金が足りません",
        onPick: () => {
          state.gold -= MERCHANT_HEAL_COST;
          fieldParty.forEach((c) => { if (c.status === "active") c.hp = c.maxHp; });
          playSfx("heal");
          dlog("薬売りの見事な手当てを受けた。全員の傷がすっかり癒えた！");
          saveState();
          renderDungeon();
        },
      },
      { icon: "🚶", label: "断る", desc: "先を急ぐ", onPick: () => { dlog("「またご縁がありましたら」薬売りは笑って店をたたんだ。"); renderDungeon(); } },
    ],
  },
  {
    id: "spring", title: "こんこんと湧く泉", image: "assets/events/spring.png",
    flavor: "澄んだ湧き水が湧いている。心が洗われるようだ。",
    choices: () => [
      {
        icon: "🛁", label: "一番疲れた者を浸からせる", desc: "ストレスを大きく回復",
        onPick: () => {
          const alive = fieldParty.filter((c) => c.status === "active");
          const t = alive.reduce((a, b) => ((b.fatigue || 0) > (a.fatigue || 0) ? b : a), alive[0]);
          if (t) {
            t.fatigue = Math.max(0, (t.fatigue || 0) - 30);
            popupOn(t.id, "30", "stress-relief");
            playSfx("onsen_relief");
            dlog(`${t.label}は泉にゆっくり浸かった。心がすっと軽くなった。(ストレス-30)`);
          }
          saveState();
          renderDungeon();
        },
      },
      {
        icon: "💧", label: "全員で少しずつ飲む", desc: "全員のストレスを小さく回復",
        onPick: () => {
          fieldParty.forEach((c) => { if (c.status === "active") { c.fatigue = Math.max(0, (c.fatigue || 0) - 8); popupOn(c.id, "8", "stress-relief"); } });
          playSfx("heal");
          dlog("全員で冷たい湧き水を分け合った。少し気持ちが安らいだ。(全員ストレス-8)");
          saveState();
          renderDungeon();
        },
      },
    ],
  },
  {
    id: "shrine", title: "古びた祠", image: "assets/events/shrine.png",
    flavor: "小さな祠から、ただならぬ妖気が漂っている…。",
    choices: () => [
      {
        icon: "⛩️", label: "一人が祈祷する", desc: "最もMPが減った者のMP全回復、代わりにストレス+15",
        onPick: () => {
          const alive = fieldParty.filter((c) => c.status === "active" && c.maxMp > 0);
          const t = alive.reduce((a, b) => ((b.mp / b.maxMp) < (a.mp / a.maxMp) ? b : a), alive[0]);
          if (t) {
            t.mp = t.maxMp;
            t.fatigue = Math.min(FATIGUE_MAX, (t.fatigue || 0) + 15);
            popupOn(t.id, "15", "stress");
            playSfx("omikuji_daikichi");
            dlog(`${t.label}が祠に祈祷した。妖力が満ちていく…だが妖気に当てられた。(MP全回復、ストレス+15)`);
          }
          saveState();
          renderDungeon();
        },
      },
      { icon: "🚶", label: "近寄らない", desc: "妖気には関わらない", onPick: () => { dlog("祠には近寄らず、足早に通り過ぎた。"); renderDungeon(); } },
    ],
  },
  {
    id: "warashi", title: "迷い子の童", image: "assets/events/warashi.png",
    flavor: "小さな子がついてくる。…足音がしない。",
    choices: () => [
      {
        icon: "🖐️", label: "頭を撫でる", desc: "悪い子には見えない",
        onPick: () => {
          warashiLuckActive = true;
          playSfx("omikuji_normal");
          dlog("童の頭をそっと撫でた。ふっと姿が消え、袖に小さな鈴が結ばれていた。(この遠征中、財宝発見率が上がった)");
          renderDungeon();
        },
      },
      { icon: "🙈", label: "気づかないふりをする", desc: "関わらないでおく", onPick: () => { dlog("気づかないふりをして歩き続けた。いつの間にか気配は消えていた。"); renderDungeon(); } },
    ],
  },
  {
    id: "tanuki", title: "化け狸の賭場", image: "assets/events/tanuki.png",
    flavor: "狸が壺を振っている。「丁か半か、乗ってきな」",
    choices: () => [
      {
        icon: "🎲", label: "壺に乗る", desc: "賭け金を自分で決める", disabled: state.gold < 1,
        disabledMsg: "お金が足りません",
        onPick: () => { showTanukiBetModal(); },
      },
      { icon: "🚶", label: "乗らない", desc: "賭け事はしない", onPick: () => { dlog("「つまらないねえ」狸は壺を抱えて茂みに消えた。"); renderDungeon(); } },
    ],
  },
  {
    id: "well", title: "古井戸", image: "assets/events/well.png",
    flavor: "涸れ井戸の底で、何かが光っている。",
    choices: () => [
      {
        icon: "🔦", label: "のぞき込む", desc: "光の正体を確かめる",
        onPick: () => {
          if (Math.random() < 0.6) {
            state.inventory.soulShard = (state.inventory.soulShard || 0) + 1;
            saveState();
            playSfx("omikuji_daikichi");
            dlog("井戸の底から魂のかけらを拾い上げた！");
            showTreasurePopup(0, "assets/items/soul_shard.png");
            renderDungeon();
          } else {
            dlog("井戸の底から妖怪が飛び出してきた！");
            startEventBattle(pickEncounterForFloor(currentFloor, currentStage), { ambushChance: 1 }, "井戸から妖怪が飛び出してきた！");
          }
        },
      },
      { icon: "🚶", label: "立ち去る", desc: "嫌な予感がする", onPick: () => { dlog("井戸には近寄らないことにした。"); renderDungeon(); } },
    ],
  },
  {
    id: "kooni", title: "傷ついた小鬼", image: "assets/events/oni.png",
    flavor: "小鬼が倒れている。敵…のはずだが、虫の息だ。",
    choices: () => [
      {
        icon: "🩹", label: "手当てしてやる", desc: "一番元気な者のHP-10", disabled: !fieldParty.some((c) => c.status === "active" && c.hp > 10),
        disabledMsg: "HPが10より多い仲間がいません",
        onPick: () => {
          const alive = fieldParty.filter((c) => c.status === "active" && c.hp > 10);
          const donor = alive.reduce((a, b) => (b.hp > a.hp ? b : a), alive[0]);
          if (donor) {
            donor.hp -= 10;
            koOniRepayFloorsLeft = 3 + Math.floor(Math.random() * 3);
            playSfx("heal");
            dlog(`${donor.label}は手持ちの薬で小鬼の手当てをしてやった。(HP-10) 小鬼は何度も振り返りながら森の奥へ消えていった…。`);
          }
          saveState();
          renderDungeon();
        },
      },
      { icon: "🚶", label: "放っておく", desc: "情けは無用", onPick: () => { dlog("小鬼には関わらず、先へ進んだ。"); renderDungeon(); } },
    ],
  },
  {
    id: "tengu", title: "天狗の腕試し", image: "assets/events/tengu.png",
    flavor: "天狗が扇を鳴らした。「貴様ら、少しは骨のある奴はいるか」",
    choices: () => [
      {
        icon: "⚔️", label: "受けて立つ", desc: "強敵。勝てば大きな恵み",
        onPick: () => {
          const e = pickEventEnemyBase(currentFloor + 8);
          e.id = "tengu_shiren";
          e.ja = "天狗";
          e.label = "天狗";
          e.image = "assets/events/tengu.png";
          // ユーザー指示(2026-07-18): HPを従来(1.1倍)の1.5倍に増量 → 1.65倍
          e.maxHp = Math.round(e.maxHp * 1.65);
          // ユーザー指示(2026-07-18): 専用のため技「扇の突風」。威力は低め(通常攻撃の0.3倍)だが
          // 味方全体に当たり、各対象90%でスタン(1ターン)する行動封じ技。土台の敵の大技より優先される
          e.bigAttack = { name: "扇の突風", mult: 0.3, aoe: true, debuff: { type: "stun", chance: 0.9, turns: 1 } };
          e.hp = e.maxHp;
          e.goldMin = Math.round((e.goldMin || 5) * 1.5);
          e.goldMax = Math.round((e.goldMax || 10) * 1.5);
          dlog("腕試しを受けて立った！");
          startEventBattle([e], null, "天狗「いざ、尋常に勝負！」");
          battle.tenguChallenge = true; // victory()側で勝利報酬(魂のかけら1+全員ストレス回復)を出すための目印
        },
      },
      {
        icon: "🙇", label: "丁重に断る", desc: "全員ストレス+5",
        onPick: () => {
          fieldParty.forEach((c) => { if (c.status === "active") { c.fatigue = Math.min(FATIGUE_MAX, (c.fatigue || 0) + 5); popupOn(c.id, "5", "stress"); } });
          dlog("丁重に断ると、天狗の高笑いが山じゅうに響き渡った…。(全員ストレス+5)");
          saveState();
          renderDungeon();
        },
      },
    ],
  },
];
// 化け狸の賭場の賭け金入力(ユーザー指示2026-07-18: 「有り金の半分」固定から自分で金額を決める方式へ)。
// 勝率50%・勝てば賭け金と同額が上乗せ・負ければ没収、というルール自体は従来のまま。
// 1〜所持金の範囲で自由入力+早押しボタン(10G/半分/全額)。「やめる」は選択肢の「乗らない」と同じ扱い
function showTanukiBetModal() {
  const overlay = document.getElementById("tanukiBetOverlay");
  const input = document.getElementById("tanukiBetInput");
  document.getElementById("tanukiBetGoldText").textContent = `所持金 ${state.gold}G — いくら賭ける？`;
  input.max = String(state.gold);
  input.value = String(Math.max(1, Math.floor(state.gold / 2)));
  overlay.style.display = "flex";
  const close = () => { overlay.style.display = "none"; };
  document.getElementById("tanukiBet10").onclick = () => { input.value = String(Math.min(10, state.gold)); };
  document.getElementById("tanukiBetHalf").onclick = () => { input.value = String(Math.max(1, Math.floor(state.gold / 2))); };
  document.getElementById("tanukiBetAll").onclick = () => { input.value = String(state.gold); };
  document.getElementById("tanukiBetCancel").onclick = () => {
    close();
    dlog("「つまらないねえ」狸は壺を抱えて茂みに消えた。");
    renderDungeon();
  };
  document.getElementById("tanukiBetGo").onclick = () => {
    const bet = Math.floor(Number(input.value));
    if (!Number.isFinite(bet) || bet < 1 || bet > state.gold) {
      showInfoModal(`賭け金は1〜${state.gold}Gの間で決めてください`);
      return;
    }
    close();
    if (Math.random() < 0.5) {
      dlog(`「あんた強運だね」賭けた${bet}Gが倍になって返ってきた！`);
      grantEventGold(bet);
    } else {
      state.gold -= bet;
      dlog(`「残念、また来な」狸は笑いながら${bet}Gを掻き集めた…。`);
      saveState();
    }
    renderDungeon();
  };
}
// イベント発生の入り口(rollEncounterから呼ばれる)。未消化のイベントが無ければfalseを返して静寂にフォールバック
function tryStartDungeonEvent() {
  const pool = DUNGEON_EVENTS.filter((ev) => !expeditionSeenEventIds.has(ev.id));
  if (pool.length === 0) return false;
  const ev = pool[Math.floor(Math.random() * pool.length)];
  expeditionSeenEventIds.add(ev.id);
  dlog(`${ev.title}に出会った。`);
  showDungeonEvent(ev);
  return true;
}
// イベントカードUI。進路選択(showPathChoice)と同じ#criticalAlertパネル枠+path-tagカードの見た目を使い回し、
// 上部にイベントのイラストと情景テキストを足した構成にする
function showDungeonEvent(ev) {
  const div = document.getElementById("criticalAlert");
  document.getElementById("dungeonLog").style.display = "none";
  document.body.classList.add("path-choice-active");
  // イベント中は専用クラスでパネルを画面中央の固定モーダルにし、下部の探索ボタン群を非表示にする
  // (以前はパネルが通常フローで下へ伸び、選択肢がbottom-actionsと重なって非常に見づらかった)
  document.body.classList.add("dungeon-event-active");
  DUNGEON_BOTTOM_BTN_IDS.forEach((id) => { document.getElementById(id).disabled = true; });
  function close() {
    document.body.classList.remove("path-choice-active");
    document.body.classList.remove("dungeon-event-active");
    div.innerHTML = "";
    document.getElementById("dungeonLog").style.display = "";
  }
  const choices = ev.choices();
  div.innerHTML = `
    <div class="path-choice-panel path-tags-panel dungeon-event-panel">
      <p class="path-choice-title">${ev.title}</p>
      <img class="dungeon-event-img" src="${ev.image}" alt="">
      <p class="dungeon-event-flavor">${ev.flavor}</p>
      <div class="path-choice-cards path-tags-stack">
        ${choices.map((c, idx) => `
          ${idx > 0 ? '<span class="path-tag-rope" aria-hidden="true"></span>' : ""}
          <button class="path-card path-tag${c.disabled ? " path-tag-disabled" : ""}" data-idx="${idx}" style="--i:${idx}">
            <span class="path-card-icon">${c.icon}</span>
            <span class="path-tag-text">
              <span class="path-card-label">${c.label}</span>
              <span class="path-card-desc">${c.desc}</span>
            </span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
  const stack = div.querySelector(".path-tags-stack");
  const btns = Array.from(div.querySelectorAll(".path-tag"));
  btns.forEach((btn, idx) => {
    btn.onclick = () => {
      if (stack.classList.contains("path-tags-locked")) return;
      if (choices[idx].disabled) {
        if (choices[idx].disabledMsg) showInfoModal(choices[idx].disabledMsg);
        return;
      }
      stack.classList.add("path-tags-locked");
      btns.forEach((el) => el.classList.add(el === btn ? "path-tag-selected" : "path-tag-fading"));
      setTimeout(() => { close(); choices[idx].onPick(); }, 170);
    };
  });
}

// 茶屋の階に確定で到着した時、通常の戦闘/財宝抽選(resolveFloorArrival)を行わず茶屋画面を開く。
// 商品在庫は来訪のたびにリセットするのではなく日付単位で持続する(resetTeahouseStockIfNewDay、
// renderTeahouse側で呼ぶ)ため、ここでは何もリセットしない
function enterTeahouseFromDungeon() {
  renderTeahouse();
  showScreen("screen-teahouse");
}

// 同じ階に瀕死の仲間が複数いる場合、1人ずつ順番に「担ぐ/見送る」を選ばせるためのキュー
let pendingCriticalQueue = [];
let afterCriticalQueue = null;
// 現在criticalAlert欄に表示中の内容(担ぐ/見送るの選択肢、または担ぎ手選択の一覧)を覚えておく。
// 道具ボタンの使用等でrenderDungeon()が割り込んだ時に、消さずに同じ内容を再表示するために使う
let activeCriticalAlert = null; // { critical, onResolved, screen: "alert" | "carryPicker" } | null
function queueCriticalAlerts(criticalList, onAllDone) {
  pendingCriticalQueue = criticalList;
  afterCriticalQueue = onAllDone;
  // オート帰還中に瀕死の仲間を発見した場合は、戦闘/茶屋と同じく暗転を挟んで一旦停止する
  // (解決後も自動再開はしない。時刻変化だけが唯一の自動再開の例外)
  if (autoRetreatActive) {
    stopAutoRetreat();
    playAutoRetreatCutFade(() => { showNextQueuedCriticalAlert(); });
    return;
  }
  showNextQueuedCriticalAlert();
}
function showNextQueuedCriticalAlert() {
  if (pendingCriticalQueue.length === 0) {
    // 「担ぐ/見送る」の判断が全て終わるまでは進む/里に戻るを封じていたので、ここで解除する
    document.getElementById("advanceBtn").disabled = false;
    document.getElementById("retreatBtn").disabled = false;
    const cb = afterCriticalQueue;
    afterCriticalQueue = null;
    if (cb) cb();
    return;
  }
  const critical = pendingCriticalQueue.shift();
  if (critical.status !== "critical" || critical.carriedBy) { showNextQueuedCriticalAlert(); return; } // 既に対応済みなら飛ばす
  showCriticalAlert(critical, showNextQueuedCriticalAlert);
}

// 別の冒険で瀕死のまま残された仲間がいる階に到達した時のアラート。
// onResolved: 「見送る」または「担ぐ」が確定した時の続き処理(複数人いる場合は次の1人のアラートへ、
// 全員片付いたらフロア到達時は次のエンカウント抽選、戦闘直後は何もせず探索画面に留まる)。
// 「救出して町に戻る」(即座に瀕死解除+強制帰還)は、実質ノーコストのファストトラベルになってしまうため廃止。
// 瀕死の仲間を助ける手段は「担ぐ」(歩いて連れて帰る必要がある)のみにしてある
function showCriticalAlert(critical, onResolved) {
  activeCriticalAlert = { critical, onResolved, screen: "alert" };
  // 「担ぐ/見送る」を選ぶまでは進む/里に戻るを封じる(でないと選ばずに階層を進めてしまい、
  // 元の階に取り残されたキャラのアラートが新しい階でも(activeCriticalAlertの復元により)
  // 出続けてしまうバグがあった)。道具ボタンはこれまで通り使用可(既存の中断復元の仕組みを維持)
  document.getElementById("advanceBtn").disabled = true;
  document.getElementById("retreatBtn").disabled = true;
  document.body.classList.add("critical-alert-active");
  const div = document.getElementById("criticalAlert");
  // このポップアップの下に隠れているはずの探索ログが透けて見え、下部の進む/里に戻るボタンとも
  // 見た目上重なってしまうため、ポップアップ表示中はログを非表示にする(解決時に元に戻す)
  document.getElementById("dungeonLog").style.display = "none";
  const stageLabel = critical.criticalStage === "coast" ? "海岸" : critical.criticalStage === "cave" ? "洞窟" : "深淵の森";
  div.innerHTML = `
    <div class="critical-alert">
      <p class="critical-alert-title">仲間が倒れている</p>
      <div class="critical-alert-portrait">
        <img src="${characterPortraitSrc(critical)}">
      </div>
      <p class="critical-alert-name">${critical.name}</p>
      <div class="critical-alert-timer">
        <span class="critical-alert-timer-label">消滅まで残り</span>
        <span class="critical-alert-timer-value">${criticalTimeLeftStr(critical)}</span>
      </div>
      <p class="critical-alert-place">${stageLabel} ${critical.criticalFloor}層目</p>
      <div class="critical-alert-actions">
        <button class="big primary critical-alert-btn" id="carryBtn">連れて帰る</button>
        <button class="big critical-alert-skip-btn critical-alert-btn" id="skipCriticalBtn">見送る</button>
      </div>
    </div>
  `;
  // 閉じる/画面遷移する直前にごく短いscale+opacityの退場演出を挟んでから次へ進む(0.15秒、テンポは維持)
  function closeWithAnim(next) {
    const box = div.querySelector(".critical-alert");
    if (box) box.classList.add("critical-alert-closing");
    setTimeout(next, 150);
  }
  document.getElementById("carryBtn").onclick = () => {
    // 担げる仲間が1人もいない場合はshowCarryPicker側がshowInfoModal()を出して現在のアラートをそのまま
    // 残す仕様なので、その場合だけは退場演出を挟まずに現在の表示を維持する
    if (aliveField().filter((c) => !c.carryingId).length === 0) {
      showCarryPicker(critical, onResolved);
      return;
    }
    closeWithAnim(() => showCarryPicker(critical, onResolved));
  };
  document.getElementById("skipCriticalBtn").onclick = () => {
    closeWithAnim(() => {
      dlog(`${critical.name}をその場に残した。`);
      div.innerHTML = "";
      document.getElementById("dungeonLog").style.display = "";
      document.body.classList.remove("critical-alert-active");
      activeCriticalAlert = null;
      onResolved();
    });
  };
}

// 誰が担ぐかを選ぶ(探索中に取り残された仲間の階へたどり着いた時、または戦闘直後にこのフロアで瀕死になった仲間がいる時)
function showCarryPicker(critical, onResolved) {
  const div = document.getElementById("criticalAlert");
  const carriers = aliveField().filter((c) => !c.carryingId);
  if (carriers.length === 0) {
    showInfoModal("担げる仲間がいません(全員ふさがっています)");
    return;
  }
  activeCriticalAlert = { critical, onResolved, screen: "carryPicker" };
  document.getElementById("advanceBtn").disabled = true;
  document.getElementById("retreatBtn").disabled = true;
  const rowHtml = (c) => {
    return `
      <button class="big" data-carrier-id="${c.id}" style="margin-top:0.3rem; display:flex; align-items:center; gap:0.6rem; justify-content:flex-start; padding-left:0.8rem;">
        <img src="${characterPortraitSrc(c)}" style="width:36px;height:36px;object-fit:contain;background:#353a44;border-radius:4px;">
        <span>${c.name}</span>
      </button>
    `;
  };
  div.innerHTML = `
    <div class="critical-alert">
      <p><strong>${critical.name}を誰が担ぎますか？</strong></p>
      ${carriers.map(rowHtml).join("")}
      <button class="big" id="cancelCarryBtn" style="margin-top:0.4rem;">やめる</button>
    </div>
  `;
  carriers.forEach((c) => {
    div.querySelector(`button[data-carrier-id="${c.id}"]`).onclick = () => {
      c.carryingId = critical.id;
      critical.carriedBy = c.id;
      critical.criticalFloor = null;
      critical.criticalExpireMinutes = null;
      saveState();
      dlog(`${c.name}が${critical.name}を担いだ。里まで歩いて連れて帰ろう。`);
      if (Math.random() < DIALOGUE_CHANCE.carried) trySpeak(critical, "carried");
      playSfx("carry");
      // ユーザー指示により、以前あった2秒間の静止(演出のための強制停止)を廃止し、即座に再開する
      activeCriticalAlert = null;
      div.innerHTML = "";
      document.body.classList.remove("critical-alert-active");
      renderDungeon();
      onResolved();
    };
  });
  document.getElementById("cancelCarryBtn").onclick = () => showCriticalAlert(critical, onResolved);
}

// 担いでいた仲間を無事に里まで届け、瀕死から回復させる(里に着いた時に呼ぶ)
// 担がれている本人は、今回の遠征の名簿(fieldParty)に居るとは限らない(別の冒険で瀕死のまま
// 取り残されていた仲間を、今回の探索中に見つけて担いだ場合など)。そのため検索はfieldPartyではなく
// state.roster全体に対して行い、「今回の遠征メンバーの誰かに担がれているか」で判定する
function deliverCarriedAllies() {
  state.roster.forEach((c) => {
    if (c.status === "critical" && c.carriedBy && fieldParty.some((f) => f.id === c.carriedBy)) {
      const carrier = getRosterChar(c.carriedBy);
      rescueCritical(c);
      dlog(`${carrier ? carrier.name : "仲間"}が担いでいた${c.name}を無事に里まで連れ帰った！`);
    }
  });
  fieldParty.forEach((c) => { c.carryingId = null; });
}

// 帰還中(retreating)は危険が少ない道を通るという設定で、戦闘遭遇率・財宝発見率を下げる(固定値)
const RETREAT_BATTLE_CHANCE = 0.18; // ユーザー指示で19%・18%に1%下げた
const RETREAT_GOLD_CHANCE = 0.10;
// 連続戦闘のストレス軽減(ピティ制、2026-07-21)。「進む→戦闘→進む→また戦闘」が連続すると
// 実際のプレイ体験としては「運が悪い」ではなく「戦闘が多すぎるゲーム」という印象になりやすい、
// というユーザー提案を受けて導入。戦闘直後は戦闘率を大きく下げ、階層を経るごとに通常倍率へ戻し、
// 一定階層経っても戦闘が無ければ確定発生させる。パラメータは実データ(PATH_DEFS等)でのシミュレーション
// (30層/15層想定、複数案を比較)を経てユーザーが選んだ「案E」の数値。総戦闘数は現行比-13〜18%程度に
// 抑えつつ、3連続以上の発生率を現行の40〜65%程度から10〜20%程度まで削減する
const PITY_MIN_MULT = 0.45; // 戦闘直後の戦闘率倍率
const PITY_RAMP_FLOORS = 3; // この階数で通常倍率(1.0)まで回復する
const PITY_GUARANTEE_FLOORS = 6; // この階数、戦闘が無いまま経過したら確定発生させる
function pityBattleChanceMultiplier() {
  if (floorsSinceLastBattle >= PITY_GUARANTEE_FLOORS) return Infinity; // 確定発生の目印
  if (floorsSinceLastBattle >= PITY_RAMP_FLOORS) return 1;
  return PITY_MIN_MULT + (1 - PITY_MIN_MULT) * (floorsSinceLastBattle / PITY_RAMP_FLOORS);
}
function applyEncounterPity(baseChance) {
  const mult = pityBattleChanceMultiplier();
  return mult === Infinity ? 1 : Math.min(1, baseChance * mult);
}
function rollEncounter(pathBias) {
  // ここでの1回の呼び出しが「1階層分の抽選」に対応するため、まず経過階層を進めておく。
  // 実際に戦闘が発生した場合はstartBattle()側で0にリセットされる(このrollEncounter内の
  // どの分岐から戦闘が始まっても、呼び出し元を問わず必ず通る単一の戦闘開始関数のため確実)
  floorsSinceLastBattle++;
  // 神隠しの道(森)/幻の島(海岸)は選ぶと確定で魂のかけらを2つ手に入れる特別な道(戦闘/財宝抽選はしない)
  if (pathBias === "kamikakushi") {
    lastFloorMoveOutcome = "kamikakushi"; // オート帰還の一時停止判定用(実際にはpathBiasが常にnullなので帰還中は通らない)
    state.inventory.soulShard = (state.inventory.soulShard || 0) + 2;
    saveState();
    dlog("神隠しの道を抜けると、魂のかけらが2つ落ちていた。");
    renderDungeon();
    playKamikakushiEffect();
    playSfx("omikuji_daikichi");
    showTreasurePopup(0, "assets/items/soul_shard.png");
    // 神隠しの道は平和な掛け合いの対象外(ユーザー指示)
    return;
  }
  const bias = !retreating && pathBias ? currentPathDefs()[pathBias] : null;
  const baseBattle = bias ? bias.battle : 0.65;
  const baseGold = bias ? bias.gold : 0.25;
  // 帰還中はユーザー指示で戦闘遭遇率19%・財宝発見率10%の固定値にした(以前は基準値の1/4・1/5だった)。
  // ただしそのステージの敵データがまだ1体も無い場合(廃城下町/門/古城の下地テスト段階)は、
  // 帰還中の固定値も含めて戦闘発生率を強制的に0にする(pickEncounterForFloorが空を返して
  // クラッシュするのを未然に防ぐための安全策。敵データが揃えば自動的に通常通り機能する)
  const rawBattleChance = (!debugNoEncounters && stageHasEnemies(currentStage)) ? (retreating ? RETREAT_BATTLE_CHANCE : baseBattle) : 0;
  // ピティ制は帰還中には適用しない(シミュレーションの結果、帰還のRETREAT_BATTLE_CHANCEは元々低いため
  // 6階確定発生がむしろ戦闘数を増やす方向に働くと判明。帰還はもともと3連続以上の発生率も低く
  // 導入の必要性が薄いという判断。ユーザー指示、2026-07-21)
  const battleChance = rawBattleChance > 0 ? (retreating ? rawBattleChance : applyEncounterPity(rawBattleChance)) : 0;
  // 座敷わらしの幸運(イベント): この遠征中は財宝発見率1.5倍(戦闘率は不変、合計が1を超えないよう上限あり)
  const goldChance = retreating ? RETREAT_GOLD_CHANCE : Math.min(baseGold * (warashiLuckActive ? 1.5 : 1), Math.max(0, 1 - battleChance));
  // 探索イベントの取り分(静寂の枠から削る。帰還中・進路選択なし(依頼対象接近等)の時は出ない)
  const eventChance = !retreating && pathBias ? (pathBias === "shizuka" || pathBias === "komorebi" ? DUNGEON_EVENT_CHANCE_QUIET : DUNGEON_EVENT_CHANCE) : 0;
  const roll = Math.random();
  if (roll < battleChance) {
    lastFloorMoveOutcome = "battle"; // オート帰還の一時停止判定用
    startBattle(pickEncounterForFloor(currentFloor, currentStage), bias);
  } else if (roll < battleChance + goldChance) {
    lastFloorMoveOutcome = "gold"; // オート帰還の一時停止判定用
    // 財宝の金額: 上限は1階層につき+1Gの単純な一次式、下限は上限の50%(深く潜っても運が悪いと固定5G、という
    // 旧仕様の問題を解消するため、下限も階層に応じて伸びるようにしてある)。
    // 森だけユーザー指示で基準値を6→5に1G下げた(海岸はこれまでどおり6のまま)
    const treasureMax = (currentStage === "coast" ? 6 : 5) + currentFloor;
    const treasureMin = Math.max(1, Math.round(treasureMax * 0.5));
    const baseG = treasureMin + Math.floor(Math.random() * (treasureMax - treasureMin + 1));
    // ユーザー指示(2026-07-18)の財宝配分調整: 道端で拾うゴールドは基準値の半分に減らし、
    // 代わりに「何かが光る道」の宝箱から出るゴールドは基準値の2.8倍に増やす
    // (道端拾いを地味に、宝箱を「開ける価値のある当たり」にするメリハリ付け)
    const isHikaruChest = !retreating && pathBias === "hikaru";
    const g = isHikaruChest ? Math.round(baseG * 2.8) : Math.max(1, Math.round(baseG * 0.5));
    state.gold += g;
    advGoldEarned += g; // リザルト画面の「収穫」にも反映されるよう、戦闘報酬と同じ集計に加算する
    saveState();
    dlog(`${g}Gの財宝を見つけた！`);
    renderDungeon();
    // 「何かが光る道」で見つけた財宝だけは特別な宝箱演出(SFXも演出側が鳴らす)。それ以外は従来のポップアップ
    if (!retreating && pathBias === "hikaru") {
      playHikaruTreasureCelebration(g);
    } else {
      playSfx("coin");
      showTreasurePopup(g);
    }
    // 財宝発見時も(戦闘に遭遇していなければ)平和/疲弊の掛け合いの対象にする(帰還中の「帰還」ボタンは対象外)。
    // 両者はストレス条件が相互排他(平和=全員元気、疲弊=疲労キャラを含むペア)のため、同時には発火しない
    if (!retreating) { maybeTriggerPeaceDialogue(); maybeTriggerTiredDialogue(); }
  } else if (roll < battleChance + goldChance + eventChance && tryStartDungeonEvent()) {
    lastFloorMoveOutcome = "event"; // 未消化イベントが無い場合はtryStartDungeonEventがfalseを返し、下の静寂へ落ちる
  } else {
    lastFloorMoveOutcome = "silent"; // オート帰還の一時停止判定用
    // 傷ついた小鬼の恩返し(イベント): 手当てから数フロア後、静かな通路で待っていて財宝のありかを教えてくれる
    if (koOniRepayFloorsLeft > 0) {
      koOniRepayFloorsLeft--;
      if (koOniRepayFloorsLeft === 0) {
        const g = ((currentStage === "coast" ? 6 : 5) + currentFloor) * 3;
        dlog(`手当てした小鬼が待っていた！恩返しに、隠された財宝のありかをこっそり教えてくれた。${g}Gを手に入れた！`);
        grantEventGold(g);
        renderDungeon();
        return;
      }
    }
    dlog("静かな通路だ。何も起こらなかった。");
    renderDungeon();
    // 「すすむ」で敵と遭遇しなかった時だけ、平和/疲弊の掛け合いの発生条件をチェックする(帰還中の「帰還」ボタンは対象外)
    if (!retreating) { maybeTriggerPeaceDialogue(); maybeTriggerTiredDialogue(); }
  }
}

// ============ 平和な掛け合い(トリガー判定) ============
// 発生条件(全て満たす時のみ100%発生。呼び出し元rollEncounter側で「敵と遭遇しなかった場合」
// (財宝発見含む、神隠しの道は対象外)・帰還中でないこと、に限定して呼んでいるため、ここでは
// 残りの条件のみチェックする:
// ① パーティ全員(戦闘に出ているactiveメンバー)がストレス49以下、かつ瀕死のキャラがいない、担いでもいない
// ② パーティ全員がHP50%以上
// ③⑦ その遠征で敵に一回以上勝利しており、かつ直近の勝利後にまだこのセリフが発火していない
//     (peaceDialogueLocked、victory()勝利のたびにunlockPeaceDialogueAfterVictory()でfalseに戻り、
//      1回発火するたびにtrueに戻る「勝利→1回だけ発火可」のサイクル)
// ⑥ パーティが二人以上いる
function peaceDialogueConditionsMet() {
  if (peaceDialogueLocked) return false; // ③⑦
  const active = fieldParty.filter((c) => c.status === "active");
  if (active.length < 2) return false; // ⑥
  if (fieldParty.some((c) => c.status === "critical")) return false; // ① 瀕死がいない
  if (fieldParty.some((c) => c.carryingId)) return false; // ① 担いでいない
  if (!active.every((c) => (c.fatigue || 0) <= 49)) return false; // ① ストレス49以下
  if (!active.every((c) => c.maxHp > 0 && c.hp / c.maxHp >= 0.5)) return false; // ② HP50%以上
  return true;
}
// 配列からランダムに異なる2要素を選ぶ(パーティ人数2〜4人のいずれでも動作する)
function pickTwoRandomElements(list) {
  const pool = [...list];
  const first = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  const second = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  return [first, second];
}
// 3人掛け合いの抽選率(ユーザー指示2026-07-18: 当初60%/40%→同日「両方50%に」で半々に変更)。
// 3人版はパーティに元気な3人以上がいて、性格の組み合わせに合う未消化の候補が残っている時だけ
// 抽選対象になり、候補が無い場合は従来どおり2人版banterのみが出る
const TRIO_DIALOGUE_CHANCE = 0.5;
// パーティの現在メンバーで成立する3人掛け合い候補を全て集める(tiredのcollectTiredDialogueCandidatesと
// 同じ総当たり方式。同じ性格のメンバーが複数いても別人として全組み合わせを列挙する)
function collectTrioDialogueCandidates() {
  const list = trioDialogueList();
  if (!list.length) return [];
  const active = fieldParty.filter((c) => c.status === "active");
  if (active.length < 3) return [];
  const results = [];
  list.forEach((entry) => {
    if (expeditionSpokenDialogueKeys.has("trio:" + entry.id)) return; // この遠征で既出のセリフは使わない
    active.forEach((mA) => {
      if (mA.personality !== entry.pA) return;
      active.forEach((mB) => {
        if (mB === mA || mB.personality !== entry.pB) return;
        active.forEach((mC) => {
          if (mC === mA || mC === mB || mC.personality !== entry.pC) return;
          results.push({ entry, mA, mB, mC });
        });
      });
    });
  });
  return results;
}
function maybeTriggerPeaceDialogue() {
  if (!peaceDialogueConditionsMet()) return;
  // まず3人版をTRIO_DIALOGUE_CHANCE(50%)で抽選。2人版・3人版はpeaceDialogueLockedを共有しているため、
  // どちらか片方が発火した時点で、次の戦闘勝利までもう片方も発火の権利を失う
  const trioCandidates = collectTrioDialogueCandidates();
  if (trioCandidates.length > 0 && Math.random() < TRIO_DIALOGUE_CHANCE) {
    const picked = trioCandidates[Math.floor(Math.random() * trioCandidates.length)];
    if (playTrioDialogueExchange(picked.mA, picked.mB, picked.mC, picked.entry, "banter", true)) {
      peaceDialogueLocked = true;
      expeditionSpokenDialogueKeys.add("trio:" + picked.entry.id);
      return;
    }
  }
  const active = fieldParty.filter((c) => c.status === "active");
  // この2人の並び順に意味は無い(pickTwoRandomElementsは単にランダムに2人選ぶだけ)。
  // 実際にどちらが先に喋るかはplayPairedDialogueExchange側でentry.pAとの一致で決め直す
  const [member1, member2] = pickTwoRandomElements(active);
  // この遠征で既に発火したセリフは候補から除く(banter/tired共通の既出記録)
  const candidates = pairedDialoguesForPair("banter", member1.personality, member2.personality)
    .filter((e) => !expeditionSpokenDialogueKeys.has("banter:" + e.id));
  if (candidates.length === 0) return;
  const entry = candidates[Math.floor(Math.random() * candidates.length)];
  // ignoreMutexForFirst=true: 発生条件が厳しい特別なイベントなので、直前のアンビエントセリフ
  // (警戒/ストレス愚痴等)とたまたま重なって黙って不発になることがないよう優先して発言させる
  if (playPairedDialogueExchange(member1, member2, entry, "banter", true)) {
    peaceDialogueLocked = true;
    expeditionSpokenDialogueKeys.add("banter:" + entry.id);
  }
}

// ============ 疲弊時の掛け合い(トリガー判定) ============
// 平和な掛け合い(banter)と全く同じ発生条件・発火サイクル(勝利→敵と遭遇しなかったフロアで
// 1回だけ100%発火、神隠しの道と帰還中は対象外)だが、ストレス条件だけが異なる:
// banterは「全員49以下(=全員元気)」であるのに対し、こちらは「セリフのMOODが要求する
// 疲労/元気の組み合わせに合致する2人が実際にパーティにいること」が条件になる。
//   疲労 = ストレス50〜99(100=発狂圏は対象外)、元気 = ストレス49以下
//   bothTired        → A役・B役とも疲労
//   aTiredBEnergetic → A役が疲労、B役が元気
//   aEnergeticBTired → A役が元気、B役が疲労
// 全MOODが「少なくとも1人は疲労」を要求するため、banterの発生条件(全員元気)とは
// 同時に成立せず、どちらか一方しか発火しない
function tiredStressMatches(member, needTired) {
  const f = member.fatigue || 0;
  return needTired ? f >= 50 && f <= 99 : f <= 49;
}
function tiredDialogueConditionsMet() {
  if (tiredDialogueLocked) return false; // 勝利→1回発火のサイクル(banterのpeaceDialogueLockedと同じ)
  const active = fieldParty.filter((c) => c.status === "active");
  if (active.length < 2) return false;
  if (fieldParty.some((c) => c.status === "critical")) return false; // 瀕死がいない
  if (fieldParty.some((c) => c.carryingId)) return false; // 担いでいない
  if (!active.every((c) => c.maxHp > 0 && c.hp / c.maxHp >= 0.5)) return false; // HP50%以上
  return true;
}
// パーティの現在のストレス状態で成立する(性格ペア+MOODが両方合致する)セリフ候補を全て集める
function collectTiredDialogueCandidates() {
  const store = pairedDialogueStore["tired"];
  if (!store) return [];
  const active = fieldParty.filter((c) => c.status === "active");
  const results = [];
  store.list.forEach((entry) => {
    if (!entry.mood) return; // MOOD行の無い壊れたエントリは対象外
    if (expeditionSpokenDialogueKeys.has("tired:" + entry.id)) return; // この遠征で既出のセリフは使わない
    const needATired = entry.mood === "bothTired" || entry.mood === "aTiredBEnergetic";
    const needBTired = entry.mood === "bothTired" || entry.mood === "aEnergeticBTired";
    active.forEach((mA) => {
      if (mA.personality !== entry.pA || !tiredStressMatches(mA, needATired)) return;
      active.forEach((mB) => {
        if (mB === mA) return;
        if (mB.personality !== entry.pB || !tiredStressMatches(mB, needBTired)) return;
        results.push({ entry, mA, mB });
      });
    });
  });
  return results;
}
function maybeTriggerTiredDialogue() {
  if (!tiredDialogueConditionsMet()) return;
  const candidates = collectTiredDialogueCandidates();
  if (candidates.length === 0) return;
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  // playPairedDialogueExchangeはentry.pAと話者の性格の一致で先攻を決めるため、
  // MOOD判定済みのmA(A役)を第1引数に渡せばA役が必ず先に喋る
  if (playPairedDialogueExchange(picked.mA, picked.mB, picked.entry, "tired", true)) {
    tiredDialogueLocked = true;
    expeditionSpokenDialogueKeys.add("tired:" + picked.entry.id);
  }
}

// 神隠しの道を抜けた時だけの特別演出: 画面全体を紫〜白の幻想的な光でフラッシュさせ、
// 光の粒(パーティクル)を画面各所からふわっと浮かび上がらせる。通常の財宝発見演出
// (showTreasurePopup)より一段大掛かりにして「特別な道だった」感を出す。DOM要素は
// #treasure-popupのような常設要素ではなく、演出のたびにbodyへ動的追加→setTimeoutで除去する
// (crit演出のsetTimeout+remove方式と同じ考え方)
function playKamikakushiEffect() {
  const flash = document.createElement("div");
  flash.className = "kamikakushi-flash-overlay";
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 1150);

  const layer = document.createElement("div");
  layer.className = "kamikakushi-particle-layer";
  document.body.appendChild(layer);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const PARTICLE_COUNT = 22;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = document.createElement("div");
    p.className = "kamikakushi-particle";
    const size = 4 + Math.random() * 7;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${Math.random() * vw}px`;
    p.style.top = `${vh * 0.4 + Math.random() * vh * 0.5}px`;
    p.style.setProperty("--kk-dur", `${(1.2 + Math.random() * 1.0).toFixed(2)}s`);
    p.style.setProperty("--kk-x", `${((Math.random() * 2 - 1) * 60).toFixed(1)}px`);
    p.style.setProperty("--kk-y", `${-(120 + Math.random() * 160).toFixed(1)}px`);
    p.style.animationDelay = `${(Math.random() * 0.4).toFixed(2)}s`;
    layer.appendChild(p);
  }
  setTimeout(() => layer.remove(), 2000);
}
// 財宝発見時、量に応じて4段階(ごくわずか/少量/中量/大量)のイラストを画面中央に一瞬表示する
function treasureTierImage(amount) {
  if (amount <= 5) return "gokuwazuka";
  if (amount <= 15) return "shoryo";
  if (amount <= 25) return "churyo";
  return "tairyo";
}
// ============ 光る道の財宝発見・豪華演出 ============
// 「何かが光る道」(hikaru)で財宝を見つけた時だけ、通常のポップアップの代わりに再生する特別演出。
// 暗めの幕→宝箱がドンと降ってくる→ガタガタ震える→光が弾けて金額がドン、という流れを全てWAAPIで組む
// (CSS transitionはこのプロジェクトでは信頼できない実績があるためelement.animate()のみ使用)
const HIKARU_CELEBRATION_TOTAL_MS = 2600;
function playHikaruTreasureCelebration(amount) {
  const old = document.querySelector(".hikaru-celebration");
  if (old) old.remove(); // 連続発見時の保険(通常は演出中に次の発見は起きない)
  const layer = document.createElement("div");
  layer.className = "hikaru-celebration";
  layer.innerHTML = `
    <div class="hikaru-backdrop"></div>
    <div class="hikaru-rays"></div>
    <div class="hikaru-stage">
      <div class="hikaru-flash"></div>
      <img class="hikaru-chest" src="assets/events/treasure_chest.png" alt="">
      <div class="hikaru-amount">+${amount}G</div>
      ${Array.from({ length: 10 }, () => '<span class="hikaru-spark">✨</span>').join("")}
    </div>`;
  document.body.appendChild(layer);
  const backdrop = layer.querySelector(".hikaru-backdrop");
  const rays = layer.querySelector(".hikaru-rays");
  const chest = layer.querySelector(".hikaru-chest");
  const flash = layer.querySelector(".hikaru-flash");
  const amountEl = layer.querySelector(".hikaru-amount");
  const sparks = Array.from(layer.querySelectorAll(".hikaru-spark"));
  // 1) 幕が下りて宝箱が落ちてくる(バウンド付き)
  backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: "ease", fill: "forwards" });
  playSfx("omikuji_normal");
  chest.animate(
    [
      { opacity: 0, transform: "translateY(-58vh) scale(0.8)", offset: 0 },
      { opacity: 1, transform: "translateY(0) scale(1)", offset: 0.55 },
      { opacity: 1, transform: "translateY(-5vh) scale(1.02)", offset: 0.75 },
      { opacity: 1, transform: "translateY(0) scale(1)", offset: 1 },
    ],
    { duration: 620, easing: "ease-in-out", fill: "forwards" }
  );
  // 2) 期待の間: 宝箱がガタガタと震え、背後で光の帯が回り始める
  setTimeout(() => {
    rays.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: "ease", fill: "forwards" });
    rays.animate([{ transform: "translate(-50%, -50%) rotate(0deg)" }, { transform: "translate(-50%, -50%) rotate(360deg)" }], { duration: 7000, iterations: Infinity, easing: "linear" });
    chest.animate(
      [
        { transform: "rotate(0deg)" }, { transform: "rotate(-5deg)" }, { transform: "rotate(5deg)" },
        { transform: "rotate(-7deg)" }, { transform: "rotate(7deg)" }, { transform: "rotate(-4deg)" }, { transform: "rotate(0deg)" },
      ],
      { duration: 520, easing: "ease-in-out" }
    );
  }, 660);
  // 3) 光が弾けて金額がドン+火花が放射状に飛ぶ。
  // ユーザー指示(2026-07-18): 弾けた瞬間に宝箱のアイコンを消してコイン(金額段階のゴールド絵)に
  // 切り替え、「開けたら中からコインが出てきた」流れに見せる
  setTimeout(() => {
    playSfx("coin");
    flash.animate([{ opacity: 1, transform: "scale(0.5)" }, { opacity: 0, transform: "scale(1.6)" }], { duration: 480, easing: "ease-out", fill: "forwards" });
    chest.src = `assets/gold/${treasureTierImage(amount)}.png`;
    chest.animate([{ transform: "scale(1)" }, { transform: "scale(1.14)" }, { transform: "scale(1)" }], { duration: 300, easing: "ease-out" });
    amountEl.animate(
      [
        { opacity: 0, transform: "translateX(-50%) scale(0.3)", offset: 0 },
        { opacity: 1, transform: "translateX(-50%) scale(1.25)", offset: 0.55 },
        { opacity: 1, transform: "translateX(-50%) scale(1)", offset: 1 },
      ],
      { duration: 380, easing: "ease-out", fill: "forwards" }
    );
    sparks.forEach((s, i) => {
      const angle = (i / sparks.length) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 70 + Math.random() * 70;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      s.animate(
        [
          { opacity: 1, transform: "translate(-50%, -50%) scale(0.5)" },
          { opacity: 0, transform: `translate(calc(-50% + ${dx.toFixed(0)}px), calc(-50% + ${dy.toFixed(0)}px)) scale(1.3)` },
        ],
        { duration: 650 + Math.random() * 250, easing: "ease-out", fill: "forwards" }
      );
    });
  }, 1180);
  // 4) 余韻→全体フェードアウトして片付け
  setTimeout(() => {
    const out = layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: "ease", fill: "forwards" });
    out.onfinish = () => layer.remove();
    setTimeout(() => layer.remove(), 600); // onfinish不発時の保険
  }, HIKARU_CELEBRATION_TOTAL_MS - 380);
}

let treasurePopupTimer = null;
// extraImageSrc: ゴールドと同時に表示したい追加アイテムのイラスト(鬼火の魂のかけら等)のsrc。
// 省略時は従来通りゴールドのイラスト1枚だけを表示する。amount<=0の時はゴールド側の絵を隠し、
// extraImageSrcだけを表示できる(ゴールドが0でも100%ドロップするアイテムがあるケース向け)
function showTreasurePopup(amount, extraImageSrc) {
  const popup = document.getElementById("treasurePopup");
  const img = document.getElementById("treasurePopupImg");
  const extraImg = document.getElementById("treasurePopupExtraImg");
  img.style.display = amount > 0 ? "" : "none";
  if (amount > 0) img.src = `assets/gold/${treasureTierImage(amount)}.png`;
  if (extraImageSrc) {
    extraImg.src = extraImageSrc;
    extraImg.style.display = "";
  } else {
    extraImg.style.display = "none";
  }
  popup.style.display = "flex";
  [img, extraImg].forEach((el) => {
    if (el.style.display === "none") return;
    el.style.animation = "none";
    void el.offsetWidth; // 再生中に連続で発見した時もアニメーションを最初から再生し直すためのリフロー強制
    el.style.animation = "";
  });
  clearTimeout(treasurePopupTimer);
  treasurePopupTimer = setTimeout(() => { popup.style.display = "none"; }, 1800);
}

function checkStrandedOnCurrentFloor() {
  // 戦闘中に「控えと交代」した瀕死の仲間はfieldPartyから控え(reserveFieldMember)へ移っているため、
  // ここでも合わせて確認しないと担ぐ/見送るの選択肢が二度と出なくなってしまう
  const pool = reserveFieldMember ? fieldParty.concat([reserveFieldMember]) : fieldParty;
  const criticalList = pool.filter((c) => c.status === "critical" && c.criticalFloor === currentFloor && (c.criticalStage || "forest") === currentStage && !c.carriedBy);
  if (criticalList.length > 0) queueCriticalAlerts(criticalList, () => {});
}

// ============ 茶屋 ============
// 深淵の森15層に建築後は確定で立ち寄れる休憩所。「一休み」でHP/MPを回復、「買い物」で
// 回復薬/煙玉/お茶菓子を購入できる。夜・早朝の時間帯は営業時間外として利用できない。
// 商品在庫は来訪のたびにではなく「日付(dayCount)」単位でリセットする(state.teaHouseStockCounts、
// resetTeahouseStockIfNewDay参照)。そのため同じ遠征中に行き帰りで2回立ち寄っても、行きで
// 売り切れた商品は帰りでもまだ売り切れのまま(翌日の営業再開まで補充されない)
function teahouseIsOpen() {
  return state.timeOfDay !== "night" && state.timeOfDay !== "dawn";
}
// 日付が変わっていたら在庫カウントを全商品分リセットする(onsenEggの resetOnsenEggStockIfNewDay と同じ考え方)
function resetTeahouseStockIfNewDay() {
  if (state.teaHouseStockDate !== state.dayCount) {
    state.teaHouseStockCounts = {};
    state.teaHouseStockDate = state.dayCount;
    saveState();
  }
}
function pickTeahouseRestMessage() {
  return TEAHOUSE_REST_MESSAGES[Math.floor(Math.random() * TEAHOUSE_REST_MESSAGES.length)];
}
function teahouseSupplyTotal() {
  return supplyItemTotal();
}
function renderTeahouse() {
  updateSceneBackgrounds();
  renderDwHeader("teaHouse", "茶屋", () => { showScreen("screen-dungeon"); renderDungeon(); });
  resetTeahouseStockIfNewDay();
  const open = teahouseIsOpen();
  document.getElementById("teaHouseClosedNotice").style.display = open ? "none" : "";
  document.getElementById("teaHouseOpenContent").style.display = open ? "" : "none";
  // 営業時間外(夜・早朝)は店員が出勤していない体で、案内キャラも表示しない
  if (open) {
    updateKeeperLine("teaHouseKeeperLinePeriod", "teaHouseKeeperLineIndex", TEAHOUSE_KEEPER_LINES, "teaHouseKeeperBubble");
    showKeeperCharacter("teaHouseKeeperWrap");
  } else {
    hideKeeperCharacter("teaHouseKeeperWrap");
  }
  if (!open) return;

  document.getElementById("teaHouseRestCostText").textContent = TEAHOUSE_REST_COST;
  const restBtn = document.getElementById("teaHouseRestBtn");
  restBtn.textContent = `一休みする(${TEAHOUSE_REST_COST}G)`;
  restBtn.disabled = state.gold < TEAHOUSE_REST_COST;

  document.getElementById("teaHousePotionOwned").textContent = state.inventory.potion || 0;
  document.getElementById("teaHousePotionDesc").textContent = `${ITEMS.potion.desc}(${ITEMS.potion.price}G)`;
  document.getElementById("teaHouseSmokeBombOwned").textContent = state.inventory.smokeBomb || 0;
  document.getElementById("teaHouseSmokeBombDesc").textContent = `${ITEMS.smokeBomb.desc}(${ITEMS.smokeBomb.price}G)`;

  const potionBtn = document.getElementById("teaHouseBuyPotionBtn");
  const potionRemaining = Math.max(0, TEAHOUSE_POTION_STOCK - (state.teaHouseStockCounts.potion || 0));
  if (potionRemaining <= 0) {
    potionBtn.textContent = "本日売り切れ";
    potionBtn.disabled = true;
  } else {
    potionBtn.textContent = `購入 残り${potionRemaining}個`;
    potionBtn.disabled = teahouseSupplyTotal() >= supplyCap() || (state.inventory.potion || 0) >= TEAHOUSE_POTION_CAP || state.gold < ITEMS.potion.price;
  }
  const smokeBtn = document.getElementById("teaHouseBuySmokeBombBtn");
  const smokeRemaining = Math.max(0, TEAHOUSE_SMOKEBOMB_STOCK - (state.teaHouseStockCounts.smokeBomb || 0));
  if (smokeRemaining <= 0) {
    smokeBtn.textContent = "本日売り切れ";
    smokeBtn.disabled = true;
  } else {
    smokeBtn.textContent = `購入 残り${smokeRemaining}個`;
    smokeBtn.disabled = teahouseSupplyTotal() >= supplyCap() || state.gold < ITEMS.smokeBomb.price;
  }
  renderTeahouseSnackList();
}
// お茶菓子一覧: 回復薬/煙玉と同じ「買うと支援物資として持ち歩ける」方式に統一(1商品につき1日1個までの
// 在庫制、state.teaHouseStockCounts/TEAHOUSE_SNACK_STOCK)。使うのはここではなく道具メニュー側
// (探索中の「道具」ボタン、戦闘中の「道具」コマンド)から選んだ時
function renderTeahouseSnackList() {
  const list = document.getElementById("teaHouseSnackList");
  list.innerHTML = TEAHOUSE_SNACK_IDS.map((id) => {
    const item = ITEMS[id];
    return `
    <div class="card" style="margin-top:0.6rem;">
      <div class="shop-item">
        <img class="shop-item-icon" src="${item.image}" alt="">
        <div>
          <div><strong>${item.ja}</strong> <span id="teaHouseSnackOwned_${id}">0</span>個</div>
          <div class="desc">${item.desc.replace(/\n/g, "<br>")}</div>
        </div>
        <button class="big" data-snack-id="${id}"></button>
      </div>
    </div>
  `;
  }).join("");
  TEAHOUSE_SNACK_IDS.forEach((id) => {
    const item = ITEMS[id];
    document.getElementById(`teaHouseSnackOwned_${id}`).textContent = state.inventory[id] || 0;
    const btn = list.querySelector(`button[data-snack-id="${id}"]`);
    const remaining = Math.max(0, TEAHOUSE_SNACK_STOCK - (state.teaHouseStockCounts[id] || 0));
    if (remaining <= 0) {
      btn.textContent = "本日売り切れ";
      btn.disabled = true;
      return;
    }
    btn.textContent = `購入(${item.price}G)`;
    btn.disabled = supplyItemTotal() >= supplyCap() || state.gold < item.price;
    btn.onclick = () => {
      if ((state.teaHouseStockCounts[id] || 0) >= TEAHOUSE_SNACK_STOCK) { showInfoModal(`${item.ja}は本日もう売り切れです`); return; }
      if (supplyItemTotal() >= supplyCap()) { showInfoModal(`支援物資は最大${supplyCap()}個までしか持てません`); return; }
      if (state.gold < item.price) { showInfoModal("お金が足りません"); return; }
      state.gold -= item.price;
      state.inventory[id] = (state.inventory[id] || 0) + 1;
      state.teaHouseStockCounts[id] = (state.teaHouseStockCounts[id] || 0) + 1;
      saveState();
      playSfx("coin");
      renderTeahouse();
    };
  });
}
document.getElementById("teaHouseBuyPotionBtn").onclick = () => {
  if ((state.teaHouseStockCounts.potion || 0) >= TEAHOUSE_POTION_STOCK) { showInfoModal("回復薬は本日もう売り切れです"); return; }
  if (teahouseSupplyTotal() >= supplyCap()) { showInfoModal(`支援物資は最大${supplyCap()}個までしか持てません`); return; }
  if ((state.inventory.potion || 0) >= TEAHOUSE_POTION_CAP) { showInfoModal(`回復薬は最大${TEAHOUSE_POTION_CAP}個までしか持てません`); return; }
  if (state.gold < ITEMS.potion.price) { showInfoModal("お金が足りません"); return; }
  state.gold -= ITEMS.potion.price;
  state.inventory.potion = (state.inventory.potion || 0) + 1;
  state.teaHouseStockCounts.potion = (state.teaHouseStockCounts.potion || 0) + 1;
  saveState();
  playSfx("coin");
  renderTeahouse();
};
document.getElementById("teaHouseBuySmokeBombBtn").onclick = () => {
  if ((state.teaHouseStockCounts.smokeBomb || 0) >= TEAHOUSE_SMOKEBOMB_STOCK) { showInfoModal("煙玉は本日もう売り切れです"); return; }
  if (teahouseSupplyTotal() >= supplyCap()) { showInfoModal(`支援物資は最大${supplyCap()}個までしか持てません`); return; }
  if (state.gold < ITEMS.smokeBomb.price) { showInfoModal("お金が足りません"); return; }
  state.gold -= ITEMS.smokeBomb.price;
  state.inventory.smokeBomb = (state.inventory.smokeBomb || 0) + 1;
  state.teaHouseStockCounts.smokeBomb = (state.teaHouseStockCounts.smokeBomb || 0) + 1;
  saveState();
  playSfx("coin");
  renderTeahouse();
};
document.getElementById("teaHouseRestBtn").onclick = () => {
  if (!teahouseIsOpen() || state.gold < TEAHOUSE_REST_COST) return;
  state.gold -= TEAHOUSE_REST_COST;
  saveState();
  playSfx("select");
  playTeahouseRestTransition(() => {
    const beforeSnapshot = fieldParty.filter((c) => c.status === "active").map((c) => {
      // hpBarHtml/mpBarHtmlの回復トレイルは「前回表示した残量」との比較で発火するため、確実に
      // 回復アニメーションが出るよう回復前の値を明示的に記録しておく(finishCampingと同じ対処)
      c.__hpDisplayRatio = c.maxHp > 0 ? Math.max(0, c.hp / c.maxHp) * 100 : 0;
      c.__mpDisplayRatio = c.maxMp > 0 ? Math.max(0, c.mp / c.maxMp) * 100 : 0;
      return { id: c.id, fatigueBefore: c.fatigue || 0 };
    });
    fieldParty.forEach((c) => { if (c.status === "active") useTeahouseRest(c); });
    advanceExplorationClock(TEAHOUSE_REST_CLOCK_MINUTES);
    tickCriticalExpiry(state.roster, absoluteGameMinutes());
    checkQuestDeadline();
    saveState();
    showRestSummary("teahouseRestSummary", "teahouseRestSummaryList", "teahouseRestNextBtn", beforeSnapshot, () => {
      revealTeahouseRest(() => { renderTeahouse(); });
    }, false);
  });
};
document.getElementById("teaHouseBackBtn").onclick = () => { showScreen("screen-dungeon"); renderDungeon(); };
document.getElementById("teaHouseBackBtnTop").onclick = () => { showScreen("screen-dungeon"); renderDungeon(); };

// 一休みの演出: 宿泊/野営と違い場所を移動しないため、bg画像のクロスフェードは無く暗転+キャプションのみ
let teahouseRestTransitionActive = false;
function playTeahouseRestTransition(onBlack) {
  if (teahouseRestTransitionActive) return;
  teahouseRestTransitionActive = true;
  let blackDone = false;
  function reachBlack() {
    if (blackDone) return;
    blackDone = true;
    clearTimeout(safetyTimer);
    caption.textContent = pickTeahouseRestMessage();
    caption.style.animation = "lodgingCaptionFade 3900ms ease forwards";
    setTimeout(onBlack, 3900);
  }
  const safetyTimer = setTimeout(reachBlack, 30000);
  const overlay = document.getElementById("teahouseRestTransition");
  const blackEl = document.getElementById("teahouseRestBlack");
  const caption = document.getElementById("teahouseRestCaption");
  blackEl.style.opacity = "0";
  caption.textContent = "";
  overlay.style.display = "block";
  void overlay.offsetWidth;
  fadeOpacity(blackEl, 0, 1, 1200, reachBlack);
}
function revealTeahouseRest(onDone) {
  let revealDone = false;
  function finish() {
    if (revealDone) return;
    revealDone = true;
    clearTimeout(safetyTimer);
    overlay.style.display = "none";
    teahouseRestTransitionActive = false;
    onDone();
  }
  const safetyTimer = setTimeout(finish, 30000);
  const overlay = document.getElementById("teahouseRestTransition");
  const blackEl = document.getElementById("teahouseRestBlack");
  setTimeout(() => { fadeOpacity(blackEl, 1, 0, 1000, finish); }, 200);
}

