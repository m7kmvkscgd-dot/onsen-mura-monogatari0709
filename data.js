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

// 職業ごとのざっくりとした説明文(ゲーム開始時の最初の1人選び画面で表示する)
const CLASS_DESC = {
  samurai: "会心の一撃を得意とする単体特化の剣士。攻撃力・防御力ともに高水準で扱いやすい。",
  ninja: "抜群の素早さで先手を取り、奇襲で一撃を狙う俊敏な戦士。",
  spearman: "高いHPと防御力を誇り、「かばう」で仲間を守る守護者。",
  naginata: "薙ぎ払いで敵全体を攻撃できる範囲特化の武人。",
  hunter: "抜群の命中率と会心の一矢で急所を突く弓使い。",
  gunner: "圧倒的な火力の砲撃を放つが、撃った次のターンは装填で動けなくなる。",
  onmyoji: "呪符ノ術(単体)・大祓ノ術(全体)を操る魔法職。打たれ弱いが火力は高い。",
  priest: "治癒の術で仲間のHPを回復する支援役。",
};

// ゲーム開始時に最初の1人を選んだ時だけ、性格をランダムではなく職業ごとに固定する
const FIRST_CHARACTER_PERSONALITY = {
  samurai: "真面目",
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
    真面目: ["立て直そう。", "冷静に。", "まだ戦える。", "気を抜くな。"],
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
    真面目: ["決まりました。", "効いています。", "成功です。", "この調子です。", "成功です。", "順調です。", "作戦どおりです。", "効果ありです。", "決まりました。", "このままいきます。"],
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
    真面目: ["見事です。", "効いています。", "いい一撃です。", "この調子です。", "見事です。", "効果的です。", "素晴らしいです。", "順調ですね。", "完璧です。", "この調子です。"],
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
    真面目: ["いきます。", "油断は禁物です。", "慎重に。", "始めましょう。"],
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
    真面目: ["一体撃破。", "次へ進みます。", "順調です。", "油断は禁物です。", "任務継続。", "確実にいきます。", "落ち着いて進もう。", "この調子です。", "撃破しました。", "任務完了です。", "次へ進みます。", "順調です。", "この調子です。", "片付きました。"],
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
    真面目: ["勝利しました。", "任務完了です。", "無事に終わりました。", "よく戦いました。", "次へ進みましょう。", "油断は禁物です。", "順調です。", "お疲れさまでした。", "作戦成功です。", "勝利を確認しました。"],
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
};

