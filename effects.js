// ============ effects.js: 戦闘演出(VFX/会心演出/セリフ/状態異常アイコンとツールチップ/朱印演出) ============
function findVfxEntity(targetId) {
  const ally = fieldParty.find((c) => c.id === targetId);
  if (ally) return ally;
  return battle && battle.enemies ? battle.enemies.find((e) => e.instanceId === targetId) : null;
}

// 与えたダメージ/回復の演出(数字ポップアップ・揺れ)は、DOM要素ではなくキャラ/敵オブジェクト自身に
// 「いつ・何を表示すべきか」を記録しておく方式にする。renderPartyBar/敵カード生成が毎回このデータを見て
// その場でポップアップ要素を作るため、ターンのたびにDOM要素が作り直されても消えたり出そびれたりしない
// 敵の大技予告(bigAttackPending)が発生した瞬間、画面端を一瞬だけ橙色に光らせる警告演出。
// アニメーションを毎回頭から再生させるため、一度クラスを外してリフローを挟んでから付け直す
function triggerWarningFlash() {
  const el = document.getElementById("screenWarningFlash");
  if (!el) return;
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "screenWarningFlash 0.6s ease-out";
}
// ボス/中ボスが自分の手番で逃走を選んだ瞬間の演出(triggerBossFlee/triggerQuestBossFlee共通、battle.js参照)。
// 画面を軽く暗転させつつ中央に大きく「◯◯は逃げ出した！」の告知バナーを出し、専用SE(既存の"flee"、
// 仲間の逃走完了時と同じ音を流用)を鳴らす。逃げる本人のカードにも後ずさりして駆け去る退場アニメーションを
// 付ける。BOSS_FLEE_BANNER_MSが経過したら呼び出し元のonDone(実際の戦闘終了処理)を実行する
const BOSS_FLEE_BANNER_MS = 1400;
function playBossFleeBanner(enemy, onDone) {
  const card = findVisibleCard(enemy.instanceId);
  if (card) card.classList.add("boss-fleeing-out");
  playSfx("flee");
  const overlay = document.createElement("div");
  overlay.className = "boss-flee-banner-overlay";
  overlay.innerHTML = `<div class="boss-flee-banner-text">💨 ${enemy.label}は逃げ出した！</div>`;
  document.body.appendChild(overlay);
  setTimeout(() => { overlay.remove(); onDone(); }, BOSS_FLEE_BANNER_MS);
}
// 攻撃系のdmgポップアップ呼び出し時、技/会心なら"strong"(揺れ1.2倍)、通常攻撃なら"normal"(揺れ0.8倍)を
// 呼び出し元で明示的に渡す(毒/炎上などの継続ダメージは渡さず、常にnormal扱いにする)
function dmgShakeIntensity(isSkill) {
  return (isSkill || (typeof lastHitWasCrit !== "undefined" && lastHitWasCrit)) ? "strong" : "normal";
}
// ポップアップ(回復/毒/出血/炎上/スタン/会心の数字)が画面に出ている時間。以前は1.5秒だったが
// 「出てすぐ消えて読めない」というユーザー指摘を受けて延長した(.dmg-popのCSSアニメーション
// 時間(battle.css)ともセットで変更すること)
const POPUP_DISPLAY_MS = 2000;
// ターン開始時の毒/出血/炎上ダメージは、複数が同時に発生すると1個しかないポップアップ枠を
// 即座に奪い合い、後から発生した種類にすぐ上書きされて前の数字を読む間もなく消えていた。
// 種類ごとに間隔を空けて1つずつ表示することで、それぞれ読めるようにする
const DOT_POPUP_STAGGER_MS = 700;
function popupDotStack(targetId, dot, burnCls) {
  const entries = [];
  if (dot.poison > 0) entries.push({ text: `🦠-${dot.poison}`, cls: "poison" });
  if (dot.bleed > 0) entries.push({ text: `🩸-${dot.bleed}`, cls: "bleed" });
  if (dot.burn > 0) entries.push({ text: `🔥-${dot.burn}`, cls: burnCls || "burn" });
  entries.forEach((e, i) => setTimeout(() => popupOn(targetId, e.text, e.cls), i * DOT_POPUP_STAGGER_MS));
}
function popupOn(targetId, text, cls, intensity) {
  const entity = findVfxEntity(targetId);
  if (!entity) return;
  if (cls === "dmg") {
    entity.__shakeUntil = Date.now() + 400;
    entity.__shakeIntensity = intensity || "normal";
  }
  // 赤いダメージ数字のポップアップ表示は敵/味方問わず廃止(揺れ+フラッシュの演出のみ残す)。回復の表示は継続する
  if (cls === "dmg") return;
  entity.__popupText = text;
  entity.__popupCls = cls;
  entity.__popupAt = Date.now();
  renderVfxFor(targetId);
}
// 攻撃が命中した時に対象カードへ重ねるヒットエフェクト(職業ごとに素材/フレーム数/表示サイズが異なる)。
// カード自体はrenderBattleScreen()のたびに作り直されるため、要素をDOMに残さず「今表示されている
// カードに一度だけ追加→アニメーション完了で自分で消える」使い切り方式にしてある。
// 侍/忍/薙刀士は共通のSlashFX斬撃(通常=黄/技=ティール)、槍士は専用の金属衝撃エフェクト
// (通常=黄/技=紫)、狩人は星形の黄、砲術士は星形の赤、陰陽師は通常攻撃が槍士と共通の黄(小さめ)・
// 呪符ノ術等の技だけ紫の星形、僧侶は通常攻撃のみ陰陽師と共通の黄(小さめ)を使う
// 通常攻撃のエフェクトは全体的に90%サイズにする(スキル系は据え置き、というユーザー指示への対応)
const CLASS_ATTACK_VFX = {
  samurai:  { normal: { prefix: "assets/vfx/slash_", frames: 9, size: 454 }, skill: { prefix: "assets/vfx/slash_skill_", frames: 9, size: 504 } },
  ninja:    { normal: { prefix: "assets/vfx/slash_magenta_", frames: 9, size: 320 }, skill: { prefix: "assets/vfx/impact_ninja_skill_", frames: 4, size: 200 } },
  naginata: { normal: { prefix: "assets/vfx/slash_", frames: 9, size: 454 }, skill: { prefix: "assets/vfx/slash_skill_", frames: 9, size: 504 } }, // 侍と同素材のため、ユーザー指示でサイズも侍と揃えた
  spearman: { normal: { prefix: "assets/vfx/impact_spear_", frames: 6, size: 198 }, skill: { prefix: "assets/vfx/impact_spear_skill_", frames: 6, size: 220 } },
  priest:   { normal: { prefix: "assets/vfx/impact_spear_", frames: 6, size: 99 } },
  onmyoji:  { normal: { prefix: "assets/vfx/impact_spear_", frames: 6, size: 99 }, skill: { prefix: "assets/vfx/impact_onmyoji_", frames: 4, size: 200 } },
  hunter:   { normal: { prefix: "assets/vfx/impact_hunter_", frames: 4, size: 180 }, skill: { prefix: "assets/vfx/impact_gunner_", frames: 4, size: 200 } },
  gunner:   { normal: { prefix: "assets/vfx/impact_gunner_", frames: 4, size: 180 }, skill: { prefix: "assets/vfx/impact_gunner_", frames: 4, size: 200 } },
  // 狩人「鷹を呼ぶ」の追撃専用エントリ。侍の通常斬撃素材を流用しつつ、サイズだけ半分以下(454→200)に
  // 縮小した後、ユーザー指示でさらに1.5倍(200→300)に拡大した
  hawk:     { normal: { prefix: "assets/vfx/slash_", frames: 9, size: 300 } },
};
// 忍が変化の術で変身中の通常攻撃エフェクト(適当に既存素材から流用)。カラスは素早い爪撃きなので
// 忍本来のマゼンタ斬撃のままにし、ガマは体当たりで衝撃系、ヘビは毒々しさで紫系のエフェクトにした
const TRANSFORM_ATTACK_VFX = {
  gama: { normal: { prefix: "assets/vfx/impact_gunner_", frames: 4, size: 180 } },
  hebi: { normal: { prefix: "assets/vfx/impact_onmyoji_", frames: 4, size: 200 } },
};
const ATTACK_VFX_FRAME_MS = 30; // 1フレームあたりの表示時間。フレーム数は素材ごとに異なる(CLASS_ATTACK_VFX参照)
// startFrame: 省略時は1(先頭から通常再生)。通常攻撃のヒットストップ(battle.js
// NORMAL_ATTACK_HITSTOP_MS)は、命中と同時にこの関数を先頭から呼んで1フレーム目だけを見せ、
// ヒットストップ明けにrenderBattleScreen()でカードが作り直された後、続きのフレームから
// この関数をもう一度呼んで再開する、という2段構えで使う(renderBattleScreen()は敵カードのDOMを
// 毎回作り直すため、単純に発火を早めただけでは再描画時にVFXが消えてしまうことへの対策)
function playAttackVfx(targetId, actor, kind, startFrame) {
  const transformOverride = actor.transformForm && TRANSFORM_ATTACK_VFX[actor.transformForm];
  const cfg = (transformOverride && transformOverride[kind]) || (CLASS_ATTACK_VFX[actor.classId] && CLASS_ATTACK_VFX[actor.classId][kind]);
  if (!cfg) return; // 対応するエフェクトが設定されていない組み合わせ(僧侶のskillなど)は何も出さない
  const el = findVisibleCard(targetId);
  if (!el) return;
  let frame = startFrame || 1;
  if (frame > cfg.frames) return; // 続きが無ければ何も出さない(既に最終フレームまで再生済み)
  const img = document.createElement("img");
  img.className = "slash-vfx";
  img.style.width = cfg.size + "px";
  img.src = `${cfg.prefix}${frame}.png`;
  el.appendChild(img);
  const timer = setInterval(() => {
    frame++;
    if (frame > cfg.frames) {
      clearInterval(timer);
      img.remove();
      return;
    }
    img.src = `${cfg.prefix}${frame}.png`;
  }, ATTACK_VFX_FRAME_MS);
}
// かばう反撃(会心の返し)の演出。ダメージ計算自体はengine.js側で敵の攻撃と同時に処理されているが、
// 見た目上は「敵の攻撃を受ける→一呼吸置いてから槍士が実際に反撃する」という2段構えに分けたいという
// ユーザー指示のため、呼び出し元(battle.js)で敵の攻撃演出を出した直後にこの関数を呼び、
// GUARD_COUNTER_DELAY_MS(0.5秒)待ってから槍士側の攻撃VFX/SE/ダメージ揺れをまとめて再生する。
// onDoneは演出が一通り終わった後に呼ぶ(呼び出し元で次のターンへ進める処理を渡す)
const GUARD_COUNTER_DELAY_MS = 500;
// かばう反撃の瞬間、槍士のポートレートを一瞬「ぴょこん」と跳ねさせて攻撃している感を出す
// (自分の手番中ずっと浮遊し続ける.party-member.actingとは別枠の、一回きりのバウンス演出)
const GUARD_COUNTER_BOUNCE_MS = 400;
function playGuardCounterVisual(spearman, enemy, counterDmg, onDone) {
  setTimeout(() => {
    // 実際のHP減算とログ出力はここで初めて行う(engine.js側のhandleGuardSynergyPassivesでは
    // ダメージ量の計算のみ行い、反撃が発生した事実は伝えていない)。これによりHPバーの減少・
    // ログ・ダメージポップアップ・攻撃VFXが全て同じタイミングで発生するようになる
    enemy.hp = Math.max(0, enemy.hp - counterDmg);
    blog(`${spearman.label}はかばいながら反撃した！${enemy.label}に${counterDmg}ダメージ！`);
    popupOn(enemy.instanceId, `-${counterDmg}`, "dmg", dmgShakeIntensity(false));
    playSfx(attackSfxFor(spearman.classId));
    renderBattleScreen();
    playAttackVfx(enemy.instanceId, spearman, "normal");
    const card = findVisibleCard(spearman.id);
    if (card) {
      card.classList.add("counter-bounce");
      setTimeout(() => card.classList.remove("counter-bounce"), GUARD_COUNTER_BOUNCE_MS);
    }
    setTimeout(onDone, 500);
  }, GUARD_COUNTER_DELAY_MS);
}
// 狩人「鷹を呼ぶ」の追撃演出: 鷹のイラスト(assets/vfx/hawk.png)が狩人の位置から対象へ飛んでいき、
// 着弾で侍の通常攻撃と同じ斬撃エフェクト+SEを鳴らした後、少しヒットストップしてからUターンで
// 元の位置に戻って消える。(見た目のサイズだけ侍の半分以下に抑えたCLASS_ATTACK_VFX.hawkを使う)
const HAWK_PROJECTILE_MS = 306; // ユーザー指示で速度0.8倍(220ms→275ms)からさらに10%減速(275/0.9=305.5→306ms)
const HAWK_HITSTOP_MS = 80; // 着弾後、Uターンを始めるまでの一呼吸
function playHawkAttackVfx(hunterActor, targetId) {
  const strike = () => {
    // 通常の被ダメージ揺れを対象に発生させる。着弾はrenderBattleScreen()から数百ms遅れて
    // 非同期に起きる(既に次のターンに進んでいる可能性がある)ため、再描画は挟まずカード要素へ
    // 直接shakeClassFor相当のクラスを付け外しする(popupOn自体はentity側の状態記録のみ)
    popupOn(targetId, "", "dmg", "normal");
    const card = findVisibleCard(targetId);
    if (card) {
      const shakeClasses = shakeClassFor(findVfxEntity(targetId)).trim().split(" ").filter(Boolean);
      card.classList.add(...shakeClasses);
      setTimeout(() => card.classList.remove(...shakeClasses), 400);
    }
    playAttackVfx(targetId, { classId: "hawk" }, "normal");
    playSfx(attackSfxFor("samurai"));
  };
  // 飛翔中(往路〜復路)は、飛んでいる本体と紛らわしいため狩人ポートレートの鷹バッジを一時的に隠す。
  // hawkFlightActiveフラグはrenderPartyBar側の表示条件にも効くので、飛翔中にrenderBattleScreen()が
  // 挟まってポートレートDOMが作り直されても(直接のstyle操作は失われても)バッジは隠れたままになる
  hunterActor.hawkFlightActive = true;
  const setBadgeHidden = (hidden) => {
    const card = findVisibleCard(hunterActor.id);
    const badge = card && card.querySelector(".hawk-badge");
    if (badge) badge.style.display = hidden ? "none" : "";
  };
  const endFlight = () => {
    hunterActor.hawkFlightActive = false;
    setBadgeHidden(false);
    // 飛翔中に(敵ターン等で)renderBattleScreen()が挟まっていた場合、その時点ではまだ
    // hawkFlightActive=trueでバッジ自体が描画されていない。style操作だけでは戻せないため、
    // 念のため味方バーを再描画してバッジの有無を現在の状態に合わせ直す
    if (battle && document.getElementById("battlePartyBar")) {
      renderPartyBar("battlePartyBar", fieldParty.filter((c) => c.fleeState !== "fled"), battle.actingId);
    }
  };
  setBadgeHidden(true);
  const fromEl = findVisibleCard(hunterActor.id);
  const toEl = findVisibleCard(targetId);
  if (!fromEl || !toEl) { strike(); endFlight(); return; }
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();
  const fromX = fromRect.left + fromRect.width / 2;
  const fromY = fromRect.top + fromRect.height / 2;
  const toX = toRect.left + toRect.width / 2;
  const toY = toRect.top + toRect.height / 2;
  const bird = document.createElement("img");
  bird.className = "hawk-projectile";
  bird.src = "assets/vfx/hawk.png";
  document.body.appendChild(bird);
  const outbound = bird.animate([
    { transform: `translate(${fromX}px, ${fromY}px) scale(0.8)`, opacity: 1 },
    { transform: `translate(${toX}px, ${toY}px) scale(1.15)`, opacity: 1 },
  ], { duration: HAWK_PROJECTILE_MS, easing: "ease-in", fill: "forwards" });
  outbound.onfinish = () => {
    strike(); // 着弾の瞬間に攻撃が発生する
    setTimeout(() => {
      const inbound = bird.animate([
        { transform: `translate(${toX}px, ${toY}px) scale(1.15)`, opacity: 1 },
        { transform: `translate(${fromX}px, ${fromY}px) scale(0.8)`, opacity: 0 },
      ], { duration: HAWK_PROJECTILE_MS, easing: "ease-out", fill: "forwards" });
      inbound.onfinish = () => { bird.remove(); endFlight(); };
    }, HAWK_HITSTOP_MS);
  };
}
// 会心専用の演出。通常攻撃の処理そのものは一切変更せず、会心が発生した時だけ追加で呼ぶ。
// 「ヒットストップ」は本物の処理停止ではなく、通常の斬撃エフェクト/シェイクが鳴った直後に
// 一呼吸(80ms)置いてから、追加のご褒美演出(画面全体の揺れ・特大金色ダメージ数字・白閃光/衝撃波/
// 火花・「クリティカル！」バナー・専用SE)がまとめて畳み掛ける、という「間→ドカン」の2段構えで
// 気持ちよさを表現している。全体の演出時間はヒットストップ80ms+効果本体約250msで0.3秒強に収めてある
const CRIT_HITSTOP_MS = 80;
// 会心の画面揺れ: 戦闘画面の固定要素(背景/敵表示・行動選択)自体のtransformにCSS変数経由で
// オフセットを足し込む方式。以前はbody要素にtransformを掛けてposition:fixedの子要素ごと
// 揺らしていたが、その方式だとfixed要素の基準(containing block)がviewportからbodyに切り替わり、
// 実機で画面が一瞬ジャンプする不具合が起きたため、揺らしたい要素そのものを直接動かす方式に変更した。
// .party-barは過去にtransform常時付与でiOS Safariの再描画不具合を起こした前科があるため対象から除外している
const SCREEN_SHAKE_FRAMES = [[0, 0], [-6, 3], [5, -3], [-3, 2], [2, -1], [0, 0]];
const SCREEN_SHAKE_DURATION_MS = 180;
function playScreenShakeCrit() {
  const targets = [document.getElementById("battleBg"), document.getElementById("battleTop"), document.querySelector(".battle-actions")].filter(Boolean);
  if (targets.length === 0) return;
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / SCREEN_SHAKE_DURATION_MS);
    const idx = Math.min(SCREEN_SHAKE_FRAMES.length - 1, Math.floor(t * (SCREEN_SHAKE_FRAMES.length - 1)));
    const [dx, dy] = SCREEN_SHAKE_FRAMES[idx];
    targets.forEach((el) => { el.style.setProperty("--crit-shake-x", `${dx}px`); el.style.setProperty("--crit-shake-y", `${dy}px`); });
    if (t < 1) requestAnimationFrame(step);
    else targets.forEach((el) => { el.style.removeProperty("--crit-shake-x"); el.style.removeProperty("--crit-shake-y"); });
  }
  requestAnimationFrame(step);
}
function playCritEffects(targetId, actor, dmg) {
  setTimeout(() => {
    playScreenShakeCrit();
    playSfx(critSfxFor(actor.classId));
    const el = findVisibleCard(targetId);
    if (!el) return;
    const pop = document.createElement("div");
    pop.className = "dmg-pop crit";
    pop.textContent = `-${dmg}`;
    el.appendChild(pop);
    setTimeout(() => pop.remove(), 1150);
    const flash = document.createElement("div");
    flash.className = "crit-flash-overlay";
    el.appendChild(flash);
    setTimeout(() => flash.remove(), 220);
    const wave = document.createElement("div");
    wave.className = "crit-shockwave";
    el.appendChild(wave);
    setTimeout(() => wave.remove(), 300);
    for (let i = 0; i < 6; i++) {
      const spark = document.createElement("div");
      spark.className = "crit-spark";
      const angle = Math.random() * Math.PI * 2;
      const dist = 18 + Math.random() * 14;
      spark.style.setProperty("--spark-x", `${Math.cos(angle) * dist}px`);
      spark.style.setProperty("--spark-y", `${Math.sin(angle) * dist}px`);
      spark.style.setProperty("--spark-dur", `${0.2 + Math.random() * 0.1}s`);
      el.appendChild(spark);
      setTimeout(() => spark.remove(), 320);
    }
    const banner = document.createElement("div");
    banner.className = "crit-banner";
    banner.textContent = "クリティカル！";
    el.appendChild(banner);
    setTimeout(() => banner.remove(), 520);
  }, CRIT_HITSTOP_MS);
}
// 狩人/砲術士が飛行(🪽)の敵を撃ち落とした時の演出。対象は複数(範囲技)の可能性があるので配列で受け取る。
// 1体でも撃ち落としがあれば、専用SEを鳴らし「◯◯を撃ち落とした！」をログに出す
// (以前は1秒間画面が停止していたが、ユーザー指示で廃止し即座に次へ進行するようにした)
function triggerShootDownEvents(shotDownTargets, onDone) {
  if (!shotDownTargets || shotDownTargets.length === 0) { onDone(); return; }
  shotDownTargets.forEach((t) => blog(`${t.label}を撃ち落とした！`));
  playSfx("shoot_down");
  renderBattleScreen(); // 🪽解除後の見た目(HPバー横のマーク消失)をすぐ反映する
  onDone();
}
// entityの現在のカードDOM要素に、保存済みのポップアップ/揺れ状態を反映する
// (renderPartyBar/敵カード生成の直後に呼ぶことで、その場で作られたばかりのカードにも即座に反映する)
// 同じキャラのカードは#dungeonPartyBar/#battlePartyBar/#campPartyBarなど複数の画面(.screen)に
// 同時に存在しうる(現在表示されていない画面の分もDOM上には残っている)。data-idだけで
// document.querySelector(...)すると、たまたまDOM順で先に出てくる「非表示画面側」のカードに
// マッチしてしまい、そちらはdisplay:noneの祖先を持つため getBoundingClientRect() が全て0を
// 返す、という不具合があった(敵側は#enemyRowが戦闘画面にしか存在しないため起こらなかった)。
// 複数マッチする中から実際にレイアウトされている(幅/高さが0でない)ものを選ぶ
function findVisibleCard(targetId) {
  // 担がれているキャラは自分の.party-memberを持たず、担いでいるキャラのカードに重ねた
  // .carried-badge(data-carried-id)としてしか存在しないため、そちらも検索対象に含める
  const candidates = document.querySelectorAll(`.enemy-card[data-id="${targetId}"], .party-member[data-id="${targetId}"], .carried-badge[data-carried-id="${targetId}"]`);
  for (const c of candidates) {
    const r = c.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return c;
  }
  return candidates[0] || null;
}

