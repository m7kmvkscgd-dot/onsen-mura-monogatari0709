// ============ umimura.js: 海の村(第二の町、2026-07-19)。廃城下町の出口の分岐から到達する ============
// 【現状の位置づけ】温泉村の宿屋/温泉ほど作り込まれた画面ではなく、まず「海の村へ実際に
// たどり着いて、宿と温泉が機能する」下地だけを用意した一次実装。日替わり演出や名簿選択式の
// 宿泊などは持たせず、稼働中の仲間全員へ即座に効果を適用するだけの簡易版にしてある。

const UMIYADO_COST_PER_PERSON = LODGE_COST; // 潮風宿の宿代は温泉村の宿屋と同額
const UMIONSEN_COST_PER_PERSON = ONSEN_FLAT_COST; // 湯乃里温泉の湯代は温泉村の温泉(Lv1相当)と同額

function renderUmiMura() {
  document.getElementById("umimuraHeaderGold").textContent = `${state.gold}G`;
  document.getElementById("umimuraHeaderTime").textContent = `${TIME_PHASE_LABEL[state.timeOfDay || "day"]} ${formatClockTime(state.clockMinutes)}`;
  updateSceneBackgrounds();
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
  const activeCount = fieldParty.filter((c) => c.status === "active").length;
  document.getElementById("umionsenCostText").textContent = UMIONSEN_COST_PER_PERSON;
  const cost = UMIONSEN_COST_PER_PERSON * activeCount;
  const btn = document.getElementById("umionsenSoakBtn");
  btn.textContent = activeCount > 0 ? `湯に浸かる(${activeCount}人・${cost}G)` : "入れる仲間がいません";
  btn.disabled = activeCount === 0 || state.gold < cost;
  updateSceneBackgrounds();
}

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

document.getElementById("umimuraYadoBtn").onclick = () => { renderUmiYado(); showScreen("screen-umiyado"); };
document.getElementById("umimuraOnsenBtn").onclick = () => { renderUmiOnsen(); showScreen("screen-umionsen"); };
// 「温泉村へ帰る」: stageEntryStackを1つpopして直前地点(廃城下町)へ戻し、そのまま既存の
// 帰還カスケード(moveOneFloor内のstageEntryStack pop処理)に合流させる。海の村自体は
// 「1階層だけの中継ステージ」として扱っているため、ここでのpopは他のステージと同じ形になる
document.getElementById("umimuraLeaveBtn").onclick = () => {
  showConfirmModal("温泉村へ帰りますか？(廃城下町・洞窟・森を通って歩いて帰ります)", [
    {
      label: "はい", className: "big danger",
      onClick: () => {
        retreating = true;
        const prev = stageEntryStack.pop();
        currentStage = prev.stage;
        currentFloor = prev.floor;
        dlog("引き返すことにした。ここから階層を下って里へ戻る。");
        saveState();
        showScreen("screen-dungeon");
        renderDungeon();
        startAutoRetreat();
      },
    },
    { label: "いいえ", className: "big" },
  ]);
};

document.getElementById("umiyadoBackBtn").onclick = () => { renderUmiMura(); showScreen("screen-umimura"); };
document.getElementById("umiyadoStayBtn").onclick = () => {
  const active = fieldParty.filter((c) => c.status === "active");
  const cost = UMIYADO_COST_PER_PERSON * active.length;
  if (active.length === 0 || state.gold < cost) return;
  state.gold -= cost;
  active.forEach((c) => {
    c.hp = c.maxHp;
    c.mp = c.maxMp;
    c.fatigue = Math.max(0, (c.fatigue || 0) - LODGE_FATIGUE_RELIEF);
  });
  saveState();
  playSfx("select");
  showConfirmModal("一泊し、HP・MPが全回復した。", [{ label: "OK", className: "big" }]);
  renderUmiYado();
};

document.getElementById("umionsenBackBtn").onclick = () => { renderUmiMura(); showScreen("screen-umimura"); };
document.getElementById("umionsenSoakBtn").onclick = () => {
  const active = fieldParty.filter((c) => c.status === "active");
  const cost = UMIONSEN_COST_PER_PERSON * active.length;
  if (active.length === 0 || state.gold < cost) return;
  state.gold -= cost;
  active.forEach((c) => { c.fatigue = Math.max(0, (c.fatigue || 0) - ONSEN_FATIGUE_RELIEF); });
  saveState();
  playSfx("select");
  showConfirmModal("湯に浸かり、疲労が和らいだ。", [{ label: "OK", className: "big" }]);
  renderUmiOnsen();
};
