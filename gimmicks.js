// ============ gimmicks.js: ボスギミック機構(2026-07-31新設) ============
// ENEMIES[id].gimmicks(構造化データ)を読み、戦闘中の「トリガー→効果発動」を汎用的に処理する。
// enemy_editor.htmlのギミック欄(gimmickNotes、自由記述)はユーザーの設計メモであり、エンジンは一切読まない。
// 運用ループ: ユーザーがエディターにメモを書く→JSONエクスポート→Claudeがメモを読んで
// この機構のtrigger/effectsの形へ翻訳しdata.jsへ実装→タイトルの「ボステスト」で発火を検証する。
//
// ---- データ契約 ----
// gimmicks: [{ id, name, trigger, announce, effects: [...] }] (1体に複数可。発動は1戦闘につき各1回)
// trigger:
//   { type: "hpBelow", ratio: 0.5 }  … 持ち主のHPがこの割合を下回った直後のターンの節目に発動
//   { type: "battleStart" }          … 戦闘開始直後(最初の手番の前)に発動
//   { type: "round", round: N }      … Nラウンド目に入った時に発動
// effects(発動時に一度だけ適用されるもの/発動後ラウンドごとに繰り返すものが混在できる):
//   { type: "overlay", key: "blaze"|"onibi" }
//       … 戦闘背景の上にCSSの場演出(battle.cssの#battleGimmickOverlay .gimmick-◯◯)を重ねる。
//         専用背景画像が用意できるまでの代用も兼ねる(画像ができたらbg効果へ差し替えるだけ)
//   { type: "bg", image: "assets/bg/xxx.jpg" }
//       … 戦闘背景そのものを1枚絵へ差し替える(同一構図の昼/炎上差分など。時間帯無視で固定)
//   { type: "fieldDamage", every: N, pctMaxHp: 0.06, min: 3, name: "業火" }
//       … 発動後、Nラウンドごとのラウンドの節目に、味方全員へ最大HP割合の場ダメージ
//         (ポケモンの天候ダメージのイメージ。敵の行動権を消費せず、防御・かばうも無視)
//   { type: "fieldInflict", every: N, name: "業火", inflict: { type: "burn", turnsMin: 2, turnsMax: 3 } }
//       … 発動後、Nラウンドごとに味方全員へ状態異常を付与する(火車の「4ターンに一度全体炎上」用)。
//         inflictの中身はresolveDebuffEffect(engine.js)がそのまま解釈するので、大技のdebuffと同じ書式で
//         burn以外(poison/bleed/stun等)も指定できる。免疫(statusImmuneTurns)や御守ガードも通常どおり効く
//   { type: "summon", every: N, enemyId, count, maxAlive, immediate, text }
//       … 発動後、Nラウンドごとに雑魚(enemyId)をcount体召喚。場にいる同種の生存数がmaxAliveに
//         達している分は湧かない。immediate:trueなら発動した瞬間にも1回召喚する
//   { type: "bindOne", every: N, turns: 1, name: "花婿の赤緒", text: "…{target}…" }
//       … 発動後、Nラウンドごとに味方1人をランダムに拘束(スタン扱い、行動不能)する。
//         行動阻害系ギミックの汎用形(雨嫁・白縫の赤い組紐用に新設、2026-07-31)。textの{target}は対象名に置換
//   { type: "dmgTakenWhileMinions", mult: 0.7 }
//       … 自分以外の敵(取り巻き)が場に生きている間、持ち主の被ダメージを軽減し続ける
//         (毎ラウンド掛け直しのdmgTaken statMod。取り巻きを先に倒せば素通しになる)
//   { type: "formCycle", every: N, forms: [ { id, name, announce, ...形態効果 } ] }
//       … 発動時に先頭の形態になり、以後Nラウンドごとに固定順で次の形態へ替わる(末尾の次は先頭へ)。
//         百面師・うつろの「三面替え」用に新設(2026-07-31)。形態効果は次の3種を組み合わせる:
//         attacks/attackMult … 通常攻撃がattacks回の連続攻撃になり、1発あたりの攻撃力がattackMult倍(狐面)
//         bigAttackStance … 形態になった後の最初の手番は攻撃せず「構え」(既存の大技予告と同じ表示)だけを行い、
//                            次の手番で持ち主のbigAttack(全体大技)が発動する(般若面。予告→対策の間が必ず1手番ある)
//         summon/dmgTakenWhileMinionsMult … 形態になった瞬間に雑魚を召喚し、この形態の間は取り巻きが
//                            生きている限り被ダメ軽減を掛け直す(翁面)。軽減はgimmickApplyMinionShield経由で
//                            他ギミック(笑わぬ祭のdmgTakenWhileMinions)と同一ラウンド内で重複しない
//         regenPctMaxHp … この形態の間、毎ラウンド持ち主が最大HP割合ぶん回復する(お白の「ぬる湯」用、2026-08-01)
//         fieldDamagePctMaxHp/fieldDamageMin/fieldDamageName … この形態の間、毎ラウンド味方全員へ
//                            最大HP割合の場ダメージ(お白の「煮え湯」用。既存fieldDamage効果の形態内蔵版)
//
// 呼び出し側(battle.js)のフック:
//   startBattle → initBattleGimmicks()(戦闘ごとの状態初期化+場演出のリセット)
//   processNext冒頭 → processGimmickTriggers()(毎手番の節目にトリガー判定)
//   nextRoundのラウンドの節目 → processGimmickRoundEffects(continueRound)(周期効果の解決)
//   clearBattleTransientForms → clearGimmickBattleFx()(戦闘終了時の場演出解除)

