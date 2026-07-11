// ============ town.js: 町・宿屋・温泉・増築・奉行所・道具屋・パーティ編成・ステータス詳細など町まわりの全画面 ============
// ============ 町 ============
// 町画面のボタンに出す「NEWがあるかどうか」の覗き見用チェック。実際にその画面(宿屋/増築)を
// 開いた時に初めてseenUnlockedClasses/seenUnlockedBuildingsへ記録されるため、ここでは
// state を書き換えない(読み取るだけ)
function hasAnyNewClass() {
  return Object.keys(CLASSES).some((classId) => isClassUnlocked(classId) && CLASS_UNLOCK_BUILDING[classId] && !state.seenUnlockedClasses[classId]);
}
function hasAnyNewBuilding() {
  const level = state.houseLevel || 1;
  const checks = [
    ["dojoLevel", DOJO_UNLOCK_HOUSE_LEVEL], ["magistrateLevel", MAGISTRATE_UNLOCK_HOUSE_LEVEL],
    ["travelPrepShopLevel", TRAVEL_PREP_SHOP_UNLOCK_HOUSE_LEVEL], ["bagShopLevel", BAG_SHOP_UNLOCK_HOUSE_LEVEL],
    ["watchtowerLevel", WATCHTOWER_UNLOCK_HOUSE_LEVEL], ["henHouseLevel", HEN_HOUSE_UNLOCK_HOUSE_LEVEL],
    ["shrineLevel", SHRINE_UNLOCK_HOUSE_LEVEL], ["gunpowderStoreLevel", GUNPOWDER_STORE_UNLOCK_HOUSE_LEVEL],
    ["karakuriLevel", KARAKURI_UNLOCK_HOUSE_LEVEL], ["hotSpringKeeperLevel", HOT_SPRING_KEEPER_UNLOCK_HOUSE_LEVEL],
    ["teaHouseLevel", TEA_HOUSE_UNLOCK_HOUSE_LEVEL], ["stableLevel", STABLE_UNLOCK_HOUSE_LEVEL],
    ["beeFarmLevel", BEE_FARM_UNLOCK_HOUSE_LEVEL], ["ferryLevel", FERRY_UNLOCK_HOUSE_LEVEL],
    ["shopLevel", SHOP_UNLOCK_HOUSE_LEVEL],
  ];
  return checks.some(([key, unlockLevel]) => level >= unlockLevel && !(state[key] || 0) && !state.seenUnlockedBuildings[key]);
}
function renderTown() {
  // HP/MPは町では自動回復しない(宿屋で宿泊した仲間だけが回復する)
  pruneActiveParty();
  saveState();
  if (checkGameOver()) return;
  document.getElementById("townGold").textContent = state.gold + "G";
  document.getElementById("townDateLabel").textContent = formatGameDate(state.dayCount);
  document.getElementById("townTimeLabel").textContent = `${TIME_PHASE_LABEL[state.timeOfDay || "day"]} ${formatClockTime(state.clockMinutes)}`;
  // 最初の1人を選んだ直後(まだ宿屋で誰も雇っていない間)だけ、宿屋への案内を出す
  // (ゲーム開始時にチュートリアル「表示しない」を選んだ場合は出さない。tutorialEnabled===undefinedは
  // この機能追加前の既存セーブなので、旧来通り表示する側にフォールバックする)
  document.getElementById("townHireHint").style.display = (state.roster.length === 1 && state.tutorialEnabled !== false) ? "" : "none";
  document.getElementById("toMagistrateBtn").style.display = state.magistrateLevel ? "" : "none";
  document.getElementById("toShopBtn").style.display = state.shopLevel ? "" : "none";
  document.getElementById("tavernNewBadge").style.display = hasAnyNewClass() ? "" : "none";
  document.getElementById("extensionTownNewBadge").style.display = hasAnyNewBuilding() ? "" : "none";
  playTownAreaBgm();
  updateSceneBackgrounds();
  showScreen("screen-town");
}

// ============ 開発者モード(町の時刻表示を7回連続タップで起動) ============
let devTapCount = 0;
let devTapLastAt = 0;
const DEV_TAP_REQUIRED = 7;
const DEV_TAP_WINDOW_MS = 600; // タップ間隔がこれを超えたらカウントをリセットする
function handleDevTimeLabelTap() {
  const now = Date.now();
  devTapCount = (now - devTapLastAt <= DEV_TAP_WINDOW_MS) ? devTapCount + 1 : 1;
  devTapLastAt = now;
  if (devTapCount >= DEV_TAP_REQUIRED) {
    devTapCount = 0;
    openDevMode();
  }
}
// タップ専用: ページ全体のダブルタップズーム対策(350ms以内の連続タップのtouchendをpreventDefaultする処理)が
// このボタン上でも働き、素早く連続タップすると合成されるclickイベントごと消えてしまい7回タップが
// カウントできなくなっていたため、このボタンだけtouchend自体をカウント源にして回避する
// (このボタンのtouchendは常にpreventDefaultし、その後に合成されるclickと二重カウントしないようにする)
document.getElementById("townTimeLabel").addEventListener("touchend", (e) => {
  e.preventDefault();
  handleDevTimeLabelTap();
}, { passive: false });
document.getElementById("townTimeLabel").addEventListener("click", handleDevTimeLabelTap);
function openDevMode() {
  document.getElementById("devGoldInput").value = state.gold;
  renderDevRosterList();
  document.getElementById("devModeOverlay").style.display = "block";
}
function renderDevRosterList() {
  const list = document.getElementById("devRosterList");
  list.innerHTML = "";
  state.roster.forEach((c) => {
    const row = document.createElement("div");
    row.className = "card";
    row.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap:0.5rem;";
    const label = document.createElement("span");
    label.textContent = `${c.label}(${CLASSES[c.classId].ja} Lv${c.level})`;
    label.style.cssText = "flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";
    const input = document.createElement("input");
    input.type = "number"; input.min = 1; input.max = MAX_LEVEL; input.value = c.level;
    input.style.cssText = "width:55px; text-align:right; background:var(--surface); color:var(--text); border:1px solid var(--border); border-radius:6px; padding:0.3rem;";
    const btn = document.createElement("button");
    btn.className = "big"; btn.style.cssText = "width:auto; padding:0.4rem 0.6rem;";
    btn.textContent = "設定";
    btn.onclick = () => {
      devSetCharacterLevel(c, parseInt(input.value, 10) || 1);
      saveState();
      renderDevRosterList();
    };
    row.appendChild(label); row.appendChild(input); row.appendChild(btn);
    list.appendChild(row);
  });
}
// レベルを直接指定する(levelUpは1段ずつしか上げられないため、一度基礎値まで戻してから
// 目的のレベルまでlevelUpを繰り返し適用することで、成長式を通した正しいステータスを再現する)
function devSetCharacterLevel(character, targetLevel) {
  targetLevel = Math.max(1, Math.min(MAX_LEVEL, Math.round(targetLevel)));
  const c = CLASSES[character.classId];
  character.level = 1;
  character.maxHp = c.hp; character.atk = c.atk; character.def = c.def; character.spd = c.spd; character.mag = c.mag;
  for (let i = 1; i < targetLevel; i++) levelUp(character, () => {});
  character.hp = character.maxHp;
  character.mp = character.maxMp;
  character.xp = 0;
  // 通常のレベルアップ(victory()経路)はここでqueueSkillChoices()を呼んでスキル選択待ちに積むが、
  // devSetCharacterLevelはその呼び出しが抜けていたため、開発者モードでレベルを上げてもスキルが
  // 一切取得できない不具合があった。character.skills[level]がまだ無いレベルだけ選び直しできるよう積む
  // (既に選択済みのレベルを二重に積むと、applySkillChoiceが加算式の受動効果を二重付与してしまうため除外する。
  // 同様に、既にpendingSkillChoicesへ積まれ未解決のままのレベルも二重に積まないよう除外する)
  const alreadyPendingLevels = new Set(
    state.pendingSkillChoices.filter((e) => e.characterId === character.id).map((e) => e.level)
  );
  const leveledUp = [];
  for (let lv = 2; lv <= targetLevel; lv++) {
    if ((!character.skills || !character.skills[lv]) && !alreadyPendingLevels.has(lv)) leveledUp.push({ character, level: lv });
  }
  queueSkillChoices(leveledUp);
}
document.getElementById("devGoldSetBtn").onclick = () => {
  const v = parseInt(document.getElementById("devGoldInput").value, 10);
  state.gold = isNaN(v) ? state.gold : Math.max(0, v);
  saveState();
  document.getElementById("devGoldInput").value = state.gold;
  document.getElementById("townGold").textContent = state.gold + "G";
};
document.getElementById("devModeCloseBtn").onclick = () => {
  document.getElementById("devModeOverlay").style.display = "none";
  renderTown();
};

// ============ 時間を進める(⌛️) ============
// 町の時計の横から、30分刻み・最長12時間まで時間を早送りできる。1時間ごとに1秒かけて進め、
// 時間帯(朝/昼/夕/夜)の境界を跨いだ時だけ町の背景をフェードで自然に切り替える
const TIME_SKIP_STEP_MIN = 30;
const TIME_SKIP_MAX_MIN = 12 * 60;
let timeSkipSelectedMin = 60;
function formatTimeSkipDuration(min) {
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}
// 選んだ時間だけ進めた後の時刻・時間帯を(実際には進めず)プレビュー計算する。
// phaseForClockMinutes/formatClockTimeはどちらも副作用の無い純粋関数なので、ここでstateを書き換えずに使える
function renderTimeSkipPicker() {
  document.getElementById("timeSkipDurationLabel").textContent = formatTimeSkipDuration(timeSkipSelectedMin);
  document.getElementById("timeSkipMinusBtn").disabled = timeSkipSelectedMin <= TIME_SKIP_STEP_MIN;
  document.getElementById("timeSkipPlusBtn").disabled = timeSkipSelectedMin >= TIME_SKIP_MAX_MIN;
  const nowMinutes = state.clockMinutes || 0;
  const afterMinutes = (nowMinutes + timeSkipSelectedMin) % 1440;
  const nowPhase = phaseForClockMinutes(nowMinutes);
  const afterPhase = phaseForClockMinutes(afterMinutes);
  document.getElementById("timeSkipNowPhase").textContent = TIME_PHASE_LABEL[nowPhase];
  document.getElementById("timeSkipNowLabel").textContent = formatClockTime(nowMinutes);
  document.getElementById("timeSkipAfterPhase").textContent = TIME_PHASE_LABEL[afterPhase];
  document.getElementById("timeSkipAfterLabel").textContent = formatClockTime(afterMinutes);
}
document.getElementById("timeSkipBtn").onclick = () => {
  timeSkipSelectedMin = 60;
  renderTimeSkipPicker();
  const tag = document.querySelector(".time-skip-tag");
  if (tag) tag.classList.remove("pressed");
  document.getElementById("timeSkipPickerView").style.display = "block";
  document.getElementById("timeSkipAnimView").style.display = "none";
  document.getElementById("timeSkipOverlay").style.display = "block";
};
document.getElementById("timeSkipMinusBtn").onclick = () => {
  timeSkipSelectedMin = Math.max(TIME_SKIP_STEP_MIN, timeSkipSelectedMin - TIME_SKIP_STEP_MIN);
  renderTimeSkipPicker();
};
document.getElementById("timeSkipPlusBtn").onclick = () => {
  timeSkipSelectedMin = Math.min(TIME_SKIP_MAX_MIN, timeSkipSelectedMin + TIME_SKIP_STEP_MIN);
  renderTimeSkipPicker();
};
document.getElementById("timeSkipCancelBtn").onclick = () => {
  document.getElementById("timeSkipOverlay").style.display = "none";
};
document.getElementById("timeSkipConfirmBtn").onclick = () => {
  const tag = document.querySelector(".time-skip-tag");
  if (tag) tag.classList.add("pressed");
  setTimeout(() => { startTimeSkipAnimation(timeSkipSelectedMin); }, 130);
};
function startTimeSkipAnimation(totalMin) {
  document.getElementById("timeSkipPickerView").style.display = "none";
  const animView = document.getElementById("timeSkipAnimView");
  animView.style.display = "block";
  const fromEl = document.getElementById("timeSkipBgFrom");
  const toEl = document.getElementById("timeSkipBgTo");
  const clockEl = document.getElementById("timeSkipClockDisplay");
  fromEl.style.opacity = "1";
  fromEl.style.backgroundImage = `url('${BG_SETS.town[state.timeOfDay]}')`;
  toEl.style.opacity = "0";
  const updateClockDisplay = () => {
    clockEl.textContent = `${TIME_PHASE_LABEL[state.timeOfDay]} ${formatClockTime(state.clockMinutes)}`;
  };
  updateClockDisplay();
  // 60分刻みに分解し、端数(30分)があれば最後に1ステップ追加する。1ステップ=1秒
  const steps = [];
  let remaining = totalMin;
  while (remaining > 0) {
    const step = Math.min(60, remaining);
    steps.push(step);
    remaining -= step;
  }
  function runStep(i) {
    if (i >= steps.length) {
      tickCriticalExpiry(state.roster, absoluteGameMinutes());
      checkQuestDeadline(); // 受注中の依頼が期限切れになっていないか確認する
      pruneActiveParty();
      saveState();
      document.getElementById("timeSkipOverlay").style.display = "none";
      renderTown();
      return;
    }
    const beforePhase = state.timeOfDay;
    advanceExplorationClock(steps[i]);
    updateClockDisplay();
    if (state.timeOfDay !== beforePhase) {
      crossfadeBg(fromEl, toEl, BG_SETS.town[state.timeOfDay], 1000, () => runStep(i + 1));
    } else {
      setTimeout(() => runStep(i + 1), 1000);
    }
  }
  runStep(0);
}

