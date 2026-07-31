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
  // 2種類目(毒)の表示中
  setTimeout(() => {
    const card = document.querySelector(`#enemyRow .enemy-card[data-id="${eC.instanceId}"]`);
    const chip = card && card.querySelector(".dot-stop-chip");
    check("2種類目のチップが毒", !!chip && chip.textContent.includes("毒"), chip && chip.textContent);
  }, 260 + 840 + 500);
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
      console.log(failed === 0 ? "✅ 全テスト通過" : `❌ ${failed}件失敗`);
      window.__failed = failed;
    });
  }
})();
