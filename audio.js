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
};
// 探索中に流す曲を選ぶ(森はアンビエントのみ、海岸はcoast/coast_nightの2曲)。戦闘終了時にstopBattleBgm()からも呼ばれる
function playExplorationAreaBgm() {
  if (currentStage === "coast") playBgm(state.timeOfDay === "night" ? "coast_night" : "coast");
}
// 戦闘BGMを時間帯・ステージに応じて選ぶ。森は夜だけ専用曲、海岸はcoast_battle(昼夜共通)
function playBattleBgm() {
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
const BGM_BASE_VOLUME = 0.8; // ユーザー指示で村・冒険中(戦闘含む)BGMの音量を80%に
const LODGING_BGM_VOLUME = 0.5;
const CAMP_BGM_VOLUME = 0.5;
const AMBIENT_BGM_VOLUME = 0.45;
const OPENING_BGM_VOLUME = 0.55;
bgmAudio.volume = BGM_BASE_VOLUME;
lodgingBgmAudio.volume = LODGING_BGM_VOLUME;
campBgmAudio.volume = CAMP_BGM_VOLUME;
ambientBgmAudio.volume = AMBIENT_BGM_VOLUME;
openingBgmAudio.volume = OPENING_BGM_VOLUME;
let audioUnlocked = false;
let muted = false;
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
    bgmAudio.play().catch(() => {});
    ambientBgmAudio.play().catch(() => {});
  } else {
    // まだタイトル/オープニング中(currentBgmKeyは最初のplayBgm()呼び出しまでnullのまま)。
    // オープニングBGMの再生を試みる。起動直後の自動再生が制限で失敗していた場合、
    // ユーザーの最初の操作によるこの呼び出しが確実な再試行のタイミングになる
    openingBgmAudio.play().catch(() => {});
  }
  // iPhone Safari対策: SE用AudioContextはユーザーの最初のタップの中でresume()する必要がある
  if (sfxAudioCtx && sfxAudioCtx.state === "suspended") sfxAudioCtx.resume().catch(() => {});
}
["pointerdown", "touchstart", "mousedown", "keydown"].forEach((evt) => {
  document.addEventListener(evt, unlockAudio, { once: true, passive: true });
});

// iPhone Safariのダブルタップズーム対策。touch-action:manipulation(html,body)とviewportの
// maximum-scale=1/user-scalable=noだけでは、探索画面のように連続してボタンをタップする場面で
// ズームが発生してしまうことがあったため、素早い連続タップの2回目のtouchendを明示的に
// preventDefault()してズームジェスチャー自体の発生を止める。
// 最初は「350ms以内なら問答無用でブロック」だったが、攻撃連打など通常の高速操作まで
// 潰してしまう(反応しないボタンがある)という指摘を受け、「同じ要素への連打」限定+
// ウィンドウを150msまで短縮する形に調整した(別の要素を素早く連続タップする通常操作は影響を受けない)

// 海岸ステージのBGMだけ、ユーザー指示で音量を1.7倍にする(他は通常のBGM_BASE_VOLUMEのまま)
const COAST_BGM_VOLUME_MULT = 1.7;
// 村の「town」キー(早朝/夜以外、朝・昼・夕方に使われる)だけ、ユーザー指示で音量を8割にする
const TOWN_DAY_BGM_VOLUME_MULT = 0.8;
function bgmVolumeForKey(key) {
  if (key === "coast" || key === "coast_night" || key === "coast_battle") return Math.min(1, BGM_BASE_VOLUME * COAST_BGM_VOLUME_MULT);
  if (key === "town") return BGM_BASE_VOLUME * TOWN_DAY_BGM_VOLUME_MULT;
  return BGM_BASE_VOLUME;
}
// タイトル/オープニングBGM(openingBgmAudio)からの引き継ぎ用フェードアウト。
// playBgm()が最初に呼ばれた時点(=タイトルを離れて実際のゲーム画面のBGMが決まった時点)で
// 自動的に呼ばれる。0.6秒で滑らかに消し、二重再生や急なブツ切りにならないようにする
let openingBgmFadeToken = 0;
function fadeOutOpeningBgm() {
  if (openingBgmAudio.paused) return;
  const startVol = openingBgmAudio.volume;
  const startTime = performance.now();
  const myToken = ++openingBgmFadeToken;
  const durationMs = 600;
  function step() {
    if (openingBgmFadeToken !== myToken) return;
    const t = Math.min(1, (performance.now() - startTime) / durationMs);
    openingBgmAudio.volume = startVol * (1 - t);
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      openingBgmAudio.pause();
      openingBgmAudio.currentTime = 0;
      openingBgmAudio.volume = OPENING_BGM_VOLUME;
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
    if (bgmAudio.paused && audioUnlocked) bgmAudio.play().catch(() => {});
    return;
  }
  if (currentBgmKey) bgmPositions[currentBgmKey] = bgmAudio.currentTime;
  currentBgmKey = key;
  bgmAudio.src = BGM_TRACKS[key];
  bgmAudio.currentTime = bgmPositions[key] || 0;
  bgmAudio.volume = bgmVolumeForKey(key);
  if (audioUnlocked) bgmAudio.play().catch(() => {});
}