// 戦闘背景のギミック上書きURL(ui.js updateSceneBackgroundsが最優先で参照する)は
// ui.js側でlet gimmickBattleBgUrlとして宣言済み(スクリプト読み込み順の都合)

function gimmickOverlayEl() {
  return document.getElementById("battleGimmickOverlay");
}

// 戦闘ごとの状態初期化。battle.gimmicksに「敵インスタンス×ギミック定義」の実行状態を積む
function initBattleGimmicks() {
  if (!battle) return;
  battle.gimmicks = [];
  battle.enemies.forEach((e) => {
    (e.gimmicks || []).forEach((def) => {
      battle.gimmicks.push({ owner: e, def, active: false, roundsSinceActive: 0 });
    });
  });
  initSecondFormState(); // ボス第二形態(secondForm)の発火状態も戦闘ごとに初期化する
  clearGimmickBattleFx();
}

// 場演出(オーバーレイ/背景差し替え)を解除する。戦闘開始時と戦闘終了時(勝利/敗北/逃走/ボス逃走=
// clearBattleTransientForms)の両方から呼ばれる二重保険
function clearGimmickBattleFx() {
  gimmickBattleBgUrl = null;
  const el = gimmickOverlayEl();
  if (el) el.className = "";
}

function gimmickTriggerMet(entry) {
  const t = entry.def.trigger || {};
  if (t.type === "hpBelow") return entry.owner.hp > 0 && entry.owner.hp / entry.owner.maxHp < (t.ratio != null ? t.ratio : 0.5);
  if (t.type === "battleStart") return true;
  if (t.type === "round") return (battle.roundsTotal || 0) >= (t.round || 1);
  // secondForm: 自力では発動しない。第二形態シーケンス(maybeStartSecondFormSequence)の締めで
  // activateGimmickEntryが直接発動させる(HP判定はsecondForm側が一元管理=二重発動の根絶)
  if (t.type === "secondForm") return false;
  return false;
}

