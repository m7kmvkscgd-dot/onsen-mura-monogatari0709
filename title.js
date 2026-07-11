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

// ============ タイトル画面プリロード ============
// 起動直後に必要な画像だけを優先度順(①背景 ②ロゴ)でプリロードする。ゲーム開始後にしか
// 使わない画像(職業アイコン・施設アイコン等)はここに含めない。index.html側の
// <link rel="preload">はブラウザへの早期ヒントで、こちらはJS側で「確実に読み込み終わった」ことを
// 検知してからフェードインを始めるための保険(低速回線でpreloadヒントが間に合わなかった場合でも、
// 「まだ来ていない画像がいきなりポップインする」のではなく読み込み完了を待ってから表示できる)
const TITLE_CRITICAL_IMAGES = ["assets/title/title_bg_base.webp", "assets/title/title_bg.webp"];
function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}
// 万一画像サーバーが極端に遅い場合でも起動が止まらないよう、1.5秒で見切りを付けて先へ進む
function preloadTitleImages() {
  return Promise.race([
    Promise.all(TITLE_CRITICAL_IMAGES.map(preloadImage)),
    sleep(1500),
  ]);
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

function cancelTitleSequence() {
  titleSeqAnimations.forEach((a) => { try { a.cancel(); } catch (e) {} });
  titleSeqAnimations = [];
}

// element.animate()の.finishedはタブが背面に回った直後など極めて稀な状況で解決が遅れる/されない
// ことがある(Web Animations API全般の既知の弱点)。この演出は複数のアニメーションを直列に
// await連結しているため、1箇所でも解決しないとそこから先(ボタン表示まで)が永久に止まってしまう
// ―― まさに今回JSで置き換えた旧CSS方式のバグ(背景が消えたまま戻らない)と同じ「詰み」のリスクが
// 形を変えて残ることになる。これを避けるため、指定時間+200msのタイムアウトと.finishedを
// Promise.raceさせ、アニメーションAPI側が万一応答しなくても必ず先へ進めるようにしてある
// finalStyleは完了後にelへ書き込む素のinline style(例: {opacity:"1", transform:""})。
// fill:"forwards"のアニメーションはWeb Animations APIの効果として残り続け、通常のCSS(:active等)
// より優先されてしまう(ボタンの登場演出のtransformが残ったままだと、後で押した時の
// :active { transform: scale(0.97) } が一切効かなくなる)。完了後にアニメーションをcancel()した上で
// finalStyleを自分で書き込むことで、以降は普通のCSSカスケード(:active含む)が効くようにしている
// (transformは""で明示的にクリアし、次にelement.animate()もCSSの:activeも触っていない
// transform: none相当の状態に戻す。opacityだけは最終値をそのままinlineに残す)
function titleAnimate(el, keyframes, opts, finalStyle) {
  const a = el.animate(keyframes, opts);
  titleSeqAnimations.push(a);
  const duration = typeof opts.duration === "number" ? opts.duration : 300;
  return Promise.race([a.finished.catch(() => {}), sleep(duration + 200)]).then(() => {
    try { a.cancel(); } catch (e) {}
    if (finalStyle) Object.assign(el.style, finalStyle);
  });
}

function titleSeqElements() {
  return {
    bgBase: document.getElementById("titleBgBase"),
    logo: document.getElementById("titleLogoReveal"),
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
  els.buttons.forEach((b) => { b.style.opacity = "1"; b.style.transform = ""; });
  els.footer.style.opacity = "1";
  els.menu.style.pointerEvents = "";
}

// full=trueの時だけ「背景表示→0.5秒→ロゴフェードイン→0.3秒→ボタン0.08秒差でスライドイン」の
// 一連の演出を再生する。トークンで世代管理しており、演出の途中でrenderTitleScreen()が
// 再度呼ばれた場合(例:演出中に設定へ移動して戻ってきた等)は古い世代のawaitが目を覚ましても
// 何もせず即座に抜ける。以前あった「画面をタップ」待ちは、演出全体を一つの自然な流れにする
// という指示により廃止し、プリロード完了後は無条件で自動的に最後まで進む
async function runTitleSequence(full) {
  const myToken = ++titleSeqToken;
  cancelTitleSequence();
  const els = titleSeqElements();

  if (!full) {
    showTitleVisualStateInstantly();
    return;
  }

  resetTitleVisualState();
  await preloadTitleImages();
  if (myToken !== titleSeqToken) return;

  // 背景→0.5秒→ロゴ、という短い間だけを置く(以前の1.5秒待ちが「読み込みが遅い」という
  // 印象を与えていたため大幅に短縮。プリロード済みのため背景は表示した瞬間に完全な状態で出る)
  await titleAnimate(els.bgBase, [{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: "ease-out", fill: "forwards" }, { opacity: "1" });
  if (myToken !== titleSeqToken) return;
  await sleep(500);
  if (myToken !== titleSeqToken) return;

  await titleAnimate(els.logo, [{ opacity: 0, transform: "scale(0.98)" }, { opacity: 1, transform: "scale(1)" }], { duration: 400, easing: "ease-out", fill: "forwards" }, { opacity: "1", transform: "scale(1)" });
  if (myToken !== titleSeqToken) return;
  await sleep(300);
  if (myToken !== titleSeqToken) return;

  els.menu.style.pointerEvents = "";
  els.buttons.forEach((b, i) => {
    setTimeout(() => {
      if (myToken !== titleSeqToken) return;
      // transformは完了後に""でクリアする(ボタンのentrance演出が:active { transform: scale(0.97) }を
      // 塞いでしまわないように。空文字はtranslateY(0)と見た目上同じ「変形なし」の状態になる)
      titleAnimate(b, [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 300, easing: "ease-out", fill: "forwards" }, { opacity: "1", transform: "" });
    }, i * 80);
  });
  await sleep(Math.max(0, els.buttons.length - 1) * 80 + 300);
  if (myToken !== titleSeqToken) return;
  titleAnimate(els.footer, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out", fill: "forwards" }, { opacity: "1" });
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

  // オープニングBGMはこの時点(オープニング開始と同時)で再生を試みる。動画の有無に関わらず
  // 同じ曲がそのままタイトル画面のBGMとしても鳴り続ける設計のため、動画が無い場合(現状)でも
  // ここで開始しておけば「オープニング→タイトルへ自然に切り替わる」体験になる。
  // ブラウザの自動再生制限で拒否された場合は、audio.jsのunlockAudio()が最初のユーザー操作の
  // タイミングで再試行する(この関数はcatchだけしてエラーを握りつぶさず、そちらに委ねる)
  if (openingBgmAudio.paused) {
    openingBgmAudio.currentTime = 0;
    openingBgmAudio.play().catch(() => {});
  }

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
