// ============ audio.js: 音声(BGM/環境音/効果音) ============
// ============ 音声 ============
// 場面ごとに曲を切り替える。ダンジョン探索と戦闘はかつて「冒険中」として同じ曲を共有していたが、
// 戦闘の緊張感を出すため、この曲(dungeon/dungeon_night)は戦闘中だけ流し、戦闘終了時にフェードアウトする
// 「戦闘専用BGM」に変更した。探索中は下の虫の声アンビエント(AMBIENT_BGM_TRACKS)だけが流れる
const BGM_TRACKS = {
  town: "assets/bgm/town_bgm.mp3",
  town_dawn: "assets/bgm/town_dawn_bgm.mp3", // 朝(dawn)の時間帯だけ町で流れる専用BGM
  town_night: "assets/bgm/town_night_bgm.mp3", // 夜(night)の時間帯だけ町で流れる専用BGM
  dungeon: "assets/bgm/dungeon_bgm.mp3",
  dungeon_night: "assets/bgm/dungeon_night_bgm.mp3", // 夜(night)の時間帯だけ戦闘で流れる専用BGM
  // 海岸ステージ: 森と同じ構造(探索用coast/coast_night、戦闘専用coast_battle)。
  // 戦闘開始でplayBattleBgm()がcoast_battleに切り替え、戦闘終了でstopBattleBgm()が探索用BGMに戻す
  coast: "assets/bgm/coast_bgm.mp3",
  coast_night: "assets/bgm/coast_night_bgm.mp3",
  coast_battle: "assets/bgm/coast_battle_bgm.mp3",
  // 渓流ステージの探索用フィールド曲(ユーザー提供音源、2026-07-20)。海岸と同じく探索中ずっと
  // 流し続ける専用チャンネル。早朝/朝/昼はvalley、夜だけvalley_night(戦闘専用曲はまだ無く、
  // 敵データが未実装のため戦闘自体が発生しない。実装され次第dungeon/dungeon_nightと同じ扱いを検討)
  valley: "assets/bgm/valley_bgm.mp3",
  valley_night: "assets/bgm/valley_night_bgm.mp3",
  // ボス/中ボスは共通曲(quest_target_battle_bgm.mp3)のまま。討伐依頼対象(🎯、ボス/中ボス以外)のみ
  // 2026-07-20にユーザー提供曲(quest_target_only_battle_bgm.mp3)へ分離
  boss_battle: "assets/bgm/quest_target_battle_bgm.mp3", // 最終ボス・序盤緊急依頼ボス専用(森・海岸共通、時間帯問わず)
  mid_boss_battle: "assets/bgm/quest_target_battle_bgm.mp3", // 中ボス専用(森・海岸共通、時間帯問わず)
  quest_target_battle: "assets/bgm/quest_target_only_battle_bgm.mp3", // 奉行所の討伐依頼対象(🎯)との戦闘専用(中ボス/ボスを除く)。ただし中ボス/ボスの方が優先度が高い
  tengu_battle: "assets/bgm/tengu_battle_bgm.mp3", // 天狗の腕試し(イベント戦)専用(ユーザー提供曲、2026-07-18追加)
  raid_battle: "assets/bgm/yokai_no_shutai.mp3", // 大規模戦(村襲撃プロトタイプ)専用(ユーザー提供曲「yokai-no-shūtai」、2026-07-27追加)
  // クエスト専用ルート「笑わぬ祭」のルートBGM(探索・戦闘とも同曲を通しで流す。出典はdocs/BGM出典.md)。
  // QUEST_ROUTE_DEFS[routeId].bgmにこのキーを書くと、そのルートの探索/戦闘で流れる(下のquestRouteBgmKey参照)
  warawanu_matsuri: "assets/bgm/omatsuri_bayashi_bgm.mp3",
  // クエスト専用ルート「帰らずの湯治道」のルートBGM(同上。出典はdocs/BGM出典.md)
  kaerazu_tojiyado: "assets/bgm/kaerazu_wafuu_horror_bgm.mp3",
};
// 現在questroute(クエスト専用ルート)に居て、そのルートに専用BGM(QUEST_ROUTE_DEFS[].bgm)が
// 定義されていればそのキーを返す。探索(playExplorationAreaBgm)と戦闘(playBattleBgm)の両方が参照し、
// 探索→戦闘→探索を通して同じ曲を途切れず流し続ける(playBgmの同一キーガードで頭出しされない)
function questRouteBgmKey() {
  if (typeof currentStage === "undefined" || currentStage !== "questroute") return null;
  if (typeof questRouteDef !== "function") return null;
  const def = questRouteDef();
  return def && def.bgm && BGM_TRACKS[def.bgm] ? def.bgm : null;
}
// 中ボス(最終ボスの一段階手前、floor26+のがしゃどくろ・九尾の狐・大蟹王)専用のBGMを鳴らす対象。
// 最終ボス(kishin_rasetsuo/kaiyoujo_ou)や序盤緊急依頼ボス(isBoss:trueだがこのSetには含めない)は
// 従来通りboss_battleのまま
const MID_BOSS_BGM_IDS = new Set(["gashadokuro", "kyubi_no_kitsune", "oo_kani_ou"]);
// 探索中に流す曲を選ぶ(森はアンビエントのみ、海岸/渓流はそれぞれ専用の探索曲2曲)。戦闘終了時にstopBattleBgm()からも呼ばれる
function playExplorationAreaBgm() {
  const routeBgm = questRouteBgmKey();
  if (routeBgm) playBgm(routeBgm);
  else if (currentStage === "coast") playBgm(state.timeOfDay === "night" ? "coast_night" : "coast");
  else if (currentStage === "valley") playBgm(state.timeOfDay === "night" ? "valley_night" : "valley");
}
// 戦闘BGMを時間帯・ステージに応じて選ぶ。森は夜だけ専用曲、海岸はcoast_battle(昼夜共通)。
// 中ボス(battle.enemies内にMID_BOSS_BGM_IDSの敵が1体でもいる場合)はmid_boss_battle、
// それ以外のボス(最終ボス・序盤緊急依頼ボス、isBoss:true)はboss_battleを、森・海岸問わず優先する
// 討伐依頼の追跡(state.acceptedQuest.chasing)の最中は、接敵→逃走→再遭遇の間ずっと同じ相手との
// 決着がついていないため、再遭遇のたびにボス曲を頭出しし直さず、途切れず流れ続けているBGMをそのまま続投させる
// (ユーザー指摘: 大猪の追跡戦で再戦するたびに曲が最初から再生されてしまっていた不具合の対応)
function isContinuingBossChase() {
  return !!(state.acceptedQuest && state.acceptedQuest.chasing);
}
// 戦闘BGMの強制上書きキー(大規模戦テスト/将来の村襲撃用)。nullなら通常のステージ別選曲
let battleBgmOverrideKey = null;
function playBattleBgm() {
  if (battleBgmOverrideKey) {
    battleBgmFadeToken++;
    currentBgmKey = null;
    bgmPositions[battleBgmOverrideKey] = 0; // 毎回頭から再生(天狗戦と同じ)
    playBgm(battleBgmOverrideKey);
    return;
  }
  // 洞窟内は戦闘BGMをミュートする(ユーザー指示、2026-07-21)。cave_ambient(環境音)は戦闘中も鳴り続ける
  if (currentStage === "cave") {
    if (currentBgmKey) stopBattleBgm();
    return;
  }
  // ルートBGM付きのクエスト専用ルート(笑わぬ祭など): ボス戦含む全戦闘で探索と同じ曲を
  // 頭出しせずそのまま流し続ける(祭囃子が途切れない不気味さを優先。ボス曲より優先)
  const routeBgm = questRouteBgmKey();
  if (routeBgm) { playBgm(routeBgm); return; }
  const continuingChase = isContinuingBossChase();
  // 天狗の腕試し(イベント戦)専用BGM。追跡戦は存在しないので毎回頭から再生する
  if (battle && battle.enemies && battle.enemies.some((e) => e.id === "tengu_shiren")) {
    battleBgmFadeToken++;
    currentBgmKey = null;
    bgmPositions.tengu_battle = 0;
    playBgm("tengu_battle");
    return;
  }
  if (battle && battle.enemies && battle.enemies.some((e) => MID_BOSS_BGM_IDS.has(e.id))) {
    if (continuingChase && currentBgmKey === "mid_boss_battle") { playBgm("mid_boss_battle"); return; }
    battleBgmFadeToken++;
    currentBgmKey = null;
    bgmPositions.mid_boss_battle = 0; // ボス戦は毎回頭から再生する(coast_battleと同じ扱い、ただし追跡継続中を除く)
    playBgm("mid_boss_battle");
    return;
  }
  if (battle && battle.enemies && battle.enemies.some((e) => e.isBoss)) {
    if (continuingChase && currentBgmKey === "boss_battle") { playBgm("boss_battle"); return; }
    battleBgmFadeToken++;
    currentBgmKey = null;
    bgmPositions.boss_battle = 0; // ボス戦は毎回頭から再生する(coast_battleと同じ扱い、ただし追跡継続中を除く)
    playBgm("boss_battle");
    return;
  }
  // 奉行所の討伐依頼対象(🎯、isQuestTarget)との戦闘専用BGM。中ボス/ボス(isBoss:trueの依頼対象も
  // 含む)は上の2つの分岐で既に処理済みのため、ここに来る時点でボス級ではないと確定している
  if (battle && battle.enemies && battle.enemies.some((e) => e.isQuestTarget)) {
    if (continuingChase && currentBgmKey === "quest_target_battle") { playBgm("quest_target_battle"); return; }
    battleBgmFadeToken++;
    currentBgmKey = null;
    bgmPositions.quest_target_battle = 0;
    playBgm("quest_target_battle");
    return;
  }
  if (currentStage === "coast") {
    // 前回の戦闘のstopBattleBgm()フェードアウト(3秒)が完了しないうちに次の戦闘へ突入すると、
    // currentBgmKeyがまだ"coast_battle"のままのため、playBgm()の「同じキーなら何もしない」
    // 早期returnに引っかかり、フェード中の再生位置・音量のまま鳴り続けてしまっていた
    // (=次の戦闘なのに前回の途中から再生される不具合)。currentBgmKeyをここで一旦nullにし、
    // 進行中のフェードも無効化することで、playBgm()に「新しい曲」として頭出し処理を通させる
    battleBgmFadeToken++;
    currentBgmKey = null;
    bgmPositions.coast_battle = 0;
    playBgm("coast_battle");
    return;
  }
  playBgm(state.timeOfDay === "night" ? "dungeon_night" : "dungeon");
}
const bgmAudio = document.getElementById("bgmAudio");
const lodgingBgmAudio = document.getElementById("lodgingBgmAudio");
const campBgmAudio = document.getElementById("campBgmAudio");
const ambientBgmAudio = document.getElementById("ambientBgmAudio");
const openingBgmAudio = document.getElementById("openingBgmAudio");