// 毎手番の節目(processNext冒頭)に呼ばれる。未発動のギミックのトリガーを判定し、
// 満たしていれば発動(告知ログ+場演出+即時召喚)する。持ち主が倒れていたら発動しない
function processGimmickTriggers() {
  if (!battle || !battle.gimmicks) return;
  battle.gimmicks.forEach((entry) => {
    if (entry.active || entry.owner.hp <= 0) return;
    if (!gimmickTriggerMet(entry)) return;
    // hpBelowギミックの発動=第二形態相当(2026-08-01ユーザー指定)。二段構成BGMの対象ボスなら
    // ここで導入曲→本命曲(yokai_no_shutai)へ頭出しで切り替える(正式なsecondForm定義を持つボスは
    // この経路には来ず、maybeStartSecondFormSequenceがフル演出付きで切り替える)
    if (entry.def.trigger && entry.def.trigger.type === "hpBelow" && typeof playBossClimaxBgm === "function") playBossClimaxBgm();
    activateGimmickEntry(entry);
    renderBattleScreen();
  });
}
// ギミック発動の実体(告知+場演出+即時効果)。通常トリガー(processGimmickTriggers)と
// 第二形態シーケンス(maybeStartSecondFormSequence、trigger:"secondForm"のギミックを直接発動)の共通部
function activateGimmickEntry(entry) {
  entry.active = true;
  entry.roundsSinceActive = 0;
  if (entry.def.announce) blog(entry.def.announce);
  else blog(`${entry.owner.label}の【${entry.def.name || "ギミック"}】が発動した！`);
  triggerWarningFlash();
  playSfx("big_attack_warning");
  (entry.def.effects || []).forEach((eff) => {
    if (eff.type === "overlay") {
      const el = gimmickOverlayEl();
      if (el) el.className = "gimmick-" + eff.key;
    } else if (eff.type === "bg") {
      gimmickBattleBgUrl = eff.image;
      updateSceneBackgrounds();
    } else if (eff.type === "summon" && eff.immediate) {
      gimmickDoSummon(eff, entry.owner);
    } else if (eff.type === "formCycle") {
      entry.formIndex = 0; // 発動と同時に先頭の形態(狐面)になる
      gimmickApplyForm(entry, eff);
    }
  });
}

