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
//   { type: "summon", every: N, enemyId, count, maxAlive, immediate, text }
//       … 発動後、Nラウンドごとに雑魚(enemyId)をcount体召喚。場にいる同種の生存数がmaxAliveに
//         達している分は湧かない。immediate:trueなら発動した瞬間にも1回召喚する
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
  return false;
}

// 毎手番の節目(processNext冒頭)に呼ばれる。未発動のギミックのトリガーを判定し、
// 満たしていれば発動(告知ログ+場演出+即時召喚)する。持ち主が倒れていたら発動しない
function processGimmickTriggers() {
  if (!battle || !battle.gimmicks) return;
  battle.gimmicks.forEach((entry) => {
    if (entry.active || entry.owner.hp <= 0) return;
    if (!gimmickTriggerMet(entry)) return;
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
      }
    });
    renderBattleScreen();
  });
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
      } else if (eff.type === "summon") {
        if (entry.roundsSinceActive % (eff.every || 1) !== 0) return;
        if (gimmickDoSummon(eff, entry.owner)) fired = true;
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
