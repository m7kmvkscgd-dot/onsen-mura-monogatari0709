// ============ battle.js: 戦闘(ターン進行・行動選択・対象選択・勝敗判定) ============
// ============ 戦闘 ============
let battle = null;
let pendingEnemyPick = null; // 対象選択待ちの間、敵カード画像を直接タップしても選べるようにする際のコールバック
let pendingAllyPick = null; // 同様に、味方対象の選択待ちの間、味方の画像を直接タップしても選べるようにする際のコールバック
let battleSubMenuActive = false; // 対象選択/道具メニューなどのサブ画面を表示中かどうか(trueの間はコマンド外タップで一段戻れる)
// このターンで既に行動系ボタン(攻撃/技/かばう/逃げる等)が押されたかどうか。renderActionButtons()の
// たびにfalseへ戻す。モバイル特有の「ほぼ同時の2本指/2タップが、片方の処理でボタンがDOMから
// 消える前にもう片方も同じ要素へロックオンして配送される」レースにより、pendingEnemyPick/
// pendingAllyPickのような状態フラグを経由しない直接actionのボタン(攻撃・かばう・技・逃げる等)は
// grid.innerHTML=""によるDOM除去だけでは二重発火を防げていなかった(通常攻撃の連打で
// ダメージ計算が2回走るバグの実際の原因)。ボタンごとにこのフラグを確認してから初めて処理に入る
let battleActionLocked = false;

// targetId(キャラのid、または敵のinstanceId)から実体(キャラ/敵オブジェクト)を探す。
// 揺れの状態はDOM要素ではなくこのオブジェクト自身に持たせる(再描画でDOM要素が作り直されても消えない)
// 大規模戦(村襲撃)モード: trueの間は敵の頭数に関係なく敵カードを常に縮小サイズ(mass-battle)で
// 統一する(ユーザー指定2026-07-27: 襲撃では敵が1体でも同じ大きさに。頭数でサイズが変わると
// ウェーブ間や撃破途中で見た目がガタつくため)。タイトルの大規模戦テスト(title.js)が立てる。
// 通常探索の戦闘は従来通り「5体以上の時だけ」縮小
let massBattleSizingForced = false;
// ボステスト(title.js)中フラグ。trueの間は勝利/敗北/逃走が全てlocation.reload()でタイトルへ直帰し、
// ボスのHP低下逃走(追撃モード)も発生しない(最後まで戦ってギミックを検証するためのモード)
let bossTestActive = false;
// ============ 村襲撃バリケード(2026-07-27ユーザー確定仕様、モックで演出確認済み) ============
// 柵が立っている間(raidBarricadeHp>0)、飛行(isFlying)以外の敵の攻撃は全てバリケードが肩代わりする
// (横取りはengine.js applyDamageToTargetの先頭)。HP0で倒壊し、以降は通常戦闘。
// 通常プレイでは常に0のため一切影響しない。HPの初期値は大規模戦テスト(title.js)が設定する仮値で、
// 建築レベル由来の段階値(木の柵/鉄杭柵…)への接続とバランス数値はユーザーが後日調整する
let raidBarricadeHp = 0;
let raidBarricadeMaxHp = 0;
// 戦闘終了時(勝利/敗北/逃走/煙玉)に、戦闘中限定の変身・構え・カウンタを解除する。
// 鬼神化は「その戦闘が終わったら解ける」(ユーザー確定2026-07-30、忍者の変化の術と違い持ち越さない)。
// 各clearDotEffects(fieldParty)の呼び出し(=戦闘の後始末マーカー)とセットで呼ぶ
function clearBattleTransientForms() {
  fieldParty.forEach((c) => {
    c.kishinTurns = 0;
    c.meikyoTurns = 0;
    c.hyakkaActive = false;
    c.__hyakkaExtraUsedThisTurn = false;
    c.__battleHitCount = 0;
    c.katamiKitsuneMask = false; // 形見「うつろの狐面」はその戦闘限り
    c.katamiShadowGuard = false; // 形見「逆月の鏡片」の身代わりも戦闘をまたいで持ち越さない
  });
  // ボスギミックの場演出(業火オーバーレイ/背景差し替え)も戦闘の後始末で必ず解除する
  if (typeof clearGimmickBattleFx === "function") clearGimmickBattleFx();
  // 逃げる小ボタン(#battleFleeBtn)も戦闘の後始末(勝利/全滅/逃走/煙玉)で必ず隠す。
  // 次の戦闘のrenderActionButtonsが改めて表示する
  const fleeBtn = document.getElementById("battleFleeBtn");
  if (fleeBtn) fleeBtn.style.display = "none";
}
function resetRaidBarricade(hp) {
  raidBarricadeHp = raidBarricadeMaxHp = hp;
  const wrap = document.getElementById("raidBarricadeWrap");
  if (wrap) {
    wrap.classList.remove("worn", "critical");
    // hp<=0(バリケード未建築、または既に全壊している)は絵自体を隠す。倒壊演出(playBarricadeCollapseFx)
    // の終了時にも同じ.collapsedが付くため、ここで無条件除去すると「柵が無いのに絵だけ表示される」
    // バグになっていた(ユーザー実機発見2026-07-29: 襲撃テストで木の柵OFFにしても絵が出た)
    wrap.classList.toggle("collapsed", hp <= 0);
    wrap.getAnimations().forEach((a) => a.cancel());
    wrap.style.opacity = "";
    wrap.style.transform = "";
  }
  updateRaidBarricadeUi();
}
function updateRaidBarricadeUi() {
  const wrap = document.getElementById("raidBarricadeWrap");
  const strip = document.getElementById("raidDuraStrip");
  if (!wrap || !strip) return;
  const r = raidBarricadeMaxHp > 0 ? raidBarricadeHp / raidBarricadeMaxHp : 0;
  strip.style.display = raidBarricadeHp > 0 ? "" : "none"; // 基本の表示可否はCSS(.raid-battle)側、ここは倒壊後に消す用
  const fill = document.getElementById("raidDuraFill");
  fill.style.width = (Math.max(0, r) * 100) + "%";
  fill.className = r <= 0.25 ? "low" : r <= 0.5 ? "mid" : "";
  document.getElementById("raidDuraNum").textContent = Math.max(0, raidBarricadeHp);
  wrap.classList.toggle("worn", r <= 0.5 && r > 0.25);
  wrap.classList.toggle("critical", r <= 0.25 && r > 0);
}
// 敵の攻撃を柵が肩代わりした時の処理(engine.jsから呼ばれる)
function applyRaidBarricadeDamage(dmg) {
  raidBarricadeHp = Math.max(0, raidBarricadeHp - dmg);
  updateRaidBarricadeUi();
  if (raidBarricadeHp <= 0) {
    playBarricadeCollapseFx();
    blog("バリケードが崩れ落ちた！");
  } else {
    playBarricadeHitFx(dmg);
  }
}
// この戦闘で敵が死亡時に落とした素材 [{matId, el, x, y}](el/x/yは足元に転がるアイコンのDOMと座標。
// 丸呑み中に死ぬなどカードが無いまま抽選された場合はelがnull)。抽選は敵が死んだ瞬間に行い
// (rollMaterialDropOnDeath、確率は従来の勝利時抽選と同一)、勝利したら巾着袋へ回収される。
// 逃走・全滅・ボス逃走で戦闘が終わった場合は置き去り=拾えない(ユーザー指定)。
// なお戦闘中にリロードされた場合、このリスト(DOM参照を含む)は復元されず消える(素材はおまけ
// 要素のため許容。リロード再開の敵HPなどは従来通り遠征スナップショットが受け持つ)
let materialGroundDrops = [];
function startBattle(enemies, pathDef, encounterText) {
  materialGroundDrops = [];
  clearMaterialGroundDrops(); // 前の戦闘の置き去り分が画面に残っていたら掃除(effects.js)
  markEnemiesSeen(enemies); // 図鑑: 遭遇した敵を記録する(倒す必要はなく、出会った時点で登録される)
  // 連続戦闘のストレス軽減(ピティ制)用カウンターを、どの経路から始まった戦闘でも必ずここでリセットする
  // (通常のrollEncounter経由はもちろん、討伐依頼の強制遭遇/ボス追跡/イベント戦なども全てstartBattle経由のため)
  floorsSinceLastBattle = 0;
  // おみくじ「吉」: 次の遠征の最初の戦闘だけ、味方の攻撃が最初の3回連続で確定会心になる。この戦闘で使い切る(2戦目以降には持ち越さない)
  const omikujiGuaranteedCrits = state.omikujiGuaranteedCritsLeft || 0;
  if (omikujiGuaranteedCrits > 0) state.omikujiGuaranteedCritsLeft = 0;
  // swapCooldown: 交代コマンドの残りクールダウン(ラウンドの節目で1減る、0で使用可、開幕から使用可)。
  // roundsTotal/presence: 参加ターン比の経験値配分用(そのラウンドに戦場へ出ていたキャラのカウント。nextRound/victory参照)
  battle = { enemies, order: [], orderIndex: 0, actingId: null, actingEnemyId: null, goldMult: (pathDef && pathDef.goldMult) || 1, justAppeared: true, omamoriUsed: {}, omikujiGuaranteedCritsLeft: omikujiGuaranteedCrits, swapCooldown: 0, roundsTotal: 0, presence: {}, raidRoundTargetCounts: {} };
  // 新しい戦闘の最初の手番は必ずスライド演出を再生させたいので、前の戦闘の最後にたまたま
  // 同じキャラのidが残っていて「変化なし」と誤判定されない(演出が飛ばされない)よう明示的にリセットする
  lastPartyBarActingId.battlePartyBar = null;
  // 戦闘に入った事実を即座に保存する(遠征スナップショットのinBattle=true)。これが無いと
  // 「嫌な敵に遭遇→保存が走る前に即リロード」でペナルティ無しに敵を消せてしまう
  saveState();
  // 貫き矢(狩人)など「倒した敵の余りダメージを他の敵に分け与える」系のスキルがengine.js側から
  // 他の敵を参照できるようにするための、敵全体への自己参照(__alliesの敵版)
  enemies.forEach((e) => { e.__enemyAllies = enemies; });
  // ボスギミック(gimmicks.js): この戦闘の敵が持つギミックの実行状態を初期化し、場演出をリセットする
  if (typeof initBattleGimmicks === "function") initBattleGimmicks();
  // テストモード中(タイトルのテスト系ボタン経由)だけ、戦闘画面左上に「タイトルへ戻る」ボタンを出す
  const testExitBtn = document.getElementById("battleTestExitBtn");
  if (testExitBtn) testExitBtn.style.display = (typeof testModeActive !== "undefined" && testModeActive) ? "" : "none";
  // 新しい戦闘のたびに前回の逃走状態/状態異常/一時バフ/戦闘限定の受動効果をリセット(毒などが戦闘をまたいで残らないように)
  fieldParty.forEach((c) => {
    c.fleeState = null;
    c.poison = 0;
    c.burnTurns = 0;
    c.bleed = 0;
    c.stunTurns = 0;
    c.stunResistTurns = 0;
    c.silenceTurns = 0;
    c.statusImmuneTurns = 0;
    c.tauntTurns = 0;
    c.statMods = [];
    c.stackCounters = {}; // 迅雷突き/鎧砕き/剛槍など蓄積型の一時ステータス変化も戦闘をまたいで持ち越さない
    c.reloading = false; // 砲術士の装填クールダウンも戦闘をまたいで持ち越さない
    c.hawkTurnsLeft = 0; // 狩人「鷹を呼ぶ」も戦闘をまたいで持ち越さない
    c.hawkGuardTargetId = null;
    c.turnStackAtkStacks = 0; // 百戦錬磨など、ターン経過で積み上がる攻撃力バフも戦闘をまたいで持ち越さない
    c.nullifyCounterTurnsLeft = 0; // 心眼の構えなど、このターン限定の無効化反撃も戦闘をまたいで持ち越さない
    c.nullifyCounterMult = null;
    c.kishinTurns = 0; c.meikyoTurns = 0; // 鬼神化/明鏡止水(通常は戦闘終了時に解除済み、開始時の保険)
    c.hyakkaActive = false; c.__hyakkaExtraUsedThisTurn = false; // 百花繚乱はその戦闘中のみ
    c.__battleHitCount = 0; // 千本桜の威力スケール用ヒット数(戦闘ごとにゼロから)
    c.migawariShieldActive = false; // 身代わりの術も戦闘をまたいで持ち越さない
    c.barrierHp = 0; c.barrierMaxHp = 0; // 結界術の数値シールドも戦闘をまたいで持ち越さない
    c.hasBeenHitThisBattle = false; // 忍足など、初被弾までの回避バフを毎戦闘リセットする
    c.onKillEvasionBonusActive = false; // 修羅刃など、キル直後の回避バフも毎戦闘リセットする
    c.hagakiCritStack = 0; // 覇気: 会心のたびに積み上がる会心率も毎戦闘リセットする
    c.nextSkillFreeMp = false; // 残心: キル直後の次技無償化フラグも毎戦闘リセットする
    c.dosayUsed = false; // 怒声: 戦闘中一度きりの使用制限も毎戦闘リセットする
    c.__usedShikigamiTypes = new Set(); // 式神: 帰還/消滅したタイプの再召喚禁止も戦闘をまたいで持ち越さない
    // 「誰かがかばっている間」系のスキル(連携の呼吸・援護薙ぎ・護りの薙刀・鼓舞の盾など)がengine.js側から
    // 他の味方の状態を参照できるようにするための、パーティ全体への自己参照(戦闘開始のたびに配り直す)
    c.__allies = fieldParty;
    if (c.passives) {
      c.passives.onceGuardUsed = false;
      c.passives.firstAttackUsed = false;
      c.passives.onKillStacks = 0;
      c.passives.onKillStacksTurns = 0;
      c.passives.omamoriIzanagiPending = null;
      c.passives.omamoriIzanamiPending = null;
      c.passives.omamoriSharedSurviveFatal = null;
      c.passives.omamoriBishamonPending = false; // 前回誰かに配られた分が残らないよう、毎戦闘リセットしてから配り直す
    }
  });
  battleLogLines = [];
  document.getElementById("battleLog").innerHTML = "";
  // お守り(戦闘単位で発動するもの)のセットアップ。全て装備中(state.omamoriEquipped)の時だけ発動する。
  // battleLogLinesのクリアより後に置く(blog()を呼ぶsarutahikoの分がクリアで消えてしまわないように)
  if (hasOmamori("izanagi")) {
    const guard = { used: false };
    fieldParty.forEach((c) => { if (c.passives) c.passives.omamoriIzanagiPending = guard; });
  }
  if (hasOmamori("izanami")) {
    const guard = { used: false };
    fieldParty.forEach((c) => { if (c.passives) c.passives.omamoriIzanamiPending = guard; });
  }
  if (hasOmamori("susanoo")) {
    const guard = { used: false };
    fieldParty.forEach((c) => { if (c.passives) c.passives.omamoriSharedSurviveFatal = guard; });
  }
  if (hasOmamori("inari")) fieldParty.forEach((c) => applyStatMod(c, "evasionAdd", 0.05, 999));
  if (hasOmamori("yatagarasu")) fieldParty.forEach((c) => applyStatMod(c, "accuracyAdd", 0.12, 999));
  // 毘沙門天の御守: 戦闘開始時、生存中の味方からランダムに1人選び、次の攻撃を完全無効化するバリアを張る
  if (hasOmamori("bishamonten")) {
    const alive = fieldParty.filter((c) => c.status === "active");
    if (alive.length > 0) {
      const chosen = alive[Math.floor(Math.random() * alive.length)];
      if (chosen.passives) chosen.passives.omamoriBishamonPending = true;
      blog(`毘沙門天の御守の加護で、${chosen.label}に無敵の加護が宿った！`);
    }
  }
  // 石長比売の御守: 最大HP+5%(ぽかぽかの温泉バフと同じ「実際のHPの器を増やす」方式。戦闘終了時に必ず差し引く)
  if (hasOmamori("iwanagahime")) {
    fieldParty.forEach((c) => {
      if (c.status === "active" && !c.omamoriIwanagaHpBonusAmount) {
        const bonus = Math.max(1, Math.round(c.maxHp * 0.05));
        c.maxHp += bonus;
        c.hp += bonus;
        c.omamoriIwanagaHpBonusAmount = bonus;
      }
    });
  }
  // シームレス戦闘遷移(2026-08-01ユーザー承認で本採用、effects.js参照): 暗転なしで背景1.05倍ズーム。
  // 敵の出現もフェード0.8→1.0倍に切り替わる(seamless-entry)。
  // 画面共通のフェードイン(screenFadeIn)も今回だけ抑止する=切替時に一瞬暗く見えていた正体(実機報告)。
  // showScreenより前に仕込む必要があるためこの位置。襲撃戦のみ従来どおり(クラスも付かない)
  const seamlessEntry = !raidBattleActive;
  if (typeof resetSeamlessBattleCamera === "function") resetSeamlessBattleCamera(); // 前の戦闘のズーム残りを掃除
  const battleTopForSeamless = document.querySelector(".battle-top");
  if (battleTopForSeamless) battleTopForSeamless.classList.toggle("seamless-entry", seamlessEntry);
  document.getElementById("screen-battle").style.animation = seamlessEntry ? "none" : "";
  showScreen("screen-battle");
  if (seamlessEntry && typeof seamlessBattleCameraIn === "function") seamlessBattleCameraIn();
  playBattleBgm(); // 戦闘専用BGMを開始する(探索中は流れず、戦闘開始の合図として鳴る。森は夜だけ専用曲、海岸はcoast_battle)
  blog(encounterText || (enemies.length > 1 ? `${enemies.map((e) => e.label).join("、")}が現れた！` : `${enemies[0].label}が現れた！`));
  // おみくじ「吉」: 次の遠征の最初の戦闘だけ、味方の攻撃が最初の3回連続で確定会心になる
  if (omikujiGuaranteedCrits > 0) blog(`おみくじの御利益で、最初の${omikujiGuaranteedCrits}回の攻撃が会心になる！`);
  if (hasOmamori("sarutahiko")) {
    // turns:2にしているのはtickStatMods()が「自分の手番開始時に先に1減らす」仕様のため。
    // turns:1だと最初のティックで即座に0になり消えてしまい、誰の行動にも間に合わない(連斬等と同じ理由)
    fieldParty.forEach((c) => { applyStatMod(c, "atk", 1.25, 2); applyStatMod(c, "spd", 1.25, 2); });
    blog("猿田彦神の御守の加護で、味方全体の勢いが増した！");
  }
  // 暗い道の奇襲: 一定確率で敵全員の素早さを1ターン目だけ引き上げ、先手を取られやすくする
  if (pathDef && pathDef.ambushChance && Math.random() < pathDef.ambushChance) {
    enemies.forEach((e) => applyStatMod(e, "spd", 1.5, 1));
    blog("奇襲だ！敵の動きが速い！");
  }
  // 戦闘開始時の吹き出し(30%)。生存中の仲間からランダムに1人選ぶ
  if (Math.random() < DIALOGUE_CHANCE.battleStart) {
    const alive = fieldParty.filter((c) => c.status === "active");
    if (alive.length > 0) trySpeak(alive[Math.floor(Math.random() * alive.length)], "battleStart");
  }
  // おみくじ「小吉」: 次の遠征の最初の戦闘だけ先制確定。この戦闘で使い切る(2戦目以降には持ち越さない)
  let forceFirstStrike = state.omikujiFirstStrikePending;
  if (forceFirstStrike) {
    state.omikujiFirstStrikePending = false;
    blog("おみくじの御利益で先手を取った！");
  }
  // 月読命の御守: 夜の戦闘は60%で先制する
  if (!forceFirstStrike && hasOmamori("tsukuyomi") && (state.timeOfDay === "night") && Math.random() < 0.60) {
    forceFirstStrike = true;
    blog("月読命の御守の加護で、夜陰に乗じて先手を取った！");
  }
  // 物語クエストのボス口上(preBattleLines): 定義があれば暗転オーバーレイで台詞を見せてから戦闘に入る
  const orator = enemies.find((e) => Array.isArray(e.preBattleLines) && e.preBattleLines.length > 0);
  if (orator && typeof playPreBattleLines === "function") {
    playPreBattleLines(orator, () => { if (battle) nextRound(forceFirstStrike); });
  } else {
    nextRound(forceFirstStrike);
  }
}

// テストモード中だけ表示される「タイトルへ戻る」ボタン(index.htmlのbattleTestExitBtn、表示切替は
// startBattle)。長いテストの誤タップで全部やり直しにならないよう、確認を挟んでからreload(全滅時と同じ手順)
document.getElementById("battleTestExitBtn").onclick = () => {
  showConfirmModal("テストを終了してタイトルへ戻りますか？", [
    { label: "はい", className: "big danger", onClick: () => location.reload() },
    { label: "いいえ", className: "big" },
  ]);
};

function aliveField() {
  return fieldParty.filter((c) => c.hp > 0 && c.status === "active" && c.fleeState !== "fled");
}
function aliveEnemies() {
  return battle.enemies.filter((e) => e.hp > 0);
}
// 丸呑みされている敵は攻撃対象として選べない/表示もされない(ただしhpは残っているのでaliveEnemies()には
// 含まれ続け、丸呑み中の敵が最後の1体でも戦闘終了にはならない)
function targetableEnemies() {
  return aliveEnemies().filter((e) => !(e.swallowedTurns > 0));
}

// カラス変身の「観察眼」: 次に行動する組み合わせ(味方/敵問わず)を青い矢印バッジで示す。
// battle.orderは1ラウンド分しか確定していないため、今のラウンドの残り分だけを覗き見る
// (ラウンド末尾まで見ても次の行動者がいない=次ラウンドの並び順はまだ未確定、という場合は何も表示しない)
function nextActingCombatant() {
  if (!battle || !battle.order) return null;
  for (let i = battle.orderIndex + 1; i < battle.order.length; i++) {
    const c = battle.order[i];
    if (c.hp > 0 && c.fleeState !== "fled" && (c.status === undefined || c.status === "active")) return c;
  }
  return null;
}
function anyCrowScoutActive() {
  return fieldParty.some((c) => c.status === "active" && c.transformForm === "karasu");
}