// ============ bgmAudio専用: Web Audio API(GainNode)による音量制御【最小構成】 ============
// AudioContext → MediaElementAudioSourceNode → GainNode → destination の1本道のみ。
// まずbgmAudio(町・冒険中BGM)だけをこの経路に乗せる。他のBGM要素(openingBgmAudio/
// lodgingBgmAudio/campBgmAudio/ambientBgmAudio)は今回は触らず、従来通り<audio>.volumeの
// ままにしておく(bgmAudio単体でPC・iPhoneとも正常動作することを確認してから、
// 同じパターンを他の要素にも1つずつ広げる方針)。
// GainNode構築に失敗した場合(古いブラウザ等)は、bgmAudio.volumeへの直接代入にフォールバックする。
let bgmAudioCtx = null;
let bgmGainNode = null;
let openingGainNode = null; // オープニングBGM用(2026-08-01追加。iOSは<audio>.volumeを無視するため、
// タイトル画面のBGMがずっと素の音量=うるさいまま鳴っていた。bgmAudioで実績のある同じ1本道パターンを
// 「1要素ずつ広げる」方針(下のコメント)どおり2要素目として追加。失敗時は従来の.volumeフォールバック)
try {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) {
    bgmAudioCtx = new AudioContextClass();
    const bgmSource = bgmAudioCtx.createMediaElementSource(bgmAudio);
    bgmGainNode = bgmAudioCtx.createGain();
    bgmSource.connect(bgmGainNode).connect(bgmAudioCtx.destination);
  }
} catch (e) {
  bgmAudioCtx = null;
  bgmGainNode = null;
}
// オープニング側は別tryで隔離: 万一ここが失敗しても、実績のあるbgmAudio側の経路を巻き添えにしない
// (過去の「複数要素を一括で移行して全滅」事故の教訓。失敗時は従来の.volumeフォールバックで動き続ける)
try {
  if (bgmAudioCtx) {
    const openingSource = bgmAudioCtx.createMediaElementSource(openingBgmAudio);
    openingGainNode = bgmAudioCtx.createGain();
    openingSource.connect(openingGainNode).connect(bgmAudioCtx.destination);
  }
} catch (e) {
  openingGainNode = null;
}
// オープニングBGMの音量の読み書き(GainNode経路。非対応環境は従来の.volumeへフォールバック)
function setOpeningBgmVolume(value) {
  if (openingGainNode) openingGainNode.gain.value = value;
  else openingBgmAudio.volume = value;
}
function getOpeningBgmVolume() {
  return openingGainNode ? openingGainNode.gain.value : openingBgmAudio.volume;
}
function setBgmAudioVolume(value) {
  if (bgmGainNode) bgmGainNode.gain.value = value;
  else bgmAudio.volume = value;
}
function getBgmAudioVolume() {
  return bgmGainNode ? bgmGainNode.gain.value : bgmAudio.volume;
}
// bgmAudioがWeb Audio API経由になったため、AudioContextが未resume(suspended)のままだと
// 無音になる。iOSはユーザー操作の中で1回resumeしただけでは以後suspendedへ戻ることがあるため、
// 効果音(sfxAudioCtx)と同じく「再生を試みるたびに、suspendedならresumeしてから鳴らす」方式にする
// 【多重呼び出しガード】複数の復旧経路(visibilitychange/pause自動復帰/タップ/playBgm)から
// 短時間にplay()が重ね掛けされると、iOSでは詰まった要素が曲頭だけを連打再生する引き金になる。
// play()のPromiseが解決するまで+直後400msは追加要求を無視して、実行を実質1本に絞る
let bgmPlayRequestPending = false;
let bgmLastPlayAttemptAt = 0;
function resumeAndPlayBgmAudio() {
  const now = performance.now();
  if (bgmPlayRequestPending || now - bgmLastPlayAttemptAt < 400) return;
  bgmLastPlayAttemptAt = now;
  bgmPlayRequestPending = true;
  const keyAtRequest = currentBgmKey;
  const finish = () => { bgmPlayRequestPending = false; };
  const doPlay = () => {
    // 【レース対策(ユーザー報告2026-07-26)】この再生要求は非同期(AudioContextのresume待ちや
    // アプリ復帰時のsrc読み直し完了待ち)の後に実行されるため、その間に曲が止められた/別の曲へ
    // 切り替わったなら、もう古い要求であり再生してはいけない。このチェックが無いと、
    // 「アプリ復帰(村BGMの再生要求が仕掛かる)→すぐ村から出発(stopTownBgm()で停止+キーnull化)→
    // 遅れてplay()が実行され、誰も管理していない探索中に村BGMが鳴り出す(壊れた要素だと曲頭の
    // ループとして延々続き、戦闘開始でsrcが差し替わるまで止まらない)」という事故になっていた
    if (!currentBgmKey || currentBgmKey !== keyAtRequest) { finish(); return; }
    bgmAudio.play().then(finish).catch(finish);
  };
  if (bgmAudioCtx && bgmAudioCtx.state === "suspended") {
    bgmAudioCtx.resume().then(doPlay).catch(doPlay);
  } else {
    doPlay();
  }
}
// 【対策】宿泊等でbgmAudioを一度止めて別トラックへ切り替えた後、iOS実機で「play()が一度成功して
// 再生イベントまで発火した直後(1秒未満)に、こちらのコードは一切.pause()を呼んでいないのに
// bgmAudio.pausedが勝手にtrueへ戻り、再生位置が0付近で数回リピートする」現象が確認されている
// (iOS側のWeb Audio API+HTMLMediaElement連携特有の、再生開始直後の瞬断とみられる)。意図した
// 一時停止(曲切り替え・フェード終了時のbgmAudio.pause()呼び出し)はpauseBgmAudio()経由に統一し、
// その場合だけ短い猶予(400ms)を設けて自動復帰の対象から除外する。それ以外の(=このコードが
// 一切関与していない)pauseは「意図しない停止」とみなし、即座に再生を試みて自動的に復帰させる
let bgmIntentionalPauseUntil = 0;
function pauseBgmAudio() {
  bgmIntentionalPauseUntil = performance.now() + 400;
  bgmAudio.pause();
}
// 【最後の砦: srcの読み直しによる完全リセット(ユーザー報告2026-07-25)】
// アプリ切り替え(LINE等を開いて戻る)の後、bgmAudioのメディアパイプラインが壊れて「曲頭の
// 0.5秒だけが永遠にリピートされる」状態に入ることがかなりの高確率である。iPhoneではChromeも
// SafariもWebKitのため両ブラウザで同一の症状になる。壊れ方は2通り確認/推定されており、
//  (a) 要素は「再生中」を名乗ったまま、loop属性によるネイティブループで曲頭付近だけを繰り返す
//      (pauseイベントを一切出さないため、pause監視ベースの既存の自動復帰では検出不可能)
//  (b) play()が一瞬成功→勝手にpause、の往復(既存の自動復帰が1秒おきにplay()し直すため、
//      「1秒おきに曲頭だけ鳴る」リピートとして聞こえ続ける)
// どちらもplay()やシークの再試行では直らず、src再代入+load()でパイプラインを作り直すしか
// 治らない(「戦闘開始や帰村などplayBgm()がsrcを差し替えるタイミングで直る」という報告と一致)。
// 読み直し後は退避しておいた再生位置へシークしてから再生し直す(音源はキャッシュ済みのため一瞬)
let bgmHardResetToken = 0;
function hardResetBgmAudio() {
  if (!currentBgmKey || !audioUnlocked) return;
  const myToken = ++bgmHardResetToken;
  const keyAtReset = currentBgmKey;
  const pos = bgmPositions[keyAtReset] || 0;
  bgmIntentionalPauseUntil = performance.now() + 800; // load()に伴うpause/abortを自動復帰の対象から外す
  bgmAudio.src = BGM_TRACKS[keyAtReset];
  bgmAudio.load();
  const seekAndPlay = () => {
    // 読み直しの完了を待つ間に別のリセットや曲の切り替えが起きていたら、この古い処理は捨てる
    if (myToken !== bgmHardResetToken || currentBgmKey !== keyAtReset) return;
    try { bgmAudio.currentTime = pos; } catch (e) {}
    bgmPlayRequestPending = false; // リセット前のplay()待ちが残っていても無効なので、多重呼び出しガードを明示的に解いてから再生する
    bgmLastPlayAttemptAt = 0;
    resumeAndPlayBgmAudio();
  };
  if (bgmAudio.readyState >= 1) seekAndPlay();
  else bgmAudio.addEventListener("loadedmetadata", seekAndPlay, { once: true });
}
let bgmAutoRecoverLastAt = 0;
let bgmAutoRecoverStreak = 0;
bgmAudio.addEventListener("pause", () => {
  if (performance.now() < bgmIntentionalPauseUntil) return; // 意図した一時停止
  if (!currentBgmKey || !audioUnlocked) return; // 何も再生する意図がない/まだアンロック前
  // 【iOSタブ復帰の連打リピート対策(ユーザー報告2026-07-18)】
  // ①タブが非表示の間のpauseはOSによる正当な停止なので復帰させない(復帰はvisibilitychange側で行う)。
  //   ここでplay()し返すと、非表示中の「play→OSがpause→play→…」のピンポン連打が始まり、
  //   タブに戻った時に曲頭の0.5秒だけが機関銃のようにリピートする現象の引き金になっていた
  if (document.visibilityState !== "visible") return;
  // ②フォアグラウンドでも自動復帰は1秒に1回まで(万一play↔pauseの往復が起きても連打にしない)
  const now = performance.now();
  if (now - bgmAutoRecoverLastAt < 1000) return;
  // ③自動復帰が短時間(5秒以内)に連続する=素のplay()では再開が定着しない壊れ方(上記(b))を
  //   しているとみなし、2回目からはsrc読み直しの完全リセットへ格上げする
  bgmAutoRecoverStreak = now - bgmAutoRecoverLastAt < 5000 ? bgmAutoRecoverStreak + 1 : 1;
  bgmAutoRecoverLastAt = now;
  if (bgmAutoRecoverStreak >= 2) hardResetBgmAudio();
  else resumeAndPlayBgmAudio();
});

