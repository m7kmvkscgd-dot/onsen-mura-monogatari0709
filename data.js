// ダンジョン1: データ定義(職業・敵・アイテム)

// 和製8職業の個性設計(ユーザー提供のキャラシートに基づく):
// - 単体特化: 侍(会心の一撃)・忍(奇襲)・狩人(会心の一矢)
// - タンク: 槍士(かばう)
// - 範囲特化: 薙刀士(薙ぎ払い)
// - 高火力/低速: 砲術士(砲撃、使うと次のターンは装填で動けない)
// - 魔法: 陰陽師(呪符ノ術=単体/大祓ノ術=全体)
// - 支援: 僧侶(治癒の術)
// accuracy: 命中率の基本値。狩人だけ突出して高くし「命中率が高い職業」という個性にする(他は共通のBASE_ACCURACY相当の0.95)
// defは「被ダメ軽減%」を直接表す固定値(旧: K/(K+def)式への入力だった数値を、防御力体系の
// 全面刷新に伴い職業固有の固定%に置き換えた。レベルでは成長しない、装備でのみ上乗せされる)
const CLASSES = {
  samurai: { ja: "侍", image: "assets/class_samurai.png", hp: 35, atk: 12, def: 30, spd: 11, mag: 0, accuracy: 0.95, abilities: ["critAttack"] },
  ninja: { ja: "忍", image: "assets/class_ninja.png", hp: 30, atk: 13, def: 28, spd: 16, mag: 0, accuracy: 0.95, abilities: ["powerAttack"] },
  spearman: { ja: "槍士", image: "assets/class_spearman.png", hp: 39, atk: 11, def: 35, spd: 7, mag: 0, accuracy: 0.95, abilities: ["guard"] },
  naginata: { ja: "薙刀士", image: "assets/class_naginata.png", hp: 33, atk: 12, def: 30, spd: 11, mag: 0, accuracy: 0.95, abilities: ["physicalAttackAll"] },
  hunter: { ja: "狩人", image: "assets/class_hunter.png", hp: 27, atk: 11, def: 28, spd: 12, mag: 0, accuracy: 0.99, abilities: ["preciseShot"] },
  gunner: { ja: "砲術士", image: "assets/class_gunner.png", hp: 29, atk: 16, def: 25, spd: 4, mag: 0, accuracy: 0.95, abilities: ["cannonShot"] },
  onmyoji: { ja: "陰陽師", image: "assets/class_onmyoji.png", hp: 25, atk: 5, def: 20, spd: 9, mag: 17, maxMp: 10, accuracy: 0.95, abilities: ["magicAttack", "magicAttackAll"] },
  priest: { ja: "僧侶", image: "assets/class_priest.png", hp: 27, atk: 6, def: 25, spd: 8, mag: 13, maxMp: 10, accuracy: 0.95, abilities: ["heal"] },
};

// ステータス詳細画面(renderStatusScreen)専用の「ストレス無し時」立ち絵。
// パーティ編成/出発準備/パーティバー等、他の画面で使われるCLASSES[classId].imageとは
// あえて別ファイルにしてあり、ここを差し替えても他画面には一切影響しない
// (ストレスがある時はこれまで通りCLASS_STRESS_IMAGESを使う。statusPortraitSrc()参照)
const CLASS_STATUS_PORTRAIT = {
  samurai: "assets/class_samurai_status.png",
  ninja: "assets/class_ninja_status.png",
  spearman: "assets/class_spearman_status.png",
  naginata: "assets/class_naginata_status.png",
  hunter: "assets/class_hunter_status.png",
  gunner: "assets/class_gunner_status.png",
  onmyoji: "assets/class_onmyoji_status.png",
  priest: "assets/class_priest_status.png",
};

// 温泉の入浴が明けた時の「リラックスできた！」ポップアップ専用の風呂上り立ち絵(JPEG、背景#353a44)
const CLASS_ONSEN_RELIEF_IMAGE = {
  samurai: "assets/class_samurai_onsen.jpg",
  ninja: "assets/class_ninja_onsen.jpg",
  spearman: "assets/class_spearman_onsen.jpg",
  naginata: "assets/class_naginata_onsen.jpg",
  hunter: "assets/class_hunter_onsen.jpg",
  gunner: "assets/class_gunner_onsen.jpg",
  onmyoji: "assets/class_onmyoji_onsen.jpg",
  priest: "assets/class_priest_onsen.jpg",
};

// ストレス段階ごとのキャラ立ち絵差し替え(通常時はCLASSES[classId].imageをそのまま使う)。
// mild=ストレス50超、severe=75超、panic=100(engine.jsのcharacterPortraitSrc()参照)
const CLASS_STRESS_IMAGES = {
  samurai: { mild: "assets/class_samurai_mild.png", severe: "assets/class_samurai_severe.png", panic: "assets/class_samurai_panic.png" },
  ninja: { mild: "assets/class_ninja_mild.png", severe: "assets/class_ninja_severe.png", panic: "assets/class_ninja_panic.png" },
  spearman: { mild: "assets/class_spearman_mild.png", severe: "assets/class_spearman_severe.png", panic: "assets/class_spearman_panic.png" },
  naginata: { mild: "assets/class_naginata_mild.png", severe: "assets/class_naginata_severe.png", panic: "assets/class_naginata_panic.png" },
  hunter: { mild: "assets/class_hunter_mild.png", severe: "assets/class_hunter_severe.png", panic: "assets/class_hunter_panic.png" },
  gunner: { mild: "assets/class_gunner_mild.png", severe: "assets/class_gunner_severe.png", panic: "assets/class_gunner_panic.png" },
  onmyoji: { mild: "assets/class_onmyoji_mild.png", severe: "assets/class_onmyoji_severe.png", panic: "assets/class_onmyoji_panic.png" },
  priest: { mild: "assets/class_priest_mild.png", severe: "assets/class_priest_severe.png", panic: "assets/class_priest_panic.png" },
};

// 職業ごとのざっくりとした説明文(ゲーム開始時の最初の1人選び画面で表示する)
const CLASS_DESC = {
  samurai: "会心の一撃を得意とする単体特化の剣士。攻撃力・防御力ともに高水準で扱いやすい。",
  ninja: "抜群の素早さで先手を取り、奇襲で一撃を狙う俊敏な戦士。",
  spearman: "高いHPと防御力を誇り、「かばう」で仲間を守る守護者。",
  naginata: "薙ぎ払いで敵全体を攻撃できる範囲特化の武人。",
  hunter: "抜群の命中率と会心の一矢で急所を突く弓使い。飛んでいる敵を撃ち落とすのも得意。",
  gunner: "圧倒的な火力の砲撃を放つが、撃った次のターンは装填で動けなくなる。",
  onmyoji: "呪符ノ術(単体)・大祓ノ術(全体)を操る魔法職。打たれ弱いが火力は高い。",
  priest: "治癒の術で仲間のHPを回復する支援役。",
};

// ゲーム開始時に最初の1人を選んだ時、性格をランダムではなく職業ごとに固定する仕組み(旧仕様)。
// ユーザー指示でいったん未使用にした(town.js側の最初の1人作成処理は現在pickNonDuplicatePersonality()を
// 使っている)。復活させる可能性があるためデータ自体は削除せず残してある
const FIRST_CHARACTER_PERSONALITY = {
  samurai: "熱血",
  ninja: "無口",
  spearman: "世話好き",
  naginata: "優しい",
  hunter: "冷静",
  gunner: "お調子者",
  onmyoji: "生意気",
  priest: "のんびり",
};

// 性格: キャラ作成時にランダムで1つ割り当てる(ステータス画面で文字表示、絵文字は使わない)。
// 戦闘中/探索中にまれに表示される吹き出しセリフの、性格ごとの言い回しの違いに使う
const PERSONALITIES = ["優しい", "熱血", "冷静", "生意気", "のんびり", "真面目", "世話好き", "お調子者", "無口", "怖がり"];
// 「世話好き」はユーザー指示で一時的に選択プールから除外(セリフ等のデータ自体はDIALOGUE_LINES等に
// 残したままなので、この配列に戻すだけでいつでも復活できる)。新規キャラの性格抽選は必ずこちらを使う。
// 既に世話好きを持つ既存キャラの検証(PERSONALITIES.includes、save.js)は元のPERSONALITIES側で
// 行うため、勝手に別の性格へ再割り当てされることはない
const ACTIVE_PERSONALITIES = PERSONALITIES.filter((p) => p !== "世話好き");

// 吹き出しセリフの本文。キー(カテゴリ)ごとに性格→セリフ配列。
// selfSkillHit/allySkillHit、selfPinch/allyPinch は同じ発生イベントを、発言者が当事者か
// 別の仲間かで出し分けるためのペア(engine側でどちらのセリフを使うか抽選する)
// 性格構成を10種(優しい/熱血/冷静/生意気/のんびり/真面目/世話好き/お調子者/無口/怖がり)に
// 変更したのに伴い、旧セリフ(豪快を含む9性格分)を一旦すべて削除して空にしてある。
// trySpeak()側は該当カテゴリ/性格のセリフが無ければ何も発言しないだけなので、システムはこのままで動作する。
// 今後、通常イベント/戦闘後の掛け合い/野営会話/ボス前会話/帰還時会話などを新10性格分で順次追加していく予定。
// (カテゴリの目安: selfPinch/allyPinch/selfSkillHit/allySkillHit/selfHealed/allyDefeated/battleStart/
//  stressLight/stressMid/stressHigh/breakdown/dangerFloor/normalKill/allDefeated/retreat/
//  retreatPinch/questTargetFound)
const DIALOGUE_LINES = {};

// おみくじ: 神社で1日1回引ける5段階の運勢。数値バフではなく次の遠征の展開そのものを変える効果にしてある
// (weightの合計は100。効果の実際の発動箇所はindex.html側のomikuji関連コードを参照)
const OMIKUJI_TIERS = {
  daikichi: { label: "大吉", weight: 5, effectDesc: "次の遠征中、瀕死の一撃をパーティ全員で一度だけHP1に耐える" },
  chukichi: { label: "中吉", weight: 15, effectDesc: "次の遠征中、不穏な道が一切出ない" },
  kichi: { label: "吉", weight: 30, effectDesc: "次の遠征、最初の戦闘だけ会心が3回連続で発生する" },
  shokichi: { label: "小吉", weight: 35, effectDesc: "次の遠征、最初の戦闘だけ先制確定" },
  kyou: { label: "凶", weight: 15, effectDesc: "特に何も起こらない" },
};
// おみくじの結果ごとに、引いた仲間が漏らす性格別の一言(5段階×10性格=50パターン)
const OMIKUJI_LINES = {
  daikichi: {
    優しい: ["こんなに良いなんて…嬉しいな。"],
    熱血: ["よっしゃあ！最高の御札だ！"],
    冷静: ["大吉か。幸先がいい。"],
    生意気: ["ふん、当然の結果だよね。"],
    のんびり: ["わぁ…なんかいいことありそう。"],
    真面目: ["身が引き締まります。大切にします。"],
    世話好き: ["これでみんなを守れそう。"],
    お調子者: ["うおおお大吉ー！ツイてる！"],
    無口: ["……大吉。悪くない。"],
  },
  chukichi: {
    優しい: ["ちょっと安心した。"],
    熱血: ["よし、悪くない滑り出しだ！"],
    冷静: ["中吉、上出来だ。"],
    生意気: ["まあまあってとこ？"],
    のんびり: ["お、良さそうな感じ。"],
    真面目: ["この運を活かします。"],
    世話好き: ["いい兆し、ほっとするね。"],
    お調子者: ["中吉きたー！悪くない！"],
    無口: ["……中吉。上々。"],
  },
  kichi: {
    優しい: ["うん、良い感じ。"],
    熱血: ["よし、いい流れだ！"],
    冷静: ["吉、まずまずだ。"],
    生意気: ["そこそこじゃん。"],
    のんびり: ["まあまあいいかも。"],
    真面目: ["堅実な結果です。"],
    世話好き: ["悪くないね、安心した。"],
    お調子者: ["吉ー！まあまあツイてる！"],
    無口: ["……吉。上々。"],
  },
  shokichi: {
    優しい: ["少しだけ運が良さそう。"],
    熱血: ["小さくてもツキはツキだ！"],
    冷静: ["小吉、悪くはない。"],
    生意気: ["ま、こんなもんか。"],
    のんびり: ["ちょっとだけラッキーかな。"],
    真面目: ["小さな運も活かします。"],
    世話好き: ["少しでも良い兆しはありがたいね。"],
    お調子者: ["小吉でもツイてるツイてる！"],
    無口: ["……小吉。まあまあ。"],
  },
  kyou: {
    優しい: ["うーん…気をつけよう。"],
    熱血: ["凶なんて気にしない！"],
    冷静: ["凶か。まあ、ただの紙だ。"],
    生意気: ["はっ、迷信でしょこんなの。"],
    のんびり: ["あちゃー…まあいいか。"],
    真面目: ["油断せず気を引き締めます。"],
    世話好き: ["気にしすぎないようにしよう。"],
    お調子者: ["うわー凶かよ！でも気にしなーい！"],
    無口: ["……凶。気にしない。"],
  },
};

// 吹き出しセリフの発生確率。selfSkillHit/allySkillHit、selfPinch/allyPinchは同じイベントの
// 抽選(どちらが発言するか)に使うので同じ値を共有する
const DIALOGUE_CHANCE = {
  // 会心発生時のセリフ(旧critHit)はDIALOGUE_LINESベースから廃止し、assets/dialogues/dialogue_crit.txt +
  // effects.js側の専用定数(CRIT_DIALOGUE_TRIGGER_CHANCE等)に置き換え済み
  normalKill: 0.25,
  allyDefeated: 0.75,
  selfHealed: 0.20,
  pinch: 0.20,
  battleStart: 0.30,
  breakdownPerTurn: 0.50,
  dangerFloor: 0.40,
  stressFloor: 0.20,
  allDefeated: 0.35, // 敵を全滅させた時のセリフの発生確率(発動時は最後に倒した人物65%/他の仲間35%で抽選)
  retreat: 0.60, // 里に戻るを押した時(誰も失っていない通常の帰還)
  retreatPinch: 0.50, // 里に戻るを押した時(この遠征で仲間をロストしているピンチの帰還)
};
// 現在階層がパーティ平均レベルのこの倍数を超えたら「自分たちのレベル的に危険な階層」とみなす
const DANGER_FLOOR_LEVEL_MULT = 1.3;
// 吹き出しが画面に表示され続ける時間
const SPEECH_BUBBLE_DURATION_MS = 2500;

// 戦闘後の平和な掛け合い(旧PEACE_DIALOGUES)は、保守性のためコードから完全に分離し、
// assets/dialogues/dialogue_peace.txt(唯一のマスターデータ)+ dialogues.js(読み込み・検索)に移設した。
// 野営会話/ボス前会話/帰還時会話/温泉会話など今後追加するカテゴリも同じ仕組みに乗せる設計。
// 詳細はdialogues.js冒頭のコメントを参照

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
  critAttack: "敵一体に高威力の一撃",
  powerAttack: "敵1体に不意を突いた一撃",
  physicalAttackAll: "敵全体になぎ払いの一撃(1体あたりは控えめ)",
  preciseShot: "敵1体に防御力を無視しやすい矢",
  cannonShot: "敵1体に大ダメージ。使った次のターンは装填で動けない",
  guard: "仲間を敵の攻撃からかばう。",
};