// 職業の初期解放/建築解放の仕分け。侍・槍士・狩人・陰陽師は最初から雇える。
// 残り4職業はそれぞれ対応する建物を建てるまで、宿屋の雇用画面にも最初の1人選び画面にも出てこない
const CLASS_UNLOCK_BUILDING = {
  ninja: "karakuriLevel",
  naginata: "dojoLevel",
  gunner: "gunpowderStoreLevel",
  priest: "shrineLevel",
};
function isClassUnlocked(classId) {
  const stateKey = CLASS_UNLOCK_BUILDING[classId];
  if (!stateKey) return true;
  return (state[stateKey] || 0) > 0;
}
document.getElementById("toTavernBtn").onclick = () => { playSfx("select"); renderTavern(); showScreen("screen-tavern"); };
document.getElementById("toShopBtn").onclick = () => { playSfx("select"); renderShop(); showScreen("screen-shop"); };
document.getElementById("toOnsenBtn").onclick = () => { playSfx("onsen_enter"); renderOnsen(); showScreen("screen-onsen"); };
document.getElementById("toDungeonBtn").onclick = () => {
  playSfx("select");
  renderPartySelect();
  showScreen("screen-party-select");
};

// ============ 宿屋 ============
// 建物で解禁されたばかり(まだこの一覧で見ていない)の職業に「NEW」を出す。侍/槍士/狩人/陰陽師のような
// 建物不要で最初から雇える職業は対象外(CLASS_UNLOCK_BUILDINGにエントリが無い=判定自体をスキップする)
function renderClassGrid() {
  const grid = document.getElementById("classGrid");
  grid.innerHTML = "";
  const descArea = document.getElementById("classDescArea");
  descArea.textContent = CLASS_DESC[selectedClass] || "";
  let anyNewlySeen = false;
  Object.keys(CLASSES).filter(isClassUnlocked).forEach((classId) => {
    const c = CLASSES[classId];
    const div = document.createElement("div");
    div.className = "class-pick" + (selectedClass === classId ? " selected" : "");
    const isNew = !!CLASS_UNLOCK_BUILDING[classId] && !state.seenUnlockedClasses[classId];
    div.innerHTML = `<img src="${c.image}"><span>${c.ja}</span>${isNew ? '<span class="new-badge">NEW</span>' : ""}`;
    if (isNew) { state.seenUnlockedClasses[classId] = true; anyNewlySeen = true; }
    div.onclick = () => { selectedClass = classId; renderClassGrid(); };
    // カーソルを乗せている間だけそのクラスの説明を表示し、離れたら選択中のクラスの説明に戻す
    div.onmouseenter = () => { descArea.textContent = CLASS_DESC[classId] || ""; };
    div.onmouseleave = () => { descArea.textContent = CLASS_DESC[selectedClass] || ""; };
    grid.appendChild(div);
  });
  if (anyNewlySeen) saveState();
}
let selectedClass = "samurai";

// 宿屋の名簿一覧: 宿泊できる仲間には「宿泊する」ボタンを表示(まとめて選んで下部の確定ボタンで1回だけ宿泊)。
// 解雇はここではなく各キャラの「詳細」画面(renderStatusScreen)の下部に移した(誤タップ防止のため)
let lodgingSelectedIds = [];

function renderRosterList() {
  const list = document.getElementById("rosterList");
  list.innerHTML = "";
  if (state.roster.length === 0) {
    list.innerHTML = "";
    return;
  }
  // 選択後に瀕死/ロストになったキャラ(遠征中の事故など)は宿泊対象になれないため選択を自動解除する。
  // これをしないと、宿泊ボタン自体が出ない(=解除する手段がない)まま選択済み扱いのidだけが残り、
  // 宿泊人数・料金に数えられ続けて宿泊自体ができなくなる不具合が起きる
  lodgingSelectedIds = lodgingSelectedIds.filter((id) => {
    const c = state.roster.find((r) => r.id === id);
    return c && c.status === "active";
  });
  const now = absoluteGameMinutes();
  state.roster.forEach((c) => {
    const c2 = CLASSES[c.classId];
    const fullHealth = c.status === "active" && c.hp >= c.maxHp && c.mp >= c.maxMp;
    const lodgeable = c.status === "active";
    const lodgeSelected = lodgingSelectedIds.includes(c.id);
    const isOnsenBuffTag = c.status === "active" && !isOnsenLocked(c, now) && !!c.onsenBuffKey;
    const tagText = c.status !== "active" ? (c.status === "critical" ? "瀕死" : "ロスト") : isOnsenLocked(c, now) ? "入浴中" : isOnsenBuffTag ? onsenBuffName(c.onsenBuffKey) : fullHealth ? "満タン" : "待機中";
    const hpRatio = c.maxHp > 0 ? Math.max(0, c.hp / c.maxHp) * 100 : 0;
    const mpRatio = c.maxMp > 0 ? Math.max(0, c.mp / c.maxMp) * 100 : 0;
    const pendingLevels = state.pendingSkillChoices.filter((e) => e.characterId === c.id).map((e) => e.level);
    const hasPendingSkill = pendingLevels.length > 0;
    const levelUpFrom = hasPendingSkill ? Math.min(...pendingLevels) - 1 : null;
    const row = document.createElement("div");
    row.className = "roster-row" + (lodgeSelected ? " selected" : "");
    row.innerHTML = `
      <img src="${characterPortraitSrc(c)}">
      <div class="roster-info">
        <div class="roster-name">${c.name} <span class="status-tag ${statusTagClass(c)}${isOnsenBuffTag ? " onsen-buff-tag" : ""}"${isOnsenBuffTag ? ` data-onsen-buff="${c.onsenBuffKey}"` : ""}>${tagText}</span></div>
        <div class="roster-sub">${statusLabel(c)}</div>
        ${hasPendingSkill ? `<div class="levelup-badge-small">レベルアップ！ Lv.${levelUpFrom}→${c.level}</div>` : ""}
        ${c.status === "active" ? `
          <div class="hpbar-track"><div class="hpbar-fill${hpRatio < 30 ? " low" : ""}" style="width:${hpRatio}%"></div></div>
          ${c.maxMp > 0 ? `<div class="mpbar-track"><div class="mpbar-fill" style="width:${mpRatio}%"></div></div>` : ""}
        ` : ""}
      </div>
      <div class="roster-actions">
        <button class="detail-btn" data-id="${c.id}">詳細</button>
        ${hasPendingSkill ? `<button class="skill-pending-btn">🎓スキル選択</button>` : ""}
      </div>
    `;
    row.querySelector(".detail-btn").onclick = (e) => {
      e.stopPropagation();
      renderStatusScreen(c.id);
      showScreen("screen-status");
    };
    // アイコン写真自体をタップしても詳細ステータスを開けるようにする(既存の「詳細」ボタンと同じ遷移)。
    // 行全体のクリック(宿泊選択トグル)を巻き込まないようstopPropagationする
    const rosterImg = row.querySelector("img");
    rosterImg.style.cursor = "pointer";
    rosterImg.onclick = (e) => {
      e.stopPropagation();
      renderStatusScreen(c.id);
      showScreen("screen-status");
    };
    const skillBtn = row.querySelector(".skill-pending-btn");
    if (skillBtn) {
      skillBtn.onclick = (e) => {
        e.stopPropagation();
        openSkillChoiceFor(c.id);
      };
    }
    // 個別の「宿泊する」ボタンは廃止し、行全体(詳細/スキル選択ボタン以外)をタップすると
    // 宿泊対象として選択/解除できるようにする
    if (lodgeable) {
      row.style.cursor = "pointer";
      row.onclick = (e) => {
        if (e.target.closest(".onsen-buff-tag")) return; // 温泉効果タグのタップはツールチップ表示のみ、宿泊選択を巻き込まない
        if (lodgeSelected) lodgingSelectedIds = lodgingSelectedIds.filter((id) => id !== c.id);
        else lodgingSelectedIds.push(c.id);
        renderRosterList();
      };
    }
    list.appendChild(row);
  });
  const cost = LODGE_COST * lodgingSelectedIds.length;
  const confirmBtn = document.getElementById("lodgeConfirmBtn");
  confirmBtn.textContent = lodgingSelectedIds.length > 0 ? `宿泊する(${cost}G)` : "宿泊する";
  confirmBtn.disabled = lodgingSelectedIds.length === 0 || state.gold < cost;
}

// 宿泊時の演出。現在の時間帯から朝を迎えるまでの残りの時間帯(例: 朝スタートなら昼→夕→夜)を
// 順にクロスフェードでめくり、最後の夜→朝だけは暗転を挟んでから明ける。動画ファイルは使わず、
// 既存の背景イラストの重ね合わせだけで表現しているので読み込み負荷は増えない。
// CSS transitionを「transition:noneにしてリフローしてから戻す」方式で毎回リスタートさせていたが、
// 端末によってはこの手順がうまく効かずフェードせず一瞬で切り替わってしまう不具合があったため、
// より確実にアニメーションさせられるWeb Animations API(element.animate())に切り替えてある
let lodgingTransitionActive = false;
// 現在時刻→夜へクロスフェード→暗転して「一晩がすぎた…」キャプションが出るところまで進める。
// 暗転しきったところでonBlackを呼び、回復サマリー画面の表示を呼び出し元(lodgeConfirmBtn)に任せる。
// 朝への切り替え(森の朝背景+フェードイン)はrevealLodgingMorning側で行う
function playLodgingTransition(onBlack) {
  if (lodgingTransitionActive) return;
  lodgingTransitionActive = true;
  playLodgingBgm();
  const overlay = document.getElementById("lodgingTransition");
  const fromEl = document.getElementById("lodgingTransitionFrom");
  const toEl = document.getElementById("lodgingTransitionTo");
  const blackEl = document.getElementById("lodgingTransitionBlack");
  const caption = document.getElementById("lodgingTransitionCaption");
  const NIGHT_CROSSFADE_MS = 2000; // 現在時刻→夜へのクロスフェード時間(ユーザー指示で従来より少し長め)
  const INITIAL_HOLD_MS = 2200; // 宿泊開始直後、現在時刻の絵を止めたまま表示しておく時間(ユーザー指示で0.3秒短縮)

  fromEl.style.opacity = "1";
  fromEl.style.backgroundImage = `url('${BG_SETS.tavern[state.timeOfDay] || BG_SETS.tavern.night}')`;
  toEl.style.opacity = "0";
  blackEl.style.opacity = "0";
  caption.style.animation = "none";
  caption.style.opacity = "0";
  overlay.style.display = "block";
  void overlay.offsetWidth;

  // 途中の時間帯(昼/夕)は経由せず、現在時刻から夜へ直接クロスフェードする。既に夜ならクロスフェード自体不要
  function afterHold() {
    if (state.timeOfDay === "night") {
      finale();
    } else {
      crossfadeBg(fromEl, toEl, BG_SETS.tavern.night, NIGHT_CROSSFADE_MS, finale);
    }
  }

  function finale() {
    // 夜→暗転(ユーザー指示で暗転まわりの時間はすべて従来の3倍)
    fadeOpacity(blackEl, 0, 1, 2700, () => {
      // 画面が真っ暗な間に背景を朝の絵へ差し替え、キャプションを表示する
      fromEl.style.backgroundImage = `url('${BG_SETS.tavern.dawn}')`;
      caption.textContent = pickLodgingNightMessage();
      caption.style.animation = "lodgingCaptionFade 3900ms ease forwards";
      // キャプションが完全に消えてから回復画面を出す(表示時間を0.6秒短縮したのに合わせて
      // 回復画面が出るタイミングも同じだけ早める)
      setTimeout(onBlack, 3900);
    });
  }

  setTimeout(afterHold, INITIAL_HOLD_MS);
}
// 回復サマリーの「次へ」が押された後に呼ぶ: 暗転明け→朝(モーニングチャイム+フェードイン)して演出を終える
function revealLodgingMorning(onDone) {
  // セーフティネット: アニメーションのコールバック(element.animateのonfinish)がバックグラウンド化などの
  // 理由で発火しなかった場合、lodgingTransitionActiveがtrueのまま固まり続け、以降ずっと宿泊が
  // 無反応になってしまう(ユーザー報告のバグ)。想定最大所要時間より十分長い上限で強制的に完了させ、
  // 自然完了・タイムアウトのどちらが先でも一度しか後処理が走らないようにする
  let lodgingFinished = false;
  function finishLodging() {
    if (lodgingFinished) return;
    lodgingFinished = true;
    clearTimeout(safetyTimer);
    overlay.style.display = "none";
    lodgingTransitionActive = false;
    onDone();
  }
  const safetyTimer = setTimeout(finishLodging, 30000);
  const overlay = document.getElementById("lodgingTransition");
  const blackEl = document.getElementById("lodgingTransitionBlack");
  // 朝のイラストが見え始めるこのタイミングで専用の効果音を一度だけ鳴らす
  playSfx("morning_chime");
  fadeOpacity(blackEl, 1, 0, 3300, finishLodging);
}

// 野営開始時の演出: 現在の背景(1.5秒静止)→夜の森へクロスフェード(既に夜ならスキップ)→
// 夜の森を1.5秒静止→ゆっくり暗転→野営地の絵にフェードイン。BGMのフェードアウトと同時に開始する
function showLodgingRestSummary(beforeSnapshot, onNext) {
  showRestSummary("lodgingRestSummary", "lodgingRestSummaryList", "lodgingRestNextBtn", beforeSnapshot, onNext);
}