// ============ 敵撃破リアクション(演出ではなく「反応」) ============
// 目的は派手さではなく「倒した」という手応えを短く上質に伝えること。爆発/回転/吹き飛ばしは
// 一切使わず、transformのtranslate/scaleとopacityだけで構成する: ①白フラッシュ(40ms)
// ②攻撃側(=常に画面下の味方側)から押し返されたようにわずかに上へ(8px)+わずかに縮み(scale0.95)+
// 半透明化(opacity0.4)する(180ms) ③そのまま自然にopacity0までフェードアウトして消える(250ms)。
// renderBattleScreen()は.enemy-cardを毎回innerHTML総取っ替えで作り直すため、カード自身の上で
// このアニメーションを再生すると、演出の途中で別の理由の再描画(多段ヒットの次の1発、HPバー更新等)
// が挟まった瞬間に演出が切れてしまう(hit-shakeで実際に踏んだ地雷と同じ構造の問題)。この演出は
// 470ms前後とhit-shakeより長く、複数体同時撃破(AOE)では再描画の頻度も上がるため影響を受けやすい。
// そのためカードの見た目をクローンしてbody直下へ独立させ、Web Animations API(element.animate())で
// 再生する(hawk projectileと同じ回避パターン)。元のカードは.defeat-hidden(visibility:hidden)で
// 見た目だけ消し、レイアウト上の幅(=他の敵の並び)は演出が終わるまでそのまま確保しておく
const ENEMY_DEFEAT_FLASH_MS = 40;
const ENEMY_DEFEAT_PUSH_MS = 180;
const ENEMY_DEFEAT_FADE_MS = 250;
const ENEMY_DEFEAT_PUSH_DISTANCE_PX = 8;
function playEnemyDefeatReaction(entity, card) {
  const rect = card.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    // 画面に実際に描画されていない(=見えていない)カードなら演出自体が無意味なので、
    // 即座に完了扱いにしてrenderBattleScreen()側のフィルタから外れるようにするだけに留める
    entity.__defeatReactionState = "done";
    return;
  }
  const clone = card.cloneNode(true);
  clone.classList.remove("targetable", "charging", "entering", "defeat-hidden");
  clone.onclick = null;
  clone.style.cssText = `position:fixed; left:${rect.left}px; top:${rect.top}px; width:${rect.width}px; height:${rect.height}px; margin:0; pointer-events:none; z-index:40;`;
  document.body.appendChild(clone);

  // ①白フラッシュ: 新しいoverlay要素をopacityだけで明滅させる(transform/filterは使わない)
  const flash = document.createElement("div");
  flash.style.cssText = "position:absolute; inset:0; background:#fff; opacity:0; pointer-events:none;";
  clone.appendChild(flash);
  const flashAnim = flash.animate(
    [{ opacity: 0 }, { opacity: 0.85, offset: 0.5 }, { opacity: 0 }],
    { duration: ENEMY_DEFEAT_FLASH_MS, easing: "linear", fill: "forwards" }
  );

  // ②③押し返され+縮小+半透明化(180ms)→そのままフェードアウト(250ms)を1本のアニメーションにまとめる
  // (delayでフラッシュの後から開始し、offsetで2段階の速度/終端opacityを表現する)
  const pushFadeTotalMs = ENEMY_DEFEAT_PUSH_MS + ENEMY_DEFEAT_FADE_MS;
  const pushOffset = ENEMY_DEFEAT_PUSH_MS / pushFadeTotalMs;
  const bodyAnim = clone.animate(
    [
      { transform: "translateY(0px) scale(1)", opacity: 1, offset: 0 },
      { transform: `translateY(-${ENEMY_DEFEAT_PUSH_DISTANCE_PX}px) scale(0.95)`, opacity: 0.4, offset: pushOffset },
      { transform: `translateY(-${ENEMY_DEFEAT_PUSH_DISTANCE_PX}px) scale(0.95)`, opacity: 0, offset: 1 },
    ],
    { duration: pushFadeTotalMs, delay: ENEMY_DEFEAT_FLASH_MS, easing: "ease-out", fill: "forwards" }
  );
  bodyAnim.onfinish = () => {
    flashAnim.cancel();
    bodyAnim.cancel();
    clone.remove();
    entity.__defeatReactionState = "done"; // 再生済みフラグのみ。枠自体はrenderBattleScreen()側で外さないため再描画は不要
  };
}

