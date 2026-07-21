// ============ camp.js: 野営(キャンプ画面・就寝演出) ============
let campTransitionActive = false;
function playCampTransition(onDone) {
  if (campTransitionActive) return;
  campTransitionActive = true;
  revertAllTransforms(); // 野営を始めたら変化の術は強制解除
  playCampBgm();
  playAmbientBgm("night"); // 野営は演出上常に夜になるため、実際のtimeOfDayに関わらず虫の声も夜側に固定する
  let campTransFinished = false;
  function finishCampTransition() {
    if (campTransFinished) return;
    campTransFinished = true;
    clearTimeout(safetyTimer);
    overlay.style.display = "none";
    campTransitionActive = false;
    onDone();
  }
  const safetyTimer = setTimeout(finishCampTransition, 30000);
  const overlay = document.getElementById("campTransition");
  const fromEl = document.getElementById("campTransitionFrom");
  const toEl = document.getElementById("campTransitionTo");
  const blackEl = document.getElementById("campTransitionBlack");
  const caption = document.getElementById("campTransitionCaption");
  const HOLD_MS = 1500;
  const NIGHT_CROSSFADE_MS = 1500;

  fromEl.style.opacity = "1";
  fromEl.style.backgroundImage = `url('${currentAreaBgSet()[state.timeOfDay] || currentAreaBgSet().night}')`;
  toEl.style.opacity = "0";
  blackEl.style.opacity = "0";
  caption.textContent = "";
  overlay.style.display = "block";
  void overlay.offsetWidth;

  function afterInitialHold() {
    if (state.timeOfDay === "night") {
      afterNightHold();
    } else {
      crossfadeBg(fromEl, toEl, currentAreaBgSet().night, NIGHT_CROSSFADE_MS, () => setTimeout(afterNightHold, HOLD_MS));
    }
  }
  function afterNightHold() {
    // 夜の森/海岸→暗転→野営地
    fadeOpacity(blackEl, 0, 1, 2000, () => {
      fromEl.style.backgroundImage = `url('${currentCampBgUrl()}')`;
      setTimeout(() => {
        fadeOpacity(blackEl, 1, 0, 1500, finishCampTransition);
      }, 300);
    });
  }

  setTimeout(afterInitialHold, HOLD_MS);
}

