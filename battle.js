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
function startBattle(enemies, pathDef, encounterText) {
  markEnemiesSeen(enemies); // 図鑑: 遭遇した敵を記録する(倒す必要はなく、出会った時点で登録される)
  // おみくじ「吉」: 次の遠征の最初の戦闘だけ、味方の攻撃が最初の3回連続で確定会心になる。この戦闘で使い切る(2戦目以降には持ち越さない)
  const omikujiGuaranteedCrits = state.omikujiGuaranteedCritsLeft || 0;
  if (omikujiGuaranteedCrits > 0) state.omikujiGuaranteedCritsLeft = 0;
  battle = { enemies, order: [], orderIndex: 0, actingId: null, actingEnemyId: null, goldMult: (pathDef && pathDef.goldMult) || 1, justAppeared: true, omamoriUsed: {}, omikujiGuaranteedCritsLeft: omikujiGuaranteedCrits, voluntarySwapUsed: false };
  // 新しい戦闘の最初の手番は必ずスライド演出を再生させたいので、前の戦闘の最後にたまたま
  // 同じキャラのidが残っていて「変化なし」と誤判定されない(演出が飛ばされない)よう明示的にリセットする
  lastPartyBarActingId.battlePartyBar = null;
  // 貫き矢(狩人)など「倒した敵の余りダメージを他の敵に分け与える」系のスキルがengine.js側から
  // 他の敵を参照できるようにするための、敵全体への自己参照(__alliesの敵版)
  enemies.forEach((e) => { e.__enemyAllies = enemies; });
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
    c.reloading = false; // 砲術士の装填クールダウンも戦闘をまたいで持ち越さない
    c.hawkTurnsLeft = 0; // 狩人「鷹を呼ぶ」も戦闘をまたいで持ち越さない
    c.hawkGuardTargetId = null;
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
  showScreen("screen-battle");
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
  nextRound(forceFirstStrike);
}

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

