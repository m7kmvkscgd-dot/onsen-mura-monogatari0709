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
  return; // 【無効化2026-08-01ユーザー指示】画面端の黄色フラッシュを試験的に停止(💢アイコン/警告音/ログは従来どおり)。戻す時はこの行を消すだけ
  const el = document.getElementById("screenWarningFlash");
  if (!el) return;
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "screenWarningFlash 0.6s ease-out";
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
  // ストレス増減ポップアップは一旦保留(ユーザー指示)。頻発するため、同じキャラの回復ポップアップの
  // 表示枠(1体につき1つしか保持できない__popupText等)を上書きして消してしまう副作用が出ていた。
  // ストレス自体の計算・蓄積処理(fatigue加減算)はそのまま残し、見た目の数字表示だけを止める
  if (cls === "stress" || cls === "stress-relief") return;
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
  // 狩人「鷹を呼ぶ」の追撃専用エントリ。ユーザー指示(2026-07-18)で侍の通常斬撃と完全に同じ
  // 見た目(同素材・同サイズ454px)にした(以前は200→300と段階的に縮小版を使っていた)
  hawk:     { normal: { prefix: "assets/vfx/slash_", frames: 9, size: 454 } },
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
// ============ 攻撃VFXのウォームアップ(iOSの出だし欠け・コマ落ち対策、2026-07-26) ============
// iOS Safariは「作りたてのDOM要素+即アニメーション」の序盤フレームを描画しないことがあり(交代の
// 走り込みで実証済み、battle.jsの常設ステージ参照)、さらにsrc差し替え式のコマ送りは各フレーム画像の
// デコードが間に合わないとコマ落ちする(PCとの体感差の正体)。対策は2段:
// ①起動時に全フレーム画像をImage.decode()で事前デコードしてメモリに保持(コマ落ち対策)
// ②表示用のimg要素を起動時に作って画面外に常駐させ、使い回す(作りたて要素の描画飲み込み対策)
const vfxWarmImages = new Map(); // url -> Image(デコード済みビットマップへの参照を保持し続ける)
function warmUpAttackVfxAssets() {
  const addSet = (set) => {
    if (!set) return;
    Object.values(set).forEach((c) => {
      if (!c || !c.prefix) return;
      for (let f = 1; f <= c.frames; f++) {
        const url = `${c.prefix}${f}.png`;
        if (vfxWarmImages.has(url)) continue;
        const im = new Image();
        im.src = url;
        if (im.decode) im.decode().catch(() => {});
        vfxWarmImages.set(url, im);
      }
    });
  };
  Object.values(CLASS_ATTACK_VFX).forEach(addSet);
  Object.values(TRANSFORM_ATTACK_VFX).forEach(addSet);
}
// 表示用の常駐プール。範囲攻撃で複数同時に出るためVFX_POOL_SIZE個用意し、使う時だけ対象カードの
// 中央(実測座標)へ移動する。全部使用中の場合だけ従来の使い切り方式にフォールバックする
const VFX_POOL_SIZE = 6;
let attackVfxPool = null;
function getAttackVfxPool() {
  if (attackVfxPool) return attackVfxPool;
  attackVfxPool = [];
  for (let i = 0; i < VFX_POOL_SIZE; i++) {
    const img = document.createElement("img");
    img.className = "slash-vfx-pooled";
    img.src = "assets/vfx/slash_1.png"; // 何かしら表示させて「描画済みの温まった状態」にしておく
    document.body.appendChild(img);
    attackVfxPool.push({ img, busy: false });
  }
  return attackVfxPool;
}
function playAttackVfx(targetId, actor, kind, startFrame) {
  const transformOverride = actor.transformForm && TRANSFORM_ATTACK_VFX[actor.transformForm];
  const cfg = (transformOverride && transformOverride[kind]) || (CLASS_ATTACK_VFX[actor.classId] && CLASS_ATTACK_VFX[actor.classId][kind]);
  if (!cfg) return; // 対応するエフェクトが設定されていない組み合わせ(僧侶のskillなど)は何も出さない
  const el = findVisibleCard(targetId);
  if (!el) return;
  let frame = startFrame || 1;
  if (frame > cfg.frames) return; // 続きが無ければ何も出さない(既に最終フレームまで再生済み)
  const slot = getAttackVfxPool().find((s) => !s.busy);
  if (slot) {
    // 常駐プール方式: 対象カードの中央へ移動してコマ送り、終わったら画面外へ戻す
    slot.busy = true;
    const img = slot.img;
    const rect = el.getBoundingClientRect();
    img.style.width = cfg.size + "px";
    img.style.left = (rect.left + rect.width / 2) + "px";
    img.style.top = (rect.top + rect.height / 2) + "px";
    img.src = `${cfg.prefix}${frame}.png`;
    const timer = setInterval(() => {
      frame++;
      if (frame > cfg.frames) {
        clearInterval(timer);
        img.style.left = "-2000px";
        slot.busy = false;
        return;
      }
      img.src = `${cfg.prefix}${frame}.png`;
    }, ATTACK_VFX_FRAME_MS);
    return;
  }
  // プール枯渇時のフォールバック(従来の使い切り方式)
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
    playScreenShakeOnKillOnly(enemy, false); // 反撃は自動発生で頻度が高いため、画面が揺れるのはとどめの時だけ
    playAttackSfxWithSwish(spearman.classId);
    renderBattleScreen();
    playAttackVfx(enemy.instanceId, spearman, "normal");
    const card = findVisibleCard(spearman.id);
    if (card) {
      // 直前の被弾で残った揺れクラスがcounter-bounceのanimationを詳細度で上書きして
      // バウンスを殺すため、先に剥がす(updateEnemyCardの踏み込みと同じ2026-07-31の修正)
      card.classList.remove(...HIT_SHAKE_CLASSES);
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
    // 直接クラスを付け外しする(popupOn自体はentity側の状態記録のみ)。
    // 【重要】shakeClassFor()経由にしない理由: あちらは「同じ揺れを二重描画しない」ための
    // __shakeRenderedForガードを持ち、popupOn直後の再描画に食われてここでは空文字が返るため、
    // 実機では鷹の着弾時に被弾モーションが出ていなかった(ユーザー報告2026-07-18)。
    // 通常被弾と同じクラス(揺れ+白フラッシュ)を無条件で直接付ける
    popupOn(targetId, "", "dmg", "normal");
    const card = findVisibleCard(targetId);
    if (card) {
      const shakeClasses = ["hit-shake", "hit-flash", "hit-shake-normal"];
      card.classList.remove(...shakeClasses);
      void card.offsetWidth; // 連続ヒット時もアニメーションを再発火させるためのリフロー
      card.classList.add(...shakeClasses);
      setTimeout(() => card.classList.remove(...shakeClasses), 400);
    }
    playAttackVfx(targetId, { classId: "hawk" }, "normal");
    playAttackSfxWithSwish("samurai");
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
  // 飛翔の出発点は狩人カードの中心ではなく、ポートレート右上に表示している鷹バッジの位置にする
  // (ユーザー指摘2026-07-18: 鷹本体はバッジのいる場所から飛んでいってほしい)。バッジはこの後
  // display:noneで隠すためgetBoundingClientRect()が測れなくなる。必ず「隠す前」にここで測っておく
  // (以前の実装はカード中心を使っていた上、修正を試みても隠した後に測ってゼロ座標になる罠があった)。
  // 万一バッジ要素が見つからない場合(再描画のタイミング等)は、バッジの定位置=カード右上を近似で使う
  const fromEl = findVisibleCard(hunterActor.id);
  const badgeEl = fromEl && fromEl.querySelector(".hawk-badge");
  const badgeRect = badgeEl ? badgeEl.getBoundingClientRect() : null;
  setBadgeHidden(true);
  const toEl = findVisibleCard(targetId);
  if (!fromEl || !toEl) { strike(); endFlight(); return; }
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();
  // .hawk-projectile(55px幅)は左上原点で配置されるため、出発時に鳥の中心がバッジの中心と
  // 重なるよう半サイズぶんずらす(バッジがそのまま羽ばたいて飛んでいくように見せる)
  const badgeCenterX = badgeRect ? badgeRect.left + badgeRect.width / 2 : fromRect.right - 12;
  const badgeCenterY = badgeRect ? badgeRect.top + badgeRect.height / 2 : fromRect.top + 10;
  const fromX = badgeCenterX - 27;
  const fromY = badgeCenterY - 20;
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
// ============ 一撃の重み演出(2026-07-25ユーザー指摘「攻撃に重みがない」対応) ============
// 通常ヒット用の軽い画面揺れ。会心のSCREEN_SHAKE_FRAMESより振幅を抑えた同方式(--crit-shake-x/y流用)。
// 会心の時は呼ばれても何もしない(playCritEffects側の重い揺れに任せ、二重に揺らさない)。
// とどめの一撃(target.hp<=0)だけは会心と同じ重い揺れへ格上げして「倒した山場」を作る。
// 敵→味方の被弾や毒などのDOTには使わない(呼び出し元は味方→敵の命中箇所のみ)
const LIGHT_SHAKE_FRAMES = [[0, 0], [-3, 2], [3, -1], [-1, 1], [0, 0]];
const LIGHT_SHAKE_DURATION_MS = 130;
function playScreenShakeOnHit(target, isCrit) {
  if (isCrit) return;
  if (target && target.hp <= 0) { playScreenShakeCrit(); return; }
  const targets = [document.getElementById("battleBg"), document.getElementById("battleTop"), document.querySelector(".battle-actions")].filter(Boolean);
  if (targets.length === 0) return;
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / LIGHT_SHAKE_DURATION_MS);
    const idx = Math.min(LIGHT_SHAKE_FRAMES.length - 1, Math.floor(t * (LIGHT_SHAKE_FRAMES.length - 1)));
    const [dx, dy] = LIGHT_SHAKE_FRAMES[idx];
    targets.forEach((el) => { el.style.setProperty("--crit-shake-x", `${dx}px`); el.style.setProperty("--crit-shake-y", `${dy}px`); });
    if (t < 1) requestAnimationFrame(step);
    else targets.forEach((el) => { el.style.removeProperty("--crit-shake-x"); el.style.removeProperty("--crit-shake-y"); });
  }
  requestAnimationFrame(step);
}
// 通常攻撃(と自動発生の反撃・式神)用: 画面シェイクは「とどめの一撃」の時だけ重い揺れを出し、
// それ以外は一切揺らさない。毎回の通常ヒットで画面が揺れるのは疲れる+「画面が動く=特別」の
// 文法が薄まるというユーザー指摘(2026-07-26)を受け、軽い揺れ(playScreenShakeOnHit)は
// 技(MP消費)・爆弾専用に整理した。会心は従来通りplayCritEffects側の重い揺れに任せる
function playScreenShakeOnKillOnly(target, isCrit) {
  if (isCrit) return;
  if (target && target.hp <= 0) playScreenShakeCrit();
}
// 攻撃の踏み込み: 行動者のカードが一瞬グッと前へ出て戻る一回きりのモーション。かばう反撃の
// counter-bounceと同じ「クラス付与→時間で剥がす」方式(iOSでtransformを常時残さない前科対応に倣う)。
// かつては通常攻撃直後の再描画(renderPartyBar)でカードごと作り直されて踏み込みがブツ切りになる
// 問題があり、進行中の踏み込みを記録して負のanimation-delayで途中復帰させる仕組み
// (activeAttackLunge/resumeAttackLungeOnCard)を挟んでいたが、差分更新化(2026-07-26)でカードDOMが
// 再描画を生き延びるようになったため撤去した。クラスを付けたら後はCSSアニメーションが完走する
const ATTACK_LUNGE_MS = 300;
function playAttackerLunge(actorId) {
  if (actorId == null) return;
  const card = findVisibleCard(actorId);
  if (!card) return;
  // 被弾で残った揺れクラスがattack-lungeのanimationを詳細度で上書きして踏み込みを殺すため、
  // 先に剥がす(updateEnemyCardの敵の踏み込みと同じ2026-07-31の修正)
  card.classList.remove(...HIT_SHAKE_CLASSES);
  card.classList.remove("attack-lunge");
  void card.offsetWidth; // 連続攻撃でも毎回最初から再生し直すためのリフロー強制
  card.classList.add("attack-lunge");
  setTimeout(() => card.classList.remove("attack-lunge"), ATTACK_LUNGE_MS);
}
// ============ 敵の攻撃モーション(mock_enemy_attack.htmlでユーザー採用2026-08-01) ============
// 通常=案A「予備動作つき踏み込み」: 身を引いて一拍溜め→鋭く味方側(下)へ踏み込む。
// 大技=案C「溜め→解放」: 画面が暗くなり赤いオーラでしゃがみ込み→爆発的に突進(白フラッシュは
// ユーザー指示で不採用)。従来は味方と共用のattackLunge(上=味方から遠ざかる向き)で安っぽかった。
// どちらもWAAPI(常駐カードDOMへのelement.animate)=iOSの作りたてDOM問題を踏まない経路
const ENEMY_ATK_ANIM_MS = 620;
const ENEMY_ATK_IMPACT_MS = 310; // 案Aの踏み込みが当たる瞬間(50%地点)。ダメージ表示はここに同期
const ENEMY_BIG_CHARGE_MS = 620;
const ENEMY_BIG_BURST_IMPACT_MS = 170; // 解放(バースト)開始から当たりまで
function enemyCardOf(actor) {
  return document.querySelector(`#enemyRow .enemy-card[data-id="${actor.instanceId}"]`);
}
function playEnemyAttackAnim(actor) {
  const card = enemyCardOf(actor);
  if (!card || !card.animate) return;
  card.classList.remove(...HIT_SHAKE_CLASSES); // 残留揺れのCSSアニメがtransformを取り合わないよう剥がす
  card.animate([
    { transform: "translateY(0) scale(1)" },
    { transform: "translateY(-9px) scale(0.97)", offset: 0.28 }, // 予備動作: 身を引く
    { transform: "translateY(-9px) scale(0.97)", offset: 0.38 }, // 一拍溜める
    { transform: "translateY(22px) scale(1.07)", offset: 0.5 },  // 鋭く踏み込む(当たる瞬間)
    { transform: "translateY(20px) scale(1.06)", offset: 0.62 },
    { transform: "translateY(0) scale(1)" },
  ], { duration: ENEMY_ATK_ANIM_MS, easing: "cubic-bezier(0.3,0.9,0.4,1)" });
}
// 大技の赤ビネット+暗転はシングルトン常駐(swap-fx-stageと同じ「温めておく」方針)
let bigAtkOverlaySingleton = null;
function getBigAtkOverlays() {
  if (bigAtkOverlaySingleton && bigAtkOverlaySingleton.dim.isConnected) return bigAtkOverlaySingleton;
  const dim = document.createElement("div");
  dim.className = "big-atk-dim";
  const vign = document.createElement("div");
  vign.className = "big-atk-vignette";
  document.body.appendChild(dim);
  document.body.appendChild(vign);
  bigAtkOverlaySingleton = { dim, vign };
  return bigAtkOverlaySingleton;
}
function playEnemyBigAttackCharge(actor, onImpact) {
  const card = enemyCardOf(actor);
  if (!card || !card.animate) { onImpact(); return; }
  card.classList.remove(...HIT_SHAKE_CLASSES);
  const { dim } = getBigAtkOverlays();
  dim.classList.add("on");
  // 赤いオーラ(立ち絵の背後)。使い捨てで生成し、解放の瞬間に消す
  const box = card.querySelector(".enemy-portrait-box");
  const aura = document.createElement("div");
  aura.className = "big-atk-aura";
  if (box) box.insertBefore(aura, box.firstChild);
  if (aura.animate) {
    aura.animate([
      { opacity: 0, transform: "translateX(-50%) scale(0.85)" },
      { opacity: 1, offset: 0.55 },
      { opacity: 0.85, transform: "translateX(-50%) scale(1.08)" },
    ], { duration: ENEMY_BIG_CHARGE_MS, easing: "ease-out", fill: "forwards" });
  }
  const crouch = card.animate([
    { transform: "translateY(0) scale(1)", filter: "brightness(1)" },
    { transform: "translateY(-6px) scale(1.02, 0.94)", filter: "brightness(0.92)", offset: 0.35 },
    { transform: "translateY(-8px) scale(1.04, 0.92)", filter: "brightness(0.88)" },
  ], { duration: ENEMY_BIG_CHARGE_MS, easing: "ease-out", fill: "forwards" });
  const release = () => {
    aura.remove();
    crouch.cancel(); // fill:forwardsのしゃがみ姿勢を解いてバーストへ引き継ぐ
    card.animate([
      { transform: "translateY(-8px) scale(1.04, 0.92)" },
      { transform: "translateY(30px) scale(1.16)", offset: 0.3 },  // 爆発的な踏み込み
      { transform: "translateY(28px) scale(1.15)", offset: 0.48 }, // 当たった瞬間を見せる
      { transform: "translateY(0) scale(1)" },
    ], { duration: 520, easing: "cubic-bezier(0.2,0.95,0.3,1)" });
    setTimeout(() => {
      dim.classList.remove("on");
      onImpact();
    }, ENEMY_BIG_BURST_IMPACT_MS);
  };
  setTimeout(release, ENEMY_BIG_CHARGE_MS + 60);
}
// 大技着弾の重み: 赤ビネット+大きめ画面揺れ(白フラッシュはユーザー指示で無し)
function playBigAtkImpactFx() {
  const { vign } = getBigAtkOverlays();
  if (vign.animate) {
    vign.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], { duration: 700, easing: "ease-out" });
  }
  playScreenShakeCrit(); // 会心と同じ画面揺れを大技の着弾にも流用
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
// ボス/中ボスの大技を味方が被弾した時だけの重い衝撃演出(通常の敵の大技には付けない、ユーザー指示)。
// playScreenShakeCrit()と同じ--crit-shake-x/y経由の画面シェイクを使い回すが、振幅を大きく(1.7倍相当)・
// 尺を長く(180ms→260ms)して「痛打を受けた」重さを出す。ヒットストップは挟まず、命中と同時に即座に発火する
// (会心は「加害側のご褒美演出」なので一呼吸置いて溜めるが、被弾側の衝撃はもたつかせず即応させたいため)
const BIG_IMPACT_SHAKE_FRAMES = [[0, 0], [-11, 7], [9, -6], [-7, 5], [5, -3], [-2, 1], [0, 0]];
const BIG_IMPACT_SHAKE_DURATION_MS = 260;
function playScreenShakeBigImpact() {
  const targets = [document.getElementById("battleBg"), document.getElementById("battleTop"), document.querySelector(".battle-actions")].filter(Boolean);
  if (targets.length === 0) return;
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / BIG_IMPACT_SHAKE_DURATION_MS);
    const idx = Math.min(BIG_IMPACT_SHAKE_FRAMES.length - 1, Math.floor(t * (BIG_IMPACT_SHAKE_FRAMES.length - 1)));
    const [dx, dy] = BIG_IMPACT_SHAKE_FRAMES[idx];
    targets.forEach((el) => { el.style.setProperty("--crit-shake-x", `${dx}px`); el.style.setProperty("--crit-shake-y", `${dy}px`); });
    if (t < 1) requestAnimationFrame(step);
    else targets.forEach((el) => { el.style.removeProperty("--crit-shake-x"); el.style.removeProperty("--crit-shake-y"); });
  }
  requestAnimationFrame(step);
}
function playBossBigAttackImpact(targetId) {
  playScreenShakeBigImpact();
  const el = findVisibleCard(targetId);
  if (!el) return;
  const flash = document.createElement("div");
  flash.className = "impact-flash-overlay";
  el.appendChild(flash);
  setTimeout(() => flash.remove(), 260);
  const wave = document.createElement("div");
  wave.className = "impact-shockwave";
  el.appendChild(wave);
  setTimeout(() => wave.remove(), 340);
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
  const candidates = document.querySelectorAll(`.enemy-card[data-id="${targetId}"], .party-member[data-id="${targetId}"]`);
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
// カードの見た目をクローンしてbody直下へ独立させ、Web Animations API(element.animate())で再生する
// (hawk projectileと同じパターン)。元は「innerHTML総取っ替えの再描画で演出が切れる」対策だったが、
// 差分更新化(2026-07-26)後もクローン方式を存続させている(引き継ぎ文書フェーズ5の「残してもよい」枠。
// body直下で再生するためカードのスタッキングコンテキストや後続のクラス変更の影響を一切受けない利点が
// ある)。元のカードは.defeat-hidden(visibility:hidden)で見た目だけ消し、レイアウト上の幅(=他の敵の
// 並び)は演出が終わるまでそのまま確保しておく
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
  // 差分更新化(2026-07-26)でカードDOMが使い回しになったため、直前のダメージポップや会心演出の
  // 一時要素がカード内に残ったままクローンに写り込むことがある。従来(毎回作りたてのカードの
  // クローン)と見た目を揃えるため、一時演出要素はクローンから取り除く
  clone.querySelectorAll(".dmg-pop, .crit-flash-overlay, .crit-shockwave, .crit-spark, .crit-banner").forEach((el) => el.remove());
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

// ============ 吹き出しテキストの自動改行整形 ============
// .speech-bubbleはmax-width:150px(全角約11文字)で成り行き折り返しになるため、15文字前後のセリフが
// 「11文字+4文字」のような不格好な位置で割れてしまう。表示直前に「文章として自然な切れ目」へ
// 明示的な改行(\n + white-space:pre-line)を入れて整える。データ側(セリフtxt等)は一切変更しない
const BUBBLE_LINE_MAX = 11; // 全角換算で1行に収まる文字数(150px ÷ 0.72rem)
const BUBBLE_BREAK_PUNCT = "、。!！?？…」〜 　"; // この直後が最優先の改行位置(のんびり口調の「〜」と空白も含む)
const BUBBLE_BREAK_PARTICLES = "はがをにでとものへねよて"; // 助詞・接続の「て」の直後は次点の改行位置
// 「て/で」の直後がこれらだと助詞ではなく単語の途中の可能性が高い(てる/てた/できる/ていく等)ので折らない
const BUBBLE_TE_DE_NG_NEXT = "るたないてでちじきしすせ";
const BUBBLE_HEAD_FORBIDDEN = "、。!！?？…」ーっんらゃゅょぁぃぅぇぉ゛゜〜 　"; // 行頭禁則(この文字で行を始めない)
function bubbleTextWidth(str) {
  let w = 0;
  for (const ch of str) w += ch.codePointAt(0) <= 0xff ? 0.5 : 1; // 半角は0.5文字扱い
  return w;
}
function formatSpeechBubbleText(text) {
  if (!text || text.includes("\n")) return text;
  const chars = [...text];
  const total = bubbleTextWidth(text);
  // 1行に収まるならそのまま。逆に2行にも収まらない長文は下手にいじらずCSSの成り行きに任せる
  if (total <= BUBBLE_LINE_MAX || total > BUBBLE_LINE_MAX * 2) return text;
  let bestPunct = null;
  let bestParticle = null;
  for (let i = 2; i <= chars.length - 2; i++) {
    const prev = chars[i - 1];
    const next = chars[i];
    if (BUBBLE_HEAD_FORBIDDEN.includes(next)) continue;
    if (prev === "「") continue; // 行末に開きかっこを残さない
    if (prev === "っ") continue; // 「言っ|て」のような促音直後で折らない
    if ((prev === "て" || prev === "で") && BUBBLE_TE_DE_NG_NEXT.includes(next)) continue;
    const left = bubbleTextWidth(chars.slice(0, i).join(""));
    const right = total - left;
    if (left > BUBBLE_LINE_MAX || right > BUBBLE_LINE_MAX || left < 2 || right < 2) continue;
    const imbalance = Math.abs(left - right); // 2行の長さが揃うほど良い
    if (BUBBLE_BREAK_PUNCT.includes(prev)) {
      if (!bestPunct || imbalance < bestPunct.imbalance) bestPunct = { i, imbalance };
    } else if (BUBBLE_BREAK_PARTICLES.includes(prev) && !BUBBLE_BREAK_PARTICLES.includes(next)) {
      if (!bestParticle || imbalance < bestParticle.imbalance) bestParticle = { i, imbalance };
    }
  }
  // 句読点・記号の直後があれば(多少長さが偏っても)そちらを優先。無ければ最も中央に近い助詞の直後
  const joinAt = (i) => chars.slice(0, i).join("").replace(/[ 　]+$/, "") + "\n" + chars.slice(i).join("").replace(/^[ 　]+/, "");
  const chosen = bestPunct || bestParticle;
  if (chosen) return joinAt(chosen.i);
  // 自然な切れ目が無い場合は中央で折る(行頭禁則の文字が来たら右へずらす)
  let mid = Math.round(chars.length / 2);
  while (mid < chars.length - 1 && (BUBBLE_HEAD_FORBIDDEN.includes(chars[mid]) || chars[mid - 1] === "「" || chars[mid - 1] === "っ")) mid++;
  if (mid <= 1 || mid >= chars.length) return text;
  return joinAt(mid);
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
      // 差分更新化(2026-07-26)以降、戦闘中の再描画でポップが消えることは無くなったが、
      // 表示中に画面が切り替わる(戦闘→探索/野営など)と、findVisibleCardが別のバーのカードを
      // 指すようになりポップを作り直す経路が今も正当に残っている。その場合でも見た目上は同じ
      // 1回のポップアップに見えるよう、経過時間分だけ負のanimation-delayで巻き戻して途中から
      // 再開させる(フェーズ5で撤去検討の結果、画面跨ぎの継続機構として存続させると判断)
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
      bubble.textContent = formatSpeechBubbleText(entity.__speechText);
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
      const isPartySide = freshEl.classList.contains("party-member");
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
  if (!speaker || speaker.status !== "active") return false;
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
  const gap = gapMs != null ? gapMs : PAIRED_DIALOGUE_GAP_MS;
  setTimeout(() => { speakExplicitLine(speaksSecond, entry.lineB, category, true); }, gap);
  // A→B→Aの3行掛け合い(tiredカテゴリの一部エントリ)は、Bの発言からさらに同じ間隔を空けて
  // Aがオチの一言を返す。2行エントリ(lineA2無し)ではこの処理は走らず従来通り
  if (entry.lineA2) {
    setTimeout(() => { speakExplicitLine(speaksFirst, entry.lineA2, category, true); }, gap * 2);
  }
  return true;
}

// 3人掛け合い(A→B→Cで全員が1回ずつ喋る)。呼び出し側(dungeon.jsのmaybeTriggerPeaceDialogue)が
// entry.pA/pB/pCと性格を照合済みのメンバーを渡してくるため、ここでは並び替えをしない。
// 間隔・ミューテックスの扱いは2人版(playPairedDialogueExchange)と同じ:
// 先頭のAだけignoreMutexForFirstに従い、B/Cは会話の続きとしてミューテックスを無視して重ねる
function playTrioDialogueExchange(mA, mB, mC, entry, category, ignoreMutexForFirst) {
  if (!speakExplicitLine(mA, entry.lineA, category, ignoreMutexForFirst)) return false;
  setTimeout(() => { speakExplicitLine(mB, entry.lineB, category, true); }, PAIRED_DIALOGUE_GAP_MS);
  setTimeout(() => { speakExplicitLine(mC, entry.lineC, category, true); }, PAIRED_DIALOGUE_GAP_MS * 2);
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
// 会心関連のちょっとしたストレス軽減(1〜2、都度個別に抽選)。会心を出した爽快感そのものと、
// 掛け声で気を紛らわせられたことは別の出来事として扱うため、両方に該当する時は重ねて軽減する
function grantCritStressRelief(c) {
  if (!c || c.status !== "active") return;
  const amount = 1 + Math.floor(Math.random() * 2);
  c.fatigue = Math.max(0, (c.fatigue || 0) - amount);
  popupOn(c.id, String(amount), "stress-relief");
}
function maybeSpeakOnCrit(actor, wasCrit) {
  if (!wasCrit) return;
  grantCritStressRelief(actor); // 会心を出した本人はセリフの有無に関わらず毎回少しストレスが和らぐ
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
        // セリフを言った本人(A=会心を出した本人、B=乗っかった仲間)はさらに気が紛れて少しストレスが和らぐ
        grantCritStressRelief(actor);
        grantCritStressRelief(ally);
        return;
      }
    }
    speakExplicitLine(actor, kiaiLine, "crit", false, true);
    grantCritStressRelief(actor);
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
// 1回の被弾(=__shakeUntilの値)につき最初の描画だけクラス名を返し、以降の再描画では空文字を返す。
// このガードが無いと、揺れ中判定の期間(400ms、揺れ本体の144〜216msより長い)にコマンドボタン押下等で
// 再描画が走るたび、呼び出し側(updateEnemyCard/updatePartyMemberCard)の「剥がして付け直す」再発火
// 処理が毎回実行され、イラストがちかちかして見える(差分更新化後もこのガードは現役で必要)
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
  if (entity.statMods && entity.statMods.some((m) => m.stat === "atk" && m.mult < 1)) s += statusIconHtml("atkDown");
  if (entity.statMods && entity.statMods.some((m) => m.stat === "def" && m.mult < 1)) s += statusIconHtml("defDown");
  if (entity.statMods && entity.statMods.some((m) => m.stat === "dmgTaken" && m.mult > 1)) s += statusIconHtml("dmgTakenUp");
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
  } else if (el.classList.contains("enemy-bigattack-tap")) {
    // 敵イラストのタップで、その敵の大技(engine.jsのbigAttackSummaryTextで機械的に生成)を確認できる
    title = `${el.dataset.enemyName}の「${el.dataset.bigattackName}」`; desc = el.dataset.bigattackDesc; iconHtml = "📜"; category = null;
  } else if (el.classList.contains("ally-lethal-warning")) {
    // ターゲットマーク左上の⚠️: 未かばう想定で大技を受けるとHPが最大の20%以下まで落ち込む可能性が高い警告
    title = "危険：致死級の一撃"; desc = el.dataset.lethalDesc; iconHtml = "⚠️"; category = null;
  } else if (el.classList.contains("ally-target-marker")) {
    // ターゲットマーク本体: 敵のイラスト+技名+簡潔な説明(1〜2行)だけを見せる(長文だと一目で読めないというユーザー指摘)
    title = el.dataset.attackName; desc = el.dataset.attackDesc;
    iconHtml = `<img src="${el.dataset.enemyImage}" class="tooltip-enemy-icon">`; category = null;
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
const TOOLTIP_TARGET_SELECTOR = ".status-icon, .onsen-buff-tag, .enemy-bigattack-tap, .ally-target-marker, .ally-lethal-warning";
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

// ============ 素材ドロップ演出(2026-07-27): 勝利時、落ちた素材のアイコンが敵の位置から
// 巾着袋(ユーザー提供イラスト)へ放物線で飛んで吸い込まれる。テキストログの「素材を手に入れた」の
// 置き換え(文章量削減のユーザー方針)。呼び出し元はbattle.js victory()。
// 演出は一回きりの使い捨てDOM(fixedレイヤーを作って終わったら丸ごと除去)で、戦闘UIの
// 差分更新デザイン(カードDOMの使い回し)には一切触れない。アニメーションは全てelement.animate()
// (CSS transition+二重rAFはiOSで不発があるため使わない方針)
// ============ 素材ドロップ演出(2026-07-27改・ユーザー提案の2段階方式) ============
// ①敵が死んだ瞬間: spawnMaterialGroundDrop()で素材アイコンがその敵の足元にポンっと跳ねて転がる
// ②勝利時: playMaterialCollectFx()で転がっている素材が0.3秒差で1個ずつ巾着袋へ吸い込まれる
// ③逃走/全滅/ボス逃走: clearMaterialGroundDrops()で置き去り(拾えない)
// 抽選と入手のロジックはbattle.js側(rollMaterialDropOnDeath/victory)。ここは表示だけ。
// 座標は全て素のviewport基準(レイヤーはinset:0のfixedで中央寄せ変換なし)。アニメーションは
// 全てelement.animate()(CSS transition+二重rAFはiOSで不発があるため使わない方針)
let matGroundLayer = null;
function ensureMatGroundLayer() {
  if (matGroundLayer && matGroundLayer.isConnected) return matGroundLayer;
  matGroundLayer = document.createElement("div");
  matGroundLayer.className = "mat-ground-layer";
  document.body.appendChild(matGroundLayer);
  return matGroundLayer;
}
// 敵カードの足元にドロップ品(素材/魂のかけら)がポンっと跳ねて落ちる。{el, x, y}を返す
// (勝利時の回収で使う)。カードが無い/実測できない場合はnull(回収時は巾着の位置で直接
// カウントされる)。rare=trueなら金の光をまとって転がる(魂のかけら用)
function spawnMaterialGroundDrop(iconSrc, card, rare) {
  const r = card ? card.getBoundingClientRect() : null;
  if (!r || r.width === 0) return null;
  const layer = ensureMatGroundLayer();
  const img = document.createElement("img");
  img.className = "mat-ground-item" + (rare ? " rare" : "");
  img.src = iconSrc;
  const x = r.left + r.width / 2 + (Math.random() * 16 - 8); // 足元で少し散らばる
  const y = r.bottom - 13;
  img.style.left = `${x - 20}px`;
  img.style.top = `${y - 20}px`;
  layer.appendChild(img);
  // ポンっと跳ね上がって落ち、小さくバウンドして静止する
  img.animate(
    [
      { transform: "translateY(0) scale(0.3)", opacity: 0 },
      { transform: "translateY(-24px) scale(1.15)", opacity: 1, offset: 0.35 },
      { transform: "translateY(0) scale(1)", offset: 0.68 },
      { transform: "translateY(-7px) scale(1)", offset: 0.84 },
      { transform: "translateY(0) scale(1)" },
    ],
    { duration: 550, easing: "ease-out", fill: "forwards" });
  return { el: img, x, y };
}
// 置き去り(逃走/全滅/ボス逃走/次の戦闘開始時の掃除): 転がっている素材を表示ごと消す
function clearMaterialGroundDrops() {
  if (matGroundLayer) { matGroundLayer.remove(); matGroundLayer = null; }
}
// 勝利時の回収: 巾着袋が現れ、転がっている素材が1個ずつ時間差で吸い込まれる
function playMaterialCollectFx(drops) {
  if (!drops || drops.length === 0) return;
  const layer = ensureMatGroundLayer();
  const colRight = Math.min(window.innerWidth, window.innerWidth / 2 + 240); // 表示カラム(最大480px)の右端
  const pouch = document.createElement("div");
  pouch.className = "mat-drop-pouch";
  pouch.style.left = `${colRight - 54 - 12}px`;
  pouch.innerHTML = `<img src="assets/icons/pouch.png" alt=""><div class="mat-drop-count">0</div>`;
  layer.appendChild(pouch);
  const countEl = pouch.querySelector(".mat-drop-count");
  const to = { x: colRight - 54 - 12 + 27, y: 200 + 27 }; // 巾着(54px角、top:200px)の中心
  // バッジは戦闘ごとの0スタートではなく「この遠征で拾った累計」の蓄積表示(ユーザー指示2026-07-27)。
  // victory()はこの演出を呼ぶ前に遠征集計(advMaterialGains/advSoulShardGained)へ今回の分を
  // 加算済みなので、「累計-今回の個数」から始めて1個収まるたびに+1すると最終値=累計になる
  let bagCount = 0;
  try {
    const matTotal = Object.values(advMaterialGains || {}).reduce((a, b) => a + b, 0);
    bagCount = Math.max(0, matTotal + (advSoulShardGained || 0) - drops.length);
  } catch (e) {}
  countEl.textContent = bagCount;
  if (bagCount > 0) countEl.classList.add("show"); // 前の戦闘までの蓄積があれば最初から見せる
  pouch.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 250, easing: "ease-out", fill: "forwards" });
  const START = 600, STAGGER = 300, D_FLY = 450; // 吸い込みは同時ではなく1個ずつ0.3秒差(ユーザー指定)
  drops.forEach((d, i) => {
    setTimeout(() => {
      if (!layer.isConnected) return;
      const arrive = () => {
        bagCount++;
        countEl.textContent = bagCount;
        countEl.classList.add("show");
        playSfx(d.rare ? "loot_rare" : "loot_item"); // 通常=置く音/レア(魂のかけら等)=風鈴(ユーザー提供SE)
        pouch.animate(
          [{ transform: "rotate(0) scale(1)" }, { transform: "rotate(-9deg) scale(1.14)", offset: 0.3 }, { transform: "rotate(7deg) scale(1.07)", offset: 0.6 }, { transform: "rotate(0) scale(1)" }],
          { duration: 340, easing: "ease-out" });
      };
      if (!d.el || !d.el.isConnected || d.x == null) { arrive(); return; } // 足元表示なしで抽選された分は直接カウント
      // 弧を描いて巾着へ(中間点を上へ持ち上げた3点キーフレーム)
      d.el.animate(
        [
          { transform: "translate(0, 0) scale(1)" },
          { transform: `translate(${(to.x - d.x) * 0.5}px, ${(to.y - d.y) * 0.5 - 46}px) scale(1.05)`, offset: 0.5 },
          { transform: `translate(${to.x - d.x}px, ${to.y - d.y}px) scale(0.4)`, opacity: 0.9 },
        ],
        { duration: D_FLY, easing: "ease-in", fill: "forwards" }).onfinish = () => { d.el.remove(); arrive(); };
    }, START + i * STAGGER);
  });
  // 最後の1個が収まってから少し置いてレイヤーごと退場
  setTimeout(() => {
    if (!layer.isConnected) return;
    layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: "ease-out", fill: "forwards" }).onfinish = () => {
      layer.remove();
      if (matGroundLayer === layer) matGroundLayer = null;
    };
  }, START + (drops.length - 1) * STAGGER + D_FLY + 900);
}