// ============ 敵カードの差分更新(生成は戦闘開始時の1回だけ、以後は中身の書き換えのみ) ============
// 静的な骨組み(名前・立ち絵・各コンテナ)だけを持つカードを生成する。動的な部分(クラス・
// 状態アイコン・HPバー・大技タップ説明)は毎描画updateEnemyCard()が書き換える
function createEnemyCard(e) {
  const card = document.createElement("div");
  card.className = "enemy-card";
  // frameless指定の敵(百面師・うつろ等の大型ボス)は、カードの箱の見た目(枠線・背景・影)を外して
  // 透過PNGを戦闘背景の上へ直接立たせる(名前・HPバー・状態アイコンはそのまま)。battle.css参照
  if (e.frameless) card.classList.add("frameless");
  // 細身/小柄な透過立ち絵の見た目補正(spriteScale、data.jsのTEST_TRANSPARENT_ENEMY_SCALE等)。
  // transformなので箱のレイアウト寸法(3体1行の幅計算・HPバー位置)には影響しない
  if (e.frameless && e.spriteScale) card.style.setProperty("--clear-scale", e.spriteScale);
  card.dataset.id = e.instanceId;
  card.innerHTML = `
      <div class="enemy-name">${e.label}</div>
      <div class="enemy-portrait-box" style="position:relative;">
        <img class="card-portrait-img" src="${e.image}" alt="${e.label}">
        <div class="enemy-debuff-icons"></div>
      </div>
      <div class="hp-with-warning"></div>
    `;
  // タップ(攻撃対象の選択)は生成時に一度だけ張る。対象選択中(targetableクラスが付いている時)だけ
  // 反応する。クロージャで生成時の敵オブジェクトを直接掴まず、発火時にdata-idから現在の敵を
  // 引き直す(引き継ぎ文書の地雷リスト3番)
  card.onclick = () => {
    if (!pendingEnemyPick || !card.classList.contains("targetable")) return; // 既に別経路(対象一覧のテキストボタン等)で選択済みなら無視する(二重行動防止)
    const cur = battle && battle.enemies.find((x) => String(x.instanceId) === card.dataset.id);
    if (!cur || cur.hp <= 0) return;
    const picked = pendingEnemyPick;
    pendingEnemyPick = null;
    battleActionLocked = true; // 対象を選んだ瞬間から解決完了まで、再度ロックする
    picked(cur);
  };
  return card;
}
const HIT_SHAKE_CLASSES = ["hit-shake", "hit-flash", "hit-shake-normal", "hit-shake-strong"];
function updateEnemyCard(card, e) {
  const dead = e.hp <= 0;
  const targetable = !!pendingEnemyPick && !dead;
  card.classList.toggle("swarm", !!e.isSwarm);
  // 飛行中は立ち絵を浮かせて接地影と分離する(frameless時のみ意味を持つ、battle.cssのairborne)。
  // 撃ち落とされてisFlyingが外れると次の再描画で自然に着地する
  card.classList.toggle("airborne", !!e.isFlying);
  card.classList.toggle("midboss", !!e.isMidBoss);
  card.classList.toggle("quest-target", !!e.isQuestTarget);
  // 襲撃戦のカード幅は編成「枠」(ボス級4/通常2/大群1)に比例させる(ユーザー指定2026-07-29:
  // 大猪とコウモリが同じ大きさなのはおかしい)。スタイルは.battle-top.raid-battle配下限定
  // (battle.css)のため、通常戦闘ではこのクラスが付いていても見た目は一切変わらない
  const slotTier = (e.isBoss || e.isMidBoss) ? "boss" : e.isSwarm ? "swarm" : "normal";
  card.classList.toggle("slot-boss", slotTier === "boss");
  card.classList.toggle("slot-swarm", slotTier === "swarm");
  card.classList.toggle("slot-normal", slotTier === "normal");
  card.classList.toggle("dead", dead);
  card.classList.toggle("defeat-hidden", dead);
  // acting(enemyLunge)のような一回きりのCSSアニメーションは、クラスが「無い→有る」に変わった
  // 瞬間だけ再生される(付いたままの再描画では再生されない。以前はカード作り直しのたびに
  // 最初から再生し直されていたが、それはこの差分更新化で直したい症状そのもの)。
  // 【2026-07-31修正】被弾で付いた揺れクラス(hit-shake等)は完走後もカードに残る仕様だが、
  // .enemy-card.hit-shake.hit-flash.hit-shake-*の方が.enemy-card.actingより詳細度が高く、
  // animationプロパティを取り合って踏み込み(enemyLunge)を上書きしてしまう(=一度でも殴った敵は
  // 攻撃前のプッシュモーションが二度と出ない実バグ。フェーズ5の「残っても無害」の見落とし)。
  // 手番が付く瞬間(無→有の遷移)に揺れクラスを剥がしてからactingを付けることで毎ターン確実に再生する
  const becomesActing = e.instanceId === battle.actingEnemyId;
  if (becomesActing && !card.classList.contains("acting")) card.classList.remove(...HIT_SHAKE_CLASSES);
  card.classList.toggle("acting", becomesActing);
  card.classList.toggle("targetable", targetable);
  card.classList.toggle("charging", !!e.bigAttackPending && !dead);
  // 出現演出は初回描画だけ。2回目以降の描画でクラスを剥がす(従来はカード作り直しで暗黙に消えていた)
  if (!battle.justAppeared) card.classList.remove("entering");
  // 被弾の揺れ: shakeClassFor()は「1回の被弾(__shakeUntil)につき最初の描画だけ」クラス名を返す。
  // 新しい揺れはクラスを一度剥がしてリフローを挟んでから付け直してCSSアニメーションを確実に
  // 再発火させる(地雷リスト2番の既存パターン)。揺れ中の再描画では何もしない=アニメーションを
  // 途中で切らず完走させる(旧方式は再描画のカード作り直しで揺れがブツ切りになっており、
  // その再現をフェーズ5で撤去した。完了後にクラスが残り続けるのは無害=付け直した瞬間しか再生されない)
  const shake = shakeClassFor(e).trim();
  if (shake) {
    card.classList.remove(...HIT_SHAKE_CLASSES);
    void card.offsetWidth;
    card.classList.add(...shake.split(/\s+/));
  }
  // 第二形態(secondForm)などでe.imageが差し替わった時だけ立ち絵のsrcを更新する(差分更新の原則:
  // 表示内容が実際に変わった時だけ触る。カードを作り直すと透過立ち絵が1フレーム消えるため)
  const portraitImg = card.querySelector(".card-portrait-img");
  if (portraitImg && portraitImg.getAttribute("src") !== e.image) portraitImg.src = e.image;
  // 立ち絵の上に重ねる動的アイコン(飛行/大技予告💢/依頼対象/次ターン行動バッジ)は毎回作り直す。
  // 全てposition:absoluteの小要素で、アニメーションの起点にはならないため作り直しても問題ない。
  // DOM上の並び(デバフアイコン列の手前)も従来のマークアップと同じに保つ
  const box = card.querySelector(".enemy-portrait-box");
  const debuffIconsEl = card.querySelector(".enemy-debuff-icons");
  box.querySelectorAll(":scope > .status-icon, :scope > .next-actor-badge").forEach((el) => el.remove());
  const enemyIsNextActor = anyCrowScoutActive() && nextActingCombatant() === e;
  let overlayHtml = "";
  if (e.isFlying) overlayHtml += `<span class="status-icon" data-status="flying" style="position:absolute;top:2px;left:2px;font-size:20px;color:#fff;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.8));z-index:2;">${ICONS.flying}</span>`;
  if (e.bigAttackPending && !dead) overlayHtml += `<span class="big-attack-warning-icon status-icon" data-status="bigAttackPending" style="position:absolute;top:2px;right:34px;z-index:2;">💢</span>`;
  if (e.isQuestTarget) overlayHtml += `<span class="status-icon" data-status="questTarget" style="position:absolute;top:2px;right:2px;font-size:20px;color:#e6c977;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.8));z-index:2;">${ICONS.questTarget}</span>`;
  if (enemyIsNextActor) overlayHtml += '<span class="next-actor-badge">▲次ターン行動</span>';
  if (overlayHtml) debuffIconsEl.insertAdjacentHTML("beforebegin", overlayHtml);
  debuffIconsEl.innerHTML = statusIconsFor(e);
  // HPバーはトレイル(前回表示位置からの追いつき)のfrom/targetを描画のたびに現在値で作り直す
  // 必要があるため、バー部分のみ従来通りHTMLを組み直す(この後のactivateHpTrails()が拾って動かす)
  card.querySelector(".hp-with-warning").innerHTML = hpBarHtml(e);
  // 大技の内容はイラストのタップで確認する(状態異常アイコン等と同じタップ表示/他箇所タップで消える
  // 仕組みに統一。対象選択中(targetable)はタップが「攻撃対象を選ぶ」動作も兼ねるが、そちらは
  // card.onclick側で別途処理されるため両立する。ユーザー指示、2026-07-21で長押し方式から変更)
  const portraitEl = card.querySelector(".card-portrait-img");
  if (!dead) {
    portraitEl.classList.add("enemy-bigattack-tap");
    portraitEl.dataset.enemyName = e.label;
    portraitEl.dataset.bigattackName = bigAttackPool(e).map((p) => p.name || "大技").join("/");
    portraitEl.dataset.bigattackDesc = bigAttackSummaryText(e);
  } else {
    portraitEl.classList.remove("enemy-bigattack-tap");
  }
}

function renderBattleScreen() {
  // 煙玉等で戦闘が終了した後、直前にsetTimeoutで予約されていた処理が遅れて発火してもクラッシュしないための保険
  if (!battle) return;
  hideStatusTooltip(); // 再描画でアイコン要素が作り直されるため、表示中の説明ツールチップが宙に浮かないよう消しておく
  // 逃走完了(fleeState==="fled")した仲間は、この戦闘の間だけ表示から消える(探索画面に戻れば元通り表示される)
  // 控え(reserveFieldMember)は控えに入っている間は画面上のアイコン表示に含めない(4人編成でも
  // 常時表示されるアイコンは4つのまま。交代ボタンを押した時のピッカーでのみ姿を見せる)
  // 倒れた(重傷/ロスト)仲間はカードごと表示から外す(KO演出=倒れ→カード畳みが終わるまでは
  // __koFxUntilの猶予で残し、演出途中の再描画でカードが消し飛ばないようにする。2026-08-01
  // ユーザー指摘「倒れたやつが画面に残り続ける」→モック採用案どおり畳んで消す挙動へ)
  const battleDisplayParty = fieldParty.filter((c) => c.fleeState !== "fled" &&
    (c.status === "active" || (c.__koFxUntil && Date.now() < c.__koFxUntil)));
  renderPartyBar("battlePartyBar", battleDisplayParty, battle.actingId);
  const row = document.getElementById("enemyRow");
  // 【差分更新方式(2026-07-26、iOS演出品質の根本対策)】以前は毎回row.innerHTML=""で全カードを
  // 作り直していたが、iOS Safariは「挿入したてのDOM要素への即時アニメーション」の序盤フレームを
  // 描画しない(docs/引き継ぎ_戦闘UI差分更新化.md §3)。カードは敵インスタンス(instanceId)ごとに
  // 1回だけ生成して使い回し、毎回の描画では中身(クラス・バー・アイコン)だけを書き換える。
  // 要素の追加/削除は編成が実際に変わった時だけ(戦闘開始・丸呑み・前の戦闘の残骸の掃除)
  // 丸呑みされている敵は敵表示(UI)から完全に消す。hpは残っているため戦闘終了判定(aliveEnemies)には
  // 引き続きカウントされ、丸呑み中の敵が最後の1体でも戦闘は終わらない。撃破された敵は
  // (演出が終わった後も)このリストから外さない=枠は残したままにする。外すと#enemyRowの
  // justify-content:centerにより残った敵が中央へ詰め直されてしまい、「敵が死んで消えても
  // 他の敵の並びは動かないでほしい」という指示に反するため
  // __clearedWave: 襲撃戦でウェーブが進んだ時、前の波の死体カードの枠ごと畳むための表示専用フラグ
  // (raid.js raidTryAdvanceWave参照。通常戦闘では常にundefinedなので従来どおり枠が残る)
  const visibleEnemies = battle.enemies.filter((e) => !(e.swallowedTurns > 0) && !e.__clearedWave);
  row.classList.toggle("crowded", visibleEnemies.length >= 4);
  // 全員がframeless(透過立ち絵)の敵編成は、枠が無いぶん間隔を詰めて立ち絵自体を大きく表示できる
  // (battle.cssの.enemy-row.all-framelessサイズ式)。木枠カードが混ざる編成は従来サイズのまま
  row.classList.toggle("all-frameless", visibleEnemies.length > 0 && visibleEnemies.every((e) => e.frameless));
  // 5体以上の大規模戦は敵カードを味方カード(5人表示)と同格のサイズへ縮小し、折り返さず1行に収める
  // (2026-07-27実機報告: 通常サイズのまま5体並べると2行に折り返してテキストボックスと衝突していた)
  row.classList.toggle("mass-battle", massBattleSizingForced || visibleEnemies.length >= 5);
  // 襲撃バリケードの表示(大規模戦モードのみ。バリケードimgとログの重ねスタイルをまとめて切り替える)
  const battleTop = row.closest(".battle-top");
  if (battleTop) battleTop.classList.toggle("raid-battle", massBattleSizingForced);
  // 大規模戦はテキストボックスと一緒に味方バーも下げる(結び目を見せるレイアウト。ボタン列は実測追従)
  const bpb = document.getElementById("battlePartyBar");
  if (bpb) bpb.classList.toggle("raid-battle-bar", massBattleSizingForced);
  // 戦闘レイアウトプリセット(data.jsのBATTLE_LAYOUT参照): center_v1はログ上部・敵中央帯・味方バー49.2vhの
  // 新配置(2026-07-31ユーザー調整)。襲撃戦(massBattleSizingForced)は完成済みレイアウトのため常に従来配置
  const useCenterLayout = typeof BATTLE_LAYOUT !== "undefined" && BATTLE_LAYOUT === "center_v1" && !massBattleSizingForced;
  if (battleTop) battleTop.classList.toggle("layout-center", useCenterLayout);
  if (bpb) bpb.classList.toggle("layout-center", useCenterLayout);
  // 表示対象でなくなったカードだけ取り除く(前の戦闘の残り=instanceIdは全戦闘を通じて一意、または丸呑み中)
  const visibleIds = new Set(visibleEnemies.map((e) => String(e.instanceId)));
  [...row.children].forEach((el) => { if (!visibleIds.has(el.dataset.id)) el.remove(); });
  const newlyDeadForReaction = []; // 撃破リアクションはループを抜けた後にまとめて起動する(下記コメント参照)
  let prevCard = null;
  visibleEnemies.forEach((e) => {
    let card = row.querySelector(`:scope > .enemy-card[data-id="${e.instanceId}"]`);
    if (!card) {
      card = createEnemyCard(e);
      // 出現演出(entering)は戦闘開始直後の初回生成だけ。丸呑みからの解放などで戦闘中に
      // カードを作り直すケースでは付けない(従来のjustAppeared判定と同じ)
      if (battle.justAppeared) card.classList.add("entering");
      // battle.enemiesの並び順を保って挿入する(基本は末尾追加。丸呑みからの解放で列の途中に
      // 戻るケースだけ実際に途中挿入になる)。既存カードは並べ替えない=再挿入で「作りたて扱い」に
      // 戻さない(引き継ぎ文書の地雷リスト6番)
      row.insertBefore(card, prevCard ? prevCard.nextElementSibling : row.firstElementChild);
    }
    updateEnemyCard(card, e);
    prevCard = card;
    // 撃破リアクションは「初めて死亡を検知した描画」の時だけ起動する(再描画のたびに再生し直さない、
    // shakeClassFor()と同じ考え方)。起動自体はこのループを抜けた後にまとめて行う(下記参照)
    if (e.hp <= 0 && !e.__defeatReactionState) {
      e.__defeatReactionState = "playing";
      newlyDeadForReaction.push({ entity: e, card });
    }
  });
  // 【不具合対策】ループの途中(まだ他のカードがrowに入っていない時点)でplayEnemyDefeatReaction()の
  // card.getBoundingClientRect()を呼ぶと、#enemyRowのflexbox(justify-content:center)が
  // 「今この瞬間rowに入っている枚数」を基準に再計算されてしまい、全カードが揃った後の最終位置
  // ではなく「1枚だけの時の中央寄せ位置」を捕まえてしまっていた(2体編成で片方が死ぬと、撃破演出の
  // クローンが2体の中間にワープして見える不具合の原因だった)。全カードをrowに追加し終えて
  // レイアウトが確定してから、まとめて起動することで解決する
  newlyDeadForReaction.forEach(({ entity, card }) => {
    playEnemyDefeatReaction(entity, card);
    // 素材ドロップの抽選+足元にポンっと跳ねて落ちる表示。カード位置が確定しているこの瞬間に
    // 行う(以前は勝利時にまとめて抽選していたが、その時点ではカードが消えていて
    // 「どの敵が落としたか」を見せられなかった)
    rollMaterialDropOnDeath(entity, card);
  });
  battle.justAppeared = false; // 敵出現演出は戦闘開始直後の初回描画だけ(以降の再描画で毎回再生されないように)
  activateHpTrails(row);
  fieldParty.forEach((c) => renderVfxFor(c.id));
  battle.enemies.forEach((e) => renderVfxFor(e.instanceId));
  positionActionsBelowPartyBar("battlePartyBar", ".battle-actions");
}

// 素材/魂のかけらのドロップ抽選(1体1回、敵が死んだ瞬間に呼ばれる)。当選したら足元に転がる表示
// (effects.js spawnMaterialGroundDrop)を出し、materialGroundDropsに積む。実際の入手は
// 勝利時(victory)にまとめて確定する=逃走/全滅なら置き去りで入手なし(従来の勝利時抽選と同じ結果)。
// 魂のかけら(鬼火の確率ドロップ/大物主神の御守のボス撃破確定分)はレア扱い: 金の光をまとって
// 転がり、巾着に入る時の音が置く音ではなく風鈴になる(2026-07-27ユーザー指示)
function rollMaterialDropOnDeath(e, card) {
  if (e.__materialDropRolled) return; // 二重抽選防止(勝利時の補完抽選と重なっても1回だけ)
  e.__materialDropRolled = true;
  const push = (entry, iconSrc, rare) => {
    const ground = spawnMaterialGroundDrop(iconSrc, card, rare);
    materialGroundDrops.push({ ...entry, rare, el: ground ? ground.el : null, x: ground ? ground.x : null, y: ground ? ground.y : null });
  };
  // どの敵が何を何%で落とすかは完全にテーブル駆動(ENEMY_MATERIAL_DROPS/ENEMY_MATERIAL_DROP_CHANCES、
  // 敵エディターで編集可能)。ボスも登録すれば落とす(現状は未登録=落とさない、従来と同じ)
  const matId = ENEMY_MATERIAL_DROPS[e.id];
  if (matId) {
    const chance = ENEMY_MATERIAL_DROP_CHANCES[e.id] != null ? ENEMY_MATERIAL_DROP_CHANCES[e.id] : (e.isSwarm ? MATERIAL_DROP_CHANCE_SWARM : MATERIAL_DROP_CHANCE);
    if (Math.random() < chance) push({ kind: "material", matId }, MATERIALS[matId].icon, false);
  }
  const droppedShard = (e.id === "onibi" && Math.random() < ONIBI_SOUL_SHARD_DROP_CHANCE) || (e.isBoss && hasOmamori("omononushi"));
  if (droppedShard) push({ kind: "soulShard" }, "assets/items/soul_shard.png", true);
}

// aliveField()が0人になった時、それが「全滅」なのか「全員逃げ切った」なのかを判定する
// (fleeStateが"fled"のキャラはaliveField()から除外されるが、hp>0かつstatus==="active"のままなので
// fieldParty全体で見ればまだ生きている=逃走成功、というケースと区別する必要がある)
function handleNoOneLeftToFight() {
  const stillActiveIncludingFled = fieldParty.filter((c) => c.hp > 0 && c.status === "active");
  if (stillActiveIncludingFled.length > 0) escapeBattle();
  else defeat();
}

function nextRound(forceFirstStrike) {
  if (battle) battle.raidRoundTargetCounts = {}; // 襲撃戦の集中狙い分散カウントはラウンド単位でリセット(engine.js参照)
  // このラウンド中に「逃走準備」に入った仲間は、次のラウンドが始まる前にまとめて実際に逃げ出す。
  // 以前は本人の次の手番(=次のラウンドの自分の順番)まで待ってから逃げていたため、運が悪いと
  // 敵の攻撃をラウンドを跨いで2回受けてから逃げる、ということが起きていた。ラウンドの節目で
  // 解決するようにし、逃走準備中に受ける敵の攻撃は最大でも「そのラウンド中の1回」までに抑える
  fieldParty.forEach((c) => {
    if (c.fleeState === "preparing") {
      c.fleeState = "fled";
      playSfx("flee");
      blog(`${c.label}は戦闘から逃げ出した！`);
    }
  });
  const alive = aliveField();
  // 多段ウェーブ(襲撃戦): 全滅していても次のウェーブが控えていれば、victory()の代わりに
  // raidTryAdvanceWave()が湧かせて戦闘を続行させる(trueを返した時だけ町へ戻らず続行)
  if (aliveEnemies().length === 0 && !(typeof raidTryAdvanceWave === "function" && raidTryAdvanceWave())) { victory(); return; }
  if (alive.length === 0) { handleNoOneLeftToFight(); return; }
  // ラウンドの節目の処理一式。ボスギミックの周期効果(場ダメージ・召喚)が発動した場合は
  // processGimmickRoundEffects(gimmicks.js)が演出の間を取ってからこの続きを呼ぶため、関数に切り出してある
  const continueRound = () => {
    if (!battle) return; // ギミック演出待ちの間に戦闘が終了していた場合の保険
    // 投石器: ラウンドが1つ完了した直後に発動する(battle.roundsTotal>0=このnextRound呼び出しが
    // 戦闘開始直後の初回ではないことの目印。0のままなら開戦直後なのでまだ何も起きていない)。
    // 戻り値は投擲演出の所要ms(2026-07-29に演出化)。石が飛んでいる間は次ラウンドの手番開始を
    // 待たせ、着弾でダメージが確定してから手番順を組む(=石で倒した敵が行動順に混ざらない)
    const catapultFxMs = battle.roundsTotal > 0 ? fireCatapultOnRoundEnd() : 0;
    // 交代コマンドのクールダウンはラウンドの節目で1減る
    if (battle.swapCooldown > 0) battle.swapCooldown--;
    // 参加ターン比の経験値配分用: このラウンドに戦場へ出ていたメンバーを記録する。
    // ラウンド途中で交代したキャラは出た側にも別途加算する(=交代ターンは双方にカウント、victory参照)
    battle.roundsTotal++;
    aliveField().forEach((c) => { battle.presence[c.id] = (battle.presence[c.id] || 0) + 1; });
    const beginRound = () => {
      if (!battle) return; // 演出待ちの間に戦闘が終了していた場合の保険
      battle.order = turnOrder([...aliveField(), ...aliveEnemies()]);
      // おみくじ「小吉」: この戦闘の最初のラウンドだけ、味方全員を敵より先に行動させる(先制確定)
      if (forceFirstStrike) {
        const allies = battle.order.filter((e) => e.instanceId === undefined);
        const foes = battle.order.filter((e) => e.instanceId !== undefined);
        battle.order = [...allies, ...foes];
      }
      battle.orderIndex = 0;
      processNext();
    };
    if (catapultFxMs > 0) setTimeout(beginRound, catapultFxMs);
    else beginRound();
  };
  // ボスギミックの周期効果は投石器より前・戦闘開始直後の初回は除く(roundsTotal>0)で解決する。
  // trueが返った時はギミック側がcontinueRoundの続きを引き受けている(全滅時は呼ばれず全滅処理へ)
  if (battle.roundsTotal > 0 && typeof processGimmickRoundEffects === "function" && processGimmickRoundEffects(continueRound)) return;
  continueRound();
}