// ============ ボス第二形態(secondForm、2026-08-01) ============
// ENEMIES[boss].secondForm = { hpBelow, lines, image, bg, gimmickId } を持つボスは、HPが閾値(既定50%)を
// 切った直後の手番の節目に、以下のフルシーケンスを一度だけ実行する(K1指定の流れ2026-08-01):
//   現在の行動演出完了→導入BGM停止(無音)→第二形態口上(タップ送り)→怒り背景+怒り形態絵へ切替→
//   口上明けに本命BGM(yokai_no_shutai)開始→怒り限定ギミック(trigger:"secondForm")発動
// battle.jsのprocessNext冒頭から呼ばれ、開始したらtrueを返す(呼び出し元は進行を止め、onDoneで再開する)
function initSecondFormState() {
  if (!battle) return;
  battle.secondForm = null;
  battle.enemies.forEach((e) => {
    if (e.secondForm && !battle.secondForm) battle.secondForm = { owner: e, def: e.secondForm, fired: false };
  });
}
// シーケンスは「案3改: 暗転からの解放」(mock_phase2_transition.htmlでユーザー採用2026-08-01):
// 導入BGM停止→0.4秒→画面が完全な闇へ(1秒)→闇の中で口上を1文ずつ(出て消えて次、タップ早送り可)→
// 最後の文が表示された瞬間に本命BGM(yokai_no_shutai)頭出し→口上明けに白フラッシュ+雷鳴SE→
// フラッシュの下で怒り背景+怒り形態絵へ切替→明けたら第二形態→0.6秒置いて怒りギミック発動
function maybeStartSecondFormSequence(onDone) {
  if (!battle || !battle.secondForm) return false;
  const sf = battle.secondForm;
  if (sf.fired || sf.owner.hp <= 0) return false;
  if (sf.owner.hp / sf.owner.maxHp >= (sf.def.hpBelow != null ? sf.def.hpBelow : 0.5)) return false;
  sf.fired = true; // 開始した時点で発火済み(演出中の再入・二重発動を防ぐ)
  if (typeof stopBossIntroBgm === "function") stopBossIntroBgm();
  renderBattleScreen();
  const blackout = createSecondFormBlackout(); // 0.4秒の静寂の後、1秒かけて闇へ沈む(fadeはCSS遷移)
  const bail = () => { if (blackout.parentNode) blackout.remove(); onDone(); }; // 演出中に戦闘が終わった時の後始末
  setTimeout(() => {
    if (!battle) { bail(); return; }
    playSecondFormLines(sf.def.lines || [], () => {
      if (typeof playBossClimaxBgm === "function") playBossClimaxBgm(true); // 最後の文と同時に本命曲
    }, () => {
      if (!battle) { bail(); return; }
      playSecondFormFlash();
      setTimeout(() => {
        if (!battle) { bail(); return; }
        // フラッシュが乗り切っている間に怒り背景+怒り形態の立ち絵へ切替(updateEnemyCardがsrc差分を反映)
        if (sf.def.bg) { gimmickBattleBgUrl = sf.def.bg; updateSceneBackgrounds(); }
        if (sf.def.image) sf.owner.image = sf.def.image;
        renderBattleScreen();
        blackout.style.transition = "opacity 0.35s ease";
        blackout.style.opacity = "0";
        setTimeout(() => { if (blackout.parentNode) blackout.remove(); }, 450);
        // 雷鳴は「暗転が明けた瞬間にドーン」(ユーザー指定2026-08-01)。音源は雷9(Nosferatu用の重い雷、
        // Richard Humphries CC-BY 4.0)の頭の無音をカットした即発音版
        playSfx("phase2_thunder");
        if (typeof playBigAtkImpactFx === "function") playBigAtkImpactFx(); // 赤ビネット+画面揺れ
        // 雷鳴が鳴り響く間を0.6秒置いてから怒りギミック(告知+召喚)を発動して進行再開
        setTimeout(() => {
          if (!battle) { onDone(); return; }
          const entry = (battle.gimmicks || []).find((g) => g.owner === sf.owner && g.def.id === sf.def.gimmickId);
          if (entry && !entry.active) { activateGimmickEntry(entry); renderBattleScreen(); }
          onDone();
        }, 600);
      }, 180);
    });
  }, 1400);
  return true;
}
// formCycleの形態切り替えの実体。持ち主に形態フラグを立て(古い形態のフラグは全消去)、
// 予告文をログへ流す。般若面(bigAttackStance)は危険の合図として警告フラッシュ+警告音も鳴らす
function gimmickApplyForm(entry, eff) {
  const owner = entry.owner;
  const form = eff.forms[(entry.formIndex || 0) % eff.forms.length];
  owner.__formId = form.id;
  owner.__formAttacks = form.attacks || null;
  owner.__formAttackMult = form.attackMult || null;
  owner.__formBigAttackStance = !!form.bigAttackStance;
  // 切替の言い回しはeff.switchTextでギミックごとに指定できる({label}/{form}が置換される。
  // 例: 三面替え=「面を顔へ重ねた」、湯加減=「湯樋を引き替えた」)。未指定は汎用文
  const tmpl = eff.switchText || "{label}は【{form}】に構えを変えた。";
  blog(tmpl.replace("{label}", owner.label).replace("{form}", form.name) + (form.announce || ""));
  if (form.bigAttackStance) {
    triggerWarningFlash();
    playSfx("big_attack_warning");
  }
  if (form.summon) gimmickDoSummon(form.summon, owner);
  renderBattleScreen();
}
// 「取り巻きが生きている間の被ダメ軽減」の掛け直し。翁面(formCycle)と笑わぬ祭(dmgTakenWhileMinions)の
// 両方が同時に条件を満たしても、同一ラウンドに二重掛けして軽減が乗算で深くならないようにする
function gimmickApplyMinionShield(owner, mult) {
  if (!battle || owner.hp <= 0) return;
  if (owner.__gimmickShieldRound === battle.roundsTotal) return;
  owner.__gimmickShieldRound = battle.roundsTotal;
  applyStatMod(owner, "dmgTaken", mult, 2);
}