// ============ 採掘場の伐採/採掘エフェクト(2026-07-28、mock_kyoboku_chop.html v3でユーザー採用) ============
// 道具(斧/ツルハシ)のスイング→命中(閃光+破片+背景揺れ+SE)→素材が弧を描いて巾着袋へ。
// 巾着袋は戦闘の素材回収(playMaterialCollectFx)と同じ見た目・位置(.mat-drop-pouch、右端top200px)で、
// 採掘バーが開いている間は出しっぱなしにする(閉じる時にhideMiningPouch)。バッジは遠征累計(戦闘と同じ)。
// アニメーション不発環境(テスト等)でも進行が止まらないよう、回収コールバックはonfinishとsetTimeoutの両輪で駆動する
let miningPouchEl = null;
function miningPouchTotal() {
  try {
    return Object.values(advMaterialGains || {}).reduce((a, b) => a + b, 0) + (advSoulShardGained || 0);
  } catch (e) { return 0; }
}
function ensureMiningPouch() {
  if (miningPouchEl && miningPouchEl.isConnected) return miningPouchEl;
  const colRight = Math.min(window.innerWidth, window.innerWidth / 2 + 240); // 表示カラム(最大480px)の右端
  const pouch = document.createElement("div");
  pouch.className = "mat-drop-pouch";
  pouch.style.position = "fixed"; // 戦闘と違いfixedレイヤーを介さず単体で置く
  pouch.style.zIndex = "20";
  pouch.style.left = `${colRight - 54 - 12}px`;
  pouch.innerHTML = `<img src="assets/icons/pouch.png" alt=""><div class="mat-drop-count">0</div>`;
  document.body.appendChild(pouch);
  const cnt = pouch.querySelector(".mat-drop-count");
  const total = miningPouchTotal();
  cnt.textContent = total;
  if (total > 0) cnt.classList.add("show");
  pouch.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 250, easing: "ease-out", fill: "forwards" });
  miningPouchEl = pouch;
  return pouch;
}
function hideMiningPouch() {
  if (!miningPouchEl || !miningPouchEl.isConnected) { miningPouchEl = null; return; }
  const el = miningPouchEl;
  miningPouchEl = null;
  el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, easing: "ease-out", fill: "forwards" }).onfinish = () => el.remove();
  setTimeout(() => { if (el.isConnected) el.remove(); }, 400); // アニメ不発環境の保険
}
// fx = MINING_DEFSのfx定義({tool, sfx, matIcon, chipColor, chipColorBig})。onCollectは素材が巾着に収まった瞬間に1回呼ばれる
function playMiningChopFx(fx, onCollect) {
  const pouch = ensureMiningPouch();
  const W = window.innerWidth, H = window.innerHeight;
  const ix = W / 2 + 8, iy = H * 0.4; // 命中点(画面中央やや上=巨木の幹/岩壁のあたり)
  const tool = document.createElement("div");
  tool.className = "mining-fx-tool";
  tool.textContent = fx.tool;
  tool.style.left = (ix - 20) + "px";
  tool.style.top = (iy - 26) + "px";
  document.body.appendChild(tool);
  tool.animate(
    [{ transform: "translate(90px, 130px) rotate(120deg)", opacity: 0 },
     { transform: "translate(70px, 100px) rotate(105deg)", opacity: 1, offset: 0.25 },
     { transform: "translate(0px, 0px) rotate(-14deg)", opacity: 1, offset: 0.72 },
     { transform: "translate(-4px, 2px) rotate(-6deg)", opacity: 1 }],
    { duration: 340, easing: "cubic-bezier(0.5, 0, 0.2, 1)", fill: "forwards" });
  setTimeout(() => { // 命中の瞬間
    playSfx(fx.sfx);
    const slash = document.createElement("div");
    slash.className = "mining-fx-slash";
    slash.style.left = (ix - 60) + "px";
    slash.style.top = iy + "px";
    document.body.appendChild(slash);
    slash.animate([{ opacity: 0, transform: "rotate(-38deg) scaleX(0.4)" }, { opacity: 1, transform: "rotate(-38deg) scaleX(1)", offset: 0.35 }, { opacity: 0, transform: "rotate(-38deg) scaleX(1.05)" }], { duration: 200, easing: "ease-out" }).onfinish = () => slash.remove();
    setTimeout(() => { if (slash.isConnected) slash.remove(); }, 300);
    const imp = document.createElement("div");
    imp.className = "mining-fx-impact";
    imp.style.left = (ix - 30) + "px";
    imp.style.top = (iy - 30) + "px";
    document.body.appendChild(imp);
    imp.animate([{ opacity: 1, transform: "scale(0.5)" }, { opacity: 0, transform: "scale(1.6)" }], { duration: 260, easing: "ease-out" }).onfinish = () => imp.remove();
    setTimeout(() => { if (imp.isConnected) imp.remove(); }, 360);
    for (let i = 0; i < 10; i++) {
      const c = document.createElement("div");
      const big = Math.random() < 0.3;
      c.className = "mining-fx-chip" + (big ? " big" : "");
      c.style.background = big ? fx.chipColorBig : fx.chipColor;
      c.style.left = ix + "px";
      c.style.top = iy + "px";
      document.body.appendChild(c);
      const dx = (Math.random() - 0.5) * 170;
      const dy = -40 - Math.random() * 70;
      c.animate(
        [{ transform: "translate(0,0) rotate(0deg)", opacity: 1 },
         { transform: `translate(${dx * 0.6}px, ${dy}px) rotate(${dx * 3}deg)`, opacity: 1, offset: 0.45 },
         { transform: `translate(${dx}px, ${dy + 130}px) rotate(${dx * 6}deg)`, opacity: 0 }],
        { duration: 640 + Math.random() * 220, easing: "ease-out" }).onfinish = () => c.remove();
      setTimeout(() => { if (c.isConnected) c.remove(); }, 900);
    }
    // 背景揺れ: 帰還ズーム(fill:forwardsのscale)と衝突しないようcomposite:addで重ねる(非対応環境は通常適用)
    const shakeKF = [{ transform: "translate(0,0)" }, { transform: "translate(-5px,2px)" }, { transform: "translate(5px,-2px)" }, { transform: "translate(-2px,1px)" }, { transform: "translate(0,0)" }];
    ["dungeonBgInner", "dungeonBgInner2"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      try { el.animate(shakeKF, { duration: 300, easing: "ease-out", composite: "add" }); }
      catch (e) { el.animate(shakeKF, { duration: 300, easing: "ease-out" }); }
    });
    // 素材が幹/岩からポンっと跳ねて、弧を描いて巾着袋へ(戦闘の素材回収と同じ3点キーフレーム)
    setTimeout(() => {
      const mat = document.createElement("img");
      mat.className = "mining-fx-mat";
      mat.src = fx.matIcon;
      mat.style.left = (ix - 20) + "px";
      mat.style.top = (iy - 20) + "px";
      document.body.appendChild(mat);
      const pr = pouch.getBoundingClientRect();
      const tx = pr.left + pr.width / 2 - ix;
      const ty = pr.top + pr.height / 2 - iy;
      let collected = false;
      const collect = () => {
        if (collected) return;
        collected = true;
        mat.remove();
        playSfx("loot_item");
        const cnt = pouch.querySelector(".mat-drop-count");
        if (cnt) {
          cnt.textContent = miningPouchTotal();
          cnt.classList.add("show");
        }
        pouch.animate(
          [{ transform: "rotate(0) scale(1)" }, { transform: "rotate(-9deg) scale(1.14)", offset: 0.3 }, { transform: "rotate(7deg) scale(1.07)", offset: 0.6 }, { transform: "rotate(0) scale(1)" }],
          { duration: 340, easing: "ease-out" });
        if (onCollect) onCollect();
      };
      mat.animate(
        [{ transform: "translate(0,0) scale(0.3)", opacity: 0 },
         { transform: "translate(0,-30px) scale(1.1)", opacity: 1, offset: 0.3 },
         { transform: `translate(${tx * 0.5}px, ${ty * 0.5 - 46}px) scale(1.05)`, opacity: 1, offset: 0.65 },
         { transform: `translate(${tx}px, ${ty}px) scale(0.4)`, opacity: 0.9 }],
        { duration: 640, easing: "ease-in", fill: "forwards" }).onfinish = collect;
      setTimeout(collect, 720); // アニメ不発環境でも回収が止まらない保険
    }, 160);
    setTimeout(() => { if (tool.isConnected) tool.remove(); }, 380);
  }, 300);
}