function processNext() {
  // 煙玉等で戦闘が終了した後、直前にsetTimeoutで予約されていたターン処理が遅れて発火してもクラッシュしないための保険
  if (!battle) return;
  battle.actingId = null;
  battle.actingEnemyId = null;
  // ボス第二形態(secondForm、gimmicks.js): HP50%を切った直後の手番の節目に、進行を止めて
  // フルシーケンス(導入BGM停止→無音→口上→怒り背景/絵切替→本命BGM→怒りギミック)を挟む。
  // 開始したらtrueが返るのでここで一旦returnし、演出明けのonDoneでprocessNextを再開する
  if (typeof maybeStartSecondFormSequence === "function" && maybeStartSecondFormSequence(() => processNext())) return;
  // ボスギミックのトリガー判定(gimmicks.js): 毎手番の節目に、HP割合などの発動条件を満たした
  // ギミックを発動させる(例: ボスがHP50%を割った直後、次の手番が始まる前に激怒が入る)
  if (typeof processGimmickTriggers === "function") processGimmickTriggers();
  if (aliveEnemies().length === 0) {
    renderBattleScreen();
    if (!(typeof raidTryAdvanceWave === "function" && raidTryAdvanceWave())) { victory(); return; }
  }
  const alive = aliveField();
  if (alive.length === 0) { renderBattleScreen(); handleNoOneLeftToFight(); return; }
  if (battle.orderIndex >= battle.order.length) { nextRound(); return; }
  const actor = battle.order[battle.orderIndex];
  const isEnemy = battle.enemies.includes(actor);
  if (isEnemy) {
    if (actor.hp <= 0) { battle.orderIndex++; processNext(); return; }
    battle.actingEnemyId = actor.instanceId;
    // 自分のターンでなくなったので、前のターンの行動ボタンが残って誤タップできてしまわないよう消す
    document.getElementById("actionGrid").innerHTML = "";
    renderBattleScreen();
    // 敵のDOT(毒/出血/炎上)の蓄積ダメージは、停止演出(effects.jsのplayEnemyDotStopSequence)が
    // 炎上→毒→出血の順に「暗転+種類チップ+VFX+効果音+被弾リアクション+ダメージ適用」を
    // 1種類ずつ(1種類につき0.7秒停止)処理する(モックmock_dot_vfx.htmlでユーザー承認2026-07-31。
    // 旧・小さいポップを0.7秒間隔で流すだけの表示は廃止)。DOT以外のターン開始処理(継続回復・
    // バフ経過など)は従来どおりtickTurnStartEffects側が担当する(skipDots指定でDOTの二重適用を防ぐ)
    const continueEnemyTurn = () => {
      if (!battle) return; // 停止演出中に煙玉等で戦闘が終了していた場合の保険
      tickTurnStartEffects(actor, blog, { skipDots: true });
      const enemyActionDelay = 600; // DOTの見せ場は停止演出側で消化済みのため、行動開始までは常に既定の600ms
      if (actor.hp <= 0) {
        renderBattleScreen();
        setTimeout(() => { battle.orderIndex++; processNext(); }, 500);
        return;
      }
      if (actor.stunTurns > 0) {
        actor.stunTurns--;
        blog(`${actor.label}はスタンして動けない！`);
        popupOn(actor.instanceId, "💫スタン", "stun");
        renderBattleScreen();
        setTimeout(() => { battle.orderIndex++; processNext(); }, 500);
        return;
      }
      // ガマの「丸呑み」で行動不能にされている間はスキップする
      if (actor.swallowedTurns > 0) {
        actor.swallowedTurns--;
        blog(`${actor.label}は丸呑みにされて動けない！`);
        renderBattleScreen();
        setTimeout(() => { battle.orderIndex++; processNext(); }, 500);
        return;
      }
      setTimeout(() => {
        // 三面替え・般若面(gimmicks.jsのformCycle): 面を替えた後の最初の手番は攻撃せず、
        // 既存の大技サイクルと同じ形の「構え」(予告表示+ターゲット確定)だけを行う。
        // countdownを0にしておくことで、次の手番は下のbigAttackDue経路がそのまま全体大技を発動する
        // (=予告から発動まで必ず丸1手番の対策時間がある。パーマデス制のため予告なし大技は禁止)
        if (actor.__formBigAttackStance) {
          actor.__formBigAttackStance = false;
          actor.bigAttackPending = true;
          actor.bigAttackCountdown = 0;
          commitBigAttackTelegraphTarget(actor, alive);
          blog(`${actor.label}が般若の面の奥で息を溜めている…次のターンは大技【${peekNextBigAttackName(actor)}】だ！`);
          triggerWarningFlash();
          playSfx("big_attack_warning");
          renderBattleScreen();
          setTimeout(() => { battle.orderIndex++; processNext(); }, 900);
          return;
        }
        // 大技サイクル: 敵ごとのbigAttackCountdownが0になったターンに大技発動、残り1で予告(このターンは
        // 通常攻撃のまま)。間隔(平均何ターンに一度か/ばらつき/即効)は敵ごとのbigAttackCycleで個別指定でき、
        // 未設定の敵は全敵共通デフォルト(BIG_ATTACK_CYCLE_LENGTH=4ターン固定)のまま。
        const bigAttackDue = (actor.bigAttackCountdown || 0) <= 0;
        if (bigAttackDue) {
          actor.bigAttackPending = false;
          actor.bigAttackCountdown = rollBigAttackCountdown(actor);
          // 「〜を放った！」の単独告知は廃止し、直後のかわした/ダメージのログ1行に技名を組み込む形へ統合した
          // (ユーザー指示、2026-07-21。enemyBigAttack内のlog呼び出し・applyDamageToTargetのbigAttackName引数で処理)
          // 【大技モーション刷新2026-08-01(モック案C採用、白フラッシュ無し)】溜め(暗転+赤オーラ+
          // しゃがみ込み)→解放(爆発的踏み込み)の演出後、当たる瞬間にダメージ確定〜表示を行う。
          // ダメージ計算自体も解放後に回す(溜めの間もログや被弾が先行しないよう全部まとめて遅らせる)
          playEnemyBigAttackCharge(actor, () => {
          if (!battle) return; // 溜めの間に煙玉等で戦闘が終了していた場合の保険
          const hpBeforeBig = {};
          alive.forEach((c) => { hpBeforeBig[c.id] = c.hp; });
          const yatanokagamiActive = hasOmamori("yatanokagami") && !battle.omamoriUsed.yatanokagami;
          const results = enemyBigAttack(actor, alive, blog);
          if (results.some((r) => r.hit && !r.barricade) && !yatanokagamiActive) playBigAtkImpactFx(); // 赤ビネット+画面揺れ(命中時のみ)
          if (yatanokagamiActive) {
            // 八咫鏡の御守: 戦闘中、最初に敵が大技を放った時にそれを無効化し、想定ダメージの50%を反射する
            let prevented = 0;
            results.forEach((r) => {
              if (r.barricade) return; // 柵が受けた大技は八咫鏡の対象外(味方は無傷のため)
              if (r.hit && r.dmg > 0) {
                const before = hpBeforeBig[r.target.id];
                const actualLoss = before - r.target.hp;
                if (actualLoss > 0) { r.target.hp = Math.min(r.target.maxHp, before); prevented += actualLoss; }
              }
            });
            if (prevented > 0) {
              battle.omamoriUsed.yatanokagami = true;
              const reflectDmg = Math.max(1, Math.round(prevented * 0.5));
              actor.hp = Math.max(0, actor.hp - reflectDmg);
              blog(`八咫鏡の御守が大技を打ち消し、${actor.label}に${reflectDmg}ダメージを跳ね返した！`);
              playSfx("evade");
            }
          } else {
            results.forEach((r) => {
              if (r.barricade) return; // 柵が受けた: 味方向けの演出は不要
              if (r.hit) {
                popupOn(r.target.id, `-${r.dmg}`, "dmg", dmgShakeIntensity(true));
                playSfx(hitTakenSfxFor(r.dmg, r.target.maxHp));
                // ボス/中ボスの大技だけ、画面シェイク+被弾カードの赤い閃光/衝撃波で「重い一撃」を強調する
                // (雑魚の大技には付けない、ユーザー指示)
                if (actor.isBoss || actor.isMidBoss) playBossBigAttackImpact(r.target.id);
              } else {
                playSfx("evade");
              }
            });
          }
          alive.forEach((c) => checkPinchTrigger(c, hpBeforeBig[c.id]));
          const newlyCriticalBig = handleFieldDeaths();
          renderBattleScreen();
          const advanceTurnAfterBig = () => { battle.orderIndex++; processNext(); };
          const continueAfterBig = () => {
            const bigCounterResult = results.find((r) => r.guardCounterDmg);
            if (bigCounterResult) {
              // かばう反撃(会心の返し): 大技の演出の0.5秒後に槍士側の反撃演出を差し込んでから次のターンへ進む
              playGuardCounterVisual(bigCounterResult.target, actor, bigCounterResult.guardCounterDmg, advanceTurnAfterBig);
            } else {
              setTimeout(advanceTurnAfterBig, 500);
            }
          };
          autoDeployReserveIfNeeded(newlyCriticalBig, continueAfterBig);
          }); // ← playEnemyBigAttackChargeの着弾コールバック(大技モーション刷新2026-08-01)
          return;
        }
        if (actor.bigAttackCountdown === 1) {
          actor.bigAttackPending = true;
          // 単体大技ならこの瞬間に狙う相手を確定する(ターゲットマーク表示と実際の被弾対象を一致させるため)
          commitBigAttackTelegraphTarget(actor, alive);
          // 予告テキストはボス/中ボスだけ表示する(雑魚は💢アイコン+画面フラッシュ+警告音のみで、
          // 毎回同じ文言がログに流れるのは冗長というユーザー指摘)。次に来る技名まで見せる
          // (extraBigAttacksでローテーションする敵は、予告時点で次の技が確定しているため先出しできる)
          if (actor.isBoss || actor.isMidBoss) blog(`${actor.label}が唸り声をあげて構えた…次のターンは大技【${peekNextBigAttackName(actor)}】だ！`);
          triggerWarningFlash();
          playSfx("big_attack_warning");
          actor.bigAttackCountdown -= 1;
        } else {
          actor.bigAttackCountdown = Math.max(0, (actor.bigAttackCountdown || 0) - 1);
        }
        // 通常攻撃。三面替えの狐面(gimmicks.jsのformCycle)中は__formAttacks回の連続攻撃になり、
        // 1発あたりの攻撃力は__formAttackMult倍に落ちる(手数で追い詰める形態)。通常の敵は従来どおり1回
        const totalAttacks = Math.max(1, actor.__formAttacks || 1);
        const atkOpts = actor.__formAttackMult ? { atkMult: actor.__formAttackMult } : undefined;
        const advanceTurn = () => { battle.orderIndex++; processNext(); };
        const doOneAttack = (remaining) => {
          if (!battle) return; // 連続攻撃の合間に戦闘が終了していた場合の保険
          const targetsNow = aliveField();
          if (targetsNow.length === 0 || actor.hp <= 0) { setTimeout(advanceTurn, 500); return; }
          const hpBeforeAtk = {};
          targetsNow.forEach((c) => { hpBeforeAtk[c.id] = c.hp; });
          // 【攻撃モーション刷新2026-08-01(モック案A採用)】ダメージ計算は即時に確定させるが、
          // 見た目(ログ/ポップ/SE/HPバー/死亡処理)は踏み込みが「当たる瞬間」(ENEMY_ATK_IMPACT_MS)
          // まで遅らせて同期する。ログはenemyAttackが書くため、いったん貯めて着弾時に流す
          const pendingLogs = [];
          const result = enemyAttack(actor, targetsNow, (m) => pendingLogs.push(m), atkOpts);
          playEnemyAttackAnim(actor);
          setTimeout(() => {
          if (!battle) return; // 着弾待ちの間に煙玉等で戦闘が終了していた場合の保険
          pendingLogs.forEach((m) => blog(m));
          if (result && result.barricade) {
            // 柵が受けた: 味方向けのポップ/被弾SE/ピンチ判定は不要(柵側の演出はapplyRaidBarricadeDamageが再生)
          } else if (result && result.hit) {
            popupOn(result.target.id, `-${result.dmg}`, "dmg", dmgShakeIntensity(false));
            playSfx(hitTakenSfxFor(result.dmg, result.target.maxHp));
            checkPinchTrigger(result.target, hpBeforeAtk[result.target.id]);
          } else if (result) {
            playSfx("evade");
          }
          const newlyCritical = handleFieldDeaths();
          renderBattleScreen();
          const proceed = () => {
            // 反撃等で自分が倒れた/相手が居なくなったら残りの連続攻撃は打ち切って手番を終える
            if (remaining > 1 && battle && actor.hp > 0 && aliveField().length > 0) {
              setTimeout(() => doOneAttack(remaining - 1), 450);
            } else {
              setTimeout(advanceTurn, 500);
            }
          };
          const continueAfterAttack = () => {
            if (result && result.guardCounterDmg) {
              // かばう反撃(会心の返し): 敵の攻撃演出の0.5秒後に槍士側の反撃演出を差し込んでから次のターンへ進む
              playGuardCounterVisual(result.target, actor, result.guardCounterDmg, proceed);
            } else {
              proceed();
            }
          };
          autoDeployReserveIfNeeded(newlyCritical, continueAfterAttack);
          }, ENEMY_ATK_IMPACT_MS); // ← 着弾同期の遅延(攻撃モーション刷新2026-08-01)
        };
        doOneAttack(totalAttacks);
      }, enemyActionDelay);
    };
    playEnemyDotStopSequence(actor, blog, continueEnemyTurn);
  } else if (actor.isShikigami) {
    // 式神: プレイヤー操作不要で自動的に行動する(resolveShikigamiAction参照。タイプごとに通常攻撃/連撃/
    // 特技(狐火・回復・結界・スタン・沈黙等)/庇うを使い分ける)
    if (actor.hp <= 0 || actor.status !== "active") { battle.orderIndex++; processNext(); return; }
    battle.actingId = actor.id;
    actor.guarding = false;
    actor.guardProtectCount = 0;
    document.getElementById("actionGrid").innerHTML = "";
    renderBattleScreen();
    const dot = tickTurnStartEffects(actor, blog);
    if (dot.total > 0) {
      popupOn(actor.id, `-${dot.total}`, "dmg");
      popupDotStack(actor.id, dot, "burn");
      const newlyCriticalDot = handleFieldDeaths();
      renderBattleScreen();
      if (actor.hp <= 0 || actor.status !== "active") {
        setTimeout(() => { battle.orderIndex++; processNext(); }, 500);
        return;
      }
    }
    if (actor.stunTurns > 0) {
      actor.stunTurns--;
      blog(`${actor.label}はスタンして動けない！`);
      popupOn(actor.id, "💫スタン", "stun");
      renderBattleScreen();
      battle.orderIndex++;
      setTimeout(processNext, 500);
      return;
    }
    setTimeout(() => {
      const result = resolveShikigamiAction(actor, blog);
      if (result.regen > 0) popupOn(actor.id, `+${result.regen}`, "heal");
      // ダメージ系(attack/multiAttack)だけがtarget.instanceId/dmgを持つ。heal/shield/guard/noneはここでは扱わない
      const hits = result.kind === "multiAttack" ? result.hits : (result.kind === "attack" ? [result] : []);
      // 式神にはclassIdが無いため、actor.classIdをそのまま渡すとattackSfxFor/CLASS_ATTACK_VFXの
      // 参照先が見つからず攻撃音・斬撃VFXが一切出ない不具合があった。鷹を呼ぶの追撃(playHawkAttackVfx)
      // と同じ手法で、侍の通常攻撃と全く同じ音・エフェクトを明示的に流用する(ユーザー指示2026-07-25)
      if (result.kind === "attack" || result.kind === "multiAttack") playAttackSfxWithSwish("samurai");
      hits.forEach((h) => {
        if (h.hit === false) return;
        popupOn(h.target.instanceId, `-${h.dmg}`, "dmg", dmgShakeIntensity(false));
        playScreenShakeOnKillOnly(h.target, h.crit); // 式神の攻撃は毎ラウンド自動で発生するので通常攻撃と同じ扱い
        playSfx(hitTakenSfxFor(h.dmg, h.target.maxHp, h.target.isSwarm));
        if (h.crit) playCritEffects(h.target.instanceId, actor, h.dmg);
      });
      if (result.kind === "attack" && result.hit === false) playSfx("evade");
      if (result.kind === "heal") { popupOn(result.target.id, `+${result.heal}`, "heal"); playSfx("heal"); }
      if (result.kind === "shield") { popupOn(result.target.id, `結界+${result.barrierHp}`, "heal"); playSfx("select"); }
      if (result.kind === "guard") playSfx("guard");
      renderBattleScreen();
      if (result.kind === "attack" || result.kind === "multiAttack") playAttackerLunge(actor.id); // 式神も攻撃時は踏み込む
      hits.forEach((h) => { if (h.hit !== false) playAttackVfx(h.target.instanceId, { classId: "samurai" }, "normal"); });
      const newlyCriticalAction = handleFieldDeaths();
      renderBattleScreen();
      const advanceTurn = () => { battle.orderIndex++; processNext(); };
      autoDeployReserveIfNeeded(newlyCriticalAction, () => setTimeout(advanceTurn, 500));
    }, 600);
  } else {
    if (actor.hp <= 0 || actor.status !== "active" || actor.fleeState === "fled") { battle.orderIndex++; processNext(); return; }
    battle.actingId = actor.id;
    // 自分のターンが回ってきたら、かばうの構え(と身代わり回数のカウント)は無条件でリセットする
    actor.guarding = false;
    actor.guardProtectCount = 0;
    actor.__hyakkaExtraUsedThisTurn = false; // 百花繚乱の追加行動は1手番につき1回まで(2026-07-30)
    tickSamuraiForms(actor, blog); // 鬼神化/明鏡止水のターン経過(残りターン消化・明鏡のストレス回復)
    document.getElementById("actionGrid").innerHTML = "";
    renderBattleScreen();
    const dot = tickTurnStartEffects(actor, blog);
    if (dot.total > 0) {
      popupOn(actor.id, `-${dot.total}`, "dmg");
      popupDotStack(actor.id, dot, "burn");
      const newlyCriticalDot = handleFieldDeaths();
      renderBattleScreen();
      if (actor.hp <= 0 || actor.status !== "active") {
        autoDeployReserveIfNeeded(newlyCriticalDot, () => {
          setTimeout(() => { battle.orderIndex++; processNext(); }, 500);
        });
        return;
      }
    }
    if (actor.stunTurns > 0) {
      actor.stunTurns--;
      blog(`${actor.label}はスタンして動けない！`);
      popupOn(actor.id, "💫スタン", "stun");
      renderBattleScreen();
      battle.orderIndex++;
      setTimeout(processNext, 500);
      return;
    }
    // 逃走準備(fleeState==="preparing")の解決はnextRound()側でラウンドの節目にまとめて行うため、
    // ここでは何もしない(このactorがここに来る時点で既に"fled"になっているか、まだ"preparing"のまま
    // 通常通り行動選択に進む=このラウンド中はまだ逃げていないことになる)
    // 発狂中の吹き出しトリガーは一時停止中
    if (actor.reloading) {
      actor.reloading = false;
      // 土嚢展開(reloadImmuneのstatMod)が有効な間は装填を発生させない
      const reloadImmune = actor.statMods && actor.statMods.some((m) => m.stat === "reloadImmune");
      if (!reloadImmune) {
        blog(`${actor.label}は装填中で動けない！`);
        battle.orderIndex++;
        setTimeout(processNext, 500);
        return;
      }
    }
    if (actor.silenceTurns > 0) {
      blog(`${actor.label}は沈黙していて技が使えない！`);
      actor.silenceTurns--;
    }
    // 変身中のform専用スキル(丸呑み/脱皮/毒液散布等)のクールタイムは、この変身キャラ自身の
    // 手番が来るたびにスキルごとに1減る
    if (actor.formCooldowns) {
      Object.keys(actor.formCooldowns).forEach((key) => {
        if (actor.formCooldowns[key] > 0) actor.formCooldowns[key]--;
      });
    }
    renderActionButtons(actor);
  }
}

