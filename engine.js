// ダンジョン1: ゲームロジック本体(キャラ生成・ダメージ計算・戦闘・死体/ロスト管理)

let __idSeq = 1;
let __enemySeq = 1;
function nextId() {
  return "c" + __idSeq++;
}

// 魔力0の物理職(盗賊/忍者など)も自分の得意技を使えるよう、MPには最低ライン(10)を必ず持たせる
function maxMpFor(mag) {
  return 10 + Math.round(mag * 1.2);
}

// classUpgrades: { weapon: tierIndex(0=未購入), armor: tierIndex(0=未購入) } — 職業単位の恒久装備。
// 上位ティアを買うと下位ティアから乗り換わる(加算ではなく差し替え)。個別のキャラごとの装備管理は無く、
// 「その職業への投資」として全メンバー(既存+以後仲間にする人)に一律で乗る(MVPとしての単純化)。
function computeEquipBonus(classId, classUpgrades) {
  const bonus = { atk: 0, def: 0, mag: 0 };
  const eq = EQUIPMENT[classId];
  const owned = (classUpgrades && classUpgrades[classId]) || {};
  if (eq && owned.weapon > 0) {
    const t = eq.weapon[owned.weapon - 1];
    bonus[t.statKey] += t.bonus;
  }
  if (eq && owned.armor > 0) {
    const t = eq.armor[owned.armor - 1];
    bonus[t.statKey] += t.bonus;
  }
  return bonus;
}

// そのクラスの誰かが指定レベルに到達しているか(装備ティア解禁判定に使う)
function classHasReachedLevel(characters, classId, level) {
  return characters.some((c) => c.classId === classId && c.status !== "lost" && c.level >= level);
}

function createCharacter(name, classId, classUpgrades) {
  const c = CLASSES[classId];
  const maxMp = maxMpFor(c.mag);
  return {
    id: nextId(),
    name,
    classId,
    label: name,
    level: 1,
    xp: 0,
    maxHp: c.hp,
    hp: c.hp,
    maxMp,
    mp: maxMp,
    atk: c.atk,
    def: c.def,
    spd: c.spd,
    mag: c.mag,
    equipBonus: computeEquipBonus(classId, classUpgrades),
    fatigue: 0, // 0〜100。潜り続けるほど溜まり、戦闘力を下げる(町では抜けない。温泉で回復)
    guarding: false,
    reloading: false, // 砲術士の砲撃を使った直後、次の自分のターンは装填で動けない
    status: "active", // active | critical | lost
    criticalFloor: null,
    criticalExpireHalfDay: null,
    onsenCooldownUntil: null, // この値以上にhalfDayStepが進むまで温泉に入れない
    lodgingCooldownUntil: null, // この値以上にhalfDayStepが進むまで宿泊中で連れて行けない
  };
}

// 体感のレベルアップ速度を旧来の3分の1にするため必要経験値を3倍にし、さらに「上がりやすすぎる」というフィードバックを受けて1.5倍(合計4.5倍)にしてある
function xpToNext(level) {
  return Math.round((20 + level * 15) * 4.5);
}

// レベルアップ時、職業ごとの基礎値にレベル依存の成長率をかけて再計算する。
// HPは全快させず、最大値が増えた分だけ現在値に上乗せする(戦闘中の連続レベルアップが実質全回復になっていたバグの修正)
function levelUp(character, log) {
  character.level++;
  const c = CLASSES[character.classId];
  const growth = 1 + character.level * 0.12;
  const oldMaxHp = character.maxHp;
  const oldMaxMp = character.maxMp;
  character.maxHp = Math.round(c.hp * growth);
  character.hp = Math.min(character.maxHp, character.hp + (character.maxHp - oldMaxHp));
  character.atk = Math.round(c.atk * growth);
  character.def = Math.round(c.def * growth);
  character.spd = Math.round(c.spd * (1 + character.level * 0.05));
  character.mag = Math.round(c.mag * growth);
  character.maxMp = maxMpFor(character.mag);
  character.mp = Math.min(character.maxMp, character.mp + (character.maxMp - oldMaxMp));
  log(`${character.label}はレベル${character.level}になった！`);
}

// フィールドに出ている(ダンジョンに潜っている)キャラに1階分の疲労(ストレス)を加算する
function advanceFatigue(characters) {
  characters.forEach((c) => {
    if (c.status === "active") {
      c.fatigue = Math.min(FATIGUE_MAX, c.fatigue + FATIGUE_PER_FLOOR);
    }
  });
}

