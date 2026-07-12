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
  samurai: { ja: "侍", image: "assets/class_samurai.png", hp: 35, atk: 12, def: 8, spd: 11, mag: 0, accuracy: 0.95, abilities: ["critAttack"] },
  ninja: { ja: "忍", image: "assets/class_ninja.png", hp: 30, atk: 13, def: 7, spd: 16, mag: 0, accuracy: 0.95, abilities: ["powerAttack"] },
  spearman: { ja: "槍士", image: "assets/class_spearman.png", hp: 39, atk: 11, def: 10, spd: 7, mag: 0, accuracy: 0.95, abilities: ["guard"] },
  naginata: { ja: "薙刀士", image: "assets/class_naginata.png", hp: 33, atk: 12, def: 8, spd: 9, mag: 0, accuracy: 0.95, abilities: ["physicalAttackAll"] },
  hunter: { ja: "狩人", image: "assets/class_hunter.png", hp: 27, atk: 11, def: 5, spd: 12, mag: 0, accuracy: 0.99, abilities: ["preciseShot"] },
  gunner: { ja: "砲術士", image: "assets/class_gunner.png", hp: 29, atk: 16, def: 6, spd: 4, mag: 0, accuracy: 0.95, abilities: ["cannonShot"] },
  onmyoji: { ja: "陰陽師", image: "assets/class_onmyoji.png", hp: 25, atk: 5, def: 5, spd: 9, mag: 17, maxMp: 25, accuracy: 0.95, abilities: ["magicAttack", "magicAttackAll"] },
  priest: { ja: "僧侶", image: "assets/class_priest.png", hp: 27, atk: 6, def: 6, spd: 8, mag: 13, accuracy: 0.95, abilities: ["heal"] },
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
// mild=ストレス40〜59、severe=60〜99、panic=100(stressTier()の1/2・3/4に対応)
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

// ゲーム開始時に最初の1人を選んだ時だけ、性格をランダムではなく職業ごとに固定する
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
const PERSONALITIES = ["優しい", "熱血", "冷静", "生意気", "のんびり", "真面目", "世話好き", "お調子者", "無口", "豪快"];