// ============ 村襲撃バリケードの演出(2026-07-27、mock_barricade_damage.htmlでユーザー確認済み) ============
// 被弾: 揺れ+木片+ヒットSE。倒壊: 大揺れ→傾いて崩れ落ちる+倒壊SE→collapsedで非表示。
// 状態(HP)はbattle.js側、ここは見た目だけ
function spawnBarricadeChips(wrap, n) {
  for (let i = 0; i < n; i++) {
    const c = document.createElement("div");
    c.className = "wood-chip";
    c.style.left = (18 + Math.random() * 64) + "%";
    c.style.top = (28 + Math.random() * 18) + "%";
    wrap.appendChild(c);
    const dx = (Math.random() - 0.5) * 120;
    const dy = -30 - Math.random() * 60;
    c.animate(
      [{ transform: "translate(0,0) rotate(0deg)", opacity: 1 },
       { transform: `translate(${dx * 0.6}px, ${dy}px) rotate(${dx * 3}deg)`, opacity: 1, offset: 0.45 },
       { transform: `translate(${dx}px, ${dy + 110}px) rotate(${dx * 6}deg)`, opacity: 0 }],
      { duration: 620 + Math.random() * 200, easing: "ease-out" }).onfinish = () => c.remove();
  }
}
function playBarricadeHitFx(dmg) {
  const wrap = document.getElementById("raidBarricadeWrap");
  if (!wrap || wrap.classList.contains("collapsed")) return;
  playSfx("barricade_hit");
  // 被弾フラッシュ: 柵の絵の形どおりに一瞬白く光る(filterなのでPNGの透過部分は光らない)。
  // アニメーション中だけclassの傷みfilter(worn/critical)を上書きし、終わると自動で元に戻る
  const img = document.getElementById("raidBarricade");
  if (img) img.animate([{ filter: "brightness(2.1) saturate(0.75)" }, { filter: "brightness(1)" }], { duration: 220, easing: "ease-out" });
  const amp = dmg >= 25 ? 7 : 4;
  wrap.animate(
    [{ transform: "translate(0,0)" }, { transform: `translate(${-amp}px,1px)` }, { transform: `translate(${amp}px,-1px)` }, { transform: `translate(${-amp * 0.5}px,0)` }, { transform: "translate(0,0)" }],
    { duration: 280, easing: "ease-out" });
  spawnBarricadeChips(wrap, dmg >= 25 ? 12 : 6);
}
function playBarricadeCollapseFx() {
  const wrap = document.getElementById("raidBarricadeWrap");
  if (!wrap || wrap.classList.contains("collapsed")) return;
  playSfx("barricade_break");
  spawnBarricadeChips(wrap, 26);
  wrap.animate(
    [{ transform: "translate(0,0) rotate(0deg)", opacity: 1 },
     { transform: "translate(-8px,2px) rotate(-1deg)", offset: 0.15 },
     { transform: "translate(8px,-1px) rotate(1deg)", offset: 0.3 },
     { transform: "translate(-4px,14px) rotate(-2.5deg)", opacity: 1, offset: 0.55 },
     { transform: "translate(2px,70px) rotate(4deg)", opacity: 0 }],
    { duration: 1000, easing: "ease-in", fill: "forwards" }).onfinish = () => wrap.classList.add("collapsed");
}