function renderBattleScreen() {
  // 煙玉等で戦闘が終了した後、直前にsetTimeoutで予約されていた処理が遅れて発火してもクラッシュしないための保険
  if (!battle) return;
  // ボス追撃モードの発動判定。討伐依頼対象(isQuestTarget、既に専用の追跡システムを持つ)は対象外。
  // __hasFledPursuitで同じ敵が1戦闘中に何度も発動しないようにする(HPが閾値以下のまま複数回
  // renderBattleScreen()が呼ばれても再発動しない)
  const fleeingBoss = battle.enemies.find((e) => (e.isBoss || e.isMidBoss) && !e.isQuestTarget && !e.__hasFledPursuit && e.hp > 0 && e.hp / e.maxHp <= BOSS_FLEE_HP_RATIO);
  if (fleeingBoss) {
    fleeingBoss.__hasFledPursuit = true;
    triggerBossFlee(fleeingBoss);
    return;
  }
  hideStatusTooltip(); // 再描画でアイコン要素が作り直されるため、表示中の説明ツールチップが宙に浮かないよう消しておく
  // 逃走完了(fleeState==="fled")した仲間は、この戦闘の間だけ表示から消える(探索画面に戻れば元通り表示される)
  // 控え(reserveFieldMember)は控えに入っている間は画面上のアイコン表示に含めない(5人編成でも
  // 常時表示されるアイコンは4つのまま。交代ボタンを押した時のピッカーでのみ姿を見せる)
  const battleDisplayParty = fieldParty.filter((c) => c.fleeState !== "fled");
  renderPartyBar("battlePartyBar", battleDisplayParty, battle.actingId);
  const row = document.getElementById("enemyRow");
  row.innerHTML = "";
  // 丸呑みされている敵は敵表示(UI)から完全に消す。hpは残っているため戦闘終了判定(aliveEnemies)には
  // 引き続きカウントされ、丸呑み中の敵が最後の1体でも戦闘は終わらない。撃破された敵は
  // (演出が終わった後も)このリストから外さない=枠は残したままにする。外すと#enemyRowの
  // justify-content:centerにより残った敵が中央へ詰め直されてしまい、「敵が死んで消えても
  // 他の敵の並びは動かないでほしい」という指示に反するため
  const visibleEnemies = battle.enemies.filter((e) => !(e.swallowedTurns > 0));
  row.classList.toggle("crowded", visibleEnemies.length >= 4);
  const newlyDeadForReaction = []; // 撃破リアクションはループを抜けた後にまとめて起動する(下記コメント参照)
  visibleEnemies.forEach((e) => {
    const dead = e.hp <= 0;
    const targetable = !!pendingEnemyPick && !dead;
    const card = document.createElement("div");
    card.className = "enemy-card" + (e.isSwarm ? " swarm" : "") + (e.isMidBoss ? " midboss" : "") + (e.isQuestTarget ? " quest-target" : "") + (dead ? " dead" : "") + (dead ? " defeat-hidden" : "") + (e.instanceId === battle.actingEnemyId ? " acting" : "") + (targetable ? " targetable" : "") + (e.bigAttackPending && !dead ? " charging" : "") + (battle.justAppeared ? " entering" : "") + shakeClassFor(e);
    card.dataset.id = e.instanceId;
    const enemyIsNextActor = anyCrowScoutActive() && nextActingCombatant() === e;
    card.innerHTML = `
      <div class="enemy-name">${e.label}</div>
      <div style="position:relative;">
        <img class="card-portrait-img" src="${e.image}" alt="${e.label}">
        ${e.isFlying ? `<span class="status-icon" data-status="flying" style="position:absolute;top:2px;left:2px;font-size:20px;color:#fff;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.8));z-index:2;">${ICONS.flying}</span>` : ""}
        ${e.bigAttackPending && !dead ? `<span class="big-attack-warning-icon status-icon" data-status="bigAttackPending" style="position:absolute;top:2px;right:34px;z-index:2;">💢</span>` : ""}
        ${e.isQuestTarget ? `<span class="status-icon" data-status="questTarget" style="position:absolute;top:2px;right:2px;font-size:20px;color:#e6c977;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.8));z-index:2;">${ICONS.questTarget}</span>` : ""}
        ${enemyIsNextActor ? '<span class="next-actor-badge">▲次ターン行動</span>' : ""}
        <div class="enemy-debuff-icons">${statusIconsFor(e)}</div>
      </div>
      <div class="hp-with-warning">
        ${hpBarHtml(e)}
      </div>
    `;
    if (targetable) {
      card.onclick = () => {
        if (!pendingEnemyPick) return; // 既に別経路(対象一覧のテキストボタン等)で選択済みなら無視する(二重行動防止)
        const picked = pendingEnemyPick;
        pendingEnemyPick = null;
        battleActionLocked = true; // 対象を選んだ瞬間から解決完了まで、再度ロックする
        picked(e);
      };
    }
    row.appendChild(card);
    // 撃破リアクションは「初めて死亡を検知した描画」の時だけ起動する(再描画のたびに再生し直さない、
    // shakeClassFor()と同じ考え方)。起動自体はこのループを抜けた後にまとめて行う(下記参照)
    if (dead && !e.__defeatReactionState) {
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
  newlyDeadForReaction.forEach(({ entity, card }) => playEnemyDefeatReaction(entity, card));
  battle.justAppeared = false; // 敵出現演出は戦闘開始直後の初回描画だけ(以降の再描画で毎回再生されないように)
  activateHpTrails(row);
  fieldParty.forEach((c) => renderVfxFor(c.id));
  battle.enemies.forEach((e) => renderVfxFor(e.instanceId));
  positionActionsBelowPartyBar("battlePartyBar", ".battle-actions");
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
  if (aliveEnemies().length === 0) { victory(); return; }
  if (alive.length === 0) { handleNoOneLeftToFight(); return; }
  battle.order = turnOrder([...alive, ...aliveEnemies()]);
  // おみくじ「小吉」: この戦闘の最初のラウンドだけ、味方全員を敵より先に行動させる(先制確定)
  if (forceFirstStrike) {
    const allies = battle.order.filter((e) => e.instanceId === undefined);
    const foes = battle.order.filter((e) => e.instanceId !== undefined);
    battle.order = [...allies, ...foes];
  }
  battle.orderIndex = 0;
  processNext();
}

function processNext() {
  // 煙玉等で戦闘が終了した後、直前にsetTimeoutで予約されていたターン処理が遅れて発火してもクラッシュしないための保険
  if (!battle) return;
  battle.actingId = null;
  battle.actingEnemyId = null;
  if (aliveEnemies().length === 0) { renderBattleScreen(); victory(); return; }
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
    const dot = tickTurnStartEffects(actor, blog);
    if (dot.total > 0) popupOn(actor.instanceId, `-${dot.total}`, "dmg");
    popupDotStack(actor.instanceId, dot, actor.isPlant ? "burn-plant" : "burn");
    // 毒/出血/炎上が同時に何種類も出ている時、ポップアップが順番に表示し終わる前に
    // 敵の攻撃モーションが始まってしまうと忙しなく見えるため、実際に表示される種類数だけ
    // 行動開始を後ろ倒しにする(表示が無ければ従来通りの600ms、種類が増えるほど長く待つ)
    const dotTypeCount = [dot.poison, dot.bleed, dot.burn].filter((v) => v > 0).length;
    const enemyActionDelay = dotTypeCount > 0 ? dotTypeCount * DOT_POPUP_STAGGER_MS : 600;
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
      // 大技サイクル: 通常攻撃を2回→3回目は予告(通常攻撃はする)→4回目で大技発動、を繰り返す。
      // 毒弱点②(ENEMY_WEAKNESS)を持つ敵は、毒状態の間は予告も発動もできず通常攻撃のみになる
      // (サイクルのカウント自体は進め続け、毒が切れれば続きから再開する)
      const cyclePos = (actor.bigAttackCounter || 0) % BIG_ATTACK_CYCLE_LENGTH;
      const poisonBlocksBigAttack = (actor.poison || 0) > 0 && !!enemyWeaknessType(actor, "poison") && enemyWeaknessType(actor, "poison").tier === 2;
      if (cyclePos === BIG_ATTACK_CYCLE_LENGTH - 1 && !poisonBlocksBigAttack) {
        actor.bigAttackPending = false;
        actor.bigAttackCounter = (actor.bigAttackCounter || 0) + 1;
        blog(`${actor.label}が大技を放った！`);
        const hpBeforeBig = {};
        alive.forEach((c) => { hpBeforeBig[c.id] = c.hp; });
        const yatanokagamiActive = hasOmamori("yatanokagami") && !battle.omamoriUsed.yatanokagami;
        const results = enemyBigAttack(actor, alive, blog);
        if (yatanokagamiActive) {
          // 八咫鏡の御守: 戦闘中、最初に敵が大技を放った時にそれを無効化し、想定ダメージの50%を反射する
          let prevented = 0;
          results.forEach((r) => {
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
            if (r.hit) {
              popupOn(r.target.id, `-${r.dmg}`, "dmg", dmgShakeIntensity(true));
              playSfx(hitTakenSfxFor(r.dmg, r.target.maxHp));
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
        offerReserveSwapIfNeeded(newlyCriticalBig, continueAfterBig);
        return;
      }
      if (cyclePos === BIG_ATTACK_CYCLE_LENGTH - 2 && !poisonBlocksBigAttack) {
        actor.bigAttackPending = true;
        blog(`${actor.label}が唸り声をあげて構えた…次のターンは大技だ！`);
        triggerWarningFlash();
        playSfx("big_attack_warning");
      }
      actor.bigAttackCounter = (actor.bigAttackCounter || 0) + 1;
      const hpBeforeAtk = {};
      alive.forEach((c) => { hpBeforeAtk[c.id] = c.hp; });
      const result = enemyAttack(actor, alive, blog);
      if (result && result.hit) {
        popupOn(result.target.id, `-${result.dmg}`, "dmg", dmgShakeIntensity(false));
        playSfx(hitTakenSfxFor(result.dmg, result.target.maxHp));
        checkPinchTrigger(result.target, hpBeforeAtk[result.target.id]);
      } else if (result) {
        playSfx("evade");
      }
      const newlyCritical = handleFieldDeaths();
      renderBattleScreen();
      const advanceTurn = () => { battle.orderIndex++; processNext(); };
      const continueAfterAttack = () => {
        if (result && result.guardCounterDmg) {
          // かばう反撃(会心の返し): 敵の攻撃演出の0.5秒後に槍士側の反撃演出を差し込んでから次のターンへ進む
          playGuardCounterVisual(result.target, actor, result.guardCounterDmg, advanceTurn);
        } else {
          setTimeout(advanceTurn, 500);
        }
      };
      offerReserveSwapIfNeeded(newlyCritical, continueAfterAttack);
    }, enemyActionDelay);
  } else {
    if (actor.hp <= 0 || actor.status !== "active" || actor.fleeState === "fled") { battle.orderIndex++; processNext(); return; }
    battle.actingId = actor.id;
    // 自分のターンが回ってきたら、かばうの構え(と身代わり回数のカウント)は無条件でリセットする
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
        offerReserveSwapIfNeeded(newlyCriticalDot, () => {
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

// 戻り値: このタイミングで新たに瀕死になった(fieldParty本人が力尽きた)キャラの配列。
// 呼び出し元(processNext等)がこれを見て、控えとの交代ポップアップを出すかどうか判断する
// (担がれていた側が巻き添えで瀕死になったケースは対象外、あくまで直接倒れた本人のみ)
function handleFieldDeaths() {
  // 以前は確定戦闘(大猪等の依頼専用エンカウント)で瀕死になった場合だけ1つ手前のフロアで
  // 救助できる特例があったが、ユーザー指示で廃止。敵がいたフロアにそのまま取り残す通常仕様に統一する
  const newlyCritical = [];
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
      // このキャラが誰かを担いでいた場合、担がれていた側もここで降ろされ、このフロアに瀕死のまま取り残される
      const carried = fieldParty.find((x) => x.carriedBy === c.id);
      if (carried) {
        markCritical(carried, currentFloor, absoluteGameMinutes(), currentStage);
        carried.carriedBy = null;
        c.carryingId = null;
        blog(`${c.name}が倒れ、担がれていた${carried.name}もその場に取り残された...`);
      }
      // 瀕死になるダメージを受けた本人にも、その衝撃でストレスが溜まる
      c.fatigue = Math.min(FATIGUE_MAX, (c.fatigue || 0) + 20);
      markCritical(c, currentFloor, absoluteGameMinutes(), currentStage);
      blog(`${c.name}は倒れた...瀕死のまま${currentStageName()} ${currentFloor}層目に取り残された。`);
      newlyCritical.push(c);
      // 仲間が瀕死になった衝撃で、生き残っている他のメンバーのストレスが上がる
      fieldParty.forEach((ally) => {
        if (ally.id !== c.id && ally.status === "active") {
          ally.fatigue = Math.min(FATIGUE_MAX, (ally.fatigue || 0) + 25);
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

// 瀕死になった直後、控え(reserveFieldMember)がいれば「交代しますか？」のポップアップを出す。
// 「はい」なら瀕死のキャラを控え枠に下げ、控えだったキャラをその場に迎える(ターン進行はonDoneで続ける)。
// 「いいえ」、または控えがいない/既に控えが瀕死等で交代できない場合は即座にonDoneを呼んで通常通り進む
function offerReserveSwapIfNeeded(newlyCritical, onDone) {
  const candidate = newlyCritical.find((c) => c.status === "critical");
  if (!candidate || !reserveFieldMember || reserveFieldMember.status !== "active") { onDone(); return; }
  showConfirmModal(`控えの${reserveFieldMember.name}と交代しますか？`, [
    {
      label: "はい", className: "big primary", onClick: () => {
        swapReserveMember(candidate, blog);
        renderBattleScreen();
        onDone();
      },
    },
    { label: "いいえ", className: "big", onClick: onDone },
  ]);
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

// 担いでいる相手を対象に選ぶ(戦闘中に瀕死になった仲間、または担いでいる最中に別の仲間が瀕死になった場合)
// スキルツリーの能動スキルを実行する。種類(自己バフ/全体バフ/回復/範囲攻撃/単体攻撃)ごとに対象の選び方が違う
function runTreeSkill(actor, skill) {
  const action = skill.action;
  // 八幡神の御守: 戦闘中最初に使う技のMP消費が0になる(消費前にコスト分を先に補充しておき、
  // useTreeSkill内の通常の減算と相殺させることで実質無償化する)
  const cost = skillMpCost(actor, skill.mp);
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
  if (action.kind === "buffSelf") {
    playSfx("select");
    useTreeSkill(actor, actor, skill, blog);
    renderBattleScreen();
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
  if (action.kind === "summonHawk") {
    // 担ぐ・変身解除と同じく、召喚自体はターンを消費しない(呼び出した後そのまま別の行動を選べる)
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
      const targets = fieldParty.filter((c) => !c.transformForm && (c.status === "active" || (action.reviveHpPct && c.status === "critical")));
      const result = useTreeSkill(actor, targets, skill, blog);
      if (result && result.healed) {
        result.healed.forEach((h) => {
          if (h.revived) { rescueCritical(h.target); h.target.hp = Math.max(1, Math.round(h.target.maxHp * action.reviveHpPct)); blog(`${h.target.name}が蘇生した！`); }
          else { popupOn(h.target.id, `+${h.heal}`, "heal"); maybeSpeakHealed(h.target); }
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
    playSfx(attackSfxFor(actor.classId));
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
    triggerShootDownEvents(shotDownTargets, () => finishPlayerAction(anyCrit));
    return;
  }
  pickSingleEnemyTarget((target) => {
    playSfx(attackSfxFor(actor.classId));
    const result = useTreeSkill(actor, target, skill, blog);
    const r = result && result.dmgs && result.dmgs[0];
    if (r && r.hit && r.hits && r.hits.length > 1) {
      // 連突き/二連射のような多段ヒット技: 1振りごとに間を置いて別々の攻撃モーション/ポップアップ/
      // 鷹の追撃を再生する(合計ダメージを1回にまとめて見せていた旧仕様をユーザー指摘で修正)。
      // renderBattleScreen()は#actionGridに触れないため、finishPlayerAction()が呼ばれるまで
      // 演出中もボタンが押せる状態のまま残っており、連打すると同じ技が多重発動するバグがあった
      // (renderCarryTargetsの「演出の間はボタンを消して連打を防ぐ」と同じ対策をここにも適用する)
      document.getElementById("actionGrid").innerHTML = "";
      renderBattleScreen();
      if (!maybeSpeakAllDefeated()) maybeSpeakOnCrit(actor, r.crit);
      const STAGGER_MS = 260;
      r.hits.forEach((hitInfo, i) => {
        setTimeout(() => {
          // ダメージ行(と貫通/鷹追撃の行があればそれも)を、このヒットのVFXと同時に流す。
          // 以前はuseTreeSkill内で全振り分のログが即座にまとめて出てしまい、エフェクトだけが
          // 遅れて2回再生される見た目とテキストの表示タイミングがズレていた
          (hitInfo.logLines || []).forEach((line) => blog(line));
          popupOn(target.instanceId, `-${hitInfo.dmg}`, "dmg", dmgShakeIntensity(true));
          playSfx(hitTakenSfxFor(hitInfo.dmg, target.maxHp, target.isSwarm));
          if (hitInfo.crit) playCritEffects(target.instanceId, actor, hitInfo.dmg);
          playAttackVfx(target.instanceId, actor, "skill");
          if (r.hawkTargetIds && r.hawkTargetIds[i]) playHawkAttackVfx(actor, r.hawkTargetIds[i]);
        }, i * STAGGER_MS);
      });
      setTimeout(() => {
        triggerShootDownEvents(r.shotDown ? [target] : [], () => finishPlayerAction(r.crit));
      }, r.hits.length * STAGGER_MS);
      return;
    }
    if (r && r.hit) {
      popupOn(target.instanceId, `-${r.dmg}`, "dmg", dmgShakeIntensity(true));
      playSfx(hitTakenSfxFor(r.dmg, target.maxHp, target.isSwarm));
      if (r.crit) playCritEffects(target.instanceId, actor, r.dmg);
      if (!maybeSpeakAllDefeated()) maybeSpeakOnCrit(actor, r.crit);
    }
    else if (r) playSfx("evade");
    renderBattleScreen();
    if (r && r.hit) playAttackVfx(target.instanceId, actor, "skill");
    if (r && lastHawkFollowupHappened) playHawkAttackVfx(actor, r.hawkTargetId || target.instanceId); // 技が外れても鷹は独立して追撃する。倒した場合は別の対象へ
    triggerShootDownEvents(r && r.shotDown ? [target] : [], () => finishPlayerAction(r && r.crit));
  });
}

// スキルツリーの単体回復スキル用、味方の対象選択(既存のrenderAllyTargetsは回復薬/治癒の術専用のため別関数にしてある)
function renderTreeSkillAllyPicker(actor, skill) {
  battleSubMenuActive = true;
  const grid = document.getElementById("actionGrid");
  grid.innerHTML = "";
  aliveField().filter((target) => !target.transformForm).forEach((target) => {
    const btn = document.createElement("button");
    btn.className = "big";
    btn.textContent = `${target.name} (${target.hp}/${target.maxHp})`;
    btn.onclick = () => {
      playSfx("heal");
      const result = useTreeSkill(actor, target, skill, blog);
      if (result && result.healed && result.healed[0]) { popupOn(target.id, `+${result.healed[0].heal}`, "heal"); maybeSpeakHealed(target); }
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
    playSfx(attackSfxFor(actor.classId));
    actor.formCooldowns[skillKey] = skill.cooldown;
    blog(`${actor.name}は毒液を撒き散らした！`);
    targetableEnemies().forEach((e) => {
      const dmg = applyDamageToTarget(e, Math.max(1, Math.round(e.maxHp * skill.dmgPct)), blog, actor.label, null);
      popupOn(e.instanceId, `-${dmg}`, "dmg", dmgShakeIntensity(true));
      playSfx(hitTakenSfxFor(dmg, e.maxHp, e.isSwarm));
      applyPoison(e, resolveValue({ valueMin: skill.poisonMin, valueMax: skill.poisonMax }, skill.poisonMin));
    });
    renderBattleScreen();
    finishPlayerAction();
    return;
  }
}

function renderCarryTargets(actor, targets) {
  battleSubMenuActive = true;
  const grid = document.getElementById("actionGrid");
  grid.innerHTML = "";
  targets.forEach((target) => {
    const btn = document.createElement("button");
    btn.className = "big";
    btn.textContent = `${target.name}を担ぐ`;
    btn.onclick = () => {
      actor.carryingId = target.id;
      target.carriedBy = actor.id;
      target.criticalFloor = null;
      target.criticalExpireMinutes = null;
      blog(`${actor.label}は${target.name}を担いだ！`);
      if (Math.random() < DIALOGUE_CHANCE.carried) trySpeak(target, "carried");
      playSfx("carry");
      document.getElementById("actionGrid").innerHTML = ""; // 演出の間はボタンを消して連打を防ぐ
      // 2秒静止してから、担がれるキャラのイラストを担ぐキャラのカードに重ねる演出に入る
      setTimeout(() => {
        renderBattleScreen();
        renderActionButtons(actor); // 担ぐ自体はターンを消費しない。続けて逃げる準備などの行動を選べる
      }, 2000);
    };
    grid.appendChild(btn);
  });
  const backBtn = document.createElement("button");
  backBtn.className = "big";
  backBtn.textContent = "戻る";
  backBtn.onclick = () => renderActionButtons(actor);
  grid.appendChild(backBtn);
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
// 25〜35msの範囲で調整したい場合はこの1箇所の値だけを変えればよい
const NORMAL_ATTACK_HITSTOP_MS = 40;
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

  // 仲間を担いでいる間は攻撃/技が使えず、逃げるかアイテムしか行動できない
  if (!actor.carryingId) {
    const atkBtn = document.createElement("button");
    atkBtn.className = "big primary";
    atkBtn.textContent = "攻撃";
    atkBtn.onclick = () => {
      if (battleActionLocked) return;
      battleActionLocked = true;
      pickSingleEnemyTarget((target) => {
        playSfx(attackSfxFor(actor.classId));
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
            if (actor.classId === "hunter") playSfx(hitTakenSfxFor(result.dmg, target.maxHp, target.isSwarm));
            if (result.crit) playCritEffects(target.instanceId, actor, result.dmg);
            maybeSpeakOnCrit(actor, result.crit);
            maybeSpeakOnKill(actor, target);
          }
          else playSfx("evade");
          renderBattleScreen();
          if (result.hit) playAttackVfx(target.instanceId, actor, "normal", vfxResumeFrame);
          if (lastHawkFollowupHappened) playHawkAttackVfx(actor, result.hawkTargetId || target.instanceId); // 通常攻撃が外れても鷹は独立して追撃する。倒した場合は別の対象へ
          triggerShootDownEvents(result.shotDown ? [target] : [], () => finishPlayerAction(result.crit));
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
        const cost = abilityMpCost(ability);
        abBtn.textContent = ABILITY_LABEL[ability] + (cost > 0 ? `(MP${cost})` : "");
        if (cost > 0 && actor.mp < cost) abBtn.disabled = true;
        abBtn.onclick = () => {
          if (battleActionLocked) return;
          battleActionLocked = true;
          if (ability === "heal") { renderAllyTargets(actor, "heal"); return; }
          if (ability === "guard") {
            playSfx("guard");
            useAbility(actor, actor, "guard", blog);
            maybeSpeakOnGuard(actor);
            renderBattleScreen();
            finishPlayerAction();
            return;
          }
          if (ability === "magicAttackAll" || ability === "physicalAttackAll") {
            playSfx(attackSfxFor(actor.classId));
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
            hitTargets.forEach((t) => playAttackVfx(t.instanceId, actor, "skill"));
            triggerShootDownEvents(shotDownTargets, () => finishPlayerAction(anyCrit));
            return;
          }
          // 単体系(会心の一撃/奇襲/呪符ノ術など)
          pickSingleEnemyTarget((target) => {
            playSfx(attackSfxFor(actor.classId));
            const result = useAbility(actor, target, ability, blog);
            if (result && result.hit) {
              popupOn(target.instanceId, `-${result.dmg}`, "dmg", dmgShakeIntensity(true));
              playSfx(hitTakenSfxFor(result.dmg, target.maxHp, target.isSwarm));
              if (result.crit) playCritEffects(target.instanceId, actor, result.dmg);
              if (!maybeSpeakAllDefeated()) maybeSpeakOnCrit(actor, result.crit);
            }
            else if (result && !result.failed) playSfx("evade");
            renderBattleScreen();
            if (result && result.hit) playAttackVfx(target.instanceId, actor, "skill");
            if (result && lastHawkFollowupHappened) playHawkAttackVfx(actor, result.hawkTargetId || target.instanceId); // アビリティが外れても鷹は独立して追撃する。倒した場合は別の対象へ
            triggerShootDownEvents(result && result.shotDown ? [target] : [], () => finishPlayerAction(result && result.crit));
          });
        };
        attachSkillLongPressTooltip(abBtn, ABILITY_LABEL[ability], ABILITY_DESC[ability]);
        skillButtons.push(abBtn);
      });

      // スキルツリーで選んだ能動スキル(沈黙中は使えない)
      (actor.silenceTurns > 0 ? [] : (actor.unlockedSkills || [])).forEach((skill) => {
        const btn = document.createElement("button");
        btn.className = "big";
        const cost = skillMpCost(actor, skill.mp);
        const hawkActive = skill.action && skill.action.kind === "summonHawk" && actor.hawkTurnsLeft > 0;
        // 八幡神の御守: 戦闘中最初に使う技はMP消費が0になるため、MP不足でもボタンを押せるようにする
        const hachimanFree = cost > 0 && hasOmamori("hachiman") && !battle.omamoriUsed.hachiman;
        btn.textContent = skill.name + (hawkActive ? `(滞在中あと${actor.hawkTurnsLeft}T)` : (cost > 0 ? `(MP${cost})` : ""));
        if (hawkActive || (cost > 0 && actor.mp < cost && !hachimanFree)) btn.disabled = true;
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

      if (skillButtons.length >= 3) {
        const skillMenuBtn = document.createElement("button");
        skillMenuBtn.className = "big";
        skillMenuBtn.textContent = "技";
        skillMenuBtn.onclick = () => renderSkillSubMenu(actor, skillButtons);
        grid.appendChild(skillMenuBtn);
      } else {
        skillButtons.forEach((btn) => grid.appendChild(btn));
      }
    }

    // 担ぐ: 今この戦闘で瀕死になった(このフロアに取り残された)仲間がいて、まだ誰にも担がれていない場合に表示。
    // 控え枠(reserveFieldMember)に瀕死のまま入っているキャラもここに含める(「交代」で控えに下がっても
    // 歩けないのは変わらないため、担いで救出する必要がある)
    const carryPool = reserveFieldMember ? fieldParty.concat([reserveFieldMember]) : fieldParty;
    const carryTargets = carryPool.filter((x) => x.status === "critical" && x.criticalFloor === currentFloor && (x.criticalStage || "forest") === currentStage && !x.carriedBy);
    if (carryTargets.length > 0) {
      const carryBtn = document.createElement("button");
      carryBtn.className = "big";
      carryBtn.textContent = "担ぐ";
      carryBtn.onclick = () => renderCarryTargets(actor, carryTargets);
      grid.appendChild(carryBtn);
    }
    // 交代: 控えが健在(瀕死でない)の時だけ表示。任意の交代は1戦闘につき1回まで(瀕死時の自動提案は
    // 別枠でカウントしないため回数に影響しない、offerReserveSwapIfNeeded参照)。ターンは消費せず、
    // 入れ替わった控えのキャラがそのまま同じ手番で行動できる(担ぐ・変身解除と同じ「無消費」パターン)
    if (reserveFieldMember && reserveFieldMember.status === "active") {
      const swapUsed = battle.voluntarySwapUsed;
      const swapBtn = document.createElement("button");
      swapBtn.className = "big";
      swapBtn.textContent = "交代" + (swapUsed ? "(使用済み)" : "");
      swapBtn.disabled = swapUsed;
      swapBtn.onclick = () => {
        if (battleActionLocked || battle.voluntarySwapUsed) return;
        battle.voluntarySwapUsed = true;
        const incoming = swapReserveMember(actor, blog);
        if (!incoming) return;
        battle.actingId = incoming.id; // このターンをそのまま入れ替わった控えのキャラへ引き継ぐ
        renderBattleScreen();
        renderActionButtons(incoming);
      };
      grid.appendChild(swapBtn);
    }
  }

  // 変身解除: 任意のタイミングで解除できる。担いでいる間でも(変身自体は解除したいはずなので)表示し、
  // ターンを消費せずそのまま行動選択に戻る(担ぐコマンドと同じ「無消費の意思決定」パターン)
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

  const itemBtn = document.createElement("button");
  itemBtn.className = "big";
  itemBtn.textContent = "道具";
  itemBtn.disabled = (state.inventory.potion || 0) <= 0 && (state.inventory.smokeBomb || 0) <= 0;
  itemBtn.onclick = () => { renderItemMenu(actor); };
  grid.appendChild(itemBtn);

  // 消火: からくり屋敷を建てるまでは使えない。味方に炎上中の仲間が1人でもいる時だけ表示。
  // 煙玉を1個消費して使い、パーティ全員の炎上を治す。温泉卵と同様にターンを消費しない(誤タップ防止のため使用前に確認を挟む)
  if ((state.karakuriLevel || 0) > 0 && fieldParty.some((c) => c.burnTurns > 0) && (state.inventory.smokeBomb || 0) > 0) {
    const extinguishBtn = document.createElement("button");
    extinguishBtn.className = "big";
    extinguishBtn.textContent = `消火(${state.inventory.smokeBomb || 0})`;
    extinguishBtn.onclick = () => renderExtinguishConfirm(actor);
    grid.appendChild(extinguishBtn);
  }

  const fleeBtn = document.createElement("button");
  fleeBtn.className = "big";
  fleeBtn.textContent = "逃げる";
  fleeBtn.onclick = () => {
    if (battleActionLocked) return;
    battleActionLocked = true;
    fleeAction(actor);
  };
  grid.appendChild(fleeBtn);
}

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
  if (kind === "heal") {
    playSfx("heal");
    const result = useAbility(actor, target, "heal", blog);
    if (result && result.heal) { popupOn(target.id, `+${result.heal}`, "heal"); maybeSpeakHealed(target); }
  } else if (kind === "hawkGuard") {
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
  const targets = aliveField().filter((c) => !c.transformForm);
  pendingAllyPick = (t) => { pendingAllyPick = null; battleActionLocked = true; resolveAllyTarget(actor, kind, t); };
  renderBattleScreen();
  const grid = document.getElementById("actionGrid");
  grid.innerHTML = "";
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
  offerReserveSwapIfNeeded(newlyCritical, () => {
    battle.orderIndex++;
    processNext();
  });
}

function victory() {
  stopBattleBgm();
  playSfx("victory");
  unlockPeaceDialogueAfterVictory(); // 平和な掛け合い: この勝利をもって次に条件を満たした時1回だけ発火できるようにする
  fieldParty.forEach((c) => { if (c.campWeaponCareBattles > 0) c.campWeaponCareBattles--; });
  clearDotEffects(fieldParty); // 戦闘に勝ったので毒/炎上は持ち越さず治す
  let totalGold = 0;
  const leveledUp = []; // [{character, level}] レベルアップが起きた分だけ積む(スキル選択に使う)
  // 奉行所の討伐依頼(受注制): この戦闘がbattle.questKey(tryForceQuestEncounterで確定出現させた
  // 対象)ならその場で達成とし、報酬はリザルト画面(renderResultScreen)にまとめて表示する。
  if (battle.questKey && state.acceptedQuest && state.acceptedQuest.questKey === battle.questKey) {
    const qDef = QUEST_DEFS[battle.questKey];
    const questGold = questGoldReward(qDef) + (state.acceptedQuest.contractFee || 0); // 契約金は達成時に全額返還される
    advQuestCompleted = { title: qDef.title, gold: questGold, xp: QUEST_REWARD_XP };
    totalGold += questGold;
    aliveField().forEach((c) => {
      const beforeLevel = c.level;
      grantXp(c, QUEST_REWARD_XP, blog);
      advXpGained[c.id] = (advXpGained[c.id] || 0) + QUEST_REWARD_XP;
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
  // ボス追撃モード: 追いついて仕留めきった戦闘なら追撃状態を終了する(通常のgold/xp報酬は
  // 下のbattle.enemies.forEachで他の敵と同じように処理されるため、ここでは状態のクリアのみ)
  if (battle.bossPursuitEnemyId) bossPursuit = null;
  let soulShardCount = 0;
  let soulLumpCount = 0;
  battle.enemies.forEach((e) => {
    const g = goldReward(e);
    totalGold += g;
    if (e.id === "onibi" && Math.random() < ONIBI_SOUL_SHARD_DROP_CHANCE) soulShardCount++; // 鬼火は一定確率で魂のかけらをドロップする(討伐数ぶん)
    if (e.isBoss && hasOmamori("omononushi")) soulShardCount++; // 大物主神の御守: ボスを倒すと必ず魂のかけらを落とす
    if ((e.isBoss || e.isMidBoss) && Math.random() < SOUL_LUMP_DROP_CHANCE) soulLumpCount++; // ボス/中ボス討伐時のみ低確率で魂の塊をドロップ(神社の特別祈願用)
    aliveField().forEach((c) => {
      const beforeLevel = c.level;
      grantXp(c, e.xp, blog);
      advXpGained[c.id] = (advXpGained[c.id] || 0) + e.xp;
      for (let lv = beforeLevel + 1; lv <= c.level; lv++) leveledUp.push({ character: c, level: lv });
    });
    // 道場があれば、この冒険に同行しなかった(名簿にいるが出発していない)仲間にも経験値の一部を分配する
    if ((state.dojoLevel || 0) >= 1) {
      const reserveXp = Math.round(e.xp * DOJO_XP_SHARE_BY_LEVEL[state.dojoLevel]);
      state.roster.filter((c) => c.status === "active" && !fieldParty.includes(c)).forEach((c) => {
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
  if (soulShardCount > 0) {
    state.inventory.soulShard = (state.inventory.soulShard || 0) + soulShardCount;
    blog(`魂のかけらを${soulShardCount}個手に入れた。`);
  }
  if (soulLumpCount > 0) {
    const before = state.inventory.soulLump || 0;
    state.inventory.soulLump = Math.min(SOUL_LUMP_CAP, before + soulLumpCount);
    if (state.inventory.soulLump > before) blog(`魂の塊を${state.inventory.soulLump - before}個手に入れた！`);
    else blog("魂の塊を感じたが、これ以上は持てなかった。");
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
  if (totalGold > 0 || soulShardCount > 0 || soulLumpCount > 0) {
    if (totalGold > 0) playSfx("coin");
    // 複数体(1〜3体の集団)を倒した時、合計金額でティア判定すると雑魚3体分の少額合計でも
    // 「大量」の絵になってしまうため、1体あたりの平均額でティアを決める(表示・所持金への加算はtotalGoldのまま)。
    // 魂のかけら/魂の塊を入手していれば、ゴールドのイラストの横に並べて同じ演出で表示する
    // (塊の方が激レアなので、両方同時に落ちた場合は塊を優先して見せる)
    const extraImg = soulLumpCount > 0 ? "assets/items/soul_lump.png" : soulShardCount > 0 ? "assets/items/soul_shard.png" : null;
    showTreasurePopup(Math.round(totalGold / battle.enemies.length), extraImg);
  }
  queueSkillChoices(leveledUp); // 戦闘直後には出さず、宿屋の名簿画面から選べるよう積んでおく
  saveState();
  document.getElementById("actionGrid").innerHTML = `<button class="big primary" id="battleContinueBtn" style="grid-column:1/-1;">${currentStageName()}に戻る</button>`;
  document.getElementById("battleContinueBtn").onclick = () => {
    battle = null;
    clearHawkState(fieldParty);
    clearGuardState(fieldParty);
    clearOmamoriIwanagaBonus(fieldParty);
    fieldParty.forEach((c) => { c.fleeState = null; }); // 戦闘中に個別に逃げた仲間も、戦闘が終われば担ぐ/行動の対象に戻す
    showScreen("screen-dungeon");
    renderDungeon();
    checkStrandedOnCurrentFloor();
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
// ボス追撃モード: 討伐依頼対象ではないボス/中ボスがHPをBOSS_FLEE_HP_RATIO以下まで削られると、
// プレイヤーの選択を待たずその場で瀕死のまま戦闘から逃走する(escapeBattle()のプレイヤー主導の
// 逃走とは違い、敵側が一方的に切り上げる形)。以後bossPursuitが立ち、tryForceBossPursuitEncounter()
// (dungeon.js)が同じステージのフロア移動のたびに一定確率で追いつかせる
function triggerBossFlee(enemy) {
  bossPursuit = { enemyId: enemy.id, hp: enemy.hp, maxHp: enemy.maxHp, stage: currentStage };
  if (!shouldKeepBossBgmOnFlee()) stopBattleBgm(); // 追撃中はボス戦BGMを止めない(shouldKeepBossBgmOnFlee側でbossPursuitも見る)
  battle = null;
  pendingEnemyPick = null;
  pendingAllyPick = null;
  clearDotEffects(fieldParty);
  clearHawkState(fieldParty);
  clearGuardState(fieldParty);
  clearOmamoriIwanagaBonus(fieldParty);
  fieldParty.forEach((c) => { c.fleeState = null; });
  advanceExplorationClock(MINUTES_PER_FLOOR_RETREAT);
  showScreen("screen-dungeon");
  renderDungeon();
  dlog(`${enemy.label}は手負いのまま逃げ出した！`);
  checkStrandedOnCurrentFloor();
}
// ボス追撃モードの再戦(battle.bossPursuitEnemyId)からプレイヤー側が逃げた(escapeBattle/
// useSmokeBomb)場合、その時点のHPをbossPursuitへ書き戻す。これをしないと、追撃中に一部
// ダメージを与えてから再度逃げた分が失われ、追いつくたびに同じHPで出現してしまう
// (討伐依頼のmarkQuestChasingIfFled/carryHpと同じ考え方)
function updateBossPursuitHpIfFled() {
  if (battle && battle.bossPursuitEnemyId && bossPursuit && bossPursuit.enemyId === battle.bossPursuitEnemyId) {
    const enemy = battle.enemies.find((e) => e.id === battle.bossPursuitEnemyId);
    if (enemy) bossPursuit.hp = enemy.hp;
  }
}
function escapeBattle() {
  markQuestChasingIfFled();
  updateBossPursuitHpIfFled();
  if (!shouldKeepBossBgmOnFlee()) stopBattleBgm();
  blog("残った仲間全員が戦闘から逃げ延びた。");
  battle = null;
  pendingEnemyPick = null;
  pendingAllyPick = null;
  clearDotEffects(fieldParty); // 戦闘から逃げたので毒/炎上は持ち越さず治す
  clearHawkState(fieldParty);
  clearGuardState(fieldParty);
  clearOmamoriIwanagaBonus(fieldParty);
  fieldParty.forEach((c) => {
    c.fleeState = null; // 戦闘中に個別に逃げた仲間も、戦闘が終われば担ぐ/行動の対象に戻す
    // 逃げ延びた緊張と疲れでストレスが溜まる(進む→即逃げるを繰り返すだけの無限探索への対策)
    if (c.status === "active") c.fatigue = Math.min(FATIGUE_MAX, (c.fatigue || 0) + FLEE_STRESS_PENALTY);
  });
  // 逃げても階層は後退させない(以前は里の方向へ1階層分後退していたが、その場に留まる仕様に変更)
  advanceExplorationClock(MINUTES_PER_FLOOR_RETREAT);
  showScreen("screen-dungeon");
  renderDungeon();
  checkStrandedOnCurrentFloor();
}

// 今しがたの戦闘でこのフロアに瀕死のまま取り残された(まだ誰にも担がれていない)仲間がいれば、
// 探索画面に戻った直後にも担ぐ/救出のアラートを出す(戦闘中に担ぎそびれた場合の救済)
function defeat() {
  updateBossPursuitHpIfFled(); // 追撃モードの再戦中に全滅した場合、その時点のダメージを反映してから記録する
  recordBossWoundIfPursuing(); // 全滅で追撃を続けられなくなった場合も「見送った」扱いで手負いのHPを記録する
  stopBattleBgm();
  fieldParty.forEach((c) => { if (c.campWeaponCareBattles > 0) c.campWeaponCareBattles--; });
  fieldParty.forEach((c) => clearOnsenBuff(c)); // 遠征が終わったので温泉バフも失効させる
  clearDotEffects(fieldParty); // 毒/炎上を持ち越さないよう治しておく(瀕死の仲間が後で救出された時のため)
  clearHawkState(fieldParty);
  clearGuardState(fieldParty);
  clearOmamoriIwanagaBonus(fieldParty);
  clearOmikujiExpeditionEffect();
  resetPeaceDialogueState();
  blog(`パーティは全滅した...瀕死の仲間を${currentStage === "coast" ? "海岸" : "深淵の森"}に残し、町に戻った。別の仲間で助けに向かおう。`);
  document.getElementById("actionGrid").innerHTML = `<button class="big" id="battleBackTownBtn" style="grid-column:1/-1;">町に戻る</button>`;
  document.getElementById("battleBackTownBtn").onclick = () => {
    stopAmbientBgm();
    stopCoastAreaBgm();
    battle = null;
    toggleTimeOfDay();
    bgmPositions.town = 0; // 里に帰るたびに町の曲を続きからではなく最初から再生する
    playDefeatBanner(() => {
      renderResultScreen(() => {
        renderTown();
      }, true);
    });
  };
}

