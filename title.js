// ============ title.js: オープニング動画・タイトル画面(起動時の入口)・設定・製作者より ============
// ゲームは常にオープニング動画→タイトル画面の順で始まる。「旅を始める」でセーブが無ければそのまま
// 最初の1人選びへ、既にセーブがある場合は上書き確認を挟んでから最初の1人選びへ(新しい冒険を開始)。
// 「続きから」は既存セーブがある時だけ有効になり、これまでの町に直接戻る。

function titleHasSave() {
  return state.roster.length > 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============ タイトル演出のシーケンス制御 ============
// 以前はCSSの@keyframes+classList付け外し(クラスを外してreflowを挟んで付け直す方式)で
// 演出をリプレイしていたが、このプロジェクトでは同じ手法がHPバーの被弾トレイル・ログ行の登場演出・
// 宿泊のクロスフェードで繰り返し信頼性の問題を起こしており、タイトル画面の背景が消えたまま
// 戻らなくなる不具合もこれと同じ系統(animationがforwards指定で"表示"を担っている状態で、
// クラスを外すと即座に非animation時の既定値=opacity:0に戻ってしまい、reflow後の再付与が
// 何らかのタイミング/環境で再生に失敗すると、opacity:0のまま二度と復帰しなくなる)と判断し、
// element.animate()による明示的なJS制御に全面的に置き換えた。CSS側は「常時表示された状態」を
// 既定値とし、非表示状態は演出の開始直前にJSがinline styleとして都度書き込む方式にしたため、
// 万一JSが例外で止まっても要素が消えたままになることはない(せいぜい演出が省略されるだけ)。
let titleSeqToken = 0;
let titleSeqAnimations = [];
let titleTapCleanup = null;

function cancelTitleSequence() {
  titleSeqAnimations.forEach((a) => { try { a.cancel(); } catch (e) {} });
  titleSeqAnimations = [];
  if (titleTapCleanup) { titleTapCleanup(); titleTapCleanup = null; }
}

// element.animate()の.finishedはタブが背面に回った直後など極めて稀な状況で解決が遅れる/されない
// ことがある(Web Animations API全般の既知の弱点)。この演出は複数のアニメーションを直列に
// await連結しているため、1箇所でも解決しないとそこから先(ボタン表示まで)が永久に止まってしまう
// ―― まさに今回JSで置き換えた旧CSS方式のバグ(背景が消えたまま戻らない)と同じ「詰み」のリスクが
// 形を変えて残ることになる。これを避けるため、指定時間+200msのタイムアウトと.finishedを
// Promise.raceさせ、アニメーションAPI側が万一応答しなくても必ず先へ進めるようにしてある
function titleAnimate(el, keyframes, opts) {
  const a = el.animate(keyframes, opts);
  titleSeqAnimations.push(a);
  const duration = typeof opts.duration === "number" ? opts.duration : 300;
  return Promise.race([a.finished.catch(() => {}), sleep(duration + 200)]);
}

function waitForTap() {
  return new Promise((resolve) => {
    const handler = () => { cleanup(); resolve(); };
    const cleanup = () => {
      document.removeEventListener("pointerdown", handler);
      titleTapCleanup = null;
    };
    titleTapCleanup = cleanup;
    document.addEventListener("pointerdown", handler, { once: true });
  });
}

function titleSeqElements() {
  return {
    bgBase: document.getElementById("titleBgBase"),
    logo: document.getElementById("titleLogoReveal"),
    tapPrompt: document.getElementById("titleTapPrompt"),
    menu: document.getElementById("titleMenu"),
    buttons: Array.from(document.querySelectorAll("#titleMenu .title-menu-btn")),
    footer: document.querySelector("#screen-title .title-footer"),
  };
}

// JSシーケンス開始前の非表示状態にする(CSSの既定値は常時表示なので、ここで都度隠す)
function resetTitleVisualState() {
  const els = titleSeqElements();
  els.bgBase.style.opacity = "0";
  els.logo.style.opacity = "0";
  els.logo.style.transform = "scale(0.98)";
  els.tapPrompt.style.opacity = "0";
  els.tapPrompt.style.display = "none";
  els.buttons.forEach((b) => { b.style.opacity = "0"; b.style.transform = "translateY(16px)"; });
  els.footer.style.opacity = "0";
  els.menu.style.pointerEvents = "none";
}

// 演出を待たず、いきなり完成形で表示する(設定画面等からタイトルへ戻ってきた時用)
function showTitleVisualStateInstantly() {
  const els = titleSeqElements();
  els.bgBase.style.opacity = "1";
  els.logo.style.opacity = "1";
  els.logo.style.transform = "scale(1)";
  els.tapPrompt.style.opacity = "0";
  els.tapPrompt.style.display = "none";
  els.buttons.forEach((b) => { b.style.opacity = "1"; b.style.transform = "translateY(0)"; });
  els.footer.style.opacity = "1";
  els.menu.style.pointerEvents = "";
}

// full=trueの時だけ「背景表示→1.5秒→ロゴ→0.5秒→タップ待ち→ボタン0.08秒差でスライドイン」の
// 一連の演出を再生する。トークンで世代管理しており、演出の途中でrenderTitleScreen()が
// 再度呼ばれた場合(例:演出中に設定へ移動して戻ってきた等)は古い世代のawaitが目を覚ましても
// 何もせず即座に抜ける
async function runTitleSequence(full) {
  const myToken = ++titleSeqToken;
  cancelTitleSequence();
  const els = titleSeqElements();

  if (!full) {
    showTitleVisualStateInstantly();
    return;
  }

  resetTitleVisualState();

  await titleAnimate(els.bgBase, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: "ease-out", fill: "forwards" });
  if (myToken !== titleSeqToken) return;
  await sleep(1500);
  if (myToken !== titleSeqToken) return;

  await titleAnimate(els.logo, [{ opacity: 0, transform: "scale(0.98)" }, { opacity: 1, transform: "scale(1)" }], { duration: 500, easing: "ease-out", fill: "forwards" });
  if (myToken !== titleSeqToken) return;
  await sleep(500);
  if (myToken !== titleSeqToken) return;

  els.tapPrompt.style.display = "block";
  await titleAnimate(els.tapPrompt, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: "ease-out", fill: "forwards" });
  if (myToken !== titleSeqToken) return;

  await waitForTap();
  if (myToken !== titleSeqToken) return;

  await titleAnimate(els.tapPrompt, [{ opacity: 1 }, { opacity: 0 }], { duration: 250, easing: "ease-out", fill: "forwards" });
  els.tapPrompt.style.display = "none";
  if (myToken !== titleSeqToken) return;

  els.menu.style.pointerEvents = "";
  els.buttons.forEach((b, i) => {
    setTimeout(() => {
      if (myToken !== titleSeqToken) return;
      titleAnimate(b, [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 300, easing: "ease-out", fill: "forwards" });
    }, i * 80);
  });
  await sleep(Math.max(0, els.buttons.length - 1) * 80 + 300);
  if (myToken !== titleSeqToken) return;
  titleAnimate(els.footer, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out", fill: "forwards" });
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

// opts.full=trueの時だけ、上記の順次演出をフルで再生する(オープニング動画の直後の初回表示のみ)。
// それ以外(設定/製作者よりから戻る等)は即座に完成形を表示する
function renderTitleScreen(opts) {
  const full = !!(opts && opts.full);
  renderTitlePetals();
  const hasSave = titleHasSave();
  const continueBtn = document.getElementById("titleContinueBtn");
  continueBtn.disabled = !hasSave;
  // 「続きから」があれば既存の冒険の続きを推す、無ければ「旅を始める」を推す、という1つだけの主動線に
  // ソフトな金の光(常時点滅ではなくゆっくりしたフェード)を付ける
  document.getElementById("titleStartBtn").classList.toggle("primary", !hasSave);
  continueBtn.classList.toggle("primary", hasSave);
  return runTitleSequence(full);
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

// ============ 製作者より ============
// 画面遷移はせず、タイトル画面の上に暗いオーバーレイ+木製パネルを重ねるだけ(spec通り)
document.getElementById("titleStaffBtn").onclick = () => {
  playSfx("select");
  document.getElementById("titleCreditsOverlay").style.display = "flex";
};
document.getElementById("titleCreditsCloseBtn").onclick = () => {
  document.getElementById("titleCreditsOverlay").style.display = "none";
};

// ============ オープニング動画 ============
// 初回起動時のみ最後まで再生(タップでスキップ不可)。2回目以降はタップでスキップ可能。
// 動画ファイルが存在しない/読み込めない場合は初回扱いにせず、即座にタイトルへ遷移する。
// 後からassets/opening/opening.mp4を配置するだけで動作する(このファイルの変更は不要)
const OPENING_SEEN_KEY = "onsen_opening_seen_v1";

function initOpeningSequence() {
  const overlay = document.getElementById("openingOverlay");
  const video = document.getElementById("openingVideo");
  const skipHint = document.getElementById("openingSkipHint");
  const hasSeenBefore = localStorage.getItem(OPENING_SEEN_KEY) === "1";
  let resolved = false;

  const onSkipTap = () => { if (hasSeenBefore) finish(true, false); };
  const cleanupSkipListener = () => { overlay.removeEventListener("pointerdown", onSkipTap); };

  function finish(markSeen, immediate) {
    if (resolved) return;
    resolved = true;
    cleanupSkipListener();
    if (markSeen) localStorage.setItem(OPENING_SEEN_KEY, "1");
    if (immediate) {
      overlay.style.display = "none";
      renderTitleScreen({ full: true });
      return;
    }
    const anim = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: "ease-out" });
    anim.onfinish = () => {
      overlay.style.display = "none";
      overlay.style.opacity = "";
      renderTitleScreen({ full: true });
    };
  }

  video.onerror = () => finish(false, true);
  video.onended = () => finish(true, false);

  if (hasSeenBefore) {
    skipHint.style.display = "block";
    overlay.addEventListener("pointerdown", onSkipTap);
  }

  overlay.style.display = "flex";
  overlay.style.opacity = "1";

  // 音声付き再生を試み、自動再生制限で拒否された場合はミュートで再試行する(動画自体は見せる)
  const playPromise = video.play();
  if (playPromise && playPromise.catch) {
    playPromise.catch(() => {
      video.muted = true;
      video.play().catch(() => finish(false, true));
    });
  }
}

// ============ 初期化 ============
// タイトル画面はオープニング動画の背後で先に非表示状態にしておく(動画フェード中に完成形が
// 透けて見えないように)。実際の表示はinitOpeningSequence()の完了後、renderTitleScreen({full:true})で行う
resetTitleVisualState();
initOpeningSequence();