// key: id, ja, image, hp, atk, def, spd, goldMin, goldMax, xp, minFloor, maxFloor, isBoss
// isFlying: true = 明らかに空を飛んでいる敵(素のステータスは変更なし)。近接攻撃の命中率が25%下がる。
// 狩人/砲術士が命中させると80%で撃ち落として解除でき、成功時は1ターンのスタンも追加で付与する
// (詳細はengine.js側のrollHit/maybeShootDown参照)
// 序盤(Lv1-10)/中盤(Lv11-25)/後半(Lv26-40)/終盤(Lv41-50〜)の4段階、計40種。
// 後半のがしゃどくろ・九尾の狐は中ボス、終盤の鬼神・羅刹王が最終ボス(いずれもisBoss:trueで
// pickEncounterForFloor()により15の倍数フロアで単体ボス戦として優先的に選ばれる)
const ENEMIES = {
  yaken: { id: "yaken", ja: "野犬", image: "assets/enemies/yaken.png", hp: 48, atk: 12, def: 15, spd: 6, goldMin: 4, goldMax: 9, xp: 8, minFloor: 1, maxFloor: 18,
    bigAttack: { name: "牙噛み", mult: 1.2, debuff: { type: "bleed", chance: 0.8, value: 2, turns: 2 } },
    bigAttackCycle: { min: 3, max: 5 } },
  inoshishi: { id: "inoshishi", ja: "猪", image: "assets/enemies/inoshishi.png", hp: 62, atk: 15, def: 15, spd: 4, goldMin: 7, goldMax: 14, xp: 9, minFloor: 1, maxFloor: 18,
    bigAttack: { name: "猪突猛進", mult: 2.02, debuff: { type: "bleed", chance: 0.35, value: 2, turnsMin: 1, turnsMax: 3 } },
    bigAttackCycle: { min: 3, max: 5 } },
  dokuhebi: { id: "dokuhebi", ja: "毒蛇", image: "assets/enemies/dokuhebi.png", hp: 44, atk: 14, def: 15, spd: 7, goldMin: 6, goldMax: 12, xp: 9, minFloor: 1, maxFloor: 18,
    bigAttack: { name: "毒牙", mult: 1.2, debuff: { type: "poison", chance: 1, value: 3 } },
    bigAttackCycle: { min: 3, max: 5 },
    onHitInflict: { type: "poison", chance: 0.5, value: 3 } },
  oogumo: { id: "oogumo", ja: "大蜘蛛", image: "assets/enemies/oogumo.png", hp: 58, atk: 14, def: 15, spd: 6, goldMin: 3, goldMax: 8, xp: 10, minFloor: 1, maxFloor: 18,
    bigAttack: { name: "糸搦め", mult: 1, debuff: { type: "spdDown", chance: 1, value: 0.5, turns: 3 } },
    bigAttackCycle: { min: 2, max: 4 } },
  kodama: { id: "kodama", ja: "木霊", image: "assets/enemies/kodama.png", hp: 50, atk: 12, def: 25, spd: 5, goldMin: 5, goldMax: 10, xp: 9, minFloor: 1, maxFloor: 18, isPlant: true,
    bigAttack: { name: "精気吸い", mult: 0.9, debuff: { type: "atkDown", chance: 0.5, value: 0.25, turns: 3 } },
    bigAttackCycle: { min: 4, max: 6 } },
  kappa: { id: "kappa", ja: "河童", image: "assets/enemies/kappa.png", hp: 55, atk: 15, def: 15, spd: 6, goldMin: 7, goldMax: 13, xp: 10, minFloor: 1, maxFloor: 18,
    bigAttack: { name: "河童相撲", mult: 1, debuff: { type: "defDown", chance: 0.8, value: 0.25, turns: 2 } },
    bigAttackCycle: { min: 3, max: 5 } },
  hitotsume_kozo: { id: "hitotsume_kozo", ja: "一つ目小僧", image: "assets/enemies/hitotsume_kozo.png", hp: 48, atk: 15, def: 15, spd: 8, goldMin: 5, goldMax: 11, xp: 10, minFloor: 1, maxFloor: 18,
    bigAttack: { name: "一つ目睨み", mult: 1, debuff: { type: "spdDown", chance: 0.5, value: 0.3, turns: 3 } },
    bigAttackCycle: { min: 4, max: 6 } },
  bake_danuki: { id: "bake_danuki", ja: "化け狸", image: "assets/enemies/bake_danuki.png", hp: 62, atk: 15, def: 15, spd: 6, goldMin: 8, goldMax: 13, xp: 11, minFloor: 1, maxFloor: 18,
    bigAttack: { name: "狸囃子", mult: 1, debuff: { type: "silence", chance: 0.85, turns: 2 } },
    bigAttackCycle: { min: 3, max: 5 } },
  onibi: { id: "onibi", ja: "鬼火", image: "assets/enemies/onibi.png", hp: 40, atk: 15, def: 15, spd: 7, goldMin: 5, goldMax: 9, xp: 11, minFloor: 1, maxFloor: 18,
    bigAttack: { name: "鬼火纏い", mult: 0.4, ignoreGuardian: true, debuff: { type: "burn", chance: 1, turnsMin: 2, turnsMax: 3 } },
    onHitInflict: { type: "burn", chance: 0.3, turnsMin: 2, turnsMax: 3 } },
  kamaitachi: { id: "kamaitachi", ja: "かまいたち", image: "assets/enemies/kamaitachi.png", hp: 55, atk: 18, def: 15, spd: 10, goldMin: 8, goldMax: 13, xp: 13, minFloor: 1, maxFloor: 18,
    bigAttack: { name: "疾風斬", mult: 1, debuff: { type: "defDown", chance: 0.55, value: 0.2, turns: 3 } } },
  oo_inoshishi: { id: "oo_inoshishi", ja: "大猪", image: "assets/enemies/oo_inoshishi.png", hp: 431, atk: 23, def: 35, spd: 3, goldMin: 20, goldMax: 40, xp: 40, minFloor: 1, maxFloor: 18, isBoss: true, questOnly: true, isMidBoss: true,
    bigAttack: { name: "大猪突進", mult: 4 },
    bigAttackCycle: { min: 3, max: 5 } },
  q_arakuma: { id: "q_arakuma", ja: "荒熊", image: "assets/enemies/q_arakuma.png", stage: "valley", hp: 133, atk: 21, def: 35, spd: 3, goldMin: 35, goldMax: 55, xp: 42, minFloor: 1, maxFloor: 18, isBoss: true, questOnly: true, isMidBoss: true,
    bigAttack: { name: "熊爪薙ぎ", mult: 1.3, debuff: { type: "defDown", chance: 0.5, value: 0.2, turns: 3 } } },
  q_daija: { id: "q_daija", ja: "大蛇", image: "assets/enemies/q_daija.png", hp: 75, atk: 24, def: 35, spd: 7, goldMin: 35, goldMax: 55, xp: 42, minFloor: 1, maxFloor: 18, isBoss: true, questOnly: true, isMidBoss: true,
    bigAttack: { name: "鎌首の一閃", mult: 1.2 },
    onHitInflict: { type: "poison", chance: 0.4, value: 4 } },
  q_oni: { id: "q_oni", ja: "鬼", image: "assets/enemies/q_oni.png", hp: 923, atk: 27, def: 35, spd: 4, goldMin: 38, goldMax: 58, xp: 45, minFloor: 1, maxFloor: 18, isBoss: true, questOnly: true, isMidBoss: true,
    bigAttack: { name: "金棒一閃", mult: 1.4 } },
  q_gashadokuro: { id: "q_gashadokuro", ja: "がしゃどくろ", image: "assets/enemies/q_gashadokuro.png", stage: "cave", hp: 492, atk: 20, def: 34, spd: 6, goldMin: 38, goldMax: 58, xp: 45, minFloor: 1, maxFloor: 18, isBoss: true, questOnly: true, isMidBoss: true,
    bigAttack: { name: "骨鳴らし", mult: 0.5, aoe: true, debuff: { type: "stun", chance: 0.3, turns: 1 } },
    extraBigAttacks: [{ name: "大振り", mult: 1.45 }],
    bigAttackCycle: { min: 3, max: 3 },
    statusImmune: ["bleed"] },
  ochimusha: { id: "ochimusha", ja: "落武者", image: "assets/enemies/ochimusha.png", stage: "castle", hp: 116, atk: 21, def: 15, spd: 8, goldMin: 18, goldMax: 29, xp: 24, minFloor: 13, maxFloor: 43,
    bigAttack: { name: "怨念の一閃", mult: 1.1, debuff: { type: "bleed", chance: 0.5, value: 2 } } },
  kamaitachi2: { id: "kamaitachi2", ja: "かまいたち", image: "assets/enemies/kamaitachi2.png", stage: "yama", hp: 96, atk: 24, def: 15, spd: 12, goldMin: 20, goldMax: 30, xp: 25, minFloor: 13, maxFloor: 43,
    bigAttack: { name: "剛鎌風", mult: 1.15, debuff: { type: "bleed", chance: 0.5, value: 3 } } },
  youko: { id: "youko", ja: "妖狐", image: "assets/enemies/youko.png", hp: 89, atk: 27, def: 15, spd: 9, goldMin: 20, goldMax: 30, xp: 25, minFloor: 13, maxFloor: 43,
    bigAttack: { name: "妖狐の幻", mult: 1, debuff: { type: "atkDown", chance: 0.5, value: 0.2, turns: 3 } } },
  rokurokubi: { id: "rokurokubi", ja: "ろくろ首", image: "assets/enemies/rokurokubi.png", stage: "ruins", hp: 103, atk: 21, def: 15, spd: 8, goldMin: 18, goldMax: 29, xp: 24, minFloor: 13, maxFloor: 43,
    bigAttack: { name: "首伸ばし", mult: 1, debuff: { type: "stun", chance: 0.45, turns: 1 } } },
  yukionna: { id: "yukionna", ja: "雪女", image: "assets/enemies/yukionna.png", hp: 92, atk: 24, def: 15, spd: 8, goldMin: 20, goldMax: 30, xp: 25, minFloor: 13, maxFloor: 43,
    bigAttack: { name: "氷結の息", mult: 1, debuff: { type: "spdDown", chance: 0.5, value: 0.2, turns: 3 } } },
  yamauba: { id: "yamauba", ja: "山姥", image: "assets/enemies/yamauba.png", hp: 123, atk: 21, def: 15, spd: 6, goldMin: 21, goldMax: 31, xp: 26, minFloor: 13, maxFloor: 43,
    bigAttack: { name: "怪力の一撃", mult: 1.35 } },
  onryo: { id: "onryo", ja: "怨霊", image: "assets/enemies/onryo.png", hp: 82, atk: 30, def: 15, spd: 9, goldMin: 21, goldMax: 31, xp: 27, minFloor: 13, maxFloor: 43,
    bigAttack: { name: "怨嗟の声", mult: 0.9, debuff: { type: "dmgTakenUp", chance: 0.45, value: 0.15, turns: 3 } } },
  kasha: { id: "kasha", ja: "火車", image: "assets/enemies/kasha.png", hp: 116, atk: 27, def: 15, spd: 7, goldMin: 23, goldMax: 35, xp: 29, minFloor: 13, maxFloor: 43,
    bigAttack: { name: "業火の相貌", mult: 1.4, debuff: { type: "atkDown", chance: 0.45, value: 0.2, turns: 3 } } },
  oni: { id: "oni", ja: "鬼", image: "assets/enemies/oni.png", hp: 198, atk: 30, def: 15, spd: 9, goldMin: 24, goldMax: 36, xp: 42, minFloor: 35, maxFloor: 67,
    bigAttack: { name: "鬼の金棒", mult: 1.4 } },
  karasu_tengu: { id: "karasu_tengu", ja: "烏天狗", image: "assets/enemies/karasu_tengu.png", hp: 164, atk: 30, def: 15, spd: 14, goldMin: 24, goldMax: 36, xp: 42, minFloor: 35, maxFloor: 67, isFlying: true,
    bigAttack: { name: "扇の突風", mult: 0.3, aoe: true, debuff: { type: "stun", chance: 0.9, turns: 1 } } },
  yamauba2: { id: "yamauba2", ja: "山姥", image: "assets/enemies/yamauba2.png", hp: 192, atk: 27, def: 15, spd: 8, goldMin: 23, goldMax: 35, xp: 41, minFloor: 35, maxFloor: 67,
    bigAttack: { name: "命喰らいの呪い", mult: 1.2, debuff: { type: "atkDown", chance: 0.5, value: 0.2, turns: 3 } } },
  gyuki: { id: "gyuki", ja: "牛鬼", image: "assets/enemies/gyuki.png", hp: 239, atk: 33, def: 15, spd: 7, goldMin: 28, goldMax: 40, xp: 46, minFloor: 35, maxFloor: 67,
    bigAttack: { name: "牛鬼の角", mult: 1, debuff: { type: "poison", chance: 0.5, value: 4 } } },
  nue: { id: "nue", ja: "ぬえ", image: "assets/enemies/nue.png", hp: 178, atk: 30, def: 15, spd: 11, goldMin: 26, goldMax: 38, xp: 44, minFloor: 35, maxFloor: 67, isFlying: true,
    bigAttack: { name: "鵺の鳴き声", mult: 1.15, debuff: { type: "silence", chance: 0.4, turns: 2 } } },
  wanyudo: { id: "wanyudo", ja: "輪入道", image: "assets/enemies/wanyudo.png", hp: 171, atk: 30, def: 15, spd: 13, goldMin: 25, goldMax: 37, xp: 43, minFloor: 35, maxFloor: 67,
    bigAttack: { name: "火輪の相貌", mult: 1.2, debuff: { type: "stun", chance: 0.35, turns: 1 } } },
  gaikotsu_musha: { id: "gaikotsu_musha", ja: "骸骨武者", image: "assets/enemies/gaikotsu_musha.png", hp: 185, atk: 30, def: 15, spd: 10, goldMin: 26, goldMax: 38, xp: 44, minFloor: 35, maxFloor: 67,
    bigAttack: { name: "骸骨の乱撃", mult: 1.3, debuff: { type: "defDown", chance: 0.5, value: 0.2, turns: 3 } } },
  orochi: { id: "orochi", ja: "大蛇", image: "assets/enemies/orochi.png", hp: 212, atk: 30, def: 15, spd: 9, goldMin: 27, goldMax: 39, xp: 45, minFloor: 35, maxFloor: 67,
    bigAttack: { name: "大蛇の毒吐き", mult: 1.15, debuff: { type: "poison", chance: 0.6, value: 4 } } },
  gashadokuro: { id: "gashadokuro", ja: "がしゃどくろ", image: "assets/enemies/gashadokuro.png", hp: 581, atk: 43, def: 35, spd: 9, goldMin: 90, goldMax: 130, xp: 150, minFloor: 38, maxFloor: 1498, isBoss: true,
    bigAttack: { name: "がしゃどくろの哭き", mult: 1.6, debuff: { type: "stun", chance: 0.5, turns: 1 } } },
  kyubi_no_kitsune: { id: "kyubi_no_kitsune", ja: "九尾の狐", image: "assets/enemies/kyubi_no_kitsune.png", hp: 530, atk: 46, def: 35, spd: 12, goldMin: 95, goldMax: 135, xp: 155, minFloor: 38, maxFloor: 1498, isBoss: true,
    bigAttack: { name: "九尾の妖火", mult: 1.5, debuff: { type: "dmgTakenUp", chance: 0.5, value: 0.2, turns: 3 } } },
  shuten_doji: { id: "shuten_doji", ja: "酒呑童子", image: "assets/enemies/shuten_doji.png", hp: 315, atk: 46, def: 15, spd: 10, goldMin: 40, goldMax: 58, xp: 75, minFloor: 56, maxFloor: 1498,
    bigAttack: { name: "鬼哭の咆哮", mult: 1.5, debuff: { type: "atkDown", chance: 0.5, value: 0.25, turns: 3 } } },
  ibaraki_doji: { id: "ibaraki_doji", ja: "茨木童子", image: "assets/enemies/ibaraki_doji.png", hp: 335, atk: 49, def: 15, spd: 10, goldMin: 42, goldMax: 60, xp: 78, minFloor: 56, maxFloor: 1498,
    bigAttack: { name: "鉤爪の一薙ぎ", mult: 1.4, debuff: { type: "defDown", chance: 0.55, value: 0.25, turns: 3 } } },
  dai_tengu: { id: "dai_tengu", ja: "大天狗", image: "assets/enemies/dai_tengu.png", hp: 291, atk: 49, def: 15, spd: 15, goldMin: 41, goldMax: 59, xp: 76, minFloor: 56, maxFloor: 1498,
    bigAttack: { name: "扇の突風", mult: 0.3, aoe: true, debuff: { type: "stun", chance: 0.9, turns: 1 } } },
  yamata_no_orochi: { id: "yamata_no_orochi", ja: "八岐大蛇", image: "assets/enemies/yamata_no_orochi.png", hp: 376, atk: 52, def: 15, spd: 8, goldMin: 45, goldMax: 64, xp: 82, minFloor: 56, maxFloor: 1498,
    bigAttack: { name: "八岐の乱牙", mult: 1.3, debuff: { type: "poison", chance: 0.65, value: 5 } } },
  tamamo_no_mae: { id: "tamamo_no_mae", ja: "玉藻前", image: "assets/enemies/tamamo_no_mae.png", hp: 280, atk: 49, def: 15, spd: 12, goldMin: 42, goldMax: 60, xp: 77, minFloor: 56, maxFloor: 1498,
    bigAttack: { name: "傾国の艶", mult: 1.2, debuff: { type: "atkDown", chance: 0.55, value: 0.3, turns: 3 } } },
  giou: { id: "giou", ja: "鵺王", image: "assets/enemies/giou.png", hp: 342, atk: 49, def: 15, spd: 11, goldMin: 44, goldMax: 62, xp: 80, minFloor: 56, maxFloor: 1498,
    bigAttack: { name: "鵺王の咆哮", mult: 1.3, debuff: { type: "silence", chance: 0.5, turns: 2 } } },
  kyubi_shin: { id: "kyubi_shin", ja: "九尾の狐(真)", image: "assets/enemies/kyubi_shin.png", hp: 325, atk: 52, def: 15, spd: 13, goldMin: 46, goldMax: 65, xp: 85, minFloor: 56, maxFloor: 1498,
    bigAttack: { name: "業炎の九尾", mult: 1.4, debuff: { type: "burn", chance: 0.6, turnsMin: 2, turnsMax: 3 } } },
  gashadokuro_shin: { id: "gashadokuro_shin", ja: "がしゃどくろ(真)", image: "assets/enemies/gashadokuro_shin.png", hp: 410, atk: 49, def: 15, spd: 8, goldMin: 47, goldMax: 66, xp: 86, minFloor: 56, maxFloor: 1498,
    bigAttack: { name: "亡骨の大哭", mult: 1.7, debuff: { type: "stun", chance: 0.55, turns: 1 } } },
  yomi_no_onryo: { id: "yomi_no_onryo", ja: "黄泉の怨霊", image: "assets/enemies/yomi_no_onryo.png", hp: 301, atk: 58, def: 15, spd: 11, goldMin: 48, goldMax: 68, xp: 88, minFloor: 56, maxFloor: 1498,
    bigAttack: { name: "黄泉の呪詛", mult: 1.3, debuff: { type: "dmgTakenUp", chance: 0.55, value: 0.25, turns: 3 } } },
  kishin_rasetsuo: { id: "kishin_rasetsuo", ja: "鬼神・羅刹王", image: "assets/enemies/kishin_rasetsuo.png", hp: 958, atk: 61, def: 35, spd: 12, goldMin: 220, goldMax: 320, xp: 420, minFloor: 62, maxFloor: 1498, isBoss: true,
    bigAttack: { name: "羅刹の薙ぎ払い", mult: 1.4, ignoreGuardian: true, debuff: { type: "stun", chance: 0.45, turns: 1 } } },
  nurari_koumori: { id: "nurari_koumori", ja: "ぬらりこうもり", image: "assets/enemies/nurari_koumori.png", hp: 13, atk: 10, def: 10, spd: 9, goldMin: 3, goldMax: 5, xp: 5, minFloor: 1, maxFloor: 18, isFlying: true, isSwarm: true,
    bigAttack: { name: "羽ばたきの乱舞", mult: 0.85, debuff: { type: "stun", chance: 0.3, turns: 1 } },
    bigAttackCycle: { min: 2, max: 8 },
    onHitInflict: { type: "poison", chance: 0.4, value: 2, stacking: true } },
  chochin_obake: { id: "chochin_obake", ja: "提灯おばけ", image: "assets/enemies/chochin_obake.png", hp: 20, atk: 7, def: 10, spd: 5, goldMin: 3, goldMax: 6, xp: 5, minFloor: 1, maxFloor: 18, isSwarm: true,
    bigAttack: { name: "かがり火", mult: 0.75, debuff: { type: "burn", chance: 1, value: 1, turns: 1 } },
    bigAttackCycle: { min: 2, max: 8 } },
  kawappa: { id: "kawappa", ja: "かわっぱ", image: "assets/enemies/kawappa.png", hp: 49, atk: 13, def: 10, spd: 6, goldMin: 10, goldMax: 14, xp: 11, minFloor: 13, maxFloor: 43, isSwarm: true,
    bigAttack: { name: "悪戯突き", mult: 0.9, debuff: { type: "defDown", chance: 0.4, value: 0.15, turns: 3 } } },
  chibi_oni: { id: "chibi_oni", ja: "ちび鬼", image: "assets/enemies/chibi_oni.png", hp: 46, atk: 13, def: 10, spd: 7, goldMin: 10, goldMax: 16, xp: 12, minFloor: 13, maxFloor: 43, isSwarm: true,
    bigAttack: { name: "豆鬼の一撃", mult: 1 } },
  karakasa: { id: "karakasa", ja: "からかさ", image: "assets/enemies/karakasa.png", hp: 103, atk: 17, def: 10, spd: 6, goldMin: 13, goldMax: 18, xp: 19, minFloor: 35, maxFloor: 67, isSwarm: true,
    bigAttack: { name: "からかさ跳ね", mult: 0.95, debuff: { type: "spdDown", chance: 0.4, value: 0.2, turns: 3 } } },
  kogitsune: { id: "kogitsune", ja: "こぎつね", image: "assets/enemies/kogitsune.png", hp: 84, atk: 17, def: 10, spd: 13, goldMin: 13, goldMax: 18, xp: 20, minFloor: 35, maxFloor: 67, isSwarm: true,
    bigAttack: { name: "子狐の妖術", mult: 0.95, debuff: { type: "atkDown", chance: 0.4, value: 0.15, turns: 3 } } },
  warashibe_ningyo: { id: "warashibe_ningyo", ja: "わらしべ人形", image: "assets/enemies/warashibe_ningyo.png", hp: 179, atk: 23, def: 10, spd: 5, goldMin: 22, goldMax: 28, xp: 35, minFloor: 56, maxFloor: 1498, isSwarm: true,
    bigAttack: { name: "藁人形の呪い", mult: 1.1, debuff: { type: "atkDown", chance: 0.4, value: 0.2, turns: 3 } } },
  medama_kozou: { id: "medama_kozou", ja: "目玉こぞう", image: "assets/enemies/medama_kozou.png", hp: 152, atk: 27, def: 10, spd: 6, goldMin: 22, goldMax: 30, xp: 36, minFloor: 56, maxFloor: 1498, isSwarm: true,
    bigAttack: { name: "百目睨み", mult: 1.1, debuff: { type: "spdDown", chance: 0.45, value: 0.2, turns: 3 } } },
  cave_tsuchigumo: { id: "cave_tsuchigumo", ja: "土蜘蛛", image: "assets/enemies/tsuchigumo.png", stage: "cave", hp: 66, atk: 15, def: 15, spd: 7, goldMin: 8, goldMax: 14, xp: 13, minFloor: 1, maxFloor: 15,
    bigAttack: { name: "闇網搦め", mult: 1.2, debuff: { type: "stun", chance: 0.45, turns: 1 } } },
  cave_oomukade: { id: "cave_oomukade", ja: "大百足", image: "assets/enemies/oomukade.png", stage: "cave", hp: 77, atk: 18, def: 15, spd: 5, goldMin: 9, goldMax: 16, xp: 13, minFloor: 1, maxFloor: 15,
    bigAttack: { name: "百足の締め上げ", mult: 1.15, debuff: { type: "defDown", chance: 0.5, value: 0.25, turns: 3 } },
    bigAttackCycle: { min: 4, max: 6 } },
  cave_nurarikoumori: { id: "cave_nurarikoumori", ja: "ぬらりこうもり", image: "assets/enemies/nurari_koumori.png", stage: "cave", hp: 30, atk: 10, def: 10, spd: 10, goldMin: 4, goldMax: 6, xp: 6, minFloor: 1, maxFloor: 15, isFlying: true, isSwarm: true,
    bigAttack: { name: "毒の牙", mult: 0.8, debuff: { type: "poison", chance: 0.75, value: 1, turns: 2, turnsMin: 1, turnsMax: 2 } },
    bigAttackCycle: { min: 4, max: 6 },
    onHitInflict: { type: "poison", chance: 0.4, value: 2, stacking: true } },
  doukutsu_shokujinsou: { id: "doukutsu_shokujinsou", ja: "洞窟食人草", image: "assets/enemies/doukutsu_shokujinsou.png", stage: "cave", hp: 69, atk: 13, def: 30, spd: 4, goldMin: 9, goldMax: 13, xp: 13, minFloor: 1, maxFloor: 15, isPlant: true,
    bigAttack: { name: "食人草の丸呑み", mult: 1.2, debuff: { type: "atkDown", chance: 0.5, value: 0.2, turns: 3 } } },
  doukutsu_chouchinbi: { id: "doukutsu_chouchinbi", ja: "洞窟の提灯火", image: "assets/enemies/doukutsu_chouchinbi.png", stage: "cave", hp: 54, atk: 17, def: 15, spd: 8, goldMin: 9, goldMax: 15, xp: 13, minFloor: 1, maxFloor: 15,
    bigAttack: { name: "提灯火の幻惑", mult: 1, debuff: { type: "silence", chance: 0.7, turns: 2 } } },
  bake_nezumi: { id: "bake_nezumi", ja: "化け鼠", image: "assets/enemies/bake_nezumi.png", stage: "cave", hp: 29, atk: 11, def: 10, spd: 9, goldMin: 4, goldMax: 6, xp: 6, minFloor: 1, maxFloor: 15, isSwarm: true,
    bigAttack: { name: "鼠の乱噛み", mult: 0.95, debuff: { type: "bleed", chance: 0.5, value: 2 } },
    bigAttackCycle: { min: 4, max: 8 } },
  bake_take: { id: "bake_take", ja: "化け茸", image: "assets/enemies/bake_take.png", stage: "cave", hp: 60, atk: 13, def: 15, spd: 4, goldMin: 8, goldMax: 14, xp: 12, minFloor: 1, maxFloor: 15, isPlant: true,
    bigAttack: { name: "胞子撒き", mult: 0.3, aoe: true, debuff: { type: "poison", chance: 1, value: 2, turns: 2, turnsMin: 0 } },
    bigAttackCycle: { min: 4, max: 8, instant: true },
    onHitInflict: { type: "poison", chance: 0.35, value: 3 },
    statusImmune: ["poison"] },
  doukutsu_bourei: { id: "doukutsu_bourei", ja: "洞窟の亡霊", image: "assets/enemies/doukutsu_bourei.png", stage: "cave", hp: 59, atk: 17, def: 15, spd: 8, goldMin: 10, goldMax: 14, xp: 13, minFloor: 1, maxFloor: 15,
    bigAttack: { name: "亡霊の怨嗟", mult: 0.3, aoe: true, debuff: { type: "dmgTakenUp", chance: 0.65, value: 0.1, turns: 3 } },
    bigAttackCycle: { min: 5, max: 7 } },
  doukutsu_inoshishi: { id: "doukutsu_inoshishi", ja: "洞窟イノシシ", image: "assets/enemies/doukutsu_inoshishi.png", stage: "cave", hp: 83, atk: 18, def: 15, spd: 4, goldMin: 10, goldMax: 17, xp: 13, minFloor: 1, maxFloor: 15,
    bigAttack: { name: "洞窟の猛進", mult: 1.5 },
    bigAttackCycle: { min: 4, max: 6 } },
  iso_gani: { id: "iso_gani", ja: "磯ガニ", image: "assets/enemies/iso_gani.png", stage: "coast", hp: 48, atk: 12, def: 15, spd: 3, goldMin: 5, goldMax: 10, xp: 8, minFloor: 1, maxFloor: 18,
    bigAttack: { name: "大鋏挟み", mult: 1.3, debuff: { type: "atkDown", chance: 0.4, value: 0.15, turns: 3 } },
    onHitInflict: { type: "bleed", chance: 0.2, value: 2 } },
  yadokari: { id: "yadokari", ja: "ヤドカリ", image: "assets/enemies/yadokari.png", stage: "coast", hp: 55, atk: 12, def: 15, spd: 4, goldMin: 5, goldMax: 11, xp: 8, minFloor: 1, maxFloor: 18,
    bigAttack: { name: "貝殻突撃", mult: 1.2 } },
  isozakana: { id: "isozakana", ja: "磯魚", image: "assets/enemies/isozakana.png", stage: "coast", hp: 27, atk: 7, def: 10, spd: 8, goldMin: 3, goldMax: 6, xp: 5, minFloor: 1, maxFloor: 18, isSwarm: true,
    bigAttack: { name: "跳ね躍り", mult: 1.3 },
    onHitInflict: { type: "bleed", chance: 1, valueMin: 1, valueMax: 2 } },
  kurage_bou: { id: "kurage_bou", ja: "くらげ坊", image: "assets/enemies/kurage_bou.png", stage: "coast", hp: 44, atk: 12, def: 15, spd: 5, goldMin: 6, goldMax: 12, xp: 9, minFloor: 1, maxFloor: 18,
    bigAttack: { name: "痺れ触手", mult: 1, debuff: { type: "stun", chance: 0.45, turns: 1 } } },
  kaiyose: { id: "kaiyose", ja: "貝寄せ", image: "assets/enemies/kaiyose.png", stage: "coast", hp: 44, atk: 12, def: 15, spd: 3, goldMin: 6, goldMax: 12, xp: 9, minFloor: 1, maxFloor: 18,
    bigAttack: { name: "貝閉じの一撃", mult: 1.3 },
    onHitInflict: { type: "bleed", chance: 0.2, value: 2 } },
  hama_tako: { id: "hama_tako", ja: "浜タコ", image: "assets/enemies/hama_tako.png", stage: "coast", hp: 58, atk: 15, def: 15, spd: 6, goldMin: 8, goldMax: 14, xp: 10, minFloor: 1, maxFloor: 18,
    bigAttack: { name: "足絡め", mult: 1, debuff: { type: "spdDown", chance: 0.5, value: 0.2, turns: 3 } } },
  kaisou_douji: { id: "kaisou_douji", ja: "海藻童子", image: "assets/enemies/kaisou_douji.png", stage: "coast", hp: 48, atk: 15, def: 15, spd: 9, goldMin: 8, goldMax: 14, xp: 10, minFloor: 1, maxFloor: 18, isPlant: true,
    bigAttack: { name: "海藻の鞭", mult: 1.1 } },
  harifugu: { id: "harifugu", ja: "ハリフグ", image: "assets/enemies/harifugu.png", stage: "coast", hp: 51, atk: 18, def: 15, spd: 5, goldMin: 8, goldMax: 15, xp: 11, minFloor: 1, maxFloor: 18,
    bigAttack: { name: "針膨れ突進", mult: 1.5 } },
  umineko: { id: "umineko", ja: "ウミネコ", image: "assets/enemies/umineko.png", stage: "coast", hp: 44, atk: 15, def: 15, spd: 10, goldMin: 9, goldMax: 15, xp: 11, minFloor: 1, maxFloor: 18, isFlying: true,
    bigAttack: { name: "急降下つつき", mult: 1, debuff: { type: "spdDown", chance: 0.4, value: 0.2, turns: 3 } } },
  kaizoku_gaikotsu: { id: "kaizoku_gaikotsu", ja: "海賊骸骨", image: "assets/enemies/kaizoku_gaikotsu.png", stage: "coast", hp: 103, atk: 24, def: 15, spd: 8, goldMin: 18, goldMax: 29, xp: 24, minFloor: 13, maxFloor: 43,
    bigAttack: { name: "錆刀の一閃", mult: 1.1, debuff: { type: "bleed", chance: 0.5, value: 2 } } },
  iso_inu: { id: "iso_inu", ja: "磯犬", image: "assets/enemies/iso_inu.png", stage: "coast", hp: 92, atk: 27, def: 15, spd: 11, goldMin: 18, goldMax: 29, xp: 24, minFloor: 13, maxFloor: 43,
    bigAttack: { name: "潮風の牙", mult: 1.3, debuff: { type: "spdDown", chance: 0.5, value: 0.2, turns: 3 } },
    onHitInflict: { type: "bleed", chance: 0.3, value: 1 } },
  oo_dako_1: { id: "oo_dako_1", ja: "大ダコ", image: "assets/enemies/oo_dako_1.png", stage: "coast", hp: 123, atk: 24, def: 15, spd: 6, goldMin: 20, goldMax: 30, xp: 26, minFloor: 13, maxFloor: 43,
    bigAttack: { name: "大ダコの締め付け", mult: 1.2, debuff: { type: "defDown", chance: 0.5, value: 0.2, turns: 3 } } },
  iwa_gani: { id: "iwa_gani", ja: "岩ガニ", image: "assets/enemies/iwa_gani.png", stage: "coast", hp: 103, atk: 24, def: 15, spd: 5, goldMin: 19, goldMax: 29, xp: 24, minFloor: 13, maxFloor: 43,
    bigAttack: { name: "岩鋏", mult: 1.4 },
    onHitInflict: { type: "bleed", chance: 0.2, value: 2 } },
  gyojin: { id: "gyojin", ja: "魚人", image: "assets/enemies/gyojin.png", stage: "coast", hp: 99, atk: 30, def: 15, spd: 9, goldMin: 20, goldMax: 31, xp: 26, minFloor: 13, maxFloor: 43,
    bigAttack: { name: "三叉槍突き", mult: 1.1, debuff: { type: "bleed", chance: 0.45, value: 2 } } },
  shell_slime: { id: "shell_slime", ja: "シェルスライム", image: "assets/enemies/shell_slime.png", stage: "coast", hp: 109, atk: 21, def: 15, spd: 4, goldMin: 19, goldMax: 29, xp: 25, minFloor: 13, maxFloor: 43,
    bigAttack: { name: "溶蝕の粘液", mult: 1, debuff: { type: "defDown", chance: 0.5, value: 0.2, turns: 3 } } },
  kaisou_no_sei: { id: "kaisou_no_sei", ja: "海藻の精", image: "assets/enemies/kaisou_no_sei.png", stage: "coast", hp: 89, atk: 24, def: 15, spd: 7, goldMin: 18, goldMax: 28, xp: 24, minFloor: 13, maxFloor: 43, isPlant: true,
    bigAttack: { name: "海藻纏い", mult: 1.1, debuff: { type: "atkDown", chance: 0.5, value: 0.2, turns: 3 } },
    onHitInflict: { type: "poison", chance: 0.35, value: 2 } },
  same: { id: "same", ja: "鮫", image: "assets/enemies/same.png", stage: "coast", hp: 96, atk: 30, def: 15, spd: 13, goldMin: 21, goldMax: 32, xp: 27, minFloor: 13, maxFloor: 43,
    bigAttack: { name: "鮫の乱牙", mult: 1.3, debuff: { type: "bleed", chance: 0.6, value: 2 } } },
  iso_onna_1: { id: "iso_onna_1", ja: "磯女", image: "assets/enemies/iso_onna_1.png", stage: "coast", hp: 86, atk: 30, def: 15, spd: 8, goldMin: 20, goldMax: 31, xp: 26, minFloor: 13, maxFloor: 43,
    bigAttack: { name: "黒髪縛り", mult: 1.1, debuff: { type: "spdDown", chance: 0.5, value: 0.25, turns: 3 } } },
  oo_kai: { id: "oo_kai", ja: "大貝", image: "assets/enemies/oo_kai.png", stage: "coast", hp: 116, atk: 24, def: 15, spd: 3, goldMin: 20, goldMax: 30, xp: 25, minFloor: 13, maxFloor: 43,
    bigAttack: { name: "大貝の圧殺", mult: 1.4 },
    onHitInflict: { type: "bleed", chance: 0.2, value: 2 } },
  umibouzu: { id: "umibouzu", ja: "海坊主", image: "assets/enemies/umibouzu.png", stage: "coast", hp: 205, atk: 30, def: 15, spd: 6, goldMin: 25, goldMax: 37, xp: 43, minFloor: 35, maxFloor: 67,
    bigAttack: { name: "海坊主の大波", mult: 0.5, ignoreGuardian: true } },
  iso_onna_2: { id: "iso_onna_2", ja: "磯女", image: "assets/enemies/iso_onna_2.png", stage: "coast", hp: 185, atk: 33, def: 15, spd: 10, goldMin: 26, goldMax: 38, xp: 44, minFloor: 35, maxFloor: 67,
    bigAttack: { name: "怨念の黒髪", mult: 1.2, debuff: { type: "spdDown", chance: 0.55, value: 0.25, turns: 3 } } },
  iwagaki_ou: { id: "iwagaki_ou", ja: "岩ガキ翁", image: "assets/enemies/iwagaki_ou.png", stage: "coast", hp: 198, atk: 27, def: 15, spd: 4, goldMin: 24, goldMax: 36, xp: 42, minFloor: 35, maxFloor: 67,
    bigAttack: { name: "老翁の岩殻", mult: 1.3 } },
  umihebi: { id: "umihebi", ja: "海蛇", image: "assets/enemies/umihebi.png", stage: "coast", hp: 171, atk: 33, def: 15, spd: 12, goldMin: 25, goldMax: 37, xp: 43, minFloor: 35, maxFloor: 67,
    bigAttack: { name: "海蛇の毒牙", mult: 1, debuff: { type: "poison", chance: 0.6, value: 4 } },
    onHitInflict: { type: "poison", chance: 0.35, value: 3 } },
  umigumo: { id: "umigumo", ja: "海蜘蛛", image: "assets/enemies/umigumo.png", stage: "coast", hp: 178, atk: 30, def: 15, spd: 8, goldMin: 24, goldMax: 36, xp: 42, minFloor: 35, maxFloor: 67,
    bigAttack: { name: "海蜘蛛の縛糸", mult: 1.1, debuff: { type: "stun", chance: 0.5, turns: 1 } } },
  ryuuguu_no_shisha: { id: "ryuuguu_no_shisha", ja: "竜宮の使者", image: "assets/enemies/ryuuguu_no_shisha.png", stage: "coast", hp: 164, atk: 33, def: 15, spd: 13, goldMin: 26, goldMax: 38, xp: 44, minFloor: 35, maxFloor: 67,
    bigAttack: { name: "竜宮の穂先", mult: 1.2, debuff: { type: "bleed", chance: 0.5, value: 2 } } },
  oo_dako_2: { id: "oo_dako_2", ja: "大ダコ", image: "assets/enemies/oo_dako_2.png", stage: "coast", hp: 212, atk: 30, def: 15, spd: 7, goldMin: 27, goldMax: 39, xp: 45, minFloor: 35, maxFloor: 67,
    bigAttack: { name: "岩場の抱擁", mult: 1.2, debuff: { type: "defDown", chance: 0.55, value: 0.25, turns: 3 } } },
  same_bito: { id: "same_bito", ja: "鮫人", image: "assets/enemies/same_bito.png", stage: "coast", hp: 185, atk: 36, def: 15, spd: 12, goldMin: 27, goldMax: 39, xp: 45, minFloor: 35, maxFloor: 67,
    bigAttack: { name: "鮫人の乱撃", mult: 1.25, debuff: { type: "bleed", chance: 0.6, value: 2 } },
    onHitInflict: { type: "bleed", chance: 0.25, value: 1 } },
  shinkai_no_bourei: { id: "shinkai_no_bourei", ja: "深海の亡霊", image: "assets/enemies/shinkai_no_bourei.png", stage: "coast", hp: 157, atk: 36, def: 15, spd: 10, goldMin: 26, goldMax: 38, xp: 44, minFloor: 35, maxFloor: 67,
    bigAttack: { name: "深海の呪縛", mult: 1.2, debuff: { type: "dmgTakenUp", chance: 0.45, value: 0.15, turns: 3 } },
    onHitInflict: { type: "poison", chance: 0.4, value: 3 } },
  oo_kani_ou: { id: "oo_kani_ou", ja: "大蟹王", image: "assets/enemies/oo_kani_ou.png", stage: "coast", hp: 564, atk: 46, def: 35, spd: 7, goldMin: 90, goldMax: 130, xp: 150, minFloor: 38, maxFloor: 1498, isBoss: true,
    bigAttack: { name: "王鋏の一閃", mult: 1.5, debuff: { type: "defDown", chance: 0.4, value: 0.2, turns: 3 } },
    onHitInflict: { type: "bleed", chance: 0.2, value: 2 } },
  kaima_daiou: { id: "kaima_daiou", ja: "海魔大王", image: "assets/enemies/kaima_daiou.png", stage: "coast", hp: 325, atk: 52, def: 15, spd: 8, goldMin: 48, goldMax: 68, xp: 86, minFloor: 56, maxFloor: 1498,
    bigAttack: { name: "大槍薙ぎ", mult: 1.4, ignoreGuardian: true } },
  youen_na_isoonna: { id: "youen_na_isoonna", ja: "妖艶な磯女", image: "assets/enemies/youen_na_isoonna.png", stage: "coast", hp: 291, atk: 49, def: 15, spd: 11, goldMin: 47, goldMax: 67, xp: 85, minFloor: 56, maxFloor: 1498,
    bigAttack: { name: "魅了の歌声", mult: 1.1, debuff: { type: "atkDown", chance: 0.55, value: 0.25, turns: 3 } } },
  kyokai_no_oodako: { id: "kyokai_no_oodako", ja: "巨海の大ダコ", image: "assets/enemies/kyokai_no_oodako.png", stage: "coast", hp: 359, atk: 49, def: 15, spd: 7, goldMin: 48, goldMax: 68, xp: 87, minFloor: 56, maxFloor: 1498,
    bigAttack: { name: "八腕搦め", mult: 1.3, debuff: { type: "stun", chance: 0.35, turns: 1 } } },
  oni_harifugu: { id: "oni_harifugu", ja: "鬼ハリフグ", image: "assets/enemies/oni_harifugu.png", stage: "coast", hp: 301, atk: 49, def: 15, spd: 6, goldMin: 47, goldMax: 67, xp: 85, minFloor: 56, maxFloor: 1498,
    bigAttack: { name: "毒針乱射", mult: 0.6, ignoreGuardian: true, debuff: { type: "poison", chance: 0.7, value: 3 } },
    onHitInflict: { type: "poison", chance: 0.3, value: 2 } },
  oo_kani_shougun: { id: "oo_kani_shougun", ja: "大蟹将軍", image: "assets/enemies/oo_kani_shougun.png", stage: "coast", hp: 342, atk: 49, def: 15, spd: 6, goldMin: 48, goldMax: 68, xp: 86, minFloor: 56, maxFloor: 1498,
    bigAttack: { name: "将軍鋏", mult: 1.5, debuff: { type: "defDown", chance: 0.4, value: 0.25, turns: 3 } },
    onHitInflict: { type: "bleed", chance: 0.2, value: 2 } },
  kairyuu_ou: { id: "kairyuu_ou", ja: "海龍王", image: "assets/enemies/kairyuu_ou.png", stage: "coast", hp: 376, atk: 52, def: 15, spd: 10, goldMin: 50, goldMax: 70, xp: 90, minFloor: 56, maxFloor: 1498,
    bigAttack: { name: "海龍の雷", mult: 1.3, debuff: { type: "stun", chance: 0.4, turns: 1 } },
    onHitInflict: { type: "bleed", chance: 0.2, value: 2 } },
  same_no_bujin: { id: "same_no_bujin", ja: "鮫の武人", image: "assets/enemies/same_no_bujin.png", stage: "coast", hp: 315, atk: 52, def: 15, spd: 13, goldMin: 48, goldMax: 68, xp: 86, minFloor: 56, maxFloor: 1498,
    bigAttack: { name: "武人の穂先", mult: 1.3, debuff: { type: "bleed", chance: 0.65, value: 2 } },
    onHitInflict: { type: "bleed", chance: 0.3, value: 1 } },
  umi_no_souryo: { id: "umi_no_souryo", ja: "海の僧侶", image: "assets/enemies/umi_no_souryo.png", stage: "coast", hp: 291, atk: 46, def: 15, spd: 9, goldMin: 47, goldMax: 67, xp: 85, minFloor: 56, maxFloor: 1498,
    bigAttack: { name: "海僧の呪法", mult: 1.2, debuff: { type: "atkDown", chance: 0.5, value: 0.2, turns: 3 } },
    onHitInflict: { type: "poison", chance: 0.4, value: 3 } },
  uzushio_no_onryou: { id: "uzushio_no_onryou", ja: "渦潮の怨霊", image: "assets/enemies/uzushio_no_onryou.png", stage: "coast", hp: 308, atk: 49, def: 15, spd: 9, goldMin: 47, goldMax: 67, xp: 85, minFloor: 56, maxFloor: 1498,
    bigAttack: { name: "渦潮の引き寄せ", mult: 0.55, ignoreGuardian: true, debuff: { type: "stun", chance: 0.4, turns: 1 } } },
  kaiyoujo_ou: { id: "kaiyoujo_ou", ja: "海妖女王", image: "assets/enemies/kaiyoujo_ou.png", stage: "coast", hp: 1026, atk: 64, def: 35, spd: 11, goldMin: 230, goldMax: 330, xp: 430, minFloor: 62, maxFloor: 1498, isBoss: true,
    bigAttack: { name: "妖女王の呪詛", mult: 1.3, debuff: { type: "poison", chance: 0.5, value: 3 } },
    onHitInflict: { type: "burn", chance: 0.25, turnsMin: 2, turnsMax: 3 } },
};

