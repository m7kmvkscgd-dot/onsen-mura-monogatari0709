// テスト本体: 物語クエスト「鈴鳴峠の嫁入り」のデータ整合と、区間フレーバー/ボス口上/
// 白縫ギミック(赤緒の拘束・行列の被ダメ軽減)/魂の回想ビューアの動作を検証する
(function () {
  let failed = 0;
  function check(name, cond, detail) {
    if (cond) { console.log(`  OK ${name}`); }
    else { failed++; console.log(`  NG ${name}${detail ? " — " + detail : ""}`); }
  }
  function makeParty() {
    state = defaultState();
    fieldParty = [
      createCharacter("試験侍", "samurai", state.classUpgrades),
      createCharacter("試験槍", "spearman", state.classUpgrades),
      createCharacter("試験狩", "hunter", state.classUpgrades),
    ];
    fieldParty.forEach((c) => { c.__allies = fieldParty; });
    reserveFieldMember = null;
  }

  console.log("--- A: 鈴鳴峠のデータ整合 ---");
  const qDef = QUEST_DEFS.amayome_shiranui;
  const route = QUEST_ROUTE_DEFS.suzunari;
  check("依頼がルートに紐付く", !!qDef && qDef.route === "suzunari" && !!route);
  check("ボスは最終層に配置", qDef.targetFloor === route.totalFloors);
  check("完了文がある", typeof qDef.completionText === "string" && qDef.completionText.length > 10);
  check("区間4つ・fromFloor昇順", route.segments.length === 4 && route.segments.every((s, i) => i === 0 || s.fromFloor > route.segments[i - 1].fromFloor));
  check("全区間にフレーバーがある", route.segments.every((s) => s.flavor && s.flavor.length > 5));
  check("区間の敵IDが実在する", route.segments.every((s) => (s.enemies || []).every((id) => !!ENEMIES[id])));
  const boss = ENEMIES.amayome_shiranui;
  check("ボスの口上4行", Array.isArray(boss.preBattleLines) && boss.preBattleLines.length === 4);
  check("回想(soulStory)はデータから撤去済み(2026-07-31方針転換)", !boss.soulStory);
  check("ギミック2種(赤緒/行列)", boss.gimmicks.length === 2 && boss.gimmickNotes.length === 2);
  check("提灯童/白縫は通常抽選に出ない", ENEMIES.chochin_warabe.questOnly && ENEMIES.chochin_warabe.maxFloor === 0 && boss.questOnly && boss.maxFloor === 0);

  console.log("--- B: 区間フレーバー(1回だけ表示) ---");
  makeParty();
  currentStage = "questroute";
  currentQuestRouteId = "suzunari";
  questRouteFlavorShown = {};
  retreating = false;
  dungeonLogLines = [];
  currentFloor = 3;
  maybeShowQuestRouteFlavor();
  check("区間開始層でフレーバーが流れる", dungeonLogLines.some((l) => l.includes("誰も持っていない提灯")));
  const countAfterFirst = dungeonLogLines.length;
  maybeShowQuestRouteFlavor();
  check("同じ区間で二度は流れない", dungeonLogLines.length === countAfterFirst);
  currentFloor = 4;
  maybeShowQuestRouteFlavor();
  check("区間の途中の層では流れない", dungeonLogLines.length === countAfterFirst);
  currentStage = "forest";
  currentQuestRouteId = null;

  console.log("--- C: ボス口上オーバーレイ→戦闘開始 ---");
  makeParty();
  const shiranui = instantiateEnemyById("amayome_shiranui");
  startBattle([shiranui], null, "雨嫁・白縫が立ちはだかる！");
  const overlay = document.querySelector(".pre-battle-lines-overlay");
  check("口上オーバーレイが出る", !!overlay);
  check("4行ぶんの台詞がある", overlay && overlay.querySelectorAll("p").length === 4);
  check("口上中は戦闘がまだ始まらない", battle.roundsTotal === 0);
  overlay.click(); // 1タップ目: 残り全行を表示
  overlay.click(); // 2タップ目: 戦闘開始
  const waitC = setInterval(() => {
    if (document.querySelector(".pre-battle-lines-overlay")) return;
    clearInterval(waitC);
    check("タップで口上が閉じ戦闘が始まる", battle && battle.roundsTotal >= 1);
    check("口上がログにも残る", battleLogLines.some((l) => l.includes("置いていかないで")));
    runGimmickCase();
  }, 120);

  function runGimmickCase() {
    console.log("--- D: 白縫のギミック(赤緒の拘束/嫁入り行列) ---");
    makeParty();
    const b = instantiateEnemyById("amayome_shiranui");
    battle = { enemies: [b], order: [], orderIndex: 0, actingId: null, actingEnemyId: null, goldMult: 1, justAppeared: true, omamoriUsed: {}, omikujiGuaranteedCritsLeft: 0, swapCooldown: 0, roundsTotal: 0, presence: {} };
    b.__enemyAllies = [b];
    initBattleGimmicks();
    renderBattleScreen();
    processGimmickTriggers();
    check("赤緒は開幕から起動する", battle.gimmicks.find((g) => g.def.id === "akao").active);
    check("行列はまだ起動しない(HP60%超)", !battle.gimmicks.find((g) => g.def.id === "tomurai").active);
    battle.roundsTotal = 1;
    processGimmickRoundEffects(() => {});
    processGimmickRoundEffects(() => {});
    check("赤緒の周期前は誰も拘束されない", fieldParty.every((c) => !(c.stunTurns > 0)));
    processGimmickRoundEffects(() => {});
    check("3ラウンド目で味方1人が拘束される", fieldParty.filter((c) => c.stunTurns > 0).length === 1);
    b.hp = Math.floor(b.maxHp * 0.5);
    processGimmickTriggers();
    check("HP60%未満で行列が起動+提灯童2体", battle.gimmicks.find((g) => g.def.id === "tomurai").active && battle.enemies.filter((e) => e.id === "chochin_warabe").length === 2);
    processGimmickRoundEffects(() => {});
    check("提灯童がいる間は被ダメ軽減が掛かる", b.statMods.some((m) => m.stat === "dmgTaken" && m.mult === 0.7));
    battle.enemies.forEach((e) => { if (e.id === "chochin_warabe") e.hp = 0; });
    b.statMods = [];
    processGimmickRoundEffects(() => {});
    check("提灯童が全滅すると軽減は掛からない", !b.statMods.some((m) => m.stat === "dmgTaken"));
    runSoulCase();
  }

  // E: 回想機構の休眠テスト(2026-07-31方針転換で本番データからsoulStoryは撤去済み。
  // 機構=showSoulStoryOffer/openSoulStoryViewerは残置のため、合成データを注入して
  // 「データを足せばそのまま復活する」ことを保証し続ける)。soulStoryGateScaleで間を1/50に縮小
  function runSoulCase() {
    console.log("--- E: 魂の回想機構(休眠、合成データ注入) ---");
    soulStoryGateScale = 0.02;
    makeParty();
    const b = instantiateEnemyById("amayome_shiranui");
    b.soulStory = {
      soulLine: "私は……誰を待っていたのでしょう。",
      scenes: [
        { text: "私には、呼んでくれる名すらありませんでした。この赤い緒があれば、どこにいても家族だと。", gates: { 0: 900 } },
        { text: "迎えに来たよ、白縫、と。" },
      ],
    };
    battle = { enemies: [b], order: [], orderIndex: 0, actingId: null, actingEnemyId: null, goldMult: 1, justAppeared: true, omamoriUsed: {}, omikujiGuaranteedCritsLeft: 0, swapCooldown: 0, roundsTotal: 1, presence: {} };
    b.__enemyAllies = [b];
    renderBattleScreen();
    b.hp = 0;
    renderBattleScreen();
    document.getElementById("actionGrid").innerHTML = `<button class="big primary" id="battleContinueBtn" style="grid-column:1/-1;">戻る</button>`;
    showSoulStoryOffer(b);
    const fx = document.querySelector("#screen-battle .soul-offer-fx");
    check("魂が独立レイヤーに浮かぶ", !!fx && !!fx.querySelector(".soul-rise"));
    check("魂は死んだ敵カードの中には居ない(visibility:hiddenで見えなくなる)", !document.querySelector(".enemy-card .soul-rise"));
    check("魂の一言は静寂中はまだ出ない", (fx.querySelector(".soul-line").textContent || "") === "");
    check("回想ボタンも即座には出ない", !document.getElementById("soulStoryBtn"));
    check("演出中は「戻る」が隠れる", document.getElementById("battleContinueBtn").style.display === "none");
    const waitLine = setInterval(() => {
      const btn = document.getElementById("soulStoryBtn");
      if (!btn) return; // ボタンが出る=一言も出きっている時刻
      clearInterval(waitLine);
      check("魂の一言が一言遅れで出る", fx.querySelector(".soul-line").textContent.includes("誰を待っていたのでしょう"));
      check("「残された記憶に触れる」ボタンが出る", btn.textContent.includes("残された記憶に触れる"));
      check("演出完了で「戻る」が再表示される", document.getElementById("battleContinueBtn").style.display !== "none");
      btn.click();
      const viewer = document.getElementById("soulStoryOverlay");
      const textEl = document.getElementById("soulStoryText");
      check("ビューアが開き1場面目の1文目だけが出る", viewer.style.display === "flex" && textEl.textContent.includes("呼んでくれる名すら") && !textEl.textContent.includes("赤い緒があれば"));
      viewer.click(); // ゲート(注入したgates[0]=900ms×0.02=18ms)以内の連打は飲み込まれる
      check("ゲート中のタップは無視される", !textEl.textContent.includes("赤い緒があれば"));
      // 以降はゲート明けを待ちながらタップを繰り返し、最終場面の最終文まで送る
      let taps = 0;
      const tapLoop = setInterval(() => {
        if (textEl.textContent.includes("迎えに来たよ、白縫")) {
          clearInterval(tapLoop);
          check("場面をまたいで最終文まで送れる", true);
          check("既読が記録される", state.soulStoriesSeen && state.soulStoriesSeen.amayome_shiranui === true);
          viewer.click(); // 最終場面でタップ→閉じる(フェード後)
          const waitClose = setInterval(() => {
            if (viewer.style.display !== "none") return;
            clearInterval(waitClose);
            check("最後のタップで閉じる", true);
            soulStoryGateScale = 1;
            runQuestTesterCase();
          }, 120);
          return;
        }
        viewer.click();
        if (++taps > 40) { clearInterval(tapLoop); check("場面をまたいで最終文まで送れる", false, "40タップで到達せず"); soulStoryGateScale = 1; runQuestTesterCase(); }
      }, 60);
    }, 30);
  }

  // F: クエストテスト(タイトルの開発ツール)。抽選なしで受注→出発し、1層目のフレーバーまで流れる
  function runQuestTesterCase() {
    console.log("--- F: クエストテスターとタイトル整理 ---");
    check("タイトルのdevグリッドに4ボタン", document.querySelectorAll(".title-dev-grid .title-menu-btn").length === 4);
    check("クエストテストボタンがある", !!document.getElementById("titleQuestTestBtn"));
    battle = null;
    renderQuestTestScreen();
    const sel = document.getElementById("questTestSelect");
    check("依頼リストの先頭は専用ルート付き", sel.value === "amayome_shiranui", sel.value);
    check("味方枠4つが出る", document.querySelectorAll("#questTestAllyRows .boss-test-slot").length === 4);
    document.getElementById("questTestStartBtn").onclick();
    check("受注状態が本番と同じ形で作られる", state.acceptedQuest && state.acceptedQuest.questKey === "amayome_shiranui" && state.acceptedQuest.route === "suzunari" && state.acceptedQuest.contractFee === 0);
    check("専用ルートへ出発する", currentStage === "questroute" && currentQuestRouteId === "suzunari" && currentFloor === 1);
    check("3人+控え1で出発する", fieldParty.length === 3 && !!reserveFieldMember);
    check("1層目のフレーバーが流れる", dungeonLogLines.some((l) => l.includes("峠の奥から始まっていた")));
    check("テストモードでセーブ保護される", testModeActive === true);
    runKagegiCase();
  }

  // G: 影盗り宿の十三号室(第2号)のデータ整合+十三枚目の席ギミック(round3毎に影法師召喚+拘束)
  function runKagegiCase() {
    console.log("--- G: 影盗り宿の十三号室のデータ整合とギミック ---");
    const qDef2 = QUEST_DEFS.kagegui_sakazuki;
    const route2 = QUEST_ROUTE_DEFS.tsukikage_yado;
    check("依頼がルートに紐付く", !!qDef2 && qDef2.route === "tsukikage_yado" && !!route2);
    check("ボスは最終層に配置", qDef2.targetFloor === route2.totalFloors);
    check("区間4つ・fromFloor昇順", route2.segments.length === 4 && route2.segments.every((s, i) => i === 0 || s.fromFloor > route2.segments[i - 1].fromFloor));
    check("区間の敵IDが実在する", route2.segments.every((s) => (s.enemies || []).every((id) => !!ENEMIES[id])));
    const boss2 = ENEMIES.kagegui_sakazuki;
    check("ボスの口上4行", Array.isArray(boss2.preBattleLines) && boss2.preBattleLines.length === 4);
    check("回想(soulStory)はデータから撤去済み(2026-07-31方針転換)", !boss2.soulStory);
    check("ギミックメモは2件、構造化ギミックは1件(影写しは既存トリガーで表現不可のため未実装)", boss2.gimmickNotes.length === 2 && boss2.gimmicks.length === 1);
    check("影法師/逆月は通常抽選に出ない", ENEMIES.kageboshi.questOnly && ENEMIES.kageboshi.maxFloor === 0 && boss2.questOnly && boss2.maxFloor === 0);

    makeParty();
    const b2 = instantiateEnemyById("kagegui_sakazuki");
    battle = { enemies: [b2], order: [], orderIndex: 0, actingId: null, actingEnemyId: null, goldMult: 1, justAppeared: true, omamoriUsed: {}, omikujiGuaranteedCritsLeft: 0, swapCooldown: 0, roundsTotal: 0, presence: {} };
    b2.__enemyAllies = [b2];
    initBattleGimmicks();
    renderBattleScreen();
    processGimmickTriggers();
    check("ラウンド1では未発動", !battle.gimmicks.find((g) => g.def.id === "juusan").active);
    battle.roundsTotal = 3;
    processGimmickTriggers();
    check("3ラウンド目の発動と同時に影法師が1体出現(immediate)", battle.gimmicks.find((g) => g.def.id === "juusan").active && battle.enemies.filter((e) => e.id === "kageboshi" && e.hp > 0).length === 1);
    check("発動直後はまだ誰も拘束されない", fieldParty.every((c) => !(c.stunTurns > 0)));
    processGimmickRoundEffects(() => {});
    processGimmickRoundEffects(() => {});
    check("周期前(2ラウンド)はそのまま", battle.enemies.filter((e) => e.id === "kageboshi" && e.hp > 0).length === 1 && fieldParty.every((c) => !(c.stunTurns > 0)));
    processGimmickRoundEffects(() => {});
    check("3ラウンド周期でmaxAlive(2)まで影法師が増える", battle.enemies.filter((e) => e.id === "kageboshi" && e.hp > 0).length === 2);
    check("同じ周期で味方1人が拘束される", fieldParty.filter((c) => c.stunTurns > 0).length === 1);
    fieldParty.forEach((c) => { c.stunTurns = 0; });
    processGimmickRoundEffects(() => {});
    processGimmickRoundEffects(() => {});
    processGimmickRoundEffects(() => {});
    check("maxAlive2を超えて増えない(次周期は拘束のみ)", battle.enemies.filter((e) => e.id === "kageboshi" && e.hp > 0).length === 2);

    console.log(failed === 0 ? "✅ 全テスト通過" : `❌ ${failed}件失敗`);
    window.__failed = failed;
  }
})();