function renderVfxFor(targetId) {
  const el = findVisibleCard(targetId);
  if (!el) return;
  const entity = findVfxEntity(targetId);
  if (!entity) return;
  if (entity.__popupAt && Date.now() - entity.__popupAt < POPUP_DISPLAY_MS) {
    const existing = el.querySelector(".dmg-pop");
    // 前の被弾からまだPOPUP_DISPLAY_MS経っていない状態でもう一度被弾すると、__popupAtが更新されるのに
    // 「既にポップアップがある」という判定だけで新しい数字がスキップされ、2発目以降が一切表示されなくなる
    // バグがあった。表示中の数字がどの被弾のものかをdata属性で区別し、最新の被弾なら必ず作り直す
    const alreadyShowingLatest = existing && Number(existing.dataset.popupAt) === entity.__popupAt;
    if (!alreadyShowingLatest) {
      if (existing) existing.remove();
      const pop = document.createElement("div");
      pop.className = "dmg-pop" + (entity.__popupCls ? " " + entity.__popupCls : "");
      pop.textContent = entity.__popupText;
      pop.dataset.popupAt = String(entity.__popupAt);
      const elapsed = Date.now() - entity.__popupAt;
      // カード自体がrenderBattleScreen()の再構築(innerHTML=""での作り直し)で差し替わり、
      // 表示中のポップアップごと消えてしまうことがある。その場合でも見た目上は同じ1回のポップアップに
      // 見えるよう、経過時間分だけ負のanimation-delayでアニメーションを巻き戻して途中から再開させる
      // (これをしないと、作り直しのたびにアニメーションが最初から再生され「2回表示された」ように見える)
      pop.style.animationDelay = `-${elapsed}ms`;
      el.appendChild(pop);
      const remaining = POPUP_DISPLAY_MS - elapsed;
      setTimeout(() => pop.remove(), Math.max(0, remaining));
    }
  }
  // 吹き出しは.party-member/.enemy-cardの中には置かず、専用の全画面固定レイヤー(#speechBubbleLayer)に
  // カード位置を実測して配置する(.party-barのスタッキングコンテキストの都合で、内部にどんな高い
  // z-indexを置いても探索画面側の要素の手前に出せなかったための対策)
  const layer = document.getElementById("speechBubbleLayer");
  const existingBubble = layer.querySelector(`[data-speech-id="${targetId}"]`);
  const withinWindow = entity.__speechAt && Date.now() - entity.__speechAt < SPEECH_BUBBLE_DURATION_MS;
  if (withinWindow) {
    const speechAtSnapshot = entity.__speechAt;
    const alreadyShowingLatest = existingBubble && Number(existingBubble.dataset.speechAt) === speechAtSnapshot;
    if (!alreadyShowingLatest) {
      if (existingBubble) existingBubble.remove();
      const bubble = document.createElement("div");
      bubble.className = "speech-bubble";
      bubble.textContent = entity.__speechText;
      bubble.dataset.speechId = targetId;
      bubble.dataset.speechAt = String(speechAtSnapshot);
      layer.appendChild(bubble);
      // 会心の気合いセリフ(A側)など「力の込もった発言」は、他の吹き出しと同じふわっとしたフェードではなく、
      // 一瞬で飛び出して弾む「ドンッ」という勢いのある登場にする(ダメージ演出と体感速度を揃える狙い)。
      // .speech-bubbleのベース transform(中心寄せ+GPUレイヤー昇格)はWAAPIのtransformキーフレームで
      // 丸ごと上書きされてしまうため、scaleを付け足す形で毎回同じ文字列を明示している
      const isForceful = !!entity.__speechForceful && entity.__speechForcefulAt === speechAtSnapshot;
      const bubbleBaseTransform = "translate(-50%, calc(-100% - 5px)) translateZ(0)";
      const enterKeyframes = isForceful
        ? [
            { opacity: 0, transform: `${bubbleBaseTransform} scale(0.4)`, offset: 0 },
            { opacity: 1, transform: `${bubbleBaseTransform} scale(1.22)`, offset: 0.05 },
            { opacity: 1, transform: `${bubbleBaseTransform} scale(0.92)`, offset: 0.09 },
            { opacity: 1, transform: `${bubbleBaseTransform} scale(1)`, offset: 0.14 },
            { opacity: 1, transform: `${bubbleBaseTransform} scale(1)`, offset: 0.85 },
            { opacity: 0, transform: `${bubbleBaseTransform} scale(1)`, offset: 1 },
          ]
        : [
            { opacity: 0, offset: 0 },
            { opacity: 1, offset: 0.12 },
            { opacity: 1, offset: 0.85 },
            { opacity: 0, offset: 1 },
          ];
      const fadeAnim = bubble.animate(enterKeyframes, { duration: SPEECH_BUBBLE_DURATION_MS, easing: "linear", fill: "forwards" });
      const remaining = SPEECH_BUBBLE_DURATION_MS - (Date.now() - speechAtSnapshot);
      setTimeout(() => { fadeAnim.cancel(); bubble.remove(); }, Math.max(0, remaining));
    }
    requestAnimationFrame(() => {
      const freshEl = findVisibleCard(targetId);
      const freshBubble = layer.querySelector(`[data-speech-id="${targetId}"][data-speech-at="${speechAtSnapshot}"]`);
      if (!freshEl || !freshBubble) return;
      const rect = freshEl.getBoundingClientRect();
      // 自キャラ(味方)の吹き出しだけ、ユーザー指示によりさらに5px下にずらす(敵はそのまま)
      const isPartySide = freshEl.classList.contains("party-member") || freshEl.classList.contains("carried-badge");
      // 4人パーティの左端/右端キャラだと、キャラ中心に吹き出しを置くと画面外にはみ出て
      // 文字が読めなくなることがあった。吹き出し自体の位置は画面内に収まるようクランプし、
      // 矢印(::after)だけ--arrow-offsetでキャラの実際の中心へずらして指し示す
      const desiredCenterX = rect.left + rect.width / 2;
      const bubbleWidth = freshBubble.getBoundingClientRect().width;
      const EDGE_MARGIN = 8;
      const minCenter = EDGE_MARGIN + bubbleWidth / 2;
      const maxCenter = window.innerWidth - EDGE_MARGIN - bubbleWidth / 2;
      const clampedCenterX = Math.min(Math.max(desiredCenterX, minCenter), maxCenter);
      const ARROW_EDGE_MARGIN = 12; // 矢印が吹き出しの丸角にめり込まないための余白
      const maxArrowOffset = Math.max(0, bubbleWidth / 2 - ARROW_EDGE_MARGIN);
      const arrowOffset = Math.min(Math.max(desiredCenterX - clampedCenterX, -maxArrowOffset), maxArrowOffset);
      freshBubble.style.left = `${clampedCenterX}px`;
      freshBubble.style.top = `${rect.top + (isPartySide ? 5 : 0)}px`;
      freshBubble.style.setProperty("--arrow-offset", `${arrowOffset}px`);
    });
  } else if (existingBubble) {
    existingBubble.remove();
  }
}
// 現在、発狂(breakdown)以外の理由で吹き出しを表示中の仲間がいるかどうか。
// 通常は同時に1人しか喋らない(発狂中のセリフだけこのミューテックスを無視して複数同時発言を許す)
function anyoneSpeaking() {
  const now = Date.now();
  return fieldParty.some((c) => c.__speechAt && c.__speechCategory !== "breakdown" && now - c.__speechAt < SPEECH_BUBBLE_DURATION_MS);
}
// 吹き出しセリフの中核処理。category に応じてspeakerの性格のセリフ配列からランダムに1つ選んで表示する
function trySpeak(speaker, category) {
  // 担がれた側(瀕死でstatus==="critical")のセリフだけは例外的に許可する
  const speakerOk = speaker && (speaker.status === "active" || (category === "carried" && speaker.status === "critical"));
  if (!speakerOk) return false;
  // breakdown(発狂)とallDefeated(全滅)は他のセリフより優先させるため、表示中の吹き出しがあっても構わず発言させる
  const allowConcurrent = category === "breakdown" || category === "allDefeated";
  if (!allowConcurrent && anyoneSpeaking()) return false;
  // 変化の術で変身中は、性格ごとのセリフの代わりに鳴き声を喋る
  const lines = speaker.transformForm
    ? TRANSFORM_ANIMAL_SOUNDS[speaker.transformForm]
    : DIALOGUE_LINES[category] && DIALOGUE_LINES[category][speaker.personality];
  if (!lines || !lines.length) return false;
  speaker.__speechText = lines[Math.floor(Math.random() * lines.length)];
  speaker.__speechAt = Date.now();
  speaker.__speechCategory = category;
  renderVfxFor(speaker.id);
  return true;
}