// 温泉: レベルが高いキャラほど入浴料が高くなる(ちょっと高めの金額)
function onsenCost(level) {
  return ONSEN_BASE_COST + level * ONSEN_COST_PER_LEVEL;
}

// 現在「休養中」(温泉に入っている)かどうか。宿泊は(一旦)冒険可否に影響しない
function isResting(character, halfDayStep) {
  return character.onsenCooldownUntil != null && halfDayStep < character.onsenCooldownUntil;
}

// 生存していて、かつ休養中でもない = 冒険に連れて行ける/温泉や宿屋を新たに利用できる状態
function isAvailable(character, halfDayStep) {
  return character.status === "active" && !isResting(character, halfDayStep);
}

// 温泉に入り、ストレスを半分(ONSEN_FATIGUE_RELIEF分)回復する。以後半日は再利用/連れ出し不可にする
function useOnsen(character, halfDayStep) {
  character.fatigue = Math.max(0, (character.fatigue || 0) - ONSEN_FATIGUE_RELIEF);
  character.onsenCooldownUntil = halfDayStep + 1;
}

// 宿屋に宿泊し、HP/MPを全回復する(宿泊自体は冒険可否に影響しない)
function useLodging(character, halfDayStep) {
  character.hp = character.maxHp;
  character.mp = character.maxMp;
}

// ストレスの段階(0=平常, 1=40〜59, 2=60〜79, 3=80〜99, 4=100=発狂)
function stressTier(fatigue) {
  const f = fatigue || 0;
  if (f >= 100) return 4;
  if (f >= 80) return 3;
  if (f >= 60) return 2;
  if (f >= 40) return 1;
  return 0;
}

// ストレスによる攻撃力/防御力/素早さ/魔力の低下率。段階が上がるごとに重くなり、
// 80〜99で半減、100(発狂)は数値上も0(=そもそも行動不能として別途扱う)
function fatigueMalus(fatigue) {
  const tier = stressTier(fatigue);
  if (tier >= 4) return 1;
  if (tier === 3) return 0.5;
  if (tier === 2) return 0.3;
  if (tier === 1) return 0.15;
  return 0;
}

// 疲労を反映した実効ステータス(敵にはfatigueが無いのでそのまま返る)
// 疲労減衰は素の能力値にのみかかり、装備ボーナスは減衰後に加算する(装備は疲労で劣化しない)
function effectiveStat(entity, key) {
  const base = entity[key] || 0;
  if (entity.fatigue == null) return base; // 敵など疲労を持たない対象はそのまま
  const fatigued = base * (1 - fatigueMalus(entity.fatigue));
  const equip = (entity.equipBonus && entity.equipBonus[key]) || 0;
  return Math.max(1, Math.round(fatigued + equip));
}

// 装備購入後、既存の該当職業メンバー全員のequipBonusを再計算する
function refreshEquipBonus(characters, classId, classUpgrades) {
  const bonus = computeEquipBonus(classId, classUpgrades);
  characters.forEach((c) => {
    if (c.classId === classId) c.equipBonus = bonus;
  });
}

// guard以外の全アビリティ(魔法系だけでなく物理系の必殺技も)はMPを消費する。
// 魔力0の物理職(盗賊/忍者/戦士/侍)にも最低10のMPを持たせてあるので、自分の技は使える
const ABILITY_MP_COST = { magicAttack: 6, magicAttackAll: 12, heal: 5, critAttack: 4, powerAttack: 5, physicalAttackAll: 9, preciseShot: 4, cannonShot: 8 };
function abilityMpCost(abilityType) {
  return ABILITY_MP_COST[abilityType] || 0;
}

function grantXp(character, amount, log) {
  if (character.status !== "active") return;
  character.xp += amount;
  let guardCounter = 0;
  while (character.xp >= xpToNext(character.level) && guardCounter < 50) {
    character.xp -= xpToNext(character.level);
    levelUp(character, log);
    guardCounter++;
  }
}

