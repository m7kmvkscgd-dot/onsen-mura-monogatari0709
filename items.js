// ============ items.js: 戦闘中の道具使用(道具メニュー・煙玉・消火) ============
function renderItemMenu(actor) {
  battleSubMenuActive = true;
  const grid = document.getElementById("actionGrid");
  grid.innerHTML = "";
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

  // 爆弾は火薬庫を建てるまでボタン自体を出さない(未所持でも灰色ボタンとして見えてしまうと、
  // 建物を建てる前からアイテムの存在を知ってしまう=ネタバレになるため、他の未解禁アイテムと
  // 同じく「ラインナップにすら出さない」方式に統一した)
  if (state.gunpowderStoreLevel) {
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
  yesBtn.onclick = () => useSmokeBomb(actor);
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
  yesBtn.onclick = () => useExtinguish(actor);
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
  clearDotEffects(fieldParty); // 戦闘から逃げたので毒/炎上は持ち越さず治す
  clearHawkState(fieldParty);
  clearGuardState(fieldParty);
  clearOmamoriIwanagaBonus(fieldParty);
  renderBattleScreen();
  playSmokeBombEffect(() => {
    battle = null;
    pendingEnemyPick = null;
    pendingAllyPick = null;
    showScreen("screen-dungeon");
    renderDungeon();
    checkStrandedOnCurrentFloor();
  });
}

// 逃げる: 押した本人だけが「逃走準備」に入り、その場では離脱せず今のターンを消費する。次に自分の番が来た時に
// 実際に逃げ出す(processNext参照)。パーティ全員が入れ替わりで一人ずつ逃げる必要があり、
// 誰か一人が逃げただけで全員が離脱するわけではない
