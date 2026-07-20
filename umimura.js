// ============ umimura.js: 海の村(第二の町、2026-07-19)。廃城下町の出口の分岐から到達する ============
// 中継の村(海の村/山伏の里、今後増える村も含む)は、温泉村と見た目だけ異なる別画面だが、
// 仕様は完全に同一にする(ユーザー指示、2026-07-21: 「温泉村と同じにして」)。宿は名簿(state.roster、
// 温泉村と同じく在宅中の仲間も含む名簿全員)+雇用まで含めてtown.jsのrenderInnRosterList等を再利用する。
// 温泉/支度は遠征中で物理的にそこにいるfieldPartyが対象(既存の実装のまま)

function renderUmiMura() {
  document.getElementById("umimuraHeaderGold").textContent = `${state.gold}G`;
  document.getElementById("umimuraHeaderTime").textContent = `${TIME_PHASE_LABEL[state.timeOfDay || "day"]} ${formatClockTime(state.clockMinutes)}`;
  // 奉行所は温泉村と同じ解禁条件(state.magistrateLevel、建築で解放)。全村共通の経済のため
  // 温泉村で解放すればここにもすぐ現れる
  document.getElementById("umimuraMagistrateBtn").style.display = state.magistrateLevel ? "" : "none";
  updateSceneBackgrounds();
  // 温泉村のrenderTown()と同じく、入浴ロックが明けたキャラがいれば「リラックスできた！」を
  // ここでも出す(海の村の温泉で入浴した後、温泉村へ戻らずここに留まり続けるケースがあるため)
  checkOnsenReliefPopups();
}

const UMIYADO_INN_IDS = { rosterList: "umiyadoRosterList", lodgeBtn: "umiyadoStayBtn", classGrid: "umiyadoClassGrid", classDesc: "umiyadoClassDescArea", nameInput: "umiyadoNewCharName", createBtn: "umiyadoCreateCharBtn", gold: "umiyadoGold" };
function defaultUmiyadoStatusOnBack() { renderUmiYado(); showScreen("screen-umiyado"); }
function renderUmiYado() {
  renderDwHeader("umiyado", "潮風宿", () => { renderUmiMura(); showScreen("screen-umimura"); });
  document.getElementById("umiyadoGold").textContent = state.gold + "G";
  renderInnRosterList(UMIYADO_INN_IDS, () => state.roster, defaultUmiyadoStatusOnBack);
  renderInnClassGrid(UMIYADO_INN_IDS);
  updateSceneBackgrounds();
}

function renderUmiOnsen() {
  renderDwHeader("umionsen", "湯乃里温泉", () => { renderUmiMura(); showScreen("screen-umimura"); });
  document.getElementById("umionsenShrineBtn").style.display = (state.shrineLevel || 0) > 0 ? "" : "none";
  renderOnsenRosterList("umionsenList", fieldParty);
  updateSceneBackgrounds();
}
document.getElementById("umionsenShopBtn").onclick = () => { playSfx("select"); facilityHomeOnsenScreen = "screen-umionsen"; renderOnsenShop(); showScreen("screen-onsen-shop"); };
document.getElementById("umionsenShrineBtn").onclick = () => { playSfx("select"); enterOnsenShrine("screen-umionsen"); };

// 廃城下町の出口の分岐で「海の村」を選んだ時に呼ぶ。moveOneFloor()の往路分岐と同様の
// 最低限のブックキーピング(疲労・時計・セーブ)だけ行い、通常のダンジョン画面ではなく
// 海の村の画面を表示する。stageEntryStackに直前地点(廃城下町の最深部)を積んでおくことで、
// 「温泉村へ帰る」を選んだ時にそこから既存の帰還カスケードへそのまま合流できる
function arriveAtUmiMura() {
  advanceFatigue(fieldParty);
  stageEntryStack.push({ stage: currentStage, floor: currentFloor });
  currentStage = "umimura";
  currentFloor = 1;
  saveState();
  recordMaxFloorReached();
  healPartyOnFloorMove();
  advanceExplorationClock(MINUTES_PER_FLOOR_FORWARD);
  dlog("⛵海の村にたどり着いた。");
  saveState();
  renderUmiMura();
  showScreen("screen-umimura");
}