const BGM_BASE_VOLUME = 0.8; // ユーザー指示で村・冒険中(戦闘含む)BGMの音量を80%に
const LODGING_BGM_VOLUME = 0.5;
const CAMP_BGM_VOLUME = 0.5;
const AMBIENT_BGM_VOLUME = 0.45;
const OPENING_BGM_VOLUME = 0.55;
// ============ 音量調整(右上のスピーカーアイコン→0〜10のボタン) ============
// 0(ミュート)〜1の倍率、0.1刻み。bgmAudio(GainNode経由)の実際のgainに常に掛け合わされる。
// 他のBGM要素(opening/lodging/camp/ambient)はGainNode化していないため、この値では音量までは
// 変えられないが、0の時だけ.mutedで完全に黙らせる(0ボタン=ミュート、という直感的な挙動に合わせるため)
let masterBgmVolume = 0.6; // ユーザー指示で初期値は6(10段階中)
let lastMasterBgmVolumeBeforeMute = 0.6; // ミュート前の音量を覚えておき、設定画面のON/OFFトグルで復元する
function targetBgmVolume(key) {
  return bgmVolumeForKey(key) * masterBgmVolume;
}
function baseTargetVolume() {
  return BGM_BASE_VOLUME * masterBgmVolume;
}
function applyMasterVolumeToUi() {
  const isMuted = masterBgmVolume === 0;
  lodgingBgmAudio.muted = isMuted;
  openingBgmAudio.muted = isMuted;
  ambientBgmAudio.muted = isMuted;
  campBgmAudio.muted = isMuted;
  // ボタン自体は歯車アイコン固定(設定/タイトルに戻るも収めた汎用メニューに変わったため、
  // 音量状態を絵文字で出し分けるのはやめた。現在の音量はポップオーバー内のボタンのハイライトで分かる)
  const activeStep = Math.round(masterBgmVolume * 10);
  document.querySelectorAll(".volume-step-btn").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.step) === activeStep);
  });
}
function setMasterBgmVolume(v) {
  masterBgmVolume = Math.max(0, Math.min(1, v));
  if (masterBgmVolume > 0) lastMasterBgmVolumeBeforeMute = masterBgmVolume;
  if (currentBgmKey && !bgmAudio.paused) setBgmAudioVolume(targetBgmVolume(currentBgmKey));
  applyMasterVolumeToUi();
}
function toggleMute() {
  setMasterBgmVolume(masterBgmVolume > 0 ? 0 : (lastMasterBgmVolumeBeforeMute || 1));
}
setBgmAudioVolume(baseTargetVolume());
lodgingBgmAudio.volume = LODGING_BGM_VOLUME;
campBgmAudio.volume = CAMP_BGM_VOLUME;
ambientBgmAudio.volume = AMBIENT_BGM_VOLUME;
setOpeningBgmVolume(OPENING_BGM_VOLUME); // GainNode経路(iOSで.volumeが無視される問題への対応、2026-08-01)
let audioUnlocked = false;
let currentBgmKey = null;
// 場面ごとの再生位置記憶(例: 町の曲は町に戻るたびに続きから再生される)。
// ただしダンジョンの曲だけは、新しい冒険を始めるたびにenterDungeon()でこの値を0に戻し、
// 前回の続きからではなく必ず最初から再生されるようにしている
const bgmPositions = {};
// stopBattleBgm()のフェード処理を無効化するためのトークン。フェード開始のたびに増やし、
// fadeStep側は自分が始めた時のトークン値と現在値を比較する。currentBgmKeyの一致だけでは、
// 「同じキー(coast_battle)が新しい戦闘で再び頭出しされた」場合と「まだ同じフェードが続いている」
// 場合を区別できない(文字列としては同じキーのため)。playBattleBgm()が次の戦闘で頭出しする際に
// この値を進めることで、進行中の古いフェードを確実に止める
let battleBgmFadeToken = 0;

