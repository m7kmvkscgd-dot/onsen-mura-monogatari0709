// ダンジョン1: データ定義(職業・敵・アイテム)

// 和製8職業の個性設計(ユーザー提供のキャラシートに基づく):
// - 単体特化: 侍(会心の一撃)・忍(奇襲)・狩人(会心の一矢)
// - タンク: 槍士(かばう)
// - 範囲特化: 薙刀士(薙ぎ払い)
// - 高火力/低速: 砲術士(砲撃、使うと次のターンは装填で動けない)
// - 魔法: 陰陽師(呪符ノ術=単体/大祓ノ術=全体)
// - 支援: 僧侶(治癒の術)
// accuracy: 命中率の基本値。狩人だけ突出して高くし「命中率が高い職業」という個性にする(他は共通のBASE_ACCURACY相当の0.95)
const CLASSES = {
  samurai: { ja: "侍", image: "assets/class_samurai.png", hp: 35, atk: 13, def: 8, spd: 11, mag: 0, accuracy: 0.95, abilities: ["critAttack"] },
  ninja: { ja: "忍", image: "assets/class_ninja.png", hp: 30, atk: 13, def: 7, spd: 16, mag: 0, accuracy: 0.95, abilities: ["powerAttack"] },
  spearman: { ja: "槍士", image: "assets/class_spearman.png", hp: 39, atk: 11, def: 10, spd: 7, mag: 0, accuracy: 0.95, abilities: ["guard"] },
  naginata: { ja: "薙刀士", image: "assets/class_naginata.png", hp: 33, atk: 12, def: 8, spd: 9, mag: 0, accuracy: 0.95, abilities: ["physicalAttackAll"] },
  hunter: { ja: "狩人", image: "assets/class_hunter.png", hp: 27, atk: 11, def: 5, spd: 12, mag: 0, accuracy: 0.99, abilities: ["preciseShot"] },
  gunner: { ja: "砲術士", image: "assets/class_gunner.png", hp: 29, atk: 16, def: 6, spd: 4, mag: 0, accuracy: 0.95, abilities: ["cannonShot"] },
  onmyoji: { ja: "陰陽師", image: "assets/class_onmyoji.png", hp: 25, atk: 5, def: 4, spd: 9, mag: 17, maxMp: 25, accuracy: 0.95, abilities: ["magicAttack", "magicAttackAll"] },
  priest: { ja: "僧侶", image: "assets/class_priest.png", hp: 27, atk: 6, def: 6, spd: 8, mag: 13, accuracy: 0.95, abilities: ["heal"] },
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
  yaken: { id: "yaken", ja: "野犬", image: "assets/enemies/yaken.png", hp: 14, atk: 4, def: 2, spd: 6, goldMin: 5, goldMax: 11, xp: 8, minFloor: 1, maxFloor: 12 },
  inoshishi: { id: "inoshishi", ja: "猪", image: "assets/enemies/inoshishi.png", hp: 18, atk: 5, def: 3, spd: 4, goldMin: 6, goldMax: 12, xp: 9, minFloor: 1, maxFloor: 12 },
  dokuhebi: { id: "dokuhebi", ja: "毒蛇", image: "assets/enemies/dokuhebi.png", hp: 13, atk: 6, def: 2, spd: 7, goldMin: 6, goldMax: 12, xp: 9, minFloor: 1, maxFloor: 12 },
  oogumo: { id: "oogumo", ja: "大蜘蛛", image: "assets/enemies/oogumo.png", hp: 17, atk: 5, def: 3, spd: 6, goldMin: 8, goldMax: 14, xp: 10, minFloor: 1, maxFloor: 12 },
  kodama: { id: "kodama", ja: "木霊", image: "assets/enemies/kodama.png", hp: 15, atk: 5, def: 2, spd: 5, goldMin: 6, goldMax: 12, xp: 9, minFloor: 1, maxFloor: 12 },
  kappa: { id: "kappa", ja: "河童", image: "assets/enemies/kappa.png", hp: 16, atk: 5, def: 3, spd: 6, goldMin: 8, goldMax: 14, xp: 10, minFloor: 1, maxFloor: 12 },
  hitotsume_kozo: { id: "hitotsume_kozo", ja: "一つ目小僧", image: "assets/enemies/hitotsume_kozo.png", hp: 14, atk: 5, def: 2, spd: 8, goldMin: 8, goldMax: 14, xp: 10, minFloor: 1, maxFloor: 12 },
  bake_danuki: { id: "bake_danuki", ja: "化け狸", image: "assets/enemies/bake_danuki.png", hp: 18, atk: 5, def: 3, spd: 6, goldMin: 9, goldMax: 15, xp: 11, minFloor: 1, maxFloor: 12 },
  onibi: { id: "onibi", ja: "鬼火", image: "assets/enemies/onibi.png", hp: 12, atk: 6, def: 1, spd: 7, goldMin: 9, goldMax: 15, xp: 11, minFloor: 1, maxFloor: 12 },
  kamaitachi: { id: "kamaitachi", ja: "鎌鼬", image: "assets/enemies/kamaitachi.png", hp: 16, atk: 6, def: 2, spd: 10, goldMin: 11, goldMax: 18, xp: 13, minFloor: 1, maxFloor: 12 },

  // ---- 中盤(Lv11-25 / floor 9-29) ----
  ochimusha: { id: "ochimusha", ja: "落武者", image: "assets/enemies/ochimusha.png", hp: 34, atk: 10, def: 6, spd: 8, goldMin: 18, goldMax: 29, xp: 24, minFloor: 9, maxFloor: 29 },
  kamaitachi2: { id: "kamaitachi2", ja: "鎌鼬", image: "assets/enemies/kamaitachi2.png", hp: 28, atk: 11, def: 4, spd: 12, goldMin: 20, goldMax: 30, xp: 25, minFloor: 9, maxFloor: 29 },
  youko: { id: "youko", ja: "妖狐", image: "assets/enemies/youko.png", hp: 26, atk: 12, def: 4, spd: 9, goldMin: 20, goldMax: 30, xp: 25, minFloor: 9, maxFloor: 29 },
  rokurokubi: { id: "rokurokubi", ja: "ろくろ首", image: "assets/enemies/rokurokubi.png", hp: 30, atk: 10, def: 5, spd: 8, goldMin: 18, goldMax: 29, xp: 24, minFloor: 9, maxFloor: 29 },
  yukionna: { id: "yukionna", ja: "雪女", image: "assets/enemies/yukionna.png", hp: 27, atk: 11, def: 5, spd: 8, goldMin: 20, goldMax: 30, xp: 25, minFloor: 9, maxFloor: 29 },
  yamauba: { id: "yamauba", ja: "山姥", image: "assets/enemies/yamauba.png", hp: 36, atk: 10, def: 6, spd: 6, goldMin: 21, goldMax: 31, xp: 26, minFloor: 9, maxFloor: 29 },
  tsuchigumo: { id: "tsuchigumo", ja: "土蜘蛛", image: "assets/enemies/tsuchigumo.png", hp: 32, atk: 10, def: 5, spd: 7, goldMin: 20, goldMax: 30, xp: 25, minFloor: 9, maxFloor: 29 },
  onryo: { id: "onryo", ja: "怨霊", image: "assets/enemies/onryo.png", hp: 24, atk: 13, def: 3, spd: 9, goldMin: 21, goldMax: 31, xp: 27, minFloor: 9, maxFloor: 29 },
  oomukade: { id: "oomukade", ja: "大百足", image: "assets/enemies/oomukade.png", hp: 38, atk: 11, def: 6, spd: 6, goldMin: 22, goldMax: 33, xp: 27, minFloor: 9, maxFloor: 29 },
  kasha: { id: "kasha", ja: "火車", image: "assets/enemies/kasha.png", hp: 34, atk: 12, def: 6, spd: 7, goldMin: 23, goldMax: 35, xp: 29, minFloor: 9, maxFloor: 29 },

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

  // 大群系(isSwarm): 通常より小さく表示され、ステータスは同階層帯の通常種平均のおよそ4〜5割に抑えてある。
  // 遭遇時は2体で通常種1体ぶんの「枠」を埋める(pickEncounterForFloor参照)。階層帯は既存の40種と同じ4段階に対応
  nurari_koumori: { id: "nurari_koumori", ja: "ぬらりこうもり", image: "assets/enemies/nurari_koumori.png", hp: 6, atk: 3, def: 0, spd: 9, goldMin: 3, goldMax: 5, xp: 5, minFloor: 1, maxFloor: 12, isSwarm: true },
  chochin_obake: { id: "chochin_obake", ja: "提灯おばけ", image: "assets/enemies/chochin_obake.png", hp: 8, atk: 2, def: 1, spd: 5, goldMin: 3, goldMax: 6, xp: 5, minFloor: 1, maxFloor: 12, isSwarm: true },
  kawappa: { id: "kawappa", ja: "かわっぱ", image: "assets/enemies/kawappa.png", hp: 13, atk: 5, def: 2, spd: 6, goldMin: 10, goldMax: 14, xp: 11, minFloor: 9, maxFloor: 29, isSwarm: true },
  chibi_oni: { id: "chibi_oni", ja: "ちび鬼", image: "assets/enemies/chibi_oni.png", hp: 12, atk: 6, def: 1, spd: 7, goldMin: 10, goldMax: 16, xp: 12, minFloor: 9, maxFloor: 29, isSwarm: true },
  karakasa: { id: "karakasa", ja: "からかさ", image: "assets/enemies/karakasa.png", hp: 27, atk: 8, def: 4, spd: 6, goldMin: 13, goldMax: 18, xp: 19, minFloor: 24, maxFloor: 45, isSwarm: true },
  kogitsune: { id: "kogitsune", ja: "こぎつね", image: "assets/enemies/kogitsune.png", hp: 22, atk: 9, def: 3, spd: 13, goldMin: 13, goldMax: 18, xp: 20, minFloor: 24, maxFloor: 45, isSwarm: true },
  warashibe_ningyo: { id: "warashibe_ningyo", ja: "わらしべ人形", image: "assets/enemies/warashibe_ningyo.png", hp: 47, atk: 12, def: 6, spd: 5, goldMin: 22, goldMax: 28, xp: 35, minFloor: 38, maxFloor: 999, isSwarm: true },
  medama_kozou: { id: "medama_kozou", ja: "目玉こぞう", image: "assets/enemies/medama_kozou.png", hp: 40, atk: 14, def: 5, spd: 6, goldMin: 22, goldMax: 30, xp: 36, minFloor: 38, maxFloor: 999, isSwarm: true },
};