// ============ 新カテゴリの掛け合い会話システム(戦闘後の平和な掛け合い、他) ============
// trySpeak()はDIALOGUE_LINES[category][personality]からランダムに1つ選ぶ仕組みのため、
// PEACE_DIALOGUESのような「性格ペアごとに決まった1文」を明示的に喋らせる用途にはそのまま使えない。
// trySpeak()自体は変更せず、内部の「表示を確定させる」部分(__speechText/__speechAt/__speechCategoryの
// セット+renderVfxFor呼び出し)だけを、テキストを直接渡せる形で複製した薄いラッパー。
// ignoreMutex=trueの時だけ、既に誰か発言中でもミューテックス(anyoneSpeaking)を無視して表示する
// (2人の掛け合いで、Aの吹き出し表示中にBが続けて喋る自然な会話テンポを作るために使う)。
// 今後の野営会話/ボス前会話/帰還時会話/温泉会話も、この関数を使い回して実装できる
function speakExplicitLine(speaker, text, category, ignoreMutex, forceful) {
  if (!speaker || speaker.status !== "active") return false;
  if (!ignoreMutex && anyoneSpeaking()) return false;
  speaker.__speechText = text;
  speaker.__speechAt = Date.now();
  speaker.__speechCategory = category;
  // trySpeak()は変更しない方針のため__speechForcefulを一切セットしない。trySpeak()経由の発言で
  // 古いforcefulフラグが誤って使い回されないよう、フラグ自体に対応する__speechAtを一緒に記録し、
  // renderVfxFor側は両者が完全一致した時だけ「力の込もった登場」を採用する
  speaker.__speechForceful = !!forceful;
  speaker.__speechForcefulAt = speaker.__speechAt;
  renderVfxFor(speaker.id);
  return true;
}
// lineA→固定の間→lineBの順で喋らせる2人掛け合い共通処理。entryの{pA, pB, lineA, lineB}は
// 「pAの性格を持つ側がlineA(問いかけ)を先に、pBの性格を持つ側がlineB(返答)を後に言う」という
// 順序が固定の会話文なので、呼び出し側から渡される2人(member1/member2)の並び順には依存せず、
// 必ずpAと性格が一致する方をlineAの話者(先に喋る)、もう一方をlineBの話者(後に喋る)に固定する。
// (以前はmember1を無条件で先に喋らせていたため、member1の性格がpB側と一致した時に
// 返答(lineB)が問いかけ(lineA)より先に表示される逆転が起きていた不具合の修正)
// 先に喋る側の発言は既定ではミューテックスを尊重し(他の誰かが喋っている最中なら不発になる)、
// 後に喋る側は「相手との自然な会話」としてミューテックスを無視して重ねて表示する
// (ユーザー指示: 先の吹き出し表示中に後の側が続けて喋ることで実際の会話に見せる)。
// ignoreMutexForFirst=trueの時は、先に喋る側もミューテックスを無視する。
// (戦闘後の平和な掛け合いは「1回の遠征につき1回まで」等の厳しい発生条件を満たした特別な瞬間なので、
// 直前のmaybeSpeakOnFloorAdvance()の警戒/ストレス愚痴のようなアンビエントセリフとたまたま重なって
// 黙って不発になってしまうと勿体ない。peaceカテゴリのみtrueを渡して優先させる。critのような
// 頻繁に起こるカテゴリは従来どおり他の発言を尊重させたいので既定のfalseのまま)
// 先に喋る側が発言できた場合にtrueを返す
const PAIRED_DIALOGUE_GAP_MS = 2000; // 先の発言から後の発言までの固定の間(ユーザー指示で2秒固定)
// 会心セリフ(A→B)だけは、他の掛け合い(平和な掛け合い等)より短く畳み掛けるようユーザー指示で調整
const CRIT_DIALOGUE_GAP_MS = 1200;
function playPairedDialogueExchange(member1, member2, entry, category, ignoreMutexForFirst, forcefulFirst, gapMs) {
  const speaksFirst = entry.pA === member1.personality ? member1 : member2;
  const speaksSecond = speaksFirst === member1 ? member2 : member1;
  if (!speakExplicitLine(speaksFirst, entry.lineA, category, ignoreMutexForFirst, forcefulFirst)) return false;
  setTimeout(() => { speakExplicitLine(speaksSecond, entry.lineB, category, true); }, gapMs != null ? gapMs : PAIRED_DIALOGUE_GAP_MS);
  return true;
}