// 【②の根本原因】iOS Safari(および多くのモバイルブラウザ)は<audio>要素の再生を、実在する
// 「信頼できるユーザー操作(トラステッドイベント)」の呼び出しスタックの中でしか許可しない。
// これはブラウザの仕様上の制約であり、コードのバグではなく回避不可能な既定動作。
// 以前の実装はこの解除リスナーをpointerdownイベント1種類だけに依存していたため、
// 万一その端末/OSバージョンでPointer Eventsの発火が遅い・不安定であれば解除が漏れる余地があった。
// ここではtouchstart/mousedown/pointerdown/keydownの複数種類を同時に張り、どれか最初に
// 発火したものだけで解除する(audioUnlockedガードで二重実行は防止)ことで取りこぼしを無くしている。
// なお「オープニング開始と同時に」を100%保証することは、ユーザーが何もタップしないまま
// 演出だけを眺めている間はブラウザの仕様上不可能(タップ0回=トラステッドイベント無し=
// 再生許可が一切下りない)。このため実際に音が鳴り始めるのは「ページ内の最初の操作の瞬間」になる
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  if (currentBgmKey) {
    // 既に町/冒険用のBGMキーが決まっている(=タイトルより先に進んでいる)場合はそちらを再開する
    resumeAndPlayBgmAudio();
    ambientBgmAudio.play().catch(() => {});
  } else {
    // まだタイトル/オープニング中(currentBgmKeyは最初のplayBgm()呼び出しまでnullのまま)。
    // オープニングBGMの再生を試みる。起動直後の自動再生が制限で失敗していた場合、
    // ユーザーの最初の操作によるこの呼び出しが確実な再試行のタイミングになる
    openingBgmAudio.play().catch(() => {});
  }
  // iPhone Safari対策: SE用/BGM用、両方のAudioContextともユーザーの最初のタップの中でresume()する必要がある
  if (sfxAudioCtx && sfxAudioCtx.state === "suspended") sfxAudioCtx.resume().catch(() => {});
  if (bgmAudioCtx && bgmAudioCtx.state === "suspended") bgmAudioCtx.resume().catch(() => {});
}
["pointerdown", "touchstart", "mousedown", "keydown"].forEach((evt) => {
  document.addEventListener(evt, unlockAudio, { once: true, passive: true });
});

// iPhone Safariのダブルタップズーム対策。touch-action:manipulation(html,body)とviewportの
// maximum-scale=1/user-scalable=noだけでは、探索画面のように連続してボタンをタップする場面で
// ズームが発生してしまうことがあったため、素早い連続タップの2回目のtouchendを明示的に
// preventDefault()してズームジェスチャー自体の発生を止める。
// 最初は「350ms以内なら問答無用でブロック」だったが、攻撃連打など通常の高速操作まで
// 潰してしまう(反応しないボタンがある)という指摘を受け、「同じ要素への連打」限定に調整した
// (別の要素を素早く連続タップする通常操作は影響を受けない)。その後、探索画面で「進む」等を
// 連打した時にズームが再発する報告を受け、時間側の窓を150ms→400msに広げ直した(ui.js参照。
// 同じ要素への連打は正当な用途が無いため、時間窓を広げても副作用は無い)

// 海岸ステージのBGMだけ、ユーザー指示で音量を1.7倍にする(他は通常のBGM_BASE_VOLUMEのまま)
const COAST_BGM_VOLUME_MULT = 1.7;
// 村の「town」キー(早朝/夜以外、朝・昼・夕方に使われる)だけ、他のBGMと独立して音量を下げる。
// bgmAudioはGainNode経由の音量制御に移行済みのため、iOS実機でも実際に反映される
const TOWN_DAY_BGM_VOLUME_MULT = 0.7;
// 普通の雑魚敵との戦闘BGM(森の戦闘専用曲dungeon/dungeon_night)だけ1.2倍(ユーザー指示、2026-07-25)。
// 海岸の雑魚戦(coast_battle)は既にCOAST_BGM_VOLUME_MULT(1.7倍)で上限(1.0)に張り付いているため対象外
const NORMAL_BATTLE_BGM_VOLUME_MULT = 1.2;
function bgmVolumeForKey(key) {
  if (key === "coast" || key === "coast_night" || key === "coast_battle") return Math.min(1, BGM_BASE_VOLUME * COAST_BGM_VOLUME_MULT);
  if (key === "dungeon" || key === "dungeon_night") return Math.min(1, BGM_BASE_VOLUME * NORMAL_BATTLE_BGM_VOLUME_MULT);
  if (key === "town") return BGM_BASE_VOLUME * TOWN_DAY_BGM_VOLUME_MULT;
  return BGM_BASE_VOLUME;
}
// タイトル/オープニングBGM(openingBgmAudio)からの引き継ぎ用フェードアウト。
// playBgm()が最初に呼ばれた時点(=タイトルを離れて実際のゲーム画面のBGMが決まった時点)で
// 自動的に呼ばれる。0.6秒で滑らかに消し、二重再生や急なブツ切りにならないようにする
let openingBgmFadeToken = 0;
function fadeOutOpeningBgm() {
  if (openingBgmAudio.paused) return;
  const startVol = getOpeningBgmVolume();
  const startTime = performance.now();
  const myToken = ++openingBgmFadeToken;
  const durationMs = 600;
  function step() {
    if (openingBgmFadeToken !== myToken) return;
    const t = Math.min(1, (performance.now() - startTime) / durationMs);
    setOpeningBgmVolume(startVol * (1 - t));
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      openingBgmAudio.pause();
      openingBgmAudio.currentTime = 0;
      setOpeningBgmVolume(OPENING_BGM_VOLUME);
    }
  }
  step();
}
function playBgm(key) {
  // タイトル画面を離れて最初の本編BGMが決まった瞬間、流れっぱなしのオープニング/タイトル曲を
  // フェードアウトする(このガードが無いと、町BGMと二重に鳴り続けてしまう)
  fadeOutOpeningBgm();
  if (currentBgmKey === key) {
    // 同じ曲を続けて流すはずの場面(海岸の探索→戦闘の継続再生など)で、何らかの理由で
    // 要素が一時停止してしまっていた場合に無音のまま固まらないよう、ここで取りこぼさず再開する
    if (bgmAudio.paused && audioUnlocked) resumeAndPlayBgmAudio();
    return;
  }
  if (currentBgmKey) bgmPositions[currentBgmKey] = bgmAudio.currentTime;
  currentBgmKey = key;
  bgmAudio.src = BGM_TRACKS[key];
  bgmAudio.currentTime = bgmPositions[key] || 0;
  setBgmAudioVolume(targetBgmVolume(key));
  if (audioUnlocked) resumeAndPlayBgmAudio();
}

