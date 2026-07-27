// ============ ui.js: 画面横断で使う共通UI部品(背景プリロード・ヘッダー・ボタン配置・パーティバー・ログ表示・結果バナー等) ============
const BG_SETS = {
  town: { dawn: "assets/bg/town_dawn.jpg", asa: "assets/bg/town_asa.jpg", day: "assets/bg/town.jpg", dusk: "assets/bg/town_dusk.jpg", night: "assets/bg/town_night.jpg" },
  tavern: { dawn: "assets/bg/tavern_dawn.jpg", asa: "assets/bg/tavern_asa.jpg", day: "assets/bg/tavern.jpg", dusk: "assets/bg/tavern_dusk.jpg", night: "assets/bg/tavern_night.jpg" },
  dungeon: { dawn: "assets/bg/forest_dawn.jpg", asa: "assets/bg/forest_asa.jpg", day: "assets/bg/forest_day.jpg", dusk: "assets/bg/forest_dusk.jpg", night: "assets/bg/forest_night.jpg" },
  coast: { dawn: "assets/bg/coast_dawn.jpg", asa: "assets/bg/coast_asa.jpg", day: "assets/bg/coast_day.jpg", dusk: "assets/bg/coast_dusk.jpg", night: "assets/bg/coast_night.jpg" },
  onsen: { day: "assets/bg/onsen.jpg", night: "assets/bg/onsen_night.jpg" },
  departure: { dawn: "assets/bg/departure_gate_dawn.jpg", asa: "assets/bg/departure_gate_asa.jpg", day: "assets/bg/departure_gate.jpg", dusk: "assets/bg/departure_gate_dusk.jpg", night: "assets/bg/departure_gate_night.jpg" },
  teaHouse: { dawn: "assets/bg/teahouse_dawn.jpg", asa: "assets/bg/teahouse_asa.jpg", day: "assets/bg/teahouse_day.jpg", dusk: "assets/bg/teahouse_dusk.jpg", night: "assets/bg/teahouse_night.jpg" },
  // 洞窟の入口/出口だけ、森や海岸と同じく時間帯で絵が変わる(1層目=森との境目、行きは入口/帰りは出口を使う)
  caveEntrance: { dawn: "assets/bg/cave_entrance_dawn.jpg", asa: "assets/bg/cave_entrance_asa.jpg", day: "assets/bg/cave_entrance_day.jpg", dusk: "assets/bg/cave_entrance_dusk.jpg", night: "assets/bg/cave_entrance_night.jpg" },
  caveExit: { dawn: "assets/bg/cave_exit_dawn.jpg", asa: "assets/bg/cave_exit_asa.jpg", day: "assets/bg/cave_exit_day.jpg", dusk: "assets/bg/cave_exit_dusk.jpg", night: "assets/bg/cave_exit_night.jpg" },
  // 廃城下町/古城(2026-07-19、実際の生成イラストに差し替え済み)
  ruins: { dawn: "assets/bg/ruins_dawn.jpg", asa: "assets/bg/ruins_asa.jpg", day: "assets/bg/ruins_day.jpg", dusk: "assets/bg/ruins_dusk.jpg", night: "assets/bg/ruins_night.jpg" },
  castle: { dawn: "assets/bg/castle_dawn.jpg", asa: "assets/bg/castle_asa.jpg", day: "assets/bg/castle_day.jpg", dusk: "assets/bg/castle_dusk.jpg", night: "assets/bg/castle_night.jpg" },
  // 門はまだ専用の背景画像が無いため、暫定的に廃城下町の画像を流用(TODO: 門用の絵ができ次第差し替え)
  gate: { dawn: "assets/bg/ruins_dawn.jpg", asa: "assets/bg/ruins_asa.jpg", day: "assets/bg/ruins_day.jpg", dusk: "assets/bg/ruins_dusk.jpg", night: "assets/bg/ruins_night.jpg" },
  // 渓流/光る竹林(2026-07-19、下地の歩行テスト用)
  valley: { dawn: "assets/bg/valley_dawn.jpg", asa: "assets/bg/valley_asa.jpg", day: "assets/bg/valley_day.jpg", dusk: "assets/bg/valley_dusk.jpg", night: "assets/bg/valley_night.jpg" },
  bamboo: { dawn: "assets/bg/bamboo_dawn.jpg", asa: "assets/bg/bamboo_asa.jpg", day: "assets/bg/bamboo_day.jpg", dusk: "assets/bg/bamboo_dusk.jpg", night: "assets/bg/bamboo_night.jpg" },
  // 海の村(第二の町、2026-07-19)。本体/宿/温泉の3画面分
  umimura: { dawn: "assets/bg/umimura_dawn.jpg", asa: "assets/bg/umimura_asa.jpg", day: "assets/bg/umimura_day.jpg", dusk: "assets/bg/umimura_dusk.jpg", night: "assets/bg/umimura_night.jpg" },
  umiyado: { dawn: "assets/bg/umiyado_dawn.jpg", asa: "assets/bg/umiyado_asa.jpg", day: "assets/bg/umiyado_day.jpg", dusk: "assets/bg/umiyado_dusk.jpg", night: "assets/bg/umiyado_night.jpg" },
  umionsen: { dawn: "assets/bg/umionsen_dawn.jpg", asa: "assets/bg/umionsen_asa.jpg", day: "assets/bg/umionsen_day.jpg", dusk: "assets/bg/umionsen_dusk.jpg", night: "assets/bg/umionsen_night.jpg" },
  // 修験道/山(2026-07-19、下地の歩行テスト用)。山は前半/後半で背景セットが分かれる
  shugendo: { dawn: "assets/bg/shugendo_dawn.jpg", asa: "assets/bg/shugendo_asa.jpg", day: "assets/bg/shugendo_day.jpg", dusk: "assets/bg/shugendo_dusk.jpg", night: "assets/bg/shugendo_night.jpg" },
  yama: { dawn: "assets/bg/yama_dawn.jpg", asa: "assets/bg/yama_asa.jpg", day: "assets/bg/yama_day.jpg", dusk: "assets/bg/yama_dusk.jpg", night: "assets/bg/yama_night.jpg" },
  yama2: { dawn: "assets/bg/yama2_dawn.jpg", asa: "assets/bg/yama2_asa.jpg", day: "assets/bg/yama2_day.jpg", dusk: "assets/bg/yama2_dusk.jpg", night: "assets/bg/yama2_night.jpg" },
  // 山伏の里(渓流→光る竹林の先にある第三の村、2026-07-19)。本体/宿/温泉の3画面分(宿は2026-07-21追加)
  yamabushi: { dawn: "assets/bg/yamabushi_dawn.jpg", asa: "assets/bg/yamabushi_asa.jpg", day: "assets/bg/yamabushi_day.jpg", dusk: "assets/bg/yamabushi_dusk.jpg", night: "assets/bg/yamabushi_night.jpg" },
  yamabushiyado: { dawn: "assets/bg/yamabushiyado_dawn.jpg", asa: "assets/bg/yamabushiyado_asa.jpg", day: "assets/bg/yamabushiyado_day.jpg", dusk: "assets/bg/yamabushiyado_dusk.jpg", night: "assets/bg/yamabushiyado_night.jpg" },
  yamabushionsen: { dawn: "assets/bg/yamabushionsen_dawn.jpg", asa: "assets/bg/yamabushionsen_asa.jpg", day: "assets/bg/yamabushionsen_day.jpg", dusk: "assets/bg/yamabushionsen_dusk.jpg", night: "assets/bg/yamabushionsen_night.jpg" },
};
// 洞窟の奥(2〜7層=浅い層、8層以降=深い層)は地下のため時間帯で見た目が変わらず、1枚絵で固定
const CAVE_SHALLOW_BG_URL = "assets/bg/cave_shallow.jpg";
const CAVE_DEEP_BG_URL = "assets/bg/cave_deep.jpg";
const CAVE_CAMP_BG_URL = "assets/bg/cave_camp.jpg";
// 洞窟ステージ中の現在地(階層・進行方向)に応じて、森/海岸と同じ「時間帯キーで引けるセット」の形に組み立てる。
// 1層目(森との境目)だけ行き/帰りで絵を出し分け、それ以外は階層帯に応じた1枚絵を5つの時間帯キー全てに割り当てる
function caveBgSetForCurrentState() {
  if (currentFloor <= 1) return retreating ? BG_SETS.caveExit : BG_SETS.caveEntrance;
  const url = currentFloor <= 7 ? CAVE_SHALLOW_BG_URL : CAVE_DEEP_BG_URL;
  return { dawn: url, asa: url, day: url, dusk: url, night: url };
}
// 山ステージ中の現在地(階層)に応じて、前半(yama)/後半(yama2、YAMA_STAGE2_FLOOR以降)の
// 背景セットを出し分ける(洞窟の浅い層/深い層と同じ考え方)
function yamaBgSetForCurrentState() {
  return currentFloor >= YAMA_STAGE2_FLOOR ? BG_SETS.yama2 : BG_SETS.yama;
}
// 探索/戦闘の背景・野営背景は森/海岸/洞窟/廃城下町/門/古城/渓流/光る竹林/修験道/山のどのステージ中かで出し分ける
function currentAreaBgSet() {
  if (currentStage === "coast") return BG_SETS.coast;
  if (currentStage === "cave") return caveBgSetForCurrentState();
  // 少し森の1層目は洞窟を抜けた直後の場面のため、廃城下町/海の村どちらへ向かう場合も
  // 洞窟出口のイラストを使う(2層目以降は通常の森の絵に戻る)
  if (currentStage === "ruinsforest" && currentFloor <= 1) return BG_SETS.caveExit;
  if (currentStage === "ruins") return BG_SETS.ruins;
  if (currentStage === "gate") return BG_SETS.gate;
  if (currentStage === "castle") return BG_SETS.castle;
  if (currentStage === "valley") return BG_SETS.valley;
  if (currentStage === "bamboo") return BG_SETS.bamboo;
  if (currentStage === "shugendo") return BG_SETS.shugendo;
  if (currentStage === "yama") return yamaBgSetForCurrentState();
  return BG_SETS.dungeon;
}
function currentCampBgUrl() {
  if (currentStage === "coast") return "assets/bg/coast_camp.jpg";
  if (currentStage === "cave") return CAVE_CAMP_BG_URL;
  if (currentStage === "ruins") return "assets/bg/ruins_camp.jpg";
  if (currentStage === "castle") return "assets/bg/castle_camp.jpg";
  // 門はまだ専用の野営画像が無いため、暫定的に廃城下町の野営画像を流用
  if (currentStage === "gate") return "assets/bg/ruins_camp.jpg";
  if (currentStage === "valley") return "assets/bg/valley_camp.jpg";
  if (currentStage === "bamboo") return "assets/bg/bamboo_camp.jpg";
  if (currentStage === "shugendo") return "assets/bg/shugendo_camp.jpg";
  if (currentStage === "yama") return currentFloor >= YAMA_STAGE2_FLOOR ? "assets/bg/yama2_camp.jpg" : "assets/bg/yama_camp.jpg";
  return "assets/bg/camp_night.jpg";
}
// 宿泊演出(短時間で夕方/夜など複数の時間帯イラストを連続クロスフェードする)専用に、
// 宿屋の4枚だけを先読みしておく。反応速度優先のため、対象は宿泊演出に必要な最小限(4枚、以前は
// 町/森/温泉も含めた十数枚だった)に絞り、かつrequestIdleCallbackでブラウザが本当に暇な時だけ
// 読み込むようにして、ボタンSFXなど他の処理を一切邪魔しないようにしてある
function preloadTavernImages() {
  Object.values(BG_SETS.tavern).forEach((url) => { const img = new Image(); img.src = url; });
}
// 野営開始演出(森の現在時間帯→夜へのクロスフェード)で使う森の4枚も同様に先読みしておく。
// 未読み込みのままcrossfadeBgを呼ぶと、実機ではフェード中に画像取得が間に合わず、フェードに
// 見えず突然切り替わったように見えてしまうことがあったための対策
function preloadDungeonImages() {
  Object.values(BG_SETS.dungeon).forEach((url) => { const img = new Image(); img.src = url; });
  Object.values(BG_SETS.coast).forEach((url) => { const img = new Image(); img.src = url; });
  Object.values(BG_SETS.caveEntrance).forEach((url) => { const img = new Image(); img.src = url; });
  Object.values(BG_SETS.caveExit).forEach((url) => { const img = new Image(); img.src = url; });
  [CAVE_SHALLOW_BG_URL, CAVE_DEEP_BG_URL, CAVE_CAMP_BG_URL].forEach((url) => { const img = new Image(); img.src = url; });
  Object.values(BG_SETS.ruins).forEach((url) => { const img = new Image(); img.src = url; });
  Object.values(BG_SETS.castle).forEach((url) => { const img = new Image(); img.src = url; });
  Object.values(BG_SETS.valley).forEach((url) => { const img = new Image(); img.src = url; });
  Object.values(BG_SETS.bamboo).forEach((url) => { const img = new Image(); img.src = url; });
  Object.values(BG_SETS.shugendo).forEach((url) => { const img = new Image(); img.src = url; });
  Object.values(BG_SETS.yama).forEach((url) => { const img = new Image(); img.src = url; });
  Object.values(BG_SETS.yama2).forEach((url) => { const img = new Image(); img.src = url; });
}
// 鬼火の「魂のかけら」ドロップ演出(showTreasurePopup)は最大1.8秒しか表示されないため、
// 初回遭遇時に画像が未読み込みだと表示されないまま消えてしまう。他の先読みと同様、暇な時に読み込んでおく
function preloadDropIcons() {
  const img = new Image();
  img.src = "assets/items/soul_shard.png";
}
function scheduleIdlePreload(fn) {
  if (window.requestIdleCallback) requestIdleCallback(fn, { timeout: 5000 });
  else setTimeout(fn, 2000);
}
if (document.readyState === "complete") {
  scheduleIdlePreload(preloadTavernImages);
  scheduleIdlePreload(preloadDungeonImages);
  scheduleIdlePreload(preloadDropIcons);
} else {
  window.addEventListener("load", () => {
    scheduleIdlePreload(preloadTavernImages);
    scheduleIdlePreload(preloadDungeonImages);
    scheduleIdlePreload(preloadDropIcons);
  });
}
function dayLikeOf(tod) {
  return tod === "dawn" || tod === "asa" || tod === "day" ? "day" : "night";
}
// 戦闘背景の強制上書き(BG_SETSのセットを入れる。大規模戦テスト/将来の村襲撃用)。nullなら通常のステージ別背景
let battleBgOverrideSet = null;
function updateSceneBackgrounds() {
  const tod = state.timeOfDay || "day";
  const dayLike = dayLikeOf(tod);
  document.getElementById("townHero").style.backgroundImage = `url('${BG_SETS.town[tod]}')`;
  document.getElementById("tavernHero").style.backgroundImage = `url('${BG_SETS.tavern[tod]}')`;
  document.getElementById("statusHero").style.backgroundImage = `url('${BG_SETS.tavern[tod]}')`;
  document.getElementById("dungeonBgInner").style.backgroundImage = `url('${currentAreaBgSet()[tod]}')`;
  document.getElementById("battleBg").style.backgroundImage = `url('${(battleBgOverrideSet || currentAreaBgSet())[tod]}')`;
  // 帰還方向(温泉村へ向かっている)の時は背景を水平反転する。「進む/帰還」ボタンの表示ラベルではなく
  // 実際にretreatingかどうか(山伏の里/海の村からの「元来た道を歩いて戻る」中も含め、常に家へ
  // 向かっているかを表す)を見る(ユーザー指示、2026-07-21)
  const bgFlipped = typeof retreating !== "undefined" && !!retreating;
  document.getElementById("dungeonBg").classList.toggle("bg-flipped", bgFlipped);
  document.getElementById("battleBg").classList.toggle("bg-flipped", bgFlipped);
  document.getElementById("onsenHero").style.backgroundImage = `url('${BG_SETS.onsen[dayLike]}')`;
  document.getElementById("shopHero").style.backgroundImage = `url('${BG_SETS.town[tod]}')`;
  document.getElementById("partySelectHeroInner").style.backgroundImage = `url('${BG_SETS.departure[tod]}')`;
  document.getElementById("resultHero").style.backgroundImage = `url('${BG_SETS.town[tod]}')`;
  document.getElementById("extensionHero").style.backgroundImage = `url('${BG_SETS.town[tod]}')`;
  // 奉行所だけこの一覧から漏れており、専用の絵が無いため常に真っ黒(背景未設定)のまま表示されていた不具合を修正。
  // 他の「町の施設だが専用の絵が無い」画面(道具屋/増築/リザルト)と同じくtownの絵を流用する
  document.getElementById("magistrateHero").style.backgroundImage = `url('${BG_SETS.town[tod]}')`;
  document.getElementById("teaHouseHero").style.backgroundImage = `url('${BG_SETS.teaHouse[tod]}')`;
  // 海の村(第二の町、2026-07-19)。要素が存在しない場合(未実装ビルド等)にエラーにならないよう保険を掛ける
  const umimuraHero = document.getElementById("umimuraHero");
  if (umimuraHero) umimuraHero.style.backgroundImage = `url('${BG_SETS.umimura[tod]}')`;
  const umiyadoHero = document.getElementById("umiyadoHero");
  if (umiyadoHero) umiyadoHero.style.backgroundImage = `url('${BG_SETS.umiyado[tod]}')`;
  const umionsenHero = document.getElementById("umionsenHero");
  if (umionsenHero) umionsenHero.style.backgroundImage = `url('${BG_SETS.umionsen[tod]}')`;
  // 山伏の里(第三の村、2026-07-19。宿は2026-07-21追加)
  const yamabushiHero = document.getElementById("yamabushiHero");
  if (yamabushiHero) yamabushiHero.style.backgroundImage = `url('${BG_SETS.yamabushi[tod]}')`;
  const yamabushiyadoHero = document.getElementById("yamabushiyadoHero");
  if (yamabushiyadoHero) yamabushiyadoHero.style.backgroundImage = `url('${BG_SETS.yamabushiyado[tod]}')`;
  const yamabushionsenHero = document.getElementById("yamabushionsenHero");
  if (yamabushionsenHero) yamabushionsenHero.style.backgroundImage = `url('${BG_SETS.yamabushionsen[tod]}')`;
}
let lastTouchEndAt = 0;
let lastTouchEndTarget = null;
// 一度150ms→400msに広げたことがあったが、「進む」やコマンドボタンを連打してテンポよく進めたい
// 場面(このゲームの主要な操作感)で正当な連打まで巻き込んで潰してしまい、ゲームが著しく
// プレイしづらくなるという強い指摘を受けて150msに戻した。ズームのすり抜けよりも、
// 意図した連打が効かないストレスの方が実害が大きいと判断
const DOUBLE_TAP_ZOOM_WINDOW_MS = 150;
// 窓の広さに関わらず踏む地雷: touchendはタップだけでなく「スクロール/スワイプの指離し」でも
// 発火する。スクロールで下の方の要素(茶屋のお茶菓子ボタン等、画面下部にあるほど起きやすい)を
// 表示させて指を離した瞬間のtouchendがその要素を「1回目のタップ」として記録してしまい、直後に
// 本当にタップした2回目(=最初の実質的なタップ)が窓内・同じ要素だと誤ってpreventDefaultされ、
// ボタンがまるで無反応であるかのように見える不具合があった。touchstartの座標と比較し、
// 一定距離以上動いていたら(=スクロール/スワイプ)タップとして扱わず、lastTouchEndTarget/Atも
// 更新しない(次の本当のタップの判定を汚染しないようにする)
let touchStartX = 0, touchStartY = 0;
const TAP_MOVE_THRESHOLD_PX = 10;
document.addEventListener("touchstart", (e) => {
  const t = e.touches && e.touches[0];
  if (t) { touchStartX = t.clientX; touchStartY = t.clientY; }
}, { passive: true });
// 探索パートだけでズームが再発していた原因: 「進む」を押すと歩き演出→暗転→フェードインの間
// (playDungeonMoveTransition、合計で通常時1.5〜2秒前後)advanceBtn/retreatBtnがdisabledになるが、
// この間は見た目の反応が無いため焦った利用者が同じボタンを何度も連打しがちで、その間隔は
// 150msの窓より大きいことがほとんどだった(戦闘のコマンド確定待ちは0.5秒と短く、この状況が起きにくい)。
// disabled中のボタンはそもそも絶対にclickが発火しない(=連打を許しても失われる正規の操作が無い)ため、
// disabled要素への連打だけは窓を大きく取っても安全。それ以外(通常の連打でテンポよく進めたい操作)は
// 150msのまま変えない
const DISABLED_ELEMENT_ZOOM_WINDOW_MS = 3000;
document.addEventListener("touchend", (e) => {
  const t = e.changedTouches && e.changedTouches[0];
  const moved = t ? Math.hypot(t.clientX - touchStartX, t.clientY - touchStartY) : 0;
  if (moved >= TAP_MOVE_THRESHOLD_PX) return; // スクロール/スワイプの指離しはタップ扱いしない
  const now = Date.now();
  const windowMs = (e.target && e.target.disabled) ? DISABLED_ELEMENT_ZOOM_WINDOW_MS : DOUBLE_TAP_ZOOM_WINDOW_MS;
  if (e.target === lastTouchEndTarget && now - lastTouchEndAt <= windowMs) e.preventDefault();
  lastTouchEndAt = now;
  lastTouchEndTarget = e.target;
}, { passive: false });
// ============ 画面切り替え ============
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

