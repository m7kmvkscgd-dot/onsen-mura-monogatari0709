// audio_vol_test.jsから結合実行されるテスト本体(ゲーム全スクリプトと同じevalスコープで動く)
(async () => {
  const errors = [];
  const ok = (cond, msg) => { if (!cond) { errors.push(msg); console.error("  ✗ " + msg); } };
  const near = (a, b) => Math.abs(a - b) < 0.0001;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const TRACE = window.__AUDIO_TRACE;
  try {
    // ---- 1. Context構成: bgm/sfx/ambient/openingの4個、MediaElementSourceは各Contextに最大1本 ----
    ok(TRACE.contexts.length === 4, `AudioContextは4個のはず(実際${TRACE.contexts.length})`);
    TRACE.contexts.forEach((c, i) => ok(c.__mediaSources.length <= 1, `Context#${i}のMediaElementSourceが${c.__mediaSources.length}本(1本以下のはず)`));
    const allMediaEls = TRACE.contexts.flatMap((c) => c.__mediaSources.map((s) => s.__el));
    ok(allMediaEls.includes(bgmAudio) && allMediaEls.includes(ambientBgmAudio) && allMediaEls.includes(openingBgmAudio), "bgm/ambient/openingの3要素が接続されているはず");
    ok(!allMediaEls.includes(lodgingBgmAudio) && !allMediaEls.includes(campBgmAudio), "宿泊/野営の要素はMediaElementSourceに接続しない(バッファ方式)");
    ok(!!bgmGainNode && !!ambientGainNode && !!openingGainNode, "3本のGainNodeが構築されているはず");

    // ---- 2. 通常BGM21キー: srcとgain(キー別基準×マスター)が正しい ----
    ok(Object.keys(BGM_TRACKS).length === 21, `BGM_TRACKSは21キーのはず(実際${Object.keys(BGM_TRACKS).length})`);
    for (const key of Object.keys(BGM_TRACKS)) {
      playBgm(key);
      ok(currentBgmKey === key, `playBgm(${key})後のcurrentBgmKey`);
      ok(bgmAudio.src.includes(BGM_TRACKS[key].split("/").pop()), `playBgm(${key})のsrc`);
      ok(near(bgmGainNode.gain.value, bgmVolumeForKey(key) * masterBgmVolume), `playBgm(${key})のgain(${bgmGainNode.gain.value})`);
    }

    // aux用バッファ(宿泊/野営)のプリロード完了を待つ
    for (let i = 0; i < 50 && !(auxBuffers.lodging && auxBuffers.camp); i++) await sleep(50);
    ok(!!auxBuffers.lodging && !!auxBuffers.camp, "宿泊/野営のAudioBufferがプリロードされているはず");

    // ---- 3. マスター音量がaux4チャンネル全てに乗る/0でmuted ----
    setMasterBgmVolume(0.2);
    ok(near(ambientGainNode.gain.value, AMBIENT_BGM_VOLUME * 0.2), "マスター0.2: ambient gain");
    ok(near(openingGainNode.gain.value, OPENING_BGM_VOLUME * 0.2), "マスター0.2: opening gain");
    ok(near(lodgingBufGain.gain.value, LODGING_BGM_VOLUME * 0.2), "マスター0.2: lodging gain");
    ok(near(campBufGain.gain.value, CAMP_BGM_VOLUME * 0.2), "マスター0.2: camp gain");
    setMasterBgmVolume(0);
    ok(lodgingBgmAudio.muted && openingBgmAudio.muted && ambientBgmAudio.muted && campBgmAudio.muted, "マスター0: aux要素は全てmuted");
    ok(near(campBufGain.gain.value, 0) && near(lodgingBufGain.gain.value, 0), "マスター0: バッファ経路もgain0");
    setMasterBgmVolume(0.6);
    ok(!ambientBgmAudio.muted, "マスター0.6: muted解除");

    // ---- 4. 環境音の切替: 昼虫→夜虫→波→洞窟(洞窟だけ基準1.0=焼き込み40%を等倍) ----
    currentStage = "dungeon";
    state.timeOfDay = "day";
    playAmbientBgm();
    ok(currentAmbientKey === "day" && ambientBgmAudio.src.includes("insect_day.mp3"), "環境音: 昼の虫");
    ok(near(ambientGainNode.gain.value, 0.45 * 0.6), `環境音: 昼虫gain(${ambientGainNode.gain.value})`);
    state.timeOfDay = "night";
    playAmbientBgm();
    ok(currentAmbientKey === "night" && ambientBgmAudio.src.includes("insect_night.mp3"), "環境音: 夜の虫");
    currentStage = "coast";
    playAmbientBgm();
    ok(currentAmbientKey === "coast" && ambientBgmAudio.src.includes("coast_ambient.mp3"), "環境音: 波");
    ok(near(ambientGainNode.gain.value, 0.45 * 0.6), "環境音: 波gain");
    currentStage = "cave";
    currentFloor = 3;
    playAmbientBgm();
    ok(currentAmbientKey === "cave" && ambientBgmAudio.src.includes("cave_ambient.mp3"), "環境音: 洞窟");
    ok(near(ambientGainNode.gain.value, CAVE_AMBIENT_GAIN * 0.6), `環境音: 洞窟gain=1.0×マスター(${ambientGainNode.gain.value})`);
    setMasterBgmVolume(0.2);
    ok(near(ambientGainNode.gain.value, CAVE_AMBIENT_GAIN * 0.2), "環境音: 洞窟中のマスター変更が追従");
    setMasterBgmVolume(0.6);

    // ---- 5. 戦闘BGMの分岐: 洞窟戦→第二形態ボス(導入→本命)→通常森戦 ----
    playBattleBgm();
    ok(currentBgmKey === "cave_battle", `洞窟の戦闘BGM(${currentBgmKey})`);
    currentStage = "dungeon"; // 洞窟分岐はボス判定より優先される既存仕様のため、ボス曲の検証は森で行う
    battle = { enemies: [{ id: "test_boss", isBoss: true, gimmicks: [{ trigger: { type: "hpBelow", value: 50 } }] }] };
    playBattleBgm();
    ok(currentBgmKey === "boss_battle_intro", `第二形態持ちボスは導入曲(${currentBgmKey})`);
    playBossClimaxBgm();
    ok(currentBgmKey === "boss_battle_climax", `第二形態発動で本命曲(${currentBgmKey})`);
    battle = null;
    currentStage = "dungeon";
    state.timeOfDay = "day";
    playBattleBgm();
    ok(currentBgmKey === "dungeon", `森の昼戦闘BGM(${currentBgmKey})`);

    // ---- 6. 宿泊: フェード→バッファ再生→曲終了→早朝BGM頭出し ----
    audioUnlocked = true;
    playBgm("town");
    const sfxCtxTrace = TRACE.contexts.find((c) => c.__gains.includes(lodgingBufGain));
    const srcCountBefore = sfxCtxTrace.__bufferSources.length;
    playLodgingBgm();
    await sleep(1600); // 1.2秒フェードの完了待ち
    ok(bgmAudio.paused, "宿泊: 町BGMがフェード後に停止");
    const lodgingSrc = sfxCtxTrace.__bufferSources.filter((s) => s.__to === lodgingBufGain).pop();
    ok(!!lodgingSrc && lodgingSrc.__started && !lodgingSrc.loop, "宿泊: バッファソースが開始(ループなし)");
    ok(near(lodgingBufGain.gain.value, 0.5 * 0.6), "宿泊: gain=0.5×マスター");
    lodgingSrc.onended(); // 曲の自然終了をシミュレート
    ok(currentBgmKey === "town_dawn", `宿泊明け: 早朝BGMへ(${currentBgmKey})`);
    ok(bgmPositions.town_dawn === 0 || bgmAudio.currentTime === 0, "宿泊明け: 頭出し");

    // ---- 7. 野営: 開始(ループ)→終了フェードでgainが0まで落ちてから停止・復元 ----
    playBgm("dungeon");
    playCampBgm();
    await sleep(1600);
    const campSrc = sfxCtxTrace.__bufferSources.filter((s) => s.__to === campBufGain).pop();
    ok(!!campSrc && campSrc.__started && campSrc.loop === true, "野営: ループ再生開始");
    ok(campBufSource === campSrc, "野営: campBufSourceが追跡されている");
    let campDone = false;
    let sawLowGain = false;
    const watchGain = setInterval(() => { if (campBufGain.gain.value < 0.05) sawLowGain = true; }, 30);
    stopCampBgm(() => { campDone = true; });
    await sleep(1600);
    clearInterval(watchGain);
    ok(campDone, "野営終了: onDoneが呼ばれた");
    ok(sawLowGain, "野営終了: gainがフェードで0付近まで下がった");
    ok(campSrc.__stopped, "野営終了: ソースが停止された");
    ok(near(campBufGain.gain.value, 0.5 * 0.6), "野営終了: gainが次回用に復元された");
    ok(campBufSource === null, "野営終了: campBufSourceがクリアされた");

    // ---- 8. 野営の競合: 開始フェード中に終了したら遅れて鳴り出さない ----
    const campSrcCount = sfxCtxTrace.__bufferSources.filter((s) => s.__to === campBufGain).length;
    playCampBgm();
    await sleep(100); // フェード完了(=バッファ開始)前に終了させる
    stopCampBgm(() => {});
    await sleep(1800);
    const campSrcCountAfter = sfxCtxTrace.__bufferSources.filter((s) => s.__to === campBufGain).length;
    ok(campSrcCountAfter === campSrcCount, `野営競合: 古い開始要求が無効化される(前${campSrcCount}/後${campSrcCountAfter})`);

    // ---- 9. オープニング: 本編BGM開始でフェードアウトし、gainが基準×マスターへ復元 ----
    currentBgmKey = null;
    openingBgmAudio.__paused = false; // タイトルで鳴っている状態を再現
    openingGainNode.gain.value = OPENING_BGM_VOLUME * masterBgmVolume;
    playBgm("town");
    await sleep(900); // 0.6秒フェードの完了待ち
    ok(openingBgmAudio.paused, "オープニング: フェード後に停止");
    ok(near(openingGainNode.gain.value, OPENING_BGM_VOLUME * masterBgmVolume), "オープニング: gainが基準×マスターへ復元");

    // ---- 10. 状態異常SE(playSfxFromUrl): キャッシュ→gain指定再生、マスター0で鳴らない ----
    playSfxFromUrl("assets/se_library/test_dot.ogg", 0.5); // 初回=デコード開始のみ
    await sleep(150);
    const dotSrcBefore = sfxCtxTrace.__bufferSources.length;
    playSfxFromUrl("assets/se_library/test_dot.ogg", 0.5);
    await sleep(50);
    ok(sfxCtxTrace.__bufferSources.length === dotSrcBefore + 1, "DOT SE: 2回目でバッファ再生");
    const dotSrc = sfxCtxTrace.__bufferSources[sfxCtxTrace.__bufferSources.length - 1];
    ok(dotSrc.__to && dotSrc.__to.gain && near(dotSrc.__to.gain.value, 0.5), "DOT SE: gain0.5が適用");
    setMasterBgmVolume(0);
    playSfxFromUrl("assets/se_library/test_dot.ogg", 0.5);
    await sleep(50);
    ok(sfxCtxTrace.__bufferSources.length === dotSrcBefore + 1, "DOT SE: マスター0では鳴らない");
    setMasterBgmVolume(0.6);
  } catch (e) {
    errors.push("例外: " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 5).join("\n"));
  }
  if (errors.length === 0) console.log("✅ audio_vol_test: 全チェック通過");
  else console.error(`❌ audio_vol_test: ${errors.length}件失敗`);
  window.__failed = errors.length;
})();