document.getElementById("lodgeConfirmBtn").onclick = () => {
  const targets = state.roster.filter((c) => lodgingSelectedIds.includes(c.id));
  if (targets.length === 0) return;
  playLodgingTransition(() => {
    const cost = LODGE_COST * targets.length;
    state.gold -= cost;
    // hpBarHtml/mpBarHtmlの回復トレイルは「前回表示した残量」との比較で発火するため、この
    // キャラの残量バーが今まで一度も描画されたことがなくても確実に回復アニメーションが出るよう、
    // 宿泊前の値を明示的に記録しておく(野営の回復サマリーと同じ対策)
    const beforeSnapshot = targets.map((c) => {
      c.__hpDisplayRatio = c.maxHp > 0 ? Math.max(0, c.hp / c.maxHp) * 100 : 0;
      c.__mpDisplayRatio = c.maxMp > 0 ? Math.max(0, c.mp / c.maxMp) * 100 : 0;
      return { id: c.id, fatigueBefore: c.fatigue || 0 };
    });
    targets.forEach((c) => useLodging(c));
    advanceToNextMorning();
    lodgingSelectedIds = [];
    saveState();
    showLodgingRestSummary(beforeSnapshot, () => {
      revealLodgingMorning(() => {
        if (checkGameOver()) return; // 宿泊で最後の稼働可能な仲間がロストになった場合はここで詰みを検出する
        renderTavern();
      });
    });
  });
};

function renderTavern() {
  pruneActiveParty();
  renderDwHeader("tavern", "宿屋", () => { renderTown(); });
  document.getElementById("tavernGold").textContent = state.gold + "G";
  renderRosterList();
  renderClassGrid();
  document.getElementById("createCharBtn").disabled = state.gold < HIRE_COST || state.roster.length >= rosterCapacity();
  playTownAreaBgm();
  updateSceneBackgrounds();
}