// 戻り値: このタイミングで力尽きてロストしたキャラの配列。
// 呼び出し元(processNext等)がこれをautoDeployReserveIfNeededへ渡し、控えの自動登場を判断する
function handleFieldDeaths() {
  const newlyCritical = [];
  // 影分身/式神はHPが0になってもロストにはならず、その場で消滅するだけ。
  // 通常のロスト処理には一切乗せないよう、forEachの一番最初で処理してreturnする
  const vanishIds = [];
  fieldParty.forEach((c) => {
    if ((c.isClone || c.isShikigami) && c.hp <= 0 && c.status === "active") {
      blog(`${c.name}は力尽きて消えた...`);
      vanishIds.push(c.id);
      // 魂養術: 式神が力尽きた瞬間、味方全員のHPを一定割合回復する(分身には効果を紐付けていない)
      if (c.isShikigami) {
        const owner = fieldParty.find((p) => p.id === c.ownerId);
        // 消滅したタイプはこの戦闘中もう召喚できないようにする(帰還時の記録はrecallShikigami参照)
        if (owner && c.shikigamiType) {
          owner.__usedShikigamiTypes = owner.__usedShikigamiTypes || new Set();
          owner.__usedShikigamiTypes.add(c.shikigamiType);
        }
        if (owner && owner.passives && owner.passives.onShikigamiDownPartyHealPct) {
          const pct = owner.passives.onShikigamiDownPartyHealPct;
          fieldParty.filter((p) => p.status === "active" && !p.isClone && !p.isShikigami).forEach((p) => {
            const heal = Math.max(1, Math.round(p.maxHp * pct));
            p.hp = Math.min(p.maxHp, p.hp + heal);
            popupOn(p.id, `+${heal}`, "heal");
          });
          blog(`${owner.name}の魂養術で味方が回復した！`);
        }
      }
    }
  });
  if (vanishIds.length) fieldParty = fieldParty.filter((c) => !vanishIds.includes(c.id));
  fieldParty.forEach((c) => {
    // 変身中に致命傷級のダメージを受けても瀕死にはならず、変身が強制解除されて人間の姿(変身前のHP)に
    // 戻るだけで済む(「変身が身代わりになる」仕様)
    if (c.hp <= 0 && c.status === "active" && c.transformForm) {
      const formName = TRANSFORM_FORMS[c.transformForm].ja;
      revertTransform(c);
      blog(`${c.name}は${formName}の姿を保てず、人間の姿に戻った！`);
      return;
    }
    if (c.hp <= 0 && c.status === "active") {
      if (state.permadeathMode) {
        // パーマデスモード(設定トグルON): 従来どおり戦闘不能=即ロスト(完全消滅)
        c.status = "lost";
        removeFromRoster(c.id); // 名簿からも完全に削除する(ロストは戻ってこないため)
        blog(`${c.name}は倒れた...帰らぬ人となった。`);
        playAllyKoFx(c, `${c.name}は倒れた…帰らぬ人となった`);
      } else {
        // 標準(2026-08-01パーマデス廃止): 戦闘不能=重傷。遠征から強制離脱し、温泉村で
        // INJURY_REST_DAYS日の湯治(編成不可)を経て復帰する(復帰処理はtickInjuryRecovery)。
        // 本人には倒れた衝撃でストレス+100(上限まで)
        c.status = "injured";
        c.injuryRecoverOnDay = state.dayCount + INJURY_REST_DAYS;
        c.fatigue = Math.min(FATIGUE_MAX, (c.fatigue || 0) + 100);
        blog(`${c.name}は深手を負って倒れた...(温泉療養${INJURY_REST_DAYS}日)`);
        playAllyKoFx(c, `${c.name}は深手を負った…温泉療養${INJURY_REST_DAYS}日`);
      }
      advLostHappened = true; // リザルトの朱印評価/「全員生還！」表示用(重傷も「無傷の生還ではない」扱い)
      newlyCritical.push(c);
      // 仲間が倒れた衝撃で、生き残っている他のメンバーのストレスが上がる
      fieldParty.forEach((ally) => {
        if (ally.id !== c.id && ally.status === "active") {
          ally.fatigue = Math.min(FATIGUE_MAX, (ally.fatigue || 0) + 25);
          popupOn(ally.id, "25", "stress");
        }
      });
      // 味方が倒れた時の吹き出し(75%)。倒れた本人は喋れないので他の生存者から選ぶ
      if (Math.random() < DIALOGUE_CHANCE.allyDefeated) {
        const bystanders = fieldParty.filter((ally) => ally.id !== c.id && ally.status === "active");
        if (bystanders.length > 0) trySpeak(bystanders[Math.floor(Math.random() * bystanders.length)], "allyDefeated");
      }
    }
  });
  pruneActiveParty();
  saveState();
  return newlyCritical;
}

// 味方が倒れ(ロストし)た直後、控え(reserveFieldMember)がいれば確認なしで自動的に戦場へ登場させる。
// 交代コマンドとは別枠の無料登場(クールダウンを無視する)だが、登場後のクールダウンは3ターンに
// リセットされる(登場直後に任意交代で回転させることはできない)。控えがいなければ何もしない
function autoDeployReserveIfNeeded(newlyLost, onDone) {
  const someoneLost = newlyLost.some((c) => c.status === "lost" || c.status === "injured");
  if (!someoneLost || !reserveFieldMember || reserveFieldMember.status !== "active") {
    // 誰か倒れたのに控えがいない場合も、倒れ演出(倒れ+カード畳み)を見せ切ってから
    // 戦闘を再開する(演出中に敵が次の行動を始めてしまうと倒れた事実が流れてしまうため)
    if (someoneLost) { setTimeout(onDone, ALLY_KO_ANIM_MS + ALLY_KO_COLLAPSE_MS); return; }
    onDone();
    return;
  }
  // 倒れ演出(1.5秒)→カード畳み(0.35秒)→0.7秒の「間」→控えの走り込み、の順(モック
  // mock_ko_anim.htmlでユーザーが「A・0.7秒」を採用2026-08-01。以前は即走り込みで「あっさりしすぎ」)
  setTimeout(() => {
    const incoming = reserveFieldMember;
    // 「間」の待機中に状況が変わっていないかの再確認(控えが別経路で消えた等の保険)
    if (!incoming || incoming.status !== "active" || !battle) { onDone(); return; }
    reserveFieldMember = null;
    fieldParty.push(incoming);
    battle.swapCooldown = 3;
    // 参加ターン比の経験値: 登場したこのラウンドから出場カウントを付ける
    battle.presence[incoming.id] = (battle.presence[incoming.id] || 0) + 1;
    renderBattleScreen();
    playSfx("swap_dash");
    // ログの文字送りは走り込みとメインスレッドを食い合ってカクつくため、演出後に流す。
    // 登場後に0.7秒の「間」を挟んでからターン進行を再開する。すぐ進めると直後の再描画で
    // 演出が作り直しに巻き込まれて消えてしまうため(演出を最後まで見せるための猶予)
    playSwapRunIn(incoming, () => {
      blog(`控えの${incoming.name}が飛び出してきた！`);
      setTimeout(onDone, 700);
    });
  }, ALLY_KO_ANIM_MS + ALLY_KO_COLLAPSE_MS + ALLY_KO_DEPLOY_PAUSE_MS);
}

// ============ 交代の確認ダイアログ+タッグ走り込み演出 ============
// 「交代」ボタン→控えのステータスカード付きダイアログ→「交代する」で成立(ユーザー指示2026-07-26)。
// 演出はswap_anim_mock.htmlの案1「タッグ走り込み」採用: 下がるキャラが画面端へダッシュ→一拍→
// 控えが反対側から走り込んでズサッと止まる(土埃+「◯◯、参上!」バナー+専用SE swap_dash)
function showSwapConfirmDialog(actor) {
  const rm = reserveFieldMember;
  if (!rm) return;
  showConfirmModal("控えと交代しますか？", [
    { label: "交代する", className: "big primary", onClick: () => performVoluntarySwap(actor) },
    { label: "やめる", className: "big" },
  ]);
  // ダイアログのテキストとボタンの間に、控えのステータスカードを流し込む(showConfirmModalが毎回クリアする枠)。
  // カード自体は戦闘の味方カード準拠デザインの共通部品(reserveStatusCardHtml、ui.js)を使う
  document.getElementById("genericConfirmExtra").innerHTML = reserveStatusCardHtml(rm);
}
// 常設ステージ(シングルトン)。一連の実機検証で分かったこと:
// モック(swap_anim_mock.html)がiPhoneで滑らかだったのは「ページ読み込み時から存在し描画済みの
// 要素」をWAAPI(element.animate=合成スレッド駆動、ProMotionなら120fps)で動かしていたから。
// 本番で同じWAAPIが全く描画されなかったのは「作りたてのDOMに同時挿入→即animate」だったから。
// 手動rAF駆動は動きはするがメインスレッド依存で60fps上限+負荷でカクつく(ユーザー報告)。
// → 結論: ステージを1個だけ作って画面外に常駐させ(=常に描画済みの温まった状態を維持)、
//    使う時だけ実座標へ移動してWAAPIで動かす。これでモックと同じ条件を本番に再現する
let swapFxStageSingleton = null;
function getSwapFxStageSingleton() {
  if (swapFxStageSingleton && swapFxStageSingleton.box.isConnected) return swapFxStageSingleton;
  const box = document.createElement("div");
  box.className = "swap-fx-stage";
  // display:noneではなく画面外配置で待機する(noneだと表示のたびに「初回描画」からやり直しになり、
  // 作りたてDOMと同じ描画されない問題を踏み得るため。画面外でも常にレンダリング対象であり続ける)
  box.style.left = "-2000px";
  box.style.top = "0px";
  box.style.width = "80px";
  box.style.height = "80px";
  // 動かすのはimgではなくこのmover(div)。置換要素を直接animateするのは避ける
  const mover = document.createElement("div");
  mover.className = "swap-fx-mover";
  const clone = document.createElement("img");
  clone.className = "swap-fx-sprite";
  mover.appendChild(clone);
  box.appendChild(mover);
  document.body.appendChild(box);
  swapFxStageSingleton = { box, mover, clone };
  return swapFxStageSingleton;
}
function makePortraitFxStage(card) {
  const img = card ? card.querySelector(".card-portrait-img") : null;
  if (!img || img.tagName !== "IMG") return null; // 式神の絵文字ポートレート等、<img>以外は演出をスキップ
  const rect = img.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const s = getSwapFxStageSingleton();
  // 前回の演出の残り(アニメーション・transform・土埃)を掃除してから再利用する
  s.mover.getAnimations().forEach((a) => a.cancel());
  s.mover.style.transform = "";
  s.box.querySelectorAll(".swap-dust").forEach((d) => d.remove());
  s.box.style.left = rect.left + "px";
  s.box.style.top = rect.top + "px";
  s.box.style.width = rect.width + "px";
  s.box.style.height = rect.height + "px";
  s.clone.src = img.currentSrc || img.src;
  img.style.opacity = "0"; // 本物は演出中隠す(台座の見た目はステージ側が描いている)
  return { box: s.box, mover: s.mover, clone: s.clone, img, width: rect.width };
}
// 常設ステージを画面外の待機位置へ戻す(removeはしない=描画済みの温まった状態を保つ)
function removePortraitFxStage(stage) {
  if (!stage) return;
  stage.img.style.opacity = "";
  stage.mover.getAnimations().forEach((a) => a.cancel());
  stage.mover.style.transform = "";
  stage.box.querySelectorAll(".swap-dust").forEach((d) => d.remove());
  stage.box.style.left = "-2000px";
}
// 起動時に常設ステージを先に作って描画に乗せておく(初回の交代でも「作りたてDOM」にならないように)
getSwapFxStageSingleton();
function performVoluntarySwap(actor) {
  if (battleActionLocked || !battle || (battle.swapCooldown || 0) > 0) return;
  battleActionLocked = true;
  battle.swapCooldown = 3;
  document.getElementById("actionGrid").innerHTML = ""; // 演出の間はボタンを消して連打を防ぐ
  playSfx("swap_dash");
  // 退場: 今のカードの立ち絵が右へダッシュ(前傾)。演出後にデータを入れ替えて再描画→走り込み
  const outCard = document.querySelector(`#battlePartyBar .party-member[data-id="${actor.id}"]`);
  const outStage = makePortraitFxStage(outCard);
  const finishSwap = () => {
    removePortraitFxStage(outStage); // 退場ステージを片付ける(直後の再描画でカード自体も作り直される)
    // 交代ログの文字送り(18msごとのDOM追加)が走り込みと同時に走るとメインスレッドを食い合って
    // 手動rAF駆動の走り込みがカクつくため、ログは溜めておいて演出が終わってから流す
    const pendingLogs = [];
    const incoming = swapReserveMember(actor, (msg) => pendingLogs.push(msg));
    if (!incoming) { battleActionLocked = false; renderActionButtons(actor); return; }
    // 参加ターン比の経験値: 交代が発生したラウンドは下がった側(ラウンド頭で加算済み)と
    // 出た側の両方に出場カウントを付ける
    battle.presence[incoming.id] = (battle.presence[incoming.id] || 0) + 1;
    battle.actingId = incoming.id; // このターンをそのまま入れ替わった控えのキャラへ引き継ぐ
    // 手番切り替えのカードスライド演出(acting-enter)は発火させない。カード全体がポンと跳ねる動きが
    // 走り込みに被さって「ドンと急に現れる」見た目になっていたため(ユーザー報告2026-07-26)、
    // 交代の登場はこの後の走り込み(playSwapRunIn)だけに一本化する
    lastPartyBarActingId.battlePartyBar = incoming.id;
    renderBattleScreen();
    playSwapRunIn(incoming, () => {
      pendingLogs.forEach(blog);
      renderActionButtons(incoming);
    });
  };
  if (outStage) {
    const w = outStage.width;
    const outAnim = outStage.mover.animate([
      { transform: "translateX(0) rotate(0deg)" },
      { transform: `translateX(${Math.round(w * 0.12)}px) rotate(4deg)`, offset: 0.3 },
      { transform: `translateX(${Math.round(w * 1.3)}px) rotate(8deg)` },
    ], { duration: 250, easing: "cubic-bezier(0.5, 0, 0.9, 0.6)", fill: "both" });
    outAnim.onfinish = () => setTimeout(finishSwap, 100); // 一拍(0.1秒)おいてから走り込み
  } else {
    finishSwap();
  }
}
// iOS Safariの初回描画待ちヘルパー(交代の走り込みが実機で描画されない問題の対策一式)。
// 原因: renderBattleScreen()のDOM再構築→ステージ挿入→同じJSタスク内でdelayなしのanimate()即開始、
// という流れだと、WebKitが初回スタイル計算/imgのデコード/合成レイヤーの確立/初回コミットを終える前に
// WAAPIのタイムラインだけが進み、途中フレームが一切画面に乗らない(onfinishは正しい時刻に発火する)。
// 同じステージ内でもdelay180ms付きの土埃(div)だけ動いていたのはこのため。
// 対策: ①初期transformを通常スタイルとして先に確立 ②クローンimgのdecode()を待つ
// ③レイアウトを同期確定 ④rAFを2回待って初期状態を最低一度描画させる ⑤その後にanimate()開始
function waitTwoAnimationFrames() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}
async function waitForImageDecode(img) {
  if (!img) return;
  if (typeof img.decode === "function") {
    try {
      await img.decode();
      return;
    } catch (error) {
      // decode失敗時はload/error待ちへフォールバック
    }
  }
  if (img.complete) return;
  await new Promise((resolve) => {
    const finish = () => {
      img.removeEventListener("load", finish);
      img.removeEventListener("error", finish);
      resolve();
    };
    img.addEventListener("load", finish, { once: true });
    img.addEventListener("error", finish, { once: true });
  });
}
// 走り込み登場(手動交代・倒れた時の自動登場の共通演出)。renderBattleScreen()で作り直された
// 直後のカードに対して、立ち絵の走り込み+土埃+「◯◯、参上!」バナーを重ねる。
// カードが見つからない場合(理論上の保険)は演出をスキップして即続行する
async function playSwapRunIn(incoming, onDone) {
  const card = document.querySelector(`#battlePartyBar .party-member[data-id="${incoming.id}"]`);
  const stage = makePortraitFxStage(card);
  if (!stage) { onDone(); return; }
  const w = stage.width;
  // 初期位置(画面外)を通常スタイルとして先に確立し、画像のデコード完了と初回描画を待ってから動かし始める
  stage.mover.style.transform = `translateX(${Math.round(w * 1.3)}px) rotate(-8deg)`;
  stage.mover.style.transformOrigin = "50% 50%";
  await waitForImageDecode(stage.clone);
  void stage.mover.offsetWidth; // レイアウトを同期的に確定
  await waitTwoAnimationFrames();
  // 待機中に別の描画でDOMが破棄された場合の保険
  if (!stage.box.isConnected || !card.isConnected) {
    removePortraitFxStage(stage);
    battleActionLocked = false;
    onDone();
    return;
  }
  // 土埃: 立ち絵の足元(ステージの下端)に3つ、時間差で舞い上がる
  [0, 1, 2].forEach((k) => {
    const d = document.createElement("div");
    d.className = "swap-dust";
    d.style.left = (22 + k * 18) + "px";
    stage.box.appendChild(d);
    d.animate([
      { transform: "translate(0,0) scale(0.6)", opacity: 0 },
      { transform: `translate(${8 + k * 4}px,-${6 + k * 3}px) scale(${1.3 + k * 0.3})`, opacity: 0.8, offset: 0.4 },
      { transform: `translate(${14 + k * 6}px,-${10 + k * 4}px) scale(${1.8 + k * 0.3})`, opacity: 0 },
    ], { duration: 420, delay: 180 + k * 40, easing: "ease-out" }).onfinish = () => d.remove();
  });
  // 走り込み本体: 常設ステージ上のWAAPI(合成スレッド駆動=モックと同じ滑らかさ)
  const inAnim = stage.mover.animate([
    { transform: `translateX(${Math.round(w * 1.3)}px) rotate(-8deg)` },
    { transform: `translateX(${Math.round(w * -0.07)}px) rotate(-3deg)`, offset: 0.7 },
    { transform: `translateX(${Math.round(w * 0.03)}px) rotate(0deg)`, offset: 0.88 },
    { transform: "translateX(0) rotate(0deg)" },
  ], { duration: 300, easing: "cubic-bezier(0.2, 0.8, 0.4, 1)", fill: "both" });
  inAnim.onfinish = () => {
    // 本物の立ち絵は即座に戻す(ステージのクローンが同じ位置に重なっているので切り替わりは見えない)。
    // ステージ自体は土埃の舞い残り(最大+0.4秒程度)を見せ切ってから待機位置へ戻す
    stage.img.style.opacity = "";
    setTimeout(() => removePortraitFxStage(stage), 420);
    // 「◯◯、参上!」バナーは2026-08-01ユーザー指示で廃止(走り込み+土埃+SEの演出はそのまま)
    battleActionLocked = false;
    onDone();
  };
}

// 変化の術は戦闘終了(勝利/逃走/全滅)では自動解除されない(ユーザー指示により撤廃)。
// 現在この関数を呼ぶのは野営開始時のみ(camp.js)。
function revertAllTransforms() {
  fieldParty.forEach((c) => {
    if (c.transformForm) {
      const formName = TRANSFORM_FORMS[c.transformForm].ja;
      revertTransform(c);
      blog(`${c.name}は${formName}の姿から人間に戻った。`);
    }
  });
}

// 対象選択/道具メニューなどのサブ画面(戻るボタンは置かず、コマンド外をタップすると呼ばれる)を
// キャンセルして行動選択に戻る
function cancelBattleSubMenu() {
  if (!battle || battle.actingId == null) return;
  if (battleActionLocked) return; // 既に行動を確定させて次のターンへの待機中なら、今さらメニューへ戻さない(二重行動防止)
  const actor = fieldParty.find((c) => c.id === battle.actingId);
  if (!actor) return;
  pendingEnemyPick = null;
  pendingAllyPick = null;
  renderBattleScreen();
  renderActionButtons(actor);
}

// 敵が2体以上生きている場合は対象を選ばせ、1体だけなら自動でその敵を対象にする。
// 対象選択中は上の敵カード画像を直接タップしても選べる(pendingEnemyPick、renderBattleScreen側で処理)
function pickSingleEnemyTarget(onPicked) {
  const targets = targetableEnemies();
  if (targets.length === 1) { onPicked(targets[0]); return; }
  battleSubMenuActive = true;
  // 対象選択中はまだ何も確定していないため、attack/ability/skillボタン押下時に立てたbattleActionLockedを
  // 一旦解除し、「戻る」(cancelBattleSubMenu)で確実に行動選択へ戻れるようにする(そのまま
  // trueだと「戻る」も同じロックで弾かれてしまい、一切反応しなくなるバグがあった)。
  // 実際に対象を選んだ瞬間(下の各onclick内)でbattleActionLockedを再度trueに戻し、
  // 解決中(ヒットストップ等の遅延の間)にactionGridの外を誤タップしてキャンセルされる
  // レースからは引き続き保護する
  battleActionLocked = false;
  pendingEnemyPick = (t) => { onPicked(t); };
  renderBattleScreen();
  const grid = document.getElementById("actionGrid");
  grid.innerHTML = "";
  // 敵が5体以上いると2列のままでは行数が増えすぎ、末尾の「戻る」がactionGrid(fixed配置)の画面外に
  // 押し出されて押せなくなっていたため、この対象選択だけ3列にして行数を減らす
  // (renderActionButtonsで通常の2列に戻す)
  grid.style.gridTemplateColumns = "1fr 1fr 1fr";
  targets.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = "big";
    btn.textContent = `${t.label} (${t.hp}/${t.maxHp})`;
    btn.onclick = () => {
      if (!pendingEnemyPick) return; // 既に別経路(敵カード直接タップ等)で選択済みなら無視する(二重行動防止)
      pendingEnemyPick = null;
      battleActionLocked = true; // 対象を選んだ瞬間から解決完了まで、再度ロックする
      onPicked(t);
    };
    grid.appendChild(btn);
  });
  if (targets.length === 0) {
    // ガマの丸呑みで狙える敵が1体も残っていない時は「待機」を選べるようにする(ターンをパスするだけ、MP消費なし)
    const waitBtn = document.createElement("button");
    waitBtn.className = "big";
    waitBtn.textContent = "待機";
    waitBtn.onclick = () => {
      if (!pendingEnemyPick) return;
      pendingEnemyPick = null;
      battleActionLocked = true;
      const actor = fieldParty.find((c) => c.id === battle.actingId);
      blog(`${actor ? actor.name : "仲間"}は様子を見た。`);
      renderBattleScreen();
      finishPlayerAction();
    };
    grid.appendChild(waitBtn);
  }
  const backBtn = document.createElement("button");
  backBtn.className = "big";
  backBtn.textContent = "戻る";
  backBtn.onclick = () => cancelBattleSubMenu();
  grid.appendChild(backBtn);
}