function rollBasicAttack(atk, def) {
  return Math.max(1, Math.round(atk - def * 0.6 + (Math.random() * 5 - 2)));
}
function rollMagicAttack(mag, def) {
  return Math.max(1, Math.round(mag * 1.8 - def * 0.3 + (Math.random() * 4 - 1)));
}
function rollPowerAttack(atk, def) {
  return Math.max(1, Math.round(atk * 1.6 - def * 0.7 + (Math.random() * 5 - 2)));
}
function rollCritAttack(atk, def) {
  return Math.max(1, Math.round(atk * 1.3 - def * 0.4 + (Math.random() * 5 - 2)));
}
// 狩人の会心の一矢。会心の一撃と同じ防御貫通の性質(弓は鎧の隙間を狙う)
function rollPreciseShot(atk, def) {
  return Math.max(1, Math.round(atk * 1.35 - def * 0.4 + (Math.random() * 5 - 2)));
}
// 砲術士の砲撃。渾身の一撃よりさらに重いが、使うと次のターンは装填で動けなくなる(呼び出し側で処理)
function rollCannonShot(atk, def) {
  return Math.max(1, Math.round(atk * 2.4 - def * 0.8 + (Math.random() * 8 - 3)));
}
function rollHeal(mag) {
  return Math.max(5, Math.round(mag * 1.5 + Math.random() * 5));
}

// 現在のフロアに応じて敵を1体抽選する(内部用)。フロアが深いほど際限なくステータスが強化される。
// onlyBoss=trueの場合はそのフロアで出現可能なボスだけに絞る(ボスフロアで確実にボスを出すため)
function pickEnemyForFloor(floor, onlyBoss) {
  const eligible = Object.values(ENEMIES).filter((e) => floor >= e.minFloor && floor <= e.maxFloor && (!onlyBoss || e.isBoss));
  if (onlyBoss && eligible.length === 0) return null;
  const weighted = [];
  eligible.forEach((e) => {
    const weight = e.isBoss ? (floor % 10 === 0 ? 6 : 1) : 10;
    for (let i = 0; i < weight; i++) weighted.push(e);
  });
  const pick = weighted[Math.floor(Math.random() * weighted.length)];
  const scale = 1 + (floor - 1) * FLOOR_SCALE_RATE;
  const hp = Math.round(pick.hp * scale);
  return {
    ...pick,
    instanceId: "e" + __enemySeq++,
    label: pick.ja,
    hp,
    maxHp: hp,
    atk: Math.round(pick.atk * scale),
    def: Math.round(pick.def * scale),
  };
}

// そのフロアの遭遇(1〜3体)を組み立てる。ボスフロア(10の倍数)は必ず単体。
// それ以外は単体(手強い1体)か複数体(1体あたりは弱いが数で来る雑魚集団)がランダムに出る —
// 雑魚集団は範囲攻撃(魔法使いのメテオ/忍者の乱れ突き)で効率よく削れる、という職業差別化の要
function pickEncounterForFloor(floor) {
  if (floor % 10 === 0) {
    const boss = pickEnemyForFloor(floor, true);
    return [boss || pickEnemyForFloor(floor)];
  }
  const roll = Math.random();
  let count = 1;
  if (floor >= 4) {
    if (roll < 0.45) count = 1;
    else if (roll < 0.8) count = 2;
    else count = 3;
  }
  const enemies = [];
  for (let i = 0; i < count; i++) {
    const e = pickEnemyForFloor(floor);
    if (e.isBoss) return [e]; // ボス個体が紛れたら単体に差し戻す
    if (count > 1) {
      const nerf = count === 2 ? 0.8 : 0.65;
      e.hp = Math.max(1, Math.round(e.hp * nerf));
      e.maxHp = e.hp;
      e.atk = Math.max(1, Math.round(e.atk * nerf));
    }
    enemies.push(e);
  }
  return enemies;
}

function goldReward(enemy) {
  return enemy.goldMin + Math.floor(Math.random() * (enemy.goldMax - enemy.goldMin + 1));
}

function performAttack(actor, target, log) {
  const dmg = rollBasicAttack(effectiveStat(actor, "atk"), target.def);
  applyDamageToTarget(target, dmg, log, actor.label);
  return dmg;
}

// ログは「静香は鬼火に50ダメージ！」の1行のみにする(技名などの装飾は付けない)
function applyDamageToTarget(target, dmg, log, actorLabel) {
  target.hp = Math.max(0, target.hp - dmg);
  log(`${actorLabel}は${target.label}に${dmg}ダメージ！`);
}