// ============ 素材(敵ドロップ) ============
// 敵を倒すと確率で落とす素材4種。現状の使い道は温泉の売店での売却のみ(鍛冶/建築への
// 組み込みは後日設計)。ボス/中ボス(isBoss)のドロップ設計は保留中のため対象外。
// 並び順(MATERIAL_ORDER)は売店の買取カウンターの表示順(ユーザー指定: 皮→骨→木→鉄)
const MATERIALS = {
  kawa: { id: "kawa", ja: "皮", icon: "assets/icons/materials/kawa.png", sell: 8 },
  hone: { id: "hone", ja: "骨", icon: "assets/icons/materials/hone.png", sell: 6 },
  ki: { id: "ki", ja: "木", icon: "assets/icons/materials/ki.png", sell: 6 },
  tetsu: { id: "tetsu", ja: "鉄", icon: "assets/icons/materials/tetsu.png", sell: 15 },
};
const MATERIAL_ORDER = ["kawa", "hone", "ki", "tetsu"];
const MATERIAL_DROP_CHANCE = 0.4; // 雑魚1体あたりのドロップ率
// 大群(isSwarm)は1戦闘の頭数が多く、40%のままだと1戦あたりの入手量が通常戦の約2倍になって
// しまうため半分にして、1戦あたりの期待値を通常戦と同水準に揃えている
const MATERIAL_DROP_CHANCE_SWARM = 0.2;
// 敵ごとのドロップ率の上書き(enemyId -> 0〜1)。未登録の敵は従来の一律値(通常40%/大群20%)を使う。
// 敵エディターの「素材ドロップ 確率%」を適用する時は、百分率÷100の値でここに登録する(2026-07-27)
const ENEMY_MATERIAL_DROP_CHANCES = { chochin_obake: 0.3 }; // 提灯おばけ=木30%(大群既定20%から引き上げ、序盤の木不足対策。ユーザー指定2026-07-28)
// 敵→素材の対応(1体につき1種固定)。体感ルールは
//   皮=生身の生き物 / 骨=骸骨・亡者 / 木=植物・木製の器物 / 鉄=鬼・武具持ち・金属もの。
// ここに載っていない敵はドロップ無し: 純粋な霊体(鬼火・雪女・海坊主・洞窟の提灯火。
// 鬼火は既存の魂のかけら枠があるため素材とは重複させない)と、設計保留中のボス/中ボス
const ENEMY_MATERIAL_DROPS = {
  // 森ルート
  yaken: "kawa", inoshishi: "kawa", dokuhebi: "kawa", oogumo: "hone", kodama: "ki",
  kappa: "kawa", hitotsume_kozo: "hone", bake_danuki: "kawa", kamaitachi: "kawa",
  ochimusha: "hone", kamaitachi2: "kawa", youko: "kawa", rokurokubi: "hone",
  yamauba: "hone", onryo: "hone", kasha: "tetsu", oni: "tetsu", karasu_tengu: "tetsu",
  yamauba2: "hone", gyuki: "kawa", nue: "kawa", wanyudo: "ki", gaikotsu_musha: "hone",
  orochi: "kawa", shuten_doji: "tetsu", ibaraki_doji: "tetsu", dai_tengu: "tetsu",
  yamata_no_orochi: "kawa", tamamo_no_mae: "kawa", giou: "hone", kyubi_shin: "kawa",
  gashadokuro_shin: "hone", yomi_no_onryo: "hone",
  // 大群
  nurari_koumori: "kawa", chochin_obake: "ki", kawappa: "kawa", chibi_oni: "tetsu",
  karakasa: "ki", kogitsune: "kawa", warashibe_ningyo: "ki", 
  // 鍾乳洞
  cave_tsuchigumo: "hone", cave_oomukade: "hone", cave_nurarikoumori: "kawa",
  doukutsu_shokujinsou: "ki", bake_nezumi: "kawa", bake_take: "ki",
  doukutsu_bourei: "hone", doukutsu_inoshishi: "kawa",
  // 海ルート
  iso_gani: "hone", yadokari: "hone", isozakana: "kawa", 
  kaiyose: "hone", kaisou_douji: "ki", harifugu: "kawa",
  umineko: "kawa", kaizoku_gaikotsu: "hone", iso_inu: "kawa", 
  iwa_gani: "hone", gyojin: "tetsu", kaisou_no_sei: "ki",
  same: "kawa", iso_onna_1: "hone", oo_kai: "hone", iso_onna_2: "hone",
  iwagaki_ou: "hone", umihebi: "kawa", umigumo: "hone", ryuuguu_no_shisha: "tetsu",
  same_bito: "kawa", shinkai_no_bourei: "hone",
  kaima_daiou: "tetsu", youen_na_isoonna: "hone", 
  oni_harifugu: "kawa", oo_kani_shougun: "hone", kairyuu_ou: "kawa",
  same_no_bujin: "tetsu", umi_no_souryo: "hone", uzushio_no_onryou: "hone",
};