// カード等の登場アニメーションはCSSのanimationプロパティで書いているが、同じ要素に対して
// renderStatusScreen()を2回目以降呼んだだけではクラスが既に付いたままなので再生されない。
// 一度クラスを外してreflowを挟んでから付け直すことで、画面を開き直すたびに毎回再生されるようにする
function retriggerEntryAnim(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
// 詳細ステータスは宿屋の名簿だけでなく、出発準備画面のキャラアイコンからも開けるようにしたため、
// 「戻る」の遷移先を呼び出し元ごとに変える必要がある。onBackを省略した場合(スキル系譜からの
// 復帰など、明示的に渡さない内部呼び出し)は直前に使われたonBackをそのまま引き継ぐ。
// statusBackBtn/statusBackBtnTopは画面ロード時に1度だけイベント登録される固定ボタンのため、
// このモジュール変数を参照する形で常に「今表示中のキャラの正しい戻り先」を辿れるようにしてある
let statusScreenOnBack = null;
function defaultStatusOnBack() { renderTavern(); showScreen("screen-tavern"); }
function renderStatusScreen(charId, onBack) {
  statusScreenOnBack = onBack || statusScreenOnBack || defaultStatusOnBack;
  const c = getRosterChar(charId);
  const c2 = CLASSES[c.classId];
  const reading = NAME_READINGS[c.name];
  document.getElementById("statusName").textContent = reading ? `${c.name}(${reading})` : c.name;
  renderDwHeader("status", c.name, statusScreenOnBack);
  document.getElementById("statusImg").src = statusPortraitSrc(c);
  document.getElementById("statClass").textContent = c2.ja;
  document.getElementById("statPersonality").textContent = c.personality || "-";
  document.getElementById("statLevel").textContent = c.level;
  document.getElementById("statXp").textContent = c.level >= MAX_LEVEL ? "MAX" : `${c.xp} / ${xpToNext(c.level)}`;
  document.getElementById("statStatus").textContent = statusLabel(c);

  const atkText = effectiveStat(c, "atk") + (c.equipBonus && c.equipBonus.atk ? ` (装備+${c.equipBonus.atk})` : "");
  const defText = effectiveStat(c, "def") + (c.equipBonus && c.equipBonus.def ? ` (装備+${c.equipBonus.def})` : "");
  const magText = c.mag > 0 ? effectiveStat(c, "mag") + (c.equipBonus && c.equipBonus.mag ? ` (装備+${c.equipBonus.mag})` : "") : "-";
  const statRows = [
    { key: "hp", label: "HP", value: `${c.hp} / ${c.maxHp}` },
    { key: "mp", label: "MP", value: c.maxMp > 0 ? `${c.mp} / ${c.maxMp}` : "-" },
    { key: "atk", label: "攻撃力", value: atkText },
    { key: "def", label: "防御力", value: defText },
    { key: "spd", label: "素早さ", value: effectiveStat(c, "spd") },
    { key: "mag", label: "魔力", value: magText },
    { key: "stress", label: "ストレス", value: c.fatigue || 0 },
  ];
  document.getElementById("statStatList").innerHTML = statRows.map((row) => `
    <div class="status-stat-row is-${row.key}">
      <span class="status-stat-icon">${ICONS[row.key]}</span>
      <span class="status-stat-label">${row.label}</span>
      <span class="status-stat-value">${row.value}</span>
    </div>
  `).join("");

  // 習得済みスキルに加えて、まだ到達していないレベルは「？？？ Lv◯で習得」の伏せ字で表示し、
  // レベルアップの楽しみを持たせる(選ばなかった方の枝は「二度と来ない」ので対象外、あくまで未来の枠のみ)
  const skillListEl = document.getElementById("statSkillList");
  const tree = SKILL_TREES[c.classId] || {};
  const allLevels = Object.keys(tree).map(Number).sort((a, b) => a - b);
  const skillRows = allLevels.map((lv) => {
    const side = c.skills && c.skills[lv];
    if (side) {
      const skill = tree[lv][side];
      if (!skill) return "";
      return `
        <div class="skill-entry" data-level="${lv}">
          <div class="skill-entry-head">
            <strong>Lv.${lv} ${skill.name}</strong>
            <span class="skill-entry-side">${side === "left" ? "左" : "右"}</span>
          </div>
          <p class="skill-entry-desc">${skill.desc}</p>
        </div>
      `;
    }
    if (lv <= c.level) return ""; // レベル到達済みだが選択待ち(スキル選択ポップアップ側で処理するためここには出さない)
    return `
      <div class="skill-entry locked">
        <div class="skill-entry-head">
          <strong class="skill-entry-mystery">？？？</strong>
          <span class="skill-entry-side">Lv${lv}で習得</span>
        </div>
      </div>
    `;
  }).join("");
  skillListEl.innerHTML = skillRows || '<p style="color:var(--dw-caption-color);font-size:13px;">まだ習得したスキルがありません。</p>';
  skillListEl.querySelectorAll(".skill-entry:not(.locked)").forEach((el) => {
    el.onclick = () => { el.classList.toggle("open"); };
  });

  retriggerEntryAnim(document.getElementById("statusPortraitCard"), "status-portrait-card");
  [document.getElementById("statusStatCard"), document.getElementById("statusSkillCard")].forEach((el) => retriggerEntryAnim(el, "status-card-in"));

  document.getElementById("statusViewSkillTreeBtn").onclick = () => {
    viewSkillTree(charId, () => { renderStatusScreen(charId); showScreen("screen-status"); });
  };
  document.getElementById("statusDismissBtn").onclick = () => {
    showConfirmModal(
      `${c.name}を解雇したキャラは2度と戻ってきません、本当に解雇しますか？`,
      [
        {
          label: "はい",
          className: "big danger",
          onClick: () => {
            state.roster = state.roster.filter((r) => r.id !== charId);
            state.activePartyIds = state.activePartyIds.filter((id) => id !== charId);
            saveState();
            renderTavern();
            showScreen("screen-tavern");
          },
        },
        { label: "いいえ", className: "big" },
      ],
      "var(--danger)"
    );
  };
}
document.getElementById("statusBackBtn").onclick = () => { (statusScreenOnBack || defaultStatusOnBack)(); };
document.getElementById("statusBackBtnTop").onclick = () => { (statusScreenOnBack || defaultStatusOnBack)(); };

// 各キャラ名表示は基本的に漢字のみ(ふりがなの丸括弧は非表示)。宿屋の詳細ステータス画面
// (renderStatusScreen)でだけ、NAME_READINGSで引いたふりがなを名前の横に括弧書きで表示する
const RANDOM_FEMALE_NAMES = [
  { name: "紫苑", reading: "しおん" }, { name: "花梨", reading: "かりん" }, { name: "汐里", reading: "しおり" }, { name: "千代", reading: "ちよ" },
  { name: "小春", reading: "こはる" }, { name: "小夜", reading: "さよ" }, { name: "小梅", reading: "こうめ" }, { name: "小鈴", reading: "こすず" },
  { name: "千鶴", reading: "ちづる" }, { name: "千代乃", reading: "ちよの" }, { name: "千歳", reading: "ちとせ" }, { name: "巴", reading: "ともえ" },
  { name: "楓", reading: "かえで" }, { name: "椿", reading: "つばき" }, { name: "菖蒲", reading: "あやめ" }, { name: "桔梗", reading: "ききょう" },
  { name: "撫子", reading: "なでしこ" }, { name: "百合", reading: "ゆり" }, { name: "菊乃", reading: "きくの" }, { name: "梅乃", reading: "うめの" },
  { name: "藤乃", reading: "ふじの" }, { name: "雪乃", reading: "ゆきの" }, { name: "葵", reading: "あおい" }, { name: "柚葉", reading: "ゆずは" },
  { name: "琴葉", reading: "ことは" }, { name: "琴乃", reading: "ことの" }, { name: "鈴音", reading: "すずね" }, { name: "澪", reading: "みお" },
  { name: "夕霧", reading: "ゆうぎり" }, { name: "朝霧", reading: "あさぎり" }, { name: "月乃", reading: "つきの" }, { name: "月代", reading: "つきよ" },
  { name: "朝日", reading: "あさひ" }, { name: "千景", reading: "ちかげ" }, { name: "志乃", reading: "しの" }, { name: "篠", reading: "しの" },
  { name: "美緒", reading: "みお" }, { name: "美琴", reading: "みこと" }, { name: "乙葉", reading: "おとは" }, { name: "彩葉", reading: "いろは" },
  { name: "詩", reading: "うた" }, { name: "奏", reading: "かなで" }, { name: "鈴", reading: "すず" }, { name: "蛍", reading: "ほたる" },
  { name: "時雨", reading: "しぐれ" }, { name: "露", reading: "つゆ" }, { name: "調", reading: "しらべ" }, { name: "環", reading: "たまき" },
  { name: "日和", reading: "ひより" }, { name: "柚月", reading: "ゆづき" }, { name: "美月", reading: "みつき" }, { name: "雪", reading: "ゆき" },
  { name: "皐月", reading: "さつき" }, { name: "薊", reading: "あざみ" }, { name: "暦", reading: "こよみ" }, { name: "弥生", reading: "やよい" },
  { name: "紗枝", reading: "さえ" }, { name: "泉", reading: "いずみ" }, { name: "紬", reading: "つむぎ" }, { name: "真白", reading: "ましろ" },
  { name: "桜", reading: "さくら" }, { name: "紅葉", reading: "もみじ" }, { name: "芙蓉", reading: "ふよう" }, { name: "若葉", reading: "わかば" },
  { name: "霞", reading: "かすみ" }, { name: "白雪", reading: "しらゆき" }, { name: "雛", reading: "ひな" }, { name: "潮", reading: "しお" },
  { name: "蓮", reading: "れん" }, { name: "燕", reading: "つばめ" }, { name: "篝", reading: "かがり" }, { name: "蒼", reading: "あお" },
  { name: "木葉", reading: "このは" }, { name: "菫", reading: "すみれ" }, { name: "譲葉", reading: "ゆずりは" }, { name: "天音", reading: "あまね" },
  { name: "葉月", reading: "はづき" }, { name: "千尋", reading: "ちひろ" }, { name: "小町", reading: "こまち" }, { name: "水琴", reading: "みこと" },
  { name: "白妙", reading: "しろたえ" }, { name: "深雪", reading: "みゆき" }, { name: "千紗", reading: "ちさ" }, { name: "千草", reading: "ちぐさ" },
  { name: "千結", reading: "ちゆ" }, { name: "静葉", reading: "しずは" }, { name: "清乃", reading: "きよの" }, { name: "瑠璃", reading: "るり" },
  { name: "琥珀", reading: "こはく" }, { name: "透花", reading: "とうか" }, { name: "紗月", reading: "さつき" }, { name: "紗雪", reading: "さゆき" },
  { name: "綾乃", reading: "あやの" }, { name: "綾葉", reading: "あやは" }, { name: "香乃", reading: "かの" }, { name: "香澄", reading: "かすみ" },
  { name: "詩乃", reading: "しの" }, { name: "詩織", reading: "しおり" }, { name: "初音", reading: "はつね" }, { name: "初乃", reading: "はつの" },
  { name: "瑞葉", reading: "みずは" }, { name: "瑞希", reading: "みずき" }, { name: "結乃", reading: "ゆいの" }, { name: "結月", reading: "ゆづき" },
  { name: "結衣", reading: "ゆい" }, { name: "碧", reading: "あおい" }, { name: "雛乃", reading: "ひなの" }, { name: "紫月", reading: "しづき" },
  { name: "紫乃", reading: "しの" }, { name: "鈴蘭", reading: "すずらん" }, { name: "常盤", reading: "ときわ" }, { name: "風花", reading: "ふうか" },
  { name: "月華", reading: "げっか" }, { name: "夕花", reading: "ゆうか" }, { name: "千花", reading: "ちか" }, { name: "朝霞", reading: "あさか" },
  { name: "朝香", reading: "あさか" }, { name: "明日香", reading: "あすか" }, { name: "文乃", reading: "あやの" }, { name: "彩乃", reading: "あやの" },
  { name: "伊織", reading: "いおり" }, { name: "一葉", reading: "かずは" }, { name: "歌乃", reading: "うたの" }, { name: "歌葉", reading: "うたは" },
  { name: "永遠", reading: "とわ" }, { name: "咲良", reading: "さくら" }, { name: "咲耶", reading: "さくや" }, { name: "咲乃", reading: "さきの" },
  { name: "咲月", reading: "さつき" }, { name: "千織", reading: "ちおり" }, { name: "千里", reading: "ちさと" }, { name: "千波", reading: "ちなみ" },
  { name: "千尋乃", reading: "ちひろの" }, { name: "月詠", reading: "つくよ" }, { name: "都", reading: "みやこ" }, { name: "都乃", reading: "みやの" },
  { name: "七瀬", reading: "ななせ" }, { name: "七緒", reading: "なお" }, { name: "野乃花", reading: "ののか" }, { name: "初穂", reading: "はつほ" },
  { name: "春乃", reading: "はるの" }, { name: "陽菜", reading: "ひな" }, { name: "緋菜", reading: "ひな" }, { name: "美鈴", reading: "みすず" },
  { name: "美咲", reading: "みさき" }, { name: "美空", reading: "みそら" }, { name: "美波", reading: "みなみ" }, { name: "望月", reading: "もちづき" },
  { name: "夜月", reading: "よづき" }, { name: "和葉", reading: "かずは" },
];
const NAME_READINGS = {};
RANDOM_FEMALE_NAMES.forEach((n) => { NAME_READINGS[n.name] = n.reading; });
function randomFemaleName() {
  return RANDOM_FEMALE_NAMES[Math.floor(Math.random() * RANDOM_FEMALE_NAMES.length)].name;
}

// 汎用の確認/案内ポップアップ。buttonsは{label, className, onClick}の配列
function showConfirmModal(text, buttons, textColor) {
  const textEl = document.getElementById("genericConfirmText");
  textEl.textContent = text;
  textEl.style.color = textColor || "";
  const btnWrap = document.getElementById("genericConfirmButtons");
  btnWrap.innerHTML = "";
  buttons.forEach((b) => {
    const btn = document.createElement("button");
    btn.className = b.className || "big";
    btn.textContent = b.label;
    btn.onclick = () => {
      hideConfirmModal();
      if (b.onClick) b.onClick();
    };
    btnWrap.appendChild(btn);
  });
  document.getElementById("genericConfirmOverlay").style.display = "flex";
}
function hideConfirmModal() {
  document.getElementById("genericConfirmOverlay").style.display = "none";
}

// ============ 最初の1人選び(ゲーム開始時、名簿が空の間だけ表示) ============
// つかみの画面のため、一覧をずらっと並べるのではなく1体ずつ大きい絵で見せるカルーセル形式にしてある。
// firstCharIndexは画面遷移のたびにrenderFirstCharacterScreen()でリセットされ、
// 左右ボタンはrenderFirstCharacterCard()だけを呼び直す(確認モーダルは再表示しない)
let firstCharIndex = 0;
function firstCharClassIds() {
  return Object.keys(CLASSES).filter(isClassUnlocked);
}
function renderFirstCharacterScreen() {
  // ゲーム開始時(名簿が空の間)だけ、チュートリアル案内(宿屋で仲間を雇いましょう等)の
  // 表示可否を一度だけ選ばせる。既存セーブでroster.length===1のまま(この機能追加前に
  // 最初の1人を作った)場合はtutorialEnabledがundefinedのままになるが、
  // townHireHint側は「undefined=表示する」扱いにしてあるため、旧来通りの挙動を保つ
  if (state.tutorialEnabled === undefined) {
    showConfirmModal("チュートリアルを表示しますか？", [
      { label: "はい", className: "big primary", onClick: () => { state.tutorialEnabled = true; saveState(); startFirstCharacterPick(); } },
      { label: "いいえ", className: "big", onClick: () => { state.tutorialEnabled = false; saveState(); startFirstCharacterPick(); } },
    ]);
  } else {
    startFirstCharacterPick();
  }
}
function startFirstCharacterPick() {
  showConfirmModal("職業を選びましょう。", [{ label: "はじめる", className: "big primary" }]);
  firstCharIndex = 0;
  renderFirstCharacterCard();
}
function renderFirstCharacterCard() {
  const ids = firstCharClassIds();
  if (firstCharIndex < 0) firstCharIndex = ids.length - 1;
  if (firstCharIndex >= ids.length) firstCharIndex = 0;
  const classId = ids[firstCharIndex];
  const c2 = CLASSES[classId];
  const skillsHtml = c2.abilities.map((ab) => `
    <div class="skill-row"><span class="skill-name">${ABILITY_LABEL[ab]}</span> ${ABILITY_DESC[ab]}</div>
  `).join("");
  const dotsHtml = ids.map((id, i) => `<span class="first-char-dot${i === firstCharIndex ? " active" : ""}"></span>`).join("");
  const list = document.getElementById("firstCharacterList");
  list.innerHTML = `
    <div class="first-char-carousel">
      <div class="first-char-photo-wrap">
        ${ids.length > 1 ? '<button class="first-char-arrow left" id="firstCharPrevBtn">‹</button>' : ""}
        <img class="first-char-photo" src="${c2.image}">
        ${ids.length > 1 ? '<button class="first-char-arrow right" id="firstCharNextBtn">›</button>' : ""}
      </div>
      ${ids.length > 1 ? `<div class="first-char-dots">${dotsHtml}</div>` : ""}
      <div class="first-char-name">${c2.ja}</div>
      <div class="first-char-desc">${CLASS_DESC[classId]}</div>
      <div class="first-char-skills">${skillsHtml}</div>
      <button class="big primary first-char-choose-btn" id="firstCharChooseBtn">この職業に決める</button>
    </div>
  `;
  if (ids.length > 1) {
    document.getElementById("firstCharPrevBtn").onclick = () => { playSfx("select"); firstCharIndex--; renderFirstCharacterCard(); };
    document.getElementById("firstCharNextBtn").onclick = () => { playSfx("select"); firstCharIndex++; renderFirstCharacterCard(); };
  }
  document.getElementById("firstCharChooseBtn").onclick = () => {
    showConfirmModal(`${c2.ja}にしますか？`, [
      {
        label: "はい",
        className: "big primary",
        onClick: () => {
          const name = randomFemaleName();
          const c = createCharacter(name, classId, state.classUpgrades);
          c.personality = FIRST_CHARACTER_PERSONALITY[classId];
          state.roster.push(c);
          state.activePartyIds = [c.id];
          saveState();
          playSfx("select");
          renderTown();
        },
      },
      { label: "いいえ", className: "big" },
    ]);
  };
}

const HIRE_COST = 50; // 新しい冒険者を仲間にする際の費用
// 最初に仲間にする10人(最初の1人+宿屋で雇う9人)は性格が誰とも被らないようにする。
// PERSONALITIESはちょうど全10種あるため10人分でぴったり使い切る(11人目以降は完全ランダムに戻る)
function pickNonDuplicatePersonality() {
  if (state.roster.length >= 10) return PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
  const used = new Set(state.roster.map((c) => c.personality));
  const available = PERSONALITIES.filter((p) => !used.has(p));
  if (available.length === 0) return PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
  return available[Math.floor(Math.random() * available.length)];
}
document.getElementById("createCharBtn").onclick = () => {
  const nameInput = document.getElementById("newCharName");
  const name = nameInput.value.trim() || randomFemaleName();
  if (state.roster.length >= rosterCapacity()) { alert(`仲間がいっぱいです(最大${rosterCapacity()}人。増築で上限を増やせます)`); return; }
  if (state.gold < HIRE_COST) { alert(`お金が足りません(${HIRE_COST}G必要)`); return; }
  state.gold -= HIRE_COST;
  const c = createCharacter(name, selectedClass, state.classUpgrades);
  c.personality = pickNonDuplicatePersonality();
  state.roster.unshift(c); // 新しく雇った仲間が名簿の一番上に来るようにする
  nameInput.value = "";
  saveState();
  playSfx("select");
  renderRosterList();
  document.getElementById("tavernGold").textContent = state.gold + "G";
};
document.getElementById("tavernBackBtn").onclick = () => { renderTown(); };
document.getElementById("tavernBackBtnTop").onclick = () => { renderTown(); };

const LODGE_COST = 10; // 宿屋に宿泊する際の宿代(キャラ1人あたり)

// ============ パーティ編成(出発直前) ============
// 出発準備画面のタブ切り替え(支度/おみくじ)。神社が未建築の間はおみくじタブ自体を表示しない。
// 支度タブへの切り替えボタンは廃止したため、おみくじ画面の「戻る」がshowPartySelectTab("main")を呼ぶ
function showPartySelectTab(tab) {
  document.getElementById("partySelectMainTab").style.display = tab === "omikuji" ? "none" : "";
  document.getElementById("partySelectOmikujiTab").style.display = tab === "omikuji" ? "" : "none";
  document.getElementById("partySelectOmikujiTabBtn").className = "big" + (tab === "omikuji" ? " primary" : "");
}
document.getElementById("partySelectOmikujiTabBtn").onclick = () => { playSfx("select"); showPartySelectTab("omikuji"); renderOmikujiTab(); };

function renderPartySelect() {
  playTownAreaBgm();
  updateSceneBackgrounds();
  renderDwHeader("partySelect", "パーティ編成", () => { renderTown(); });
  pruneActiveParty();
  renderSupplies();
  document.getElementById("partySelectOmikujiTabBtn").style.display = (state.shrineLevel || 0) > 0 ? "" : "none";
  showPartySelectTab("main");
  renderOmikujiTab();
  const list = document.getElementById("partySelectList");
  list.innerHTML = "";
  if (state.roster.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">仲間がいません。宿屋で仲間を作りましょう。</p>';
    return;
  }
  const now = absoluteGameMinutes();
  state.roster.forEach((c) => {
    const c2 = CLASSES[c.classId];
    const inParty = state.activePartyIds.includes(c.id);
    const selectable = isAvailable(c, now);
    const row = document.createElement("div");
    row.className = "roster-row" + (inParty ? " selected" : "") + (!selectable ? " disabled" : "");
    const isOnsenBuffTag = c.status === "active" && !isOnsenLocked(c, now) && !!c.onsenBuffKey;
    const tagText = c.status !== "active" ? (c.status === "critical" ? "瀕死" : "ロスト") : isOnsenLocked(c, now) ? "入浴中" : isOnsenBuffTag ? onsenBuffName(c.onsenBuffKey) : "待機中";
    row.innerHTML = `
      <img src="${characterPortraitSrc(c)}">
      <div class="roster-info">
        <div class="roster-name">${c.name} <span class="status-tag ${statusTagClass(c)}${isOnsenBuffTag ? " onsen-buff-tag" : ""}"${isOnsenBuffTag ? ` data-onsen-buff="${c.onsenBuffKey}"` : ""}>${tagText}</span></div>
        ${hpBarHtml(c)}
        ${c.maxMp > 0 ? `<div class="mpbar-track"><div class="mpbar-fill" style="width:${c.maxMp > 0 ? Math.max(0, c.mp / c.maxMp) * 100 : 0}%"></div></div>` : ""}
        <div class="roster-sub">${statusLabel(c)}</div>
      </div>
    `;
    row.onclick = (e) => {
      if (e.target.closest(".onsen-buff-tag")) return; // 温泉効果タグのタップはツールチップ表示のみ、パーティ選択を巻き込まない
      if (!selectable) return;
      if (inParty) {
        state.activePartyIds = state.activePartyIds.filter((id) => id !== c.id);
      } else {
        if (state.activePartyIds.length >= 4) { alert("パーティは最大4人までです"); return; }
        state.activePartyIds.push(c.id);
      }
      saveState();
      renderPartySelect();
    };
    // アイコン写真をタップした時だけ詳細ステータスを開く(行全体のクリックはパーティ編成の
    // 選択/解除に使われているため、stopPropagationで巻き込まないようにする)。
    // 戻るボタンはこの出発準備画面へ戻れるようonBackを明示的に渡す
    const partyImg = row.querySelector("img");
    partyImg.style.cursor = "pointer";
    partyImg.onclick = (e) => {
      e.stopPropagation();
      renderStatusScreen(c.id, () => { renderPartySelect(); showScreen("screen-party-select"); });
      showScreen("screen-status");
    };
    list.appendChild(row);
  });
  activateHpTrails(list);
}

// 支援物資(回復薬+煙玉)の購入。道具屋ではなくここ(出発画面)で買う。合計supplyCap()個までの共有枠
function renderSupplies() {
  const total = (state.inventory.potion || 0) + (state.inventory.smokeBomb || 0) + (state.inventory.onsenEgg || 0) + (state.inventory.bomb || 0);
  document.getElementById("suppliesGold").textContent = state.gold + "G";
  document.getElementById("suppliesCount").textContent = `(${total}/${supplyCap()})`;
  document.getElementById("suppliesCapLabel").textContent = supplyCap();
  document.getElementById("potionOwned").textContent = state.inventory.potion || 0;
  document.getElementById("smokeBombOwned").textContent = state.inventory.smokeBomb || 0;
  document.getElementById("buyPotionSupplyBtn").textContent = `購入(${ITEMS.potion.price}G)`;
  document.getElementById("buyPotionSupplyBtn").disabled = total >= supplyCap() || state.gold < ITEMS.potion.price;
  document.getElementById("buySmokeBombBtn").textContent = `購入(${ITEMS.smokeBomb.price}G)`;
  document.getElementById("buySmokeBombBtn").disabled = total >= supplyCap() || state.gold < ITEMS.smokeBomb.price;
  // 野営具は旅支度屋を建築するまで出発画面にラインナップされない
  document.getElementById("campingKitSection").style.display = state.travelPrepShopLevel ? "" : "none";
  if (state.travelPrepShopLevel) {
    document.getElementById("campingKitCapLabel").textContent = CAMPING_KIT_CAP;
    document.getElementById("campingKitOwned").textContent = state.inventory.campingKit || 0;
    document.getElementById("buyCampingKitBtn").textContent = `購入(${ITEMS.campingKit.price}G)`;
    document.getElementById("buyCampingKitBtn").disabled = (state.inventory.campingKit || 0) >= CAMPING_KIT_CAP || state.gold < ITEMS.campingKit.price;
  }
  // 爆弾は火薬庫を建築するまで出発画面にラインナップされない(支援物資の共有枠を消費する)
  document.getElementById("bombSection").style.display = state.gunpowderStoreLevel ? "" : "none";
  if (state.gunpowderStoreLevel) {
    document.getElementById("bombOwned").textContent = state.inventory.bomb || 0;
    document.getElementById("buyBombBtn").textContent = `購入(${ITEMS.bomb.price}G)`;
    document.getElementById("buyBombBtn").disabled = total >= supplyCap() || state.gold < ITEMS.bomb.price;
  }
  renderOwnedSupplyIcons();
}
// 所持中の支援物資を、野営具→回復薬→煙玉→温泉卵の順で1個ずつ小さいアイコンとして並べる
// (背景画像の上に直接表示するため、個数分そのままアイコンを並べる方式にしてある)
function renderOwnedSupplyIcons() {
  const wrap = document.getElementById("ownedSupplyIcons");
  let html = "";
  // image(画像)が用意されているものはimg、無いもの(絵文字のみ、爆弾など)はemojiをそのまま文字表示する
  const addIcons = (item, count) => {
    for (let i = 0; i < count; i++) {
      html += item.image ? `<img src="${item.image}" alt="${item.ja}">` : `<span class="supply-icon-emoji" title="${item.ja}">${item.emoji || ""}</span>`;
    }
  };
  addIcons(ITEMS.campingKit, state.inventory.campingKit || 0);
  addIcons(ITEMS.potion, state.inventory.potion || 0);
  addIcons(ITEMS.smokeBomb, state.inventory.smokeBomb || 0);
  addIcons(ITEMS.onsenEgg, state.inventory.onsenEgg || 0);
  addIcons(ITEMS.bomb, state.inventory.bomb || 0);
  wrap.innerHTML = html;
}
document.getElementById("buyPotionSupplyBtn").onclick = () => {
  const total = (state.inventory.potion || 0) + (state.inventory.smokeBomb || 0) + (state.inventory.onsenEgg || 0) + (state.inventory.bomb || 0);
  if (total >= supplyCap()) { alert(`支援物資は最大${supplyCap()}個までしか持てません`); return; }
  if (state.gold < ITEMS.potion.price) { alert("お金が足りません"); return; }
  state.gold -= ITEMS.potion.price;
  state.inventory.potion = (state.inventory.potion || 0) + 1;
  saveState();
  playSfx("coin");
  renderSupplies();
};
document.getElementById("buySmokeBombBtn").onclick = () => {
  const total = (state.inventory.potion || 0) + (state.inventory.smokeBomb || 0) + (state.inventory.onsenEgg || 0) + (state.inventory.bomb || 0);
  if (total >= supplyCap()) { alert(`支援物資は最大${supplyCap()}個までしか持てません`); return; }
  if (state.gold < ITEMS.smokeBomb.price) { alert("お金が足りません"); return; }
  state.gold -= ITEMS.smokeBomb.price;
  state.inventory.smokeBomb = (state.inventory.smokeBomb || 0) + 1;
  saveState();
  playSfx("coin");
  renderSupplies();
};
document.getElementById("buyCampingKitBtn").onclick = () => {
  if ((state.inventory.campingKit || 0) >= CAMPING_KIT_CAP) { alert(`野営具は最大${CAMPING_KIT_CAP}個までしか持てません`); return; }
  if (state.gold < ITEMS.campingKit.price) { alert("お金が足りません"); return; }
  state.gold -= ITEMS.campingKit.price;
  state.inventory.campingKit = (state.inventory.campingKit || 0) + 1;
  saveState();
  playSfx("coin");
  renderSupplies();
};
document.getElementById("buyBombBtn").onclick = () => {
  const total = (state.inventory.potion || 0) + (state.inventory.smokeBomb || 0) + (state.inventory.onsenEgg || 0) + (state.inventory.bomb || 0);
  if (total >= supplyCap()) { alert(`支援物資は最大${supplyCap()}個までしか持てません`); return; }
  if (state.gold < ITEMS.bomb.price) { alert("お金が足りません"); return; }
  state.gold -= ITEMS.bomb.price;
  state.inventory.bomb = (state.inventory.bomb || 0) + 1;
  saveState();
  playSfx("coin");
  renderSupplies();
};

document.getElementById("partySelectBackBtn").onclick = () => { renderTown(); };
document.getElementById("partySelectBackBtnTop").onclick = () => { renderTown(); };
document.getElementById("partySelectBackBtnFromOmikuji").onclick = () => { playSfx("select"); showPartySelectTab("main"); };

// おみくじの結果ごとの表示ラベル(現在有効な御利益の説明用)
const OMIKUJI_EFFECT_LABEL = {
  daikichi: "大吉(瀕死の一撃をパーティ全員で一度だけHP1に耐える)",
  chukichi: "中吉(不穏な道が一切出ない)",
  kichi: "吉(神隠しの道の出現率アップ)",
  shokichi: "小吉(最初の戦闘だけ先制確定)",
};
function renderOmikujiTab() {
  const canDraw = (state.omikujiDrawnDate || 0) !== state.dayCount;
  const effectCard = document.getElementById("omikujiCurrentEffectCard");
  if (state.omikujiEffect && OMIKUJI_EFFECT_LABEL[state.omikujiEffect]) {
    effectCard.style.display = "";
    document.getElementById("omikujiCurrentEffectText").textContent = OMIKUJI_EFFECT_LABEL[state.omikujiEffect];
  } else {
    effectCard.style.display = "none";
  }
  const resultCard = document.getElementById("omikujiResultCard");
  if (state.omikujiLastTier && (state.omikujiDrawnDate || 0) === state.dayCount) {
    resultCard.style.display = "";
    const tier = OMIKUJI_TIERS[state.omikujiLastTier];
    document.getElementById("omikujiResultTier").textContent = tier ? tier.label : "";
    document.getElementById("omikujiResultEffect").textContent = tier ? tier.effectDesc : "";
    document.getElementById("omikujiResultLine").textContent = state.omikujiLastLine || "";
  } else {
    resultCard.style.display = "none";
  }
  const btn = document.getElementById("omikujiDrawBtn");
  btn.textContent = canDraw ? "おみくじを引く" : "本日は引き終わりました";
  btn.disabled = !canDraw;
}
function drawOmikuji() {
  if ((state.omikujiDrawnDate || 0) === state.dayCount) return;
  const keys = Object.keys(OMIKUJI_TIERS);
  const total = keys.reduce((s, k) => s + OMIKUJI_TIERS[k].weight, 0);
  let r = Math.random() * total;
  let tierKey = keys[keys.length - 1];
  for (const k of keys) { r -= OMIKUJI_TIERS[k].weight; if (r <= 0) { tierKey = k; break; } }
  state.omikujiDrawnDate = state.dayCount;
  state.omikujiLastTier = tierKey;
  state.omikujiEffect = tierKey === "kyou" ? null : tierKey;
  const speaker = pickRandomActiveRosterChar();
  let line = "";
  if (speaker && OMIKUJI_LINES[tierKey] && OMIKUJI_LINES[tierKey][speaker.personality]) {
    const lines = OMIKUJI_LINES[tierKey][speaker.personality];
    line = `${speaker.name}「${lines[Math.floor(Math.random() * lines.length)]}」`;
  }
  state.omikujiLastLine = line;
  saveState();
  playSfx("select");
  renderOmikujiTab();
}
function pickRandomActiveRosterChar() {
  const alive = state.roster.filter((c) => c.status === "active");
  if (alive.length === 0) return null;
  return alive[Math.floor(Math.random() * alive.length)];
}
document.getElementById("omikujiDrawBtn").onclick = () => drawOmikuji();
// 出発時の演出: 専用効果音を再生→パーティ編成画面のタブ(支援物資/パーティ編成)と見出しを
// すべて隠して門イラストの背景だけを1.5秒見せる→探索中の「進む」と同じ歩行アニメーション
// (buildWalkKeyframes、背景だけscale/translateY、足音効果音つき)を1.25秒かけて→
// 画面全体を0.75秒でフェードアウト→暗転を1.5秒保持(この間にenterDungeonで実際の画面遷移+
// タブ類を元に戻す)→0.5秒でフェードインして探索画面を見せる。
// 背景の変形リセットは(暗転しきってから行う既存の移動演出と同じく)フェードアウトが完了して
// 画面が真っ暗になった後に行う。歩行アニメーション終了直後にリセットすると、フェードアウトの
// 途中で一瞬ズームが元に戻って見えてしまうバグがあったため
const DEPARTURE_BG_HOLD_MS = 1500;
const DEPARTURE_WALK_MS = 1250;
const DEPARTURE_FADEOUT_MS = 750;
const DEPARTURE_FADEOUT_DELAY_MS = 800; // ズーム開始から暗転フェードアウトが始まるまでの間(ユーザー指示で0.8秒遅らせた)
const DEPARTURE_FADEIN_MS = 500;
const DEPARTURE_BLACK_HOLD_MS = 1500;
function startDeparture(stage) {
  if (state.activePartyIds.length === 0) {
    alert("パーティを1人以上選んでください");
    return;
  }
  currentStage = stage;
  playSfx("departure");
  const departForestBtnEl = document.getElementById("departForestBtn");
  const departCoastBtnEl = document.getElementById("departCoastBtn");
  departForestBtnEl.disabled = true;
  departCoastBtnEl.disabled = true;
  const bodyPad = document.querySelector("#screen-party-select .body-pad");
  const heroTitle = document.querySelector("#partySelectHero h1");
  const heroInner = document.getElementById("partySelectHeroInner");
  bodyPad.style.display = "none";
  heroTitle.style.display = "none";
  setTimeout(() => {
    playSfx("footstep");
    const overlay = document.getElementById("moveTransitionBlack");
    overlay.style.display = "block";
    // 揺れ/ズームの歩行アニメーションはすぐ始めるが、暗転フェードアウトの開始だけ0.8秒遅らせる
    // (ユーザー指示で、ズームだけ先に見せてから暗転に入るよう間を空けた)
    const walkAnim = heroInner.animate(buildWalkKeyframes(), { duration: DEPARTURE_WALK_MS, easing: "ease-in-out", fill: "forwards" });
    setTimeout(() => {
      const fadeOut = overlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DEPARTURE_FADEOUT_MS, easing: "ease", fill: "forwards" });
      fadeOut.onfinish = () => {
        fadeOut.cancel();
        overlay.style.opacity = "1";
        walkAnim.cancel();
        heroInner.style.transform = "";
        setTimeout(() => {
          enterDungeon();
          departForestBtnEl.disabled = false;
          departCoastBtnEl.disabled = false;
          bodyPad.style.display = "";
          heroTitle.style.display = "";
          const fadeIn = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DEPARTURE_FADEIN_MS, easing: "ease", fill: "forwards" });
          fadeIn.onfinish = () => {
            fadeIn.cancel();
            overlay.style.opacity = "0";
            overlay.style.display = "none";
          };
        }, DEPARTURE_BLACK_HOLD_MS);
      };
    }, DEPARTURE_FADEOUT_DELAY_MS);
  }, DEPARTURE_BG_HOLD_MS);
}
// 出発前の最終確認: 選んだメンバーの一覧を見せてから、間違えて出発してしまわないようにする
let pendingDepartureStage = null;
function showDepartConfirm(stage) {
  if (state.activePartyIds.length === 0) {
    alert("パーティを1人以上選んでください");
    return;
  }
  pendingDepartureStage = stage;
  const list = document.getElementById("departConfirmList");
  list.innerHTML = "";
  state.activePartyIds.forEach((id) => {
    const c = getRosterChar(id);
    if (!c) return;
    const c2 = CLASSES[c.classId];
    const row = document.createElement("div");
    row.className = "card";
    row.style.cssText = "display:flex; align-items:center; gap:0.6rem;";
    row.innerHTML = `<img src="${characterPortraitSrc(c)}" style="width:44px;height:44px;object-fit:contain;background:#353a44;border-radius:6px;"><span>${c.name}(${c2.ja} Lv${c.level})</span>`;
    list.appendChild(row);
  });
  document.getElementById("departConfirmOverlay").style.display = "block";
}
document.getElementById("departForestBtn").onclick = () => showDepartConfirm("forest");
document.getElementById("departCoastBtn").onclick = () => showDepartConfirm("coast");
document.getElementById("departConfirmYesBtn").onclick = () => {
  document.getElementById("departConfirmOverlay").style.display = "none";
  startDeparture(pendingDepartureStage);
};
document.getElementById("departConfirmNoBtn").onclick = () => {
  document.getElementById("departConfirmOverlay").style.display = "none";
};