// 連斬(会心後の追撃)専用の対象選択。pickSingleEnemyTargetと違い「戻る」を出さない
// (通常の行動選択に戻れてしまうと、既に確定した通常攻撃の分を無かったことにして
// 別の行動を選び直せてしまう抜け道になるため)。対象が1体もいなければ追撃自体を諦める
function pickFollowupTarget(onPicked) {
  const targets = targetableEnemies();
  if (targets.length === 0) { onPicked(null); return; }
  if (targets.length === 1) { onPicked(targets[0]); return; }
  battleSubMenuActive = true;
  battleActionLocked = false;
  pendingEnemyPick = (t) => { onPicked(t); };
  renderBattleScreen();
  const grid = document.getElementById("actionGrid");
  grid.innerHTML = "";
  grid.style.gridTemplateColumns = "1fr 1fr 1fr";
  targets.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = "big";
    btn.textContent = `${t.label} (${t.hp}/${t.maxHp})`;
    btn.onclick = () => {
      if (!pendingEnemyPick) return;
      pendingEnemyPick = null;
      battleActionLocked = true;
      onPicked(t);
    };
    grid.appendChild(btn);
  });
}
// 連斬など: 会心を出した直後の追撃。通常攻撃と同じ処理を簡略版で再現する
// (最初の一撃の武甕槌命/建御雷神の御守判定・ヒットストップ演出の間は含めない。追撃はあくまで「おまけ」の一撃)
// 連斬(onCritExtraAttackChance)の発動判定+行動終了の共通ラッパー。従来は通常攻撃の会心にしか
// 反応しなかったが、descは「会心を出した直後」であり技の会心も対象(鬼神斬り(会心+40%)との
// シナジーがユーザーの設計意図、2026-07-30)。技・基本アビリティの完了経路からもこれを通す。
// 判定は行動1回につき1回(範囲技で複数会心が出ても1回だけ)
function maybeCritFollowupThenFinish(actor, wasCrit) {
  if (wasCrit && actor.hp > 0 && actor.passives && actor.passives.onCritExtraAttackChance && Math.random() < actor.passives.onCritExtraAttackChance) {
    runCritFollowupAttack(actor, () => finishPlayerAction(wasCrit));
    return;
  }
  finishPlayerAction(wasCrit);
}
function runCritFollowupAttack(actor, onDone) {
  blog(`${actor.label}は会心の勢いのまま、もう一度斬りかかった！`);
  pickFollowupTarget((target) => {
    if (!target) { onDone(); return; }
    playAttackSfxWithSwish(actor.classId);
    const result = performAttack(actor, target, blog);
    if (result.hit) playSfx(hitTakenSfxFor(result.dmg, target.maxHp, target.isSwarm));
    if (result.hit) {
      popupOn(target.instanceId, `-${result.dmg}`, "dmg", dmgShakeIntensity(false));
      playScreenShakeOnKillOnly(target, result.crit);
      if (result.crit) playCritEffects(target.instanceId, actor, result.dmg);
      maybeSpeakOnKill(actor, target);
    } else {
      playSfx("evade");
    }
    renderBattleScreen();
    playAttackerLunge(actor.id);
    if (result.hit) playAttackVfx(target.instanceId, actor, "normal");
    triggerShootDownEvents(result.shotDown ? [target] : [], onDone);
  });
}

// スキルツリーの能動スキルを実行する。種類(自己バフ/全体バフ/回復/範囲攻撃/単体攻撃)ごとに対象の選び方が違う
function runTreeSkill(actor, skill) {
  const action = skill.action;
  // 怒声など: HP割合条件/戦闘中一度きりの使用制限を持つ技は、MPを一切消費させずにその場で弾く
  // (MP減算はこの関数のもっと後ろで行われるため、ここで早期returnすれば無駄打ちにならない)
  if (action.hpBelowPct != null && actor.hp / actor.maxHp > action.hpBelowPct) {
    blog(`${actor.label}はまだ十分に消耗していない！`);
    renderActionButtons(actor);
    return;
  }
  if (action.onceFlag && actor[action.onceFlag]) {
    blog(`${actor.label}は${skill.name}を既に使い切っている！`);
    renderActionButtons(actor);
    return;
  }
  // 【必殺技キャスト演出(モック案A採用2026-08-01)】気合い発光+技名帯→技本体。
  // 対象選択(敵/味方)を伴う技は「選択してから技名と音」(2026-08-01ユーザー指示)のため
  // 入口では鳴らさず、各分岐の選択後コールバック内で鳴らす(treeSkillFxAfterPick)。
  // 使用不可の早期return(上の怒声系ガード)は演出より前に弾いておく
  if (treeSkillFxAfterPick(action)) runTreeSkillBody(actor, skill);
  else playSkillCastFx(actor, skill.name, () => runTreeSkillBody(actor, skill));
}
// 対象選択を伴う(=キャスト演出を選択後に出す)技の判定。runTreeSkillBodyの分岐実体と対応させる。
// 変身/式神召喚の種類ピッカーは戦場の対象選択ではないため入口演出のまま
function treeSkillFxAfterPick(action) {
  if (!action) return false;
  if (action.pickTargets === 2) return true; // 迅雷突き(敵2回選択)
  if (action.kind === "dismissShikigamiDebuff" || action.kind === "stunNoCost") return true; // 敵単体選択
  if (action.kind === "shieldAlly") return true; // 結界(味方選択)
  if (action.kind === "heal" && !action.aoe) return true; // 単体回復(味方選択)
  const NO_PICK_KINDS = ["transform", "guardCounterSelf", "damageRandomMulti", "shieldSelf", "summonShikigami",
    "debuffAllNoCost", "kishinka", "buffSelf", "buffParty", "buffPartyNoCost", "summonHawk", "heal"];
  if (NO_PICK_KINDS.includes(action.kind)) return false;
  // 未知のkind=ダメージ系フォールスルー: 全体(aoe)は選択なし、単体は敵選択あり
  return !action.aoe;
}
function runTreeSkillBody(actor, skill) {
  const action = skill.action;
  // 八幡神の御守: 戦闘中最初に使う技のMP消費が0になる(消費前にコスト分を先に補充しておき、
  // useTreeSkill内の通常の減算と相殺させることで実質無償化する)
  const cost = skillMpCost(actor, skill.mp, skill.action);
  if (cost > 0 && hasOmamori("hachiman") && !battle.omamoriUsed.hachiman) {
    actor.mp += cost;
    battle.omamoriUsed.hachiman = true;
    blog("八幡神の御守の加護で、技を無償で繰り出せた！");
  }
  if (action.kind === "transform") {
    const mpBeforeCost = actor.mp; // 3択の「戻る」で変身をやめた時、MP消費を取り消せるよう直前の値を控えておく
    const result = useTreeSkill(actor, actor, skill, blog); // MP消費/不足判定のみ処理される
    if (result && result.failed) { battleActionLocked = false; return; } // 再描画を挟まず抜けるため、ロックを自分で解除しておく
    renderTransformFormPicker(actor, mpBeforeCost);
    return;
  }
  if (action.kind === "guardCounterSelf") {
    playSfx("guard");
    useTreeSkill(actor, actor, skill, blog);
    renderBattleScreen();
    finishPlayerAction();
    return;
  }
  if (action.kind === "damageRandomMulti") {
    playAttackSfxWithSwish(actor.classId);
    const result = useTreeSkill(actor, null, skill, blog);
    const hits = (result && result.randomHits) || [];
    document.getElementById("actionGrid").innerHTML = "";
    renderBattleScreen();
    const STAGGER_MS = 260;
    let anyCrit = false;
    hits.forEach((h, i) => {
      setTimeout(() => {
        if (h.hit) {
          popupOn(h.target.instanceId, `-${h.dmg}`, "dmg", dmgShakeIntensity(true));
          playScreenShakeOnHit(h.target, h.crit);
          playSfx(hitTakenSfxFor(h.dmg, h.target.maxHp, h.target.isSwarm));
          if (h.crit) { anyCrit = true; playCritEffects(h.target.instanceId, actor, h.dmg); }
          playAttackVfx(h.target.instanceId, actor, "skill");
        } else {
          playSfx("evade");
        }
        renderBattleScreen();
        if (i === 0) playAttackerLunge(actor.id, true); // 踏み込みは最初の一撃だけ(連撃のたびに跳ねるとしつこい)。技なので強ヒットストップ
      }, i * STAGGER_MS);
    });
    setTimeout(() => {
      if (!maybeSpeakAllDefeated()) maybeSpeakOnCrit(actor, anyCrit);
      maybeCritFollowupThenFinish(actor, anyCrit);
    }, hits.length * STAGGER_MS + 50);
    return;
  }
  if (action.kind === "shieldSelf") {
    playSfx("select");
    useTreeSkill(actor, actor, skill, blog);
    renderBattleScreen();
    finishPlayerAction();
    return;
  }
  // 結界術: 味方単体を選んで数値シールドを付与する
  if (action.kind === "shieldAlly") {
    renderTreeSkillShieldAllyPicker(actor, skill);
    return;
  }
  // 式神召喚: 陰陽師の現在レベル+この戦闘で未使用の式神タイプから選ばせる
  if (action.kind === "summonShikigami") {
    renderShikigamiTypePicker(actor, skill);
    return;
  }
  // 憑依: 式神がいなければMPを消費させずにその場で中止する(ターゲット選択に進まない)
  if (action.kind === "dismissShikigamiDebuff") {
    if (!fieldParty.some((c) => c.isShikigami && c.ownerId === actor.id)) {
      blog(`${actor.label}には式神がいない！`);
      renderActionButtons(actor);
      return;
    }
    pickSingleEnemyTarget((target) => playSkillCastFx(actor, skill.name, () => {
      playSfx("select");
      const result = useTreeSkill(actor, target, skill, blog);
      renderBattleScreen();
      if (result && result.debuffed) playAttackVfx(target.instanceId, actor, "skill");
      finishPlayerAction();
    }));
    return;
  }
  // 撒菱など: ターンを消費しないので、行動確定後は普通に行動選択へ戻す(変化の術/鷹を呼ぶと同じ扱い)
  if (action.kind === "debuffAllNoCost") {
    playSfx("select");
    useTreeSkill(actor, null, skill, blog);
    renderBattleScreen();
    renderActionButtons(actor);
    return;
  }
  // 影縫いなど: ターンを消費しない単体スタン。対象を選んでから解決する
  if (action.kind === "stunNoCost") {
    pickSingleEnemyTarget((target) => playSkillCastFx(actor, skill.name, () => {
      playSfx("guard");
      const result = useTreeSkill(actor, target, skill, blog);
      renderBattleScreen();
      if (result && result.stunned) playAttackVfx(target.instanceId, actor, "skill");
      renderActionButtons(actor);
    }));
    return;
  }
  // 鬼神化(2026-07-30): 遠征中一度だけの変身。ターンを消費しない(発動後そのまま行動を選べる)
  if (action.kind === "kishinka") {
    if (actor.kishinkaUsed) {
      blog(`${actor.label}は既に鬼の力を使い果たしている！`);
      renderActionButtons(actor);
      return;
    }
    const result = useTreeSkill(actor, actor, skill, blog);
    if (result && result.failed) { battleActionLocked = false; return; }
    playSfx("transform");
    renderBattleScreen(); // 立ち絵が鬼神化差分(characterPortraitSrc)に切り替わる
    renderActionButtons(actor);
    return;
  }
  if (action.kind === "buffSelf") {
    playSfx("select");
    useTreeSkill(actor, actor, skill, blog);
    renderBattleScreen();
    // 明鏡止水など: ターンを消費しない自己バフ
    if (action.noCost) { renderActionButtons(actor); return; }
    finishPlayerAction();
    return;
  }
  if (action.kind === "buffParty") {
    playSfx("select");
    useTreeSkill(actor, aliveField(), skill, blog);
    renderBattleScreen();
    finishPlayerAction();
    return;
  }
  // 守護陣など: ターンを消費しない全体バフ(撒菱=debuffAllNoCostの全体バフ版)
  if (action.kind === "buffPartyNoCost") {
    playSfx("select");
    useTreeSkill(actor, aliveField(), skill, blog);
    renderBattleScreen();
    renderActionButtons(actor);
    return;
  }
  if (action.kind === "summonHawk") {
    // 変身解除と同じく、召喚自体はターンを消費しない(呼び出した後そのまま別の行動を選べる)
    const result = useTreeSkill(actor, actor, skill, blog);
    if (result && result.failed) { renderActionButtons(actor); return; }
    playSfx("hawk_summon");
    renderBattleScreen();
    renderActionButtons(actor);
    return;
  }
  if (action.kind === "heal") {
    if (action.aoe) {
      playSfx("heal");
      // reviveHpPct(蘇生系)は瀕死廃止(戦闘不能=即ロスト)に伴い蘇生対象が存在しなくなったため、
      // 生存者への回復としてだけ機能する(スキル自体の整理はスキル棚卸しの際にユーザーが行う)
      const targets = fieldParty.filter((c) => !c.transformForm && !c.isClone && !c.isShikigami && c.status === "active");
      const result = useTreeSkill(actor, targets, skill, blog);
      if (result && result.healed) {
        result.healed.forEach((h) => {
          popupOn(h.target.id, `+${h.heal}`, "heal");
          maybeSpeakHealed(h.target);
        });
      }
      renderBattleScreen();
      finishPlayerAction();
      return;
    }
    renderTreeSkillAllyPicker(actor, skill);
    return;
  }
  // ダメージ系
  if (action.aoe) {
    playAttackSfxWithSwish(actor.classId);
    if (action.onceFlag) actor[action.onceFlag] = true; // 怒声など: 戦闘中一度きりのスキルはここで使用済みにする
    const targetsList = targetableEnemies();
    const result = useTreeSkill(actor, targetsList, skill, blog);
    const shotDownTargets = [];
    const hitTargets = [];
    let anyCrit = false;
    if (result && result.dmgs) {
      let anyEvaded = false;
      let anyHit = false;
      targetsList.forEach((t, i) => {
        const r = result.dmgs[i];
        if (r && r.hit) {
          popupOn(t.instanceId, `-${r.dmg}`, "dmg", dmgShakeIntensity(true));
          anyHit = true;
          hitTargets.push(t);
          if (r.shotDown) shotDownTargets.push(t);
          playSfx(hitTakenSfxFor(r.dmg, t.maxHp, t.isSwarm));
          if (r.crit) { anyCrit = true; playCritEffects(t.instanceId, actor, r.dmg); }
        }
        else anyEvaded = true;
      });
      if (anyEvaded) playSfx("evade");
      if (!maybeSpeakAllDefeated()) maybeSpeakOnCrit(actor, anyCrit);
    }
    renderBattleScreen();
    hitTargets.forEach((t) => playAttackVfx(t.instanceId, actor, "skill"));
    triggerShootDownEvents(shotDownTargets, () => maybeCritFollowupThenFinish(actor, anyCrit));
    return;
  }
  // 迅雷突き(2026-07-30): 敵を2回指定して1体ずつ100%威力で攻撃する(同じ敵を2回選んでもよい)。
  // 2体選び終えてから技を1回だけ実行し(MP消費も1回)、演出は乱れ斬りと同じずらし再生
  if (action.pickTargets === 2) {
    pickSingleEnemyTarget((t1) => {
      pickSingleEnemyTarget((t2) => playSkillCastFx(actor, skill.name, () => {
        playAttackSfxWithSwish(actor.classId);
        const picked = [t1, t2];
        const result = useTreeSkill(actor, picked, skill, blog);
        const rs = (result && result.dmgs) || [];
        document.getElementById("actionGrid").innerHTML = "";
        renderBattleScreen();
        const STAGGER_MS = 260;
        let anyCrit = false;
        rs.forEach((h, i) => {
          setTimeout(() => {
            const t = picked[i];
            if (h.hit && h.dmg > 0) {
              popupOn(t.instanceId, `-${h.dmg}`, "dmg", dmgShakeIntensity(true));
              playScreenShakeOnHit(t, h.crit);
              playSfx(hitTakenSfxFor(h.dmg, t.maxHp, t.isSwarm));
              if (h.crit) { anyCrit = true; playCritEffects(t.instanceId, actor, h.dmg); }
              playAttackVfx(t.instanceId, actor, "skill");
            } else if (!h.hit && t.hp > 0) playSfx("evade");
            renderBattleScreen();
            if (i === 0) playAttackerLunge(actor.id, true); // 技なので強ヒットストップ
          }, i * STAGGER_MS);
        });
        setTimeout(() => {
          if (!maybeSpeakAllDefeated()) maybeSpeakOnCrit(actor, anyCrit);
          maybeCritFollowupThenFinish(actor, anyCrit);
        }, rs.length * STAGGER_MS + 50);
      }));
    });
    return;
  }
  pickSingleEnemyTarget((target) => playSkillCastFx(actor, skill.name, () => {
    playAttackSfxWithSwish(actor.classId);
    const result = useTreeSkill(actor, target, skill, blog);
    const r = result && result.dmgs && result.dmgs[0];
    if (r && r.hit && r.hits && r.hits.length > 1) {
      // 連突き/二連射のような多段ヒット技: 1振りごとに間を置いて別々の攻撃モーション/ポップアップ/
      // 鷹の追撃を再生する(合計ダメージを1回にまとめて見せていた旧仕様をユーザー指摘で修正)。
      // renderBattleScreen()は#actionGridに触れないため、finishPlayerAction()が呼ばれるまで
      // 演出中もボタンが押せる状態のまま残っており、連打すると同じ技が多重発動するバグがあった
      // (演出の間はボタンを消して連打を防ぐ)
      document.getElementById("actionGrid").innerHTML = "";
      renderBattleScreen();
      playAttackerLunge(actor.id, true); // 技なので強ヒットストップ
      if (!maybeSpeakAllDefeated()) maybeSpeakOnCrit(actor, r.crit);
      const STAGGER_MS = 260;
      r.hits.forEach((hitInfo, i) => {
        setTimeout(() => {
          // ダメージ行(と貫通/鷹追撃の行があればそれも)を、このヒットのVFXと同時に流す。
          // 以前はuseTreeSkill内で全振り分のログが即座にまとめて出てしまい、エフェクトだけが
          // 遅れて2回再生される見た目とテキストのタイミングがズレていた
          (hitInfo.logLines || []).forEach((line) => blog(line));
          popupOn(target.instanceId, `-${hitInfo.dmg}`, "dmg", dmgShakeIntensity(true));
          playScreenShakeOnHit(target, hitInfo.crit);
          playSfx(hitTakenSfxFor(hitInfo.dmg, target.maxHp, target.isSwarm));
          if (hitInfo.crit) playCritEffects(target.instanceId, actor, hitInfo.dmg);
          playAttackVfx(target.instanceId, actor, "skill");
          if (r.hawkTargetIds && r.hawkTargetIds[i]) playHawkAttackVfx(actor, r.hawkTargetIds[i]);
        }, i * STAGGER_MS);
      });
      setTimeout(() => {
        // 暗殺術など: このスキルでキルした場合はターンを消費せず、もう一度行動できる
        if (action.extraTurnOnKill && target.hp <= 0) {
          triggerShootDownEvents(r.shotDown ? [target] : [], () => renderActionButtons(actor));
          return;
        }
        triggerShootDownEvents(r.shotDown ? [target] : [], () => maybeCritFollowupThenFinish(actor, r.crit));
      }, r.hits.length * STAGGER_MS);
      return;
    }
    if (r && r.hit) {
      popupOn(target.instanceId, `-${r.dmg}`, "dmg", dmgShakeIntensity(true));
      playScreenShakeOnHit(target, r.crit);
      playSfx(hitTakenSfxFor(r.dmg, target.maxHp, target.isSwarm));
      if (r.crit) playCritEffects(target.instanceId, actor, r.dmg);
      if (!maybeSpeakAllDefeated()) maybeSpeakOnCrit(actor, r.crit);
    }
    else if (r) playSfx("evade");
    renderBattleScreen();
    playAttackerLunge(actor.id, true); // 技なので強ヒットストップ
    if (r && r.hit) playAttackVfx(target.instanceId, actor, "skill");
    if (r && lastHawkFollowupHappened) playHawkAttackVfx(actor, r.hawkTargetId || target.instanceId); // 技が外れても鷹は独立して追撃する。倒した場合は別の対象へ
    // 暗殺術など: このスキルでキルした場合はターンを消費せず、もう一度行動できる
    if (action.extraTurnOnKill && r && r.hit && target.hp <= 0) {
      triggerShootDownEvents(r && r.shotDown ? [target] : [], () => renderActionButtons(actor));
      return;
    }
    // 神速抜刀など: ヒット/ミストに関わらずターンを消費しない単体攻撃
    if (action.noCost) {
      triggerShootDownEvents(r && r.shotDown ? [target] : [], () => renderActionButtons(actor));
      return;
    }
    triggerShootDownEvents(r && r.shotDown ? [target] : [], () => maybeCritFollowupThenFinish(actor, r && r.crit));
  }));
}

// スキルツリーの単体回復スキル用、味方の対象選択(既存のrenderAllyTargetsは回復薬/治癒の術専用のため別関数にしてある)
function renderTreeSkillAllyPicker(actor, skill) {
  battleSubMenuActive = true;
  const grid = document.getElementById("actionGrid");
  grid.innerHTML = "";
  aliveField().filter((target) => !target.transformForm && !target.isClone && !target.isShikigami).forEach((target) => {
    const btn = document.createElement("button");
    btn.className = "big";
    btn.textContent = `${target.name} (${target.hp}/${target.maxHp})`;
    btn.onclick = () => playSkillCastFx(actor, skill.name, () => {
      playSfx("heal");
      const result = useTreeSkill(actor, target, skill, blog);
      if (result && result.healed && result.healed[0]) { popupOn(target.id, `+${result.healed[0].heal}`, "heal"); maybeSpeakHealed(target); }
      renderBattleScreen();
      finishPlayerAction();
    });
    grid.appendChild(btn);
  });
  const backBtn = document.createElement("button");
  backBtn.className = "big";
  backBtn.textContent = "戻る";
  backBtn.onclick = () => renderActionButtons(actor);
  grid.appendChild(backBtn);
}