// ============ 投石器の投擲演出(2026-07-29、mock_catapult_fx.htmlでユーザー確認済みのデザインを移植) ============
// 村(画面下方=味方バーの奥)から石が放物線を描いて敵カードへ飛び、着弾で土煙+カード揺れ+SE。
// ダメージ適用とログは呼び出し元(raid.jsのfireCatapultOnRoundEnd)がonImpactの中で行う。
// 石はposition:fixedでbody直下に置く(戦闘レイアウトのスタッキングコンテキストに影響されず画面を横断できる。
// 撃破演出のクローン(playEnemyDefeatReaction)と同じ考え方)
function playCatapultStoneFx(card, onImpact) {
  const rect = card.getBoundingClientRect();
  if (rect.width === 0) { onImpact(); return; } // カードが描画されていなければ演出なしで即適用
  const to = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const from = { x: window.innerWidth / 2, y: window.innerHeight - 150 };
  const stone = document.createElement("div");
  stone.style.cssText = "position:fixed; left:0; top:0; z-index:40; pointer-events:none; will-change:transform;";
  const img = document.createElement("img");
  img.src = "assets/vfx/catapult_stone.png";
  img.style.cssText = "width:26px; display:block; filter:drop-shadow(0 2px 3px rgba(0,0,0,0.7));";
  img.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: 350, iterations: Infinity });
  stone.appendChild(img);
  document.body.appendChild(stone);
  const D = 620, arcHeight = 120, startT = performance.now();
  // 着弾処理は一度きり(landed)にした上で、rAFとは別にsetTimeoutでも必ず呼ぶ。
  // rAFはタブが隠れると完全に停止するため、飛翔ループの完走だけに頼ると
  // 「ラウンドは進んだのにダメージが適用されない」という不整合が起きうる
  // (Chrome検証で実際に発生)。演出は止まってもゲーム進行は必ず正しく完了させる
  let landed = false;
  function land() {
    if (landed) return;
    landed = true;
    stone.remove();
    playSfx("barricade_hit");
    setTimeout(() => playSfx("hit_taken_2"), 40);
    spawnCatapultDust(to.x, to.y, 10);
    card.animate(
      [{ transform: "translate(0,0)" }, { transform: "translate(-3px,1px)" }, { transform: "translate(3px,-1px)" }, { transform: "translate(0,0)" }],
      { duration: 240, easing: "ease-out" });
    onImpact();
  }
  function frame(now) {
    if (landed) return;
    const p = Math.min(1, (now - startT) / D);
    const x = from.x + (to.x - from.x) * p;
    // 山なり: sin弧で高さを付ける(モックで確定した軌道そのまま)
    const y = from.y + (to.y - from.y) * p - Math.sin(Math.PI * p) * arcHeight;
    stone.style.transform = `translate(${x - 13}px, ${y - 13}px)`;
    if (p < 1) requestAnimationFrame(frame);
    else land();
  }
  requestAnimationFrame(frame);
  setTimeout(land, D + 80); // rAF停止時の保証(通常はrAF側が先に着弾させるので何もしない)
}
function spawnCatapultDust(x, y, n) {
  for (let i = 0; i < n; i++) {
    const d = document.createElement("div");
    d.style.cssText = `position:fixed; left:${x - 4}px; top:${y - 4}px; width:8px; height:8px; border-radius:50%; background:radial-gradient(circle, rgba(220,205,175,0.95), rgba(160,140,110,0)); pointer-events:none; z-index:39;`;
    document.body.appendChild(d);
    const dx = (Math.random() - 0.5) * 46, dy = -8 - Math.random() * 26;
    d.animate(
      [{ opacity: 0.9, transform: "translate(0,0) scale(1)" }, { opacity: 0, transform: `translate(${dx}px,${dy}px) scale(1.8)` }],
      { duration: 480 + Math.random() * 180, easing: "ease-out" }).onfinish = () => d.remove();
  }
}

