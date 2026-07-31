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
    runWarawanuCase();
  }

  // H: 笑わぬ祭の面売り(第3号)。データ整合+三面替え(formCycle: 狐→般若→翁の固定順、
  // 狐=2回攻撃/般若=構え→予告→全体大技/翁=召喚+取り巻き軽減)+笑わぬ祭(hpBelow50%)+
  // ルートBGM+フレームレス表示を検証する
  function runWarawanuCase() {
    console.log("--- H: 笑わぬ祭の面売り(三面替え/笑わぬ祭/BGM/フレームレス) ---");
    const qDef3 = QUEST_DEFS.hyakumenshi_utsuro;
    const route3 = QUEST_ROUTE_DEFS.warawanu_matsuri;
    check("依頼がルートに紐付く", !!qDef3 && qDef3.route === "warawanu_matsuri" && !!route3);
    check("ボスは最終層に配置", qDef3.targetFloor === route3.totalFloors);
    check("区間4つ・fromFloor昇順・敵IDが実在", route3.segments.length === 4 && route3.segments.every((s, i) => (i === 0 || s.fromFloor > route3.segments[i - 1].fromFloor) && (s.enemies || []).every((id) => !!ENEMIES[id])));
    check("背景セット4つがBG_SETSに登録済み", route3.segments.every((s) => !!BG_SETS[s.bg]));
    const boss3 = ENEMIES.hyakumenshi_utsuro;
    check("ボスの口上4行・ギミックメモ2件・回想なし", boss3.preBattleLines.length === 4 && boss3.gimmickNotes.length === 2 && !boss3.soulStory);
    check("構造化ギミック2件(三面替え+笑わぬ祭)", boss3.gimmicks.length === 2 && boss3.gimmicks[0].effects[0].type === "formCycle" && boss3.gimmicks[1].trigger.type === "hpBelow");
    check("大技は全体攻撃で自前サイクルは実質無効(般若面専用)", boss3.bigAttack.aoe === true && boss3.bigAttackCycle.min === 99);
    check("面かぶり/うつろは通常抽選に出ない", ENEMIES.menkaburi.questOnly && ENEMIES.menkaburi.maxFloor === 0 && boss3.questOnly && boss3.maxFloor === 0);
    check("ルートBGMキーが実在する", route3.bgm === "warawanu_matsuri" && !!BGM_TRACKS.warawanu_matsuri);

    // フレームレス表示: ボスのカードだけ箱の見た目を外すクラスが付く
    const cardBoss = createEnemyCard(instantiateEnemyById("hyakumenshi_utsuro"));
    const cardNormal = createEnemyCard(instantiateEnemyById("menkaburi"));
    check("ボスのカードにframelessクラス", cardBoss.classList.contains("frameless"));
    check("通常敵のカードには付かない", !cardNormal.classList.contains("frameless"));

    // ルートBGM: 探索も戦闘も同じキーが選ばれ、戦闘終了で止まらない
    currentStage = "questroute";
    currentQuestRouteId = "warawanu_matsuri";
    check("questRouteBgmKeyがルート曲を返す", questRouteBgmKey() === "warawanu_matsuri");
    makeParty();
    const bossBgm = instantiateEnemyById("hyakumenshi_utsuro");
    battle = { enemies: [bossBgm], order: [], orderIndex: 0, actingId: null, actingEnemyId: null, goldMult: 1, justAppeared: true, omamoriUsed: {}, omikujiGuaranteedCritsLeft: 0, swapCooldown: 0, roundsTotal: 0, presence: {} };
    playBattleBgm();
    check("ボス戦でもルート曲が流れる(ボス曲より優先)", currentBgmKey === "warawanu_matsuri");
    stopBattleBgm();
    check("戦闘終了でもルート曲は止まらない", currentBgmKey === "warawanu_matsuri");
    currentStage = "forest";
    currentQuestRouteId = null;
    check("ルートを離れるとルート曲キーは選ばれない", questRouteBgmKey() === null);

    // 三面替え: 発動→狐面、2ラウンドごとに般若→翁→狐の固定順
    makeParty();
    const b3 = instantiateEnemyById("hyakumenshi_utsuro");
    battle = { enemies: [b3], order: [], orderIndex: 0, actingId: null, actingEnemyId: null, goldMult: 1, justAppeared: true, omamoriUsed: {}, omikujiGuaranteedCritsLeft: 0, swapCooldown: 0, roundsTotal: 0, presence: {} };
    b3.__enemyAllies = [b3];
    initBattleGimmicks();
    renderBattleScreen();
    processGimmickTriggers();
    check("開幕で三面替えが発動し狐面になる", b3.__formId === "kitsune" && b3.__formAttacks === 2 && b3.__formAttackMult === 0.6);
    battle.roundsTotal = 1;
    processGimmickRoundEffects(() => {});
    check("1ラウンドでは面は替わらない", b3.__formId === "kitsune");
    processGimmickRoundEffects(() => {});
    check("2ラウンド周期で般若面へ(構えフラグが立ち連続攻撃は解除)", b3.__formId === "hannya" && b3.__formBigAttackStance === true && !b3.__formAttacks);
    processGimmickRoundEffects(() => {});
    processGimmickRoundEffects(() => {});
    check("さらに2ラウンドで翁面へ+面かぶり1体召喚", b3.__formId === "okina" && battle.enemies.filter((e) => e.id === "menkaburi" && e.hp > 0).length === 1);
    b3.statMods = [];
    battle.roundsTotal = 2; // 実ゲームではラウンドごとに増える(軽減の掛け直しは1ラウンド1回ガードがある)
    processGimmickRoundEffects(() => {});
    check("翁面中は取り巻きが居る間だけ被ダメ軽減", b3.statMods.filter((m) => m.stat === "dmgTaken" && m.mult === 0.7).length === 1);
    battle.enemies.forEach((e) => { if (e.id === "menkaburi") e.hp = 0; });
    b3.statMods = [];
    processGimmickRoundEffects(() => {});
    check("翁面から狐面へ一巡する(取り巻き全滅で軽減なし)", b3.__formId === "kitsune" && !b3.statMods.some((m) => m.stat === "dmgTaken"));

    // 笑わぬ祭: HP50%未満で一度だけ発動、面かぶり2体即時召喚+生存中の被ダメ軽減(翁面と同一ラウンド重複なし)
    b3.hp = Math.floor(b3.maxHp * 0.4);
    processGimmickTriggers();
    const waraEntry = battle.gimmicks.find((g) => g.def.id === "warawanu");
    check("HP50%未満で笑わぬ祭が発動+面かぶり2体", waraEntry.active && battle.enemies.filter((e) => e.id === "menkaburi" && e.hp > 0).length === 2);
    check("台詞がログに出る", battleLogLines.some((l) => l.includes("顔を失くせば、何も悲しまずに済む")));
    b3.statMods = [];
    battle.roundsTotal = 10;
    processGimmickRoundEffects(() => {});
    check("軽減は翁面と重複せず1本だけ掛かる", b3.statMods.filter((m) => m.stat === "dmgTaken").length === 1);
    battle.enemies.forEach((e) => { if (e.id === "menkaburi") e.hp = 0; });
    b3.statMods = [];
    battle.roundsTotal = 11;
    processGimmickRoundEffects(() => {});
    check("面かぶり全滅で軽減が解除される", !b3.statMods.some((m) => m.stat === "dmgTaken"));
    battle.roundsTotal = 12;
    processGimmickRoundEffects(() => {});
    check("周期補充で面かぶりが戻る(上限3)", battle.enemies.filter((e) => e.id === "menkaburi" && e.hp > 0).length >= 2 && battle.enemies.filter((e) => e.id === "menkaburi" && e.hp > 0).length <= 3);

    runWarawanuTurnCase();
  }

  // H続き: 実際の手番処理(processNext)で狐面の2回攻撃と般若面の構え→全体大技を通しで検証する
  function runWarawanuTurnCase() {
    makeParty();
    const b = instantiateEnemyById("hyakumenshi_utsuro");
    battle = { enemies: [b], order: [], orderIndex: 0, actingId: null, actingEnemyId: null, goldMult: 1, justAppeared: true, omamoriUsed: {}, omikujiGuaranteedCritsLeft: 0, swapCooldown: 0, roundsTotal: 1, presence: {} };
    b.__enemyAllies = [b];
    battle.gimmicks = []; // 周期切り替えを止め、形態フラグを手動で固定して手番だけを検証する
    renderBattleScreen();
    // 狐面: 2回攻撃+1発あたり0.6倍
    b.__formId = "kitsune"; b.__formAttacks = 2; b.__formAttackMult = 0.6;
    let atkCalls = 0; let atkMultSeen = null;
    const origEnemyAttack = enemyAttack;
    enemyAttack = function (enemy, targets, log, opts) {
      atkCalls++; atkMultSeen = opts && opts.atkMult;
      return origEnemyAttack(enemy, targets, log, opts);
    };
    battle.order = [b];
    battle.orderIndex = 0;
    processNext();
    const waitFox = setInterval(() => {
      if (atkCalls < 2) return;
      clearInterval(waitFox);
      enemyAttack = origEnemyAttack;
      check("狐面は1手番で2回攻撃する", atkCalls === 2);
      check("1発あたりの攻撃力は0.6倍で渡る", atkMultSeen === 0.6);
      // 般若面: 構えの手番は攻撃せず予告だけ→次の手番で全体大技
      makeParty();
      const b2 = instantiateEnemyById("hyakumenshi_utsuro");
      battle = { enemies: [b2], order: [b2], orderIndex: 0, actingId: null, actingEnemyId: null, goldMult: 1, justAppeared: true, omamoriUsed: {}, omikujiGuaranteedCritsLeft: 0, swapCooldown: 0, roundsTotal: 1, presence: {} };
      b2.__enemyAllies = [b2];
      battle.gimmicks = [];
      renderBattleScreen();
      b2.__formBigAttackStance = true;
      const hpBeforeStance = fieldParty.map((c) => c.hp);
      processNext();
      const waitStance = setInterval(() => {
        if (!b2.bigAttackPending) return;
        clearInterval(waitStance);
        check("構えの手番は攻撃せず予告が立つ", fieldParty.every((c, i) => c.hp === hpBeforeStance[i]) && b2.bigAttackCountdown === 0);
        check("予告がログに出る(技名つき)", battleLogLines.some((l) => l.includes("般若の面の奥で息を溜めている") && l.includes("般若百鬼")));
        battle.order = [b2];
        battle.orderIndex = 0;
        processNext();
        const waitBig = setInterval(() => {
          const damaged = fieldParty.filter((c, i) => c.hp < hpBeforeStance[i]).length;
          if (damaged < 2) return; // 全体大技: 回避を考慮して3人中2人以上の被弾で判定
          clearInterval(waitBig);
          check("次の手番で全体大技が発動する", true);
          check("発動後は自前サイクルに戻る(次の大技は再び般若面待ち)", b2.bigAttackCountdown >= 90);
          runWasureyuCase();
        }, 120);
      }, 120);
    }, 120);
  }

  // I: 帰らずの湯治宿(第4号)。データ整合+湯加減(formCycle: ぬる湯=自己回復/煮え湯=全体場ダメージ)+
  // 静かな宿の客(hpBelow55%召喚)+新美術基準のframeless表示を検証する
  function runWasureyuCase() {
    console.log("--- I: 帰らずの湯治宿(湯加減/召喚/frameless) ---");
    const qDef4 = QUEST_DEFS.wasureyu_oshira;
    const route4 = QUEST_ROUTE_DEFS.kaerazu_tojiyado;
    check("依頼がルートに紐付く", !!qDef4 && qDef4.route === "kaerazu_tojiyado" && !!route4);
    check("ボスは最終層・区間4つ・敵ID実在・BG登録済み", qDef4.targetFloor === route4.totalFloors && route4.segments.length === 4 && route4.segments.every((s) => !!BG_SETS[s.bg] && (s.enemies || []).every((id) => !!ENEMIES[id])));
    const boss4 = ENEMIES.wasureyu_oshira;
    check("口上4行・提案メモ2件・回想なし", boss4.preBattleLines.length === 4 && boss4.gimmickNotes.length === 2 && !boss4.soulStory);
    check("ボスと湯浸りは新基準のframeless", boss4.frameless === true && ENEMIES.yubitari.frameless === true);
    check("ルートBGMキーが実在する", route4.bgm === "kaerazu_tojiyado" && !!BGM_TRACKS.kaerazu_tojiyado);
    check("湯浸り/お白は通常抽選に出ない", ENEMIES.yubitari.questOnly && ENEMIES.yubitari.maxFloor === 0 && boss4.questOnly && boss4.maxFloor === 0);

    makeParty();
    const b = instantiateEnemyById("wasureyu_oshira");
    battle = { enemies: [b], order: [], orderIndex: 0, actingId: null, actingEnemyId: null, goldMult: 1, justAppeared: true, omamoriUsed: {}, omikujiGuaranteedCritsLeft: 0, swapCooldown: 0, roundsTotal: 0, presence: {} };
    b.__enemyAllies = [b];
    initBattleGimmicks();
    renderBattleScreen();
    processGimmickTriggers();
    check("開幕で湯加減が発動しぬる湯になる", b.__formId === "nuruyu");
    b.hp = Math.floor(b.maxHp * 0.8);
    const hpBefore = b.hp;
    battle.roundsTotal = 1;
    processGimmickRoundEffects(() => {});
    check("ぬる湯の間は毎ラウンド自己回復する", b.hp > hpBefore);
    const partyHp1 = fieldParty.map((c) => c.hp);
    battle.roundsTotal = 2;
    processGimmickRoundEffects(() => {});
    check("2ラウンド周期で煮え湯へ", b.__formId === "nieyu");
    battle.roundsTotal = 3;
    const bossHpAtNieyu = b.hp;
    processGimmickRoundEffects(() => {});
    check("煮え湯の間は味方全員が場ダメージを受ける", fieldParty.every((c, i) => c.hp < partyHp1[i]));
    check("煮え湯の間は回復しない", b.hp === bossHpAtNieyu);
    battle.roundsTotal = 4;
    processGimmickRoundEffects(() => {});
    check("一巡してぬる湯へ戻る", b.__formId === "nuruyu");
    b.hp = Math.floor(b.maxHp * 0.5);
    processGimmickTriggers();
    check("HP55%未満で湯浸りが1体召喚される", battle.enemies.filter((e) => e.id === "yubitari" && e.hp > 0).length === 1);

    console.log(failed === 0 ? "✅ 全テスト通過" : `❌ ${failed}件失敗`);
    window.__failed = failed;
  }
})();
