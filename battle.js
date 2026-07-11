// ============ battle.js: 戦闘(ターン進行・行動選択・対象選択・勝敗判定) ============
// ============ 戦闘 ============
let battle = null;
let pendingEnemyPick = null; // 対象選択待ちの間、敵カード画像を直接タップしても選べるようにする際のコールバック
let pendingAllyPick = null; // 同様に、味方対象の選択待ちの間、味方の画像を直接タップしても選べるようにする際のコールバック
let battleSubMenuActive = false; // 対象選択/道具メニューなどのサブ画面を表示中かどうか(trueの間はコマンド外タップで一段戻れる)

// targetId(キャラのid、または敵のinstanceId)から実体(キャラ/敵オブジェクト)を探す。
// 揺れの状態はDOM要素ではなくこのオブジェクト自身に持たせる(再描画でDOM要素が作り直されても消えない)
function startBattle(enemies, pathDef, encounterText) {
  battle = { enemies, order: [], orderIndex: 0, actingId: null, actingEnemyId: null, goldMult: (pathDef && pathDef.goldMult) || 1, justAppeared: true };
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
    // 「誰かがかばっている間」系のスキル(連携の呼吸・援護薙ぎ・護りの薙刀・鼓舞の盾など)がengine.js側から
    // 他の味方の状態を参照できるようにするための、パーティ全体への自己参照(戦闘開始のたびに配り直す)
    c.__allies = fieldParty;
    if (c.passives) {
      c.passives.onceGuardUsed = false;
      c.passives.firstAttackUsed = false;
      c.passives.onKillStacks = 0;
      c.passives.onKillStacksTurns = 0;
    }
  });
  battleLogLines = [];
  document.getElementById("battleLog").innerHTML = "";
  showScreen("screen-battle");
  playBattleBgm(); // 戦闘専用BGMを開始する(探索中は流れず、戦闘開始の合図として鳴る。森は夜だけ専用曲、海岸はcoast_battle)
  blog(encounterText || (enemies.length > 1 ? `${enemies.map((e) => e.label).join("、")}が現れた！` : `${enemies[0].label}が現れた！`));
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
  const forceFirstStrike = state.omikujiFirstStrikePending;
  if (forceFirstStrike) {
    state.omikujiFirstStrikePending = false;
    blog("おみくじの御利益で先手を取った！");
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
  hideStatusTooltip(); // 再描画でアイコン要素が作り直されるため、表示中の説明ツールチップが宙に浮かないよう消しておく
  // 逃走完了(fleeState==="fled")した仲間は、この戦闘の間だけ表示から消える(探索画面に戻れば元通り表示される)
  renderPartyBar("battlePartyBar", fieldParty.filter((c) => c.fleeState !== "fled"), battle.actingId);
  const row = document.getElementById("enemyRow");
  row.innerHTML = "";
  // 丸呑みされている敵は敵表示(UI)から完全に消す。hpは残っているため戦闘終了判定(aliveEnemies)には
  // 引き続きカウントされ、丸呑み中の敵が最後の1体でも戦闘は終わらない
  const visibleEnemies = battle.enemies.filter((e) => !(e.swallowedTurns > 0));
  row.classList.toggle("crowded", visibleEnemies.length >= 4);
  visibleEnemies.forEach((e) => {
    const dead = e.hp <= 0;
    const targetable = !!pendingEnemyPick && !dead;
    const card = document.createElement("div");
    card.className = "enemy-card" + (e.isSwarm ? " swarm" : "") + (e.isMidBoss ? " midboss" : "") + (e.isQuestTarget ? " quest-target" : "") + (dead ? " dead" : "") + (e.instanceId === battle.actingEnemyId ? " acting" : "") + (targetable ? " targetable" : "") + (e.bigAttackPending && !dead ? " charging" : "") + (battle.justAppeared ? " entering" : "") + shakeClassFor(e);
    card.dataset.id = e.instanceId;
    const enemyIsNextActor = anyCrowScoutActive() && nextActingCombatant() === e;
    card.innerHTML = `
      <div class="enemy-name">${e.label}</div>
      <div style="position:relative;">
        <img src="${e.image}" alt="${e.label}">
        ${e.isFlying ? `<span class="status-icon" data-status="flying" style="position:absolute;top:2px;left:2px;color:#fff;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.8));">${ICONS.flying}</span>` : ""}
        ${e.isQuestTarget ? `<span class="status-icon" data-status="questTarget" style="position:absolute;top:2px;right:2px;color:#e6c977;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.8));">${ICONS.questTarget}</span>` : ""}
        ${enemyIsNextActor ? '<span class="next-actor-badge">▲次ターン行動</span>' : ""}
      </div>
      <div class="hp-with-warning">
        ${hpBarHtml(e)}
        ${e.bigAttackPending && !dead ? `<span class="big-attack-warning-icon status-icon" data-status="bigAttackPending">💢</span>` : ""}
      </div>
      <div class="status-icon-row">${statusIconsFor(e)}</div>
    `;
    if (targetable) {
      card.onclick = () => {
        const picked = pendingEnemyPick;
        pendingEnemyPick = null;
        picked(e);
      };
    }
    row.appendChild(card);
  });
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
    const poisonDmg = tickTurnStartEffects(actor, blog);
    if (poisonDmg > 0) popupOn(actor.instanceId, `-${poisonDmg}`, "dmg");
    if (actor.hp <= 0) {
      renderBattleScreen();
      setTimeout(() => { battle.orderIndex++; processNext(); }, 500);
      return;
    }
    if (actor.stunTurns > 0) {
      actor.stunTurns--;
      blog(`${actor.label}はスタンして動けない！`);
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
      // 大技サイクル: 通常攻撃を2回→3回目は予告(通常攻撃はする)→4回目で大技発動、を繰り返す
      const cyclePos = (actor.bigAttackCounter || 0) % BIG_ATTACK_CYCLE_LENGTH;
      if (cyclePos === BIG_ATTACK_CYCLE_LENGTH - 1) {
        actor.bigAttackPending = false;
        actor.bigAttackCounter = (actor.bigAttackCounter || 0) + 1;
        blog(`${actor.label}が大技を放った！`);
        const hpBeforeBig = {};
        alive.forEach((c) => { hpBeforeBig[c.id] = c.hp; });
        const results = enemyBigAttack(actor, alive, blog);
        results.forEach((r) => {
          if (r.hit) {
            popupOn(r.target.id, `-${r.dmg}`, "dmg", dmgShakeIntensity(true));
            playSfx(hitTakenSfxFor(r.dmg, r.target.maxHp));
          } else {
            playSfx("evade");
          }
        });
        alive.forEach((c) => checkPinchTrigger(c, hpBeforeBig[c.id]));
        handleFieldDeaths();
        renderBattleScreen();
        setTimeout(() => {
          battle.orderIndex++;
          processNext();
        }, 500);
        return;
      }
      if (cyclePos === BIG_ATTACK_CYCLE_LENGTH - 2) {
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
      handleFieldDeaths();
      renderBattleScreen();
      setTimeout(() => {
        battle.orderIndex++;
        processNext();
      }, 500);
    }, 600);
  } else {
    if (actor.hp <= 0 || actor.status !== "active" || actor.fleeState === "fled") { battle.orderIndex++; processNext(); return; }
    battle.actingId = actor.id;
    document.getElementById("actionGrid").innerHTML = "";
    renderBattleScreen();
    const poisonDmg = tickTurnStartEffects(actor, blog);
    if (poisonDmg > 0) {
      popupOn(actor.id, `-${poisonDmg}`, "dmg");
      handleFieldDeaths();
      renderBattleScreen();
      if (actor.hp <= 0 || actor.status !== "active") {
        setTimeout(() => { battle.orderIndex++; processNext(); }, 500);
        return;
      }
    }
    if (actor.stunTurns > 0) {
      actor.stunTurns--;
      blog(`${actor.label}はスタンして動けない！`);
      renderBattleScreen();
      battle.orderIndex++;
      setTimeout(processNext, 500);
      return;
    }
    // 逃走準備(fleeState==="preparing")の解決はnextRound()側でラウンドの節目にまとめて行うため、
    // ここでは何もしない(このactorがここに来る時点で既に"fled"になっているか、まだ"preparing"のまま
    // 通常通り行動選択に進む=このラウンド中はまだ逃げていないことになる)
    // 発狂中の吹き出し(このキャラの手番が来るたび50%、行動できるかどうかとは独立の判定)。
    // 発狂だけは複数人が同時に喋ることを許すため、通常のミューテックスとは別枠のcategoryを使う
    if (stressTier(actor.fatigue) >= 4 && Math.random() < DIALOGUE_CHANCE.breakdownPerTurn) {
      trySpeak(actor, "breakdown");
    }
    // 発狂(ストレス100)は完全に行動不能ではなく、50%の確率で動けない(残り50%は行動できる、ただし
    // ステータス自体はfatigueMalusのtier4減衰(-100%)がそのままかかる)
    if (stressTier(actor.fatigue) >= 4 && Math.random() < 0.5) {
      blog(`${actor.label}は発狂して動けない！`);
      battle.orderIndex++;
      setTimeout(processNext, 500);
      return;
    }
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
    // 変身中のform専用スキル(丸呑み/脱皮)のクールタイムは、この変身キャラ自身の手番が来るたびに1減る
    if (actor.formCooldown > 0) actor.formCooldown--;
    renderActionButtons(actor);
  }
}

