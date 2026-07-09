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
// クラスごとの基礎MP上限。CLASSES[classId].maxMpで明示的に指定されていればそれを優先し(魔力に連動させたくない
// 個別調整用)、無ければ従来通り魔力から自動計算する
function baseMaxMpFor(classId) {
  const c = CLASSES[classId];
  return c.maxMp != null ? c.maxMp : maxMpFor(c.mag);
}

// classUpgrades: { weapon: tierIndex(0=未購入), armor: tierIndex(0=未購入) } — 職業単位の恒久装備。
// 上位ティアを買うと下位ティアから乗り換わる(加算ではなく差し替え)。個別のキャラごとの装備管理は無く、
// 「その職業への投資」として全メンバー(既存+以後仲間にする人)に一律で乗る(MVPとしての単純化)。
function computeEquipBonus(classId, classUpgrades) {
  const bonus = { atk: 0, def: 0, mag: 0, mp: 0 };
  const eq = EQUIPMENT[classId];
  const owned = (classUpgrades && classUpgrades[classId]) || {};
  if (eq && owned.weapon > 0) {
    const t = eq.weapon[owned.weapon - 1];
    bonus[t.statKey] += t.bonus;
  }
  if (eq && owned.armor > 0) {
    const t = eq.armor[owned.armor - 1];
    bonus[t.statKey] += t.bonus;
    bonus.mp += owned.armor * 2; // 防具を1段階買うごとにMP上限+2(5段階買うと最大+10)
  }
  return bonus;
}

// そのクラスの誰かが指定レベルに到達しているか(装備ティア解禁判定に使う)
function classHasReachedLevel(characters, classId, level) {
  return characters.some((c) => c.classId === classId && c.status !== "lost" && c.level >= level);
}

function createCharacter(name, classId, classUpgrades) {
  const c = CLASSES[classId];
  const equipBonus = computeEquipBonus(classId, classUpgrades);
  const maxMp = baseMaxMpFor(classId) + (equipBonus.mp || 0);
  return {
    id: nextId(),
    name,
    classId,
    label: name,
    personality: PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)], // 吹き出しセリフの言い回しに使う
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
    accuracy: c.accuracy,
    equipBonus,
    fatigue: 0, // 0〜100。潜り続けるほど溜まり、戦闘力を下げる(町では抜けない。温泉で回復)
    guarding: false,
    reloading: false, // 砲術士の砲撃を使った直後、次の自分のターンは装填で動けない
    fleeState: null, // null | "preparing"(逃走準備中) | "fled"(この戦闘から逃げた)。戦闘開始のたびリセットされる
    status: "active", // active | critical | lost
    onsenLockUntilMinutes: null, // 入浴した時点の絶対分数+ONSEN_LOCK_MINUTES。この値を過ぎるまでパーティ編成に組み込めない
    criticalFloor: null,
    criticalExpireMinutes: null, // ロストするゲーム内絶対分数(この値を過ぎるとtickCriticalExpiryでロストになる)
    carryingId: null, // 担いでいる瀕死の仲間のid(いなければnull)。担いでいる間は素早さ半減+攻撃/技が使えない
    carriedBy: null, // 自分が瀕死の時、誰に担がれているか(担がれていなければnull)
    poison: 0, // 毒の蓄積値。自分のターンが来るたびにこの値分ダメージを受け、1減る
    bleed: 0, // 裂傷の蓄積値。毒と同じ減衰式だが、技の付与量は毒より低めに設計する。裂傷中は攻撃力-10%
    burnTurns: 0, // 炎上の残りターン数。自分のターンが来るたびに最大HP割合のダメージを受ける(ターン数のみ減り、減衰しない)
    stunTurns: 0, // スタン(行動不能)の残りターン数
    stunResistTurns: 0, // スタンを受けた直後の一定ターン、スタン確率が大幅に下がる(連続スタンロック防止)
    silenceTurns: 0, // 沈黙(技が使えず通常攻撃のみ)の残りターン数
    statusImmuneTurns: 0, // 状態異常を受け付けない残りターン数
    tauntTurns: 0, // 挑発中の残りターン数(かばう同様、敵から必ず狙われる)
    statMods: [], // [{stat, mult, turns}] 一時的なステータス倍率(バフ/デバフ)。effectiveStatで乗算される
    campWeaponCareBattles: 0, // 野営「武器の手入れ」の攻撃力バフ残り戦闘回数。startBattle()ではリセットせず、戦闘終了時に1減る
    guaranteedCritNext: false, // 反射神経(evadeCritCounter)などで、次の自分の攻撃だけ確定会心にするフラグ
    skills: {}, // { level: "left"|"right" } スキルツリーで選んだ側の記録
    unlockedSkills: [], // 選んだ能動スキル(action持ち)のリスト。戦闘中の行動選択に追加される
    passives: initPassives(), // スキルツリーの永続受動効果をまとめて保持するオブジェクト
  };
}

// レベル上限を10に圧縮したことに伴う再設計(旧: 上限なしで(20+level*15)*4.5)。
// 「新レベルN = 旧レベル4N-3〜4Nの4段分をまとめたもの」という考え方で、旧式で旧レベル1〜36を上る
// のに必要だった経験値の合計と同じ総量になるよう、新レベル1〜9の必要経験値を等差数列(1080*level-45)で
// 割り振ってある(結果として新レベル1=1035, 新レベル9=9675と、終盤ほど1段の重みが大きくなる)
function xpToNext(level) {
  return Math.round((1080 * level - 45) * 0.11025); // ユーザー指示で必要経験値を現状からさらに1割短縮(0.1225 * 0.9)
}