// 戦闘終了時: 森の戦闘専用BGM(dungeon/dungeon_night)をフェードアウトして止める。海岸は戦闘中も
// 探索用BGMを切り替えず流し続ける設計のため、ここでは一切触らない(currentBgmKeyがcoast系なら即return)。
// 毎回の戦闘開始時に必ず曲の頭から鳴らしたいので、フェード完了時に再生位置を0にリセットしてから
// currentBgmKeyをnullに戻す(nullにしないとplayBattleBgm()の「同キーなら何もしない」判定で無音のまま止まる)
const BATTLE_BGM_FADE_OUT_MS = 3000;
function stopBattleBgm() {
  if (currentBgmKey !== "dungeon" && currentBgmKey !== "dungeon_night" && currentBgmKey !== "coast_battle") return;
  const key = currentBgmKey;
  const wasCoastBattle = key === "coast_battle";
  const startVol = bgmAudio.volume;
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
    bgmAudio.volume = startVol * (1 - t);
    if (t < 1) {
      requestAnimationFrame(fadeStep);
    } else {
      bgmPositions[key] = 0;
      bgmAudio.pause();
      bgmAudio.volume = BGM_BASE_VOLUME;
      currentBgmKey = null;
      if (wasCoastBattle) playExplorationAreaBgm(); // 海岸は戦闘終了後、探索用BGM(coast/coast_night)へ戻す
    }
  }
  fadeStep();
}

// 環境音: 探索中・戦闘中を通して共通で流れ続ける環境音。森は虫の声(朝昼insect_day/夕夜insect_night、
// forceKeyを渡すと時間帯に関わらずそのキーを強制。野営演出が視覚的には常に夜へ切り替わるため、
// 野営開始時だけ強制的にinsect_nightへ寄せる用途)、海岸は波音(coast_ambient、時間帯に関わらず1種類)を使う
const AMBIENT_BGM_TRACKS = { day: "assets/bgm/insect_day.mp3", night: "assets/bgm/insect_night.mp3" };
const COAST_AMBIENT_TRACK = "assets/bgm/coast_ambient.mp3";
let currentAmbientKey = null;
function ambientKeyForTimeOfDay(tod) {
  return tod === "dawn" || tod === "asa" || tod === "day" ? "day" : "night";
}
function playAmbientBgm(forceKey) {
  const key = currentStage === "coast" ? "coast" : (forceKey || ambientKeyForTimeOfDay(state.timeOfDay));
  if (currentAmbientKey === key) return;
  currentAmbientKey = key;
  ambientBgmAudio.src = key === "coast" ? COAST_AMBIENT_TRACK : AMBIENT_BGM_TRACKS[key];
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
  bgmAudio.pause();
  bgmPositions[currentBgmKey] = 0;
  currentBgmKey = null;
}

// 町のBGM(bgmAudio)を即座に止める。探索中はbgmAudioを戦闘専用として使うため、森に入る瞬間に
// 明示的に止めておかないと、以前ここでplayBgm("dungeon")を呼んでいた(=同じ要素のsrcを上書きすることで
// 自動的に町の曲が止まっていた)頃と違い、何もしなければ町のBGMが鳴りっぱなしになってしまう
function stopTownBgm() {
  bgmAudio.pause();
  currentBgmKey = null;
}

