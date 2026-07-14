// ============ dungeon.js: 深淵の森/海岸探索(進む・進路選択・エンカウント・瀕死救出・帰還) ============
// ============ ダンジョン ============
let currentFloor = 0;
let currentStage = "forest"; // "forest"(深淵の森) | "coast"(海岸)。町の出発ボタンで選び、enterDungeon()〜帰還/全滅まで有効
function currentStageName() { return currentStage === "coast" ? "海岸" : "深淵の森"; }
// ステージごとの最高到達階層を更新する。前進(moveOneFloor)とenterDungeon(1層目突入)からのみ呼び、
// 帰還中の後退では呼ばない(currentFloorが減る側なので自然にMath.maxで無視される想定だが、念のため明示)
function recordMaxFloorReached() {
  state.maxFloorReached = state.maxFloorReached || { forest: 0, coast: 0 };
  if (currentFloor > (state.maxFloorReached[currentStage] || 0)) state.maxFloorReached[currentStage] = currentFloor;
}
let fieldParty = []; // 現在ダンジョンに出ているキャラのライブ参照配列(戦闘に出る最大4人。5人目は下記reserveFieldMember)
// 「助っ人の札」を使って5人編成で出発した時の5人目(交代要員)。戦闘には参加せず、
// 探索中はいつでも自由にfieldPartyの誰かと交代でき、戦闘中は①行動中のキャラが自分のターンを
// 消費して手動で交代する、②誰かが瀕死になった瞬間に「交代しますか？」のポップアップで交代する、の2経路がある。
// 瀕死のキャラがこの枠に入ることもあるが、その場合も「歩けない」ため戦闘終了後は通常通り担いで
// 救出する必要がある(この枠にいるだけでは救出したことにならない)
let reserveFieldMember = null;
let advGoldEarned = 0; // 今回の冒険で稼いだ合計ゴールド(帰還時のリザルト画面用、enterDungeon()でリセット)
let advXpGained = {}; // 今回の冒険でキャラごとに得た経験値の合計(characterId -> xp、同じくリザルト画面用)
let advLevelBefore = {}; // 今回の冒険開始時点のレベル(characterId -> level)。リザルト画面でレベルアップを分かりやすく表示するための比較用
let advQuestCompleted = null; // 今回の冒険で奉行所の依頼を達成した場合{title, gold, xp}(リザルト画面用、enterDungeon()でリセット)
let retreating = false; // 里に戻る途中(進むボタンが「帰還」になり、階層を1つずつ下って歩いて帰る)