// 結界術用、味方の対象選択(renderTreeSkillAllyPickerは回復専用のため、シールド付与用に別関数にしてある)
function renderTreeSkillShieldAllyPicker(actor, skill) {
  battleSubMenuActive = true;
  const grid = document.getElementById("actionGrid");
  grid.innerHTML = "";
  aliveField().filter((target) => !target.transformForm && !target.isClone).forEach((target) => {
    const btn = document.createElement("button");
    btn.className = "big";
    btn.textContent = `${target.name} (${target.hp}/${target.maxHp})`;
    btn.onclick = () => playSkillCastFx(actor, skill.name, () => {
      playSfx("select");
      const result = useTreeSkill(actor, target, skill, blog);
      if (result && result.shielded) popupOn(target.id, `結界+${result.barrierHp}`, "heal");
      renderBattleScreen();
      finishPlayerAction();
    });
    grid.appendChild(btn);
  });
  const backBtn = document.createElement("button");
  backBtn.className = "big";
  backBtn.textContent = "戻る";
  backBtn.onclick = () => renderActionButtons(actor);
  grid.appendChild(backBtn);
}

// 式神召喚の種類選択。陰陽師の現在レベルで解禁済み、かつこの戦闘でまだ帰還/消滅させていないタイプだけを
// 選択肢に出す(unlockedShikigamiTypes参照)。MPが足りないタイプはグレーアウトして選べないようにする
function renderShikigamiTypePicker(actor, skill) {
  battleSubMenuActive = true;
  const grid = document.getElementById("actionGrid");
  grid.innerHTML = "";
  const options = unlockedShikigamiTypes(actor, actor.__usedShikigamiTypes);
  if (!options.length) {
    blog(`${actor.label}が今召喚できる式神がいない！`);
    renderActionButtons(actor);
    return;
  }
  options.forEach((typeKey) => {
    const def = SHIKIGAMI_DEFS[typeKey];
    const affordable = actor.mp >= def.mp;
    const btn = document.createElement("button");
    btn.className = "big";
    btn.textContent = `${def.emoji}${def.name}(MP${def.mp})`;
    if (!affordable) { btn.disabled = true; btn.style.opacity = "0.5"; }
    btn.onclick = () => {
      const result = useTreeSkill(actor, typeKey, skill, blog);
      renderBattleScreen();
      if (result && result.failed) { playSfx("select"); renderActionButtons(actor); return; }
      // 召喚演出: 陰陽師の呪符技と同じ紫の術式エフェクト(impact_onmyoji_)を新しく出た式神のカードに重ねる+
      // 式神召喚専用SE(ユーザー提供音源、2026-07-25)。以前は鷹を呼ぶと同じSEを流用していたが
      // 「鷹の声はいらない」との指示で専用素材に差し替えた
      if (result && result.shikigami) {
        playSfx("shikigami_summon");
        playAttackVfx(result.shikigami.id, actor, "skill");
      } else {
        playSfx("select");
      }
      // 神速召喚: ターンを消費せず続けて別の行動を選べる
      if (actor.passives && actor.passives.noCostSummonShikigami) { renderActionButtons(actor); return; }
      finishPlayerAction();
    };
    grid.appendChild(btn);
  });
  const backBtn2 = document.createElement("button");
  backBtn2.className = "big";
  backBtn2.textContent = "戻る";
  backBtn2.onclick = () => renderActionButtons(actor);
  grid.appendChild(backBtn2);
}

// 変化の術: カラス/ガマ/ヘビの3択を表示する。カラスだけは変身直後にすぐ行動できる
// (ターンを消費せず同じactorの行動選択にそのまま戻る)特典があり、ガマ/ヘビは通常通りそこで手番を終える
// mpBeforeCost: このピッカーを開く直前のMP。「戻る」で変身自体をやめた時、useTreeSkillが既に
// 引いていたMP消費を巻き戻すために使う(消費だけされて何も選ばずに戻れてしまうバグの修正)
function renderTransformFormPicker(actor, mpBeforeCost) {
  battleSubMenuActive = true;
  const grid = document.getElementById("actionGrid");
  grid.innerHTML = "";
  Object.keys(TRANSFORM_FORMS).forEach((formKey) => {
    const form = TRANSFORM_FORMS[formKey];
    const btn = document.createElement("button");
    btn.className = "big";
    btn.textContent = `${form.emoji}${form.ja}`;
    btn.onclick = () => {
      playTransformEffect(() => {
        enterTransform(actor, formKey);
        blog(`${actor.name}は${form.ja}に変身した！`);
        renderBattleScreen();
        if (form.extraActionOnTransform) renderActionButtons(actor);
        else finishPlayerAction();
      });
    };
    grid.appendChild(btn);
  });
  const backBtn = document.createElement("button");
  backBtn.className = "big";
  backBtn.textContent = "戻る";
  backBtn.onclick = () => {
    if (mpBeforeCost != null) actor.mp = mpBeforeCost;
    renderActionButtons(actor);
  };
  grid.appendChild(backBtn);
}
// ガマの「丸呑み」「吐き出す」/ヘビの「脱皮」「毒液散布」。いずれも専用クールタイム(MPではない、
// actor.formCooldowns[skillKey]で個別管理)で管理する
function runFormSkill(actor, skillKey) {
  const formKey = actor.transformForm;
  const form = TRANSFORM_FORMS[formKey];
  const skill = form.formSkills.find((s) => s.key === skillKey);
  if (skillKey === "marunomi") {
    const targets = targetableEnemies().filter((e) => !e.isBoss && !e.isMidBoss);
    if (targets.length === 0) { showInfoModal("丸呑みにできる敵がいません"); return; }
    battleSubMenuActive = true;
    const grid = document.getElementById("actionGrid");
    grid.innerHTML = "";
    targets.forEach((t) => {
      const btn = document.createElement("button");
      btn.className = "big";
      btn.textContent = t.label;
      btn.onclick = () => {
        playSfx("select");
        t.swallowedTurns = skill.swallowTurns;
        actor.formCooldowns[skillKey] = skill.cooldown;
        blog(`${actor.name}は${t.label}を丸呑みにした！`);
        renderBattleScreen();
        finishPlayerAction();
      };
      grid.appendChild(btn);
    });
    const backBtn = document.createElement("button");
    backBtn.className = "big";
    backBtn.textContent = "戻る";
    backBtn.onclick = () => renderActionButtons(actor);
    grid.appendChild(backBtn);
    return;
  }
  // ガマが行動不能で詰むのを防ぐための解除コマンド。丸呑み中の敵を1体選んで即座に解放する
  // (クールタイムなし、ターンは消費する)
  if (skillKey === "hakidasu") {
    const swallowed = battle.enemies.filter((e) => e.swallowedTurns > 0);
    if (swallowed.length === 0) { showInfoModal("丸呑みにしている相手がいません"); return; }
    if (swallowed.length === 1) {
      swallowed[0].swallowedTurns = 0;
      blog(`${actor.name}は${swallowed[0].label}を吐き出した！`);
      renderBattleScreen();
      finishPlayerAction();
      return;
    }
    battleSubMenuActive = true;
    const grid = document.getElementById("actionGrid");
    grid.innerHTML = "";
    swallowed.forEach((t) => {
      const btn = document.createElement("button");
      btn.className = "big";
      btn.textContent = t.label;
      btn.onclick = () => {
        t.swallowedTurns = 0;
        blog(`${actor.name}は${t.label}を吐き出した！`);
        renderBattleScreen();
        finishPlayerAction();
      };
      grid.appendChild(btn);
    });
    const backBtn = document.createElement("button");
    backBtn.className = "big";
    backBtn.textContent = "戻る";
    backBtn.onclick = () => renderActionButtons(actor);
    grid.appendChild(backBtn);
    return;
  }
  if (skillKey === "datsupi") {
    playSfx("heal");
    const heal = Math.round(actor.maxHp * skill.healPct);
    actor.hp = Math.min(actor.maxHp, actor.hp + heal);
    actor.poison = 0; actor.bleed = 0; actor.burnTurns = 0; actor.stunTurns = 0; actor.silenceTurns = 0;
    actor.formCooldowns[skillKey] = skill.cooldown;
    popupOn(actor.id, `+${heal}`, "heal");
    blog(`${actor.name}は脱皮してHPを${heal}回復し、状態異常を治した！`);
    renderBattleScreen();
    finishPlayerAction();
    return;
  }
  if (skillKey === "dokueki") {
    playAttackSfxWithSwish(actor.classId);
    actor.formCooldowns[skillKey] = skill.cooldown;
    blog(`${actor.name}は毒液を撒き散らした！`);
    targetableEnemies().forEach((e) => {
      const dmg = applyDamageToTarget(e, Math.max(1, Math.round(e.maxHp * skill.dmgPct)), blog, actor.label, null);
      popupOn(e.instanceId, `-${dmg}`, "dmg", dmgShakeIntensity(true));
      playSfx(hitTakenSfxFor(dmg, e.maxHp, e.isSwarm));
      applyPoison(e, resolveValue({ valueMin: skill.poisonMin, valueMax: skill.poisonMax }, skill.poisonMin));
    });
    playScreenShakeOnHit(null, false); // 全体攻撃は一括で1回だけ軽く揺らす(敵ごとに揺らすと多重で暴れる)
    renderBattleScreen();
    playAttackerLunge(actor.id);
    finishPlayerAction();
    return;
  }
}

// 技(スキル)サブメニュー: 職業の基本アビリティ+スキルツリーの能動スキル+味方を守れの合計が
// 3つ以上あるクラスは、通常攻撃の右の「技」ボタンからこのサブメニューを開いて選ぶ形にまとめる。
// buttonsは既にrenderActionButtons側でクリック処理まで組み立て済みの要素をそのまま流用する
// (作り直さず、DOM上の挿し先を変えるだけ)
function renderSkillSubMenu(actor, buttons) {
  battleSubMenuActive = true;
  const grid = document.getElementById("actionGrid");
  grid.innerHTML = "";
  buttons.forEach((btn) => grid.appendChild(btn));
  const backBtn = document.createElement("button");
  backBtn.className = "big";
  backBtn.textContent = "戻る";
  backBtn.onclick = () => renderActionButtons(actor);
  grid.appendChild(backBtn);
}

// 通常攻撃(非会心・命中時のみ)専用のヒットストップ。effects.jsのCRIT_HITSTOP_MS(80ms、会心専用)
// とは完全に別の定数・別のsetTimeoutで、会心側のコード・演出には一切触れていない。
// CSSのanimation-delayではなく、着弾リアクション(揺れ・HPバー反映・次ターンへの進行)一式を
// 呼び出すタイミングそのものをここで止めるため、「戦闘進行として正しく止まる」本物の一時停止になる。
// 調整したい場合はこの1箇所の値だけを変えればよい(当初40msだったが「攻撃に重みがない」という
// ユーザー指摘(2026-07-25)を受け、風切り音→着弾の二層SEと合わせて90msへ延長した)
const NORMAL_ATTACK_HITSTOP_MS = 90;
// 斬撃VFX(ATTACK_VFX_FRAME_MS=30ms/フレーム、effects.js)は、命中と同時に1フレーム目だけを
// 即座に見せ(「斬撃が敵へ到達した瞬間」の合図)、ヒットストップ明けに続きのフレームから再開する。
// 何フレーム目から再開するかは、ヒットストップの長さぶん既に経過したフレーム数+1として算出するため、
// NORMAL_ATTACK_HITSTOP_MSを25〜35msの範囲で変えても自動的に正しいフレームに追従する
const NORMAL_ATTACK_VFX_RESUME_FRAME = Math.floor(NORMAL_ATTACK_HITSTOP_MS / ATTACK_VFX_FRAME_MS) + 1;