// レベルアップ時、職業ごとの基礎値にレベル依存の成長率をかけて再計算する。
// HPは全快させず、最大値が増えた分だけ現在値に上乗せする(戦闘中の連続レベルアップが実質全回復になっていたバグの修正)。
// 成長率はダクソン/XCOM的に「Lv10でも2倍未満」に収まるよう抑えてある(旧0.1=Lv10で2.0倍から、
// 序盤の階層で装備済みの高レベルキャラが無双しすぎるという指摘を受けさらに緩和。Lv10で1.75倍)。
// 防御力はレベルでは一切伸ばさず、常に職業の基礎値のまま固定する(装備(甲冑)だけが伸びしろになる)
function levelUp(character, log) {
  if (character.level >= MAX_LEVEL) return;
  character.level++;
  const c = CLASSES[character.classId];
  const growth = 1 + character.level * 0.075; // Lv10で1.75倍
  const oldMaxHp = character.maxHp;
  character.maxHp = Math.round(c.hp * growth);
  character.hp = Math.min(character.maxHp, character.hp + (character.maxHp - oldMaxHp));
  character.atk = Math.round(c.atk * growth);
  character.def = c.def; // レベルによるdef成長は廃止(装備でのみ伸びる)
  character.spd = Math.round(c.spd * (1 + character.level * 0.05));
  character.mag = Math.round(c.mag * growth); // 魔法威力/治癒量は引き続き伸びる。MPの上限だけはレベルで伸ばさない(maxMp/mpは据え置き)
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

// 温泉: 一人あたり定額(ONSEN_FLAT_COST)
function onsenCost(level) {
  return ONSEN_FLAT_COST;
}

// 入浴後、まだONSEN_LOCK_MINUTES(2時間)経っていなければパーティ編成に組み込めない
// (宿泊の可否には影響しない、宿泊は別途c.status==="active"のみで判定している)
function isOnsenLocked(character, absoluteMinutes) {
  return character.onsenLockUntilMinutes != null && absoluteMinutes < character.onsenLockUntilMinutes;
}

// 生存していて、かつ温泉の入浴ロック中でなければ冒険に連れて行ける(宿屋の宿泊可否には影響しない)
function isAvailable(character, absoluteMinutes) {
  if (character.status !== "active") return false;
  if (absoluteMinutes != null && isOnsenLocked(character, absoluteMinutes)) return false;
  return true;
}

// 温泉に入り、ストレスを半分(ONSEN_FATIGUE_RELIEF分)回復する。以後2時間はパーティ編成に組み込めない
function useOnsen(character, absoluteMinutes) {
  character.fatigue = Math.max(0, (character.fatigue || 0) - ONSEN_FATIGUE_RELIEF);
  character.onsenLockUntilMinutes = absoluteMinutes + ONSEN_LOCK_MINUTES;
  // 次の遠征中限定のランダムバフを付与する(野営する、または町へ帰ると失効する)
  character.onsenBuffKey = pickOnsenBuff();
}
// バフ「ぽかぽか」(最大HP+7%)は他のバフと違い実効ステータス計算だけでは足りず、実際のHPの
// 器そのものを一時的に増やす必要があるため、遠征開始時(enterDungeon)に一度だけ加算し、
// バフが失効するタイミング(clearOnsenBuff)で同じ量を正しく差し引く
function applyOnsenHpBuffOnDeparture(character) {
  if (character.onsenBuffKey === "pokapoka" && !character.onsenHpBonusAmount) {
    const bonus = Math.round(character.maxHp * 0.07);
    character.maxHp += bonus;
    character.hp += bonus;
    character.onsenHpBonusAmount = bonus;
  }
}
// 野営する/町へ戻るタイミングで呼び、バフ(と「ぽかぽか」で加算した分のHP)を失効させる
function clearOnsenBuff(character) {
  if (character.onsenHpBonusAmount) {
    character.maxHp = Math.max(1, character.maxHp - character.onsenHpBonusAmount);
    character.hp = Math.min(character.maxHp, Math.max(0, character.hp - character.onsenHpBonusAmount));
    character.onsenHpBonusAmount = 0;
  }
  character.onsenBuffKey = null;
}

// 宿屋に宿泊し、HP/MPを全回復+ストレスを少量回復する(宿泊自体は冒険可否に影響しない)
function useLodging(character) {
  character.hp = character.maxHp;
  character.mp = character.maxMp;
  character.fatigue = Math.max(0, (character.fatigue || 0) - LODGE_FATIGUE_RELIEF);
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
  let result;
  if (entity.fatigue == null) {
    result = base; // 敵など疲労を持たない対象はそのまま
  } else {
    const fatigued = base * (1 - fatigueMalus(entity.fatigue));
    const equip = (entity.equipBonus && entity.equipBonus[key]) || 0;
    result = Math.max(1, Math.round(fatigued + equip));
    if (key === "spd" && entity.carryingId) result = Math.max(1, Math.round(result * 0.5)); // 仲間を担いでいる間は素早さ半減
  }
  // 温泉バフ(血行促進=攻撃力+5%、湯上がり=素早さ+5%)。次の遠征中限定、野営/帰還で失効する
  if (key === "atk" && entity.onsenBuffKey === "kekkou") result = Math.max(1, Math.round(result * 1.05));
  if (key === "spd" && entity.onsenBuffKey === "yuagari") result = Math.max(1, Math.round(result * 1.05));
  // 裂傷: 出血中は常時攻撃力-10%(敵/味方どちらにも適用)
  if (key === "atk" && (entity.bleed || 0) > 0) result = Math.max(1, Math.round(result * 0.9));
  // スキルツリーの一時バフ/デバフ(statMods)を乗算で適用。敵side/味方side問わず(デバフ技が敵にも掛かるため)適用する
  if (entity.statMods && entity.statMods.length) {
    let mult = 1;
    entity.statMods.forEach((m) => { if (m.stat === key) mult *= m.mult; });
    result = Math.max(1, Math.round(result * mult));
  }
  // スキルツリーの永続受動効果(atk/mag/def/spdの倍率)を適用。magはatkMultを流用する(陰陽師/僧侶の術威力もこれで底上げされる)
  if (entity.passives && (key === "atk" || key === "mag" || key === "def" || key === "spd")) {
    const p = entity.passives;
    const permMult = (key === "atk" || key === "mag") ? p.atkMult : key === "def" ? p.defMult : p.spdMult;
    if (permMult !== 1) result = Math.max(1, Math.round(result * permMult));
  }
  // HP割合条件つきの受動効果(武士道など、HP◯%以下で攻撃力/防御力up、といったもの)
  if (entity.passives && entity.passives.conditionalMods && entity.passives.conditionalMods.length && (key === "atk" || key === "mag" || key === "def" || key === "spd")) {
    activeConditionalMods(entity).forEach((m) => {
      if (!m.statMult) return;
      m.statMult.forEach((sm) => { if (sm.stat === key) result = Math.max(1, Math.round(result * sm.mult)); });
    });
  }
  // 状態フラグ条件つきの受動効果(挑発中/装填中/かばう中など、entity自身の一時状態を見て乗算する汎用フック)
  if (entity.passives && entity.passives.flagMods && entity.passives.flagMods.length && (key === "atk" || key === "mag" || key === "def" || key === "spd")) {
    entity.passives.flagMods.forEach((fm) => {
      if (fm.stat !== key) return;
      if (entity[fm.flag]) result = Math.max(1, Math.round(result * fm.mult));
    });
  }
  // 撃破時スタック系の受動効果(修羅・槍鬼など)。重複回数ぶん倍率を線形に積み増す
  if (entity.passives && entity.passives.onKill && entity.passives.onKillStacks > 0 && (key === "atk" || key === "mag" || key === "def" || key === "spd")) {
    entity.passives.onKill.statMult.forEach((sm) => {
      if (sm.stat !== key) return;
      const totalMult = 1 + (sm.mult - 1) * entity.passives.onKillStacks;
      result = Math.max(1, Math.round(result * totalMult));
    });
  }
  // 野営「武器の手入れ」の攻撃力バフ(戦闘回数でカウントするため、ターン基準のstatModsとは別枠)
  if (key === "atk" && entity.campWeaponCareBattles > 0) {
    result = Math.max(1, Math.round(result * CAMP_WEAPON_CARE_ATK_MULT));
  }
  return result;
}

// 野営: HP/MPを割合回復し、ストレスを固定量回復する(宿泊とは異なり全回復ではない)
function useCampRest(character) {
  character.hp = Math.min(character.maxHp, character.hp + Math.round(character.maxHp * CAMP_HP_RELIEF));
  character.mp = Math.min(character.maxMp, character.mp + Math.round(character.maxMp * CAMP_MP_RELIEF));
  character.fatigue = Math.max(0, (character.fatigue || 0) - CAMP_STRESS_RELIEF);
}

// 一時的なステータス修正(バフ/デバフ)を付与する。同じstatへの既存の修正は上書き(重ね掛けで際限なく増えないように)
function applyStatMod(entity, stat, mult, turns) {
  entity.statMods = entity.statMods || [];
  const existing = entity.statMods.find((m) => m.stat === stat);
  if (existing) { existing.mult = mult; existing.turns = turns; }
  else entity.statMods.push({ stat, mult, turns });
}
// 自分のターンが来るたびに残りターン数を1減らし、0になったものは消す
function tickStatMods(entity) {
  if (!entity.statMods || !entity.statMods.length) return;
  entity.statMods.forEach((m) => { m.turns--; });
  entity.statMods = entity.statMods.filter((m) => m.turns > 0);
}

const POISON_MAX_STACKS = 6; // OP化を防ぐための毒蓄積の上限
// 毒を付与する。重ね掛けは加算ではなく現在値との大きい方に上書きする(無限に積み上がらないように)
function applyPoison(entity, stacks) {
  if (entity.statusImmuneTurns > 0) return;
  entity.poison = Math.min(POISON_MAX_STACKS, Math.max(entity.poison || 0, stacks));
}
// 毒: 自分のターンが来るたびに蓄積値分のダメージを受け、蓄積値が1減る(ダーケストダンジョン方式)
function tickPoison(entity, log) {
  if (!entity.poison || entity.poison <= 0) return 0;
  const dmg = Math.min(entity.hp, entity.poison);
  entity.hp = Math.max(0, entity.hp - entity.poison);
  log(`${entity.label}は毒で${dmg}ダメージ！`);
  entity.poison = Math.max(0, entity.poison - 1);
  return dmg;
}
// 炎上: 毒(固定ダメージ・蓄積減衰)とは違う性質のDOTとして、最大HPの割合ダメージ・ターン数固定(減衰なし)にしてある。
// 低HPの相手には毒が、高HPのタンク相手には炎上がよく効く、という住み分けを狙った設計
function applyBurn(entity, turns) {
  if (entity.statusImmuneTurns > 0) return;
  entity.burnTurns = Math.max(entity.burnTurns || 0, turns);
}
const BLEED_MAX_STACKS = 5; // 毒(6)よりわずかに低い上限。海岸ステージの敵向け新DOT
// 裂傷: 毒と全く同じ蓄積減衰式のDOTだが、技側の付与量を毒より低めに設定する運用にしてあり
// (毒を与える技より裂傷を与える技の方が数値が小さくなりがち)、代わりに裂傷中は常時攻撃力-10%が乗る(effectiveStat側)
function applyBleed(entity, stacks) {
  if (entity.statusImmuneTurns > 0) return;
  entity.bleed = Math.min(BLEED_MAX_STACKS, Math.max(entity.bleed || 0, stacks));
}
function tickBleed(entity, log) {
  if (!entity.bleed || entity.bleed <= 0) return 0;
  const dmg = Math.min(entity.hp, entity.bleed);
  entity.hp = Math.max(0, entity.hp - entity.bleed);
  log(`${entity.label}は裂傷で${dmg}ダメージ！`);
  entity.bleed = Math.max(0, entity.bleed - 1);
  return dmg;
}
// 戦闘終了時(勝利/逃走)に、生き残った味方の毒/炎上/裂傷を自動的に治す。戦闘のたびに持ち越される
// 鬱陶しさをなくすための措置(スタン等の他の状態異常はターン制でその場で切れるため対象外)
function clearDotEffects(characters) {
  characters.forEach((c) => { c.poison = 0; c.burnTurns = 0; c.bleed = 0; });
}
function tickBurn(entity, log) {
  if (!entity.burnTurns || entity.burnTurns <= 0) return 0;
  const dmg = Math.max(1, Math.round(entity.maxHp * BURN_DAMAGE_PCT));
  entity.hp = Math.max(0, entity.hp - dmg);
  log(`${entity.label}は炎上で${dmg}ダメージ！`);
  entity.burnTurns--;
  return dmg;
}
function applyStun(entity, turns) {
  if (entity.statusImmuneTurns > 0) return;
  entity.stunTurns = Math.max(entity.stunTurns || 0, turns);
  // スタンした相手には一定ターン、スタン抵抗(resistedChance側で参照)を大幅に付与する。
  // 連続でスタンし続けられる「スタンロック」を防ぐための措置(通常のstatusResistMultとは別枠)
  entity.stunResistTurns = Math.max(entity.stunResistTurns || 0, STUN_RESIST_TURNS);
  // 大技の構え中(bigAttackPending)にスタンが入ると、構え自体を完全に潰す(止める対抗策)
  if (entity.bigAttackPending) {
    entity.bigAttackPending = false;
    entity.bigAttackCounter = 0;
  }
}
function applySilence(entity, turns) {
  if (entity.statusImmuneTurns > 0) return;
  entity.silenceTurns = Math.max(entity.silenceTurns || 0, turns);
}
// 自分のターンの一番最初に呼ぶ共通処理(毒/炎上のダメージ+継続回復+バフ/デバフの残りターン消化)。ダメージ量を返す
function tickTurnStartEffects(entity, log) {
  if (entity.stunResistTurns > 0) entity.stunResistTurns--;
  const dmg = tickPoison(entity, log) + tickBurn(entity, log) + tickBleed(entity, log);
  // 温泉バフ「湯治」: 自分のターンの最初に毎回HPの2%を回復する
  if (entity.hp > 0 && entity.onsenBuffKey === "touji") {
    const heal = Math.max(1, Math.round(entity.maxHp * 0.02));
    entity.hp = Math.min(entity.maxHp, entity.hp + heal);
    log(`${entity.label}は湯治の効果で${heal}回復した！`);
  }
  // hpRegenPct: statMods便乗の継続回復タグ(mult欄に割合を入れて流用)。明鏡止水・仁王立ちなど
  if (entity.hp > 0 && entity.statMods) {
    entity.statMods.forEach((m) => {
      if (m.stat === "hpRegenPct") {
        const heal = Math.max(1, Math.round(entity.maxHp * m.mult));
        entity.hp = Math.min(entity.maxHp, entity.hp + heal);
        log(`${entity.label}は${heal}回復した！`);
      }
    });
  }
  tickStatMods(entity);
  if (entity.statusImmuneTurns > 0) entity.statusImmuneTurns--;
  if (entity.tauntTurns > 0) entity.tauntTurns--;
  if (entity.passives && entity.passives.onKillStacks > 0) {
    entity.passives.onKillStacksTurns--;
    if (entity.passives.onKillStacksTurns <= 0) entity.passives.onKillStacks = 0;
  }
  return dmg;
}

// 装備購入後、既存の該当職業メンバー全員のequipBonusを再計算する
function refreshEquipBonus(characters, classId, classUpgrades) {
  const bonus = computeEquipBonus(classId, classUpgrades);
  const baseMaxMp = baseMaxMpFor(classId);
  characters.forEach((c) => {
    if (c.classId === classId) {
      c.equipBonus = bonus;
      const newMaxMp = baseMaxMp + (bonus.mp || 0);
      const delta = newMaxMp - c.maxMp;
      c.maxMp = newMaxMp;
      c.mp = Math.max(0, Math.min(newMaxMp, c.mp + delta)); // MP上限が増えた分、現在MPにもそのまま上乗せする
    }
  });
}

// 魔力0の物理職(盗賊/忍者/戦士/侍)にも最低10のMPを持たせてあるので、自分の技は使える。
// MPはレベルアップで伸びなくなった(下記levelUp参照)ため、一度の遠征で4〜5回使える程度を目安に
// guard以外は旧コストの半分にしてある。guardは他の技より軽いが、無制限に連発できないよう1だけ消費させる
const ABILITY_MP_COST = { magicAttack: 3, magicAttackAll: 6, heal: 3, critAttack: 2, powerAttack: 3, physicalAttackAll: 3, preciseShot: 2, cannonShot: 4, guard: 1 };
function abilityMpCost(abilityType, actor) {
  let cost = ABILITY_MP_COST[abilityType] || 0;
  // 温泉バフ「英気充填」: MP消費-10%
  if (actor && actor.onsenBuffKey === "eikijuten") cost = Math.max(0, Math.round(cost * 0.9));
  return cost;
}

function grantXp(character, amount, log) {
  if (character.status !== "active") return;
  if (character.level >= MAX_LEVEL) return; // 上限到達後は経験値を受け取らない(溜まり続けるのを防ぐ)
  character.xp += amount;
  let guardCounter = 0;
  while (character.level < MAX_LEVEL && character.xp >= xpToNext(character.level) && guardCounter < 50) {
    character.xp -= xpToNext(character.level);
    levelUp(character, log);
    guardCounter++;
  }
  if (character.level >= MAX_LEVEL) character.xp = 0;
}

// 防御力による軽減率(割合軽減式)。K/(K+def)で、defが増えるほど軽減率は上がるが常に伸びが緩やかになり、
// どれだけ防御力を積んでも生ダメージが0になることはない(旧: atk - def×係数 という引き算式は、
// 防御力を積むほど直線的に効きが増して「攻撃がほぼ通らない」状態を作れてしまっていたため、割合式に全面刷新した)。
// Kが小さいほど防御力の影響を強く受ける(=防御貫通しやすい/軽減されにくい)技になる
function mitigation(def, K) {
  return K / (K + Math.max(0, def));
}
// 命中した際の最終ダメージにランダムな幅(±pct)を掛ける。割合式では加算乱数より掛け算の方が自然
function withVariance(value, pct) {
  return value * (1 + (Math.random() * 2 - 1) * pct);
}
function rollBasicAttack(atk, def) {
  return Math.max(1, Math.round(withVariance(atk * mitigation(def, 18), 0.15)));
}
function rollMagicAttack(mag, def) {
  return Math.max(1, Math.round(withVariance(mag * 1.8 * mitigation(def, 8), 0.12)));
}
function rollPowerAttack(atk, def) {
  return Math.max(1, Math.round(withVariance(atk * 1.6 * mitigation(def, 22), 0.15)));
}
function rollCritAttack(atk, def) {
  return Math.max(1, Math.round(withVariance(atk * 1.56 * mitigation(def, 12), 0.15))); // ユーザー指示で威力を1.2倍(1.3→1.56)
}
// 狩人の会心の一矢。会心の一撃と同じ防御貫通の性質(弓は鎧の隙間を狙う)
function rollPreciseShot(atk, def) {
  return Math.max(1, Math.round(withVariance(atk * 1.485 * mitigation(def, 12), 0.15)));
}
// 砲術士の砲撃。渾身の一撃よりさらに重いが、使うと次のターンは装填で動けなくなる(呼び出し側で処理)
function rollCannonShot(atk, def) {
  return Math.max(1, Math.round(withVariance(atk * 2.4 * mitigation(def, 26), 0.2)));
}
function rollHeal(mag) {
  return Math.max(5, Math.round(mag * 1.5 + Math.random() * 5));
}

// ============ スキルツリー(XCOM風、レベルアップごとに2択で1つ選ぶ) ============
// character.passives: 選んだ受動スキルの効果をまとめて蓄積するオブジェクト(常時参照される)
function initPassives() {
  return {
    atkMult: 1, defMult: 1, spdMult: 1, // hpMultは適用時に直接maxHpへ反映するのでここでは保持しない
    critRateAdd: 0, critDmgAdd: 0, accuracyAdd: 0, evasionAdd: 0,
    statusResistMult: 0, dodgeChance: 0, counterChance: 0, counterMult: 1,
    mpDiscountPct: 0, mpRefundChance: 0,
    onceGuardType: null, onceGuardUsed: false,
    firstAttackBonusMult: 0, firstAttackUsed: false,
    onKill: null, // {statMult:[{stat,mult}], turns, maxStacks}
    onKillStacks: 0, onKillStacksTurns: 0,
    onHitInflicts: [], // [{type, chance, value, turns}] 通常攻撃に乗る状態異常付与(複数スキルぶん積み上がる)
    executeBonus: null, // {belowPct, mult} HPが閾値以下の相手への追加ダメージ倍率
    executeCritBonus: [], // [{belowPct, addRate, cmp}] 対象のHP割合条件つき追加会心率(剣豪など)。配列なので閾値違いを複数持てる
    woundBonuses: [], // [{mult, ailment}] 状態異常(ailment未指定なら何らかの状態異常全般、指定時はそれだけ)を負っている相手への追加ダメージ倍率。
    // 同じクラスが複数のailment条件違いを選べるよう配列にしてある(単一フィールドだと後から選んだ方が上書きしてしまうため)
    conditionalMods: [], // [{cmp, value, statMult:[{stat,mult}]|null, dmgTakenMult:number|null, evasionAdd:number|null}] (stat基準は常にhpPct)
    flagMods: [], // [{flag, stat, mult}] entity自身の一時状態(tauntTurns/reloading/guardingなど)が真の間だけ乗算する汎用フック
    evadeCritCounter: false, // 回避に成功した直後、次の自分の攻撃が確定会心になる(反射神経など)
    onCritSelfBuff: null, // {stat, mult} 自分が会心を出した直後、次の自分の1ターンだけそのステータスが上がる(連斬など)
    fasterFoeDmgReduction: null, // 数値(mult) 自分より素早い相手から受けるダメージを軽減する(疾風など)
    ailmentCritBonus: [], // [{ailment, addRate}] 対象が特定の状態異常を負っている時の追加会心率(毒を負わせた敵に会心、など)。配列なので複数のailment条件を持てる
    onEvadeSelfBuff: null, // {stat, mult} 回避に成功した直後、次の自分の1ターンだけそのステータスが上がる(影分身など)
    executeAccuracyBonus: null, // {belowPct, addRate, cmp} 対象のHP割合条件つき命中率ボーナス(弱点看破など)
    comboFollowup: [], // [{tag, stat, mult}] 特定のcomboTag技を使った直後、次の自分の1ターンだけ効果を得る(連射の心得など)。配列なので同じ技に複数の追撃効果を紐付けられる
    discountWhileFlag: null, // {statModName, pct} 特定のstatMod(reloadImmuneなど)が有効な間だけMP消費を追加割引する(装填術など)
    healBonusRules: [], // [{trigger:"targetHpBelow"|"selfHpAbove"|"onCleanse", value, mult}] 回復量への条件つき倍率(治癒術・慈愛など)
    mpOnCleanse: 0, // 状態異常を解除する回復/バフを使うたび、これだけMPが回復する(生命力循環など)
  };
}
const BASE_CRIT_RATE = 0.05; // 全キャラ共通の会心率の下限(スキルツリーで底上げされる)
const BASE_CRIT_DMG_MULT = 1.5; // 会心時のダメージ倍率の基準(スキルツリーでさらに加算される)

// レベルアップで選んだスキルを反映する。受動効果はpassivesに蓄積し、能動スキルはunlockedSkillsに追加する。
// level引数は「このスキルを選んだのはレベル何の時か」を明示的に渡すためのもの。
// character.levelを使わない理由: 1戦で2レベル以上連続で上がった場合、スキル選択が全て終わる前に
// character.levelは既に最終レベルまで進んでしまっているため、character.levelをキーに使うと
// 複数のレベル分の選択が同じキーに上書きされて記録が消えてしまうバグがあった
function applySkillChoice(character, skill, level) {
  character.skills = character.skills || {};
  character.skills[level] = skill.side;
  if (skill.passive) {
    const p = character.passives;
    const add = skill.passive;
    if (add.atkMult) p.atkMult *= add.atkMult;
    if (add.defMult) p.defMult *= add.defMult;
    if (add.spdMult) p.spdMult *= add.spdMult;
    if (add.hpMult) {
      // maxHpはeffectiveStat経由ではなく直接持つ値なので、levelUpと同じ要領でその場で底上げする
      const oldMax = character.maxHp;
      character.maxHp = Math.round(character.maxHp * add.hpMult);
      character.hp += character.maxHp - oldMax;
    }
    if (add.critRateAdd) p.critRateAdd += add.critRateAdd;
    if (add.critDmgAdd) p.critDmgAdd += add.critDmgAdd;
    if (add.accuracyAdd) p.accuracyAdd += add.accuracyAdd;
    if (add.evasionAdd) p.evasionAdd += add.evasionAdd;
    if (add.statusResistMult) p.statusResistMult = Math.min(0.9, p.statusResistMult + add.statusResistMult);
    if (add.dodgeChance) p.dodgeChance = Math.min(0.6, p.dodgeChance + add.dodgeChance);
    if (add.counterChance) { p.counterChance = Math.min(0.6, p.counterChance + add.counterChance); p.counterMult = add.counterMult || p.counterMult; }
    if (add.mpDiscountPct) p.mpDiscountPct = Math.min(0.6, p.mpDiscountPct + add.mpDiscountPct);
    if (add.mpRefundChance) p.mpRefundChance = Math.min(0.6, p.mpRefundChance + add.mpRefundChance);
    if (add.onceGuardType) p.onceGuardType = add.onceGuardType;
    if (add.firstAttackBonusMult) p.firstAttackBonusMult = add.firstAttackBonusMult;
    if (add.onKill) p.onKill = add.onKill;
    if (add.conditionalMod) p.conditionalMods.push(add.conditionalMod);
    if (add.onHitInflict) p.onHitInflicts.push(add.onHitInflict);
    if (add.executeBonus) p.executeBonus = add.executeBonus;
    if (add.executeCritBonus) p.executeCritBonus.push(add.executeCritBonus);
    if (add.woundBonus) p.woundBonuses.push(add.woundBonus);
    if (add.flagMod) p.flagMods.push(add.flagMod);
    if (add.evadeCritCounter) p.evadeCritCounter = true;
    if (add.onCritSelfBuff) p.onCritSelfBuff = add.onCritSelfBuff;
    if (add.fasterFoeDmgReduction) p.fasterFoeDmgReduction = add.fasterFoeDmgReduction;
    if (add.ailmentCritBonus) p.ailmentCritBonus.push(add.ailmentCritBonus);
    if (add.onEvadeSelfBuff) p.onEvadeSelfBuff = add.onEvadeSelfBuff;
    if (add.executeAccuracyBonus) p.executeAccuracyBonus = add.executeAccuracyBonus;
    if (add.comboFollowup) p.comboFollowup.push(add.comboFollowup);
    if (add.discountWhileFlag) p.discountWhileFlag = add.discountWhileFlag;
    if (add.healBonusRule) p.healBonusRules.push(add.healBonusRule);
    if (add.mpOnCleanse) p.mpOnCleanse += add.mpOnCleanse;
  }
  if (skill.action) {
    character.unlockedSkills = character.unlockedSkills || [];
    character.unlockedSkills.push({ id: skill.id, name: skill.name, mp: skill.mp, action: skill.action, comboTag: skill.comboTag });
  }
}

// HP割合条件つきの受動効果(気迫・武士道など)を、現在のHPに応じて都度評価する
function activeConditionalMods(character) {
  if (!character.passives || !character.passives.conditionalMods.length) return [];
  const hpPct = character.maxHp > 0 ? character.hp / character.maxHp : 1;
  return character.passives.conditionalMods.filter((m) => (m.cmp === "gte" ? hpPct >= m.value : hpPct <= m.value));
}
// 被ダメージ軽減系の受動効果(気迫・仁王立ちなど、statMods経由のものも含む)をまとめて乗算で返す
// 回復量に影響する条件つきボーナスをまとめて判定する(治癒術・慈愛・生命の奇跡・慈悲の心など)。
// targetHpBelow: 対象のHP割合が閾値以下 / selfHpAbove: 自分(施術者)のHP割合が閾値以上 / onCleanse: 状態異常解除を伴う回復の時
function healBonusMultiplier(actor, target, wasCleanse) {
  let mult = 1;
  if (!actor.passives || !actor.passives.healBonusRules || !actor.passives.healBonusRules.length) return mult;
  actor.passives.healBonusRules.forEach((r) => {
    if (r.trigger === "targetHpBelow" && target && target.maxHp > 0 && target.hp / target.maxHp <= r.value) mult *= r.mult;
    if (r.trigger === "selfHpAbove" && actor.maxHp > 0 && actor.hp / actor.maxHp >= r.value) mult *= r.mult;
    if (r.trigger === "onCleanse" && wasCleanse) mult *= r.mult;
  });
  return mult;
}
function damageTakenMultiplier(character) {
  let mult = 1;
  activeConditionalMods(character).forEach((m) => { if (m.dmgTakenMult) mult *= m.dmgTakenMult; });
  if (character.statMods) character.statMods.forEach((m) => { if (m.stat === "dmgTaken") mult *= m.mult; });
  if (character.passives && character.passives.flagMods) {
    character.passives.flagMods.forEach((fm) => { if (fm.stat === "dmgTaken" && character[fm.flag]) mult *= fm.mult; });
  }
  return mult;
}
// 会心判定。会心なら会心時ダメージ倍率を、外れなら1を返す
function rollCritMultiplier(actor, extraCritRate, target) {
  const p = actor.passives;
  if (!p) return 1;
  // 直前に回避成功した時などに1回だけ立つ「次の攻撃は確定会心」フラグ(反射神経など)。使ったら消費する
  if (actor.guaranteedCritNext) {
    actor.guaranteedCritNext = false;
    return BASE_CRIT_DMG_MULT + p.critDmgAdd;
  }
  // 温泉バフ「気分爽快」: 会心率+5%
  const onsenCritBonus = actor.onsenBuffKey === "kibunsoukai" ? 0.05 : 0;
  // 対象のHP割合条件つき会心率ボーナス(剣豪など、弱った敵ほど会心が出やすい系。cmp:"gte"なら逆に高HP時に発動)。
  // 配列なので閾値違いを複数持てる場合は全部チェックして合算する
  let executeCritAdd = 0;
  if (p.executeCritBonus && p.executeCritBonus.length && target && target.maxHp > 0) {
    const hpPct = target.hp / target.maxHp;
    p.executeCritBonus.forEach((eb) => {
      const matched = (eb.cmp || "lte") === "lte" ? hpPct <= eb.belowPct : hpPct >= eb.belowPct;
      if (matched) executeCritAdd += eb.addRate;
    });
  }
  // 対象が特定の状態異常を負っている時の追加会心率(毒を負わせた敵に会心、など)。複数条件を合算する
  let ailmentCritAdd = 0;
  if (p.ailmentCritBonus && p.ailmentCritBonus.length && target) {
    p.ailmentCritBonus.forEach((ac) => { if (hasSpecificAilment(target, ac.ailment)) ailmentCritAdd += ac.addRate; });
  }
  const rate = BASE_CRIT_RATE + p.critRateAdd + onsenCritBonus + executeCritAdd + ailmentCritAdd + (extraCritRate || 0);
  if (Math.random() < rate) return BASE_CRIT_DMG_MULT + p.critDmgAdd;
  return 1;
}
// スキルツリーの技のMPコストに、そのキャラのMP割引を適用する
function skillMpCost(actor, baseMp) {
  let discount = (actor.passives && actor.passives.mpDiscountPct) || 0;
  // 温泉バフ「英気充填」: MP消費-10%(他の割引と乗算ではなく加算で重ねる)
  if (actor.onsenBuffKey === "eikijuten") discount += 0.1;
  // 特定のstatMod(土嚢展開のreloadImmuneなど)が有効な間だけ追加割引(装填術など)
  if (actor.passives && actor.passives.discountWhileFlag && actor.statMods) {
    const d = actor.passives.discountWhileFlag;
    if (actor.statMods.some((m) => m.stat === d.statModName)) discount += d.pct;
  }
  return Math.max(0, Math.round(baseMp * (1 - discount)));
}
// 状態異常の付与確率に、対象の耐性(statusResistMult)を適用する。
// typeが"stun"かつ対象がスタン抵抗中(stunResistTurns>0、直近でスタンされた直後)の場合は、
// 通常のstatusResistMultとは別枠でさらに大きく確率を下げる(連続スタンロック防止)
function resistedChance(target, baseChance, type) {
  let resist = (target.passives && target.passives.statusResistMult) || 0;
  // 温泉バフ「美肌」: 状態異常耐性+20%
  if (target.onsenBuffKey === "bihada") resist += 0.2;
  let chance = baseChance * (1 - resist);
  if (type === "stun" && target.stunResistTurns > 0) chance *= STUN_RESIST_MULT;
  return chance;
}

// スキルツリーの能動スキル(単体/範囲攻撃、バフ、回復など)を実行する汎用リゾルバ。
// target: 単体系はentity1体、範囲系(action.aoe)は配列
function useTreeSkill(actor, target, skill, log) {
  const action = skill.action;
  const cost = skillMpCost(actor, skill.mp);
  if (cost > 0) {
    if (actor.mp < cost) { log(`${actor.label}はMPが足りない！`); return { failed: true }; }
    const refund = actor.passives && Math.random() < actor.passives.mpRefundChance;
    if (!refund) actor.mp -= cost;
  }
  // コンボタグ: 特定の技(comboTagで印付け)を使った時点で、次の自分の1ターンだけ効果を得る受動を発動する
  // (連射の心得・式神召喚など)。actionの種類(damage/heal/buffSelf等)を問わず「使った」時点で一律に判定する
  if (skill.comboTag && actor.passives && actor.passives.comboFollowup && actor.passives.comboFollowup.length) {
    actor.passives.comboFollowup.forEach((f) => {
      if (f.tag === skill.comboTag) applyStatMod(actor, f.stat, f.mult, 2);
    });
  }
  if (action.kind === "buffSelf" || action.kind === "buffParty") {
    const targets = action.kind === "buffParty" ? target : [actor];
    targets.forEach((t) => {
      (action.stats || []).forEach((s) => applyStatMod(t, s.stat, s.mult, action.turns));
      if (action.hpRegenPct) applyStatMod(t, "hpRegenPct", action.hpRegenPct, action.turns); // effectiveStatでは使わず、tick時に直接参照する目印として保持
      if (action.cleanse) {
        t.poison = 0; t.burnTurns = 0; t.bleed = 0; t.stunTurns = 0; t.silenceTurns = 0;
        if (actor.passives && actor.passives.mpOnCleanse) actor.mp = Math.min(actor.maxMp, actor.mp + actor.passives.mpOnCleanse);
      }
      if (action.statusImmuneTurns) t.statusImmuneTurns = Math.max(t.statusImmuneTurns || 0, action.statusImmuneTurns);
      if (action.tauntTurns) t.tauntTurns = Math.max(t.tauntTurns || 0, action.tauntTurns);
    });
    log(`${actor.label}は${skill.name}を使った！`);
    return { buffed: true };
  }
  if (action.kind === "heal") {
    const targets = action.aoe ? target : [target];
    const heals = targets.map((t) => {
      const bonusMult = healBonusMultiplier(actor, t, !!action.cleanse);
      const heal = Math.round(applyOnsenHealBonus(t, Math.max(1, Math.round(t.maxHp * action.healPct))) * bonusMult);
      if (t.status === "critical" && action.reviveHpPct) {
        return { target: t, revived: true, heal: 0 };
      }
      t.hp = Math.min(t.maxHp, t.hp + heal);
      if (action.cleanse) {
        t.poison = 0; t.burnTurns = 0; t.bleed = 0; t.stunTurns = 0; t.silenceTurns = 0;
        if (actor.passives && actor.passives.mpOnCleanse) actor.mp = Math.min(actor.maxMp, actor.mp + actor.passives.mpOnCleanse);
      }
      log(`${actor.label}は${t.label}を${heal}回復！`);
      return { target: t, heal };
    });
    return { healed: heals };
  }
  // selfReload: 砲術士の一部の技(貫通弾・一斉砲撃など)は、命中/回避に関わらず撃てば次の自分のターンは
  // 装填で動けなくなる(cannonShotと同じ仕様)。大威力の代わりに手数が落ちる、というトレードオフの表現
  if (action.selfReload) actor.reloading = true;
  // ダメージ系(単体/範囲/連撃)。会心判定/被ダメージ軽減/覚悟等の一度きり効果/反撃はapplyDamageToTarget側で一括処理する
  const targets = action.aoe ? target : [target];
  const results = targets.map((t) => {
    if (!action.guaranteedHit && !rollHit(actor, t)) {
      log(`${t.label}は${actor.label}の${skill.name}をかわした！`);
      return { hit: false, dmg: 0 };
    }
    const hits = action.hits || 1;
    const atkStat = action.useMag ? effectiveStat(actor, "mag") : effectiveStat(actor, "atk");
    const defPierce = action.defPierce || 0;
    const def = effectiveStat(t, "def") * (1 - defPierce);
    let rawTotal = 0;
    for (let i = 0; i < hits; i++) {
      rawTotal += Math.max(1, Math.round(withVariance(atkStat * (action.mult / hits) * mitigation(def, 15), 0.15)));
    }
    const hpPct = t.maxHp > 0 ? t.hp / t.maxHp : 1;
    if (action.executeBonus && hpPct <= action.executeBonus.belowPct) rawTotal = Math.round(rawTotal * action.executeBonus.mult);
    const dmg = applyDamageToTarget(t, rawTotal, log, actor.label, actor);
    if (action.inflict && Math.random() < resistedChance(t, action.inflict.chance, action.inflict.type)) {
      if (action.inflict.type === "poison") applyPoison(t, action.inflict.value || 3);
      if (action.inflict.type === "bleed") applyBleed(t, action.inflict.value || 2);
      if (action.inflict.type === "burn") applyBurn(t, action.inflict.turns || 3);
      if (action.inflict.type === "stun") applyStun(t, action.inflict.turns || 1);
      if (action.inflict.type === "silence") applySilence(t, action.inflict.turns || 2);
      if (action.inflict.type === "atkDown") applyStatMod(t, "atk", 1 - (action.inflict.value || 0.2), action.inflict.turns || 3);
      if (action.inflict.type === "defDown") applyStatMod(t, "def", 1 - (action.inflict.value || 0.2), action.inflict.turns || 3);
      if (action.inflict.type === "spdDown") applyStatMod(t, "spd", 1 - (action.inflict.value || 0.2), action.inflict.turns || 3);
      if (action.inflict.type === "dmgTakenUp") applyStatMod(t, "dmgTaken", 1 + (action.inflict.value || 0.1), action.inflict.turns || 3);
    }
    return { hit: true, dmg };
  });
  return { dmgs: results };
}

// 現在のフロアに応じて敵を1体抽選する(内部用)。深さによる強さの違いはENEMIESの4段階ティア
// (序盤/中盤/後半/終盤、ティアごとに素の平均ステータスが約1.6〜2.1倍ずつ伸びる設計)に任せており、
// 階層に応じて変動する倍率は持たない(ENEMY_SCALE/ENEMY_DEF_SCALEは常に一定)。
// onlyBoss=trueの場合はそのフロアで出現可能なボスだけに絞る(ボスフロアで確実にボスを出すため)
// mode: true(旧onlyBossの後方互換) = ボスのみ、"swarm" = 大群系のみ、それ以外 = 通常(大群系は除外。
// 大群系はpickEncounterForFloorの枠抽選経由でのみ出す)
function pickEnemyForFloor(floor, mode, stage) {
  const eligible = Object.values(ENEMIES).filter((e) => {
    if ((e.stage || "forest") !== (stage || "forest")) return false;
    if (floor < e.minFloor || floor > e.maxFloor) return false;
    if (mode === true) return !!e.isBoss;
    if (mode === "swarm") return !!e.isSwarm;
    return !e.isSwarm;
  });
  if (mode === true && eligible.length === 0) return null;
  const weighted = [];
  eligible.forEach((e) => {
    const weight = e.isBoss ? (floor % 10 === 0 ? 6 : 1) : 10;
    for (let i = 0; i < weight; i++) weighted.push(e);
  });
  const pick = weighted[Math.floor(Math.random() * weighted.length)];
  const hp = Math.round(pick.hp * ENEMY_SCALE * (pick.isSwarm ? 1 : ENEMY_HP_MULT));
  return {
    ...pick,
    instanceId: "e" + __enemySeq++,
    label: pick.ja,
    hp,
    maxHp: hp,
    atk: Math.round(pick.atk * ENEMY_SCALE * ENEMY_ATK_MULT * (pick.isSwarm ? ENEMY_SWARM_ATK_MULT : 1)),
    def: Math.round(pick.def * ENEMY_DEF_SCALE),
    // 大技サイクルの開始位置を0〜2からランダムにずらす(複数体が同時に予告/発動しないようにするため)
    bigAttackCounter: Math.floor(Math.random() * (BIG_ATTACK_CYCLE_LENGTH - 1)),
    bigAttackPending: false,
  };
}

// そのフロアの遭遇を組み立てる。ボスフロア(10の倍数)は必ず単体。
// それ以外は、まず「大群が絡むか」を1回だけ判定し(SWARM_ENCOUNTER_CHANCE)、絡む場合は
// pickSwarmInvolvedEncounterで直接まとめて組み立てる(3枠それぞれ独立に大群判定すると、
// 6体まで揃う確率が0.15^3のようにほぼ0まで潰れてしまうため、複数回のサイコロを重ねる設計を避けた)。
// 絡まない場合は従来通り1〜3体の通常敵のみ。
// 雑魚集団は範囲攻撃(魔法使いのメテオ/忍者の乱れ突き)で効率よく削れる、という職業差別化の要
function pickEncounterForFloor(floor, stage) {
  if (floor % 10 === 0) {
    const boss = pickEnemyForFloor(floor, true, stage);
    return [boss || pickEnemyForFloor(floor, undefined, stage)];
  }
  const hasSwarmHere = Object.values(ENEMIES).some((e) => (e.stage || "forest") === (stage || "forest") && e.isSwarm && floor >= e.minFloor && floor <= e.maxFloor);
  if (hasSwarmHere && Math.random() < SWARM_ENCOUNTER_CHANCE) {
    return applyGroupNerf(pickSwarmInvolvedEncounter(floor, stage));
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
    const e = pickEnemyForFloor(floor, undefined, stage);
    if (e.isBoss) return [e]; // ボス個体が紛れたら単体に差し戻す
    enemies.push(e);
  }
  return applyGroupNerf(enemies);
}

// 大群が絡むと決まった時の中身。65%は「大群のみ3〜6体」(6体の内訳20%=大群絡み全体の13%≒毎回の1.95%程度)、
// 35%は「通常1〜2体+大群2体」の混成にする
function pickSwarmInvolvedEncounter(floor, stage) {
  const enemies = [];
  if (Math.random() < 0.65) {
    const roll = Math.random();
    let swarmCount;
    if (roll < 0.15) swarmCount = 3;
    else if (roll < 0.5) swarmCount = 4;
    else if (roll < 0.8) swarmCount = 5;
    else swarmCount = 6;
    for (let i = 0; i < swarmCount; i++) enemies.push(pickEnemyForFloor(floor, "swarm", stage));
  } else {
    const normalCount = Math.random() < 0.5 ? 1 : 2;
    for (let i = 0; i < normalCount; i++) {
      const e = pickEnemyForFloor(floor, undefined, stage);
      if (!e.isBoss) enemies.push(e); // ボスが紛れたらこの枠は諦める(滅多に起きない)
    }
    for (let i = 0; i < 2; i++) enemies.push(pickEnemyForFloor(floor, "swarm", stage));
  }
  return enemies;
}

// 頭数が多いほど、行動回数(=敵側の総攻撃回数)が増えて理不尽にならないよう1体あたりの数値を弱める
function applyGroupNerf(enemies) {
  if (enemies.length > 1) {
    const nerfTable = { 2: 0.8, 3: 0.65, 4: 0.55, 5: 0.48, 6: 0.42 };
    const nerf = nerfTable[enemies.length] || 0.4;
    enemies.forEach((e) => {
      e.hp = Math.max(1, Math.round(e.hp * nerf));
      e.maxHp = e.hp;
      e.atk = Math.max(1, Math.round(e.atk * nerf));
    });
  }
  return enemies;
}

const TRASH_MOB_GOLD_MULT = 0.9; // 雑魚(非ボス)戦のゴールド報酬を10%ナーフ。ボスはそのまま
function goldReward(enemy) {
  const base = enemy.goldMin + Math.floor(Math.random() * (enemy.goldMax - enemy.goldMin + 1));
  return enemy.isBoss ? base : Math.round(base * TRASH_MOB_GOLD_MULT);
}

// 素早さが高いほど回避率が上がる(敵にはfatigueが無いので疲労減衰の影響は受けない)。
// 逃走準備中(fleeState==="preparing")は、逃げ出そうと隙を伺っている分+25%回避率が上がる
function evasionChance(entity) {
  const spd = effectiveStat(entity, "spd");
  const base = Math.max(0, Math.min(EVASION_MAX, (spd - EVASION_SPD_BASELINE) * EVASION_SPD_FACTOR));
  const passiveAdd = (entity.passives && entity.passives.evasionAdd) || 0;
  let timedAdd = 0;
  if (entity.statMods) entity.statMods.forEach((m) => { if (m.stat === "evasionAdd") timedAdd += m.mult; });
  // HP割合条件つきの回避ボーナス(見切りなど)
  let condAdd = 0;
  if (entity.passives && entity.passives.conditionalMods && entity.passives.conditionalMods.length) {
    activeConditionalMods(entity).forEach((m) => { if (m.evasionAdd) condAdd += m.evasionAdd; });
  }
  // 状態フラグ条件つきの回避ボーナス(flagModsのうちstat==="evasionAdd"のもの、加算方式)
  if (entity.passives && entity.passives.flagMods) {
    entity.passives.flagMods.forEach((fm) => { if (fm.stat === "evasionAdd" && entity[fm.flag]) condAdd += fm.mult; });
  }
  const fleeingAdd = entity.fleeState === "preparing" ? 0.25 : 0;
  return Math.min(0.9, base + passiveAdd + timedAdd + condAdd + fleeingAdd);
}
function accuracyOf(entity, target) {
  const base = entity.accuracy != null ? entity.accuracy : BASE_ACCURACY;
  let addTotal = (entity.passives && entity.passives.accuracyAdd) || 0;
  if (entity.statMods) entity.statMods.forEach((m) => { if (m.stat === "accuracyAdd") addTotal += m.mult; });
  // 対象のHP割合条件つき命中率ボーナス(弱点看破など)
  if (entity.passives && entity.passives.executeAccuracyBonus && target && target.maxHp > 0) {
    const b = entity.passives.executeAccuracyBonus;
    const hpPct = target.hp / target.maxHp;
    const matched = (b.cmp || "lte") === "lte" ? hpPct <= b.belowPct : hpPct >= b.belowPct;
    if (matched) addTotal += b.addRate;
  }
  return Math.min(0.99, base + addTotal);
}
// 命中判定。相手の回避率でどれだけ削られてもMIN_HIT_CHANCE未満にはならない(かわされ過ぎるストレスを避けるため)。
// スキルツリーの「完全回避」系受動(見切り・分身など)は、この命中率とは別枠の追加判定として先に効く
function rollHit(actor, target) {
  let dodge = (target.passives && target.passives.dodgeChance) || 0;
  if (target.statMods) target.statMods.forEach((m) => { if (m.stat === "dodgeChance") dodge += m.mult; });
  if (dodge > 0 && Math.random() < dodge) return false;
  const chance = Math.max(MIN_HIT_CHANCE, Math.min(0.99, accuracyOf(actor, target) - evasionChance(target)));
  return Math.random() < chance;
}

// ダメージ技共通: 外れたら回避ログだけ出してダメージ無しで返す
function rollAttackOrMiss(actor, target, rollFn, log, extraCritRate) {
  if (!rollHit(actor, target)) {
    log(`${target.label}は${actor.label}の攻撃をかわした！`);
    return { hit: false, dmg: null };
  }
  const dmg = applyDamageToTarget(target, rollFn(), log, actor.label, actor, null, extraCritRate);
  return { hit: true, dmg };
}
// 範囲技共通: 対象ごとに個別に命中判定する
function rollAoeAttack(actor, targets, rollFn, log) {
  const hits = [];
  const dmgs = [];
  targets.filter((t) => t.hp > 0).forEach((t) => {
    if (!rollHit(actor, t)) {
      log(`${t.label}は${actor.label}の攻撃をかわした！`);
      hits.push(false);
      dmgs.push(null);
      return;
    }
    const dmg = applyDamageToTarget(t, rollFn(t), log, actor.label, actor);
    hits.push(true);
    dmgs.push(dmg);
  });
  return { hits, dmgs };
}

function performAttack(actor, target, log) {
  return rollAttackOrMiss(actor, target, () => rollBasicAttack(effectiveStat(actor, "atk"), target.def), log);
}

// 直近で敵を倒した攻撃者(全滅時のセリフ抽選で「最後に倒した人物」を優先させるために使う)
let lastEnemyKillActor = null;
// 直近のapplyDamageToTargetで会心が発動したか(index.html側で被弾演出の揺れの強さを決めるのに使う)
let lastHitWasCrit = false;
// 「傷口狙い」系の受動効果が参照する、対象が何らかの状態異常を負っているかどうかの判定。
// 毒/炎上/スタン/沈黙に加え、能力低下(捕縛・崩しなどのstatMods、mult<1のもの)も対象に含める
function hasStatusAilment(target) {
  if ((target.poison || 0) > 0) return true;
  if ((target.burnTurns || 0) > 0) return true;
  if ((target.bleed || 0) > 0) return true;
  if ((target.stunTurns || 0) > 0) return true;
  if ((target.silenceTurns || 0) > 0) return true;
  if (target.statMods && target.statMods.some((m) => m.mult < 1)) return true;
  return false;
}
// woundBonus系の一部スキルは「状態異常全般」ではなく特定の状態異常(炎上/毒/スタン/能力低下)だけを
// 対象にしたい場合があるため、typeを指定できる版を用意する(type未指定ならhasStatusAilmentと同じ)
function hasSpecificAilment(target, type) {
  if (!type) return hasStatusAilment(target);
  if (type === "poison") return (target.poison || 0) > 0;
  if (type === "burn") return (target.burnTurns || 0) > 0;
  if (type === "bleed") return (target.bleed || 0) > 0;
  if (type === "stun") return (target.stunTurns || 0) > 0;
  if (type === "debuff") return !!(target.statMods && target.statMods.some((m) => m.mult < 1));
  return hasStatusAilment(target);
}
// ダメージ適用の共通処理。会心判定/被ダメージ軽減/一度だけの生存効果(覚悟・空蝉)/反撃(迎撃)を
// ここでまとめて処理し、最終的に与えたダメージ量を返す。ログは「静香は鬼火に50ダメージ！」の1行のみ(技名などの装飾は付けない)
function applyDamageToTarget(target, dmg, log, actorLabel, actor, logSuffix, extraCritRate) {
  logSuffix = logSuffix || "";
  if (actor && actor.passives && actor.passives.firstAttackBonusMult > 0 && !actor.passives.firstAttackUsed) {
    dmg = Math.round(dmg * (1 + actor.passives.firstAttackBonusMult));
    actor.passives.firstAttackUsed = true;
  }
  // 常時発動の低HP追撃系の受動効果(暗殺術など): 対象のHPが閾値以下なら全ての攻撃にダメージ加算がかかる
  if (actor && actor.passives && actor.passives.executeBonus) {
    const hpPct = target.maxHp > 0 ? target.hp / target.maxHp : 1;
    if (hpPct <= actor.passives.executeBonus.belowPct) dmg = Math.round(dmg * actor.passives.executeBonus.mult);
  }
  // 傷口狙い系の受動効果: 対象が(指定があれば特定の、無ければ何らかの)状態異常を負っていれば追加ダメージ。
  // 同じクラスが複数持てるよう配列全部をチェックして掛け合わせる
  if (actor && actor.passives && actor.passives.woundBonuses && actor.passives.woundBonuses.length) {
    actor.passives.woundBonuses.forEach((wb) => {
      if (hasSpecificAilment(target, wb.ailment)) dmg = Math.round(dmg * wb.mult);
    });
  }
  lastHitWasCrit = false;
  if (actor) {
    const critMult = rollCritMultiplier(actor, extraCritRate, target);
    dmg = Math.round(dmg * critMult);
    lastHitWasCrit = critMult > 1;
    // 会心を出した直後、次の自分の1ターンだけ効果を得る受動(連斬など)。turns:2は「tickが自分の手番開始時に
    // 先に走る」仕様上、mid-action付与で"次の1ターンだけ"にするための必要値(reloadImmune等と同じ考え方)
    if (lastHitWasCrit && actor.passives && actor.passives.onCritSelfBuff) {
      const b = actor.passives.onCritSelfBuff;
      applyStatMod(actor, b.stat, b.mult, 2);
    }
  }
  // 自分より素早い相手から受けるダメージを軽減する受動(疾風など)。actorは攻撃側なので、
  // 敵からの攻撃(actor=敵)・味方からの攻撃(actor=味方)どちらでも同じロジックで比較できる
  if (target.passives && target.passives.fasterFoeDmgReduction && actor && effectiveStat(actor, "spd") > effectiveStat(target, "spd")) {
    dmg = Math.round(dmg * (1 - target.passives.fasterFoeDmgReduction));
  }
  // 大技の構え中(bigAttackPending)の敵は隙だらけとみなし、受けるダメージが増える(押し切る対抗策)
  if (target.bigAttackPending) dmg = Math.round(dmg * BIG_ATTACK_EXPOSED_BONUS);
  dmg = Math.max(0, Math.round(dmg * damageTakenMultiplier(target)));
  if (target.passives && target.passives.onceGuardType === "nullifyDamage" && !target.passives.onceGuardUsed) {
    target.passives.onceGuardUsed = true;
    log(`${target.label}は${actorLabel}の攻撃を完全に無効化した！`);
    return 0;
  }
  const lethal = target.hp - dmg <= 0;
  // おみくじ「大吉」: パーティ全員で共有する1回だけの致命傷耐え(同じオブジェクト参照を
  // 全員のpassivesに配っておくことで、誰が最初に致命傷を受けても消費は1回だけになる)
  if (lethal && target.passives && target.passives.sharedSurviveFatal && !target.passives.sharedSurviveFatal.used) {
    target.passives.sharedSurviveFatal.used = true;
    target.hp = 1;
    log(`${actorLabel}は${target.label}に${dmg}ダメージ${logSuffix}！`);
    log(`${target.label}はお守りの力で致命傷をこらえた！`);
  } else if (lethal && target.passives && target.passives.onceGuardType === "surviveAtHp1" && !target.passives.onceGuardUsed) {
    target.passives.onceGuardUsed = true;
    target.hp = 1;
    log(`${actorLabel}は${target.label}に${dmg}ダメージ${logSuffix}！`);
    log(`${target.label}は致命傷を気迫でこらえた！`);
  } else {
    target.hp = Math.max(0, target.hp - dmg);
    log(`${actorLabel}は${target.label}に${dmg}ダメージ${logSuffix}！`);
  }
  if (actor && target.hp > 0 && target.passives && target.passives.counterChance > 0 && Math.random() < target.passives.counterChance) {
    const counterDmg = Math.max(1, Math.round(effectiveStat(target, "atk") * (target.passives.counterMult || 1) - effectiveStat(actor, "def") * 0.5));
    actor.hp = Math.max(0, actor.hp - counterDmg);
    log(`${target.label}は反撃した！${actorLabel}に${counterDmg}ダメージ！`);
  }
  // 敵を倒した攻撃者を記録しておく(全滅時のセリフで「最後に倒した人物」を優先的に喋らせるために使う)
  if (actor && target.instanceId !== undefined && target.hp <= 0) {
    lastEnemyKillActor = actor;
  }
  // 撃破時スタック系の受動効果(修羅・槍鬼など): このダメージで倒したらスタックを積む
  if (actor && actor.passives && actor.passives.onKill && target.hp <= 0) {
    const ok = actor.passives.onKill;
    actor.passives.onKillStacks = Math.min(ok.maxStacks, (actor.passives.onKillStacks || 0) + 1);
    actor.passives.onKillStacksTurns = ok.turns;
  }
  // 通常攻撃に乗る状態異常付与の受動効果(毒刃・毒矢など): 攻撃が当たった時に確率判定する。複数選んでいれば全て判定する
  if (actor && actor.passives && actor.passives.onHitInflicts && target.hp > 0) {
    actor.passives.onHitInflicts.forEach((oh) => {
      if (Math.random() < resistedChance(target, oh.chance, oh.type)) {
        if (oh.type === "poison") applyPoison(target, oh.value || 3);
        if (oh.type === "bleed") applyBleed(target, oh.value || 2);
        if (oh.type === "burn") applyBurn(target, oh.turns || 3);
        if (oh.type === "stun") applyStun(target, oh.turns || 1);
        if (oh.type === "atkDown") applyStatMod(target, "atk", 1 - (oh.value || 0.15), oh.turns || 3);
        if (oh.type === "defDown") applyStatMod(target, "def", 1 - (oh.value || 0.15), oh.turns || 3);
      }
    });
  }
  return dmg;
}

// abilityType: 'magicAttack' | 'magicAttackAll' | 'heal' | 'critAttack' | 'powerAttack' | 'physicalAttackAll' | 'guard'
// target: 単体系は対象1体、全体系(...All)は生存中の敵配列、heal/guardはactor自身か味方1体
function useAbility(actor, target, abilityType, log) {
  const cost = abilityMpCost(abilityType, actor);
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
    return rollAttackOrMiss(actor, target, () => rollMagicAttack(effectiveStat(actor, "mag"), target.def), log);
  }
  if (abilityType === "magicAttackAll") {
    return rollAoeAttack(actor, target, (t) => Math.max(1, Math.round(rollMagicAttack(effectiveStat(actor, "mag"), t.def) * 0.6)), log);
  }
  if (abilityType === "physicalAttackAll") {
    return rollAoeAttack(actor, target, (t) => Math.max(1, Math.round(rollBasicAttack(effectiveStat(actor, "atk"), t.def) * 0.95)), log);
  }
  if (abilityType === "powerAttack") {
    return rollAttackOrMiss(actor, target, () => rollPowerAttack(effectiveStat(actor, "atk"), target.def), log);
  }
  if (abilityType === "critAttack") {
    return rollAttackOrMiss(actor, target, () => rollCritAttack(effectiveStat(actor, "atk"), target.def), log);
  }
  if (abilityType === "preciseShot") {
    // 「会心の一矢」の名前通り、通常の会心率(基本5%)に+45%を上乗せし、合計50%で急所を突く
    return rollAttackOrMiss(actor, target, () => rollPreciseShot(effectiveStat(actor, "atk"), target.def), log, 0.45);
  }
  if (abilityType === "cannonShot") {
    actor.reloading = true; // 命中/回避に関わらず、撃った以上は次のターン装填で動けなくなる
    return rollAttackOrMiss(actor, target, () => rollCannonShot(effectiveStat(actor, "atk"), target.def), log);
  }
  if (abilityType === "heal") {
    const bonusMult = healBonusMultiplier(actor, target, false);
    const heal = Math.round(applyOnsenHealBonus(target, rollHeal(effectiveStat(actor, "mag"))) * bonusMult);
    target.hp = Math.min(target.maxHp, target.hp + heal);
    log(`${actor.label}は${target.label}を${heal}回復！`);
    return { heal };
  }
  return null;
}
// 温泉バフ「湯浴み」: 回復を受ける側がこのバフを持っていれば、回復量を+15%する
// (回復薬/温泉卵/治癒の術/スキルツリーの回復技、全ての回復経路で共通して使う)
function applyOnsenHealBonus(target, heal) {
  return target.onsenBuffKey === "yuami" ? Math.round(heal * 1.15) : heal;
}

