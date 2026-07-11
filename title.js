// ============ title.js: タイトル画面(起動時の入口)・設定・スタッフ ============
// ゲームは常にこのタイトル画面から始まる。「旅を始める」でセーブが無ければそのまま最初の1人選びへ、
// 既にセーブがある場合は上書き確認を挟んでから最初の1人選びへ(新しい冒険を開始)。
// 「続きから」は既存セーブがある時だけ有効になり、これまでの町に直接戻る。

function titleHasSave() {
  return state.roster.length > 0;
}

// 起動のたびに再生する「背景→タイトル→ボタン」の0.3秒刻みの順次フェードイン演出。
// 各要素をクラス付け外しで毎回リプレイする(retriggerEntryAnimと同じ考え方)
function playTitleBootSequence() {
  const bg = document.getElementById("titleBg");
  const menu = document.getElementById("titleMenu");
  const footer = document.querySelector("#screen-title .title-footer");
  [bg, menu, footer].forEach((el) => { if (el) el.classList.remove("title-seq-in"); });
  void document.getElementById("screen-title").offsetWidth; // reflow
  if (bg) bg.classList.add("title-seq-in");
  if (menu) menu.classList.add("title-seq-in");
  if (footer) footer.classList.add("title-seq-in");
}

function renderTitlePetals() {
  const layer = document.getElementById("titleFxLayer");
  if (layer.childElementCount > 0) return; // 一度作れば使い回す(再描画のたびに増殖させない)
  const PETAL_COUNT = 9;
  for (let i = 0; i < PETAL_COUNT; i++) {
    const p = document.createElement("div");
    p.className = "title-petal";
    p.style.left = `${Math.random() * 100}%`;
    p.style.animationDelay = `${(Math.random() * 14).toFixed(2)}s`;
    p.style.animationDuration = `${(11 + Math.random() * 7).toFixed(2)}s`;
    p.style.opacity = (0.35 + Math.random() * 0.35).toFixed(2);
    const size = 7 + Math.random() * 5;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    layer.appendChild(p);
  }
  for (let i = 0; i < 3; i++) {
    const s = document.createElement("div");
    s.className = "title-steam";
    s.style.left = `${10 + i * 35 + Math.random() * 10}%`;
    s.style.animationDelay = `${(Math.random() * 8).toFixed(2)}s`;
    layer.appendChild(s);
  }
}

function renderTitleScreen() {
  renderTitlePetals();
  const hasSave = titleHasSave();
  const continueBtn = document.getElementById("titleContinueBtn");
  continueBtn.disabled = !hasSave;
  // 「続きから」があれば既存の冒険の続きを推す、無ければ「旅を始める」を推す、という1つだけの主動線に
  // ソフトな金の光(常時点滅ではなくゆっくりしたフェード)を付ける
  document.getElementById("titleStartBtn").classList.toggle("primary", !hasSave);
  continueBtn.classList.toggle("primary", hasSave);
  playTitleBootSequence();
}

function goToFirstCharacterCreation() {
  showScreen("screen-first-character");
  renderFirstCharacterScreen();
}

document.getElementById("titleStartBtn").onclick = () => {
  playSfx("select");
  if (titleHasSave()) {
    showConfirmModal("現在の冒険データを消去して、最初から始めますか？\nこの操作は取り消せません。", [
      { label: "はい", className: "big danger", onClick: () => {
        state = defaultState();
        saveState();
        goToFirstCharacterCreation();
      } },
      { label: "いいえ", className: "big" },
    ]);
  } else {
    goToFirstCharacterCreation();
  }
};

document.getElementById("titleContinueBtn").onclick = () => {
  if (!titleHasSave()) return;
  playSfx("select");
  renderTown();
};

document.getElementById("titleSettingsBtn").onclick = () => {
  playSfx("select");
  showScreen("screen-settings");
  renderSettingsScreen();
};

document.getElementById("titleStaffBtn").onclick = () => {
  playSfx("select");
  showScreen("screen-staff");
};

// ============ 設定画面 ============
// 既存のミュート機能(#muteBtn/audio.js)とチュートリアル表示フラグ(state.tutorialEnabled)を
// そのままON/OFFトグルとして見せるだけの、新しい仕組みを持たない最小限の設定画面
function renderSettingsScreen() {
  const soundBtn = document.getElementById("settingsSoundToggle");
  soundBtn.textContent = muted ? "OFF" : "ON";
  soundBtn.classList.toggle("is-on", !muted);
  const tutoBtn = document.getElementById("settingsTutorialToggle");
  const tutoOn = state.tutorialEnabled !== false;
  tutoBtn.textContent = tutoOn ? "ON" : "OFF";
  tutoBtn.classList.toggle("is-on", tutoOn);
}
document.getElementById("settingsSoundToggle").onclick = () => {
  document.getElementById("muteBtn").click();
  renderSettingsScreen();
};
document.getElementById("settingsTutorialToggle").onclick = () => {
  state.tutorialEnabled = state.tutorialEnabled === false ? true : false;
  saveState();
  playSfx("select");
  renderSettingsScreen();
};
document.getElementById("settingsBackBtn").onclick = () => {
  showScreen("screen-title");
  renderTitleScreen();
};
document.getElementById("staffBackBtn").onclick = () => {
  showScreen("screen-title");
  renderTitleScreen();
};

// ============ 初期化 ============
// ゲームの入口は常にこのタイトル画面(index.htmlでも#screen-titleがactiveな状態で描画される)
renderTitleScreen();