// ============ 戦闘後の平和な掛け合い: 探索1回ごとにリセットする状態(他の探索限定の変数と同じくstateには保存しない) ============
let peaceDialogueShown = false; // 今回の探索で既に平和な掛け合いを表示したか
function resetPeaceDialogueState() {
  peaceDialogueShown = false;
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
  recordMaxFloorReached();
  pruneActiveParty();
  fieldParty = state.activePartyIds.map(getRosterChar).filter((c) => c && c.status === "active");
  // 「助っ人の札」で5人選んでいた場合、5人目(最後に選んだ人)は交代要員として控えに回り、
  // 出発時に札を1枚消費する(4人以下で出発した場合は消費しない)
  if (fieldParty.length >= 5) {
    reserveFieldMember = fieldParty.pop();
    state.inventory.kotaifuda = Math.max(0, (state.inventory.kotaifuda || 0) - 1);
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
  stopTownBgm();
  showScreen("screen-dungeon");
  renderDungeon();
  dlog(`${currentStageName()}に入った。`);
}

let dungeonLogLines = [];
function dlog(msg) {
  dungeonLogLines.push(msg);
  appendTypewriterLog("dungeonLog", "dungeonLogArrow", msg);
}

// ストレス段階に応じた落書き風オーバーレイ画像(無ければnull)
// 交代要員(reserveFieldMember)は、健在(status:"active")の間だけ一覧の末尾に表示する
// (交代候補として見えている必要があるため)。瀕死のまま控えに入っている間は、他の瀕死の
// fieldPartyメンバーと同じく非表示にする(担がれるまでは姿を見せない、という既存仕様を踏襲)
function visibleFieldParty() {
  const pool = reserveFieldMember ? fieldParty.concat([reserveFieldMember]) : fieldParty;
  return pool.filter((c) => c.status !== "critical" || c.carriedBy);
}
function renderDungeon() {
  hideStatusTooltip(); // 再描画でアイコン要素が作り直されるため、表示中の説明ツールチップが宙に浮かないよう消しておく
  document.getElementById("floorBadgeText").textContent = `${currentFloor}層目`;
  document.getElementById("dungeonTimeBadge").textContent = `${TIME_PHASE_LABEL[state.timeOfDay || "day"]} ${formatClockTime(state.clockMinutes)}`;
  updateQuestTargetBadge();
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
  if (currentStage === "coast" && !isBossBgmActive()) playExplorationAreaBgm();
  updateSceneBackgrounds(); // 探索中の時計が時間帯の境界を跨いだ時に、背景がその場で切り替わるように
  document.getElementById("advanceBtn").textContent = retreating ? "帰還" : "進む";
  document.getElementById("advanceBtn").classList.toggle("retreat-active", retreating);
  document.getElementById("retreatBtn").style.display = retreating ? "none" : "";
  // 進む/里に戻るのdisabledは、進路選択(showPathChoice)や瀕死アラート(showCriticalAlert)、
  // 移動演出(playDungeonMoveTransition)など複数箇所が個別にtrue/falseを設定する分散管理になっており、
  // 稀にdisabled=trueのまま解除されずに残ってしまうと次の遠征に持ち越されて「進む/里に戻るが
  // 押せなくなる」不具合になる(押せるのは道具だけ、という報告と一致)。renderDungeon()は
  // 探索画面に戻るたびに必ず呼ばれる場所のため、瀕死アラート表示中でない限りここで強制的に
  // 解除し、どんな経路で壊れても次の描画で自己修復するようにする
  if (!activeCriticalAlert) {
    document.getElementById("advanceBtn").disabled = false;
    document.getElementById("retreatBtn").disabled = false;
  }
  document.getElementById("dungeonPotionBtn").textContent = `回復薬(${state.inventory.potion || 0})`;
  document.getElementById("dungeonPotionBtn").disabled = (state.inventory.potion || 0) <= 0;
  // 道具: 野営具/温泉卵をまとめて選ぶメニュー。どちらも0個の時だけ無効化する
  document.getElementById("dungeonToolsBtn").disabled = (state.inventory.campingKit || 0) <= 0 && totalOnsenEggCount() <= 0;
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
  if (targets.length === 0) { alert("交代できる仲間がいません(全員ふさがっています)"); return; }
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

// 探索中の「道具」ボタン: 野営具(野営を始める)/温泉卵(誰か1人がその場で少し回復)をまとめて選ぶメニュー。
// 回復薬/治癒の術と同じ.bottom-actions→dungeonTargetPickerの仕組みを流用する
document.getElementById("dungeonToolsBtn").onclick = () => {
  DUNGEON_BOTTOM_BTN_IDS.forEach((id) => { document.getElementById(id).style.display = "none"; });
  const picker = document.getElementById("dungeonTargetPicker");
  picker.style.display = "flex";
  const campCount = state.inventory.campingKit || 0;
  const eggCount = totalOnsenEggCount();
  // 野営具は旅支度屋を建てるまでボタン自体を出さない(未所持でも灰色ボタンとして見えると、
  // 建物を建てる前からアイテムの存在を知ってしまう=ネタバレになるため)
  picker.innerHTML = `
    <p style="width:100%;margin:0;font-size:0.82rem;"><strong>道具を選んでください</strong></p>
    ${state.travelPrepShopLevel ? `<button class="big" id="toolsCampBtn" ${campCount <= 0 ? "disabled" : ""}>野営具(${campCount})</button>` : ""}
    <button class="big" id="toolsEggBtn" ${eggCount <= 0 ? "disabled" : ""}>温泉卵(${eggCount})</button>
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
// 帰還中(retreating)に「帰還」ボタンを連打する時だけ、この倍率で移動演出全体を高速化する
// (歩き演出→暗転→フェードインという演出の流れ自体は探索時と共通のまま、時間だけ縮める)。
// 探索時の演出(通常のplayDungeonMoveTransition呼び出し)には一切影響しない
const RETREAT_MOVE_SPEED_MULTIPLIER = 3;
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
// speedMultiplier: 省略時は1(探索時と同じ通常速度)。帰還の連打時はRETREAT_MOVE_SPEED_MULTIPLIERを渡すことで
// 歩き演出/暗転/フェードインの時間だけを短縮する(ゲームロジック=actualLogicの中身は一切変えない)
function playDungeonMoveTransition(actualLogic, speedMultiplier) {
  const speed = speedMultiplier || 1;
  const animMs = MOVE_ANIM_MS / speed;
  const fadeMs = MOVE_FADE_MS / speed;
  const bg = document.getElementById("dungeonBgInner"); // 中央寄せを担う親(#dungeonBg)ではなく画像だけの内側レイヤーを動かす
  const overlay = document.getElementById("moveTransitionBlack");
  const advanceBtnEl = document.getElementById("advanceBtn");
  const retreatBtnEl = document.getElementById("retreatBtn");
  advanceBtnEl.disabled = true;
  retreatBtnEl.disabled = true;
  playSfx("footstep");
  const moveAnim = bg.animate(buildWalkKeyframes(animMs), { duration: animMs, easing: "ease-in-out", fill: "forwards" });
  let proceeded = false;
  function proceedToFade() {
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
  moveAnim.onfinish = proceedToFade;
  setTimeout(proceedToFade, animMs + 200); // 安全策: onfinishが発火しない場合でも止まらないように
}

// 「里に戻る」を押した最初の一押しから、すぐに1階層分下る(以前はモード切り替えのみで、
// 実際に1階層下るには帰還ボタンをもう一度押す必要があり「押しても階層が下がらない」ように
// 見えていた)。以後は「帰還」ボタン(advanceBtn)を押すたびに1階層ずつ下って里まで歩いて帰る
document.getElementById("retreatBtn").onclick = () => {
  if (fieldParty.every((c) => c.hp <= 0 || c.status !== "active")) {
    alert("行動できる仲間がいません");
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
        playDungeonMoveTransition(() => {
          retreating = true;
          dlog("引き返すことにした。ここから階層を下って里へ戻る。");
          moveOneFloor();
        });
      },
    },
    { label: "いいえ", className: "big" },
  ]);
};

function finishRetreat() {
  stopAmbientBgm();
  stopCoastAreaBgm();
  retreating = false;
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
    currentFloor--;
    healPartyOnFloorMove();
    advanceExplorationClock(MINUTES_PER_FLOOR_RETREAT);
    if (currentFloor <= 0) {
      saveState();
      finishRetreat();
      return;
    }
  } else {
    advanceFatigue(fieldParty); // ストレスは深層に向かう時だけ溜まる(帰還中は溜めない)
    currentFloor++;
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
function resolveFloorArrival(pathBias) {
  if (tryForceQuestEncounter()) return;
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
// 茶屋(建築済みの時、深淵の森15層に着く時だけ確定で立ち寄れる。進む/帰還どちらの方向でも
// その階へ向かう時は毎回この判定が通るため、行きと帰りに二回立ち寄ることもできる)
function teahouseOfferedForFloor(floor) {
  return currentStage === "forest" && (state.teaHouseLevel || 0) > 0 && floor === TEA_HOUSE_FLOOR;
}
document.getElementById("advanceBtn").onclick = () => {
  if (fieldParty.every((c) => c.hp <= 0 || c.status !== "active")) {
    alert("行動できる仲間がいません");
    return;
  }
  const targetFloor = retreating ? currentFloor - 1 : currentFloor + 1;
  // 帰還中(retreating)は安全なルートを通って歩いて帰る演出のため、道の分岐は出さない。
  // ただし茶屋の階だけは例外で、立ち寄るかどうかの2択を出す
  if (retreating) {
    // 帰還中の「帰還」ボタン連打はここに来る(ボタン連打のテンポ改善のため演出だけ高速化、
    // 階層移動/敵出現判定などのゲームロジックはmoveOneFloor側で従来通り)
    if (teahouseOfferedForFloor(targetFloor)) {
      showTeahouseOffer(
        () => playDungeonMoveTransition(() => moveOneFloor(null, true), RETREAT_MOVE_SPEED_MULTIPLIER),
        () => playDungeonMoveTransition(() => moveOneFloor(null), RETREAT_MOVE_SPEED_MULTIPLIER)
      );
      return;
    }
    playDungeonMoveTransition(() => moveOneFloor(null), RETREAT_MOVE_SPEED_MULTIPLIER);
    return;
  }
  showPathChoice((pathBias) => {
    if (pathBias === TEAHOUSE_PATH_KEY) {
      playDungeonMoveTransition(() => moveOneFloor(null, true));
      return;
    }
    const chosen = currentPathDefs()[pathBias];
    if (chosen) dlog(`${chosen.icon}${chosen.label}を選んだ。`);
    playDungeonMoveTransition(() => moveOneFloor(pathBias));
  }, teahouseOfferedForFloor(targetFloor));
};

// スレイ・ザ・スパイア風の「進む前に道を選ぶ」システム。選んだ道ごとに戦闘/財宝/静寂の出現率を
// 傾ける(battle/gold値、残りが静寂)。フロア構成自体を分岐させる本格的なマップ化ではなく、
// 既存の抽選ロジックに「狙った方向へ振れる」選択肢を挟むだけの軽量版。
// 各道のbattle/gold率、ambushChance(暗い道の奇襲)、goldMult(暗い道の獲得金増)は
// キーごとに1本化し、出現の重み(NORMAL_PATH_WEIGHTS/ONE_CHOICE_PATH_WEIGHTS)とは分離してある
const PATH_DEFS = {
  rindou: { icon: "🌲", label: "林道", battle: 0.60, gold: 0.20 },
  kemono: { icon: "🐾", label: "獣道", battle: 0.75, gold: 0.15 },
  kurai: { icon: "🌑", label: "暗い道", battle: 0.80, gold: 0.10, ambushChance: 0.5, goldMult: 1.5 },
  shizuka: { icon: "🍃", label: "静かな道", battle: 0.15, gold: 0.25 },
  komorebi: { icon: "🌿", label: "木漏れ日の道", battle: 0.20, gold: 0.30 },
  hikaru: { icon: "💰", label: "何かが光る道", battle: 0.10, gold: 0.90 },
  fuon: { icon: "👁️", label: "不穏な道", battle: 1.00, gold: 0.00 },
  kamikakushi: { icon: "✨", label: "神隠しの道", battle: 0.00, gold: 0.00 },
};
// 海岸ステージ版の進路(キーは共通、アイコン/ラベルだけ海のテーマに差し替え。battle/gold等の数値は森と完全に同じ)
const COAST_PATH_DEFS = {
  rindou: { icon: "🏝️", label: "砂浜", battle: 0.60, gold: 0.20 },
  kemono: { icon: "🪨", label: "岩場", battle: 0.75, gold: 0.15 },
  kurai: { icon: "🌊", label: "波打ち際", battle: 0.80, gold: 0.10, ambushChance: 0.5, goldMult: 1.5 },
  shizuka: { icon: "🐚", label: "静かな砂浜", battle: 0.15, gold: 0.25 },
  komorebi: { icon: "🐟", label: "潮溜まり", battle: 0.20, gold: 0.30 },
  hikaru: { icon: "💰", label: "何かが光る道", battle: 0.10, gold: 0.90 },
  fuon: { icon: "👁️", label: "不穏な砂浜", battle: 1.00, gold: 0.00 },
  kamikakushi: { icon: "✨", label: "幻の島", battle: 0.00, gold: 0.00 },
};
function currentPathDefs() { return currentStage === "coast" ? COAST_PATH_DEFS : PATH_DEFS; }
// 進路選択カードの短い情景描写(演出用の雰囲気テキストのみ。battle/gold等の数値には一切影響しない)
const PATH_FLAVOR = {
  rindou: "木々に囲まれた広い道", kemono: "草木が生い茂っている", kurai: "危険な気配が漂う",
  shizuka: "静かな竹林が続く", komorebi: "木漏れ日が差し込む小道", hikaru: "何かが遠くで光っている",
  fuon: "得体の知れない気配がする", kamikakushi: "空気が違う…",
};
const COAST_PATH_FLAVOR = {
  rindou: "波の音が心地よい浜辺", kemono: "足場の悪い岩場が続く", kurai: "危険な気配が漂う",
  shizuka: "静かな砂浜が広がる", komorebi: "小さな生き物がいる潮溜まり", hikaru: "何かが波間で光っている",
  fuon: "得体の知れない気配がする", kamikakushi: "見えるはずのない島影…",
};
function currentPathFlavor() { return currentStage === "coast" ? COAST_PATH_FLAVOR : PATH_FLAVOR; }
// 2択/3択で使う通常プールの出現の重み(重複ありの抽選=同じ道が2つとも出ることもある)
const NORMAL_PATH_WEIGHTS = {
  rindou: 45, kemono: 30, kurai: 7.6, shizuka: 3.52,
  komorebi: 3.2, hikaru: 3.2, fuon: 2, kamikakushi: 0.24,
};
// 1択専用プール: 静かな道を除外し、不穏な道の重みを引き上げて「避けて通れない恐怖」を演出
// (不穏な道がこのプール内でちょうど15%のシェアになるよう他の重みから逆算した値)
const ONE_CHOICE_PATH_WEIGHTS = {
  rindou: 45, kemono: 30, kurai: 7.6,
  komorebi: 3.2, hikaru: 3.2, kamikakushi: 0.24, fuon: 15.75,
};
// 1〜3択の出現割合(1択15%/2択70%/3択15%)。1択の時だけONE_CHOICE_PATH_WEIGHTSを使う
function pickPathChoiceCount() {
  const r = Math.random();
  return r < 0.15 ? 1 : (r < 0.85 ? 2 : 3);
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
function showPathChoice(onChosen, offerTeahouse) {
  const div = document.getElementById("criticalAlert");
  // このポップアップの下に隠れているはずの探索ログが透けて見えてしまうため、表示中は非表示にする(showCriticalAlertと同じ対処)
  document.getElementById("dungeonLog").style.display = "none";
  const count = pickPathChoiceCount();
  const weights = omikujiAdjustedWeights(count === 1 ? ONE_CHOICE_PATH_WEIGHTS : NORMAL_PATH_WEIGHTS);
  const picked = [];
  for (let i = 0; i < count; i++) picked.push(weightedPickPathKey(weights));
  // 茶屋(建築済み+対象階)は通常の抽選プールとは別に、確定で追加の選択肢として必ず加える
  if (offerTeahouse) picked.push(TEAHOUSE_PATH_KEY);
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
      <div class="path-choice-panel path-tags-panel">
        <p class="path-choice-title">進路選択</p>
        <div class="path-choice-cards path-tags-stack">
          ${picked.map((key, idx) => {
            const isTeahouse = key === TEAHOUSE_PATH_KEY;
            const p = isTeahouse ? { icon: "🍡", label: "茶屋" } : currentPathDefs()[key];
            const desc = isTeahouse ? "一休みできる茶屋が見える" : (flavor[key] || "");
            return `
              ${idx > 0 ? '<span class="path-tag-rope" aria-hidden="true"></span>' : ""}
              <button class="path-card path-tag" data-idx="${idx}" style="--i:${idx}">
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
      btn.onclick = () => {
        if (stack.classList.contains("path-tags-locked")) return;
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

// 茶屋の階に確定で到着した時、通常の戦闘/財宝抽選(resolveFloorArrival)を行わず茶屋画面を開く
function enterTeahouseFromDungeon() {
  teahouseVisitStock = { potion: 0, smokeBomb: 0 };
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
  const stageLabel = critical.criticalStage === "coast" ? "海岸" : "深淵の森";
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
    // 担げる仲間が1人もいない場合はshowCarryPicker側がalert()を出して現在のアラートをそのまま
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
    alert("担げる仲間がいません(全員ふさがっています)");
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

// 帰還中(retreating)は危険が少ない道を通るという設定で、戦闘遭遇率を1/4、財宝発見率を1/5に下げる
function rollEncounter(pathBias) {
  // 神隠しの道(森)/幻の島(海岸)は選ぶと確定で魂のかけらを3つ手に入れる特別な道(戦闘/財宝抽選はしない)
  if (pathBias === "kamikakushi") {
    state.inventory.soulShard = (state.inventory.soulShard || 0) + 3;
    saveState();
    dlog("神隠しの道を抜けると、魂のかけらが3つ落ちていた。");
    renderDungeon();
    showTreasurePopup(0, "assets/items/soul_shard.png");
    if (!retreating) maybeTriggerPeaceDialogue();
    return;
  }
  const bias = !retreating && pathBias ? currentPathDefs()[pathBias] : null;
  const baseBattle = bias ? bias.battle : 0.65;
  const baseGold = bias ? bias.gold : 0.25;
  const battleChance = retreating ? baseBattle / 4 : baseBattle;
  const goldChance = retreating ? baseGold / 5 : baseGold;
  const roll = Math.random();
  if (roll < battleChance) {
    startBattle(pickEncounterForFloor(currentFloor, currentStage), bias);
  } else if (roll < battleChance + goldChance) {
    // 財宝の金額: 上限は1階層につき+1Gの単純な一次式、下限は上限の50%(深く潜っても運が悪いと固定5G、という
    // 旧仕様の問題を解消するため、下限も階層に応じて伸びるようにしてある)。
    // 森だけユーザー指示で基準値を6→5に1G下げた(海岸はこれまでどおり6のまま)
    const treasureMax = (currentStage === "coast" ? 6 : 5) + currentFloor;
    const treasureMin = Math.max(1, Math.round(treasureMax * 0.5));
    const g = treasureMin + Math.floor(Math.random() * (treasureMax - treasureMin + 1));
    state.gold += g;
    advGoldEarned += g; // リザルト画面の「収穫」にも反映されるよう、戦闘報酬と同じ集計に加算する
    saveState();
    playSfx("coin");
    dlog(`${g}Gの財宝を見つけた！`);
    renderDungeon();
    showTreasurePopup(g);
    // 財宝発見時も(戦闘に遭遇していなければ)平和な掛け合いの対象にする(帰還中の「帰還」ボタンは対象外)
    if (!retreating) maybeTriggerPeaceDialogue();
  } else {
    dlog("静かな通路だ。何も起こらなかった。");
    renderDungeon();
    // 「すすむ」で敵と遭遇しなかった時だけ、平和な掛け合いの発生条件をチェックする(帰還中の「帰還」ボタンは対象外)
    if (!retreating) maybeTriggerPeaceDialogue();
  }
}

// ============ 平和な掛け合い(トリガー判定) ============
// 発生条件: 今回の探索でまだ表示していない・パーティ全員がHP40%以上かつストレス40%以下、を
// 全て満たす時。以前は「1戦目に勝利済み」も必須条件だったが、ユーザー指示により撤廃し、
// 一度も戦闘していない(1〜2層目で静かな通路だった等)状態でも条件さえ満たせば発生するようにした。
// 呼び出し元(rollEncounter)側で「すすむ」で敵と遭遇しなかった場合に限定して呼んでいるため、
// ここでは条件チェックとキャラ選び・掛け合い抽選だけを行う
function peaceDialogueConditionsMet() {
  if (peaceDialogueShown) return false;
  const active = fieldParty.filter((c) => c.status === "active");
  if (active.length < 2) return false;
  return active.every((c) => c.maxHp > 0 && c.hp / c.maxHp >= 0.4 && (c.fatigue || 0) <= 40);
}
// 配列からランダムに異なる2要素を選ぶ(パーティ人数2〜4人のいずれでも動作する)
function pickTwoRandomElements(list) {
  const pool = [...list];
  const first = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  const second = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  return [first, second];
}
function maybeTriggerPeaceDialogue() {
  if (!peaceDialogueConditionsMet()) return;
  const active = fieldParty.filter((c) => c.status === "active");
  // この2人の並び順に意味は無い(pickTwoRandomElementsは単にランダムに2人選ぶだけ)。
  // 実際にどちらが先に喋るかはplayPairedDialogueExchange側でentry.pAとの一致で決め直す
  const [member1, member2] = pickTwoRandomElements(active);
  const candidates = pairedDialoguesForPair("peace", member1.personality, member2.personality);
  if (candidates.length === 0) return;
  const entry = candidates[Math.floor(Math.random() * candidates.length)];
  // ignoreMutexForFirst=true: 発生条件が厳しい特別なイベントなので、直前のアンビエントセリフ
  // (警戒/ストレス愚痴等)とたまたま重なって黙って不発になることがないよう優先して発言させる
  if (playPairedDialogueExchange(member1, member2, entry, "peace", true)) peaceDialogueShown = true;
}

// 財宝発見時、量に応じて4段階(ごくわずか/少量/中量/大量)のイラストを画面中央に一瞬表示する
function treasureTierImage(amount) {
  if (amount <= 5) return "gokuwazuka";
  if (amount <= 15) return "shoryo";
  if (amount <= 25) return "churyo";
  return "tairyo";
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
// 回復薬/煙玉を購入できる(在庫は来訪ごとにリセットする、セーブはしないその場限りの状態)。
// 夜・早朝の時間帯は営業時間外として利用できない
let teahouseVisitStock = { potion: 0, smokeBomb: 0 };
function teahouseIsOpen() {
  return state.timeOfDay !== "night" && state.timeOfDay !== "dawn";
}
function pickTeahouseRestMessage() {
  return TEAHOUSE_REST_MESSAGES[Math.floor(Math.random() * TEAHOUSE_REST_MESSAGES.length)];
}
function teahouseSupplyTotal() {
  return (state.inventory.potion || 0) + (state.inventory.smokeBomb || 0) + (state.inventory.onsenEgg || 0) + (state.inventory.bomb || 0);
}
function renderTeahouse() {
  updateSceneBackgrounds();
  renderDwHeader("teaHouse", "茶屋", () => { showScreen("screen-dungeon"); renderDungeon(); });
  const open = teahouseIsOpen();
  document.getElementById("teaHouseClosedNotice").style.display = open ? "none" : "";
  document.getElementById("teaHouseOpenContent").style.display = open ? "" : "none";
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
  const potionRemaining = Math.max(0, TEAHOUSE_POTION_STOCK - teahouseVisitStock.potion);
  if (potionRemaining <= 0) {
    potionBtn.textContent = "今回は売り切れ";
    potionBtn.disabled = true;
  } else {
    potionBtn.textContent = `購入 残り${potionRemaining}個`;
    potionBtn.disabled = teahouseSupplyTotal() >= supplyCap() || state.gold < ITEMS.potion.price;
  }
  const smokeBtn = document.getElementById("teaHouseBuySmokeBombBtn");
  const smokeRemaining = Math.max(0, TEAHOUSE_SMOKEBOMB_STOCK - teahouseVisitStock.smokeBomb);
  if (smokeRemaining <= 0) {
    smokeBtn.textContent = "今回は売り切れ";
    smokeBtn.disabled = true;
  } else {
    smokeBtn.textContent = `購入 残り${smokeRemaining}個`;
    smokeBtn.disabled = teahouseSupplyTotal() >= supplyCap() || state.gold < ITEMS.smokeBomb.price;
  }
}
document.getElementById("teaHouseBuyPotionBtn").onclick = () => {
  if (teahouseVisitStock.potion >= TEAHOUSE_POTION_STOCK) { alert("回復薬は今回もう売り切れです"); return; }
  if (teahouseSupplyTotal() >= supplyCap()) { alert(`支援物資は最大${supplyCap()}個までしか持てません`); return; }
  if (state.gold < ITEMS.potion.price) { alert("お金が足りません"); return; }
  state.gold -= ITEMS.potion.price;
  state.inventory.potion = (state.inventory.potion || 0) + 1;
  teahouseVisitStock.potion++;
  saveState();
  playSfx("coin");
  renderTeahouse();
};
document.getElementById("teaHouseBuySmokeBombBtn").onclick = () => {
  if (teahouseVisitStock.smokeBomb >= TEAHOUSE_SMOKEBOMB_STOCK) { alert("煙玉は今回もう売り切れです"); return; }
  if (teahouseSupplyTotal() >= supplyCap()) { alert(`支援物資は最大${supplyCap()}個までしか持てません`); return; }
  if (state.gold < ITEMS.smokeBomb.price) { alert("お金が足りません"); return; }
  state.gold -= ITEMS.smokeBomb.price;
  state.inventory.smokeBomb = (state.inventory.smokeBomb || 0) + 1;
  teahouseVisitStock.smokeBomb++;
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

