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
    fatigue: 0, // 0〜100。潜り続けるほど溜まり、戦闘力を下げる(町で全回復)
    guarding: false,
    status: "active", // active | corpse | lost
    corpseFloor: null,
    corpseExpireStep: null,
  };
}

function xpToNext(level) {
  return 20 + level * 15;
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

// 町に戻って休息した際にHP/MP/疲労度を全回復する(ダンジョン探索中は回復しない)
function restAtTown(characters) {
  characters.forEach((c) => {
    if (c.status === "active") {
      c.hp = c.maxHp;
      c.mp = c.maxMp;
      c.fatigue = 0;
    }
  });
}

// フィールドに出ている(ダンジョンに潜っている)キャラに1階分の疲労を加算する
function advanceFatigue(characters) {
  characters.forEach((c) => {
    if (c.status === "active") {
      c.fatigue = Math.min(FATIGUE_MAX, c.fatigue + FATIGUE_PER_FLOOR);
    }
  });
}

// 疲労度による攻撃力/防御力/素早さ/魔力の低下率(最大40%)
function fatigueMalus(fatigue) {
  return Math.min(0.4, (fatigue || 0) * 0.004);
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
const ABILITY_MP_COST = { magicAttack: 6, magicAttackAll: 12, heal: 5, critAttack: 4, powerAttack: 5, physicalAttackAll: 9 };
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
function rollHeal(mag) {
  return Math.max(5, Math.round(mag * 1.5 + Math.random() * 5));
}

// 現在のフロアに応じて敵を1体抽選する(内部用)。フロアが深いほど際限なくステータスが強化される
function pickEnemyForFloor(floor) {
  const eligible = Object.values(ENEMIES).filter((e) => floor >= e.minFloor && floor <= e.maxFloor);
  const weighted = [];
  eligible.forEach((e) => {
    const weight = e.isBoss ? (floor % 10 === 0 ? 6 : 1) : 10;
    for (let i = 0; i < weight; i++) weighted.push(e);
  });
  const pick = weighted[Math.floor(Math.random() * weighted.length)];
  const scale = 1 + (floor - 1) * 0.045;
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
  if (floor % 10 === 0) return [pickEnemyForFloor(floor)];
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
  applyDamageToTarget(target, dmg, log, `${actor.label}の攻撃！`);
  return dmg;
}

function applyDamageToTarget(target, dmg, log, prefix) {
  target.hp = Math.max(0, target.hp - dmg);
  log(`${prefix} ${target.label}に${dmg}ダメージ！`);
}

// abilityType: 'magicAttack' | 'magicAttackAll' | 'heal' | 'critAttack' | 'powerAttack' | 'physicalAttackAll' | 'guard'
// target: 単体系は対象1体、全体系(...All)は生存中の敵配列、heal/guardはactor自身か味方1体
function useAbility(actor, target, abilityType, log) {
  const cost = abilityMpCost(abilityType);
  if (cost > 0) {
    if (actor.mp < cost) {
      log(`${actor.label}はMPが足りず${ABILITY_LABEL[abilityType]}を使えなかった！`);
      return { failed: true };
    }
    actor.mp -= cost;
  }
  if (abilityType === "guard") {
    actor.guarding = true;
    log(`${actor.label}は身を守る構えを取った！`);
    return { guard: true };
  }
  if (abilityType === "magicAttack") {
    const dmg = rollMagicAttack(effectiveStat(actor, "mag"), target.def);
    applyDamageToTarget(target, dmg, log, `${actor.label}の${ABILITY_LABEL[abilityType]}！`);
    return { dmg };
  }
  if (abilityType === "magicAttackAll") {
    const results = target.filter((t) => t.hp > 0).map((t) => {
      const dmg = Math.max(1, Math.round(rollMagicAttack(effectiveStat(actor, "mag"), t.def) * 0.6));
      applyDamageToTarget(t, dmg, log, `${actor.label}の${ABILITY_LABEL[abilityType]}！`);
      return dmg;
    });
    return { dmgs: results };
  }
  if (abilityType === "physicalAttackAll") {
    const results = target.filter((t) => t.hp > 0).map((t) => {
      const dmg = Math.max(1, Math.round(rollBasicAttack(effectiveStat(actor, "atk"), t.def) * 0.55));
      applyDamageToTarget(t, dmg, log, `${actor.label}の${ABILITY_LABEL[abilityType]}！`);
      return dmg;
    });
    return { dmgs: results };
  }
  if (abilityType === "powerAttack") {
    const dmg = rollPowerAttack(effectiveStat(actor, "atk"), target.def);
    applyDamageToTarget(target, dmg, log, `${actor.label}の${ABILITY_LABEL[abilityType]}！`);
    return { dmg };
  }
  if (abilityType === "critAttack") {
    const dmg = rollCritAttack(effectiveStat(actor, "atk"), target.def);
    applyDamageToTarget(target, dmg, log, `${actor.label}の${ABILITY_LABEL[abilityType]}！`);
    return { dmg };
  }
  if (abilityType === "heal") {
    const heal = rollHeal(effectiveStat(actor, "mag"));
    target.hp = Math.min(target.maxHp, target.hp + heal);
    log(`${actor.label}の${ABILITY_LABEL[abilityType]}！ ${target.label}のHPが${heal}回復した！(MP-${cost})`);
    return { heal };
  }
  return null;
}

function usePotion(target, log) {
  const heal = 30;
  target.hp = Math.min(target.maxHp, target.hp + heal);
  log(`${target.label}は回復薬でHPが${heal}回復した！`);
}

// enemy一体がtargets(生存中の味方)からランダムに1人を攻撃する。かばう中の相手なら大幅減衰した上で構えを消費する
function enemyAttack(enemy, targets, log) {
  const alive = targets.filter((t) => t.hp > 0);
  if (!alive.length) return null;
  const target = alive[Math.floor(Math.random() * alive.length)];
  let dmg = rollBasicAttack(enemy.atk, effectiveStat(target, "def"));
  if (target.guarding) {
    dmg = Math.max(1, Math.round(dmg * 0.4));
    target.guarding = false;
    target.hp = Math.max(0, target.hp - dmg);
    log(`${enemy.label}の攻撃！ ${target.label}はかばう構えで衝撃を軽減し、${dmg}ダメージ！`);
  } else {
    target.hp = Math.max(0, target.hp - dmg);
    log(`${enemy.label}の攻撃！ ${target.label}に${dmg}ダメージ！`);
  }
  return { target, dmg };
}

// 戦闘不能になったキャラをそのフロアの死体にする(パーマデス+死体回収システム)
function markCorpse(character, floor, worldStep) {
  character.status = "corpse";
  character.hp = 0;
  character.corpseFloor = floor;
  character.corpseExpireStep = worldStep + CORPSE_STEP_LIMIT;
}

// worldStepが進むたび、期限切れの死体をロスト(完全消滅)にする
function tickWorldStep(characters, worldStep) {
  characters.forEach((c) => {
    if (c.status === "corpse" && worldStep > c.corpseExpireStep) {
      c.status = "lost";
    }
  });
}

// 聖水を使って死体を蘇生する(HP半分で復活)
function reviveCorpse(character) {
  if (character.status !== "corpse") return false;
  const c = CLASSES[character.classId];
  character.status = "active";
  character.hp = Math.max(1, Math.round(c.hp * 0.5));
  character.fatigue = 0;
  character.corpseFloor = null;
  character.corpseExpireStep = null;
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
    createCharacter, rollBasicAttack, rollMagicAttack, rollPowerAttack, rollCritAttack, rollHeal,
    pickEnemyForFloor, pickEncounterForFloor, goldReward, performAttack, useAbility, usePotion, enemyAttack,
    markCorpse, tickWorldStep, reviveCorpse, turnOrder, simulateBattle, simulateBattleMulti,
    xpToNext, levelUp, grantXp, maxMpFor, restAtTown, abilityMpCost,
    advanceFatigue, fatigueMalus, effectiveStat, computeEquipBonus, refreshEquipBonus, classHasReachedLevel,
  };
}