function handleFieldDeaths() {
  // 以前は確定戦闘(大猪等の依頼専用エンカウント)で瀕死になった場合だけ1つ手前のフロアで
  // 救助できる特例があったが、ユーザー指示で廃止。敵がいたフロアにそのまま取り残す通常仕様に統一する
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
}

// 変化の術は「戦闘が終わるまで」しか持続しない仕様のため、勝利/逃走(煙玉含む)/全滅どの経路でも
// 戦闘終了の瞬間に強制的に解除する。野営開始時にも同様に呼ぶ(renderTown()側は既存のpruneActiveParty
// 等と同じ「保険」の位置づけとして呼ばない=ここで確実に処理できているはずのため)
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
    btn.onclick = () => { pendingEnemyPick = null; onPicked(t); };
    grid.appendChild(btn);
  });
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
  if (action.kind === "transform") {
    const result = useTreeSkill(actor, actor, skill, blog); // MP消費/不足判定のみ処理される
    if (result && result.failed) return;
    renderTransformFormPicker(actor);
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
          if (r.crit) { anyCrit = true; playCritEffects(t.instanceId, actor, r.dmg); }
        }
        else anyEvaded = true;
      });
      if (anyEvaded) playSfx("evade");
      if (!maybeSpeakAllDefeated()) maybeSpeakOnCrit(actor, anyCrit);
    }
    renderBattleScreen();
    hitTargets.forEach((t) => playAttackVfx(t.instanceId, actor, "skill"));
    triggerShootDownEvents(shotDownTargets, () => finishPlayerAction());
    return;
  }
  pickSingleEnemyTarget((target) => {
    playSfx(attackSfxFor(actor.classId));
    const result = useTreeSkill(actor, target, skill, blog);
    const r = result && result.dmgs && result.dmgs[0];
    if (r && r.hit) {
      popupOn(target.instanceId, `-${r.dmg}`, "dmg", dmgShakeIntensity(true));
      if (r.crit) playCritEffects(target.instanceId, actor, r.dmg);
      if (!maybeSpeakAllDefeated()) maybeSpeakOnCrit(actor, r.crit);
    }
    else if (r) playSfx("evade");
    renderBattleScreen();
    if (r && r.hit) playAttackVfx(target.instanceId, actor, "skill");
    triggerShootDownEvents(r && r.shotDown ? [target] : [], () => finishPlayerAction());
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
function renderTransformFormPicker(actor) {
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
  backBtn.onclick = () => renderActionButtons(actor);
  grid.appendChild(backBtn);
}
// ガマの「丸呑み」/ヘビの「脱皮」。どちらも専用クールタイム(MPではない)で管理する
function runFormSkill(actor) {
  const formKey = actor.transformForm;
  const form = TRANSFORM_FORMS[formKey];
  if (formKey === "gama") {
    const targets = targetableEnemies().filter((e) => !e.isBoss && !e.isMidBoss);
    if (targets.length === 0) { alert("丸呑みにできる敵がいません"); return; }
    battleSubMenuActive = true;
    const grid = document.getElementById("actionGrid");
    grid.innerHTML = "";
    targets.forEach((t) => {
      const btn = document.createElement("button");
      btn.className = "big";
      btn.textContent = t.label;
      btn.onclick = () => {
        playSfx("select");
        t.swallowedTurns = form.formSkill.swallowTurns;
        actor.formCooldown = form.formSkill.cooldown;
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
  if (formKey === "hebi") {
    playSfx("heal");
    const heal = Math.round(actor.maxHp * form.formSkill.healPct);
    actor.hp = Math.min(actor.maxHp, actor.hp + heal);
    actor.poison = 0; actor.bleed = 0; actor.burnTurns = 0; actor.stunTurns = 0; actor.silenceTurns = 0;
    actor.formCooldown = form.formSkill.cooldown;
    popupOn(actor.id, `+${heal}`, "heal");
    blog(`${actor.name}は脱皮してHPを${heal}回復し、状態異常を治した！`);
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

function renderActionButtons(actor) {
  battleSubMenuActive = false;
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
      pickSingleEnemyTarget((target) => {
        playSfx(attackSfxFor(actor.classId));
        const result = performAttack(actor, target, blog);
        if (result.hit) {
          popupOn(target.instanceId, `-${result.dmg}`, "dmg", dmgShakeIntensity(false));
          if (result.crit) playCritEffects(target.instanceId, actor, result.dmg);
          maybeSpeakOnCrit(actor, result.crit);
          maybeSpeakOnKill(actor, target);
        }
        else playSfx("evade");
        renderBattleScreen();
        if (result.hit) playAttackVfx(target.instanceId, actor, "normal");
        triggerShootDownEvents(result.shotDown ? [target] : [], () => finishPlayerAction());
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
          playSfx("guard");
          useAbility(actor, actor, "guard", blog);
          renderBattleScreen();
          finishPlayerAction();
        };
        attachSkillLongPressTooltip(guardBtn, "かばう", ABILITY_DESC.guard);
        grid.appendChild(guardBtn);
      }
      if (formDef.formSkill) {
        const skillBtn = document.createElement("button");
        skillBtn.className = "big";
        const onCooldown = actor.formCooldown > 0;
        skillBtn.textContent = formDef.formSkill.name + (onCooldown ? `(あと${actor.formCooldown}T)` : "");
        skillBtn.disabled = onCooldown;
        skillBtn.onclick = () => { runFormSkill(actor); };
        attachSkillLongPressTooltip(skillBtn, formDef.formSkill.name, formDef.formSkill.desc);
        grid.appendChild(skillBtn);
      }
    } else {
      // 沈黙中は技(会心の一撃・呪符ノ術など)が使えず、通常攻撃のみになる
      (actor.silenceTurns > 0 ? [] : (c.abilities || [])).forEach((ability) => {
        const abBtn = document.createElement("button");
        abBtn.className = "big";
        const cost = abilityMpCost(ability);
        abBtn.textContent = ABILITY_LABEL[ability] + (cost > 0 ? `(MP${cost})` : "");
        if (cost > 0 && actor.mp < cost) abBtn.disabled = true;
        abBtn.onclick = () => {
          if (ability === "heal") { renderAllyTargets(actor, "heal"); return; }
          if (ability === "guard") {
            playSfx("guard");
            useAbility(actor, actor, "guard", blog);
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
                  if (result.crits && result.crits[i]) { anyCrit = true; playCritEffects(t.instanceId, actor, result.dmgs[i]); }
                }
                else anyEvaded = true;
              });
              if (anyEvaded) playSfx("evade");
              if (!maybeSpeakAllDefeated()) maybeSpeakOnCrit(actor, anyCrit);
            }
            renderBattleScreen();
            hitTargets.forEach((t) => playAttackVfx(t.instanceId, actor, "skill"));
            triggerShootDownEvents(shotDownTargets, () => finishPlayerAction());
            return;
          }
          // 単体系(会心の一撃/奇襲/呪符ノ術など)
          pickSingleEnemyTarget((target) => {
            playSfx(attackSfxFor(actor.classId));
            const result = useAbility(actor, target, ability, blog);
            if (result && result.hit) {
              popupOn(target.instanceId, `-${result.dmg}`, "dmg", dmgShakeIntensity(true));
              if (result.crit) playCritEffects(target.instanceId, actor, result.dmg);
              if (!maybeSpeakAllDefeated()) maybeSpeakOnCrit(actor, result.crit);
            }
            else if (result && !result.failed) playSfx("evade");
            renderBattleScreen();
            if (result && result.hit) playAttackVfx(target.instanceId, actor, "skill");
            triggerShootDownEvents(result && result.shotDown ? [target] : [], () => finishPlayerAction());
          });
        };
        attachSkillLongPressTooltip(abBtn, ABILITY_LABEL[ability], ABILITY_DESC[ability]);
        grid.appendChild(abBtn);
      });

      // スキルツリーで選んだ能動スキル(沈黙中は使えない)
      (actor.silenceTurns > 0 ? [] : (actor.unlockedSkills || [])).forEach((skill) => {
        const btn = document.createElement("button");
        btn.className = "big";
        const cost = skillMpCost(actor, skill.mp);
        btn.textContent = skill.name + (cost > 0 ? `(MP${cost})` : "");
        if (cost > 0 && actor.mp < cost) btn.disabled = true;
        btn.onclick = () => { runTreeSkill(actor, skill); };
        attachSkillLongPressTooltip(btn, skill.name, skill.desc);
        grid.appendChild(btn);
      });
    }

    // 担ぐ: 今この戦闘で瀕死になった(このフロアに取り残された)仲間がいて、まだ誰にも担がれていない場合に表示
    const carryTargets = fieldParty.filter((x) => x.status === "critical" && x.criticalFloor === currentFloor && (x.criticalStage || "forest") === currentStage && !x.carriedBy);
    if (carryTargets.length > 0) {
      const carryBtn = document.createElement("button");
      carryBtn.className = "big";
      carryBtn.textContent = "担ぐ";
      carryBtn.onclick = () => renderCarryTargets(actor, carryTargets);
      grid.appendChild(carryBtn);
    }
  }

  // 変身解除: 任意のタイミングで解除できる。担いでいる間でも(変身自体は解除したいはずなので)表示し、
  // ターンを消費せずそのまま行動選択に戻る(担ぐコマンドと同じ「無消費の意思決定」パターン)
  if (actor.transformForm) {
    const revertBtn = document.createElement("button");
    revertBtn.className = "big";
    revertBtn.textContent = "変身解除";
    revertBtn.onclick = () => {
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
  fleeBtn.onclick = () => fleeAction(actor);
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
  } else {
    state.inventory.potion--;
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
  const targets = aliveField().filter((c) => !c.transformForm);
  pendingAllyPick = (t) => { pendingAllyPick = null; resolveAllyTarget(actor, kind, t); };
  renderBattleScreen();
  const grid = document.getElementById("actionGrid");
  grid.innerHTML = "";
  targets.forEach((target) => {
    const btn = document.createElement("button");
    btn.className = "big";
    btn.textContent = `${target.name} (${target.hp}/${target.maxHp})`;
    btn.onclick = () => { pendingAllyPick = null; resolveAllyTarget(actor, kind, target); };
    grid.appendChild(btn);
  });
  const backBtn = document.createElement("button");
  backBtn.className = "big";
  backBtn.textContent = "戻る";
  backBtn.onclick = () => cancelBattleSubMenu();
  grid.appendChild(backBtn);
}

// 行動確定の直後に必ず呼ぶ。#actionGridをその場で空にしてから500ms後にターンを進めることで、
// 演出のディレイ中にボタン(や敵/味方の直接タップ)を連打して同じキャラが何度も行動できてしまう
// バグ(致命的な二重行動バグ)を防ぐ。renderBattleScreen()自体は#actionGridに触れないため、
// これを呼ばずにsetTimeout(afterPlayerAction, 500)だけ書くと再発するので注意
function finishPlayerAction() {
  document.getElementById("actionGrid").innerHTML = "";
  setTimeout(afterPlayerAction, 500);
}

function afterPlayerAction() {
  handleFieldDeaths();
  battle.orderIndex++;
  processNext();
}

function victory() {
  stopBattleBgm();
  playSfx("victory");
  fieldParty.forEach((c) => { if (c.campWeaponCareBattles > 0) c.campWeaponCareBattles--; });
  clearDotEffects(fieldParty); // 戦闘に勝ったので毒/炎上は持ち越さず治す
  revertAllTransforms(); // 変化の術は戦闘が終わったら強制解除
  let totalGold = 0;
  const leveledUp = []; // [{character, level}] レベルアップが起きた分だけ積む(スキル選択に使う)
  // 奉行所の緊急依頼(荒熊等)の討伐判定は受注制の討伐依頼とは別枠のまま維持
  if (state.magistrateLevel > 0 && state.emergencyQuest && !state.emergencyQuest.claimed) {
    battle.enemies.forEach((e) => {
      if (state.emergencyQuest.enemyId === e.id) state.emergencyQuest.kills = 1;
    });
  }
  // 奉行所の討伐依頼(受注制): この戦闘がbattle.questKey(tryForceQuestEncounterで確定出現させた
  // 対象)ならその場で達成とし、報酬はリザルト画面(renderResultScreen)にまとめて表示する。
  // 猪の依頼(大猪討伐)だけは通常のクリアカウントに含めず、代わりに緊急依頼解禁フラグを立てる
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
    if (battle.questKey === "inoshishi") {
      state.defeatedOoInoshishi = true;
    } else {
      state.magistrateNormalClears = (state.magistrateNormalClears || 0) + 1;
    }
    maybeTriggerEmergencyQuest();
  }
  battle.enemies.forEach((e) => {
    const g = goldReward(e);
    totalGold += g;
    const xpAmount = Math.round(e.xp * xpMultiplierForFloor(currentFloor));
    aliveField().forEach((c) => {
      const beforeLevel = c.level;
      grantXp(c, xpAmount, blog);
      advXpGained[c.id] = (advXpGained[c.id] || 0) + xpAmount;
      for (let lv = beforeLevel + 1; lv <= c.level; lv++) leveledUp.push({ character: c, level: lv });
    });
    // 道場があれば、この冒険に同行しなかった(名簿にいるが出発していない)仲間にも経験値の一部を分配する
    if ((state.dojoLevel || 0) >= 1) {
      const reserveXp = Math.round(xpAmount * DOJO_XP_SHARE_BY_LEVEL[state.dojoLevel]);
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
  state.gold += totalGold;
  advGoldEarned += totalGold;
  blog(`敵を全て倒した！ ${totalGold}Gを手に入れた。`);
  if (totalGold > 0) {
    playSfx("coin");
    // 複数体(1〜3体の集団)を倒した時、合計金額でティア判定すると雑魚3体分の少額合計でも
    // 「大量」の絵になってしまうため、1体あたりの平均額でティアを決める(表示・所持金への加算はtotalGoldのまま)
    showTreasurePopup(Math.round(totalGold / battle.enemies.length));
  }
  queueSkillChoices(leveledUp); // 戦闘直後には出さず、宿屋の名簿画面から選べるよう積んでおく
  saveState();
  document.getElementById("actionGrid").innerHTML = `<button class="big primary" id="battleContinueBtn" style="grid-column:1/-1;">${currentStageName()}に戻る</button>`;
  document.getElementById("battleContinueBtn").onclick = () => {
    battle = null;
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
  }
}
function escapeBattle() {
  markQuestChasingIfFled();
  stopBattleBgm();
  blog("残った仲間全員が戦闘から逃げ延びた。");
  battle = null;
  pendingEnemyPick = null;
  pendingAllyPick = null;
  clearDotEffects(fieldParty); // 戦闘から逃げたので毒/炎上は持ち越さず治す
  revertAllTransforms(); // 変化の術は戦闘が終わったら強制解除
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
  stopBattleBgm();
  fieldParty.forEach((c) => { if (c.campWeaponCareBattles > 0) c.campWeaponCareBattles--; });
  fieldParty.forEach((c) => clearOnsenBuff(c)); // 遠征が終わったので温泉バフも失効させる
  clearDotEffects(fieldParty); // 毒/炎上を持ち越さないよう治しておく(瀕死の仲間が後で救出された時のため)
  revertAllTransforms(); // 変化の術は戦闘が終わったら強制解除(通常はhandleFieldDeaths側で既に解除済みのはずの保険)
  clearOmikujiExpeditionEffect();
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