// ============ 敵のDOT(毒/出血/炎上)停止演出(2026-07-31、モックmock_dot_vfx.htmlでユーザー承認) ============
// 敵のターン開始時にDOTの蓄積ダメージが入る瞬間、進行を一時停止して「暗転(敵カードだけスポットライトに
// 残る)→種類チップ→VFX+効果音+被弾リアクション(通常被弾と同じ白フラッシュ)→ダメージ適用」を
// 炎上→毒→出血の順に1種類ずつ見せる。ダメージ適用そのもの(tickBurn/tickPoison/tickBleed)もこの
// シーケンスが1種類ずつ直接呼ぶため、呼び出し元(battle.jsの敵ターン)はtickTurnStartEffectsに
// skipDotsを渡して二重適用を防ぐ。VFX/効果音の割り当てはAILMENT_VFX_ASSIGNMENTS(data.js、
// VFXエディタのエクスポート)から、その時点の蓄積値に最も近いstackLevelの項目を選ぶ
const DOT_STOP_HOLD_MS = 700; // 1種類ごとの停止時間(モックの選択肢からユーザーが0.7秒を採用)
const DOT_STOP_DIM_IN_MS = 260; // 暗転が乗り切ってから最初の種類を見せるまでの間
const DOT_STOP_STEP_GAP_MS = 140; // 種類と種類の間の小休止(チップの消え際)
const DOT_STOP_DIM_OUT_MS = 250; // 明転してから敵の行動フローへ戻るまでの間
const AILMENT_VFX_STAGE_PORTRAIT_W = 96; // VFXエディタのステージ敵絵の幅(px)。size/offsetの基準
function ailmentVfxAssignmentFor(ailmentId, stackValue) {
  const list = (typeof AILMENT_VFX_ASSIGNMENTS !== "undefined" ? AILMENT_VFX_ASSIGNMENTS : []).filter((a) => a.ailmentId === ailmentId);
  if (list.length === 0) return null;
  return list.reduce((best, a) => (Math.abs(a.stackLevel - stackValue) < Math.abs(best.stackLevel - stackValue) ? a : best));
}
// フリップブックVFXを敵カードの絵の中心に重ねて1回再生する。sizeとoffsetはエディタのステージ
// (敵絵96px幅)基準のpx値なので、実際の敵絵の表示幅(通常92px/大規模戦は60px以下)に比例させる
function playAilmentVfxOnCard(card, assignment) {
  if (!card || !assignment) return 0;
  const portrait = card.querySelector(".card-portrait-img");
  const scale = portrait && portrait.clientWidth > 0 ? portrait.clientWidth / AILMENT_VFX_STAGE_PORTRAIT_W : 1;
  const img = document.createElement("img");
  img.className = "dot-ailment-vfx" + (assignment.blendScreen ? " blend-screen" : "");
  img.style.width = Math.max(8, Math.round(assignment.size * scale)) + "px";
  img.style.height = "auto";
  const cx = portrait ? portrait.offsetLeft + portrait.clientWidth / 2 : card.clientWidth / 2;
  const cy = portrait ? portrait.offsetTop + portrait.clientHeight / 2 : card.clientHeight / 2;
  img.style.left = Math.round(cx + assignment.offsetX * scale) + "px";
  img.style.top = Math.round(cy + assignment.offsetY * scale) + "px";
  img.src = `${assignment.framePrefix}1.png`;
  card.appendChild(img);
  let frame = 1;
  const frameMs = assignment.frameMs || 30;
  const timer = setInterval(() => {
    frame++;
    if (frame > assignment.frameCount) { clearInterval(timer); img.remove(); return; }
    img.src = `${assignment.framePrefix}${frame}.png`;
  }, frameMs);
  // 効果音: エディタで割り当てた素材をそのまま鳴らす(エディタのプレビュー再生と同じ方式)
  if (assignment.se) {
    const se = new Audio(assignment.se);
    se.volume = 0.5;
    se.play().catch(() => {});
  }
  return assignment.frameCount * frameMs;
}
// 本体シーケンス。DOTが1つも無ければ何もせず即onDoneを呼ぶ(従来と同じ同期タイミングを保つ)
function playEnemyDotStopSequence(actor, blogFn, onDone) {
  const steps = [];
  // 処理順は炎上→毒→出血(ユーザー指定)。stackはVFXのstackLevel選択に使う現在の蓄積値/残りターン
  if (actor.burnTurns > 0) steps.push({ id: "burn", icon: "🔥", label: "炎上", popCls: actor.isPlant ? "burn-plant" : "burn", chipCls: "dot-chip-burn", stack: actor.burnTurns, tick: () => tickBurn(actor, blogFn) });
  if (actor.poison > 0) steps.push({ id: "poison", icon: "🦠", label: "毒", popCls: "poison", chipCls: "dot-chip-poison", stack: actor.poison, tick: () => tickPoison(actor, blogFn) });
  if (actor.bleed > 0) steps.push({ id: "bleed", icon: "🩸", label: "出血", popCls: "bleed", chipCls: "dot-chip-bleed", stack: actor.bleed, tick: () => tickBleed(actor, blogFn) });
  if (steps.length === 0) { onDone(); return; }
  const dim = document.getElementById("battleDotStopDim");
  if (dim) dim.classList.add("on");
  const finish = () => {
    if (dim) dim.classList.remove("on");
    setTimeout(onDone, DOT_STOP_DIM_OUT_MS);
  };
  const runStep = (i) => {
    // 途中で敵が力尽きたら残りの種類は省略して締める(死体に0ダメージの表示を続けない)
    if (!battle || i >= steps.length || actor.hp <= 0) { finish(); return; }
    const s = steps[i];
    const card = findVisibleCard(actor.instanceId);
    let chip = null;
    let vfxMs = 0;
    if (card) {
      chip = document.createElement("div");
      chip.className = `dot-stop-chip ${s.chipCls}`;
      chip.textContent = `${s.icon} ${s.label}`;
      card.appendChild(chip);
      requestAnimationFrame(() => chip.classList.add("show"));
      vfxMs = playAilmentVfxOnCard(card, ailmentVfxAssignmentFor(s.id, s.stack));
    }
    const dmg = s.tick(); // 実際のダメージ適用とログはengine.jsのtickBurn等がそのまま担当する
    if (dmg > 0) {
      popupOn(actor.instanceId, `${s.icon}-${dmg}`, s.popCls);
      // 通常攻撃の被弾と同じリアクション(白フラッシュ+ノックバック+潰れ伸び)を再発火させる
      actor.__shakeUntil = Date.now() + 400;
      actor.__shakeIntensity = "normal";
      delete actor.__shakeRenderedFor;
    }
    renderBattleScreen();
    // 停止時間はモック承認どおり「0.7秒」と「VFXの再生が終わるまで」の長い方(炎上のVFXは約1.3秒
    // あるため、一律0.7秒で切ると炎が燃えている最中に明転→敵の攻撃が始まって見えてしまう。
    // VFXが完全に消えてから次の種類/明転へ進むことで、演出終了→敵の行動モーションの順序を保証する)
    setTimeout(() => {
      if (chip) chip.remove();
      runStep(i + 1);
    }, Math.max(DOT_STOP_HOLD_MS, vfxMs - 120) + DOT_STOP_STEP_GAP_MS);
  };
  setTimeout(() => runStep(0), DOT_STOP_DIM_IN_MS);
}
// ============ 物語クエスト演出(2026-07-31、GPT/Codex量産パイプライン用) ============
// ①ボス戦前の口上(preBattleLines): 戦闘開始時に暗転オーバーレイで台詞を1行ずつ表示してから
//   戦闘に入る(タップで残り全行を即表示→もう一度タップで開始)。敵defのpreBattleLines(配列)が定義源
// ②魂の回想(soulStory): ボス撃破の勝利画面で、魂が浮かびsoulLine(一言)が表示され、
//   「残された記憶に触れる」ボタンから画像+テキストのページ送りビューアを開く(鬼滅形式)。
//   scenesの画像(image)は未提供でも動く(テキストのみのページになる)
function playPreBattleLines(enemy, onDone) {
  const lines = enemy.preBattleLines || [];
  if (!lines.length) { onDone(); return; }
  const overlay = document.createElement("div");
  overlay.className = "pre-battle-lines-overlay";
  overlay.innerHTML = `<div class="pre-battle-lines-box">${lines.map((l) => `<p>「${l}」</p>`).join("")}</div><div class="pre-battle-tap-hint">タップで進む</div>`;
  document.body.appendChild(overlay);
  const ps = [...overlay.querySelectorAll("p")];
  ps.forEach((p) => { p.style.opacity = "0"; });
  let shown = 0;
  let finished = false;
  const timers = [];
  const showNext = () => {
    if (shown >= ps.length) return;
    const p = ps[shown++];
    p.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 450, easing: "ease-out", fill: "forwards" });
    p.style.opacity = "1";
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    lines.forEach((l) => blog(`「${l}」`)); // 戦闘ログにも全行を記録として残す
    const fade = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, easing: "ease-out" });
    fade.onfinish = () => { overlay.remove(); onDone(); };
    setTimeout(() => { if (overlay.parentNode) { overlay.remove(); onDone(); } }, 600); // onfinish不発の保険
  };
  overlay.addEventListener("click", () => {
    if (shown < ps.length) { while (shown < ps.length) showNext(); } // 1タップ目: 残りを全部出す
    else finish(); // 全行表示済みならタップで戦闘開始
  });
  showNext();
  for (let i = 1; i < ps.length; i++) timers.push(setTimeout(showNext, i * 1300));
  timers.push(setTimeout(finish, ps.length * 1300 + 2200)); // 放置でも自動で戦闘へ
}