// 戦闘終了時: 森の戦闘専用BGM(dungeon/dungeon_night)をフェードアウトして止める。海岸は戦闘中も
// 探索用BGMを切り替えず流し続ける設計のため、ここでは一切触らない(currentBgmKeyがcoast系なら即return)。
// 毎回の戦闘開始時に必ず曲の頭から鳴らしたいので、フェード完了時に再生位置を0にリセットしてから
// currentBgmKeyをnullに戻す(nullにしないとplayBattleBgm()の「同キーなら何もしない」判定で無音のまま止まる)
const BATTLE_BGM_FADE_OUT_MS = 3000;
// 中ボス/ボス級の討伐依頼から逃げた(=state.acceptedQuest.chasingが立った)直後は、
// 追いかけてくる設定である以上また同じ相手と再戦することになるため、逃走のたびに
// ボス曲がフェードアウト→探索曲に戻る→再遭遇でまたボス曲頭出し、を繰り返すのがうるさいという
// ユーザー指摘を受け、討伐するまではボス曲を止めずに流し続けるようにした
// (escapeBattle/useSmokeBombのどちらの離脱経路からもmarkQuestChasingIfFled()の直後に呼ぶ)
function isBossBgmActive() {
  return currentBgmKey === "boss_battle" || currentBgmKey === "mid_boss_battle" || currentBgmKey === "quest_target_battle";
}
function shouldKeepBossBgmOnFlee() {
  return isContinuingBossChase() && isBossBgmActive();
}
function stopBattleBgm() {
  if (currentBgmKey !== "dungeon" && currentBgmKey !== "dungeon_night" && currentBgmKey !== "coast_battle" && currentBgmKey !== "boss_battle" && currentBgmKey !== "mid_boss_battle" && currentBgmKey !== "quest_target_battle" && currentBgmKey !== "tengu_battle") return;
  const key = currentBgmKey;
  // ボス戦(boss_battle/mid_boss_battle/quest_target_battle)や天狗戦は森・海岸共通の1トラックのため、
  // 戦闘終了時にどちらへ戻すかは現在のステージ(currentStage)で判定する
  // (coast_battleは元々このキー自体で確定していた)
  const wasCoastBattle = key === "coast_battle" || ((key === "boss_battle" || key === "mid_boss_battle" || key === "quest_target_battle" || key === "tengu_battle") && currentStage === "coast");
  const startVol = getBgmAudioVolume();
  const startTime = performance.now();
  const myFadeToken = ++battleBgmFadeToken;
  function fadeStep() {
    // フェード中に(町に戻る等で)別のBGMキーへ既に切り替わっていたら、この古いフェード処理は
    // 中断する。ここでチェックせずbgmAudio.pause()まで進んでしまうと、後から始まった曲(町BGM等)を
    // 巻き込んで無音にしてしまうという不具合があった(森全滅後に町BGMが鳴らない/海岸全滅後に
    // 探索用BGMが町で鳴り続ける、という2つの報告は両方ともこれが原因)。
    // battleBgmFadeTokenの不一致は、同じキーのまま次の戦闘が頭出しされたケースを検出する
    if (currentBgmKey !== key || battleBgmFadeToken !== myFadeToken) return;
    const t = Math.min(1, (performance.now() - startTime) / BATTLE_BGM_FADE_OUT_MS);
    setBgmAudioVolume(startVol * (1 - t));
    if (t < 1) {
      requestAnimationFrame(fadeStep);
    } else {
      bgmPositions[key] = 0;
      pauseBgmAudio();
      // 【不具合対策】pause()直後にgainをBGM_BASE_VOLUMEへ即座に戻すと、Web Audioの処理
      // パイプラインに残っていた僅かな残留オーディオ(pause()はソース側の「今後の供給」を止める
      // だけで、既にグラフに渡り済みの数ms分のバッファは即座には消えない)がフルボリュームで
      // 出力され、フェードの最後に一瞬大きな音が鳴る不具合があった。残留分が確実に流れきる
      // だけの猶予(150ms)を置いてからgainを戻す
      setTimeout(() => setBgmAudioVolume(baseTargetVolume()), 150);
      currentBgmKey = null;
      if (wasCoastBattle) playExplorationAreaBgm(); // 海岸は戦闘終了後、探索用BGM(coast/coast_night)へ戻す
    }
  }
  fadeStep();
}

// 環境音: 探索中・戦闘中を通して共通で流れ続ける環境音。森は虫の声(朝昼insect_day/夕夜insect_night、
// forceKeyを渡すと時間帯に関わらずそのキーを強制。野営演出が視覚的には常に夜へ切り替わるため、
// 野営開始時だけ強制的にinsect_nightへ寄せる用途)、海岸は波音(coast_ambient、時間帯に関わらず1種類)、
// 洞窟は洞窟内の音(cave_ambient、時間帯に関わらず1種類)を使う
const AMBIENT_BGM_TRACKS = { day: "assets/bgm/insect_day.mp3", night: "assets/bgm/insect_night.mp3" };
const COAST_AMBIENT_TRACK = "assets/bgm/coast_ambient.mp3";
const CAVE_AMBIENT_TRACK = "assets/bgm/cave_ambient.mp3";
let currentAmbientKey = null;
function ambientKeyForTimeOfDay(tod) {
  return tod === "dawn" || tod === "asa" || tod === "day" ? "day" : "night";
}
// 洞窟1層目は深淵の森から地続きの入り口という位置づけのため、洞窟専用の音(cave_ambient)ではなく
// 森の環境音(虫の声)のままにする(ユーザー指示、2026-07-21)。2層目以降で洞窟の音に切り替わる
const CAVE_AMBIENT_VOLUME_RATIO = 0.8; // 洞窟内の音量は通常の環境音の80%(ユーザー指示)
function playAmbientBgm(forceKey) {
  const useCaveAmbient = currentStage === "cave" && currentFloor > 1;
  const key = currentStage === "coast" ? "coast" : useCaveAmbient ? "cave" : (forceKey || ambientKeyForTimeOfDay(state.timeOfDay));
  if (currentAmbientKey === key) return;
  currentAmbientKey = key;
  ambientBgmAudio.src = key === "coast" ? COAST_AMBIENT_TRACK : key === "cave" ? CAVE_AMBIENT_TRACK : AMBIENT_BGM_TRACKS[key];
  ambientBgmAudio.volume = key === "cave" ? AMBIENT_BGM_VOLUME * CAVE_AMBIENT_VOLUME_RATIO : AMBIENT_BGM_VOLUME;
  ambientBgmAudio.currentTime = 0;
  if (audioUnlocked) ambientBgmAudio.play().catch(() => {});
}
function stopAmbientBgm() {
  ambientBgmAudio.pause();
  currentAmbientKey = null;
}
// 海岸ステージの探索用BGM(coast/coast_night、戦闘中も継続して流れている)を止める。里に帰る時に呼ぶ
function stopCoastAreaBgm() {
  if (currentBgmKey !== "coast" && currentBgmKey !== "coast_night") return;
  pauseBgmAudio();
  bgmPositions[currentBgmKey] = 0;
  currentBgmKey = null;
}
// 渓流ステージの探索用BGM(valley/valley_night)を止める。海岸と違い渓流は光る竹林へ一本道で
// 継続する(STAGE_CHAIN_NEXT)ため、里に帰る時だけでなく渓流を抜けて光る竹林へ進む時にも呼ぶ必要がある
function stopValleyAreaBgm() {
  if (currentBgmKey !== "valley" && currentBgmKey !== "valley_night") return;
  pauseBgmAudio();
  bgmPositions[currentBgmKey] = 0;
  currentBgmKey = null;
}

