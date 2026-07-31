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

  // 【リリース前に1000へ戻すこと】本来の演出指示は「タップ後1秒の間」だが、テスト期間中は
  // 起動を速くするため0.1秒に短縮している(ユーザー指示2026-07-28、CLAUDE.mdにも戻し忘れ防止メモあり)
  await sleep(100);
  if (myToken !== titleSeqToken) return;

  els.buttons.forEach((b, i) => {
    setTimeout(() => {
      if (myToken !== titleSeqToken) return;
      // 下からのスライド(translateY)は廃止し、フェードインのみにした(ユーザー指示)
      titleAnimate(b, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out", fill: "forwards" }, { opacity: "1" });
    }, i * 80);
  });
  await sleep(Math.max(0, els.buttons.length - 1) * 80 + 300);
  if (myToken !== titleSeqToken) return;
  // 【誤タップ防止の構造修正2026-07-28】pointerEventsの解除はボタンのフェードイン完了後に行う。
  // 以前はフェード開始前に解除していたため「透明なボタンが先に押せる状態で立っている」時間があり、
  // 開始タップ直後の素早い2回目のタップが見えないボタン(製作者より/テストモード等)に命中して
  // 画面が切り替わってしまうバグがあった(タップ後の静止1秒がこの穴を偶然隠していただけで、
  // 静止を0.1秒に短縮したことで露呈した)
  els.menu.style.pointerEvents = "";
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

// ============ 開発用テストモード(2026-07-27) ============
// 侍/狩人/陰陽師+控え槍士(全Lv1)の固定パーティで、村を経由せず即・深淵の森へ出発する。
// 実機での動作確認を1タップで始めるためのもの。テストモード中はsaveState()が無効化される
// (save.js testModeActive)ため、本物のセーブデータには一切影響しない。帰還・全滅時は
// location.reload()でタイトルへ戻る(リロードすれば実セーブがそのまま生きている)
document.getElementById("titleTestBtn").onclick = () => {
  playSfx("select");
  testModeActive = true; // ここから先はセーブ書き込み禁止(実セーブ保護)
  state = defaultState();
  const specs = [["小太郎", "samurai"], ["弥助", "hunter"], ["静", "onmyoji"], ["権六", "spearman"]];
  const chars = specs.map(([name, classId]) => createCharacter(name, classId, state.classUpgrades));
  state.roster.push(...chars);
  state.activePartyIds = chars.map((c) => c.id); // 4人目(槍士)はenterDungeon()が控えに回す
  currentStage = "forest";
  enterDungeon(); // 画面遷移・BGM・遠征トラッカーのリセットまで通常の出発と同じ
};

// ============ ボステスト(2026-07-31、大規模戦テストを置き換え) ============
// 味方4枠(3人+控え1、本番のパーティ構成と同じ)の職業/レベル/スキルの型/装備有無と、
// 敵(ボス1+お供最大3)+ステータス上書きを設定して即戦闘に入る開発用ツール。
// ボスギミック(gimmicks.js)が実際に発火する状態で戦えるのが最大の目的で、
// 「調整→開始→設定画面に戻って再調整→再戦」のループを回す(戦闘中のリアルタイム編集はしない)。
// 調整した敵ステータスは敵エディタと同じENEMIES_CHANGED差分形式でJSON出力でき、
// 既存の適用フロー(pipeline/apply_enemy_editor_export.js)にそのまま乗る。
// 他のテストモードと同じくtestModeActiveでセーブ保護、勝敗/逃走は全てタイトルへ直帰(battle.jsのbossTestActive分岐)
const BOSS_TEST_STAT_KEYS = ["hp", "atk", "def", "spd"];
let bossTestConfig = {
  allies: [
    { classId: "samurai", level: 5, tree: "random" },
    { classId: "spearman", level: 5, tree: "random" },
    { classId: "onmyoji", level: 5, tree: "random" },
    { classId: "hunter", level: 5, tree: "random" },
  ],
  equipOn: true,
  enemies: ["boss_kasha", "", "", ""],
  // 敵枠ごとのステータス上書き { hp, atk, def, spd }(枠の敵を選び直すとマスター値で初期化される)
  statOverrides: [null, null, null, null],
};
function bossTestEnemyIdsSorted() {
  const ids = Object.keys(ENEMIES);
  const isBossLike = (id) => ENEMIES[id].isBoss || ENEMIES[id].isMidBoss;
  return { bosses: ids.filter(isBossLike), others: ids.filter((id) => !isBossLike(id)) };
}
function bossTestDefaultStats(enemyId) {
  const e = ENEMIES[enemyId];
  return e ? { hp: e.hp, atk: e.atk, def: e.def, spd: e.spd } : null;
}
// 味方1枠ぶんの行(職業/レベル/型)を作る。selectのonchangeは設定オブジェクトの書き換えだけ行い、
// 画面全体は再描画しない(型の選択肢だけは職業に依存するため、職業変更時にその場で作り直す)
function bossTestBuildAllyRow(idx) {
  const spec = bossTestConfig.allies[idx];
  const row = document.createElement("div");
  row.className = "boss-test-slot";
  const classSel = document.createElement("select");
  classSel.className = "title-select";
  Object.keys(CLASSES).forEach((cid) => {
    const opt = document.createElement("option");
    opt.value = cid;
    opt.textContent = CLASSES[cid].ja;
    classSel.appendChild(opt);
  });
  classSel.value = spec.classId;
  const levelSel = document.createElement("select");
  levelSel.className = "title-select bt-level";
  for (let lv = 1; lv <= MAX_LEVEL; lv++) {
    const opt = document.createElement("option");
    opt.value = String(lv);
    opt.textContent = `Lv.${lv}`;
    levelSel.appendChild(opt);
  }
  levelSel.value = String(spec.level);
  const treeSel = document.createElement("select");
  treeSel.className = "title-select bt-tree";
  const fillTreeOptions = () => {
    const names = SKILL_TREE_NAMES[spec.classId] || { left: "左", right: "右" };
    treeSel.innerHTML = "";
    [["random", "🎲ランダム"], ["left", `${names.left}固定`], ["right", `${names.right}固定`]].forEach(([v, label]) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = label;
      treeSel.appendChild(opt);
    });
    treeSel.value = spec.tree;
  };
  fillTreeOptions();
  classSel.onchange = () => { spec.classId = classSel.value; spec.tree = "random"; fillTreeOptions(); };
  levelSel.onchange = () => { spec.level = Number(levelSel.value) || 1; };
  treeSel.onchange = () => { spec.tree = treeSel.value; };
  row.appendChild(classSel);
  row.appendChild(levelSel);
  row.appendChild(treeSel);
  return row;
}
// 敵1枠ぶんのselect。1枠目はボスを先頭グループに出す(お供枠は全敵から自由に選べる+空欄可)
function bossTestBuildEnemyRow(idx) {
  const row = document.createElement("div");
  row.className = "boss-test-slot";
  const sel = document.createElement("select");
  sel.className = "title-select";
  const { bosses, others } = bossTestEnemyIdsSorted();
  const addOptions = (parent, ids) => {
    ids.forEach((id) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = `${ENEMIES[id].ja} [${id}]`;
      parent.appendChild(opt);
    });
  };
  if (idx > 0) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "(なし)";
    sel.appendChild(empty);
  }
  const bossGroup = document.createElement("optgroup");
  bossGroup.label = "ボス/中ボス";
  addOptions(bossGroup, bosses);
  sel.appendChild(bossGroup);
  const otherGroup = document.createElement("optgroup");
  otherGroup.label = "雑魚";
  addOptions(otherGroup, others);
  sel.appendChild(otherGroup);
  sel.value = bossTestConfig.enemies[idx] || (idx === 0 ? "boss_kasha" : "");
  bossTestConfig.enemies[idx] = sel.value;
  sel.onchange = () => {
    bossTestConfig.enemies[idx] = sel.value;
    bossTestConfig.statOverrides[idx] = sel.value ? bossTestDefaultStats(sel.value) : null;
    renderBossTestStatRows(); // 敵の入れ替えは構造が変わるのでステータス欄だけ作り直す
  };
  row.appendChild(sel);
  return row;
}
// 選択中の敵枠ぶんのステータス上書き欄。数値inputのoninputは設定の書き換えのみで再描画しない
// (エディタ系の「入力のたびに再描画してフォーカスが飛ぶ」事故の再発防止)
function renderBossTestStatRows() {
  const wrap = document.getElementById("bossTestStatRows");
  wrap.innerHTML = "";
  bossTestConfig.enemies.forEach((enemyId, idx) => {
    if (!enemyId) return;
    if (!bossTestConfig.statOverrides[idx]) bossTestConfig.statOverrides[idx] = bossTestDefaultStats(enemyId);
    const ov = bossTestConfig.statOverrides[idx];
    const box = document.createElement("div");
    box.className = "boss-test-stat-box";
    const head = document.createElement("div");
    head.className = "boss-test-stat-head";
    head.textContent = `${idx + 1}. ${ENEMIES[enemyId].ja}のステータス`;
    box.appendChild(head);
    const grid = document.createElement("div");
    grid.className = "boss-test-stat-grid";
    [["hp", "HP"], ["atk", "攻"], ["def", "防"], ["spd", "速"]].forEach(([key, label]) => {
      const field = document.createElement("label");
      field.className = "boss-test-stat-field";
      field.innerHTML = `<span>${label}</span>`;
      const input = document.createElement("input");
      input.type = "number";
      input.inputMode = "numeric";
      input.value = String(ov[key]);
      input.oninput = () => { ov[key] = Math.max(0, Number(input.value) || 0); };
      field.appendChild(input);
      grid.appendChild(field);
    });
    box.appendChild(grid);
    wrap.appendChild(box);
  });
}
function renderBossTestScreen() {
  const allyWrap = document.getElementById("bossTestAllyRows");
  allyWrap.innerHTML = "";
  bossTestConfig.allies.forEach((_, idx) => allyWrap.appendChild(bossTestBuildAllyRow(idx)));
  const enemyWrap = document.getElementById("bossTestEnemyRows");
  enemyWrap.innerHTML = "";
  bossTestConfig.enemies.forEach((_, idx) => enemyWrap.appendChild(bossTestBuildEnemyRow(idx)));
  renderBossTestStatRows();
  const equipBtn = document.getElementById("bossTestEquipToggle");
  equipBtn.textContent = bossTestConfig.equipOn ? "ON" : "OFF";
  equipBtn.classList.toggle("is-on", bossTestConfig.equipOn);
  document.getElementById("bossTestExportArea").style.display = "none";
  document.getElementById("bossTestCopyBtn").style.display = "none";
}
document.getElementById("titleBossTestBtn").onclick = () => {
  playSfx("select");
  renderBossTestScreen();
  showScreen("screen-boss-test");
};
document.getElementById("bossTestBackBtn").onclick = () => {
  playSfx("select");
  showScreen("screen-title");
  renderTitleScreen();
};
document.getElementById("bossTestEquipToggle").onclick = () => {
  playSfx("select");
  bossTestConfig.equipOn = !bossTestConfig.equipOn;
  const equipBtn = document.getElementById("bossTestEquipToggle");
  equipBtn.textContent = bossTestConfig.equipOn ? "ON" : "OFF";
  equipBtn.classList.toggle("is-on", bossTestConfig.equipOn);
};
// 装備トグルON時の自動購入: 各職業とも「そのレベルで解禁済みの段階」まで購入済み扱いにする
// (EQUIPMENTのtier.levelが解禁レベル。同じ職業が複数枠いる場合は最高レベルに合わせる)。
// createCharacterが購入状態(state.classUpgrades)から装備ボーナスを計算するため、キャラ生成前に呼ぶ
function bossTestApplyEquipUpgrades(specs) {
  const levelByClass = {};
  specs.forEach((s) => { levelByClass[s.classId] = Math.max(levelByClass[s.classId] || 0, s.level); });
  Object.keys(levelByClass).forEach((classId) => {
    const eq = EQUIPMENT[classId];
    if (!eq) return;
    const ownedTiers = (tiers) => tiers.filter((t) => t.level <= levelByClass[classId]).length;
    state.classUpgrades[classId] = { weapon: ownedTiers(eq.weapon), armor: ownedTiers(eq.armor) };
  });
}
// 指定レベルまでlevelUpを繰り返しながらスキルを取らせてキャラを作る(createRaidTestCharacterと
// 同じ方式)。treeMode="left"/"right"なら毎レベル同じ側で固定、"random"なら左右ランダム
function createBossTestCharacter(name, classId, targetLevel, treeMode) {
  const c = createCharacter(name, classId, state.classUpgrades);
  for (let lv = 2; lv <= targetLevel; lv++) {
    levelUp(c, () => {});
    const choice = SKILL_TREES[classId] && SKILL_TREES[classId][lv];
    if (choice) {
      const side = treeMode === "left" || treeMode === "right" ? treeMode : (Math.random() < 0.5 ? "left" : "right");
      applySkillChoice(c, { ...choice[side], side }, lv);
    }
  }
  c.hp = c.maxHp;
  c.mp = c.maxMp;
  return c;
}
document.getElementById("bossTestStartBtn").onclick = () => {
  playSfx("select");
  const enemyIds = bossTestConfig.enemies.filter(Boolean);
  if (enemyIds.length === 0 || !bossTestConfig.enemies[0]) {
    showInfoModal("1枠目のボスを選んでください");
    return;
  }
  testModeActive = true; // ここから先はセーブ書き込み禁止(実セーブ保護)
  bossTestActive = true; // 勝敗/逃走のタイトル直帰・ボスのHP低下逃走の無効化(battle.js)
  state = defaultState();
  if (bossTestConfig.equipOn) bossTestApplyEquipUpgrades(bossTestConfig.allies);
  const names = [...RAID_TEST_NAMES].sort(() => Math.random() - 0.5);
  const chars = bossTestConfig.allies.map((spec, i) => createBossTestCharacter(names[i] || `試験隊${i + 1}`, spec.classId, spec.level, spec.tree));
  state.roster.push(...chars);
  state.activePartyIds = chars.map((c) => c.id);
  state.pendingSkillChoices = []; // スキルは生成時に選択済みのため、レベルアップで積まれた選択待ちは消す
  fieldParty = chars.slice(0, 3); // 本番と同じ3人+控え1の構成
  reserveFieldMember = chars[3] || null;
  // 背景はボスのステージの絵をそのまま使う(探索は経由しない)
  const boss = ENEMIES[bossTestConfig.enemies[0]];
  currentStage = boss.stage || "forest";
  currentFloor = Math.max(1, boss.minFloor || 1);
  retreating = false;
  updateSceneBackgrounds();
  const enemies = bossTestConfig.enemies.map((id, idx) => {
    if (!id) return null;
    const e = instantiateEnemyById(id);
    if (!e) return null;
    const ov = bossTestConfig.statOverrides[idx];
    if (ov) {
      e.hp = e.maxHp = Math.max(1, ov.hp);
      e.atk = Math.max(1, ov.atk);
      e.def = Math.max(0, ov.def);
      e.spd = Math.max(1, ov.spd);
    }
    return e;
  }).filter(Boolean);
  startBattle(enemies, null, `ボステスト: ${boss.ja}が立ちはだかる！`);
};
// 調整した敵ステータスを、敵エディタのエクスポートと同じENEMIES_CHANGED差分形式で出力する
// (マスター値から変更のあった敵だけ、敵オブジェクト全体を出す=適用スクリプトのマージ単位と同じ)。
// 同じ敵を複数枠に置いて別々の値にした場合は後の枠が勝つ
function buildBossTestExportText() {
  const changed = {};
  bossTestConfig.enemies.forEach((id, idx) => {
    if (!id || !ENEMIES[id]) return;
    const ov = bossTestConfig.statOverrides[idx];
    if (!ov) return;
    const base = ENEMIES[id];
    if (BOSS_TEST_STAT_KEYS.every((k) => Number(ov[k]) === base[k])) return;
    changed[id] = { ...base, hp: Number(ov.hp), atk: Number(ov.atk), def: Number(ov.def), spd: Number(ov.spd) };
  });
  let out = `// ボステストで調整した敵 — ${Object.keys(changed).length}体(enemy_editor.htmlのエクスポートと同形式)\n`;
  out += `const ENEMIES_CHANGED = ${JSON.stringify(changed, null, 2)};\n\n`;
  out += `const ENEMIES_REMOVED = [];\n\n`;
  out += `const ENEMY_WEAKNESS_CHANGED = {};\n\n`;
  out += `const ENEMY_WEAKNESS_REMOVED = [];\n\n`;
  out += `const ENEMY_MATERIAL_DROPS_CHANGED = {};\n\n`;
  out += `const ENEMY_MATERIAL_DROPS_REMOVED = [];\n`;
  return out;
}
document.getElementById("bossTestExportBtn").onclick = () => {
  playSfx("select");
  const area = document.getElementById("bossTestExportArea");
  area.value = buildBossTestExportText();
  area.style.display = "";
  document.getElementById("bossTestCopyBtn").style.display = "";
};
document.getElementById("bossTestCopyBtn").onclick = () => {
  const area = document.getElementById("bossTestExportArea");
  area.select();
  navigator.clipboard.writeText(area.value).then(() => {
    const btn = document.getElementById("bossTestCopyBtn");
    btn.textContent = "コピーしました！";
    setTimeout(() => { btn.textContent = "JSONをコピー"; }, 1500);
  }).catch(() => { document.execCommand("copy"); });
};

