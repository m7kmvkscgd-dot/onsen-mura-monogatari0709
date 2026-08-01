// ============ items.js: 戦闘中の道具使用(道具メニュー・煙玉・消火・形見) ============

// ---- 形見(KATAMI_DEFS)の所持・冷却の共通ヘルパー ----
function katamiOwnedIds() { return state.katamiOwned || []; }
// その形見の残り冷却日数(0=使用可)。冷却の起点は使用時にstate.katamiCdUntilへ書いた「回復する日」
function katamiCdLeft(id) {
  return Math.max(0, ((state.katamiCdUntil || {})[id] || 0) - state.dayCount);
}
function takenKatamiDef() {
  return state.katamiTakenId && typeof KATAMI_DEFS !== "undefined" ? KATAMI_DEFS[state.katamiTakenId] || null : null;
}
// 戦闘中に形見ボタンを出せるか。襲撃戦(遠征外)とボステスト(実所持品を汚さない)では使えない
function katamiAvailableInBattle() {
  if (typeof raidBattleActive !== "undefined" && raidBattleActive) return false;
  if (typeof bossTestActive !== "undefined" && bossTestActive) return false;
  return !!takenKatamiDef();
}
// 使用確定の共通処理: 遠征中1回フラグ+クールダウン開始(使用日からcdDays日後に回復)
function consumeKatamiUse() {
  const def = takenKatamiDef();
  if (!def) return;
  state.katamiUsedOnTrip = true;
  if (!state.katamiCdUntil) state.katamiCdUntil = {};
  state.katamiCdUntil[def.id] = state.dayCount + def.cdDays;
  saveState();
}

function renderItemMenu(actor) {
  battleSubMenuActive = true;
  const grid = document.getElementById("actionGrid");
  grid.innerHTML = "";

  // 形見: 道具メニューの最上段に特別枠(金色・幅いっぱい)で出す(ユーザー指定2026-08-01)。
  // 遠征中1回使い切り。使用済みの間は押せない表示だけ残して「まだ切り札がある」誤解を防ぐ
  const kdef = katamiAvailableInBattle() ? takenKatamiDef() : null;
  if (kdef) {
    const kBtn = document.createElement("button");
    kBtn.className = "big katami-use-btn";
    kBtn.textContent = state.katamiUsedOnTrip ? `🎐${kdef.ja}(この遠征では使用済み)` : `🎐${kdef.ja}`;
    kBtn.disabled = !!state.katamiUsedOnTrip;
    kBtn.onclick = () => renderKatamiConfirm(actor);
    grid.appendChild(kBtn);
  }

  const potionBtn = document.createElement("button");
  potionBtn.className = "big";
  potionBtn.textContent = `回復薬(${state.inventory.potion || 0})`;
  potionBtn.disabled = (state.inventory.potion || 0) <= 0;
  potionBtn.onclick = () => { renderAllyTargets(actor, "potion"); };
  grid.appendChild(potionBtn);

  const smokeBtn = document.createElement("button");
  smokeBtn.className = "big";
  smokeBtn.textContent = `煙玉(${state.inventory.smokeBomb || 0})`;
  smokeBtn.disabled = (state.inventory.smokeBomb || 0) <= 0;
  smokeBtn.onclick = () => renderSmokeBombConfirm(actor);
  grid.appendChild(smokeBtn);

  // 爆弾の購入効果は廃止済み(火薬庫は砲術士解禁のみの建物)のため新規に入手する手段はないが、
  // 既存セーブで爆弾を所持している場合は使い切れるよう、所持数がある時だけボタンを出す
  if ((state.inventory.bomb || 0) > 0) {
    const bombBtn = document.createElement("button");
    bombBtn.className = "big";
    bombBtn.textContent = `爆弾(${state.inventory.bomb || 0})`;
    bombBtn.disabled = (state.inventory.bomb || 0) <= 0;
    bombBtn.onclick = () => {
      state.inventory.bomb--;
      playSfx("attack_gunner");
      blog(`${actor.label}は爆弾を投げつけた！`);
      targetableEnemies().forEach((e) => {
        const dmg = applyDamageToTarget(e, BOMB_FLAT_DAMAGE, blog, actor.label, null);
        popupOn(e.instanceId, `-${dmg}`, "dmg", dmgShakeIntensity(true));
      });
      playScreenShakeOnHit(null, false); // 爆弾も一括で1回だけ軽く揺らす(一撃の重み演出、2026-07-26)
      saveState();
      renderBattleScreen();
      finishPlayerAction();
    };
    grid.appendChild(bombBtn);
  }

  // 温泉卵: 回復薬と違い自分にしか使えない(対象選択なし)代わりに、使ってもターンを消費しない
  // (finishPlayerActionを呼ばず、行動選択メニューに戻すだけ)
  const eggBtn = document.createElement("button");
  eggBtn.className = "big";
  eggBtn.textContent = `温泉卵(${totalOnsenEggCount()})`;
  eggBtn.disabled = totalOnsenEggCount() <= 0;
  eggBtn.onclick = () => {
    consumeOnsenEggFromInventory();
    playSfx("heal");
    const heal = useOnsenEgg(actor, blog);
    popupOn(actor.id, `+${heal}`, "heal");
    maybeSpeakHealed(actor);
    saveState();
    renderBattleScreen();
    renderActionButtons(actor);
  };
  grid.appendChild(eggBtn);

  // 茶屋の菓子: 所持している(=買った)物だけボタンを出す。回復薬と同じくrenderAllyTargets経由で
  // 対象を選ばせ、resolveAllyTarget側でkind(=菓子のid)を見て専用の回復処理に振り分ける
  TEAHOUSE_SNACK_IDS.filter((id) => (state.inventory[id] || 0) > 0).forEach((id) => {
    const item = ITEMS[id];
    const snackBtn = document.createElement("button");
    snackBtn.className = "big";
    snackBtn.textContent = `${item.ja}(${state.inventory[id] || 0})`;
    snackBtn.onclick = () => { renderAllyTargets(actor, id); };
    grid.appendChild(snackBtn);
  });

  const backBtn = document.createElement("button");
  backBtn.className = "big";
  backBtn.textContent = "戻る";
  backBtn.onclick = () => renderActionButtons(actor);
  grid.appendChild(backBtn);
}