const DW_HEADER_BACK_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 5 8l5 5"/></svg>';
// 戦闘・探索を除く全画面共通のヘッダー(戻る/タイトル/所持金/時刻)を1箇所にまとめて描画する。
// 各画面のrender関数の先頭で呼ぶだけで、位置・見た目が自動的に統一される
function renderDwHeader(prefix, title, onBack) {
  const backBtn = document.getElementById(prefix + "HeaderBack");
  const titleEl = document.getElementById(prefix + "HeaderTitle");
  const goldEl = document.getElementById(prefix + "HeaderGold");
  const timeEl = document.getElementById(prefix + "HeaderTime");
  if (!backBtn || !titleEl) return; // ヘッダーを持たない画面(戦闘/探索等)から誤って呼ばれても無害にする
  backBtn.innerHTML = DW_HEADER_BACK_ICON;
  backBtn.onclick = onBack;
  titleEl.textContent = title;
  if (goldEl) goldEl.textContent = `${state.gold}G`;
  if (timeEl) timeEl.textContent = `${TIME_PHASE_LABEL[state.timeOfDay || "day"]} ${formatClockTime(state.clockMinutes)}`;
}

function statusLabel(c) {
  if (c.status === "active") {
    const base = `Lv.${c.level} ${CLASSES[c.classId].ja}`;
    if (stressTier(c.fatigue) >= 4) return `${base}(発狂中)`;
    return base;
  }
  return statusLabelNonActive(c);
}
// 出発準備(パーティ編成)・宿屋の名簿用: 職業名の代わりに性格を表示する(ユーザー指示2026-07-18
// 「レベルの横に職業書かなくていいから性格書いといて」)。職業は詳細画面で確認できる。
// active以外(ロスト)の表示はstatusLabelと共通
function statusLabelPersonality(c) {
  if (c.status === "active") {
    const base = `Lv.${c.level} ${c.personality || CLASSES[c.classId].ja}`;
    if (stressTier(c.fatigue) >= 4) return `${base}(発狂中)`;
    return base;
  }
  return statusLabelNonActive(c);
}
// レベルメダル+性格の行(ユーザー提供の漢数字メダルassets/icons/level_1..10.png)。
// 出発準備/宿屋の名簿で「Lv.◯ 性格」の文字表記の代わりに使う(C改レイアウト:
// 名前→メダル+性格→HP/MPバーの順)。active以外(ロスト)はメダルを出さず状態文のみ
function rosterSubWithLevelBadge(c) {
  if (c.status !== "active") return statusLabelNonActive(c);
  const frenzy = stressTier(c.fatigue) >= 4 ? "(発狂中)" : "";
  const lv = Math.min(10, Math.max(1, c.level || 1));
  return `<img class="lv-badge" src="assets/icons/level_${lv}.png" alt="Lv.${c.level}">${c.personality || CLASSES[c.classId].ja}${frenzy}`;
}
function statusLabelNonActive(c) {
  return "ロスト(消滅した)";
}

// 温泉の入浴名簿を描画する共通処理。温泉村/海の村/山伏の里(および今後増える村)で全て同じ仕様に
// するため一本化してある(ユーザー指示、2026-07-21: 中継の村を簡易版のままにせず温泉村と同等にする)。
// charactersは対象キャラ配列(温泉村は町に置いている状態のstate.roster全員、海の村/山伏の里は
// 遠征中で物理的にそこにいるfieldPartyのみ)。入浴は即座に疲労を減らさず、useOnsen()で翌朝まで
// ロック+次の遠征限定バフを付与するだけ(実際の疲労軽減と「リラックスできた！」演出は、次に
// いずれかの村のホーム画面に戻った時にcheckOnsenReliefPopups()側で行われる)
function renderOnsenRosterList(containerId, characters) {
  const list = document.getElementById(containerId);
  list.innerHTML = "";
  const bathable = characters.filter((c) => c.status === "active");
  if (bathable.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">入浴できる仲間がいません。</p>';
    return;
  }
  const now = absoluteGameMinutes();
  bathable.forEach((c) => {
    const c2 = CLASSES[c.classId];
    const cost = onsenCost(c.level);
    const noFatigue = (c.fatigue || 0) <= 0;
    const locked = isOnsenLocked(c, now);
    const disabled = locked || noFatigue || state.gold < cost;
    let label = `入る(${cost}G)`;
    if (locked) label = "入浴中";
    else if (noFatigue) label = "ストレスなし";
    const row = document.createElement("div");
    row.className = "roster-row";
    row.innerHTML = `
      <img src="${characterPortraitSrc(c)}">
      <div class="roster-info">
        <div class="roster-name">${c.name} <span class="status-tag ${locked ? "bathing" : "active"}">Lv.${c.level} ${c2.ja}</span></div>
        <div class="roster-sub">ストレス ${Math.round(c.fatigue || 0)}</div>
        <div class="fatigue-track" style="margin-top:0.25rem;"><div class="fatigue-fill" style="width:${Math.round(c.fatigue || 0)}%"></div></div>
      </div>
      <button class="big" ${disabled ? "disabled" : ""}>${label}</button>
    `;
    row.querySelector("button").onclick = () => {
      if (isOnsenLocked(c, absoluteGameMinutes())) return; // 二重タップ等での再ロック上書きを保険として防ぐ
      state.gold -= cost;
      useOnsen(c, absoluteGameMinutes());
      saveState();
      playSfx("onsen");
      renderOnsenRosterList(containerId, characters);
    };
    list.appendChild(row);
  });
}