// 就寝時の演出: ゆっくり暗転(2.5秒)。暗転しきったところでonBlackを呼び、回復サマリー画面の表示を
// 呼び出し元(finishCamping)に任せる。翌朝への切り替え(森の朝背景+フェードイン)はrevealCampMorning側で行う
let campSleepTransitionActive = false;
function playCampSleepTransition(onBlack) {
  if (campSleepTransitionActive) return;
  campSleepTransitionActive = true;
  let blackDone = false;
  function reachBlack() {
    if (blackDone) return;
    blackDone = true;
    clearTimeout(safetyTimer);
    fromEl.style.backgroundImage = `url('${currentAreaBgSet().dawn}')`;
    // 宿泊演出と同様、キャプションを表示して完全に消えてから回復画面(onBlack)を呼ぶ
    // (2026-07-21にユーザー指示で表示時間を3900ms→2500ms→2700msへ調整)
    caption.textContent = pickCampNightMessage();
    caption.style.animation = "lodgingCaptionFade 2700ms ease forwards";
    setTimeout(onBlack, 2700);
  }
  const safetyTimer = setTimeout(reachBlack, 30000);
  const overlay = document.getElementById("campTransition");
  const fromEl = document.getElementById("campTransitionFrom");
  const toEl = document.getElementById("campTransitionTo");
  const blackEl = document.getElementById("campTransitionBlack");
  const caption = document.getElementById("campTransitionCaption");

  fromEl.style.opacity = "1";
  fromEl.style.backgroundImage = `url('${currentCampBgUrl()}')`;
  toEl.style.opacity = "0";
  blackEl.style.opacity = "0";
  caption.textContent = "";
  overlay.style.display = "block";
  void overlay.offsetWidth;

  fadeOpacity(blackEl, 0, 1, 2500, reachBlack);
}
// 回復サマリーの「次へ」が押された後に呼ぶ: 暗転から森の朝背景へフェードインして演出を終える
function revealCampMorning(onDone) {
  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(safetyTimer);
    overlay.style.display = "none";
    overlay.style.opacity = "1"; // 次回の野営演出のためにリセットしておく
    campSleepTransitionActive = false;
  }
  // 宿泊と同様、黒(blackEl)が明けた直後はまだオーバーレイ自体が画面を覆っているので、その裏で
  // 実画面(onDone)を先に最新状態へ描画してからオーバーレイ全体をフェードアウトする(display:none
  // による瞬時切り替えだと画面が「ドン」と唐突に切り替わって見えるため。ユーザー報告2026-07-21)
  let revealed = false;
  function revealRealScreen() {
    if (revealed) return;
    revealed = true;
    onDone();
    fadeOpacity(overlay, 1, 0, 600, finish);
  }
  const safetyTimer = setTimeout(() => { revealRealScreen(); finish(); }, 30000);
  const overlay = document.getElementById("campTransition");
  const blackEl = document.getElementById("campTransitionBlack");
  setTimeout(() => {
    fadeOpacity(blackEl, 1, 0, 1500, revealRealScreen);
  }, 300);
}
// 回復サマリー画面の共通実装(野営/宿泊どちらも使う)。暗転中に対象キャラごとの
// HP/MPの回復バー(hpBarHtml/mpBarHtmlの回復トレイル)とストレス減少量を表示し、
// 「次へ」ボタンが押されたらonNextを呼ぶ
function showCampRestSummary(beforeSnapshot, onNext) {
  showRestSummary("campRestSummary", "campRestSummaryList", "campRestNextBtn", beforeSnapshot, onNext);
}
// ============ 野営 ============
// 野営具を使うと開始する休息イベント。仲間が1人ずつ「回復薬を調合/慰める/武器の手入れ」から1つ選び、
// 全員が選び終えると就寝できる。就寝すると翌朝(5:30)になり、HP/MP/ストレスが回復する
function clog(msg) {
  const el = document.getElementById("campLog");
  const p = document.createElement("p");
  p.textContent = msg;
  el.appendChild(p);
  el.scrollTop = el.scrollHeight;
}
let campActionQueue = [];
let campPendingComfortActor = null;
// 野営具を使って野営を開始する(道具ボタンのメニューから呼ばれる)
function startCampFromTools() {
  if ((state.inventory.campingKit || 0) <= 0) return;
  state.inventory.campingKit--;
  saveState();
  playCampTransition(() => {
    startCampPhase();
  });
}
function startCampPhase() {
  showScreen("screen-camp");
  document.getElementById("campBg").style.backgroundImage = `url('${currentCampBgUrl()}')`;
  document.getElementById("campLog").innerHTML = "";
  campActionQueue = fieldParty.filter((c) => c.status === "active");
  campPendingComfortActor = null;
  clog("野営の準備を整えた。焚き火を囲みながら、夜の行動を選ぼう。");
  renderCampScreen();
}
function renderCampScreen() {
  renderPartyBar("campPartyBar", visibleFieldParty());
  const actions = document.getElementById("campActions");
  actions.innerHTML = "";

  if (campPendingComfortActor) {
    const actor = campPendingComfortActor;
    const targets = fieldParty.filter((c) => c.status === "active" && c.id !== actor.id);
    const p = document.createElement("p");
    p.style.cssText = "width:100%;margin:0;font-size:0.82rem;";
    p.innerHTML = `<strong>${actor.name}が誰を慰めますか？</strong>`;
    actions.appendChild(p);
    targets.forEach((t) => {
      const btn = document.createElement("button");
      btn.className = "big";
      btn.textContent = `${t.name}(ストレス${t.fatigue || 0})`;
      btn.onclick = () => {
        t.fatigue = Math.max(0, (t.fatigue || 0) - CAMP_COMFORT_STRESS_RELIEF);
        clog(`${actor.name}は${t.name}を慰めた。`);
        playSfx("heal");
        campPendingComfortActor = null;
        campActionQueue.shift();
        saveState();
        renderCampScreen();
      };
      actions.appendChild(btn);
    });
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "big";
    cancelBtn.textContent = "やめる";
    cancelBtn.onclick = () => { campPendingComfortActor = null; renderCampScreen(); };
    actions.appendChild(cancelBtn);
    positionActionsBelowPartyBar("campPartyBar", ".camp-actions");
    return;
  }

  if (campActionQueue.length === 0) {
    const sleepBtn = document.createElement("button");
    sleepBtn.className = "big primary";
    sleepBtn.textContent = "就寝";
    sleepBtn.onclick = () => finishCamping();
    actions.appendChild(sleepBtn);
    positionActionsBelowPartyBar("campPartyBar", ".camp-actions");
    return;
  }

  const actor = campActionQueue[0];
  const p = document.createElement("p");
  p.style.cssText = "width:100%;margin:0;font-size:0.82rem;";
  p.innerHTML = `<strong>${actor.name}の夜の行動を選択してください</strong>`;
  actions.appendChild(p);

  const brewBtn = document.createElement("button");
  brewBtn.className = "big";
  brewBtn.textContent = "回復薬を調合";
  brewBtn.onclick = () => {
    state.inventory.potion = Math.min(supplyCap(), (state.inventory.potion || 0) + 1);
    clog(`${actor.name}は回復薬を調合した。`);
    playSfx("coin");
    showTreasurePopup(0, "assets/items/potion.png"); // ゴールド拾得時と同じ中央ポップアップ演出を流用(amount:0でゴールド絵は隠し、回復薬アイコンだけ出す)
    campActionQueue.shift();
    saveState();
    renderCampScreen();
  };
  actions.appendChild(brewBtn);

  // 慰める対象は自分以外なので、他に稼働中の仲間がいない(単独行動中)時はボタン自体を出さない
  if (fieldParty.some((c) => c.status === "active" && c.id !== actor.id)) {
    const comfortBtn = document.createElement("button");
    comfortBtn.className = "big";
    comfortBtn.textContent = "慰める";
    comfortBtn.onclick = () => { campPendingComfortActor = actor; renderCampScreen(); };
    actions.appendChild(comfortBtn);
  }

  const careBtn = document.createElement("button");
  careBtn.className = "big";
  careBtn.textContent = "武器の手入れ";
  careBtn.onclick = () => {
    actor.campWeaponCareBattles = CAMP_WEAPON_CARE_BATTLES;
    clog(`${actor.name}は武器の手入れをした。(攻撃力+10%、${CAMP_WEAPON_CARE_BATTLES}戦闘の間)`);
    playSfx("guard");
    campActionQueue.shift();
    saveState();
    renderCampScreen();
  };
  actions.appendChild(careBtn);

  positionActionsBelowPartyBar("campPartyBar", ".camp-actions");
}
function finishCamping() {
  stopCampBgm();
  playCampSleepTransition(() => {
    const beforeSnapshot = fieldParty.filter((c) => c.status === "active").map((c) => {
      // hpBarHtml/mpBarHtmlの回復トレイルは「前回表示した残量」との比較で発火するため、この
      // キャラの残量バーが今まで一度も描画されたことがなくても(特にMPは通常の味方表示では
      // 未使用の関数なので)確実に回復アニメーションが出るよう、回復前の値を明示的に記録しておく
      c.__hpDisplayRatio = c.maxHp > 0 ? Math.max(0, c.hp / c.maxHp) * 100 : 0;
      c.__mpDisplayRatio = c.maxMp > 0 ? Math.max(0, c.mp / c.maxMp) * 100 : 0;
      return { id: c.id, fatigueBefore: c.fatigue || 0 };
    });
    fieldParty.forEach((c) => { if (c.status === "active") { useCampRest(c); clearOnsenBuff(c); } });
    // 平和な掛け合いは通常「戦闘勝利後に1回まで」だが、野営を挟んだ場合はユーザー指示により
    // 例外的にロックを解除し、次の勝利を待たずとも条件(HP/ストレス等)を満たせば再度発生できるようにする。
    // 疲弊時の掛け合い(tired)も同じ扱いにする
    peaceDialogueLocked = false;
    tiredDialogueLocked = false;
    saveState();
    showCampRestSummary(beforeSnapshot, () => {
      revealCampMorning(() => {
        advanceToNextMorning();
        state.clockMinutes = 5 * 60 + 30; // 翌朝5:30
        saveState();
        showScreen("screen-dungeon");
        renderDungeon();
        dlog("野営を終え、5:30に目を覚ました。");
      });
    });
  });
}