// 支援物資: 道具屋ではなく出発画面(パーティ編成)で購入する消耗品。合計SUPPLY_CAP個までしか持てない
const ITEMS = {
  potion: { id: "potion", ja: "回復薬", price: 5, desc: "戦闘中に1人のHPを最大HPの35%回復する" },
  smokeBomb: { id: "smokeBomb", ja: "煙玉", price: 15, desc: "その戦闘から即座に逃げる" },
  campingKit: { id: "campingKit", ja: "野営具", price: 80, desc: "簡易宿泊キット。夜を越すことができる" },
};
const POTION_HEAL_RATIO = 0.38;
// 野営具は回復薬/煙玉とは別枠で、最大CAMPING_KIT_CAP個までしか持てない(高価な特別アイテムのため)
const CAMPING_KIT_CAP = 1;
// 野営(野営具を使った時の休息)の効果: HP/MPを割合回復、ストレスを固定量回復
const CAMP_HP_RELIEF = 0.6;
const CAMP_MP_RELIEF = 0.45;
const CAMP_STRESS_RELIEF = 20;
// 野営中に選べる3行動のうち「慰める」のストレス軽減量
const CAMP_COMFORT_STRESS_RELIEF = 10;
// 野営中「武器の手入れ」を選んだキャラの攻撃力バフ(戦闘回数でカウントし、ターンではなく戦闘をまたいで持続する)
const CAMP_WEAPON_CARE_ATK_MULT = 1.1;
const CAMP_WEAPON_CARE_BATTLES = 3;