// 図鑑用のテキスト(生態の説明+大技の内容)。ENEMIES本体(ステータス・戦闘用の数値)とは意図的に
// 分離してある(こちらは純粋な表示用データで、書き間違えても戦闘バランスには一切影響しない)。
// 弱点(isFlying/isPlant)は既存のフラグから自動算出するため、ここには持たせていない。
// bigAttackDescが無い(=ENEMIES側にbigAttackの明示設定が無く、汎用フォールバックに乗る)敵は
// 図鑑側で共通の代替文を表示する(BESTIARY_GENERIC_BIG_ATTACK_DESC参照)
const BESTIARY_GENERIC_BIG_ATTACK_DESC = "パーティ全体を巻き込む強烈な一撃。時折、様々な状態異常を伴うこともある。";
const ENEMY_BESTIARY_TEXT = {
  // ---- 森・序盤 ----
  yaken: { desc: "群れで人里に近づく獰猛な野犬。", bigAttackDesc: "群れで足に食らいつき、動きを鈍らせる。" },
  inoshishi: { desc: "森を駆け回る荒々しい猪。突進の勢いはすさまじい。", bigAttackDesc: "猪突猛進、ただ単純な強打を放つ。" },
  dokuhebi: { desc: "鋭い牙に猛毒を宿す蛇。通常攻撃でも高確率で毒を注入してくる。", bigAttackDesc: "牙に猛毒を仕込み、噛みついた相手を確実に毒状態にする。" },
  oogumo: { desc: "太い糸を吐く大きな蜘蛛。獲物を絡め取って動きを封じる。", bigAttackDesc: "粘着質の糸で獲物を絡め取り、高確率で行動を封じる。" },
  kodama: { desc: "森の精霊。木々に宿り、侵入者から精気を吸い取る。", bigAttackDesc: "精気を吸い、力を奪って攻撃力を下げる。" },
  kappa: { desc: "川辺に棲む妖怪。相撲を好み、力比べで組み伏せてくる。", bigAttackDesc: "相撲さながらに組み伏せ、構えを崩して防御力を下げる。" },
  hitotsume_kozo: { desc: "額に大きな一つ目を持つ小さな妖怪。不気味な視線で竦ませる。", bigAttackDesc: "不気味な一つ目で睨みつけ、竦んで動きが鈍る。" },
  bake_danuki: { desc: "人を化かす狸。幻術で惑わせてくる。", bigAttackDesc: "幻術で惑わし、技を封じてくる。" },
  onibi: { desc: "宙を漂う怪しい炎の妖怪。", bigAttackDesc: "誰か1人が庇っても防ぎきれない燃え広がる炎で、パーティ全体を焼く。" },
  kamaitachi: { desc: "鋭い刃のような風を操る妖怪。一閃で鎧ごと切り裂く。", bigAttackDesc: "かまいたちの一閃が鎧ごと切り裂き、防御力を下げる。" },
  // ---- 森・序盤の中ボス級(奉行所の依頼専用) ----
  oo_inoshishi: { desc: "猪の中でもひときわ巨大な個体。毛皮は分厚く牙は鋭く、奉行所に討伐依頼が入るほどの猛々しさを持つ。", bigAttackDesc: "渾身の突進。かばう仲間でもぎりぎり耐えられるかという凄まじい一撃。" },
  q_arakuma: { desc: "森の主と呼ばれる巨大な熊。緊急の討伐依頼で現れる。", bigAttackDesc: "爪の一薙ぎが鎧を弾き飛ばし、防御力を下げる。" },
  q_daija: { desc: "川を塞ぐほどの大きさの蛇。牙に猛毒を宿す。緊急の討伐依頼で現れる。", bigAttackDesc: "強烈な一撃を放つ。牙に噛まれると高確率で毒を負う。" },
  q_oni: { desc: "山に棲む鬼。緊急の討伐依頼で現れる。", bigAttackDesc: "棍棒の一撃は防御ごと打ち砕く強烈な一打。" },
  q_gashadokuro: { desc: "夜な夜な鳴くという骨の怪。緊急の討伐依頼で現れる。", bigAttackDesc: "骨の震えが響き渡り、高確率で敵をスタンさせる。" },
  // ---- 森・中盤 ----
  ochimusha: { desc: "戦に敗れ、成仏できずに彷徨う武者の霊。" },
  kamaitachi2: { desc: "序盤の個体よりも研ぎ澄まされた、より鋭い風を操るかまいたち。" },
  youko: { desc: "人を化かす妖艶な狐。長い年月を経て妖力を得た。" },
  rokurokubi: { desc: "首が伸びる妖怪。不意をついて距離を詰めてくる。" },
  yukionna: { desc: "雪山に現れる白い女の妖怪。冷気で近づく者を凍えさせる。" },
  yamauba: { desc: "山奥に棲む老婆の妖怪。怪力で襲いかかる。" },
  tsuchigumo: { desc: "地中に潜む大蜘蛛の妖怪。不意打ちを得意とする。" },
  onryo: { desc: "強い恨みを残したまま彷徨う霊。攻撃的で力も強い。" },
  oomukade: { desc: "山を這う巨大な百足。硬い甲殻で身を守る。" },
  kasha: { desc: "亡骸を奪い去るという、炎をまとった妖怪の車。" },
  // ---- 森・後半(2体は中ボス級) ----
  oni: { desc: "赤黒い肌と角を持つ、力自慢の鬼。" },
  karasu_tengu: { desc: "翼を持つ烏の姿の天狗。空を飛び回る。" },
  yamauba2: { desc: "さらに年月を経て凶暴化した山姥。" },
  gyuki: { desc: "牛の頭を持つ巨大な鬼。並外れた膂力を誇る。" },
  nue: { desc: "猿・虎・蛇が混ざったような姿の怪物。空を飛び回る。" },
  wanyudo: { desc: "燃え盛る車輪の姿をした妖怪。猛スピードで転がってくる。" },
  gaikotsu_musha: { desc: "朽ちてなお武具を纏う骸骨の武者。" },
  orochi: { desc: "山を覆うほどの巨体を持つ大蛇。" },
  gashadokuro: { desc: "無数の骨が集まってできた巨大な怪物。夜な夜な軋む音を響かせ、近づく者を震え上がらせる。" },
  kyubi_no_kitsune: { desc: "九本の尾を持つ古の妖狐。強大な妖力を自在に操り、並の術者では太刀打ちできない。" },
  // ---- 森・終盤(最後の1体は最終ボス) ----
  shuten_doji: { desc: "酒を好み、都を騒がせたという鬼の頭領。" },
  ibaraki_doji: { desc: "酒呑童子の腹心として知られる、屈強な鬼。" },
  dai_tengu: { desc: "他の天狗を束ねるほどの神通力を操る存在。" },
  yamata_no_orochi: { desc: "八つの頭と尾を持つ伝説の大蛇。" },
  tamamo_no_mae: { desc: "絶世の美女に化けた、九尾の狐の化身。" },
  giou: { desc: "深き山に君臨するという、謎めいた王。" },
  kyubi_shin: { desc: "正体を現した、九尾の狐の真の姿。" },
  gashadokuro_shin: { desc: "無数の怨念を宿した、がしゃどくろの真の姿。" },
  yomi_no_onryo: { desc: "黄泉の国から現世に漏れ出た、強い恨みを持つ霊。" },
  kishin_rasetsuo: { desc: "深淵の森の最奥に君臨する、鬼神にして羅刹の王。その一撃は山をも砕くという。" },
  // ---- 森・大群系(小さく、数が多いのが特徴) ----
  nurari_koumori: { desc: "小さな群れで飛び回るコウモリの妖怪。毒を持つ牙で噛みつく。" },
  chochin_obake: { desc: "提灯に目鼻がついた小さな妖怪。群れで漂う。" },
  kawappa: { desc: "河童の子供のような小さな妖怪。群れで現れる。" },
  chibi_oni: { desc: "まだ幼い小鬼。数の多さで挑んでくる。" },
  karakasa: { desc: "古い傘の妖怪。ぴょんぴょん跳ねて襲いかかる。" },
  kogitsune: { desc: "すばしっこい子狐の妖怪。群れで駆け回る。" },
  warashibe_ningyo: { desc: "藁でできた人形の妖怪。呪いを宿し群れで動く。" },
  medama_kozou: { desc: "大きな目玉を持つ小僧の妖怪。" },
  // ---- 海岸・序盤 ----
  iso_gani: { desc: "磯辺に潜む蟹の妖怪。大きなハサミで挟みかかる。", bigAttackDesc: "大きなハサミで挟み込み、攻撃力を下げる。" },
  yadokari: { desc: "貝殻を背負った妖怪。殻を盾に体当たりする。", bigAttackDesc: "貝殻を盾にした体当たり。" },
  isozakana: { desc: "群れで泳ぐ小さな魚の妖怪。鋭い歯で通常攻撃でも必ず出血を負わせる。", bigAttackDesc: "跳びかかりながらの体当たり。デバフは伴わない。" },
  kurage_bou: { desc: "クラゲの姿をした妖怪。触手で痺れさせる。", bigAttackDesc: "触手でびりびりと痺れさせ、スタンさせる。" },
  kaiyose: { desc: "波間を漂う貝の妖怪。殻を閉じて噛みつく。", bigAttackDesc: "貝殻を閉じて強く噛みつく。" },
  hama_tako: { desc: "浜に上がってきたタコの妖怪。足を絡めてくる。", bigAttackDesc: "足を絡めて動きを封じる。" },
  kaisou_douji: { desc: "海藻をまとった童子の妖怪。", bigAttackDesc: "しなやかな体で連続して攻め立てる。" },
  harifugu: { desc: "膨れて針だらけになるフグの妖怪。", bigAttackDesc: "大きく膨らみ、針だらけの体で突進する。" },
  umineko: { desc: "海辺を飛び回るカモメの妖怪。", bigAttackDesc: "高速で急降下し、くちばしでつつく。" },
  // ---- 海岸・中盤 ----
  kaizoku_gaikotsu: { desc: "海に沈んだ海賊の成れの果て。錆びた刀を振るう。", bigAttackDesc: "錆びた刀の一閃が傷を刻む。" },
  iso_inu: { desc: "磯を駆け回る犬の妖怪。鋭い牙で何度も噛みつき、通常攻撃でも出血を負わせる。" },
  oo_dako_1: { desc: "岩場に潜む大きなタコの妖怪。", bigAttackDesc: "足で締め上げ、体勢を崩して防御力を下げる。" },
  iwa_gani: { desc: "岩のように硬い甲羅を持つ蟹の妖怪。", bigAttackDesc: "岩の隙間から大きなハサミで挟み込む。" },
  gyojin: { desc: "半魚人の姿をした妖怪。三叉槍を操る。", bigAttackDesc: "三叉槍の刺突が深い傷を残す。" },
  shell_slime: { desc: "貝殻をまとったスライム状の妖怪。", bigAttackDesc: "体当たりの粘液が防具を溶かし、防御力を下げる。" },
  kaisou_no_sei: { desc: "海藻に宿る精霊。触れた相手からじわじわ体力を奪う。" },
  same: { desc: "海の頂点に立つ鮫の妖怪。", bigAttackDesc: "群れの頂点、鋭い歯で嚙みちぎる。" },
  iso_onna_1: { desc: "磯辺に現れる女の妖怪。長い髪で絡めとる。", bigAttackDesc: "伸びる髪で絡めとり、動きを封じる。" },
  oo_kai: { desc: "巨大な貝の妖怪。", bigAttackDesc: "貝殻を強く閉じて押しつぶす。" },
  // ---- 海岸・後半(1体は中ボス級) ----
  umibouzu: { desc: "海に現れる黒い巨体の妖怪。", bigAttackDesc: "水しぶきが誰か1人の盾では防ぎきれず、パーティ全体を飲み込む。" },
  iso_onna_2: { desc: "積年の怨念を宿した、より強力な磯女。", bigAttackDesc: "伸びる髪で絡めとり、強く動きを封じる。" },
  iwagaki_ou: { desc: "長年生きた岩ガキの化身。硬い殻で身を守る。", bigAttackDesc: "硬い殻を活かした強烈な体当たり。" },
  umihebi: { desc: "海に潜む大蛇。鋭い牙に毒を仕込む。" },
  umigumo: { desc: "海中に糸を張る蜘蛛の妖怪。", bigAttackDesc: "糸で動きを完全に封じる。" },
  ryuuguu_no_shisha: { desc: "竜宮城からの使いとされる妖怪。素早い三叉槍を操る。", bigAttackDesc: "素早い三叉槍の突きが深い傷を刻む。" },
  oo_dako_2: { desc: "さらに巨大化した大ダコ。", bigAttackDesc: "岩場に潜む巨躯が締め上げ、防御力を下げる。" },
  same_bito: { desc: "鮫の姿をした獰猛な戦士。短剣と牙で切り裂く。", bigAttackDesc: "短剣と牙で連続して切り裂く。" },
  shinkai_no_bourei: { desc: "深海から漂う怨念の亡霊。呪いの力で継続的に蝕む。" },
  oo_kani_ou: { desc: "この地を支配する巨大な蟹の王。鋼のように硬い甲羅と、鎧ごと砕く鋏を持つ。", bigAttackDesc: "巨大な鋏で鎧ごと粉砕する強烈な一撃。" },
  // ---- 海岸・終盤(最後の1体は最終ボス) ----
  kaima_daiou: { desc: "海の魔を統べる大王。", bigAttackDesc: "大槍を薙ぎ払い、庇う相手ごと巻き込む。" },
  youen_na_isoonna: { desc: "妖艶な姿で敵を誘い込む磯女の上位個体。", bigAttackDesc: "魅了の歌で敵を弱らせ、攻撃力を下げる。" },
  kyokai_no_oodako: { desc: "海を支配するほど巨大化したタコの妖怪。", bigAttackDesc: "八本の足で完全に絡め取り、スタンさせる。" },
  oni_harifugu: { desc: "鬼のように巨大化したハリフグ。針に毒を宿す。", bigAttackDesc: "無数の針を飛ばし、毒をばら撒く。" },
  oo_kani_shougun: { desc: "この地を治める巨蟹の将。", bigAttackDesc: "巨大な鋏で敵を叩き潰し、防御力を下げる。" },
  kairyuu_ou: { desc: "海を統べる龍の王。潮と雷撃を操る。", bigAttackDesc: "潮とともに雷撃を放ち、スタンさせる。" },
  same_no_bujin: { desc: "鎧を纏った鮫の戦士。槍と牙で敵を貫く。", bigAttackDesc: "槍と牙で敵を貫く連続攻撃。" },
  umi_no_souryo: { desc: "海に沈んだ僧侶の怨念。呪詛の法術を操る。", bigAttackDesc: "呪詛の法術で敵の力を弱める。" },
  uzushio_no_onryou: { desc: "渦潮に宿る怨霊。渡る者を引きずり込む。", bigAttackDesc: "渦潮に引き寄せ、庇う間もなくパーティ全体を飲み込む。" },
  kaiyoujo_ou: { desc: "この地の全てを支配する妖怪の女王。その呪術の前では、並みの武具など意味を成さない。", bigAttackDesc: "強力な呪術で敵を蝕む一撃。" },
};
function bestiaryTextFor(enemyId) {
  const t = ENEMY_BESTIARY_TEXT[enemyId] || {};
  return { desc: t.desc || "", bigAttackDesc: t.bigAttackDesc || BESTIARY_GENERIC_BIG_ATTACK_DESC };
}
// 図鑑の弱点表示。4種類: bleed(出血🩸,獣・動物系)/poison(毒☠️,人型系)/burn(炎上🔥,植物・木系)/
// spirit(霊力☯️,実体を持たない系、被ダメージ1.5倍固定)。被ダメージ2倍は共通、加えてeffects
// (atkDown/defDown/spdDown、図鑑エディタのチェックボックス)で対応するDOTがアクティブな間だけ
// 継続ステータスデバフが乗る(engine.jsのweaknessEffectActive参照)。
// (2026-07-21: 飛行(flying)は実際にはisFlyingフラグ側のみが機能しており、この弱点システム上は
// 表示専用で何もしていなかったため撤去した。isFlyingの実際の挙動は変更なし)
const WEAKNESS_ICON = { bleed: "🩸", poison: "☠️", burn: "🔥", spirit: "☯️" };
const ENEMY_WEAKNESS = {
  yaken: { type: "bleed", effects: ["atkDown"], flavor: "深手を負うと獰猛さを失い、防御が大きく低下する。" },
  inoshishi: { type: "bleed", effects: ["atkDown", "defDown"], flavor: "傷を負うと勢いが鈍り、防御が大きく低下する。" },
  dokuhebi: { type: "bleed", effects: ["atkDown"], flavor: "傷口から体力を失いやすい。" },
  oogumo: { type: "burn", effects: ["atkDown", "defDown"], flavor: "巣や糸は炎に弱く、激しく燃え広がる。" },
  kodama: { type: "burn", effects: ["defDown"], flavor: "依代である木が燃えると、その力を維持できない。" },
  kappa: { type: "poison", effects: ["defDown"], flavor: "人に近い身体を持つため、毒がよく効く。" },
  hitotsume_kozo: { type: "poison", effects: ["atkDown"], flavor: "妖力は体調に左右されやすく、毒で術が乱れる。" },
  bake_danuki: { type: "bleed", flavor: "傷を負うと化ける力が不安定になる。" },
  onibi: { type: "spirit", flavor: "霊力に非常に弱い。" },
  kamaitachi: { type: "bleed", effects: ["atkDown", "spdDown"], flavor: "傷を負うと俊敏さを失い、防御が大きく低下する。" },
  oo_inoshishi: { type: "bleed", flavor: "傷を負うと勢いが鈍り、防御が大きく低下する。", effects: ["defDown"] },
  q_arakuma: { type: "bleed", flavor: "深手を負うと獰猛さを失い、防御が大きく低下する。", effects: ["defDown"] },
  q_daija: { type: "bleed", flavor: "傷口から体力を失いやすい。" },
  q_oni: { type: "poison", flavor: "巨体でも毒の侵食には抗えない。" },
  q_gashadokuro: { type: "spirit", flavor: "骨だけの体は霊力に強く侵される。" },
  ochimusha: { type: "poison", flavor: "生前と同じ肉体を宿しているため、毒で怨念が乱れる。" },
  kamaitachi2: { type: "bleed", flavor: "傷を負うと素早さを失い、防御が大きく低下する。", effects: ["defDown"] },
  youko: { type: "bleed", flavor: "傷を負うと幻術への集中が乱れやすい。" },
  rokurokubi: { type: "poison", flavor: "妖力は体調に左右されやすく、毒で術が乱れる。" },
  yukionna: { type: "burn", flavor: "冷気の妖力は炎に弱く、燃え続ける炎を嫌う。" },
  yamauba: { type: "poison", flavor: "老いた身体は毒に侵されると妖力を維持できない。" },
  onryo: { type: "spirit", flavor: "実体を持たず、霊力に強く侵される。" },
  kasha: { type: "spirit", flavor: "妖火をまとう体は、霊力には抗えない。" },
  oni: { type: "poison", flavor: "巨体でも毒の侵食には抗えない。" },
  yamauba2: { type: "poison", flavor: "老いた身体は毒に侵されると妖力が乱れる。" },
  gyuki: { type: "bleed", flavor: "深い傷を負うと巨体を支えられず、防御が大きく低下する。", effects: ["defDown"] },
  wanyudo: { type: "burn", flavor: "燃え盛る炎は逆に制御を乱し、力を暴走させる。" },
  gaikotsu_musha: { type: "spirit", flavor: "肉体を持たず、霊力に強く侵される。" },
  orochi: { type: "bleed", flavor: "傷口から体力を失いやすい。" },
  gashadokuro: { type: "spirit", flavor: "無数の骨が集う体は、霊力に強く侵される。" },
  kyubi_no_kitsune: { type: "bleed", flavor: "傷を負うと妖力への集中が乱れ、防御が大きく低下する。", effects: ["defDown"] },
  shuten_doji: { type: "poison", flavor: "豪胆な鬼でも、毒は確実に身体を蝕む。" },
  ibaraki_doji: { type: "poison", flavor: "強靭な肉体も毒の侵食には抗えない。" },
  dai_tengu: { type: "poison", flavor: "強大な妖術ほど毒の影響を受けやすい。" },
  yamata_no_orochi: { type: "bleed", flavor: "巨大な身体ほど傷口から力を失いやすい。" },
  tamamo_no_mae: { type: "bleed", flavor: "傷を負うと妖力への集中が乱れ、防御が大きく低下する。", effects: ["defDown"] },
  giou: { type: "bleed", flavor: "巨体ゆえに深手を負うと動きが鈍り、防御が大きく低下する。", effects: ["defDown"] },
  kyubi_shin: { type: "bleed", flavor: "傷を負うと妖力への集中が乱れ、防御が大きく低下する。", effects: ["defDown"] },
  gashadokuro_shin: { type: "spirit", flavor: "骨だけで構成された巨体は、霊力に強く侵される。" },
  yomi_no_onryo: { type: "spirit", flavor: "肉体を持たず、霊力に強く侵される。" },
  kishin_rasetsuo: { type: "spirit", flavor: "鬼神の肉体も、霊力の前では無力に近い。" },
  chochin_obake: { type: "burn", flavor: "提灯の紙と竹は炎に弱い。" },
  kawappa: { type: "poison", flavor: "子供の河童はまだ毒への耐性が乏しい。" },
  chibi_oni: { type: "poison", flavor: "幼い鬼はまだ毒への耐性が弱い。" },
  karakasa: { type: "burn", flavor: "古い傘の紙と骨は炎に弱い。" },
  kogitsune: { type: "bleed", flavor: "幼い狐は傷を負うと動きが乱れやすい。" },
  warashibe_ningyo: { type: "burn", flavor: "藁でできた体は炎に非常に弱い。" },
  medama_kozou: { type: "poison", flavor: "小さな体は毒の影響を受けやすい。" },
  iso_gani: { type: "bleed", flavor: "殻に傷が入ると、防御が大きく低下する。", effects: ["defDown"] },
  yadokari: { type: "bleed", flavor: "殻から出た柔らかい体は傷つきやすい。" },
  isozakana: { type: "bleed", flavor: "小さな体は傷を負うと弱りやすい。" },
  kurage_bou: { type: "bleed", flavor: "傷つくと体液を失い、力が抜ける。" },
  kaiyose: { type: "bleed", flavor: "殻の隙間から傷を負いやすい。" },
  hama_tako: { type: "bleed", flavor: "柔らかい体は傷に弱い。" },
  kaisou_douji: { type: "burn", flavor: "海藻の体は乾くと燃えやすい。" },
  harifugu: { type: "bleed", flavor: "針の下の柔らかい体は傷に弱い。" },
  kaizoku_gaikotsu: { type: "spirit", flavor: "白骨の体は、霊力に強く侵される。" },
  iso_inu: { type: "bleed", flavor: "傷を負うと獰猛さを失い、防御が大きく低下する。", effects: ["defDown"] },
  oo_dako_1: { type: "bleed", flavor: "柔らかい体は傷に弱い。" },
  iwa_gani: { type: "bleed", flavor: "岩のような殻も、傷が入れば防御が大きく低下する。", effects: ["defDown"] },
  gyojin: { type: "poison", flavor: "人に近い体を持つため、毒がよく効く。" },
  shell_slime: { type: "spirit", flavor: "液状の体は、霊力に強く侵される。" },
  kaisou_no_sei: { type: "burn", flavor: "依代の海藻が燃えると、その力を維持できない。" },
  same: { type: "bleed", flavor: "手負いになると狩りの精度を欠き、防御が大きく低下する。", effects: ["defDown"] },
  iso_onna_1: { type: "poison", flavor: "妖力は体調に左右されやすく、毒で術が乱れる。" },
  oo_kai: { type: "bleed", flavor: "殻を閉じる力も、傷を負えば大きく落ちる。", effects: ["defDown"] },
  umibouzu: { type: "spirit", flavor: "得体の知れない体は、霊力に強く侵される。" },
  iso_onna_2: { type: "poison", flavor: "積年の妖力は毒で大きく乱れる。" },
  iwagaki_ou: { type: "bleed", flavor: "長年の殻も、傷が入れば防御が大きく低下する。", effects: ["defDown"] },
  umihebi: { type: "bleed", flavor: "傷口から体力を失いやすい。" },
  umigumo: { type: "burn", flavor: "糸は炎に弱く、激しく燃え広がる。" },
  ryuuguu_no_shisha: { type: "poison", flavor: "妖力は毒に大きく乱される。" },
  oo_dako_2: { type: "bleed", flavor: "柔らかい体は傷に弱い。" },
  same_bito: { type: "poison", flavor: "人に近い体ほど、毒の影響を強く受ける。" },
  shinkai_no_bourei: { type: "spirit", flavor: "実体を持たず、霊力に強く侵される。" },
  oo_kani_ou: { type: "bleed", flavor: "巨大な鋏も、傷が入れば防御が大きく低下する。", effects: ["defDown"] },
  kaima_daiou: { type: "poison", flavor: "王としての誇りも、毒には抗えない。" },
  youen_na_isoonna: { type: "poison", flavor: "妖艶な力ほど、毒に乱されやすい。" },
  kyokai_no_oodako: { type: "bleed", flavor: "巨躯でも柔らかい体は傷に弱い。" },
  oni_harifugu: { type: "bleed", flavor: "針の下の体は傷に弱い。" },
  oo_kani_shougun: { type: "bleed", flavor: "将としての威厳も、傷を負えば防御が大きく低下する。", effects: ["defDown"] },
  kairyuu_ou: { type: "bleed", flavor: "巨躯の龍でも、傷口から力を失う。" },
  same_no_bujin: { type: "poison", flavor: "人に近い体を持つ武人ほど、毒がよく効く。" },
  umi_no_souryo: { type: "poison", flavor: "人としての肉体は、毒の影響を色濃く受ける。" },
  uzushio_no_onryou: { type: "spirit", flavor: "実体を持たず、霊力に強く侵される。" },
  kaiyoujo_ou: { type: "poison", flavor: "女王としての誇り高き妖力も、毒には抗えない。" },
  cave_tsuchigumo: { type: "burn", effects: ["atkDown", "defDown"] },
  cave_oomukade: { type: "burn", effects: ["atkDown", "defDown"] },
  doukutsu_shokujinsou: { type: "burn", effects: ["atkDown", "defDown"] },
  doukutsu_chouchinbi: { type: "spirit" },
  bake_nezumi: { type: "bleed", effects: ["spdDown"] },
  bake_take: { type: "burn", effects: ["atkDown"], customEffect: "大技を使用できなくなる" },
  doukutsu_bourei: { type: "spirit" },
  doukutsu_inoshishi: { type: "bleed", effects: ["atkDown"] },
};
function enemyWeakness(enemyId) { return ENEMY_WEAKNESS[enemyId] || null; }
// 図鑑の1行の弱点表示テキスト(絵文字込み)を組み立てる。無ければnull
function bestiaryWeaknessLine(enemyId) {
  const w = ENEMY_WEAKNESS[enemyId];
  if (!w) return null;
  return `${WEAKNESS_ICON[w.type]}${w.flavor}`;
}

