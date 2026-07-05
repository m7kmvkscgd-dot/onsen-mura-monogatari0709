// ダンジョン1: データ定義(職業・敵・アイテム)

// 和製8職業の個性設計(ユーザー提供のキャラシートに基づく):
// - 単体特化: 侍(会心の一撃)・忍(奇襲)・狩人(会心の一矢)
// - タンク: 槍士(かばう)
// - 範囲特化: 薙刀士(薙ぎ払い)
// - 高火力/低速: 砲術士(砲撃、使うと次のターンは装填で動けない)
// - 魔法: 陰陽師(呪符ノ術=単体/大祓ノ術=全体)
// - 支援: 僧侶(治癒の術)
const CLASSES = {
  samurai: { ja: "侍", image: "assets/class_samurai.png", hp: 34, atk: 13, def: 8, spd: 11, mag: 0, abilities: ["critAttack"] },
  ninja: { ja: "忍", image: "assets/class_ninja.png", hp: 29, atk: 13, def: 7, spd: 16, mag: 0, abilities: ["powerAttack"] },
  spearman: { ja: "槍士", image: "assets/class_spearman.png", hp: 42, atk: 11, def: 13, spd: 7, mag: 0, abilities: ["guard"] },
  naginata: { ja: "薙刀士", image: "assets/class_naginata.png", hp: 32, atk: 12, def: 8, spd: 9, mag: 0, abilities: ["physicalAttackAll"] },
  hunter: { ja: "狩人", image: "assets/class_hunter.png", hp: 26, atk: 11, def: 5, spd: 12, mag: 0, abilities: ["preciseShot"] },
  gunner: { ja: "砲術士", image: "assets/class_gunner.png", hp: 28, atk: 16, def: 6, spd: 4, mag: 0, abilities: ["cannonShot"] },
  onmyoji: { ja: "陰陽師", image: "assets/class_onmyoji.png", hp: 21, atk: 5, def: 4, spd: 9, mag: 17, abilities: ["magicAttack", "magicAttackAll"] },
  priest: { ja: "僧侶", image: "assets/class_priest.png", hp: 26, atk: 6, def: 6, spd: 8, mag: 13, abilities: ["heal"] },
};

const ABILITY_LABEL = {
  magicAttack: "呪符ノ術",
  magicAttackAll: "大祓ノ術(全体)",
  heal: "治癒の術",
  critAttack: "会心の一撃",
  powerAttack: "奇襲",
  physicalAttackAll: "薙ぎ払い(全体)",
  preciseShot: "会心の一矢",
  cannonShot: "砲撃",
  guard: "かばう",
};

const ABILITY_DESC = {
  magicAttack: "敵1体に陰陽術のダメージ",
  magicAttackAll: "敵全体に陰陽術のダメージ(1体あたりは控えめ)",
  heal: "味方1人のHPを回復",
  critAttack: "敵1体に防御力を無視しやすい一撃",
  powerAttack: "敵1体に不意を突いた一撃",
  physicalAttackAll: "敵全体になぎ払いの一撃(1体あたりは控えめ)",
  preciseShot: "敵1体に防御力を無視しやすい矢",
  cannonShot: "敵1体に大ダメージ。使った次のターンは装填で動けない",
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
  samurai: {
    weapon: [tier("業物の刀", "atk", 5, 120, 1), tier("妖刀", "atk", 11, 270, 5), tier("伝説の名刀", "atk", 18, 540, 10)],
    armor: [tier("当世具足", "def", 5, 110, 1), tier("上級当世具足", "def", 10, 250, 5), tier("伝説の甲冑", "def", 17, 500, 10)],
  },
  ninja: {
    weapon: [tier("業物の苦無", "atk", 4, 90, 1), tier("影の苦無", "atk", 9, 220, 5), tier("暁の苦無", "atk", 15, 440, 10)],
    armor: [tier("強化忍び装束", "def", 3, 75, 1), tier("上級忍び装束", "def", 7, 190, 5), tier("暁の装束", "def", 12, 400, 10)],
  },
  spearman: {
    weapon: [tier("鍛えの槍", "atk", 4, 90, 1), tier("十文字槍", "atk", 9, 220, 5), tier("伝説の大槍", "atk", 16, 450, 10)],
    armor: [tier("鉄の大盾", "def", 6, 110, 1), tier("強化大盾", "def", 12, 260, 5), tier("伝説の盾", "def", 20, 500, 10)],
  },
  naginata: {
    weapon: [tier("鍛えの薙刀", "atk", 5, 110, 1), tier("大薙刀", "atk", 11, 250, 5), tier("伝説の薙刀", "atk", 17, 510, 10)],
    armor: [tier("強化白鉢巻", "def", 4, 90, 1), tier("上級具足", "def", 8, 220, 5), tier("伝説の巫女装束", "def", 14, 440, 10)],
  },
  hunter: {
    weapon: [tier("鍛えの弓", "atk", 4, 90, 1), tier("強弓", "atk", 9, 220, 5), tier("伝説の弓", "atk", 15, 440, 10)],
    armor: [tier("強化猟師装束", "def", 3, 75, 1), tier("上級猟師装束", "def", 7, 190, 5), tier("伝説の猟師装束", "def", 12, 400, 10)],
  },
  gunner: {
    weapon: [tier("鍛えの火縄銃", "atk", 6, 130, 1), tier("上級火縄銃", "atk", 13, 290, 5), tier("伝説の大筒", "atk", 21, 570, 10)],
    armor: [tier("強化胴当て", "def", 3, 75, 1), tier("上級胴当て", "def", 7, 190, 5), tier("伝説の胴当て", "def", 12, 400, 10)],
  },
  onmyoji: {
    weapon: [tier("式神の御幣", "mag", 5, 110, 1), tier("上級御幣", "mag", 11, 260, 5), tier("大陰陽の御幣", "mag", 19, 520, 10)],
    armor: [tier("浄衣", "def", 3, 90, 1), tier("上級浄衣", "def", 7, 210, 5), tier("大陰陽の浄衣", "def", 12, 430, 10)],
  },
  priest: {
    weapon: [tier("聖なる錫杖", "mag", 4, 100, 1), tier("大僧正の錫杖", "mag", 9, 240, 5), tier("神託の錫杖", "mag", 16, 480, 10)],
    armor: [tier("法衣", "def", 4, 90, 1), tier("大僧正の法衣", "def", 8, 220, 5), tier("神託の法衣", "def", 14, 440, 10)],
  },
};

const CORPSE_STEP_LIMIT = 40; // 死亡時のworldStepからこの歩数以内に回収しないとロストする

const FATIGUE_PER_FLOOR = 4; // フィールドに出ているキャラが1階進むごとに溜まる疲労度
const FATIGUE_MAX = 100;

if (typeof module !== "undefined") {
  module.exports = { CLASSES, ABILITY_LABEL, ABILITY_DESC, ENEMIES, ITEMS, EQUIPMENT, CORPSE_STEP_LIMIT, FATIGUE_PER_FLOOR, FATIGUE_MAX };
}