// 形見は遠征中1回の切り札のため、誤タップ対策で使用前に確認を挟む(煙玉と同じ形)
function renderKatamiConfirm(actor) {
  const def = takenKatamiDef();
  if (!def) { renderItemMenu(actor); return; }
  battleSubMenuActive = true;
  const grid = document.getElementById("actionGrid");
  grid.innerHTML = "";
  const msg = document.createElement("div");
  msg.style.cssText = "grid-column:1/-1;font-size:0.85rem;text-align:center;margin-bottom:0.3rem;";
  msg.textContent = `形見「${def.ja}」を使いますか？(遠征中1回・使うと${def.cdDays}日休眠)`;
  grid.appendChild(msg);
  const yesBtn = document.createElement("button");
  yesBtn.className = "big";
  yesBtn.textContent = "はい";
  yesBtn.onclick = () => {
    if (battleActionLocked) return;
    battleActionLocked = true;
    useKatami(actor, def);
  };
  grid.appendChild(yesBtn);
  const noBtn = document.createElement("button");
  noBtn.className = "big";
  noBtn.textContent = "いいえ";
  noBtn.onclick = () => renderItemMenu(actor);
  grid.appendChild(noBtn);
}
// 形見の効果本体へ振り分ける。対象選択が要るもの(赤緒=敵1体、鏡片/湯の花=味方1人)は
// 既存の対象選択UI(pickSingleEnemyTarget/renderAllyTargets)をそのまま使う。
// どの形見も「使用者のターンを消費」し、効果解決後にconsumeKatamiUse()で遠征1回+冷却が確定する
function useKatami(actor, def) {
  if (def.id === "hanayome_akao") {
    pickSingleEnemyTarget((target) => {
      consumeKatamiUse();
      // スタン免疫(図鑑のstatusImmune等)の相手には効かない。偽ログを出さず「効かない」と伝える
      if (applyStun(target, 1)) {
        blog(`${actor.label}が結び縄を掲げると、縄が${target.label}へ伸びて縛り上げた！`);
        popupOn(target.instanceId, "💫拘束", "stun");
      } else {
        blog(`${actor.label}が結び縄を掲げた…しかし${target.label}には効かない！`);
      }
      playSfx("big_attack_warning");
      renderBattleScreen();
      finishPlayerAction();
    });
    return;
  }
  if (def.id === "sakazuki_kagami") {
    renderAllyTargets(actor, "katami_kagami");
    return;
  }
  if (def.id === "oshira_yunohana") {
    renderAllyTargets(actor, "katami_yunohana");
    return;
  }
  if (def.id === "utsuro_kitsunemen") {
    consumeKatamiUse();
    actor.katamiKitsuneMask = true;
    blog(`${actor.label}は狐の面をかぶった。動きが軽やかに、二つに残像がぶれる！`);
    playSfx("heal");
    renderBattleScreen();
    finishPlayerAction();
    return;
  }
  // 未知のidは何もせずメニューへ戻す(データ入力ミス時に切り札を無駄撃ちさせない)
  battleActionLocked = false;
  renderItemMenu(actor);
}
// 味方対象の形見(鏡片/湯の花)の効果本体。battle.jsのresolveAllyTargetから呼ばれる
function resolveKatamiAllyTarget(actor, kind, target) {
  if (kind === "katami_kagami") {
    consumeKatamiUse();
    target.katamiShadowGuard = true;
    blog(`${target.label}の影がすうっと離れ、寄り添うように立った。次の一撃を代わりに受けるつもりだ。`);
    playSfx("heal");
  } else if (kind === "katami_yunohana") {
    consumeKatamiUse();
    const heal = Math.max(1, Math.round(target.maxHp * 0.30));
    target.hp = Math.min(target.maxHp, target.hp + heal);
    target.burnTurns = 0;
    target.poison = 0;
    blog(`${actor.label}は湯の花を振りかけた。${target.label}の傷と穢れが湯気とともに流れ落ちる。`);
    popupOn(target.id, `+${heal}`, "heal");
    playSfx("heal");
  }
  renderBattleScreen();
  finishPlayerAction();
}
// 形見「うつろの狐面」を使った本人の通常攻撃: その戦闘の間ずっと2回攻撃(威力50%×2)。
// 通常攻撃の緻密なヒットストップ演出は使わず、会心追撃(runCritFollowupAttack)と同じ簡易演出で
// 1振りずつ見せる(2振り目は少し間を置く)。連斬などの会心追撃はこの攻撃からは連鎖しない
function runKitsuneMaskAttack(actor) {
  pickSingleEnemyTarget((target) => {
    const strike = (onDone) => {
      if (target.hp <= 0) { onDone(); return; }
      playAttackSfxWithSwish(actor.classId);
      const result = performAttack(actor, target, blog, { atkMult: 0.5 });
      if (result.hit) {
        playSfx(hitTakenSfxFor(result.dmg, target.maxHp, target.isSwarm));
        popupOn(target.instanceId, `-${result.dmg}`, "dmg", dmgShakeIntensity(false));
        playScreenShakeOnKillOnly(target, result.crit);
        if (result.crit) playCritEffects(target.instanceId, actor, result.dmg);
        maybeSpeakOnKill(actor, target);
      } else playSfx("evade");
      renderBattleScreen();
      playAttackerLunge(actor.id);
      if (result.hit) playAttackVfx(target.instanceId, actor, "normal");
      triggerShootDownEvents(result.shotDown ? [target] : [], onDone);
    };
    strike(() => setTimeout(() => strike(() => finishPlayerAction()), 380));
  });
}