// 支援物資: 道具屋ではなく出発画面(パーティ編成)で購入する消耗品。合計SUPPLY_CAP個までしか持てない
const ITEMS = {
  potion: { id: "potion", ja: "回復薬", price: 5, desc: "HPを少し回復する", image: "assets/items/potion.png" },
  smokeBomb: { id: "smokeBomb", ja: "煙玉", price: 15, desc: "その戦闘から即座に逃げる", image: "assets/items/smoke_bomb.png" },
  campingKit: { id: "campingKit", ja: "野営具", price: 50, desc: "簡易宿泊キット。夜を越すことができる", image: "assets/items/camping_kit.png" },
  onsenEgg: { id: "onsenEgg", ja: "温泉卵", price: 5, desc: "HPをほんの少し回復。ターンを消費しない(自分専用)", image: "assets/items/onsen_egg.png" },
  bomb: { id: "bomb", ja: "爆弾", price: 30, desc: "敵全体にダメージ", emoji: "💣" }, // 画像は未用意。imageが無い場合は絵文字で代用する
  takigyo: { id: "takigyo", ja: "滝行許可証", price: 500, desc: "全てのスキルを忘れて\n1から取り直しできる", emoji: "📜" },
  // 茶屋のお茶菓子8種。回復薬/煙玉と同じ支援物資として持ち歩き、道具メニューから使う(購入時にその場で
  // 食べさせる方式は「回復薬と同じように使いたい」という指摘を受けて廃止した)。hpPct/mpPctは
  // useTeahouseSnack(engine.js)が参照する専用フィールド
  amadango: { id: "amadango", ja: "甘団子", price: 9, hpPct: 0.20, mpPct: 0.15, desc: "素朴な甘さが心をほぐす団子。\nHPとMPをちょっと回復。", image: "assets/items/snack_amadango.png" },
  sanshokudango: { id: "sanshokudango", ja: "三色団子", price: 5, hpPct: 0.20, mpPct: 0.13, desc: "春を感じる彩り豊かな団子。\nHPとMPをちょっと回復。", image: "assets/items/snack_sanshokudango.png" },
  sakuramochi: { id: "sakuramochi", ja: "桜餅", price: 10, hpPct: 0.25, mpPct: 0.15, desc: "桜の香りが気持ちを和らげる。\nHPとMPをちょっと回復。", image: "assets/items/snack_sakuramochi.png" },
  kusamochi: { id: "kusamochi", ja: "草餅", price: 8, hpPct: 0.20, mpPct: 0.10, desc: "よもぎの香りが疲れを癒やす。\nHPとMPをちょっと回復。", image: "assets/items/snack_kusamochi.png" },
  matcha: { id: "matcha", ja: "抹茶", price: 8, hpPct: 0.10, mpPct: 0.20, desc: "ほろ苦い一服で心を落ち着ける。\nHPとMPをちょっと回復。", image: "assets/items/snack_matcha.png" },
  yakiguri: { id: "yakiguri", ja: "焼き栗", price: 8, hpPct: 0.13, mpPct: 0.16, desc: "ほくほくとした甘みが元気をくれる。\nHPとMPをちょっと回復。", image: "assets/items/snack_yakiguri.png" },
  hoshigaki: { id: "hoshigaki", ja: "干し柿", price: 12, hpPct: 0.25, mpPct: 0.13, desc: "じっくり熟した自然の甘味。\nHPとMPをちょっと回復。", image: "assets/items/snack_hoshigaki.png" },
  konpeito: { id: "konpeito", ja: "金平糖", price: 15, hpPct: 0.25, mpPct: 0.20, desc: "ひと粒で気分が晴れる甘い菓子。\nHPとMPをちょっと回復。", image: "assets/items/snack_konpeito.png" },
};
// 茶屋のお茶菓子のid一覧(ITEMSキーの部分集合)。支援物資合計(supplyItemTotal)・所持アイコン一覧
// (renderOwnedSupplyIcons)・道具メニュー(dungeonToolsBtn/renderItemMenu)での一括列挙に使う
const TEAHOUSE_SNACK_IDS = ["amadango", "sanshokudango", "sakuramochi", "kusamochi", "matcha", "yakiguri", "hoshigaki", "konpeito"];
// 火薬庫で購入できる爆弾: 敵全体に防御無視の固定ダメージ(猪の実HP約62の6割=約37を基準に設定)
const BOMB_FLAT_DAMAGE = 37;
const POTION_HEAL_RATIO = 0.38;
const BEE_FARM_POTION_BONUS_PER_LEVEL = 0.015; // 養蜂場は1段階につき回復薬の回復量+1.5%(最大5段階で+7.5%。建築エディタ2026-07-26で0.02→0.015)
// 温泉卵: 使ってもターンを消費しない自分専用の回復アイテム(仲間には使えない)。回復薬/煙玉と
// 同じ支援物資の共有枠(SUPPLY_CAP_BASE)を消費する
const ONSEN_EGG_HEAL_RATIO = 0.25;
const HEN_HOUSE_ONSEN_EGG_BONUS_PER_LEVEL = 0.02; // 鶏小屋は1段階につき温泉卵の回復量+2%(最大2段階で+4%。建築エディタ2026-07-26のdesc仕様に合わせて0.05→0.02)
// 野営具は回復薬/煙玉とは別枠で、最大CAMPING_KIT_CAP個までしか持てない(高価な特別アイテムのため)
const CAMPING_KIT_CAP = 1;
// 野営(野営具を使った時の休息)の効果: HP/MPを割合回復、ストレスを固定量回復
const CAMP_HP_RELIEF = 0.6;
const CAMP_MP_RELIEF = 0.45;
const CAMP_STRESS_RELIEF = 20;
// 野営中に選べる3行動のうち「慰める」のストレス軽減量
const CAMP_COMFORT_STRESS_RELIEF = 10;
// 茶屋(深淵の森15層、茶屋を建築済みの時だけ進路選択に必ず現れる休憩所)
const TEA_HOUSE_FLOOR = 20; // 階層1.5倍化で15→22にした後、ユーザー指示(2026-07-18)で20へ調整
const TEAHOUSE_REST_COST = 30; // 一休みの利用料(G)
const TEAHOUSE_REST_HP_RATIO = 0.4;
const TEAHOUSE_REST_MP_RATIO = 0.4;
const TEAHOUSE_REST_CLOCK_MINUTES = 60; // 一休みで進む時間(1時間)
const TEAHOUSE_POTION_STOCK = 4; // 1回の来訪で買える回復薬の在庫数
const TEAHOUSE_SMOKEBOMB_STOCK = 1; // 1回の来訪で買える煙玉の在庫数
const TEAHOUSE_REST_MESSAGES = ["団子を食べて休憩した", "ちょっと一休みした", "お茶を飲んで休憩", "ちょっと疲れが取れた"];
const TEAHOUSE_SNACK_STOCK = 1; // お茶菓子は1商品につき1日1個までしか売っていない(翌日の営業再開まで補充されない)
// 茶屋の案内キャラクター。温泉・宿屋・売店と同じく1日おきにランダムな一言を喋る(renderTeahouse参照)
const TEAHOUSE_KEEPER_LINES = [
  "いらっしゃい。お茶でもどうぞ。",
  "団子、焼きたてですよ。",
  "少し座って休んでいってください。",
  "旅の途中は、甘い物が効きますよ。",
  "お団子、たくさん召し上がれ。",
  "ここでひと息つくと、また歩けますよ。",
  "抹茶、渋みが良い塩梅なんです。",
  "無理せず、ゆっくりしていってくださいね。",
  "遠くから歩いてきたんですね。お疲れさま。",
  "この栗、今朝焼いたばかりなんですよ。",
  "甘い物は、心にも効くんです。",
  "また旅の話、聞かせてくださいね。",
  "干し柿、よく熟していて甘いですよ。",
  "金平糖、一粒でほっとしますよ。",
  "お茶が入りましたよ。どうぞ。",
  "森の中は大変でしょう。少し休んで。",
];
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
      left: { name: "居合", desc: "戦闘開始後、最初の攻撃のダメージ+40%", mp: 0, passive: { firstAttackBonusMult: 0.40 } },
      right: { name: "見切り", desc: "敵の攻撃を回避した時、攻撃力50%の威力で反撃する。", mp: 0, passive: { onEvadeCounterMult: 0.5 } },
    },
    3: {
      // 闘志はLv7左から移動(内容はそのまま)
      left: { name: "闘志", desc: "仲間が会心を発動したターン、自分の会心率が25%上がる。(仲間が二人以上会心を出しても、重複しない)", mp: 0, passive: { allyCritSelfCritBuff: 0.25 } },
      // 新規スキル。HP20%刻み4段のconditionalModsで表現(HP80/60/40/20%以下でそれぞれ攻撃力+10%)。
      // 複数段の重なりは加算(全部重なるとちょうど+40%)。エンジン側(engine.js effectiveStat)で
      // 差分合算してから1回だけ乗算する実装のため複利にはならない
      right: {
        name: "武士道", desc: "HPが20%減るごとに攻撃力＋10%", mp: 0,
        passive: {
          conditionalMods: [
            { cmp: "lte", value: 0.8, statMult: [{ stat: "atk", mult: 1.1 }] },
            { cmp: "lte", value: 0.6, statMult: [{ stat: "atk", mult: 1.1 }] },
            { cmp: "lte", value: 0.4, statMult: [{ stat: "atk", mult: 1.1 }] },
            { cmp: "lte", value: 0.2, statMult: [{ stat: "atk", mult: 1.1 }] },
          ],
        },
      },
    },
    4: {
      left: { name: "一閃", desc: "敵単体へ190%ダメージ、防御力25%無視", mp: 3, action: { kind: "damage", mult: 1.9, defPierce: 0.25 } },
      right: { name: "心眼", desc: "このターン、敵の単体攻撃を1度だけダメージ0にし、100%の攻撃力で反撃する。", mp: 2, action: { kind: "guardCounterSelf", mult: 1.0 } },
    },
    5: {
      left: { name: "疾風斬り", desc: "自分より素早さが遅い相手に攻撃する時、75%の確率で出血1〜3を与える。", mp: 0, passive: { onHitInflict: { type: "bleed", chance: 0.75, valueMin: 1, valueMax: 3, condition: "targetSlower" } } },
      // desc変更(スキルエディタの差分反映): 敵バフ解除から、命中した敵を2ターン自分に引きつける効果に全面差し替え。
      // 新設のforceTarget(inflict)機構で実装。挑発/かばうより優先度が高く、対象がいなくなれば通常選択に戻る
      right: { name: "水月", desc: "威力90%で攻撃し、これを受けた敵は2ターンの間、自分を狙うようになる。", mp: 1, action: { kind: "damage", mult: 0.9, inflict: { type: "forceTarget", chance: 1, turns: 2 } } },
    },
    6: {
      // 鬼神化は過去に無断実装してユーザー指示でrevertした経緯があるため、今回も仕組みは実装せずテキストのみ反映(2026-07-25引き継ぎ参照、要確認)
      left: { name: "鬼神化", desc: "遠征中一度だけ使える。5ターンの間、鬼の力を発現する。発動時、全ての状態異常、HPを全回復する。鬼神化中はストレスの影響を受けない。鬼神斬り:mp消費0。威力110%会心率＋40%が利用可能。この技で敵を倒すとHPを20%回復。ストレス＋100。ターンを消費しない。", mp: 3 },
      // 新規スキル(旧・百戦錬磨の名前枠を置き換え、百戦錬磨自体はLv10右「天衣無縫」へ移動)。
      // 会心率+25%/5ターン/ターン消費なしの部分のみ実装。「心眼のmp消費-1」「ストレス免疫/毎ターン回復」は
      // 別途ストレス無効化の仕組み自体が必要なため今回は見送り、テキストのみ反映(2026-07-25引き継ぎ参照、要確認)
      right: { name: "明鏡止水", desc: "5ターンの間、明鏡止水状態に入る。会心率+25% 心眼のmp消費-1。 ストレスの影響を受けず、ストレスを蓄積しない。毎ターンストレスを1回復。ターンを消費しない。", mp: 3, action: { kind: "buffSelf", stats: [{ stat: "critRateAdd", mult: 0.25 }], turns: 5, noCost: true } },
    },
    7: {
      // 連斬はLv8左から移動(内容はそのまま、覇気と入れ替え)
      left: { name: "連斬", desc: "会心を出した直後、25%の確率でもう一度通常攻撃できる。(通常攻撃のみ選択可、対象も選び直せる)", mp: 0, passive: { onCritExtraAttackChance: 0.25 } },
      // 新規スキル(燕返しの抜けた枠、実質は旧Lv9右にあった「覚悟」の再登場)。onceGuardType:"surviveAtHp1"は
      // 元々あった仕組みだが、これまでどのスキルからも参照されていなかった(未使用の汎用フック)
      right: { name: "覚悟", desc: "戦闘中に1度だけ、瀕死になる攻撃を受けた時、状態異常を全て回復し、HP1で持ち堪える。", mp: 0, passive: { onceGuardType: "surviveAtHp1" } },
    },
    8: {
      // 覇気はLv7左から移動(内容はそのまま、連斬と入れ替え)
      left: { name: "覇気", desc: "会心が発動するたびに、会心率が＋3%。", mp: 0, passive: { onCritSelfStackCritRate: 0.03 } },
      // desc変更(スキルエディタの差分反映): 燕返し(反撃会心率up)の枠に、黒曜(Lv7右から移動)を効果拡張して差し替えた
      right: { name: "黒曜", desc: "出血ダメージと、攻撃力低下を受けなくなる", mp: 0, passive: { dotDamageMult: 0, debuffImmuneStats: ["atk"] } },
    },
    9: {
      left: { name: "修羅", desc: "敵を倒すと3ターンの間、攻撃力+25%\n(重複しない)", mp: 0, passive: { onKill: { statMult: [{ stat: "atk", mult: 1.25 }], turns: 3, maxStacks: 1 } } },
      // mp変更(スキルエディタの差分反映): 3→0
      right: { name: "残心", desc: "敵を倒すと次のターンに使うスキルのmpを0にする", mp: 0, passive: { onKillNextSkillFree: true } },
    },
    10: {
      // 旧・神速抜刀(320%ダメージ)から全面刷新
      left: { name: "神速抜刀", desc: "35%の威力で敵を攻撃。ターンを消費しない。", mp: 1, action: { kind: "damage", mult: 0.35, noCost: true } },
      // desc変更(スキルエディタの差分反映): 旧・百戦錬磨(ターン経過で攻撃力up)から「反撃ダメージ+50%」の
      // 固定バフに全面差し替え。心眼(guardCounterSelf)/見切り・瞬身の順(onEvadeCounterMult)双方の
      // 反撃ダメージに加算で乗る、反撃全般の共通強化として実装(counterChance系の燕返しが今のツリーに
      // 無くても、心眼・見切りが機能源になるので死にスキルにはならない)
      right: { name: "天衣無縫", desc: "反撃ダメージ+50%", mp: 0, passive: { counterDamageBonus: 0.5 } },
    },
  },
  ninja: {
    2: {
      left: { name: "煙幕", desc: "けむり玉を一つ消費して煙幕をはる。煙幕は２ターンの間、味方全体の回避率を50%向上させる。", mp: 1, action: { kind: "buffPartyConsumeItem", item: "smokeBomb", stats: [{ stat: "evasionAdd", mult: 0.5 }], turns: 2 } },
      right: { name: "毒刃", desc: "通常攻撃時、50%の確率で敵を毒状態にする(蓄積3)", mp: 0, passive: { onHitInflict: { type: "poison", chance: 0.5, valueMin: 3, valueMax: 3 } } },
    },
    3: {
      // 撒菱はLv4左から移動(内容はそのまま)
      left: { name: "撒菱", desc: "敵全体の素早さを３ターンの間30%下げる。使用時、ターンを消費しない。重複利用はできない。", mp: 1, action: { kind: "debuffAllNoCost", stat: "spd", value: 0.3, turns: 3 } },
      right: { name: "忍足", desc: "その戦闘で敵に初めに攻撃されるまで回避率＋20%", mp: 4, passive: { preFirstHitEvasionAdd: 0.2 } },
    },
    4: {
      // 口寄せの術はLv3左から移動(内容はそのまま、撒菱と入れ替え)
      left: { name: "口寄せの術", desc: "カラス・ガマ・ヘビのいずれかに変身する。", mp: 5, action: { kind: "transform" } },
      right: { name: "影分身の術", desc: "自分の分身(HP75%/MP0、通常攻撃のみ)を呼び出し、4人目として並んで戦わせる。分身は状態異常にならず回復も不可、力尽きると消え、戦闘が終わると自動で消滅する", mp: 4, action: { kind: "summonClone" } },
    },
    5: {
      left: { name: "身代わりの術", desc: "次に受ける全ての攻撃を1度だけ無効化する(全体攻撃を含む)", mp: 1, action: { kind: "shieldSelf" } },
      right: { name: "蝮手裏剣", desc: "75%のダメージを与え、毒3〜5を与える", mp: 2, rangeType: "ranged", action: { kind: "damage", mult: 0.75, inflict: { type: "poison", chance: 1.0, valueMin: 3, valueMax: 5 } } },
    },
    6: {
      left: { name: "暗殺術", desc: "攻撃力100%で敵を攻撃する。このスキルで敵をキルした場合、ターンが終了せず、再度ターンをプレイできる。", mp: 3, action: { kind: "damage", mult: 1.0, extraTurnOnKill: true } },
      // 毒殺の心得はLv9右から移動(内容はそのまま、空蝉と入れ替え)
      right: { name: "毒殺の心得", desc: "毒を負わせた敵への会心率+40%", mp: 0, passive: { ailmentCritBonus: { ailment: "poison", addRate: 0.4 } } },
    },
    7: {
      left: { name: "影縫い", desc: "敵単体へ90%ダメージ、85%の確率でスタン", mp: 3, action: { kind: "damage", mult: 0.9, inflict: { type: "stun", chance: 0.85, turns: 1 } } },
      right: { name: "瞬身の順", desc: "敵の攻撃を回避した時、反撃する。(攻撃威力75%)", mp: 0, passive: { onEvadeCounterMult: 0.75 } },
    },
    8: {
      left: { name: "幻影乱舞", desc: "ランダムな敵に威力50%の攻撃を5回繰り返す。対象ターゲットは毎回抽選。", mp: 4, action: { kind: "damageRandomMulti", mult: 0.5, hits: 5 } },
      right: { name: "修羅刃", desc: "敵を倒すと次の攻撃の回避率+40%。値は蓄積しない。", mp: 0, passive: { onKillEvasionBonus: 0.4 } },
    },
    9: {
      left: { name: "影縫い", desc: "敵一体をスタンさせる。ターンを消費しない", mp: 3, action: { kind: "stunNoCost", chance: 1, turns: 1 } },
      // 空蝉はLv6右から移動(内容はそのまま、毒殺の心得と入れ替え)。※名前欄が差分に無かったため推測で補完、要確認
      right: { name: "空蝉", desc: "敵の攻撃を回避した時、mpを1回復する。", mp: 0, passive: { onEvadeMpRestore: 1 } },
    },
    10: {
      left: { name: "禁忌・影分身の術", desc: "", mp: 0 },
      right: { name: "朧隠れ", desc: "3ターンの間、味方全員の回避率+30%", mp: 3, action: { kind: "buffParty", stats: [{ stat: "evasionAdd", mult: 0.3 }], turns: 3 } },
    },
  },
  spearman: {
    2: {
      left: { name: "貫通突き", desc: "敵単体へ180%ダメージ、防御力20%無視", mp: 2, action: { kind: "damage", mult: 1.8, defPierce: 0.2 } },
      right: { name: "不動", desc: "敵からダメージを受けるとHPを2%回復する", mp: 0, passive: { onDamagedSelfHealPct: 0.02 } },
    },
    3: {
      left: { name: "貫きの構え", desc: "かばうが成功した直後、次の自分の攻撃が確定会心になる", mp: 0, passive: { guardCritCounter: true } },
      right: { name: "砦の構え", desc: "かばうが敵の攻撃を防いだ瞬間、確実に反撃する", mp: 0, passive: { guardCounter: true } },
    },
    4: {
      left: { name: "迅雷突き", desc: "敵単体へ240%ダメージ 相手の防御力を３ターン20%低下。(40%まで蓄積する)", mp: 4, action: { kind: "damage", mult: 2.4, inflict: { type: "defDownStack", chance: 1.0, value: 0.2, maxStacks: 2, turns: 3 } } },
      right: { name: "守り槍", desc: "敵一体に攻撃をしつつ同時に庇うを発動する", mp: 2, action: { kind: "damage", mult: 1.0, alsoGuard: true } },
    },
    5: {
      // desc/mp変更(スキルエディタの差分反映): 蜻蛉切りがLv7左から移動してきた(剛槍とはLv7左へ入れ替え。
      // 明示指定は無かったが、蜻蛉切りが抜けた後のLv7左の行き先が示されていなかったため、剛槍をそちらへ
      // 移すのが最も自然と判断した。要確認)。mp2→1
      left: { name: "蜻蛉切り", desc: "飛行の敵に対する命中率ペナルティを受けずに攻撃する。打ち落としも発生する。", mp: 1, rangeType: "ranged", action: { kind: "damage", mult: 1.0, canShootDown: true } },
      // 新規スキル(旧・守護陣を置き換え)。戦闘中1回・HP25%以下限定の緊急脱出技。onceFlag/hpBelowPctは
      // 今回新設した汎用フック(runTreeSkill側でMP消費前にチェックする)
      right: { name: "怒声", desc: "戦闘中に一度だけ、HP25%以下の時にだけ使える。敵全員をスタンさせる。", mp: 2, action: { kind: "damage", aoe: true, mult: 0, hitChance: 1, inflict: { type: "stun", chance: 1, turns: 1 }, hpBelowPct: 0.25, onceFlag: "dosayUsed" } },
    },
    6: {
      // 阿修羅突きはLv7左から移動(内容はそのまま)
      left: { name: "阿修羅突き", desc: "HPが満タンの敵に対し、攻撃をすると出血を3〜5付与する", mp: 0, passive: { onHitInflict: { type: "bleed", chance: 1.0, valueMin: 3, valueMax: 5, condition: "targetFullHp" } } },
      right: { name: "迎撃", desc: "被弾時、30%の確率で反撃する", mp: 0, passive: { counterChance: 0.3 } },
    },
    7: {
      // 蜻蛉切りがLv5左へ移動したため、剛槍(旧Lv5左)をこちらへ入れ替えた(要確認、詳細はLv5左のコメント参照)
      left: { name: "剛槍", desc: "敵に攻撃すると攻撃力が２ターンの間10%上がる(20%まで蓄積する)", mp: 0, passive: { onHitSelfStackBuff: { stat: "atk", perStack: 0.1, maxStacks: 2, turns: 2 } } },
      right: { name: "城壁の意志", desc: "かばうが成功するとMPが1回復する", mp: 0, passive: { guardMpRefund: true } },
    },
    8: {
      // 鎧砕きはLv5左から移動(内容はそのまま、千人力→剛槍と入れ替え)
      left: { name: "鎧砕き", desc: "攻撃した敵の防御力を2ターン-20%。(40%まで蓄積する)", mp: 0, action: { kind: "damage", mult: 0, inflict: { type: "defDownStack", chance: 1.0, value: 0.2, maxStacks: 2, turns: 2 } } },
      right: { name: "不屈", desc: "状態異常にかかる確率が40%減少する", mp: 0, passive: { statusResistMult: 0.4 } },
    },
    9: {
      left: { name: "槍鬼", desc: "敵を倒すたび攻撃力+12%(最大3回まで重複)", mp: 0, passive: { onKill: { statMult: [{ stat: "atk", mult: 1.12 }], turns: 20, maxStacks: 3 } } },
      right: { name: "鋼の肉体", desc: "HPが50%以下の間、被ダメージ20%減少", mp: 0, passive: { conditionalMod: { cmp: "lte", value: 0.5, dmgTakenMult: 0.80 } } },
    },
    10: {
      left: { name: "天穿槍", desc: "敵単体へ290%ダメージ、防御力45%無視", mp: 5, action: { kind: "damage", mult: 2.9, defPierce: 0.45 } },
      right: { name: "仁王立ち", desc: "5ターンの間、防御力+35%、被ダメージ25%減少、毎ターンHP5%回復", mp: 5, action: { kind: "buffSelf", stats: [{ stat: "def", mult: 1.35 }, { stat: "dmgTaken", mult: 0.75 }], turns: 5, hpRegenPct: 0.05 } },
    },
  },
  naginata: {
    2: {
      left: { name: "舞の型", desc: "薙ぎ払いのMP消費-1", mp: 0, passive: { abilityMpDiscount: { physicalAttackAll: 1 } } },
      right: { name: "足払い", desc: "敵単体へ90%ダメージ、85%の確率でスタン(1ターン)", mp: 2, action: { kind: "damage", mult: 0.9, inflict: { type: "stun", chance: 0.85, turns: 1 } } },
    },
    3: {
      left: { name: "円舞", desc: "薙ぎ払いが命中した敵の数×20%、次の自分のターンまで回避率が上がる", mp: 0, passive: { abilityAoeSelfBuff: { physicalAttackAll: { stat: "evasionAdd", perHitMult: 0.2, turns: 2 } } } },
      right: { name: "崩し", desc: "通常攻撃が命中した敵の防御力を15%下げる(3ターン)", mp: 0, passive: { onHitInflict: { type: "defDown", chance: 0.3, value: 0.15, turns: 3 } } },
    },
    4: {
      left: { name: "旋風薙ぎ", desc: "薙ぎ払いが出血2〜4を付与するようになる", mp: 0, passive: { abilityOnHitInflict: { physicalAttackAll: { type: "bleed", chance: 1.0, valueMin: 2, valueMax: 4 } } } },
      right: { name: "威圧", desc: "通常攻撃が命中した敵の攻撃力を15%下げる(3ターン)", mp: 0, passive: { onHitInflict: { type: "atkDown", chance: 0.3, value: 0.15, turns: 3 } } },
    },
    5: {
      left: { name: "拍子外し", desc: "素早さが下がっている敵への会心率+25%", mp: 0, passive: { debuffCritBonus: { stat: "spd", addRate: 0.25 } } },
      right: { name: "舞姫", desc: "回避に成功すると、次の自分の1ターンだけ回避率+30%", mp: 0, passive: { onEvadeSelfBuff: { stat: "evasionAdd", mult: 0.3 } } },
    },
    6: {
      left: { name: "乱舞", desc: "敵全体へ2連続攻撃(合計130%ダメージ)", mp: 5, action: { kind: "damage", aoe: true, mult: 1.3, hits: 2 } },
      right: { name: "流水", desc: "回避に成功すると、次の自分の1ターンだけ攻撃力+15%", mp: 0, passive: { onEvadeSelfBuff: { stat: "atk", mult: 1.15 } } },
    },
    7: {
      left: { name: "豪舞", desc: "HPが70%以上の間、攻撃力+12%", mp: 0, passive: { conditionalMod: { cmp: "gte", value: 0.7, statMult: [{ stat: "atk", mult: 1.12 }] } } },
      right: { name: "護りの薙刀", desc: "仲間がかばっている間、被ダメージ-10%", mp: 0, passive: { allyGuardDmgTakenMult: 0.9 } },
    },
    8: {
      left: { name: "花吹雪", desc: "敵全体へ150%ダメージ", mp: 6, action: { kind: "damage", aoe: true, mult: 1.5 } },
      right: { name: "乱心", desc: "通常攻撃時、15%の確率で敵をスタンさせる", mp: 0, passive: { onHitInflict: { type: "stun", chance: 0.15, turns: 1 } } },
    },
    9: {
      left: { name: "百花繚乱", desc: "スタン中の敵へのダメージ+20%", mp: 0, passive: { woundBonus: { mult: 1.2, ailment: "stun" } } },
      right: { name: "静寂", desc: "状態異常にかかる確率が35%減少する", mp: 0, passive: { statusResistMult: 0.35 } },
    },
    10: {
      left: { name: "千本桜", desc: "敵全体へ220%ダメージ", mp: 7, action: { kind: "damage", aoe: true, mult: 2.2 } },
      right: { name: "天女の舞", desc: "5ターンの間、味方全体の攻撃力・防御力・素早さ+15%", mp: 6, action: { kind: "buffParty", stats: [{ stat: "atk", mult: 1.15 }, { stat: "def", mult: 1.15 }, { stat: "spd", mult: 1.15 }], turns: 5 } },
    },
  },
  hunter: {
    2: {
      left: { name: "火矢", desc: "攻撃力100%。炎上2を与える。", mp: 1, action: { kind: "damage", mult: 1.0, inflict: { type: "burn", chance: 1, turns: 2 } } },
      right: { name: "急所への一撃", desc: "通常攻撃で65%の確率で出血1〜3を付与", mp: 0, passive: { onHitInflict: { type: "bleed", chance: 0.65, valueMin: 1, valueMax: 3 } } },
    },
    3: {
      // desc変更(スキルエディタの差分反映): 2連続攻撃案を取りやめ、旧・隼落としの飛行ボーナスに再度差し替え
      left: { name: "隼落とし", desc: "飛行を持つ敵へのダメージ+20%", mp: 0, passive: { flyingBonus: { mult: 1.2 } } },
      // desc変更(スキルエディタの差分反映): ダメージ+スタンのアクションから、出血中の敵に狙われた時の
      // 回避率バフ(パッシブ)に全面差し替え
      right: { name: "血痕追跡", desc: "出血状態の敵から攻撃されるとき、回避率が+30%", mp: 0, passive: { evasionVsAilmentAdd: { ailment: "bleed", add: 0.3 } } },
    },
    4: {
      left: { name: "貫き矢", desc: "通常攻撃で敵を倒した時、余ったダメージを残りHPが一番低い別の敵1体に分け与える(貫通は最大2体まで、そこから先には連鎖しない)", mp: 0, passive: { overkillPierce: true } },
      right: { name: "鷹を呼ぶ", desc: "鷹を呼び出し、一緒に戦わせる。鷹の攻撃は敵を出血させる。仲間を守らせることもできる。", mp: 3, action: { kind: "summonHawk", turns: 8 } },
    },
    5: {
      left: { name: "追い討ち", desc: "HPが30%以下の敵への会心率+20%", mp: 0, passive: { executeCritBonus: { belowPct: 0.3, addRate: 0.2, cmp: "lte" } } },
      right: { name: "血管炸裂", desc: "出血中の敵へのダメージが、出血1蓄積しているごとに5%上がる。最大50%", mp: 0, passive: { bleedFollowupOnHit: true } },
    },
    6: {
      // desc変更(スキルエディタの差分反映、要確認): 確定命中ダメージ技から、大技予告中の敵への追加ダメージ(パッシブ)に
      // 全面差し替え。差分にmp指定は無かったが、パッシブは全スキル共通でmp:0のため0に修正した
      left: { name: "必中撃ち", desc: "大技予告中の敵への攻撃ダメージ+30%", mp: 0, passive: { bigAttackPendingDmgBonus: 0.3 } },
      right: { name: "麻痺の矢", desc: "敵単体へ70%ダメージ、95%の確率でスタン", mp: 3, passive: { onHitInflict: { type: "spdDown", chance: 0.25, value: 0.2, turns: 3 } } },
    },
    7: {
      left: { name: "連射の心得", desc: "二連射を使った直後、次の自分の1ターンだけ攻撃力+20%", mp: 0, passive: { comboFollowup: { tag: "rapidFire", stat: "atk", mult: 1.2 } } },
      right: { name: "狩猟本能", desc: "HPが50%以下の敵へのダメージ+25%", mp: 0, passive: { executeBonus: { belowPct: 0.5, mult: 1.25 } } },
    },
    8: {
      left: { name: "急所連撃", desc: "対象の状態異常の種類数に応じてダメージ増(1種につき+10%)", mp: 0, passive: { stackedWoundBonusPerAilment: 0.1 } },
      right: { name: "腐食毒", desc: "通常攻撃が命中した敵の防御力を20%下げる(3ターン)", mp: 0, passive: { onHitInflict: { type: "defDown", chance: 0.2, value: 0.2, turns: 3 } } },
    },
    9: {
      left: { name: "弱者狩り", desc: "攻撃力が下がっている敵への会心率+30%", mp: 0, passive: { debuffCritBonus: { stat: "atk", addRate: 0.3 } } },
      right: { name: "痺れ矢・豪雨", desc: "敵全体に矢の雨を降らせる。命中率95%、命中した敵は90%の確率でスタン", mp: 5, action: { kind: "damage", aoe: true, mult: 0, hitChance: 0.95, inflict: { type: "stun", chance: 0.90, turns: 1 } } },
    },
    10: {
      left: { name: "流星射ち", desc: "敵単体へ290%ダメージ", mp: 7, action: { kind: "damage", mult: 2.9 } },
      right: { name: "狩神の領域", desc: "5ターンの間、素早さ+20%、攻撃力+15%", mp: 6, action: { kind: "buffSelf", stats: [{ stat: "spd", mult: 1.2 }, { stat: "atk", mult: 1.15 }], turns: 5 } },
    },
  },
  gunner: {
    2: {
      left: { name: "土嚢展開", desc: "3ターンの間、自分の防御力+30%。この間は砲撃を使っても装填が発生しない", mp: 0, comboTag: "sandbag", action: { kind: "buffSelf", stats: [{ stat: "def", mult: 1.3 }, { stat: "reloadImmune", mult: 1 }], turns: 3 } },
      right: { name: "榴弾", desc: "敵全体へ65%ダメージ、30%の確率でスタン", mp: 5, action: { kind: "damage", aoe: true, mult: 0.65, inflict: { type: "stun", chance: 0.3, turns: 1 } } },
    },
    3: {
      left: { name: "火薬強化", desc: "装填中、防御力+20%", mp: 0, passive: { flagMod: { flag: "reloading", stat: "def", mult: 1.2 } } },
      right: { name: "爆薬調合", desc: "土嚢展開を使った直後、次の自分の1ターンだけ攻撃力+15%", mp: 0, passive: { comboFollowup: { tag: "sandbag", stat: "atk", mult: 1.15 } } },
    },
    4: {
      left: { name: "貫通弾", desc: "敵単体へ210%ダメージ、防御力25%無視。次の自分のターンは装填で動けない", mp: 4, action: { kind: "damage", mult: 2.1, defPierce: 0.25, selfReload: true } },
      right: { name: "炸裂弾", desc: "敵全体へ100%ダメージ、30%の確率で攻撃力-15%(3ターン)", mp: 5, action: { kind: "damage", aoe: true, mult: 1.0, inflict: { type: "atkDown", chance: 0.3, value: 0.15, turns: 3 } } },
    },
    5: {
      left: { name: "援護砲撃", desc: "仲間がかばっている間、与えるダメージ+12%", mp: 0, passive: { allyGuardDmgMult: 1.12 } },
      right: { name: "焼夷弾", desc: "通常攻撃時、20%の確率で敵を炎上状態にする(3ターン)", mp: 0, passive: { onHitInflict: { type: "burn", chance: 0.2, turns: 3 } } },
    },
    6: {
      left: { name: "装填術", desc: "土嚢展開の間、技のMP消費-30%", mp: 0, passive: { discountWhileFlag: { statModName: "reloadImmune", pct: 0.3 } } },
      right: { name: "爆風拡大", desc: "装填中、素早さ+20%", mp: 0, passive: { flagMod: { flag: "reloading", stat: "spd", mult: 1.2 } } },
    },
    7: {
      left: { name: "会心装填", desc: "会心を出した直後、次の自分の1ターンだけ攻撃力+20%", mp: 0, passive: { onCritSelfBuff: { stat: "atk", mult: 1.2 } } },
      right: { name: "衝撃波", desc: "通常攻撃が命中した敵を15%の確率でスタンさせる(1ターン)", mp: 0, passive: { onHitInflict: { type: "stun", chance: 0.15, turns: 1 } } },
    },
    8: {
      left: { name: "徹甲弾", desc: "敵単体へ220%ダメージ、防御力35%無視", mp: 5, action: { kind: "damage", mult: 2.2, defPierce: 0.35 } },
      right: { name: "一斉砲撃", desc: "敵全体へ190%ダメージ。次の自分のターンは装填で動けない", mp: 6, action: { kind: "damage", aoe: true, mult: 1.9, selfReload: true } },
    },
    9: {
      left: { name: "砲撃術皆伝", desc: "スタン中の敵へのダメージ+20%", mp: 0, passive: { woundBonus: { mult: 1.2, ailment: "stun" } } },
      right: { name: "爆炎支配", desc: "HPが50%以下の敵へのダメージ+25%", mp: 0, passive: { executeBonus: { belowPct: 0.5, mult: 1.25 } } },
    },
    10: {
      left: { name: "神威砲", desc: "敵単体へ340%ダメージ、防御力45%無視", mp: 7, action: { kind: "damage", mult: 3.4, defPierce: 0.45 } },
      right: { name: "天地崩砲", desc: "敵全体へ220%ダメージ、40%の確率で炎上(3ターン)を付与", mp: 7, action: { kind: "damage", aoe: true, mult: 2.2, inflict: { type: "burn", chance: 0.4, turns: 3 } } },
    },
  },
  onmyoji: {
    // ここから9レベルぶん、右側ツリーをスキルエディタの差分反映で「式神」テーマの一続きに全面刷新した
    // (2026-07-25、docs/引き継ぎ_影分身式神.mdへのフィードバックとして受け取った差分)。
    // 左側は2Lの威力調整のみ、3L以降は変更なし
    2: {
      // desc変更(スキルエディタの差分反映): 威力110%→120%
      left: { name: "火遁符", desc: "敵単体へ120%の攻撃。炎上2〜3を付与。", mp: 2, action: { kind: "damage", mult: 1.2, useMag: true, inflict: { type: "burn", chance: 1, turnsMin: 2, turnsMax: 3 } } },
      // 結界術はLv3右から移動(効果を「味方全体def+15%/3ターン」→「味方単体への数値シールド」に全面差し替え、mp4→3)。
      // 「陰陽師の半分のHP」は術者の最大HPの50%と解釈した。既存のbarrierHp(数値シールド)機構をこの技のために新設。
      // 旧結界術が持っていたcomboTag:"kekkai"は、それを参照していた霊脈支配(旧9右)も今回消えるため引き継いでいない
      right: { name: "結界術", desc: "味方一人に結界を付与する。結界は陰陽師の半分のHPのシールドとなり、その数値分敵の攻撃を防ぐ。", mp: 3, action: { kind: "shieldAlly", barrierPct: 0.5 } },
    },
    3: {
      left: { name: "陰陽極意", desc: "全ての技のmp消費をマイナス1する。", mp: 0, passive: { mpDiscountFlat: 1 } },
      // 式神召喚はLv6右から移動(mp6→0)。「式神は回復することができない」はheal処理側にisShikigami除外を追加して対応。
      // 「レベルに応じて召喚できる式型の種類が増える/召喚MPは式神によって変わる」は、2026-07-25に
      // ユーザー提供のイラスト+仕様(紙人形/妖狐/白鶴/狛犬/麒麟/龍神の6種)でSHIKIGAMI_DEFSとして実装済み
      right: { name: "式神召喚", desc: "式神を召喚して戦わせる。式神は回復することができない。レベルに応じて召喚できる式型の種類が増える。召喚MPは式神によって変わり、戦闘終了後も式神は消えない", mp: 0, action: { kind: "summonShikigami" } },
    },
    4: {
      left: { name: "水遁符", desc: "ランダムな敵2体へ75%のダメージと、攻撃力25%減少、素早さ30%減少を２ターン付与する。", mp: 3, action: { kind: "damageRandomMulti", hits: 2, mult: 0.75, useMag: true, inflict: [{ type: "atkDown", chance: 1, value: 0.25, turns: 2 }, { type: "spdDown", chance: 1, value: 0.3, turns: 2 }] } },
      // 新規スキル(旧・衰弱符を置き換え)。以前は「式神帰還でmp+1」が全陰陽師共通の無条件仕様だったが、
      // このスキルを取得した人だけの効果に変更した(engine.js recallShikigami参照)。差分にmp指定は無かったが
      // パッシブは全スキル共通でmp:0のため0とした
      right: { name: "帰還", desc: "式神を帰還させるとmpを1回復する", mp: 0, passive: { onRecallMpRestore: 1 } },
    },
    5: {
      left: { name: "呪符の見切り", desc: "回避に成功すると、次の自分の1ターンだけ術の威力+20%", mp: 0, passive: { onEvadeSelfBuff: { stat: "mag", mult: 1.2 } } },
      // 新規スキル(旧・封魔符を置き換え)。差分にmp指定は無かったが、パッシブは全スキル共通でmp:0のため0とした
      right: { name: "霊魂吸収", desc: "同じ敵に2回連続で通常攻撃するごとに、mpを1回復する。", mp: 0, passive: { onConsecutiveSameTargetMp: 1 } },
    },
    6: {
      left: { name: "陰陽融合", desc: "炎上している敵への魔法ダメージ+15%", mp: 0, passive: { woundBonus: { mult: 1.15, ailment: "burn" } } },
      // 新規スキル(式神召喚が3右へ移動した後の空き枠)
      right: { name: "式神の加護", desc: "式神召喚中は自身がターゲットにされない", mp: 0, passive: { shikigamiProtect: true } },
    },
    7: {
      left: { name: "天地鳴動", desc: "敵全体へ110%の魔法ダメージ", mp: 6, action: { kind: "damage", aoe: true, mult: 1.1, useMag: true } },
      // 新規スキル(旧・厄災を置き換え)
      right: { name: "魂養術", desc: "式神が瀕死になったとき味方全員のHPを10%回復する", mp: 0, passive: { onShikigamiDownPartyHealPct: 0.1 } },
    },
    8: {
      left: { name: "雷遁符", desc: "敵単体へ110%の魔法ダメージ、85%の確率でスタン", mp: 4, action: { kind: "damage", mult: 1.1, useMag: true, inflict: { type: "stun", chance: 0.85, turns: 1 } } },
      // 新規スキル(旧・呪詛を置き換え)。式神召喚(3右)のaction自体にnoCostは付けず、このパッシブを
      // 持っている場合だけbattle.js側でターン消費をスキップするよう分岐した
      right: { name: "神速召喚", desc: "式神を召喚してもターンを消費しない", mp: 0, passive: { noCostSummonShikigami: true } },
    },
    9: {
      left: { name: "衰弱撃ち", desc: "防御力が下がっている敵への会心率+25%", mp: 0, passive: { debuffCritBonus: { stat: "def", addRate: 0.25 } } },
      // 新規スキル(旧・霊脈支配を置き換え)
      right: { name: "憑依", desc: "式神を消滅させ、敵単体の攻撃力を１ターンの間半分にする。", mp: 2, action: { kind: "dismissShikigamiDebuff", value: 0.5, turns: 1 } },
    },
    10: {
      left: { name: "五行滅殺陣", desc: "敵全体へ200%の魔法ダメージ、防御力25%無視", mp: 7, action: { kind: "damage", aoe: true, mult: 2.0, useMag: true, defPierce: 0.25 } },
      right: { name: "黄泉の呪", desc: "敵全体へ80%の魔法ダメージ、60%の確率で防御力-25%(3ターン)", mp: 7, action: { kind: "damage", aoe: true, mult: 0.8, useMag: true, inflict: { type: "defDown", chance: 0.6, value: 0.25, turns: 3 } } },
    },
  },
  priest: {
    2: {
      left: { name: "治癒術", desc: "HPが50%以下の仲間への回復量+20%", mp: 0, passive: { healBonusRule: { trigger: "targetHpBelow", value: 0.5, mult: 1.2 } } },
      right: { name: "祝福", desc: "癒しの祈りを使った直後、次の自分の1ターンだけ防御力+15%", mp: 0, passive: { comboFollowup: { tag: "healPrayer", stat: "def", mult: 1.15 } } },
    },
    3: {
      left: { name: "癒しの祈り", desc: "味方単体のHPを35%回復し、状態異常を解除する", mp: 3, comboTag: "healPrayer", action: { kind: "heal", healPct: 0.35, cleanse: true } },
      right: { name: "神聖加護", desc: "3ターンの間、味方全体の防御力+15%", mp: 4, action: { kind: "buffParty", stats: [{ stat: "def", mult: 1.15 }], turns: 3 } },
    },
    4: {
      left: { name: "生命力循環", desc: "状態異常を治すたび、MPが2回復する", mp: 0, passive: { mpOnCleanse: 2 } },
      right: { name: "浄化", desc: "味方全体の状態異常を解除する", mp: 3, action: { kind: "buffParty", stats: [], turns: 1, cleanse: true } },
    },
    5: {
      left: { name: "慈愛", desc: "状態異常を治した対象への回復量+20%", mp: 0, passive: { healBonusRule: { trigger: "onCleanse", value: 0, mult: 1.2 } } },
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
      left: { name: "生命の奇跡", desc: "HPが20%以下の仲間への回復量+30%(緊急回復)", mp: 0, passive: { healBonusRule: { trigger: "targetHpBelow", value: 0.2, mult: 1.3 } } },
      right: { name: "神威", desc: "4ターンの間、味方全体の攻撃力・防御力+15%", mp: 5, action: { kind: "buffParty", stats: [{ stat: "atk", mult: 1.15 }, { stat: "def", mult: 1.15 }], turns: 4 } },
    },
    9: {
      left: { name: "慈悲の心", desc: "自分のHPが80%以上の間、回復量+15%", mp: 0, passive: { healBonusRule: { trigger: "selfHpAbove", value: 0.8, mult: 1.15 } } },
      right: { name: "退魔", desc: "状態異常にかかる確率が30%減少する", mp: 0, passive: { statusResistMult: 0.3 } },
    },
    10: {
      left: { name: "命の祝福", desc: "味方全体のHPを全回復し、戦闘不能の仲間をHP50%で蘇生する", mp: 8, action: { kind: "heal", aoe: true, healPct: 1.0, reviveHpPct: 0.5, cleanse: true } },
      right: { name: "天恵の祈り", desc: "5ターンの間、味方全体の攻撃力・防御力・素早さ+20%、毎ターンHP8%回復、状態異常無効", mp: 7, action: { kind: "buffParty", stats: [{ stat: "atk", mult: 1.2 }, { stat: "def", mult: 1.2 }, { stat: "spd", mult: 1.2 }], turns: 5, hpRegenPct: 0.08, statusImmuneTurns: 5 } },
    },
  },
};
// 各職業の左/右スキルツリーの通り名。ツリー内のスキル全体の方向性を一語で表したもので、
// スキルツリー画面の上部(系譜の見出し)に表示する
const SKILL_TREE_NAMES = {
  samurai: { left: "剣豪の型", right: "明鏡の型" },
  ninja: { left: "暗殺の型", right: "幻影の型" },
  spearman: { left: "破軍の型", right: "守護の型" },
  naginata: { left: "戦舞の型", right: "制圧の型" },
  hunter: { left: "狙撃の型", right: "狩猟の型" },
  gunner: { left: "徹甲の型", right: "爆炎の型" },
  onmyoji: { left: "五行の型", right: "呪詛の型" },
  priest: { left: "奇跡の型", right: "神恩の型" },
};
const SUPPLY_CAP_BASE = 10; // 支援物資(回復薬+煙玉の合計)は一度の遠征で最大10個まで持てる(鞄屋を建てるとsupplyCap()でこれに加算される)
const TEAHOUSE_POTION_CAP = 3; // 茶屋での回復薬購入だけは、支援物資の共有枠(supplyCap)とは別に3個までに絞る(茶屋固有の在庫制限)。出発準備画面での購入には適用しない(supplyCapのみで制限)