// ============ 温泉 ============
function renderOnsen() {
  playTownAreaBgm();
  updateSceneBackgrounds();
  renderDwHeader("onsen", "温泉", () => { renderTown(); });
  document.getElementById("onsenGold").textContent = state.gold + "G";
  const list = document.getElementById("onsenList");
  list.innerHTML = "";
  const bathable = state.roster.filter((c) => c.status === "active");
  if (bathable.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">入浴できる仲間がいません。</p>';
    return;
  }
  const now = absoluteGameMinutes();
  bathable.forEach((c) => {
    const c2 = CLASSES[c.classId];
    const cost = onsenCost(c.level);
    const noFatigue = (c.fatigue || 0) <= 0;
    // 【バグ修正】以前はここでisOnsenLocked()を確認していなかったため、入浴中(2時間ロック中)の
    // キャラでも「入る」ボタンが押せる状態のままになっており、再度タップするとuseOnsen()が
    // ロック期限を「今から2時間後」に上書きしてしまっていた(=見かけ上ロックが解除されて
    // 連続入浴できてしまうバグ)。他のキャラを入浴させたことが直接の原因ではなく、
    // この画面のボタン自体が最初からロック状態を見ていなかったのが根本原因
    const locked = isOnsenLocked(c, now);
    const disabled = locked || noFatigue || state.gold < cost;
    let label = `入る(${cost}G)`;
    if (locked) label = "入浴中";
    else if (noFatigue) label = "ストレスなし";
    const row = document.createElement("div");
    row.className = "roster-row";
    row.innerHTML = `
      <img src="${characterPortraitSrc(c)}">
      <div class="roster-info">
        <div class="roster-name">${c.name} <span class="status-tag ${locked ? "bathing" : "active"}">Lv.${c.level} ${c2.ja}</span></div>
        <div class="roster-sub">ストレス ${c.fatigue || 0}</div>
        <div class="fatigue-track" style="margin-top:0.25rem;"><div class="fatigue-fill" style="width:${c.fatigue || 0}%"></div></div>
      </div>
      <button class="big" ${disabled ? "disabled" : ""}>${label}</button>
    `;
    row.querySelector("button").onclick = () => {
      if (isOnsenLocked(c, absoluteGameMinutes())) return; // 二重タップ等での再ロック上書きを保険として防ぐ
      state.gold -= cost;
      useOnsen(c, absoluteGameMinutes());
      saveState();
      playSfx("onsen");
      renderOnsen();
    };
    list.appendChild(row);
  });
}
document.getElementById("onsenBackBtn").onclick = () => { renderTown(); };
document.getElementById("onsenBackBtnTop").onclick = () => { renderTown(); };

