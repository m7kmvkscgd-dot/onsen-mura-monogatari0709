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

// key: id, ja, image, hp, atk, def, spd, goldMin, goldMax, xp, minFloor, maxFloor, isBoss
// 序盤(Lv1-10)/中盤(Lv11-25)/後半(Lv26-40)/終盤(Lv41-50〜)の4段階、計40種。
// 後半のがしゃどくろ・九尾の狐は中ボス、終盤の鬼神・羅刹王が最終ボス(いずれもisBoss:trueで
// pickEncounterForFloor()により10の倍数フロアで単体ボス戦として優先的に選ばれる)
const ENEMIES = {
  // ---- 序盤(Lv1-10 / floor 1-12) ----
  yaken: { id: "yaken", ja: "野犬", image: "assets/enemies/yaken.png", hp: 14, atk: 4, def: 2, spd: 6, goldMin: 3, goldMax: 7, xp: 8, minFloor: 1, maxFloor: 12 },
  inoshishi: { id: "inoshishi", ja: "猪", image: "assets/enemies/inoshishi.png", hp: 20, atk: 6, def: 3, spd: 4, goldMin: 4, goldMax: 8, xp: 9, minFloor: 1, maxFloor: 12 },
  dokuhebi: { id: "dokuhebi", ja: "毒蛇", image: "assets/enemies/dokuhebi.png", hp: 13, atk: 6, def: 2, spd: 7, goldMin: 4, goldMax: 8, xp: 9, minFloor: 1, maxFloor: 12 },
  oogumo: { id: "oogumo", ja: "大蜘蛛", image: "assets/enemies/oogumo.png", hp: 17, atk: 5, def: 3, spd: 6, goldMin: 5, goldMax: 9, xp: 10, minFloor: 1, maxFloor: 12 },
  kodama: { id: "kodama", ja: "木霊", image: "assets/enemies/kodama.png", hp: 15, atk: 5, def: 2, spd: 5, goldMin: 4, goldMax: 8, xp: 9, minFloor: 1, maxFloor: 12 },
  kappa: { id: "kappa", ja: "河童", image: "assets/enemies/kappa.png", hp: 16, atk: 5, def: 3, spd: 6, goldMin: 5, goldMax: 9, xp: 10, minFloor: 1, maxFloor: 12 },
  hitotsume_kozo: { id: "hitotsume_kozo", ja: "一つ目小僧", image: "assets/enemies/hitotsume_kozo.png", hp: 14, atk: 5, def: 2, spd: 8, goldMin: 5, goldMax: 9, xp: 10, minFloor: 1, maxFloor: 12 },
  bake_danuki: { id: "bake_danuki", ja: "化け狸", image: "assets/enemies/bake_danuki.png", hp: 18, atk: 5, def: 3, spd: 6, goldMin: 6, goldMax: 10, xp: 11, minFloor: 1, maxFloor: 12 },
  onibi: { id: "onibi", ja: "鬼火", image: "assets/enemies/onibi.png", hp: 12, atk: 6, def: 1, spd: 7, goldMin: 6, goldMax: 10, xp: 11, minFloor: 1, maxFloor: 12 },
  kamaitachi: { id: "kamaitachi", ja: "鎌鼬", image: "assets/enemies/kamaitachi.png", hp: 16, atk: 7, def: 2, spd: 10, goldMin: 7, goldMax: 12, xp: 13, minFloor: 1, maxFloor: 12 },

  // ---- 中盤(Lv11-25 / floor 9-29) ----
  ochimusha: { id: "ochimusha", ja: "落武者", image: "assets/enemies/ochimusha.png", hp: 34, atk: 10, def: 6, spd: 8, goldMin: 14, goldMax: 22, xp: 24, minFloor: 9, maxFloor: 29 },
  kamaitachi2: { id: "kamaitachi2", ja: "鎌鼬", image: "assets/enemies/kamaitachi2.png", hp: 28, atk: 11, def: 4, spd: 12, goldMin: 15, goldMax: 23, xp: 25, minFloor: 9, maxFloor: 29 },
  youko: { id: "youko", ja: "妖狐", image: "assets/enemies/youko.png", hp: 26, atk: 12, def: 4, spd: 9, goldMin: 15, goldMax: 23, xp: 25, minFloor: 9, maxFloor: 29 },
  rokurokubi: { id: "rokurokubi", ja: "ろくろ首", image: "assets/enemies/rokurokubi.png", hp: 30, atk: 10, def: 5, spd: 8, goldMin: 14, goldMax: 22, xp: 24, minFloor: 9, maxFloor: 29 },
  yukionna: { id: "yukionna", ja: "雪女", image: "assets/enemies/yukionna.png", hp: 27, atk: 11, def: 5, spd: 8, goldMin: 15, goldMax: 23, xp: 25, minFloor: 9, maxFloor: 29 },
  yamauba: { id: "yamauba", ja: "山姥", image: "assets/enemies/yamauba.png", hp: 36, atk: 10, def: 6, spd: 6, goldMin: 16, goldMax: 24, xp: 26, minFloor: 9, maxFloor: 29 },
  tsuchigumo: { id: "tsuchigumo", ja: "土蜘蛛", image: "assets/enemies/tsuchigumo.png", hp: 32, atk: 10, def: 5, spd: 7, goldMin: 15, goldMax: 23, xp: 25, minFloor: 9, maxFloor: 29 },
  onryo: { id: "onryo", ja: "怨霊", image: "assets/enemies/onryo.png", hp: 24, atk: 13, def: 3, spd: 9, goldMin: 16, goldMax: 24, xp: 27, minFloor: 9, maxFloor: 29 },
  oomukade: { id: "oomukade", ja: "大百足", image: "assets/enemies/oomukade.png", hp: 38, atk: 11, def: 6, spd: 6, goldMin: 17, goldMax: 25, xp: 27, minFloor: 9, maxFloor: 29 },
  kasha: { id: "kasha", ja: "火車", image: "assets/enemies/kasha.png", hp: 34, atk: 12, def: 6, spd: 7, goldMin: 18, goldMax: 27, xp: 29, minFloor: 9, maxFloor: 29 },

  // ---- 後半(Lv26-40 / floor 24-45)、うち2体は中ボス ----
  oni: { id: "oni", ja: "鬼", image: "assets/enemies/oni.png", hp: 58, atk: 18, def: 9, spd: 9, goldMin: 24, goldMax: 36, xp: 42, minFloor: 24, maxFloor: 45 },
  karasu_tengu: { id: "karasu_tengu", ja: "烏天狗", image: "assets/enemies/karasu_tengu.png", hp: 48, atk: 17, def: 7, spd: 14, goldMin: 24, goldMax: 36, xp: 42, minFloor: 24, maxFloor: 45 },
  yamauba2: { id: "yamauba2", ja: "山姥", image: "assets/enemies/yamauba2.png", hp: 56, atk: 16, def: 9, spd: 8, goldMin: 23, goldMax: 35, xp: 41, minFloor: 24, maxFloor: 45 },
  gyuki: { id: "gyuki", ja: "牛鬼", image: "assets/enemies/gyuki.png", hp: 70, atk: 19, def: 11, spd: 7, goldMin: 28, goldMax: 40, xp: 46, minFloor: 24, maxFloor: 45 },
  nue: { id: "nue", ja: "ぬえ", image: "assets/enemies/nue.png", hp: 52, atk: 18, def: 8, spd: 11, goldMin: 26, goldMax: 38, xp: 44, minFloor: 24, maxFloor: 45 },
  wanyudo: { id: "wanyudo", ja: "輪入道", image: "assets/enemies/wanyudo.png", hp: 50, atk: 17, def: 8, spd: 13, goldMin: 25, goldMax: 37, xp: 43, minFloor: 24, maxFloor: 45 },
  gaikotsu_musha: { id: "gaikotsu_musha", ja: "骸骨武者", image: "assets/enemies/gaikotsu_musha.png", hp: 54, atk: 18, def: 10, spd: 10, goldMin: 26, goldMax: 38, xp: 44, minFloor: 24, maxFloor: 45 },
  orochi: { id: "orochi", ja: "大蛇", image: "assets/enemies/orochi.png", hp: 62, atk: 18, def: 10, spd: 9, goldMin: 27, goldMax: 39, xp: 45, minFloor: 24, maxFloor: 45 },
  gashadokuro: { id: "gashadokuro", ja: "がしゃどくろ", image: "assets/enemies/gashadokuro.png", hp: 170, atk: 24, def: 13, spd: 9, goldMin: 90, goldMax: 130, xp: 150, minFloor: 26, maxFloor: 999, isBoss: true },
  kyubi_no_kitsune: { id: "kyubi_no_kitsune", ja: "九尾の狐", image: "assets/enemies/kyubi_no_kitsune.png", hp: 155, atk: 26, def: 11, spd: 12, goldMin: 95, goldMax: 135, xp: 155, minFloor: 26, maxFloor: 999, isBoss: true },

  // ---- 終盤(Lv41-50〜 / floor 38-) ----
  shuten_doji: { id: "shuten_doji", ja: "酒呑童子", image: "assets/enemies/shuten_doji.png", hp: 92, atk: 26, def: 13, spd: 10, goldMin: 40, goldMax: 58, xp: 75, minFloor: 38, maxFloor: 999 },
  ibaraki_doji: { id: "ibaraki_doji", ja: "茨木童子", image: "assets/enemies/ibaraki_doji.png", hp: 98, atk: 28, def: 13, spd: 10, goldMin: 42, goldMax: 60, xp: 78, minFloor: 38, maxFloor: 999 },
  dai_tengu: { id: "dai_tengu", ja: "大天狗", image: "assets/enemies/dai_tengu.png", hp: 85, atk: 27, def: 12, spd: 15, goldMin: 41, goldMax: 59, xp: 76, minFloor: 38, maxFloor: 999 },
  yamata_no_orochi: { id: "yamata_no_orochi", ja: "八岐大蛇", image: "assets/enemies/yamata_no_orochi.png", hp: 110, atk: 29, def: 14, spd: 8, goldMin: 45, goldMax: 64, xp: 82, minFloor: 38, maxFloor: 999 },
  tamamo_no_mae: { id: "tamamo_no_mae", ja: "玉藻前", image: "assets/enemies/tamamo_no_mae.png", hp: 82, atk: 28, def: 11, spd: 12, goldMin: 42, goldMax: 60, xp: 77, minFloor: 38, maxFloor: 999 },
  giou: { id: "giou", ja: "巍王", image: "assets/enemies/giou.png", hp: 100, atk: 27, def: 15, spd: 11, goldMin: 44, goldMax: 62, xp: 80, minFloor: 38, maxFloor: 999 },
  kyubi_shin: { id: "kyubi_shin", ja: "九尾の狐(真)", image: "assets/enemies/kyubi_shin.png", hp: 95, atk: 30, def: 12, spd: 13, goldMin: 46, goldMax: 65, xp: 85, minFloor: 38, maxFloor: 999 },
  gashadokuro_shin: { id: "gashadokuro_shin", ja: "がしゃどくろ(真)", image: "assets/enemies/gashadokuro_shin.png", hp: 120, atk: 28, def: 16, spd: 8, goldMin: 47, goldMax: 66, xp: 86, minFloor: 38, maxFloor: 999 },
  yomi_no_onryo: { id: "yomi_no_onryo", ja: "黄泉の怨霊", image: "assets/enemies/yomi_no_onryo.png", hp: 88, atk: 32, def: 10, spd: 11, goldMin: 48, goldMax: 68, xp: 88, minFloor: 38, maxFloor: 999 },
  kishin_rasetsuo: { id: "kishin_rasetsuo", ja: "鬼神・羅刹王", image: "assets/enemies/kishin_rasetsuo.png", hp: 280, atk: 34, def: 18, spd: 12, goldMin: 220, goldMax: 320, xp: 420, minFloor: 42, maxFloor: 999, isBoss: true },
};

const ITEMS = {
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

// 戦闘不能で瀕死になったキャラは、昼夜が切り替わるたび(halfDayStep)にカウントが進み、
// この範囲でランダムに決まる猶予(2〜4 = 1〜2日分)を過ぎると誰も救出に来なくてもロストする
const CRITICAL_MIN_HALFDAYS = 2; // 1日
const CRITICAL_MAX_HALFDAYS = 4; // 2日

const FATIGUE_PER_FLOOR = 4; // フィールドに出ているキャラが1階進むごとに溜まる疲労度
const FATIGUE_MAX = 100;

if (typeof module !== "undefined") {
  module.exports = { CLASSES, ABILITY_LABEL, ABILITY_DESC, ENEMIES, ITEMS, EQUIPMENT, CRITICAL_MIN_HALFDAYS, CRITICAL_MAX_HALFDAYS, FATIGUE_PER_FLOOR, FATIGUE_MAX };
}