// 吹き出しセリフの本文。キー(カテゴリ)ごとに性格→セリフ配列。
// selfSkillHit/allySkillHit、selfPinch/allyPinch は同じ発生イベントを、発言者が当事者か
// 別の仲間かで出し分けるためのペア(engine側でどちらのセリフを使うか抽選する)
const DIALOGUE_LINES = {
  selfPinch: {
    優しい: ["まだいける。", "大丈夫。", "負けない。", "ここからだ。"],
    熱血: ["まだだ！", "立てる！", "これからだ！", "負けるか！"],
    冷静: ["落ち着け。", "想定内だ。", "まだある。", "焦るな。"],
    生意気: ["この程度？", "まだまだ。", "甘いね。", "舐めるな。"],
    のんびり: ["ありゃ。", "困ったな。", "なんとかなる。", "まだ平気。"],
    真面目: ["立て直そう！", "冷静に！", "まだ戦える！", "気を抜くな！"],
    世話好き: ["心配ない。", "私は平気。", "まだ動ける。", "大丈夫だ。"],
    お調子者: ["まずいって！", "やるじゃん！", "まだまだ！", "ここから！"],
    無口: ["……まだ。", "……負けない。", "……平気だ。", "……立てる。"],
    豪快: ["上等だ！", "面白い！", "まだだ！", "来い！"],
  },
  allyPinch: {
    優しい: ["大丈夫？", "無理するな。", "気をつけて。", "私が行く。"],
    熱血: ["踏ん張れ！", "まだ終わるな！", "立て！", "負けるな！"],
    冷静: ["落ち着け。", "焦るな。", "まだ間に合う。", "慌てるな。"],
    生意気: ["しっかりして。", "倒れるなよ。", "まだいけるでしょ？", "そんなもの？"],
    のんびり: ["大丈夫かな。", "無茶しないで。", "気をつけてね。", "焦らないで。"],
    真面目: ["下がって。", "回復を優先。", "無理は禁物。", "態勢を整えて。"],
    世話好き: ["私が行く！", "任せて。", "無事か？", "しっかり！"],
    お調子者: ["おっと危ない！", "まだいける！", "ファイト！", "気合いだ！"],
    無口: ["……下がれ。", "……危ない。", "……任せろ。", "……無茶するな。"],
    豪快: ["心配するな！", "任せろ！", "まだ終わらん！", "立ち上がれ！"],
  },
  selfSkillHit: {
    優しい: ["やった！", "決まった！", "よかった。", "効いたね。", "うまくいったね。", "これで安心。", "届いたね。", "力になれた。", "順調だね。", "よかった。"],
    熱血: ["決まった！", "どうだ！", "いいぞ！", "効いたか！", "押し切る！", "まだまだ！", "決める！", "一気にいく！", "燃えてきた！", "止まらない！"],
    冷静: ["決まった。", "想定どおり。", "効いている。", "終わりだ。", "狙いどおり。", "問題ない。", "崩せた。", "予定どおり。", "効いている。", "続けよう。"],
    生意気: ["どう？", "甘いね。", "いい感じ。", "この程度。", "こんなもの。", "余裕だね。", "見えた。", "遅いよ。", "悪くないね。", "簡単だった。"],
    のんびり: ["やったね。", "いい感じ。", "決まった。", "うまくいった。", "やったぁ。", "いい感じだね。", "よかったぁ。", "なんとかなった。", "うまくいったね。", "安心したぁ。"],
    真面目: ["決まりました！", "効いています！", "成功です！", "この調子です！", "成功です！", "順調です！", "作戦どおりです！", "効果ありです！", "決まりました！", "このままいきます！"],
    世話好き: ["よし。", "効いたね。", "大丈夫そう。", "うまくいった。", "よかったね。", "助けになれた。", "安心して。", "うまくいったよ。", "大丈夫そう。", "この調子だね。"],
    お調子者: ["やったー！", "決まった！", "バッチリ！", "最高！", "イェーイ！", "決めたー！", "バッチリ！", "最高だね！", "気持ちいい！", "ノッてきた！"],
    無口: ["……決まった。", "……効いた。", "……よし。", "……終わり。", "……十分。", "……通った。", "……悪くない。", "……終わりだ。", "……狙いどおり。", "……続ける。"],
    豪快: ["どうだ！", "効いただろ！", "痛快だ！", "はっはっは！", "気持ちいい！", "効いただろ！", "吹っ飛べ！", "まだいくぞ！", "これでどうだ！", "最高だ！"],
  },
  allySkillHit: {
    優しい: ["いいね！", "やった！", "その調子！", "ナイス！", "さすがだね。", "頼もしいね。", "助かったよ。", "いい流れ。", "その調子だね。", "きれいに決まったね。"],
    熱血: ["よし！", "決まった！", "いいぞ！", "そのまま！", "いいぞ！", "押し切れ！", "もっといけ！", "熱いね！", "その勢いだ！", "最高だ！"],
    冷静: ["決まったな。", "悪くない。", "効いてる。", "いい一撃だ。", "見事だ。", "順調だな。", "効いている。", "いい判断だ。", "悪くない。", "流れがいい。"],
    生意気: ["やるじゃん。", "いいね。", "さすが。", "悪くない。", "やるじゃん。", "悪くないね。", "見直した。", "そのくらいできるよね。", "なかなかだね。", "いい腕してる。"],
    のんびり: ["おおー。", "やったね。", "いい感じ。", "いいねぇ。", "すごいねぇ。", "助かったぁ。", "いい感じだね。", "頼もしいなぁ。", "やるねぇ。", "よかったぁ。"],
    真面目: ["見事です！", "効いています！", "いい一撃です！", "この調子です！", "見事です！", "効果的です！", "素晴らしいです！", "順調ですね！", "完璧です！", "この調子です！"],
    世話好き: ["よくやった！", "いいよ！", "その調子！", "助かった！", "助かったよ。", "頼もしいね。", "ありがとう。", "その調子だよ。", "安心したよ。", "いい一撃だね。"],
    お調子者: ["最高！", "ナイス！", "決まったー！", "やるね！", "いいねー！", "イケてる！", "ナイスー！", "最高！", "やるやる！", "決まったー！"],
    無口: ["……いい。", "……決まった。", "……見事。", "……よし。", "……見事。", "……頼もしい。", "……十分だ。", "……悪くない。", "……いい。", "……続けろ。"],
    豪快: ["いいぞ！", "痛快だ！", "その一撃だ！", "はっはっは！", "豪快だ！", "いい一撃！", "その調子だ！", "やるな！", "気持ちいいな！", "もっといけ！"],
  },
  selfHealed: {
    優しい: ["ありがとう。", "助かった。", "ほっとした。", "元気が出た。"],
    熱血: ["よし！", "助かる！", "まだいける！", "反撃だ！"],
    冷静: ["助かった。", "問題ない。", "持ち直した。", "十分だ。"],
    生意気: ["悪くないね。", "助かったよ。", "なかなかじゃん。", "いい感じ。"],
    のんびり: ["ふぅ。", "助かったぁ。", "ありがと。", "楽になった。"],
    真面目: ["感謝します。", "助かりました。", "ありがとうございます。", "持ち直せます。"],
    世話好き: ["ありがとう。", "助かったよ。", "心強いね。", "感謝する。"],
    お調子者: ["助かったー！", "復活！", "ありがと！", "元気出た！"],
    無口: ["……感謝。", "……助かった。", "……悪くない。", "……ありがとう。"],
    豪快: ["助かった！", "いいぞ！", "まだいける！", "よし来い！"],
  },
  allyDefeated: {
    優しい: ["しっかり！", "大丈夫！？", "無事でいて！", "私が守る！"],
    熱血: ["まだ終わるな！", "立て！", "ここからだ！", "負けるな！"],
    冷静: ["落ち着け。", "まだ間に合う。", "回復を急ぐ。", "立て直そう。"],
    生意気: ["何やってるの。", "しっかりして。", "まだ終わりじゃない。", "起きてよ。"],
    のんびり: ["あっ…。", "大丈夫かな。", "無茶したね。", "急がないと。"],
    真面目: ["回復を優先。", "急ぎましょう。", "まだ助けられる。", "態勢を立て直す。"],
    世話好き: ["今助ける！", "待ってて！", "任せて！", "必ず助ける！"],
    お調子者: ["うそでしょ！？", "おいおい！", "まだ諦めない！", "すぐ助ける！"],
    無口: ["……くっ。", "……まずい。", "……待ってろ。", "……助ける。"],
    豪快: ["心配するな！", "まだ終わらん！", "今助ける！", "立ち上がれ！"],
  },
  battleStart: {
    優しい: ["気をつけて。", "いこう。", "無理しないで。", "始めよう。"],
    熱血: ["いくぞ！", "全力だ！", "かかってこい！", "勝負だ！"],
    冷静: ["始める。", "油断するな。", "落ち着いて。", "いく。"],
    生意気: ["相手になる？", "さっさといこう。", "楽しませて。", "本気で来なよ。"],
    のんびり: ["いこうか。", "頑張ろう。", "のんびりとはいかないね。", "よし。"],
    真面目: ["いきます！", "油断は禁物です！", "慎重に！", "始めましょう！"],
    世話好き: ["私が支える。", "任せて。", "みんな、いこう。", "気をつけて。"],
    お調子者: ["盛り上がってきた！", "いっくよー！", "楽しもう！", "派手にいこう！"],
    無口: ["……敵。", "……始める。", "……来い。", "……行こう。"],
    豪快: ["さあ来い！", "暴れるぞ！", "一気にいく！", "相手してやる！"],
  },
  stressLight: {
    優しい: ["少し疲れた。", "ひと休みしたい。", "大丈夫かな。", "気をつけよう。"],
    熱血: ["まだ平気だ！", "こんなの平気！", "まだいける！", "気合いだ！"],
    冷静: ["少し疲労がある。", "問題ない。", "集中しよう。", "気を引き締める。"],
    生意気: ["ちょっと面倒だね。", "だるいな。", "まぁ平気か。", "まだ余裕。"],
    のんびり: ["疲れてきたなぁ。", "ふぅ。", "少し休みたい。", "のんびりしたい。"],
    真面目: ["疲労があります。", "少し休憩を。", "無理は禁物です。", "気を引き締めます。"],
    世話好き: ["少し疲れたね。", "大丈夫？", "無理しないで。", "一息つこう。"],
    お調子者: ["ちょっと疲れた！", "休みたいなー。", "まだ頑張れる！", "へっちゃら！"],
    無口: ["……疲れた。", "……少し休む。", "……平気だ。", "……まだ。"],
    豪快: ["このくらい平気！", "まだまだ！", "疲れなんて飛ばす！", "一杯やりたいな！"],
  },
  stressMid: {
    優しい: ["少し限界かも。", "休みたい…。", "気力が出ない。", "つらいな…。"],
    熱血: ["まだ倒れない！", "気合いだ…！", "くっ…！", "まだ終われない！"],
    冷静: ["集中が切れる…。", "厳しいな。", "消耗が激しい。", "一度休みたい。"],
    生意気: ["さすがにきついね…。", "面倒になってきた。", "調子が悪い。", "ちっ…。"],
    のんびり: ["もう疲れたなぁ…。", "少し休みたい…。", "しんどいな…。", "のんびりしたい…。"],
    真面目: ["消耗しています。", "休息が必要です。", "このままでは危険です。", "無理はできません。"],
    世話好き: ["少し休ませて…。", "ごめん、きつい…。", "気力が持たない…。", "少しだけ休もう。"],
    お調子者: ["さすがにきつい！", "笑えないって…。", "へとへとだ…。", "休みたいなぁ…。"],
    無口: ["……限界だ。", "……きつい。", "……休みたい。", "……疲れた。"],
    豪快: ["くっ…重いな。", "少し骨が折れる！", "まだ踏ん張る！", "簡単には倒れん！"],
  },
  stressHigh: {
    優しい: ["もう嫌だ…。", "怖い…。", "やめて…。", "ごめんなさい…。"],
    熱血: ["うるさい！！", "黙れぇ！！", "まだだ…まだだ…！", "ぶっ飛ばす！！"],
    冷静: ["集中できない…。", "思考が乱れる…。", "頭が痛い…。", "……くっ。"],
    生意気: ["イライラする…。", "もう知らない。", "全部うざい…。", "消えてよ。"],
    のんびり: ["もう何もしたくない…。", "疲れた…。", "帰りたい…。", "もう無理…。"],
    真面目: ["駄目だ…。", "判断できない…。", "失敗ばかりだ…。", "どうすれば…。"],
    世話好き: ["ごめん…。", "誰か助けて…。", "守れない…。", "もう駄目…。"],
    お調子者: ["あはは…。", "笑えない…。", "なんでだよ…。", "もう嫌だ！"],
    無口: ["……。", "……やめろ。", "……消えろ。", "……限界だ。"],
    豪快: ["チッ！！", "邪魔だぁ！！", "全員まとめて来い！！", "壊してやる！！"],
  },
  breakdown: {
    優しい: ["やめて…。", "怖い…。", "もう嫌…。", "助けて…。"],
    熱血: ["ああああっ！！", "黙れぇ！！", "消えろ！！", "うおおおっ！！"],
    冷静: ["……駄目だ。", "思考が…。", "何も見えない…。", "制御できない…。"],
    生意気: ["全部壊れろ。", "もう知らない。", "消えて。", "どうでもいい。"],
    のんびり: ["もういいや…。", "疲れた…。", "何もしたくない…。", "終わりでいい…。"],
    真面目: ["失敗した…。", "もう無理です…。", "考えられない…。", "申し訳ありません…。"],
    世話好き: ["誰か…。", "助けて…。", "ごめん…。", "守れなかった…。"],
    お調子者: ["あは…あはは…。", "おかしいな…。", "もう笑うしか…。", "ははっ…。"],
    無口: ["……。", "……終わりだ。", "……消えたい。", "…………。"],
    豪快: ["来いよぉ！！", "全部ぶっ壊す！！", "うおおおおっ！！", "ははははっ！！"],
  },
  dangerFloor: {
    優しい: ["嫌な予感がする…。", "空気が重いね…。", "気をつけよう。", "無理はしないで。"],
    熱血: ["強敵がいるな！", "気合い入れていくぞ！", "油断するな！", "ここからが本番だ！"],
    冷静: ["気配が変わった。", "この先は危険だ。", "警戒を強めよう。", "慎重に進む。"],
    生意気: ["面倒なのがいるね。", "厄介そうだ。", "気を抜けないね。", "ただ者じゃない。"],
    のんびり: ["なんだか怖いな…。", "落ち着かない…。", "変な感じ…。", "帰りたくなってきた…。"],
    真面目: ["危険度が上がっています。", "慎重に進みましょう。", "警戒してください。", "隊形を崩さないで。"],
    世話好き: ["みんな、気をつけて。", "離れないでね。", "無理はしないで。", "いつでも退けるように。"],
    お調子者: ["なんか嫌な感じ！", "笑えない空気だね…。", "これはまずいかも。", "冗談じゃなさそう…。"],
    無口: ["……来る。", "……いるな。", "……警戒。", "……まずい。"],
    豪快: ["強敵か！", "面白くなってきた！", "気を引き締めろ！", "一筋縄じゃなさそうだ！"],
  },
  normalKill: {
    優しい: ["終わったね。", "よかった。", "一安心。", "次へ行こう。", "これで大丈夫。", "ほっとした。", "無事だね。", "片付いたね。", "終わったね。", "よかった…。", "無事だったね。", "もう安心。", "ひと安心。", "次へ行こう。"],
    熱血: ["倒した！", "次だ！", "よっしゃ！", "まだいくぞ！", "この調子！", "勝負はこれから！", "いいぞ！", "もっと来い！", "次だ！", "まだいくぞ！", "よし！", "倒した！", "勢いは止まらない！", "かかってこい！"],
    冷静: ["一体撃破。", "次へ。", "順調だ。", "問題ない。", "排除完了。", "想定どおり。", "油断するな。", "続行する。", "一体撃破。", "片付いた。", "順調だ。", "次へ。", "問題ない。", "終わりだ。"],
    生意気: ["こんなもの？", "期待外れね。", "もう終わり？", "次、いこっか。", "あっけないね。", "その程度？", "退屈だな。", "まだ相手になる？", "弱かったね。", "こんなもの？", "あっけないね。", "退場。", "次は誰？", "終わりだね。"],
    のんびり: ["終わったね。", "なんとかなった。", "ほっとした。", "次いこっか。", "いい感じ。", "一人減ったね。", "よしよし。", "気が楽になった。", "終わったねぇ。", "よかったぁ。", "ひと安心。", "ほっとした。", "次いこう。", "なんとかなった。"],
    真面目: ["一体撃破！", "次へ進みます！", "順調です！", "油断は禁物です！", "任務継続！", "確実にいきます！", "落ち着いて進もう！", "この調子です！", "撃破しました！", "任務完了です！", "次へ進みます！", "順調です！", "この調子です！", "片付きました！"],
    世話好き: ["よし、一体。", "みんな大丈夫？", "この調子だね。", "次もいこう。", "ケガはない？", "任せて。", "よく頑張った。", "まだ気を抜かないで。", "大丈夫そうだね。", "無事だったね。", "よし、次へ。", "安心したよ。", "このままいこう。", "片付いたね。"],
    お調子者: ["やったー！", "決まった！", "ナイス！", "いい感じ！", "楽勝！", "最高！", "次もいくよ！", "ノってきた！", "やったー！", "楽勝！", "ナイスー！", "決めた！", "いい感じ！", "最高ー！"],
    無口: ["……撃破。", "……次。", "……終わり。", "……よし。", "……片付いた。", "……問題ない。", "……続行。", "……行く。", "……終わり。", "……撃破。", "……次だ。", "……片付いた。", "……十分。", "……いくぞ。"],
    豪快: ["一丁上がり！", "次だ！", "軽い軽い！", "どんどん来い！", "はっはっは！", "他愛ない！", "まだ足りん！", "景気がいい！", "一丁上がり！", "まだまだ！", "吹っ飛んだな！", "気持ちいい！", "次だ！", "もっと来い！"],
  },
  // 瀕死の仲間を担がれた側(瀕死になっている本人)が発言する。担いだ側ではない点に注意
  carried: {
    優しい: ["ありがとう…。", "助かった…。", "本当にありがとう。", "お願いね…。", "恩に着るよ。", "また頑張る。", "助けられたよ。", "安心した…。", "任せるね。", "忘れないよ。"],
    熱血: ["借りができた！", "助かった！", "恩に着る！", "次は助ける！", "必ず返す！", "ありがとう！", "まだ終われない！", "この借り返す！", "また戦おう！", "任せた！"],
    冷静: ["感謝する。", "助かった。", "借りができた。", "恩に着る。", "礼を言う。", "ありがとう。", "任せる。", "助けられた。", "また頼む。", "忘れない。"],
    生意気: ["借りだからね。", "助かったよ。", "ありがと。", "悪くない。", "見直した。", "今回は助けられた。", "ちゃんと返すから。", "感謝してる。", "なかなかやるね。", "恩は返すよ。"],
    のんびり: ["ありがとぉ…。", "助かったぁ…。", "ふぅ…。", "安心した…。", "お願いね…。", "助けられたよ。", "ありがとう…。", "また頑張るね。", "ほっとした…。", "恩に着るね。"],
    真面目: ["感謝します。", "助かりました。", "借りができました。", "恩に報います。", "ありがとうございます。", "必ず返します。", "助けられました。", "本当に感謝します。", "任せます。", "忘れません。"],
    世話好き: ["ありがとう。", "助かったよ。", "助けてくれてありがとう。", "恩は返すよ。", "任せるね。", "安心したよ。", "本当に助かった。", "また一緒にね。", "感謝してる。", "ありがとう、助かった。"],
    お調子者: ["助かったー！", "セーフ！", "ありがとー！", "危なかったー！", "借りだね！", "ナイス！", "また頼むね！", "やるじゃん！", "助かったよ！", "恩は返すよ！"],
    無口: ["……感謝。", "……助かった。", "……借りだ。", "……ありがとう。", "……恩に着る。", "……助けられた。", "……任せる。", "……礼を言う。", "……忘れない。", "……また。"],
    豪快: ["借りができた！", "助かった！", "恩に着る！", "ありがと！", "この借り返す！", "助けられた！", "感謝する！", "次は任せて！", "また戦おう！", "ありがとう！"],
  },
  // 敵を全滅させた時。他のセリフより優先して発言する(ミューテックスを無視できる)
  allDefeated: {
    優しい: ["終わったね。", "みんな無事でよかった。", "お疲れさま。", "勝ててよかった。", "ほっとした。", "もう大丈夫だね。", "安心したよ。", "よく頑張ったね。", "次も頑張ろう。", "帰ろうか。"],
    熱血: ["勝った！", "最高だ！", "やったぞ！", "まだまだいくぞ！", "この勢いだ！", "圧勝だ！", "気持ちいい！", "次も勝つ！", "燃えてきた！", "よっしゃ！"],
    冷静: ["制圧完了。", "終わった。", "勝利だ。", "問題ない。", "次へ進もう。", "順調だ。", "片付いたな。", "任務完了。", "予定どおりだ。", "警戒は続けよう。"],
    生意気: ["あっけなかったね。", "弱かったね。", "こんなもの？", "物足りないな。", "退屈だった。", "もう終わり？", "いい運動だったね。", "相手にならないね。", "楽勝。", "次いこう。"],
    のんびり: ["終わったぁ。", "よかったぁ。", "疲れたねぇ。", "ほっとした。", "勝てたね。", "安心したぁ。", "ひと休みしたいな。", "なんとかなったね。", "無事でよかった。", "次も頑張ろう。"],
    真面目: ["勝利しました！", "任務完了です！", "無事に終わりました！", "よく戦いました！", "次へ進みましょう！", "油断は禁物です！", "順調です！", "お疲れさまでした！", "作戦成功です！", "作戦完了です！"],
    世話好き: ["みんなお疲れさま。", "無事でよかった。", "よく頑張ったね。", "安心したよ。", "怪我はない？", "ひと安心だね。", "次も一緒に頑張ろう。", "勝ててよかった。", "今日はよく戦ったね。", "ありがとう。"],
    お調子者: ["やったー！", "勝った勝った！", "最高ー！", "楽しかった！", "イェーイ！", "余裕だったね！", "いい感じ！", "ノッてきた！", "ナイス！", "また勝ったー！"],
    無口: ["……終わり。", "……勝った。", "……片付いた。", "……十分だ。", "……次へ。", "……問題ない。", "……よくやった。", "……安心した。", "……戻ろう。", "……終戦。"],
    豪快: ["勝ったぞ！", "豪快だったな！", "気持ちいい！", "もっと来い！", "一掃したな！", "最高だ！", "まだ暴れ足りない！", "次もいくぞ！", "これくらいだ！", "よくやった！"],
  },
  // ダンジョンから村へ帰る(里に戻るを押した時)。瀕死の仲間がいない通常の帰還
  retreat: {
    優しい: ["帰ろうか。", "村へ帰ろう。", "今日はここまでだね。", "お疲れさま。", "ゆっくり休もう。", "また来ようね。", "帰ってひと休みしよう。", "温泉が待ってるね。", "帰ろう、みんな。", "ほっとしたね。"],
    熱血: ["帰るぞ！", "村へ戻ろう！", "次も暴れるぞ！", "今日は上出来だ！", "もっと強くなるぞ！", "また来よう！", "いい探索だった！", "帰って準備だ！", "次が楽しみだ！", "よし、戻ろう！"],
    冷静: ["村へ戻ろう。", "今日は終わりだ。", "帰還しよう。", "十分な成果だ。", "次へ備えよう。", "休息を取ろう。", "整理しよう。", "戻るとしよう。", "悪くない探索だった。", "帰ろう。"],
    生意気: ["帰ろっか。", "今日は満足かな。", "悪くなかったね。", "また来ればいい。", "村でゆっくりしよう。", "帰って休も。", "次はもっと奥だね。", "案外楽しめた。", "今日はこれで十分。", "帰ろう。"],
    のんびり: ["帰ろっかぁ。", "疲れたねぇ。", "ゆっくり休もう。", "温泉入りたいなぁ。", "村へ帰ろう。", "今日はおしまい。", "ほっとしたぁ。", "また来ようね。", "お腹すいたぁ。", "のんびり帰ろう。"],
    真面目: ["村へ戻りましょう。", "今日はここまでです。", "成果を整理しましょう。", "休息を取りましょう。", "次へ備えます。", "帰還します。", "十分な探索でした。", "また挑みましょう。", "村へ戻ります。", "お疲れさまでした。"],
    世話好き: ["帰ろう。", "みんなお疲れさま。", "村へ戻ろう。", "ゆっくり休もうね。", "今日は十分頑張ったよ。", "また一緒に来よう。", "温泉で休もう。", "お腹空いたね。", "帰って一息つこう。", "お疲れさま。"],
    お調子者: ["帰るかー！", "村だ村だー！", "お疲れー！", "温泉行こ！", "ご飯だー！", "楽しかったね！", "また来よう！", "今日は満足！", "帰って休もー！", "いい一日だった！"],
    無口: ["……帰る。", "……村へ。", "……終わりだ。", "……戻ろう。", "……休もう。", "……また来る。", "……帰還。", "……十分だ。", "……行こう。", "……お疲れ。"],
    豪快: ["帰るぞ！", "村へ戻る！", "今日はいい汗かいた！", "腹が減った！", "温泉だ！", "また来るぞ！", "もっと強くなる！", "いい探索だった！", "次も楽しみだ！", "帰ろう！"],
  },
  // ピンチで帰還を決めた時(瀕死の仲間を担いでいる状態で里に戻るを押した)
  retreatPinch: {
    優しい: ["帰ろう。", "無理はしない。", "急いで戻ろう。", "今日は帰ろう。", "みんなで帰ろう。", "生きて帰ろう。", "休もう。", "これ以上は危ないね。", "帰って立て直そう。", "戻ろう。"],
    熱血: ["帰るぞ！", "今日はここまでだ！", "生きて帰るぞ！", "立て直そう！", "この借りは返す！", "次は勝つ！", "まだ終わりじゃない！", "戻るぞ！", "仕切り直しだ！", "全員帰るぞ！"],
    冷静: ["帰還する。", "戻ろう。", "生存を優先する。", "これ以上は危険だ。", "立て直そう。", "休息が必要だ。", "判断は変えない。", "今日は帰る。", "村へ戻ろう。", "次へ備える。"],
    生意気: ["帰ろうか。", "今日はここまで。", "無茶はしない。", "帰って出直そう。", "まだ終わりじゃない。", "次は負けない。", "この借りは返す。", "仕方ないね。", "戻ろう。", "また来るよ。"],
    のんびり: ["帰ろっか。", "今日はおしまい。", "休もう…。", "帰って休みたいな。", "もう無理しない。", "戻ろう。", "今日は帰ろう。", "また来ようね。", "ゆっくり休もう。", "帰ろ…。"],
    真面目: ["帰還します。", "今日は戻りましょう。", "無理は禁物です。", "立て直します。", "帰還を優先します。", "次へ備えます。", "休息を取りましょう。", "これ以上は危険です。", "戻ります。", "村へ帰りましょう。"],
    世話好き: ["帰ろう。", "今日は帰ろうね。", "無理しないで。", "休もう。", "みんなで帰ろう。", "帰って手当てしよう。", "今日は十分だよ。", "戻ろう。", "焦らなくていいよ。", "帰ろうね。"],
    お調子者: ["帰るよー！", "今日はここまで！", "戻ろう！", "また来よう！", "帰って休もう！", "仕切り直しだ！", "帰ろ帰ろ！", "今日はおしまい！", "無理はしない！", "また挑もう！"],
    無口: ["……帰る。", "……戻る。", "……今日は終わり。", "……休む。", "……帰還する。", "……村へ。", "……立て直す。", "……また来る。", "……行こう。", "……帰ろう。"],
    豪快: ["帰るぞ！", "今日はここまでだ！", "生きて帰るぞ！", "立て直すぞ！", "次は勝つ！", "まだ終わっちゃいない！", "戻るぞ！", "全員帰る！", "また暴れるぞ！", "仕切り直しだ！"],
  },
  // 奉行所の依頼(受注制)で確定出現した討伐対象を発見した瞬間の特別な一言。ミューテックスの
  // 空きがあれば確実に発言させる(発生頻度が低い特別なイベントのため、他のセリフのような
  // 確率抽選は挟まずtrySpeakを直接呼ぶ、indexHtml側のtryForceQuestEncounter参照)
  questTargetFound: {
    優しい: ["見つけた…みんな、気をつけて。"],
    熱血: ["見つけたぞ！ここからが本番だ！"],
    冷静: ["対象を確認。予定通りだ。"],
    生意気: ["やっと見つけた。待たせたね。"],
    のんびり: ["あ、いた。ようやくだね。"],
    真面目: ["対象を発見しました。油断なく。"],
    世話好き: ["見つけたよ、みんな油断しないでね。"],
    お調子者: ["見っけ！待ってました！"],
    無口: ["……いた。"],
    豪快: ["見つけたぞ！かかってこい！"],
  },
};

