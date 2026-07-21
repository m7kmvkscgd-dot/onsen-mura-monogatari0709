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
    ["shopLevel", SHOP_UNLOCK_HOUSE_LEVEL], ["ryodankiLevel", RYODANKI_UNLOCK_HOUSE_LEVEL],
  ];
  return checks.some(([key, unlockLevel]) => level >= unlockLevel && !(state[key] || 0) && !state.seenUnlockedBuildings[key]);
}
// 建物を建てただけで終わらず、その先の新しい導線(温泉の神社タブ、出発準備画面の野営具/爆弾)まで
// ちゃんとたどり着けるよう、覗き見用のチェックを町のボタンにも出す(state は書き換えない)
function hasAnyNewOnsenFeature() {
  return (state.shrineLevel || 0) > 0 && !state.seenShrineTab;
}
function hasAnyNewSupplyFeature() {
  return (state.travelPrepShopLevel || 0) > 0 && !state.seenCampingKitSupply;
}

// チュートリアル機能は2026-07-18のユーザー指示で全削除した(作り直し前提の一時撤去)

// ============ 施設(建築/奉行所/鍛冶屋、温泉の売店/神社)の戻り先を動的に覚える仕組み ============
// 建築(screen-extension)/奉行所(screen-magistrate)/鍛冶屋(screen-shop)は元々温泉村(または
// 出発準備画面)専用で、戻る先が常に固定だった。海の村/山伏の里からも同じ画面(=同じ経済、
// 建物レベルや依頼は全村共通)を開けるようにするため、title.jsのsettingsReturnScreenId
// (設定画面をタイトル/町どちらから開いても正しく戻れるようにする仕組み)と同じパターンで、
// 開く直前の画面を覚えておいて「戻る」がそこへ戻るようにする
let facilityHomeScreen = "screen-town"; // "screen-town" | "screen-umimura" | "screen-yamabushi" | "screen-party-select" | "screen-village-prep"
function renderFacilityHome() {
  if (facilityHomeScreen === "screen-umimura") { renderUmiMura(); showScreen("screen-umimura"); }
  else if (facilityHomeScreen === "screen-yamabushi") { renderYamabushi(); showScreen("screen-yamabushi"); }
  else if (facilityHomeScreen === "screen-party-select") { renderPartySelect(); showScreen("screen-party-select"); }
  // screen-village-prep(海の村/山伏の里の出発準備画面)からチップ経由で鍛冶屋等を開いた時の戻り先。
  // destinations省略で呼んでも直前の行き先ボタンをvillagePrepDestinationsから復元してくれる(ui.js参照)
  else if (facilityHomeScreen === "screen-village-prep") { renderVillagePrep(); showScreen("screen-village-prep"); }
  else { renderTown(); }
}
// 温泉配下の売店/神社も同様(温泉自体は村ごとに専用画面を持つため、温泉村/海の村/山伏の里の
// 温泉のうちどこから開かれたかを覚える)
let facilityHomeOnsenScreen = "screen-onsen"; // "screen-onsen" | "screen-umionsen" | "screen-yamabushionsen"
function renderFacilityHomeOnsen() {
  if (facilityHomeOnsenScreen === "screen-umionsen") { renderUmiOnsen(); showScreen("screen-umionsen"); }
  else if (facilityHomeOnsenScreen === "screen-yamabushionsen") { renderYamabushiOnsen(); showScreen("screen-yamabushionsen"); }
  else { renderOnsen(); showScreen("screen-onsen"); }
}

function renderTown() {
  // HP/MPは町では自動回復しない(宿屋で宿泊した仲間だけが回復する)
  pruneActiveParty();
  refillHenHouseEggPouchIfNewDay();
  saveState();
  if (checkGameOver()) return;
  document.getElementById("townGold").textContent = (debugNoEncounters ? "🚫" : "") + state.gold + "G";
  document.getElementById("townDateLabel").textContent = formatGameDate(state.dayCount);
  document.getElementById("townTimeLabel").textContent = `${TIME_PHASE_LABEL[state.timeOfDay || "day"]} ${formatClockTime(state.clockMinutes)}`;
  document.getElementById("toMagistrateBtn").style.display = state.magistrateLevel ? "" : "none";
  // 鍛冶屋ボタンは出発準備画面へ移設(2026-07-18)。表示切替はrenderPartySelect側で行う
  document.getElementById("tavernNewBadge").style.display = hasAnyNewClass() ? "" : "none";
  document.getElementById("extensionTownNewBadge").style.display = hasAnyNewBuilding() ? "" : "none";
  document.getElementById("onsenTownNewBadge").style.display = hasAnyNewOnsenFeature() ? "" : "none";
  document.getElementById("dungeonTownNewBadge").style.display = hasAnyNewSupplyFeature() ? "" : "none";
  playTownAreaBgm();
  updateSceneBackgrounds();
  showScreen("screen-town");
  checkOnsenReliefPopups(); // 入浴ロックが明けたキャラがいれば「リラックスできた！」ポップアップを出す(町画面限定)
}

// ============ 温泉の入浴完了ポップアップ ============
// 入浴後、翌朝のロックが明けた瞬間にストレスを減らす演出。探索/戦闘パートでは呼ばれない
// (renderTown()からのみ呼ぶ)ため、仕様通り町画面に戻ってきた時だけ表示される。
// バーの減少アニメーションが始まるまでの間(キャラを見せるだけの間)
const ONSEN_RELIEF_REVEAL_DELAY_MS = 800;
// バー自体が減っていくアニメーションの所要時間
const ONSEN_RELIEF_BAR_ANIM_MS = 1000;
function checkOnsenReliefPopups() {
  const entries = collectReadyOnsenReliefs(state.roster, absoluteGameMinutes());
  if (entries.length === 0) return;
  saveState();
  showOnsenReliefOverlay(entries);
}
function showOnsenReliefOverlay(entries) {
  const list = document.getElementById("onsenReliefList");
  list.innerHTML = entries.map((e) => `
    <div class="onsen-relief-row">
      <img src="${CLASS_ONSEN_RELIEF_IMAGE[e.classId]}" class="onsen-relief-img">
      <div class="onsen-relief-info">
        <div class="onsen-relief-name">${e.name}</div>
        <div class="fatigue-track"><div class="fatigue-fill" data-onsen-relief-bar data-from="${e.before}" data-target="${e.after}" style="width:${e.before}%"></div></div>
        <div class="onsen-relief-stress">ストレス -${e.before - e.after}</div>
      </div>
    </div>
  `).join("");
  document.getElementById("onsenReliefOverlay").style.display = "flex";
  playSfx("onsen_relief");
  setTimeout(() => activateOnsenReliefBars(list), ONSEN_RELIEF_REVEAL_DELAY_MS);
  document.getElementById("onsenReliefCloseBtn").onclick = () => {
    document.getElementById("onsenReliefOverlay").style.display = "none";
  };
}
function activateOnsenReliefBars(container) {
  container.querySelectorAll("[data-onsen-relief-bar]").forEach((el) => {
    const from = Number(el.dataset.from);
    const target = Number(el.dataset.target);
    if (from === target) return;
    const anim = el.animate([{ width: `${from}%` }, { width: `${target}%` }], { duration: ONSEN_RELIEF_BAR_ANIM_MS, easing: "ease-out", fill: "forwards" });
    anim.onfinish = () => { anim.cancel(); el.style.width = `${target}%`; };
  });
}