// 支援物資(回復薬/煙玉/野営具)購入UIの共通処理。温泉村の出発準備画面(パーティ編成タブ内、
// prefix "supplies")と、海の村/山伏の里(および今後増える村)共通の支度画面(prefix "vprep")の
// 両方で使う(ユーザー指示、2026-07-21: 中継の村を簡易版のままにせず温泉村と同等にする)。
// 2画面はDOM要素のidが異なるだけで中身(所持数・価格・上限・売却)は完全に同一の仕様
const SUPPLY_UI_IDS = {
  supplies: {
    count: "suppliesCount", capLabel: "suppliesCapLabel", gold: "suppliesGold",
    eggPouchInfo: "henHouseEggPouchInfo", eggPouchCount: "henHouseEggPouchCountLabel", eggPouchCap: "henHouseEggPouchCapLabel",
    ownedIcons: "ownedSupplyIcons",
    potionOwned: "potionOwned", buyPotionBtn: "buyPotionSupplyBtn",
    smokeBombOwned: "smokeBombOwned", buySmokeBombBtn: "buySmokeBombBtn",
    campingKitSection: "campingKitSection", campingKitCap: "campingKitCapLabel", campingKitOwned: "campingKitOwned", campingKitNewBadge: "campingKitNewBadge", buyCampingKitBtn: "buyCampingKitBtn",
    bombSection: "bombSection", buyBombBtn: "buyBombBtn",
  },
  vprep: {
    count: "vprepCount", capLabel: "vprepCapLabel", gold: "vprepGold",
    eggPouchInfo: "vprepEggPouchInfo", eggPouchCount: "vprepEggPouchCountLabel", eggPouchCap: "vprepEggPouchCapLabel",
    ownedIcons: "vprepOwnedSupplyIcons",
    potionOwned: "vprepPotionOwned", buyPotionBtn: "vprepBuyPotionBtn",
    smokeBombOwned: "vprepSmokeBombOwned", buySmokeBombBtn: "vprepBuySmokeBombBtn",
    campingKitSection: "vprepCampingKitSection", campingKitCap: "vprepCampingKitCapLabel", campingKitOwned: "vprepCampingKitOwned", campingKitNewBadge: "vprepCampingKitNewBadge", buyCampingKitBtn: "vprepBuyCampingKitBtn",
    bombSection: "vprepBombSection", buyBombBtn: "vprepBuyBombBtn",
  },
};
function renderSupplyPurchaseUI(prefix) {
  const ids = SUPPLY_UI_IDS[prefix];
  const total = supplyItemTotal();
  document.getElementById(ids.gold).textContent = state.gold + "G";
  document.getElementById(ids.count).textContent = `(${total}/${supplyCap()})`;
  document.getElementById(ids.capLabel).textContent = supplyCap();
  // 鶏小屋の卵ポーチ: 支援物資の上限には含まれない別枠のため、混同されないよう専用の1行で
  // 小さく表示する(鶏小屋未建築の間は行ごと非表示)
  const eggPouchInfo = document.getElementById(ids.eggPouchInfo);
  const eggPouchCap = henHouseEggPouchCapacity();
  eggPouchInfo.style.display = eggPouchCap > 0 ? "" : "none";
  if (eggPouchCap > 0) {
    document.getElementById(ids.eggPouchCount).textContent = state.inventory.onsenEggPouch || 0;
    document.getElementById(ids.eggPouchCap).textContent = eggPouchCap;
  }
  document.getElementById(ids.potionOwned).textContent = state.inventory.potion || 0;
  document.getElementById(ids.smokeBombOwned).textContent = state.inventory.smokeBomb || 0;
  document.getElementById(ids.buyPotionBtn).textContent = `購入(${ITEMS.potion.price}G)`;
  document.getElementById(ids.buyPotionBtn).disabled = total >= supplyCap() || state.gold < ITEMS.potion.price;
  document.getElementById(ids.buySmokeBombBtn).textContent = `購入(${ITEMS.smokeBomb.price}G)`;
  document.getElementById(ids.buySmokeBombBtn).disabled = total >= supplyCap() || state.gold < ITEMS.smokeBomb.price;
  // 野営具は旅支度屋を建築するまでラインナップされない
  document.getElementById(ids.campingKitSection).style.display = state.travelPrepShopLevel ? "" : "none";
  if (state.travelPrepShopLevel) {
    document.getElementById(ids.campingKitCap).textContent = CAMPING_KIT_CAP;
    document.getElementById(ids.campingKitOwned).textContent = state.inventory.campingKit || 0;
    document.getElementById(ids.buyCampingKitBtn).textContent = `購入(${ITEMS.campingKit.price}G)`;
    document.getElementById(ids.buyCampingKitBtn).disabled = (state.inventory.campingKit || 0) >= CAMPING_KIT_CAP || state.gold < ITEMS.campingKit.price;
    document.getElementById(ids.campingKitNewBadge).style.display = !state.seenCampingKitSupply ? "" : "none";
    if (!state.seenCampingKitSupply) { state.seenCampingKitSupply = true; saveState(); }
  }
  // 爆弾の購入効果はユーザー指示により廃止した(火薬庫は砲術士解禁のみの建物になった)。
  // 既存セーブで爆弾を所持している場合に備え、購入UI自体は常に非表示にするだけで
  // inventory.bomb自体やバトル中の使用(items.js)には手を付けていない
  document.getElementById(ids.bombSection).style.display = "none";
  renderOwnedSupplyIcons(prefix);
}
// 所持中の支援物資を、野営具→回復薬→煙玉→温泉卵の順で1個ずつ小さいアイコンとして並べる
// (背景画像の上に直接表示するため、個数分そのままアイコンを並べる方式にしてある)。
// タップすると1個売却できる(売値は購入価格の半額、端数切り捨て)
function renderOwnedSupplyIcons(prefix) {
  const ids = SUPPLY_UI_IDS[prefix];
  const wrap = document.getElementById(ids.ownedIcons);
  let html = "";
  // image(画像)が用意されているものはimg、無いもの(絵文字のみ、爆弾など)はemojiをそのまま文字表示する
  const addIcons = (itemId, count) => {
    const item = ITEMS[itemId];
    for (let i = 0; i < count; i++) {
      html += item.image
        ? `<img src="${item.image}" alt="${item.ja}" data-item-id="${itemId}">`
        : `<span class="supply-icon-emoji" title="${item.ja}" data-item-id="${itemId}">${item.emoji || ""}</span>`;
    }
  };
  addIcons("campingKit", state.inventory.campingKit || 0);
  addIcons("potion", state.inventory.potion || 0);
  addIcons("smokeBomb", state.inventory.smokeBomb || 0);
  addIcons("onsenEgg", state.inventory.onsenEgg || 0);
  addIcons("bomb", state.inventory.bomb || 0);
  TEAHOUSE_SNACK_IDS.forEach((id) => addIcons(id, state.inventory[id] || 0));
  wrap.innerHTML = html;
  wrap.querySelectorAll("[data-item-id]").forEach((el) => {
    el.onclick = () => confirmSellSupplyItem(el.dataset.itemId, prefix);
  });
}
function confirmSellSupplyItem(itemId, prefix) {
  const item = ITEMS[itemId];
  const sellPrice = Math.floor(item.price / 2);
  showConfirmModal(`${item.ja}を${sellPrice}Gで売りますか？`, [
    {
      label: "売る", className: "big primary", onClick: () => {
        if ((state.inventory[itemId] || 0) <= 0) return;
        state.inventory[itemId]--;
        state.gold += sellPrice;
        saveState();
        playSfx("coin");
        renderSupplyPurchaseUI(prefix);
      },
    },
    { label: "やめる", className: "big" },
  ]);
}
// 支援物資の購入ボタン群を、指定したprefixのDOM要素に一度だけ配線する(温泉村側/vprep側の2回呼ぶ)
function wireSupplyPurchaseButtons(prefix) {
  const ids = SUPPLY_UI_IDS[prefix];
  document.getElementById(ids.buyPotionBtn).onclick = () => {
    const total = supplyItemTotal();
    if (total >= supplyCap()) { showInfoModal(`支援物資は最大${supplyCap()}個までしか持てません`); return; }
    if (state.gold < ITEMS.potion.price) { showInfoModal("お金が足りません"); return; }
    state.gold -= ITEMS.potion.price;
    state.inventory.potion = (state.inventory.potion || 0) + 1;
    saveState();
    playSfx("coin");
    renderSupplyPurchaseUI(prefix);
  };
  document.getElementById(ids.buySmokeBombBtn).onclick = () => {
    const total = supplyItemTotal();
    if (total >= supplyCap()) { showInfoModal(`支援物資は最大${supplyCap()}個までしか持てません`); return; }
    if (state.gold < ITEMS.smokeBomb.price) { showInfoModal("お金が足りません"); return; }
    state.gold -= ITEMS.smokeBomb.price;
    state.inventory.smokeBomb = (state.inventory.smokeBomb || 0) + 1;
    saveState();
    playSfx("coin");
    renderSupplyPurchaseUI(prefix);
  };
  document.getElementById(ids.buyCampingKitBtn).onclick = () => {
    if ((state.inventory.campingKit || 0) >= CAMPING_KIT_CAP) { showInfoModal(`野営具は最大${CAMPING_KIT_CAP}個までしか持てません`); return; }
    if (state.gold < ITEMS.campingKit.price) { showInfoModal("お金が足りません"); return; }
    state.gold -= ITEMS.campingKit.price;
    state.inventory.campingKit = (state.inventory.campingKit || 0) + 1;
    saveState();
    playSfx("coin");
    renderSupplyPurchaseUI(prefix);
  };
  document.getElementById(ids.buyBombBtn).onclick = () => {
    const total = supplyItemTotal();
    if (total >= supplyCap()) { showInfoModal(`支援物資は最大${supplyCap()}個までしか持てません`); return; }
    if (state.gold < ITEMS.bomb.price) { showInfoModal("お金が足りません"); return; }
    state.gold -= ITEMS.bomb.price;
    state.inventory.bomb = (state.inventory.bomb || 0) + 1;
    saveState();
    playSfx("coin");
    renderSupplyPurchaseUI(prefix);
  };
}
wireSupplyPurchaseButtons("supplies");
wireSupplyPurchaseButtons("vprep");
// 中継の村(海の村/山伏の里、今後増える村も含む)共通の支度画面。facilityHomeScreen(town.js)に
// 開く直前の村を記録しておき、戻るボタンは renderFacilityHome() でその村へ戻す(奉行所/建築/
// 鍛冶屋と同じ「戻り先を動的に覚える」パターンを流用)
// destinations: [{label, primary(省略可), onClick}] 温泉村の出発準備画面(screen-party-select、
// 支援物資+出発ボタンが1画面にまとまっている)と同じ体験にするため、支度単独の画面にはせず
// 「出発」ボタンを押した先でそのまま行き先も選べるようにしてある(ユーザー指示、2026-07-21)。
// 鍛冶屋チップから開いた後に戻ってくる時など、destinations省略で呼ばれても直前の内容を
// 保ったまま再描画できるよう、最後に渡された配列をvillagePrepDestinationsに覚えておく
let villagePrepDestinations = [];
function renderVillagePrep(destinations) {
  if (destinations) villagePrepDestinations = destinations;
  renderDwHeader("villagePrep", "出発", () => { renderFacilityHome(); });
  renderSupplyPurchaseUI("vprep");
  // 鍛冶屋は温泉村と同じく村トップではなくここ(出発準備画面)のチップから開く
  document.getElementById("vprepShopBtn").style.display = state.shopLevel ? "" : "none";
  const wrap = document.getElementById("vprepDepartButtons");
  wrap.innerHTML = "";
  villagePrepDestinations.forEach((d, i) => {
    const btn = document.createElement("button");
    btn.className = "big depart-btn" + (d.primary !== false && i === 0 ? " primary" : " depart-coast");
    btn.style.width = "100%";
    if (i > 0) btn.style.marginTop = "0.5rem";
    btn.textContent = d.label;
    btn.onclick = d.onClick;
    wrap.appendChild(btn);
  });
}
document.getElementById("vprepShopBtn").onclick = () => { playSfx("select"); facilityHomeScreen = "screen-village-prep"; renderShop(); showScreen("screen-shop"); };
document.getElementById("villagePrepBackBtn").onclick = () => { renderFacilityHome(); };
document.getElementById("villagePrepBackBtnTop").onclick = () => { renderFacilityHome(); };