// 雑魚召喚の実体。襲撃戦の多段ウェーブ(raidTryAdvanceWave)と同じ「battle.enemiesへ後から足す」方式。
// 場にいる同種の生存数がmaxAliveに達している分は湧かない(0体なら何もしない)
function gimmickDoSummon(eff, owner) {
  const aliveOfKind = battle.enemies.filter((e) => e.id === eff.enemyId && e.hp > 0).length;
  const room = Math.max(0, (eff.maxAlive != null ? eff.maxAlive : 99) - aliveOfKind);
  const n = Math.min(eff.count || 1, room);
  if (n <= 0) return false;
  // 過去に召喚されて倒された同種の死体カードの枠は畳む(枠が溜まると新しいカードが押し出されて
  // 縮む・寄る問題への対策。raidTryAdvanceWaveの__clearedWaveと同じ表示専用フラグを流用)
  battle.enemies.forEach((e) => { if (e.__summonedByGimmick && e.hp <= 0) e.__clearedWave = true; });
  const spawned = [];
  for (let i = 0; i < n; i++) {
    const e = instantiateEnemyById(eff.enemyId);
    if (e) {
      e.__summonedByGimmick = true;
      spawned.push(e);
    }
  }
  if (spawned.length === 0) return false;
  battle.enemies = battle.enemies.concat(spawned);
  // 貫き矢の余りダメージ分配など、敵同士の相互参照(__enemyAllies)を新しい配列で配り直す
  battle.enemies.forEach((e) => { e.__enemyAllies = battle.enemies; });
  battle.justAppeared = true; // 新しく作られるカードにだけ出現演出が付く(既存カードは再生されない)
  blog(eff.text || `${owner.label}が${(ENEMIES[eff.enemyId] || {}).ja || "仲間"}を${spawned.length}体呼び出した！`);
  renderBattleScreen();
  return true;
}