// おみくじ: 神社で1日1回引ける5段階の運勢。数値バフではなく次の遠征の展開そのものを変える効果にしてある
// (weightの合計は100。効果の実際の発動箇所はindex.html側のomikuji関連コードを参照)
const OMIKUJI_TIERS = {
  daikichi: { label: "大吉", weight: 5, effectDesc: "次の遠征中、瀕死の一撃をパーティ全員で一度だけHP1に耐える" },
  chukichi: { label: "中吉", weight: 15, effectDesc: "次の遠征中、不穏な道が一切出ない" },
  kichi: { label: "吉", weight: 30, effectDesc: "次の遠征中、神隠しの道の出現率が上がる" },
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
    豪快: ["はっはっは！これは幸先がいいな！"],
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
    豪快: ["悪くないじゃないか！"],
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
    豪快: ["悪くない！行くぞ！"],
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
    豪快: ["小さくても御の字だ！"],
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
    豪快: ["はっはっは、紙切れ一枚だ！"],
  },
};

// 吹き出しセリフの発生確率。selfSkillHit/allySkillHit、selfPinch/allyPinchは同じイベントの
// 抽選(どちらが発言するか)に使うので同じ値を共有する
const DIALOGUE_CHANCE = {
  critHit: 0.70, // 会心発生時のみ発動(以前は攻撃成功時に一律30%だったが、会心限定+70%に置き換えた)。発動時は自分/仲間のどちらが発言するか50%ずつ抽選
  normalKill: 0.25,
  allyDefeated: 0.75,
  selfHealed: 0.20,
  pinch: 0.20,
  battleStart: 0.30,
  breakdownPerTurn: 0.50,
  dangerFloor: 0.40,
  stressFloor: 0.20,
  carried: 0.90, // 瀕死の仲間を担いだ時、担がれた側(瀕死側)が発言する確率(元0.75から+15%)
  allDefeated: 0.35, // 敵を全滅させた時のセリフの発生確率(発動時は最後に倒した人物65%/他の仲間35%で抽選)
  retreat: 0.60, // 里に戻るを押した時(瀕死の仲間がいない通常の帰還)
  retreatPinch: 0.50, // 里に戻るを押した時(瀕死の仲間を担いでいるピンチの帰還)
};
// 現在階層がパーティ平均レベルのこの倍数を超えたら「自分たちのレベル的に危険な階層」とみなす
const DANGER_FLOOR_LEVEL_MULT = 1.3;
// 吹き出しが画面に表示され続ける時間
const SPEECH_BUBBLE_DURATION_MS = 2500;

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
// pickEncounterForFloor()により10の倍数フロアで単体ボス戦として優先的に選ばれる)
const ENEMIES = {
  // ---- 序盤(Lv1-10 / floor 1-12) ----
  // bigAttack: 大技(予告→発動)の専用プロファイル。見た目/生態にあわせて威力とデバフを個別に設計してある
  // (未設定の敵はengine.js側の汎用フォールバック=BIG_ATTACK_MULT+ランダムデバフプールを使う)
  yaken: { id: "yaken", ja: "野犬", image: "assets/enemies/yaken.png", hp: 14, atk: 4, def: 2, spd: 6, goldMin: 5, goldMax: 11, xp: 8, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 1.0, debuff: { type: "spdDown", chance: 0.45, value: 0.2, turns: 3 } } }, // 群れで足に食らいつき、動きを鈍らせる
  inoshishi: { id: "inoshishi", ja: "猪", image: "assets/enemies/inoshishi.png", hp: 18, atk: 5, def: 3, spd: 4, goldMin: 6, goldMax: 12, xp: 9, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 1.62 } }, // 猪突猛進、ただ単純に高威力
  dokuhebi: { id: "dokuhebi", ja: "毒蛇", image: "assets/enemies/dokuhebi.png", hp: 13, atk: 5, def: 2, spd: 7, goldMin: 6, goldMax: 12, xp: 9, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 0.9, debuff: { type: "poison", chance: 1.0, value: 3 } },
    onHitInflict: { type: "poison", chance: 0.5, value: 3 } }, // 攻撃力を落とす代わりに、通常攻撃でも高確率で毒を注入する
  oogumo: { id: "oogumo", ja: "大蜘蛛", image: "assets/enemies/oogumo.png", hp: 17, atk: 5, def: 3, spd: 6, goldMin: 8, goldMax: 14, xp: 10, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 1.1, debuff: { type: "stun", chance: 0.5, turns: 1 } } }, // 糸で絡め取り、高確率で行動を封じる
  kodama: { id: "kodama", ja: "木霊", image: "assets/enemies/kodama.png", hp: 15, atk: 5, def: 2, spd: 5, goldMin: 6, goldMax: 12, xp: 9, minFloor: 1, maxFloor: 12, isPlant: true,
    bigAttack: { mult: 0.9, debuff: { type: "atkDown", chance: 0.5, value: 0.15, turns: 3 } } }, // 精気を吸い、力を奪う
  kappa: { id: "kappa", ja: "河童", image: "assets/enemies/kappa.png", hp: 16, atk: 5, def: 3, spd: 6, goldMin: 8, goldMax: 14, xp: 10, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 1.0, debuff: { type: "defDown", chance: 0.5, value: 0.15, turns: 3 } } }, // 相撲さながらに組み伏せ、構えを崩す
  hitotsume_kozo: { id: "hitotsume_kozo", ja: "一つ目小僧", image: "assets/enemies/hitotsume_kozo.png", hp: 14, atk: 5, def: 2, spd: 8, goldMin: 8, goldMax: 14, xp: 10, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 1.0, debuff: { type: "spdDown", chance: 0.4, value: 0.2, turns: 3 } } }, // 不気味な一つ目で睨まれ、竦んで動きが鈍る
  bake_danuki: { id: "bake_danuki", ja: "化け狸", image: "assets/enemies/bake_danuki.png", hp: 18, atk: 5, def: 4, spd: 6, goldMin: 9, goldMax: 15, xp: 11, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 0.9, debuff: { type: "silence", chance: 0.45, turns: 2 } } }, // 幻術で惑わし、技を封じる
  onibi: { id: "onibi", ja: "鬼火", image: "assets/enemies/onibi.png", hp: 12, atk: 5, def: 1, spd: 7, goldMin: 9, goldMax: 15, xp: 11, minFloor: 1, maxFloor: 12,
    // 燃え盛る炎そのもの。大技は誰か1人を庇っても防ぎきれない燃え広がる炎として、かばう/挑発を無視して
    // 必ず全体を巻き込む(ignoreGuardian)。その代わり単体特化の大技より威力は抑えめ、通常攻撃も
    // 全体攻撃力を20%落とした代わりに、通常攻撃自体にも延焼(30%)を持たせてある
    bigAttack: { mult: 0.4, ignoreGuardian: true, debuff: { type: "burn", chance: 1.0, turnsMin: 2, turnsMax: 3 } },
    onHitInflict: { type: "burn", chance: 0.3, turnsMin: 2, turnsMax: 3 } },
  kamaitachi: { id: "kamaitachi", ja: "かまいたち", image: "assets/enemies/kamaitachi.png", hp: 16, atk: 6, def: 2, spd: 10, goldMin: 11, goldMax: 18, xp: 13, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 1.0, debuff: { type: "defDown", chance: 0.55, value: 0.2, turns: 3 } } }, // かまいたちの一閃が鎧ごと切り裂く

  // ---- 序盤の中ボス級(奉行所の依頼専用。questOnly:trueのため通常の階層抽選には出ず、
  //      指名討伐でのみスポーンする) ----
  // 大猪(猪の討伐依頼で実際にスポーンする上位個体、QUEST_DEFS.inoshishi.spawnId参照)。
  // 高HPで通常攻撃は控えめだが、大技(bigAttack.mult:7.5)は庇う槍士でもギリギリ耐えられるかどうかの
  // 一撃になるよう逆算した(かばう成功で被ダメ0.4倍、槍士の実効防御力想定でHPの8割前後を削る計算)。
  // 大技は「構え中(bigAttackPending)にスタンを入れると完全に潰せる」という既存仕組みを
  // プレイヤーに実地で覚えさせるための、いわば「先生」役の中ボス
  oo_inoshishi: { id: "oo_inoshishi", ja: "大猪", image: "assets/enemies/oo_inoshishi.png", hp: 42, atk: 7, def: 6, spd: 3, goldMin: 40, goldMax: 60, xp: 40, minFloor: 1, maxFloor: 12, isBoss: true, questOnly: true, isMidBoss: true,
    bigAttack: { mult: 8.0 } },
  q_arakuma: { id: "q_arakuma", ja: "荒熊", image: "assets/enemies/q_arakuma.png", hp: 26, atk: 7, def: 5, spd: 3, goldMin: 35, goldMax: 55, xp: 42, minFloor: 1, maxFloor: 12, isBoss: true, questOnly: true,
    bigAttack: { mult: 1.3, debuff: { type: "defDown", chance: 0.5, value: 0.2, turns: 3 } } }, // 森の主、爪の一薙ぎが鎧を弾き飛ばす
  q_daija: { id: "q_daija", ja: "大蛇", image: "assets/enemies/q_daija.png", hp: 22, atk: 8, def: 4, spd: 7, goldMin: 35, goldMax: 55, xp: 42, minFloor: 1, maxFloor: 12, isBoss: true, questOnly: true,
    bigAttack: { mult: 1.2 },
    onHitInflict: { type: "poison", chance: 0.4, value: 4 } }, // 川を塞ぐ大蛇、牙に猛毒を宿す
  q_oni: { id: "q_oni", ja: "鬼", image: "assets/enemies/q_oni.png", hp: 27, atk: 9, def: 5, spd: 4, goldMin: 38, goldMax: 58, xp: 45, minFloor: 1, maxFloor: 12, isBoss: true, questOnly: true,
    bigAttack: { mult: 1.4 } }, // 山に棲む鬼、棍棒の一撃は防御ごと打ち砕く
  q_gashadokuro: { id: "q_gashadokuro", ja: "がしゃどくろ", image: "assets/enemies/q_gashadokuro.png", hp: 24, atk: 8, def: 5, spd: 8, goldMin: 38, goldMax: 58, xp: 45, minFloor: 1, maxFloor: 12, isBoss: true, questOnly: true,
    bigAttack: { mult: 1.0, debuff: { type: "stun", chance: 0.4, turns: 1 } } }, // 夜鳴きの怪、骨の震えが敵の足をすくませる

  // ---- 中盤(Lv11-25 / floor 9-29) ----
  ochimusha: { id: "ochimusha", ja: "落武者", image: "assets/enemies/ochimusha.png", hp: 34, atk: 10, def: 6, spd: 8, goldMin: 18, goldMax: 29, xp: 24, minFloor: 9, maxFloor: 29 },
  kamaitachi2: { id: "kamaitachi2", ja: "かまいたち", image: "assets/enemies/kamaitachi2.png", hp: 28, atk: 11, def: 4, spd: 12, goldMin: 20, goldMax: 30, xp: 25, minFloor: 9, maxFloor: 29 },
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
  karasu_tengu: { id: "karasu_tengu", ja: "烏天狗", image: "assets/enemies/karasu_tengu.png", hp: 48, atk: 17, def: 7, spd: 14, goldMin: 24, goldMax: 36, xp: 42, minFloor: 24, maxFloor: 45, isFlying: true },
  yamauba2: { id: "yamauba2", ja: "山姥", image: "assets/enemies/yamauba2.png", hp: 56, atk: 16, def: 9, spd: 8, goldMin: 23, goldMax: 35, xp: 41, minFloor: 24, maxFloor: 45 },
  gyuki: { id: "gyuki", ja: "牛鬼", image: "assets/enemies/gyuki.png", hp: 70, atk: 19, def: 11, spd: 7, goldMin: 28, goldMax: 40, xp: 46, minFloor: 24, maxFloor: 45 },
  nue: { id: "nue", ja: "ぬえ", image: "assets/enemies/nue.png", hp: 52, atk: 18, def: 8, spd: 11, goldMin: 26, goldMax: 38, xp: 44, minFloor: 24, maxFloor: 45, isFlying: true },
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
  giou: { id: "giou", ja: "鵺王", image: "assets/enemies/giou.png", hp: 100, atk: 27, def: 15, spd: 11, goldMin: 44, goldMax: 62, xp: 80, minFloor: 38, maxFloor: 999 },
  kyubi_shin: { id: "kyubi_shin", ja: "九尾の狐(真)", image: "assets/enemies/kyubi_shin.png", hp: 95, atk: 30, def: 12, spd: 13, goldMin: 46, goldMax: 65, xp: 85, minFloor: 38, maxFloor: 999 },
  gashadokuro_shin: { id: "gashadokuro_shin", ja: "がしゃどくろ(真)", image: "assets/enemies/gashadokuro_shin.png", hp: 120, atk: 28, def: 16, spd: 8, goldMin: 47, goldMax: 66, xp: 86, minFloor: 38, maxFloor: 999 },
  yomi_no_onryo: { id: "yomi_no_onryo", ja: "黄泉の怨霊", image: "assets/enemies/yomi_no_onryo.png", hp: 88, atk: 32, def: 10, spd: 11, goldMin: 48, goldMax: 68, xp: 88, minFloor: 38, maxFloor: 999 },
  kishin_rasetsuo: { id: "kishin_rasetsuo", ja: "鬼神・羅刹王", image: "assets/enemies/kishin_rasetsuo.png", hp: 280, atk: 34, def: 18, spd: 12, goldMin: 220, goldMax: 320, xp: 420, minFloor: 42, maxFloor: 999, isBoss: true },

  // 大群系(isSwarm): 通常より小さく表示され、ステータスは同階層帯の通常種平均のおよそ4〜5割に抑えてある。
  // 遭遇時は2体で通常種1体ぶんの「枠」を埋める(pickEncounterForFloor参照)。階層帯は既存の40種と同じ4段階に対応
  // onHitInflict: 通常攻撃が命中するたび(大技を含まない毎ターンの攻撃)に確率で毒を蓄積させる。
  // かばう/挑発でタンク役が群れの攻撃を全て一身に受けると、複数体分の蓄積が重なって毒がすぐ危険域に達する
  // (槍士の「かばう」に対する天敵として設計。かばわず散らして受ければ1体あたりの蓄積は少ない)
  nurari_koumori: { id: "nurari_koumori", ja: "ぬらりこうもり", image: "assets/enemies/nurari_koumori.png", hp: 6, atk: 3, def: 0, spd: 9, goldMin: 3, goldMax: 5, xp: 5, minFloor: 1, maxFloor: 12, isSwarm: true, isFlying: true,
    onHitInflict: { type: "poison", chance: 0.4, value: 2, stacking: true } },
  chochin_obake: { id: "chochin_obake", ja: "提灯おばけ", image: "assets/enemies/chochin_obake.png", hp: 8, atk: 2, def: 1, spd: 5, goldMin: 3, goldMax: 6, xp: 5, minFloor: 1, maxFloor: 12, isSwarm: true },
  kawappa: { id: "kawappa", ja: "かわっぱ", image: "assets/enemies/kawappa.png", hp: 13, atk: 5, def: 2, spd: 6, goldMin: 10, goldMax: 14, xp: 11, minFloor: 9, maxFloor: 29, isSwarm: true },
  chibi_oni: { id: "chibi_oni", ja: "ちび鬼", image: "assets/enemies/chibi_oni.png", hp: 12, atk: 6, def: 1, spd: 7, goldMin: 10, goldMax: 16, xp: 12, minFloor: 9, maxFloor: 29, isSwarm: true },
  karakasa: { id: "karakasa", ja: "からかさ", image: "assets/enemies/karakasa.png", hp: 27, atk: 8, def: 4, spd: 6, goldMin: 13, goldMax: 18, xp: 19, minFloor: 24, maxFloor: 45, isSwarm: true },
  kogitsune: { id: "kogitsune", ja: "こぎつね", image: "assets/enemies/kogitsune.png", hp: 22, atk: 9, def: 3, spd: 13, goldMin: 13, goldMax: 18, xp: 20, minFloor: 24, maxFloor: 45, isSwarm: true },
  warashibe_ningyo: { id: "warashibe_ningyo", ja: "わらしべ人形", image: "assets/enemies/warashibe_ningyo.png", hp: 47, atk: 12, def: 6, spd: 5, goldMin: 22, goldMax: 28, xp: 35, minFloor: 38, maxFloor: 999, isSwarm: true },
  medama_kozou: { id: "medama_kozou", ja: "目玉こぞう", image: "assets/enemies/medama_kozou.png", hp: 40, atk: 14, def: 5, spd: 6, goldMin: 22, goldMax: 30, xp: 36, minFloor: 38, maxFloor: 999, isSwarm: true },

  // ==== 海岸ステージ(stage:"coast")。森とは別枠のプール(pickEnemyForFloorがstageで絞り込む)。====
  // 甲殻類/貝類は防御力を高めに設計し、森とは違う「硬い敵」の手触りを狙った。
  // 出血(bleed)は牙・刃物・突き技を持つ敵(鮫系・海賊骸骨・磯犬・魚人系)に優先的に持たせてある。
  // ---- 序盤(Lv1-10 / floor 1-12) ----
  iso_gani: { id: "iso_gani", ja: "磯ガニ", image: "assets/enemies/iso_gani.png", stage: "coast", hp: 14, atk: 4, def: 5, spd: 3, goldMin: 5, goldMax: 10, xp: 8, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 1.3, debuff: { type: "atkDown", chance: 0.4, value: 0.15, turns: 3 } },
    onHitInflict: { type: "bleed", chance: 0.2, value: 2 } }, // 大きなハサミで挟み、力を奪う。通常攻撃でも挟まれた傷が残る
  yadokari: { id: "yadokari", ja: "ヤドカリ", image: "assets/enemies/yadokari.png", stage: "coast", hp: 16, atk: 4, def: 5, spd: 4, goldMin: 5, goldMax: 11, xp: 8, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 1.2 } }, // 貝殻を盾に体当たり
  isozakana: { id: "isozakana", ja: "磯魚", image: "assets/enemies/isozakana.png", stage: "coast", hp: 7, atk: 2, def: 1, spd: 8, goldMin: 3, goldMax: 6, xp: 5, minFloor: 1, maxFloor: 12, isSwarm: true,
    bigAttack: { mult: 1.3 }, // 群れで行動する小魚。bigAttack未設定だと汎用フォールバックでランダムに毒等が乗ってしまうため明示的に設定(飛び跳ねての体当たりのみ、デバフなし)
    onHitInflict: { type: "bleed", chance: 1.0, valueMin: 1, valueMax: 2 } }, // 鋭い歯で噛みつき、通常攻撃で必ず出血1〜2を負わせる
  kurage_bou: { id: "kurage_bou", ja: "くらげ坊", image: "assets/enemies/kurage_bou.png", stage: "coast", hp: 13, atk: 4, def: 1, spd: 5, goldMin: 6, goldMax: 12, xp: 9, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 1.0, debuff: { type: "stun", chance: 0.45, turns: 1 } } }, // 触手でびりびり痺れさせる
  kaiyose: { id: "kaiyose", ja: "貝寄せ", image: "assets/enemies/kaiyose.png", stage: "coast", hp: 13, atk: 4, def: 5, spd: 3, goldMin: 6, goldMax: 12, xp: 9, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 1.3 },
    onHitInflict: { type: "bleed", chance: 0.2, value: 2 } }, // 貝殻を閉じて噛みつく。鋭い殻の縁が傷を残す
  hama_tako: { id: "hama_tako", ja: "浜タコ", image: "assets/enemies/hama_tako.png", stage: "coast", hp: 17, atk: 5, def: 3, spd: 6, goldMin: 8, goldMax: 14, xp: 10, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 1.0, debuff: { type: "spdDown", chance: 0.5, value: 0.2, turns: 3 } } }, // 足を絡めて動きを封じる
  kaisou_douji: { id: "kaisou_douji", ja: "海藻童子", image: "assets/enemies/kaisou_douji.png", stage: "coast", hp: 14, atk: 5, def: 2, spd: 9, goldMin: 8, goldMax: 14, xp: 10, minFloor: 1, maxFloor: 12, isPlant: true,
    bigAttack: { mult: 1.1 } }, // しなやかな体で攻め立てる
  harifugu: { id: "harifugu", ja: "ハリフグ", image: "assets/enemies/harifugu.png", stage: "coast", hp: 15, atk: 6, def: 2, spd: 5, goldMin: 8, goldMax: 15, xp: 11, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 1.5 } }, // 膨らんで針だらけの体で突進
  umineko: { id: "umineko", ja: "ウミネコ", image: "assets/enemies/umineko.png", stage: "coast", hp: 13, atk: 5, def: 1, spd: 10, goldMin: 9, goldMax: 15, xp: 11, minFloor: 1, maxFloor: 12, isFlying: true,
    bigAttack: { mult: 1.0, debuff: { type: "spdDown", chance: 0.4, value: 0.2, turns: 3 } } }, // 高速で急降下し、くちばしでつつく

  // ---- 中盤(Lv11-25 / floor 9-29) ----
  kaizoku_gaikotsu: { id: "kaizoku_gaikotsu", ja: "海賊骸骨", image: "assets/enemies/kaizoku_gaikotsu.png", stage: "coast", hp: 30, atk: 11, def: 5, spd: 8, goldMin: 18, goldMax: 29, xp: 24, minFloor: 9, maxFloor: 29,
    bigAttack: { mult: 1.1, debuff: { type: "bleed", chance: 0.5, value: 2 } } }, // 錆びた刀の一閃が傷を刻む
  iso_inu: { id: "iso_inu", ja: "磯犬", image: "assets/enemies/iso_inu.png", stage: "coast", hp: 27, atk: 12, def: 4, spd: 11, goldMin: 18, goldMax: 29, xp: 24, minFloor: 9, maxFloor: 29,
    onHitInflict: { type: "bleed", chance: 0.3, value: 1 } }, // 鋭い牙で何度も噛みつき、徐々に傷を負わせる
  oo_dako_1: { id: "oo_dako_1", ja: "大ダコ", image: "assets/enemies/oo_dako_1.png", stage: "coast", hp: 36, atk: 11, def: 5, spd: 6, goldMin: 20, goldMax: 30, xp: 26, minFloor: 9, maxFloor: 29,
    bigAttack: { mult: 1.2, debuff: { type: "defDown", chance: 0.5, value: 0.2, turns: 3 } } }, // 足で締め上げ、体勢を崩す
  iwa_gani: { id: "iwa_gani", ja: "岩ガニ", image: "assets/enemies/iwa_gani.png", stage: "coast", hp: 30, atk: 11, def: 9, spd: 5, goldMin: 19, goldMax: 29, xp: 24, minFloor: 9, maxFloor: 29,
    bigAttack: { mult: 1.4 },
    onHitInflict: { type: "bleed", chance: 0.2, value: 2 } }, // 岩の隙間から大きなハサミで挟み込む
  gyojin: { id: "gyojin", ja: "魚人", image: "assets/enemies/gyojin.png", stage: "coast", hp: 29, atk: 13, def: 5, spd: 9, goldMin: 20, goldMax: 31, xp: 26, minFloor: 9, maxFloor: 29,
    bigAttack: { mult: 1.1, debuff: { type: "bleed", chance: 0.45, value: 2 } } }, // 三叉槍の刺突が深い傷を残す
  shell_slime: { id: "shell_slime", ja: "シェルスライム", image: "assets/enemies/shell_slime.png", stage: "coast", hp: 32, atk: 10, def: 8, spd: 4, goldMin: 19, goldMax: 29, xp: 25, minFloor: 9, maxFloor: 29,
    bigAttack: { mult: 1.0, debuff: { type: "defDown", chance: 0.5, value: 0.2, turns: 3 } } }, // 体当たりの粘液が防具を溶かす
  kaisou_no_sei: { id: "kaisou_no_sei", ja: "海藻の精", image: "assets/enemies/kaisou_no_sei.png", stage: "coast", hp: 26, atk: 11, def: 4, spd: 7, goldMin: 18, goldMax: 28, xp: 24, minFloor: 9, maxFloor: 29, isPlant: true,
    onHitInflict: { type: "poison", chance: 0.35, value: 2 } }, // 触れた相手からじわじわ体力を奪う
  same: { id: "same", ja: "鮫", image: "assets/enemies/same.png", stage: "coast", hp: 28, atk: 13, def: 4, spd: 13, goldMin: 21, goldMax: 32, xp: 27, minFloor: 9, maxFloor: 29,
    bigAttack: { mult: 1.3, debuff: { type: "bleed", chance: 0.6, value: 2 } } }, // 群れの頂点、鋭い歯で嚙みちぎる
  iso_onna_1: { id: "iso_onna_1", ja: "磯女", image: "assets/enemies/iso_onna_1.png", stage: "coast", hp: 25, atk: 13, def: 4, spd: 8, goldMin: 20, goldMax: 31, xp: 26, minFloor: 9, maxFloor: 29,
    bigAttack: { mult: 1.1, debuff: { type: "spdDown", chance: 0.5, value: 0.25, turns: 3 } } }, // 伸びる髪で絡めとる
  oo_kai: { id: "oo_kai", ja: "大貝", image: "assets/enemies/oo_kai.png", stage: "coast", hp: 34, atk: 11, def: 9, spd: 3, goldMin: 20, goldMax: 30, xp: 25, minFloor: 9, maxFloor: 29,
    bigAttack: { mult: 1.4 },
    onHitInflict: { type: "bleed", chance: 0.2, value: 2 } }, // 貝殻を閉じて押しつぶす。鋭い殻の縁が傷を残す

  // ---- 後半(Lv26-40 / floor 24-45)、大蟹王は中ボス ----
  umibouzu: { id: "umibouzu", ja: "海坊主", image: "assets/enemies/umibouzu.png", stage: "coast", hp: 60, atk: 18, def: 9, spd: 6, goldMin: 25, goldMax: 37, xp: 43, minFloor: 24, maxFloor: 45,
    bigAttack: { mult: 0.5, ignoreGuardian: true } }, // 水しぶきが誰か1人の盾では防ぎきれず全体を飲み込む
  iso_onna_2: { id: "iso_onna_2", ja: "磯女", image: "assets/enemies/iso_onna_2.png", stage: "coast", hp: 54, atk: 19, def: 8, spd: 10, goldMin: 26, goldMax: 38, xp: 44, minFloor: 24, maxFloor: 45,
    bigAttack: { mult: 1.2, debuff: { type: "spdDown", chance: 0.55, value: 0.25, turns: 3 } } }, // 積年の怨念、伸びる髪で絡めとる
  iwagaki_ou: { id: "iwagaki_ou", ja: "岩ガキ翁", image: "assets/enemies/iwagaki_ou.png", stage: "coast", hp: 58, atk: 16, def: 13, spd: 4, goldMin: 24, goldMax: 36, xp: 42, minFloor: 24, maxFloor: 45,
    bigAttack: { mult: 1.3 } }, // 長年生きた殻は鎧のように硬い
  umihebi: { id: "umihebi", ja: "海蛇", image: "assets/enemies/umihebi.png", stage: "coast", hp: 50, atk: 19, def: 8, spd: 12, goldMin: 25, goldMax: 37, xp: 43, minFloor: 24, maxFloor: 45,
    onHitInflict: { type: "poison", chance: 0.35, value: 3 } }, // 鋭い牙の一噛みに毒を仕込む
  umigumo: { id: "umigumo", ja: "海蜘蛛", image: "assets/enemies/umigumo.png", stage: "coast", hp: 52, atk: 17, def: 9, spd: 8, goldMin: 24, goldMax: 36, xp: 42, minFloor: 24, maxFloor: 45,
    bigAttack: { mult: 1.1, debuff: { type: "stun", chance: 0.5, turns: 1 } } }, // 糸で動きを完全に封じる
  ryuuguu_no_shisha: { id: "ryuuguu_no_shisha", ja: "竜宮の使者", image: "assets/enemies/ryuuguu_no_shisha.png", stage: "coast", hp: 48, atk: 19, def: 8, spd: 13, goldMin: 26, goldMax: 38, xp: 44, minFloor: 24, maxFloor: 45,
    bigAttack: { mult: 1.2, debuff: { type: "bleed", chance: 0.5, value: 2 } } }, // 素早い三叉槍の突きが深い傷を刻む
  oo_dako_2: { id: "oo_dako_2", ja: "大ダコ", image: "assets/enemies/oo_dako_2.png", stage: "coast", hp: 62, atk: 18, def: 9, spd: 7, goldMin: 27, goldMax: 39, xp: 45, minFloor: 24, maxFloor: 45,
    bigAttack: { mult: 1.2, debuff: { type: "defDown", chance: 0.55, value: 0.25, turns: 3 } } }, // 岩場に潜む巨躯が締め上げる
  same_bito: { id: "same_bito", ja: "鮫人", image: "assets/enemies/same_bito.png", stage: "coast", hp: 54, atk: 20, def: 7, spd: 12, goldMin: 27, goldMax: 39, xp: 45, minFloor: 24, maxFloor: 45,
    bigAttack: { mult: 1.25, debuff: { type: "bleed", chance: 0.6, value: 2 } },
    onHitInflict: { type: "bleed", chance: 0.25, value: 1 } }, // 短剣と牙で敵を引き裂く、海の凶暴な戦士
  shinkai_no_bourei: { id: "shinkai_no_bourei", ja: "深海の亡霊", image: "assets/enemies/shinkai_no_bourei.png", stage: "coast", hp: 46, atk: 20, def: 6, spd: 10, goldMin: 26, goldMax: 38, xp: 44, minFloor: 24, maxFloor: 45,
    onHitInflict: { type: "poison", chance: 0.4, value: 3 } }, // 怨念の呪いが継続的に蝕む
  oo_kani_ou: { id: "oo_kani_ou", ja: "大蟹王", image: "assets/enemies/oo_kani_ou.png", stage: "coast", hp: 165, atk: 25, def: 16, spd: 7, goldMin: 90, goldMax: 130, xp: 150, minFloor: 26, maxFloor: 999, isBoss: true,
    bigAttack: { mult: 1.5, debuff: { type: "defDown", chance: 0.4, value: 0.2, turns: 3 } },
    onHitInflict: { type: "bleed", chance: 0.2, value: 2 } }, // 海岸の王、大鋏が鎧ごと粉砕する

  // ---- 終盤(Lv41-50 / floor 38〜)、海妖女王が最終ボス ----
  kaima_daiou: { id: "kaima_daiou", ja: "海魔大王", image: "assets/enemies/kaima_daiou.png", stage: "coast", hp: 95, atk: 29, def: 12, spd: 8, goldMin: 48, goldMax: 68, xp: 86, minFloor: 38, maxFloor: 999,
    bigAttack: { mult: 1.4, ignoreGuardian: true } }, // 大槍を薙ぎ払い、庇う相手ごと巻き込む
  youen_na_isoonna: { id: "youen_na_isoonna", ja: "妖艶な磯女", image: "assets/enemies/youen_na_isoonna.png", stage: "coast", hp: 85, atk: 27, def: 9, spd: 11, goldMin: 47, goldMax: 67, xp: 85, minFloor: 38, maxFloor: 999,
    bigAttack: { mult: 1.1, debuff: { type: "atkDown", chance: 0.55, value: 0.25, turns: 3 } } }, // 魅了の歌で敵を弱らせる
  kyokai_no_oodako: { id: "kyokai_no_oodako", ja: "巨海の大ダコ", image: "assets/enemies/kyokai_no_oodako.png", stage: "coast", hp: 105, atk: 28, def: 11, spd: 7, goldMin: 48, goldMax: 68, xp: 87, minFloor: 38, maxFloor: 999,
    bigAttack: { mult: 1.3, debuff: { type: "stun", chance: 0.35, turns: 1 } } }, // 八本の足で完全に絡め取る
  oni_harifugu: { id: "oni_harifugu", ja: "鬼ハリフグ", image: "assets/enemies/oni_harifugu.png", stage: "coast", hp: 88, atk: 27, def: 9, spd: 6, goldMin: 47, goldMax: 67, xp: 85, minFloor: 38, maxFloor: 999,
    bigAttack: { mult: 0.6, ignoreGuardian: true, debuff: { type: "poison", chance: 0.7, value: 3 } },
    onHitInflict: { type: "poison", chance: 0.3, value: 2 } }, // 針を飛ばして毒をばら撒く、巨大化したハリフグ
  oo_kani_shougun: { id: "oo_kani_shougun", ja: "大蟹将軍", image: "assets/enemies/oo_kani_shougun.png", stage: "coast", hp: 100, atk: 28, def: 15, spd: 6, goldMin: 48, goldMax: 68, xp: 86, minFloor: 38, maxFloor: 999,
    bigAttack: { mult: 1.5, debuff: { type: "defDown", chance: 0.4, value: 0.25, turns: 3 } },
    onHitInflict: { type: "bleed", chance: 0.2, value: 2 } }, // 海岸を支配する巨蟹の将、大鋏で叩き潰す
  kairyuu_ou: { id: "kairyuu_ou", ja: "海龍王", image: "assets/enemies/kairyuu_ou.png", stage: "coast", hp: 110, atk: 30, def: 13, spd: 10, goldMin: 50, goldMax: 70, xp: 90, minFloor: 38, maxFloor: 999,
    bigAttack: { mult: 1.3, debuff: { type: "stun", chance: 0.4, turns: 1 } },
    onHitInflict: { type: "bleed", chance: 0.2, value: 2 } }, // 潮を操り、雷撃を放つ海の統べ手。牙も鋭い
  same_no_bujin: { id: "same_no_bujin", ja: "鮫の武人", image: "assets/enemies/same_no_bujin.png", stage: "coast", hp: 92, atk: 30, def: 10, spd: 13, goldMin: 48, goldMax: 68, xp: 86, minFloor: 38, maxFloor: 999,
    bigAttack: { mult: 1.3, debuff: { type: "bleed", chance: 0.65, value: 2 } },
    onHitInflict: { type: "bleed", chance: 0.3, value: 1 } }, // 鎧を纏った人魚の戦士、鋭い歯と槍で敵を貫く
  umi_no_souryo: { id: "umi_no_souryo", ja: "海の僧侶", image: "assets/enemies/umi_no_souryo.png", stage: "coast", hp: 85, atk: 26, def: 10, spd: 9, goldMin: 47, goldMax: 67, xp: 85, minFloor: 38, maxFloor: 999,
    bigAttack: { mult: 1.2, debuff: { type: "atkDown", chance: 0.5, value: 0.2, turns: 3 } },
    onHitInflict: { type: "poison", chance: 0.4, value: 3 } }, // 呪詛の法術で敵を弱らせ、蝕む
  uzushio_no_onryou: { id: "uzushio_no_onryou", ja: "渦潮の怨霊", image: "assets/enemies/uzushio_no_onryou.png", stage: "coast", hp: 90, atk: 28, def: 9, spd: 9, goldMin: 47, goldMax: 67, xp: 85, minFloor: 38, maxFloor: 999,
    bigAttack: { mult: 0.55, ignoreGuardian: true, debuff: { type: "stun", chance: 0.4, turns: 1 } } }, // 渦潮に引き寄せ、庇う間もなく飲み込む
  kaiyoujo_ou: { id: "kaiyoujo_ou", ja: "海妖女王", image: "assets/enemies/kaiyoujo_ou.png", stage: "coast", hp: 300, atk: 36, def: 17, spd: 11, goldMin: 230, goldMax: 330, xp: 430, minFloor: 42, maxFloor: 999, isBoss: true,
    bigAttack: { mult: 1.3, debuff: { type: "poison", chance: 0.5, value: 3 } },
    onHitInflict: { type: "burn", chance: 0.25, turnsMin: 2, turnsMax: 3 } }, // 海岸の全てを支配する妖怪、強力な呪術で敵を滅ぼす
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
  oo_inoshishi: { desc: "猪の中でもひときわ巨大な個体。奉行所の討伐依頼で相まみえる中ボス。", bigAttackDesc: "渾身の突進。かばう仲間でもぎりぎり耐えられるかという凄まじい一撃。" },
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
  gashadokuro: { desc: "無数の骨が集まってできた巨大な怪物。中ボス級の強敵。" },
  kyubi_no_kitsune: { desc: "九本の尾を持つ古の妖狐。強大な妖力を操る中ボス級の強敵。" },
  // ---- 森・終盤(最後の1体は最終ボス) ----
  shuten_doji: { desc: "酒を好み、都を騒がせたという鬼の頭領。" },
  ibaraki_doji: { desc: "酒呑童子の腹心として知られる、屈強な鬼。" },
  dai_tengu: { desc: "天狗の中でも最強格とされる存在。神通力を操る。" },
  yamata_no_orochi: { desc: "八つの頭と尾を持つ伝説の大蛇。" },
  tamamo_no_mae: { desc: "絶世の美女に化けた、九尾の狐の化身。" },
  giou: { desc: "深き山に君臨するという、謎めいた王。" },
  kyubi_shin: { desc: "正体を現した、九尾の狐の真の姿。" },
  gashadokuro_shin: { desc: "無数の怨念を宿した、がしゃどくろの真の姿。" },
  yomi_no_onryo: { desc: "黄泉の国から現世に漏れ出た、強い恨みを持つ霊。" },
  kishin_rasetsuo: { desc: "深淵の森の最奥に君臨する、鬼神にして羅刹の王。最強格の強敵。" },
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
  oo_kani_ou: { desc: "海岸を支配する巨大な蟹の王。中ボス級の強敵。", bigAttackDesc: "巨大な鋏で鎧ごと粉砕する強烈な一撃。" },
  // ---- 海岸・終盤(最後の1体は最終ボス) ----
  kaima_daiou: { desc: "海の魔を統べる大王。", bigAttackDesc: "大槍を薙ぎ払い、庇う相手ごと巻き込む。" },
  youen_na_isoonna: { desc: "妖艶な姿で敵を誘い込む磯女の上位個体。", bigAttackDesc: "魅了の歌で敵を弱らせ、攻撃力を下げる。" },
  kyokai_no_oodako: { desc: "海を支配するほど巨大化したタコの妖怪。", bigAttackDesc: "八本の足で完全に絡め取り、スタンさせる。" },
  oni_harifugu: { desc: "鬼のように巨大化したハリフグ。針に毒を宿す。", bigAttackDesc: "無数の針を飛ばし、毒をばら撒く。" },
  oo_kani_shougun: { desc: "海岸を支配する巨蟹の将。", bigAttackDesc: "巨大な鋏で敵を叩き潰し、防御力を下げる。" },
  kairyuu_ou: { desc: "海を統べる龍の王。潮と雷撃を操る。", bigAttackDesc: "潮とともに雷撃を放ち、スタンさせる。" },
  same_no_bujin: { desc: "鎧を纏った鮫の戦士。槍と牙で敵を貫く。", bigAttackDesc: "槍と牙で敵を貫く連続攻撃。" },
  umi_no_souryo: { desc: "海に沈んだ僧侶の怨念。呪詛の法術を操る。", bigAttackDesc: "呪詛の法術で敵の力を弱める。" },
  uzushio_no_onryou: { desc: "渦潮に宿る怨霊。渡る者を引きずり込む。", bigAttackDesc: "渦潮に引き寄せ、庇う間もなくパーティ全体を飲み込む。" },
  kaiyoujo_ou: { desc: "海岸の全てを支配する妖怪の女王。最強格の強敵。", bigAttackDesc: "強力な呪術で敵を蝕む一撃。" },
};
function bestiaryTextFor(enemyId) {
  const t = ENEMY_BESTIARY_TEXT[enemyId] || {};
  return { desc: t.desc || "", bigAttackDesc: t.bigAttackDesc || BESTIARY_GENERIC_BIG_ATTACK_DESC };
}
// 図鑑の弱点表示。5種類: bleed(出血🩸,獣・動物系)/poison(毒☠️,人型系)/burn(炎上🔥,植物・木系)/
// flying(🪽,固定文言、遠距離攻撃で撃ち落とすと1ターンスタン)/spirit(霊力☯️,実体を持たない系、被ダメージ1.5倍固定・段階なし)。
// bleed/poison/burnはtier1/2があり、tier2は追加の効果を持つ(下記WEAKNESS_TIER_EFFECT参照)。
// 図鑑にはtierの数字自体は出さず、絵文字+個別のflavorテキストのみ表示する
const WEAKNESS_ICON = { bleed: "🩸", poison: "☠️", burn: "🔥", flying: "🪽", spirit: "☯️" };
const WEAKNESS_TIER_EFFECT = {
  bleed: { 1: "出血ダメージ2倍", 2: "出血ダメージ2倍、出血中は防御力30%低下" },
  poison: { 1: "毒ダメージ2倍", 2: "毒ダメージ2倍、毒状態になると大技が使用不能(詠唱・予告中は中断される)" },
  burn: { 1: "炎上ダメージ2倍", 2: "炎上ダメージ2倍、炎上が自然に消えない" },
};
const FLYING_WEAKNESS_TEXT = "遠距離攻撃で撃ち落とすと1ターンスタンする";
const ENEMY_WEAKNESS = {
  // ---- 森・序盤 ----
  yaken: { type: "bleed", tier: 2, flavor: "深手を負うと獰猛さを失い、防御が大きく低下する。" },
  inoshishi: { type: "bleed", tier: 2, flavor: "傷を負うと勢いが鈍り、防御が大きく低下する。" },
  dokuhebi: { type: "bleed", tier: 1, flavor: "傷口から体力を失いやすい。" },
  oogumo: { type: "burn", tier: 1, flavor: "巣や糸は炎に弱く、激しく燃え広がる。" },
  kodama: { type: "burn", tier: 2, flavor: "依代である木が燃えると、その力を維持できない。" },
  kappa: { type: "poison", tier: 1, flavor: "人に近い身体を持つため、毒がよく効く。" },
  hitotsume_kozo: { type: "poison", tier: 2, flavor: "妖力は体調に左右されやすく、毒で術が乱れる。" },
  bake_danuki: { type: "bleed", tier: 1, flavor: "傷を負うと化ける力が不安定になる。" },
  onibi: { type: "spirit", flavor: "霊力に非常に弱い。" },
  kamaitachi: { type: "bleed", tier: 2, flavor: "傷を負うと俊敏さを失い、防御が大きく低下する。" },
  // ---- 森・序盤の中ボス級 ----
  oo_inoshishi: { type: "bleed", tier: 2, flavor: "傷を負うと勢いが鈍り、防御が大きく低下する。" },
  q_arakuma: { type: "bleed", tier: 2, flavor: "深手を負うと獰猛さを失い、防御が大きく低下する。" },
  q_daija: { type: "bleed", tier: 1, flavor: "傷口から体力を失いやすい。" },
  q_oni: { type: "poison", tier: 1, flavor: "巨体でも毒の侵食には抗えない。" },
  q_gashadokuro: { type: "spirit", flavor: "骨だけの体は霊力に強く侵される。" },
  // ---- 森・中盤 ----
  ochimusha: { type: "poison", tier: 2, flavor: "生前と同じ肉体を宿しているため、毒で怨念が乱れる。" },
  kamaitachi2: { type: "bleed", tier: 2, flavor: "傷を負うと素早さを失い、防御が大きく低下する。" },
  youko: { type: "bleed", tier: 1, flavor: "傷を負うと幻術への集中が乱れやすい。" },
  rokurokubi: { type: "poison", tier: 2, flavor: "妖力は体調に左右されやすく、毒で術が乱れる。" },
  yukionna: { type: "burn", tier: 2, flavor: "冷気の妖力は炎に弱く、燃え続ける炎を嫌う。" },
  yamauba: { type: "poison", tier: 2, flavor: "老いた身体は毒に侵されると妖力を維持できない。" },
  tsuchigumo: { type: "burn", tier: 1, flavor: "巨大な巣は炎で簡単に焼き払われる。" },
  onryo: { type: "spirit", flavor: "実体を持たず、霊力に強く侵される。" },
  oomukade: { type: "burn", tier: 1, flavor: "硬い甲殻を持つが、炎には弱い。" },
  kasha: { type: "spirit", flavor: "妖火をまとう体は、霊力には抗えない。" },
  // ---- 森・後半 ----
  oni: { type: "poison", tier: 1, flavor: "巨体でも毒の侵食には抗えない。" },
  karasu_tengu: { type: "flying" },
  yamauba2: { type: "poison", tier: 2, flavor: "老いた身体は毒に侵されると妖力が乱れる。" },
  gyuki: { type: "bleed", tier: 2, flavor: "深い傷を負うと巨体を支えられず、防御が大きく低下する。" },
  nue: { type: "flying" },
  wanyudo: { type: "burn", tier: 1, flavor: "燃え盛る炎は逆に制御を乱し、力を暴走させる。" },
  gaikotsu_musha: { type: "spirit", flavor: "肉体を持たず、霊力に強く侵される。" },
  orochi: { type: "bleed", tier: 1, flavor: "傷口から体力を失いやすい。" },
  gashadokuro: { type: "spirit", flavor: "無数の骨が集う体は、霊力に強く侵される。" },
  kyubi_no_kitsune: { type: "bleed", tier: 2, flavor: "傷を負うと妖力への集中が乱れ、防御が大きく低下する。" },
  // ---- 森・終盤 ----
  shuten_doji: { type: "poison", tier: 1, flavor: "豪胆な鬼でも、毒は確実に身体を蝕む。" },
  ibaraki_doji: { type: "poison", tier: 1, flavor: "強靭な肉体も毒の侵食には抗えない。" },
  dai_tengu: { type: "poison", tier: 2, flavor: "強大な妖術ほど毒の影響を受けやすい。" },
  yamata_no_orochi: { type: "bleed", tier: 1, flavor: "巨大な身体ほど傷口から力を失いやすい。" },
  tamamo_no_mae: { type: "bleed", tier: 2, flavor: "傷を負うと妖力への集中が乱れ、防御が大きく低下する。" },
  giou: { type: "bleed", tier: 2, flavor: "巨体ゆえに深手を負うと動きが鈍り、防御が大きく低下する。" },
  kyubi_shin: { type: "bleed", tier: 2, flavor: "傷を負うと妖力への集中が乱れ、防御が大きく低下する。" },
  gashadokuro_shin: { type: "spirit", flavor: "骨だけで構成された巨体は、霊力に強く侵される。" },
  yomi_no_onryo: { type: "spirit", flavor: "肉体を持たず、霊力に強く侵される。" },
  kishin_rasetsuo: { type: "spirit", flavor: "鬼神の肉体も、霊力の前では無力に近い。" },
  // ---- 森・大群系 ----
  nurari_koumori: { type: "flying" },
  chochin_obake: { type: "burn", tier: 1, flavor: "提灯の紙と竹は炎に弱い。" },
  kawappa: { type: "poison", tier: 1, flavor: "子供の河童はまだ毒への耐性が乏しい。" },
  chibi_oni: { type: "poison", tier: 1, flavor: "幼い鬼はまだ毒への耐性が弱い。" },
  karakasa: { type: "burn", tier: 1, flavor: "古い傘の紙と骨は炎に弱い。" },
  kogitsune: { type: "bleed", tier: 1, flavor: "幼い狐は傷を負うと動きが乱れやすい。" },
  warashibe_ningyo: { type: "burn", tier: 1, flavor: "藁でできた体は炎に非常に弱い。" },
  medama_kozou: { type: "poison", tier: 1, flavor: "小さな体は毒の影響を受けやすい。" },
  // ---- 海岸・序盤 ----
  iso_gani: { type: "bleed", tier: 2, flavor: "殻に傷が入ると、防御が大きく低下する。" },
  yadokari: { type: "bleed", tier: 1, flavor: "殻から出た柔らかい体は傷つきやすい。" },
  isozakana: { type: "bleed", tier: 1, flavor: "小さな体は傷を負うと弱りやすい。" },
  kurage_bou: { type: "bleed", tier: 1, flavor: "傷つくと体液を失い、力が抜ける。" },
  kaiyose: { type: "bleed", tier: 1, flavor: "殻の隙間から傷を負いやすい。" },
  hama_tako: { type: "bleed", tier: 1, flavor: "柔らかい体は傷に弱い。" },
  kaisou_douji: { type: "burn", tier: 1, flavor: "海藻の体は乾くと燃えやすい。" },
  harifugu: { type: "bleed", tier: 1, flavor: "針の下の柔らかい体は傷に弱い。" },
  umineko: { type: "flying" },
  // ---- 海岸・中盤 ----
  kaizoku_gaikotsu: { type: "spirit", flavor: "白骨の体は、霊力に強く侵される。" },
  iso_inu: { type: "bleed", tier: 2, flavor: "傷を負うと獰猛さを失い、防御が大きく低下する。" },
  oo_dako_1: { type: "bleed", tier: 1, flavor: "柔らかい体は傷に弱い。" },
  iwa_gani: { type: "bleed", tier: 2, flavor: "岩のような殻も、傷が入れば防御が大きく低下する。" },
  gyojin: { type: "poison", tier: 1, flavor: "人に近い体を持つため、毒がよく効く。" },
  shell_slime: { type: "spirit", flavor: "液状の体は、霊力に強く侵される。" },
  kaisou_no_sei: { type: "burn", tier: 2, flavor: "依代の海藻が燃えると、その力を維持できない。" },
  same: { type: "bleed", tier: 2, flavor: "手負いになると狩りの精度を欠き、防御が大きく低下する。" },
  iso_onna_1: { type: "poison", tier: 2, flavor: "妖力は体調に左右されやすく、毒で術が乱れる。" },
  oo_kai: { type: "bleed", tier: 2, flavor: "殻を閉じる力も、傷を負えば大きく落ちる。" },
  // ---- 海岸・後半 ----
  umibouzu: { type: "spirit", flavor: "得体の知れない体は、霊力に強く侵される。" },
  iso_onna_2: { type: "poison", tier: 2, flavor: "積年の妖力は毒で大きく乱れる。" },
  iwagaki_ou: { type: "bleed", tier: 2, flavor: "長年の殻も、傷が入れば防御が大きく低下する。" },
  umihebi: { type: "bleed", tier: 1, flavor: "傷口から体力を失いやすい。" },
  umigumo: { type: "burn", tier: 1, flavor: "糸は炎に弱く、激しく燃え広がる。" },
  ryuuguu_no_shisha: { type: "poison", tier: 2, flavor: "妖力は毒に大きく乱される。" },
  oo_dako_2: { type: "bleed", tier: 1, flavor: "柔らかい体は傷に弱い。" },
  same_bito: { type: "poison", tier: 2, flavor: "人に近い体ほど、毒の影響を強く受ける。" },
  shinkai_no_bourei: { type: "spirit", flavor: "実体を持たず、霊力に強く侵される。" },
  oo_kani_ou: { type: "bleed", tier: 2, flavor: "巨大な鋏も、傷が入れば防御が大きく低下する。" },
  // ---- 海岸・終盤 ----
  kaima_daiou: { type: "poison", tier: 1, flavor: "王としての誇りも、毒には抗えない。" },
  youen_na_isoonna: { type: "poison", tier: 2, flavor: "妖艶な力ほど、毒に乱されやすい。" },
  kyokai_no_oodako: { type: "bleed", tier: 1, flavor: "巨躯でも柔らかい体は傷に弱い。" },
  oni_harifugu: { type: "bleed", tier: 1, flavor: "針の下の体は傷に弱い。" },
  oo_kani_shougun: { type: "bleed", tier: 2, flavor: "将としての威厳も、傷を負えば防御が大きく低下する。" },
  kairyuu_ou: { type: "bleed", tier: 1, flavor: "巨躯の龍でも、傷口から力を失う。" },
  same_no_bujin: { type: "poison", tier: 2, flavor: "人に近い体を持つ武人ほど、毒がよく効く。" },
  umi_no_souryo: { type: "poison", tier: 2, flavor: "人としての肉体は、毒の影響を色濃く受ける。" },
  uzushio_no_onryou: { type: "spirit", flavor: "実体を持たず、霊力に強く侵される。" },
  kaiyoujo_ou: { type: "poison", tier: 2, flavor: "女王としての誇り高き妖力も、毒には抗えない。" },
};
function enemyWeakness(enemyId) { return ENEMY_WEAKNESS[enemyId] || null; }
// 図鑑の1行の弱点表示テキスト(絵文字込み)を組み立てる。無ければnull
function bestiaryWeaknessLine(enemyId) {
  const w = ENEMY_WEAKNESS[enemyId];
  if (!w) return null;
  if (w.type === "flying") return `${WEAKNESS_ICON.flying}${FLYING_WEAKNESS_TEXT}`;
  return `${WEAKNESS_ICON[w.type]}${w.flavor}`;
}