// 会心発生時の吹き出し判定(assets/dialogues/dialogue_crit.txt、通常攻撃/技どちらの会心でも共通)。
// 発生条件: パーティ全員のストレスが60%以下の時のみ。会心が起きるたびCRIT_DIALOGUE_TRIGGER_CHANCE(75%)で
// 発生の有無を抽選し、発生した場合は必ず会心を出した本人(A)がまずかけ声を発する。そこからさらに
// CRIT_DIALOGUE_ALLY_JOIN_CHANCE(30%)でランダムな他の仲間(B)が2秒後に反応を続ける(残り70%はAのみで完結)。
// A/Bのセリフは「特定の2人の組み合わせで固定の会話」ではなく、Aは自分の性格の持ちかけ声、Bは自分の性格の
// 持ち反応をそれぞれ独立にランダム抽選する(soloPersonalityLines、dialogues.js参照)。
// playPairedDialogueExchangeへは、抽選済みの2文をその場で組み立てた疑似エントリとして渡すことで、
// 既存の「A→2秒→B、Bはミューテックス無視」という表示ロジックをそのまま流用する
const CRIT_DIALOGUE_TRIGGER_CHANCE = 0.75;
const CRIT_DIALOGUE_ALLY_JOIN_CHANCE = 0.4;
const CRIT_DIALOGUE_STRESS_THRESHOLD = 60;
function maybeSpeakOnCrit(actor, wasCrit) {
  if (!wasCrit) return;
  const allBelowStressThreshold = fieldParty.every((c) => c.status !== "active" || (c.fatigue || 0) <= CRIT_DIALOGUE_STRESS_THRESHOLD);
  if (!allBelowStressThreshold) return;
  if (Math.random() >= CRIT_DIALOGUE_TRIGGER_CHANCE) return;
  // Aの気合いセリフは、playCritEffects()のダメージ演出(CRIT_HITSTOP_MS後にまとめて畳み掛ける)と
  // 同じタイミングで出す(以前は500ms遅れで表示され、ダメージ演出より体感で遅く感じられていた)
  setTimeout(() => {
    const kiaiLines = soloPersonalityLines("crit", actor.personality, "A");
    if (!kiaiLines.length) return; // 未読み込み/該当性格の持ちセリフが無い場合は何も言わない
    const kiaiLine = kiaiLines[Math.floor(Math.random() * kiaiLines.length)];
    const others = fieldParty.filter((c) => c.status === "active" && c.id !== actor.id);
    if (others.length > 0 && Math.random() < CRIT_DIALOGUE_ALLY_JOIN_CHANCE) {
      const ally = others[Math.floor(Math.random() * others.length)];
      const reactionLines = soloPersonalityLines("crit", ally.personality, "B");
      if (reactionLines.length > 0) {
        const reactionLine = reactionLines[Math.floor(Math.random() * reactionLines.length)];
        // Aの気合い(lineA)だけ「力の込もった登場」にする。Bの相槌(lineB)は従来通りのふわっとしたフェード
        playPairedDialogueExchange(actor, ally, { pA: actor.personality, pB: ally.personality, lineA: kiaiLine, lineB: reactionLine }, "crit", false, true, CRIT_DIALOGUE_GAP_MS);
        return;
      }
    }
    speakExplicitLine(actor, kiaiLine, "crit", false, true);
  }, CRIT_HITSTOP_MS);
}
// 槍士「かばう」使用時の一言(assets/dialogues/dialogue_guard.txt、単独発言型)。
// 20%の確率で、かばったキャラ本人が自分の性格の持ちセリフを1つ発言する
const GUARD_DIALOGUE_CHANCE = 0.2;
function maybeSpeakOnGuard(actor) {
  if (Math.random() >= GUARD_DIALOGUE_CHANCE) return;
  const lines = soloDialogueLines("guard", actor.personality);
  if (!lines.length) return;
  speakExplicitLine(actor, lines[Math.floor(Math.random() * lines.length)], "guard");
}
// 回復を受けた時の吹き出し判定(20%)。回復された本人が発言する
function maybeSpeakHealed(target) {
  if (Math.random() >= DIALOGUE_CHANCE.selfHealed) return;
  setTimeout(() => trySpeak(target, "selfHealed"), 500);
}
// 敵を全滅させた直後に呼ぶ(通常攻撃/技どちらの撃破でも共通)。「全滅させた時」のセリフ(35%、
// 他のセリフより優先=ミューテックスを無視して発言できる)を、最後に倒した本人(lastEnemyKillActor、
// engine.js側で自動記録)が65%、別の生存中の仲間が35%の割合で抽選する。全滅していなければ何もしない
function maybeSpeakAllDefeated() {
  if (aliveEnemies().length > 0) return false;
  if (Math.random() >= DIALOGUE_CHANCE.allDefeated) return false;
  const killer = lastEnemyKillActor;
  const others = fieldParty.filter((c) => c.status === "active" && (!killer || c.id !== killer.id));
  if (killer && Math.random() < 0.65) trySpeak(killer, "allDefeated");
  else if (others.length > 0) trySpeak(others[Math.floor(Math.random() * others.length)], "allDefeated");
  else if (killer) trySpeak(killer, "allDefeated");
  return true;
}
// 通常攻撃で敵を倒した直後に呼ぶ。全滅していれば全滅セリフを優先し、そうでなければ通常の撃破セリフ(25%)を抽選する
function maybeSpeakOnKill(killer, target) {
  if (!target || target.hp > 0) return;
  if (maybeSpeakAllDefeated()) return;
  if (Math.random() < DIALOGUE_CHANCE.normalKill) trySpeak(killer, "normalKill");
}
// ダメージ判定の前後でHPを比較し、瀕死ライン(30%)を新たに下回った瞬間だけ判定する(20%)。
// 本人か、ランダムな他の仲間のどちらかが発言する
function checkPinchTrigger(target, hpBefore) {
  if (!target || target.status !== "active" || !(target.maxHp > 0)) return;
  const wasAbove = hpBefore / target.maxHp > 0.3;
  const nowAtOrBelow = target.hp / target.maxHp <= 0.3 && target.hp > 0;
  if (!wasAbove || !nowAtOrBelow) return;
  if (Math.random() >= DIALOGUE_CHANCE.pinch) return;
  setTimeout(() => {
    const others = fieldParty.filter((c) => c.status === "active" && c.id !== target.id);
    if (others.length > 0 && Math.random() < 0.5) trySpeak(others[Math.floor(Math.random() * others.length)], "allyPinch");
    else trySpeak(target, "selfPinch");
  }, 500);
}
// 探索中、「進む」でフロアが変わるたびに呼ぶ。パーティ平均レベルに対して階層が深すぎる時の警戒セリフ(40%)を判定する。
// ストレスを抱えている仲間の愚痴セリフ(stressLight/Mid/High)のトリガーは一時停止中
function maybeSpeakOnFloorAdvance() {
  const alive = fieldParty.filter((c) => c.status === "active");
  if (alive.length === 0) return;
  const avgLevel = alive.reduce((sum, c) => sum + c.level, 0) / alive.length;
  if (currentFloor > avgLevel * DANGER_FLOOR_LEVEL_MULT && Math.random() < DIALOGUE_CHANCE.dangerFloor) {
    trySpeak(alive[Math.floor(Math.random() * alive.length)], "dangerFloor");
  }
}
// entity(キャラ/敵オブジェクト)の__shakeUntilを見て、まだ揺れる時間内ならクラス名を返す。
// __shakeUntilの猶予(400ms)は揺れ本体のCSSアニメーション(144〜216ms)より長いため、アニメーション自体は
// もう終わっているのにまだ「揺れ中判定」の期間が残っていることがある。この期間中にコマンドボタン押下等で
// renderBattleScreen()が再実行されると、.enemy-card/.party-memberはinnerHTML総取っ替えで新しいDOM要素に
// 作り直されるため、同じshakeクラスが付いた新要素にCSSアニメーションが最初から再生され、
// 「コマンドを押すたびにイラストがちかちかする」ように見える不具合があった。1回の被弾(=__shakeUntilの値)
// につき最初の描画だけクラスを付与し、以降の再描画では付けないようにして再生を1回きりにする
function shakeClassFor(entity) {
  if (!entity.__shakeUntil || entity.__shakeUntil <= Date.now()) return "";
  if (entity.__shakeRenderedFor === entity.__shakeUntil) return "";
  entity.__shakeRenderedFor = entity.__shakeUntil;
  const intensityClass = entity.__shakeIntensity === "strong" ? "hit-shake-strong" : "hit-shake-normal";
  return ` hit-shake hit-flash ${intensityClass}`;
}
// 状態異常/バフ/デバフアイコン1個分のHTMLを組み立てる。data-status属性にSTATUS_TOOLTIPSのキーを
// 埋め込み、ホバー/長押しの説明表示(index.html下部のイベント委譲)から共通の辞書一発で拾えるようにする
function statusIconHtml(key, value) {
  const t = STATUS_TOOLTIPS[key];
  if (!t || !ICONS[key]) return "";
  return `<span class="status-icon" data-status="${key}">${ICONS[key]}${value != null ? `<span class="status-icon-value">${value}</span>` : ""}</span>`;
}
// 毒/炎上/スタン/沈黙/大技の構えの状態アイコンを名前の横に表示する
function statusIconsFor(entity) {
  let s = "";
  if (entity.poison > 0) s += statusIconHtml("poison", entity.poison);
  if (entity.burnTurns > 0) s += statusIconHtml("burn", entity.burnTurns);
  if (entity.bleed > 0) s += statusIconHtml("bleed", entity.bleed);
  if (entity.stunTurns > 0) s += statusIconHtml("stun");
  if (entity.silenceTurns > 0) s += statusIconHtml("silence");
  if (entity.statMods && entity.statMods.some((m) => m.stat === "spd" && m.mult < 1)) s += statusIconHtml("tangle");
  // 大技の構え中(bigAttackPending)は、HPバー横の💢マーク(big-attack-warning-icon)だけで示す。
  // 以前はここ(状態異常アイコン列)にも三角形の警告SVGを重複して出していたが、
  // 同じ情報を2箇所で示すのは冗長なため削除した(ユーザー指示)。ツールチップは💢側に統合済み
  return s;
}