// 神社の奉納祈願: 魂のかけらをこの個数納めるとお守りガチャを1回引ける
const SHRINE_OFFER_SOUL_SHARD_COST = 3;
const ONIBI_SOUL_SHARD_DROP_CHANCE = 0.30; // 鬼火撃破時に魂のかけらをドロップする確率
// 魂の塊: ボス/中ボスを倒した時だけ低確率でドロップする希少素材。神社の「特別祈願」で
// 魂のかけらと一緒に納めると、tier3/4だけの上位抽選(drawOmamoriのminTier引数)を引ける。
// 「深く潜ってボスを狩る理由」を作る意図で導入した(2026-07-17)
const SOUL_LUMP_DROP_CHANCE = 0.25;
const SOUL_LUMP_CAP = 3; // 激レア枠のため所持数もあえて小さく絞る
const SHRINE_SPECIAL_OFFER_LUMP_COST = 1;
const SHRINE_SPECIAL_OFFER_MIN_TIER = 3;
// 温泉の湯守りキャラクター。1日おきにランダムな一言を喋る(renderOnsen参照)
const ONSEN_KEEPER_LINES = [
  "いらっしゃいませ、温泉へようこそ。",
  "ゆっくり浸かって、疲れを癒やしてくださいね。",
  "今日もお湯加減はばっちりですよ。",
  "冷えた体には温泉が一番です。",
  "手ぬぐい、お忘れなく。",
  "のぼせないよう、ほどほどにね。",
  "また会えて嬉しいです。",
  "ここのお湯は肌にいいと評判なんですよ。",
  "ゆっくりしていってくださいね。",
  "疲れた顔をしていますね…どうぞ、こちらへ。",
  "今日は少し熱めにしてあります。",
  "湯上がりには、ぜひお茶をどうぞ。",
  "毎日お湯を張り替えているんですよ。",
  "旅の疲れは、ここで流していってください。",
  "お湯加減、いかがですか？",
  "肩まで浸かると気持ちいいですよ。",
  "今日もいいお天気で、湯気がきれいです。",
  "無理せず、休み休み入ってくださいね。",
  "また来てくれて嬉しいです。",
  "この温泉、実は結構自慢なんです。",
];
// 宿屋の女将キャラクター。温泉と同じく1日おきにランダムな一言を喋る(renderTavern参照)
const TAVERN_KEEPER_LINES = [
  "お帰りなさいませ。",
  "今日も一日お疲れさまでした。",
  "布団はふかふかにしてありますよ。",
  "ゆっくり休んでいってくださいね。",
  "お腹は空いていませんか？",
  "旅の話、また今度聞かせてくださいね。",
  "新しい仲間、探してみませんか？",
  "この宿は居心地がいいでしょう？",
  "無事に帰ってきてくれて安心しました。",
  "明日もいい日になりますように。",
  "お湯もご用意できますよ。",
  "たまにはゆっくり羽を伸ばしてくださいね。",
  "旅支度はお済みですか？",
  "怪我はありませんか？無理は禁物ですよ。",
  "今夜はぐっすり眠れそうですね。",
  "この宿、代々続いているんですよ。",
  "何かお困りごとがあれば言ってくださいね。",
  "仲間が増えると賑やかになりますね。",
  "旅立つ前に、腹ごしらえはいかがですか？",
  "また元気な顔が見られて嬉しいです。",
  "夜風が心地いい季節になりましたね。",
  "遠くまでよく戻ってきましたね。",
  "宿賃は心配なさらず、ゆっくりしてください。",
  "明日に備えて、今日はしっかり休んでね。",
  "旅の疲れ、少しでも取れましたか？",
  "この時間が一番落ち着きます。",
  "布団の準備、いつでもできていますよ。",
  "また賑やかな話、聞かせてくださいね。",
  "皆さんが無事で何よりです。",
  "今日はどんな一日でしたか？",
];
// 温泉の売店の店番キャラクター。温泉・宿屋と同じく1日おきにランダムな一言を喋る(renderOnsenShop参照)
const ONSEN_SHOP_KEEPER_LINES = [
  "買うなら早く。帰るなら静かに。",
  "……見るだけ？",
  "今日も働きたくない。",
  "売り切れです。心も。",
  "その顔、値切る気ですね。",
  "悩む時間も料金に入れたい。",
  "今日は営業してます。奇跡的に。",
  "いらっしゃい。",
  "無理はしない。売上も。",
  "接客は苦手です。",
  "試食はありません。私が食べます。",
  "その目……財布と相談中ですね。",
  "眠いので、おつりは数えてください。",
  "……また来たんですか。",
  "働いてるだけ褒めてください。",
  "特売？気分次第です",
];
const SHRINE_FIRST_VISIT_SOUL_SHARD_GIFT = 3; // 神社を初めて訪れた時にサービスで貰える魂のかけら
// お守りは全20種、tier1〜4。パーティ全体に効くパッシブで、所持数に関わらず最大OMAMORI_EQUIP_MAX個まで同時装備できる。
// 奉納祈願は「まだ持っていないお守りだけ」から重み付き抽選する(重複しない)。
// 重みはtier単位(OMAMORI_TIER_WEIGHTS)をそのtierに属する未所持アイテム数で均等割りして使う
const OMAMORI_EQUIP_MAX = 3;
const OMAMORI_TIER_WEIGHTS = { 1: 50, 2: 30, 3: 10, 4: 5 };
const OMAMORI_TIER_IMAGE = { 1: "assets/items/omamori_t1.png", 2: "assets/items/omamori_t2.png", 3: "assets/items/omamori_t3.png", 4: "assets/items/omamori_t4.png" };
const OMAMORI_LIST = [
  // ---- tier1 ----
  { id: "ebisu", name: "恵比寿神の御守", reading: "えびすがみ", tier: 1, desc: "勝利時10%でボーナスゴールド+30%", effect: { type: "battleWinGoldBonusChance", chance: 0.10, mult: 1.30 } },
  { id: "okuninushi", name: "大国主命の御守", reading: "おおくにぬしのみこと", tier: 1, desc: "戦闘終了後12%でストレスを5回復", effect: { type: "battleEndStressReliefChance", chance: 0.12, amount: 5 } },
  // ---- tier2 ----
  { id: "fukurokuju", name: "福禄寿の御守", reading: "ふくろくじゅ", tier: 2, desc: "探索で「進む」を押すたびに、全員のHPを2回復", effect: { type: "onAdvanceHealAll", amount: 2 } },
  { id: "inari", name: "稲荷大神の御守", reading: "いなりおおかみ", tier: 2, desc: "敵の攻撃を回避する確率が常時+5%", effect: { type: "evasionAddFlat", value: 0.05 } },
  { id: "benzaiten", name: "弁財天の御守", reading: "べんざいてん", tier: 2, desc: "撃破時、低確率でその戦闘のゴールドが2倍になる", effect: { type: "battleWinGoldDoubleChance", chance: 0.10 } },
  { id: "konohanasakuya", name: "木花咲耶姫の御守", reading: "このはなさくやひめ", tier: 2, desc: "回復薬を使っても20%の確率で消費しない", effect: { type: "potionNoConsumeChance", chance: 0.20 } },
  { id: "shinatsuhiko", name: "志那都比古神の御守", reading: "しなつひこのかみ", tier: 2, desc: "煙玉を使っても35%の確率で消費しない", effect: { type: "smokeBombNoConsumeChance", chance: 0.35 } },
  { id: "toyouke", name: "豊受大神の御守", reading: "とようけおおかみ", tier: 2, desc: "温泉たまごの回復量+20%", effect: { type: "onsenEggHealBonus", value: 0.20 } },
  // ---- tier3 ----
  { id: "tsukuyomi", name: "月読命の御守", reading: "つくよみのみこと", tier: 3, desc: "夜の戦闘は開始時60%で先制する", effect: { type: "nightFirstStrikeChance", chance: 0.60 } },
  { id: "takemikazuchi2", name: "武甕槌命の御守", reading: "たけみかづちのみこと", tier: 3, desc: "戦闘中、最初の通常攻撃が確定で会心になる", effect: { type: "firstNormalAttackGuaranteedCrit" } },
  { id: "izanagi", name: "伊邪那岐命の御守", reading: "いざなぎのみこと", tier: 3, desc: "戦闘中最初に受けた状態異常を打ち消す", effect: { type: "firstAilmentReceivedBlocked" } },
  { id: "omononushi", name: "大物主神の御守", reading: "おおものぬしのかみ", tier: 3, desc: "ボスを倒すと必ず魂のかけらを落とす", effect: { type: "bossKillGuaranteedShard" } },
  { id: "fudo", name: "不動明王の御守", reading: "ふどうみょうおう", tier: 3, desc: "スタンさせられた時、防御力が2倍になる", effect: { type: "defDoubleWhileStunned" } },
  { id: "iwanagahime", name: "石長比売の御守", reading: "いわながひめ", tier: 3, desc: "最大HP+5%", effect: { type: "maxHpAddPct", value: 0.05 } },
  // ---- tier4 ----
  { id: "takemikazuchi", name: "建御雷神の御守", reading: "たけみかづちのかみ", tier: 4, desc: "戦闘中、最初の通常攻撃が命中した時に確定でスタンを付与する", effect: { type: "firstNormalAttackHitStun", turns: 1 } },
  { id: "amaterasu", name: "天照大神の御守", reading: "あまてらすおおかみ", tier: 4, desc: "毎回戦闘終了後に、全員のHPを10%回復", effect: { type: "battleEndHealAllPct", pct: 0.10 } },
  { id: "yatagarasu", name: "八咫烏の御守", reading: "やたがらす", tier: 4, desc: "通常攻撃・技の命中率が常時+12%", effect: { type: "accuracyAddFlat", value: 0.12 } },
  { id: "izanami", name: "伊邪那美命の御守", reading: "いざなみのみこと", tier: 4, desc: "戦闘中最初に与える状態異常が+2される", effect: { type: "firstAilmentInflictedBonus", value: 2 } },
  { id: "susanoo", name: "須佐之男命の御守", reading: "すさのおのみこと", tier: 4, desc: "戦闘中、最初に戦闘不能級の一撃を受けた時、誰かがHP1で耐える(パーティ共有、確定)", effect: { type: "firstLethalHitSurviveAt1Shared" } },
  { id: "hachiman", name: "八幡神の御守", reading: "はちまんしん", tier: 4, desc: "戦闘中最初に使う技のMP消費が0", effect: { type: "firstSkillFreeMp" } },
  { id: "sarutahiko", name: "猿田彦神の御守", reading: "さるたひこのかみ", tier: 4, desc: "戦闘開始時確定で、1ターンだけ味方全体の攻撃力+25%・素早さ+25%", effect: { type: "battleStartPartyBuff", stats: [{ stat: "atk", mult: 1.25 }, { stat: "spd", mult: 1.25 }], turns: 1 } },
  { id: "yatanokagami", name: "八咫鏡の御守", reading: "やたのかがみ", tier: 4, desc: "戦闘中、最初に敵が大技を放った時にそれを無効化し、想定ダメージの50%を反射する", effect: { type: "firstBigAttackReflect", pct: 0.50 } },
  { id: "amenominakanushi", name: "天之御中主神の御守", reading: "あめのみなかぬしのかみ", tier: 4, desc: "毎戦闘終了後にMP1回復", effect: { type: "battleEndRestoreMp", amount: 1 } },
  { id: "bishamonten", name: "毘沙門天の御守", reading: "びしゃもんてん", tier: 4, desc: "戦闘開始時、ランダムな味方一人に次の攻撃を完全に無効化するバリアを張る", effect: { type: "battleStartRandomAllyBarrier" } },
  { id: "kannon", name: "観音菩薩の御守", reading: "かんのんぼさつ", tier: 4, desc: "回復薬による回復効果+30%", effect: { type: "potionHealBonus", value: 0.30 } },
];
function omamoriById(id) { return OMAMORI_LIST.find((o) => o.id === id); }
// 未所持のお守りだけからtier重み付きで1つ抽選する(全て所持済みならnullを返す)。
// minTierを指定すると、それ未満のtierを候補から除外した上で(既存の重み比率のまま)抽選する
// (神社の特別祈願=魂の塊を使った上位ガチャで、tier3/4のみを引かせるために使う)
function drawOmamori(ownedIds, minTier) {
  const unowned = OMAMORI_LIST.filter((o) => !ownedIds.includes(o.id) && (!minTier || o.tier >= minTier));
  if (unowned.length === 0) return null;
  const tierCounts = {};
  unowned.forEach((o) => { tierCounts[o.tier] = (tierCounts[o.tier] || 0) + 1; });
  const weighted = unowned.map((o) => ({ o, w: OMAMORI_TIER_WEIGHTS[o.tier] / tierCounts[o.tier] }));
  const total = weighted.reduce((sum, x) => sum + x.w, 0);
  let roll = Math.random() * total;
  for (const x of weighted) {
    roll -= x.w;
    if (roll < 0) return x.o;
  }
  return weighted[weighted.length - 1].o;
}