function statusTagClass(c) {
  if (c.status === "active" && isOnsenLocked(c, absoluteGameMinutes())) return "bathing";
  if (c.status === "active" && c.onsenBuffKey) return "onsen-buffed";
  return c.status;
}

// 名簿の全員が稼働不能(ロスト)になり、かつ新しく雇う手段も残っていなければ、もう手詰まりなのでゲームオーバーにする。
// 「新しく雇う手段」は所持金(HIRE_COST以上)だけでなく名簿の空き枠(rosterCapacity()、固定8人)も両方必要。
// 名簿が8人とも稼働不能になった時点で所持金がいくらあっても新規雇用の枠自体が無く実質詰みになる
// (旧実装は所持金しか見ておらずこのケースを見逃していた)。
// ロストしたキャラは名簿から完全に削除される(removeFromRoster)ため、全滅した末に名簿が0人に
// なるケースもここを通る。roster.length===0は[].every()が常にtrueを返す(空配列は「全員非activeで
// ある」を満たす)ため特別扱いは不要で、canStillHireの判定だけで「新規に1人目を雇えるなら詰みではない」
// を正しく表現できる(ゲーム開始直後は所持金50・HIRE_COST20なので誤検出しない)
// trueを返した場合、呼び出し元(renderTown)は通常の町画面表示を打ち切ってゲームオーバー画面に切り替える
function checkGameOver() {
  const noActive = state.roster.every((c) => c.status !== "active");
  if (!noActive) return false;
  const canStillHire = state.gold >= HIRE_COST && state.roster.length < rosterCapacity();
  if (canStillHire) return false;
  showScreen("screen-gameover");
  return true;
}

// 町・宿屋・鍛冶屋・温泉・増築・パーティ編成など「町エリア」の全画面で共通して使う、
// 時間帯に応じた町BGMの選択。宿泊で寝ている間にtimeOfDayが変わった場合など、画面遷移のたびに
// 呼び直すことで常に今の時間帯に合ったBGMになる(呼ばなかった画面だけ古いBGMが鳴り続けるバグの対策)
function playTownAreaBgm() {
  playBgm(state.timeOfDay === "dawn" ? "town_dawn" : state.timeOfDay === "night" ? "town_night" : "town");
}