// ============ 状態異常/温泉効果アイコンの説明ツールチップ(PC:ホバー/スマホ:タップ) ============
// イベント委譲で実装しているため、.status-icon/.onsen-buff-tagがどの画面のどのタイミングで
// 描画されても(再描画のたびにDOM要素が作り直されても)個別にイベントを貼り直す必要が無い。
// 温泉効果(.onsen-buff-tag、宿屋の名簿・出発準備画面の「血行促進」等の表示)も状態異常アイコンと
// 全く同じ見た目・操作方法でタップすると効果説明が出るようにしてあり、かつ「温泉効果」という
// 見出しを必ず添えることで、状態異常ではなくバフ(温泉に入って得た良い効果)だと分かるようにしている
const STATUS_TOOLTIP_FADE_MS = 100;
let statusTooltipAnim = null;
// title/desc/iconHtml/categoryを直接指定してツールチップを出す共通処理(位置計算・フェードインを担う)。
// showStatusTooltip(状態異常/温泉効果アイコン)とshowSkillTooltip(戦闘中の技ボタン長押し)の両方から使う
function showTooltipContent(el, title, desc, iconHtml, category) {
  const tip = document.getElementById("statusTooltip");
  tip.innerHTML = `${category ? `<div class="status-tooltip-category">${category}</div>` : ""}<div class="status-tooltip-title">${iconHtml ? iconHtml + " " : ""}${title}</div><div>${desc}</div>`;
  tip.style.display = "block";
  const rect = el.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  const EDGE_MARGIN = 8;
  let left = rect.left + rect.width / 2 - tipRect.width / 2;
  left = Math.min(Math.max(left, EDGE_MARGIN), window.innerWidth - tipRect.width - EDGE_MARGIN);
  let top = rect.top - tipRect.height - 8;
  if (top < EDGE_MARGIN) top = rect.bottom + 8; // 画面上端に近い時だけアイコンの下側に出す
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  if (statusTooltipAnim) statusTooltipAnim.cancel();
  tip.style.opacity = "0";
  statusTooltipAnim = tip.animate([{ opacity: 0 }, { opacity: 1 }], { duration: STATUS_TOOLTIP_FADE_MS, fill: "forwards" });
}
function showStatusTooltip(el) {
  let title, desc, iconHtml, category;
  if (el.classList.contains("onsen-buff-tag")) {
    const buff = ONSEN_BUFFS.find((b) => b.key === el.dataset.onsenBuff);
    if (!buff) return;
    title = buff.name; desc = buff.desc; iconHtml = "♨️"; category = "温泉効果";
  } else {
    const info = STATUS_TOOLTIPS[el.dataset.status];
    if (!info) return;
    title = info.title; desc = info.desc; iconHtml = ICONS[el.dataset.status] || ""; category = null;
  }
  showTooltipContent(el, title, desc, iconHtml, category);
}
function hideStatusTooltip() {
  if (statusTooltipAnim) { statusTooltipAnim.cancel(); statusTooltipAnim = null; }
  document.getElementById("statusTooltip").style.display = "none";
  statusTooltipShownFor = null;
}
const TOOLTIP_TARGET_SELECTOR = ".status-icon, .onsen-buff-tag";
// PC: マウスホバー。pointerover/pointerout(mouseover/mouseoutと同じくバブルするので委譲できる)を
// pointerType==="mouse"に限定することで、タッチ操作時に発火する合成pointer/mouseイベントを除外する
document.addEventListener("pointerover", (e) => {
  if (e.pointerType !== "mouse") return;
  const el = e.target.closest(TOOLTIP_TARGET_SELECTOR);
  if (el) showStatusTooltip(el);
});
document.addEventListener("pointerout", (e) => {
  if (e.pointerType !== "mouse") return;
  if (e.target.closest(TOOLTIP_TARGET_SELECTOR)) hideStatusTooltip();
});
// スマホ: タップで表示し、そのまま指を離しても消えない。もう一度同じアイコンをタップするか、
// 画面のどこか他の場所をタップすると消える(以前の0.5秒長押し方式から変更)
let statusTooltipShownFor = null; // 現在表示中の.status-icon/.onsen-buff-tag要素(nullなら非表示)
document.addEventListener("touchend", (e) => {
  const el = e.target.closest(TOOLTIP_TARGET_SELECTOR);
  if (el) {
    if (statusTooltipShownFor === el) {
      hideStatusTooltip();
      statusTooltipShownFor = null;
    } else {
      showStatusTooltip(el);
      statusTooltipShownFor = el;
    }
  } else if (statusTooltipShownFor) {
    hideStatusTooltip();
    statusTooltipShownFor = null;
  }
}, { passive: true });