// ============ クエストテスト(2026-07-31) ============
// 奉行所の依頼を日替わり張り出し抽選を待たずに即受注→出発する開発用ツール。物語クエスト
// (専用ルートのフレーバー/口上/魂の回想/完了文)を通しで検証するのが主目的。
// 味方はボステストと同じ設定(bossTestConfig.allies/equipOn)と生成関数を共用し、
// 出発は本番と同じ受注状態(state.acceptedQuest)を作ってenterDungeon()を呼ぶだけ
// (=区間解決・確定戦闘・失敗精算・リザルトまで全て本番ロジック。契約金は0)
function renderQuestTestScreen() {
  const sel = document.getElementById("questTestSelect");
  if (sel.options.length === 0) {
    // 専用ルート付き(物語クエスト)を先頭グループに出す
    const keys = Object.keys(QUEST_DEFS);
    const withRoute = keys.filter((k) => QUEST_DEFS[k].route);
    const withoutRoute = keys.filter((k) => !QUEST_DEFS[k].route);
    [...withRoute, ...withoutRoute].forEach((k) => {
      const d = QUEST_DEFS[k];
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = `${d.emoji} ${d.title}${d.route ? " 🛤" : ""}`;
      sel.appendChild(opt);
    });
    if (withRoute.length > 0) sel.value = withRoute[0];
  }
  const allyWrap = document.getElementById("questTestAllyRows");
  allyWrap.innerHTML = "";
  bossTestConfig.allies.forEach((_, idx) => allyWrap.appendChild(bossTestBuildAllyRow(idx)));
  const equipBtn = document.getElementById("questTestEquipToggle");
  equipBtn.textContent = bossTestConfig.equipOn ? "ON" : "OFF";
  equipBtn.classList.toggle("is-on", bossTestConfig.equipOn);
}
document.getElementById("titleQuestTestBtn").onclick = () => {
  playSfx("select");
  renderQuestTestScreen();
  showScreen("screen-quest-test");
};
document.getElementById("questTestBackBtn").onclick = () => {
  playSfx("select");
  showScreen("screen-title");
  renderTitleScreen();
};
document.getElementById("questTestEquipToggle").onclick = () => {
  playSfx("select");
  bossTestConfig.equipOn = !bossTestConfig.equipOn;
  const equipBtn = document.getElementById("questTestEquipToggle");
  equipBtn.textContent = bossTestConfig.equipOn ? "ON" : "OFF";
  equipBtn.classList.toggle("is-on", bossTestConfig.equipOn);
};
document.getElementById("questTestStartBtn").onclick = () => {
  playSfx("select");
  const questKey = document.getElementById("questTestSelect").value;
  const qDef = QUEST_DEFS[questKey];
  if (!qDef) return;
  testModeActive = true; // ここから先はセーブ書き込み禁止(実セーブ保護)
  state = defaultState();
  if (bossTestConfig.equipOn) bossTestApplyEquipUpgrades(bossTestConfig.allies);
  const names = [...RAID_TEST_NAMES].sort(() => Math.random() - 0.5);
  const chars = bossTestConfig.allies.map((spec, i) => createBossTestCharacter(names[i] || `試験隊${i + 1}`, spec.classId, spec.level, spec.tree));
  state.roster.push(...chars);
  state.activePartyIds = chars.map((c) => c.id); // 4人目はenterDungeon()が控えに回す(本番と同じ)
  state.pendingSkillChoices = [];
  state.inventory.potion = 5; // 道中検証用の回復薬
  // 本番の受注処理(town.js acceptQuest)と同じ形のacceptedQuestを契約金0で作る
  state.acceptedQuest = {
    questKey, enemyId: qDef.spawnId || questKey, targetFloor: qDef.targetFloor, count: qDef.count, chasing: false,
    contractFee: 0, route: qDef.route || null,
    expireMinutes: qDef.route ? null : absoluteGameMinutes() + QUEST_DEADLINE_DAYS * 24 * 60,
  };
  currentStage = qDef.route ? "questroute" : "forest";
  enterDungeon();
};