// 煙玉は消耗品かつ使うと即座に戦闘から一斉離脱してしまうため、誤タップ対策で使用前に確認を挟む
function renderSmokeBombConfirm(actor) {
  battleSubMenuActive = true;
  const grid = document.getElementById("actionGrid");
  grid.innerHTML = "";
  const msg = document.createElement("div");
  msg.style.cssText = "grid-column:1/-1;font-size:0.85rem;text-align:center;margin-bottom:0.3rem;";
  msg.textContent = "煙玉を使いますか？";
  grid.appendChild(msg);

  const yesBtn = document.createElement("button");
  yesBtn.className = "big";
  yesBtn.textContent = "はい";
  yesBtn.onclick = () => {
    // useSmokeBomb内のplaySmokeBombEffect(演出)が終わってbattle=nullになるまで#actionGridが
    // そのまま残り続けるため、この間に連打すると煙玉が2個消費されてしまうバグがあった
    if (battleActionLocked) return;
    battleActionLocked = true;
    useSmokeBomb(actor);
  };
  grid.appendChild(yesBtn);

  const noBtn = document.createElement("button");
  noBtn.className = "big";
  noBtn.textContent = "いいえ";
  noBtn.onclick = () => renderItemMenu(actor);
  grid.appendChild(noBtn);
}