function usePotion(target, log) {
  const heal = applyOnsenHealBonus(target, Math.round(target.maxHp * POTION_HEAL_RATIO));
  target.hp = Math.min(target.maxHp, target.hp + heal);
  log(`${target.label}は回復薬で${heal}回復！`);
  return heal;
}

// 温泉卵: 回復薬と違い自分専用(呼び出し側でtarget=行動者本人を渡す前提)。ターンを消費しない点は
// index.html側(ボタンのonclickでfinishPlayerActionを呼ばない)で担保している
function useOnsenEgg(target, log) {
  const heal = applyOnsenHealBonus(target, Math.round(target.maxHp * ONSEN_EGG_HEAL_RATIO));
  target.hp = Math.min(target.maxHp, target.hp + heal);
  log(`${target.label}は温泉卵で${heal}回復！`);
  return heal;
}

// かばう(guarding)の身代わり成功率。100%だと絶対に守り切れてしまうため95%に抑えてあり、
// 5%は守り切れず別の味方が狙われる。挑発(tauntTurns)はタンク側の強制引きつけなので100%のまま変えない
const GUARD_REDIRECT_CHANCE = 0.95;
function findGuardTarget(alive) {
  const taunter = alive.find((t) => t.tauntTurns > 0);
  if (taunter) return taunter;
  const guardian = alive.find((t) => t.guarding);
  if (guardian && Math.random() < GUARD_REDIRECT_CHANCE) return guardian;
  return null;
}
// enemy一体がtargets(生存中の味方)を攻撃する。かばう中の仲間がいれば、タンクとして95%の確率で身代わりになって
// 大幅減衰した上で構えを消費する(誰もかばっていない、または5%で守り切れなければランダムに1人を攻撃する)
// 回避に成功した瞬間、evadeCritCounter持ちなら「次の自分の攻撃は確定会心」フラグを立て(反射神経)、
// onEvadeSelfBuff持ちなら次の自分の1ターンだけステータスが上がる(影分身)
function onEvadeSuccess(target) {
  if (target.passives && target.passives.evadeCritCounter) target.guaranteedCritNext = true;
  if (target.passives && target.passives.onEvadeSelfBuff) {
    const b = target.passives.onEvadeSelfBuff;
    applyStatMod(target, b.stat, b.mult, 2);
  }
}
function enemyAttack(enemy, targets, log) {
  const alive = targets.filter((t) => t.hp > 0);
  if (!alive.length) return null;
  const guardian = findGuardTarget(alive);
  const target = guardian || alive[Math.floor(Math.random() * alive.length)];
  // 戦闘中1回だけ確実に攻撃を回避する受動(分身など)。dodgeChance(確率式)とは別枠の確定回避
  if (target.passives && target.passives.onceGuardType === "dodgeOnce" && !target.passives.onceGuardUsed) {
    target.passives.onceGuardUsed = true;
    log(`${target.label}は${enemy.label}の攻撃を完全に見切ってかわした！`);
    onEvadeSuccess(target);
    return { target, dmg: null, hit: false };
  }
  if (!rollHit(enemy, target)) {
    log(`${target.label}は${enemy.label}の攻撃をかわした！`);
    onEvadeSuccess(target);
    return { target, dmg: null, hit: false };
  }
  let rawDmg = rollBasicAttack(enemy.atk, effectiveStat(target, "def"));
  let suffix = "";
  if (target.guarding) {
    rawDmg = Math.max(1, Math.round(rawDmg * 0.4));
    target.guarding = false;
    suffix = "(かばう)";
  }
  const dmg = applyDamageToTarget(target, rawDmg, log, enemy.label, enemy, suffix);
  // 瀕死になった一撃は、既にHPが減っていて実際のダメージ量(dmg)が小さくても、
  // 気絶するという出来事自体が最大級のストレスになるはずなので、その場合はratio=1.0扱いで計算する
  const wentDown = target.hp <= 0;
  target.fatigue = Math.min(FATIGUE_MAX, (target.fatigue || 0) + damageStress(wentDown ? target.maxHp : dmg, target.maxHp));
  // 敵固有の通常攻撃時デバフ(ぬらりこうもりの毒など)。かばう/挑発で同じ相手が何度も狙われ続けると
  // 蓄積が重なって危険域に達しやすい、という「かばうへの天敵」を演出するための仕組み。
  // stacking:trueの毒は通常のapplyPoison(最大値で頭打ち)と違い、命中のたびに加算される特殊仕様
  if (!wentDown && enemy.onHitInflict && Math.random() < enemy.onHitInflict.chance) {
    if (enemy.onHitInflict.type === "poison" && enemy.onHitInflict.stacking && target.statusImmuneTurns <= 0) {
      target.poison = Math.min(POISON_MAX_STACKS, (target.poison || 0) + (enemy.onHitInflict.value || 1));
      log(`${target.label}は${enemy.label}に噛まれ、毒が蓄積した！(${target.poison})`);
    } else {
      resolveDebuffEffect(target, enemy.onHitInflict.type, enemy.onHitInflict, log);
    }
  }
  return { target, dmg, hit: true };
}