// ============ 温泉の売店(温泉卵) ============
const ONSEN_EGG_DAILY_STOCK = 2; // 売店の温泉卵は1日2個まで。翌朝(dayCountが変わったタイミング)に仕入れ直す
// dayCountが前回リセット時と変わっていたら、本日の販売数をリセットする(翌朝の仕入れ直し)
function resetOnsenEggStockIfNewDay() {
  if (state.onsenEggDailyDate !== state.dayCount) {
    state.onsenEggDailyCount = 0;
    state.onsenEggDailyDate = state.dayCount;
  }
}
function renderOnsenShop() {
  resetOnsenEggStockIfNewDay();
  document.getElementById("onsenShopGold").textContent = state.gold + "G";
  document.getElementById("onsenEggOwned").textContent = state.inventory.onsenEgg || 0;
  const total = (state.inventory.potion || 0) + (state.inventory.smokeBomb || 0) + (state.inventory.onsenEgg || 0) + (state.inventory.bomb || 0);
  const remaining = Math.max(0, ONSEN_EGG_DAILY_STOCK - (state.onsenEggDailyCount || 0));
  const buyBtn = document.getElementById("buyOnsenEggBtn");
  if (remaining <= 0) {
    buyBtn.textContent = "本日売り切れ";
    buyBtn.disabled = true;
  } else {
    buyBtn.textContent = `購入(${ITEMS.onsenEgg.price}G) 残り${remaining}個`;
    buyBtn.disabled = total >= supplyCap() || state.gold < ITEMS.onsenEgg.price;
  }
}
document.getElementById("buyOnsenEggBtn").onclick = () => {
  resetOnsenEggStockIfNewDay();
  if ((state.onsenEggDailyCount || 0) >= ONSEN_EGG_DAILY_STOCK) { alert("温泉卵は本日売り切れです(翌朝また仕入れます)"); return; }
  const total = (state.inventory.potion || 0) + (state.inventory.smokeBomb || 0) + (state.inventory.onsenEgg || 0) + (state.inventory.bomb || 0);
  if (total >= supplyCap()) { alert(`支援物資は最大${supplyCap()}個までしか持てません`); return; }
  if (state.gold < ITEMS.onsenEgg.price) { alert("お金が足りません"); return; }
  state.gold -= ITEMS.onsenEgg.price;
  state.inventory.onsenEgg = (state.inventory.onsenEgg || 0) + 1;
  state.onsenEggDailyCount = (state.onsenEggDailyCount || 0) + 1;
  saveState();
  playSfx("coin");
  renderOnsenShop();
};
document.getElementById("toOnsenShopBtn").onclick = () => { playSfx("select"); renderOnsenShop(); showScreen("screen-onsen-shop"); };
document.getElementById("onsenShopBackBtn").onclick = () => { renderOnsen(); showScreen("screen-onsen"); };
document.getElementById("onsenShopBackBtnTop").onclick = () => { renderOnsen(); showScreen("screen-onsen"); };