// abilityType: 'magicAttack' | 'magicAttackAll' | 'heal' | 'critAttack' | 'powerAttack' | 'physicalAttackAll' | 'guard'
// target: 単体系は対象1体、全体系(...All)は生存中の敵配列、heal/guardはactor自身か味方1体
function useAbility(actor, target, abilityType, log) {
  const cost = abilityMpCost(abilityType);
  if (cost > 0) {
    if (actor.mp < cost) {
      log(`${actor.label}はMPが足りない！`);
      return { failed: true };
    }
    actor.mp -= cost;
  }
  if (abilityType === "guard") {
    actor.guarding = true;
    log(`${actor.label}は身を守る構え！`);
    return { guard: true };
  }
  if (abilityType === "magicAttack") {
    const dmg = rollMagicAttack(effectiveStat(actor, "mag"), target.def);
    applyDamageToTarget(target, dmg, log, actor.label);
    return { dmg };
  }
  if (abilityType === "magicAttackAll") {
    const results = target.filter((t) => t.hp > 0).map((t) => {
      const dmg = Math.max(1, Math.round(rollMagicAttack(effectiveStat(actor, "mag"), t.def) * 0.6));
      applyDamageToTarget(t, dmg, log, actor.label);
      return dmg;
    });
    return { dmgs: results };
  }
  if (abilityType === "physicalAttackAll") {
    // 旧0.55倍だと素の攻撃(atk倍率1.0)に対する目減りが大きく、魔法版(rollMagicAttackの1.8倍×0.6=実質1.08倍)より
    // 大幅に見劣りしていたため、0.85倍に引き上げて薙ぎ払いが単体攻撃と張り合える威力になるよう調整
    const results = target.filter((t) => t.hp > 0).map((t) => {
      const dmg = Math.max(1, Math.round(rollBasicAttack(effectiveStat(actor, "atk"), t.def) * 0.85));
      applyDamageToTarget(t, dmg, log, actor.label);
      return dmg;
    });
    return { dmgs: results };
  }
  if (abilityType === "powerAttack") {
    const dmg = rollPowerAttack(effectiveStat(actor, "atk"), target.def);
    applyDamageToTarget(target, dmg, log, actor.label);
    return { dmg };
  }
  if (abilityType === "critAttack") {
    const dmg = rollCritAttack(effectiveStat(actor, "atk"), target.def);
    applyDamageToTarget(target, dmg, log, actor.label);
    return { dmg };
  }
  if (abilityType === "preciseShot") {
    const dmg = rollPreciseShot(effectiveStat(actor, "atk"), target.def);
    applyDamageToTarget(target, dmg, log, actor.label);
    return { dmg };
  }
  if (abilityType === "cannonShot") {
    const dmg = rollCannonShot(effectiveStat(actor, "atk"), target.def);
    applyDamageToTarget(target, dmg, log, actor.label);
    actor.reloading = true;
    return { dmg };
  }
  if (abilityType === "heal") {
    const heal = rollHeal(effectiveStat(actor, "mag"));
    target.hp = Math.min(target.maxHp, target.hp + heal);
    log(`${actor.label}は${target.label}を${heal}回復！`);
    return { heal };
  }
  return null;
}

function usePotion(target, log) {
  const heal = Math.round(target.maxHp * POTION_HEAL_RATIO);
  target.hp = Math.min(target.maxHp, target.hp + heal);
  log(`${target.label}は回復薬で${heal}回復！`);
  return heal;
}

// enemy一体がtargets(生存中の味方)を攻撃する。かばう中の仲間がいれば、タンクとして必ずその相手が身代わりになって
// 大幅減衰した上で構えを消費する(誰もかばっていなければランダムに1人を攻撃する)
function enemyAttack(enemy, targets, log) {
  const alive = targets.filter((t) => t.hp > 0);
  if (!alive.length) return null;
  const guardian = alive.find((t) => t.guarding);
  const target = guardian || alive[Math.floor(Math.random() * alive.length)];
  let dmg = rollBasicAttack(enemy.atk, effectiveStat(target, "def"));
  if (target.guarding) {
    dmg = Math.max(1, Math.round(dmg * 0.4));
    target.guarding = false;
    target.hp = Math.max(0, target.hp - dmg);
    log(`${enemy.label}は${target.label}に${dmg}ダメージ(かばう)！`);
  } else {
    target.hp = Math.max(0, target.hp - dmg);
    log(`${enemy.label}は${target.label}に${dmg}ダメージ！`);
  }
  target.fatigue = Math.min(FATIGUE_MAX, (target.fatigue || 0) + damageStress(dmg, target.maxHp));
  return { target, dmg };
}

// 被弾ダメージが自身の最大HPに占める割合に応じてストレスが溜まる。3割未満は増加なし、
// 3割で+2、8割で+15になるよう線形補間している(割合1.0=即死級の一撃で+20)
function damageStress(dmg, maxHp) {
  if (!maxHp) return 0;
  const ratio = Math.min(dmg / maxHp, 1);
  if (ratio < 0.3) return 0;
  return Math.round(26 * (ratio - 0.3) + 2);
}

