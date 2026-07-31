// テスト本体(ゲームスクリプトと同じevalスコープで実行される)。
// ボスギミック機構(gimmicks.js)・試作ボスデータ(boss_kasha/boss_gashadokuro/gasha_kobone)・
// ボステストのキャラ生成/装備自動購入/JSON出力(title.js)を検証する
(function () {
  let failed = 0;
  function check(name, cond, detail) {
    if (cond) { console.log(`  OK ${name}`); }
    else { failed++; console.log(`  NG ${name}${detail ? " — " + detail : ""}`); }
  }

  console.log("--- A: ボステストのキャラ生成(型固定/ランダム) ---");
  state = defaultState();
  const cLeft = createBossTestCharacter("左固定", "samurai", 8, "left");
  check("レベルが指定どおり", cLeft.level === 8, `actual=${cLeft.level}`);
  const leftSides = Object.keys(SKILL_TREES.samurai).map(Number).filter((lv) => lv >= 2 && lv <= 8).map((lv) => cLeft.skills[lv]);
  check("左固定で全レベル左側を取得", leftSides.length > 0 && leftSides.every((s) => s === "left"), JSON.stringify(cLeft.skills));
  const cRight = createBossTestCharacter("右固定", "onmyoji", 10, "right");
  const rightSides = Object.keys(SKILL_TREES.onmyoji).map(Number).filter((lv) => lv >= 2 && lv <= 10).map((lv) => cRight.skills[lv]);
  check("右固定で全レベル右側を取得", rightSides.length > 0 && rightSides.every((s) => s === "right"), JSON.stringify(cRight.skills));
  check("HP/MPが満タンで生成される", cLeft.hp === cLeft.maxHp && cLeft.mp === cLeft.maxMp);

  console.log("--- B: 装備の自動購入(レベル解禁段階まで) ---");
  state = defaultState();
  bossTestApplyEquipUpgrades([{ classId: "samurai", level: 5 }, { classId: "samurai", level: 9 }]);
  const expWeapon9 = EQUIPMENT.samurai.weapon.filter((t) => t.level <= 9).length;
  const expArmor9 = EQUIPMENT.samurai.armor.filter((t) => t.level <= 9).length;
  check("同職業は最高レベルに合わせて購入", state.classUpgrades.samurai.weapon === expWeapon9 && state.classUpgrades.samurai.armor === expArmor9,
    JSON.stringify(state.classUpgrades.samurai));
  bossTestApplyEquipUpgrades([{ classId: "hunter", level: 1 }]);
  check("Lv1は第1段階のみ購入", state.classUpgrades.hunter.weapon === 1 && state.classUpgrades.hunter.armor === 1, JSON.stringify(state.classUpgrades.hunter));
  const cEquipped = createBossTestCharacter("装備あり", "samurai", 9, "left");
  check("生成キャラに装備ボーナスが乗る", (cEquipped.equipBonus.atk || 0) > 0 && (cEquipped.equipBonus.def || 0) > 0, JSON.stringify(cEquipped.equipBonus));

  // 戦闘セットアップの共通部品(smoke_body.jsと同じ、startBattleの演出部分を通らない簡易版+ギミック初期化)
  function setupGimmickBattle(enemies) {
    battle = { enemies, order: [], orderIndex: 0, actingId: null, actingEnemyId: null, goldMult: 1, justAppeared: true, omamoriUsed: {}, omikujiGuaranteedCritsLeft: 0, swapCooldown: 0, roundsTotal: 0, presence: {} };
    enemies.forEach((x) => { x.__enemyAllies = enemies; });
    pendingEnemyPick = null;
    pendingAllyPick = null;
    initBattleGimmicks();
  }
  function makeParty() {
    state = defaultState();
    fieldParty = [
      createBossTestCharacter("試験侍", "samurai", 5, "left"),
      createBossTestCharacter("試験槍", "spearman", 5, "left"),
      createBossTestCharacter("試験陰", "onmyoji", 5, "left"),
    ];
    fieldParty.forEach((c) => { c.__allies = fieldParty; });
    reserveFieldMember = null;
  }

  console.log("--- C: 火車の業火纏い(hpBelowトリガー+4ターン毎の全体炎上付与+オーバーレイ) ---");
  makeParty();
  const kasha = instantiateEnemyById("boss_kasha");
  setupGimmickBattle([kasha]);
  check("ギミック実行状態が積まれる", battle.gimmicks.length === 1 && !battle.gimmicks[0].active);
  processGimmickTriggers();
  check("HP満タンでは発動しない", !battle.gimmicks[0].active);
  const overlay = document.getElementById("battleGimmickOverlay");
  check("発動前はオーバーレイ無し", overlay.className === "");
  kasha.hp = Math.floor(kasha.maxHp * 0.4);
  processGimmickTriggers();
  check("HP50%未満で発動する", battle.gimmicks[0].active);
  check("業火オーバーレイが付く", overlay.className === "gimmick-blaze", overlay.className);
  battle.roundsTotal = 1;
  let proceeded = false;
  const r1 = processGimmickRoundEffects(() => { proceeded = true; });
  const r2 = processGimmickRoundEffects(() => { proceeded = true; });
  const r3 = processGimmickRoundEffects(() => { proceeded = true; });
  check("発動後1〜3ラウンド目は何も起きない(every:4)", r1 === false && r2 === false && r3 === false && !proceeded);
  check("(前提)まだ誰も炎上していない", fieldParty.every((c) => !(c.burnTurns > 0)));
  const hpBefore = fieldParty.map((c) => c.hp);
  const r4 = processGimmickRoundEffects(() => {});
  check("4ラウンド目に発動する", r4 === true);
  check("味方全員に炎上(2〜3ターン)が付与される", fieldParty.every((c) => c.burnTurns >= 2 && c.burnTurns <= 3), fieldParty.map((c) => c.burnTurns).join(","));
  check("付与の瞬間は直接ダメージを受けない", fieldParty.every((c, i) => c.hp === hpBefore[i]));
  check("炎上ティックで最大HP8%のダメージを受ける", (() => {
    const c = fieldParty[0];
    const before = c.hp;
    const turnsBefore = c.burnTurns;
    tickBurn(c, () => {});
    return before - c.hp === Math.round(c.maxHp * BURN_DAMAGE_PCT) && c.burnTurns === turnsBefore - 1;
  })());
  check("さらに4ラウンド後にもう一度付与される", (() => {
    fieldParty.forEach((c) => { c.burnTurns = 0; });
    processGimmickRoundEffects(() => {});
    processGimmickRoundEffects(() => {});
    processGimmickRoundEffects(() => {});
    const mid = fieldParty.every((c) => !(c.burnTurns > 0));
    processGimmickRoundEffects(() => {});
    return mid && fieldParty.every((c) => c.burnTurns >= 2 && c.burnTurns <= 3);
  })());
  check("状態異常免疫中の味方には付与されない", (() => {
    fieldParty.forEach((c) => { c.burnTurns = 0; });
    fieldParty[0].statusImmuneTurns = 2;
    for (let i = 0; i < 4; i++) processGimmickRoundEffects(() => {});
    const ok = !(fieldParty[0].burnTurns > 0) && fieldParty[1].burnTurns > 0;
    fieldParty[0].statusImmuneTurns = 0;
    return ok;
  })());
  check("倒れたボスのギミックは何もしない", (() => {
    kasha.hp = 0;
    fieldParty.forEach((c) => { c.burnTurns = 0; });
    for (let i = 0; i < 8; i++) processGimmickRoundEffects(() => {});
    return fieldParty.every((c) => !(c.burnTurns > 0));
  })());

  console.log("--- D: がしゃどくろの骨呼び(即時召喚+周期召喚+上限) ---");
  makeParty();
  const gasha = instantiateEnemyById("boss_gashadokuro");
  setupGimmickBattle([gasha]);
  gasha.hp = Math.floor(gasha.maxHp * 0.6);
  processGimmickTriggers();
  check("発動+即時召喚で骸骨2体", battle.enemies.length === 3 && battle.enemies.filter((e) => e.id === "gasha_kobone").length === 2, `enemies=${battle.enemies.length}`);
  check("鬼火オーバーレイが付く", overlay.className === "gimmick-onibi", overlay.className);
  check("召喚された骸骨の相互参照が配り直される", battle.enemies.every((e) => e.__enemyAllies === battle.enemies));
  battle.roundsTotal = 1;
  processGimmickRoundEffects(() => {});
  processGimmickRoundEffects(() => {});
  check("周期(every:3)の途中では召喚しない", battle.enemies.length === 3);
  processGimmickRoundEffects(() => {});
  check("3ラウンド目で+2体(計4体、上限ちょうど)", battle.enemies.filter((e) => e.id === "gasha_kobone" && e.hp > 0).length === 4, `total=${battle.enemies.length}`);
  processGimmickRoundEffects(() => {});
  processGimmickRoundEffects(() => {});
  processGimmickRoundEffects(() => {});
  check("上限4体に達している間は追加召喚しない", battle.enemies.filter((e) => e.id === "gasha_kobone").length === 4);
  // 3体倒すと枠が空き、次の周期で2体まで補充される。死体の召喚カード枠は畳まれる(__clearedWave)
  const minions = battle.enemies.filter((e) => e.id === "gasha_kobone");
  minions[0].hp = 0; minions[1].hp = 0; minions[2].hp = 0;
  processGimmickRoundEffects(() => {});
  processGimmickRoundEffects(() => {});
  processGimmickRoundEffects(() => {});
  check("枠が空いたら次の周期で2体補充", battle.enemies.filter((e) => e.id === "gasha_kobone" && e.hp > 0).length === 3, `alive=${battle.enemies.filter((e) => e.id === "gasha_kobone" && e.hp > 0).length}`);
  check("倒された召喚骸骨のカード枠は畳まれる", battle.enemies.filter((e) => e.id === "gasha_kobone" && e.hp <= 0).every((e) => e.__clearedWave));

  console.log("--- E: fieldDamage(直接場ダメージ)機構と全滅処理・battleStartトリガー ---");
  makeParty();
  const kasha2 = instantiateEnemyById("boss_kasha");
  // 汎用機構の検証用に、開幕発動+毎ラウンド大ダメージの合成ギミックを差し込む
  kasha2.gimmicks = [{ id: "test_wipe", name: "試験の劫火",
    trigger: { type: "battleStart" },
    effects: [{ type: "fieldDamage", every: 1, pctMaxHp: 0.5, min: 999, name: "試験の劫火" }] }];
  setupGimmickBattle([kasha2]);
  processGimmickTriggers();
  check("battleStartトリガーは即発動する", battle.gimmicks[0].active);
  fieldParty.forEach((c) => { c.hp = 1; });
  battle.roundsTotal = 1;
  let proceedCalled = false;
  const rWipe = processGimmickRoundEffects(() => { proceedCalled = true; });
  check("全滅時はtrueを返し続きを呼ばない(全滅処理へ)", rWipe === true && !proceedCalled);
  check("全員ロストになっている", fieldParty.every((c) => c.status === "lost"));

  console.log("--- F: 戦闘終了の後始末で場演出が消える ---");
  makeParty();
  const kasha3 = instantiateEnemyById("boss_kasha");
  setupGimmickBattle([kasha3]);
  kasha3.hp = 1;
  processGimmickTriggers();
  check("(前提)オーバーレイが付いている", overlay.className === "gimmick-blaze");
  clearBattleTransientForms();
  check("後始末でオーバーレイが消える", overlay.className === "");

  console.log("--- G: ボステストのJSON出力(敵エディタ互換の差分形式) ---");
  bossTestConfig.enemies = ["boss_kasha", "gasha_kobone", "", ""];
  bossTestConfig.statOverrides = [
    { hp: 999, atk: 30, def: 25, spd: 10 }, // hpだけ変更
    { hp: 40, atk: 16, def: 10, spd: 8 },   // 全てマスター値と同じ=出力されない
    null, null,
  ];
  const txt = buildBossTestExportText();
  check("ENEMIES_CHANGEDブロックがある", txt.includes("const ENEMIES_CHANGED ="));
  check("変更した敵だけが出力される", txt.includes('"boss_kasha"') && !txt.includes('"gasha_kobone"'));
  check("上書き値が反映される", txt.includes('"hp": 999'));
  check("適用スクリプト互換の空ブロックも出す", txt.includes("const ENEMIES_REMOVED = []") && txt.includes("const ENEMY_WEAKNESS_CHANGED = {}"));

  console.log("--- H: ボステスト用の敵は通常抽選に出ない ---");
  const testOnlyLeaks = [];
  for (let f = 1; f <= 100; f++) {
    ["forest", "cave", "coast"].forEach((stg) => {
      // 敵が1体もいない階層帯では既存のpickEnemyForFloorが空プールを踏むため、そこは対象外
      let e = null;
      try { e = pickEnemyForFloor(f, false, stg); } catch (err) { return; }
      if (e && ["boss_kasha", "boss_gashadokuro", "gasha_kobone"].includes(e.id)) testOnlyLeaks.push(e.id);
    });
  }
  check("100階ぶん抽選しても混入しない", testOnlyLeaks.length === 0, testOnlyLeaks.join(","));
  check("ボス抽選(15の倍数階)にも混入しない", (() => {
    for (let i = 0; i < 50; i++) {
      let b = null;
      try { b = pickEnemyForFloor(45, true, "forest"); } catch (err) { return true; }
      if (b && ["boss_kasha", "boss_gashadokuro"].includes(b.id)) return false;
    }
    return true;
  })());

  console.log("--- I: 戦闘画面のテスト用ボタン ---");
  const exitBtn = document.getElementById("battleTestExitBtn");
  check("タイトルへ戻るボタンが存在する", !!exitBtn);
  check("初期状態では非表示", exitBtn.style.display === "none");
  check("クリックハンドラが付いている", typeof exitBtn.onclick === "function");
  check("大規模戦テストのボタンは撤去済み", !document.getElementById("titleTest2Btn"));
  check("ボステストのボタンがある", !!document.getElementById("titleBossTestBtn"));

  console.log("--- J: ボスは逃走しない(逃走+追撃システム全廃、2026-07-31) ---");
  // HP30%未満のボスの手番をprocessNextで直接回し、旧システムなら逃走していた状況で
  // 戦闘が続行される(battleが破棄されない)ことを確認する。通常戦闘想定(bossTestActive=false)
  makeParty();
  const fleeBoss = instantiateEnemyById("boss_kasha");
  fleeBoss.hp = Math.floor(fleeBoss.maxHp * 0.1); // 旧BOSS_FLEE_HP_RATIO(0.3)を大きく割るHP
  setupGimmickBattle([fleeBoss]);
  battle.roundsTotal = 1;
  battle.order = [{ kind: "enemy", ref: fleeBoss }];
  battle.orderIndex = 0;
  const wasBossTest = bossTestActive;
  bossTestActive = false;
  processNext();
  check("瀕死ボスの手番でも戦闘が破棄されない", battle !== null);
  check("逃走関連の関数が完全に撤去済み", typeof triggerBossFlee === "undefined" && typeof playBossFleeBanner === "undefined" && typeof tryForceBossPursuitEncounter === "undefined");
  check("逃走用の状態変数も撤去済み", typeof bossPursuit === "undefined");
  bossTestActive = wasBossTest;

  console.log(failed === 0 ? "✅ 全テスト通過" : `❌ ${failed}件失敗`);
  window.__failed = failed;
})();