// 吹き出しセリフの発生確率。selfSkillHit/allySkillHit、selfPinch/allyPinchは同じイベントの
// 抽選(どちらが発言するか)に使うので同じ値を共有する
const DIALOGUE_CHANCE = {
  skillHit: 0.30, // 全体で30%発動、発動時は自分/仲間のどちらが発言するか50%ずつ抽選(=各15%)
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
  dokuhebi: { id: "dokuhebi", ja: "毒蛇", image: "assets/enemies/dokuhebi.png", hp: 13, atk: 6, def: 2, spd: 7, goldMin: 6, goldMax: 12, xp: 9, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 0.9, debuff: { type: "poison", chance: 1.0, value: 3 } } }, // 威力は控えめだが必ず毒を注入する
  oogumo: { id: "oogumo", ja: "大蜘蛛", image: "assets/enemies/oogumo.png", hp: 17, atk: 5, def: 3, spd: 6, goldMin: 8, goldMax: 14, xp: 10, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 1.1, debuff: { type: "stun", chance: 0.5, turns: 1 } } }, // 糸で絡め取り、高確率で行動を封じる
  kodama: { id: "kodama", ja: "木霊", image: "assets/enemies/kodama.png", hp: 15, atk: 5, def: 2, spd: 5, goldMin: 6, goldMax: 12, xp: 9, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 0.9, debuff: { type: "atkDown", chance: 0.5, value: 0.15, turns: 3 } } }, // 精気を吸い、力を奪う
  kappa: { id: "kappa", ja: "河童", image: "assets/enemies/kappa.png", hp: 16, atk: 5, def: 3, spd: 6, goldMin: 8, goldMax: 14, xp: 10, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 1.0, debuff: { type: "defDown", chance: 0.5, value: 0.15, turns: 3 } } }, // 相撲さながらに組み伏せ、構えを崩す
  hitotsume_kozo: { id: "hitotsume_kozo", ja: "一つ目小僧", image: "assets/enemies/hitotsume_kozo.png", hp: 14, atk: 5, def: 2, spd: 8, goldMin: 8, goldMax: 14, xp: 10, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 1.0, debuff: { type: "spdDown", chance: 0.4, value: 0.2, turns: 3 } } }, // 不気味な一つ目で睨まれ、竦んで動きが鈍る
  bake_danuki: { id: "bake_danuki", ja: "化け狸", image: "assets/enemies/bake_danuki.png", hp: 18, atk: 5, def: 3, spd: 6, goldMin: 9, goldMax: 15, xp: 11, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 0.9, debuff: { type: "silence", chance: 0.45, turns: 2 } } }, // 幻術で惑わし、技を封じる
  onibi: { id: "onibi", ja: "鬼火", image: "assets/enemies/onibi.png", hp: 12, atk: 5, def: 1, spd: 7, goldMin: 9, goldMax: 15, xp: 11, minFloor: 1, maxFloor: 12,
    // 燃え盛る炎そのもの。大技は誰か1人を庇っても防ぎきれない燃え広がる炎として、かばう/挑発を無視して
    // 必ず全体を巻き込む(ignoreGuardian)。その代わり単体特化の大技より威力は抑えめ、通常攻撃も
    // 全体攻撃力を20%落とした代わりに、通常攻撃自体にも延焼(30%)を持たせてある
    bigAttack: { mult: 0.4, ignoreGuardian: true, debuff: { type: "burn", chance: 1.0, turnsMin: 2, turnsMax: 3 } },
    onHitInflict: { type: "burn", chance: 0.3, turnsMin: 2, turnsMax: 3 } },
  kamaitachi: { id: "kamaitachi", ja: "鎌鼬", image: "assets/enemies/kamaitachi.png", hp: 16, atk: 6, def: 2, spd: 10, goldMin: 11, goldMax: 18, xp: 13, minFloor: 1, maxFloor: 12,
    bigAttack: { mult: 1.0, debuff: { type: "defDown", chance: 0.55, value: 0.2, turns: 3 } } }, // 鎌鼬の一閃が鎧ごと切り裂く

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
  // onHitInflict: 通常攻撃が命中するたび(大技を含まない毎ターンの攻撃)に確率で毒を蓄積させる。
  // かばう/挑発でタンク役が群れの攻撃を全て一身に受けると、複数体分の蓄積が重なって毒がすぐ危険域に達する
  // (槍士の「かばう」に対する天敵として設計。かばわず散らして受ければ1体あたりの蓄積は少ない)
  nurari_koumori: { id: "nurari_koumori", ja: "ぬらりこうもり", image: "assets/enemies/nurari_koumori.png", hp: 6, atk: 3, def: 0, spd: 9, goldMin: 3, goldMax: 5, xp: 5, minFloor: 1, maxFloor: 12, isSwarm: true,
    onHitInflict: { type: "poison", chance: 0.4, value: 2, stacking: true } },
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
  potion: { id: "potion", ja: "回復薬", price: 5, desc: "HPを少し回復する", image: "assets/items/potion.png" },
  smokeBomb: { id: "smokeBomb", ja: "煙玉", price: 15, desc: "その戦闘から即座に逃げる", image: "assets/items/smoke_bomb.png" },
  campingKit: { id: "campingKit", ja: "野営具", price: 50, desc: "簡易宿泊キット。夜を越すことができる", image: "assets/items/camping_kit.png" },
  onsenEgg: { id: "onsenEgg", ja: "温泉卵", price: 5, desc: "HPをほんの少し回復。ターンを消費しない(自分専用)", image: "assets/items/onsen_egg.png" },
};
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
      left: { name: "剣圧", desc: "会心率+15%", mp: 0, passive: { critRateAdd: 0.15 } },
      right: { name: "心眼", desc: "命中率+15%", mp: 0, passive: { accuracyAdd: 0.15 } },
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
      left: { name: "急所狙い", desc: "会心率+15%", mp: 0, passive: { critRateAdd: 0.15 } },
      right: { name: "毒刃", desc: "通常攻撃時、25%の確率で敵を毒状態にする(蓄積3)", mp: 0, passive: { onHitInflict: { type: "poison", chance: 0.25, value: 3 } } },
    },
    3: {
      left: { name: "影斬り", desc: "敵単体へ170%ダメージ", mp: 3, action: { kind: "damage", mult: 1.7 } },
      right: { name: "スタン手裏剣", desc: "敵単体へ70%ダメージ、85%の確率でスタン(1ターン)", mp: 3, action: { kind: "damage", mult: 0.7, inflict: { type: "stun", chance: 0.85, turns: 1 } } },
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
      right: { name: "挑発", desc: "3ターンの間、敵から必ず狙われるようになり、防御力+15%", mp: 2, action: { kind: "buffSelf", stats: [{ stat: "def", mult: 1.15 }], turns: 3, tauntTurns: 3 } },
    },
    3: {
      left: { name: "豪槍", desc: "挑発中、攻撃力+20%", mp: 0, passive: { flagMod: { flag: "tauntTurns", stat: "atk", mult: 1.2 } } },
      right: { name: "鉄壁", desc: "防御力+15%", mp: 0, passive: { defMult: 1.15 } },
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
      left: { name: "警戒", desc: "挑発中、回避率+15%", mp: 0, passive: { flagMod: { flag: "tauntTurns", stat: "evasionAdd", mult: 0.15 } } },
      right: { name: "鋼の肉体", desc: "HPが50%以下の間、被ダメージ15%減少", mp: 0, passive: { conditionalMod: { cmp: "lte", value: 0.5, dmgTakenMult: 0.85 } } },
    },
    8: {
      left: { name: "迅雷突き", desc: "敵単体へ210%ダメージ", mp: 4, action: { kind: "damage", mult: 2.1 } },
      right: { name: "守護陣", desc: "4ターンの間、味方全体の防御力+15%", mp: 5, action: { kind: "buffParty", stats: [{ stat: "def", mult: 1.15 }], turns: 4 } },
    },
    9: {
      left: { name: "槍鬼", desc: "敵を倒すたび攻撃力+12%(最大3回まで重複)", mp: 0, passive: { onKill: { statMult: [{ stat: "atk", mult: 1.12 }], turns: 20, maxStacks: 3 } } },
      right: { name: "金剛", desc: "挑発中、被ダメージ20%減少", mp: 0, passive: { flagMod: { flag: "tauntTurns", stat: "dmgTaken", mult: 0.8 } } },
    },
    10: {
      left: { name: "天穿槍", desc: "敵単体へ290%ダメージ、防御力45%無視", mp: 7, action: { kind: "damage", mult: 2.9, defPierce: 0.45 } },
      right: { name: "仁王立ち", desc: "5ターンの間、防御力+35%、被ダメージ25%減少、毎ターンHP5%回復", mp: 6, action: { kind: "buffSelf", stats: [{ stat: "def", mult: 1.35 }, { stat: "dmgTaken", mult: 0.75 }], turns: 5, hpRegenPct: 0.05 } },
    },
  },
  naginata: {
    2: {
      left: { name: "円月の構え", desc: "薙ぎ払いの威力+10%", mp: 0, passive: { atkMult: 1.1 } },
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
      left: { name: "追刃", desc: "会心率+15%", mp: 0, passive: { critRateAdd: 0.15 } },
      right: { name: "舞姫", desc: "回避に成功すると、次の自分の1ターンだけ回避率+20%", mp: 0, passive: { onEvadeSelfBuff: { stat: "evasionAdd", mult: 0.2 } } },
    },
    6: {
      left: { name: "乱舞", desc: "敵全体へ2連続攻撃(合計130%ダメージ)", mp: 5, action: { kind: "damage", aoe: true, mult: 1.3, hits: 2 } },
      right: { name: "流水", desc: "回避に成功すると、次の自分の1ターンだけ攻撃力+15%", mp: 0, passive: { onEvadeSelfBuff: { stat: "atk", mult: 1.15 } } },
    },
    7: {
      left: { name: "豪舞", desc: "HPが70%以上の間、攻撃力+12%", mp: 0, passive: { conditionalMod: { cmp: "gte", value: 0.7, statMult: [{ stat: "atk", mult: 1.12 }] } } },
      right: { name: "制圧の心得", desc: "防御力+10%", mp: 0, passive: { defMult: 1.1 } },
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
      right: { name: "毒矢", desc: "敵単体へ110%ダメージ、確実に毒状態にする(蓄積5)", mp: 3, action: { kind: "damage", mult: 1.1, inflict: { type: "poison", chance: 1.0, value: 5 } } },
    },
    3: {
      left: { name: "二連射", desc: "敵単体へ2連続攻撃(合計150%ダメージ)", mp: 3, comboTag: "rapidFire", action: { kind: "damage", mult: 1.5, hits: 2 } },
      right: { name: "スタン矢", desc: "敵単体へ70%ダメージ、85%の確率でスタン", mp: 3, action: { kind: "damage", mult: 0.7, inflict: { type: "stun", chance: 0.85, turns: 1 } } },
    },
    4: {
      left: { name: "急所狙い", desc: "毒を負わせた敵への会心率+20%", mp: 0, passive: { ailmentCritBonus: { ailment: "poison", addRate: 0.2 } } },
      right: { name: "傷口狙い", desc: "状態異常(毒・炎上・スタン・沈黙・能力低下等)を負っている敵へのダメージ+25%", mp: 0, passive: { woundBonus: { mult: 1.25 } } },
    },
    5: {
      left: { name: "鷹の目", desc: "命中率+10%、会心ダメージ+15%", mp: 0, passive: { accuracyAdd: 0.1, critDmgAdd: 0.15 } },
      right: { name: "弱点看破", desc: "炎上している敵へのダメージ+20%", mp: 0, passive: { woundBonus: { mult: 1.2, ailment: "burn" } } },
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
      left: { name: "射手の極意", desc: "会心率+15%、会心ダメージ+25%", mp: 0, passive: { critRateAdd: 0.15, critDmgAdd: 0.25 } },
      right: { name: "百歩穿楊", desc: "HPが50%以下の敵への会心率+10%", mp: 0, passive: { executeCritBonus: { belowPct: 0.5, addRate: 0.1 } } },
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
      left: { name: "照準", desc: "命中率+15%", mp: 0, passive: { accuracyAdd: 0.15 } },
      right: { name: "焼夷弾", desc: "通常攻撃時、20%の確率で敵を炎上状態にする(3ターン)", mp: 0, passive: { onHitInflict: { type: "burn", chance: 0.2, turns: 3 } } },
    },
    6: {
      left: { name: "装填術", desc: "土嚢展開の間、技のMP消費-30%", mp: 0, passive: { discountWhileFlag: { statModName: "reloadImmune", pct: 0.3 } } },
      right: { name: "爆風拡大", desc: "装填中、素早さ+20%", mp: 0, passive: { flagMod: { flag: "reloading", stat: "spd", mult: 1.2 } } },
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
      left: { name: "五行の理", desc: "術の威力+10%", mp: 0, passive: { atkMult: 1.1 } },
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
      left: { name: "四神加護", desc: "会心ダメージ+30%", mp: 0, passive: { critDmgAdd: 0.3 } },
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
// 料金は一人あたり定額。入浴すると2時間はパーティ編成に組み込めなくなる(宿泊は引き続き可能)
const ONSEN_FATIGUE_RELIEF = 50;
const ONSEN_FLAT_COST = 20;
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
const BIG_ATTACK_DEBUFF_POOL = ["atkDown", "defDown", "spdDown", "poison", "burn"];

if (typeof module !== "undefined") {
  module.exports = {
    CLASSES, ABILITY_LABEL, ABILITY_DESC, ENEMIES, ITEMS, EQUIPMENT, CRITICAL_MIN_HOURS, CRITICAL_MAX_HOURS,
    PERSONALITIES, DIALOGUE_LINES, DIALOGUE_CHANCE, DANGER_FLOOR_LEVEL_MULT, SPEECH_BUBBLE_DURATION_MS,
    FATIGUE_PER_FLOOR, FATIGUE_MAX, FLEE_STRESS_PENALTY, ONSEN_FATIGUE_RELIEF, ONSEN_FLAT_COST, ONSEN_LOCK_MINUTES, LODGE_FATIGUE_RELIEF, MAX_LEVEL, ENEMY_ATK_MULT, ENEMY_HP_MULT, ENEMY_SWARM_ATK_MULT,
    ENEMY_SCALE, ENEMY_DEF_SCALE, SWARM_ENCOUNTER_CHANCE, BURN_DAMAGE_PCT,
    BASE_ACCURACY, EVASION_SPD_BASELINE, EVASION_SPD_FACTOR, EVASION_MAX, MIN_HIT_CHANCE, STUN_RESIST_TURNS, STUN_RESIST_MULT,
    BIG_ATTACK_CYCLE_LENGTH, BIG_ATTACK_MULT, BIG_ATTACK_DOT_REDUCTION, BIG_ATTACK_EXPOSED_BONUS,
    BIG_ATTACK_DEBUFF_CHANCE, BIG_ATTACK_DEBUFF_POOL, SKILL_TREES,
    CAMPING_KIT_CAP, CAMP_HP_RELIEF, CAMP_MP_RELIEF, CAMP_STRESS_RELIEF, CAMP_COMFORT_STRESS_RELIEF,
    CAMP_WEAPON_CARE_ATK_MULT, CAMP_WEAPON_CARE_BATTLES,
  };
}