// ラウンドの節目(nextRound、投石器より前)に呼ばれる。発動済みギミックの周期効果
// (場ダメージ・周期召喚)を解決する。効果が発動した場合は演出の間を取ってから
// continueRound(次ラウンドの手番組みへ進む続き)を自分で呼び、trueを返す(呼び出し側はreturnする)。
// 場ダメージで全滅した場合はcontinueRoundを呼ばずに全滅処理へ入る。何も発動しなければfalse
function processGimmickRoundEffects(continueRound) {
  if (!battle || !battle.gimmicks) return false;
  let fired = false;
  battle.gimmicks.forEach((entry) => {
    if (!entry.active || entry.owner.hp <= 0) return;
    entry.roundsSinceActive++;
    (entry.def.effects || []).forEach((eff) => {
      if (eff.type === "fieldDamage") {
        if (entry.roundsSinceActive % (eff.every || 1) !== 0) return;
        const targets = aliveField();
        if (targets.length === 0) return;
        blog(`${eff.name || entry.def.name || "場の力"}が味方全員に降りかかった！`);
        targets.forEach((c) => {
          const dmg = Math.max(eff.min != null ? eff.min : 1, Math.round(c.maxHp * (eff.pctMaxHp || 0.05)));
          c.hp = Math.max(0, c.hp - dmg);
          popupOn(c.id, `-${dmg}`, "dmg");
        });
        fired = true;
      } else if (eff.type === "fieldInflict") {
        if (entry.roundsSinceActive % (eff.every || 1) !== 0) return;
        const targets = aliveField();
        if (targets.length === 0 || !eff.inflict) return;
        blog(`${eff.name || entry.def.name || "場の力"}が味方全員に襲いかかった！`);
        // 付与の中身(種類/ターン数/値)と免疫の扱いは、敵の大技デバフと同じresolveDebuffEffectに任せる
        targets.forEach((c) => { resolveDebuffEffect(c, eff.inflict.type, eff.inflict, blog); });
        fired = true;
      } else if (eff.type === "summon") {
        if (entry.roundsSinceActive % (eff.every || 1) !== 0) return;
        if (gimmickDoSummon(eff, entry.owner)) fired = true;
      } else if (eff.type === "bindOne") {
        if (entry.roundsSinceActive % (eff.every || 1) !== 0) return;
        const candidates = aliveField().filter((c) => !(c.stunTurns > 0));
        if (candidates.length === 0) return;
        const t = candidates[Math.floor(Math.random() * candidates.length)];
        applyStun(t, eff.turns || 1);
        blog(eff.text ? eff.text.replace("{target}", t.label) : `${eff.name || entry.def.name || "拘束"}が${t.label}を縛り上げた！`);
        popupOn(t.id, "💫拘束", "stun");
        fired = true;
      } else if (eff.type === "dmgTakenWhileMinions") {
        // 取り巻きが生きている間だけ、毎ラウンド軽減を掛け直す(全滅していれば何もしない=素通し)。
        // 表示の間は取らない(firedにしない)静かな効果。翁面(formCycle)と同一ラウンドで重複しない
        const hasMinions = battle.enemies.some((e) => e !== entry.owner && e.hp > 0);
        if (hasMinions) gimmickApplyMinionShield(entry.owner, eff.mult || 0.7);
      } else if (eff.type === "formCycle") {
        // 周期が満ちたら固定順で次の面へ(狐→般若→翁→狐…)
        if (entry.roundsSinceActive % (eff.every || 2) === 0) {
          entry.formIndex = (entry.formIndex || 0) + 1;
          gimmickApplyForm(entry, eff);
          fired = true;
        }
        // 翁面の間: 取り巻きが生きていれば被ダメ軽減を掛け直す(静かな効果、firedにしない)
        const curForm = eff.forms[(entry.formIndex || 0) % eff.forms.length];
        if (curForm.dmgTakenWhileMinionsMult) {
          const hasFormMinions = battle.enemies.some((e) => e !== entry.owner && e.hp > 0);
          if (hasFormMinions) gimmickApplyMinionShield(entry.owner, curForm.dmgTakenWhileMinionsMult);
        }
        // ぬる湯(regenPctMaxHp): この形態の間、毎ラウンド持ち主が回復する
        if (curForm.regenPctMaxHp && entry.owner.hp > 0 && entry.owner.hp < entry.owner.maxHp) {
          const heal = Math.max(1, Math.round(entry.owner.maxHp * curForm.regenPctMaxHp));
          entry.owner.hp = Math.min(entry.owner.maxHp, entry.owner.hp + heal);
          blog(`${curForm.name || "湯"}の温もりが${entry.owner.label}の傷を癒やした。(+${heal})`);
          popupOn(entry.owner.instanceId, `+${heal}`, "heal");
          fired = true;
        }
        // 煮え湯(fieldDamagePctMaxHp): この形態の間、毎ラウンド味方全員へ場ダメージ
        if (curForm.fieldDamagePctMaxHp) {
          const targets2 = aliveField();
          if (targets2.length > 0) {
            blog(`${curForm.fieldDamageName || curForm.name || "場の力"}が味方全員に降りかかった！`);
            targets2.forEach((c) => {
              const dmg = Math.max(curForm.fieldDamageMin != null ? curForm.fieldDamageMin : 1, Math.round(c.maxHp * curForm.fieldDamagePctMaxHp));
              c.hp = Math.max(0, c.hp - dmg);
              popupOn(c.id, `-${dmg}`, "dmg");
            });
            fired = true;
          }
        }
      }
    });
  });
  if (!fired) return false;
  const newlyCritical = handleFieldDeaths();
  renderBattleScreen();
  if (aliveField().length === 0) {
    handleNoOneLeftToFight();
    return true;
  }
  autoDeployReserveIfNeeded(newlyCritical, () => setTimeout(continueRound, 700));
  return true;
}