// 消火(煙玉消費)の誤タップ防止確認。ターンを消費しないため「戻る」で行動選択に戻れる
function renderExtinguishConfirm(actor) {
  battleSubMenuActive = true;
  const grid = document.getElementById("actionGrid");
  grid.innerHTML = "";
  const msg = document.createElement("div");
  msg.style.cssText = "grid-column:1/-1;font-size:0.85rem;text-align:center;margin-bottom:0.3rem;";
  msg.textContent = "煙玉を投げてパーティ全員の炎上を消火しますか？(ターンは消費しません)";
  grid.appendChild(msg);

  const yesBtn = document.createElement("button");
  yesBtn.className = "big";
  yesBtn.textContent = "はい";
  yesBtn.onclick = () => {
    if (battleActionLocked) return;
    battleActionLocked = true;
    useExtinguish(actor);
  };
  grid.appendChild(yesBtn);

  const noBtn = document.createElement("button");
  noBtn.className = "big";
  noBtn.textContent = "いいえ";
  noBtn.onclick = () => renderActionButtons(actor);
  grid.appendChild(noBtn);
}
function useExtinguish(actor) {
  consumeSmokeBomb();
  playSfx("heal");
  fieldParty.forEach((c) => { c.burnTurns = 0; });
  blog(`${actor.label}は煙玉を投げ、仲間の炎を消し止めた！`);
  saveState();
  renderBattleScreen();
  renderActionButtons(actor);
}
// 煙玉: 使うとパーティ全員がその戦闘から即座に一斉離脱する(消耗品による確実な脱出手段)
// 煙玉使用時、画面いっぱいに煙が広がって消える演出。CSSのkeyframeアニメーションは
// (transitionと違い)inline style設定直後でも確実に発火するため、double-rAFのような小細工は不要
const SMOKE_BOMB_EFFECT_MS = 1700; // 最後のpuffのanimation-delay(0.3s)+アニメーション本体(1.4s)を少し超える長さ
function playSmokeBombEffect(onDone) {
  const el = document.getElementById("smokeBombEffect");
  el.style.display = "block";
  setTimeout(() => {
    el.style.display = "none";
    onDone();
  }, SMOKE_BOMB_EFFECT_MS);
}
// 忍の変化の術: 発動/解除どちらの瞬間も同じ煙エフェクト(既存の煙玉演出を流用)+専用SEを鳴らす
function useSmokeBomb(actor) {
  markQuestChasingIfFled();
  if (!shouldKeepBossBgmOnFlee()) stopBattleBgm();
  fieldParty.forEach((c) => { if (c.campWeaponCareBattles > 0) c.campWeaponCareBattles--; });
  consumeSmokeBomb();
  saveState();
  blog(`${actor.label}は煙玉を使った！パーティは戦闘から一斉に逃げ出した！`);
  playSfx("smoke_bomb");
  clearDotEffects(fieldParty); clearBattleTransientForms(); // 戦闘から逃げたので毒/炎上は持ち越さず治す
  clearHawkState(fieldParty);
  clearGuardState(fieldParty);
  clearOmamoriIwanagaBonus(fieldParty);
  renderBattleScreen();
  playSmokeBombEffect(() => {
    battle = null;
    pendingEnemyPick = null;
    pendingAllyPick = null;
    if (typeof seamlessDungeonCameraOut === "function") seamlessDungeonCameraOut(); // シームレス入りの戦闘なら逆再生(showScreenより前=共通フェードの抑止が効くように)
    showScreen("screen-dungeon");
    renderDungeon();
  });
}

// 逃げる: 押した本人だけが「逃走準備」に入り、その場では離脱せず今のターンを消費する。次に自分の番が来た時に
// 実際に逃げ出す(processNext参照)。パーティ全員が入れ替わりで一人ずつ逃げる必要があり、
// 誰か一人が逃げただけで全員が離脱するわけではない