// 狩人スキル「鷹を呼ぶ」関連の数値
const HAWK_FOLLOWUP_ATK_MULT = 0.35; // 鷹の追撃威力(狩人の攻撃力に対する割合)
const HAWK_FOLLOWUP_BLEED_CHANCE = 1.0; // 鷹の追撃が出血を付与する確率(ユーザー指示で100%に変更)
const HAWK_GUARD_MP_COST = 0; // 「味方を守れ」のMP消費(ユーザー指示で無料に変更)

// 職業ごとの武器/防具。各5段階(Lv1/3/5/7/9で解禁、レベルが2上がるごとに上位種が出る)。
// 上位を買うと下位から乗り換わる(加算ではなく差し替え)。「そのレベルに到達した仲間が1人でもいるか」で解禁判定する。
// 購入すると同じ職業の全メンバーに恒久的なステータスが乗る。個別の装備の付け外しは無く、
// 「その職業への投資」として一度買えば以後ずっと有効(ウィザードリィ的な個別装備管理はMVPとして省略)。
// 最上位(Lv9)の数値は、そのステータスがレベル1→10のレベルアップだけで伸びる量のおよそ半分になるよう調整してある
// (例: 侍はレベルアップだけで攻撃力+13伸びるので、武器の最終段階は+7程度に抑え、装備がレベルアップの主役を
// 食ってしまわないようにした)。防具(防御力)は元々のレベル成長自体が緩やかなため、最終段階は小さい値になる。
// mats: 素材要求 { 素材id: 個数 }(素材経済フェーズ1、2026-07-27)。ゴールドに加えて素材も揃わないと購入できない。
// 素材の種類は装備の材質準拠(刀=鉄、槍=鉄+木、弓=木、御幣=木+骨、具足=鉄+皮、装束=皮…)、
// 個数は武器3/防具3を起点に段階ごと×1.5複利(合計6→9→14→21個)。表と経緯はユーザー確定(2026-07-27)
function tier(name, statKey, bonus, price, level, mats) {
  return { name, statKey, bonus, price, level, mats: mats || {} };
}
// 甲冑ボーナス(def)は「被ダメ軽減%への直接加算」に全面刷新(旧: 職業ごとにバラバラな数値だった
// defの加算量を、全職業共通でtier1〜5=+2/+4/+6/+8/+10%に統一した。装備を多く積むほどタンク職
// だけ有利になっていく問題を避けるため、職業間の差は基礎%(CLASSES側)のみで表現する。価格は据え置き)
// ゴールドの改定(2026-07-27素材経済フェーズ1): 武器1は値下げ(侍/忍/槍/薙/狩40→20、僧45→25、砲55→30、陰60→35。
// 素材1個が付いた分、入門装備は気軽に買える価格へ)。防具1は全職10Gに統一、防具3以降は同段階の武器価格の80%(5G丸め)に
// 引き上げ(旧価格は武器に比べて安すぎたため)。武器3以降のゴールドは従来のまま
const EQUIPMENT = {
  samurai: {
    weapon: [tier("業物の刀", "atk", 2, 20, 1, { ki: 1 }), tier("業物の太刀", "atk", 4, 90, 3, { tetsu: 6 }), tier("妖刀", "atk", 5, 125, 5, { tetsu: 9 }), tier("鬼哭の刀", "atk", 6, 160, 7, { tetsu: 14 }), tier("伝説の名刀", "atk", 7, 200, 9, { tetsu: 21 })],
    armor: [tier("当世具足", "def", 2, 10, 1, { kawa: 1 }), tier("強化当世具足", "def", 4, 70, 3, { tetsu: 3, kawa: 3 }), tier("上級当世具足", "def", 6, 100, 5, { tetsu: 4, kawa: 5 }), tier("鬼哭の甲冑", "def", 8, 130, 7, { tetsu: 6, kawa: 8 }), tier("伝説の甲冑", "def", 10, 160, 9, { tetsu: 10, kawa: 11 })],
  },
  ninja: {
    weapon: [tier("業物の苦無", "atk", 2, 20, 1, { ki: 1 }), tier("改良苦無", "atk", 4, 90, 3, { tetsu: 6 }), tier("影の苦無", "atk", 5, 120, 5, { tetsu: 9 }), tier("月影の苦無", "atk", 6, 160, 7, { tetsu: 14 }), tier("暁の苦無", "atk", 7, 195, 9, { tetsu: 21 })],
    armor: [tier("強化忍び装束", "def", 2, 10, 1, { kawa: 1 }), tier("精鋭忍び装束", "def", 4, 70, 3, { kawa: 6 }), tier("上級忍び装束", "def", 6, 95, 5, { kawa: 9 }), tier("月影の装束", "def", 8, 130, 7, { kawa: 14 }), tier("暁の装束", "def", 10, 155, 9, { kawa: 21 })],
  },
  spearman: {
    weapon: [tier("鍛えの槍", "atk", 2, 20, 1, { ki: 1 }), tier("業物の槍", "atk", 3, 70, 3, { tetsu: 3, ki: 3 }), tier("十文字槍", "atk", 4, 100, 5, { tetsu: 5, ki: 4 }), tier("鬼殺しの槍", "atk", 5, 130, 7, { tetsu: 8, ki: 6 }), tier("伝説の大槍", "atk", 6, 170, 9, { tetsu: 12, ki: 9 })],
    armor: [tier("鉄の大盾", "def", 2, 10, 1, { kawa: 1 }), tier("業物の大盾", "def", 4, 55, 3, { tetsu: 4, kawa: 2 }), tier("強化大盾", "def", 6, 80, 5, { tetsu: 5, kawa: 4 }), tier("鬼殺しの大盾", "def", 8, 105, 7, { tetsu: 8, kawa: 6 }), tier("伝説の盾", "def", 10, 135, 9, { tetsu: 12, kawa: 9 })],
  },
  naginata: {
    weapon: [tier("鍛えの薙刀", "atk", 2, 20, 1, { ki: 1 }), tier("業物の薙刀", "atk", 3, 65, 3, { tetsu: 3, ki: 3 }), tier("大薙刀", "atk", 4, 90, 5, { tetsu: 5, ki: 4 }), tier("巴形の薙刀", "atk", 5, 120, 7, { tetsu: 8, ki: 6 }), tier("伝説の薙刀", "atk", 6, 155, 9, { tetsu: 12, ki: 9 })],
    armor: [tier("強化白鉢巻", "def", 2, 10, 1, { kawa: 1 }), tier("強化具足", "def", 4, 50, 3, { kawa: 4, tetsu: 2 }), tier("上級具足", "def", 6, 70, 5, { kawa: 6, tetsu: 3 }), tier("巴形の装束", "def", 8, 95, 7, { kawa: 9, tetsu: 5 }), tier("伝説の巫女装束", "def", 10, 125, 9, { kawa: 14, tetsu: 7 })],
  },
  hunter: {
    weapon: [tier("鍛えの弓", "atk", 2, 20, 1, { ki: 1 }), tier("業物の弓", "atk", 3, 70, 3, { ki: 6 }), tier("強弓", "atk", 4, 100, 5, { ki: 9 }), tier("鬼哭の弓", "atk", 5, 130, 7, { ki: 14 }), tier("伝説の弓", "atk", 6, 170, 9, { ki: 21 })],
    armor: [tier("強化猟師装束", "def", 2, 10, 1, { kawa: 1 }), tier("精鋭猟師装束", "def", 4, 55, 3, { kawa: 6 }), tier("上級猟師装束", "def", 6, 80, 5, { kawa: 9 }), tier("鬼哭の猟師装束", "def", 8, 105, 7, { kawa: 14 }), tier("伝説の猟師装束", "def", 10, 135, 9, { kawa: 21 })],
  },
  gunner: {
    weapon: [tier("鍛えの火縄銃", "atk", 3, 30, 1, { ki: 1 }), tier("業物の火縄銃", "atk", 4, 85, 3, { tetsu: 4, ki: 2 }), tier("上級火縄銃", "atk", 6, 135, 5, { tetsu: 6, ki: 3 }), tier("雷神の大筒", "atk", 7, 170, 7, { tetsu: 10, ki: 4 }), tier("伝説の大筒", "atk", 8, 205, 9, { tetsu: 15, ki: 6 })],
    armor: [tier("強化胴当て", "def", 2, 10, 1, { kawa: 1 }), tier("精鋭胴当て", "def", 4, 70, 3, { tetsu: 3, kawa: 3 }), tier("上級胴当て", "def", 6, 110, 5, { tetsu: 4, kawa: 5 }), tier("雷神の胴当て", "def", 8, 135, 7, { tetsu: 6, kawa: 8 }), tier("伝説の胴当て", "def", 10, 165, 9, { tetsu: 9, kawa: 12 })],
  },
  onmyoji: {
    weapon: [tier("式神の御幣", "mag", 3, 35, 1, { ki: 1 }), tier("精霊の御幣", "mag", 5, 110, 3, { ki: 3, hone: 3 }), tier("上級御幣", "mag", 6, 140, 5, { ki: 5, hone: 4 }), tier("秘伝の御幣", "mag", 8, 205, 7, { ki: 7, hone: 7 }), tier("大陰陽の御幣", "mag", 9, 245, 9, { ki: 11, hone: 10 })],
    armor: [tier("浄衣", "def", 2, 10, 1, { kawa: 1 }), tier("精霊の浄衣", "def", 4, 90, 3, { kawa: 4 }), tier("上級浄衣", "def", 6, 110, 5, { kawa: 6 }), tier("秘伝の浄衣", "def", 8, 165, 7, { kawa: 9 }), tier("大陰陽の浄衣", "def", 10, 195, 9, { kawa: 14 })],
  },
  priest: {
    weapon: [tier("聖なる錫杖", "mag", 2, 25, 1, { ki: 1 }), tier("高僧の錫杖", "mag", 4, 100, 3, { tetsu: 3, ki: 3 }), tier("大僧正の錫杖", "mag", 5, 135, 5, { tetsu: 4, ki: 5 }), tier("悟りの錫杖", "mag", 6, 170, 7, { tetsu: 6, ki: 8 }), tier("神託の錫杖", "mag", 7, 215, 9, { tetsu: 10, ki: 11 })],
    armor: [tier("法衣", "def", 2, 10, 1, { kawa: 1 }), tier("高僧の法衣", "def", 4, 80, 3, { kawa: 4 }), tier("大僧正の法衣", "def", 6, 110, 5, { kawa: 6 }), tier("悟りの法衣", "def", 8, 135, 7, { kawa: 9 }), tier("神託の法衣", "def", 10, 170, 9, { kawa: 14 })],
  },
};

// 重み(weight)の合計を100として、そこからランダムに1つ選ぶ共通ヘルパー(宿泊/野営の演出キャプションで使う)
function pickWeightedMessage(list) {
  const total = list.reduce((sum, m) => sum + m.weight, 0);
  let roll = Math.random() * total;
  for (const m of list) {
    roll -= m.weight;
    if (roll < 0) return m.text;
  }
  return list[0].text;
}
// 宿泊時の演出キャプション。重み(weight)の合計が出現率(%)になる
const LODGING_NIGHT_MESSAGES = [
  { text: "ぐっすり眠った", weight: 50 },
  { text: "しっかり体を休めた", weight: 20 },
  { text: "朝まで休んだ", weight: 10 },
  { text: "お腹いっぱい食べた", weight: 5 },
  { text: "ささいな宴を楽しんだ", weight: 5 },
  { text: "虫の声を聞きながら眠った", weight: 3 },
  { text: "故郷に想いを馳せた", weight: 2 },
  { text: "仲間と語り合った", weight: 2 },
  { text: "月を見ながら眠りについた", weight: 2 },
  { text: "星を眺めて語り合った", weight: 1 },
];
function pickLodgingNightMessage() {
  return pickWeightedMessage(LODGING_NIGHT_MESSAGES);
}
// 野営時の演出キャプション
const CAMP_NIGHT_MESSAGES = [
  { text: "ぐっすり眠った", weight: 24 },
  { text: "星が綺麗だった", weight: 20 },
  { text: "明日に備えて眠った", weight: 20 },
  { text: "月がよく見える夜だった", weight: 15 },
  { text: "焚き火を絶やさず眠った", weight: 10 },
  { text: "虫の声が心地よかった", weight: 5 },
  { text: "深い眠りについた", weight: 5 },
  { text: "遠くで狼の声が聞こえた", weight: 1 },
];
function pickCampNightMessage() {
  return pickWeightedMessage(CAMP_NIGHT_MESSAGES);
}

// 式神の種類データ(2026-07-25、ユーザー提供のイラスト+仕様をもとに実装)。
// unlockLevel: 陰陽師本人のキャラクターレベルがこの値に達すると式神召喚の選択肢に加わる
// (紙人形だけは式神召喚を習得した時点で最初から選べるためnull)。
// mp: そのタイプを選んで召喚する時に陰陽師本人が消費するMP(式神召喚スキル自体のmpは0で固定、
// 実際のコストは選んだ式神の種類ごとにここで個別に持たせる=「召喚MPは式神によって変わる」という仕様のため)。
// hp/atk/spdの各Fromは術者(陰陽師本人)の現在ステータスを基準にした相対値として設計してある。
// ai/basicHits/special/onSummon/turnRegenPctの意味はengine.jsのresolveShikigamiAction参照
// 同レベル帯の指定職業(生まれ持った基礎atk×レベル成長率、engine.jsのlevelUpと同じ式)の攻撃力を返す。
// 式神の攻撃力は陰陽師本人のmagを直接参照すると魔力が高すぎて破綻する(ユーザー指摘)ため、
// 全タイプこの「他職業の同レベル帯攻撃力を基準にした相対値」で統一してある(紙人形だけは例外的に
// 陰陽師本人のatkを直接使う、これは指定通り)
function sameLevelClassAtk(classId, level) {
  return Math.round(CLASSES[classId].atk * (1 + (level - 1) * 0.075));
}
const SHIKIGAMI_DEFS = {
  kamiNingyo: {
    name: "紙人形", emoji: "📜", iconImg: "assets/icons/shikigami/kamiNingyo.png", unlockLevel: null, mp: 2,
    hpFrom: (owner) => Math.round(owner.maxHp * 0.75),
    atkFrom: (owner) => owner.atk,
    spdFrom: (owner) => Math.round(CLASSES.hunter.spd * (1 + owner.level * 0.05)),
    ai: "guardIfAllyLow", // 味方にHP50%未満がいれば庇う(guarding=true)、いなければ通常攻撃
  },
  youko: {
    name: "妖狐", emoji: "🦊", iconImg: "assets/icons/shikigami/youko.png", unlockLevel: 2, mp: 3,
    hpFrom: (owner) => owner.maxHp,
    atkFrom: (owner) => sameLevelClassAtk("hunter", owner.level) - 2,
    spdFrom: (owner) => Math.round(CLASSES.ninja.spd * (1 + owner.level * 0.05)),
    special: { cooldown: 4, kind: "singleAttack", mult: 1.0, inflict: { type: "burn", turns: 2 }, name: "狐火" },
  },
  hakuzuru: {
    name: "白鶴", emoji: "🕊️", iconImg: "assets/icons/shikigami/hakuzuru.png", unlockLevel: 4, mp: 5, isFlying: true,
    hpFrom: (owner) => owner.maxHp,
    atkFrom: (owner) => sameLevelClassAtk("hunter", owner.level) - 3,
    spdFrom: (owner) => Math.round(owner.spd * 0.85),
    special: { cooldown: 4, kind: "healLowestAllyIfBelow", healPct: 0.4, allyHpBelowPct: 0.5, name: "癒しの舞" },
  },
  komainu: {
    name: "狛犬", emoji: "🐕", iconImg: "assets/icons/shikigami/komainu.png", unlockLevel: 5, mp: 6,
    hpFrom: (owner) => owner.maxHp + 10,
    atkFrom: (owner) => sameLevelClassAtk("hunter", owner.level) - 1,
    spdFrom: (owner) => Math.round(owner.spd * 1.15),
    basicHits: 2, // 通常攻撃がランダムな敵2体への連撃になる(1体に2連続の場合もある)
    special: { cooldown: 4, kind: "shieldLowestAllyIfBelow", barrierPct: 0.5, allyHpBelowPct: 0.3, name: "護りの結界" },
  },
  kirin: {
    name: "麒麟", emoji: "🦄", iconImg: "assets/icons/shikigami/kirin.png", unlockLevel: 7, mp: 7,
    hpFrom: (owner) => owner.maxHp + 10,
    atkFrom: (owner) => sameLevelClassAtk("samurai", owner.level) - 1,
    spdFrom: (owner) => Math.round(CLASSES.hunter.spd * (1 + owner.level * 0.05)),
    onSummon: { kind: "aoeAttack", mult: 0.3, stunChance: 0.35, name: "麒麟の一喝" },
    special: { cooldown: 5, kind: "stunSingleAttack", mult: 1.0, name: "破魔の蹄" },
  },
  ryujin: {
    name: "龍神", emoji: "🐉", iconImg: "assets/icons/shikigami/ryujin.png", unlockLevel: 9, mp: 9, isFlying: true,
    hpFrom: (owner) => owner.maxHp + 20,
    atkFrom: (owner) => sameLevelClassAtk("spearman", owner.level),
    spdFrom: (owner) => owner.spd,
    onSummon: { kind: "partySpdBuff", mult: 0.3, turns: 2, name: "龍神の加護" },
    special: { cooldown: 4, kind: "aoeSilence", mult: 0.3, turns: 1, name: "龍の咆哮" },
    turnRegenPct: 0.03,
  },
};

// 温泉に入るとランダムで1つ付与されるバフ。次の遠征中だけ効果があり、野営するか町へ戻ると消える
// (character.onsenBuffKeyにkeyを保存する。効果の実適用はengine.js側の各所で判定している)
const ONSEN_BUFFS = [
  { key: "pokapoka", name: "ぽかぽか", desc: "最大HP+7%" },
  { key: "kekkou", name: "血行促進", desc: "攻撃力+5%" },
  { key: "yuagari", name: "湯上がり", desc: "素早さ+5%" },
  { key: "kibunsoukai", name: "気分爽快", desc: "会心率+5%" },
  { key: "touji", name: "湯治", desc: "毎ターンHP2%回復" },
  { key: "bihada", name: "美肌", desc: "状態異常耐性+20%" },
  { key: "fukumaneki", name: "福招き", desc: "獲得銭+10%" },
  { key: "eikijuten", name: "英気充填", desc: "MP消費-10%" },
  { key: "yuami", name: "湯浴み", desc: "HP回復効果+15%" },
];
function pickOnsenBuff() {
  return ONSEN_BUFFS[Math.floor(Math.random() * ONSEN_BUFFS.length)].key;
}
function onsenBuffName(key) {
  const b = ONSEN_BUFFS.find((x) => x.key === key);
  return b ? b.name : "";
}

const FATIGUE_PER_FLOOR = 1; // フィールドに出ているキャラが1階進むごとに溜まる疲労度(階層1.5倍化に伴い2→1。1遠征あたりの総量は従来の75%で少し楽になる)
const FATIGUE_PER_FLOOR_RETREAT = 0.5; // 帰還中も1階ごとに疲労を溜める(往路の半分。ユーザー指示で0→0.5に変更)
// 戦闘から逃げ延びるとストレスが溜まる。「進む→戦闘が出たら即逃げる」を繰り返すだけで
// レベルに関係なく無限に深く潜れてしまう抜け道への対策(繰り返すほどストレスが蓄積し、
// いずれ大きく弱体化して無傷では続けられなくする)
const FLEE_STRESS_PENALTY = 5;
const FATIGUE_MAX = 100;

// 温泉: 宿屋では抜けなくなった疲労度を回復するための有料施設。1回で半分(50)回復する。
// 料金はレベル1で20G、以降レベルごとに7Gずつ上がる。入浴すると翌朝(早朝4:30)まで
// パーティ編成に組み込めなくなる(宿泊は引き続き可能)。
// 同じ4人を毎回温泉で全回復させて回し続けられてしまい、控えメンバーを使う理由が無くなっていた
// (ユーザー指摘)ため、ロックを2時間の固定時間から「翌朝まで」に延長し、控えを併用しないと
// 運用が回らないようにした(具体的な計算はstate.jsのnextMorningAbsoluteMinutes参照)
const ONSEN_FATIGUE_RELIEF = 50;
const HOT_SPRING_KEEPER_FATIGUE_RELIEF = 65; // 湯守屋を建てると回復量が50→65に上がる(2026-07-28ユーザー改定70→65)
const ONSEN_FLAT_COST = 15;
const ONSEN_COST_PER_LEVEL = 7;
// 宿屋の宿泊はHP/MP全回復に加えて、ストレスも少量(10)回復する
const LODGE_FATIGUE_RELIEF = 10;

// 敵のhp/atk/defはENEMIES側に「実戦でそのまま使う最終値」として直接書かれている(旧:
// ENEMY_SCALE/ENEMY_ATK_MULT/ENEMY_HP_MULT/ENEMY_SWARM_ATK_MULT/ENEMY_DEF_SCALEという
// 複数の倍率を生値に掛けて実戦値を算出していたが、防御力を%直接方式に刷新したのに合わせて
// 攻撃力・HPも同じくWYSIWYGな最終値に統一し、これらの倍率は全廃止した)
const MAX_LEVEL = 10; // レベル上限。ダクソン/XCOM的に「少ないレベルで大きく強くなる」設計のため低めに圧縮
// 大群系が絡んだ遭遇になる確率(1回の遭遇につき1回だけ判定する)。毎回出るとうざいので控えめにしてある
const SWARM_ENCOUNTER_CHANCE = 0.15;