// paramsにturnsMin/turnsMaxがあれば範囲内でランダムなターン数を、無ければ固定のturns(既定3)を返す
function resolveTurns(params) {
  if (params.turnsMin != null && params.turnsMax != null) {
    return params.turnsMin + Math.floor(Math.random() * (params.turnsMax - params.turnsMin + 1));
  }
  return params.turns || 3;
}
// デバフ種別ごとの適用処理を共通化(大技の専用プロファイル・汎用ランダムプール・通常攻撃時デバフの
// いずれからも呼ぶ)。paramsはvalue/turns(またはturnsMin/turnsMaxの範囲指定)を持つinflict設定オブジェクト
function resolveDebuffEffect(target, type, params, log) {
  params = params || {};
  if (type === "atkDown") { applyStatMod(target, "atk", 1 - (params.value || 0.15), resolveTurns(params)); log(`${target.label}は攻撃力が下がった！`); }
  if (type === "defDown") { applyStatMod(target, "def", 1 - (params.value || 0.15), resolveTurns(params)); log(`${target.label}は防御力が下がった！`); }
  if (type === "spdDown") { applyStatMod(target, "spd", 1 - (params.value || 0.2), resolveTurns(params)); log(`${target.label}は素早さが下がった！`); }
  if (type === "poison") { applyPoison(target, params.value || 3); log(`${target.label}は毒を受けた！`); }
  if (type === "bleed") { applyBleed(target, params.value || 2); log(`${target.label}は裂傷を負った！`); }
  if (type === "burn") { applyBurn(target, resolveTurns(params)); log(`${target.label}は炎上した！`); }
  if (type === "stun") { applyStun(target, params.turns || 1); log(`${target.label}はスタンした！`); }
  if (type === "silence") { applySilence(target, params.turns || 2); log(`${target.label}は沈黙した！`); }
}

