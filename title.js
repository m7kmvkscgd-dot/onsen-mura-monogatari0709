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

// ============ ロゴのclip-path動的計算(①の根本修正) ============
// title_bg.webpは853x1844で、ロゴ帯は画像のy=195〜575の範囲に焼き込まれている。
// 背景は.title-bg-base/.title-logo-revealともbackground-size:coverで表示しており、
// coverは「要素(=画面)の縦横比」と「画像の縦横比」がずれるほど画像の一部が上下または左右に
// はみ出してトリミングされる。以前はこのロゴ帯の範囲を「画像の高さ1844pxに対する割合」
// (10.575%〜68.818%)としてclip-path: inset()に直接指定していたが、clip-path: inset()の
// パーセンテージは画像ではなく要素(=画面)の高さに対する割合として解釈されるため、
// 画面の縦横比が画像の縦横比(853:1844≈0.4626)とたまたま近い端末でしか正しい位置にならず、
// 縦横比が大きく異なる端末(例: iPhone SEのような相対的に横長の画面)では coverによる
// 上下トリミング量が変わり、ロゴ帯が画面外(クリップ範囲の外)にずれて「ロゴが表示されない」
// 不具合を起こしていた。これがタイトルロゴ非表示の根本原因。
// 対策として、実際のビューポートサイズ・画像の実寸・coverのスケール計算をJSで毎回行い、
// 「画像のロゴ帯が画面のどの位置に実際に描画されているか」を逆算してclip-pathを都度書き込む。
// Safariはアドレスバーの表示/非表示で実効ビューポート高さが動的に変わるため、
// resize/orientationchangeのたびに再計算する
const TITLE_LOGO_IMAGE_W = 853;
const TITLE_LOGO_IMAGE_H = 1844;
const TITLE_LOGO_BAND_TOP_PX = 195;
const TITLE_LOGO_BAND_BOTTOM_PX = 575;
function updateTitleLogoClipPath() {
  const el = document.getElementById("titleLogoReveal");
  if (!el) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!vw || !vh) return;
  // background-size:coverと同じ計算: 画面を隙間なく覆うために必要な最小スケール
  const scale = Math.max(vw / TITLE_LOGO_IMAGE_W, vh / TITLE_LOGO_IMAGE_H);
  const scaledH = TITLE_LOGO_IMAGE_H * scale;
  // background-position:centerのため、画像は縦方向にも中央揃え(はみ出す分は上下均等にトリミング)
  const offsetY = (vh - scaledH) / 2;
  const topPx = offsetY + TITLE_LOGO_BAND_TOP_PX * scale;
  const bottomPx = offsetY + TITLE_LOGO_BAND_BOTTOM_PX * scale;
  const topPct = Math.max(0, Math.min(100, (topPx / vh) * 100));
  const bottomInsetPct = Math.max(0, Math.min(100, ((vh - bottomPx) / vh) * 100));
  el.style.clipPath = `inset(${topPct.toFixed(3)}% 0 ${bottomInsetPct.toFixed(3)}% 0)`;
  // scale(0.98→1)のフェードイン演出がロゴ帯の中心を基準に膨らむよう、transform-originも
  // 同じ計算で揃える(clip-pathと基準がずれていると、拡大時にロゴが変な位置にずれて見える)
  const centerPct = ((topPx + bottomPx) / 2 / vh) * 100;
  el.style.transformOrigin = `50% ${Math.max(0, Math.min(100, centerPct)).toFixed(3)}%`;
}
window.addEventListener("resize", updateTitleLogoClipPath);
window.addEventListener("orientationchange", updateTitleLogoClipPath);

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
// transform: none相当の状態に戻す。opacityだけは最終値をそのままinlineに残す)。
// 【ボタン出現直後の一瞬のチラつきの原因】以前はa.cancel()を先に呼んでからfinalStyleを
// 書き込んでいたが、cancel()はアニメーションの効果をその場で取り除くため、次の行が実行される
// までの一瞬、要素は「アニメーション開始前のinline style」(resetTitleVisualState()が設定した
// opacity:"0"のまま)に戻ってしまう瞬間が生まれ得る。同じ関数内の連続した同期処理でも、
// ブラウザによっては(特にSafari/WebKit系のコンポジタ)この中間状態を実際に1フレーム描画してしまい、
// 「出た瞬間に一瞬消えてまた出る」というチラつきとして視認されていた。finalStyleを先に書き込み、
// その後でcancel()する順序に入れ替えることで、アニメーションが外れた瞬間には既に正しい
// inline styleが書き込まれた状態になり、古い値が一瞬でも露出する隙が無くなる
function titleAnimate(el, keyframes, opts, finalStyle) {
  const a = el.animate(keyframes, opts);
  titleSeqAnimations.push(a);
  const duration = typeof opts.duration === "number" ? opts.duration : 300;
  return Promise.race([a.finished.catch(() => {}), sleep(duration + 200)]).then(() => {
    if (finalStyle) Object.assign(el.style, finalStyle);
    try { a.cancel(); } catch (e) {}
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
  updateTitleLogoClipPath(); // 演出開始のたびに最新のビューポート寸法でclip-pathを計算し直す
  const els = titleSeqElements();
  els.bgBase.style.opacity = "0";
  els.logo.style.opacity = "0";
  els.logo.style.transform = "scale(0.98)";
  els.tapPrompt.style.opacity = "0";
  els.tapPrompt.style.display = "none";
  els.buttons.forEach((b) => { b.style.opacity = "0"; });
  els.footer.style.opacity = "0";
  els.menu.style.pointerEvents = "none";
}

// 演出を待たず、いきなり完成形で表示する(設定画面等からタイトルへ戻ってきた時用)
function showTitleVisualStateInstantly() {
  updateTitleLogoClipPath(); // 画面回転等でビューポートが変わっていた場合に備えて再計算
  const els = titleSeqElements();
  els.bgBase.style.opacity = "1";
  els.logo.style.opacity = "1";
  els.logo.style.transform = "scale(1)";
  els.tapPrompt.style.opacity = "0";
  els.tapPrompt.style.display = "none";
  els.buttons.forEach((b) => { b.style.opacity = "1"; b.style.transform = ""; });
  els.footer.style.opacity = "1";
  els.menu.style.pointerEvents = "";
}

function waitForTitleTap() {
  return new Promise((resolve) => {
    const handler = () => { document.removeEventListener("pointerdown", handler); resolve(); };
    document.addEventListener("pointerdown", handler, { once: true });
  });
}

// full=trueの時だけ「背景表示→0.3秒→ロゴフェードイン→0.3秒→画面をタップ→(タップで専用SE+1秒)→
// ボタン0.08秒差でスライドイン」の一連の演出を再生する。イラストをまず見せてから操作に入りたい
// という指示のため、ロゴが出た後は自動で進めずタップ待ちにしている。トークンで世代管理しており、
// 演出の途中でrenderTitleScreen()が再度呼ばれた場合(例:演出中に設定へ移動して戻ってきた等)は
// 古い世代のawaitが目を覚ましても何もせず即座に抜ける
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

  await titleAnimate(els.bgBase, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: "ease-out", fill: "forwards" }, { opacity: "1" });
  if (myToken !== titleSeqToken) return;
  await sleep(300);
  if (myToken !== titleSeqToken) return;

  await titleAnimate(els.logo, [{ opacity: 0, transform: "scale(0.98)" }, { opacity: 1, transform: "scale(1)" }], { duration: 400, easing: "ease-out", fill: "forwards" }, { opacity: "1", transform: "scale(1)" });
  if (myToken !== titleSeqToken) return;
  await sleep(300);
  if (myToken !== titleSeqToken) return;

  els.tapPrompt.style.display = "block";
  await titleAnimate(els.tapPrompt, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out", fill: "forwards" }, { opacity: "1" });
  if (myToken !== titleSeqToken) return;

  await waitForTitleTap();
  if (myToken !== titleSeqToken) return;
  playSfx("title_tap");

  await titleAnimate(els.tapPrompt, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-out", fill: "forwards" }, { opacity: "0" });
  els.tapPrompt.style.display = "none";
  if (myToken !== titleSeqToken) return;

  await sleep(1000);
  if (myToken !== titleSeqToken) return;

  els.menu.style.pointerEvents = "";
  els.buttons.forEach((b, i) => {
    setTimeout(() => {
      if (myToken !== titleSeqToken) return;
      // 下からのスライド(translateY)は廃止し、フェードインのみにした(ユーザー指示)
      titleAnimate(b, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out", fill: "forwards" }, { opacity: "1" });
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
  // 遠征の途中でリロードされたセーブなら、町ではなく探索のその場から再開する
  // (以前は常に町へ戻れてしまい、危険になったら更新で無傷離脱できるパーマデス回避の穴だった)
  if (state.expedition && state.expedition.active && resumeExpeditionFromSave()) return;
  renderTown();
};

document.getElementById("titleSettingsBtn").onclick = () => {
  playSfx("select");
  showScreen("screen-settings");
  renderSettingsScreen();
};

// ============ 設定画面 ============
// 既存のミュート機能(#muteBtn/audio.js)をON/OFFトグルとして見せるだけの最小限の設定画面。
// (チュートリアル表示トグルは機能ごと削除した、2026-07-18)
// 元々タイトル画面からしか開けなかったため「戻る」は常にタイトルへ固定だったが、町画面の
// 歯車メニューからも開けるようになったため、開く直前の画面を記憶しておいて戻れるようにする
// (audio.jsのmenuSettingsBtnが設定する)。未設定(nullのまま)ならタイトルから開かれた
// ケースなので従来通りタイトルへ戻る
let settingsReturnScreenId = null;
function renderSettingsScreen() {
  const soundBtn = document.getElementById("settingsSoundToggle");
  soundBtn.textContent = masterBgmVolume === 0 ? "OFF" : "ON";
  soundBtn.classList.toggle("is-on", masterBgmVolume > 0);
}
document.getElementById("settingsSoundToggle").onclick = () => {
  toggleMute();
  renderSettingsScreen();
};
document.getElementById("settingsBackBtn").onclick = () => {
  if (settingsReturnScreenId) {
    showScreen(settingsReturnScreenId);
    settingsReturnScreenId = null;
  } else {
    showScreen("screen-title");
    renderTitleScreen();
  }
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

// ============ タップして開始ゲート ============
// ブラウザの自動再生制限(信頼できるユーザー操作の中でしか<audio>を再生できない)により、
// 何もタップせず演出を眺めているだけの間はオープニングBGMを鳴らせない。ここで最初の
// 一回だけ実際のタップを挟むことで、直後に始まるオープニング一式(動画+BGM)が
// 開始と同時に確実に音付きで始まるようにしている。タップ自体はaudio.js側の
// unlockAudio()(document全体のpointerdown等で発火)も同じイベントの中で動くため、
// ここで個別にBGMを再生する処理は書かず、ゲートを閉じてinitOpeningSequence()を
// 呼ぶだけでよい(unlockAudio()が同じ呼び出しスタックの中で先に解決している)
function initOpeningTapGate() {
  const gate = document.getElementById("openingTapGate");
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    gate.style.display = "none";
    initOpeningSequence();
  };
  gate.addEventListener("pointerdown", start, { once: true });
}

// ============ 初期化 ============
// タイトル画面はオープニング動画の背後で先に非表示状態にしておく(動画フェード中に完成形が
// 透けて見えないように)。実際の表示はinitOpeningSequence()の完了後、renderTitleScreen({full:true})で行う
resetTitleVisualState();
initOpeningTapGate();