// ---- 回想の文章送り(回想演出指示v2、2026-07-31) ----
// 場面のtextを句点(。)で一文ずつに分割し、タップごとに1文追加表示する(段落の一括表示をやめた)。
// 自動送りは無し。次のタップ受付までは最低SOUL_STORY_MIN_GATE_MS空け(連打で全文が一瞬で流れるのを防ぐ)、
// 場面データのgates[文idx]で「この文の後だけ長く待つ」を上書きできる(例: 「閂を外さなかった。」の後1.5秒)。
// fadeMs[文idx]はその文のフェードイン時間の上書き(「表示速度を少し落とす」指示用、既定450ms)
const SOUL_STORY_MIN_GATE_MS = 700;
const SOUL_STORY_SCENE_FADE_MS = 700; // 場面転換の黒フェード(指示書の0.6〜0.9秒の中間)
const SOUL_STORY_LINE_HOLD_MS = 800; // 魂の一言の前の静寂(SE納品後はここに和鏡の落下音〜亀裂音が入る)
const SOUL_STORY_LINE_STEP_MS = 900; // 魂の一言が2文以上ある時の文間隔
const SOUL_STORY_BTN_DELAY_MS = 1200; // 一言が出きってから回想ボタンが現れるまで
let soulStoryGateScale = 1; // node vmテスト用の時間短縮フック(実プレイでは常に1)
function splitSoulSentences(text) {
  return (String(text || "").match(/[^。]*。|[^。]+/g) || []).map((s) => s.trim()).filter(Boolean);
}
// 勝利画面に魂の演出+回想ボタンを差し込む(battle.jsのvictory()から呼ばれる)。
// ボタンは押しても消えず、閉じたら再度読める(画面を離れるまで)。
// v2演出: 魂の一言は静寂を置いてから一文ずつ現れ、出きって少し置いてからボタンが現れる。
// 【重要】魂と一言は死んだ敵カードの中に入れない: 撃破済みカードは.defeat-hidden(visibility:hidden)
// +.dead(opacity:0.25)で、子要素をどう頑張っても見えない/薄くなる(実機で「回想が流れない」報告の原因)。
// カードの位置だけ借りて、#screen-battle直下の独立レイヤー(.soul-offer-fx)に出す。
// 演出が終わって回想ボタンが出るまでは「戻る」(battleContinueBtn)を隠し、見逃し離脱を防ぐ
function showSoulStoryOffer(enemy) {
  const story = enemy.soulStory;
  if (!story || !story.scenes || !story.scenes.length) return;
  document.querySelectorAll(".soul-offer-fx").forEach((el) => el.remove()); // 連戦の残骸掃除
  const lineSentences = splitSoulSentences(story.soulLine);
  const contBtn = document.getElementById("battleContinueBtn");
  if (contBtn) contBtn.style.display = "none"; // 演出完了(ボタン挿入)時に戻す
  const screen = document.getElementById("screen-battle") || document.body;
  const card = findVisibleCard(enemy.instanceId);
  const rect = card ? card.getBoundingClientRect() : null;
  const wrap = document.createElement("div");
  wrap.className = "soul-offer-fx";
  // visibility:hiddenのカードもレイアウト上の位置は保っているので、浮かぶ高さだけ借りる
  wrap.style.top = rect && rect.top > 0 ? `${Math.max(60, rect.top)}px` : "24vh";
  const soul = document.createElement("img");
  soul.className = "soul-rise";
  soul.src = "assets/items/soul_shard.png";
  wrap.appendChild(soul);
  const line = document.createElement("div");
  line.className = "soul-line";
  wrap.appendChild(line);
  screen.appendChild(wrap);
  lineSentences.forEach((s, i) => {
    setTimeout(() => {
      if (!wrap.isConnected) return; // 画面を離れた後は何もしない
      line.textContent = lineSentences.slice(0, i + 1).map((t) => `「${t}」`).join("");
      line.classList.add("show");
    }, (SOUL_STORY_LINE_HOLD_MS + i * SOUL_STORY_LINE_STEP_MS) * soulStoryGateScale);
  });
  // 回想ボタンは魂の一言が出きってから少し間を置いて現れる(即表示しない、指示書「1.2秒後」)。
  // 同じタイミングで「戻る」も再表示する
  const btnDelay = lineSentences.length
    ? (SOUL_STORY_LINE_HOLD_MS + (lineSentences.length - 1) * SOUL_STORY_LINE_STEP_MS + SOUL_STORY_BTN_DELAY_MS) * soulStoryGateScale
    : 0;
  setTimeout(() => {
    const grid = document.getElementById("actionGrid");
    const cont = document.getElementById("battleContinueBtn");
    if (cont) cont.style.display = "";
    if (!battle || !grid || !cont || document.getElementById("soulStoryBtn")) return;
    const btn = document.createElement("button");
    btn.className = "big soul-story-btn";
    btn.id = "soulStoryBtn";
    btn.textContent = "🕯 残された記憶に触れる";
    btn.style.gridColumn = "1/-1";
    grid.insertBefore(btn, grid.firstChild);
    btn.onclick = () => {
      playSfx("select");
      openSoulStoryViewer(enemy);
      state.soulStoriesSeen = state.soulStoriesSeen || {};
      state.soulStoriesSeen[enemy.id] = true; // 図鑑での読み返し(将来実装)用の既読記録
      saveState();
    };
  }, btnDelay);
}
function openSoulStoryViewer(enemy) {
  const scenes = enemy.soulStory.scenes;
  const overlay = document.getElementById("soulStoryOverlay");
  const img = document.getElementById("soulStoryImage");
  const textEl = document.getElementById("soulStoryText");
  const hintEl = document.getElementById("soulStoryHint");
  // 場面転換の黒フェード用レイヤー(画像もテキスト欄も覆う)。開き直しに備えてid再利用
  let fadeEl = document.getElementById("soulSceneFade");
  if (!fadeEl) {
    fadeEl = document.createElement("div");
    fadeEl.id = "soulSceneFade";
    fadeEl.className = "soul-scene-fade";
    overlay.appendChild(fadeEl);
  }
  let idx = 0;
  let sentences = [];
  let sentIdx = 0;
  let gateUntil = 0; // このミリ秒時刻までタップを受け付けない(連打防止・演出の間の確保)
  const updateHint = () => {
    if (sentIdx < sentences.length) hintEl.textContent = `タップで進む(${idx + 1}/${scenes.length})`;
    else hintEl.textContent = idx < scenes.length - 1 ? `タップで次へ(${idx + 1}/${scenes.length})` : "タップで閉じる";
  };
  const showNextSentence = () => {
    const s = scenes[idx];
    const span = document.createElement("span");
    span.textContent = sentences[sentIdx];
    span.style.opacity = "0";
    textEl.appendChild(span);
    const fadeMs = ((s.fadeMs && s.fadeMs[sentIdx]) || 450) * soulStoryGateScale;
    span.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fadeMs, easing: "ease-out", fill: "forwards" });
    span.style.opacity = "1";
    gateUntil = Date.now() + ((s.gates && s.gates[sentIdx]) || SOUL_STORY_MIN_GATE_MS) * soulStoryGateScale;
    sentIdx++;
    updateHint();
  };
  const showScene = () => {
    const s = scenes[idx];
    img.style.display = "none";
    img.onload = () => { img.style.display = ""; };
    img.onerror = () => { img.style.display = "none"; }; // 画像未提供(制作待ち)はテキストのみで見せる
    img.src = s.image || "";
    textEl.textContent = "";
    sentences = splitSoulSentences(s.text);
    sentIdx = 0;
    showNextSentence(); // 場面の1文目は自動で出す(以降はタップ)
  };
  overlay.style.display = "flex";
  overlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: "ease-out" });
  overlay.onclick = () => {
    if (Date.now() < gateUntil) return; // 間の途中のタップは飲み込む(指示書: 最低0.7秒)
    if (sentIdx < sentences.length) { showNextSentence(); return; }
    if (idx < scenes.length - 1) {
      // 場面転換: 黒フェードの往路で画像・文章を差し替え、復路で明ける。フェード中の入力も弾く
      const half = (SOUL_STORY_SCENE_FADE_MS / 2) * soulStoryGateScale;
      gateUntil = Date.now() + half * 2;
      fadeEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: half, easing: "ease-in", fill: "forwards" });
      setTimeout(() => {
        idx++;
        showScene();
        fadeEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: half, easing: "ease-out", fill: "forwards" });
      }, half);
    } else {
      const fade = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, easing: "ease-out" });
      fade.onfinish = () => { overlay.style.display = "none"; };
      setTimeout(() => { overlay.style.display = "none"; }, 600); // onfinish不発の保険
    }
  };
  showScene();
}