// ============ スキルツリー(XCOM風。レベルアップ毎(Lv2〜10)に左右どちらか1つを選ぶ) ============
// 数値はユーザー提供の原案(ChatGPT作成)をベースに、このゲームの既存の技(会心の一撃mult1.3など、
// MPは物理職10固定/術者職26〜30)と釣り合うよう全体的に控えめへ調整してある。
// 「通常攻撃時に◯%で追撃/連撃」系は会心率/会心ダメージ加算に、「状態異常:麻痺」は全て「スタン(1ターン行動不能)」に、
// 「沈黙」は敵に技が無い都合上スタンかデバフに、「狙われる確率」系は回避率加算に、それぞれ意味の近い形に置き換えている
const SKILL_TREES = {
  samurai: {
    2: {
      left: { name: "居合", desc: "戦闘開始後、最初の攻撃のダメージ+35%", mp: 0, passive: { firstAttackBonusMult: 0.35 } },
      right: { name: "見切り", desc: "被弾時、12%の確率で完全に回避する", mp: 0, passive: { dodgeChance: 0.12 } },
    },
    3: {
      left: { name: "連斬", desc: "会心率+10%、会心ダメージ+15%", mp: 0, passive: { critRateAdd: 0.1, critDmgAdd: 0.15 } },
      right: { name: "気迫", desc: "HPが80%以上の間、被ダメージ12%減少", mp: 0, passive: { conditionalMod: { cmp: "gte", value: 0.8, dmgTakenMult: 0.88 } } },
    },
    4: {
      left: { name: "一閃", desc: "敵単体へ190%ダメージ、防御力25%無視", mp: 4, action: { kind: "damage", mult: 1.9, defPierce: 0.25 } },
      right: { name: "武士道", desc: "HPが50%以下の間、攻撃力・防御力+18%", mp: 0, passive: { conditionalMod: { cmp: "lte", value: 0.5, statMult: [{ stat: "atk", mult: 1.18 }, { stat: "def", mult: 1.18 }] } } },
    },
    5: {
      left: { name: "剣圧", desc: "会心率+15%", mp: 0, passive: { critRateAdd: 0.15 } },
      right: { name: "心眼", desc: "命中率+15%", mp: 0, passive: { accuracyAdd: 0.15 } },
    },
    6: {
      left: { name: "剣豪", desc: "会心率+20%、会心ダメージ+30%", mp: 0, passive: { critRateAdd: 0.2, critDmgAdd: 0.3 } },
      right: { name: "不動", desc: "状態異常にかかる確率が50%減少する", mp: 0, passive: { statusResistMult: 0.5 } },
    },
    7: {
      left: { name: "疾風", desc: "素早さ+20%", mp: 0, passive: { spdMult: 1.2 } },
      right: { name: "鉄心", desc: "最大HP+15%、被ダメージ8%減少", mp: 0, passive: { hpMult: 1.15, conditionalMod: { cmp: "gte", value: 0, dmgTakenMult: 0.92 } } },
    },
    8: {
      left: { name: "乱れ斬り", desc: "敵単体へ3連続攻撃(合計210%ダメージ)", mp: 5, action: { kind: "damage", mult: 2.1, hits: 3 } },
      right: { name: "反撃", desc: "被弾時、20%の確率で反撃する(通常の1.4倍ダメージ)", mp: 0, passive: { counterChance: 0.2, counterMult: 1.4 } },
    },
    9: {
      left: { name: "修羅", desc: "敵を倒すと3ターンの間、攻撃力+25%", mp: 0, passive: { onKill: { statMult: [{ stat: "atk", mult: 1.25 }], turns: 3, maxStacks: 1 } } },
      right: { name: "覚悟", desc: "戦闘不能になる一撃を、戦闘中1回だけHP1で耐える", mp: 0, passive: { onceGuardType: "surviveAtHp1" } },
    },
    10: {
      left: { name: "神速抜刀", desc: "敵単体へ320%ダメージ、防御力50%無視", mp: 7, action: { kind: "damage", mult: 3.2, defPierce: 0.5 } },
      right: { name: "明鏡止水", desc: "5ターンの間、攻撃力・防御力・素早さ+20%、毎ターンHP8%回復、状態異常無効", mp: 6, action: { kind: "buffSelf", stats: [{ stat: "atk", mult: 1.2 }, { stat: "def", mult: 1.2 }, { stat: "spd", mult: 1.2 }], turns: 5, hpRegenPct: 0.08, statusImmuneTurns: 5 } },
    },
  },
  ninja: {
    2: {
      left: { name: "急所狙い", desc: "会心率+15%", mp: 0, passive: { critRateAdd: 0.15 } },
      right: { name: "毒刃", desc: "通常攻撃時、25%の確率で敵を毒状態にする(蓄積3)", mp: 0, passive: { onHitInflict: { type: "poison", chance: 0.25, value: 3 } } },
    },
    3: {
      left: { name: "俊足", desc: "素早さ+15%", mp: 0, passive: { spdMult: 1.15 } },
      right: { name: "反射神経", desc: "回避率+12%", mp: 0, passive: { evasionAdd: 0.12 } },
    },
    4: {
      left: { name: "影斬り", desc: "敵単体へ170%ダメージ", mp: 3, action: { kind: "damage", mult: 1.7 } },
      right: { name: "スタン手裏剣", desc: "敵単体へ100%ダメージ、55%の確率でスタン(1ターン)", mp: 3, action: { kind: "damage", mult: 1.0, inflict: { type: "stun", chance: 0.55, turns: 1 } } },
    },
    5: {
      left: { name: "暗殺術", desc: "HPが50%以下の敵へのダメージ+30%", mp: 0, passive: { executeBonus: { belowPct: 0.5, mult: 1.3 } } },
      right: { name: "忍足", desc: "回避率+8%", mp: 0, passive: { evasionAdd: 0.08 } },
    },
    6: {
      left: { name: "影分身", desc: "回避率+12%", mp: 0, passive: { evasionAdd: 0.12 } },
      right: { name: "分身", desc: "被弾時、15%の確率で完全に回避する", mp: 0, passive: { dodgeChance: 0.15 } },
    },
    7: {
      left: { name: "修羅刃", desc: "敵を倒すと3ターンの間、攻撃力+20%", mp: 0, passive: { onKill: { statMult: [{ stat: "atk", mult: 1.2 }], turns: 3, maxStacks: 1 } } },
      right: { name: "幻惑", desc: "通常攻撃が命中した敵の防御力を10%下げる(3ターン)", mp: 0, passive: { onHitInflict: { type: "defDown", chance: 1.0, value: 0.1, turns: 3 } } },
    },
    8: {
      left: { name: "乱れ苦無", desc: "敵単体へ4連続攻撃(合計200%ダメージ)", mp: 5, action: { kind: "damage", mult: 2.0, hits: 4 } },
      right: { name: "影縫い", desc: "敵単体へ130%ダメージ、30%の確率でスタン", mp: 3, action: { kind: "damage", mult: 1.3, inflict: { type: "stun", chance: 0.3, turns: 1 } } },
    },
    9: {
      left: { name: "忍の極意", desc: "会心ダメージ+40%", mp: 0, passive: { critDmgAdd: 0.4 } },
      right: { name: "空蝉", desc: "戦闘中1回だけ、受けるダメージを完全に無効化する", mp: 0, passive: { onceGuardType: "nullifyDamage" } },
    },
    10: {
      left: { name: "瞬獄", desc: "敵単体へ290%ダメージ、HP50%以下の敵にはさらに1.4倍", mp: 7, action: { kind: "damage", mult: 2.9, executeBonus: { belowPct: 0.5, mult: 1.4 } } },
      right: { name: "朧隠れ", desc: "5ターンの間、回避率+30%", mp: 6, action: { kind: "buffSelf", stats: [{ stat: "evasionAdd", mult: 0.3 }], turns: 5 } },
    },
  },
  spearman: {
    2: {
      left: { name: "貫通突き", desc: "敵単体へ150%ダメージ、防御力20%無視", mp: 3, action: { kind: "damage", mult: 1.5, defPierce: 0.2 } },
      right: { name: "鉄壁", desc: "防御力+15%", mp: 0, passive: { defMult: 1.15 } },
    },
    3: {
      left: { name: "豪槍", desc: "攻撃力+12%", mp: 0, passive: { atkMult: 1.12 } },
      right: { name: "挑発", desc: "3ターンの間、敵から必ず狙われるようになり、防御力+15%", mp: 2, action: { kind: "buffSelf", stats: [{ stat: "def", mult: 1.15 }], turns: 3, tauntTurns: 3 } },
    },
    4: {
      left: { name: "連突き", desc: "敵単体へ2連続攻撃(合計150%ダメージ)、3ターンの間防御力-15%", mp: 3, action: { kind: "damage", mult: 1.5, hits: 2, inflict: { type: "defDown", chance: 0.4, value: 0.15, turns: 3 } } },
      right: { name: "迎撃", desc: "被弾時、30%の確率で反撃する", mp: 0, passive: { counterChance: 0.3 } },
    },
    5: {
      left: { name: "鎧砕き", desc: "敵単体へ150%ダメージ、3ターンの間防御力-20%", mp: 3, action: { kind: "damage", mult: 1.5, inflict: { type: "defDown", chance: 1.0, value: 0.2, turns: 3 } } },
      right: { name: "守護の構え", desc: "HPが80%以上の間、被ダメージ15%減少", mp: 0, passive: { conditionalMod: { cmp: "gte", value: 0.8, dmgTakenMult: 0.85 } } },
    },
    6: {
      left: { name: "槍術皆伝", desc: "攻撃力+10%", mp: 0, passive: { atkMult: 1.1 } },
      right: { name: "不屈", desc: "状態異常にかかる確率が40%減少する", mp: 0, passive: { statusResistMult: 0.4 } },
    },
    7: {
      left: { name: "警戒", desc: "回避率+12%", mp: 0, passive: { evasionAdd: 0.12 } },
      right: { name: "鋼の肉体", desc: "最大HP+20%", mp: 0, passive: { hpMult: 1.2 } },
    },
    8: {
      left: { name: "迅雷突き", desc: "敵単体へ210%ダメージ", mp: 4, action: { kind: "damage", mult: 2.1 } },
      right: { name: "守護陣", desc: "4ターンの間、味方全体の防御力+15%", mp: 5, action: { kind: "buffParty", stats: [{ stat: "def", mult: 1.15 }], turns: 4 } },
    },
    9: {
      left: { name: "槍鬼", desc: "敵を倒すたび攻撃力+12%(最大3回まで重複)", mp: 0, passive: { onKill: { statMult: [{ stat: "atk", mult: 1.12 }], turns: 20, maxStacks: 3 } } },
      right: { name: "金剛", desc: "被ダメージ13%減少", mp: 0, passive: { conditionalMod: { cmp: "gte", value: 0, dmgTakenMult: 0.87 } } },
    },
    10: {
      left: { name: "天穿槍", desc: "敵単体へ290%ダメージ、防御力45%無視", mp: 7, action: { kind: "damage", mult: 2.9, defPierce: 0.45 } },
      right: { name: "仁王立ち", desc: "5ターンの間、防御力+35%、被ダメージ25%減少、毎ターンHP5%回復", mp: 6, action: { kind: "buffSelf", stats: [{ stat: "def", mult: 1.35 }, { stat: "dmgTaken", mult: 0.75 }], turns: 5, hpRegenPct: 0.05 } },
    },
  },
  naginata: {
    2: {
      left: { name: "円月の構え", desc: "薙ぎ払いの威力+10%", mp: 0, passive: { atkMult: 1.1 } },
      right: { name: "足払い", desc: "敵単体へ130%ダメージ、40%の確率で素早さ-20%(3ターン)", mp: 2, action: { kind: "damage", mult: 1.3, inflict: { type: "spdDown", chance: 0.4, value: 0.2, turns: 3 } } },
    },
    3: {
      left: { name: "円舞", desc: "薙ぎ払いの威力+10%", mp: 0, passive: { atkMult: 1.1 } },
      right: { name: "崩し", desc: "通常攻撃が命中した敵の防御力を15%下げる(3ターン)", mp: 0, passive: { onHitInflict: { type: "defDown", chance: 0.3, value: 0.15, turns: 3 } } },
    },
    4: {
      left: { name: "旋風薙ぎ", desc: "敵全体へ100%ダメージ", mp: 4, action: { kind: "damage", aoe: true, mult: 1.0 } },
      right: { name: "威圧", desc: "通常攻撃が命中した敵の攻撃力を15%下げる(3ターン)", mp: 0, passive: { onHitInflict: { type: "atkDown", chance: 0.3, value: 0.15, turns: 3 } } },
    },
    5: {
      left: { name: "追刃", desc: "会心率+15%", mp: 0, passive: { critRateAdd: 0.15 } },
      right: { name: "舞姫", desc: "回避率+15%", mp: 0, passive: { evasionAdd: 0.15 } },
    },
    6: {
      left: { name: "乱舞", desc: "敵全体へ2連続攻撃(合計130%ダメージ)", mp: 5, action: { kind: "damage", aoe: true, mult: 1.3, hits: 2 } },
      right: { name: "流水", desc: "被弾時、13%の確率で完全に回避する", mp: 0, passive: { dodgeChance: 0.13 } },
    },
    7: {
      left: { name: "豪舞", desc: "攻撃力+15%", mp: 0, passive: { atkMult: 1.15 } },
      right: { name: "制圧の心得", desc: "防御力+10%", mp: 0, passive: { defMult: 1.1 } },
    },
    8: {
      left: { name: "花吹雪", desc: "敵全体へ150%ダメージ", mp: 6, action: { kind: "damage", aoe: true, mult: 1.5 } },
      right: { name: "乱心", desc: "通常攻撃時、15%の確率で敵をスタンさせる", mp: 0, passive: { onHitInflict: { type: "stun", chance: 0.15, turns: 1 } } },
    },
    9: {
      left: { name: "百花繚乱", desc: "薙ぎ払いの威力+12%", mp: 0, passive: { atkMult: 1.12 } },
      right: { name: "静寂", desc: "状態異常にかかる確率が35%減少する", mp: 0, passive: { statusResistMult: 0.35 } },
    },
    10: {
      left: { name: "千本桜", desc: "敵全体へ220%ダメージ", mp: 7, action: { kind: "damage", aoe: true, mult: 2.2 } },
      right: { name: "天女の舞", desc: "5ターンの間、味方全体の攻撃力・防御力・素早さ+15%", mp: 6, action: { kind: "buffParty", stats: [{ stat: "atk", mult: 1.15 }, { stat: "def", mult: 1.15 }, { stat: "spd", mult: 1.15 }], turns: 5 } },
    },
  },
  hunter: {
    2: {
      left: { name: "狙撃", desc: "敵単体へ150%ダメージ", mp: 3, action: { kind: "damage", mult: 1.5 } },
      right: { name: "毒矢", desc: "敵単体へ110%ダメージ、確実に毒状態にする(蓄積5)", mp: 3, action: { kind: "damage", mult: 1.1, inflict: { type: "poison", chance: 1.0, value: 5 } } },
    },
    3: {
      left: { name: "急所狙い", desc: "会心率+15%", mp: 0, passive: { critRateAdd: 0.15 } },
      right: { name: "罠師", desc: "命中率+8%", mp: 0, passive: { accuracyAdd: 0.08 } },
    },
    4: {
      left: { name: "二連射", desc: "敵単体へ2連続攻撃(合計150%ダメージ)", mp: 3, action: { kind: "damage", mult: 1.5, hits: 2 } },
      right: { name: "スタン矢", desc: "敵単体へ100%ダメージ、40%の確率でスタン", mp: 3, action: { kind: "damage", mult: 1.0, inflict: { type: "stun", chance: 0.4, turns: 1 } } },
    },
    5: {
      left: { name: "鷹の目", desc: "命中率+10%、会心ダメージ+15%", mp: 0, passive: { accuracyAdd: 0.1, critDmgAdd: 0.15 } },
      right: { name: "弱点看破", desc: "攻撃力+8%", mp: 0, passive: { atkMult: 1.08 } },
    },
    6: {
      left: { name: "狙撃術", desc: "攻撃力+12%", mp: 0, passive: { atkMult: 1.12 } },
      right: { name: "捕縛", desc: "通常攻撃が命中した敵の素早さを20%下げる(3ターン)", mp: 0, passive: { onHitInflict: { type: "spdDown", chance: 0.25, value: 0.2, turns: 3 } } },
    },
    7: {
      left: { name: "連射の心得", desc: "命中率+12%", mp: 0, passive: { accuracyAdd: 0.12 } },
      right: { name: "狩猟本能", desc: "HPが50%以下の敵へのダメージ+25%", mp: 0, passive: { executeBonus: { belowPct: 0.5, mult: 1.25 } } },
    },
    8: {
      left: { name: "必中撃ち", desc: "敵単体へ210%ダメージ。この攻撃は必ず命中する", mp: 4, action: { kind: "damage", mult: 2.1, guaranteedHit: true } },
      right: { name: "腐食毒", desc: "通常攻撃が命中した敵の防御力を20%下げる(3ターン)", mp: 0, passive: { onHitInflict: { type: "defDown", chance: 0.2, value: 0.2, turns: 3 } } },
    },
    9: {
      left: { name: "射手の極意", desc: "会心率+15%、会心ダメージ+25%", mp: 0, passive: { critRateAdd: 0.15, critDmgAdd: 0.25 } },
      right: { name: "百歩穿楊", desc: "攻撃力+10%", mp: 0, passive: { atkMult: 1.1 } },
    },
    10: {
      left: { name: "流星射ち", desc: "敵単体へ290%ダメージ", mp: 7, action: { kind: "damage", mult: 2.9 } },
      right: { name: "狩神の領域", desc: "5ターンの間、素早さ+20%、攻撃力+15%", mp: 6, action: { kind: "buffSelf", stats: [{ stat: "spd", mult: 1.2 }, { stat: "atk", mult: 1.15 }], turns: 5 } },
    },
  },
  gunner: {
    2: {
      left: { name: "精密射撃", desc: "敵単体へ190%ダメージ。次の自分のターンは装填で動けない", mp: 3, action: { kind: "damage", mult: 1.9, selfReload: true } },
      right: { name: "榴弾", desc: "敵全体へ85%ダメージ", mp: 5, action: { kind: "damage", aoe: true, mult: 0.85 } },
    },
    3: {
      left: { name: "火薬強化", desc: "攻撃力+12%", mp: 0, passive: { atkMult: 1.12 } },
      right: { name: "爆薬調合", desc: "攻撃力+10%(範囲攻撃向け)", mp: 0, passive: { atkMult: 1.1 } },
    },
    4: {
      left: { name: "貫通弾", desc: "敵単体へ210%ダメージ、防御力25%無視。次の自分のターンは装填で動けない", mp: 4, action: { kind: "damage", mult: 2.1, defPierce: 0.25, selfReload: true } },
      right: { name: "炸裂弾", desc: "敵全体へ100%ダメージ、30%の確率で攻撃力-15%(3ターン)", mp: 5, action: { kind: "damage", aoe: true, mult: 1.0, inflict: { type: "atkDown", chance: 0.3, value: 0.15, turns: 3 } } },
    },
    5: {
      left: { name: "照準", desc: "命中率+15%", mp: 0, passive: { accuracyAdd: 0.15 } },
      right: { name: "焼夷弾", desc: "通常攻撃時、20%の確率で敵を炎上状態にする(3ターン)", mp: 0, passive: { onHitInflict: { type: "burn", chance: 0.2, turns: 3 } } },
    },
    6: {
      left: { name: "装填術", desc: "攻撃力+12%", mp: 0, passive: { atkMult: 1.12 } },
      right: { name: "爆風拡大", desc: "攻撃力+12%(範囲攻撃向け)", mp: 0, passive: { atkMult: 1.12 } },
    },
    7: {
      left: { name: "急所射撃", desc: "会心ダメージ+35%", mp: 0, passive: { critDmgAdd: 0.35 } },
      right: { name: "衝撃波", desc: "通常攻撃が命中した敵を15%の確率でスタンさせる(1ターン)", mp: 0, passive: { onHitInflict: { type: "stun", chance: 0.15, turns: 1 } } },
    },
    8: {
      left: { name: "徹甲弾", desc: "敵単体へ220%ダメージ、防御力35%無視", mp: 5, action: { kind: "damage", mult: 2.2, defPierce: 0.35 } },
      right: { name: "一斉砲撃", desc: "敵全体へ190%ダメージ。次の自分のターンは装填で動けない", mp: 6, action: { kind: "damage", aoe: true, mult: 1.9, selfReload: true } },
    },
    9: {
      left: { name: "砲撃術皆伝", desc: "MP消費-20%", mp: 0, passive: { mpDiscountPct: 0.2 } },
      right: { name: "爆炎支配", desc: "HPが50%以下の敵へのダメージ+25%", mp: 0, passive: { executeBonus: { belowPct: 0.5, mult: 1.25 } } },
    },
    10: {
      left: { name: "神威砲", desc: "敵単体へ340%ダメージ、防御力45%無視", mp: 7, action: { kind: "damage", mult: 3.4, defPierce: 0.45 } },
      right: { name: "天地崩砲", desc: "敵全体へ220%ダメージ、40%の確率で炎上(3ターン)を付与", mp: 7, action: { kind: "damage", aoe: true, mult: 2.2, inflict: { type: "burn", chance: 0.4, turns: 3 } } },
    },
  },
  onmyoji: {
    2: {
      left: { name: "火遁符", desc: "敵単体へ150%の魔法ダメージ", mp: 3, action: { kind: "damage", mult: 1.5, useMag: true } },
      right: { name: "呪縛符", desc: "通常攻撃時、25%の確率で敵の攻撃力を15%下げる(3ターン)", mp: 0, passive: { onHitInflict: { type: "atkDown", chance: 0.25, value: 0.15, turns: 3 } } },
    },
    3: {
      left: { name: "水遁符", desc: "敵全体へ85%の魔法ダメージ", mp: 5, action: { kind: "damage", aoe: true, mult: 0.85, useMag: true } },
      right: { name: "結界術", desc: "3ターンの間、味方全体の防御力+15%", mp: 4, action: { kind: "buffParty", stats: [{ stat: "def", mult: 1.15 }], turns: 3 } },
    },
    4: {
      left: { name: "雷遁符", desc: "敵単体へ170%の魔法ダメージ、25%の確率でスタン", mp: 4, action: { kind: "damage", mult: 1.7, useMag: true, inflict: { type: "stun", chance: 0.25, turns: 1 } } },
      right: { name: "衰弱符", desc: "敵単体へ80%の魔法ダメージ、3ターンの間防御力-20%", mp: 3, action: { kind: "damage", mult: 0.8, useMag: true, inflict: { type: "defDown", chance: 1.0, value: 0.2, turns: 3 } } },
    },
    5: {
      left: { name: "五行の理", desc: "術の威力+10%", mp: 0, passive: { atkMult: 1.1 } },
      right: { name: "封魔符", desc: "敵単体へ80%の魔法ダメージ、35%の確率でスタン", mp: 3, action: { kind: "damage", mult: 0.8, useMag: true, inflict: { type: "stun", chance: 0.35, turns: 1 } } },
    },
    6: {
      left: { name: "陰陽融合", desc: "命中率+12%", mp: 0, passive: { accuracyAdd: 0.12 } },
      right: { name: "式神召喚", desc: "術の威力+8%", mp: 0, passive: { atkMult: 1.08 } },
    },
    7: {
      left: { name: "天地鳴動", desc: "敵全体へ110%の魔法ダメージ", mp: 6, action: { kind: "damage", aoe: true, mult: 1.1, useMag: true } },
      right: { name: "厄災", desc: "HPが30%以下の敵への魔法ダメージ+15%", mp: 0, passive: { executeBonus: { belowPct: 0.3, mult: 1.15 } } },
    },
    8: {
      left: { name: "陰陽極意", desc: "MP消費-25%", mp: 0, passive: { mpDiscountPct: 0.25 } },
      right: { name: "呪詛", desc: "通常攻撃時、20%の確率で敵を炎上状態にする(3ターン)", mp: 0, passive: { onHitInflict: { type: "burn", chance: 0.2, turns: 3 } } },
    },
    9: {
      left: { name: "四神加護", desc: "会心ダメージ+30%", mp: 0, passive: { critDmgAdd: 0.3 } },
      right: { name: "霊脈支配", desc: "防御力+10%", mp: 0, passive: { defMult: 1.1 } },
    },
    10: {
      left: { name: "五行滅殺陣", desc: "敵全体へ200%の魔法ダメージ、防御力25%無視", mp: 7, action: { kind: "damage", aoe: true, mult: 2.0, useMag: true, defPierce: 0.25 } },
      right: { name: "黄泉の呪", desc: "敵全体へ80%の魔法ダメージ、60%の確率で防御力-25%(3ターン)", mp: 7, action: { kind: "damage", aoe: true, mult: 0.8, useMag: true, inflict: { type: "defDown", chance: 0.6, value: 0.25, turns: 3 } } },
    },
  },
  priest: {
    2: {
      left: { name: "治癒術", desc: "治癒の術の回復量+15%", mp: 0, passive: { atkMult: 1.15 } },
      right: { name: "祝福", desc: "防御力+10%", mp: 0, passive: { defMult: 1.1 } },
    },
    3: {
      left: { name: "癒しの祈り", desc: "味方単体のHPを35%回復し、状態異常を解除する", mp: 3, action: { kind: "heal", healPct: 0.35, cleanse: true } },
      right: { name: "神聖加護", desc: "3ターンの間、味方全体の防御力+15%", mp: 4, action: { kind: "buffParty", stats: [{ stat: "def", mult: 1.15 }], turns: 3 } },
    },
    4: {
      left: { name: "生命力循環", desc: "技のMP消費を15%の確率で無効化する", mp: 0, passive: { mpRefundChance: 0.15 } },
      right: { name: "浄化", desc: "味方全体の状態異常を解除する", mp: 3, action: { kind: "buffParty", stats: [], turns: 1, cleanse: true } },
    },
    5: {
      left: { name: "慈愛", desc: "治癒の術の回復量+10%", mp: 0, passive: { atkMult: 1.1 } },
      right: { name: "聖なる結界", desc: "3ターンの間、味方全体の被ダメージ12%減少", mp: 4, action: { kind: "buffParty", stats: [{ stat: "dmgTaken", mult: 0.88 }], turns: 3 } },
    },
    6: {
      left: { name: "蘇生術", desc: "技のMP消費-20%", mp: 0, passive: { mpDiscountPct: 0.2 } },
      right: { name: "神託", desc: "3ターンの間、味方全体の素早さ+15%", mp: 4, action: { kind: "buffParty", stats: [{ stat: "spd", mult: 1.15 }], turns: 3 } },
    },
    7: {
      left: { name: "癒しの波動", desc: "味方全体のHPを20%回復する", mp: 5, action: { kind: "heal", aoe: true, healPct: 0.2 } },
      right: { name: "聖域", desc: "状態異常にかかる確率が40%減少する", mp: 0, passive: { statusResistMult: 0.4 } },
    },
    8: {
      left: { name: "生命の奇跡", desc: "技のMP消費を15%の確率で無効化する(生命力循環と重複可)", mp: 0, passive: { mpRefundChance: 0.15 } },
      right: { name: "神威", desc: "4ターンの間、味方全体の攻撃力・防御力+15%", mp: 5, action: { kind: "buffParty", stats: [{ stat: "atk", mult: 1.15 }, { stat: "def", mult: 1.15 }], turns: 4 } },
    },
    9: {
      left: { name: "慈悲の心", desc: "治癒の術の回復量+10%", mp: 0, passive: { atkMult: 1.1 } },
      right: { name: "退魔", desc: "状態異常にかかる確率が30%減少する", mp: 0, passive: { statusResistMult: 0.3 } },
    },
    10: {
      left: { name: "命の祝福", desc: "味方全体のHPを全回復し、戦闘不能の仲間をHP50%で蘇生する", mp: 8, action: { kind: "heal", aoe: true, healPct: 1.0, reviveHpPct: 0.5, cleanse: true } },
      right: { name: "天恵の祈り", desc: "5ターンの間、味方全体の攻撃力・防御力・素早さ+20%、毎ターンHP8%回復、状態異常無効", mp: 7, action: { kind: "buffParty", stats: [{ stat: "atk", mult: 1.2 }, { stat: "def", mult: 1.2 }, { stat: "spd", mult: 1.2 }], turns: 5, hpRegenPct: 0.08, statusImmuneTurns: 5 } },
    },
  },
};
const SUPPLY_CAP = 10; // 支援物資(回復薬+煙玉の合計)は一度の遠征で最大10個まで持てる