// 冒険から町に帰る直前に挟むリザルト画面: 今回の冒険で稼いだゴールドと、キャラごとに得た経験値を
// バー(今回の冒険より前からの分+今回新たに得た分を強調表示)で見せる。「町に戻る」を押すまでは
// 実際の町への遷移(onContinue)は行わない
// 勝利/敗北の告知バナー。同じオーバーレイ要素を使い回すが、victory/defeatでクラスを丸ごと
// 差し替えることで背景・文字色・尺・SEを完全に分離する(ユーザー指定: 演出を勝敗で共有しない)。
// 「ヒットストップ」は本物のゲームロジック停止ではなく、既存の会心演出と同じく
// アニメーション自体の「間」(0%→35%で待たせてから弾ませる)で表現している
// 帰還成功時のバナー(旧「勝利」表記)。以前は550ms後に自動で消えていたが、
// ユーザー指示で画面タップを待ってから町へ進むように変更した
function playVictoryBanner(onDone) {
  const overlay = document.getElementById("resultBannerOverlay");
  const text = document.getElementById("resultBannerText");
  overlay.className = "result-banner-overlay victory";
  text.className = "result-banner-text victory";
  text.textContent = "帰還成功";
  // 金の粒子(✦✧)を文字の周囲にランダムに舞わせる(2026-07-26、商業作品風の演出強化)。
  // タップで先へ進んだ時に必ず削除する(次回の敗北バナーで使い回される入れ物のため)
  const PARTICLE_COUNT = 12;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = document.createElement("span");
    p.className = "result-banner-particle";
    p.textContent = Math.random() < 0.5 ? "✦" : "✧";
    p.style.left = `${10 + Math.random() * 80}%`;
    p.style.top = `${30 + Math.random() * 40}%`;
    p.style.fontSize = `${9 + Math.random() * 9}px`;
    p.style.animationDelay = `${Math.random() * 2.2}s`;
    overlay.appendChild(p);
  }
  overlay.style.display = "flex";
  overlay.style.pointerEvents = "auto"; // 通常は演出のみでタップを透過させるが、ここだけタップで進めるようにする
  playSfx("victory");
  const proceed = () => {
    overlay.removeEventListener("click", proceed);
    overlay.style.display = "none";
    overlay.style.pointerEvents = "none";
    overlay.querySelectorAll(".result-banner-particle").forEach((el) => el.remove());
    onDone();
  };
  // pointerdownではなくclickで進める(スキル習得の「タップして進む」と同じゴーストクリック対策:
  // pointerdownで閉じると、指を離した時のclickが下に出たリザルト画面へ着弾してしまう)
  overlay.addEventListener("click", proceed);
}
// ============ 村到着シークエンス(帰還完了、1→0層の特別演出。2026-07-26) ============
// いつもの黒い暗転ではなく白くふわっと明転し(「森を抜けた」開放感)、村の実際の背景(現在の
// 時間帯の湯乃里)がゆっくりズームで映り、鐘の音+仲間の一言吹き出しの後に「帰還成功」バナーが
// 重なる。バナーのタップでリザルト画面へ進む(呼び出し元はdungeon.js finishRetreat)
const HOMECOMING_LINES = [
  "「ふう…やっと帰ってきたね」",
  "「里の灯りが見えると、ほっとするなあ」",
  "「今日も全員でただいま、っと」",
  "「あー疲れた!温泉入ろ、温泉!」",
  "「無事に帰れたことに感謝、だね」",
];
function playHomecomingSequence(onDone) {
  const white = document.getElementById("homecomingWhite");
  const overlay = document.getElementById("homecomingOverlay");
  const bgEl = document.getElementById("homecomingBg");
  const speech = document.getElementById("homecomingSpeech");
  const tod = state.timeOfDay || "day";
  bgEl.style.backgroundImage = `url('${BG_SETS.town[tod] || BG_SETS.town.day}')`;
  white.style.display = "block";
  fadeOpacity(white, 0, 1, 700, () => {
    overlay.style.display = "block";
    speech.style.opacity = "0";
    const zoom = bgEl.animate([{ transform: "scale(1.08)" }, { transform: "scale(1)" }], { duration: 6000, easing: "ease-out", fill: "forwards" });
    playSfx("morning_chime"); // 里の鐘(手持ちのチャイムSEを流用。合わなければ差し替え)
    fadeOpacity(white, 1, 0, 900, () => { white.style.display = "none"; });
    // 生き残った仲間の誰かが一言(発言者名+固定数種からランダム)
    const alive = fieldParty.filter((c) => c.status === "active" && c.hp > 0 && !c.isShikigami);
    const speaker = alive.length > 0 ? alive[Math.floor(Math.random() * alive.length)] : null;
    if (speaker) {
      // 発言者のイラスト付き(ユーザー指示2026-07-26)。characterPortraitSrc()はストレス段階に応じた
      // 立ち絵(平常/軽度/重度/発狂)を返すため、疲れて帰ってきた顔がそのまま出る
      speech.innerHTML = `
        <img class="homecoming-speaker-img" src="${characterPortraitSrc(speaker)}">
        <span class="homecoming-speech-text"><span class="homecoming-speaker">${speaker.name}</span>${HOMECOMING_LINES[Math.floor(Math.random() * HOMECOMING_LINES.length)]}</span>`;
      setTimeout(() => fadeOpacity(speech, 0, 1, 500), 700);
    }
    setTimeout(() => {
      playVictoryBanner(() => {
        overlay.style.display = "none";
        zoom.cancel();
        bgEl.style.transform = "";
        onDone();
      });
    }, 2100);
  });
}
function playDefeatBanner(onDone) {
  const overlay = document.getElementById("resultBannerOverlay");
  const text = document.getElementById("resultBannerText");
  overlay.className = "result-banner-overlay defeat";
  text.className = "result-banner-text defeat";
  text.textContent = "全滅…";
  overlay.style.display = "flex";
  // 敗北専用の効果音は用意されていないため、あえて無音のまま暗転させる
  // (勝利の賑やかなSEを流用すると「SEを勝敗で完全に分ける」という指定に反するため)
  setTimeout(() => {
    overlay.style.display = "none";
    onDone();
  }, 2300);
}
// isDefeat=trueの時は「冒険の記録」を敗北専用の見せ方に切り替える(タイトル文言・金色の
// 祝祭色を外す・依頼達成カードを出さない・BGM代わりのresult SEを鳴らさない)。
// 経験値/ゴールド/戦利品は一気に出さず、result-fade/.result-xp-rowのreveal-inクラスを
// 時間差で付けていくことで順番に浮かび上がらせる
function renderResultScreen(onContinue, isDefeat) {
  const screenEl = document.getElementById("screen-result");
  screenEl.classList.toggle("is-defeat", !!isDefeat);
  document.getElementById("resultHeroTitle").textContent = isDefeat ? "撤退の記録" : "冒険の記録";
  renderDwHeader("result", isDefeat ? "撤退の記録" : "冒険の記録", onContinue);
  const continueBtn = document.getElementById("resultContinueBtn");
  continueBtn.className = isDefeat ? "big" : "big primary";

  const questCard = document.getElementById("resultQuestCard");
  if (!isDefeat && advQuestCompleted) {
    questCard.style.display = "";
    questCard.innerHTML = `
      <div class="roster-name">🏯依頼達成: ${advQuestCompleted.title}</div>
      <p style="font-size:0.85rem;margin-top:0.3rem;">報酬: ${advQuestCompleted.gold}G${advQuestCompleted.xp > 0 ? ` + XP${advQuestCompleted.xp}` : ""}</p>
    `;
  } else {
    questCard.style.display = "none";
  }
  questCard.classList.remove("reveal-in");
  const goldEl = document.getElementById("resultGold");
  goldEl.classList.remove("reveal-in");
  // 戦績行(踏破/討伐/全員生還)。カウンタはdungeon.js/battle.jsが遠征中に集計している
  const statsEl = document.getElementById("resultStatsLine");
  statsEl.classList.remove("reveal-in");
  // 「全員生還！」は今回の遠征中に誰もロストしていない(advLostHappened)ことに加えて、帰還時点の
  // 顔ぶれに離脱者がいないことも確認する(遠征の途中でこの集計機能が入ってフラグが立っていない
  // 場合でも「全員無事」と言い張らないように。ユーザー報告2026-07-26)
  const anyNotActive = fieldParty.some((c) => !c.isShikigami && (c.status !== "active" || c.hp <= 0));
  const allAlive = !isDefeat && !advLostHappened && !anyNotActive;
  statsEl.innerHTML = `踏破 ${advMaxFloor || 0}層 ・ 討伐 ${advEnemiesDefeated || 0}体${allAlive ? ' ・ <span class="result-all-alive">全員生還！</span>' : ""}`;
  const stampEl = document.getElementById("resultRankStamp");
  stampEl.classList.remove("stamp-in");
  stampEl.style.display = "none";
  // 素材アイコン行(2026-07-27): 今回の冒険で拾った素材を、文字なしで取れた個数ぶん
  // アイコン実物を左から並べて見せる(ユーザーのマルアップ準拠)。魂の塊はレア枠として
  // 末尾に金の光をまとって並ぶ。勝利時は1個ずつポンポンと積む演出(下の時間差リビール参照)、
  // 敗北(撤退)時は祝祭演出を付けず最初から静止表示
  const matRowEl = document.getElementById("resultMatRow");
  matRowEl.innerHTML = "";
  const matIcons = [];
  MATERIAL_ORDER.forEach((id) => {
    for (let i = 0; i < (advMaterialGains[id] || 0); i++) matIcons.push({ src: MATERIALS[id].icon, rare: false });
  });
  // レア枠は末尾にまとめる(かけら→塊の順=レア度の低い順)
  for (let i = 0; i < advSoulShardGained; i++) matIcons.push({ src: "assets/items/soul_shard.png", rare: true });
  for (let i = 0; i < advSoulLumpGained; i++) matIcons.push({ src: "assets/items/soul_lump.png", rare: true });
  matIcons.forEach((m) => {
    const img = document.createElement("img");
    img.className = "result-mat-item" + (m.rare ? " rare" : "");
    img.src = m.src;
    if (!isDefeat) img.style.opacity = "0"; // 勝利時は時間差の演出側で1個ずつ出す
    matRowEl.appendChild(img);
  });
  const list = document.getElementById("resultXpList");
  list.innerHTML = "";
  // 経験値リストは実際に遠征へ出たメンバーだけを出す(ユーザー指示2026-07-26: 道場の分け前を
  // もらっただけの留守番組はリザルトに並べない。分け前の経験値自体はこれまで通り入っている)
  const wasOnExpedition = (c) => fieldParty.some((f) => f.id === c.id) || (reserveFieldMember && reserveFieldMember.id === c.id);
  const participants = state.roster.filter((c) => (advXpGained[c.id] || 0) > 0 && wasOnExpedition(c));
  if (participants.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">今回は経験値を得られなかった。</p>';
  }
  // 1画面完結(スクロール不要)のため、旅団旗の5人編成で行が増えた時は2列で畳む
  list.classList.toggle("result-xp-grid-2", participants.length > 4);
  const animQueue = []; // 勝利時のバー演出({row, segs})。画面が出てから順次再生する
  participants.forEach((c) => {
    const gained = advXpGained[c.id] || 0;
    const isMax = c.level >= MAX_LEVEL;
    const need = isMax ? 0 : xpToNext(c.level);
    const currentRatio = isMax ? 100 : Math.max(0, Math.min(100, (c.xp / need) * 100));
    const levelBefore = advLevelBefore[c.id] || c.level;
    const leveledUp = c.level > levelBefore;
    const row = document.createElement("div");
    row.className = "card result-xp-row";
    const headerHtml = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <strong>${c.name}</strong>
        <span style="font-size:0.8rem;color:var(--accent);">+${gained} XP</span>
      </div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.15rem;">Lv.${c.level}${isMax ? "(MAX)" : ""}</div>
      ${leveledUp ? `<div class="levelup-badge${isDefeat ? "" : " pending"}">⭐レベルアップ！ Lv.${levelBefore}→${c.level}</div>` : ""}`;
    if (isDefeat) {
      // 敗北時は従来どおり静止したバー(祝祭演出は付けない)
      const gainRatio = isMax ? 0 : Math.max(0, Math.min(currentRatio, (Math.min(gained, c.xp) / need) * 100));
      const baseRatio = Math.max(0, currentRatio - gainRatio);
      row.innerHTML = `
        <img class="result-xp-portrait" src="${characterPortraitSrc(c)}">
        <div class="result-xp-main">
          ${headerHtml}
          <div class="xpbar-track">
            <div class="xpbar-fill" style="width:${baseRatio}%"></div>
            <div class="xpbar-gain" style="left:${baseRatio}%;width:${gainRatio}%"></div>
          </div>
        </div>`;
    } else {
      // 勝利時: 遠征開始時点のバー位置から実際に伸びていく(レベルアップの瞬間は満タン→光って→0から再スタート)
      const segs = xpSegmentsFor(c, gained, levelBefore);
      row.innerHTML = `
        <img class="result-xp-portrait" src="${characterPortraitSrc(c)}">
        <div class="result-xp-main">
          ${headerHtml}
          <div class="xpbar-track"><div class="xpbar-fill" style="width:${segs[0].fromRatio}%"></div></div>
        </div>`;
      animQueue.push({ row, segs });
    }
    list.appendChild(row);
  });
  updateSceneBackgrounds();
  // リザルト画面ではBGMを止める(currentBgmKeyもリセットし、続ける押下後の
  // playTownAreaBgm()が同じキーでも確実に再開できるようにする)
  bgmAudio.pause();
  currentBgmKey = null;
  if (!isDefeat) playSfx("result"); // 敗北時は専用SEが無いため無音のまま(賑やかな結果音を流用しない)
  const myToken = ++resultScreenToken; // 町に戻った後に朱印のSEだけ鳴るのを防ぐ世代トークン
  continueBtn.onclick = () => { resultScreenToken++; onContinue(); };
  showScreen("screen-result");
  // 素材アイコンが大量でも1行に収まるよう、実測幅から重なり量を詰め直す(リザルトの
  // 1画面完結=スクロール禁止の維持)。表示直後でないとclientWidthが取れないためここで行う
  if (matIcons.length > 1) {
    const avail = matRowEl.clientWidth;
    const iw = 40; // .result-mat-itemの幅
    const step = Math.max(6, Math.min(iw - 10, (avail - iw) / (matIcons.length - 1)));
    matRowEl.querySelectorAll(".result-mat-item").forEach((el, i) => {
      if (i < matIcons.length - 1) el.style.marginRight = `${Math.floor(step - iw)}px`;
    });
  }
  // 依頼達成→収穫(カウントアップ)→素材アイコンが左から1個ずつ→戦績→経験値(バー演出)→朱印、
  // の順に時間差で見せていく(素材ゼロの遠征では素材の待ち時間は挟まない)
  goldEl.textContent = isDefeat ? `収穫: +${advGoldEarned}G` : "収穫: +0G";
  setTimeout(() => { if (questCard.style.display !== "none") questCard.classList.add("reveal-in"); }, 80);
  setTimeout(() => {
    goldEl.classList.add("reveal-in");
    if (!isDefeat) animateGoldCount(goldEl, advGoldEarned);
  }, 260);
  const hasMatFx = !isDefeat && matIcons.length > 0;
  const MAT_START = 1150, MAT_STAGGER = 110; // 開始はゴールドのカウントアップが概ね終わる頃
  if (hasMatFx) {
    matRowEl.querySelectorAll(".result-mat-item").forEach((el, i) => {
      setTimeout(() => {
        if (myToken !== resultScreenToken) return; // もう町に戻っている(音だけ鳴るのを防ぐ)
        el.animate(
          [{ opacity: 0, transform: "translateX(-14px) scale(0.5)" }, { opacity: 1, transform: "translateX(2px) scale(1.15)", offset: 0.7 }, { opacity: 1, transform: "translateX(0) scale(1)" }],
          { duration: 240, easing: "ease-out", fill: "forwards" });
        playSfx(el.classList.contains("rare") ? "loot_rare" : "loot_item"); // 置く音/風鈴(ユーザー提供SE)
        if (el.classList.contains("rare")) {
          el.animate(
            [{ filter: "drop-shadow(0 0 18px rgba(255,190,60,1)) brightness(1.8)" }, { filter: "drop-shadow(0 0 7px rgba(255,214,102,0.95)) brightness(1)" }],
            { duration: 800, easing: "ease-out" });
        }
      }, MAT_START + i * MAT_STAGGER);
    });
  }
  const statsDelay = hasMatFx ? MAT_START + matIcons.length * MAT_STAGGER + 200 : 430;
  const xpDelay = statsDelay + 130;
  setTimeout(() => { statsEl.classList.add("reveal-in"); }, statsDelay);
  setTimeout(() => {
    list.querySelectorAll(".result-xp-row").forEach((row, i) => {
      setTimeout(() => row.classList.add("reveal-in"), i * 90);
    });
    animQueue.forEach((q, i) => setTimeout(() => animateXpRow(q.row, q.segs), i * 90 + 280));
  }, xpDelay);
  if (!isDefeat) {
    // 朱印(松/竹/梅)はバー演出が一通り終わる頃にドンと押す
    const stampDelay = xpDelay + animQueue.length * 90 + 1600;
    setTimeout(() => {
      if (myToken !== resultScreenToken) return; // もう町に戻っている
      stampEl.textContent = computeExpeditionRank();
      stampEl.style.display = "flex";
      stampEl.classList.add("stamp-in");
      playSfx("quest_accept"); // ハンコを押すドン(仮。専用SEが来たら差し替え)
    }, stampDelay);
  }
}
let resultScreenToken = 0;
// 収穫ゴールドのカウントアップ(0→合計値がコロコロ増える)。増えている間はコインSEを小刻みに鳴らす
function animateGoldCount(el, total) {
  if (!(total > 0)) { el.textContent = `収穫: +${total || 0}G`; return; }
  const durMs = Math.min(1300, 450 + total * 6);
  const start = performance.now();
  let lastCoinAt = -1000;
  function step(now) {
    const t = Math.min(1, (now - start) / durMs);
    const eased = 1 - Math.pow(1 - t, 2); // 最後にかけてゆっくり止まる
    el.textContent = `収穫: +${Math.round(total * eased)}G`;
    if (t < 1) {
      if (now - lastCoinAt > 280) { playSfx("coin"); lastCoinAt = now; }
      requestAnimationFrame(step);
    }
  }
  requestAnimationFrame(step);
}
// 帰還時点の(level, xp)から今回得たXPを逆再生して遠征開始時点のバー位置を割り出し、
// レベル境界ごとの「どこからどこまで伸ばすか」の区間リストを作る(リザルトのバー演出用)
function xpSegmentsFor(c, gained, levelBefore) {
  let level = c.level;
  let xp = Math.max(0, c.xp || 0);
  let rem = Math.max(0, gained);
  while (level > levelBefore && rem > xp) {
    rem -= xp;
    level--;
    xp = xpToNext(level); // 1つ前のレベルを満了した(境界ちょうど)状態まで巻き戻す
  }
  const startXp = Math.max(0, xp - rem);
  const segs = [];
  let curLevel = levelBefore;
  while (curLevel < c.level) {
    const need = xpToNext(curLevel);
    segs.push({ fromRatio: curLevel === levelBefore && need > 0 ? Math.min(100, (startXp / need) * 100) : 0, toRatio: 100, levelUpTo: curLevel + 1 });
    curLevel++;
  }
  const isMax = c.level >= MAX_LEVEL;
  const need = isMax ? 0 : xpToNext(c.level);
  segs.push({
    fromRatio: curLevel === levelBefore && need > 0 ? Math.min(100, (startXp / need) * 100) : 0,
    toRatio: isMax ? 100 : (need > 0 ? Math.max(0, Math.min(100, (c.xp / need) * 100)) : 0),
    levelUpTo: null,
  });
  return segs;
}
// 経験値バーの区間を順番に再生する。レベル境界では満タン→金フラッシュ+顔アイコンのきらめき+SE→
// 0に戻して次の区間、最後の区間が終わったらレベルアップバッジをポンと出す
function animateXpRow(row, segs) {
  const fill = row.querySelector(".xpbar-fill");
  const track = row.querySelector(".xpbar-track");
  const portrait = row.querySelector(".result-xp-portrait");
  const badge = row.querySelector(".levelup-badge");
  let i = 0;
  function runSeg() {
    const s = segs[i];
    if (!s) return;
    const durMs = segs.length > 1 ? 480 : 750;
    const anim = fill.animate([{ width: `${s.fromRatio}%` }, { width: `${s.toRatio}%` }], { duration: durMs, easing: "ease-out", fill: "forwards" });
    anim.onfinish = () => {
      anim.cancel();
      fill.style.width = `${s.toRatio}%`;
      if (s.levelUpTo != null) {
        playSfx("skill_confirm"); // レベルアップの節目(仮SE)
        track.classList.add("xp-flash");
        if (portrait) { portrait.classList.remove("levelup-flash"); void portrait.offsetWidth; portrait.classList.add("levelup-flash"); }
        setTimeout(() => track.classList.remove("xp-flash"), 380);
        fill.style.width = "0%";
        i++;
        setTimeout(runSeg, 200);
      } else if (badge) {
        badge.classList.add("badge-pop");
      }
    };
  }
  runSeg();
}
// 評価の朱印(松/竹/梅)。基準は仮決め(要調整): 踏破階層+討伐数×2のスコアと、全員生還したかどうか
function computeExpeditionRank() {
  const score = (advMaxFloor || 0) + (advEnemiesDefeated || 0) * 2;
  if (!advLostHappened && score >= 28) return "松";
  if (score >= 12) return "竹";
  return "梅";
}
function crossfadeBg(fromEl, toEl, imageUrl, durationMs, callback) {
  toEl.style.opacity = "0";
  toEl.style.backgroundImage = `url('${imageUrl}')`;
  const anim = toEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: durationMs, easing: "ease", fill: "forwards" });
  anim.onfinish = () => {
    fromEl.style.backgroundImage = `url('${imageUrl}')`; // 今回の見た目をfrom側に焼き込み、toを次のフェード用に戻す
    anim.cancel(); // fill:forwardsで保持されたopacity:1を解除してから素のinline styleに戻す
    toEl.style.opacity = "0";
    if (callback) callback();
  };
}

function fadeOpacity(el, from, to, durationMs, callback) {
  el.style.opacity = String(from);
  const anim = el.animate([{ opacity: from }, { opacity: to }], { duration: durationMs, easing: "ease", fill: "forwards" });
  anim.onfinish = () => {
    anim.cancel();
    el.style.opacity = String(to);
    if (callback) callback();
  };
}

function showRestSummary(panelId, listId, nextBtnId, beforeSnapshot, onNext, showStress = true, playHealSfx = true) {
  const panel = document.getElementById(panelId);
  const list = document.getElementById(listId);
  // 7人以上(宿泊の全員一括化で名簿上限8人まで並び得る)はコンパクト4列表示にする(camp.css参照)。
  // 4人ちょうどは3+1の端数を出さず2×2で組む(ユーザー指示)
  list.classList.toggle("camp-rest-many", beforeSnapshot.length > 6);
  list.classList.toggle("camp-rest-four", beforeSnapshot.length === 4);
  list.innerHTML = beforeSnapshot.map(({ id, fatigueBefore }) => {
    const c = getRosterChar(id);
    if (!c) return "";
    const fatigueDelta = fatigueBefore - (c.fatigue || 0);
    return `
      <div class="camp-rest-row">
        <img src="${characterPortraitSrc(c)}">
        <div class="camp-rest-info">
          <div class="nm">${c.name}</div>
          <div class="camp-rest-stat-label">HP</div>
          ${hpBarHtml(c)}
          ${c.maxMp > 0 ? `<div class="camp-rest-stat-label" style="margin-top:0.25rem;">MP</div>${mpBarHtml(c)}` : ""}
          ${showStress ? `<div class="camp-rest-stress">ストレス -${Math.round(fatigueDelta)}</div>` : ""}
        </div>
      </div>
    `;
  }).join("");
  panel.style.display = "flex";
  // 一拍(0.9秒)おいてから0.9秒かけてゆっくり伸ばす(回復している感を出すためのユーザー指示)。
  // バーが伸び始める瞬間に合わせて回復音を鳴らす(野営/茶屋のみ。宿泊はユーザー指示でSEなしに変更)
  const REST_HEAL_DELAY_MS = 900;
  activateHpTrails(list, { delayMs: REST_HEAL_DELAY_MS, durationMs: 900 });
  if (playHealSfx) setTimeout(() => playSfx("rest_heal"), REST_HEAL_DELAY_MS);
  document.getElementById(nextBtnId).onclick = () => {
    panel.style.display = "none";
    onNext();
  };
}
// ============ ステータス詳細 ============
// 和風・シンプルを守るため絵文字ではなく最小限の線画SVGを使う(currentColorで行ごとの色分けを継承する)
// 和風・シンプルを守るため絵文字を一切使わず、この1つのアイコン言語(currentColorのSVG線画、
// viewBox 0 0 16 16, stroke-width 1.3で統一)だけをゲーム全体のアイコンとして使う。
// ステータス画面の能力値アイコン・戦闘の状態異常アイコン・町の施設ボタンアイコン、全てここから引く
const ICONS = {
  hp: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M8 13.5C4 10.8 2 8.7 2 6.2 2 4.4 3.4 3 5.1 3c1 0 2 .5 2.9 1.6C8.9 3.5 9.9 3 10.9 3 12.6 3 14 4.4 14 6.2c0 2.5-2 4.6-6 7.3Z"/></svg>',
  mp: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M8 2c2.2 3 4 5.6 4 7.8A4 4 0 0 1 4 9.8C4 7.6 5.8 5 8 2Z"/></svg>',
  atk: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M4 12 12 4"/><path d="M9.5 3.2 12.8 6.5"/><path d="M3.3 10.5 5.5 12.7"/></svg>',
  def: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M8 2.2 13 4v4.3C13 11.5 10.8 13.2 8 14 5.2 13.2 3 11.5 3 8.3V4Z"/></svg>',
  spd: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M2.5 6.5h7a2 2 0 1 0-1.8-2.9"/><path d="M2.5 9.5h9a2 2 0 1 1-1.8 2.9"/></svg>',
  mag: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M8 2v3.2M8 10.8V14M2 8h3.2M10.8 8H14M4.3 4.3l2.2 2.2M9.5 9.5l2.2 2.2M4.3 11.7l2.2-2.2M9.5 6.5l2.2-2.2"/></svg>',
  stress: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8c1.5-2 2.5 2 4 0s2.5-2 4 0 2.5 2 4 0"/></svg>',
  // 状態異常(元は絵文字だったが一時SVG線画に統一していたものを、ユーザー指示で絵文字表示へ戻した。
  // STATUS_TOOLTIPS側のiconと同じ絵文字に揃えてある)
  poison: '🦠',
  burn: '🔥',
  bleed: '🩸',
  stun: '💫',
  silence: '🔇',
  tangle: '🕸️',
  atkDown: '📉',
  defDown: '🔻',
  dmgTakenUp: '💥',
  bigAttackPending: '⚡',
  guarding: '🛡',
  flying: '<img src="assets/icons/status_flying.png" alt="" style="display:inline-block;width:22px;height:22px;vertical-align:middle;">',
  questTarget: '🎯',
  // 施設・行動(町画面等)
  lodge: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M2 8 8 3l6 5" stroke-linecap="round"/><path d="M3.3 7.2V13h9.4V7.2"/><path d="M6.3 13v-4h3.4v4"/></svg>',
  onsen: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M1.5 12.2c1-1 2-1 3 0s2 1 3 0 2-1 3 0 2 1 3 0"/><path d="M6.2 7.8c-1-1.2-1-2.2 0-3.4M9.3 7.8c-1-1.5-1-2.8.3-4.2"/></svg>',
  smith: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M9.2 2 13.5 6.3l-2.1 2.1-4.3-4.3Z" stroke-linecap="round"/><path d="M9.6 5.7 3 12.3l-1.3 1.3" stroke-linecap="round"/></svg>',
  quest: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M4 2.3h8v11.4l-2-1.5-2 1.5-2-1.5-2 1.5Z"/><path d="M6 6h4M6 8.6h4" stroke-linecap="round"/></svg>',
  build: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13 9.5 6.5"/><path d="M8.3 3.7l3 3-1.3 1.3-3-3Z"/><path d="M2.3 13.7l1.6-3.6 2 2Z"/></svg>',
  magistrate: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M2 6 8 2l6 4" stroke-linecap="round"/><path d="M2.8 6.5v6.8h10.4V6.5"/><path d="M5 13.3V9.5h1.8v3.8M9.2 13.3V9.5H11v3.8" stroke-linecap="round"/></svg>',
  depart: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12.5 6.5 3.5"/><path d="M6.5 3.5H10M6.5 3.5l1 3"/><path d="M9 8.5l5 1.2-3.8 3.3"/></svg>',
};
// 被弾時、緑ゲージは即座に新しい残量まで落とし、赤ゲージ(トレイル)は前回表示していた残量から
// 緑の位置までゆっくり追いついて消えていく。entity.__hpDisplayRatioに前回表示分を記憶しておく。
// 回復時(前回より残量が増えた時)は、赤ゲージとは別に淡いシアンの回復用トレイルも重ねて出し、
// 回復前の残量から緑の位置まで追いついたら非表示にする(ダメージ用の赤ゲージの挙動は変更しない)
// 陰陽師「結界術」の数値シールド(barrierHp)は専用の別バーではなく、HPバーの中に紫の区画として
// 統合して描く(ユーザー指示、2026-07-26)。緑=今のHP、その右に紫=結界の耐久値、が1本のバーに同居する。
// 「HP満タン+結界」のように合計が最大HPを超える場合は、バー全体を合計値のスケールに切り替えて
// 緑を圧縮し、はみ出した結界ぶんが必ず紫として見えるようにする(オーバーシールド式)
function hpBarHtml(entity) {
  const barrier = entity.barrierHp > 0 ? entity.barrierHp : 0;
  const denom = Math.max(entity.maxHp, Math.max(0, entity.hp) + barrier);
  const ratio = denom > 0 ? Math.max(0, entity.hp / denom) * 100 : 0;
  const prevRatio = entity.__hpDisplayRatio != null ? entity.__hpDisplayRatio : ratio;
  entity.__hpDisplayRatio = ratio;
  const lowClass = ratio < 30 ? " low" : "";
  const isHeal = ratio > prevRatio;
  const healTrailHtml = isHeal
    ? `<div class="hpbar-heal-trail" data-hp-heal-trail data-from="${prevRatio}" data-target="${ratio}" style="width:${prevRatio}%"></div>`
    : "";
  const barrierRatio = denom > 0 ? Math.min(100 - ratio, (barrier / denom) * 100) : 0;
  const barrierHtml = barrier > 0 ? `<div class="hpbar-barrier-fill" style="left:${ratio}%;width:${barrierRatio}%"></div>` : "";
  return `<div class="hpbar-track"><div class="hpbar-fill-trail" data-hp-trail data-from="${prevRatio}" data-target="${ratio}" style="width:${prevRatio}%"></div><div class="hpbar-fill${lowClass}" style="width:${ratio}%"></div>${barrierHtml}${healTrailHtml}</div>`;
}
// 描画直後の赤ゲージ/回復用シアンゲージを、記録しておいた目標値までアニメーションさせて追いつかせる。
// CSS transitionを「別のタイミングでinline styleを書き換えて発火させる」方式は、環境によっては
// (実測したところheadless Chromiumでも)トランジションが一切発火せず一瞬で目標値に飛んでしまう
// ことがあったため、Web Animations API(element.animate())で確実にアニメーションさせる方式にした。
// 回復用ゲージは追いついたら(アニメーション完了時)非表示にする
// opts(省略可): { delayMs, durationMs } — 回復サマリー(宿泊/野営/茶屋)だけは「一拍おいてから
// ゆっくり回復」の演出にしたい(ユーザー指示2026-07-18: 即始まると回復している感じが分かりにくい)ため、
// 開始遅延と伸びる時間を呼び出し側から指定できるようにした。未指定なら従来どおり即時250ms
function activateHpTrails(container, opts) {
  const HP_TRAIL_MS = 250;
  const delayMs = (opts && opts.delayMs) || 0;
  const durationMs = (opts && opts.durationMs) || HP_TRAIL_MS;
  const trails = container.querySelectorAll("[data-hp-trail]");
  const healTrails = container.querySelectorAll("[data-hp-heal-trail]");
  trails.forEach((el) => {
    const from = Number(el.dataset.from);
    const target = Number(el.dataset.target);
    if (from === target) return;
    const anim = el.animate([{ width: `${from}%` }, { width: `${target}%` }], { duration: durationMs, delay: delayMs, easing: "ease-out", fill: "forwards" });
    anim.onfinish = () => { anim.cancel(); el.style.width = `${target}%`; };
  });
  healTrails.forEach((el) => {
    const from = Number(el.dataset.from);
    const target = Number(el.dataset.target);
    // 遅延ありの時は、待っている間バー全体が「回復前の量」に見えている必要がある。
    // 完成形の緑/青バー(.hpbar-fill/.mpbar-fill)は描画時点で回復後の値になっているため、
    // いったんfromまで戻してからトレイルと同じタイミングで一緒に伸ばす
    if (delayMs > 0) {
      const fillEl = el.parentElement.querySelector(".hpbar-fill, .mpbar-fill");
      if (fillEl) {
        fillEl.style.width = `${from}%`;
        const fillAnim = fillEl.animate([{ width: `${from}%` }, { width: `${target}%` }], { duration: durationMs, delay: delayMs, easing: "ease-out", fill: "forwards" });
        fillAnim.onfinish = () => { fillAnim.cancel(); fillEl.style.width = `${target}%`; };
      }
    }
    const anim = el.animate([{ width: `${from}%` }, { width: `${target}%` }], { duration: durationMs, delay: delayMs, easing: "ease-out", fill: "forwards" });
    anim.onfinish = () => { anim.cancel(); el.style.width = `${target}%`; el.style.display = "none"; };
  });
}
// HP版(hpBarHtml)と同じ考え方のMP回復トレイル。data-hp-heal-trailを共有しているので
// activateHpTrails()がそのまま拾ってアニメーションさせてくれる(野営の回復サマリー画面用)
function mpBarHtml(entity) {
  const ratio = entity.maxMp > 0 ? Math.max(0, entity.mp / entity.maxMp) * 100 : 0;
  const prevRatio = entity.__mpDisplayRatio != null ? entity.__mpDisplayRatio : ratio;
  entity.__mpDisplayRatio = ratio;
  const isHeal = ratio > prevRatio;
  const healTrailHtml = isHeal
    ? `<div class="mpbar-heal-trail" data-hp-heal-trail data-from="${prevRatio}" data-target="${ratio}" style="width:${prevRatio}%"></div>`
    : "";
  return `<div class="mpbar-track"><div class="mpbar-fill" style="width:${ratio}%"></div>${healTrailHtml}</div>`;
}

// elIdごとに「直前の描画で誰がactingCharIdだったか」を覚えておき、renderPartyBar()内でも
// 実際に手番が切り替わった瞬間(値が変わった時)だけ.acting-enterを付けてスライド演出を1回だけ再生する。
// renderPartyBar()はinnerHTML=""で毎回DOMを作り直すため、この追跡をしないと技/道具/対象選択などの
// サブメニューを開くたびに同じキャラのカードが再生成され、そのたびに演出が再生されてしつこくなる
// (「ぴょんぴょん1」で実際に踏んだ不具合。KAMIKAKUSHI_REVEAL_MSと同じ「フラグで一度きりに絞る」考え方)
// 交代ダイアログ(戦闘)/交代ピッカー(探索)で表示する控えキャラのステータスカード。
// 宿の名簿風の「横並びの小さな肖像+テキスト」ではなく、戦闘の味方カードと同じ部品
// (ポートレート+緑のHPバー+青のMPバー+名前)を縦に組んだデザインに統一する(ユーザー指示2026-07-26)。
// ポートレートはストレス表情を反映(characterPortraitSrc)。hpBarHtml()を使うため
// トレイルの記憶(__hpDisplayRatio)も戦闘カードと共有される(表示するだけなら無害)
// compact=true(探索の交代ピッカー用)は戦闘の味方カード(.party-member、幅95px)と同じサイズ感に
// 揃えた縮小版。縦に余裕のあるモーダル(戦闘の交代確認ダイアログ)では従来のフルサイズ版を使う
function reserveStatusCardHtml(rm, compact) {
  const frenzy = stressTier(rm.fatigue) >= 4 ? " <span style='color:#e08787;'>(発狂中)</span>" : "";
  const mpRatio = rm.maxMp > 0 ? Math.max(0, rm.mp / rm.maxMp) * 100 : 0;
  const barsHtml = `
      <div class="reserve-status-bars">
        ${hpBarHtml(rm)}
        ${rm.maxMp > 0 ? `<div class="mpbar-track"><div class="mpbar-fill" style="width:${mpRatio}%"></div></div>` : ""}
      </div>`;
  if (compact) {
    // 数値行は置かない(本隊カードと同じ「ポートレート+バー+名前」だけの構成・同じ高さに揃える)
    return `
    <div class="reserve-status-card compact">
      <img class="card-portrait-img" src="${characterPortraitSrc(rm)}">
      ${barsHtml}
      <div class="reserve-status-name">${rm.name} Lv${rm.level}${frenzy}</div>
    </div>`;
  }
  return `
    <div class="reserve-status-card">
      <img class="card-portrait-img" src="${characterPortraitSrc(rm)}">
      ${barsHtml}
      <div class="reserve-status-name">${rm.name}(${CLASSES[rm.classId].ja} Lv${rm.level}・${rm.personality || "-"})${frenzy}</div>
      <div class="reserve-status-numbers">HP ${rm.hp}/${rm.maxHp}${rm.maxMp > 0 ? `・MP ${rm.mp}/${rm.maxMp}` : ""}・ストレス ${rm.fatigue || 0}</div>
    </div>`;
}

const lastPartyBarActingId = {};
// ============ 味方カードの差分更新(2026-07-26、iOS演出品質の根本対策) ============
// 以前は毎回bar.innerHTML=""で全カードを作り直していたが、iOS Safariは「挿入したてのDOM要素への
// 即時アニメーション」の序盤フレームを描画しない(docs/引き継ぎ_戦闘UI差分更新化.md §3)。
// カードはキャラ(id)ごとに1回だけ生成して使い回し、毎回の描画では中身だけを書き換える。
// 要素の追加/削除は編成が実際に変わった時だけ(交代・式神/分身の召喚と消滅・逃走離脱・遠征の入れ替え)
function createPartyMemberCard(c) {
  const div = document.createElement("div");
  div.className = "party-member";
  div.dataset.id = c.id;
  // 静的な骨組みのみ。ポートレート/バー/バッジ類は毎描画updatePartyMemberCard()が書き換える
  div.innerHTML = `
      <div class="party-portrait-wrap">
        <div class="ally-debuff-icons"></div>
      </div>
      <div class="status-icon-row"></div>
      <div class="nm"></div>
    `;
  // タップ(回復対象などの味方選択)は生成時に一度だけ張る。対象選択中(targetableクラスが付いて
  // いる時)だけ反応する。クロージャで生成時のキャラ参照を掴まず、発火時にdata-idから現在の
  // エンティティを引き直す(引き継ぎ文書の地雷リスト3番)
  div.onclick = () => {
    if (!pendingAllyPick || !div.classList.contains("targetable")) return; // 既に別経路(対象一覧のテキストボタン等)で選択済みなら無視する(二重行動防止)
    const cur = fieldParty.find((x) => String(x.id) === div.dataset.id);
    if (!cur) return;
    const picked = pendingAllyPick;
    pendingAllyPick = null;
    picked(cur);
  };
  return div;
}
function updatePartyMemberCard(card, c, isActing, isFreshTurn) {
  const dead = c.hp <= 0 || c.status !== "active";
  // 変化の術で変身中は回復薬/治癒の術の対象にできない(回復不可のため、味方イラストの直接タップからも除外する)
  const targetable = !!pendingAllyPick && !dead && !c.transformForm;
  card.classList.toggle("dead", dead);
  card.classList.toggle("acting", isActing);
  // 手番切り替えのスライド演出(acting-enter)は、実際に手番が変わった描画(isFreshTurn)の時だけ
  // 再発火させる。カードが使い回しになったため、クラス除去→リフロー→再付与でCSSアニメーションを
  // 確実に最初から再生する(地雷リスト2番の既存パターン)
  card.classList.remove("acting-enter");
  if (isActing && isFreshTurn) {
    void card.offsetWidth;
    card.classList.add("acting-enter");
  }
  card.classList.toggle("targetable", targetable);
  // 被弾の揺れ: 敵カード(updateEnemyCard)と同じ扱い。新しい揺れの時だけ剥がして付け直し、
  // 揺れ中の再描画では何もしない=アニメーションを途中で切らず完走させる(フェーズ5で
  // 「空文字時に剥がす」従来挙動の再現を撤去。残ったクラスは無害=付け直した瞬間しか再生されない)
  const shake = shakeClassFor(c).trim();
  if (shake) {
    card.classList.remove(...HIT_SHAKE_CLASSES);
    void card.offsetWidth;
    card.classList.add(...shake.split(/\s+/));
  }
  const wrap = card.querySelector(".party-portrait-wrap");
  const debuffIconsEl = wrap.querySelector(".ally-debuff-icons");
  const statusRowEl = card.querySelector(".status-icon-row");
  const nmEl = card.querySelector(".nm");
  // 忍の変化の術で変身中は、ポートレートをform専用イラストに差し替え、MPバー(概念自体が無くなる)は隠す
  const transformDef = c.transformForm ? TRANSFORM_FORMS[c.transformForm] : null;
  // 式神はiconImg(実イラスト)があればそれを、無ければ絵文字アイコンで代用する。
  // classIdを持たないのでcharacterPortraitSrc(CLASSES[c.classId]を前提とする)は呼べない
  const portraitSrc = c.isShikigami ? c.iconImg : (transformDef ? transformDef.image : characterPortraitSrc(c));
  // ポートレートは表示内容(変身・式神の種類)が実際に変わった時だけ差し替える。毎回作り直すと
  // 「作りたてのimg」に戻ってしまい、差分更新化の意味が無くなるため
  const isEmojiPortrait = c.isShikigami && !portraitSrc;
  const portraitKey = isEmojiPortrait ? `emoji:${c.emoji || "🐾"}` : `img:${portraitSrc}`;
  if (card.__portraitKey !== portraitKey) {
    card.__portraitKey = portraitKey;
    const oldPortrait = wrap.querySelector(":scope > .card-portrait-img");
    if (oldPortrait) oldPortrait.remove();
    wrap.insertAdjacentHTML("afterbegin", isEmojiPortrait ? `<div class="card-portrait-img shikigami-emoji-portrait">${c.emoji || "🐾"}</div>` : `<img class="card-portrait-img" src="${portraitSrc}">`);
  }
  // 立ち絵に重ねる動的オーバーレイ(毘沙門の加護/結界/照準マーク)は毎回作り直す。全て
  // position:absoluteの小要素で、被弾揺れ等のアニメーションの起点にはならないため問題ない。
  // DOM上の並び(毘沙門/結界はデバフアイコン列の手前、照準マークは末尾)も従来のマークアップと同じに保つ
  wrap.querySelectorAll(":scope > .bishamon-barrier-vfx, :scope > .kekkai-barrier-vfx, :scope > .ally-target-marker").forEach((el) => el.remove());
  let vfxHtml = "";
  if (c.passives && c.passives.omamoriBishamonPending) vfxHtml += `<img class="bishamon-barrier-vfx" src="assets/vfx/bishamon_barrier.png">`;
  if (c.barrierHp > 0) vfxHtml += `<img class="kekkai-barrier-vfx" src="assets/vfx/kekkai_barrier.png">`;
  if (vfxHtml) debuffIconsEl.insertAdjacentHTML("beforebegin", vfxHtml);
  debuffIconsEl.innerHTML = statusIconsFor(c);
  // 敵の大技予告(bigAttackPending)がこのキャラを狙っている場合、ターゲットマーク(照準)を出す。
  // タップでどの敵の何の技に狙われているか説明が見られる(effects.jsのshowStatusTooltip参照)。
  // さらに未かばう想定でHPが最大の20%以下まで落ち込む可能性が高ければ、左上に⚠️も追加で出す
  const bigThreat = !dead ? findBigAttackThreatFor(c.id) : null;
  if (bigThreat) {
    const bigThreatLethal = isBigAttackLethalRisk(bigThreat.enemy, c, bigThreat.profile);
    wrap.insertAdjacentHTML("beforeend", `
      <div class="ally-target-marker">
        <img class="ally-target-marker-img" src="assets/vfx/target_marker.png" alt="">
        ${bigThreatLethal ? `<span class="ally-lethal-warning">⚠️</span>` : ""}
      </div>`);
    // data-*は文字列組み立てで直接埋め込まず(HTMLインジェクション対策)、他の.dataset.X=箇所と
    // 同じくHTML挿入後にJSプロパティ代入で付与する
    const markerEl = wrap.querySelector(".ally-target-marker");
    markerEl.dataset.enemyImage = bigThreat.enemy.image;
    markerEl.dataset.attackName = bigThreat.profile.name || "大技";
    markerEl.dataset.attackDesc = describeBigAttackShort(bigThreat.profile);
    const warnEl = wrap.querySelector(".ally-lethal-warning");
    if (warnEl) warnEl.dataset.lethalDesc = "この大技を受けると戦闘不能になる可能性があります。";
  }
  // 鷹バッジ/次ターン行動バッジ/HPバーは従来と同じDOM順(立ち絵ラッパーの直後)で毎回作り直す。
  // HPバーはトレイル(前回表示位置からの追いつき)のfrom/targetを描画のたびに現在値で組み直す
  // 必要があるため(この後のactivateHpTrails()が拾って動かす)
  card.querySelectorAll(":scope > .hawk-badge, :scope > .next-actor-badge, :scope > .hpbar-track, :scope > .mpbar-track").forEach((el) => el.remove());
  // カラス変身中の「観察眼」: 次に行動するのがこのキャラなら青い矢印バッジを出す
  const isNextActor = anyCrowScoutActive() && nextActingCombatant() === c;
  let midHtml = "";
  if (c.hawkTurnsLeft > 0 && !c.hawkFlightActive) midHtml += `<img class="hawk-badge" src="assets/vfx/hawk.png" title="鷹(あと${c.hawkTurnsLeft}T)">`;
  if (isNextActor) midHtml += '<span class="next-actor-badge">▲次ターン行動</span>';
  wrap.insertAdjacentHTML("afterend", midHtml + hpBarHtml(c));
  statusRowEl.innerHTML = c.guarding ? statusIconHtml("guarding") : "";
  if (!transformDef && c.maxMp > 0) {
    const mpRatio = Math.max(0, c.mp / c.maxMp) * 100;
    statusRowEl.insertAdjacentHTML("afterend", `<div class="mpbar-track"><div class="mpbar-fill" style="width:${mpRatio}%"></div></div>`);
  }
  nmEl.textContent = `${c.name}${transformDef ? ` ${transformDef.emoji}${transformDef.ja}` : ""}`;
}
function renderPartyBar(elId, combatants, actingCharId) {
  const bar = document.getElementById(elId);
  const isFreshTurn = actingCharId != null && lastPartyBarActingId[elId] !== actingCharId;
  lastPartyBarActingId[elId] = actingCharId != null ? actingCharId : null;
  // 影分身/式神で追加の1体が出ている間は、狭いスマホ画面でもカードが収まるよう一回り小さくする
  bar.classList.toggle("party-bar-five", combatants.length >= 5);
  // 表示対象でなくなったカードだけ取り除く(交代で下がった/ロストして探索バーから外れた/
  // 式神・分身の消滅/逃走離脱/別の遠征メンバーへの入れ替わり)
  const validIds = new Set(combatants.map((c) => String(c.id)));
  [...bar.children].forEach((el) => { if (!validIds.has(el.dataset.id)) el.remove(); });
  let prevCard = null;
  combatants.forEach((c) => {
    let card = bar.querySelector(`:scope > .party-member[data-id="${c.id}"]`);
    if (!card) {
      card = createPartyMemberCard(c);
      // combatantsの並び順を保って挿入する(基本は末尾追加。交代でカードの中身が別キャラに変わる
      // ケースは「同じ位置に新しいidのカードを挿入」として自然に処理される)。既存カードは
      // 並べ替えない=再挿入で「作りたて扱い」に戻さない(引き継ぎ文書の地雷リスト6番)
      bar.insertBefore(card, prevCard ? prevCard.nextElementSibling : bar.firstElementChild);
    }
    updatePartyMemberCard(card, c, c.id === actingCharId, isFreshTurn);
    prevCard = card;
  });
  activateHpTrails(bar);
  combatants.forEach((c) => renderVfxFor(c.id));
}

// 行動選択ボタン欄を、味方表示の実際の描画位置のすぐ下に配置する。
// 端末ごとにブラウザの表示領域の高さが違い、固定pxの当て推量では重なったりズレたりするため、
// 実測したgetBoundingClientRect()を元に毎回計算し直す
let lastPartyBarPositionCall = null; // 直近の呼び出し引数を覚えておき、visualViewportの変化時に再計算できるようにする
function positionActionsBelowPartyBar(partyBarId, actionsSelector) {
  const partyBar = document.getElementById(partyBarId);
  const actions = document.querySelector(actionsSelector);
  if (!partyBar || !actions) return;
  const apply = () => {
    const rect = partyBar.getBoundingClientRect();
    let top = Math.round(rect.bottom) + 10;
    // 【見切れ防止クランプ】ボタン列/対象選択ピッカーの下端が可視領域(innerHeight)からはみ出す場合は、
    // はみ出したぶんだけ全体を上へずらす。iOS SafariはURL バー/下部バー展開時の可視高さが
    // 500px台まで縮むことがあり、味方表示の下に置くと下段のボタンが画面外(バーの下)に隠れて
    // 押せなくなっていた(探索の交代ピッカーで実機発覚、2026-07-26)。ずらした結果、味方表示の
    // 下端に多少重なることがあるが、ボタンが押せないよりはよい(はみ出さない通常時は従来通り)
    const actionsHeight = actions.getBoundingClientRect().height;
    const maxTop = window.innerHeight - actionsHeight - 6;
    if (top > maxTop) top = Math.max(0, maxTop);
    actions.style.top = `${top}px`;
  };
  apply();
  lastPartyBarPositionCall = { partyBarId, actionsSelector };
  // ごく稀に、呼び出し直後はまだレイアウトが完全に確定しておらず(iOS Safariのアドレスバー表示/非表示の
  // 切り替わり中など)、ボタン位置が実際の味方表示より上にズレたまま固定されてしまうことがあったため、
  // 次の描画フレームでもう一度測り直して補正する(既に正しい場合は同じ値を書き込むだけで無害)
  requestAnimationFrame(apply);
}
// iOS Safariでアドレスバーの表示/非表示が切り替わり実際の可視領域(visualViewport)が変化した時、
// 直前に配置したボタン列を同じ組み合わせで再計算する(再描画を待たずに追従させるための保険)
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    if (lastPartyBarPositionCall) positionActionsBelowPartyBar(lastPartyBarPositionCall.partyBarId, lastPartyBarPositionCall.actionsSelector);
  });
}

let battleLogLines = [];
const LOG_CHAR_MS = 18; // 1文字あたりの文字送り速度(0.015〜0.02秒の範囲)
// タップで現在の文字送りを即座に全文表示するためのコールバック群。短時間に複数行が追加され、
// 同時に文字送り中になることがあるため、単一の変数ではなくSetで全て保持し、タップ時に全て消化する
const activeLogFinishers = new Set();
let activeTypingCount = 0; // 何行が文字送り中か(0になった時だけ右下の▼を表示する)
// 戦闘ログ内で、現在フィールドにいる味方/敵のラベル名と一致する部分だけ{isName:true}として
// 分割する(長い名前を先にマッチさせ、短い名前が別名の部分文字列になっている誤マッチを防ぐ)
function tokenizeLogLine(text) {
  const names = [];
  if (typeof fieldParty !== "undefined" && fieldParty) fieldParty.forEach((c) => { if (c && c.label) names.push(c.label); });
  if (typeof battle !== "undefined" && battle && battle.enemies) battle.enemies.forEach((e) => { if (e && e.label) names.push(e.label); });
  const uniqueNames = [...new Set(names)].sort((a, b) => b.length - a.length);
  if (uniqueNames.length === 0) return [{ text, isName: false }];
  const pattern = new RegExp(`(${uniqueNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  const tokens = [];
  let lastIndex = 0;
  let m;
  while ((m = pattern.exec(text))) {
    if (m.index > lastIndex) tokens.push({ text: text.slice(lastIndex, m.index), isName: false });
    tokens.push({ text: m[0], isName: true });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) tokens.push({ text: text.slice(lastIndex), isName: false });
  return tokens;
}
// 1行を1文字ずつフェードインさせる(文字送り)。名前部分は.log-nameでラップして金箔色にする。
// 完了(またはタップでスキップ)するとonFinishを呼ぶ
function revealLogLine(p, text, onFinish) {
  p.innerHTML = "";
  const tokens = tokenizeLogLine(text);
  const charSpans = [];
  let charIndex = 0;
  tokens.forEach((tok) => {
    const wrapper = tok.isName ? document.createElement("span") : null;
    if (wrapper) { wrapper.className = "log-name"; p.appendChild(wrapper); }
    const target = wrapper || p;
    [...tok.text].forEach((ch) => {
      const span = document.createElement("span");
      span.className = "log-char";
      span.textContent = ch;
      span.style.animationDelay = `${charIndex * LOG_CHAR_MS}ms`;
      target.appendChild(span);
      charSpans.push(span);
      charIndex++;
    });
  });
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    charSpans.forEach((s) => { s.style.animation = "none"; s.style.opacity = "1"; });
    activeLogFinishers.delete(skipFn);
    if (onFinish) onFinish();
  };
  const timer = setTimeout(finish, charIndex * LOG_CHAR_MS + 120);
  const skipFn = () => { clearTimeout(timer); finish(); };
  activeLogFinishers.add(skipFn);
}
// 探索ログ(#dungeonLog)/戦闘ログ(#battleLog)共通の文字送り表示処理。両者でテキストUIの
// 見た目・演出(1文字ずつフェードイン+名前の金箔色+文字送り完了後の▼)を完全に揃えるための共通化
function appendTypewriterLog(elId, arrowId, msg) {
  const el = document.getElementById(elId);
  let arrow = document.getElementById(arrowId);
  if (!arrow) {
    arrow = document.createElement("span");
    arrow.id = arrowId;
    arrow.className = "log-arrow";
    arrow.textContent = "▼";
    el.appendChild(arrow);
  }
  activeTypingCount++;
  arrow.style.display = "none";
  const p = document.createElement("p");
  el.insertBefore(p, arrow);
  // 行の登場演出(ふわっと下から現れる)は、以前はCSSの@keyframes+animationクラス付与で
  // 実装していたが、要素が生成された直後にクラスを付けるこの方式だとブラウザ側の
  // スタイル再計算のタイミング次第でアニメーションが開始状態(translateY(10px)、つまり
  // 中央より少し下にずれた位置)のまま止まって見えることがあり、これが「ログの文字が
  // ボックス内で中央からずれて見える」不具合の実際の原因だった(実測で確認済み)。
  // このプロジェクトで過去に何度も踏んだ「CSSのtransition/animationクラス切り替えは
  // 信頼できない」問題と同じ系統のため、element.animate()(Web Animations API)に統一する
  const enterAnim = p.animate(
    [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }],
    { duration: 150, easing: "ease-out", fill: "forwards" }
  );
  enterAnim.onfinish = () => {
    enterAnim.cancel();
    p.style.opacity = "1";
    p.style.transform = "translateY(0)";
  };
  revealLogLine(p, msg, () => {
    activeTypingCount = Math.max(0, activeTypingCount - 1);
    if (activeTypingCount === 0) arrow.style.display = "block";
  });
  // ログは行を追加するだけで一切消していなかったため、#battleLogは戦闘開始のたびに
  // innerHTMLごとクリアされて実質問題が起きない一方、#dungeonLogは同じ遠征中(何度も「進む」
  // を押す間)ずっと蓄積し続け、固定84pxの枠に収まりきらなくなって最下部までスクロールされ、
  // 一番上の行が枠の上端で欠けて見える不具合になっていた。ボックスの実際の高さを超えた分の
  // 古い行(矢印を除く)を削除して、常に最新の1〜3行分だけが残るようにする
  const lines = [...el.children].filter((c) => c !== arrow);
  while (lines.length > 1 && el.scrollHeight > el.clientHeight) {
    const oldest = lines.shift();
    oldest.remove();
  }
  el.scrollTop = el.scrollHeight;
}
function blog(msg) {
  battleLogLines.push(msg);
  appendTypewriterLog("battleLog", "battleLogArrow", msg);
}
// ログ全履歴の振り返り画面。#dungeonLog/#battleLogは表示領域の都合で直近数行しかDOMに残らないが、
// battleLogLines/dungeonLogLines自体は戦闘/遠征が始まってから今までの全行を(枝刈りせず)保持しているため、
// それをそのまま流し込むだけで実装できる
function showLogHistory(lines) {
  const content = document.getElementById("logHistoryContent");
  content.innerHTML = "";
  lines.forEach((msg) => {
    const p = document.createElement("p");
    p.textContent = msg;
    content.appendChild(p);
  });
  document.getElementById("logHistoryOverlay").style.display = "flex";
  content.scrollTop = content.scrollHeight; // 開いた時点で最新行が見える位置にしておく
}
function hideLogHistory() {
  document.getElementById("logHistoryOverlay").style.display = "none";
}
document.getElementById("logHistoryCloseBtn").onclick = hideLogHistory;
// パネル自体のタップは閉じない(スクロール操作を邪魔しない)よう、背景(オーバーレイ自身)への
// タップだけを閉じる条件にする
document.getElementById("logHistoryOverlay").addEventListener("click", (e) => {
  if (e.target.id === "logHistoryOverlay") hideLogHistory();
});
// テキストボックスのタップは、文字送り中なら従来通りその場でスキップ、文字送り中でなければ
// 全履歴の振り返り画面を開く(2つの役割を同じタップ操作に自然に振り分ける)
document.getElementById("battleLog").onclick = () => {
  if (activeLogFinishers.size > 0) { [...activeLogFinishers].forEach((fn) => fn()); return; }
  showLogHistory(battleLogLines);
};
document.getElementById("dungeonLog").onclick = () => {
  if (activeLogFinishers.size > 0) { [...activeLogFinishers].forEach((fn) => fn()); return; }
  showLogHistory(dungeonLogLines);
};

// ============ 背景の覗き見(.heroの何もない場所をタップでUIを消し、背景イラストをよく見せる) ============
// 2026-07-18ユーザー指示で長押し(250ms)からタップ発動へ変更。
// スクロールの開始やドラッグをタップと誤認しないよう、「押してから350ms未満・指の移動10px未満で
// 離した」場合だけをタップとみなす(スクロール解放のtouchendをタップと誤認した過去のバグと同じ教訓)。
// ボタン/リンク/inputの上からのタップは無視し(本来の操作を妨げない)、
// 発動後はbody.bg-peekを付けるだけで、実際にどの要素を隠すかはCSS側(.hero > *と.body-pad)に任せる
const BG_PEEK_TAP_MAX_MS = 350;
const BG_PEEK_TAP_MAX_MOVE_PX = 10;
function initBackgroundPeek() {
  let bgPeekActive = false;
  let tapStart = null;
  const activate = () => {
    bgPeekActive = true;
    document.body.classList.add("bg-peek");
    playSfx("select");
  };
  const deactivate = () => {
    bgPeekActive = false;
    document.body.classList.remove("bg-peek");
    playSfx("select");
  };
  document.querySelectorAll(".hero").forEach((hero) => {
    hero.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest("button, a, input")) return;
      tapStart = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    hero.addEventListener("pointerup", (e) => {
      if (!tapStart) return;
      const dx = e.clientX - tapStart.x;
      const dy = e.clientY - tapStart.y;
      const dt = performance.now() - tapStart.t;
      tapStart = null;
      if (bgPeekActive) return; // 復帰は下のdocumentキャプチャ側で処理済み
      if (dt < BG_PEEK_TAP_MAX_MS && dx * dx + dy * dy < BG_PEEK_TAP_MAX_MOVE_PX * BG_PEEK_TAP_MAX_MOVE_PX) activate();
    });
    ["pointerleave", "pointercancel"].forEach((evt) => hero.addEventListener(evt, () => { tapStart = null; }));
  });
  // 覗き見中は、画面のどこを再タップしても(ボタンの上でも)そのタップ自体は握りつぶして元に戻すだけにする
  document.addEventListener("pointerdown", (e) => {
    if (!bgPeekActive) return;
    deactivate();
    e.stopPropagation();
  }, { capture: true });
}
initBackgroundPeek();

// 戦闘中に「逃げた」(fleeState==="fled")キャラは、生きていても以後この戦闘には参加しない