// 町のBGM(bgmAudio)を即座に止める。探索中はbgmAudioを戦闘専用として使うため、森に入る瞬間に
// 明示的に止めておかないと、以前ここでplayBgm("dungeon")を呼んでいた(=同じ要素のsrcを上書きすることで
// 自動的に町の曲が止まっていた)頃と違い、何もしなければ町のBGMが鳴りっぱなしになってしまう
function stopTownBgm() {
  pauseBgmAudio();
  currentBgmKey = null;
}

// 出発演出(startDeparture、town.js)の開始と同時に町BGMをフェードアウトする。演出全体の
// 所要時間(徒歩アニメーション→暗転→enterDungeon())より短く終わるようにし、画面が暗転する
// 頃には自然に無音になっているようにする。フェード完了時にbgmAudio.pause()+currentBgmKey=null
// まで行うため、その後enterDungeon()内のstopTownBgm()が呼ばれても(まだフェード中でも)
// 二重に問題を起こさない(既に無音ならpause()は無害、まだフェード中ならここで即座に打ち切る)
const TOWN_DEPARTURE_FADE_MS = 2500;
let townDepartureFadeToken = 0;
function fadeOutTownBgm() {
  if (currentBgmKey !== "town" || bgmAudio.paused) return;
  const startVol = getBgmAudioVolume();
  const startTime = performance.now();
  const myToken = ++townDepartureFadeToken;
  function fadeStep() {
    if (townDepartureFadeToken !== myToken || currentBgmKey !== "town") return; // 途中で別のBGMに切り替わっていたら中断
    const t = Math.min(1, (performance.now() - startTime) / TOWN_DEPARTURE_FADE_MS);
    setBgmAudioVolume(startVol * (1 - t));
    if (t < 1) {
      requestAnimationFrame(fadeStep);
    } else {
      pauseBgmAudio();
      setTimeout(() => setBgmAudioVolume(baseTargetVolume()), 150); // 残留オーディオ対策(stopBattleBgm()と同じ理由)
      currentBgmKey = null;
    }
  }
  fadeStep();
}

// 宿泊時: 町のBGMをフェードで止め、代わりに宿泊専用の一度きりの曲を再生する。曲が鳴り終わったら
// (ended)、町のBGMを最初から再開する(bgmPositionsの続きからではなく、必ず頭出しする)。
// bgmAudio側のフェードはGainNode経由(setBgmAudioVolume/getBgmAudioVolume)のため、
// iOS実機でも滑らかに減衰する。lodgingBgmAudio自体はまだ<audio>.volumeのまま(未移行)
const LODGING_BGM_FADE_OUT_MS = 1200;
function playLodgingBgm() {
  const startVol = getBgmAudioVolume();
  const startTime = performance.now();
  function fadeStep() {
    const t = Math.min(1, (performance.now() - startTime) / LODGING_BGM_FADE_OUT_MS);
    setBgmAudioVolume(startVol * (1 - t));
    if (t < 1) {
      requestAnimationFrame(fadeStep);
    } else {
      pauseBgmAudio();
      // 残留オーディオがフルボリュームで一瞬鳴る不具合対策(stopBattleBgm()と同じ理由、150ms猶予)
      setTimeout(() => setBgmAudioVolume(baseTargetVolume()), 150);
      lodgingBgmAudio.currentTime = 0;
      if (audioUnlocked) lodgingBgmAudio.play().catch(() => {});
    }
  }
  fadeStep();
}
lodgingBgmAudio.addEventListener("ended", () => {
  // 宿泊は必ず翌朝(dawn)に進む(advanceToNextMorning()参照)ため、目的地は常にtown_dawnで確定している。
  // 以前はここでstate.timeOfDayを見て選び直していたが、この曲が自然に鳴り終わるタイミング(音源自体の
  // 長さ次第)とadvanceToNextMorning()が実際にtimeOfDayを"dawn"へ書き換えるタイミング(暗転演出の
  // onBlackコールバック内)は無関係な非同期処理同士のため、曲の方が先に鳴り終わるとまだ更新前の
  // (寝る前の)時間帯を見てしまい、暗転明けの一瞬だけ昼/夜の町BGMが誤って鳴ってしまう不具合があった
  bgmPositions.town_dawn = 0;
  playBgm("town_dawn");
});

// 野営時: 冒険中BGMをフェードで止め、代わりに野営専用の曲をループ再生する。就寝時にstopCampBgm()で
// 逆方向のフェードを行い、冒険中BGMを(頭出しではなく)続きから再開する
const CAMP_BGM_FADE_MS = 1200;
function playCampBgm() {
  const startVol = getBgmAudioVolume();
  const startTime = performance.now();
  function fadeStep() {
    const t = Math.min(1, (performance.now() - startTime) / CAMP_BGM_FADE_MS);
    setBgmAudioVolume(startVol * (1 - t));
    if (t < 1) {
      requestAnimationFrame(fadeStep);
    } else {
      pauseBgmAudio();
      // 残留オーディオがフルボリュームで一瞬鳴る不具合対策(stopBattleBgm()と同じ理由、150ms猶予)
      setTimeout(() => setBgmAudioVolume(baseTargetVolume()), 150);
      campBgmAudio.currentTime = 0;
      if (audioUnlocked) campBgmAudio.play().catch(() => {});
    }
  }
  fadeStep();
}
function stopCampBgm(onDone) {
  const startVol = campBgmAudio.volume;
  const startTime = performance.now();
  function fadeStep() {
    const t = Math.min(1, (performance.now() - startTime) / CAMP_BGM_FADE_MS);
    campBgmAudio.volume = startVol * (1 - t);
    if (t < 1) {
      requestAnimationFrame(fadeStep);
    } else {
      campBgmAudio.pause();
      campBgmAudio.volume = CAMP_BGM_VOLUME;
      if (onDone) onDone();
    }
  }
  fadeStep();
  // 探索中はbgmAudio(戦闘専用BGM)を鳴らさない設計に変更したため、以前ここにあった
  // 「野営明けに冒険中BGMを再開する」処理は不要になった(虫の声アンビエントの継続はrenderDungeon側で行う)
}