// 支援物資: 道具屋ではなく出発画面(パーティ編成)で購入する消耗品。合計SUPPLY_CAP個までしか持てない
const ITEMS = {
  potion: { id: "potion", ja: "回復薬", price: 5, desc: "HPを少し回復する", image: "assets/items/potion.png" },
  smokeBomb: { id: "smokeBomb", ja: "煙玉", price: 15, desc: "その戦闘から即座に逃げる", image: "assets/items/smoke_bomb.png" },
  campingKit: { id: "campingKit", ja: "野営具", price: 50, desc: "簡易宿泊キット。夜を越すことができる", image: "assets/items/camping_kit.png" },
  onsenEgg: { id: "onsenEgg", ja: "温泉卵", price: 5, desc: "HPをほんの少し回復。ターンを消費しない(自分専用)", image: "assets/items/onsen_egg.png" },
  bomb: { id: "bomb", ja: "爆弾", price: 30, desc: "敵全体にダメージ", emoji: "💣" }, // 画像は未用意。imageが無い場合は絵文字で代用する
};
// 火薬庫で購入できる爆弾: 敵全体に防御無視の固定ダメージ(猪の実HP約62の6割=約37を基準に設定)
const BOMB_FLAT_DAMAGE = 37;
const POTION_HEAL_RATIO = 0.38;
// 温泉卵: 使ってもターンを消費しない自分専用の回復アイテム(仲間には使えない)。回復薬/煙玉と
// 同じ支援物資の共有枠(SUPPLY_CAP_BASE)を消費する
const ONSEN_EGG_HEAL_RATIO = 0.25;
// 野営具は回復薬/煙玉とは別枠で、最大CAMPING_KIT_CAP個までしか持てない(高価な特別アイテムのため)
const CAMPING_KIT_CAP = 1;
// 野営(野営具を使った時の休息)の効果: HP/MPを割合回復、ストレスを固定量回復
const CAMP_HP_RELIEF = 0.6;
const CAMP_MP_RELIEF = 0.45;
const CAMP_STRESS_RELIEF = 20;
// 野営中に選べる3行動のうち「慰める」のストレス軽減量
const CAMP_COMFORT_STRESS_RELIEF = 10;
// 茶屋(深淵の森15層、茶屋を建築済みの時だけ進路選択に必ず現れる休憩所)
const TEA_HOUSE_FLOOR = 15;
const TEAHOUSE_REST_COST = 30; // 一休みの利用料(G)
const TEAHOUSE_REST_HP_RATIO = 0.4;
const TEAHOUSE_REST_MP_RATIO = 0.4;
const TEAHOUSE_REST_CLOCK_MINUTES = 60; // 一休みで進む時間(1時間)
const TEAHOUSE_POTION_STOCK = 4; // 1回の来訪で買える回復薬の在庫数
const TEAHOUSE_SMOKEBOMB_STOCK = 1; // 1回の来訪で買える煙玉の在庫数
const TEAHOUSE_REST_MESSAGES = ["団子を食べて休憩した", "ちょっと一休みした", "お茶を飲んで休憩", "ちょっと疲れが取れた"];
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
      right: { name: "見切り", desc: "HPが50%以下の時、回避率+25%", mp: 0, passive: { conditionalMod: { cmp: "lte", value: 0.5, evasionAdd: 0.25 } } },
    },
    3: {
      left: { name: "連斬", desc: "会心を出した直後、次の自分の1ターンだけ攻撃力+20%", mp: 0, passive: { onCritSelfBuff: { stat: "atk", mult: 1.2 } } },
      right: { name: "気迫", desc: "HPが80%以上の間、被ダメージ12%減少", mp: 0, passive: { conditionalMod: { cmp: "gte", value: 0.8, dmgTakenMult: 0.88 } } },
    },
    4: {
      left: { name: "一閃", desc: "敵単体へ190%ダメージ、防御力25%無視", mp: 4, action: { kind: "damage", mult: 1.9, defPierce: 0.25 } },
      right: { name: "武士道", desc: "HPが50%以下の間、攻撃力・防御力+18%", mp: 0, passive: { conditionalMod: { cmp: "lte", value: 0.5, statMult: [{ stat: "atk", mult: 1.18 }, { stat: "def", mult: 1.18 }] } } },
    },
    5: {
      left: { name: "隙討ち", desc: "防御力が下がっている敵への会心率+22%", mp: 0, passive: { debuffCritBonus: { stat: "def", addRate: 0.22 } } },
      right: { name: "連携の呼吸", desc: "仲間がかばっている間、会心率+15%", mp: 0, passive: { allyGuardCritAdd: 0.15 } },
    },
    6: {
      left: { name: "剣豪", desc: "HPが50%以下の敵への会心率+25%", mp: 0, passive: { executeCritBonus: { belowPct: 0.5, addRate: 0.25 } } },
      right: { name: "不動", desc: "状態異常にかかる確率が50%減少する", mp: 0, passive: { statusResistMult: 0.5 } },
    },
    7: {
      left: { name: "疾風", desc: "自分より素早い相手から受けるダメージ-15%", mp: 0, passive: { fasterFoeDmgReduction: 0.15 } },
      right: { name: "鉄心", desc: "HPが満タンの間、被ダメージ10%減少", mp: 0, passive: { conditionalMod: { cmp: "gte", value: 1.0, dmgTakenMult: 0.9 } } },
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
      left: { name: "怯み討ち", desc: "スタン中の敵への会心率+30%", mp: 0, passive: { ailmentCritBonus: { ailment: "stun", addRate: 0.3 } } },
      right: { name: "毒刃", desc: "通常攻撃時、25%の確率で敵を毒状態にする(蓄積3)", mp: 0, passive: { onHitInflict: { type: "poison", chance: 0.25, value: 3 } } },
    },
    3: {
      left: { name: "変化の術", desc: "MPを消費し、カラス・ガマ・ヘビのいずれかに変身する。変身は戦闘不能になるか戦闘/野営/帰還を終えるまで持続し、任意で解除もできる。変身中はMP・ストレスの概念が無くなる代わりに通常の技が使えなくなる", mp: 5, action: { kind: "transform" } },
      right: { name: "スタン手裏剣", desc: "敵単体へ70%ダメージ、85%の確率でスタン(1ターン)", mp: 3, rangeType: "ranged", action: { kind: "damage", mult: 0.7, inflict: { type: "stun", chance: 0.85, turns: 1 } } },
    },
    4: {
      left: { name: "俊足", desc: "毒を負わせた敵への会心率+40%", mp: 0, passive: { ailmentCritBonus: { ailment: "poison", addRate: 0.4 } } },
      right: { name: "反射神経", desc: "回避に成功すると、次の自分の攻撃が確定会心になる", mp: 0, passive: { evadeCritCounter: true } },
    },
    5: {
      left: { name: "暗殺術", desc: "HPが50%以下の敵へのダメージ+30%", mp: 0, passive: { executeBonus: { belowPct: 0.5, mult: 1.3 } } },
      right: { name: "忍足", desc: "HPが30%以下の時、回避率+20%", mp: 0, passive: { conditionalMod: { cmp: "lte", value: 0.3, evasionAdd: 0.2 } } },
    },
    6: {
      left: { name: "影分身", desc: "回避に成功すると、次の自分の1ターンだけ攻撃力+20%", mp: 0, passive: { onEvadeSelfBuff: { stat: "atk", mult: 1.2 } } },
      right: { name: "分身", desc: "戦闘中1回だけ、攻撃を完全に回避する", mp: 0, passive: { onceGuardType: "dodgeOnce" } },
    },
    7: {
      left: { name: "修羅刃", desc: "敵を倒すと3ターンの間、攻撃力+20%", mp: 0, passive: { onKill: { statMult: [{ stat: "atk", mult: 1.2 }], turns: 3, maxStacks: 1 } } },
      right: { name: "幻惑", desc: "通常攻撃が命中した敵の防御力を10%下げる(3ターン)", mp: 0, passive: { onHitInflict: { type: "defDown", chance: 1.0, value: 0.1, turns: 3 } } },
    },
    8: {
      left: { name: "乱れ苦無", desc: "敵単体へ4連続攻撃(合計200%ダメージ)", mp: 5, action: { kind: "damage", mult: 2.0, hits: 4 } },
      right: { name: "影縫い", desc: "敵単体へ90%ダメージ、85%の確率でスタン", mp: 3, action: { kind: "damage", mult: 0.9, inflict: { type: "stun", chance: 0.85, turns: 1 } } },
    },
    9: {
      left: { name: "百鬼断", desc: "対象の状態異常の種類数に応じてダメージ増(1種につき+12%)", mp: 0, passive: { stackedWoundBonusPerAilment: 0.12 } },
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
      right: { name: "会心の返し", desc: "かばうが敵の攻撃を防いだ瞬間、確実に反撃する", mp: 0, passive: { guardCounter: true } },
    },
    3: {
      left: { name: "居合の構え", desc: "かばうが成功した直後、次の自分の攻撃が確定会心になる", mp: 0, passive: { guardCritCounter: true } },
      right: { name: "鼓舞の盾", desc: "かばうが成功した瞬間、3ターンの間味方全体の攻撃力+8%", mp: 0, passive: { guardPartyAtkBuff: 0.08 } },
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
      left: { name: "槍術皆伝", desc: "かばう体制中、攻撃力+15%", mp: 0, passive: { flagMod: { flag: "guarding", stat: "atk", mult: 1.15 } } },
      right: { name: "不屈", desc: "状態異常にかかる確率が40%減少する", mp: 0, passive: { statusResistMult: 0.4 } },
    },
    7: {
      left: { name: "心眼", desc: "かばうが成功するとMPが1回復する", mp: 0, passive: { guardMpRefund: true } },
      right: { name: "鋼の肉体", desc: "HPが50%以下の間、被ダメージ15%減少", mp: 0, passive: { conditionalMod: { cmp: "lte", value: 0.5, dmgTakenMult: 0.85 } } },
    },
    8: {
      left: { name: "迅雷突き", desc: "敵単体へ210%ダメージ", mp: 4, action: { kind: "damage", mult: 2.1 } },
      right: { name: "守護陣", desc: "4ターンの間、味方全体の防御力+15%", mp: 5, action: { kind: "buffParty", stats: [{ stat: "def", mult: 1.15 }], turns: 4 } },
    },
    9: {
      left: { name: "槍鬼", desc: "敵を倒すたび攻撃力+12%(最大3回まで重複)", mp: 0, passive: { onKill: { statMult: [{ stat: "atk", mult: 1.12 }], turns: 20, maxStacks: 3 } } },
      right: { name: "金剛", desc: "かばう成功時の被ダメージをさらに20%軽減する", mp: 0, passive: { extraGuardMitigation: 0.8 } },
    },
    10: {
      left: { name: "天穿槍", desc: "敵単体へ290%ダメージ、防御力45%無視", mp: 7, action: { kind: "damage", mult: 2.9, defPierce: 0.45 } },
      right: { name: "仁王立ち", desc: "5ターンの間、防御力+35%、被ダメージ25%減少、毎ターンHP5%回復", mp: 6, action: { kind: "buffSelf", stats: [{ stat: "def", mult: 1.35 }, { stat: "dmgTaken", mult: 0.75 }], turns: 5, hpRegenPct: 0.05 } },
    },
  },
  naginata: {
    2: {
      left: { name: "援護薙ぎ", desc: "仲間がかばっている間、与えるダメージ+12%", mp: 0, passive: { allyGuardDmgMult: 1.12 } },
      right: { name: "足払い", desc: "敵単体へ90%ダメージ、85%の確率でスタン(1ターン)", mp: 2, action: { kind: "damage", mult: 0.9, inflict: { type: "stun", chance: 0.85, turns: 1 } } },
    },
    3: {
      left: { name: "円舞", desc: "崩し・威圧などでデバフを受けている敵へのダメージ+20%", mp: 0, passive: { woundBonus: { mult: 1.2, ailment: "debuff" } } },
      right: { name: "崩し", desc: "通常攻撃が命中した敵の防御力を15%下げる(3ターン)", mp: 0, passive: { onHitInflict: { type: "defDown", chance: 0.3, value: 0.15, turns: 3 } } },
    },
    4: {
      left: { name: "旋風薙ぎ", desc: "敵全体へ100%ダメージ", mp: 4, action: { kind: "damage", aoe: true, mult: 1.0 } },
      right: { name: "威圧", desc: "通常攻撃が命中した敵の攻撃力を15%下げる(3ターン)", mp: 0, passive: { onHitInflict: { type: "atkDown", chance: 0.3, value: 0.15, turns: 3 } } },
    },
    5: {
      left: { name: "拍子外し", desc: "素早さが下がっている敵への会心率+25%", mp: 0, passive: { debuffCritBonus: { stat: "spd", addRate: 0.25 } } },
      right: { name: "舞姫", desc: "回避に成功すると、次の自分の1ターンだけ回避率+20%", mp: 0, passive: { onEvadeSelfBuff: { stat: "evasionAdd", mult: 0.2 } } },
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
      left: { name: "狙撃", desc: "敵単体へ170%ダメージ、3ターンの間その敵の被ダメージ+10%(パーティ全員に有効)", mp: 3, action: { kind: "damage", mult: 1.7, inflict: { type: "dmgTakenUp", chance: 1.0, value: 0.1, turns: 3 } } },
      right: { name: "急所への一撃", desc: "通常攻撃で25%の確率で出血1〜3を付与", mp: 0, passive: { onHitInflict: { type: "bleed", chance: 0.25, valueMin: 1, valueMax: 3 } } },
    },
    3: {
      left: { name: "二連射", desc: "敵単体へ2連続攻撃(合計150%ダメージ)", mp: 3, comboTag: "rapidFire", action: { kind: "damage", mult: 1.5, hits: 2 } },
      right: { name: "麻痺の矢", desc: "敵単体へ70%ダメージ、90%の確率でスタン", mp: 3, action: { kind: "damage", mult: 0.7, inflict: { type: "stun", chance: 0.90, turns: 1 } } },
    },
    4: {
      left: { name: "傷口狙い", desc: "状態異常(毒・炎上・スタン・沈黙・能力低下等)を負っている敵へのダメージ+25%", mp: 0, passive: { woundBonus: { mult: 1.25 } } },
      right: { name: "鷹を呼ぶ", desc: "鷹を呼び出し、一緒に戦わせる。鷹の攻撃は敵を出血させる。仲間を守らせることもできる。", mp: 3, action: { kind: "summonHawk", turns: 8 } },
    },
    5: {
      left: { name: "急所連撃", desc: "対象の状態異常の種類数に応じてダメージ増(1種につき+10%)", mp: 0, passive: { stackedWoundBonusPerAilment: 0.1 } },
      right: { name: "追い討ち", desc: "出血中の敵を通常攻撃すると、相手に出血スタックを3付与する", mp: 0, passive: { bleedFollowupOnHit: true } },
    },
    6: {
      left: { name: "狙撃術", desc: "HPが90%以上の敵への会心率+15%", mp: 0, passive: { executeCritBonus: { belowPct: 0.9, addRate: 0.15, cmp: "gte" } } },
      right: { name: "捕縛", desc: "通常攻撃が命中した敵の素早さを20%下げる(3ターン)", mp: 0, passive: { onHitInflict: { type: "spdDown", chance: 0.25, value: 0.2, turns: 3 } } },
    },
    7: {
      left: { name: "連射の心得", desc: "二連射を使った直後、次の自分の1ターンだけ攻撃力+20%", mp: 0, passive: { comboFollowup: { tag: "rapidFire", stat: "atk", mult: 1.2 } } },
      right: { name: "狩猟本能", desc: "HPが50%以下の敵へのダメージ+25%", mp: 0, passive: { executeBonus: { belowPct: 0.5, mult: 1.25 } } },
    },
    8: {
      left: { name: "必中撃ち", desc: "敵単体へ210%ダメージ。この攻撃は必ず命中する", mp: 4, action: { kind: "damage", mult: 2.1, guaranteedHit: true } },
      right: { name: "腐食毒", desc: "通常攻撃が命中した敵の防御力を20%下げる(3ターン)", mp: 0, passive: { onHitInflict: { type: "defDown", chance: 0.2, value: 0.2, turns: 3 } } },
    },
    9: {
      left: { name: "弱者狩り", desc: "攻撃力が下がっている敵への会心率+30%", mp: 0, passive: { debuffCritBonus: { stat: "atk", addRate: 0.3 } } },
      right: { name: "貫き矢", desc: "敵単体へ130%ダメージ。敵を倒した場合、余ったダメージを残りHPが一番低い別の敵1体に分け与える(貫通は最大2体まで、そこから先には連鎖しない)", mp: 2, action: { kind: "damage", mult: 1.3, overkillPierce: true } },
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
    2: {
      left: { name: "火遁符", desc: "敵単体へ140%の魔法ダメージ、25%の確率で炎上(3ターン)を付与", mp: 3, action: { kind: "damage", mult: 1.4, useMag: true, inflict: { type: "burn", chance: 0.25, turns: 3 } } },
      right: { name: "呪縛符", desc: "通常攻撃時、25%の確率で敵を炎上状態にする(3ターン)", mp: 0, passive: { onHitInflict: { type: "burn", chance: 0.25, turns: 3 } } },
    },
    3: {
      left: { name: "水遁符", desc: "敵全体へ85%の魔法ダメージ", mp: 5, action: { kind: "damage", aoe: true, mult: 0.85, useMag: true } },
      right: { name: "結界術", desc: "3ターンの間、味方全体の防御力+15%", mp: 4, comboTag: "kekkai", action: { kind: "buffParty", stats: [{ stat: "def", mult: 1.15 }], turns: 3 } },
    },
    4: {
      left: { name: "雷遁符", desc: "敵単体へ110%の魔法ダメージ、85%の確率でスタン", mp: 4, action: { kind: "damage", mult: 1.1, useMag: true, inflict: { type: "stun", chance: 0.85, turns: 1 } } },
      right: { name: "衰弱符", desc: "敵単体へ80%の魔法ダメージ、3ターンの間防御力-20%", mp: 3, action: { kind: "damage", mult: 0.8, useMag: true, inflict: { type: "defDown", chance: 1.0, value: 0.2, turns: 3 } } },
    },
    5: {
      left: { name: "呪符の見切り", desc: "回避に成功すると、次の自分の1ターンだけ術の威力+20%", mp: 0, passive: { onEvadeSelfBuff: { stat: "mag", mult: 1.2 } } },
      right: { name: "封魔符", desc: "敵単体へ60%の魔法ダメージ、85%の確率でスタン", mp: 3, action: { kind: "damage", mult: 0.6, useMag: true, inflict: { type: "stun", chance: 0.85, turns: 1 } } },
    },
    6: {
      left: { name: "陰陽融合", desc: "炎上している敵への魔法ダメージ+15%", mp: 0, passive: { woundBonus: { mult: 1.15, ailment: "burn" } } },
      right: { name: "式神召喚", desc: "結界術を使った直後、次の自分の1ターンだけ魔法威力+15%", mp: 0, passive: { comboFollowup: { tag: "kekkai", stat: "mag", mult: 1.15 } } },
    },
    7: {
      left: { name: "天地鳴動", desc: "敵全体へ110%の魔法ダメージ", mp: 6, action: { kind: "damage", aoe: true, mult: 1.1, useMag: true } },
      right: { name: "厄災", desc: "HPが30%以下の敵への魔法ダメージ+15%", mp: 0, passive: { executeBonus: { belowPct: 0.3, mult: 1.15 } } },
    },
    8: {
      left: { name: "陰陽極意", desc: "スタン中の敵への会心率+20%", mp: 0, passive: { ailmentCritBonus: { ailment: "stun", addRate: 0.2 } } },
      right: { name: "呪詛", desc: "通常攻撃時、20%の確率で敵を炎上状態にする(3ターン)", mp: 0, passive: { onHitInflict: { type: "burn", chance: 0.2, turns: 3 } } },
    },
    9: {
      left: { name: "衰弱撃ち", desc: "防御力が下がっている敵への会心率+25%", mp: 0, passive: { debuffCritBonus: { stat: "def", addRate: 0.25 } } },
      right: { name: "霊脈支配", desc: "結界術を使った直後、次の自分の1ターンだけ防御力+15%", mp: 0, passive: { comboFollowup: { tag: "kekkai", stat: "def", mult: 1.15 } } },
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
  samurai: { left: "剣豪", right: "明鏡" },
  ninja: { left: "暗殺", right: "幻影" },
  spearman: { left: "破軍", right: "守護" },
  naginata: { left: "戦舞", right: "制圧" },
  hunter: { left: "狙撃", right: "狩猟" },
  gunner: { left: "徹甲", right: "爆炎" },
  onmyoji: { left: "五行", right: "呪詛" },
  priest: { left: "奇跡", right: "神恩" },
};
const SUPPLY_CAP_BASE = 10; // 支援物資(回復薬+煙玉の合計)は一度の遠征で最大10個まで持てる(鞄屋を建てるとsupplyCap()でこれに加算される)

// 神社の奉納祈願: 魂のかけらをこの個数納めるとお守りガチャを1回引ける
const SHRINE_OFFER_SOUL_SHARD_COST = 3;
const ONIBI_SOUL_SHARD_DROP_CHANCE = 0.30; // 鬼火撃破時に魂のかけらをドロップする確率
// 温泉の湯守りキャラクター。温泉画面を開くたびランダムな一言を喋る(renderOnsen参照)
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
  { id: "ebisu", name: "恵比寿神の御守", tier: 1, desc: "勝利時10%でボーナスゴールド+30%", effect: { type: "battleWinGoldBonusChance", chance: 0.10, mult: 1.30 } },
  { id: "okuninushi", name: "大国主命の御守", tier: 1, desc: "戦闘終了後12%でストレスを5回復", effect: { type: "battleEndStressReliefChance", chance: 0.12, amount: 5 } },
  { id: "fukurokuju", name: "福禄寿の御守", tier: 1, desc: "探索で「進む」を押すたびに、全員のHPを2回復", effect: { type: "onAdvanceHealAll", amount: 2 } },
  // ---- tier2 ----
  { id: "inari", name: "稲荷大神の御守", tier: 2, desc: "敵の攻撃を回避する確率が常時+5%", effect: { type: "evasionAddFlat", value: 0.05 } },
  { id: "benzaiten", name: "弁財天の御守", tier: 2, desc: "撃破時、低確率でその戦闘のゴールドが2倍になる", effect: { type: "battleWinGoldDoubleChance", chance: 0.10 } },
  { id: "konohanasakuya", name: "木花咲耶姫の御守", tier: 2, desc: "回復薬を使っても20%の確率で消費しない", effect: { type: "potionNoConsumeChance", chance: 0.20 } },
  { id: "shinatsuhiko", name: "志那都比古神の御守", tier: 2, desc: "煙玉を使っても35%の確率で消費しない", effect: { type: "smokeBombNoConsumeChance", chance: 0.35 } },
  // ---- tier3 ----
  { id: "takemikazuchi", name: "建御雷神の御守", tier: 3, desc: "戦闘中、最初の通常攻撃が命中した時に確定でスタンを付与する", effect: { type: "firstNormalAttackHitStun", turns: 1 } },
  { id: "tsukuyomi", name: "月読命の御守", tier: 3, desc: "夜の戦闘は開始時60%で先制する", effect: { type: "nightFirstStrikeChance", chance: 0.60 } },
  { id: "takemikazuchi2", name: "武甕槌命の御守", tier: 3, desc: "戦闘中、最初の通常攻撃が確定で会心になる", effect: { type: "firstNormalAttackGuaranteedCrit" } },
  // ---- tier4 ----
  { id: "amaterasu", name: "天照大神の御守", tier: 4, desc: "毎回戦闘終了後に、全員のHPを10%回復", effect: { type: "battleEndHealAllPct", pct: 0.10 } },
  { id: "yatagarasu", name: "八咫烏の御守", tier: 4, desc: "通常攻撃・技の命中率が常時+12%", effect: { type: "accuracyAddFlat", value: 0.12 } },
  { id: "izanagi", name: "伊邪那岐命の御守", tier: 4, desc: "戦闘中最初に受けた状態異常を打ち消す", effect: { type: "firstAilmentReceivedBlocked" } },
  { id: "izanami", name: "伊邪那美命の御守", tier: 4, desc: "戦闘中最初に与える状態異常が+2される", effect: { type: "firstAilmentInflictedBonus", value: 2 } },
  { id: "susanoo", name: "須佐之男命の御守", tier: 4, desc: "戦闘中、最初に戦闘不能級の一撃を受けた時、誰かがHP1で耐える(パーティ共有、確定)", effect: { type: "firstLethalHitSurviveAt1Shared" } },
  { id: "hachiman", name: "八幡神の御守", tier: 4, desc: "戦闘中最初に使う技のMP消費が0", effect: { type: "firstSkillFreeMp" } },
  { id: "sarutahiko", name: "猿田彦神の御守", tier: 4, desc: "戦闘開始時確定で、1ターンだけ味方全体の攻撃力+25%・素早さ+25%", effect: { type: "battleStartPartyBuff", stats: [{ stat: "atk", mult: 1.25 }, { stat: "spd", mult: 1.25 }], turns: 1 } },
  { id: "omononushi", name: "大物主神の御守", tier: 4, desc: "ボスを倒すと必ず魂のかけらを落とす", effect: { type: "bossKillGuaranteedShard" } },
  { id: "yatanokagami", name: "八咫鏡の御守", tier: 4, desc: "戦闘中、最初に敵が大技を放った時にそれを無効化し、想定ダメージの50%を反射する", effect: { type: "firstBigAttackReflect", pct: 0.50 } },
  { id: "amenominakanushi", name: "天之御中主神の御守", tier: 4, desc: "毎戦闘終了後にMP1回復", effect: { type: "battleEndRestoreMp", amount: 1 } },
];
function omamoriById(id) { return OMAMORI_LIST.find((o) => o.id === id); }
// 未所持のお守りだけからtier重み付きで1つ抽選する(全て所持済みならnullを返す)
function drawOmamori(ownedIds) {
  const unowned = OMAMORI_LIST.filter((o) => !ownedIds.includes(o.id));
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

// 戦闘不能で瀕死になったキャラは、実際のゲーム内時間(絶対分数)が経過するとロストする。
// 町へ帰る/宿泊するタイミングだけでなく、ダンジョン内を歩き回っている間の時計の進みも
// そのまま消費される。この範囲でランダムに決まる猶予を過ぎると誰も救出に来なくてもロストする
// (旧2〜4=1〜2日分→4〜6=2〜3日分→5〜7半日=2.5〜3.5日ときて、時間ベースに再設計した)
const CRITICAL_MIN_HOURS = 50;
const CRITICAL_MAX_HOURS = 74;

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

const FATIGUE_PER_FLOOR = 2; // フィールドに出ているキャラが1階進むごとに溜まる疲労度(旧4から半減)
// 戦闘から逃げ延びるとストレスが溜まる。「進む→戦闘が出たら即逃げる」を繰り返すだけで
// レベルに関係なく無限に深く潜れてしまう抜け道への対策(繰り返すほどストレスが蓄積し、
// いずれ発狂で行動不能になったり弱体化したりして無傷では続けられなくする)
const FLEE_STRESS_PENALTY = 5;
const FATIGUE_MAX = 100;

// 温泉: 宿屋では抜けなくなった疲労度を回復するための有料施設。1回で半分(50)回復する。
// 料金はレベル1で20G、以降レベルごとに8Gずつ上がる。入浴すると2時間はパーティ編成に組み込めなくなる(宿泊は引き続き可能)
const ONSEN_FATIGUE_RELIEF = 50;
const ONSEN_FLAT_COST = 20;
const ONSEN_COST_PER_LEVEL = 8;
const ONSEN_LOCK_MINUTES = 120; // 2時間 = 120分
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
const ENEMY_ATK_MULT = 0.8;
// 敵のHPだけをさらに1割弱体化する倍率(大群系isSwarmは元々ステータス控えめな雑魚のため対象外)
const ENEMY_HP_MULT = 0.9;
// 大群系(isSwarm)の敵だけ、上記ENEMY_ATK_MULTの弱体化を踏まえた現状値からさらに攻撃力を1割強化する倍率
const ENEMY_SWARM_ATK_MULT = 1.1;
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

// 敵の「大技」システム: 通常攻撃を2回→3回目は予告(通常攻撃はする)→4回目で大技発動、のサイクルを
// 繰り返す。複数体が同時に予告/発動しないよう、戦闘開始時に各敵の開始位置を0〜2からランダムにずらす
// (BIG_ATTACK_CYCLE_LENGTH-1=予告ターン、以降は0からのカウントで割った余りで判定)。
// 大技は味方全体を巻き込む代わりに1体あたりの威力を下げてある(BIG_ATTACK_MULT)
const BIG_ATTACK_CYCLE_LENGTH = 4;
const BIG_ATTACK_MULT = 0.65; // 大技の1体あたりの威力(通常攻撃比)
const BIG_ATTACK_DOT_REDUCTION = 0.15; // 敵が毒/炎上状態の間、大技の威力をさらに下げる(削る対抗策)
const BIG_ATTACK_EXPOSED_BONUS = 1.2; // 予告中(bigAttackPending)の敵へは、プレイヤーの与ダメージが増える(押し切る対抗策)
// 大技は命中した対象ごとに独立して、この確率で追加のデバフも1つ付与する(スタンはAOEで全員に
// 入ると強すぎるため対象外。単発の攻撃力/防御力/素早さダウンと毒/炎上のみを候補にしてある)
const BIG_ATTACK_DEBUFF_CHANCE = 0.35;
const BIG_ATTACK_DEBUFF_POOL = ["atkDown", "defDown", "spdDown", "poison", "burn", "bleed"];

// 奉行所: 序盤(floor1-12)の10種の敵をそれぞれ討伐対象にした依頼。全部を一度に張り出さず、
// QUEST_BOARD_SIZE枚だけを毎日ランダムに選んで張り替える(indexHtml側のrefreshMagistrateQuestsIfNeeded参照)。
// 受注制(同時に1件まで)。受注すると、深淵の森でtargetFloorに到達した時にcount体の群れが確定出現し、
// 倒すと即達成→報酬(帰還後のリザルト画面に表示)、というモンハンの緊急依頼のような1本道の設計にしてある
const QUEST_DEFS = {
  yaken: { emoji: "🐺", requester: "街道番・源蔵", title: "野犬どもを追い払え！", text: "街道を野犬の群れがうろつき、旅人が通れなくなっています。被害が広がる前に追い払ってください。", targetFloor: 3, count: 3 },
  inoshishi: { emoji: "🐗", requester: "農家・徳兵衛", title: "大猪の討伐", text: "山から現れた大きな猪が畑を荒らし回っています。このままでは収穫が望めません。どうか討伐をお願いします。", targetFloor: 5, count: 1, spawnId: "oo_inoshishi", chaseText: "大猪が追いかけてきた！", rewardGold: 70 },
  dokuhebi: { emoji: "🐍", requester: "水番・お咲", title: "水場に潜む毒", text: "村の水場に大きな毒蛇が棲みつきました。子どもたちも近寄れず困っています。退治をお願いします。", targetFloor: 5, count: 2 },
  oogumo: { emoji: "🕷", requester: "旅籠主人・宗吉", title: "糸に閉ざされた古道", text: "山道一面が蜘蛛の巣で覆われ、人が通れなくなりました。巣の主を退治してください。", targetFloor: 6, count: 1 },
  kodama: { emoji: "🌳", requester: "山守・弥助", title: "森の異変", text: "最近、森へ入った者が何人も襲われています。木が動いたと言う者もいますが、本当かどうかは分かりません…。原因を突き止めてください。", targetFloor: 4, count: 2 },
  kappa: { emoji: "🐢", requester: "漁師・浜吉", title: "川辺の怪", text: "川へ近づく者が何者かに水へ引きずり込まれそうになっています。姿を見た者はおらず、皆おびえています。", targetFloor: 5, count: 1 },
  hitotsume_kozo: { emoji: "👁", requester: "寺子屋師匠・文左衛門", title: "夜道の怪影", text: "子どもたちが「大きな目玉の化け物を見た」と泣きながら帰ってきます。本当にいるのか確かめていただけませんか。", targetFloor: 6, count: 2 },
  bake_danuki: { emoji: "🦝", requester: "旅商人・喜兵衛", title: "消えない山道", text: "山道で何度歩いても同じ場所へ戻ってしまいます。何かに化かされているとしか思えません…。", targetFloor: 7, count: 1 },
  onibi: { emoji: "🔥", requester: "墓守・源次", title: "夜に漂う青い火", text: "夜になると青白い火が現れ、人々は誰も近づけません。あれが何なのか調べてください。", targetFloor: 6, count: 3 },
  kamaitachi: { emoji: "🦦", requester: "木こり・新八", title: "風が人を斬る", text: "山へ入ると、突然体中に切り傷ができます。誰も姿を見た者はいません。どうか原因を突き止めてください。", targetFloor: 8, count: 2 },
};
const QUEST_BOARD_SIZE = 3; // 張り出される依頼の最大枚数。1件目は確定、2件目はQUEST_BOARD_SECOND_SLOT_CHANCE、
// 3件目は(2件目が出た場合のみ)QUEST_BOARD_THIRD_SLOT_CHANCEの抽選で、毎日必ず3件揃うとは限らないようにしてある
const QUEST_BOARD_SECOND_SLOT_CHANCE = 0.75;
const QUEST_BOARD_THIRD_SLOT_CHANCE = 0.5;
const QUEST_COOLDOWN_DAYS = 5; // 一度張り出された依頼は、外れてから最低この日数が経つまで再抽選の対象にならない
const QUEST_DEADLINE_DAYS = 2; // 受注してからこの日数以内に達成しないと失敗扱いになる
const QUEST_CONTRACT_FEE_DIVISOR = 5; // 契約金 = 報酬金 ÷ この値(受注時に前払いし、達成時に全額返還される。失敗/取り下げ時は没収)
const QUEST_GOLD_PER_FLOOR = 8; // 討伐依頼の報酬金は「目標階層×この値」で計算する(到達階層が深い依頼ほど高額になる)
const QUEST_REWARD_MULT = 0.9; // 奉行所の依頼報酬を1割減らす調整用倍率(固定報酬の破綻寸前救済クエストは対象外)
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
  targetFloor: 3, rewardGold: 25, itemName: "薬草",
};
const RESCUE_QUEST_GOLD_THRESHOLD = 20; // 所持金がこれ以下
const RESCUE_QUEST_MAX_ACTIVE_MEMBERS = 1; // 稼働中(瀕死・ロストを除く)の仲間がこの人数以下の時だけ張り出される
// 確定戦闘(大猪等)から討伐せず逃げた場合、以後どのフロアでも(進む/帰還どちらでも)floor移動のたびに
// この確率で追いかけてきて再戦闘になる(state.acceptedQuest.chasing、indexHtml側のtryForceQuestEncounter参照)
const CHASE_ENCOUNTER_CHANCE = 0.6;

// 奉行所: 緊急依頼(序盤のボス級、questOnly:trueの専用個体を名指しで討伐する特別枠)。
// 通常の討伐依頼(QUEST_DEFS)とは別枠で、同時に1件だけ発生する。解禁条件は2段階:
// ①大猪(猪の依頼で出てくる中ボス、QUEST_DEFS.inoshishi.spawnId)を1度は討伐済みであること(一生モノの
//   フラグ、state.defeatedOoInoshishi)②その上で、大猪以外の通常討伐依頼をEMERGENCY_QUEST_CLEAR_THRESHOLD件
// クリアするたびに1件発生する(indexHtml側のmaybeTriggerEmergencyQuest参照)。
// 一番最初に発生する緊急依頼は必ず荒熊(q_arakuma)、以降はランダム
const EMERGENCY_QUEST_DEFS = {
  q_arakuma: { emoji: "🐻", requester: "街道番・源蔵", title: "緊急依頼『森の主』", text: "山へ向かった者が誰一人戻ってきません。現場には巨大な爪痕と足跡だけが残されていました。あれは普通の熊ではありません。どうか森の主を討ち倒してください。" },
  q_daija: { emoji: "🐍", requester: "庄屋・善兵衛", title: "緊急依頼『川を塞ぐ影』", text: "川へ近づいた者が次々と姿を消しています。生き残った者は巨大な蛇を見たと震えています。村へ現れる前に討伐してください。奉行所より緊急依頼です。" },
  q_oni: { emoji: "👹", requester: "山番・五郎", title: "緊急依頼『山に棲む怪物』", text: "山小屋が跡形もなく壊されていました。人の仕業とは思えない力です。このままでは村まで被害が及びます。どうか討伐をお願いします。" },
  q_gashadokuro: { emoji: "💀", requester: "墓守・源次", title: "緊急依頼『夜鳴きの怪』", text: "夜になると山奥から骨の軋む音が聞こえます。音を追った者は誰一人帰ってきません。正体は誰にも分かりません。どうかこの怪異を止めてください。" },
};
const EMERGENCY_QUEST_CLEAR_THRESHOLD = 3; // 通常の討伐依頼をこの件数クリアするたびに緊急依頼が1件発生する
const EMERGENCY_QUEST_ENCOUNTER_CHANCE = 0.25; // 発生中、戦闘の遭遇のたびに指名の的が代わりに出てくる確率
const EMERGENCY_QUEST_REWARD_GOLD = 150;
const EMERGENCY_QUEST_REWARD_XP = 80;

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
  bigAttackPending: { icon: "⚡", title: "大技の構え", desc: "次の自分のターンに強力な一撃(大技)を放つ構えに入っている。" },
  guarding: { icon: "🛡", title: "かばう", desc: "仲間の代わりに攻撃を引き受け、被ダメージを軽減する。" },
  carrying: { icon: "🎒", title: "担いでいる", desc: "瀕死の仲間を担いでいる。素早さが下がり、攻撃・技が使えなくなる。" },
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
    formSkill: { key: "marunomi", name: "丸呑み", desc: "ボス・中ボス以外の敵単体を2ターンの間丸呑みにして行動不能にする(クールタイム6ターン)", cooldown: 6, swallowTurns: 2 },
  },
  hebi: {
    ja: "ヘビ", emoji: "🐍", image: "assets/transform/hebi.png",
    hpMult: 1, atkMult: 1.1, defMult: 1.1, spdMult: 0.9,
    onHitPoison: 3,
    formSkill: { key: "datsupi", name: "脱皮", desc: "HPを50%回復し、状態異常を全て取り除く(クールタイム6ターン)", cooldown: 6, healPct: 0.5 },
  },
};
// 変身中は普段の性格セリフの代わりに、formごとの鳴き声を喋る
const TRANSFORM_ANIMAL_SOUNDS = {
  karasu: ["カーカー！", "カァ…", "カーッ！"],
  gama: ["ゲロゲロ…", "ゲコッ！", "グルル…"],
  hebi: ["シャー…", "シャアッ！", "シュル…"],
};