// ============ 襲撃テストモード(2026-07-29、2026-07-29ユーザー指摘で村レベル/防衛設備を指定制に変更) ============
// 平均レベル・襲撃相手の村レベル・見張り台/バリケード(木の柵)/投石器の有無はユーザーが指定する
// (当初は全部ランダムにしたが「村レベルは指定させろ・防衛設備の有無もこっちで指定させろ・
// 味方の人数は必ず最低4人」と修正指示があったため)。ボタンを押すたびにランダムに振るのは
// 防衛隊の職業とスキル(各レベルで左右ランダム)だけ。人数は見張り台OFF時=4人固定、ON時=
// raidPartyMax()いっぱいの5人固定(ユーザー指定の「最低4人」を満たしつつ常に全員出す)。
// 5人編成の時は本番と同じく狩人/砲術士を1人保証する(raidPartyCompositionOk)。回復薬は5個固定。
// 実際の開戦処理(startRaidBattleFromPrep、raid.js)をそのまま呼ぶため、ウェーブ抽選・バリケードの
// 肩代わり・投石器の自動発動など本番と全く同じロジックで動く。他のテストモードと同じく
// testModeActiveでセーブ保護、全滅/帰還でタイトルへ戻る
let raidTestWatchtowerOn = true;
let raidTestBarricadeOn = true;
let raidTestCatapultOn = true;
document.getElementById("titleRaidTestBtn").onclick = () => {
  playSfx("select");
  populateRaidTestLevelSelect();
  populateRaidTestHouseLevelSelect();
  renderRaidTestScreen();
  showScreen("screen-raid-test");
};
document.getElementById("raidTestBackBtn").onclick = () => {
  playSfx("select");
  showScreen("screen-title");
  renderTitleScreen();
};
function renderRaidTestScreen() {
  [["raidTestWatchtowerToggle", "raidTestWatchtowerOn"], ["raidTestBarricadeToggle", "raidTestBarricadeOn"], ["raidTestCatapultToggle", "raidTestCatapultOn"]]
    .forEach(([btnId, varName]) => {
      const btn = document.getElementById(btnId);
      const on = varName === "raidTestWatchtowerOn" ? raidTestWatchtowerOn : varName === "raidTestBarricadeOn" ? raidTestBarricadeOn : raidTestCatapultOn;
      btn.textContent = on ? "ON" : "OFF";
      btn.classList.toggle("is-on", on);
    });
}
document.getElementById("raidTestWatchtowerToggle").onclick = () => { playSfx("select"); raidTestWatchtowerOn = !raidTestWatchtowerOn; renderRaidTestScreen(); };
document.getElementById("raidTestBarricadeToggle").onclick = () => { playSfx("select"); raidTestBarricadeOn = !raidTestBarricadeOn; renderRaidTestScreen(); };
document.getElementById("raidTestCatapultToggle").onclick = () => { playSfx("select"); raidTestCatapultOn = !raidTestCatapultOn; renderRaidTestScreen(); };
function populateRaidTestLevelSelect() {
  const select = document.getElementById("raidTestLevelSelect");
  if (select.options.length > 0) return;
  for (let lv = 1; lv <= MAX_LEVEL; lv++) {
    const opt = document.createElement("option");
    opt.value = String(lv);
    opt.textContent = `Lv.${lv}`;
    select.appendChild(opt);
  }
  select.value = "5";
}
function populateRaidTestHouseLevelSelect() {
  const select = document.getElementById("raidTestHouseLevelSelect");
  if (select.options.length > 0) return;
  for (let lv = 1; lv <= HOUSE_MAX_LEVEL; lv++) {
    const opt = document.createElement("option");
    opt.value = String(lv);
    opt.textContent = `村Lv.${lv}`;
    select.appendChild(opt);
  }
  select.value = "1";
}
const RAID_TEST_CLASS_IDS = Object.keys(CLASSES);
const RAID_TEST_NAMES = ["小太郎", "弥助", "静", "権六", "巴", "霧丸", "玄蕃", "晴明"]; // 表示用の仮名、重複しても支障はない
function raidTestRandomClass() {
  return RAID_TEST_CLASS_IDS[Math.floor(Math.random() * RAID_TEST_CLASS_IDS.length)];
}
// 指定レベルまで、SKILL_TREESにある分だけ各レベルの選択を左右ランダムに取らせながらキャラを作る
// (resetAllSkills(engine.js)と同じ「Lv1からlevelUpを繰り返す」方式で、その場でapplySkillChoiceする)
function createRaidTestCharacter(name, classId, targetLevel) {
  const c = createCharacter(name, classId, state.classUpgrades);
  for (let lv = 2; lv <= targetLevel; lv++) {
    levelUp(c, () => {});
    const choice = SKILL_TREES[classId] && SKILL_TREES[classId][lv];
    if (choice) {
      const side = Math.random() < 0.5 ? "left" : "right";
      applySkillChoice(c, { ...choice[side], side }, lv);
    }
  }
  c.hp = c.maxHp;
  c.mp = c.maxMp;
  return c;
}
document.getElementById("raidTestRollBtn").onclick = () => {
  playSfx("select");
  const avgLevel = Math.max(1, Math.min(MAX_LEVEL, Number(document.getElementById("raidTestLevelSelect").value) || 5));
  const houseLevel = Math.max(1, Math.min(HOUSE_MAX_LEVEL, Number(document.getElementById("raidTestHouseLevelSelect").value) || 1));

  testModeActive = true; // ここから先はセーブ書き込み禁止(実セーブ保護)
  state = defaultState();
  state.houseLevel = houseLevel; // ウェーブ抽選(RAID_CONFIG)に使う村レベル。ユーザー指定
  state.watchtowerLevel = raidTestWatchtowerOn ? 1 : 0;
  state.barricadeLevel = raidTestBarricadeOn ? 1 : 0; // ONの時は木の柵(Tier1)固定
  state.catapultLevel = raidTestCatapultOn ? 1 : 0;
  state.barricadeHp = state.barricadeLevel > 0 ? BARRICADE_TIERS[state.barricadeLevel - 1].hp : 0;
  state.inventory.potion = 5; // ユーザー指定: 回復薬は常に5個

  // 人数は「必ず最低4人」(ユーザー指定): 見張り台OFFなら4人固定、ONならraidPartyMax()いっぱいの5人固定
  const partySize = raidPartyMax();
  const names = [...RAID_TEST_NAMES].sort(() => Math.random() - 0.5);
  const chars = [];
  for (let i = 0; i < partySize; i++) chars.push(createRaidTestCharacter(names[i] || `防衛隊${i + 1}`, raidTestRandomClass(), avgLevel));
  // 5人編成(見張り台あり)は本番と同じく狩人/砲術士が最低1人必要。いなければ1人を差し替える
  if (partySize > RAID_PARTY_BASE_MAX && !chars.some(isRaidWatchtowerClass)) {
    const idx = Math.floor(Math.random() * chars.length);
    chars[idx] = createRaidTestCharacter(chars[idx].name, Math.random() < 0.5 ? "hunter" : "gunner", avgLevel);
  }
  state.roster.push(...chars);
  raidDefenderIds = chars.map((c) => c.id);
  startRaidBattleFromPrep();
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
  const highEncounterBtn = document.getElementById("settingsHighEncounterToggle");
  highEncounterBtn.textContent = state.highEncounterMode ? "ON" : "OFF";
  highEncounterBtn.classList.toggle("is-on", state.highEncounterMode);
  populateHighDurabilitySelects();
  document.getElementById("settingsHighDurabilityDefSelect").value = String(state.highDurabilityDefBonusPct || 0);
  document.getElementById("settingsHighDurabilityAtkSelect").value = String(state.highDurabilityAtkReductionPct || 0);
  populateGoldAdjustSelect();
  document.getElementById("settingsGoldAdjustSelect").value = String(state.goldDropAdjustment || 0);
  renderSettingsDebugWarpSection();
}
// 金調整のドロップダウンにOFF/-1〜-10の選択肢を並べる(値は差し引く額を正の数で保持)。
// 高耐久モード同様、初回だけ中身を作る(選択中の値がリセットされるのを防ぐ)
function populateGoldAdjustSelect() {
  const select = document.getElementById("settingsGoldAdjustSelect");
  if (select.options.length > 0) return;
  for (let n = 0; n <= 10; n++) {
    const opt = document.createElement("option");
    opt.value = String(n);
    opt.textContent = n === 0 ? "OFF" : `-${n}`;
    select.appendChild(opt);
  }
}
// 高耐久モードの2つのドロップダウン(防御力アップ/攻撃力ダウン)に0〜100%・5%刻みの選択肢を並べる。
// 初回だけ中身を作ればよいので、既に選択肢がある場合は作り直さない(選択中の値がリセットされるのを防ぐ)
function populateHighDurabilitySelects() {
  [["settingsHighDurabilityDefSelect", "+"], ["settingsHighDurabilityAtkSelect", "-"]].forEach(([id, sign]) => {
    const select = document.getElementById(id);
    if (select.options.length > 0) return;
    for (let pct = 0; pct <= 100; pct += 5) {
      const opt = document.createElement("option");
      opt.value = String(pct);
      opt.textContent = pct === 0 ? "OFF" : `${sign}${pct}%`;
      select.appendChild(opt);
    }
  });
}
// 開発者用: 敵無しモード(debugNoEncounters、町のゴールド表示4回タップ)がONの間だけ、
// 中継の村へのワープボタンを設定画面に表示する(debugWarpTargets/debugWarpToVillageはdungeon.js参照)
function renderSettingsDebugWarpSection() {
  const section = document.getElementById("settingsDebugWarpSection");
  section.style.display = debugNoEncounters ? "" : "none";
  if (!debugNoEncounters) return;
  const list = document.getElementById("settingsDebugWarpList");
  list.innerHTML = "";
  debugWarpTargets().forEach(({ stage, label }) => {
    const btn = document.createElement("button");
    btn.className = "big";
    btn.textContent = `${label}へワープ`;
    btn.onclick = () => { playSfx("select"); debugWarpToVillage(stage); };
    list.appendChild(btn);
  });
}
document.getElementById("settingsSoundToggle").onclick = () => {
  toggleMute();
  renderSettingsScreen();
};
document.getElementById("settingsHighEncounterToggle").onclick = () => {
  state.highEncounterMode = !state.highEncounterMode;
  saveState();
  playSfx("select");
  renderSettingsScreen();
};
document.getElementById("settingsHighDurabilityDefSelect").onchange = (e) => {
  state.highDurabilityDefBonusPct = Number(e.target.value) || 0;
  saveState();
  playSfx("select");
};
document.getElementById("settingsHighDurabilityAtkSelect").onchange = (e) => {
  state.highDurabilityAtkReductionPct = Number(e.target.value) || 0;
  saveState();
  playSfx("select");
};
document.getElementById("settingsGoldAdjustSelect").onchange = (e) => {
  state.goldDropAdjustment = Number(e.target.value) || 0;
  saveState();
  playSfx("select");
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

  // 【立ち上がらないバグの根本対策2026-07-29】opening.mp4は現状リポジトリに存在しない(将来追加予定)。
  // 存在しないsrcはSPAフォールバックで200+HTMLが返るため、ブラウザ/回線の状況によっては
  // onerrorがいつまでも発火せずreadyState=0のまま黒画面で止まる(「ゲームが立ち上がらない」の正体。
  // 立ち上がるかはエラー発火のタイミング運だった)。2秒待ってもデータが1バイトも来ていなければ
  // 動画なしでタイトルへ進む。将来本物の動画を追加した場合も、メタデータは通常2秒以内に届き
  // readyStateが1以上になるため誤発動しない(readyState 0=HAVE_NOTHINGの時だけ諦める)
  setTimeout(() => { if (video.readyState === 0) finish(false, true); }, 2000);
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