// ============ シームレス戦闘遷移(テストモード試行、2026-08-01ユーザー設計) ============
// 暗転を使わず、探索画面と同じ構図のまま「カメラが一歩寄る」ことで戦闘へ入る。
// 入り: 背景1→1.05倍ズーム+味方バーを8px下げつつ1→1.05倍(旧・暗転時間ぶんの650ms)。
//       敵は0.8→1.0倍のフェード出現(battle.cssのenemyAppearSeamless)。‼️の合図は従来どおり残す
// 出: 戦闘終了後、探索画面側で逆再生(1.05→1.0、8px→0)して元の探索の構図へ戻す。
// 実装はカード個々ではなく「バー/背景要素のCSS変数」をrAFで直接更新する方式
// (会心シェイクと同じ。カード個々への常時transformはiOS描画崩れの前科があるため使わない)
const SEAMLESS_CAM_MS = 650;
// 味方バーの沈み13px/拡大1.05倍/間隔10.4pxは試行その2で常時の定位置へ昇格し、
// ui.cssの.party-bar.layout-centerに静的定義として移動した(アニメーションはしない)
let seamlessBattleUsed = false; // この戦闘がシームレス入りだったか(終了時に逆再生するかの判定)
// 【試行その2(2026-08-01)】味方バーの移動(沈み/拡大/間隔広げ)は廃止: 「遭遇のたびに味方が動くのが
// しつこい」というユーザー指摘で、旧・戦闘中のカメラ寄り状態を探索・戦闘共通の常時の定位置へ
// 静的に昇格した(ui.cssの.party-bar.layout-center)。ここで動かすのは背景ズームだけになった
// ゆっくり始まってゆっくり終わるease-in-out(2026-08-01ユーザー指定: ズームの出だしが
// いきなり最大速度なのをやめる)。入り/逆再生の両方で使う
function seamlessCamEase(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
}
function seamlessBattleCameraIn() {
  seamlessBattleUsed = true;
  const bg = document.getElementById("battleBg");
  const t0 = performance.now();
  const tick = (now) => {
    if (!battle) return; // 演出中に戦闘が終わっていたら中断(後始末はteardown側)
    const t = Math.min(1, (now - t0) / SEAMLESS_CAM_MS);
    const e = seamlessCamEase(t);
    if (bg) bg.style.setProperty("--battle-zoom", String(1 + 0.05 * e));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
// 戦闘終了後の逆再生。戦闘終了処理がshowScreen("screen-dungeon")の【直前】に呼ぶ(シームレス入りの
// 戦闘だった時だけ動く)。①探索画面の共通フェードイン(screenFadeIn)を今回だけ抑止し(=これが
// 「一瞬の暗転」に見えていた)、②探索側の背景/味方バーを「寄った状態」に同期セットしてから650msで戻す
function seamlessDungeonCameraOut() {
  if (!seamlessBattleUsed) return;
  seamlessBattleUsed = false;
  const screenEl = document.getElementById("screen-dungeon");
  if (screenEl) screenEl.style.animation = "none"; // 共通のscreenFadeInを今回だけ止める(後で戻す)
  const inner = document.getElementById("dungeonBgInner");
  if (inner) inner.style.transform = "scale(1.05)";
  const t0 = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - t0) / SEAMLESS_CAM_MS);
    const e = 1 - Math.pow(1 - t, 3); // 戻しは従来のeaseOut(出だし速め)。ease-in-outは入りのみ(2026-08-01ユーザー指定)
    const s = 1.05 - 0.05 * e;
    if (inner) inner.style.transform = t < 1 ? `scale(${s})` : "";
    if (t < 1) requestAnimationFrame(tick);
    // 注意: ここでscreenEl.style.animationを""に戻してはいけない(表示中の画面のinline animation:noneを
    // 外すとscreenFadeInが頭から再生されて一瞬暗転する。復元はshowScreen側が次の画面切替時に行う)
  };
  requestAnimationFrame(tick);
}
// 戦闘側のカメラ変数の後始末(次の戦闘の開始時に必ず呼ぶ。teardown中に消すと
// 勝利画面の表示中にズームが急に戻って見えるため、消すのは次の戦闘の直前)
function resetSeamlessBattleCamera() {
  seamlessBattleUsed = false; // 前の戦闘の使用フラグも掃除(全滅→町経由などで逆再生されずに残ったケースの保険)
  const bg = document.getElementById("battleBg");
  const bar = document.getElementById("battlePartyBar");
  if (bg) bg.style.removeProperty("--battle-zoom");
  if (bar) { bar.style.removeProperty("--party-cam-y"); bar.style.removeProperty("--party-cam-s"); }
}

