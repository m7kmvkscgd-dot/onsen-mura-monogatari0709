// ダンジョン1: データ定義(職業・敵・アイテム)

// 各職業の個性設計:
// - 単体特化(対ボス・対タフ単体): 戦士(かばう=盾役)・侍(渾身の一撃)・盗賊(会心の一撃=防御貫通)
// - 範囲特化(対雑魚の群れ): 魔法使い(メテオ=魔法範囲)・忍者(乱れ突き=物理範囲)
// - 支援特化(継続探索を支える): 僧侶(ヒール)・賢者(ヒール+ファイア両方使えるが器用貧乏)・パラディン(かばう+ヒールの複合タンク)
const CLASSES = {
  fighter: { ja: "戦士", image: "assets/class_fighter.png", hp: 44, atk: 12, def: 12, spd: 8, mag: 0, abilities: ["guard"] },
  mage: { ja: "魔法使い", image: "assets/class_mage.png", hp: 20, atk: 5, def: 3, spd: 9, mag: 16, abilities: ["magicAttack", "magicAttackAll"] },
  priest: { ja: "僧侶", image: "assets/class_priest.png", hp: 25, atk: 6, def: 6, spd: 8, mag: 13, abilities: ["heal"] },
  thief: { ja: "盗賊", image: "assets/class_thief.png", hp: 27, atk: 10, def: 6, spd: 15, mag: 0, abilities: ["critAttack"] },
  samurai: { ja: "侍", image: "assets/class_samurai.png", hp: 37, atk: 14, def: 9, spd: 10, mag: 3, abilities: ["powerAttack"] },
  ninja: { ja: "忍者", image: "assets/class_ninja.png", hp: 29, atk: 13, def: 7, spd: 16, mag: 0, abilities: ["physicalAttackAll"] },
  sage: { ja: "賢者", image: "assets/class_sage.png", hp: 23, atk: 6, def: 5, spd: 9, mag: 12, abilities: ["magicAttack", "heal"] },
  paladin: { ja: "パラディン", image: "assets/class_paladin.png", hp: 36, atk: 10, def: 11, spd: 7, mag: 8, abilities: ["guard", "heal"] },
};

const ABILITY_LABEL = {
  magicAttack: "ファイア",
  magicAttackAll: "メテオ(全体)",
  heal: "ヒール",
  critAttack: "会心の一撃",
  powerAttack: "渾身の一撃",
  physicalAttackAll: "乱れ突き(全体)",
  guard: "かばう",
};

const ABILITY_DESC = {
  magicAttack: "敵1体に魔法ダメージ",
  magicAttackAll: "敵全体に魔法ダメージ(1体あたりは控えめ)",
  heal: "味方1人のHPを回復",
  critAttack: "敵1体に防御力を無視しやすい一撃",
  powerAttack: "敵1体に通常より重い一撃",
  physicalAttackAll: "敵全体に物理ダメージ(1体あたりは控えめ)",
  guard: "自分への被ダメージを大幅に減らす",
};

// key: id, ja, image, hp, atk, def, spd, goldMin, goldMax, minFloor, maxFloor, isBoss
const ENEMIES = {
  slime_green: { id: "slime_green", ja: "岩塊の魔物", image: "assets/enemies/slime_green.png", hp: 18, atk: 5, def: 2, spd: 4, goldMin: 5, goldMax: 10, xp: 12, minFloor: 1, maxFloor: 5 },
  slime_blue: { id: "slime_blue", ja: "氷塊の魔物", image: "assets/enemies/slime_blue.png", hp: 24, atk: 6, def: 3, spd: 6, goldMin: 8, goldMax: 14, xp: 16, minFloor: 2, maxFloor: 7 },
  goblin_yellow: { id: "goblin_yellow", ja: "ゴブリン", image: "assets/enemies/goblin_yellow.png", hp: 34, atk: 9, def: 5, spd: 8, goldMin: 14, goldMax: 22, xp: 26, minFloor: 4, maxFloor: 11 },
  ogre_red: { id: "ogre_red", ja: "紅蓮鬼", image: "assets/enemies/ogre_red.png", hp: 52, atk: 13, def: 7, spd: 7, goldMin: 22, goldMax: 35, xp: 40, minFloor: 7, maxFloor: 16 },
  shade_dark: { id: "shade_dark", ja: "くらやみのけもの", image: "assets/enemies/shade_dark.png", hp: 68, atk: 16, def: 9, spd: 11, goldMin: 32, goldMax: 48, xp: 58, minFloor: 12, maxFloor: 24 },
  boss_white: { id: "boss_white", ja: "紅の竜王", image: "assets/enemies/boss_white.png", hp: 140, atk: 20, def: 12, spd: 9, goldMin: 100, goldMax: 150, xp: 150, minFloor: 9, maxFloor: 999, isBoss: true },
};

