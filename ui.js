// ============ ui.js: 画面横断で使う共通UI部品(背景プリロード・ヘッダー・ボタン配置・パーティバー・ログ表示・結果バナー等) ============
const BG_SETS = {
  town: { dawn: "assets/bg/town_dawn.jpg", asa: "assets/bg/town_asa.jpg", day: "assets/bg/town.jpg", dusk: "assets/bg/town_dusk.jpg", night: "assets/bg/town_night.jpg" },
  tavern: { dawn: "assets/bg/tavern_dawn.jpg", asa: "assets/bg/tavern_asa.jpg", day: "assets/bg/tavern.jpg", dusk: "assets/bg/tavern_dusk.jpg", night: "assets/bg/tavern_night.jpg" },
  dungeon: { dawn: "assets/bg/forest_dawn.jpg", asa: "assets/bg/forest_asa.jpg", day: "assets/bg/forest_day.jpg", dusk: "assets/bg/forest_dusk.jpg", night: "assets/bg/forest_night.jpg" },
  coast: { dawn: "assets/bg/coast_dawn.jpg", asa: "assets/bg/coast_asa.jpg", day: "assets/bg/coast_day.jpg", dusk: "assets/bg/coast_dusk.jpg", night: "assets/bg/coast_night.jpg" },
  onsen: { day: "assets/bg/onsen.jpg", night: "assets/bg/onsen_night.jpg" },
  departure: { dawn: "assets/bg/departure_gate_dawn.jpg", asa: "assets/bg/departure_gate_asa.jpg", day: "assets/bg/departure_gate.jpg", dusk: "assets/bg/departure_gate_dusk.jpg", night: "assets/bg/departure_gate_night.jpg" },
  teaHouse: { dawn: "assets/bg/teahouse_dawn.jpg", asa: "assets/bg/teahouse_asa.jpg", day: "assets/bg/teahouse_day.jpg", dusk: "assets/bg/teahouse_dusk.jpg", night: "assets/bg/teahouse_night.jpg" },
};
// 探索/戦闘の背景・野営背景は森/海岸のどちらのステージ中かで出し分ける
function currentAreaBgSet() { return currentStage === "coast" ? BG_SETS.coast : BG_SETS.dungeon; }
function currentCampBgUrl() { return currentStage === "coast" ? "assets/bg/coast_camp.jpg" : "assets/bg/camp_night.jpg"; }
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
function updateSceneBackgrounds() {
  const tod = state.timeOfDay || "day";
  const dayLike = dayLikeOf(tod);
  document.getElementById("townHero").style.backgroundImage = `url('${BG_SETS.town[tod]}')`;
  document.getElementById("tavernHero").style.backgroundImage = `url('${BG_SETS.tavern[tod]}')`;
  document.getElementById("statusHero").style.backgroundImage = `url('${BG_SETS.tavern[tod]}')`;
  document.getElementById("dungeonBgInner").style.backgroundImage = `url('${currentAreaBgSet()[tod]}')`;
  document.getElementById("battleBg").style.backgroundImage = `url('${currentAreaBgSet()[tod]}')`;
  document.getElementById("onsenHero").style.backgroundImage = `url('${BG_SETS.onsen[dayLike]}')`;
  document.getElementById("shopHero").style.backgroundImage = `url('${BG_SETS.town[tod]}')`;
  document.getElementById("partySelectHeroInner").style.backgroundImage = `url('${BG_SETS.departure[tod]}')`;
  document.getElementById("resultHero").style.backgroundImage = `url('${BG_SETS.town[tod]}')`;
  document.getElementById("extensionHero").style.backgroundImage = `url('${BG_SETS.town[tod]}')`;
  // 奉行所だけこの一覧から漏れており、専用の絵が無いため常に真っ黒(背景未設定)のまま表示されていた不具合を修正。
  // 他の「町の施設だが専用の絵が無い」画面(道具屋/増築/リザルト)と同じくtownの絵を流用する
  document.getElementById("magistrateHero").style.backgroundImage = `url('${BG_SETS.town[tod]}')`;
  document.getElementById("teaHouseHero").style.backgroundImage = `url('${BG_SETS.teaHouse[tod]}')`;
}
// 瀕死ロスト判定・保存・背景更新は共通処理として括り出し、
// 時間帯フェーズの進め方(applyPhase、時計に触る場合は呼び出し元でsyncClockToPhaseまで行う)だけを呼び出し元ごとに変える
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
  if (c.status === "critical") {
    if (c.carriedBy) {
      const carrier = getRosterChar(c.carriedBy);
      return `${carrier ? carrier.name : "仲間"}に担がれている(里に着けば回復する)`;
    }
    return `${c.criticalStage === "coast" ? "海岸" : "深淵の森"} ${c.criticalFloor}層目で瀕死(あと約${criticalTimeLeftStr(c)}で救出しないとロスト)`;
  }
  return "ロスト(消滅した)";
}
// 瀕死キャラのロストまでの残り時間を「◯日◯時間」形式にする(statusLabel/瀕死救出アラート共通)
function criticalTimeLeftStr(c) {
  const minutesLeft = Math.max(0, (c.criticalExpireMinutes || 0) - absoluteGameMinutes());
  const totalHoursLeft = Math.floor(minutesLeft / 60);
  const daysLeft = Math.floor(totalHoursLeft / 24);
  const hoursLeft = totalHoursLeft % 24;
  return hoursLeft > 0 ? `${daysLeft}日${hoursLeft}時間` : `${daysLeft}日`;
}