// 宿泊時: 町のBGMをフェードで止め、代わりに宿泊専用の一度きりの曲を再生する。曲が鳴り終わったら
// (ended)、町のBGMを最初から再開する(bgmPositionsの続きからではなく、必ず頭出しする)。
// 補足: <audio>要素のvolumeでのフェードはiOS Safariでは効かない(音量はハードウェアボタンのみで制御され、
// JSからの変更は無視される)ため実機では厳密には滑らかにならない。Web Audio API(GainNode)化で
// 直そうとしたが、村の基本BGMまで無音になる重大な副作用が出たため、確実に動く現状の方式に戻してある
const LODGING_BGM_FADE_OUT_MS = 1200;
function playLodgingBgm() {
  const startVol = bgmAudio.volume;
  const startTime = performance.now();
  function fadeStep() {
    const t = Math.min(1, (performance.now() - startTime) / LODGING_BGM_FADE_OUT_MS);
    bgmAudio.volume = startVol * (1 - t);
    if (t < 1) {
      requestAnimationFrame(fadeStep);
    } else {
      bgmAudio.pause();
      bgmAudio.volume = BGM_BASE_VOLUME;
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
  const startVol = bgmAudio.volume;
  const startTime = performance.now();
  function fadeStep() {
    const t = Math.min(1, (performance.now() - startTime) / CAMP_BGM_FADE_MS);
    bgmAudio.volume = startVol * (1 - t);
    if (t < 1) {
      requestAnimationFrame(fadeStep);
    } else {
      bgmAudio.pause();
      bgmAudio.volume = BGM_BASE_VOLUME;
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
const SFX_EXT = { select: "ogg", coin: "ogg", heal: "ogg", attack: "ogg", victory: "ogg", attack_hunter: "mp3", attack_samurai: "mp3", attack_caster: "mp3", attack_gunner: "mp3", attack_spearman: "mp3", attack_naginata: "mp3", attack_ninja: "mp3", hit_taken_1: "mp3", hit_taken_2: "mp3", hit_taken_3: "mp3", hit_taken_4: "mp3", onsen: "mp3", onsen_enter: "mp3", evade: "mp3", guard: "mp3", flee: "mp3", extension_build: "mp3", skill_confirm: "mp3", smoke_bomb: "mp3", morning_chime: "mp3", footstep: "mp3", departure: "mp3", result: "mp3", big_attack_warning: "mp3", carry: "mp3", shoot_down: "mp3", transform: "mp3", crit_slash: "mp3", crit_ninja: "mp3", crit_caster: "mp3", crit_hunter: "mp3", crit_gunner: "mp3", quest_accept: "mp3" };
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
// 被弾ダメージが対象の最大HPに占める割合に応じて効果音を出し分ける(小さい一撃と致命傷級で音の重さを変える)
function hitTakenSfxFor(dmg, maxHp) {
  const ratio = maxHp > 0 ? dmg / maxHp : 0;
  if (ratio < 0.2) return "hit_taken_1";
  if (ratio < 0.4) return "hit_taken_2";
  if (ratio < 0.7) return "hit_taken_3";
  return "hit_taken_4";
}
function playSfx(name) {
  if (muted) return;
  const buffer = sfxBuffers[name];
  if (!buffer || !sfxAudioCtx) return; // デコードがまだ終わっていない場合は諦める(旧実装の.catch(()=>{})と同じく無音で失敗させる)
  const start = () => {
    const source = sfxAudioCtx.createBufferSource(); // 使い回さず毎回新規生成(同時多重再生に対応)
    source.buffer = buffer;
    source.connect(sfxAudioCtx.destination);
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
  if (document.visibilityState === "visible" && sfxAudioCtx && sfxAudioCtx.state === "suspended") {
    sfxAudioCtx.resume().catch(() => {});
  }
  if (document.visibilityState === "visible" && currentBgmKey && bgmAudio.paused && audioUnlocked) {
    bgmAudio.play().catch(() => {});
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

document.getElementById("muteBtn").onclick = () => {
  muted = !muted;
  bgmAudio.muted = muted;
  lodgingBgmAudio.muted = muted;
  openingBgmAudio.muted = muted;
  document.getElementById("muteBtn").textContent = muted ? "🔇" : "🔊";
};