// enemyの「大技」。かばう/挑発中の仲間がいればその1人だけに(引きつける対抗策)、いなければ
// 生存中の味方全員に襲いかかる。敵にbigAttackプロファイル(見た目/生態に合わせた専用の威力+デバフ)が
// あればそれを使い、無ければ汎用フォールバック(BIG_ATTACK_MULT+ランダムデバフプール)を使う。
// 敵自身が毒/炎上状態なら威力がさらに下がる(削る対抗策)。結果は対象ごとの配列で返す
function enemyBigAttack(enemy, targets, log) {
  const alive = targets.filter((t) => t.hp > 0);
  if (!alive.length) return [];
  const profile = enemy.bigAttack;
  // 大技は敵1体につき1人だけを狙う(以前は「かばう中の人がいなければ全員に当たる」実質AOEに
  // なっていて難易度が高くなりすぎていたため単体攻撃に統一した)。ignoreGuardian: 鬼火の業火など
  // 「誰か1人が庇っても防ぎきれない」大技は、かばう/挑発による引きつけを無視してランダムな1人を狙う
  const guardian = profile && profile.ignoreGuardian ? null : findGuardTarget(alive);
  const singleTarget = guardian || alive[Math.floor(Math.random() * alive.length)];
  const hitTargets = [singleTarget];
  let mult = profile ? profile.mult : BIG_ATTACK_MULT;
  if (enemy.poison > 0 || enemy.burnTurns > 0 || enemy.bleed > 0) mult = Math.max(0.2, mult - BIG_ATTACK_DOT_REDUCTION);
  return hitTargets.map((target) => {
    if (target.passives && target.passives.onceGuardType === "dodgeOnce" && !target.passives.onceGuardUsed) {
      target.passives.onceGuardUsed = true;
      log(`${target.label}は${enemy.label}の大技を完全に見切ってかわした！`);
      onEvadeSuccess(target);
      return { target, dmg: null, hit: false };
    }
    if (!rollHit(enemy, target)) {
      log(`${target.label}は${enemy.label}の大技をかわした！`);
      onEvadeSuccess(target);
      return { target, dmg: null, hit: false };
    }
    let rawDmg = Math.round(rollBasicAttack(enemy.atk, effectiveStat(target, "def")) * mult);
    let suffix = "";
    if (target.guarding) {
      rawDmg = Math.max(1, Math.round(rawDmg * 0.4));
      target.guarding = false;
      suffix = "(かばう)";
    }
    const dmg = applyDamageToTarget(target, rawDmg, log, enemy.label, enemy, suffix);
    const wentDown = target.hp <= 0;
    target.fatigue = Math.min(FATIGUE_MAX, (target.fatigue || 0) + damageStress(wentDown ? target.maxHp : dmg, target.maxHp));
    // 命中した対象ごとに独立してデバフ判定する(戦闘不能になった相手には付けない)
    if (!wentDown) {
      if (profile && profile.debuff) {
        if (Math.random() < profile.debuff.chance) resolveDebuffEffect(target, profile.debuff.type, profile.debuff, log);
      } else if (!profile && Math.random() < BIG_ATTACK_DEBUFF_CHANCE) {
        const debuffType = BIG_ATTACK_DEBUFF_POOL[Math.floor(Math.random() * BIG_ATTACK_DEBUFF_POOL.length)];
        resolveDebuffEffect(target, debuffType, {}, log);
      }
    }
    return { target, dmg, hit: true };
  });
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
// 誰も助けに来ないまま、実ゲーム内時間で2.5〜3.5日(CRITICAL_MIN_HOURS〜MAX_HOURS)経過すると
// ロスト(完全消滅)する。absoluteMinutesはその時点のゲーム内絶対分数(呼び出し側で算出)
function markCritical(character, floor, absoluteMinutes, stage) {
  character.status = "critical";
  character.hp = 0;
  character.criticalFloor = floor;
  character.criticalStage = stage || "forest"; // 森/海岸どちらで瀕死になったかも記録し、階層番号だけでは区別できない別ステージでの誤救出/誤表示を防ぐ
  const spanHours = CRITICAL_MIN_HOURS + Math.random() * (CRITICAL_MAX_HOURS - CRITICAL_MIN_HOURS);
  character.criticalExpireMinutes = absoluteMinutes + spanHours * 60;
}

// ゲーム内時間が進むたび(町へ帰る/宿泊はもちろん、ダンジョン内を歩き回っている間も)呼び、
// 期限切れの瀕死キャラをロストにする。ただし既に誰かに担がれている間は「救出済みで運搬中」
// なので、カウントダウンを進めない(ロストしない)
function tickCriticalExpiry(characters, absoluteMinutes) {
  characters.forEach((c) => {
    if (c.status === "critical" && !c.carriedBy && absoluteMinutes > c.criticalExpireMinutes) {
      c.status = "lost";
    }
  });
}

// 瀕死の仲間を救出する(HP半分で復活)。呼び出し側でその冒険を終了させて町に戻す
function rescueCritical(character) {
  if (character.status !== "critical") return false;
  character.status = "active";
  character.hp = 1; // 瀕死から復帰した直後はHP1(ぎりぎり生きている状態。全快ではない)
  character.criticalFloor = null;
  character.criticalExpireMinutes = null;
  character.carriedBy = null;
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
    pickEnemyForFloor, pickEncounterForFloor, goldReward, performAttack, useAbility, usePotion, useOnsenEgg, enemyAttack, enemyBigAttack, resolveDebuffEffect,
    markCritical, tickCriticalExpiry, rescueCritical, turnOrder, simulateBattle, simulateBattleMulti,
    xpToNext, levelUp, grantXp, maxMpFor, baseMaxMpFor, abilityMpCost,
    advanceFatigue, fatigueMalus, stressTier, effectiveStat, computeEquipBonus, refreshEquipBonus, classHasReachedLevel,
    onsenCost, useOnsen, isOnsenLocked, useLodging, useCampRest, isAvailable, evasionChance, accuracyOf, rollHit,
    applyStatMod, tickStatMods, applyPoison, tickPoison, applyBurn, tickBurn, applyBleed, tickBleed, BLEED_MAX_STACKS, clearDotEffects, applyStun, applySilence, tickTurnStartEffects, POISON_MAX_STACKS,
    initPassives, applySkillChoice, useTreeSkill, rollCritMultiplier, damageTakenMultiplier, activeConditionalMods,
    skillMpCost, resistedChance, applyDamageToTarget, BASE_CRIT_RATE, BASE_CRIT_DMG_MULT, mitigation, withVariance,
  };
}