// ============ 戦闘中の技ボタン長押しで効果説明を出す ============
// 状態異常アイコン等と違い、これらのボタンは「タップ=技を使う」という本来の役割があるため
// 同じタップ判定は使えない。長押し(BATTLE_SKILL_LONGPRESS_MS)を検知した時だけツールチップを出し、
// その直後に発生するclickイベントをキャプチャ段階で握りつぶして技が誤発動しないようにする
const BATTLE_SKILL_LONGPRESS_MS = 450;
function showSkillTooltip(el, title, desc) {
  if (!desc) return;
  showTooltipContent(el, title, desc, "", "技の効果");
}
function attachSkillLongPressTooltip(btn, title, desc) {
  if (!desc) return;
  let timer = null;
  let longPressed = false;
  const release = () => {
    clearTimeout(timer);
    timer = null;
    if (longPressed) hideStatusTooltip(); // 長押し中に指を離したら(=プレビューを見終わったら)ツールチップを閉じる
  };
  btn.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    longPressed = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      longPressed = true;
      showSkillTooltip(btn, title, desc);
    }, BATTLE_SKILL_LONGPRESS_MS);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((evt) => btn.addEventListener(evt, release));
  // capture:trueでボタン自身のonclick(技を使う本来の処理)より先に割り込み、長押し直後のclickだけ握りつぶす
  btn.addEventListener("click", (e) => {
    if (longPressed) {
      e.preventDefault();
      e.stopImmediatePropagation();
      longPressed = false;
    }
  }, { capture: true });
}

