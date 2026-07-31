// テスト本体(ゲームスクリプトと同じevalスコープで実行される)。
// 敵のDOT停止演出: skipDots・処理順(炎上→毒→出血)・ダメージ適用・暗転/チップ/VFXのDOM状態・
// 途中死亡時の省略・DOT無し時の同期完了を検証する。非同期完了後にwindow.__failedへ書き込む
(function () {
  let failed = 0;
  function check(name, cond, detail) {
    if (cond) { console.log(`  OK ${name}`); }
    else { failed++; console.log(`  NG ${name}${detail ? " — " + detail : ""}`); }
  }
  function makeParty() {
    state = defaultState();
    fieldParty = [createCharacter("試験侍", "samurai", state.classUpgrades)];
    fieldParty.forEach((c) => { c.__allies = fieldParty; });
    reserveFieldMember = null;
  }
  function setupBattle(enemies) {
    battle = { enemies, order: [], orderIndex: 0, actingId: null, actingEnemyId: null, goldMult: 1, justAppeared: true, omamoriUsed: {}, omikujiGuaranteedCritsLeft: 0, swapCooldown: 0, roundsTotal: 0, presence: {} };
    enemies.forEach((x) => { x.__enemyAllies = enemies; });
    renderBattleScreen();
  }
  const logs = [];
  const blogCap = (t) => logs.push(t);

  console.log("--- A: tickTurnStartEffectsのskipDots ---");
  makeParty();
  const eA = instantiateEnemyById("inoshishi");
  setupBattle([eA]);
  eA.poison = 5; eA.burnTurns = 2; eA.bleed = 3;
  const hpBeforeA = eA.hp;
  tickTurnStartEffects(eA, blogCap, { skipDots: true });
  check("skipDotsでHPが減らない", eA.hp === hpBeforeA, `hp=${eA.hp}/${hpBeforeA}`);
  check("skipDotsで蓄積値も消費されない", eA.poison === 5 && eA.burnTurns === 2 && eA.bleed === 3);
  tickTurnStartEffects(eA, blogCap);
  check("通常呼び出しでは従来どおりダメージ+消費", eA.hp < hpBeforeA && eA.poison === 4 && eA.burnTurns === 1 && eA.bleed === 2, `hp=${eA.hp} p=${eA.poison} b=${eA.burnTurns} bl=${eA.bleed}`);

  console.log("--- B: DOT無しなら同期で即完了 ---");
  makeParty();
  const eB = instantiateEnemyById("inoshishi");
  setupBattle([eB]);
  let syncDone = false;
  playEnemyDotStopSequence(eB, blogCap, () => { syncDone = true; });
  check("onDoneが同期で呼ばれる", syncDone);
  check("暗転は点灯しない", !document.getElementById("battleDotStopDim").classList.contains("on"));

  console.log("--- C: フルシーケンス(炎上→毒→出血) ---");
  makeParty();
  const eC = instantiateEnemyById("q_oni"); // HPが多くDOTで死なないボス(bleed免疫なし)
  setupBattle([eC]);
  eC.poison = 4; eC.burnTurns = 2; eC.bleed = 3;
  const hpBeforeC = eC.hp;
  logs.length = 0;
  let cDone = false;
  const seqStartAt = Date.now();
  playEnemyDotStopSequence(eC, blogCap, () => { cDone = true; });
  const dim = document.getElementById("battleDotStopDim");
  check("開始直後から暗転が点灯する", dim.classList.contains("on"));
  check("onDoneはまだ呼ばれない(停止時間ぶん待たされる)", !cDone);
  // 最初の種類(炎上)の表示中(暗転260ms+α後)にチップとVFXが出ていることを確認
  setTimeout(() => {
    const card = document.querySelector(`#enemyRow .enemy-card[data-id="${eC.instanceId}"]`);
    const chip = card && card.querySelector(".dot-stop-chip");
    check("1種類目のチップが炎上", !!chip && chip.textContent.includes("炎上"), chip && chip.textContent);
    check("チップに色クラスが付く", !!chip && chip.classList.contains("dot-chip-burn"));
    check("VFXフリップブックが敵カード上にある", !!card && !!card.querySelector(".dot-ailment-vfx"));
    check("炎上VFXは加算合成", !!card && !!card.querySelector(".dot-ailment-vfx.blend-screen"));
  }, 500);
  // 2種類目(毒)の表示中(炎上ステップはVFX完走待ちでmax(700,1320-120)+140=1340ms続くため、
  // 暗転260ms+1340msの後+400msの時点で確認する)
  setTimeout(() => {
    const card = document.querySelector(`#enemyRow .enemy-card[data-id="${eC.instanceId}"]`);
    const chip = card && card.querySelector(".dot-stop-chip");
    check("2種類目のチップが毒", !!chip && chip.textContent.includes("毒"), chip && chip.textContent);
  }, 260 + 1340 + 400);
  const finishCheck = setInterval(() => {
    if (!cDone) return;
    clearInterval(finishCheck);
    check("完了まで停止時間が積み上がる(2秒以上)", Date.now() - seqStartAt >= 2000, `${Date.now() - seqStartAt}ms`);
    check("完了後は暗転が消える", !dim.classList.contains("on"));
    const burnIdx = logs.findIndex((t) => t.includes("炎上で"));
    const poisonIdx = logs.findIndex((t) => t.includes("毒で"));
    const bleedIdx = logs.findIndex((t) => t.includes("出血で"));
    check("ログの順序が炎上→毒→出血", burnIdx >= 0 && poisonIdx > burnIdx && bleedIdx > poisonIdx, logs.join(" / "));
    check("3種類ぶんのダメージが適用されている", eC.hp < hpBeforeC && eC.poison === 3 && eC.burnTurns === 1 && eC.bleed === 2, `hp=${eC.hp}`);
    runDeathCase();
  }, 100);

  // D: 炎上の1発目で死ぬ敵は、残りの毒/出血の表示を省略して締める
  function runDeathCase() {
    console.log("--- D: 途中死亡で残りの種類を省略 ---");
    makeParty();
    const eD = instantiateEnemyById("inoshishi");
    setupBattle([eD]);
    eD.hp = 1;
    eD.burnTurns = 2; eD.poison = 5; eD.bleed = 5;
    logs.length = 0;
    playEnemyDotStopSequence(eD, blogCap, () => {
      check("死亡後は毒/出血のログを出さない", logs.some((t) => t.includes("炎上で")) && !logs.some((t) => t.includes("毒で")) && !logs.some((t) => t.includes("出血で")), logs.join(" / "));
      check("敵は倒れている", eD.hp <= 0);
      check("締めで暗転が消える", !document.getElementById("battleDotStopDim").classList.contains("on"));
      console.log("--- E: VFX割り当ての選択 ---");
      const a1 = ailmentVfxAssignmentFor("burn", 1);
      const a9 = ailmentVfxAssignmentFor("burn", 9);
      check("炎上レベル1の割り当てが取れる", !!a1 && a1.frameCount === 60);
      check("未設定レベルは最も近い既存レベルへ寄せる", a9 === a1);
      check("未知の状態異常はnull", ailmentVfxAssignmentFor("stun", 1) === null);
      runAttackOrderCase();
    });
  }

  // F: 実際のprocessNext(敵ターン)を通しで動かし、敵の攻撃(enemyAttack)が
  // 「停止演出の全種類+VFXの完走+明転+行動前の間」の後に初めて呼ばれることを時刻で検証する
  function runAttackOrderCase() {
    console.log("--- F: 敵の攻撃モーションは停止演出(VFX完走込み)の後 ---");
    makeParty();
    const eF = instantiateEnemyById("q_oni");
    setupBattle([eF]);
    eF.bigAttackCountdown = 3; // このターンは通常攻撃(大技でも予告でもない)
    eF.burnTurns = 2; // 炎上VFX=60コマ×22ms=1320ms(停止0.7秒より長い→VFX完走まで待つはず)
    eF.poison = 3;    // 毒VFX=9コマ×109ms=981ms
    battle.order = [eF];
    battle.orderIndex = 0;
    let burnTickAt = 0, poisonTickAt = 0, attackAt = 0;
    const origEnemyAttack = enemyAttack;
    const origTickBurn = tickBurn;
    const origTickPoison = tickPoison;
    enemyAttack = (a, alive, log) => { attackAt = Date.now(); return origEnemyAttack(a, alive, log); };
    tickBurn = (e, l) => { if (!burnTickAt) burnTickAt = Date.now(); return origTickBurn(e, l); };
    tickPoison = (e, l) => { if (!poisonTickAt) poisonTickAt = Date.now(); return origTickPoison(e, l); };
    processNext();
    const waitF = setInterval(() => {
      if (!attackAt) return;
      clearInterval(waitF);
      enemyAttack = origEnemyAttack;
      tickBurn = origTickBurn;
      tickPoison = origTickPoison;
      // 炎上ステップの停止はmax(700, 1320-120)+140=1340ms。毒はその後に始まる
      check("毒の表示は炎上VFXが終わってから", poisonTickAt - burnTickAt >= 1300, `${poisonTickAt - burnTickAt}ms`);
      // 毒ステップの停止max(700, 981-120)+140=1001ms+明転250ms+行動前600ms=約1850ms後に攻撃
      check("攻撃は最後のDOT表示+VFX完走+明転の後", attackAt - poisonTickAt >= 1700, `${attackAt - poisonTickAt}ms`);
      check("攻撃までの合計が演出の総和以上(約3.4秒)", attackAt - burnTickAt >= 3000, `${attackAt - burnTickAt}ms`);
      console.log(failed === 0 ? "✅ 全テスト通過" : `❌ ${failed}件失敗`);
      window.__failed = failed;
    }, 50);
  }
})();
