// ============ umimura.js: 海の村(第二の町、2026-07-19)。廃城下町の出口の分岐から到達する ============
// 中継の村(海の村/山伏の里、今後増える村も含む)は、温泉村と見た目だけ異なる別画面だが、
// 仕様(温泉の翌朝ロック+ランダムバフ+リリーフ演出、宿の一泊演出等)は温泉村と完全に同一にする
// (ユーザー指示、2026-07-21: 簡易版のままにしない)。対象キャラは町にいる名簿全員ではなく、
// 遠征中で物理的にそこにいるfieldPartyのみになる点だけが温泉村との違い

const UMIYADO_COST_PER_PERSON = LODGE_COST; // 潮風宿の宿代は温泉村の宿屋と同額

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

function renderUmiYado() {
  renderDwHeader("umiyado", "潮風宿", () => { renderUmiMura(); showScreen("screen-umimura"); });
  const activeCount = fieldParty.filter((c) => c.status === "active").length;
  document.getElementById("umiyadoCostText").textContent = UMIYADO_COST_PER_PERSON;
  const cost = UMIYADO_COST_PER_PERSON * activeCount;
  const btn = document.getElementById("umiyadoStayBtn");
  btn.textContent = activeCount > 0 ? `一泊する(${activeCount}人・${cost}G)` : "泊まれる仲間がいません";
  btn.disabled = activeCount === 0 || state.gold < cost;
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
// 温泉村の宿屋と同じ「時間帯演出」(現在時刻→夜へクロスフェード→暗転→翌朝フェードイン)を、
// 背景セットだけ潮風宿(BG_SETS.umiyado)に差し替えて流用する(playLodgingTransition/
// revealLodgingMorningは2026-07-19に背景セットを引数化済み)。効果自体もuseLodging()を
// そのまま呼び、温泉村の宿屋と完全に同じ回復量にしてある
document.getElementById("umiyadoStayBtn").onclick = () => {
  const active = fieldParty.filter((c) => c.status === "active");
  const cost = UMIYADO_COST_PER_PERSON * active.length;
  if (active.length === 0 || state.gold < cost) return;
  playLodgingTransition(() => {
    state.gold -= cost;
    active.forEach((c) => useLodging(c));
    advanceToNextMorning();
    saveState();
    revealLodgingMorning(() => {
      renderUmiYado();
      playSfx("select");
      showConfirmModal("一泊し、HP・MPが全回復した。", [{ label: "OK", className: "big" }]);
    });
  }, BG_SETS.umiyado);
};

document.getElementById("umionsenBackBtn").onclick = () => { renderUmiMura(); showScreen("screen-umimura"); };

// ============ 山伏の里(第三の村、2026-07-19)。渓流→光る竹林の先から到達する ============
// 海の村と同じく、温泉/宿等の仕様は温泉村と完全に同一にする(宿は絵が揃ったため2026-07-21追加)。
// 海の村と違い、この先(修験道→山)へさらに進める「修験道へ進む」ボタンを持つ

const YAMABUSHIYADO_COST_PER_PERSON = LODGE_COST; // 霧の宿の宿代は温泉村の宿屋と同額

function renderYamabushi() {
  document.getElementById("yamabushiHeaderGold").textContent = `${state.gold}G`;
  document.getElementById("yamabushiHeaderTime").textContent = `${TIME_PHASE_LABEL[state.timeOfDay || "day"]} ${formatClockTime(state.clockMinutes)}`;
  document.getElementById("yamabushiMagistrateBtn").style.display = state.magistrateLevel ? "" : "none";
  updateSceneBackgrounds();
  checkOnsenReliefPopups(); // 海の村と同じく、この村のホーム画面に戻った時にも入浴リリーフ演出を出す
}

function renderYamabushiYado() {
  renderDwHeader("yamabushiyado", "霧の宿", () => { renderYamabushi(); showScreen("screen-yamabushi"); });
  const activeCount = fieldParty.filter((c) => c.status === "active").length;
  document.getElementById("yamabushiyadoCostText").textContent = YAMABUSHIYADO_COST_PER_PERSON;
  const cost = YAMABUSHIYADO_COST_PER_PERSON * activeCount;
  const btn = document.getElementById("yamabushiyadoStayBtn");
  btn.textContent = activeCount > 0 ? `一泊する(${activeCount}人・${cost}G)` : "泊まれる仲間がいません";
  btn.disabled = activeCount === 0 || state.gold < cost;
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
// 海の村の潮風宿と同じ「時間帯演出」(現在時刻→夜へクロスフェード→暗転→翌朝フェードイン)を、
// 背景セットだけ霧の宿(BG_SETS.yamabushiyado)に差し替えて流用する。効果自体もuseLodging()を
// そのまま呼び、温泉村/海の村の宿と完全に同じ回復量にしてある
document.getElementById("yamabushiyadoStayBtn").onclick = () => {
  const active = fieldParty.filter((c) => c.status === "active");
  const cost = YAMABUSHIYADO_COST_PER_PERSON * active.length;
  if (active.length === 0 || state.gold < cost) return;
  playLodgingTransition(() => {
    state.gold -= cost;
    active.forEach((c) => useLodging(c));
    advanceToNextMorning();
    saveState();
    revealLodgingMorning(() => {
      renderYamabushiYado();
      playSfx("select");
      showConfirmModal("一泊し、HP・MPが全回復した。", [{ label: "OK", className: "big" }]);
    });
  }, BG_SETS.yamabushiyado);
};