// 職業ごとの武器/防具。各5段階(Lv1/3/5/7/9で解禁、レベルが2上がるごとに上位種が出る)。
// 上位を買うと下位から乗り換わる(加算ではなく差し替え)。「そのレベルに到達した仲間が1人でもいるか」で解禁判定する。
// 購入すると同じ職業の全メンバーに恒久的なステータスが乗る。個別の装備の付け外しは無く、
// 「その職業への投資」として一度買えば以後ずっと有効(ウィザードリィ的な個別装備管理はMVPとして省略)。
// 最上位(Lv9)の数値は、そのステータスがレベル1→10のレベルアップだけで伸びる量のおよそ半分になるよう調整してある
// (例: 侍はレベルアップだけで攻撃力+13伸びるので、武器の最終段階は+7程度に抑え、装備がレベルアップの主役を
// 食ってしまわないようにした)。防具(防御力)は元々のレベル成長自体が緩やかなため、最終段階は小さい値になる。
function tier(name, statKey, bonus, price, level) {
  return { name, statKey, bonus, price, level };
}
// 甲冑ボーナス(def)は「防具なし→MAX装備で被ダメージ約30%減」を狙って再設計したもの
// (旧来はレベル成長がdefを底上げしていたが、レベルによるdef成長を廃止したのに合わせて
// 装備側の伸び幅を大幅に引き上げた。価格は据え置き)
const EQUIPMENT = {
  samurai: {
    weapon: [tier("業物の刀", "atk", 2, 40, 1), tier("業物の太刀", "atk", 4, 90, 3), tier("妖刀", "atk", 5, 125, 5), tier("鬼哭の刀", "atk", 6, 160, 7), tier("伝説の名刀", "atk", 7, 200, 9)],
    armor: [tier("当世具足", "def", 2, 30, 1), tier("強化当世具足", "def", 4, 20, 3), tier("上級当世具足", "def", 7, 30, 5), tier("鬼哭の甲冑", "def", 9, 45, 7), tier("伝説の甲冑", "def", 11, 55, 9)],
  },
  ninja: {
    weapon: [tier("業物の苦無", "atk", 2, 40, 1), tier("改良苦無", "atk", 4, 90, 3), tier("影の苦無", "atk", 5, 120, 5), tier("月影の苦無", "atk", 6, 160, 7), tier("暁の苦無", "atk", 7, 195, 9)],
    armor: [tier("強化忍び装束", "def", 2, 30, 1), tier("精鋭忍び装束", "def", 4, 20, 3), tier("上級忍び装束", "def", 6, 35, 5), tier("月影の装束", "def", 9, 45, 7), tier("暁の装束", "def", 11, 60, 9)],
  },
  spearman: {
    weapon: [tier("鍛えの槍", "atk", 2, 40, 1), tier("業物の槍", "atk", 3, 70, 3), tier("十文字槍", "atk", 4, 100, 5), tier("鬼殺しの槍", "atk", 5, 130, 7), tier("伝説の大槍", "atk", 6, 170, 9)],
    armor: [tier("鉄の大盾", "def", 2, 30, 1), tier("業物の大盾", "def", 5, 20, 3), tier("強化大盾", "def", 7, 35, 5), tier("鬼殺しの大盾", "def", 10, 45, 7), tier("伝説の盾", "def", 12, 60, 9)],
  },
  naginata: {
    weapon: [tier("鍛えの薙刀", "atk", 2, 40, 1), tier("業物の薙刀", "atk", 3, 65, 3), tier("大薙刀", "atk", 4, 90, 5), tier("巴形の薙刀", "atk", 5, 120, 7), tier("伝説の薙刀", "atk", 6, 155, 9)],
    armor: [tier("強化白鉢巻", "def", 2, 30, 1), tier("強化具足", "def", 4, 20, 3), tier("上級具足", "def", 7, 35, 5), tier("巴形の装束", "def", 9, 45, 7), tier("伝説の巫女装束", "def", 11, 65, 9)],
  },
  hunter: {
    weapon: [tier("鍛えの弓", "atk", 2, 40, 1), tier("業物の弓", "atk", 3, 70, 3), tier("強弓", "atk", 4, 100, 5), tier("鬼哭の弓", "atk", 5, 130, 7), tier("伝説の弓", "atk", 6, 170, 9)],
    armor: [tier("強化猟師装束", "def", 2, 30, 1), tier("精鋭猟師装束", "def", 4, 15, 3), tier("上級猟師装束", "def", 6, 25, 5), tier("鬼哭の猟師装束", "def", 8, 35, 7), tier("伝説の猟師装束", "def", 10, 45, 9)],
  },
  gunner: {
    weapon: [tier("鍛えの火縄銃", "atk", 3, 55, 1), tier("業物の火縄銃", "atk", 4, 85, 3), tier("上級火縄銃", "atk", 6, 135, 5), tier("雷神の大筒", "atk", 7, 170, 7), tier("伝説の大筒", "atk", 8, 205, 9)],
    armor: [tier("強化胴当て", "def", 2, 30, 1), tier("精鋭胴当て", "def", 4, 15, 3), tier("上級胴当て", "def", 6, 25, 5), tier("雷神の胴当て", "def", 8, 35, 7), tier("伝説の胴当て", "def", 10, 45, 9)],
  },
  onmyoji: {
    weapon: [tier("式神の御幣", "mag", 3, 60, 1), tier("精霊の御幣", "mag", 5, 110, 3), tier("上級御幣", "mag", 6, 140, 5), tier("秘伝の御幣", "mag", 8, 205, 7), tier("大陰陽の御幣", "mag", 9, 245, 9)],
    armor: [tier("浄衣", "def", 2, 30, 1), tier("精霊の浄衣", "def", 4, 10, 3), tier("上級浄衣", "def", 6, 20, 5), tier("秘伝の浄衣", "def", 8, 25, 7), tier("大陰陽の浄衣", "def", 9, 35, 9)],
  },
  priest: {
    weapon: [tier("聖なる錫杖", "mag", 2, 45, 1), tier("高僧の錫杖", "mag", 4, 100, 3), tier("大僧正の錫杖", "mag", 5, 135, 5), tier("悟りの錫杖", "mag", 6, 170, 7), tier("神託の錫杖", "mag", 7, 215, 9)],
    armor: [tier("法衣", "def", 2, 30, 1), tier("高僧の法衣", "def", 4, 15, 3), tier("大僧正の法衣", "def", 6, 25, 5), tier("悟りの法衣", "def", 8, 35, 7), tier("神託の法衣", "def", 10, 45, 9)],
  },
};

