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
  // ユーザー指示によりボス/中ボス/討伐依頼対象、いずれの戦闘も同じ曲(quest_target_battle_bgm.mp3)に統一。
  // キー自体は分けたまま(bgmPositions/stopBattleBgmのフェード対象リストなど既存の分岐に影響を出さないため)、
  // 参照先のファイルパスだけ揃えている
  boss_battle: "assets/bgm/quest_target_battle_bgm.mp3", // 最終ボス・序盤緊急依頼ボス専用(森・海岸共通、時間帯問わず)
  mid_boss_battle: "assets/bgm/quest_target_battle_bgm.mp3", // 中ボス専用(森・海岸共通、時間帯問わず)
  quest_target_battle: "assets/bgm/quest_target_battle_bgm.mp3", // 奉行所の討伐依頼対象(🎯)との戦闘専用。ただし中ボス/ボスの方が優先度が高い
};
// 中ボス(最終ボスの一段階手前、floor26+のがしゃどくろ・九尾の狐・大蟹王)専用のBGMを鳴らす対象。
// 最終ボス(kishin_rasetsuo/kaiyoujo_ou)や序盤緊急依頼ボス(isBoss:trueだがこのSetには含めない)は
// 従来通りboss_battleのまま
const MID_BOSS_BGM_IDS = new Set(["gashadokuro", "kyubi_no_kitsune", "oo_kani_ou"]);
// 探索中に流す曲を選ぶ(森はアンビエントのみ、海岸はcoast/coast_nightの2曲)。戦闘終了時にstopBattleBgm()からも呼ばれる
function playExplorationAreaBgm() {
  if (currentStage === "coast") playBgm(state.timeOfDay === "night" ? "coast_night" : "coast");
}
// 戦闘BGMを時間帯・ステージに応じて選ぶ。森は夜だけ専用曲、海岸はcoast_battle(昼夜共通)。
// 中ボス(battle.enemies内にMID_BOSS_BGM_IDSの敵が1体でもいる場合)はmid_boss_battle、
// それ以外のボス(最終ボス・序盤緊急依頼ボス、isBoss:true)はboss_battleを、森・海岸問わず優先する
function playBattleBgm() {
  if (battle && battle.enemies && battle.enemies.some((e) => MID_BOSS_BGM_IDS.has(e.id))) {
    battleBgmFadeToken++;
    currentBgmKey = null;
    bgmPositions.mid_boss_battle = 0; // ボス戦は毎回頭から再生する(coast_battleと同じ扱い)
    playBgm("mid_boss_battle");
    return;
  }
  if (battle && battle.enemies && battle.enemies.some((e) => e.isBoss)) {
    battleBgmFadeToken++;
    currentBgmKey = null;
    bgmPositions.boss_battle = 0; // ボス戦は毎回頭から再生する(coast_battleと同じ扱い)
    playBgm("boss_battle");
    return;
  }
  // 奉行所の討伐依頼対象(🎯、isQuestTarget)との戦闘専用BGM。中ボス/ボス(isBoss:trueの依頼対象も
  // 含む)は上の2つの分岐で既に処理済みのため、ここに来る時点でボス級ではないと確定している
  if (battle && battle.enemies && battle.enemies.some((e) => e.isQuestTarget)) {
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

// ============ BGM音量制御: Web Audio API(GainNode)経由 ============
// iOS(Safari/Chromeとも中身は同一のWebKitエンジン)は<audio>要素のvolumeプロパティへの
// JSからの変更を実際の出力に反映しない(音量はハードウェアの物理ボタンのみで変わる、という
// 既知のプラットフォーム制約)。これを回避するため、BGM系の5つの<audio>要素はすべて専用の
// AudioContext(bgmAudioCtx、効果音用のsfxAudioCtxとは完全に別インスタンス)へ接続し、
// 実際の音量制御はすべてGainNode.gain.valueで行う。audioEl.volumeは常に1(フル)のまま
// 以後一切変更しない(GainNode接続に失敗した異常系だけの例外的なフォールバックを除く)
let bgmAudioCtx = null;
try {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) bgmAudioCtx = new AudioContextClass();
  console.error("[BGM DIAG] bgmAudioCtx construction OK, initial state=", bgmAudioCtx ? bgmAudioCtx.state : "NO_CLASS"); // 調査用
} catch (e) {
  console.error("[BGM DIAG] bgmAudioCtx construction THREW", e); // 調査用
}
// <audio>要素 -> GainNode のキャッシュ。MediaElementAudioSourceNodeは同じ<audio>要素に対して
// 2度目の生成を試みると例外(InvalidStateError)になる仕様のため、要素ごとに最初の1回だけ
// source→gain→destinationの接続を作り、以降は必ずこのマップから取り出して使い回す
const bgmGainNodeMap = new Map();
function getBgmGainNode(audioEl) {
  if (!bgmAudioCtx) return null;
  const cached = bgmGainNodeMap.get(audioEl);
  if (cached) return cached;
  try {
    const source = bgmAudioCtx.createMediaElementSource(audioEl);
    const gain = bgmAudioCtx.createGain();
    source.connect(gain).connect(bgmAudioCtx.destination);
    bgmGainNodeMap.set(audioEl, gain);
    console.error("[BGM DIAG] getBgmGainNode: created OK for", audioEl.id); // 調査用
    return gain;
  } catch (e) {
    console.error("[BGM DIAG] getBgmGainNode: createMediaElementSource/createGain/connect threw for", audioEl.id, e); // 調査用
    return null; // 生成に失敗した場合、setBgmVolume/getBgmVolumeがaudioEl.volumeへフォールバックする
  }
}
// BGM系<audio>要素1つぶんの実効音量を設定する共通ヘルパー。既存の初期化・フェード処理は
// すべてこの関数経由に統一し、audioEl.volumeへの直接代入は行わない
function setBgmVolume(audioEl, value) {
  const gain = getBgmGainNode(audioEl);
  if (gain) {
    gain.gain.value = value;
    audioEl.volume = 1; // 音量はGainNode側で制御するため、要素自体は常にフルのままにしておく
  } else {
    console.error("[BGM DIAG] setBgmVolume: FALLBACK path (no gain node) for", audioEl.id, "value=", value); // 調査用
    audioEl.volume = value; // GainNode接続に失敗した環境向けのフォールバック
  }
}
// フェード処理の「現在の音量」の読み取りにも同じ経路を使う(GainNode接続時はgain.value、
// フォールバック時はaudioEl.volumeを返す)
function getBgmVolume(audioEl) {
  const gain = getBgmGainNode(audioEl);
  return gain ? gain.gain.value : audioEl.volume;
}
// ============ 【調査用・一時的】BGM無音バグの原因切り分けログ ============
// 原因が判明するまではロジックを一切変更せず、状態のスナップショットをconsole.errorへ出すだけ。
// 調査が終わったらこのブロックと各呼び出し箇所は削除する
//
// ユーザーがSafari Web Inspector等でconsole.errorを直接見られない(実機のみで確認している)ため、
// console.errorを横取りして画面上の履歴パネルにも同じ内容を溜め込む。個々の呼び出し箇所を
// 全部書き換える必要が無いよう、console.error自体をラップする方式にしてある
const bgmDiagHistory = [];
const BGM_DIAG_HISTORY_MAX = 60;
const bgmDiagOrigConsoleError = console.error.bind(console);
console.error = function (...args) {
  bgmDiagOrigConsoleError(...args);
  try {
    const msg = args.map((a) => {
      if (typeof a === "string") return a;
      try { return JSON.stringify(a); } catch (e2) { return String(a); }
    }).join(" ");
    if (msg.indexOf("[BGM DIAG]") !== -1) {
      bgmDiagHistory.push("+" + performance.now().toFixed(0) + "ms " + msg.replace("[BGM DIAG] ", ""));
      if (bgmDiagHistory.length > BGM_DIAG_HISTORY_MAX) bgmDiagHistory.shift();
    }
  } catch (e2) {}
};
function bgmDiagSnapshot() {
  const gain = bgmGainNodeMap.get(bgmAudio);
  return {
    bgmAudioCtxState: bgmAudioCtx ? bgmAudioCtx.state : "NO_CONTEXT",
    bgmAudioPaused: bgmAudio.paused,
    bgmAudioCurrentSrc: bgmAudio.currentSrc,
    bgmAudioCurrentTime: bgmAudio.currentTime,
    bgmAudioMuted: bgmAudio.muted,
    bgmAudioVolume: bgmAudio.volume,
    gainNodeExists: !!gain,
    gainValue: gain ? gain.gain.value : "NO_GAIN_NODE",
    currentBgmKey,
    audioUnlocked,
  };
}
function logBgmDiag(label) {
  try {
    console.error("[BGM DIAG]", label, JSON.stringify(bgmDiagSnapshot()));
  } catch (e) {
    console.error("[BGM DIAG] logBgmDiag itself threw:", e);
  }
}
// スマホ実機でSafari Web Inspector等を使わなくても目視で状態を確認できるよう、画面左上に
// 小さな診断パネルを常設し、200msごとに最新の状態を表示し続ける。調査専用の一時コード
function renderBgmDiagOverlay() {
  try {
    let el = document.getElementById("bgmDiagOverlay");
    if (!el) {
      el = document.createElement("div");
      el.id = "bgmDiagOverlay";
      el.style.cssText = "position:fixed;top:0;left:0;z-index:999999;background:rgba(0,0,0,0.9);color:#0f0;font-size:9px;font-family:monospace;padding:4px 6px;white-space:pre-wrap;pointer-events:auto;overflow-y:auto;max-width:100vw;max-height:55vh;line-height:1.25;";
      document.body.appendChild(el);
    }
    const s = bgmDiagSnapshot();
    const header =
      "[BGM DIAG] (タップでスクロール可)\n" +
      "ctxState: " + s.bgmAudioCtxState + "\n" +
      "paused: " + s.bgmAudioPaused + "  muted: " + s.bgmAudioMuted + "\n" +
      "volume: " + s.bgmAudioVolume + "  gain: " + s.gainValue + "\n" +
      "currentTime: " + s.bgmAudioCurrentTime.toFixed(2) + "\n" +
      "key: " + s.currentBgmKey + "  unlocked: " + s.audioUnlocked + "\n" +
      "src: " + (s.bgmAudioCurrentSrc || "").split("/").pop() + "\n" +
      "----- history(古い順、下が最新) -----\n";
    // スクロール位置維持: ユーザーが履歴を読んでいる最中に自動で最下部へ飛ばされないよう、
    // 既に一番下までスクロール済みの時だけ更新後も最下部へ追従させる
    const wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
    el.textContent = header + bgmDiagHistory.join("\n");
    if (wasAtBottom) el.scrollTop = el.scrollHeight;
  } catch (e) {
    console.error("[BGM DIAG] renderBgmDiagOverlay threw:", e);
  }
}
setInterval(renderBgmDiagOverlay, 200); // 調査用

const BGM_BASE_VOLUME = 0.8; // ユーザー指示で村・冒険中(戦闘含む)BGMの音量を80%に
const LODGING_BGM_VOLUME = 0.5;
const CAMP_BGM_VOLUME = 0.5;
const AMBIENT_BGM_VOLUME = 0.45;
const OPENING_BGM_VOLUME = 0.55;
setBgmVolume(bgmAudio, BGM_BASE_VOLUME);
setBgmVolume(lodgingBgmAudio, LODGING_BGM_VOLUME);
setBgmVolume(campBgmAudio, CAMP_BGM_VOLUME);
setBgmVolume(ambientBgmAudio, AMBIENT_BGM_VOLUME);
setBgmVolume(openingBgmAudio, OPENING_BGM_VOLUME);
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
  console.error("[BGM DIAG] unlockAudio: start"); // 調査用
  logBgmDiag("unlockAudio: before play/resume"); // 調査用
  if (currentBgmKey) {
    // 既に町/冒険用のBGMキーが決まっている(=タイトルより先に進んでいる)場合はそちらを再開する
    bgmAudio.play().then(() => logBgmDiag("unlockAudio: bgmAudio.play() resolved")).catch((e) => { console.error("[BGM DIAG] unlockAudio: bgmAudio.play() REJECTED", e); logBgmDiag("unlockAudio: bgmAudio.play() rejected"); }); // 調査用
    ambientBgmAudio.play().catch((e) => console.error("[BGM DIAG] unlockAudio: ambientBgmAudio.play() REJECTED", e)); // 調査用
  } else {
    // まだタイトル/オープニング中(currentBgmKeyは最初のplayBgm()呼び出しまでnullのまま)。
    // オープニングBGMの再生を試みる。起動直後の自動再生が制限で失敗していた場合、
    // ユーザーの最初の操作によるこの呼び出しが確実な再試行のタイミングになる
    openingBgmAudio.play().then(() => logBgmDiag("unlockAudio: openingBgmAudio.play() resolved")).catch((e) => { console.error("[BGM DIAG] unlockAudio: openingBgmAudio.play() REJECTED", e); logBgmDiag("unlockAudio: openingBgmAudio.play() rejected"); }); // 調査用
  }
  // iPhone Safari対策: SE用/BGM用、どちらのAudioContextもユーザーの最初のタップの中でresume()する必要がある
  if (sfxAudioCtx && sfxAudioCtx.state === "suspended") {
    sfxAudioCtx.resume().then(() => console.error("[BGM DIAG] unlockAudio: sfxAudioCtx.resume() resolved, state=", sfxAudioCtx.state)).catch((e) => console.error("[BGM DIAG] unlockAudio: sfxAudioCtx.resume() REJECTED", e)); // 調査用
  } else {
    console.error("[BGM DIAG] unlockAudio: sfxAudioCtx resume NOT attempted. exists=", !!sfxAudioCtx, "state=", sfxAudioCtx ? sfxAudioCtx.state : null); // 調査用
  }
  if (bgmAudioCtx && bgmAudioCtx.state === "suspended") {
    bgmAudioCtx.resume().then(() => logBgmDiag("unlockAudio: bgmAudioCtx.resume() resolved")).catch((e) => { console.error("[BGM DIAG] unlockAudio: bgmAudioCtx.resume() REJECTED", e); logBgmDiag("unlockAudio: bgmAudioCtx.resume() rejected"); }); // 調査用
  } else {
    console.error("[BGM DIAG] unlockAudio: bgmAudioCtx resume NOT attempted. exists=", !!bgmAudioCtx, "state=", bgmAudioCtx ? bgmAudioCtx.state : null); // 調査用
  }
  setTimeout(() => logBgmDiag("unlockAudio: +1000ms snapshot"), 1000); // 調査用
  setTimeout(() => logBgmDiag("unlockAudio: +3000ms snapshot"), 3000); // 調査用
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
// 村の「town」キー(早朝/夜以外、朝・昼・夕方に使われる)だけ、他のBGMと独立して音量を調整する。
// 以前は<audio>要素のvolumeで制御しておりiOSでは反映されなかったが、GainNode経由の音量制御に
// 移行したことで実機でも効くようになった。ユーザー指示で現状比70%(30%減)にする
const TOWN_DAY_BGM_VOLUME_MULT = 0.7;
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
  const startVol = getBgmVolume(openingBgmAudio);
  const startTime = performance.now();
  const myToken = ++openingBgmFadeToken;
  const durationMs = 600;
  function step() {
    if (openingBgmFadeToken !== myToken) return;
    const t = Math.min(1, (performance.now() - startTime) / durationMs);
    setBgmVolume(openingBgmAudio, startVol * (1 - t));
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      openingBgmAudio.pause();
      openingBgmAudio.currentTime = 0;
      setBgmVolume(openingBgmAudio, OPENING_BGM_VOLUME);
    }
  }
  step();
}
// 【調査用・一時的】playBgm()が短時間に何回・どのタイミングで重複して呼ばれているかを実測するための
// 通し番号カウンタ。呼び出しごとに採番し、resumeの待ち時間中に別の呼び出しが割り込んでいないかを見る
let playBgmCallSeq = 0;
async function playBgm(key) {
  const callId = ++playBgmCallSeq;
  const callStartMs = performance.now();
  console.error("[BGM DIAG] playBgm(" + key + ") call#" + callId + ": ENTER at t=" + callStartMs.toFixed(1) + "ms, ctxState=" + (bgmAudioCtx ? bgmAudioCtx.state : "NO_CTX")); // 調査用
  // 【調査用・一時的】resume仮説の最小実験: 呼ばれるたびに(unlockAudio()の1回きりの試行に
  // 頼らず)suspendedならここで毎回resumeを試みる。これだけでBGMが鳴るようになるか検証する
  if (bgmAudioCtx && bgmAudioCtx.state === "suspended") {
    console.error("[BGM DIAG] playBgm(" + key + ") call#" + callId + ": ctx suspended, awaiting resume()..."); // 調査用
    try {
      await bgmAudioCtx.resume();
      console.error("[BGM DIAG] playBgm(" + key + ") call#" + callId + ": resume() succeeded at t=" + performance.now().toFixed(1) + "ms (waited " + (performance.now() - callStartMs).toFixed(1) + "ms), state=", bgmAudioCtx.state); // 調査用
    } catch (e) {
      console.error("[BGM DIAG] playBgm(" + key + ") call#" + callId + ": resume() REJECTED", e); // 調査用
    }
  }
  console.error("[BGM DIAG] playBgm(" + key + ") call#" + callId + ": PROCEEDING past resume-wait at t=" + performance.now().toFixed(1) + "ms, currentBgmKey=" + currentBgmKey); // 調査用
  // タイトル画面を離れて最初の本編BGMが決まった瞬間、流れっぱなしのオープニング/タイトル曲を
  // フェードアウトする(このガードが無いと、町BGMと二重に鳴り続けてしまう)
  fadeOutOpeningBgm();
  if (currentBgmKey === key) {
    // 同じ曲を続けて流すはずの場面(海岸の探索→戦闘の継続再生など)で、何らかの理由で
    // 要素が一時停止してしまっていた場合に無音のまま固まらないよう、ここで取りこぼさず再開する
    if (bgmAudio.paused && audioUnlocked) {
      console.error("[BGM DIAG] playBgm(" + key + ") call#" + callId + ": same key, resuming paused element"); // 調査用
      bgmAudio.play().then(() => logBgmDiag("playBgm(" + key + ") call#" + callId + ": same-key resume play() resolved")).catch((e) => { console.error("[BGM DIAG] playBgm(" + key + ") call#" + callId + ": same-key resume play() REJECTED", e); logBgmDiag("playBgm(" + key + ") call#" + callId + ": same-key resume play() rejected"); }); // 調査用
    } else {
      console.error("[BGM DIAG] playBgm(" + key + ") call#" + callId + ": same key, already playing, NO-OP"); // 調査用
    }
    return;
  }
  console.error("[BGM DIAG] playBgm(" + key + ") call#" + callId + ": RESTARTING track from currentTime=" + (bgmPositions[key] || 0) + " (this resets playback position!)"); // 調査用
  if (currentBgmKey) bgmPositions[currentBgmKey] = bgmAudio.currentTime;
  currentBgmKey = key;
  bgmAudio.src = BGM_TRACKS[key];
  bgmAudio.currentTime = bgmPositions[key] || 0;
  setBgmVolume(bgmAudio, bgmVolumeForKey(key));
  logBgmDiag("playBgm(" + key + ") call#" + callId + ": before play(), audioUnlocked=" + audioUnlocked); // 調査用
  if (audioUnlocked) {
    bgmAudio.play().then(() => logBgmDiag("playBgm(" + key + ") call#" + callId + ": play() resolved")).catch((e) => { console.error("[BGM DIAG] playBgm(" + key + ") call#" + callId + ": play() REJECTED", e); logBgmDiag("playBgm(" + key + ") call#" + callId + ": play() rejected"); }); // 調査用
  } else {
    console.error("[BGM DIAG] playBgm(" + key + ") call#" + callId + ": audioUnlocked is false, play() NOT called"); // 調査用
  }
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
  return !!(state.acceptedQuest && state.acceptedQuest.chasing && isBossBgmActive());
}
function stopBattleBgm() {
  if (currentBgmKey !== "dungeon" && currentBgmKey !== "dungeon_night" && currentBgmKey !== "coast_battle" && currentBgmKey !== "boss_battle" && currentBgmKey !== "mid_boss_battle" && currentBgmKey !== "quest_target_battle") return;
  const key = currentBgmKey;
  // ボス戦(boss_battle/mid_boss_battle/quest_target_battle)は森・海岸共通の1トラックのため、
  // 戦闘終了時にどちらへ戻すかは現在のステージ(currentStage)で判定する
  // (coast_battleは元々このキー自体で確定していた)
  const wasCoastBattle = key === "coast_battle" || ((key === "boss_battle" || key === "mid_boss_battle" || key === "quest_target_battle") && currentStage === "coast");
  const startVol = getBgmVolume(bgmAudio);
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
    setBgmVolume(bgmAudio, startVol * (1 - t));
    if (t < 1) {
      requestAnimationFrame(fadeStep);
    } else {
      bgmPositions[key] = 0;
      bgmAudio.pause();
      setBgmVolume(bgmAudio, BGM_BASE_VOLUME);
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
// 音量制御はGainNode経由(setBgmVolume)のため、iOS実機でも滑らかにフェードする
const LODGING_BGM_FADE_OUT_MS = 1200;
function playLodgingBgm() {
  const startVol = getBgmVolume(bgmAudio);
  const startTime = performance.now();
  function fadeStep() {
    const t = Math.min(1, (performance.now() - startTime) / LODGING_BGM_FADE_OUT_MS);
    setBgmVolume(bgmAudio, startVol * (1 - t));
    if (t < 1) {
      requestAnimationFrame(fadeStep);
    } else {
      bgmAudio.pause();
      setBgmVolume(bgmAudio, BGM_BASE_VOLUME);
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
  const startVol = getBgmVolume(bgmAudio);
  const startTime = performance.now();
  function fadeStep() {
    const t = Math.min(1, (performance.now() - startTime) / CAMP_BGM_FADE_MS);
    setBgmVolume(bgmAudio, startVol * (1 - t));
    if (t < 1) {
      requestAnimationFrame(fadeStep);
    } else {
      bgmAudio.pause();
      setBgmVolume(bgmAudio, BGM_BASE_VOLUME);
      campBgmAudio.currentTime = 0;
      if (audioUnlocked) campBgmAudio.play().catch(() => {});
    }
  }
  fadeStep();
}
function stopCampBgm(onDone) {
  const startVol = getBgmVolume(campBgmAudio);
  const startTime = performance.now();
  function fadeStep() {
    const t = Math.min(1, (performance.now() - startTime) / CAMP_BGM_FADE_MS);
    setBgmVolume(campBgmAudio, startVol * (1 - t));
    if (t < 1) {
      requestAnimationFrame(fadeStep);
    } else {
      campBgmAudio.pause();
      setBgmVolume(campBgmAudio, CAMP_BGM_VOLUME);
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
// 新規のAudioBufferSourceNodeを使い捨てで生成して即座に鳴らす方式に変更した。BGM(bgmAudio等)は
// 別途bgmAudioCtx(上のsetBgmVolume/getBgmGainNode参照)を使うため、このAudioContextはSE専用のまま
const SFX_EXT = { select: "ogg", coin: "ogg", heal: "ogg", attack: "ogg", victory: "ogg", attack_hunter: "mp3", attack_samurai: "mp3", attack_caster: "mp3", attack_gunner: "mp3", attack_spearman: "mp3", attack_naginata: "mp3", attack_ninja: "mp3", hit_taken_1: "mp3", hit_taken_2: "mp3", hit_taken_3: "mp3", hit_taken_4: "mp3", onsen: "mp3", onsen_enter: "mp3", evade: "mp3", guard: "mp3", flee: "mp3", extension_build: "mp3", skill_confirm: "mp3", smoke_bomb: "mp3", morning_chime: "mp3", footstep: "mp3", departure: "mp3", result: "mp3", big_attack_warning: "mp3", carry: "mp3", shoot_down: "mp3", transform: "mp3", crit_slash: "mp3", crit_ninja: "mp3", crit_caster: "mp3", crit_hunter: "mp3", crit_gunner: "mp3", quest_accept: "mp3", title_tap: "mp3", hawk_summon: "mp3", omikuji_normal: "mp3", omikuji_daikichi: "mp3", onsen_relief: "mp3" };
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
    sfxAudioCtx.resume().catch((e) => console.error("[BGM DIAG] visibilitychange: sfxAudioCtx.resume() REJECTED", e)); // 調査用
  }
  if (document.visibilityState === "visible" && bgmAudioCtx && bgmAudioCtx.state === "suspended") {
    bgmAudioCtx.resume().then(() => logBgmDiag("visibilitychange: bgmAudioCtx.resume() resolved")).catch((e) => console.error("[BGM DIAG] visibilitychange: bgmAudioCtx.resume() REJECTED", e)); // 調査用
  }
  if (document.visibilityState === "visible" && currentBgmKey && bgmAudio.paused && audioUnlocked) {
    bgmAudio.play().catch((e) => console.error("[BGM DIAG] visibilitychange: bgmAudio.play() REJECTED", e)); // 調査用
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