document.getElementById("umimuraYadoBtn").onclick = () => { playSfx("select"); renderUmiYado(); showScreen("screen-umiyado"); };
document.getElementById("umimuraOnsenBtn").onclick = () => { playSfx("onsen_enter"); renderUmiOnsen(); showScreen("screen-umionsen"); };
// 奉行所/建築は温泉村と全村共通の経済(BUILDING_DEFS/state.magistrateLevel等がグローバル)を
// 見た目だけ村を変えて開く(town.jsのfacilityHomeScreenで戻り先を覚える仕組み、2026-07-20)。
// 鍛冶屋は温泉村と同じく村トップのカードではなく出発準備画面(screen-village-prep)のチップから開く
// (ユーザー指摘、2026-07-21: 出発タブに統合するはずが村トップに残っていた)
document.getElementById("umimuraMagistrateBtn").onclick = () => { playSfx("select"); facilityHomeScreen = "screen-umimura"; renderMagistrateScreen(); };
document.getElementById("umimuraExtensionBtn").onclick = () => { playSfx("select"); facilityHomeScreen = "screen-umimura"; renderExtension(); showScreen("screen-extension"); };
// 「出発」: 温泉村の出発準備画面と同じく、支援物資の購入と行き先選びを1画面(screen-village-prep、
// renderVillagePrep)にまとめてある(ユーザー指示、2026-07-21: 支度ボタンを独立させず出発の中に統合)。
// 行き先は廃城下町(元来た道を歩いて戻る)と海岸(既存の海岸ステージを15層に縮めて流用、新規ルート)の2択。
// 「廃城下町へ」はオート帰還ではなく、普通の探索と同じ1階層ずつの手動歩行にする
// (manualRetreatMode、advanceBtn.onclick/renderDungeon側で挙動を分岐)。海の村自体は
// 「1階層だけの中継ステージ」として扱っているため、stageEntryStackのpopは他のステージと同じ形になる
document.getElementById("umimuraLeaveBtn").onclick = () => {
  playSfx("select");
  facilityHomeScreen = "screen-umimura";
  renderVillagePrep([
    {
      label: "廃城下町へ(歩いて戻る)",
      onClick: () => {
        const prev = stageEntryStack.pop();
        currentStage = prev.stage;
        currentFloor = prev.floor;
        retreating = true;
        manualRetreatMode = true;
        manualRetreatHomeVillage = "umimura";
        dlog("🏚️廃城下町へ向けて歩き出した。");
        saveState();
        showScreen("screen-dungeon");
        renderDungeon();
      },
    },
    {
      label: "海岸へ(新ルート)",
      onClick: () => {
        stageEntryStack.push({ stage: "umimura", floor: 1 });
        currentStage = "coast";
        currentFloor = 1;
        advanceFatigue(fieldParty);
        saveState();
        recordMaxFloorReached();
        dlog("🌊海岸へ足を踏み入れた。");
        showScreen("screen-dungeon");
        renderDungeon();
      },
    },
  ]);
  showScreen("screen-village-prep");
};

document.getElementById("umiyadoBackBtn").onclick = () => { renderUmiMura(); showScreen("screen-umimura"); };
// 宿泊・雇用のロジックはtown.jsのperformLodging()/wireInnHireButton()に一本化済み(温泉村の宿屋と
// 完全に同じ確認モーダル→暗転→回復サマリー→翌朝フェードインの流れ)。背景セットだけ潮風宿
// (BG_SETS.umiyado)に差し替えて流用する
document.getElementById("umiyadoStayBtn").onclick = () => {
  performLodging(state.roster.filter((c) => c.status === "active"), BG_SETS.umiyado, renderUmiYado);
};
wireInnHireButton(UMIYADO_INN_IDS, () => state.roster, defaultUmiyadoStatusOnBack);