if (typeof module !== "undefined") {
  module.exports = {
    CLASSES, ABILITY_LABEL, ABILITY_DESC, ENEMIES, ITEMS, EQUIPMENT, CRITICAL_MIN_HOURS, CRITICAL_MAX_HOURS,
    PERSONALITIES, DIALOGUE_LINES, DIALOGUE_CHANCE, DANGER_FLOOR_LEVEL_MULT, SPEECH_BUBBLE_DURATION_MS,
    FATIGUE_PER_FLOOR, FATIGUE_MAX, FLEE_STRESS_PENALTY, ONSEN_FATIGUE_RELIEF, ONSEN_FLAT_COST, ONSEN_COST_PER_LEVEL, ONSEN_LOCK_MINUTES, LODGE_FATIGUE_RELIEF, MAX_LEVEL, ENEMY_ATK_MULT, ENEMY_HP_MULT, ENEMY_SWARM_ATK_MULT,
    ENEMY_SCALE, ENEMY_DEF_SCALE, SWARM_ENCOUNTER_CHANCE, BURN_DAMAGE_PCT,
    BASE_ACCURACY, EVASION_SPD_BASELINE, EVASION_SPD_FACTOR, EVASION_MAX, MIN_HIT_CHANCE, STUN_RESIST_TURNS, STUN_RESIST_MULT,
    BIG_ATTACK_CYCLE_LENGTH, BIG_ATTACK_MULT, BIG_ATTACK_DOT_REDUCTION, BIG_ATTACK_EXPOSED_BONUS,
    BIG_ATTACK_DEBUFF_CHANCE, BIG_ATTACK_DEBUFF_POOL, SKILL_TREES,
    CAMPING_KIT_CAP, CAMP_HP_RELIEF, CAMP_MP_RELIEF, CAMP_STRESS_RELIEF, CAMP_COMFORT_STRESS_RELIEF,
    CAMP_WEAPON_CARE_ATK_MULT, CAMP_WEAPON_CARE_BATTLES, STATUS_TOOLTIPS,
    TRANSFORM_FORMS, TRANSFORM_ANIMAL_SOUNDS,
    RESCUE_QUEST_DEF, RESCUE_QUEST_GOLD_THRESHOLD, RESCUE_QUEST_MAX_ACTIVE_MEMBERS,
    QUEST_BOARD_SECOND_SLOT_CHANCE, QUEST_BOARD_THIRD_SLOT_CHANCE, QUEST_COOLDOWN_DAYS,
    QUEST_DEADLINE_DAYS, QUEST_CONTRACT_FEE_DIVISOR, questContractFee,
  };
}