// 戦闘不能で瀕死になったキャラは、昼夜が切り替わるたび(halfDayStep)にカウントが進み、
// この範囲でランダムに決まる猶予を過ぎると誰も救出に来なくてもロストする
// (旧2〜4=1〜2日分→4〜6=2〜3日分ときて、ユーザー指示でさらに半日分伸ばした)
const CRITICAL_MIN_HALFDAYS = 5; // 2.5日
const CRITICAL_MAX_HALFDAYS = 7; // 3.5日

const FATIGUE_PER_FLOOR = 2; // フィールドに出ているキャラが1階進むごとに溜まる疲労度(旧4から半減)
const FATIGUE_MAX = 100;

// 温泉: 宿屋では抜けなくなった疲労度を回復するための有料施設。1回で半分(50)回復する。
// 料金は一人あたり定額。入浴すると6時間はパーティ編成に組み込めなくなる(宿泊は引き続き可能)
const ONSEN_FATIGUE_RELIEF = 50;
const ONSEN_FLAT_COST = 20;
const ONSEN_LOCK_MINUTES = 360; // 6時間 = 360分
// 宿屋の宿泊はHP/MP全回復に加えて、ストレスも少量(10)回復する
const LODGE_FATIGUE_RELIEF = 10;

// 敵の強さ倍率。以前は「階層に応じて伸びる基礎カーブ」+「階層1〜15で増加後25にかけてフェードする
// 序盤ボーナス」を別々に足し算していたため、階層15をピークに階層20〜25で敵が逆に弱くなる歪んだコブが
// できてしまっていた。実際にはENEMIESの4段階ティア(序盤/中盤/後半/終盤、素の平均ステータスが
// 各段階で約1.6〜2.1倍ずつ綺麗に伸びている)だけで深さによる強さの違いは十分に表現できており、
// 「奥へ進むリスク」自体はストレス蓄積や瀕死救出システム側が担うべき、という方針のもと、
// 階層に応じて変動する倍率を廃止し、常に一定の倍率だけを掛ける方式に単純化した。
// 倍率の値は旧仕様の階層1時点(序盤の緊張感の基準)と一致させてあるので、階層1〜8のキツさは維持される
const ENEMY_SCALE = 3.8; // 敵の攻撃力/HPに常に掛かる固定倍率(旧・階層1のbaseScale+序盤ボーナス相当)
const ENEMY_DEF_SCALE = 1.42; // 敵の防御力に常に掛かる固定倍率(同上)
const MAX_LEVEL = 10; // レベル上限。ダクソン/XCOM的に「少ないレベルで大きく強くなる」設計のため低めに圧縮
// 敵の攻撃力だけをさらに1割弱体化する倍率(HP/防御力には影響しない)
const ENEMY_ATK_MULT = 0.9;
// 敵のHPだけをさらに1割弱体化する倍率(大群系isSwarmは元々ステータス控えめな雑魚のため対象外)
const ENEMY_HP_MULT = 0.9;
// 大群系(isSwarm)の敵だけ、上記ENEMY_ATK_MULTの弱体化を踏まえた現状値からさらに攻撃力を1割強化する倍率
const ENEMY_SWARM_ATK_MULT = 1.1;
// 大群系が絡んだ遭遇になる確率(1回の遭遇につき1回だけ判定する)。毎回出るとうざいので控えめにしてある
const SWARM_ENCOUNTER_CHANCE = 0.15;