document.getElementById("umionsenBackBtn").onclick = () => { renderUmiMura(); showScreen("screen-umimura"); };

// ============ 山伏の里(第三の村、2026-07-19)。渓流→光る竹林の先から到達する ============
// 海の村と同じく、温泉/宿等の仕様は温泉村と完全に同一にする(宿は絵が揃ったため2026-07-21追加)。
// 海の村と違い、この先(修験道→山)へさらに進める「修験道へ進む」ボタンを持つ

function renderYamabushi() {
  document.getElementById("yamabushiHeaderGold").textContent = `${state.gold}G`;
  document.getElementById("yamabushiHeaderTime").textContent = `${TIME_PHASE_LABEL[state.timeOfDay || "day"]} ${formatClockTime(state.clockMinutes)}`;
  document.getElementById("yamabushiMagistrateBtn").style.display = state.magistrateLevel ? "" : "none";
  updateSceneBackgrounds();
  checkOnsenReliefPopups(); // 海の村と同じく、この村のホーム画面に戻った時にも入浴リリーフ演出を出す
}

const YAMABUSHIYADO_INN_IDS = { rosterList: "yamabushiyadoRosterList", lodgeBtn: "yamabushiyadoStayBtn", classGrid: "yamabushiyadoClassGrid", classDesc: "yamabushiyadoClassDescArea", nameInput: "yamabushiyadoNewCharName", createBtn: "yamabushiyadoCreateCharBtn", gold: "yamabushiyadoGold" };
function defaultYamabushiyadoStatusOnBack() { renderYamabushiYado(); showScreen("screen-yamabushiyado"); }
function renderYamabushiYado() {
  renderDwHeader("yamabushiyado", "霧の宿", () => { renderYamabushi(); showScreen("screen-yamabushi"); });
  document.getElementById("yamabushiyadoGold").textContent = state.gold + "G";
  renderInnRosterList(YAMABUSHIYADO_INN_IDS, () => state.roster, defaultYamabushiyadoStatusOnBack);
  renderInnClassGrid(YAMABUSHIYADO_INN_IDS);
  updateSceneBackgrounds();
}

function renderYamabushiOnsen() {
  renderDwHeader("yamabushionsen", "雲海の湯", () => { renderYamabushi(); showScreen("screen-yamabushi"); });
  document.getElementById("yamabushionsenShrineBtn").style.display = (state.shrineLevel || 0) > 0 ? "" : "none";
  renderOnsenRosterList("yamabushionsenList", fieldParty);
  updateSceneBackgrounds();
}
document.getElementById("yamabushionsenShopBtn").onclick = () => { playSfx("select"); facilityHomeOnsenScreen = "screen-yamabushionsen"; renderOnsenShop(); showScreen("screen-onsen-shop"); };
document.getElementById("yamabushionsenShrineBtn").onclick = () => { playSfx("select"); enterOnsenShrine("screen-yamabushionsen"); };

// 光る竹林の最深部に到達した時に呼ぶ(廃城下町→海の村と同じ「1階層だけの中継ステージ」の扱い)
function arriveAtYamabushi() {
  advanceFatigue(fieldParty);
  stageEntryStack.push({ stage: currentStage, floor: currentFloor });
  currentStage = "yamabushi";
  currentFloor = 1;
  saveState();
  recordMaxFloorReached();
  healPartyOnFloorMove();
  advanceExplorationClock(MINUTES_PER_FLOOR_FORWARD);
  dlog("⛩️山伏の里にたどり着いた。");
  saveState();
  renderYamabushi();
  showScreen("screen-yamabushi");
}