// ============ 効果音(SE): Web Audio API低遅延方式 ============
// new Audio()+cloneNode().play()は端末によって呼び出しから実際の再生開始までに遅延が乗ることがあるため、
// 起動時に全SEをfetch+decodeAudioData()でAudioBufferとして事前デコードしておき、再生のたびに
// 新規のAudioBufferSourceNodeを使い捨てで生成して即座に鳴らす方式に変更した。BGM(bgmAudio/
// lodgingBgmAudio)は既存の<audio>要素のまま一切変更していない(このAudioContextはSE専用)
const SFX_EXT = { select: "ogg", coin: "ogg", heal: "ogg", attack: "ogg", victory: "ogg", attack_hunter: "mp3", attack_samurai: "mp3", attack_caster: "mp3", attack_gunner: "mp3", attack_spearman: "mp3", attack_naginata: "mp3", attack_ninja: "mp3", hit_taken_1: "mp3", hit_taken_2: "mp3", hit_taken_3: "mp3", hit_taken_4: "mp3", onsen: "mp3", onsen_enter: "mp3", evade: "mp3", guard: "mp3", flee: "mp3", extension_build: "mp3", skill_confirm: "mp3", smoke_bomb: "mp3", morning_chime: "mp3", footstep: "mp3", footstep_valley: "mp3", footstep_coast: "mp3", departure: "mp3", result: "mp3", big_attack_warning: "mp3", carry: "mp3", shoot_down: "mp3", transform: "mp3", crit_slash: "mp3", crit_ninja: "mp3", crit_caster: "mp3", crit_hunter: "mp3", crit_gunner: "mp3", quest_accept: "mp3", title_tap: "mp3", hawk_summon: "mp3", shikigami_summon: "mp3", encounter_alert: "mp3", omikuji_normal: "mp3", omikuji_daikichi: "mp3", onsen_relief: "mp3", rest_heal: "mp3", swish_sharp_1: "mp3", swish_sharp_2: "mp3", swish_sharp_3: "mp3", swish_heavy_1: "mp3", swish_heavy_2: "mp3", swap_dash: "mp3", loot_item: "mp3", loot_rare: "mp3", barricade_hit: "mp3", barricade_break: "wav" };
// ごく稀にAudioContext自体が存在しない/生成に失敗する環境があっても、ゲーム全体の初期化が
// 止まってしまわないようtry/catchで保護する(その場合はsfxAudioCtxがnullのままとなり、
// 以降のloadSfxBuffer/playSfxは何もしない安全側に倒す)
let sfxAudioCtx = null;
try {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) sfxAudioCtx = new AudioContextClass();
} catch (e) {}
const sfxBuffers = {}; // name -> デコード済みAudioBuffer
function loadSfxBuffer(name) {
  if (!sfxAudioCtx) return;
  fetch(`assets/sfx/${name}.${SFX_EXT[name] || "ogg"}`)
    .then((res) => res.arrayBuffer())
    .then((data) => sfxAudioCtx.decodeAudioData(data))
    .then((buffer) => { sfxBuffers[name] = buffer; })
    .catch(() => {}); // 個別のSEが読み込み・デコードに失敗しても他のSEの読み込みは止めない
}
Object.keys(SFX_EXT).forEach(loadSfxBuffer);
// 被弾ダメージが対象の最大HPに占める割合に応じて効果音を出し分ける(小さい一撃と致命傷級で音の重さを変える)。
// isSwarm(大群系の小さい敵)は個体のHPが小さくダメージ割合が大きく出やすいため、常に一番軽い音(hit_taken_1)に固定する
function hitTakenSfxFor(dmg, maxHp, isSwarm) {
  if (isSwarm) return "hit_taken_1";
  const ratio = maxHp > 0 ? dmg / maxHp : 0;
  if (ratio < 0.2) return "hit_taken_1";
  if (ratio < 0.4) return "hit_taken_2";
  if (ratio < 0.7) return "hit_taken_3";
  return "hit_taken_4";
}
// 渓流/海岸ステージだけ足音を専用SE(footstep_valley/footstep_coast)に差し替える(ユーザー提供音源、
// 2026-07-20)。他のステージは従来通りfootstepのまま。playDungeonMoveTransition/
// performAutoRetreatFloorMoveのどちらも「移動が確定した直後、currentStageがまだ切り替わる前」に
// 呼んでいるため、各ステージから隣接ステージへ抜ける最後の一歩まで正しくそのステージの足音になる
function footstepSfxName() {
  if (currentStage === "valley") return "footstep_valley";
  if (currentStage === "coast") return "footstep_coast";
  return "footstep";
}
// SEごとの音量倍率(未指定は1.0=素のまま)。振りかぶりの風切り音はトリム時にピークを-1dBへ
// 正規化した結果、着弾音より目立ってうるさかった(ユーザー指摘2026-07-26)ため、ここで下げる
// loot_item(素材を置く音)/loot_rare(レア入手の風鈴)の音量はモックでユーザーが決めた値(50%/30%、2026-07-27)
const SFX_GAIN = { swish_sharp_1: 0.35, swish_sharp_2: 0.35, swish_sharp_3: 0.35, swish_heavy_1: 0.35, swish_heavy_2: 0.35, loot_item: 0.5, loot_rare: 0.3, barricade_hit: 0.6, barricade_break: 0.7 };
function playSfx(name) {
  if (masterBgmVolume === 0) return;
  const buffer = sfxBuffers[name];
  if (!buffer || !sfxAudioCtx) return; // デコードがまだ終わっていない場合は諦める(旧実装の.catch(()=>{})と同じく無音で失敗させる)
  const start = () => {
    const source = sfxAudioCtx.createBufferSource(); // 使い回さず毎回新規生成(同時多重再生に対応)
    source.buffer = buffer;
    const gain = SFX_GAIN[name];
    if (gain != null && gain !== 1) {
      const g = sfxAudioCtx.createGain();
      g.gain.value = gain;
      source.connect(g).connect(sfxAudioCtx.destination);
    } else {
      source.connect(sfxAudioCtx.destination);
    }
    source.start(0);
  };
  // iOS Safariはバックグラウンド化などでAudioContextを勝手にsuspendすることがあり、
  // 一度そうなると以降ずっとSEが無音になっていた(ユーザー報告のバグ)。再生のたびに
  // suspended状態をチェックしてresume()してから鳴らすことで自己回復させる
  if (sfxAudioCtx.state === "suspended") {
    sfxAudioCtx.resume().then(start).catch(() => {});
  } else {
    start();
  }
}
// ページがバックグラウンドから復帰した瞬間にもAudioContextの復旧を試みておく(念のための保険)。
// bgmAudioも、SE再生時のオーディオフォーカス関連などで意図せず一時停止したまま
// currentBgmKeyだけが再生中のつもりで固まってしまうことがあるため、同様に復旧を試みる
document.addEventListener("visibilitychange", () => {
  // タブが隠れる瞬間に現在の再生位置を退避する。iOSはバックグラウンドで要素の位置を
  // 0付近へリセットすることがあり、復帰時にそのまま鳴らすと曲頭からの再生になってしまう
  if (document.visibilityState === "hidden" && currentBgmKey && !bgmAudio.paused) {
    bgmPositions[currentBgmKey] = bgmAudio.currentTime;
    return;
  }
  if (document.visibilityState === "visible" && sfxAudioCtx && sfxAudioCtx.state === "suspended") {
    sfxAudioCtx.resume().catch(() => {});
  }
  if (document.visibilityState === "visible" && bgmAudioCtx && bgmAudioCtx.state === "suspended") {
    bgmAudioCtx.resume().catch(() => {});
  }
  if (document.visibilityState === "visible" && currentBgmKey && audioUnlocked) {
    const pos = bgmPositions[currentBgmKey] || 0;
    if (bgmAudio.paused) {
      // iOS系はアプリ切り替えから戻るとほぼ確実にpausedになっている。以前はシーク+play()で
      // 再開していたが、切り替え後はメディアパイプラインが壊れていて「曲頭0.5秒の永久リピート」に
      // 入ることがかなりの高確率であり(ユーザー報告2026-07-25)、play()やシークではこの状態を
      // 直せない。常にsrcを読み直してパイプラインごと作り直し、退避位置から再生し直す
      // (復帰の瞬間はどのみち無音なので、読み直しによる体感の差は無い。なおPCのブラウザは
      // タブを隠してもBGMが止まらない=pausedにならないため、この分岐自体を通らない)
      hardResetBgmAudio();
    } else if (pos - (bgmAudio.currentTime || 0) > 2) {
      // 「再生中」を名乗っているのに、隠れる前に退避した位置より2秒以上巻き戻っている=
      // loop属性によるネイティブループで曲頭付近を繰り返す壊れ方(上記(a)。pauseイベントが
      // 出ないためここでしか検出できない)。これもsrc読み直しでしか直らない
      hardResetBgmAudio();
    }
  }
});
// 職業ごとの攻撃音(狩人/侍/砲術士は専用、僧侶・陰陽師は共用。それ以外は既存の汎用attack音のまま)
const CLASS_ATTACK_SFX = { hunter: "attack_hunter", samurai: "attack_samurai", priest: "attack_caster", onmyoji: "attack_caster", gunner: "attack_gunner", spearman: "attack_spearman", naginata: "attack_naginata", ninja: "attack_ninja" };
function attackSfxFor(classId) {
  return CLASS_ATTACK_SFX[classId] || "attack";
}
// 会心専用効果音(通常攻撃音とは別に鳴らす)。侍/薙刀士/槍士は共通のcrit_slash、忍は専用、
// 僧侶/陰陽師は共通のcrit_caster、狩人/砲術士はそれぞれ専用
const CLASS_CRIT_SFX = { samurai: "crit_slash", naginata: "crit_slash", spearman: "crit_slash", ninja: "crit_ninja", priest: "crit_caster", onmyoji: "crit_caster", hunter: "crit_hunter", gunner: "crit_gunner" };
function critSfxFor(classId) {
  return CLASS_CRIT_SFX[classId] || "crit_slash";
}
// ============ 打撃音の二層化(ユーザー提供の風切り音、2026-07-26) ============
// 近接職の攻撃を「振る音(ヒュッ)→一瞬の間→着弾音」の二層にして一撃の重みを出す。
// 風切りは音色分析の結果で2系統に分け(鋭い系3種=周波数重心約3000Hz・短い/重い系2種=低め・長め)、
// 系統内からランダムに選んで単調さを消す(足音と同じ考え方)。
// 遠隔・術系(狩人/砲術士/僧侶/陰陽師)は「振る」動作が無いため従来通り着弾音のみ
const SWISH_SFX_BY_CLASS = {
  samurai: ["swish_sharp_1", "swish_sharp_2", "swish_sharp_3"],
  ninja: ["swish_sharp_1", "swish_sharp_2", "swish_sharp_3"],
  spearman: ["swish_heavy_1", "swish_heavy_2"],
  naginata: ["swish_heavy_1", "swish_heavy_2"],
};
const SWISH_TO_IMPACT_MS = 90; // 振ってから着弾音までの間
function playAttackSfxWithSwish(classId) {
  const impact = attackSfxFor(classId);
  const pool = SWISH_SFX_BY_CLASS[classId];
  if (!pool) { playSfx(impact); return; }
  playSfx(pool[Math.floor(Math.random() * pool.length)]);
  setTimeout(() => playSfx(impact), SWISH_TO_IMPACT_MS);
}