function renderActionButtons(actor) {
  battleSubMenuActive = false;
  battleActionLocked = false;
  const grid = document.getElementById("actionGrid");
  grid.innerHTML = "";
  grid.style.gridTemplateColumns = ""; // 敵対象選択(3列)からの復帰時、通常の2列に戻す
  const c = CLASSES[actor.classId];

  {
    const atkBtn = document.createElement("button");
    atkBtn.className = "big primary";
    atkBtn.textContent = "攻撃";
    atkBtn.onclick = () => {
      if (battleActionLocked) return;
      battleActionLocked = true;
      // 形見「うつろの狐面」をかぶっている本人は、通常攻撃が2回攻撃に置き換わる(items.js)
      if (actor.katamiKitsuneMask) { runKitsuneMaskAttack(actor); return; }
      pickSingleEnemyTarget((target) => {
        playAttackSfxWithSwish(actor.classId);
        // 武甕槌命の御守: 戦闘中、最初の通常攻撃が確定で会心になる
        const takemikazuchi2Active = hasOmamori("takemikazuchi2") && !battle.omamoriUsed.takemikazuchi2;
        if (takemikazuchi2Active) { actor.guaranteedCritNext = true; battle.omamoriUsed.takemikazuchi2 = true; }
        const result = performAttack(actor, target, blog);
        // 建御雷神の御守: 戦闘中、最初の通常攻撃が命中した時に確定でスタンを付与する。
        // これは演出ではなく確定するゲームロジックのため、ヒットストップの遅延を挟まずここで即座に処理する
        if (result.hit && hasOmamori("takemikazuchi") && !battle.omamoriUsed.takemikazuchi) {
          battle.omamoriUsed.takemikazuchi = true;
          applyStun(target, 1);
          blog(`建御雷神の御守の加護で、${target.label}はスタンした！`);
        }
        // 被弾SE(敵側)は攻撃SEと同時(t=0)に鳴らす。以前はヒットストップ明け(NORMAL_ATTACK_HITSTOP_MS後)の
        // reveal()内で鳴らしていたが、「効果音の遅れをなくしてほしい」との指示で分離した。
        // 狩人だけは矢が届くまでの間を活かしたいとの指示で、従来通りreveal()内(ヒットストップ後)のまま残す
        if (result.hit && actor.classId !== "hunter") {
          playSfx(hitTakenSfxFor(result.dmg, target.maxHp, target.isSwarm));
        }
        // 着弾リアクション本体(揺れ・HPバー反映・次ターンへの進行)。通常ヒット(非会心)の時だけ
        // NORMAL_ATTACK_HITSTOP_MS分の「間」を置いてから発火させ、会心・回避の時は従来通り
        // 即座に発火する(会心演出=playCritEffects側のタイミング・処理には一切触れていない)。
        // vfxResumeFrameが渡された時(=ヒットストップ明けの再開時)は、既にt=0で表示済みの
        // 1フレーム目の続きから再生する。渡されない時(会心・回避)は従来通り1フレーム目から通常再生する
        const reveal = (vfxResumeFrame) => {
          if (result.hit) {
            popupOn(target.instanceId, `-${result.dmg}`, "dmg", dmgShakeIntensity(false));
            playScreenShakeOnKillOnly(target, result.crit); // 通常攻撃はとどめの一撃だけ画面を揺らす(毎回揺れると疲れる、ユーザー指摘2026-07-26)
            if (actor.classId === "hunter") playSfx(hitTakenSfxFor(result.dmg, target.maxHp, target.isSwarm));
            if (result.crit) playCritEffects(target.instanceId, actor, result.dmg);
            maybeSpeakOnCrit(actor, result.crit);
            maybeSpeakOnKill(actor, target);
          }
          else playSfx("evade");
          renderBattleScreen();
          playAttackerLunge(actor.id); // 攻撃者の踏み込み(空振りでも振ってはいるので命中に関わらず出す)
          if (result.hit) playAttackVfx(target.instanceId, actor, "normal", vfxResumeFrame);
          if (lastHawkFollowupHappened) playHawkAttackVfx(actor, result.hawkTargetId || target.instanceId); // 通常攻撃が外れても鷹は独立して追撃する。倒した場合は別の対象へ
          triggerShootDownEvents(result.shotDown ? [target] : [], () => {
            // 連斬など: 会心を出した直後、確率でもう一度だけ通常攻撃できる(対象再選択可)。
            // 追撃自体はさらに連鎖しない(allowFollowup=falseで呼ぶ)
            if (result.crit && actor.passives && actor.passives.onCritExtraAttackChance && Math.random() < actor.passives.onCritExtraAttackChance) {
              runCritFollowupAttack(actor, () => finishPlayerAction(result.crit));
            } else {
              finishPlayerAction(result.crit);
            }
          });
        };
        if (result.hit && !result.crit) {
          // 斬撃が敵へ「到達した瞬間」を表現するため、VFXの1フレーム目だけを命中と同フレームで
          // 即座に表示する(renderBattleScreen()はまだ呼ばない。呼ぶと敵カードのDOMが作り直され、
          // ここで貼ったVFXが消えてしまうため)。NORMAL_ATTACK_HITSTOP_MS後、reveal()側でカードを
          // 作り直した上で続きのフレームから再生を再開する
          playAttackVfx(target.instanceId, actor, "normal");
          setTimeout(() => reveal(NORMAL_ATTACK_VFX_RESUME_FRAME), NORMAL_ATTACK_HITSTOP_MS);
        } else {
          reveal();
        }
      });
    };
    grid.appendChild(atkBtn);

    // 影分身は通常攻撃のみ使用可能(技/道具/交代/逃げる、いずれも不可)
    if (actor.isClone) return;

    // 変化の術で変身中は、通常の職業アビリティ/スキルツリー技の代わりに専用の行動(カラスのかばう、
    // ガマ/ヘビのform専用スキル)だけを出す。MPの概念が無くなるため沈黙判定も無関係になる
    if (actor.transformForm) {
      const formDef = TRANSFORM_FORMS[actor.transformForm];
      if (formDef.canGuard) {
        const guardBtn = document.createElement("button");
        guardBtn.className = "big";
        guardBtn.textContent = "かばう";
        guardBtn.onclick = () => {
          if (battleActionLocked) return;
          battleActionLocked = true;
          playSfx("guard");
          useAbility(actor, actor, "guard", blog);
          renderBattleScreen();
          finishPlayerAction();
        };
        attachSkillLongPressTooltip(guardBtn, "かばう", ABILITY_DESC.guard);
        grid.appendChild(guardBtn);
      }
      (formDef.formSkills || []).forEach((skill) => {
        // 「吐き出す」は丸呑み中の相手がいる時だけ意味があるため、いなければボタン自体を出さない
        if (skill.key === "hakidasu" && !battle.enemies.some((e) => e.swallowedTurns > 0)) return;
        const skillBtn = document.createElement("button");
        skillBtn.className = "big";
        const cooldownLeft = (actor.formCooldowns && actor.formCooldowns[skill.key]) || 0;
        const onCooldown = cooldownLeft > 0;
        skillBtn.textContent = skill.name + (onCooldown ? `(あと${cooldownLeft}T)` : "");
        skillBtn.disabled = onCooldown;
        skillBtn.onclick = () => {
          if (battleActionLocked) return;
          battleActionLocked = true;
          runFormSkill(actor, skill.key);
        };
        attachSkillLongPressTooltip(skillBtn, skill.name, skill.desc);
        grid.appendChild(skillBtn);
      });
    } else {
      // スキル(職業の基本アビリティ+スキルツリーで選んだ能動スキル+味方を守れ)は、まず
      // skillButtonsに集めておき、合計3つ以上になるクラスだけ通常攻撃の右の「技」ボタンに
      // まとめてサブメニュー化する(action-gridの行数が増えすぎて下のボタンが画面外に
      // 切れる問題への対策)。2つ以下ならこれまで通り並べて直接表示する
      const skillButtons = [];
      // 沈黙中は技(会心の一撃・呪符ノ術など)が使えず、通常攻撃のみになる
      (actor.silenceTurns > 0 ? [] : (c.abilities || [])).forEach((ability) => {
        const abBtn = document.createElement("button");
        abBtn.className = "big";
        const cost = abilityMpCost(ability, actor);
        abBtn.textContent = ABILITY_LABEL[ability] + (cost > 0 ? `(MP${cost})` : "");
        if (cost > 0 && actor.mp < cost) abBtn.disabled = true;
        abBtn.onclick = () => {
          if (battleActionLocked) return;
          battleActionLocked = true;
          if (ability === "guard") {
            // かばうは咄嗟の防御姿勢なのでキャスト演出なしの即時発動のまま
            playSfx("guard");
            useAbility(actor, actor, "guard", blog);
            maybeSpeakOnGuard(actor);
            renderBattleScreen();
            // 金剛(guardTurnFree): かばうを使ってもターンを消費せず、続けて別の行動を選べる
            if (actor.passives && actor.passives.guardTurnFree) { renderActionButtons(actor); return; }
            finishPlayerAction();
            return;
          }
          // 【必殺技キャスト演出(モック案A採用2026-08-01)】対象選択がある会心の一撃等は
          // 「選択してから技名と音」(同日ユーザー指示)のため選択後に、全体技はここで演出。
          // 治癒の術は味方選択後(resolveAllyTarget)側で演出する
          if (ability === "heal") { renderAllyTargets(actor, "heal"); return; }
          if (ability === "magicAttackAll" || ability === "physicalAttackAll") {
            playSkillCastFx(actor, ABILITY_LABEL[ability], () => {
            playAttackSfxWithSwish(actor.classId);
            const targetsList = targetableEnemies();
            const result = useAbility(actor, targetsList, ability, blog);
            const shotDownTargets = [];
            const hitTargets = [];
            let anyCrit = false;
            if (result && result.hits) {
              let anyEvaded = false;
              targetsList.forEach((t, i) => {
                if (result.hits[i]) {
                  popupOn(t.instanceId, `-${result.dmgs[i]}`, "dmg", dmgShakeIntensity(true));
                  hitTargets.push(t);
                  if (result.shotDowns && result.shotDowns[i]) shotDownTargets.push(t);
                  playSfx(hitTakenSfxFor(result.dmgs[i], t.maxHp, t.isSwarm));
                  applyAbilityOnHitInflicts(actor, t, ability, blog); // 旋風薙ぎ(薙ぎ払いに出血付与)など、このアビリティ専用の追加効果
                  if (result.crits && result.crits[i]) { anyCrit = true; playCritEffects(t.instanceId, actor, result.dmgs[i]); }
                }
                else anyEvaded = true;
              });
              if (anyEvaded) playSfx("evade");
              if (!maybeSpeakAllDefeated()) maybeSpeakOnCrit(actor, anyCrit);
              applyAbilityAoeSelfBuffs(actor, ability, hitTargets.length); // 円舞(薙ぎ払いの命中数に応じて自分に回避バフ)など
            }
            renderBattleScreen();
            playAttackerLunge(actor.id, true); // 技なので強ヒットストップ
            playScreenShakeOnHit(null, anyCrit); // 全体技は一括で1回だけ軽く揺らす
            hitTargets.forEach((t) => playAttackVfx(t.instanceId, actor, "skill"));
            triggerShootDownEvents(shotDownTargets, () => maybeCritFollowupThenFinish(actor, anyCrit));
            }); // ← 全体技のplaySkillCastFxコールバック閉じ
            return;
          }
          // 単体系(会心の一撃/奇襲/呪符ノ術など): 対象を選んでからキャスト演出→実行
          pickSingleEnemyTarget((target) => playSkillCastFx(actor, ABILITY_LABEL[ability], () => {
            playAttackSfxWithSwish(actor.classId);
            const result = useAbility(actor, target, ability, blog);
            if (result && result.hit) {
              popupOn(target.instanceId, `-${result.dmg}`, "dmg", dmgShakeIntensity(true));
              playScreenShakeOnHit(target, result.crit);
              playSfx(hitTakenSfxFor(result.dmg, target.maxHp, target.isSwarm));
              applyAbilityOnHitInflicts(actor, target, ability, blog); // 裂傷矢(会心の一矢に出血付与)など、この基本技専用の追加効果
              if (result.crit) playCritEffects(target.instanceId, actor, result.dmg);
              if (!maybeSpeakAllDefeated()) maybeSpeakOnCrit(actor, result.crit);
            }
            else if (result && !result.failed) playSfx("evade");
            renderBattleScreen();
            playAttackerLunge(actor.id, true); // 技なので強ヒットストップ
            if (result && result.hit) playAttackVfx(target.instanceId, actor, "skill");
            if (result && lastHawkFollowupHappened) playHawkAttackVfx(actor, result.hawkTargetId || target.instanceId); // アビリティが外れても鷹は独立して追撃する。倒した場合は別の対象へ
            triggerShootDownEvents(result && result.shotDown ? [target] : [], () => maybeCritFollowupThenFinish(actor, result && result.crit));
          }));
        };
        attachSkillLongPressTooltip(abBtn, ABILITY_LABEL[ability], ABILITY_DESC[ability]);
        skillButtons.push(abBtn);
      });

      // スキルツリーで選んだ能動スキル(沈黙中は使えない)。
      // 鬼神化中は専用技「鬼神斬り」(KISHIN_SLASH_SKILL)を一覧の先頭に差し込む(2026-07-30)
      (actor.silenceTurns > 0 ? [] : [...(actor.kishinTurns > 0 ? [KISHIN_SLASH_SKILL] : []), ...(actor.unlockedSkills || [])]).forEach((skill) => {
        const btn = document.createElement("button");
        btn.className = "big";
        const cost = skillMpCost(actor, skill.mp, skill.action);
        // 鬼神化は遠征中一度だけ(使用済みなら押せない)
        if (skill.action && skill.action.kind === "kishinka" && actor.kishinkaUsed) btn.disabled = true;
        const hawkActive = skill.action && skill.action.kind === "summonHawk" && actor.hawkTurnsLeft > 0;
        // 八幡神の御守: 戦闘中最初に使う技はMP消費が0になるため、MP不足でもボタンを押せるようにする
        const hachimanFree = cost > 0 && hasOmamori("hachiman") && !battle.omamoriUsed.hachiman;
        // 煙幕など: アイテムを消費する技は所持数が0だと使えない(MPが足りていても不可)
        const consumeItemId = skill.action && skill.action.kind === "buffPartyConsumeItem" ? skill.action.item : null;
        const itemCount = consumeItemId ? (state.inventory[consumeItemId] || 0) : null;
        const itemUnavailable = consumeItemId && itemCount <= 0;
        const itemLabel = consumeItemId ? `・${ITEMS[consumeItemId].ja}${itemCount}` : "";
        btn.textContent = skill.name + (hawkActive ? `(滞在中あと${actor.hawkTurnsLeft}T)` : (cost > 0 ? `(MP${cost}${itemLabel})` : (itemLabel ? `(${itemLabel.slice(1)})` : "")));
        if (hawkActive || itemUnavailable || (cost > 0 && actor.mp < cost && !hachimanFree)) btn.disabled = true;
        btn.onclick = () => {
          if (battleActionLocked) return;
          battleActionLocked = true;
          runTreeSkill(actor, skill);
        };
        attachSkillLongPressTooltip(btn, skill.name, skill.desc);
        skillButtons.push(btn);
      });

      // 鷹を呼ぶ(狩人)が出ている間だけ使える「味方を守れ」。指定した味方への次の攻撃を鷹が代わりに受けて消滅する
      if (actor.hawkTurnsLeft > 0) {
        const hawkGuardBtn = document.createElement("button");
        hawkGuardBtn.className = "big";
        hawkGuardBtn.textContent = "味方を守れ" + (HAWK_GUARD_MP_COST > 0 ? `(MP${HAWK_GUARD_MP_COST})` : "");
        if (actor.mp < HAWK_GUARD_MP_COST) hawkGuardBtn.disabled = true;
        hawkGuardBtn.onclick = () => { renderAllyTargets(actor, "hawkGuard"); };
        attachSkillLongPressTooltip(hawkGuardBtn, "味方を守れ", "指定した味方(自分を含む)への次の攻撃を、鷹が代わりに受けて消滅する");
        skillButtons.push(hawkGuardBtn);
      }

      // 技が2つ以上ならサブメニュー化(2026-08-01ユーザー指定: コマンドを常に2×2=攻撃/技(or唯一の技)/
      // 交代/道具に保つ。以前の閾値は3つ以上だったが、逃げるの小ボタン独立化とセットで2つ以上に変更)
      if (skillButtons.length >= 2) {
        const skillMenuBtn = document.createElement("button");
        skillMenuBtn.className = "big";
        skillMenuBtn.textContent = "技";
        skillMenuBtn.onclick = () => renderSkillSubMenu(actor, skillButtons);
        grid.appendChild(skillMenuBtn);
      } else {
        skillButtons.forEach((btn) => grid.appendChild(btn));
      }
    }

  }

  // 変身解除: 任意のタイミングで解除できる。ターンを消費せずそのまま行動選択に戻る(交代と同じ「無消費の意思決定」パターン)
  if (actor.transformForm) {
    const revertBtn = document.createElement("button");
    revertBtn.className = "big";
    revertBtn.textContent = "変身解除";
    revertBtn.onclick = () => {
      if (battleActionLocked) return;
      battleActionLocked = true;
      const formName = TRANSFORM_FORMS[actor.transformForm].ja;
      playTransformEffect(() => {
        revertTransform(actor);
        blog(`${actor.name}は${formName}の姿から人間に戻った。`);
        renderBattleScreen();
        renderActionButtons(actor);
      });
    };
    grid.appendChild(revertBtn);
  }

  // 式神帰還: 陰陽師が自分の式神を出している間だけ表示。MP消費0・ターン消費0で、押した瞬間に
  // 式神を消してMPを1回復し、そのまま行動選択に戻る(変身解除と同じ「無消費の意思決定」パターン)
  if (actor.classId === "onmyoji" && fieldParty.some((c) => c.isShikigami && c.ownerId === actor.id)) {
    const recallBtn = document.createElement("button");
    recallBtn.className = "big";
    recallBtn.textContent = "式神帰還";
    recallBtn.onclick = () => {
      if (battleActionLocked) return;
      recallShikigami(actor);
      blog(`${actor.name}は式神を送り返した。`);
      renderBattleScreen();
      renderActionButtons(actor);
    };
    grid.appendChild(recallBtn);
  }

  const itemBtn = document.createElement("button");
  itemBtn.className = "big";
  itemBtn.textContent = "道具";
  itemBtn.disabled = (state.inventory.potion || 0) <= 0 && (state.inventory.smokeBomb || 0) <= 0 && !katamiAvailableInBattle();
  itemBtn.onclick = () => { renderItemMenu(actor); };
  grid.appendChild(itemBtn);

  // 交代: 控えがいる時だけ表示。パーティ共有のクールダウン制(3ターン、開幕から使用可。
  // ラウンドの節目で1減る=nextRound参照。倒れた時の自動登場autoDeployReserveIfNeededは
  // クールダウンを無視するが、登場後はクールダウンが3にリセットされる)。ターンは消費せず、
  // 入れ替わった控えのキャラがそのまま同じ手番で行動できる(変身解除と同じ「無消費」パターン)。
  // 押すと即交代ではなく、控えのステータスを確認するダイアログを挟んでから成立する。
  // 配置は道具の後=2×2の右下(2026-08-01ユーザー指定)。表示条件は移動前と完全に同じ
  // (変身中も交代可、影分身は関数冒頭のearlyリターンでここへ到達しない)
  if (reserveFieldMember && reserveFieldMember.status === "active") {
    const cd = battle.swapCooldown || 0;
    const swapBtn = document.createElement("button");
    swapBtn.className = "big";
    swapBtn.textContent = cd > 0 ? `交代(あと${cd}T)` : "交代";
    swapBtn.disabled = cd > 0;
    swapBtn.onclick = () => {
      if (battleActionLocked || (battle.swapCooldown || 0) > 0) return;
      showSwapConfirmDialog(actor);
    };
    grid.appendChild(swapBtn);
  }

  // 消火: からくり屋敷を建てるまでは使えない。味方に炎上中の仲間が1人でもいる時だけ表示。
  // 煙玉を1個消費して使い、パーティ全員の炎上を治す。温泉卵と同様にターンを消費しない(誤タップ防止のため使用前に確認を挟む)
  if ((state.karakuriLevel || 0) > 0 && fieldParty.some((c) => c.burnTurns > 0) && (state.inventory.smokeBomb || 0) > 0) {
    const extinguishBtn = document.createElement("button");
    extinguishBtn.className = "big";
    extinguishBtn.textContent = `消火(${state.inventory.smokeBomb || 0})`;
    extinguishBtn.onclick = () => renderExtinguishConfirm(actor);
    grid.appendChild(extinguishBtn);
  }

  // 逃げる: コマンド欄には置かず、味方バー右上の小ボタン(#battleFleeBtn、位置はui.jsが実測配置)を
  // 表示する(2026-08-01ユーザー確定「位置C」。コマンド欄を2×2に保って下の圧迫を減らす)。
  // 襲撃戦(村の防衛)では出さない: 自分の村から逃げる先が無く、逃走=実質敗北の踏み倒しになってしまうため
  const fleeBtnEl = document.getElementById("battleFleeBtn");
  if (fleeBtnEl) fleeBtnEl.style.display = raidBattleActive ? "none" : "";
}
// 逃げる小ボタンの実行。押した瞬間の手番のキャラ(battle.actingId)で逃走準備する。
// 敵の手番中・行動解決中(battleActionLocked)・勝敗確定後(clearBattleTransientFormsで非表示)は効かない
document.getElementById("battleFleeBtn").onclick = () => {
  if (!battle || battleActionLocked) return;
  const actor = fieldParty.find((c) => c.id === battle.actingId && c.hp > 0);
  if (!actor) return;
  battleActionLocked = true;
  fleeAction(actor);
};

// 道具メニュー: 回復薬(対象を選ぶ)と煙玉(即・全員離脱)の2択
function fleeAction(actor) {
  actor.fleeState = "preparing";
  blog(`${actor.label}は逃走準備を始めた！`);
  document.getElementById("actionGrid").innerHTML = "";
  pendingEnemyPick = null;
  pendingAllyPick = null;
  renderBattleScreen();
  finishPlayerAction();
}

// 対象選択/道具メニューなどのサブ画面を表示中(battleSubMenuActive)は、コマンド一覧(#actionGrid)や
// 選択可能な敵/味方カード以外の場所をタップすると行動選択に戻れる(専用の「戻る」ボタンは置かない)。
// "click"だとボタン押下のハンドラがactionGridの中身を書き換えてから(戻る対象が2択以上ある時など)
// イベントがbubbleするため、押した要素が既にDOMから外れてclosest("#actionGrid")が見つけられず
// 誤って直後にキャンセルされてしまう(敵が2体以上いる時に攻撃コマンドが一切効かなくなるバグの原因)。
// DOM書き換え前に判定できる"pointerdown"で見るようにして回避する
document.getElementById("screen-battle").addEventListener("pointerdown", (e) => {
  if (!battleSubMenuActive) return;
  if (e.target.closest("#actionGrid")) return;
  if (e.target.closest(".enemy-card.targetable")) return;
  if (e.target.closest(".party-member.targetable")) return;
  cancelBattleSubMenu();
});

function resolveAllyTarget(actor, kind, target) {
  // 形見(鏡片/湯の花): 効果本体はitems.jsのresolveKatamiAllyTargetが担当する
  if (kind === "katami_kagami" || kind === "katami_yunohana") {
    resolveKatamiAllyTarget(actor, kind, target);
    return;
  }
  if (kind === "heal") {
    // 治癒の術は必殺技キャスト演出つき(2026-08-01「対象選択してから技名と音」)
    playSkillCastFx(actor, ABILITY_LABEL.heal, () => {
      playSfx("heal");
      const result = useAbility(actor, target, "heal", blog);
      if (result && result.heal) { popupOn(target.id, `+${result.heal}`, "heal"); maybeSpeakHealed(target); }
      renderBattleScreen();
      finishPlayerAction();
    });
    return;
  }
  if (kind === "hawkGuard") {
    actor.mp -= HAWK_GUARD_MP_COST;
    actor.hawkGuardTargetId = target.id;
    blog(`${actor.label}の鷹が${target.label}を守るために身構えた！`);
  } else if (TEAHOUSE_SNACK_IDS.includes(kind)) {
    const item = ITEMS[kind];
    state.inventory[kind] = Math.max(0, (state.inventory[kind] || 0) - 1);
    playSfx("heal");
    const heal = useTeahouseSnack(item, target, blog);
    popupOn(target.id, `+${heal}`, "heal");
    maybeSpeakHealed(target);
    saveState();
  } else {
    consumePotion();
    playSfx("heal");
    const heal = usePotion(target, blog);
    popupOn(target.id, `+${heal}`, "heal");
    maybeSpeakHealed(target);
    saveState();
  }
  renderBattleScreen();
  finishPlayerAction();
}

// 味方対象の選択中は、上の味方イラストを直接タップしても選べる(pendingAllyPick、renderPartyBar側で処理)
function renderAllyTargets(actor, kind) {
  battleSubMenuActive = true;
  // pickSingleEnemyTargetと同じ理由: 対象選択中はまだ何も確定していないため、いったんロックを解除して
  // 「戻る」(cancelBattleSubMenu)が確実に効くようにする。対象を選んだ瞬間に再度trueへ戻す
  battleActionLocked = false;
  // 影分身は回復薬/式神を守れ以外の対象になれない(呪文/アイテムいずれの回復も不可のため)。
  // hawkGuardだけは回復ではない(鷹の身代わり)ので対象から外さない
  const targets = aliveField().filter((c) => !c.transformForm && !(c.isClone && kind !== "hawkGuard"));
  pendingAllyPick = (t) => { pendingAllyPick = null; battleActionLocked = true; resolveAllyTarget(actor, kind, t); };
  renderBattleScreen();
  const grid = document.getElementById("actionGrid");
  grid.innerHTML = "";
  // 回復系(治癒の術/回復薬/茶菓子)は控え(reserveFieldMember)も対象に選べる(ユーザー指示2026-07-26)。
  // hawkGuard(鷹の身代わり)は戦場に出ていない控えを守れないため従来通り対象外。
  // レイアウトも回復系だけ3列2行にし、控えのボタンは2行目の左端(左下)へ固定配置する
  // (1行目の余りセルを空要素で埋めて行を折り返す。renderActionButtonsで通常の2列に戻る)
  // 鏡片(katami_kagami)は回復ではなく「次の被弾の身代わり」のため、戦場に出ていない控えには意味がなく対象外
  const isHealKind = kind !== "hawkGuard" && kind !== "katami_kagami";
  const reserveTarget = isHealKind && reserveFieldMember && reserveFieldMember.status === "active" ? reserveFieldMember : null;
  if (isHealKind) grid.style.gridTemplateColumns = "1fr 1fr 1fr";
  targets.forEach((target) => {
    const btn = document.createElement("button");
    btn.className = "big";
    btn.textContent = `${target.name} (${target.hp}/${target.maxHp})`;
    btn.onclick = () => {
      if (!pendingAllyPick) return; // 既に別経路(味方イラスト直接タップ等)で選択済みなら無視する(二重行動防止)
      pendingAllyPick = null;
      battleActionLocked = true; // 対象を選んだ瞬間から解決完了まで、再度ロックする
      resolveAllyTarget(actor, kind, target);
    };
    grid.appendChild(btn);
  });
  if (reserveTarget) {
    const fillers = (3 - (targets.length % 3)) % 3;
    for (let i = 0; i < fillers; i++) grid.appendChild(document.createElement("div"));
    const rbtn = document.createElement("button");
    rbtn.className = "big";
    rbtn.textContent = `控え:${reserveTarget.name} (${reserveTarget.hp}/${reserveTarget.maxHp})`;
    rbtn.onclick = () => {
      if (!pendingAllyPick) return;
      pendingAllyPick = null;
      battleActionLocked = true;
      resolveAllyTarget(actor, kind, reserveTarget);
    };
    grid.appendChild(rbtn);
  }
  const backBtn = document.createElement("button");
  backBtn.className = "big";
  backBtn.textContent = "戻る";
  backBtn.onclick = () => cancelBattleSubMenu();
  grid.appendChild(backBtn);
}

// 行動確定の直後に必ず呼ぶ。#actionGridをその場で空にしてから待機後にターンを進めることで、
// 演出のディレイ中にボタン(や敵/味方の直接タップ)を連打して同じキャラが何度も行動できてしまう
// バグ(致命的な二重行動バグ)を防ぐ。renderBattleScreen()自体は#actionGridに触れないため、
// これを呼ばずにsetTimeout(afterPlayerAction, ...)だけ書くと再発するので注意
//
// wasCrit: この行動で会心が発生したかどうか。会心時はplayCritEffects()(effects.js)の閃光/衝撃波/
// 火花/バナーがCRIT_HITSTOP_MS(80ms)+約520msかけて再生されるため、待機を縮めると演出が
// 途中で消えてしまう(500msのまま維持する)。会心が発生していない行動は、揺れ(hit-shake-strong
// 最大216ms)・攻撃VFX(CLASS_ATTACK_VFXの最大9フレーム=270ms)・HPバートレイル(HP_TRAIL_MS=250ms)
// のいずれも270ms以内に完了するため、320ms(270ms+50msの安全マージン)待てば全演出が終わってから
// 次のターンへ進められる
const FINISH_PLAYER_ACTION_DELAY_CRIT = 500;
const FINISH_PLAYER_ACTION_DELAY_NORMAL = 320;
function finishPlayerAction(wasCrit) {
  document.getElementById("actionGrid").innerHTML = "";
  // 行動が確定した時点で「対象選択などのサブ画面を表示中」の状態も終わらせる。これをfalseに
  // 戻さないと、待機中(delay経過待ち)に空になったactionGridの外側をたまたま指が触れただけで
  // pointerdownの委譲ハンドラ(下記)がcancelBattleSubMenu()を呼び、行動選択メニューを
  // 再描画→battleActionLockedまで解除してしまい、同じ手番でもう一度攻撃できてしまうバグの原因になっていた
  battleSubMenuActive = false;
  setTimeout(afterPlayerAction, wasCrit ? FINISH_PLAYER_ACTION_DELAY_CRIT : FINISH_PLAYER_ACTION_DELAY_NORMAL);
}

function afterPlayerAction() {
  const newlyCritical = handleFieldDeaths();
  autoDeployReserveIfNeeded(newlyCritical, () => {
    if (!battle) return;
    // 百花繚乱(2026-07-30): 行動終了時、50%の確率でもう一度行動できる(1手番につき追加は1回まで。
    // 追加行動は攻撃/技/道具など何でも選べる=通常の行動選択メニューをそのまま出し直す)
    const actor = battle.order[battle.orderIndex];
    if (actor && actor.instanceId === undefined && actor.hyakkaActive && !actor.__hyakkaExtraUsedThisTurn &&
        actor.hp > 0 && actor.status === "active" && actor.fleeState !== "fled" && aliveEnemies().length > 0 && Math.random() < 0.5) {
      actor.__hyakkaExtraUsedThisTurn = true;
      blog(`${actor.label}は舞うように身を翻した！百花繚乱、もう一度行動できる！`);
      renderBattleScreen();
      renderActionButtons(actor);
      return;
    }
    battle.orderIndex++;
    processNext();
  });
}