// ============ 増築 ============
// 新しく建築可能(houseLevelは足りたがまだ未建築)になった施設に「NEW」バッジを出す。
// 一度でもこの画面で表示されるとその場でseenUnlockedBuildingsに記録するため、次にこの画面を
// 開いた時にはもう出ない(「見た瞬間に消える」方式。建てるまで粘り強く出し続ける方式ではない)
function markBuildingNewBadge(stateKey, badgeId, unlocked, built) {
  const badge = document.getElementById(badgeId);
  const isNew = unlocked && !built && !state.seenUnlockedBuildings[stateKey];
  badge.style.display = isNew ? "" : "none";
  if (isNew) state.seenUnlockedBuildings[stateKey] = true;
}
// 施設一覧の説明文はタップで開閉する(静的HTMLのまま一度だけイベントを貼る。renderExtension()の
// たびに貼り直す必要はない)
document.querySelectorAll(".facility-toggle").forEach((el) => {
  el.onclick = () => { el.classList.toggle("open"); };
});
// 施設一覧を「建築可能/建築済み/未解放」の3グループへ分けて表示する。各施設のブロック
// (h2+説明+ボタンの3点セット)自体は元のまま、renderExtension()のたびに該当グループへ
// appendChildで移動させるだけ(要素を作り直さないのでイベントハンドラや開閉状態を保持できる)
const FACILITY_GROUP_DEFS = [
  { key: "magistrate", levelField: "magistrateLevel", unlock: MAGISTRATE_UNLOCK_HOUSE_LEVEL },
  { key: "shop", levelField: "shopLevel", unlock: SHOP_UNLOCK_HOUSE_LEVEL },
  { key: "travelPrepShop", levelField: "travelPrepShopLevel", unlock: TRAVEL_PREP_SHOP_UNLOCK_HOUSE_LEVEL },
  { key: "dojo", levelField: "dojoLevel", unlock: DOJO_UNLOCK_HOUSE_LEVEL },
  { key: "karakuri", levelField: "karakuriLevel", unlock: KARAKURI_UNLOCK_HOUSE_LEVEL },
  { key: "bagShop", levelField: "bagShopLevel", unlock: BAG_SHOP_UNLOCK_HOUSE_LEVEL },
  { key: "watchtower", levelField: "watchtowerLevel", unlock: WATCHTOWER_UNLOCK_HOUSE_LEVEL },
  { key: "henHouse", levelField: "henHouseLevel", unlock: HEN_HOUSE_UNLOCK_HOUSE_LEVEL },
  { key: "shrine", levelField: "shrineLevel", unlock: SHRINE_UNLOCK_HOUSE_LEVEL },
  { key: "hotSpringKeeper", levelField: "hotSpringKeeperLevel", unlock: HOT_SPRING_KEEPER_UNLOCK_HOUSE_LEVEL },
  { key: "gunpowderStore", levelField: "gunpowderStoreLevel", unlock: GUNPOWDER_STORE_UNLOCK_HOUSE_LEVEL },
  { key: "teaHouse", levelField: "teaHouseLevel", unlock: TEA_HOUSE_UNLOCK_HOUSE_LEVEL },
  { key: "stable", levelField: "stableLevel", unlock: STABLE_UNLOCK_HOUSE_LEVEL },
  { key: "beeFarm", levelField: "beeFarmLevel", unlock: BEE_FARM_UNLOCK_HOUSE_LEVEL },
  { key: "ferry", levelField: "ferryLevel", unlock: FERRY_UNLOCK_HOUSE_LEVEL },
];
["Available", "Built", "Locked"].forEach((name) => {
  const toggle = document.getElementById("facilityGroup" + name + "Toggle");
  const body = document.getElementById("facilityGroup" + name);
  toggle.onclick = () => {
    toggle.classList.toggle("open");
    body.classList.toggle("open");
  };
});
function groupFacilityBlocks(houseLevel) {
  const availEl = document.getElementById("facilityGroupAvailable");
  const builtEl = document.getElementById("facilityGroupBuilt");
  const lockedEl = document.getElementById("facilityGroupLocked");
  let availCount = 0, builtCount = 0, lockedCount = 0;
  FACILITY_GROUP_DEFS.forEach((def) => {
    const block = document.getElementById("facilityBlock-" + def.key);
    if (!block) return;
    const lv = state[def.levelField] || 0;
    if (lv > 0) { builtEl.appendChild(block); builtCount++; }
    else if (houseLevel >= def.unlock) { availEl.appendChild(block); availCount++; }
    else { lockedEl.appendChild(block); lockedCount++; }
  });
  document.getElementById("facilityGroupAvailableCount").textContent = `(${availCount})`;
  document.getElementById("facilityGroupBuiltCount").textContent = `(${builtCount})`;
  document.getElementById("facilityGroupLockedCount").textContent = `(${lockedCount})`;
}
function renderExtension() {
  playTownAreaBgm();
  updateSceneBackgrounds();
  renderDwHeader("extension", "増築", () => { renderTown(); });
  document.getElementById("extensionGold").textContent = state.gold + "G";
  const level = state.houseLevel || 1;
  document.getElementById("extensionLevel").textContent = level;
  document.getElementById("extensionCapacity").textContent = rosterCapacity();
  const btn = document.getElementById("extensionUpgradeBtn");
  if (level >= HOUSE_MAX_LEVEL) {
    btn.textContent = "これ以上は増築できません(上限)";
    btn.disabled = true;
  } else {
    const cost = houseUpgradeCost(level);
    btn.textContent = `増築する(${cost}G) 仲間上限 ${rosterCapacity()}→${rosterCapacity() + 1}人`;
    btn.disabled = state.gold < cost;
  }
  // 次の家レベルで解禁される施設があれば「→ 家レベルN 【解禁】◯◯」の形でプレビュー表示する
  const nextLevel = level + 1;
  const unlocksAtNextLevel = [];
  if ((state.dojoLevel || 0) === 0 && nextLevel === DOJO_UNLOCK_HOUSE_LEVEL) unlocksAtNextLevel.push("道場");
  if (!state.magistrateLevel && nextLevel === MAGISTRATE_UNLOCK_HOUSE_LEVEL) unlocksAtNextLevel.push("奉行所");
  if (!state.shopLevel && nextLevel === SHOP_UNLOCK_HOUSE_LEVEL) unlocksAtNextLevel.push("鍛冶屋");
  if (!state.travelPrepShopLevel && nextLevel === TRAVEL_PREP_SHOP_UNLOCK_HOUSE_LEVEL) unlocksAtNextLevel.push("旅支度屋");
  if (!state.bagShopLevel && nextLevel === BAG_SHOP_UNLOCK_HOUSE_LEVEL) unlocksAtNextLevel.push("鞄屋");
  if (!state.watchtowerLevel && nextLevel === WATCHTOWER_UNLOCK_HOUSE_LEVEL) unlocksAtNextLevel.push("見張り台");
  if (!state.stableLevel && nextLevel === STABLE_UNLOCK_HOUSE_LEVEL) unlocksAtNextLevel.push("馬屋");
  if (!state.henHouseLevel && nextLevel === HEN_HOUSE_UNLOCK_HOUSE_LEVEL) unlocksAtNextLevel.push("鶏小屋");
  if (!state.teaHouseLevel && nextLevel === TEA_HOUSE_UNLOCK_HOUSE_LEVEL) unlocksAtNextLevel.push("茶屋");
  if (!state.hotSpringKeeperLevel && nextLevel === HOT_SPRING_KEEPER_UNLOCK_HOUSE_LEVEL) unlocksAtNextLevel.push("湯守屋");
  if (!state.beeFarmLevel && nextLevel === BEE_FARM_UNLOCK_HOUSE_LEVEL) unlocksAtNextLevel.push("養蜂場");
  if (!state.shrineLevel && nextLevel === SHRINE_UNLOCK_HOUSE_LEVEL) unlocksAtNextLevel.push("神社");
  if (!state.gunpowderStoreLevel && nextLevel === GUNPOWDER_STORE_UNLOCK_HOUSE_LEVEL) unlocksAtNextLevel.push("火薬庫");
  if (!state.karakuriLevel && nextLevel === KARAKURI_UNLOCK_HOUSE_LEVEL) unlocksAtNextLevel.push("からくり屋敷");
  if (!state.ferryLevel && nextLevel === FERRY_UNLOCK_HOUSE_LEVEL) unlocksAtNextLevel.push("渡し船");
  const nextUnlockEl = document.getElementById("extensionNextUnlock");
  nextUnlockEl.textContent = unlocksAtNextLevel.length > 0 && level < HOUSE_MAX_LEVEL
    ? `→ 家レベル${nextLevel} 【解禁】${unlocksAtNextLevel.join("・")}`
    : "";
  const dojoLevel = state.dojoLevel || 0;
  const dojoBtn = document.getElementById("dojoBuildBtn");
  const dojoLocked = dojoLevel === 0 && level < DOJO_UNLOCK_HOUSE_LEVEL;
  if (dojoLocked) {
    dojoBtn.textContent = `家レベル${DOJO_UNLOCK_HOUSE_LEVEL}で解禁されます`;
    dojoBtn.disabled = true;
  } else if (dojoLevel >= DOJO_MAX_LEVEL) {
    dojoBtn.textContent = "これ以上は増築できません(上限)";
    dojoBtn.disabled = true;
  } else if (dojoLevel === 0) {
    dojoBtn.textContent = `建築する(${DOJO_LEVEL1_COST}G)`;
    dojoBtn.disabled = state.gold < DOJO_LEVEL1_COST;
  } else {
    dojoBtn.textContent = `増築する(${DOJO_LEVEL2_COST}G) 分け前${Math.round(DOJO_XP_SHARE_BY_LEVEL[dojoLevel] * 100)}%→${Math.round(DOJO_XP_SHARE_BY_LEVEL[dojoLevel + 1] * 100)}%`;
    dojoBtn.disabled = state.gold < DOJO_LEVEL2_COST;
  }
  markBuildingNewBadge("dojoLevel", "dojoNewBadge", level >= DOJO_UNLOCK_HOUSE_LEVEL, dojoLevel >= 1);
  renderSimpleBuilding("magistrateLevel", "magistrateBuildBtn", MAGISTRATE_UNLOCK_HOUSE_LEVEL, MAGISTRATE_COST, level, "magistrateNewBadge");
  renderSimpleBuilding("shopLevel", "shopBuildBtn", SHOP_UNLOCK_HOUSE_LEVEL, SHOP_COST, level, "shopNewBadge");
  renderSimpleBuilding("travelPrepShopLevel", "travelPrepShopBuildBtn", TRAVEL_PREP_SHOP_UNLOCK_HOUSE_LEVEL, TRAVEL_PREP_SHOP_COST, level, "travelPrepShopNewBadge");
  renderSimpleBuilding("bagShopLevel", "bagShopBuildBtn", BAG_SHOP_UNLOCK_HOUSE_LEVEL, BAG_SHOP_LEVEL1_COST, level, "bagShopNewBadge");
  renderSimpleBuilding("watchtowerLevel", "watchtowerBuildBtn", WATCHTOWER_UNLOCK_HOUSE_LEVEL, WATCHTOWER_COST, level, "watchtowerNewBadge");
  renderSimpleBuilding("henHouseLevel", "henHouseBuildBtn", HEN_HOUSE_UNLOCK_HOUSE_LEVEL, HEN_HOUSE_COST, level, "henHouseNewBadge");
  renderSimpleBuilding("shrineLevel", "shrineBuildBtn", SHRINE_UNLOCK_HOUSE_LEVEL, SHRINE_COST, level, "shrineNewBadge");
  renderSimpleBuilding("gunpowderStoreLevel", "gunpowderStoreBuildBtn", GUNPOWDER_STORE_UNLOCK_HOUSE_LEVEL, GUNPOWDER_STORE_COST, level, "gunpowderStoreNewBadge");
  renderSimpleBuilding("karakuriLevel", "karakuriBuildBtn", KARAKURI_UNLOCK_HOUSE_LEVEL, KARAKURI_COST, level, "karakuriNewBadge");
  renderSimpleBuilding("hotSpringKeeperLevel", "hotSpringKeeperBuildBtn", HOT_SPRING_KEEPER_UNLOCK_HOUSE_LEVEL, HOT_SPRING_KEEPER_COST, level, "hotSpringKeeperNewBadge");
  renderSimpleBuilding("teaHouseLevel", "teaHouseBuildBtn", TEA_HOUSE_UNLOCK_HOUSE_LEVEL, TEA_HOUSE_COST, level, "teaHouseNewBadge");
  renderSimpleBuilding("stableLevel", "stableBuildBtn", STABLE_UNLOCK_HOUSE_LEVEL, STABLE_COST, level, "stableNewBadge");
  renderSimpleBuilding("beeFarmLevel", "beeFarmBuildBtn", BEE_FARM_UNLOCK_HOUSE_LEVEL, BEE_FARM_COST, level, "beeFarmNewBadge");
  renderSimpleBuilding("ferryLevel", "ferryBuildBtn", FERRY_UNLOCK_HOUSE_LEVEL, FERRY_COST, level, "ferryNewBadge");
  groupFacilityBlocks(level);
  saveState();
}
// 奉行所/鞄屋/見張り台/馬屋は全て「家レベルで解禁→1回建築したら終わり(レベル1のみ)」という
// 同じ形の建物なので、表示更新の共通処理をまとめている
function renderSimpleBuilding(stateKey, btnId, unlockHouseLevel, cost, houseLevel, badgeId) {
  const built = (state[stateKey] || 0) >= 1;
  const btn = document.getElementById(btnId);
  const unlocked = houseLevel >= unlockHouseLevel;
  if (!built && !unlocked) {
    btn.textContent = `家レベル${unlockHouseLevel}で解禁されます`;
    btn.disabled = true;
  } else if (built) {
    btn.textContent = "建築済み";
    btn.disabled = true;
  } else {
    btn.textContent = `建築する(${cost}G)`;
    btn.disabled = state.gold < cost;
  }
  if (badgeId) markBuildingNewBadge(stateKey, badgeId, unlocked, built);
}
function buildSimpleBuilding(stateKey, unlockHouseLevel, cost) {
  const built = (state[stateKey] || 0) >= 1;
  const houseLevel = state.houseLevel || 1;
  if (built || houseLevel < unlockHouseLevel || state.gold < cost) return;
  state.gold -= cost;
  state[stateKey] = 1;
  saveState();
  playSfx("extension_build");
  renderExtension();
}
document.getElementById("extensionUpgradeBtn").onclick = () => {
  const level = state.houseLevel || 1;
  if (level >= HOUSE_MAX_LEVEL) return;
  const cost = houseUpgradeCost(level);
  if (state.gold < cost) return;
  state.gold -= cost;
  state.houseLevel = level + 1;
  saveState();
  playSfx("extension_build");
  renderExtension();
};
document.getElementById("dojoBuildBtn").onclick = () => {
  const dojoLevel = state.dojoLevel || 0;
  if (dojoLevel >= DOJO_MAX_LEVEL) return;
  if (dojoLevel === 0 && (state.houseLevel || 1) < DOJO_UNLOCK_HOUSE_LEVEL) return;
  const cost = dojoLevel === 0 ? DOJO_LEVEL1_COST : DOJO_LEVEL2_COST;
  if (state.gold < cost) return;
  state.gold -= cost;
  state.dojoLevel = dojoLevel + 1;
  saveState();
  playSfx("extension_build");
  renderExtension();
};
document.getElementById("magistrateBuildBtn").onclick = () => buildSimpleBuilding("magistrateLevel", MAGISTRATE_UNLOCK_HOUSE_LEVEL, MAGISTRATE_COST);
document.getElementById("shopBuildBtn").onclick = () => buildSimpleBuilding("shopLevel", SHOP_UNLOCK_HOUSE_LEVEL, SHOP_COST);
document.getElementById("travelPrepShopBuildBtn").onclick = () => buildSimpleBuilding("travelPrepShopLevel", TRAVEL_PREP_SHOP_UNLOCK_HOUSE_LEVEL, TRAVEL_PREP_SHOP_COST);
document.getElementById("bagShopBuildBtn").onclick = () => buildSimpleBuilding("bagShopLevel", BAG_SHOP_UNLOCK_HOUSE_LEVEL, BAG_SHOP_LEVEL1_COST);
document.getElementById("watchtowerBuildBtn").onclick = () => buildSimpleBuilding("watchtowerLevel", WATCHTOWER_UNLOCK_HOUSE_LEVEL, WATCHTOWER_COST);
document.getElementById("stableBuildBtn").onclick = () => buildSimpleBuilding("stableLevel", STABLE_UNLOCK_HOUSE_LEVEL, STABLE_COST);
document.getElementById("henHouseBuildBtn").onclick = () => buildSimpleBuilding("henHouseLevel", HEN_HOUSE_UNLOCK_HOUSE_LEVEL, HEN_HOUSE_COST);
document.getElementById("teaHouseBuildBtn").onclick = () => buildSimpleBuilding("teaHouseLevel", TEA_HOUSE_UNLOCK_HOUSE_LEVEL, TEA_HOUSE_COST);
document.getElementById("hotSpringKeeperBuildBtn").onclick = () => buildSimpleBuilding("hotSpringKeeperLevel", HOT_SPRING_KEEPER_UNLOCK_HOUSE_LEVEL, HOT_SPRING_KEEPER_COST);
document.getElementById("beeFarmBuildBtn").onclick = () => buildSimpleBuilding("beeFarmLevel", BEE_FARM_UNLOCK_HOUSE_LEVEL, BEE_FARM_COST);
document.getElementById("shrineBuildBtn").onclick = () => buildSimpleBuilding("shrineLevel", SHRINE_UNLOCK_HOUSE_LEVEL, SHRINE_COST);
document.getElementById("gunpowderStoreBuildBtn").onclick = () => buildSimpleBuilding("gunpowderStoreLevel", GUNPOWDER_STORE_UNLOCK_HOUSE_LEVEL, GUNPOWDER_STORE_COST);
document.getElementById("karakuriBuildBtn").onclick = () => buildSimpleBuilding("karakuriLevel", KARAKURI_UNLOCK_HOUSE_LEVEL, KARAKURI_COST);
document.getElementById("ferryBuildBtn").onclick = () => buildSimpleBuilding("ferryLevel", FERRY_UNLOCK_HOUSE_LEVEL, FERRY_COST);
document.getElementById("toExtensionBtn").onclick = () => { playSfx("select"); renderExtension(); showScreen("screen-extension"); };
document.getElementById("toMagistrateBtn").onclick = () => { playSfx("select"); renderMagistrateScreen(); };
document.getElementById("extensionBackBtn").onclick = () => { renderTown(); };
document.getElementById("extensionBackBtnTop").onclick = () => { renderTown(); };