// スピーカーアイコンをタップすると音量調整のポップオーバーを開閉する。実機で<input type="range">の
// つまみが小さくタップ判定がシビアすぎるという指摘が2回続いたため、スライダーはやめて
// 0〜10の11段階ボタン(タップ式、当たり判定は1つ1つ十分に大きい)に変更した
(() => {
  const row = document.getElementById("volumeBtnRow");
  for (let i = 0; i <= 10; i++) {
    const b = document.createElement("button");
    b.className = "volume-step-btn";
    b.dataset.step = i;
    b.textContent = i;
    b.onclick = (e) => {
      e.stopPropagation();
      setMasterBgmVolume(i / 10);
    };
    row.appendChild(b);
  }
})();
// ポップオーバーはbody直下のposition:fixed要素のため、開くたびに押されたボタンの実際の画面上の位置
// (getBoundingClientRect)を基準に座標を計算し直す(タブ切り替え等でボタン位置が変わっても追従する)。
// 温泉村だけでなく海の村/山伏の里(今後増える村も含む)にも同じ歯車ボタンを置けるよう、
// id="muteBtn"固定ではなく.mute-btnクラス全てに配線する(2026-07-21、ユーザー指摘)。
// 【不具合対策】温泉村のボタンは画面右寄りだったため常にrightで位置決めしていたが、海の村/
// 山伏の里のボタンは左寄りに置いたため、同じ計算式だとポップオーバーが画面左端からはみ出して
// 見切れてしまっていた。ボタンの位置に応じてleft/rightどちらで固定するかを都度判定するよう修正
document.querySelectorAll(".mute-btn").forEach((btn) => {
  btn.onclick = (e) => {
    e.stopPropagation();
    const popover = document.getElementById("volumePopover");
    if (popover.style.display !== "none") {
      popover.style.display = "none";
      return;
    }
    const btnRect = e.currentTarget.getBoundingClientRect();
    popover.style.top = `${Math.round(btnRect.bottom + 8)}px`;
    // 幅を測るためvisibility:hiddenのまま先に表示し、実測してからleft/rightを決める
    popover.style.visibility = "hidden";
    popover.style.left = "auto";
    popover.style.right = "auto";
    popover.style.display = "block";
    const popoverWidth = popover.offsetWidth;
    if (btnRect.left + popoverWidth <= window.innerWidth - 8) {
      popover.style.left = `${Math.round(btnRect.left)}px`;
    } else {
      popover.style.right = `${Math.round(Math.max(8, window.innerWidth - btnRect.right))}px`;
    }
    popover.style.visibility = "visible";
  };
});
document.addEventListener("click", (e) => {
  const popover = document.getElementById("volumePopover");
  if (popover.style.display !== "none" && !popover.contains(e.target) && !e.target.classList.contains("mute-btn")) {
    popover.style.display = "none";
  }
});
// メニュー内の「設定」「タイトルに戻る」。どちらもタップした瞬間にポップオーバー自体は閉じる
document.getElementById("menuSettingsBtn").onclick = () => {
  document.getElementById("volumePopover").style.display = "none";
  settingsReturnScreenId = document.querySelector(".screen.active")?.id || null;
  showScreen("screen-settings");
  renderSettingsScreen();
};
document.getElementById("menuTitleBtn").onclick = () => {
  document.getElementById("volumePopover").style.display = "none";
  showConfirmModal("タイトルに戻りますか？", [
    { label: "はい", className: "big danger", onClick: () => { showScreen("screen-title"); renderTitleScreen(); } },
    { label: "いいえ", className: "big" },
  ]);
};
applyMasterVolumeToUi(); // 初期表示(ボタンの選択状態)を実際の音量に同期させる