// ============ 味方戦闘不能(重傷/ロスト)の倒れ演出 ============
// パーマデス廃止(2026-08-01)に伴い新設。モックmock_ko_anim.htmlの案A「膝折れフェード」+
// 療養テキストON+控え登場まで0.7秒、をユーザーが採用(2026-08-01)。
// 専用SE(ally_down.mp3、実測約1.5秒)と尺を合わせるためアニメは1500ms。
// 立ち絵のimgにWAAPI(element.animate)で膝折れ→白黒沈み込みを再生し、fill:forwardsで
// 崩れた姿勢のまま残す(.deadクラスの静的グレースケールへ瞬時に切り替わるより自然なため。
// カードDOMは差分レンダラーで使い回されるので、戦闘中はアニメ結果がそのまま保持される)
const ALLY_KO_ANIM_MS = 1500;
const ALLY_KO_SE_DELAY_MS = 800; // 倒れ始めから効果音の開始までの間(2026-08-01ユーザー指定、500→800)
const ALLY_KO_COLLAPSE_MS = 350; // 倒れ演出の後にカードを畳んで消す時間(モックのcardCollapse相当)
const ALLY_KO_DEPLOY_PAUSE_MS = 700; // カードが畳まれてから控えが走り込むまでの「間」
function playAllyKoFx(c, noteText) {
  try {
    setTimeout(() => { try { playSfx("ally_down"); } catch (e) {} }, ALLY_KO_SE_DELAY_MS);
    // 演出(倒れ1.5秒+畳み0.35秒)が終わるまでは表示リストに残す猶予(battle.jsの
    // battleDisplayPartyが参照。これが無いと演出途中の再描画でカードごと消えてしまう)
    c.__koFxUntil = Date.now() + ALLY_KO_ANIM_MS + ALLY_KO_COLLAPSE_MS;
    const card = document.querySelector(`#battlePartyBar .party-member[data-id="${c.id}"]`);
    const img = card ? card.querySelector("img") : null;
    // 倒れる前に立ち絵を現在のストレス表情へ差し替える(重傷時はhandleFieldDeathsで先に
    // ストレス+100済み=発狂顔)。差し替えないと「真顔のまま倒れる」(ユーザー指摘2026-08-01)。
    // portraitKeyも同期しておかないと、次の再描画(控え登場時)がimgを作り直して
    // fill:forwardsの崩れ姿勢ごと消してしまう
    if (img && card && !c.isShikigami && typeof characterPortraitSrc === "function") {
      const src = characterPortraitSrc(c);
      if (src && !img.src.endsWith(src)) {
        img.src = src;
        card.__portraitKey = `img:${src}`;
      }
    }
    if (img && img.animate) {
      // 多重発火の保険(同一戦闘で同じimgに再生済みのKOアニメが残っていたら消してから)
      img.getAnimations().forEach((a) => { if (a.id === "allyKo") a.cancel(); });
      const anim = img.animate([
        { transform: "translateY(0) rotate(0deg)", filter: "grayscale(0) brightness(1)", opacity: 1 },
        { transform: "translateY(2px) rotate(2deg)", filter: "grayscale(0.8) brightness(0.9)", opacity: 1, offset: 0.3 },
        { transform: "translateY(8px) rotate(5deg)", filter: "grayscale(1) brightness(0.7)", opacity: 0.9, offset: 0.7 },
        { transform: "translateY(12px) rotate(7deg)", filter: "grayscale(1) brightness(0.4)", opacity: 0.85 },
      ], { duration: ALLY_KO_ANIM_MS, easing: "ease-in-out", fill: "forwards" });
      anim.id = "allyKo";
      // 倒れ切ったらカードを畳んで表示から消す(「倒れたやつが画面に残り続ける」ユーザー指摘
      // 2026-08-01→モック採用案どおりの挙動へ。cancel時=生存復帰の再描画ではonfinishは飛ばない)
      anim.onfinish = () => { try { collapseAllyKoCard(card); } catch (e) {} };
    }
    if (noteText) showAllyKoNote(noteText);
  } catch (e) {} // 演出は失敗してもゲーム進行(handleFieldDeaths)を止めない
}
// 倒れ演出後のカード畳み: 横幅を0へ縮めながらフェードアウトし、隣のカードが自然に詰まる
// (次の再描画=控え登場時にbattleDisplayPartyから外れてDOMごと掃除される。それまでの
// つなぎとしてdisplay:noneにしておく)
function collapseAllyKoCard(card) {
  if (!card || !card.isConnected || !card.animate) return;
  card.style.overflow = "hidden";
  card.style.minWidth = "0";
  const a = card.animate([
    { opacity: 1, width: card.offsetWidth + "px" },
    { opacity: 0, width: "0px" },
  ], { duration: ALLY_KO_COLLAPSE_MS, easing: "ease-in", fill: "forwards" });
  a.onfinish = () => { card.style.display = "none"; };
}

// 倒れた瞬間に画面中央へ一瞬出す告知テキスト(「◯◯は深手を負った…温泉療養2日」)。
// 重傷システムのルール説明を兼ねる(モックの「療養テキスト表示」ON採用)。
// 位置はiOSのvh罠を避けてinnerHeight実測で置く
function showAllyKoNote(text) {
  const note = document.createElement("div");
  note.className = "ally-ko-note";
  note.textContent = text;
  note.style.top = Math.round(window.innerHeight * 0.30) + "px";
  document.body.appendChild(note);
  if (note.animate) {
    const anim = note.animate([
      { opacity: 0, transform: "translateX(-50%) translateY(6px)" },
      { opacity: 1, transform: "translateX(-50%) translateY(0)", offset: 0.12 },
      { opacity: 1, transform: "translateX(-50%) translateY(0)", offset: 0.8 },
      { opacity: 0, transform: "translateX(-50%) translateY(-4px)" },
    ], { duration: 2400, easing: "linear", fill: "forwards" });
    anim.onfinish = () => note.remove();
    setTimeout(() => { if (note.isConnected) note.remove(); }, 3000); // onfinish不発時の保険
  } else {
    setTimeout(() => note.remove(), 2400);
  }
}

// DOT VFXのフレーム画像も起動後に事前ロードしておく(初回再生のコマ落ち防止。攻撃VFXの
// ウォームアップと同じ趣旨だが、こちらは頻度が低いためプール常駐まではしない)
function preloadAilmentVfxFrames() {
  if (typeof AILMENT_VFX_ASSIGNMENTS === "undefined" || typeof Image === "undefined") return;
  AILMENT_VFX_ASSIGNMENTS.forEach((a) => {
    for (let i = 1; i <= a.frameCount; i++) {
      const im = new Image();
      im.src = `${a.framePrefix}${i}.png`;
    }
  });
}
setTimeout(preloadAilmentVfxFrames, 3000);

// 起動時に攻撃VFXのウォームアップを実行する(全フレームの事前デコード+表示用プールの常駐化。
// iOSの「作りたて要素のアニメ序盤が描画されない」「フレーム画像のデコード遅延でコマ落ちする」対策)
warmUpAttackVfxAssets();
getAttackVfxPool();
