# BGM出典記録

素材の利用条件・出典を記録する台帳(2026-07-31新設)。新しい外部BGMを導入したらここへ追記する。
ユーザー自身が提供・制作した音源(town/dungeon/coast等の既存BGM)は記録対象外。

## おまつりばやし(assets/bgm/omatsuri_bayashi_bgm.mp3)

- 用途: 奉行所クエスト「笑わぬ祭の面売り」専用ルート(warawanu_matsuri)の探索・戦闘BGM
- 曲名: おまつりばやし(OMATSURI BAYASHI)/使用版: Track 2(太鼓・打楽器の導入後に笛が始まる版)
- 作曲者: 蒲鉾さちこ
- 配布元: DOVA-SYNDROME
- 楽曲ページ: https://dova-s.jp/bgm/detail/19295
- ライセンス: https://dova-s.jp/help/articles/license/ (有償・無償ゲームの背景音楽として商用利用可、クレジット表記任意)
- 禁止事項: 音源単体の再配布・販売、Content ID等への登録、AI学習利用
- SHA-256: 0B16E3437D4D34DB5D88C065D234A000C7B5556CF87293DB47D541AC7DB10B61
- 原稿: assets/quest_raw/hyakumenshi_utsuro/music_source.md(納品時の原本)
- クレジット表記は任意だが、ゲーム内の「製作者より」等に記載する場合は「BGM: 蒲鉾さちこ(DOVA-SYNDROME)」

## 和風ホラーな曲(assets/bgm/kaerazu_wafuu_horror_bgm.mp3)

- 用途: 奉行所クエスト「帰らずの湯治宿」専用ルート(kaerazu_tojiyado)の探索・戦闘BGM
- 曲名: 和風ホラーな曲(尺1分35秒、配布元でのループ対応: 非対応=ゲーム側はloop属性で頭から繰り返し)
- 作曲者: ハヤシユウ
- 配布元: DOVA-SYNDROME
- 楽曲ページ: https://dova-s.jp/bgm/detail/12583
- ライセンス: https://dova-s.jp/help/articles/license/ (商用ゲーム背景音楽利用可、クレジット任意)
- 原稿: assets/quest_raw/wasureyu_oshira/music_source.md(納品時の原本。audio_plan.jsonの多層ミックス案は
  既存音声機構の範囲外のため不採用、単一トラック通し再生で組み込み)
- クレジット記載する場合は「BGM: ハヤシユウ(DOVA-SYNDROME)」

## 第二形態解放の雷鳴SE(assets/sfx/phase2_thunder.mp3)

- 用途: ボス第二形態シーケンス(暗転が明けた瞬間の雷鳴)。奉行所クエストの物語ボス共通
- 元素材: "Nosferatu thunderclap"(Richard Humphries)
- 配布元: Wikimedia Commons https://commons.wikimedia.org/wiki/File:Nosferatu_thunderclap_-_Richard_Humphries.wav
- ライセンス: CC-BY 4.0(要クレジット)。クレジット記載は「Thunder SE: Richard Humphries (CC-BY 4.0)」
- 加工: 頭の無音3.1秒をカット(暗転明けと同時に鳴るように)+7秒へ切り出し+正規化(2026-08-01、選定はユーザー試聴mock_thunder_pick.htmlの雷9)
- 候補10本の切り出し元はassets/sfx/thunder_pick/(不採用分。整理してよい)