// 炎上(毒とは別系統のDOT): 毒が固定ダメージ+蓄積減衰なのに対し、炎上は最大HPの割合ダメージ+ターン数固定(減衰なし)。
// 低HPの相手には毒が、高HPのタンクには炎上がよく効く、という住み分けを狙っている(陰陽師/砲術士の専売)
const BURN_DAMAGE_PCT = 0.08;

// 命中率/回避率。素早い敵ほど回避率が上がり「攻撃をかわしてくる緊張感」を出すが、
// かわし過ぎてストレスにならないよう回避率に上限(EVASION_MAX)を、命中率に下限(MIN_HIT_CHANCE)を設けている。
// 狩人だけCLASSESのaccuracyが高いので、同じ相手でも狩人は他職業よりずっと当てやすい
const BASE_ACCURACY = 0.95;
const EVASION_SPD_BASELINE = 6; // この素早さ以下ならほぼ回避してこない
const EVASION_SPD_FACTOR = 0.012; // 素早さ1につき回避率+1.2%
const EVASION_MAX = 0.18;
const MIN_HIT_CHANCE = 0.75;

// スタンを受けると、その後STUN_RESIST_TURNSターンの間だけスタン確率がSTUN_RESIST_MULT倍に
// 大幅ダウンする(通常のstatusResistMultとは別枠)。連続でスタンされ続ける「スタンロック」を
// 防ぐための措置。プレイヤー/敵どちらにも同じルールを適用する
const STUN_RESIST_TURNS = 3;
const STUN_RESIST_MULT = 0.2;

// 敵の「大技」システム: 各敵はbigAttackCountdown(残りターン数)を持ち、残り1で予告(このターンは
// 通常攻撃のまま)→残り0で大技発動、を繰り返す(engine.jsのrollBigAttackCountdown参照)。
// 間隔は敵ごとにENEMIES[id].bigAttackCycle: {min, max, instant}で個別指定でき(enemy_editor.htmlで編集可、
// 2026-07-28にavg±variance方式から最短〜最長の範囲方式へ変更=「5〜7ターンおき」のような指定が可能。
// 旧avg±variance形式もengine.js側で読める後方互換あり)。未設定の敵はBIG_ATTACK_CYCLE_LENGTHの固定間隔。
// 複数体が同時に予告/発動しないよう、戦闘開始時に各敵の初期位相をランダムにずらしている。
// 威力・デバフの中身は敵ごとにENEMIES[id].bigAttackで個別設計する(全103体に設定済み、
// 汎用フォールバックは廃止した。2026-07-19)
const BIG_ATTACK_CYCLE_LENGTH = 4;
const BIG_ATTACK_DOT_REDUCTION = 0.15; // 敵が毒/炎上状態の間、大技の威力をさらに下げる(削る対抗策)
const BIG_ATTACK_EXPOSED_BONUS = 1.2; // 予告中(bigAttackPending)の敵へは、プレイヤーの与ダメージが増える(押し切る対抗策)

// 奉行所: 序盤(floor1-12)の10種の敵をそれぞれ討伐対象にした依頼。全部を一度に張り出さず、
// QUEST_BOARD_SIZE枚だけを毎日ランダムに選んで張り替える(indexHtml側のrefreshMagistrateQuestsIfNeeded参照)。
// 受注制(同時に1件まで)。受注すると、深淵の森でtargetFloorに到達した時にcount体の群れが確定出現し、
// 倒すと即達成→報酬(帰還後のリザルト画面に表示)、というモンハンの緊急依頼のような1本道の設計にしてある
// rewardMaterials: 固定報酬素材 { 素材id: 個数 }(任意、未設定/空なら素材報酬なし)。ゴールド報酬に
// 上乗せでstate.materialsへ加算される(battle.js victory()参照)。値は奉行所エディタ(quest_editor.html)で編集する
const QUEST_DEFS = {
  yaken: { emoji: "🐺", requester: "街道番・源蔵", title: "野犬どもを追い払え！", text: "街道を野犬の群れがうろつき、旅人が通れなくなっています。被害が広がる前に追い払ってください。", targetFloor: 5, count: 2, tier: 1, rewardGold: 30 },
  // 大猪は中ボス級のため、奉行所の依頼を最低3回達成するまで張り出されない(minQuestClears、refreshMagistrateQuestsIfNeeded参照)
  inoshishi: { emoji: "🐗", requester: "農家・徳兵衛", title: "大猪の討伐", text: "山から現れた大きな猪が畑を荒らし回っています。このままでは収穫が望めません。どうか討伐をお願いします。", targetFloor: 8, count: 1, spawnId: "oo_inoshishi", chaseText: "大猪が追いかけてきた！", rewardGold: 70, tier: 1, minQuestClears: 3 },
  dokuhebi: { emoji: "🐍", requester: "水番・お咲", title: "水場に潜む毒", text: "村の水場に大きな毒蛇が棲みつきました。子どもたちも近寄れず困っています。退治をお願いします。", targetFloor: 8, count: 2, tier: 1 },
  oogumo: { emoji: "🕷", requester: "旅籠主人・宗吉", title: "糸に閉ざされた古道", text: "山道一面が蜘蛛の巣で覆われ、人が通れなくなりました。巣の主を退治してください。", targetFloor: 9, count: 1, tier: 1 },
  kodama: { emoji: "🌳", requester: "山守・弥助", title: "森の異変", text: "最近、森へ入った者が何人も襲われています。木が動いたと言う者もいますが、本当かどうかは分かりません…。原因を突き止めてください。", targetFloor: 6, count: 2, tier: 1 },
  kappa: { emoji: "🐢", requester: "漁師・浜吉", title: "川辺の怪", text: "川へ近づく者が何者かに水へ引きずり込まれそうになっています。姿を見た者はおらず、皆おびえています。", targetFloor: 8, count: 1, tier: 1 },
  hitotsume_kozo: { emoji: "👁", requester: "寺子屋師匠・文左衛門", title: "夜道の怪影", text: "子どもたちが「大きな目玉の化け物を見た」と泣きながら帰ってきます。本当にいるのか確かめていただけませんか。", targetFloor: 9, count: 2, tier: 1 },
  bake_danuki: { emoji: "🦝", requester: "旅商人・喜兵衛", title: "消えない山道", text: "山道で何度歩いても同じ場所へ戻ってしまいます。何かに化かされているとしか思えません…。", targetFloor: 11, count: 1, tier: 1 },
  onibi: { emoji: "🔥", requester: "墓守・源次", title: "夜に漂う青い火", text: "夜になると青白い火が現れ、人々は誰も近づけません。あれが何なのか調べてください。", targetFloor: 9, count: 3, tier: 1 },
  kamaitachi: { emoji: "🦦", requester: "木こり・新八", title: "風が人を斬る", text: "山へ入ると、突然体中に切り傷ができます。誰も姿を見た者はいません。どうか原因を突き止めてください。", targetFloor: 12, count: 2, tier: 1 },
  // ボス級の指名討伐4種。大猪(inoshishi)を一度でも討伐していないと奉行所の張り出しに出てこない
  // (requiresOoInoshishi、refreshMagistrateQuestsIfNeeded参照)。旧・自動発生する「緊急依頼」システムを
  // 廃止し、他の依頼と全く同じ受注制(受注→targetFloorで確定出現→討伐→リザルトで報酬)に統一した
  q_arakuma: { emoji: "🐻", requester: "街道番・源蔵", title: "緊急依頼『森の主』", text: "山へ向かった者が誰一人戻ってきません。現場には巨大な爪痕と足跡だけが残されていました。あれは普通の熊ではありません。どうか森の主を討ち倒してください。", targetFloor: 11, count: 1, chaseText: "荒熊が追いかけてきた！", rewardGold: 150, tier: 1, requiresOoInoshishi: true },
  q_daija: { emoji: "🐍", requester: "庄屋・善兵衛", title: "緊急依頼『川を塞ぐ影』", text: "川へ近づいた者が次々と姿を消しています。生き残った者は巨大な蛇を見たと震えています。村へ現れる前に討伐してください。奉行所より緊急依頼です。", targetFloor: 12, count: 1, chaseText: "大蛇が追いかけてきた！", rewardGold: 150, tier: 1, requiresOoInoshishi: true },
  q_oni: { emoji: "👹", requester: "山番・五郎", title: "緊急依頼『山に棲む怪物』", text: "山小屋が跡形もなく壊されていました。人の仕業とは思えない力です。このままでは村まで被害が及びます。どうか討伐をお願いします。", targetFloor: 14, count: 1, chaseText: "鬼が追いかけてきた！", rewardGold: 150, tier: 1, requiresOoInoshishi: true },
  q_gashadokuro: { emoji: "💀", requester: "墓守・源次", title: "緊急依頼『夜鳴きの怪』", text: "夜になると山奥から骨の軋む音が聞こえます。音を追った者は誰一人帰ってきません。正体は誰にも分かりません。どうかこの怪異を止めてください。", targetFloor: 15, count: 1, chaseText: "がしゃどくろが追いかけてきた！", rewardGold: 150, tier: 1, requiresOoInoshishi: true },
  // ★2(中盤floor9-29の10種)。報酬はquestGoldReward()の式(targetFloor×QUEST_GOLD_PER_FLOOR×QUEST_REWARD_MULT)
  // にそのまま乗るため、★1より深いtargetFloorを設定するだけで自動的に報酬・契約金も高くなる
  ochimusha: { emoji: "🥷", requester: "旅籠「松風屋」主人・徳兵衛", title: "彷徨う鎧武者", text: "日が暮れるたび、あの鎧武者が街道に現れるんです…。旅人も寄り付かず、このままじゃ店を畳むしかありません。村の者も皆おびえております。どうか、あいつを止めてください。", targetFloor: 18, count: 2, tier: 2 },
  kamaitachi2: { emoji: "🦦", requester: "薪拾い・権次", title: "風より速き影", text: "山へ入るたび、身体中が切り傷だらけになるんです。姿は見えねぇのに風だけが吹き抜ける…。もう年寄りには敵いません。村の暮らしも立ちゆきません。頼みます。", targetFloor: 21, count: 1, tier: 2 },
  youko: { emoji: "🦊", requester: "庄屋・甚兵衛", title: "化け狐の誘い", text: "村の若い衆が狐火に誘われ、夜な夜な山へ消えてしまうのです。笑って帰る者もおれば、戻らぬ者もおります…。これ以上犠牲者は出したくありませぬ。どうか助けてくだされ。", targetFloor: 24, count: 1, tier: 2 },
  rokurokubi: { emoji: "👺", requester: "呉服屋・お絹", title: "夜道に伸びる首", text: "娘が店番を終えて帰るのも命懸けです…。首の長い女が追いかけてくると皆が震えております。このままでは夜の商売もできません。安心して夜道を歩ける町に戻してください。", targetFloor: 23, count: 2, tier: 2 },
  yukionna: { emoji: "❄️", requester: "猟師・熊蔵", title: "凍てつく山の怪", text: "山はわしらの命綱なんです。それなのに仲間が次々と凍りついて帰ってくる…。獲物も獲れず、村の蓄えも尽きそうです。どうか、あの雪女を討ってください。", targetFloor: 27, count: 1, tier: 2 },
  yamauba: { emoji: "👵", requester: "木こり・辰吉", title: "山に潜む老婆", text: "『助けておくれ』って婆さんの声が聞こえるんです。でも近寄った者は誰一人帰っちゃこねぇ…。木こりも皆、山へ入るのを怖がっています。どうか退治してください。", targetFloor: 30, count: 1, tier: 2 },
  tsuchigumo: { emoji: "🕷", requester: "炭焼き・留吉", title: "糸に絡む悲鳴", text: "仲間を助けに行きたいんです。でも森中が蜘蛛の糸だらけで、一歩も進めねぇ…。助けを呼ぶ声が今も聞こえるんです。どうか、あいつを退治してください。", targetFloor: 26, count: 1, tier: 2 },
  onryo: { emoji: "👻", requester: "安養寺 住職・玄海", title: "消えぬ怨み", text: "読経を重ねても、あの怨念だけは静まりませぬ…。寺に訪れる者も怯え、夜は誰も近寄らなくなりました。どうか、この迷える魂を救ってください。", targetFloor: 29, count: 2, tier: 2 },
  oomukade: { emoji: "🐛", requester: "飛脚・新八", title: "地を這う災厄", text: "この道が通れねぇと、荷も手紙も届けられません。仲間も毒にやられちまいました…。商人も旅人も皆困っています。どうか、街道を取り戻してください！", targetFloor: 33, count: 1, tier: 2 },
  kasha: { emoji: "🔥", requester: "墓守・源蔵", title: "燃え走る怪車", text: "弔いの最中にまで火車が現れ、亡き人をさらっていくんです…。死んだ者くらい安らかに眠らせてやりたい。このままでは供養もできません。どうか力を貸してください。", targetFloor: 36, count: 1, tier: 2 },
};
const QUEST_BOARD_SIZE = 3; // 張り出される依頼の最大枚数。1件目は確定、2件目はQUEST_BOARD_SECOND_SLOT_CHANCE、
// 3件目は(2件目が出た場合のみ)QUEST_BOARD_THIRD_SLOT_CHANCEの抽選で、毎日必ず3件揃うとは限らないようにしてある
const QUEST_BOARD_SECOND_SLOT_CHANCE = 0.75;
const QUEST_BOARD_THIRD_SLOT_CHANCE = 0.5;
const QUEST_COOLDOWN_DAYS = 5; // 一度張り出された依頼は、外れてから最低この日数が経つまで再抽選の対象にならない
const QUEST_DEADLINE_DAYS = 2; // 受注してからこの日数以内に達成しないと失敗扱いになる
const QUEST_CONTRACT_FEE_DIVISOR = 5; // 契約金 = 報酬金 ÷ この値(受注時に前払いし、達成時に全額返還される。失敗/取り下げ時は没収)
const QUEST_GOLD_PER_FLOOR = 8; // 討伐依頼の報酬金は「目標階層×この値」で計算する(到達階層が深い依頼ほど高額になる)
const QUEST_REWARD_MULT = 0.6; // 階層1.5倍化でtargetFloorが1.5倍に伸びたため、0.9÷1.5=0.6にして報酬額を従来と同額に保つ(固定報酬の破綻寸前救済クエストは対象外)
function questGoldReward(def) {
  if (def.rewardGold !== undefined) return def.rewardGold;
  return Math.round(def.targetFloor * QUEST_GOLD_PER_FLOOR * QUEST_REWARD_MULT);
}
function questContractFee(def) { return Math.round(questGoldReward(def) / QUEST_CONTRACT_FEE_DIVISOR); }
const QUEST_REWARD_XP = 0; // ユーザー指示で一旦XP報酬を廃止(金銭報酬のみ)
// 破綻寸前パーティ救済クエスト(討伐ではなく採取型)。他の依頼と違い常設の1件で、
// 所持金が少なく稼働中の仲間もほぼいない「詰みかけ」の時だけ奉行所に張り出される
const RESCUE_QUEST_DEF = {
  emoji: "🌿", requester: "百姓・佐吉",
  title: "妻のための薬草摘み",
  text: "女房が夏の暑さにやられて臥せってしまいました。深淵の森に生える薬草を煎じれば良くなるはずなのですが、わっし自身は足腰が悪く森には入れません。どうか代わりに薬草を摘んできてもらえないでしょうか。",
  targetFloor: 5, rewardGold: 25, itemName: "薬草",
};
const RESCUE_QUEST_GOLD_THRESHOLD = 20; // 所持金がこれ以下
const RESCUE_QUEST_MAX_ACTIVE_MEMBERS = 1; // 稼働中(ロストを除く)の仲間がこの人数以下の時だけ張り出される
// 確定戦闘(大猪等)から討伐せず逃げた場合、以後どのフロアでも(進む/帰還どちらでも)floor移動のたびに
// この確率で追いかけてきて再戦闘になる(state.acceptedQuest.chasing、indexHtml側のtryForceQuestEncounter参照)
const CHASE_ENCOUNTER_CHANCE = 0.6;
// ボス/中ボス(isBoss/isMidBoss、討伐依頼対象も含む)のHPがこの割合以下になった状態でその敵自身の
// 手番が回ってくると、通常の行動の代わりに瀕死のまま戦闘から逃走する(追撃モード開始)。HPが閾値を
// 割った瞬間ではなく「その敵の手番が来たタイミング」で判定する(battle.jsのprocessNext参照)。
// 追撃中は以後どのフロアでもこの確率で追いつき再戦になる(dungeon.jsのbossPursuit/
// tryForceBossPursuitEncounter参照、討伐依頼のchasing/carryHpと同じ仕組み)
const BOSS_FLEE_HP_RATIO = 0.3;
const BOSS_PURSUIT_ENCOUNTER_CHANCE = 0.6;


// 状態異常/バフ/デバフアイコンの長押し・ホバー説明ツールチップ用の共通辞書。
// キーはstatusIconsFor()等がdata-status属性に埋め込む識別子。今後アイコンが増えた場合は
// ここに1エントリ足すだけで、既存のイベント委譲(index.html)がそのまま説明を拾って表示できる
const STATUS_TOOLTIPS = {
  poison: { icon: "🦠", title: "毒", desc: "毎ターンダメージを受ける。毒は蓄積し、数値が大きいほど威力が上がる。" },
  burn: { icon: "🔥", title: "炎上", desc: "毎ターン最大HPの一定割合のダメージを受ける、ターン数固定のデバフ。" },
  bleed: { icon: "🩸", title: "出血", desc: "毎ターンダメージを受け、攻撃力も下がる。" },
  stun: { icon: "💫", title: "スタン", desc: "行動できない。" },
  silence: { icon: "🔇", title: "沈黙", desc: "技・術が使えなくなり、通常攻撃しかできない。" },
  tangle: { icon: "🕸️", title: "束縛", desc: "素早さが下がる。" },
  atkDown: { icon: "📉", title: "攻撃力低下", desc: "攻撃力が下がる。" },
  defDown: { icon: "🔻", title: "防御力低下", desc: "防御力が下がる。" },
  dmgTakenUp: { icon: "💥", title: "被ダメージ増加", desc: "受けるダメージが増える。" },
  bigAttackPending: { icon: "⚡", title: "大技の構え", desc: "次の自分のターンに強力な一撃(大技)を放つ構えに入っている。" },
  guarding: { icon: "🛡", title: "かばう", desc: "仲間の代わりに攻撃を引き受け、被ダメージを軽減する。" },
  flying: { icon: "🪽", title: "飛行", desc: "飛行していて、攻撃が当たりにくい。遠距離攻撃は当たりやすく、当たると打ち落としてスタンさせることがある。" },
  questTarget: { icon: "🎯", title: "討伐対象", desc: "受注中の依頼の討伐対象。" },
};

// 忍のスキル「変化の術」で変身できる3form。ステータス倍率は元の忍者のステータス(装備込み)に掛ける。
// formSkillを持つform(ガマ/ヘビ)は、MPではなく専用のクールタイム(character.formCooldown)で管理する
const TRANSFORM_FORMS = {
  karasu: {
    ja: "カラス", emoji: "🐦‍⬛", image: "assets/transform/karasu.png",
    hpMult: 0.7, atkMult: 1, defMult: 1, spdMult: 1.2,
    isFlying: true, canGuard: true, extraActionOnTransform: true, scoutVision: true,
  },
  gama: {
    ja: "ガマ", emoji: "🐸", image: "assets/transform/gama.png",
    hpMult: 1.3, atkMult: 0.7, defMult: 1, spdMult: 0.7,
    formSkills: [
      { key: "marunomi", name: "丸呑み", desc: "ボス・中ボス以外の敵単体を2ターンの間丸呑みにして行動不能にする(クールタイム6ターン)", cooldown: 6, swallowTurns: 2 },
      { key: "hakidasu", name: "吐き出す", desc: "丸呑みにした相手を吐き出し、丸呑みを解除する(クールタイムなし)", cooldown: 0 },
    ],
  },
  hebi: {
    ja: "ヘビ", emoji: "🐍", image: "assets/transform/hebi.png",
    hpMult: 1, atkMult: 1.1, defMult: 1.1, spdMult: 0.9,
    onHitPoison: 3,
    formSkills: [
      { key: "datsupi", name: "脱皮", desc: "HPを25%回復し、状態異常を全て取り除く(クールタイム6ターン)", cooldown: 6, healPct: 0.25 },
      { key: "dokueki", name: "毒液散布", desc: "敵全体に最大HPの25%のダメージと毒2〜4を付与する(クールタイム2ターン)", cooldown: 2, dmgPct: 0.25, poisonMin: 2, poisonMax: 4 },
    ],
  },
};
// 変身中は普段の性格セリフの代わりに、formごとの鳴き声を喋る
const TRANSFORM_ANIMAL_SOUNDS = {
  karasu: ["カーカー！", "カァ…", "カーッ！"],
  gama: ["ゲロゲロ…", "ゲコッ！", "グルル…"],
  hebi: ["シャー…", "シャアッ！", "シュル…"],
};

// ============ 村襲撃(RAID_CONFIG) ============
// 襲撃スケジュール+村レベル別ウェーブプール。襲撃エディタ(raid_editor.html)のエクスポートを
// そのままここへ貼り付けて差し替える運用(エディタ側の基準値も同じ形式)。
// schedule: firstRaidDay=初回襲撃が来るdayCount、repeatMinDays/repeatMaxDays=以降の周期の範囲
// (襲撃終了時に「その日+最短〜最長からの等確率抽選」で次回を予約する。ユーザー指示2026-07-28: 日数をばらけさせる)
// pools: 村レベル(文字列キー"1"〜"7")→ウェーブ候補の配列。発生時にその時点の村レベルのプールから
// 重み(weight)付きランダムで1候補を抽選する。プール未設定のレベルは下位レベルのプールへフォールバック。
// 各候補は waves(1波目以降を順に並べた配列、各要素が{enemies:[{id,count}]})を持つ
// (2026-07-29: 多段ウェーブ対応。1波目を全滅させると即座に2波目が同じ戦闘のまま出現する、
// raid.jsのraidTryAdvanceWave参照)。1候補=1waveのみでも配列に1要素だけ入れれば従来通り動く
// ※現在の中身はユーザーのウェーブ設計エクスポート待ちの仮データ(大規模戦テストと同じ猪5体)
const RAID_CONFIG = {
  schedule: { firstRaidDay: 8, repeatMinDays: 7, repeatMaxDays: 9 },
  pools: {
    "1": [{ weight: 1, memo: "仮: エクスポート待ち", waves: [{ enemies: [{ id: "inoshishi", count: 5 }] }] }],
  },
};

if (typeof module !== "undefined") {
  module.exports = {
    CLASSES, ABILITY_LABEL, ABILITY_DESC, ENEMIES, ITEMS, EQUIPMENT,
    MATERIALS, MATERIAL_ORDER, MATERIAL_DROP_CHANCE, MATERIAL_DROP_CHANCE_SWARM, ENEMY_MATERIAL_DROPS,
    PERSONALITIES, ACTIVE_PERSONALITIES, DIALOGUE_LINES, DIALOGUE_CHANCE, DANGER_FLOOR_LEVEL_MULT, SPEECH_BUBBLE_DURATION_MS,
    FATIGUE_PER_FLOOR, FATIGUE_PER_FLOOR_RETREAT, FATIGUE_MAX, FLEE_STRESS_PENALTY, ONSEN_FATIGUE_RELIEF, ONSEN_FLAT_COST, ONSEN_COST_PER_LEVEL, LODGE_FATIGUE_RELIEF, MAX_LEVEL,
    SWARM_ENCOUNTER_CHANCE, BURN_DAMAGE_PCT,
    BASE_ACCURACY, EVASION_SPD_BASELINE, EVASION_SPD_FACTOR, EVASION_MAX, MIN_HIT_CHANCE, STUN_RESIST_TURNS, STUN_RESIST_MULT,
    BIG_ATTACK_CYCLE_LENGTH, BIG_ATTACK_DOT_REDUCTION, BIG_ATTACK_EXPOSED_BONUS, SKILL_TREES,
    CAMPING_KIT_CAP, CAMP_HP_RELIEF, CAMP_MP_RELIEF, CAMP_STRESS_RELIEF, CAMP_COMFORT_STRESS_RELIEF,
    CAMP_WEAPON_CARE_ATK_MULT, CAMP_WEAPON_CARE_BATTLES, STATUS_TOOLTIPS,
    TRANSFORM_FORMS, TRANSFORM_ANIMAL_SOUNDS,
    RESCUE_QUEST_DEF, RESCUE_QUEST_GOLD_THRESHOLD, RESCUE_QUEST_MAX_ACTIVE_MEMBERS,
    QUEST_BOARD_SECOND_SLOT_CHANCE, QUEST_BOARD_THIRD_SLOT_CHANCE, QUEST_COOLDOWN_DAYS,
    QUEST_DEADLINE_DAYS, QUEST_CONTRACT_FEE_DIVISOR, questContractFee,
    RAID_CONFIG,
  };
}