function victory() {
  // 影分身は戦闘が終わると自動で消滅する(式神は逆に生きていれば持ち越されるので、ここでは除去しない)
  fieldParty = fieldParty.filter((c) => !c.isClone);
  advEnemiesDefeated += battle.enemies.filter((e) => e.hp <= 0).length; // リザルトの戦績/朱印評価用(逃げた敵は数えない)
  stopBattleBgm();
  // 魂の回想(soulStory)持ちのボスを倒した時は勝利ファンファーレを鳴らさない(回想演出指示v2:
  // 撃破と同時にBGMを止め、静寂→魂の一言→回想ボタンの流れを音で壊さない。SEの納品後は
  // ここに和鏡の落下音・亀裂音が入る予定)。通常の勝利は従来どおり
  const hasSoulStoryKill = battle.enemies.some((e) => e.hp <= 0 && e.soulStory && e.soulStory.scenes && e.soulStory.scenes.length);
  if (!hasSoulStoryKill) playSfx("victory");
  unlockPeaceDialogueAfterVictory(); // 平和な掛け合い: この勝利をもって次に条件を満たした時1回だけ発火できるようにする
  fieldParty.forEach((c) => { if (c.campWeaponCareBattles > 0) c.campWeaponCareBattles--; });
  clearDotEffects(fieldParty); clearBattleTransientForms(); // 戦闘に勝ったので毒/炎上は持ち越さず治す
  let totalGold = 0;
  const leveledUp = []; // [{character, level}] レベルアップが起きた分だけ積む(スキル選択に使う)
  // 参加ターン比の経験値(2026-07-26): 獲得経験値=敵xp×(出場ラウンド数÷戦闘の総ラウンド数)。
  // 出場カウントはnextRound(ラウンド頭の在場者)と交代処理(出た側にも加算)が記録している。
  // 一度も出なかった控えは0%(=もらえない)。逃げた仲間は従来通り対象外
  const xpRatioOf = (c) => Math.min(1, (battle.presence[c.id] || 0) / Math.max(1, battle.roundsTotal || 0));
  const xpParticipants = () => (reserveFieldMember ? fieldParty.concat([reserveFieldMember]) : fieldParty)
    .filter((c) => c.status === "active" && !c.isClone && !c.isShikigami && c.fleeState !== "fled" && xpRatioOf(c) > 0);
  // 奉行所の討伐依頼(受注制): この戦闘がbattle.questKey(tryForceQuestEncounterで確定出現させた
  // 対象)ならその場で達成とし、報酬はリザルト画面(renderResultScreen)にまとめて表示する。
  if (battle.questKey && state.acceptedQuest && state.acceptedQuest.questKey === battle.questKey) {
    const qDef = QUEST_DEFS[battle.questKey];
    const questGold = questGoldReward(qDef) + (state.acceptedQuest.contractFee || 0); // 契約金は達成時に全額返還される
    const questMats = qDef.rewardMaterials || {}; // 討伐依頼の固定報酬素材(任意、奉行所エディタ参照)
    // completionText(物語クエストの後日談、GPT産)はリザルトのクエスト達成カードに表示される
    advQuestCompleted = { title: qDef.title, gold: questGold, xp: QUEST_REWARD_XP, materials: questMats, text: qDef.completionText || null };
    totalGold += questGold;
    // 報酬素材は敵ドロップと同じstate.materials/advMaterialGainsに積む。リザルト画面の
    // 素材アイコン行(matRowEl、ui.js)にそのまま乗って表示される
    if (MATERIAL_ORDER.some((id) => questMats[id])) {
      if (!state.materials) state.materials = { kawa: 0, hone: 0, ki: 0, tetsu: 0 };
      MATERIAL_ORDER.forEach((id) => {
        if (!questMats[id]) return;
        state.materials[id] = (state.materials[id] || 0) + questMats[id];
        advMaterialGains[id] = (advMaterialGains[id] || 0) + questMats[id];
      });
    }
    xpParticipants().forEach((c) => {
      const share = Math.round(QUEST_REWARD_XP * xpRatioOf(c));
      if (share <= 0) return;
      const beforeLevel = c.level;
      grantXp(c, share, blog);
      advXpGained[c.id] = (advXpGained[c.id] || 0) + share;
      for (let lv = beforeLevel + 1; lv <= c.level; lv++) leveledUp.push({ character: c, level: lv });
    });
    state.acceptedQuest = null;
    if (battle.questKey === "inoshishi") state.defeatedOoInoshishi = true;
    // 同じ依頼を1日に何度もクリアして稼げてしまう不具合の修正: 達成回数(大猪の張り出し解禁条件に使う)と
    // 達成日(同日中の再受注をブロックする、renderMagistrateScreen/acceptQuest参照)を記録する
    state.magistrateQuestClearCount = (state.magistrateQuestClearCount || 0) + 1;
    state.magistrateQuestClearedOn = state.magistrateQuestClearedOn || {};
    state.magistrateQuestClearedOn[battle.questKey] = state.dayCount;
  }
  let soulLumpCount = 0;
  // 探索イベント「天狗の腕試し」に勝利: 魂のかけら1つ(胸のすく勝利)。特定の敵の足元ではなく
  // 巾着への回収時に直接カウントされる(el:nullの扱い、風鈴の音はドロップ分と同じ)
  if (battle.tenguChallenge) {
    materialGroundDrops.push({ kind: "soulShard", rare: true, el: null, x: null, y: null });
    blog("見事！天狗は扇を収め、深々と一礼した。「その腕、覚えておこう」(魂のかけら1つ)");
  }
  // 素材/魂のかけらのドロップは敵が死んだ瞬間に抽選済み(rollMaterialDropOnDeath、足元に転がっている)。
  // 丸呑み中に死んだ等でカードが無く抽選が走らなかった敵がいれば、ここで補完抽選する
  // (足元表示なし・回収演出では巾着の位置で直接カウントされる)
  battle.enemies.forEach((e) => { if (e.hp <= 0) rollMaterialDropOnDeath(e, findVisibleCard(e.instanceId)); });
  const materialGains = {}; // { 素材id: 個数 } この戦闘で落ちた素材
  materialGroundDrops.forEach((d) => { if (d.kind === "material") materialGains[d.matId] = (materialGains[d.matId] || 0) + 1; });
  const soulShardCount = materialGroundDrops.filter((d) => d.kind === "soulShard").length;
  battle.enemies.forEach((e) => {
    const g = goldReward(e);
    totalGold += g;
    if ((e.isBoss || e.isMidBoss) && Math.random() < SOUL_LUMP_DROP_CHANCE) soulLumpCount++; // ボス/中ボス討伐時のみ低確率で魂の塊をドロップ(神社の特別祈願用)
    xpParticipants().forEach((c) => {
      const share = Math.round(e.xp * xpRatioOf(c));
      if (share <= 0) return;
      const beforeLevel = c.level;
      grantXp(c, share, blog);
      advXpGained[c.id] = (advXpGained[c.id] || 0) + share;
      for (let lv = beforeLevel + 1; lv <= c.level; lv++) leveledUp.push({ character: c, level: lv });
    });
    // 道場があれば、この冒険に同行しなかった(名簿にいるが出発していない)仲間にも経験値の一部を分配する
    // (遠征に同行している控えは留守番ではないため対象外。控えの経験値は上の参加ターン比で決まる)
    if ((state.dojoLevel || 0) >= 1) {
      const reserveXp = Math.round(e.xp * DOJO_XP_SHARE_BY_LEVEL[state.dojoLevel]);
      state.roster.filter((c) => c.status === "active" && !fieldParty.includes(c) && !(reserveFieldMember && reserveFieldMember.id === c.id)).forEach((c) => {
        const beforeLevel = c.level;
        grantXp(c, reserveXp, blog);
        advXpGained[c.id] = (advXpGained[c.id] || 0) + reserveXp;
        for (let lv = beforeLevel + 1; lv <= c.level; lv++) leveledUp.push({ character: c, level: lv });
      });
    }
  });
  // 暗い道の危険手当: この戦闘が暗い道由来なら獲得銭を割増する
  if (battle.goldMult && battle.goldMult !== 1) totalGold = Math.round(totalGold * battle.goldMult);
  // 温泉バフ「福招き」: パーティの誰か1人でも持っていれば獲得銭+10%
  if (fieldParty.some((c) => c.onsenBuffKey === "fukumaneki")) totalGold = Math.round(totalGold * 1.1);
  // 弁財天の御守: 撃破時、低確率でその戦闘のゴールドが2倍になる
  if (totalGold > 0 && hasOmamori("benzaiten") && Math.random() < 0.10) {
    totalGold *= 2;
    blog("弁財天の御守の加護で、ゴールドが2倍になった！");
  }
  // 恵比寿神の御守: 勝利時10%でボーナスゴールド+30%
  if (totalGold > 0 && hasOmamori("ebisu") && Math.random() < 0.10) {
    totalGold = Math.round(totalGold * 1.30);
    blog("恵比寿神の御守の加護で、ボーナスゴールドを手に入れた！");
  }
  state.gold += totalGold;
  advGoldEarned += totalGold;
  blog(`敵を全て倒した！ ${totalGold}Gを手に入れた。`);
  // 魂のかけら: テキストログには書かず(文章量削減方針)、素材と同じ足元ドロップ→巾着回収の
  // 演出(レア扱い=金の光+風鈴の音)で見せる。リザルト画面のアイコン並びにも出す
  if (soulShardCount > 0) {
    state.inventory.soulShard = (state.inventory.soulShard || 0) + soulShardCount;
    advSoulShardGained += soulShardCount;
  }
  if (soulLumpCount > 0) {
    const before = state.inventory.soulLump || 0;
    state.inventory.soulLump = Math.min(SOUL_LUMP_CAP, before + soulLumpCount);
    if (state.inventory.soulLump > before) {
      blog(`魂の塊を${state.inventory.soulLump - before}個手に入れた！`);
      advSoulLumpGained += state.inventory.soulLump - before; // リザルトのレア演出用(上限で弾かれた分は数えない)
      playSfx("loot_rare"); // レア入手の風鈴(ユーザー提供SE、2026-07-27)
    } else blog("魂の塊を感じたが、これ以上は持てなかった。");
  }
  // 形見(物語ボスの遺品、KATAMI_DEFS): 対応ボスの初回討伐で確定ドロップ(2026-08-01ユーザー方針)。
  // 永久所持のためドロップは1点きり(所持済みなら落ちない)。ボステストは実際の所持品を汚さないため対象外
  let katamiDropImg = null;
  if (!bossTestActive && typeof KATAMI_BY_BOSS !== "undefined") {
    battle.enemies.forEach((e) => {
      const kid = KATAMI_BY_BOSS[e.id];
      if (!kid || e.hp > 0) return;
      if (!state.katamiOwned) state.katamiOwned = [];
      if (state.katamiOwned.includes(kid)) return;
      state.katamiOwned.push(kid);
      const kdef = KATAMI_DEFS[kid];
      blog(`${e.label}の形見「${kdef.ja}」を受け取った。`);
      playSfx("loot_rare");
      if (kdef.image) katamiDropImg = kdef.image;
    });
  }
  // 素材(皮/骨/木/鉄)の獲得。テキストログには書かず(文章量削減のユーザー方針、2026-07-27)、
  // 足元ドロップ→巾着袋への回収演出(effects.js playMaterialCollectFx)で見せる
  if (MATERIAL_ORDER.some((id) => materialGains[id])) {
    if (!state.materials) state.materials = { kawa: 0, hone: 0, ki: 0, tetsu: 0 };
    MATERIAL_ORDER.forEach((id) => {
      if (!materialGains[id]) return;
      state.materials[id] = (state.materials[id] || 0) + materialGains[id];
      advMaterialGains[id] = (advMaterialGains[id] || 0) + materialGains[id]; // リザルト画面のアイコン並び用
    });
  }
  // 足元に転がっている素材/魂のかけらを、1個ずつ時間差(0.3秒)で巾着袋へ吸い込む
  if (materialGroundDrops.length > 0) {
    playMaterialCollectFx(materialGroundDrops);
    materialGroundDrops = [];
  }
  // 大国主命の御守: 戦闘終了後12%でストレスを5回復
  if (hasOmamori("okuninushi") && Math.random() < 0.12) {
    fieldParty.forEach((c) => { if (c.status === "active") c.fatigue = Math.max(0, (c.fatigue || 0) - 5); });
    blog("大国主命の御守の加護で、みんなのストレスが和らいだ。");
  }
  // 天照大神の御守: 毎回戦闘終了後に、全員のHPを10%回復
  if (hasOmamori("amaterasu")) {
    fieldParty.forEach((c) => { if (c.status === "active") c.hp = Math.min(c.maxHp, c.hp + Math.max(1, Math.round(c.maxHp * 0.10))); });
    blog("天照大神の御守の加護で、みんなの傷が癒えた。");
  }
  // 天之御中主神の御守: 毎戦闘終了後にMP1回復
  if (hasOmamori("amenominakanushi")) {
    fieldParty.forEach((c) => { if (c.status === "active" && c.maxMp > 0) c.mp = Math.min(c.maxMp, c.mp + 1); });
  }
  if (totalGold > 0 || soulLumpCount > 0) {
    if (totalGold > 0) playSfx("coin");
    // 複数体(1〜3体の集団)を倒した時、合計金額でティア判定すると雑魚3体分の少額合計でも
    // 「大量」の絵になってしまうため、1体あたりの平均額でティアを決める(表示・所持金への加算はtotalGoldのまま)。
    // 魂の塊を入手していれば、ゴールドのイラストの横に並べて同じ演出で表示する
    // (魂のかけらは2026-07-27から素材と同じ足元ドロップ→巾着回収の演出に移行したためここには出さない)。
    // 形見(イラストがある物)を入手した戦闘では、塊より形見の絵を優先して見せる
    const extraImg = katamiDropImg || (soulLumpCount > 0 ? "assets/items/soul_lump.png" : null);
    showTreasurePopup(Math.round(totalGold / battle.enemies.length), extraImg);
  }
  queueSkillChoices(leveledUp); // 戦闘直後には出さず、宿屋の名簿画面から選べるよう積んでおく
  saveState();
  // 襲撃戦の勝利は探索画面ではなく町へ直帰する(探索を経由していないため)。
  // 演出フックの解除・柵耐久の永続化・次回襲撃の予約はfinishRaidBattle(raid.js)が行う
  document.getElementById("actionGrid").innerHTML = `<button class="big primary" id="battleContinueBtn" style="grid-column:1/-1;">${raidBattleActive ? "村に戻る" : bossTestActive ? "タイトルへ戻る" : currentStageName() + "に戻る"}</button>`;
  // 物語クエストの魂の回想(soulStory): 倒した敵に回想があれば、魂の浮遊+一言+
  // 「残された記憶に触れる」ボタンを勝利画面に差し込む(ボステストでの検証でも出る)
  const soulEnemy = battle.enemies.find((e) => e.hp <= 0 && e.soulStory && e.soulStory.scenes && e.soulStory.scenes.length);
  if (soulEnemy && typeof showSoulStoryOffer === "function") {
    showSoulStoryOffer(soulEnemy); // 演出中は「戻る」を隠す(effects.js側が演出完了時に戻す)
    // 保険: 演出側で何か起きても「戻る」が出ないまま詰まないよう、8秒後に必ず再表示する
    setTimeout(() => { const c = document.getElementById("battleContinueBtn"); if (c) c.style.display = ""; }, 8000);
  }
  document.getElementById("battleContinueBtn").onclick = () => {
    // ボステスト(title.js)は探索を経由していないため、勝利したらそのままタイトルへ直帰する
    // (テストモードなのでリロードすれば実セーブがそのまま生きている)
    if (bossTestActive) { location.reload(); return; }
    battle = null;
    saveState(); // 遠征スナップショットのinBattleを戻す(リロード時の逃走ペナルティ誤発動防止)
    clearHawkState(fieldParty);
    clearGuardState(fieldParty);
    clearOmamoriIwanagaBonus(fieldParty);
    fieldParty.forEach((c) => { c.fleeState = null; }); // 戦闘中に個別に逃げた仲間も、戦闘が終われば行動の対象に戻す
    if (raidBattleActive) {
      stopBattleBgm();
      finishRaidBattle(true);
      bgmPositions.town = 0;
      renderTown();
      return;
    }
    if (typeof seamlessDungeonCameraOut === "function") seamlessDungeonCameraOut(); // シームレス入りの戦闘なら逆再生(showScreenより前=共通フェードの抑止が効くように)
    showScreen("screen-dungeon");
    renderDungeon();
  };
}

// レベルアップで選べるスキルツリーがある分だけ、選択待ち(state.pendingSkillChoices)に積む。
// 以前は戦闘終了直後に強制的に2択オーバーレイを出していたが、1戦で2レベル以上連続で上がった時に
// 「character.levelを見て記録キーにする」実装だった影響で選択内容の記録が壊れるバグがあったため、
// 記録は明示的にlevelを渡す形(applySkillChoice参照)に修正した上で、選ぶタイミングも
// 「宿屋の名簿画面で任意に選ぶ」方式に変更した(openSkillChoiceFor参照)
function markQuestChasingIfFled() {
  if (battle && battle.questKey && state.acceptedQuest && state.acceptedQuest.questKey === battle.questKey) {
    state.acceptedQuest.chasing = true;
    // 追跡してきて再戦になった時、逃げた時点のダメージを持ち越す(毎回HP全回復で出現していた不具合の修正)。
    // 対象は複数体の可能性もあるため配列で記録し、tryForceQuestEncounter側で同じ並び順に適用する
    state.acceptedQuest.carryHp = battle.enemies.filter((e) => e.isQuestTarget).map((e) => e.hp);
  }
}
function escapeBattle() {
  // ボステストは探索を経由していないため、逃げ延びた場合も探索画面ではなくタイトルへ直帰する
  if (bossTestActive) { location.reload(); return; }
  fieldParty = fieldParty.filter((c) => !c.isClone); // 影分身は戦闘が終わると自動で消滅する
  markQuestChasingIfFled();
  if (!shouldKeepBossBgmOnFlee()) stopBattleBgm();
  // 逃げた場合、足元に落ちている素材は置き去り=拾えない(ユーザー指定)
  materialGroundDrops = [];
  clearMaterialGroundDrops();
  blog("残った仲間全員が戦闘から逃げ延びた。");
  battle = null;
  saveState(); // 遠征スナップショットのinBattleを戻す(リロード時の逃走ペナルティ誤発動防止)
  pendingEnemyPick = null;
  pendingAllyPick = null;
  clearDotEffects(fieldParty); clearBattleTransientForms(); // 戦闘から逃げたので毒/炎上は持ち越さず治す
  clearHawkState(fieldParty);
  clearGuardState(fieldParty);
  clearOmamoriIwanagaBonus(fieldParty);
  fieldParty.forEach((c) => {
    c.fleeState = null; // 戦闘中に個別に逃げた仲間も、戦闘が終われば行動の対象に戻す
    // 逃げ延びた緊張と疲れでストレスが溜まる(進む→即逃げるを繰り返すだけの無限探索への対策)
    if (c.status === "active") {
      c.fatigue = Math.min(FATIGUE_MAX, (c.fatigue || 0) + FLEE_STRESS_PENALTY);
      popupOn(c.id, String(FLEE_STRESS_PENALTY), "stress"); // renderDungeon()後の再描画で探索画面のカードに表示される
    }
  });
  // 逃げても階層は後退させない(以前は里の方向へ1階層分後退していたが、その場に留まる仕様に変更)
  advanceExplorationClock(MINUTES_PER_FLOOR_RETREAT);
  if (typeof seamlessDungeonCameraOut === "function") seamlessDungeonCameraOut(); // シームレス入りの戦闘なら逆再生(showScreenより前=共通フェードの抑止が効くように)
  showScreen("screen-dungeon");
  renderDungeon();
}

function defeat() {
  fieldParty = fieldParty.filter((c) => !c.isClone); // 影分身は戦闘が終わると自動で消滅する
  // 全滅=素材は置き去り(拾えない)
  materialGroundDrops = [];
  clearMaterialGroundDrops();
  stopBattleBgm();
  fieldParty.forEach((c) => { if (c.campWeaponCareBattles > 0) c.campWeaponCareBattles--; });
  fieldParty.forEach((c) => clearOnsenBuff(c)); // 遠征が終わったので温泉バフも失効させる
  clearDotEffects(fieldParty); clearBattleTransientForms(); // 毒/炎上を持ち越さないよう治しておく
  clearHawkState(fieldParty);
  clearGuardState(fieldParty);
  clearOmamoriIwanagaBonus(fieldParty);
  clearOmikujiExpeditionEffect();
  resetPeaceDialogueState();
  blog(raidBattleActive ? `防衛隊は全滅した...村は荒らされてしまった。` : `パーティは全滅した...誰も帰ってこなかった。`);
  document.getElementById("actionGrid").innerHTML = `<button class="big" id="battleBackTownBtn" style="grid-column:1/-1;">${raidBattleActive ? "村に戻る" : bossTestActive ? "タイトルへ戻る" : "町に戻る"}</button>`;
  document.getElementById("battleBackTownBtn").onclick = () => {
    // ボステストの全滅はリザルト画面を経由せずタイトルへ直帰する(遠征データが無いため)
    if (bossTestActive) { location.reload(); return; }
    stopAmbientBgm();
    stopCoastAreaBgm();
    battle = null;
    // 襲撃戦の敗北はゲームオーバーではなく「村レベル低下」のペナルティで続行する(ユーザー確定)。
    // 遠征していないので遠征スナップショットのクリアも時間送りも行わない(時刻は既に襲撃日の朝)
    if (raidBattleActive) {
      const levelBefore = state.houseLevel || 1;
      finishRaidBattle(false);
      bgmPositions.town = 0;
      playDefeatBanner(() => {
        renderResultScreen(() => {
          if (testModeActive) { location.reload(); return; }
          renderTown();
          if ((state.houseLevel || 1) < levelBefore) {
            showInfoModal(`襲撃者に村を荒らされてしまった…\n村レベルが${levelBefore}から${state.houseLevel}に下がった。\n(建築済みの施設はそのまま使える)`);
          }
        }, true);
      });
      return;
    }
    // クエストダンジョン遠征中の全滅は依頼失敗(モンハン形式)。契約金没収+当日は再受注不可(翌日再張り出し)。
    // 通常依頼(route無し)は従来どおり全滅では取り下げられず、期限切れまで受注状態が残る
    if (state.acceptedQuest && state.acceptedQuest.route) {
      const failedQDef = QUEST_DEFS[state.acceptedQuest.questKey];
      advQuestFailed = { title: failedQDef ? failedQDef.title : "討伐依頼", fee: state.acceptedQuest.contractFee || 0 };
      state.magistrateQuestFailedOn = state.magistrateQuestFailedOn || {};
      state.magistrateQuestFailedOn[state.acceptedQuest.questKey] = state.dayCount;
      state.acceptedQuest = null;
    }
    currentQuestRouteId = null;
    clearExpeditionSnapshot(); // 全滅で遠征終了。リロードしても町スタートに戻る
    saveState();
    toggleTimeOfDay();
    bgmPositions.town = 0; // 里に帰るたびに町の曲を続きからではなく最初から再生する
    playDefeatBanner(() => {
      renderResultScreen(() => {
        // テストモード(title.js)なら全滅=そのままタイトルへ(ゲームオーバー画面は経由しない)
        if (testModeActive) { location.reload(); return; }
        renderTown();
      }, true);
    });
  };
}