// 戦闘不能になったキャラをそのフロアで瀕死にする(死体ではなく生存しているが動けない状態)。
// 別の仲間がそのフロアに到達し、救出コマンドを使えば連れ帰れる(ただし冒険はそこで終了する)。
// 誰も助けに来ないまま、昼夜が1〜2日分(halfDayStepにして2〜4)経過するとロスト(完全消滅)する
function markCritical(character, floor, halfDayStep) {
  character.status = "critical";
  character.hp = 0;
  character.criticalFloor = floor;
  const span = CRITICAL_MIN_HALFDAYS + Math.floor(Math.random() * (CRITICAL_MAX_HALFDAYS - CRITICAL_MIN_HALFDAYS + 1));
  character.criticalExpireHalfDay = halfDayStep + span;
}

// 昼夜が切り替わる(halfDayStepが進む)たび、期限切れの瀕死キャラをロストにする
function tickHalfDay(characters, halfDayStep) {
  characters.forEach((c) => {
    if (c.status === "critical" && halfDayStep > c.criticalExpireHalfDay) {
      c.status = "lost";
    }
  });
}

// 瀕死の仲間を救出する(HP半分で復活)。呼び出し側でその冒険を終了させて町に戻す
function rescueCritical(character) {
  if (character.status !== "critical") return false;
  const c = CLASSES[character.classId];
  character.status = "active";
  character.hp = Math.max(1, Math.round(c.hp * 0.5));
  character.fatigue = 0;
  character.criticalFloor = null;
  character.criticalExpireHalfDay = null;
  return true;
}

// 速度順(疲労を反映した実効素早さ+ランダム性込み)で行動順を決める
function turnOrder(entities) {
  return [...entities].sort((a, b) => (effectiveStat(b, "spd") + Math.random() * 4) - (effectiveStat(a, "spd") + Math.random() * 4));
}

// Node.js検証用: 素朴なAI(常に通常攻撃)でパーティvs敵1体を1戦分自動再生する
function simulateBattle(party, enemy, log) {
  const alive = () => party.filter((p) => p.hp > 0);
  let turns = 0;
  while (enemy.hp > 0 && alive().length > 0 && turns < 200) {
    turns++;
    const order = turnOrder([...alive(), enemy]);
    for (const actor of order) {
      if (enemy.hp <= 0 || alive().length === 0) break;
      if (actor === enemy) {
        enemyAttack(enemy, alive(), log);
      } else if (actor.hp > 0) {
        performAttack(actor, enemy, log);
      }
    }
  }
  return { won: enemy.hp <= 0, turns, survivors: alive().length };
}

// Node.js検証用: パーティvs複数敵を自動再生する(素朴なAI: 各自ランダムな生存敵を攻撃)
function simulateBattleMulti(party, enemies, log) {
  const aliveParty = () => party.filter((p) => p.hp > 0);
  const aliveEnemies = () => enemies.filter((e) => e.hp > 0);
  let turns = 0;
  while (aliveEnemies().length > 0 && aliveParty().length > 0 && turns < 200) {
    turns++;
    const order = turnOrder([...aliveParty(), ...aliveEnemies()]);
    for (const actor of order) {
      if (aliveEnemies().length === 0 || aliveParty().length === 0) break;
      if (actor.hp <= 0) continue;
      if (enemies.includes(actor)) {
        enemyAttack(actor, aliveParty(), log);
      } else {
        const targets = aliveEnemies();
        if (targets.length) performAttack(actor, targets[Math.floor(Math.random() * targets.length)], log);
      }
    }
  }
  return { won: aliveEnemies().length === 0, turns, survivors: aliveParty().length };
}

if (typeof module !== "undefined") {
  module.exports = {
    createCharacter, rollBasicAttack, rollMagicAttack, rollPowerAttack, rollCritAttack, rollPreciseShot, rollCannonShot, rollHeal,
    pickEnemyForFloor, pickEncounterForFloor, goldReward, performAttack, useAbility, usePotion, enemyAttack,
    markCritical, tickHalfDay, rescueCritical, turnOrder, simulateBattle, simulateBattleMulti,
    xpToNext, levelUp, grantXp, maxMpFor, abilityMpCost,
    advanceFatigue, fatigueMalus, stressTier, effectiveStat, computeEquipBonus, refreshEquipBonus, classHasReachedLevel,
    onsenCost, useOnsen, useLodging, isResting, isAvailable,
  };
}