document.getElementById("yamabushiYadoBtn").onclick = () => { playSfx("select"); renderYamabushiYado(); showScreen("screen-yamabushiyado"); };
document.getElementById("yamabushiOnsenBtn").onclick = () => { playSfx("onsen_enter"); renderYamabushiOnsen(); showScreen("screen-yamabushionsen"); };
// 奉行所/建築/鍛冶屋は温泉村と全村共通の経済を見た目だけ村を変えて開く(umimura.js側と同じ仕組み、2026-07-20)
document.getElementById("yamabushiMagistrateBtn").onclick = () => { playSfx("select"); facilityHomeScreen = "screen-yamabushi"; renderMagistrateScreen(); };
document.getElementById("yamabushiExtensionBtn").onclick = () => { playSfx("select"); facilityHomeScreen = "screen-yamabushi"; renderExtension(); showScreen("screen-extension"); };
// 「出発」: 海の村と同じく、支援物資の購入と行き先選びを1画面(screen-village-prep、renderVillagePrep)に
// まとめてある(ユーザー指示、2026-07-21)。行き先は「修験道へ進む」(奥へ進む)と「光る竹林へ」
// (元来た道を歩いて戻る)の2択。以前は別々のカードだったが、温泉村の出発準備画面と同じ体験にするため統合した
document.getElementById("yamabushiDepartBtn").onclick = () => {
  playSfx("select");
  facilityHomeScreen = "screen-yamabushi";
  renderVillagePrep([
    {
      label: "修験道へ進む",
      onClick: () => {
        // stageEntryStackにさらに1段積んで(山伏の里, 1階層目)を記録し、通常のダンジョン探索画面へ
        // 戻って修験道1層目から再開する。深く潜ってから帰還すれば、山伏の里→光る竹林→渓流→森→町の
        // 順で正しく橋渡しされる
        stageEntryStack.push({ stage: "yamabushi", floor: 1 });
        currentStage = "shugendo";
        currentFloor = 1;
        saveState();
        recordMaxFloorReached();
        dlog("⛰️修験道へ足を踏み入れた。");
        showScreen("screen-dungeon");
        renderDungeon();
      },
    },
    {
      label: "光る竹林へ(歩いて戻る)",
      onClick: () => {
        // 海の村と同じく、直前地点(光る竹林)へstageEntryStackを1つpopして戻すが、オート帰還ではなく
        // 普通の探索と同じ1階層ずつの手動歩行にする(manualRetreatMode、ユーザー指示2026-07-19)
        const prev = stageEntryStack.pop();
        currentStage = prev.stage;
        currentFloor = prev.floor;
        retreating = true;
        manualRetreatMode = true;
        manualRetreatHomeVillage = "yamabushi";
        dlog("🎋光る竹林へ向けて歩き出した。");
        saveState();
        showScreen("screen-dungeon");
        renderDungeon();
      },
    },
  ]);
  showScreen("screen-village-prep");
};

document.getElementById("yamabushionsenBackBtn").onclick = () => { renderYamabushi(); showScreen("screen-yamabushi"); };

document.getElementById("yamabushiyadoBackBtn").onclick = () => { renderYamabushi(); showScreen("screen-yamabushi"); };
// 宿泊・雇用のロジックはtown.jsのperformLodging()/wireInnHireButton()に一本化済み(温泉村の宿屋と
// 完全に同じ確認モーダル→暗転→回復サマリー→翌朝フェードインの流れ)。背景セットだけ霧の宿
// (BG_SETS.yamabushiyado)に差し替えて流用する
document.getElementById("yamabushiyadoStayBtn").onclick = () => {
  performLodging(state.roster.filter((c) => c.status === "active"), BG_SETS.yamabushiyado, renderYamabushiYado);
};
wireInnHireButton(YAMABUSHIYADO_INN_IDS, () => state.roster, defaultYamabushiyadoStatusOnBack);