// ============ 奉行所: 討伐依頼(日替わり・受注制) ============
// 全10件を一度に出さず、最大QUEST_BOARD_SIZE件だけ毎日ランダムに選び直す。dayCountが変わるまでは
// 同じ顔ぶれを維持し、変わった瞬間に新しい顔ぶれへ入れ替える。受注制のため、この一覧自体は
// idの配列だけを持てばよく(進捗は受注中の1件=state.acceptedQuestだけが持つ)。
// 受注中の依頼だけは入れ替え対象から除外し、それ以外の枠だけ毎日ローテーションする。
// 1件目は確定、2件目/3件目はそれぞれ抽選(外れたらそこで打ち切り、3件目だけ出るような逆転はしない)。
// 一度張り出された依頼はQUEST_COOLDOWN_DAYS日の間、再抽選の候補から外れる
function refreshMagistrateQuestsIfNeeded() {
  if (state.magistrateQuestDate === state.dayCount && state.magistrateAvailableQuests && state.magistrateAvailableQuests.length > 0) return;
  const keepKey = state.acceptedQuest ? state.acceptedQuest.questKey : null;
  const lastShown = state.magistrateQuestLastShown || {};
  const pool = Object.keys(QUEST_DEFS).filter((id) => {
    if (id === keepKey) return false; // 受注中のものは既に確定枠なので通常抽選プールには含めない
    const shownDay = lastShown[id];
    return shownDay == null || (state.dayCount - shownDay) >= QUEST_COOLDOWN_DAYS;
  });
  const picked = keepKey ? [keepKey] : [];
  const slotChances = [1.0, QUEST_BOARD_SECOND_SLOT_CHANCE, QUEST_BOARD_THIRD_SLOT_CHANCE];
  for (let i = picked.length; i < QUEST_BOARD_SIZE && pool.length > 0; i++) {
    const chance = slotChances[i] != null ? slotChances[i] : 1.0;
    if (Math.random() >= chance) break;
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  picked.forEach((id) => { if (id !== keepKey) lastShown[id] = state.dayCount; });
  state.magistrateQuestLastShown = lastShown;
  state.magistrateAvailableQuests = picked;
  state.magistrateQuestDate = state.dayCount;
}
// 依頼の期限切れ判定。tickCriticalExpiryと同じく、実時間(絶対分数)ベースで期限を過ぎていないか
// 確認する。過ぎていたら強制的に取り下げ(契約金は没収)、「間に合いませんでした」のポップアップを出す
function checkQuestDeadline() {
  const q = state.acceptedQuest;
  if (!q || q.expireMinutes == null) return;
  if (absoluteGameMinutes() <= q.expireMinutes) return;
  const def = QUEST_DEFS[q.questKey];
  state.acceptedQuest = null;
  saveState();
  showConfirmModal(`依頼「${def ? def.title : ""}」は期限までに完了できませんでした…間に合いませんでした。`, [{ label: "OK", className: "big" }]);
}
// 緊急依頼(序盤ボス級の指名討伐)。モンハン風に、通常の討伐依頼をEMERGENCY_QUEST_CLEAR_THRESHOLD件
// クリア(報酬受け取り)するたびに1件発生する。既に進行中(未達成)の緊急依頼がある間は増発しない。
// 一番最初に発生する緊急依頼は必ず荒熊、以降はランダムに選ぶ
function maybeTriggerEmergencyQuest() {
  if (state.emergencyQuest && !state.emergencyQuest.claimed) return;
  if (!state.defeatedOoInoshishi) return; // 大猪を一度も倒していない間は解禁されない
  if (state.magistrateNormalClears < EMERGENCY_QUEST_CLEAR_THRESHOLD) return;
  state.magistrateNormalClears -= EMERGENCY_QUEST_CLEAR_THRESHOLD;
  const ids = Object.keys(EMERGENCY_QUEST_DEFS);
  const id = state.emergencyQuestEverAppeared ? ids[Math.floor(Math.random() * ids.length)] : "q_arakuma";
  state.emergencyQuest = { enemyId: id, kills: 0, claimed: false };
  state.emergencyQuestEverAppeared = true;
}
// 破綻寸前パーティ救済クエスト(薬草摘み)の張り出し条件。既に受注中なら現在の所持金/人数に
// 関わらず表示し続ける(受注後に持ち直しても、進行中のクエストを取り上げたりはしない)
function rescueQuestAvailable() {
  const activeCount = state.roster.filter((c) => c.status === "active").length;
  return state.gold <= RESCUE_QUEST_GOLD_THRESHOLD && activeCount <= RESCUE_QUEST_MAX_ACTIVE_MEMBERS;
}
function acceptRescueQuest() {
  if (state.rescueQuestAccepted) return;
  state.rescueQuestAccepted = true;
  state.rescueQuestItemObtained = false;
  saveState();
  playSfx("select");
  renderMagistrateScreen();
}
function renderMagistrateScreen() {
  playTownAreaBgm();
  updateSceneBackgrounds();
  renderDwHeader("magistrate", "奉行所", () => { renderTown(); });
  refreshMagistrateQuestsIfNeeded();
  maybeTriggerEmergencyQuest(); // 前回の受け取り時点でしきい値に達していた場合の保険
  saveState();
  const list = document.getElementById("magistrateQuestList");
  list.innerHTML = "";
  if (state.rescueQuestAccepted || rescueQuestAvailable()) {
    const rDef = RESCUE_QUEST_DEF;
    const row = document.createElement("div");
    row.className = "card";
    row.style.border = "1px solid var(--hp)";
    row.innerHTML = `
      <div class="roster-name" style="color:var(--hp);">${rDef.emoji}${rDef.title}</div>
      <p style="font-size:13px;color:var(--dw-caption-color);margin:0.3rem 0;">依頼者: ${rDef.requester}</p>
      <p style="font-size:0.8rem;margin:0 0 0.5rem;">${rDef.text}</p>
      <p style="font-size:0.8rem;">深淵の森 ${rDef.targetFloor}層目まで到達すると${rDef.itemName}が手に入ります。持ち帰ってください。</p>
    `;
    const rBtn = document.createElement("button");
    rBtn.style.marginTop = "0.5rem";
    if (state.rescueQuestAccepted) {
      rBtn.className = "big";
      rBtn.textContent = state.rescueQuestItemObtained ? `${rDef.itemName}を手に里へ戻ろう` : "依頼を進行中です";
      rBtn.disabled = true;
    } else {
      rBtn.className = "big primary";
      rBtn.textContent = `受注する(報酬${rDef.rewardGold}G)`;
      rBtn.onclick = () => acceptRescueQuest();
    }
    row.appendChild(rBtn);
    list.appendChild(row);
  }
  if (state.emergencyQuest) {
    const eq = state.emergencyQuest;
    const eDef = EMERGENCY_QUEST_DEFS[eq.enemyId];
    const eDone = eq.kills >= 1;
    const row = document.createElement("div");
    row.className = "card";
    row.style.border = "1px solid var(--danger)";
    row.innerHTML = `
      <div class="roster-name" style="color:#f0d43a;">${eDef.emoji}${eDef.title}</div>
      <p style="font-size:13px;color:var(--dw-caption-color);margin:0.3rem 0;">依頼者: ${eDef.requester}</p>
      <p style="font-size:0.8rem;margin:0 0 0.5rem;">${eDef.text}</p>
      <p style="font-size:0.8rem;">討伐状況: ${eDone ? "討伐済み" : "未討伐"}</p>
    `;
    const eBtn = document.createElement("button");
    eBtn.style.marginTop = "0.5rem";
    if (eq.claimed) {
      eBtn.className = "big";
      eBtn.textContent = "報酬受け取り済み";
      eBtn.disabled = true;
    } else if (!eDone) {
      eBtn.className = "big";
      eBtn.textContent = "討伐を進めよう";
      eBtn.disabled = true;
    } else {
      eBtn.className = "big primary";
      eBtn.textContent = `報酬を受け取る(${EMERGENCY_QUEST_REWARD_GOLD}G / XP${EMERGENCY_QUEST_REWARD_XP})`;
      eBtn.onclick = () => claimEmergencyQuest();
    }
    row.appendChild(eBtn);
    list.appendChild(row);
  }
  state.magistrateAvailableQuests.forEach((id) => {
    const def = QUEST_DEFS[id];
    const isAccepted = state.acceptedQuest && state.acceptedQuest.questKey === id;
    const fee = questContractFee(def);
    const row = document.createElement("div");
    row.className = "card";
    let deadlineHtml = "";
    if (isAccepted && state.acceptedQuest.expireMinutes != null) {
      const daysLeft = Math.max(0, Math.ceil((state.acceptedQuest.expireMinutes - absoluteGameMinutes()) / (24 * 60)));
      deadlineHtml = `<p style="font-size:0.75rem;color:var(--danger);margin:0.3rem 0 0;">期限: あと${daysLeft}日</p>`;
    }
    row.innerHTML = `
      <div class="roster-name">${def.emoji}${def.title}</div>
      <p style="font-size:13px;color:var(--dw-caption-color);margin:0.3rem 0;">依頼者: ${def.requester} <span style="font-size:0.68rem;">(契約金${fee}G)</span></p>
      <p style="font-size:0.8rem;margin:0 0 0.5rem;">${def.text}</p>
      <p style="font-size:0.8rem;">深淵の森 ${def.targetFloor}層目に到達すると対象が現れます。</p>
      ${deadlineHtml}
    `;
    const btn = document.createElement("button");
    btn.style.marginTop = "0.5rem";
    if (isAccepted) {
      btn.className = "big danger";
      btn.textContent = "依頼を取り下げる(契約金没収)";
      btn.onclick = () => abandonQuest();
    } else if (state.acceptedQuest) {
      btn.className = "big";
      btn.textContent = "他の依頼を進行中です";
      btn.disabled = true;
    } else {
      // 所持金不足の時、以前はボタンをdisabledにして押せなくしていたが、見た目の変化が地味で
      // 「押しても反応しない=壊れている」と誤解される不具合報告があったため、押せる状態のまま残し、
      // タップした瞬間にアラートで理由をはっきり伝える方式に変更した
      btn.className = "big primary";
      btn.textContent = `受注する(報酬 ${questGoldReward(def)}G${QUEST_REWARD_XP > 0 ? ` / XP${QUEST_REWARD_XP}` : ""})`;
      btn.onclick = () => {
        if (state.gold < fee) { alert(`契約金が足りません(あと${fee - state.gold}G不足)`); return; }
        acceptQuest(id);
      };
    }
    row.appendChild(btn);
    list.appendChild(row);
  });
  showScreen("screen-magistrate");
}
// 依頼は同時に1件までしか受けられない。受注するとその依頼の対象フロアに到達した時、
// 確定でその群れと戦闘になる(tryForceQuestEncounter参照)。倒すと即達成、報酬は
// 帰還後のリザルト画面で表示する(victory()参照)。spawnIdが設定されている依頼(猪→大猪)は
// 実際にスポーンする個体が依頼の見た目(id)と異なるため、questKey(依頼自体の識別用)と
// enemyId(実際にスポーンさせる敵の種族id)を分けて持たせている
function acceptQuest(enemyId) {
  if (state.acceptedQuest) return;
  const def = QUEST_DEFS[enemyId];
  const fee = questContractFee(def);
  if (state.gold < fee) return;
  state.gold -= fee; // 契約金は前払い。達成時に全額返還、失敗/取り下げ時は没収される
  state.acceptedQuest = {
    questKey: enemyId, enemyId: def.spawnId || enemyId, targetFloor: def.targetFloor, count: def.count, chasing: false,
    contractFee: fee, expireMinutes: absoluteGameMinutes() + QUEST_DEADLINE_DAYS * 24 * 60,
  };
  saveState();
  playQuestAcceptStamp(def.title, () => { renderMagistrateScreen(); });
}
// 取り下げは契約金を返還しない(没収)。期限切れ(checkQuestDeadline)も同様に没収扱いになる
function abandonQuest() {
  state.acceptedQuest = null;
  saveState();
  renderMagistrateScreen();
}
function claimEmergencyQuest() {
  const eq = state.emergencyQuest;
  if (!eq || eq.claimed || eq.kills < 1) return;
  eq.claimed = true;
  state.gold += EMERGENCY_QUEST_REWARD_GOLD;
  const leveledUp = [];
  state.roster.filter((c) => c.status === "active").forEach((c) => {
    const beforeLevel = c.level;
    grantXp(c, EMERGENCY_QUEST_REWARD_XP, () => {});
    for (let lv = beforeLevel + 1; lv <= c.level; lv++) leveledUp.push({ character: c, level: lv });
  });
  queueSkillChoices(leveledUp);
  saveState();
  playSfx("coin");
  renderMagistrateScreen();
}
document.getElementById("magistrateBackBtnTop").onclick = () => { renderTown(); };
document.getElementById("magistrateBackBtn").onclick = () => { renderTown(); };

// ゲームオーバー画面の「最初から」: セーブを消してページごと再読み込みし、完全に初期状態からやり直す
document.getElementById("gameoverRestartBtn").onclick = () => {
  localStorage.removeItem(SAVE_KEY);
  location.reload();
};

// ============ 道具屋 ============
function renderShop() {
  playTownAreaBgm();
  updateSceneBackgrounds();
  renderDwHeader("shop", "鍛冶屋", () => { renderTown(); });
  document.getElementById("shopGold").textContent = state.gold + "G";
  renderEquipmentList();
}

function equipRowHtml(classId, slot, slotLabel) {
  const tiers = EQUIPMENT[classId][slot];
  state.classUpgrades[classId] = state.classUpgrades[classId] || { weapon: 0, armor: 0 };
  const ownedTier = state.classUpgrades[classId][slot] || 0;
  const ownedName = ownedTier > 0 ? tiers[ownedTier - 1].name : "なし";
  const slotIcon = `<span class="btn-icon">${slot === "armor" ? ICONS.def : ICONS.atk}</span>`;
  if (ownedTier >= tiers.length) {
    return `<div class="equip-row"><div class="equip-row-info"><strong>${slotIcon}${slotLabel}: ${ownedName}</strong> <span class="desc">最大強化済み</span></div></div>`;
  }
  const next = tiers[ownedTier];
  const statLabel = next.statKey === "mag" ? "魔力" : next.statKey === "def" ? "防御力" : "攻撃力";
  const levelOk = classHasReachedLevel(state.roster, classId, next.level);
  const goldOk = state.gold >= next.price;
  const disabled = !levelOk || !goldOk;
  const reason = !levelOk ? `Lv${next.level}到達で解禁` : (!goldOk ? "お金が足りません" : "");
  const mpNote = slot === "armor" ? "、MP上限+2" : "";
  return `
    <div class="equip-row">
      <div class="equip-row-info">
        <strong>${slotIcon}${slotLabel}: ${ownedName} → ${next.name}</strong>
        <span class="desc">${statLabel}+${next.bonus}${mpNote} ${!levelOk ? `/ ${reason}` : ""}</span>
      </div>
      <button class="big" data-class="${classId}" data-slot="${slot}" ${disabled ? "disabled" : ""}>${next.price}G</button>
    </div>
  `;
}

function renderEquipmentList() {
  const wrap = document.getElementById("equipmentList");
  wrap.innerHTML = "";
  // まだ名簿に1人もいない職業の武器/防具アップグレード欄は表示しない(仲間にしてから初めて出す)
  Object.keys(CLASSES).filter((classId) => state.roster.some((c) => c.classId === classId)).forEach((classId) => {
    const c2 = CLASSES[classId];
    const card = document.createElement("div");
    card.className = "equip-class-card";
    card.innerHTML = `
      <div class="equip-class-title"><img src="${c2.image}" data-class="${classId}">${c2.ja}</div>
      ${equipRowHtml(classId, "weapon", "武器")}
      ${equipRowHtml(classId, "armor", "防具")}
    `;
    card.querySelectorAll("button[data-slot]").forEach((btn) => {
      btn.onclick = () => buyEquipment(btn.dataset.class, btn.dataset.slot);
    });
    wrap.appendChild(card);
  });
}

function buyEquipment(classId, slot) {
  const tiers = EQUIPMENT[classId][slot];
  state.classUpgrades[classId] = state.classUpgrades[classId] || { weapon: 0, armor: 0 };
  const ownedTier = state.classUpgrades[classId][slot] || 0;
  if (ownedTier >= tiers.length) return;
  const next = tiers[ownedTier];
  if (!classHasReachedLevel(state.roster, classId, next.level)) { alert(`Lv${next.level}に到達した${CLASSES[classId].ja}が必要です`); return; }
  if (state.gold < next.price) { alert("お金が足りません"); return; }
  state.gold -= next.price;
  state.classUpgrades[classId][slot] = ownedTier + 1;
  refreshEquipBonus(state.roster, classId, state.classUpgrades);
  saveState();
  playSfx("coin");
  renderShop();
  const purchasedImg = document.querySelector(`#equipmentList img[data-class="${classId}"]`);
  if (purchasedImg) retriggerEntryAnim(purchasedImg, "purchase-glint");
}
document.getElementById("shopBackBtn").onclick = () => { renderTown(); };
document.getElementById("shopBackBtnTop").onclick = () => { renderTown(); };

// ============ 初期化 ============
// ゲームの入口は常にタイトル画面(title.js)。ここでの自動遷移は廃止した。