// 炎上(毒とは別系統のDOT): 毒が固定ダメージ+蓄積減衰なのに対し、炎上は最大HPの割合ダメージ+ターン数固定(減衰なし)。
// 低HPの相手には毒が、高HPのタンクには炎上がよく効く、という住み分けを狙っている(陰陽師/砲術士の専売)
const BURN_DAMAGE_PCT = 0.07;

// 命中率/回避率。素早い敵ほど回避率が上がり「攻撃をかわしてくる緊張感」を出すが、
// かわし過ぎてストレスにならないよう回避率に上限(EVASION_MAX)を、命中率に下限(MIN_HIT_CHANCE)を設けている。
// 狩人だけCLASSESのaccuracyが高いので、同じ相手でも狩人は他職業よりずっと当てやすい
const BASE_ACCURACY = 0.95;
const EVASION_SPD_BASELINE = 6; // この素早さ以下ならほぼ回避してこない
const EVASION_SPD_FACTOR = 0.012; // 素早さ1につき回避率+1.2%
const EVASION_MAX = 0.18;
const MIN_HIT_CHANCE = 0.75;

if (typeof module !== "undefined") {
  module.exports = {
    CLASSES, ABILITY_LABEL, ABILITY_DESC, ENEMIES, ITEMS, EQUIPMENT, CRITICAL_MIN_HALFDAYS, CRITICAL_MAX_HALFDAYS,
    FATIGUE_PER_FLOOR, FATIGUE_MAX, ONSEN_FATIGUE_RELIEF, ONSEN_FLAT_COST, ONSEN_LOCK_MINUTES, LODGE_FATIGUE_RELIEF, MAX_LEVEL, ENEMY_ATK_MULT, ENEMY_HP_MULT, ENEMY_SWARM_ATK_MULT,
    ENEMY_SCALE, ENEMY_DEF_SCALE, SWARM_ENCOUNTER_CHANCE, BURN_DAMAGE_PCT,
    BASE_ACCURACY, EVASION_SPD_BASELINE, EVASION_SPD_FACTOR, EVASION_MAX, MIN_HIT_CHANCE, SKILL_TREES,
    CAMPING_KIT_CAP, CAMP_HP_RELIEF, CAMP_MP_RELIEF, CAMP_STRESS_RELIEF, CAMP_COMFORT_STRESS_RELIEF,
    CAMP_WEAPON_CARE_ATK_MULT, CAMP_WEAPON_CARE_BATTLES,
  };
}
