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
// 奉行所/建築/鍛冶屋は温泉村と全村共通の経済(BUILDING_DEFS/state.magistrateLevel等がグローバル)を
// 見た目だけ村を変えて開く(town.jsのfacilityHomeScreenで戻り先を覚える仕組み、2026-07-20)
document.getElementById("umimuraMagistrateBtn").onclick = () => { playSfx("select"); facilityHomeScreen = "screen-umimura"; renderMagistrateScreen(); };
document.getElementById("umimuraExtensionBtn").onclick = () => { playSfx("select"); facilityHomeScreen = "screen-umimura"; renderExtension(); showScreen("screen-extension"); };
document.getElementById("umimuraShopBtn").onclick = () => { playSfx("select"); facilityHomeScreen = "screen-umimura"; renderShop(); showScreen("screen-shop"); };
// 支度(支援物資購入): 温泉村の出発準備画面と同仕様の共通画面(renderVillagePrep、ui.js)を、戻り先を
// 海の村として開く(ユーザー指示、2026-07-21: 中継の村でも回復薬等を買えるようにする)
document.getElementById("umimuraPrepBtn").onclick = () => { playSfx("select"); facilityHomeScreen = "screen-umimura"; renderVillagePrep(); showScreen("screen-village-prep"); };
// 「出発する」: 廃城下町(元来た道を歩いて戻る)と海岸(既存の海岸ステージを15層に縮めて流用、
// 新規ルート)の2択(ユーザー指示、2026-07-19)。
// 「廃城下町へ」はオート帰還ではなく、普通の探索と同じ1階層ずつの手動歩行にする
// (manualRetreatMode、advanceBtn.onclick/renderDungeon側で挙動を分岐)。海の村自体は
// 「1階層だけの中継ステージ」として扱っているため、stageEntryStackのpopは他のステージと同じ形になる
document.getElementById("umimuraLeaveBtn").onclick = () => {
  showConfirmModal("どちらへ出発しますか？", [
    {
      label: "廃城下町へ(歩いて戻る)", className: "big primary",
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
      label: "海岸へ(新ルート)", className: "big primary",
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
    { label: "やめる", className: "big" },
  ]);
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
// 海の村と同じく、温泉/宿等の仕様は温泉村と完全に同一にする(宿はまだ絵が無いため未実装、温泉のみ)。
// 海の村と違い、この先(修験道→山)へさらに進める「修験道へ進む」ボタンを持つ

function renderYamabushi() {
  document.getElementById("yamabushiHeaderGold").textContent = `${state.gold}G`;
  document.getElementById("yamabushiHeaderTime").textContent = `${TIME_PHASE_LABEL[state.timeOfDay || "day"]} ${formatClockTime(state.clockMinutes)}`;
  document.getElementById("yamabushiMagistrateBtn").style.display = state.magistrateLevel ? "" : "none";
  updateSceneBackgrounds();
  checkOnsenReliefPopups(); // 海の村と同じく、この村のホーム画面に戻った時にも入浴リリーフ演出を出す
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

document.getElementById("yamabushiOnsenBtn").onclick = () => { playSfx("onsen_enter"); renderYamabushiOnsen(); showScreen("screen-yamabushionsen"); };
// 奉行所/建築/鍛冶屋は温泉村と全村共通の経済を見た目だけ村を変えて開く(umimura.js側と同じ仕組み、2026-07-20)
document.getElementById("yamabushiMagistrateBtn").onclick = () => { playSfx("select"); facilityHomeScreen = "screen-yamabushi"; renderMagistrateScreen(); };
document.getElementById("yamabushiExtensionBtn").onclick = () => { playSfx("select"); facilityHomeScreen = "screen-yamabushi"; renderExtension(); showScreen("screen-extension"); };
document.getElementById("yamabushiShopBtn").onclick = () => { playSfx("select"); facilityHomeScreen = "screen-yamabushi"; renderShop(); showScreen("screen-shop"); };
document.getElementById("yamabushiPrepBtn").onclick = () => { playSfx("select"); facilityHomeScreen = "screen-yamabushi"; renderVillagePrep(); showScreen("screen-village-prep"); };
// 「修験道へ進む」: 海の村には無い、山伏の里だけの選択肢。stageEntryStackにさらに1段積んで
// (山伏の里, 1階層目)を記録し、通常のダンジョン探索画面へ戻って修験道1層目から再開する。
// 深く潜ってから帰還すれば、山伏の里→光る竹林→渓流→森→町の順で正しく橋渡しされる
document.getElementById("yamabushiContinueBtn").onclick = () => {
  stageEntryStack.push({ stage: "yamabushi", floor: 1 });
  currentStage = "shugendo";
  currentFloor = 1;
  saveState();
  recordMaxFloorReached();
  dlog("⛰️修験道へ足を踏み入れた。");
  showScreen("screen-dungeon");
  renderDungeon();
};
// 「光る竹林へ」: 海の村と同じく、直前地点(光る竹林)へstageEntryStackを1つpopして戻すが、
// オート帰還ではなく普通の探索と同じ1階層ずつの手動歩行にする(manualRetreatMode、
// ユーザー指示2026-07-19)
document.getElementById("yamabushiLeaveBtn").onclick = () => {
  showConfirmModal("光る竹林へ向かいますか？(そこから渓流・森を通って歩いて進みます)", [
    {
      label: "はい", className: "big danger",
      onClick: () => {
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
    { label: "いいえ", className: "big" },
  ]);
};

document.getElementById("yamabushionsenBackBtn").onclick = () => { renderYamabushi(); showScreen("screen-yamabushi"); };