// ============ 開発者モード(町の時刻表示を5回連続タップで即発動) ============
// 以前はパネルを開いて所持金/レベルを個別入力する方式だったが、ユーザー指示により廃止。
// 今はタップした瞬間に無条件で「所持金9999・名簿全員Lv10」を即適用するだけのワンショットな仕様
let devTapCount = 0;
let devTapLastAt = 0;
const DEV_TAP_REQUIRED = 5;
const DEV_TAP_WINDOW_MS = 600; // タップ間隔がこれを超えたらカウントをリセットする
function handleDevTimeLabelTap() {
  const now = Date.now();
  devTapCount = (now - devTapLastAt <= DEV_TAP_WINDOW_MS) ? devTapCount + 1 : 1;
  devTapLastAt = now;
  if (devTapCount >= DEV_TAP_REQUIRED) {
    devTapCount = 0;
    triggerDevCheat();
  }
}
// タップ専用: ページ全体のダブルタップズーム対策(350ms以内の連続タップのtouchendをpreventDefaultする処理)が
// このボタン上でも働き、素早く連続タップすると合成されるclickイベントごと消えてしまい連続タップが
// カウントできなくなっていたため、このボタンだけtouchend自体をカウント源にして回避する
// (このボタンのtouchendは常にpreventDefaultし、その後に合成されるclickと二重カウントしないようにする)
document.getElementById("townTimeLabel").addEventListener("touchend", (e) => {
  e.preventDefault();
  handleDevTimeLabelTap();
}, { passive: false });
document.getElementById("townTimeLabel").addEventListener("click", handleDevTimeLabelTap);
function triggerDevCheat() {
  state.gold = 9999;
  state.roster.forEach((c) => devSetCharacterLevel(c, MAX_LEVEL));
  saveState();
  renderTown();
  showInfoModal("開発者モード: 所持金9999G・名簿全員Lv10にしました。");
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

// ============ 時間を進める(⌛️) ============
// 各村の時計の横から、30分刻み・最長12時間まで時間を早送りできる。1時間ごとに1秒かけて進め、
// 時間帯(朝/昼/夕/夜)の境界を跨いだ時だけ背景をフェードで自然に切り替える。
// オーバーレイ自体は全画面共通の1つを使い回すため、どの村から開いたかをtimeSkipVillageに覚えておき、
// 背景クロスフェードに使うBG_SETSのキー(village名と一致させてある)と、完了後に戻す描画関数を
// TIME_SKIP_RETURN_FNから引く(ユーザー指摘、2026-07-21: 海の村/山伏の里にこのボタンが無かった)
const TIME_SKIP_STEP_MIN = 30;
const TIME_SKIP_MAX_MIN = 12 * 60;
let timeSkipSelectedMin = 60;
let timeSkipVillage = "town"; // "town" | "umimura" | "yamabushi"。BG_SETSのキー名と一致させてある
// renderUmiMura/renderYamabushiはumimura.js側の定義(town.jsより後に読み込まれる)のため、
// ここをconstのオブジェクトリテラルにして即座に参照すると読み込み時点でReferenceErrorになる。
// 呼び出し時(=全スクリプト読み込み後)まで評価を遅らせるため、関数越しに引く形にしてある
function timeSkipReturnFn(village) {
  if (village === "umimura") return renderUmiMura;
  if (village === "yamabushi") return renderYamabushi;
  return renderTown;
}
function openTimeSkipPicker(village) {
  timeSkipVillage = village || "town";
  timeSkipSelectedMin = 60;
  renderTimeSkipPicker();
  const tag = document.querySelector(".time-skip-tag");
  if (tag) tag.classList.remove("pressed");
  document.getElementById("timeSkipPickerView").style.display = "block";
  document.getElementById("timeSkipAnimView").style.display = "none";
  document.getElementById("timeSkipOverlay").style.display = "block";
}
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
document.getElementById("timeSkipBtn").onclick = () => openTimeSkipPicker("town");
document.getElementById("umimuraTimeSkipBtn").onclick = () => openTimeSkipPicker("umimura");
document.getElementById("yamabushiTimeSkipBtn").onclick = () => openTimeSkipPicker("yamabushi");
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
  fromEl.style.backgroundImage = `url('${BG_SETS[timeSkipVillage][state.timeOfDay]}')`;
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
      timeSkipReturnFn(timeSkipVillage)();
      return;
    }
    const beforePhase = state.timeOfDay;
    advanceExplorationClock(steps[i]);
    updateClockDisplay();
    if (state.timeOfDay !== beforePhase) {
      crossfadeBg(fromEl, toEl, BG_SETS[timeSkipVillage][state.timeOfDay], 1000, () => runStep(i + 1));
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
document.getElementById("toShopBtn").onclick = () => { playSfx("select"); facilityHomeScreen = "screen-party-select"; renderShop(); showScreen("screen-shop"); };
document.getElementById("toOnsenBtn").onclick = () => { playSfx("onsen_enter"); renderOnsen(); showScreen("screen-onsen"); };
document.getElementById("toDungeonBtn").onclick = () => {
  playSfx("select");
  renderPartySelect();
  showScreen("screen-party-select");
};

// ============ 宿屋 ============
// 建物で解禁されたばかり(まだこの一覧で見ていない)の職業に「NEW」を出す。侍/槍士/狩人/陰陽師のような
// 建物不要で最初から雇える職業は対象外(CLASS_UNLOCK_BUILDINGにエントリが無い=判定自体をスキップする)。
// 未解禁の職業は一覧から除外せず、シルエット+解禁条件付きで並べる(「まだこんな職業がいるのか」という
// ワクワク感を出すためのユーザー指示)。CLASSES本来のキー順(侍/忍/槍士/薙刀士/狩人/砲術士/陰陽師/僧侶、
// 解禁済みと未解禁が交互)のままだと表示も交互になり見た目が揃わないため、解禁済み4人を上段、
// 未解禁4人を下段にまとめて並ぶよう並び替える
// クラス選択グリッド本体はrenderInnClassGrid(ids)に一本化済み(温泉村/海の村/山伏の里共通)
let selectedClass = "samurai";

// 宿屋の名簿一覧。宿泊は選択式ではなく「宿泊する」で稼働中の仲間全員が一括で泊まる
// (ユーザー指示2026-07-18の大幅変更。料金は従来どおり1人10G×人数)。
// 解雇はここではなく各キャラの「詳細」画面(renderStatusScreen)の下部に移した(誤タップ防止のため)
function lodgeableMembers() {
  return state.roster.filter((c) => c.status === "active");
}

// ============ 宿(名簿+宿泊+雇用UI)の共通処理 ============
// 温泉村の宿屋だけでなく、海の村/山伏の里(今後増える村も含む)の宿でも全く同じ仕様にするため
// 一本化してある(ユーザー指示、2026-07-21: 「温泉村と同じにして」)。
// membersFn: 名簿に表示する対象キャラ配列を返す関数。温泉村は()=>state.roster(名簿全員、
// 家で待機中の仲間も含む)、海の村/山伏の里は()=>fieldParty(その遠征で物理的にそこにいる
// メンバーのみ)を渡す。ids: { rosterList, lodgeBtn, classGrid, classDesc, nameInput, createBtn, gold }
function renderInnRosterList(ids, membersFn, onBack) {
  const list = document.getElementById(ids.rosterList);
  const members = membersFn();
  list.innerHTML = "";
  if (members.length === 0) return;
  const now = absoluteGameMinutes();
  members.forEach((c) => {
    const c2 = CLASSES[c.classId];
    const fullHealth = c.status === "active" && c.hp >= c.maxHp && c.mp >= c.maxMp;
    const isOnsenBuffTag = c.status === "active" && !isOnsenLocked(c, now) && !!c.onsenBuffKey;
    const tagText = c.status !== "active" ? (c.status === "critical" ? "瀕死" : "ロスト") : isOnsenLocked(c, now) ? "入浴中" : isOnsenBuffTag ? onsenBuffName(c.onsenBuffKey) : fullHealth ? "満タン" : "待機中";
    const hpRatio = c.maxHp > 0 ? Math.max(0, c.hp / c.maxHp) * 100 : 0;
    const mpRatio = c.maxMp > 0 ? Math.max(0, c.mp / c.maxMp) * 100 : 0;
    const pendingLevels = state.pendingSkillChoices.filter((e) => e.characterId === c.id).map((e) => e.level);
    const hasPendingSkill = pendingLevels.length > 0;
    const levelUpFrom = hasPendingSkill ? Math.min(...pendingLevels) - 1 : null;
    const row = document.createElement("div");
    // 瀕死/ロストで戦線に戻っていない仲間は、出発準備画面(renderPartySelect)の選べないキャラと
    // 同じ.disabledクラス(半透明)でグレーアウト表示する
    row.className = "roster-row" + (c.status !== "active" ? " disabled" : "");
    row.innerHTML = `
      <img src="${characterPortraitSrc(c)}">
      <div class="roster-info">
        <div class="roster-name">${c.name} <span class="status-tag ${statusTagClass(c)}${isOnsenBuffTag ? " onsen-buff-tag" : ""}"${isOnsenBuffTag ? ` data-onsen-buff="${c.onsenBuffKey}"` : ""}>${tagText}</span></div>
        <div class="roster-sub">${rosterSubWithLevelBadge(c)}</div>
        ${hasPendingSkill ? `<div class="levelup-badge-small"><span class="nowrap">レベルアップ！</span> <span class="nowrap">Lv.${levelUpFrom}→${c.level}</span></div>` : ""}
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
    // 戻り先(onBack)を明示して渡す。renderStatusScreenのstatusScreenOnBackは「前回の戻り先を
    // 使い回す」仕様(スキルツリー往復などで文脈を保つため)なので、ここで明示しないと直前に
    // 別画面から詳細を開いていた場合に、この宿から開いたのに違う画面へ飛ばされるバグになる
    // (温泉村の宿屋で2026-07-18に発生した不具合と同種)
    row.querySelector(".detail-btn").onclick = (e) => {
      e.stopPropagation();
      renderStatusScreen(c.id, onBack);
      showScreen("screen-status");
    };
    // 宿の名簿ではアイコン写真タップでの詳細遷移はしない(ユーザー指示2026-07-18で無効化。
    // 詳細を見たい時は「詳細」ボタンから。出発準備画面のアイコンタップも2026-07-19に同様に無効化した)
    const skillBtn = row.querySelector(".skill-pending-btn");
    if (skillBtn) {
      skillBtn.onclick = (e) => {
        e.stopPropagation();
        openSkillChoiceFor(c.id);
      };
    }
    // 宿泊の全員一括化(2026-07-18)に伴い、行タップでの宿泊選択トグルは廃止した
    list.appendChild(row);
  });
  const targets = members.filter((c) => c.status === "active");
  const cost = LODGE_COST * targets.length;
  const confirmBtn = document.getElementById(ids.lodgeBtn);
  confirmBtn.textContent = targets.length > 0 ? `宿泊する(${targets.length}人・${cost}G)` : "宿泊する";
  confirmBtn.disabled = targets.length === 0 || state.gold < cost;
}
// クラス選択グリッド(雇用UI)の共通処理。selectedClassは画面をまたいだ単一のモジュール変数のため、
// 複数の宿を同時に開くことはない(1画面ずつしか表示されない)前提で問題なく共有できる
function renderInnClassGrid(ids) {
  const grid = document.getElementById(ids.classGrid);
  grid.innerHTML = "";
  const descArea = document.getElementById(ids.classDesc);
  descArea.textContent = CLASS_DESC[selectedClass] || "";
  let anyNewlySeen = false;
  const orderedClassIds = [...Object.keys(CLASSES).filter(isClassUnlocked), ...Object.keys(CLASSES).filter((id) => !isClassUnlocked(id))];
  orderedClassIds.forEach((classId) => {
    const c = CLASSES[classId];
    const div = document.createElement("div");
    if (!isClassUnlocked(classId)) {
      div.className = "class-pick locked";
      const buildingName = (FACILITY_DISPLAY[CLASS_UNLOCK_BUILDING[classId]] || {}).name || "";
      div.innerHTML = `<div class="class-pick-locked-portrait"><img src="${c.image}"></div><span class="class-pick-locked-label">🔒${buildingName}建築で解禁</span>`;
      grid.appendChild(div);
      return;
    }
    div.className = "class-pick" + (selectedClass === classId ? " selected" : "");
    const isNew = !!CLASS_UNLOCK_BUILDING[classId] && !state.seenUnlockedClasses[classId];
    div.innerHTML = `<img src="${c.image}"><span>${c.ja}</span>${isNew ? '<span class="new-badge">NEW</span>' : ""}`;
    if (isNew) { state.seenUnlockedClasses[classId] = true; anyNewlySeen = true; }
    div.onclick = () => { selectedClass = classId; renderInnClassGrid(ids); };
    div.onmouseenter = () => { descArea.textContent = CLASS_DESC[classId] || ""; };
    div.onmouseleave = () => { descArea.textContent = CLASS_DESC[selectedClass] || ""; };
    grid.appendChild(div);
  });
  document.getElementById(ids.createBtn).disabled = state.gold < HIRE_COST || state.roster.length >= rosterCapacity();
  if (anyNewlySeen) saveState();
}
// 雇用ボタンの配線(画面ごとに1度だけ呼ぶ)。雇った直後はその場でmembersFn/onBackを使って名簿を再描画する
function wireInnHireButton(ids, membersFn, onBack) {
  document.getElementById(ids.createBtn).onclick = () => {
    const nameInput = document.getElementById(ids.nameInput);
    const name = nameInput.value.trim() || randomFemaleName();
    if (state.roster.length >= rosterCapacity()) { showInfoModal(`仲間がいっぱいです(最大${rosterCapacity()}人。増築で上限を増やせます)`); return; }
    if (state.gold < HIRE_COST) { showInfoModal(`お金が足りません(${HIRE_COST}G必要)`); return; }
    state.gold -= HIRE_COST;
    const c = createCharacter(name, selectedClass, state.classUpgrades);
    c.personality = pickNonDuplicatePersonality();
    state.roster.unshift(c); // 新しく雇った仲間が名簿の一番上に来るようにする
    nameInput.value = "";
    saveState();
    playSfx("select");
    renderInnRosterList(ids, membersFn, onBack);
    renderInnClassGrid(ids);
    document.getElementById(ids.gold).textContent = state.gold + "G";
  };
}
// 宿泊の確定〜演出〜完了までの共通フロー(確認モーダル→暗転→回復サマリー→翌朝フェードイン)。
// bgSetは省略時BG_SETS.tavern(温泉村)、海の村/山伏の里は各宿のBG_SETSを渡す
function performLodging(targets, bgSet, onDone) {
  if (targets.length === 0) return;
  const cost = LODGE_COST * targets.length;
  showConfirmModal(`宿泊しますか？(${targets.length}人・${cost}G)`, [
    {
      label: "はい",
      className: "big primary",
      onClick: () => {
        playLodgingTransition(() => {
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
          saveState();
          showLodgingRestSummary(beforeSnapshot, () => {
            revealLodgingMorning(() => {
              if (checkGameOver()) return; // 宿泊で最後の稼働可能な仲間がロストになった場合はここで詰みを検出する
              onDone();
            });
          });
        }, bgSet);
      },
    },
    { label: "いいえ", className: "big" },
  ]);
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
// bgSetは省略時BG_SETS.tavern(温泉村の宿屋)。海の村の潮風宿など、他の宿でも同じ演出を
// 使い回せるよう、2026-07-19に背景セットを引数化した(ユーザー指示: 「流用できるやろ」)
function playLodgingTransition(onBlack, bgSet) {
  if (lodgingTransitionActive) return;
  lodgingTransitionActive = true;
  const bg = bgSet || BG_SETS.tavern;
  playLodgingBgm();
  const overlay = document.getElementById("lodgingTransition");
  const fromEl = document.getElementById("lodgingTransitionFrom");
  const toEl = document.getElementById("lodgingTransitionTo");
  const blackEl = document.getElementById("lodgingTransitionBlack");
  const caption = document.getElementById("lodgingTransitionCaption");
  const NIGHT_CROSSFADE_MS = 2000; // 現在時刻→夜へのクロスフェード時間(ユーザー指示で従来より少し長め)
  const INITIAL_HOLD_MS = 1500; // 宿泊開始直後、現在時刻の絵を止めたまま表示しておく時間(2026-07-21にユーザー指示で2.2秒→1.7秒→1.5秒に再短縮)

  fromEl.style.opacity = "1";
  fromEl.style.backgroundImage = `url('${bg[state.timeOfDay] || bg.night}')`;
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
      crossfadeBg(fromEl, toEl, bg.night, NIGHT_CROSSFADE_MS, finale);
    }
  }

  function finale() {
    // 夜→暗転(ユーザー指示で暗転まわりの時間はすべて従来の3倍)
    fadeOpacity(blackEl, 0, 1, 2700, () => {
      // 画面が真っ暗な間に背景を朝の絵へ差し替え、キャプションを表示する
      fromEl.style.backgroundImage = `url('${bg.dawn}')`;
      caption.textContent = pickLodgingNightMessage();
      caption.style.animation = "lodgingCaptionFade 2700ms ease forwards";
      // キャプションが完全に消えてから回復画面を出す(表示時間を0.6秒短縮したのに合わせて
      // 回復画面が出るタイミングも同じだけ早める。2026-07-21にユーザー指示で3900ms→2500ms→2700msへ調整)
      setTimeout(onBlack, 2700);
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
    overlay.style.opacity = "1"; // 次回の宿泊演出のためにリセットしておく
    lodgingTransitionActive = false;
  }
  // 黒(blackEl)が明けきった時点ではまだ演出オーバーレイ自体が画面を覆ったままなので、その裏で
  // 実際の宿屋画面(onDone=renderTavern)を先に最新状態へ描画してから、オーバーレイ全体をフェード
  // アウトして継ぎ目なく見せる。従来はここでoverlay.style.display="none"により実画面へ瞬時に
  // 切り替えていたため、更新前→更新後の画面が「ドン」と唐突に切り替わって見えていた(ユーザー報告2026-07-21)
  let revealed = false;
  function revealRealScreen() {
    if (revealed) return;
    revealed = true;
    onDone();
    fadeOpacity(overlay, 1, 0, 600, finishLodging);
  }
  const safetyTimer = setTimeout(() => { revealRealScreen(); finishLodging(); }, 30000);
  const overlay = document.getElementById("lodgingTransition");
  const blackEl = document.getElementById("lodgingTransitionBlack");
  // 朝のイラストが見え始めるこのタイミングで専用の効果音を一度だけ鳴らす
  playSfx("morning_chime");
  fadeOpacity(blackEl, 1, 0, 3300, revealRealScreen);
}

// 野営開始時の演出: 現在の背景(1.5秒静止)→夜の森へクロスフェード(既に夜ならスキップ)→
// 夜の森を1.5秒静止→ゆっくり暗転→野営地の絵にフェードイン。BGMのフェードアウトと同時に開始する
function showLodgingRestSummary(beforeSnapshot, onNext) {
  showRestSummary("lodgingRestSummary", "lodgingRestSummaryList", "lodgingRestNextBtn", beforeSnapshot, onNext, true, false);
}

document.getElementById("lodgeConfirmBtn").onclick = () => {
  performLodging(lodgeableMembers(), BG_SETS.tavern, renderTavern);
};

const TAVERN_INN_IDS = { rosterList: "rosterList", lodgeBtn: "lodgeConfirmBtn", classGrid: "classGrid", classDesc: "classDescArea", nameInput: "newCharName", createBtn: "createCharBtn", gold: "tavernGold" };
function renderTavern() {
  pruneActiveParty();
  renderDwHeader("tavern", "宿屋", () => { renderTown(); });
  document.getElementById("tavernGold").textContent = state.gold + "G";
  updateKeeperLine("tavernKeeperLinePeriod", "tavernKeeperLineIndex", TAVERN_KEEPER_LINES, "tavernKeeperBubble");
  showKeeperCharacter("tavernKeeperWrap");
  renderInnRosterList(TAVERN_INN_IDS, () => state.roster, defaultStatusOnBack);
  renderInnClassGrid(TAVERN_INN_IDS);
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
// statusBackBtnは画面ロード時に1度だけイベント登録される固定ボタンのため、
// このモジュール変数を参照する形で常に「今表示中のキャラの正しい戻り先」を辿れるようにしてある
let statusScreenOnBack = null;
function defaultStatusOnBack() { renderTavern(); showScreen("screen-tavern"); }
function renderStatusScreen(charId, onBack) {
  statusScreenOnBack = onBack || statusScreenOnBack || defaultStatusOnBack;
  const c = getRosterChar(charId);
  const c2 = CLASSES[c.classId];
  // ふりがな付きの表示名。以前は専用の<h1>(#statusName)に表示していたが、共通ヘッダー導入時に
  // .hero.has-dw-header h1{display:none}で隠れる対象になってしまい、ふりがなごと見えなくなっていた
  // (キャラの名前自体は表示されるが、意図していたふりがな注記が失われる形の回帰バグだった)。
  // 共通ヘッダーのタイトル側にふりがな込みの文字列を渡すことで復活させる
  const reading = NAME_READINGS[c.name];
  const displayName = reading ? `${c.name}(${reading})` : c.name;
  document.getElementById("statusName").textContent = displayName;
  renderDwHeader("status", displayName, statusScreenOnBack);
  document.getElementById("statusImg").src = statusPortraitSrc(c);
  document.getElementById("statusLvMedal").src = `assets/icons/level_${Math.min(MAX_LEVEL, Math.max(1, c.level))}.png`;
  document.getElementById("statusWhoName").textContent = c.name;
  const yomiEl = document.getElementById("statusWhoYomi");
  yomiEl.textContent = reading ? reading.split("").join(" ") : "";
  yomiEl.style.display = reading ? "" : "none";
  document.getElementById("statClass").textContent = c2.ja;
  document.getElementById("statPersonality").textContent = c.personality || "-";
  const xpNeed = xpToNext(c.level);
  document.getElementById("statXp").textContent = c.level >= MAX_LEVEL ? "MAX" : `${c.xp} / ${xpNeed}`;
  document.getElementById("statusXpFill").style.width = c.level >= MAX_LEVEL
    ? "100%" : `${Math.max(2, Math.min(100, Math.round((c.xp / xpNeed) * 100)))}%`;
  document.getElementById("statStatus").textContent = statusLabel(c);

  // 能力欄: HP/MPは残量バー、攻/防/速/魔は2x2タイル、ストレスは下段の1行にまとめる
  const equipNote = (k) => (c.equipBonus && c.equipBonus[k] ? `<span class="status-tile-bonus">装備+${c.equipBonus[k]}</span>` : "");
  const hpPct = Math.max(0, Math.min(100, Math.round((c.hp / c.maxHp) * 100)));
  const mpPct = c.maxMp > 0 ? Math.max(0, Math.min(100, Math.round((c.mp / c.maxMp) * 100))) : 0;
  const tiles = [
    { key: "atk", label: "攻撃", val: effectiveStat(c, "atk"), bonus: equipNote("atk") },
    { key: "def", label: "防御", val: effectiveStat(c, "def"), bonus: equipNote("def") },
    { key: "spd", label: "素早さ", val: effectiveStat(c, "spd"), bonus: "" },
    { key: "mag", label: "魔力", val: c.mag > 0 ? effectiveStat(c, "mag") : "-", bonus: c.mag > 0 ? equipNote("mag") : "" },
  ];
  document.getElementById("statStatList").innerHTML = `
    <div class="status-vbar hp">
      <div class="status-vbar-row"><span class="status-vbar-lbl">${ICONS.hp} HP</span><span class="status-vbar-num">${c.hp} / ${c.maxHp}</span></div>
      <div class="status-vbar-track"><div class="status-vbar-fill" style="width:${hpPct}%"></div></div>
    </div>
    <div class="status-vbar mp">
      <div class="status-vbar-row"><span class="status-vbar-lbl">${ICONS.mp} MP</span><span class="status-vbar-num">${c.maxMp > 0 ? `${c.mp} / ${c.maxMp}` : "-"}</span></div>
      <div class="status-vbar-track"><div class="status-vbar-fill" style="width:${mpPct}%"></div></div>
    </div>
    <div class="status-tiles">${tiles.map((t) => `
      <div class="status-tile">
        <div class="status-tile-ic">${ICONS[t.key]}</div>
        <div class="status-tile-lbl">${t.label}</div>
        <div class="status-tile-val">${t.val}</div>
        ${t.bonus}
      </div>
    `).join("")}</div>
    <div class="status-stress-row"><span class="status-stress-lbl">${ICONS.stress} ストレス</span><span class="status-stress-val">${Math.round(c.fatigue || 0)}</span></div>
  `;

  // 習得済みスキルに加えて、まだ到達していないレベルは「？？？ Lv◯で習得」の伏せ字で表示し、
  // レベルアップの楽しみを持たせる(選ばなかった方の枝は「二度と来ない」ので対象外、あくまで未来の枠のみ)。
  // スキルツリー(Lv2〜)とは別枠で、職業が最初から持つLv1のクラスアビリティ(会心の一撃/かばう等)も
  // 「習得済み」として一覧の先頭に載せる(スキルツリー選択とは無関係に全員が最初から使える技のため)
  const skillListEl = document.getElementById("statSkillList");
  const skillEntry = ({ medal, medalClass, name, nameClass, side, desc, level }) => `
    <div class="skill-entry${desc == null ? " locked" : ""}" ${level != null ? `data-level="${level}"` : ""}>
      <span class="skill-entry-medal${medalClass ? ` ${medalClass}` : ""}">${medal}</span>
      <span class="skill-entry-main">
        <span class="skill-entry-head">
          <strong${nameClass ? ` class="${nameClass}"` : ""}>${name}</strong>
          <span class="skill-entry-side">${side}</span>
        </span>
        ${desc != null ? `<p class="skill-entry-desc">${desc}</p>` : ""}
      </span>
    </div>
  `;
  const innateRows = (c2.abilities || []).map((ability) => skillEntry({
    medal: "初", name: ABILITY_LABEL[ability] || ability, side: "初期", desc: ABILITY_DESC[ability] || "", level: 1,
  })).join("");
  const tree = SKILL_TREES[c.classId] || {};
  const allLevels = Object.keys(tree).map(Number).sort((a, b) => a - b);
  const skillRows = innateRows + allLevels.map((lv) => {
    const side = c.skills && c.skills[lv];
    if (side) {
      const skill = tree[lv][side];
      if (!skill) return "";
      return skillEntry({
        medal: lv, name: skill.name, side: skill.mp > 0 ? `MP${skill.mp}` : "パッシブ", desc: skill.desc, level: lv,
      });
    }
    if (lv <= c.level) return ""; // レベル到達済みだが選択待ち(スキル選択ポップアップ側で処理するためここには出さない)
    return skillEntry({
      medal: "🔒", medalClass: "locked", name: "？？？", nameClass: "skill-entry-mystery", side: `Lv${lv}で習得`, desc: null,
    });
  }).join("");
  skillListEl.innerHTML = skillRows || '<p style="color:var(--dw-caption-color);font-size:13px;">まだ習得したスキルがありません。</p>';

  [document.getElementById("statusXpCard"), document.getElementById("statusStatCard"), document.getElementById("statusSkillCard")].forEach((el) => retriggerEntryAnim(el, "status-card-in"));

  document.getElementById("statusViewSkillTreeBtn").onclick = () => {
    viewSkillTree(charId, () => { renderStatusScreen(charId); showScreen("screen-status"); });
  };
  const takigyoCount = state.inventory.takigyo || 0;
  document.getElementById("statusTakigyoCount").textContent = takigyoCount;
  const takigyoBtn = document.getElementById("statusTakigyoBtn");
  takigyoBtn.disabled = takigyoCount <= 0;
  takigyoBtn.onclick = () => {
    if ((state.inventory.takigyo || 0) <= 0) return;
    showConfirmModal(
      `${c.name}の習得済みスキルを全て忘れ、レベル${c.level}まで1から選び直します。よろしいですか？`,
      [
        {
          label: "はい",
          className: "big danger",
          onClick: () => {
            resetAllSkills(c);
            state.inventory.takigyo--;
            saveState();
            playSfx("select");
            renderStatusScreen(charId);
          },
        },
        { label: "いいえ", className: "big" },
      ],
      "var(--dw-info)"
    );
  };
  // 名前の変更: ボタンでインラインの入力欄を開閉する(showConfirmModalはボタン選択のみでテキスト入力に
  // 対応していないため、この画面専用の簡易フォームにした)。空欄や既存名と同じ場合は何もしない
  const renameRow = document.getElementById("statusRenameRow");
  const renameInput = document.getElementById("statusRenameInput");
  renameRow.style.display = "none";
  document.getElementById("statusRenameBtn").onclick = () => {
    renameInput.value = c.name;
    renameRow.style.display = "";
    renameInput.focus();
  };
  document.getElementById("statusRenameCancelBtn").onclick = () => { renameRow.style.display = "none"; };
  document.getElementById("statusRenameConfirmBtn").onclick = () => {
    const newName = renameInput.value.trim();
    if (!newName) { showInfoModal("名前を入力してください"); return; }
    c.name = newName;
    c.label = newName;
    saveState();
    playSfx("select");
    renderStatusScreen(charId);
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

// 汎用の確認/案内ポップアップ。buttonsは{label, className, onClick}の配列。
// panelClassを渡すとパネルにそのクラスを追加できる(景色が変わる分岐道の青いグロー演出等、
// 呼び出し元ごとの特別な見た目のための拡張。省略時は通常の見た目のまま)
function showConfirmModal(text, buttons, textColor, panelClass) {
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
  const panel = document.getElementById("genericConfirmPanel");
  panel.className = panelClass || "";
  document.getElementById("genericConfirmOverlay").style.display = "flex";
}
function hideConfirmModal() {
  document.getElementById("genericConfirmOverlay").style.display = "none";
}
// ブラウザ標準のshowInfoModal()は実機(特にiOS)でタップ直後の操作シーケンスと絡んで固まる/反応しなくなる
// といった不具合を誘発しやすいとの指摘を受け、ゲーム内の案内メッセージは全てこちら(OK1つだけの
// showConfirmModal)に統一した。呼び出し側はshowInfoModal(msg)と同じ感覚でそのまま使える
function showInfoModal(message) {
  showConfirmModal(message, [{ label: "OK", className: "big primary" }]);
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
  {
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
          // 職業ごとの性格固定(旧FIRST_CHARACTER_PERSONALITY)はユーザー指示でいったん廃止し、
          // 宿屋で雇う仲間と同じくpickNonDuplicatePersonality()でランダムに割り当てる
          c.personality = pickNonDuplicatePersonality();
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

const HIRE_COST = 30; // 新しい冒険者を仲間にする際の費用
// 最初に仲間にする人数分は性格が誰とも被らないようにする。ACTIVE_PERSONALITIES(現在9種、
// 「世話好き」を除外中)を使い切ったら(10人目以降)完全ランダムに戻る
function pickNonDuplicatePersonality() {
  if (state.roster.length >= ACTIVE_PERSONALITIES.length) return ACTIVE_PERSONALITIES[Math.floor(Math.random() * ACTIVE_PERSONALITIES.length)];
  const used = new Set(state.roster.map((c) => c.personality));
  const available = ACTIVE_PERSONALITIES.filter((p) => !used.has(p));
  if (available.length === 0) return ACTIVE_PERSONALITIES[Math.floor(Math.random() * ACTIVE_PERSONALITIES.length)];
  return available[Math.floor(Math.random() * available.length)];
}
wireInnHireButton(TAVERN_INN_IDS, () => state.roster, defaultStatusOnBack);
document.getElementById("tavernBackBtn").onclick = () => { renderTown(); };
document.getElementById("tavernBackBtnTop").onclick = () => { renderTown(); };

const LODGE_COST = 10; // 宿屋に宿泊する際の宿代(キャラ1人あたり)

// ============ パーティ編成(出発直前) ============
// 出発準備画面のタブ切り替え(支度/おみくじ/図鑑)。神社が未建築の間はおみくじタブ自体を表示しない。
// 支度タブへの切り替えボタンは廃止したため、おみくじ/図鑑画面の「戻る」がshowPartySelectTab("main")を呼ぶ
function showPartySelectTab(tab) {
  document.getElementById("partySelectMainTab").style.display = tab === "main" ? "" : "none";
  document.getElementById("partySelectBestiaryTab").style.display = tab === "bestiary" ? "" : "none";
  document.getElementById("partySelectBestiaryTabBtn").className = "omikuji-chip-btn" + (tab === "bestiary" ? " active" : "");
  // 図鑑タブを開いている間はおみくじタブを隠す(ユーザー指示)。mainタブに戻った時だけ、
  // 神社建築済みかどうかの本来の条件で再表示する
  document.getElementById("partySelectOmikujiTabBtn").style.display =
    tab === "bestiary" ? "none" : ((state.shrineLevel || 0) > 0 ? "" : "none");
}
// おみくじはもう別画面に切り替わらない(ユーザー指示によりテンポ重視で撤廃)。ボタンを押すと
// その場でカードが更新されるだけで、支援物資/出発メンバー選択/出発ボタンはそのまま下に続けて操作できる。
// 本日すでに引いていればdrawOmikuji()が無言で早期returnするので、その場合は今日の結果をそのまま表示する。
// ユーザー指示: 開いている状態でもう一度ボタンを押したら閉じる(トグル)ようにする。
// omikujiDrawnDate/omikujiLastTier等の永続状態には触れず、カードの表示/非表示だけをトグルするので、
// 画面を出入りし直せば(renderPartySelect経由のrenderOmikujiTab)今日引いた結果はまた見える
document.getElementById("partySelectOmikujiTabBtn").onclick = () => {
  playSfx("select");
  state.seenOmikujiTab = true;
  document.getElementById("omikujiTabNewBadge").style.display = "none";
  showPartySelectTab("main"); // 図鑑タブを見ていた場合でも、おみくじカードが見える位置(main)へ戻す
  const resultCard = document.getElementById("omikujiResultCard");
  const alreadyDrawnToday = (state.omikujiDrawnDate || 0) === state.dayCount;
  if (alreadyDrawnToday && resultCard.style.display !== "none") {
    resultCard.style.display = "none";
  } else {
    drawOmikuji();
    renderOmikujiTab();
  }
};
// 図鑑タブもユーザー指示によりトグル化: 開いている時に同じボタンを押すと閉じてmainタブへ戻る
document.getElementById("partySelectBestiaryTabBtn").onclick = () => {
  playSfx("select");
  const isOpen = document.getElementById("partySelectBestiaryTab").style.display !== "none";
  if (isOpen) { showPartySelectTab("main"); }
  else { showPartySelectTab("bestiary"); renderBestiaryTab(); }
};
document.getElementById("partySelectBackBtnFromBestiary").onclick = () => { playSfx("select"); showPartySelectTab("main"); };

// 図鑑: 遭遇済みの敵を一覧表示する。倒す必要はなく、戦闘に出現した時点で記録される(markEnemiesSeen)。
// 一覧は名前+サムネイルだけの簡易表示にし、タップするとモーダルで詳細(立ち絵+説明+大技+弱点)を
// 左右送りで1体ずつ見られるようにする(showBestiaryDetail参照)
function bestiaryOrderedIds() {
  const allIds = Object.keys(ENEMIES);
  const forest = allIds.filter((id) => (ENEMIES[id].stage || "forest") === "forest").sort((a, b) => ENEMIES[a].minFloor - ENEMIES[b].minFloor);
  const coast = allIds.filter((id) => ENEMIES[id].stage === "coast").sort((a, b) => ENEMIES[a].minFloor - ENEMIES[b].minFloor);
  return forest.concat(coast);
}
function renderBestiaryTab() {
  // 図鑑タブを開いた時点でNEWバッジを消す(次に新しい敵と遭遇するまで再表示しない)
  state.bestiaryLastViewedCount = (state.seenEnemyIds || []).length;
  saveState();
  document.getElementById("bestiaryNewBadge").style.display = "none";

  const orderedIds = bestiaryOrderedIds();
  const seenCount = (state.seenEnemyIds || []).length;
  document.getElementById("bestiaryCompleteRate").textContent = `${Math.floor((seenCount / orderedIds.length) * 100)}%`;
  document.getElementById("bestiaryCompleteCount").textContent = `${seenCount} / ${orderedIds.length}体`;

  const list = document.getElementById("bestiaryList");
  list.innerHTML = "";
  // 海岸ステージの存在自体がネタバレになるため、森・海岸で見出しを分けず「深淵の森」1本の
  // 見出しの下に全敵をまとめて表示する(海岸という単語は図鑑に一切出さない)
  [{ ids: orderedIds, label: "深淵の森" }].forEach((group) => {
    const ids = group.ids;
    if (ids.length === 0) return;
    const h = document.createElement("h2");
    h.style.marginTop = "1rem";
    h.textContent = group.label;
    list.appendChild(h);
    ids.forEach((id) => {
      const e = ENEMIES[id];
      const seen = (state.seenEnemyIds || []).includes(id);
      const row = document.createElement("div");
      row.className = "roster-row";
      row.innerHTML = `
        <img src="${e.image}" style="${seen ? "" : "filter:grayscale(1) brightness(0.03);"}">
        <div class="roster-info">
          <div class="roster-name">${seen ? e.ja : "？？？"}${e.isBoss ? ` <span class="status-tag active">強敵</span>` : ""}</div>
          <div class="roster-sub">${seen ? bestiaryTextFor(id).desc : "まだ遭遇していません"}</div>
        </div>
      `;
      row.onclick = () => showBestiaryDetail(orderedIds.indexOf(id));
      list.appendChild(row);
    });
  });
}

// ============ 図鑑モンスター詳細モーダル(左右送り) ============
let bestiaryDetailIndex = 0;
function showBestiaryDetail(index) {
  bestiaryDetailIndex = index;
  renderBestiaryDetail();
  document.getElementById("bestiaryDetailOverlay").style.display = "flex";
}
function renderBestiaryDetail() {
  const orderedIds = bestiaryOrderedIds();
  if (bestiaryDetailIndex < 0) bestiaryDetailIndex = orderedIds.length - 1;
  if (bestiaryDetailIndex >= orderedIds.length) bestiaryDetailIndex = 0;
  const id = orderedIds[bestiaryDetailIndex];
  const e = ENEMIES[id];
  const seen = (state.seenEnemyIds || []).includes(id);
  const img = document.getElementById("bestiaryDetailImg");
  img.style.filter = seen ? "" : "grayscale(1) brightness(0.03)";
  img.src = e.image;
  document.getElementById("bestiaryDetailName").textContent = seen ? e.ja : "？？？";
  const body = document.getElementById("bestiaryDetailBody");
  if (!seen) {
    body.innerHTML = `<div class="locked-line">まだ遭遇していません。深淵の森で出会うと記録されます。</div>`;
    return;
  }
  const text = bestiaryTextFor(id);
  const weaknessLine = bestiaryWeaknessLine(id);
  body.innerHTML = `
    <div class="bestiary-block">${text.desc}</div>
    <div class="bestiary-block"><span class="bestiary-block-label">大技：</span>${text.bigAttackDesc}</div>
    ${weaknessLine ? `<div class="bestiary-block weakness-line"><span class="bestiary-block-label">弱点：</span>${weaknessLine}</div>` : ""}
  `;
}
// 左右送りは未遭遇(？？？)のページを飛ばし、遭遇済みの敵だけを順番にめくれるようにする。
// タップして直接開いた場合(未遭遇でも開ける)はそのまま表示するが、そこから左右に送ると
// 次に遭遇済みの敵が見つかるまでスキップする。誰も遭遇していない場合は無限ループを避けて動かさない
function findNextSeenBestiaryIndex(fromIndex, direction) {
  const orderedIds = bestiaryOrderedIds();
  const seenIds = state.seenEnemyIds || [];
  if (seenIds.length === 0) return fromIndex;
  let idx = fromIndex;
  for (let i = 0; i < orderedIds.length; i++) {
    idx = (idx + direction + orderedIds.length) % orderedIds.length;
    if (seenIds.includes(orderedIds[idx])) return idx;
  }
  return fromIndex;
}
document.getElementById("bestiaryDetailPrevBtn").onclick = () => {
  playSfx("select");
  bestiaryDetailIndex = findNextSeenBestiaryIndex(bestiaryDetailIndex, -1);
  renderBestiaryDetail();
};
document.getElementById("bestiaryDetailNextBtn").onclick = () => {
  playSfx("select");
  bestiaryDetailIndex = findNextSeenBestiaryIndex(bestiaryDetailIndex, 1);
  renderBestiaryDetail();
};
document.getElementById("bestiaryDetailCloseBtn").onclick = () => { playSfx("select"); document.getElementById("bestiaryDetailOverlay").style.display = "none"; };

function renderPartySelect() {
  playTownAreaBgm();
  updateSceneBackgrounds();
  renderDwHeader("partySelect", "パーティ編成", () => { renderTown(); });
  pruneActiveParty();
  renderSupplies();
  document.getElementById("partySelectOmikujiTabBtn").style.display = (state.shrineLevel || 0) > 0 ? "" : "none";
  document.getElementById("omikujiTabNewBadge").style.display = (state.shrineLevel || 0) > 0 && !state.seenOmikujiTab ? "" : "none";
  const bestiaryUnlocked = (state.houseLevel || 1) >= BESTIARY_UNLOCK_HOUSE_LEVEL;
  document.getElementById("partySelectBestiaryTabBtn").style.display = bestiaryUnlocked ? "" : "none";
  document.getElementById("bestiaryNewBadge").style.display = bestiaryUnlocked && bestiaryHasNew() ? "" : "none";
  const maxFloorReached = state.maxFloorReached || { forest: 0, coast: 0 };
  document.getElementById("forestMaxFloorLabel").textContent = maxFloorReached.forest > 0 ? `最高${maxFloorReached.forest}層` : "";
  document.getElementById("coastMaxFloorLabel").textContent = maxFloorReached.coast > 0 ? `最高${maxFloorReached.coast}層` : "";
  // 海岸への直接出発は廃止(ユーザー指示、2026-07-19)。今後は森→洞窟の先で海の村を発見してから
  // 辿り着く経路にする予定のため、そのルートができるまで出発画面からは一旦隠す
  document.getElementById("departCoastBtn").style.display = "none";
  showPartySelectTab("main");
  renderOmikujiTab();
  // 鍛冶屋チップ(村トップから移設)。鍛冶屋を建築するまでは非表示
  document.getElementById("toShopBtn").style.display = state.shopLevel ? "" : "none";
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
    // 5人目(5人編成した時の最後の1枠)は交代要員として控えに回るため、その旨を分かるようにする
    const isReserveSlot = inParty && state.activePartyIds.length >= 5 && state.activePartyIds.indexOf(c.id) === state.activePartyIds.length - 1;
    row.innerHTML = `
      <img src="${characterPortraitSrc(c)}">
      <div class="roster-info">
        <div class="roster-name">${c.name} <span class="status-tag ${statusTagClass(c)}${isOnsenBuffTag ? " onsen-buff-tag" : ""}"${isOnsenBuffTag ? ` data-onsen-buff="${c.onsenBuffKey}"` : ""}>${tagText}</span>${isReserveSlot ? ' <span class="status-tag bathing">交代要員</span>' : ""}</div>
        <div class="roster-sub">${rosterSubWithLevelBadge(c)}</div>
        ${hpBarHtml(c)}
        ${c.maxMp > 0 ? `<div class="mpbar-track"><div class="mpbar-fill" style="width:${c.maxMp > 0 ? Math.max(0, c.mp / c.maxMp) * 100 : 0}%"></div></div>` : ""}
      </div>
    `;
    row.onclick = (e) => {
      if (e.target.closest(".onsen-buff-tag")) return; // 温泉効果タグのタップはツールチップ表示のみ、パーティ選択を巻き込まない
      if (!selectable) return;
      if (inParty) {
        state.activePartyIds = state.activePartyIds.filter((id) => id !== c.id);
      } else {
        const cap = maxActivePartySize();
        if (state.activePartyIds.length >= cap) { showInfoModal(`パーティは最大${cap}人までです`); return; }
        state.activePartyIds.push(c.id);
      }
      saveState();
      renderPartySelect();
    };
    // 出発準備画面のアイコン写真タップでの詳細遷移は無効化(ユーザー指示2026-07-19。
    // 宿屋の名簿と同様、行全体のタップはパーティ選択/解除のみに使う)
    list.appendChild(row);
  });
  activateHpTrails(list);
}

// 支援物資(回復薬+煙玉+野営具)の購入。道具屋ではなくここ(出発画面)で買う。合計supplyCap()個までの共有枠。
// 実処理はui.jsのrenderSupplyPurchaseUI()に一本化済み(海の村/山伏の里の支度画面と共通)
function renderSupplies() {
  renderSupplyPurchaseUI("supplies");
  const maxHint = document.getElementById("partySelectMaxHint");
  if (maxHint) maxHint.textContent = `タップで出発パーティに入れる(最大${maxActivePartySize()}人)`;
}
document.getElementById("partySelectBackBtn").onclick = () => { renderTown(); };
document.getElementById("partySelectBackBtnTop").onclick = () => { renderTown(); };

function renderOmikujiTab() {
  const resultCard = document.getElementById("omikujiResultCard");
  if (state.omikujiLastTier && (state.omikujiDrawnDate || 0) === state.dayCount) {
    resultCard.style.display = "";
    const tier = OMIKUJI_TIERS[state.omikujiLastTier];
    document.getElementById("omikujiResultTier").textContent = tier ? tier.label : "";
    document.getElementById("omikujiResultEffect").textContent = tier ? tier.effectDesc : "";
    document.getElementById("omikujiResultLine").textContent = state.omikujiLastLine || "";
    const speakerImg = document.getElementById("omikujiResultSpeakerImg");
    const speaker = state.omikujiLastSpeakerId ? getRosterChar(state.omikujiLastSpeakerId) : null;
    if (speaker) {
      speakerImg.src = characterPortraitSrc(speaker);
      speakerImg.style.display = "";
    } else {
      speakerImg.style.display = "none";
    }
  } else {
    resultCard.style.display = "none";
  }
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
  state.omikujiLastSpeakerId = speaker ? speaker.id : null;
  saveState();
  playSfx(tierKey === "daikichi" ? "omikuji_daikichi" : "omikuji_normal");
  renderOmikujiTab();
}
function pickRandomActiveRosterChar() {
  const alive = state.roster.filter((c) => c.status === "active");
  if (alive.length === 0) return null;
  return alive[Math.floor(Math.random() * alive.length)];
}
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
    showInfoModal("パーティを1人以上選んでください");
    return;
  }
  currentStage = stage;
  playSfx("departure");
  fadeOutTownBgm(); // 出発演出と同時に町BGMをフェードアウト(以前は暗転の瞬間に無音でぶつ切りだった)
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
    const walkAnim = heroInner.animate(buildWalkKeyframes(DEPARTURE_WALK_MS), { duration: DEPARTURE_WALK_MS, easing: "ease-in-out", fill: "forwards" });
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
    showInfoModal("パーティを1人以上選んでください");
    return;
  }
  pendingDepartureStage = stage;
  const list = document.getElementById("departConfirmList");
  list.innerHTML = "";
  state.activePartyIds.forEach((id, idx) => {
    const c = getRosterChar(id);
    if (!c) return;
    const c2 = CLASSES[c.classId];
    const hpRatio = c.maxHp > 0 ? Math.max(0, c.hp / c.maxHp) * 100 : 0;
    const mpRatio = c.maxMp > 0 ? Math.max(0, c.mp / c.maxMp) * 100 : 0;
    // 5人目(最後に選んだ人)は交代要員として控えに回る(swapReserveMember/enterDungeon参照)ため、
    // 確認画面でもそれとわかるタグを付けておく
    const isReserve = state.activePartyIds.length >= 5 && idx === state.activePartyIds.length - 1;
    const row = document.createElement("div");
    row.className = "card";
    row.style.cssText = "display:flex; align-items:center; gap:0.6rem;";
    row.innerHTML = `
      <img src="${characterPortraitSrc(c)}" style="width:44px;height:44px;object-fit:contain;background:#353a44;border-radius:6px;flex-shrink:0;">
      <div style="flex:1;min-width:0;">
        <div>${c.name}(${c2.ja} Lv${c.level}・${c.personality || "-"})${isReserve ? ' <span class="status-tag bathing">交代要員</span>' : ""}</div>
        <div class="hpbar-track"><div class="hpbar-fill${hpRatio < 30 ? " low" : ""}" style="width:${hpRatio}%"></div></div>
        ${c.maxMp > 0 ? `<div class="mpbar-track"><div class="mpbar-fill" style="width:${mpRatio}%"></div></div>` : ""}
        <div style="font-size:13px;color:var(--dw-caption-color);margin-top:0.15rem;">HP ${c.hp}/${c.maxHp}${c.maxMp > 0 ? `　MP ${c.mp}/${c.maxMp}` : ""}　ストレス ${Math.round(c.fatigue || 0)}</div>
      </div>
    `;
    list.appendChild(row);
  });
  document.getElementById("departConfirmOverlay").style.display = "block";
}
document.getElementById("departForestBtn").onclick = () => showDepartConfirm("forest");
document.getElementById("departCoastBtn").onclick = () => showDepartConfirm("coast");
document.getElementById("departConfirmYesBtn").onclick = () => {
  // 出発演出の途中(モーダルが閉じてからボタンが実際にdisabledになるまでの間)に連打すると
  // startDeparture()が二重に走り、同じDOM要素(演出オーバーレイ等)を取り合って
  // ボタンが二度と有効化されないまま固まって見える不具合があったための連打防止ガード
  if (pendingDepartureStage == null) return;
  const stage = pendingDepartureStage;
  pendingDepartureStage = null;
  document.getElementById("departConfirmOverlay").style.display = "none";
  startDeparture(stage);
};
document.getElementById("departConfirmNoBtn").onclick = () => {
  document.getElementById("departConfirmOverlay").style.display = "none";
};

// ============ 施設の案内キャラクター(温泉の湯守り・宿屋の女将など共通) ============
// 表示し、約3秒後にふわっとフェードアウトさせる(画面を開き直すたびに最初から再生)。
// wrapIdごとにフェードタイマーを個別管理する(温泉と宿屋で同時に動いても干渉しないように)
const keeperFadeTimers = {};
function showKeeperCharacter(wrapId) {
  const wrap = document.getElementById(wrapId);
  clearTimeout(keeperFadeTimers[wrapId]);
  wrap.getAnimations().forEach((a) => a.cancel());
  wrap.style.display = "flex";
  wrap.style.opacity = "1";
  keeperFadeTimers[wrapId] = setTimeout(() => {
    const anim = wrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 800, easing: "ease", fill: "forwards" });
    anim.onfinish = () => { anim.cancel(); wrap.style.opacity = "0"; wrap.style.display = "none"; };
  }, 3000);
}
// 営業時間外の茶屋など、案内キャラを出したくない場面向け。showKeeperCharacter()と対になる形で
// 予約済みのフェードタイマー/進行中のアニメーションを止めた上できっちり非表示にする
function hideKeeperCharacter(wrapId) {
  const wrap = document.getElementById(wrapId);
  clearTimeout(keeperFadeTimers[wrapId]);
  wrap.getAnimations().forEach((a) => a.cancel());
  wrap.style.opacity = "0";
  wrap.style.display = "none";
}
// セリフは開くたびではなく1日おき(2日で1区切り)に更新する。同じ区切りの間は何度画面を開いても
// 同じセリフのまま(区切りが変わった時だけ新しくランダムに選び直す)。stateのフィールド名を
// periodKey/indexKeyで渡すことで温泉・宿屋どちらの案内キャラにも共通して使える
function updateKeeperLine(periodKey, indexKey, lines, bubbleId) {
  const period = Math.floor(((state.dayCount || 1) - 1) / 2);
  if (state[periodKey] !== period) {
    state[periodKey] = period;
    state[indexKey] = Math.floor(Math.random() * lines.length);
    saveState();
  }
  document.getElementById(bubbleId).textContent = lines[state[indexKey]];
}

// ============ 温泉 ============
function renderOnsen() {
  playTownAreaBgm();
  updateSceneBackgrounds();
  renderDwHeader("onsen", "温泉", () => { renderTown(); });
  updateKeeperLine("onsenKeeperLinePeriod", "onsenKeeperLineIndex", ONSEN_KEEPER_LINES, "onsenKeeperBubble");
  showKeeperCharacter("onsenKeeperWrap");
  document.getElementById("onsenGold").textContent = state.gold + "G";
  document.getElementById("toOnsenShrineBtn").style.display = (state.shrineLevel || 0) > 0 ? "" : "none";
  document.getElementById("onsenShrineTabNewBadge").style.display = (state.shrineLevel || 0) > 0 && !state.seenShrineTab ? "" : "none";
  renderOnsenRosterList("onsenList", state.roster);
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
// 鶏小屋の卵ポーチ: dayCountが前回補充時と変わっていたら無料で温泉卵を1個(ポーチ容量まで)補充する
function refillHenHouseEggPouchIfNewDay() {
  if (state.henHouseEggPouchDate === state.dayCount) return;
  state.henHouseEggPouchDate = state.dayCount;
  const cap = henHouseEggPouchCapacity();
  if (cap > 0) state.inventory.onsenEggPouch = Math.min(cap, (state.inventory.onsenEggPouch || 0) + 1);
}
function renderOnsenShop() {
  resetOnsenEggStockIfNewDay();
  updateKeeperLine("onsenShopKeeperLinePeriod", "onsenShopKeeperLineIndex", ONSEN_SHOP_KEEPER_LINES, "onsenShopKeeperBubble");
  showKeeperCharacter("onsenShopKeeperWrap");
  document.getElementById("onsenShopGold").textContent = state.gold + "G";
  document.getElementById("onsenEggOwned").textContent = state.inventory.onsenEgg || 0;
  document.getElementById("takigyoOwned").textContent = state.inventory.takigyo || 0;
  const total = supplyItemTotal();
  const remaining = Math.max(0, ONSEN_EGG_DAILY_STOCK - (state.onsenEggDailyCount || 0));
  const buyBtn = document.getElementById("buyOnsenEggBtn");
  if (remaining <= 0) {
    buyBtn.textContent = "本日売り切れ";
    buyBtn.disabled = true;
  } else {
    buyBtn.textContent = `購入(${ITEMS.onsenEgg.price}G) 残り${remaining}個`;
    buyBtn.disabled = total >= supplyCap() || state.gold < ITEMS.onsenEgg.price;
  }
  const takigyoBtn = document.getElementById("buyTakigyoBtn");
  takigyoBtn.disabled = state.gold < ITEMS.takigyo.price;
}
document.getElementById("buyOnsenEggBtn").onclick = () => {
  resetOnsenEggStockIfNewDay();
  if ((state.onsenEggDailyCount || 0) >= ONSEN_EGG_DAILY_STOCK) { showInfoModal("温泉卵は本日売り切れです(翌朝また仕入れます)"); return; }
  const total = supplyItemTotal();
  if (total >= supplyCap()) { showInfoModal(`支援物資は最大${supplyCap()}個までしか持てません`); return; }
  if (state.gold < ITEMS.onsenEgg.price) { showInfoModal("お金が足りません"); return; }
  state.gold -= ITEMS.onsenEgg.price;
  state.inventory.onsenEgg = (state.inventory.onsenEgg || 0) + 1;
  state.onsenEggDailyCount = (state.onsenEggDailyCount || 0) + 1;
  saveState();
  playSfx("coin");
  renderOnsenShop();
};
document.getElementById("buyTakigyoBtn").onclick = () => {
  if (state.gold < ITEMS.takigyo.price) { showInfoModal("お金が足りません"); return; }
  state.gold -= ITEMS.takigyo.price;
  state.inventory.takigyo = (state.inventory.takigyo || 0) + 1;
  saveState();
  playSfx("coin");
  renderOnsenShop();
};
document.getElementById("toOnsenShopBtn").onclick = () => { playSfx("select"); facilityHomeOnsenScreen = "screen-onsen"; renderOnsenShop(); showScreen("screen-onsen-shop"); };
document.getElementById("onsenShopBackBtn").onclick = () => { renderFacilityHomeOnsen(); };
document.getElementById("onsenShopBackBtnTop").onclick = () => { renderFacilityHomeOnsen(); };

// ============ 温泉の神社(奉納祈願: お守りガチャ+装備) ============
function omamoriRarityLabel(tier) {
  return "レア" + "⭐️".repeat(tier);
}
function renderOnsenShrine() {
  playTownAreaBgm();
  document.getElementById("shrineSoulShardCount").textContent = state.inventory.soulShard || 0;
  document.getElementById("shrineEquipMaxText").textContent = OMAMORI_EQUIP_MAX;
  document.getElementById("shrineEquipMaxText2").textContent = OMAMORI_EQUIP_MAX;
  document.getElementById("shrineEquippedCount").textContent = state.omamoriEquipped.length;

  const offerBtn = document.getElementById("shrineOfferBtn");
  const allOwned = state.omamoriOwned.length >= OMAMORI_LIST.length;
  if (allOwned) {
    offerBtn.textContent = "全てのお守りを授かりました";
    offerBtn.disabled = true;
  } else {
    offerBtn.textContent = `奉納する(魂のかけら${SHRINE_OFFER_SOUL_SHARD_COST}個)`;
    offerBtn.disabled = (state.inventory.soulShard || 0) < SHRINE_OFFER_SOUL_SHARD_COST;
  }

  document.getElementById("shrineSoulLumpCount").textContent = state.inventory.soulLump || 0;
  const specialOfferBtn = document.getElementById("shrineSpecialOfferBtn");
  const highTierAllOwned = OMAMORI_LIST.filter((o) => o.tier >= SHRINE_SPECIAL_OFFER_MIN_TIER).every((o) => state.omamoriOwned.includes(o.id));
  if (highTierAllOwned) {
    specialOfferBtn.textContent = "レア度⭐️⭐️⭐️以上を全て授かりました";
    specialOfferBtn.disabled = true;
  } else {
    specialOfferBtn.textContent = `特別祈願する(かけら${SHRINE_OFFER_SOUL_SHARD_COST}個+塊${SHRINE_SPECIAL_OFFER_LUMP_COST}個)`;
    specialOfferBtn.disabled = (state.inventory.soulShard || 0) < SHRINE_OFFER_SOUL_SHARD_COST || (state.inventory.soulLump || 0) < SHRINE_SPECIAL_OFFER_LUMP_COST;
  }

  const list = document.getElementById("shrineOmamoriList");
  list.innerHTML = "";
  [1, 2, 3, 4].forEach((tier) => {
    OMAMORI_LIST.filter((o) => o.tier === tier).forEach((o) => {
      const owned = state.omamoriOwned.includes(o.id);
      const equipped = state.omamoriEquipped.includes(o.id);
      const row = document.createElement("div");
      row.className = "roster-row";
      row.innerHTML = `
        <img src="${OMAMORI_TIER_IMAGE[o.tier]}" style="${owned ? "" : "filter:grayscale(1) brightness(0.35);"}">
        <div class="roster-info">
          <div class="roster-name">${owned ? `${o.name}(${o.reading})` : "？？？"} <span class="status-tag ${equipped ? "active" : ""}">${omamoriRarityLabel(o.tier)}</span></div>
          <div class="roster-sub">${owned ? o.desc : "まだ授かっていません"}</div>
        </div>
        <button class="big" ${owned ? "" : "disabled"}>${equipped ? "外す" : "装備する"}</button>
      `;
      if (owned) {
        row.querySelector("button").onclick = () => {
          if (equipped) {
            state.omamoriEquipped = state.omamoriEquipped.filter((id) => id !== o.id);
          } else {
            if (state.omamoriEquipped.length >= OMAMORI_EQUIP_MAX) { showInfoModal(`お守りは同時に${OMAMORI_EQUIP_MAX}個までしか装備できません`); return; }
            state.omamoriEquipped.push(o.id);
          }
          saveState();
          playSfx("select");
          renderOnsenShrine();
        };
      }
      list.appendChild(row);
    });
  });
}
// 星4(最高レア)のお守りを授かった時だけのド派手な演出。画面全体を金色でフラッシュさせ、
// 粒子を四方八方に弾き飛ばし、中央に大きな「大当たり！」バナーを出す(神隠しの道の演出=
// playKamikakushiEffectと同じ構造、色と規模だけ「特大」にしてある)
function playRareOmamoriEffect() {
  playSfx("omikuji_daikichi"); // 既存の中で最も「大当たり感」のあるSEを流用(新規アセットは追加しない)
  const flash = document.createElement("div");
  flash.className = "omamori-rare-flash-overlay";
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 1350);

  const banner = document.createElement("div");
  banner.className = "omamori-rare-banner";
  banner.textContent = "大当たり！";
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 1550);

  const layer = document.createElement("div");
  layer.className = "omamori-rare-particle-layer";
  document.body.appendChild(layer);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = vw / 2, cy = vh * 0.4;
  const PARTICLE_COUNT = 36; // kamikakushi(22個)よりさらに派手にするため多めに散らす
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = document.createElement("div");
    p.className = "omamori-rare-particle";
    const size = 4 + Math.random() * 8;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    const angle = Math.random() * Math.PI * 2;
    const dist = 90 + Math.random() * 160;
    p.style.setProperty("--or-x", `${(Math.cos(angle) * dist).toFixed(1)}px`);
    p.style.setProperty("--or-y", `${(Math.sin(angle) * dist).toFixed(1)}px`);
    p.style.setProperty("--or-dur", `${(1.0 + Math.random() * 0.6).toFixed(2)}s`);
    p.style.setProperty("--or-delay", `${(Math.random() * 0.25).toFixed(2)}s`);
    layer.appendChild(p);
  }
  setTimeout(() => layer.remove(), 2100);
}
document.getElementById("shrineOfferBtn").onclick = () => {
  if ((state.inventory.soulShard || 0) < SHRINE_OFFER_SOUL_SHARD_COST) { showInfoModal("魂のかけらが足りません"); return; }
  // 神社で初めて引くお守りは確定で福禄寿の御守にする(まだ1つも授かっていない=これが最初の1回)
  const drawn = state.omamoriOwned.length === 0 ? omamoriById("fukurokuju") : drawOmamori(state.omamoriOwned);
  if (!drawn) { showInfoModal("すでに全てのお守りを授かっています"); return; }
  state.inventory.soulShard -= SHRINE_OFFER_SOUL_SHARD_COST;
  state.omamoriOwned.push(drawn.id);
  saveState();
  const resultEl = document.getElementById("shrineDrawResult");
  resultEl.style.display = "block";
  resultEl.classList.toggle("omamori-rare-result-card", drawn.tier === 4);
  resultEl.innerHTML = `
    <div class="roster-name">${drawn.name}(${drawn.reading})を授かった！<br><span class="status-tag active">レア度${"⭐️".repeat(drawn.tier)}</span></div>
    <div class="roster-sub" style="margin-top:0.3rem;">${drawn.desc}</div>
  `;
  if (drawn.tier === 4) playRareOmamoriEffect();
  else playSfx("skill_confirm");
  renderOnsenShrine();
};
document.getElementById("shrineSpecialOfferBtn").onclick = () => {
  if ((state.inventory.soulShard || 0) < SHRINE_OFFER_SOUL_SHARD_COST) { showInfoModal("魂のかけらが足りません"); return; }
  if ((state.inventory.soulLump || 0) < SHRINE_SPECIAL_OFFER_LUMP_COST) { showInfoModal("魂の塊が足りません"); return; }
  const drawn = drawOmamori(state.omamoriOwned, SHRINE_SPECIAL_OFFER_MIN_TIER);
  if (!drawn) { showInfoModal("レア度⭐️⭐️⭐️以上のお守りはすでに全て授かっています"); return; }
  state.inventory.soulShard -= SHRINE_OFFER_SOUL_SHARD_COST;
  state.inventory.soulLump -= SHRINE_SPECIAL_OFFER_LUMP_COST;
  state.omamoriOwned.push(drawn.id);
  saveState();
  const resultEl = document.getElementById("shrineDrawResult");
  resultEl.style.display = "block";
  resultEl.classList.toggle("omamori-rare-result-card", drawn.tier === 4);
  resultEl.innerHTML = `
    <div class="roster-name">${drawn.name}(${drawn.reading})を授かった！<br><span class="status-tag active">レア度${"⭐️".repeat(drawn.tier)}</span></div>
    <div class="roster-sub" style="margin-top:0.3rem;">${drawn.desc}</div>
  `;
  if (drawn.tier === 4) playRareOmamoriEffect();
  else playSfx("skill_confirm");
  renderOnsenShrine();
};
// 神社への入場処理(初回訪問特典/NEWバッジ解除)。温泉村/海の村/山伏の里いずれの温泉からも
// 全村共通の同じ神社(state.shrineFirstVisitRewardGiven等)を開けるよう、戻り先だけ引数化した
// (2026-07-20)。NEWバッジは温泉村の温泉画面にしか無いため、無い場合は触らない
function enterOnsenShrine(homeScreen) {
  facilityHomeOnsenScreen = homeScreen;
  state.seenShrineTab = true;
  const newBadge = document.getElementById("onsenShrineTabNewBadge");
  if (newBadge) newBadge.style.display = "none";
  document.getElementById("shrineDrawResult").style.display = "none";
  if (!state.shrineFirstVisitRewardGiven) {
    state.shrineFirstVisitRewardGiven = true;
    state.inventory.soulShard = (state.inventory.soulShard || 0) + SHRINE_FIRST_VISIT_SOUL_SHARD_GIFT;
    saveState();
    showInfoModal(`神社を訪れた記念に、魂のかけらを${SHRINE_FIRST_VISIT_SOUL_SHARD_GIFT}個授かった！`);
  }
  renderOnsenShrine();
  showScreen("screen-onsen-shrine");
}
document.getElementById("toOnsenShrineBtn").onclick = () => { playSfx("select"); enterOnsenShrine("screen-onsen"); };
document.getElementById("onsenShrineBackBtn").onclick = () => { renderFacilityHomeOnsen(); };
document.getElementById("onsenShrineBackBtnTop").onclick = () => { renderFacilityHomeOnsen(); };

// ============ 増築 ============
// ============ 建築(増築画面の施設一覧) ============
// 「仲間を雇う」画面(宿屋)と同じ設計思想(アイコン中心の4列グリッド、詳細は別モーダル)に全面刷新。
// 全16施設のデータを1箇所(BUILDING_DEFS)にまとめ、建築/増築の実処理(buildOrUpgradeBuilding)も
// 汎用の1関数に統一した(以前はdojo/bagShop/henHouse/beeFarmだけ個別のonclickハンドラを持ち、
// 残り12施設もrenderSimpleBuilding/buildSimpleBuildingという別の共通処理を使う、という二重構造
// だったが、costsを「レベルごとの建築費配列」として持たせることで単発建築(costs長さ1)も
// 多段階建築(costs長さ2以上)も同じロジックで扱えるようにした)。
// iconImgが無い施設(まだ専用イラストが無いもの)は絵文字にフォールバックする
const BUILDING_DEFS = [
  { key: "magistrate", levelField: "magistrateLevel", name: "奉行所", icon: "🏯", iconImg: "assets/icons/town_bugyosho.png",
    unlock: MAGISTRATE_UNLOCK_HOUSE_LEVEL, costs: [MAGISTRATE_COST],
    desc: "依頼を受けられるようになります。依頼は毎日入れ替わります。" },
  { key: "shop", levelField: "shopLevel", name: "鍛冶屋", icon: "⚒️", iconImg: "assets/icons/town_kajiya.png",
    unlock: SHOP_UNLOCK_HOUSE_LEVEL, costs: [SHOP_COST],
    desc: "武器・防具を購入できるようになります。(出発準備画面から入れます)" },
  // 旅支度屋だけは専用の建物イラストではなく、既存の野営具アイテムアイコンを流用する(ユーザー指示)
  { key: "travelPrepShop", levelField: "travelPrepShopLevel", name: "旅支度屋", icon: "🏕️", iconImg: "assets/items/camping_kit.png",
    unlock: TRAVEL_PREP_SHOP_UNLOCK_HOUSE_LEVEL, costs: [TRAVEL_PREP_SHOP_COST],
    desc: "出発画面で野営具を購入できるようになります。" },
  { key: "dojo", levelField: "dojoLevel", name: "道場", icon: "🥋", iconImg: "assets/icons/buildings/dojo.png",
    unlock: DOJO_UNLOCK_HOUSE_LEVEL, costs: [DOJO_LEVEL1_COST, DOJO_LEVEL2_COST], classUnlock: "naginata",
    desc: "薙刀士が雇えるようになります。また、冒険に同行しなかった仲間も経験値の分け前をもらえます。",
    levelEffectLabel: "分け前", levelEffect: (lv) => `${Math.round(DOJO_XP_SHARE_BY_LEVEL[lv] * 100)}%` },
  { key: "karakuri", levelField: "karakuriLevel", name: "からくり屋敷", icon: "🎎", iconImg: "assets/icons/buildings/karakuri.png",
    unlock: KARAKURI_UNLOCK_HOUSE_LEVEL, costs: [KARAKURI_COST], classUnlock: "ninja",
    desc: "忍が雇えるようになります。また、戦闘中に煙玉で仲間全員の炎上を消す「消火」が使えるようになります。" },
  { key: "bagShop", levelField: "bagShopLevel", name: "鞄屋", icon: "🧳", iconImg: "assets/icons/buildings/bagShop.png",
    unlock: BAG_SHOP_UNLOCK_HOUSE_LEVEL, costs: [BAG_SHOP_LEVEL1_COST, BAG_SHOP_LEVEL2_COST, BAG_SHOP_LEVEL3_COST],
    desc: "支援物資の所持上限が増えます。",
    levelEffectLabel: "所持上限", levelEffect: (lv) => `+${lv}` },
  { key: "watchtower", levelField: "watchtowerLevel", name: "見張り台", icon: "🏹", iconImg: "assets/icons/buildings/watchtower.png",
    unlock: WATCHTOWER_UNLOCK_HOUSE_LEVEL, costs: [WATCHTOWER_COST],
    desc: "(詳細は未定)" },
  { key: "henHouse", levelField: "henHouseLevel", name: "鶏小屋", icon: "🐓", iconImg: "assets/icons/buildings/henHouse.png",
    unlock: HEN_HOUSE_UNLOCK_HOUSE_LEVEL, costs: [HEN_HOUSE_COST, HEN_HOUSE_COST],
    desc: "(詳細は未定)" },
  { key: "shrine", levelField: "shrineLevel", name: "神社", icon: "⛩️", iconImg: "assets/icons/buildings/shrine.png",
    unlock: SHRINE_UNLOCK_HOUSE_LEVEL, costs: [SHRINE_COST], classUnlock: "priest",
    desc: "僧侶が雇えるようになります。また、出発準備画面でおみくじが引けるようになり、温泉から魂のかけらを捧げてお守りをもらえるようになります。" },
  { key: "hotSpringKeeper", levelField: "hotSpringKeeperLevel", name: "湯守屋", icon: "♨️", iconImg: "assets/icons/buildings/hotSpringKeeper.png",
    unlock: HOT_SPRING_KEEPER_UNLOCK_HOUSE_LEVEL, costs: [HOT_SPRING_KEEPER_COST],
    desc: "温泉で回復するストレスの量が上がります(50→70)。" },
  { key: "gunpowderStore", levelField: "gunpowderStoreLevel", name: "火薬庫", icon: "💣", iconImg: "assets/icons/buildings/gunpowderStore.png",
    unlock: GUNPOWDER_STORE_UNLOCK_HOUSE_LEVEL, costs: [GUNPOWDER_STORE_COST], classUnlock: "gunner",
    desc: "砲術士が雇えるようになります。" },
  { key: "teaHouse", levelField: "teaHouseLevel", name: "茶屋", icon: "🍡", iconImg: "assets/icons/buildings/teaHouse.png",
    unlock: TEA_HOUSE_UNLOCK_HOUSE_LEVEL, costs: [TEA_HOUSE_COST],
    desc: "深淵の森20層で茶屋に立ち寄れるようになります。一休みしてHP・MPを回復したり、お菓子を購入できます。" },
  { key: "stable", levelField: "stableLevel", name: "馬屋", icon: "🐎", iconImg: "assets/icons/buildings/stable.png",
    unlock: STABLE_UNLOCK_HOUSE_LEVEL, costs: [STABLE_COST],
    desc: "(詳細は未定)" },
  { key: "beeFarm", levelField: "beeFarmLevel", name: "養蜂場", icon: "🐝", iconImg: "assets/icons/buildings/beeFarm.png",
    unlock: BEE_FARM_UNLOCK_HOUSE_LEVEL, costs: Array(BEE_FARM_MAX_LEVEL).fill(BEE_FARM_COST),
    desc: "回復薬の回復量が段階ごとに上がります。",
    levelEffectLabel: "回復薬", levelEffect: (lv) => `+${Math.round(BEE_FARM_POTION_BONUS_PER_LEVEL * 100 * lv)}%` },
  { key: "ferry", levelField: "ferryLevel", name: "渡し船", icon: "⛴️", iconImg: "assets/icons/buildings/ferry.png",
    unlock: FERRY_UNLOCK_HOUSE_LEVEL, costs: [FERRY_COST],
    desc: "(詳細は未定)" },
  { key: "ryodanki", levelField: "ryodankiLevel", name: "旅団旗", icon: "🚩", iconImg: "assets/icons/buildings/ryodanki.png",
    unlock: RYODANKI_UNLOCK_HOUSE_LEVEL, costs: [RYODANKI_COST],
    desc: "出発パーティの上限が4人から5人になります。5人目は戦闘に参加しない交代要員です。" },
];
// 施設アイコンのHTML。写真素材(iconImg)があればそれを、無ければ絵文字を表示する。
// silhouette=trueの時はfilter:brightness(0)で黒いシルエットにする。CSSのfilterは要素自身の
// background-colorも含めて丸ごと暗くしてしまうため(職業雇用画面のシルエットで踏んだのと同じ地雷)、
// フィルターを掛けないラッパー側に背景色を持たせ、フィルター対象(img/絵文字本体)側は透明にする
function buildingIconHtml(def, opts) {
  opts = opts || {};
  const wrapCls = opts.large ? "building-detail-icon-wrap" : "building-card-icon-wrap";
  const silCls = opts.silhouette ? " silhouette" : "";
  if (def.iconImg) return `<div class="${wrapCls}"><img class="building-icon-img${silCls}" src="${def.iconImg}"></div>`;
  return `<div class="${wrapCls}"><div class="building-icon-emoji${silCls}">${def.icon}</div></div>`;
}
// 新しく建築可能になった施設に「NEW」バッジを出す。一度でも一覧に表示されるとその場で
// state.seenUnlockedBuildingsに記録するため、次に開いた時にはもう出ない(「見た瞬間に消える」方式)
function buildingNewBadgeHtml(def, unlocked, built) {
  const isNew = unlocked && !built && !state.seenUnlockedBuildings[def.levelField];
  if (isNew) state.seenUnlockedBuildings[def.levelField] = true;
  return isNew ? '<span class="new-badge building-new-badge">NEW</span>' : "";
}
// 「建築済み/建築可能/未解放」の3グリッドを描画する。空のグループはタイトルごと非表示にする
function renderBuildingGrid(houseLevel) {
  const builtEl = document.getElementById("buildingGridBuilt");
  const availEl = document.getElementById("buildingGridAvailable");
  const lockedEl = document.getElementById("buildingGridLocked");
  builtEl.innerHTML = ""; availEl.innerHTML = ""; lockedEl.innerHTML = "";
  BUILDING_DEFS.forEach((def) => {
    const lv = state[def.levelField] || 0;
    const unlocked = houseLevel >= def.unlock;
    const built = lv > 0;
    const card = document.createElement("div");
    if (built) {
      card.className = "building-card";
      card.innerHTML = `
        ${buildingIconHtml(def)}
        <span class="building-badge built">建築済み</span>
        <div class="building-card-name">${def.name}</div>
        ${def.costs.length > 1 ? `<div class="building-card-lv">Lv${lv}</div>` : ""}
      `;
      card.onclick = () => openBuildingDetail(def.key);
      builtEl.appendChild(card);
    } else if (unlocked) {
      card.className = "building-card";
      const cost = def.costs[0];
      const canAfford = state.gold >= cost;
      card.innerHTML = `
        ${buildingIconHtml(def)}
        ${buildingNewBadgeHtml(def, unlocked, built)}
        <div class="building-card-name">${def.name}</div>
        <div class="building-card-action">${canAfford
          ? `<button class="building-build-btn" type="button">建築する</button>`
          : `<div class="building-need-gold">必要：${cost}G</div>`}</div>
      `;
      if (canAfford) {
        card.querySelector(".building-build-btn").onclick = (e) => { e.stopPropagation(); buildOrUpgradeBuilding(def.key); };
      }
      card.onclick = (e) => { if (e.target.closest(".building-build-btn")) return; openBuildingDetail(def.key); };
      availEl.appendChild(card);
    } else {
      card.className = "building-card locked";
      card.innerHTML = `
        ${buildingIconHtml(def, { silhouette: true })}
        <div class="building-card-locked-label">🔒家Lv${def.unlock}で解放</div>
      `;
      lockedEl.appendChild(card);
    }
  });
  document.getElementById("buildingSectionBuilt").style.display = builtEl.children.length > 0 ? "" : "none";
  document.getElementById("buildingSectionAvailable").style.display = availEl.children.length > 0 ? "" : "none";
  document.getElementById("buildingSectionLocked").style.display = lockedEl.children.length > 0 ? "" : "none";
}
// 施設タップで開く詳細モーダル。建築済みなら現在の効果+次の段階への増築ボタン(あれば)、
// 建築可能なら効果説明+建築ボタンを表示する。図鑑のモンスター詳細モーダルと同じ
// overlay+card+閉じるボタンの型を流用している(未解放の施設はカード自体がタップ不可なので対象外)
function openBuildingDetail(key) {
  const def = BUILDING_DEFS.find((d) => d.key === key);
  if (!def) return;
  const lv = state[def.levelField] || 0;
  document.getElementById("buildingDetailIconWrap").innerHTML = buildingIconHtml(def, { large: true });
  document.getElementById("buildingDetailName").textContent = def.name + (lv > 0 && def.costs.length > 1 ? ` Lv.${lv}` : "");
  const effectLine = (lv > 0 && def.levelEffect) ? `${def.levelEffectLabel}${def.levelEffect(lv)}` : "";
  document.getElementById("buildingDetailDesc").textContent = [def.desc, effectLine].filter(Boolean).join("\n");
  const btn = document.getElementById("buildingDetailActionBtn");
  const reasonEl = document.getElementById("buildingDetailReason");
  if (lv >= def.costs.length) {
    btn.style.display = "none";
    reasonEl.style.display = "none";
  } else {
    const cost = def.costs[lv];
    const canAfford = state.gold >= cost;
    btn.style.display = "";
    btn.textContent = `${lv === 0 ? "建築する" : "増築する"}（${cost}G）`;
    btn.disabled = !canAfford;
    // 押せない理由は所持金不足の時だけボタン直下に表示する(家カードと同じ文言パターン)
    if (canAfford) {
      reasonEl.style.display = "none";
    } else {
      reasonEl.textContent = `所持金が不足しています（${state.gold}/${cost}G）`;
      reasonEl.style.display = "";
    }
    btn.onclick = () => {
      document.getElementById("buildingDetailOverlay").style.display = "none";
      buildOrUpgradeBuilding(def.key);
    };
  }
  document.getElementById("buildingDetailOverlay").style.display = "flex";
}
document.getElementById("buildingDetailCloseBtn").onclick = () => {
  document.getElementById("buildingDetailOverlay").style.display = "none";
};
function renderExtension() {
  // 温泉村から開いた時だけ町のBGMへ切り替える(海の村/山伏の里から開いた場合はその村で
  // 鳴っていた音をそのまま邪魔しない。村自体のBGM設計は今回のスコープ外)
  if (facilityHomeScreen === "screen-town") playTownAreaBgm();
  updateSceneBackgrounds();
  renderDwHeader("extension", "増築", () => { renderFacilityHome(); });
  document.getElementById("extensionGold").textContent = state.gold + "G";
  const level = state.houseLevel || 1;
  document.getElementById("extensionLevel").textContent = level;
  document.getElementById("extensionCapacity").textContent = rosterCapacity();
  document.getElementById("extensionDesc").innerHTML = "仲間を雇える上限が増えます。<br>（冒険に出発できる人数は最大4人です。）";
  // 次の家レベルで解禁される施設があれば「◯◯ 解放」の形で「次の増築」セクションに列挙する
  const nextLevel = level + 1;
  const unlocksAtNextLevel = BUILDING_DEFS.filter((def) => (state[def.levelField] || 0) === 0 && nextLevel === def.unlock).map((def) => def.name);
  const btn = document.getElementById("extensionUpgradeBtn");
  const reasonEl = document.getElementById("extensionUpgradeReason");
  const nextSection = document.getElementById("extensionNextSection");
  if (level >= HOUSE_MAX_LEVEL) {
    // これ以上増築できない=「次」が存在しないので、次の増築セクション自体を非表示にする
    // (「現在」の情報だけが残り、混乱の元になる「次」の空欄を見せない)
    nextSection.style.display = "none";
    btn.textContent = "これ以上は増築できません(上限)";
    btn.disabled = true;
    reasonEl.style.display = "none";
  } else {
    nextSection.style.display = "";
    document.getElementById("extensionNextLabel").innerHTML = `次の増築（<span class="house-next-level">Lv${nextLevel}</span>）`;
    document.getElementById("extensionNextCapacity").textContent = rosterCapacity() + 1;
    // 解放される施設が無いレベルでは「新施設」の見出しだけ浮くのを避けるため、このブロックごと隠す
    const facilityBlock = document.getElementById("extensionFacilityBlock");
    facilityBlock.style.display = unlocksAtNextLevel.length > 0 ? "" : "none";
    document.getElementById("extensionNextUnlockList").innerHTML = unlocksAtNextLevel
      .map((name) => `<div class="house-status-unlock">・${name}</div>`).join("");
    const cost = houseUpgradeCost(level);
    const canAfford = state.gold >= cost;
    btn.textContent = `増築する（${cost}G）`;
    btn.disabled = !canAfford;
    // 押せない理由は所持金不足の時だけ、ボタン直下に「所持金が不足しています（70/200G）」の形で表示する
    // (以前は赤字で「200G必要（所持80G）」だったが、赤は警告が強すぎるとの指摘で色・文言とも変更した)
    if (canAfford) {
      reasonEl.style.display = "none";
    } else {
      reasonEl.textContent = `所持金が不足しています（${state.gold}/${cost}G）`;
      reasonEl.style.display = "";
    }
  }
  renderBuildingGrid(level);
  saveState();
}
// ============ 建築/増築の完了演出 ============
// 職業解放を伴う建築(からくり屋敷/火薬庫/神社/道場の初回建築)は、通常の建築演出の代わりに
// 新しい職業が雇えるお知らせを出す(二重に演出しない、というユーザー指示)
const FACILITY_DISPLAY = {
  houseLevel: { icon: "🏠", name: "家" },
  magistrateLevel: { icon: "🏯", name: "奉行所" },
  shopLevel: { icon: "⚒️", name: "鍛冶屋" },
  travelPrepShopLevel: { icon: "🏕️", name: "旅支度屋" },
  dojoLevel: { icon: "🥋", name: "道場" },
  karakuriLevel: { icon: "🎎", name: "からくり屋敷" },
  bagShopLevel: { icon: "🧳", name: "鞄屋" },
  watchtowerLevel: { icon: "🏹", name: "見張り台" },
  henHouseLevel: { icon: "🐓", name: "鶏小屋" },
  shrineLevel: { icon: "⛩️", name: "神社" },
  hotSpringKeeperLevel: { icon: "♨️", name: "湯守屋" },
  gunpowderStoreLevel: { icon: "💣", name: "火薬庫" },
  teaHouseLevel: { icon: "🍡", name: "茶屋" },
  stableLevel: { icon: "🐎", name: "馬屋" },
  beeFarmLevel: { icon: "🐝", name: "養蜂場" },
  ferryLevel: { icon: "⛴️", name: "渡し船" },
  ryodankiLevel: { icon: "🚩", name: "旅団旗" },
};
// アイコン(または職業解放時は全身立ち絵)がフェードイン→少し間を置いてから結果パネルが現れる、の2段構え。
// タップで即座にパネルへ進める。imageSrcを渡すとアイコンの絵文字ではなく立ち絵画像を表示する
let buildCompleteRevealed = false;
function showBuildCompleteOverlay(icon, title, name, effectLines, imageSrc) {
  const overlay = document.getElementById("buildCompleteOverlay");
  const panel = document.getElementById("buildCompletePanel");
  const iconEl = document.getElementById("buildCompleteIcon");
  const imgEl = document.getElementById("buildCompleteCharImg");
  if (imageSrc) {
    imgEl.src = imageSrc;
    imgEl.style.display = "";
    iconEl.style.display = "none";
  } else {
    iconEl.textContent = icon;
    iconEl.style.display = "";
    imgEl.style.display = "none";
  }
  document.getElementById("buildCompleteTitle").textContent = title;
  document.getElementById("buildCompleteName").textContent = name;
  document.getElementById("buildCompleteEffect").innerHTML = effectLines.filter(Boolean).map((l) => `<div>${l}</div>`).join("");
  panel.style.display = "none";
  overlay.style.display = "flex";
  overlay.classList.remove("icon-in");
  void overlay.offsetWidth; // フェードインアニメーションを毎回最初から再生させるための強制リフロー
  overlay.classList.add("icon-in");
  playSfx("extension_build");
  buildCompleteRevealed = false;
  function reveal() {
    if (buildCompleteRevealed) return;
    buildCompleteRevealed = true;
    clearTimeout(revealTimer);
    panel.style.display = "block";
  }
  const revealTimer = setTimeout(reveal, 1300);
  overlay.onclick = () => { if (!buildCompleteRevealed) reveal(); };
  document.getElementById("buildCompleteCloseBtn").onclick = (e) => {
    e.stopPropagation();
    overlay.style.display = "none";
  };
}
// 新規建築完了(職業解放を伴わない場合のみ呼ばれる)。BUILDING_DEFSの説明文をそのまま効果表示に流用する
function showBuildCompleteForNewFacility(stateKey) {
  const info = FACILITY_DISPLAY[stateKey];
  if (!info) return;
  const def = BUILDING_DEFS.find((d) => d.levelField === stateKey);
  showBuildCompleteOverlay(info.icon, "建築完了！", `${info.name} 完成`, [def ? def.desc : ""]);
}
// 施設強化完了(家・道場の2段階目等)。今回増えた効果の差分だけを表示する
function showBuildCompleteForUpgrade(stateKey, newLevel, deltaLines) {
  const info = FACILITY_DISPLAY[stateKey];
  if (!info) return;
  showBuildCompleteOverlay(info.icon, "施設を強化しました！", `${info.name} Lv.${newLevel}`, deltaLines);
}
// 職業解放のお知らせ(からくり屋敷/火薬庫/神社/道場初回建築の代わりに出す)
function showClassUnlockCelebration(classId) {
  const c = CLASSES[classId];
  // CLASSES[classId].imageは胸から上のバストアップ立ち絵なので、足元まで写る全身透過絵
  // (CLASS_STATUS_PORTRAIT、本来はステータス詳細画面専用)をこの演出だけ使い回す
  showBuildCompleteOverlay(null, "新しい仲間を雇えるようになりました！", c.ja, [CLASS_DESC[classId], "宿屋で雇えます。"], CLASS_STATUS_PORTRAIT[classId]);
}
// 建築/増築の共通処理。全16施設がこの1つの関数で完結する(costsが1要素なら単発建築のみ、
// 複数要素なら道場/鞄屋/養蜂場/鶏小屋のような多段階建築になる)
function buildOrUpgradeBuilding(key) {
  const def = BUILDING_DEFS.find((d) => d.key === key);
  if (!def) return;
  const lv = state[def.levelField] || 0;
  const houseLevel = state.houseLevel || 1;
  if (lv >= def.costs.length) return;
  if (lv === 0 && houseLevel < def.unlock) return;
  const cost = def.costs[lv];
  if (state.gold < cost) return;
  state.gold -= cost;
  state[def.levelField] = lv + 1;
  saveState();
  renderExtension();
  if (lv === 0) {
    if (def.classUnlock) showClassUnlockCelebration(def.classUnlock);
    else showBuildCompleteForNewFacility(def.levelField);
  } else {
    const deltaLine = def.levelEffect ? `${def.levelEffectLabel}${def.levelEffect(lv)}→${def.levelEffect(lv + 1)}` : null;
    showBuildCompleteForUpgrade(def.levelField, state[def.levelField], [deltaLine].filter(Boolean));
  }
}
document.getElementById("extensionUpgradeBtn").onclick = () => {
  const level = state.houseLevel || 1;
  if (level >= HOUSE_MAX_LEVEL) return;
  const cost = houseUpgradeCost(level);
  if (state.gold < cost) return;
  const capBefore = rosterCapacity();
  state.gold -= cost;
  state.houseLevel = level + 1;
  saveState();
  renderExtension();
  showBuildCompleteForUpgrade("houseLevel", state.houseLevel, [`仲間上限 ${capBefore}→${rosterCapacity()}人`]);
};
document.getElementById("toExtensionBtn").onclick = () => { playSfx("select"); facilityHomeScreen = "screen-town"; renderExtension(); showScreen("screen-extension"); };
document.getElementById("toMagistrateBtn").onclick = () => { playSfx("select"); facilityHomeScreen = "screen-town"; renderMagistrateScreen(); };
document.getElementById("extensionBackBtn").onclick = () => { renderFacilityHome(); };
document.getElementById("extensionBackBtnTop").onclick = () => { renderFacilityHome(); };

// ============ 奉行所: 討伐依頼(日替わり・受注制) ============
// 全10件を一度に出さず、最大QUEST_BOARD_SIZE件だけ毎日ランダムに選び直す。dayCountが変わるまでは
// 同じ顔ぶれを維持し、変わった瞬間に新しい顔ぶれへ入れ替える。受注制のため、この一覧自体は
// idの配列だけを持てばよく(進捗は受注中の1件=state.acceptedQuestだけが持つ)。
// 受注中の依頼だけは入れ替え対象から除外し、それ以外の枠だけ毎日ローテーションする。
// 1件目は確定、2件目/3件目はそれぞれ抽選(外れたらそこで打ち切り、3件目だけ出るような逆転はしない)。
// 一度張り出された依頼はQUEST_COOLDOWN_DAYS日の間、再抽選の候補から外れる
function refreshMagistrateQuestsIfNeeded() {
  // ★2依頼追加前のセーブ(配列形式)がまだ残っている場合の保険。save.jsのloadState()側で
  // 通常は既に{1:[],2:[]}へ変換済みのはずだが、念のためここでも自己修復する
  if (!state.magistrateAvailableQuests || Array.isArray(state.magistrateAvailableQuests)) {
    state.magistrateAvailableQuests = { 1: [], 2: [] };
    state.magistrateQuestDate = 0;
  }
  if (state.magistrateQuestDate === state.dayCount && state.magistrateAvailableQuests[1].length > 0 && state.magistrateAvailableQuests[2].length > 0) return;
  const keepKey = state.acceptedQuest ? state.acceptedQuest.questKey : null;
  const keepTier = keepKey ? (QUEST_DEFS[keepKey] || {}).tier : null;
  const lastShown = state.magistrateQuestLastShown || {};
  // 奉行所を解禁して★1に一度も依頼が張り出されたことが無い(=これが初回の抽選)間は、まだ深く
  // 潜っていない新規プレイヤーでも無理なく受けられるよう、目標階層5階までの依頼に限定する
  // (2回目以降の通常のローテーションでは通常通り★1全体から抽選する)
  const isFirstMagistrateTier1Draw = !Object.keys(lastShown).some((id) => QUEST_DEFS[id] && QUEST_DEFS[id].tier === 1);
  const slotChances = [1.0, QUEST_BOARD_SECOND_SLOT_CHANCE, QUEST_BOARD_THIRD_SLOT_CHANCE];
  [1, 2].forEach((tier) => {
    const tierKeepKey = keepTier === tier ? keepKey : null;
    const pool = Object.keys(QUEST_DEFS).filter((id) => {
      if (QUEST_DEFS[id].tier !== tier) return false;
      if (QUEST_DEFS[id].requiresOoInoshishi && !state.defeatedOoInoshishi) return false; // ボス級指名討伐は大猪を一度倒すまで張り出されない
      if (QUEST_DEFS[id].minQuestClears && (state.magistrateQuestClearCount || 0) < QUEST_DEFS[id].minQuestClears) return false; // 大猪(中ボス)は依頼を規定回数達成するまで張り出されない
      if (tier === 1 && isFirstMagistrateTier1Draw && QUEST_DEFS[id].targetFloor > 8) return false;
      if (id === tierKeepKey) return false; // 受注中のものは既に確定枠なので通常抽選プールには含めない
      const shownDay = lastShown[id];
      return shownDay == null || (state.dayCount - shownDay) >= QUEST_COOLDOWN_DAYS;
    });
    const picked = tierKeepKey ? [tierKeepKey] : [];
    for (let i = picked.length; i < QUEST_BOARD_SIZE && pool.length > 0; i++) {
      const chance = slotChances[i] != null ? slotChances[i] : 1.0;
      if (Math.random() >= chance) break;
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    picked.forEach((id) => { if (id !== tierKeepKey) lastShown[id] = state.dayCount; });
    state.magistrateAvailableQuests[tier] = picked;
  });
  state.magistrateQuestLastShown = lastShown;
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
  if (facilityHomeScreen === "screen-town") playTownAreaBgm();
  updateSceneBackgrounds();
  renderDwHeader("magistrate", "奉行所", () => { renderFacilityHome(); });
  refreshMagistrateQuestsIfNeeded();
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
  const activeTab = state.magistrateQuestTab === 2 ? 2 : 1;
  document.getElementById("magistrateTab1Btn").className = "omikuji-chip-btn" + (activeTab === 1 ? " active" : "");
  document.getElementById("magistrateTab2Btn").className = "omikuji-chip-btn" + (activeTab === 2 ? " active" : "");
  state.magistrateAvailableQuests[activeTab].forEach((id) => {
    const def = QUEST_DEFS[id];
    const isAccepted = state.acceptedQuest && state.acceptedQuest.questKey === id;
    // 同じ依頼を1日に何度もクリアして稼げてしまわないよう、達成日が今日のうちは再受注させない
    const clearedToday = (state.magistrateQuestClearedOn || {})[id] === state.dayCount;
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
    } else if (clearedToday) {
      btn.className = "big";
      btn.textContent = "本日は達成済みです(翌日また受けられます)";
      btn.disabled = true;
    } else {
      // 所持金不足の時、以前はボタンをdisabledにして押せなくしていたが、見た目の変化が地味で
      // 「押しても反応しない=壊れている」と誤解される不具合報告があったため、押せる状態のまま残し、
      // タップした瞬間にアラートで理由をはっきり伝える方式に変更した
      btn.className = "big primary";
      btn.textContent = `受注する(報酬 ${questGoldReward(def)}G${QUEST_REWARD_XP > 0 ? ` / XP${QUEST_REWARD_XP}` : ""})`;
      btn.onclick = () => {
        if (state.gold < fee) { showInfoModal(`契約金が足りません(あと${fee - state.gold}G不足)`); return; }
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
  if ((state.magistrateQuestClearedOn || {})[enemyId] === state.dayCount) return; // 同じ依頼を同日中に再受注させない
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
document.getElementById("magistrateBackBtnTop").onclick = () => { renderFacilityHome(); };
document.getElementById("magistrateBackBtn").onclick = () => { renderFacilityHome(); };
document.getElementById("magistrateTab1Btn").onclick = () => { playSfx("select"); state.magistrateQuestTab = 1; renderMagistrateScreen(); };
document.getElementById("magistrateTab2Btn").onclick = () => { playSfx("select"); state.magistrateQuestTab = 2; renderMagistrateScreen(); };

// ゲームオーバー画面の「最初から」: セーブを消してページごと再読み込みし、完全に初期状態からやり直す
document.getElementById("gameoverRestartBtn").onclick = () => {
  localStorage.removeItem(SAVE_KEY);
  location.reload();
};

// ============ 道具屋 ============
function renderShop() {
  if (facilityHomeScreen === "screen-town") playTownAreaBgm();
  updateSceneBackgrounds();
  renderDwHeader("shop", "鍛冶屋", () => { renderFacilityHome(); });
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
  // 装備は上位を買うと下位から加算ではなく差し替えになるため(computeEquipBonus参照)、
  // next.bonusをそのまま表示すると「実際に増える量」より大きく見えてしまう(2回目以降の購入で常に発生)。
  // 現在所持ぶんのbonusとの差分を実際の増分として表示する
  const currentBonus = ownedTier > 0 ? tiers[ownedTier - 1].bonus : 0;
  const gain = next.bonus - currentBonus;
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
        <span class="desc">${statLabel}+${gain}${mpNote} ${!levelOk ? `/ ${reason}` : ""}</span>
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
  if (!classHasReachedLevel(state.roster, classId, next.level)) { showInfoModal(`Lv${next.level}に到達した${CLASSES[classId].ja}が必要です`); return; }
  if (state.gold < next.price) { showInfoModal("お金が足りません"); return; }
  state.gold -= next.price;
  state.classUpgrades[classId][slot] = ownedTier + 1;
  refreshEquipBonus(state.roster, classId, state.classUpgrades);
  saveState();
  playSfx("coin");
  renderShop();
  const purchasedImg = document.querySelector(`#equipmentList img[data-class="${classId}"]`);
  if (purchasedImg) retriggerEntryAnim(purchasedImg, "purchase-glint");
}
// 鍛冶屋は出発準備画面から開くようになった(2026-07-18)ため、戻り先も出発準備にする
document.getElementById("shopBackBtn").onclick = () => { renderFacilityHome(); };
document.getElementById("shopBackBtnTop").onclick = () => { renderFacilityHome(); };

// ============ 開発者用: 町トップのゴールド表示を4回連続タップでエンカウントOFF/ONを切り替え ============
// 敵データがまだ無いエリア(廃城下町/門/古城等)の下地・背景を戦闘無しで歩いて確認したい時用。
// debugNoEncountersはdungeon.jsで定義、rollEncounter()側でゲート
let goldDebugTapCount = 0;
let goldDebugTapTimer = null;
document.getElementById("townGold").addEventListener("click", () => {
  goldDebugTapCount++;
  clearTimeout(goldDebugTapTimer);
  goldDebugTapTimer = setTimeout(() => { goldDebugTapCount = 0; }, 1200);
  if (goldDebugTapCount >= 4) {
    goldDebugTapCount = 0;
    debugNoEncounters = !debugNoEncounters;
    showInfoModal(debugNoEncounters ? "【開発者用】敵エンカウントをOFFにしました" : "【開発者用】敵エンカウントをONに戻しました");
    renderTown();
  }
});

// ============ 初期化 ============
// ゲームの入口は常にタイトル画面(title.js)。ここでの自動遷移は廃止した。