function statusTagClass(c) {
  if (c.status === "active" && isOnsenLocked(c, absoluteGameMinutes())) return "bathing";
  if (c.status === "active" && c.onsenBuffKey) return "onsen-buffed";
  return c.status;
}

// 名簿の全員が稼働不能(瀕死/ロスト)になり、かつ新しく雇う手段も残っていなければ、もう手詰まりなのでゲームオーバーにする。
// 「新しく雇う手段」は所持金(HIRE_COST以上)だけでなく名簿の空き枠(rosterCapacity())も両方必要。
// 家レベル1のうちはrosterCapacity()が2人しかないため、その2人とも稼働不能になった時点で所持金が
// いくらあっても新規雇用の枠自体が無く実質詰みになる(旧実装は所持金しか見ておらずこのケースを見逃していた)。
// trueを返した場合、呼び出し元(renderTown)は通常の町画面表示を打ち切ってゲームオーバー画面に切り替える
function checkGameOver() {
  if (state.roster.length === 0) return false;
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
function playVictoryBanner(onDone) {
  const overlay = document.getElementById("resultBannerOverlay");
  const text = document.getElementById("resultBannerText");
  overlay.className = "result-banner-overlay victory";
  text.className = "result-banner-text victory";
  text.textContent = "勝利";
  overlay.style.display = "flex";
  playSfx("victory");
  setTimeout(() => {
    overlay.style.display = "none";
    onDone();
  }, 550);
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
  goldEl.textContent = `収穫: +${advGoldEarned}G`;
  goldEl.classList.remove("reveal-in");
  const xpHeading = document.getElementById("resultXpHeading");
  xpHeading.classList.remove("reveal-in");
  const list = document.getElementById("resultXpList");
  list.innerHTML = "";
  const participants = state.roster.filter((c) => (advXpGained[c.id] || 0) > 0);
  if (participants.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">今回は経験値を得られなかった。</p>';
  }
  participants.forEach((c) => {
    const c2 = CLASSES[c.classId];
    const gained = advXpGained[c.id] || 0;
    const isMax = c.level >= MAX_LEVEL;
    const need = isMax ? 0 : xpToNext(c.level);
    const currentRatio = isMax ? 100 : Math.max(0, Math.min(100, (c.xp / need) * 100));
    const gainRatio = isMax ? 0 : Math.max(0, Math.min(currentRatio, (Math.min(gained, c.xp) / need) * 100));
    const baseRatio = Math.max(0, currentRatio - gainRatio);
    const levelBefore = advLevelBefore[c.id] || c.level;
    const leveledUp = c.level > levelBefore;
    const row = document.createElement("div");
    row.className = "card result-xp-row";
    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <strong>${c.name}(${c2.ja})</strong>
        <span style="font-size:0.8rem;color:var(--accent);">+${gained} XP</span>
      </div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.15rem;">Lv.${c.level}${isMax ? "(MAX)" : ""}</div>
      ${leveledUp ? `<div class="levelup-badge">⭐レベルアップ！ Lv.${levelBefore}→${c.level}</div>` : ""}
      <div class="xpbar-track">
        <div class="xpbar-fill" style="width:${baseRatio}%"></div>
        <div class="xpbar-gain" style="left:${baseRatio}%;width:${gainRatio}%"></div>
      </div>
    `;
    list.appendChild(row);
  });
  updateSceneBackgrounds();
  // リザルト画面ではBGMを止める(currentBgmKeyもリセットし、続ける押下後の
  // playTownAreaBgm()が同じキーでも確実に再開できるようにする)
  bgmAudio.pause();
  currentBgmKey = null;
  if (!isDefeat) playSfx("result"); // 敗北時は専用SEが無いため無音のまま(賑やかな結果音を流用しない)
  continueBtn.onclick = () => { onContinue(); };
  showScreen("screen-result");
  // 収穫→経験値の順に時間差で浮かび上がらせる(一括表示にしない)
  setTimeout(() => { if (questCard.style.display !== "none") questCard.classList.add("reveal-in"); }, 80);
  setTimeout(() => { goldEl.classList.add("reveal-in"); }, 260);
  setTimeout(() => {
    xpHeading.classList.add("reveal-in");
    list.querySelectorAll(".result-xp-row").forEach((row, i) => {
      setTimeout(() => row.classList.add("reveal-in"), i * 90);
    });
  }, 460);
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

function showRestSummary(panelId, listId, nextBtnId, beforeSnapshot, onNext, showStress = true) {
  const panel = document.getElementById(panelId);
  const list = document.getElementById(listId);
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
          ${showStress ? `<div class="camp-rest-stress">ストレス -${fatigueDelta}</div>` : ""}
        </div>
      </div>
    `;
  }).join("");
  panel.style.display = "flex";
  activateHpTrails(list);
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
  bigAttackPending: '⚡',
  guarding: '🛡',
  carrying: '🎒',
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
function hpBarHtml(entity) {
  const ratio = entity.maxHp > 0 ? Math.max(0, entity.hp / entity.maxHp) * 100 : 0;
  const prevRatio = entity.__hpDisplayRatio != null ? entity.__hpDisplayRatio : ratio;
  entity.__hpDisplayRatio = ratio;
  const lowClass = ratio < 30 ? " low" : "";
  const isHeal = ratio > prevRatio;
  const healTrailHtml = isHeal
    ? `<div class="hpbar-heal-trail" data-hp-heal-trail data-from="${prevRatio}" data-target="${ratio}" style="width:${prevRatio}%"></div>`
    : "";
  return `<div class="hpbar-track"><div class="hpbar-fill-trail" data-hp-trail data-from="${prevRatio}" data-target="${ratio}" style="width:${prevRatio}%"></div><div class="hpbar-fill${lowClass}" style="width:${ratio}%"></div>${healTrailHtml}</div>`;
}
// 描画直後の赤ゲージ/回復用シアンゲージを、記録しておいた目標値までアニメーションさせて追いつかせる。
// CSS transitionを「別のタイミングでinline styleを書き換えて発火させる」方式は、環境によっては
// (実測したところheadless Chromiumでも)トランジションが一切発火せず一瞬で目標値に飛んでしまう
// ことがあったため、Web Animations API(element.animate())で確実にアニメーションさせる方式にした。
// 回復用ゲージは追いついたら(アニメーション完了時)非表示にする
function activateHpTrails(container) {
  const HP_TRAIL_MS = 250;
  const trails = container.querySelectorAll("[data-hp-trail]");
  const healTrails = container.querySelectorAll("[data-hp-heal-trail]");
  trails.forEach((el) => {
    const from = Number(el.dataset.from);
    const target = Number(el.dataset.target);
    if (from === target) return;
    const anim = el.animate([{ width: `${from}%` }, { width: `${target}%` }], { duration: HP_TRAIL_MS, easing: "ease-out", fill: "forwards" });
    anim.onfinish = () => { anim.cancel(); el.style.width = `${target}%`; };
  });
  healTrails.forEach((el) => {
    const from = Number(el.dataset.from);
    const target = Number(el.dataset.target);
    const anim = el.animate([{ width: `${from}%` }, { width: `${target}%` }], { duration: HP_TRAIL_MS, easing: "ease-out", fill: "forwards" });
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
const lastPartyBarActingId = {};
function renderPartyBar(elId, combatants, actingCharId) {
  const bar = document.getElementById(elId);
  const isFreshTurn = actingCharId != null && lastPartyBarActingId[elId] !== actingCharId;
  lastPartyBarActingId[elId] = actingCharId != null ? actingCharId : null;
  bar.innerHTML = "";
  // 担がれているキャラは自分単独のカードを持たず、担いでいるキャラのカード右上に小さく重ねて表示する
  combatants.filter((c) => !c.carriedBy).forEach((c) => {
    const dead = c.hp <= 0 || c.status !== "active";
    // 助っ人の札で編成した5人目(交代要員)。控えの間は回復薬/治癒の術の対象にできない
    const isReserve = typeof reserveFieldMember !== "undefined" && c === reserveFieldMember;
    // 変化の術で変身中は回復薬/治癒の術の対象にできない(回復不可のため、味方イラストの直接タップからも除外する)
    const targetable = !!pendingAllyPick && !dead && !c.transformForm && !isReserve;
    const div = document.createElement("div");
    const isActing = c.id === actingCharId;
    const actingClass = isActing ? (isFreshTurn ? " acting acting-enter" : " acting") : "";
    div.className = "party-member" + (dead ? " dead" : "") + actingClass + (targetable ? " targetable" : "") + (isReserve ? " reserve" : "") + shakeClassFor(c);
    div.dataset.id = c.id;
    const mpRatio = c.maxMp > 0 ? Math.max(0, c.mp / c.maxMp) * 100 : 0;
    // 担がれている本人は今回の遠征の名簿(fieldParty/combatants)に居るとは限らない(別の冒険で瀕死のまま
    // 取り残されていた仲間を、今回の探索中に見つけて担いだ場合など、deliverCarriedAlliesと同じ理由)。
    // そのためcombatants内だけでなくstate.roster全体からも探す
    const carried = combatants.find((x) => x.carriedBy === c.id) || state.roster.find((x) => x.carriedBy === c.id);
    // 忍の変化の術で変身中は、ポートレートをform専用イラストに差し替え、MPバー(概念自体が無くなる)は隠す
    const transformDef = c.transformForm ? TRANSFORM_FORMS[c.transformForm] : null;
    const portraitSrc = transformDef ? transformDef.image : characterPortraitSrc(c);
    // カラス変身中の「観察眼」: 次に行動するのがこのキャラなら青い矢印バッジを出す
    const isNextActor = anyCrowScoutActive() && nextActingCombatant() === c;
    div.innerHTML = `
      <div class="party-portrait-wrap">
        <img src="${portraitSrc}">
        ${c.passives && c.passives.omamoriBishamonPending ? `<img class="bishamon-barrier-vfx" src="assets/vfx/bishamon_barrier.png">` : ""}
        <div class="ally-debuff-icons">${statusIconsFor(c)}</div>
      </div>
      ${carried ? `<img class="carried-badge" src="${characterPortraitSrc(carried)}" data-carried-id="${carried.id}">` : ""}
      ${c.hawkTurnsLeft > 0 && !c.hawkFlightActive ? `<img class="hawk-badge" src="assets/vfx/hawk.png" title="鷹(あと${c.hawkTurnsLeft}T)">` : ""}
      ${isNextActor ? '<span class="next-actor-badge">▲次ターン行動</span>' : ""}
      ${isReserve ? '<span class="reserve-badge">控え</span>' : ""}
      ${hpBarHtml(c)}
      <div class="status-icon-row">${c.guarding ? statusIconHtml("guarding") : ""}${c.carryingId ? statusIconHtml("carrying") : ""}</div>
      ${!transformDef && c.maxMp > 0 ? `<div class="mpbar-track"><div class="mpbar-fill" style="width:${mpRatio}%"></div></div>` : ""}
      <div class="nm">${c.name}${transformDef ? ` ${transformDef.emoji}${transformDef.ja}` : ""}</div>
    `;
    if (targetable) {
      div.onclick = () => {
        if (!pendingAllyPick) return; // 既に別経路(対象一覧のテキストボタン等)で選択済みなら無視する(二重行動防止)
        const picked = pendingAllyPick;
        pendingAllyPick = null;
        picked(c);
      };
    }
    bar.appendChild(div);
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
    actions.style.top = `${Math.round(rect.bottom) + 10}px`;
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

// 瀕死(critical)のまま誰にも担がれていない(carriedByが無い)仲間は、その場に置いていかれた
// ものとしてUIから消す(担がれている場合は引き続き表示する)
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

// ============ 背景の覗き見(.heroを0.25秒長押しでUIを消し、背景イラストをよく見せる) ============
// 戦闘/探索用のattachSkillLongPressTooltip(effects.js)と同じPointer Eventsパターンを踏襲。
// ボタン/リンク/inputの上から始めた長押しは無視し(本来のタップ操作を妨げない)、
// 発動後はbody.bg-peekを付けるだけで、実際にどの要素を隠すかはCSS側(.hero > *と.body-pad)に任せる
const BG_PEEK_LONGPRESS_MS = 250; // ユーザー指示で従来の半分(500ms→250ms)
function initBackgroundPeek() {
  let bgPeekActive = false;
  let timer = null;
  const clear = () => { clearTimeout(timer); timer = null; };
  const activate = () => {
    bgPeekActive = true;
    timer = null;
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
      clear();
      timer = setTimeout(activate, BG_PEEK_LONGPRESS_MS);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((evt) => hero.addEventListener(evt, clear));
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