const ITEMS = {
  holyWater: { id: "holyWater", ja: "聖水", price: 50, desc: "ダンジョンに残された死体を蘇生する(その場で使用)" },
  potion: { id: "potion", ja: "回復薬", price: 20, desc: "戦闘中に1人のHPを30回復する" },
};

// 職業ごとの武器/防具。各3段階(Lv1から買える基礎/Lv5解禁/Lv10解禁)。上位を買うと下位から乗り換わる(加算ではなく差し替え)。
// 「そのレベルに到達した仲間が1人でもいるか」で解禁判定する。購入すると同じ職業の全メンバーに恒久的なステータスが乗る。
// 個別の装備の付け外しは無く、「その職業への投資」として一度買えば以後ずっと有効(ウィザードリィ的な個別装備管理はMVPとして省略)。
function tier(name, statKey, bonus, price, level) {
  return { name, statKey, bonus, price, level };
}
const EQUIPMENT = {
  fighter: {
    weapon: [tier("鋼の剣", "atk", 4, 90, 1), tier("ミスリルソード", "atk", 9, 220, 5), tier("伝説の大剣", "atk", 16, 450, 10)],
    armor: [tier("鉄の大盾", "def", 6, 110, 1), tier("ミスリルシールド", "def", 12, 260, 5), tier("伝説の盾", "def", 20, 500, 10)],
  },
  mage: {
    weapon: [tier("魔導の杖", "mag", 5, 110, 1), tier("賢者の秘杖", "mag", 11, 260, 5), tier("大魔導の杖", "mag", 19, 520, 10)],
    armor: [tier("魔法のローブ", "def", 3, 90, 1), tier("上級ローブ", "def", 7, 210, 5), tier("大魔導のローブ", "def", 12, 430, 10)],
  },
  priest: {
    weapon: [tier("聖なる杖", "mag", 4, 100, 1), tier("大司教の杖", "mag", 9, 240, 5), tier("神託の杖", "mag", 16, 480, 10)],
    armor: [tier("聖職者の法衣", "def", 4, 90, 1), tier("大司教の法衣", "def", 8, 220, 5), tier("神託の法衣", "def", 14, 440, 10)],
  },
  thief: {
    weapon: [tier("業物の短剣", "atk", 4, 90, 1), tier("暗殺者の短剣", "atk", 9, 220, 5), tier("影断ちの短剣", "atk", 15, 440, 10)],
    armor: [tier("強化革鎧", "def", 3, 75, 1), tier("忍びの革鎧", "def", 7, 190, 5), tier("影の外套", "def", 12, 400, 10)],
  },
  samurai: {
    weapon: [tier("業物の刀", "atk", 5, 120, 1), tier("妖刀", "atk", 11, 270, 5), tier("伝説の名刀", "atk", 18, 540, 10)],
    armor: [tier("当世具足", "def", 5, 110, 1), tier("上級当世具足", "def", 10, 250, 5), tier("伝説の甲冑", "def", 17, 500, 10)],
  },
  ninja: {
    weapon: [tier("業物の苦無", "atk", 4, 90, 1), tier("影の苦無", "atk", 9, 220, 5), tier("暁の苦無", "atk", 15, 440, 10)],
    armor: [tier("強化忍び装束", "def", 3, 75, 1), tier("上級忍び装束", "def", 7, 190, 5), tier("暁の装束", "def", 12, 400, 10)],
  },
  sage: {
    weapon: [tier("賢者の杖", "mag", 4, 100, 1), tier("大賢者の杖", "mag", 9, 240, 5), tier("叡智の杖", "mag", 16, 480, 10)],
    armor: [tier("賢者のローブ", "def", 3, 90, 1), tier("大賢者のローブ", "def", 7, 220, 5), tier("叡智のローブ", "def", 12, 440, 10)],
  },
  paladin: {
    weapon: [tier("聖騎士の剣", "atk", 4, 110, 1), tier("上級聖剣", "atk", 9, 250, 5), tier("大聖剣", "atk", 15, 500, 10)],
    armor: [tier("聖騎士の鎧", "def", 6, 130, 1), tier("上級聖鎧", "def", 12, 280, 5), tier("大聖鎧", "def", 20, 550, 10)],
  },
};

const CORPSE_STEP_LIMIT = 40; // 死亡時のworldStepからこの歩数以内に回収しないとロストする

const FATIGUE_PER_FLOOR = 4; // フィールドに出ているキャラが1階進むごとに溜まる疲労度
const FATIGUE_MAX = 100;

if (typeof module !== "undefined") {
  module.exports = { CLASSES, ABILITY_LABEL, ABILITY_DESC, ENEMIES, ITEMS, EQUIPMENT, CORPSE_STEP_LIMIT, FATIGUE_PER_FLOOR, FATIGUE_MAX };
}
