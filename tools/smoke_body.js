// テスト本体(ゲームスクリプトと同じevalスコープで実行される。bare識別子でゲームのlet/constに触れる)
(function () {
  let failed = 0;
  function check(name, cond, detail) {
    if (cond) { console.log(`  OK ${name}`); }
    else { failed++; console.log(`  NG ${name}${detail ? " — " + detail : ""}`); }
  }

  function makeChar(id, name, classId) {
    return {
      id, name, label: name, classId, level: 5, personality: "熱血",
      hp: 40, maxHp: 40, mp: 10, maxMp: 10, atk: 10, def: 5, spd: 8,
      status: "active", fatigue: 0, fleeState: null, statMods: [],
      // 実キャラと同じ既定パッシブ一式(空オブジェクトだとeffectiveStat等がNaN/例外になる)
      passives: initPassives(), skills: [],
      stackCounters: {},
    };
  }
  fieldParty = [makeChar("c1", "テスト侍", "samurai"), makeChar("c2", "テスト忍", "ninja"), makeChar("c3", "テスト陰陽師", "onmyoji")];
  reserveFieldMember = null;

  const enemyIds = Object.keys(ENEMIES).filter((k) => ENEMIES[k] && ENEMIES[k].ja && ENEMIES[k].hp);
  const mk = (i) => instantiateEnemyById(enemyIds[i % enemyIds.length]);

  function setupBattle(enemies) {
    battle = { enemies, order: [], orderIndex: 0, actingId: null, actingEnemyId: null, goldMult: 1, justAppeared: true, omamoriUsed: {}, omikujiGuaranteedCritsLeft: 0, swapCooldown: 0, roundsTotal: 0, presence: {} };
    enemies.forEach((x) => { x.__enemyAllies = enemies; });
    pendingEnemyPick = null;
    pendingAllyPick = null;
  }

  console.log("--- フェーズ1: 敵カード差分更新 ---");
  const e1 = mk(0), e2 = mk(1), e3 = mk(2);
  setupBattle([e1, e2, e3]);
  renderBattleScreen();
  const row = document.getElementById("enemyRow");
  check("初回描画で敵カード3枚生成", row.children.length === 3, `actual=${row.children.length}`);
  check("初回はentering付き", [...row.children].every((c) => c.classList.contains("entering")));
  check("data-id対応", [...row.children].map((c) => c.dataset.id).join(",") === [e1, e2, e3].map((x) => String(x.instanceId)).join(","));
  check("HPバーが描画される", row.querySelectorAll(".hpbar-track").length === 3);
  check("名前が描画される", row.children[0].querySelector(".enemy-name").textContent === e1.label);
  check("大技タップ属性", row.children[0].querySelector(".card-portrait-img").classList.contains("enemy-bigattack-tap"));

  const cardRef1 = row.children[0];
  renderBattleScreen();
  check("再描画でカードDOMを使い回す(同一要素)", row.children[0] === cardRef1);
  check("2回目の描画でenteringが外れる", !row.children[0].classList.contains("entering"));

  e1.hp -= 15;
  e1.__shakeUntil = Date.now() + 400;
  e1.__shakeIntensity = "normal";
  delete e1.__shakeRenderedFor;
  renderBattleScreen();
  check("被弾描画で揺れクラスが付く", cardRef1.classList.contains("hit-shake") && cardRef1.classList.contains("hit-flash"));
  const fill = cardRef1.querySelector(".hpbar-fill");
  check("HPバー幅が更新される", fill && fill.style.width === (e1.hp / e1.maxHp) * 100 + "%", fill && fill.style.width);
  renderBattleScreen();
  check("同じ被弾の再描画でも揺れクラスは残る(演出を切らない、フェーズ5撤去②)", cardRef1.classList.contains("hit-shake"));
  // 次の被弾(新しい__shakeUntil)では剥がして付け直し=再発火する
  e1.__shakeUntil = Date.now() + 400;
  e1.__shakeIntensity = "strong";
  delete e1.__shakeRenderedFor;
  renderBattleScreen();
  check("新しい被弾で強度クラスが入れ替わる(再発火)", cardRef1.classList.contains("hit-shake-strong") && !cardRef1.classList.contains("hit-shake-normal"));

  battle.actingEnemyId = e2.instanceId;
  renderBattleScreen();
  check("actingが対象カードだけに付く", row.children[1].classList.contains("acting") && !row.children[0].classList.contains("acting"));
  battle.actingEnemyId = null;
  renderBattleScreen();
  check("acting解除", !row.children[1].classList.contains("acting"));

  e2.bigAttackPending = true;
  renderBattleScreen();
  check("chargingクラス", row.children[1].classList.contains("charging"));
  // 💢アイコンは2026-08-02廃止。予告は構え状態(赤オーラ+技名短冊、syncBigAttackStance)が担う
  check("構えオーラが出る", !!row.children[1].querySelector(".stance-aura"));
  check("構え短冊が出る", !!row.children[1].querySelector(".stance-tanzaku"));
  e2.bigAttackPending = false;
  renderBattleScreen();
  check("charging解除", !row.children[1].classList.contains("charging"));

  e2.poison = 3;
  renderBattleScreen();
  check("毒アイコンが出る", !!row.children[1].querySelector('.enemy-debuff-icons [data-status="poison"]'));
  e2.poison = 0;
  renderBattleScreen();
  check("毒アイコンが消える", !row.children[1].querySelector('.enemy-debuff-icons [data-status="poison"]'));

  let pickedEnemy = null;
  pendingEnemyPick = (t) => { pickedEnemy = t; };
  renderBattleScreen();
  check("targetableが生存敵に付く", [...row.children].every((c) => c.classList.contains("targetable")));
  row.children[1].dispatchEvent(new Event("click", { bubbles: true }));
  check("カードタップで対象が選ばれる", pickedEnemy === e2, String(pickedEnemy && pickedEnemy.label));
  check("タップ後にpendingEnemyPickが消える", pendingEnemyPick === null);
  battleActionLocked = false;
  renderBattleScreen();
  check("選択解除後targetableが外れる", [...row.children].every((c) => !c.classList.contains("targetable")));

  e3.hp = 0;
  renderBattleScreen();
  check("撃破でdead+defeat-hidden", row.children[2].classList.contains("dead") && row.children[2].classList.contains("defeat-hidden"));
  check("撃破でもカードは残る(並び維持)", row.children.length === 3);
  check("撃破リアクションのフラグ", e3.__defeatReactionState === "playing" || e3.__defeatReactionState === "done");
  check("死亡カードは大技タップ解除", !row.children[2].querySelector(".card-portrait-img").classList.contains("enemy-bigattack-tap"));
  pendingEnemyPick = (t) => {};
  renderBattleScreen();
  check("死亡カードはtargetableにならない", !row.children[2].classList.contains("targetable"));
  pendingEnemyPick = null;

  renderBattleScreen();
  e1.swallowedTurns = 2;
  renderBattleScreen();
  check("丸呑み中はカードが消える", row.children.length === 2 && row.children[0].dataset.id === String(e2.instanceId));
  e1.swallowedTurns = 0;
  renderBattleScreen();
  check("解放でカードが戻る(先頭位置)", row.children.length === 3 && row.children[0].dataset.id === String(e1.instanceId));
  check("解放で作り直したカードにenteringは付かない", !row.children[0].classList.contains("entering"));

  const f1 = mk(3), f2 = mk(4);
  setupBattle([f1, f2]);
  renderBattleScreen();
  check("新しい戦闘で前のカードが消える", row.children.length === 2 && [...row.children].map((c) => c.dataset.id).join(",") === `${f1.instanceId},${f2.instanceId}`);

  console.log("--- 戦闘の味方バー ---");
  const bar = document.getElementById("battlePartyBar");
  check("味方カード3枚", bar.querySelectorAll(".party-member").length === 3);
  check("味方data-id", [...bar.querySelectorAll(".party-member")].map((c) => c.dataset.id).join(",") === "c1,c2,c3");
  battle.actingId = "c2";
  renderBattleScreen();
  const c2card = bar.querySelector('.party-member[data-id="c2"]');
  check("actingId反映", c2card && c2card.classList.contains("acting"));
  check("acting-enter付与(手番切り替え)", c2card && c2card.classList.contains("acting-enter"));
  // 手番キャラのHP/MP・状態表示
  fieldParty[1].hp = 10;
  renderBattleScreen();
  const c2fill = bar.querySelector('.party-member[data-id="c2"] .hpbar-fill');
  check("味方HPバー更新", c2fill && c2fill.style.width === (10 / 40) * 100 + "%", c2fill && c2fill.style.width);
  // 味方対象選択
  let pickedAlly = null;
  pendingAllyPick = (t) => { pickedAlly = t; };
  renderBattleScreen();
  const c1card = bar.querySelector('.party-member[data-id="c1"]');
  check("味方targetable", c1card.classList.contains("targetable"));
  c1card.dispatchEvent(new Event("click", { bubbles: true }));
  check("味方タップで対象が選ばれる", pickedAlly === fieldParty[0]);
  pendingAllyPick = null;
  renderBattleScreen();
  check("味方targetable解除", !bar.querySelector('.party-member[data-id="c1"]').classList.contains("targetable"));
  // ロスト(戦闘不能=即ロスト)
  fieldParty[2].hp = 0;
  fieldParty[2].status = "lost";
  fieldParty[2].__koFxUntil = Date.now() + 60000; // KO演出(倒れ+畳み)中はカードが残る猶予
  renderBattleScreen();
  const c3card = bar.querySelector('.party-member[data-id="c3"]');
  check("KO演出中はカードが残りdeadクラス", c3card && c3card.classList.contains("dead"));
  fieldParty[2].__koFxUntil = 0;
  renderBattleScreen();
  check("KO演出後は倒れたカードが表示から消える(2026-08-01仕様)", !bar.querySelector('.party-member[data-id=\"c3\"]'));

  console.log("--- フェーズ2: 味方バー差分更新 ---");
  const c1now = bar.querySelector('.party-member[data-id="c1"]');
  renderBattleScreen();
  check("味方カードDOMを使い回す(同一要素)", bar.querySelector('.party-member[data-id="c1"]') === c1now);
  check("味方カード骨組み(ポートレート/HPバー/MPバー/名前)", !!c1now.querySelector(".card-portrait-img") && !!c1now.querySelector(":scope > .hpbar-track") && !!c1now.querySelector(":scope > .mpbar-track") && c1now.querySelector(".nm").textContent === "テスト侍");
  const domOrder = [...c1now.children].map((el) => el.className.split(" ")[0]).join(",");
  check("子要素のDOM順が従来と同じ", domOrder === "party-portrait-wrap,hpbar-track,status-icon-row,mpbar-track,nm", domOrder);

  // かばう表示
  fieldParty[0].guarding = true;
  renderBattleScreen();
  check("かばうアイコン表示", !!c1now.querySelector('.status-icon-row [data-status="guarding"]'));
  fieldParty[0].guarding = false;
  renderBattleScreen();
  check("かばうアイコン解除", !c1now.querySelector('.status-icon-row [data-status="guarding"]'));

  // 鷹バッジ
  fieldParty[0].hawkTurnsLeft = 3;
  renderBattleScreen();
  check("鷹バッジ表示", !!c1now.querySelector(":scope > .hawk-badge"));
  fieldParty[0].hawkFlightActive = true;
  renderBattleScreen();
  check("飛翔中はバッジ非表示", !c1now.querySelector(":scope > .hawk-badge"));
  fieldParty[0].hawkFlightActive = false;
  fieldParty[0].hawkTurnsLeft = 0;
  renderBattleScreen();

  // 変化の術: ポートレート差し替え+MPバー消滅+名前表記
  const portraitBefore = c1now.querySelector(".card-portrait-img");
  fieldParty[0].transformForm = "karasu";
  renderBattleScreen();
  const portraitAfter = c1now.querySelector(".card-portrait-img");
  check("変身でポートレートが差し替わる", portraitAfter !== portraitBefore && portraitAfter.getAttribute("src") === "assets/transform/karasu.png");
  check("変身中はMPバー非表示", !c1now.querySelector(":scope > .mpbar-track"));
  check("変身中の名前表記", c1now.querySelector(".nm").textContent.includes("カラス"));
  renderBattleScreen();
  check("変身継続中はポートレートを使い回す", c1now.querySelector(".card-portrait-img") === portraitAfter);
  fieldParty[0].transformForm = null;
  renderBattleScreen();
  check("変身解除でポートレートが戻る", c1now.querySelector(".card-portrait-img").getAttribute("src") !== "assets/transform/karasu.png");
  check("変身解除でMPバー復活", !!c1now.querySelector(":scope > .mpbar-track"));

  // 結界(barrierHp)のオーバーレイ
  fieldParty[0].barrierHp = 10;
  renderBattleScreen();
  check("結界オーバーレイ表示", !!c1now.querySelector(".kekkai-barrier-vfx"));
  check("結界がHPバーに統合表示", !!c1now.querySelector(".hpbar-barrier-fill"));
  fieldParty[0].barrierHp = 0;
  renderBattleScreen();
  check("結界オーバーレイ解除", !c1now.querySelector(".kekkai-barrier-vfx"));

  // ストレス立ち絵(50%超で軽度の表情に差し替わる)
  const calmSrc = c1now.querySelector(".card-portrait-img").getAttribute("src");
  fieldParty[0].fatigue = 60;
  renderBattleScreen();
  const stressedSrc = c1now.querySelector(".card-portrait-img").getAttribute("src");
  check("ストレスで立ち絵が差し替わる", stressedSrc !== calmSrc && stressedSrc === CLASS_STRESS_IMAGES.samurai.mild, stressedSrc);
  fieldParty[0].fatigue = 0;
  renderBattleScreen();
  check("ストレス回復で立ち絵が戻る", c1now.querySelector(".card-portrait-img").getAttribute("src") === calmSrc);

  // 交代: 同じ位置に別キャラのカードが入る
  const sub = makeChar("c9", "テスト控え", "samurai");
  reserveFieldMember = sub;
  const idx = fieldParty.indexOf(fieldParty[1]);
  const outgoing = fieldParty[1];
  fieldParty[idx] = sub;
  reserveFieldMember = outgoing;
  renderBattleScreen();
  const ids = [...bar.querySelectorAll(".party-member")].map((el) => el.dataset.id).join(",");
  check("交代で同じ位置に新キャラのカード(倒れたc3は表示されない)", ids === "c1,c9", ids);
  check("交代演出のセレクタでカードが引ける", !!document.querySelector('#battlePartyBar .party-member[data-id="c9"]'));

  // 式神召喚: 4枚目のカードが末尾に追加される(実イラスト無し=絵文字ポートレート)
  const shiki = { id: "shiki1", name: "紙人形", label: "紙人形", isShikigami: true, emoji: "🎎", iconImg: null, hp: 15, maxHp: 15, mp: 0, maxMp: 0, atk: 8, def: 3, spd: 7, status: "active", fatigue: 0, fleeState: null, statMods: [], passives: {}, stackCounters: {} };
  fieldParty.push(shiki);
  renderBattleScreen();
  const shikiCard = bar.querySelector('.party-member[data-id="shiki1"]');
  check("式神カードが末尾に追加", !!shikiCard && bar.lastElementChild === shikiCard);
  check("式神は絵文字ポートレート", !!shikiCard.querySelector(".shikigami-emoji-portrait"));
  check("式神はMPバー無し", !shikiCard.querySelector(":scope > .mpbar-track"));
  // 式神消滅
  fieldParty.pop();
  renderBattleScreen();
  check("式神カードが消える", !bar.querySelector('.party-member[data-id="shiki1"]'));

  // 逃走離脱: 戦闘バーからカードが消える
  fieldParty[0].fleeState = "fled";
  renderBattleScreen();
  check("逃走した仲間のカードが消える", !bar.querySelector('.party-member[data-id="c1"]'));
  fieldParty[0].fleeState = null;
  renderBattleScreen();
  check("逃走状態解除でカードが戻る(先頭位置)", bar.children[0] && bar.children[0].dataset.id === "c1");

  console.log("--- フェーズ3: 探索/野営バー ---");
  const dbar = document.getElementById("dungeonPartyBar");
  renderPartyBar("dungeonPartyBar", visibleFieldParty());
  // c3は上でロスト済み → 探索バーには並ばない
  const dids = [...dbar.querySelectorAll(".party-member")].map((el) => el.dataset.id).join(",");
  check("探索バーはロストを除外して描画", dids === "c1,c9", dids);
  const dcard = dbar.querySelector('.party-member[data-id="c1"]');
  renderPartyBar("dungeonPartyBar", visibleFieldParty());
  check("探索バーもカードを使い回す", dbar.querySelector('.party-member[data-id="c1"]') === dcard);
  const cbar = document.getElementById("campPartyBar");
  renderPartyBar("campPartyBar", visibleFieldParty());
  check("野営バーも描画される", cbar.querySelectorAll(".party-member").length === 2);
  check("3画面に同じキャラのカードが並存(findVisibleCard前提の維持)", document.querySelectorAll('.party-member[data-id="c1"]').length === 3);

  console.log("--- 交代/回復UX改修(2026-07-26) ---");
  // 状態をリセットして仕切り直し
  fieldParty = [makeChar("d1", "藤乃", "samurai"), makeChar("d2", "紅葉", "onmyoji"), makeChar("d3", "咲乃", "hunter")];
  reserveFieldMember = makeChar("d4", "控え丸", "priest");
  battle = null; pendingAllyPick = null; pendingEnemyPick = null;

  // バグ修正: イベント等の一括disabled後、renderDungeonで交代ボタンが再有効化される
  DUNGEON_BOTTOM_BTN_IDS.forEach((id) => { document.getElementById(id).disabled = true; });
  renderDungeon();
  const swapBtn = document.getElementById("dungeonSwapBtn");
  check("交代ボタンが再有効化される(グレーアウト恒久化バグの修正)", swapBtn.disabled === false);
  check("交代ボタンが表示されている", swapBtn.style.display !== "none");

  // 探索の交代ピッカー: 控えカード(コンパクト)+「やめる」だけの最小構成
  swapBtn.dispatchEvent(new Event("click", { bubbles: true }));
  const dpicker = document.getElementById("dungeonTargetPicker");
  check("交代ピッカーに控えカードが出る", !!dpicker.querySelector(".reserve-status-card.compact"));
  check("控えカードに戦闘準拠のHPバー", !!dpicker.querySelector(".reserve-status-card .hpbar-track .hpbar-fill"));
  check("控えカードに戦闘準拠のMPバー", !!dpicker.querySelector(".reserve-status-card .mpbar-track .mpbar-fill"));
  check("控えカードにポートレート", !!dpicker.querySelector(".reserve-status-card .card-portrait-img"));
  check("ピッカーのボタンは「やめる」だけ", [...dpicker.querySelectorAll("button")].map((b) => b.textContent).join(",") === "やめる");
  // 交代相手は本隊カードの直接タップで選ぶ
  const swapBar = document.getElementById("dungeonPartyBar");
  check("本隊カードがtargetableになる", swapBar.querySelector('.party-member[data-id="d2"]').classList.contains("targetable"));
  swapBar.querySelector('.party-member[data-id="d2"]').dispatchEvent(new Event("click", { bubbles: true }));
  check("カードタップで交代が成立する", fieldParty.map((c) => c.id).join(",") === "d1,d4,d3" && reserveFieldMember.id === "d2");
  // 式神カードのタップでは交代しないガード
  const shiki2 = { id: "sk2", name: "紙人形", label: "紙人形", isShikigami: true, emoji: "🎎", iconImg: null, hp: 15, maxHp: 15, mp: 0, maxMp: 0, atk: 8, def: 3, spd: 7, status: "active", fatigue: 0, fleeState: null, statMods: [], passives: {}, stackCounters: {} };
  fieldParty.push(shiki2);
  swapBtn.dispatchEvent(new Event("click", { bubbles: true }));
  swapBar.querySelector('.party-member[data-id="sk2"]').dispatchEvent(new Event("click", { bubbles: true }));
  check("式神タップでは交代せず選択継続", typeof pendingAllyPick === "function" && reserveFieldMember.id === "d2");
  swapBar.querySelector('.party-member[data-id="d1"]').dispatchEvent(new Event("click", { bubbles: true }));
  check("続けて本隊タップで交代成立", reserveFieldMember.id === "d1");
  fieldParty.splice(fieldParty.indexOf(shiki2), 1);
  // 後続テストの前提(fieldParty=d1,d4,d3 / reserve=d2)に戻す
  renderDungeon();
  swapBtn.dispatchEvent(new Event("click", { bubbles: true }));
  swapBar.querySelector('.party-member[data-id="d2"]').dispatchEvent(new Event("click", { bubbles: true }));
  check("状態復元(reserve=d2)", reserveFieldMember.id === "d2" && fieldParty.map((c) => c.id).join(",") === "d1,d4,d3");

  // 探索の回復対象に控えが出る
  state.inventory = state.inventory || {};
  state.inventory.potion = 2;
  pickDungeonAllyTarget("誰に使う?", () => {});
  check("探索の回復対象に控えボタンが出る", [...dpicker.querySelectorAll("button")].some((b) => b.textContent.startsWith("控え:紅葉")));
  let healedDungeon = null;
  pendingAllyPick = null; closeDungeonTargetPicker();
  pickDungeonAllyTarget("誰に使う?", (t) => { healedDungeon = t; });
  dpicker.querySelector('button[data-target-id="d2"]').dispatchEvent(new Event("click", { bubbles: true }));
  check("探索で控えを回復対象に選べる", healedDungeon && healedDungeon.id === "d2");

  // 戦闘の回復対象選択: 3列グリッド+控えが2行目左端(左下)
  const be1 = mk(5), be2 = mk(6);
  setupBattle([be1, be2]);
  renderBattleScreen();
  renderAllyTargets(fieldParty[0], "potion");
  const agrid = document.getElementById("actionGrid");
  check("回復対象選択が3列グリッド", agrid.style.gridTemplateColumns === "1fr 1fr 1fr", agrid.style.gridTemplateColumns);
  const cells = [...agrid.children].map((el) => el.tagName === "BUTTON" ? el.textContent : "(空)");
  check("1行目=本隊3人(交代後の編成d1,d4,d3)", cells[0].startsWith("藤乃") && cells[1].startsWith("控え丸") && cells[2].startsWith("咲乃"), cells.join(" | "));
  check("控えが4セル目(左下)に出る", cells[3] && cells[3].startsWith("控え:紅葉"), cells[3]);
  check("戻るが控えの隣", cells[4] === "戻る", cells[4]);
  // 控えを選ぶと回復が走る
  reserveFieldMember.hp = 20;
  const btnReserve = [...agrid.querySelectorAll("button")].find((b) => b.textContent.startsWith("控え:"));
  btnReserve.dispatchEvent(new Event("click", { bubbles: true }));
  check("戦闘中に控えへ回復薬が使える(HPが増える)", reserveFieldMember.hp > 20, `hp=${reserveFieldMember.hp}`);

  // 鷹の身代わり(hawkGuard)は控えを対象に出さない
  battleActionLocked = false;
  renderAllyTargets(fieldParty[0], "hawkGuard");
  check("hawkGuardの対象に控えが出ない", ![...agrid.querySelectorAll("button")].some((b) => b.textContent.startsWith("控え:")));
  pendingAllyPick = null;

  // 戦闘の交代確認ダイアログも新カード
  battleActionLocked = false;
  battle.swapCooldown = 0;
  showSwapConfirmDialog(fieldParty[0]);
  check("戦闘の交代ダイアログに新カード", !!document.getElementById("genericConfirmExtra").querySelector(".reserve-status-card"));

  console.log("--- かばう×大技の修正 ---");
  const origRandom = Math.random;
  // 初回98%/2人目以降95%
  const guard1 = fieldParty[0];
  guard1.guarding = true; guard1.guardProtectCount = 0;
  Math.random = () => 0.96; // 98%なら成功、95%なら失敗になる境界値
  check("初回の身代わりは96%ロールでも成功(98%)", findGuardTarget(fieldParty) === guard1);
  guard1.guardProtectCount = 1;
  check("2人目以降は96%ロールで失敗(95%)", findGuardTarget(fieldParty) === null);
  guard1.guarding = false; guard1.guardProtectCount = 0;

  // 予告済み大技へのかばう割り込み(修正の本丸)
  const bigEnemy = mk(8);
  bigEnemy.bigAttack = { name: "テスト大技", mult: 1.2 };
  bigEnemy.extraBigAttacks = null;
  bigEnemy.accuracy = 1.5; // 命中を確定させてテストを決定的にする
  setupBattle([bigEnemy]);
  bigEnemy.bigAttackPending = true;
  fieldParty.forEach((c) => { c.guarding = false; });
  Math.random = () => 0; // 抽選を先頭固定
  commitBigAttackTelegraphTarget(bigEnemy, fieldParty);
  check("予告対象が確定する", bigEnemy.bigAttackTelegraphTargetId === fieldParty[0].id);
  // 予告の後にタンク(3人目)がかばう → 発動時に引きつけが優先される
  const tank = fieldParty[2];
  tank.guarding = true; tank.guardProtectCount = 0;
  const hpMarked = fieldParty[0].hp, hpTank = tank.hp;
  Math.random = () => 0.5; // 引きつけ成功・命中・構えは解除側
  const bigResults = enemyBigAttack(bigEnemy, fieldParty, () => {});
  check("大技がかばい手に引きつけられる", bigResults.length === 1 && bigResults[0].target === tank, bigResults[0] && bigResults[0].target && String(bigResults[0].target.id));
  check("予告対象は無傷でかばい手が受ける", fieldParty[0].hp === hpMarked && tank.hp < hpTank, `marked=${fieldParty[0].hp}/${hpMarked} tank=${tank.hp}/${hpTank} result=${JSON.stringify({ hit: bigResults[0].hit, dmg: bigResults[0].dmg })} enemyAtk=${bigEnemy.atk}`);
  tank.guarding = false;

  // 水月の強制ターゲットで確定した予告は、かばうでも上書きされない
  const bigEnemy2 = mk(9);
  bigEnemy2.bigAttack = { name: "テスト大技2", mult: 1.2 };
  bigEnemy2.extraBigAttacks = null;
  bigEnemy2.accuracy = 1.5;
  setupBattle([bigEnemy2]);
  bigEnemy2.bigAttackPending = true;
  bigEnemy2.forcedTargetId = fieldParty[1].id;
  bigEnemy2.forcedTargetTurns = 2;
  Math.random = () => 0;
  commitBigAttackTelegraphTarget(bigEnemy2, fieldParty);
  check("強制ターゲットが予告対象になる", bigEnemy2.bigAttackTelegraphTargetId === fieldParty[1].id && bigEnemy2.bigAttackTelegraphForced === true);
  fieldParty[2].guarding = true; fieldParty[2].guardProtectCount = 0;
  Math.random = () => 0.5;
  const bigResults2 = enemyBigAttack(bigEnemy2, fieldParty, () => {});
  check("強制ターゲット中はかばうで引きつけない", bigResults2.length === 1 && bigResults2[0].target === fieldParty[1]);
  fieldParty[2].guarding = false;
  Math.random = origRandom;

  console.log(failed === 0 ? "\n全チェック通過" : `\n${failed}件失敗`);
  window.__failed = failed;
})();