function playTransformEffect(onDone) {
  playSfx("transform");
  playSmokeBombEffect(onDone);
}
// 奉行所の依頼受注演出。①紙が少し拡大→②0.1秒静止→③印鑑が回転しながら落下→④着地の瞬間に
// ヒットストップ+紙が揺れる+SE+埃→⑤朱印(受領)がインクの染み込みのように現れる→⑥印鑑が上へ戻る、
// という一連の流れをsetTimeoutでの直列オーケストレーション(CSSアニメーション自体はクラス付与のみ)で作る
const QUEST_STAMP_TIMINGS = { paperScaleMs: 120, holdMs: 100, sealFallMs: 320, hitstopMs: 60, markMs: 200, liftHoldMs: 250, finalWaitMs: 400 };
function playQuestAcceptStamp(title, onDone) {
  const overlay = document.getElementById("questAcceptStampOverlay");
  const paper = document.getElementById("questStampPaper");
  const seal = document.getElementById("questStampSeal");
  const mark = document.getElementById("questStampMark");
  const dust = document.getElementById("questStampDust");
  document.getElementById("questStampPaperTitle").textContent = title;
  // 前回分のクラスをリセットしてから表示する(同じアニメーションを毎回最初からやり直せるように)
  paper.className = "quest-stamp-paper";
  seal.className = "quest-stamp-seal";
  mark.className = "quest-stamp-mark";
  dust.className = "quest-stamp-dust";
  overlay.style.display = "flex";
  requestAnimationFrame(() => {
    paper.classList.add("scale-up"); // ①→②紙が少し拡大
    setTimeout(() => {
      // ③0.1秒静止の後、印鑑が落下
      seal.classList.add("falling");
      setTimeout(() => {
        // ④着地の瞬間: 60msのヒットストップを置いてから、紙の揺れ+SE+埃をまとめて出す
        setTimeout(() => {
          paper.classList.add("impact-shake");
          dust.classList.add("burst");
          playSfx("quest_accept");
          // ⑤朱印(受領)が現れる
          mark.classList.add("show");
          setTimeout(() => {
            // ⑥印鑑が上へ戻る
            seal.classList.add("retreat");
            setTimeout(() => {
              overlay.style.display = "none";
              onDone();
            }, QUEST_STAMP_TIMINGS.finalWaitMs);
          }, QUEST_STAMP_TIMINGS.markMs);
        }, QUEST_STAMP_TIMINGS.hitstopMs);
      }, QUEST_STAMP_TIMINGS.sealFallMs);
    }, QUEST_STAMP_TIMINGS.paperScaleMs + QUEST_STAMP_TIMINGS.holdMs);
  });
}
