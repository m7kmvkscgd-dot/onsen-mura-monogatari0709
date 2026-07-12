// ============ save.js: セーブ/ロード(localStorageへの保存・読み込み・旧セーブ互換処理) ============
const SAVE_KEY = "dungeon1_save";

// 開発中に途中でMP/疲労度/装備ボーナス/瀕死システムの仕組みを追加・変更したため、それ以前に
// 保存された古いセーブのキャラクターにはこれらのフィールドが無かったり形が古かったりする。
// ロード時に不足しているフィールドを補完し、旧「死体(corpse)」状態も瀕死(critical)に変換する
function normalizeCharacter(c, classUpgrades, nowAbsoluteMinutes) {
  if (c.onsenLockUntilMinutes === undefined) c.onsenLockUntilMinutes = null; // 旧セーブ(入浴ロック導入前)はロック無し扱い
  // 旧セーブ(入浴時に即ストレスを減らしていた仕様)はfalse扱いにする。既にonsenLockUntilMinutesが
  // 設定されていた場合でも、旧仕様では入浴と同時にストレス減算済みのため演出の再生対象にはしない
  if (c.onsenPendingRelief === undefined) c.onsenPendingRelief = false;
  if (c.maxMp == null) c.maxMp = baseMaxMpFor(c.classId);
  if (c.mp == null || isNaN(c.mp)) c.mp = c.maxMp;
  if (c.fatigue == null) c.fatigue = 0;
  if (c.guarding == null) c.guarding = false;
  if (c.accuracy == null) c.accuracy = CLASSES[c.classId].accuracy;
  // 武器購入によるMP上限ボーナスなど、equipBonusの中身が古いセーブには反映されていない場合があるため、
  // 常に最新の状態で再計算し、maxMpの差分だけ現在MPにも反映する(既存のequipBonusを持たない場合も含む)
  {
    const newEquipBonus = computeEquipBonus(c.classId, classUpgrades);
    const newMaxMp = baseMaxMpFor(c.classId) + (newEquipBonus.mp || 0);
    if (newMaxMp !== c.maxMp) {
      const delta = newMaxMp - c.maxMp;
      c.mp = Math.max(0, Math.min(newMaxMp, c.mp + delta));
    }
    c.maxMp = newMaxMp;
    c.equipBonus = newEquipBonus;
  }
  if (c.status === "corpse") {
    c.status = "critical";
    c.criticalFloor = c.corpseFloor;
    c.criticalExpireMinutes = nowAbsoluteMinutes + CRITICAL_MIN_HOURS * 60;
  }
  if (c.criticalFloor === undefined) c.criticalFloor = null;
  if (c.criticalStage === undefined) c.criticalStage = "forest"; // 旧セーブ(この機能追加以前)は全て森で瀕死になっていたと扱う
  if (c.criticalExpireMinutes === undefined) {
    // 旧halfDayStep方式のセーブから移行。瀕死中なら現在時刻起点で新しく猶予を与え、
    // それ以外(active/lost)はもともと使わない値なのでnullのままでよい
    c.criticalExpireMinutes = c.status === "critical" ? nowAbsoluteMinutes + CRITICAL_MIN_HOURS * 60 : null;
  }
  delete c.criticalExpireHalfDay;
  if (c.carryingId === undefined) c.carryingId = null;
  if (c.carriedBy === undefined) c.carriedBy = null;
  if (!c.personality) c.personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
  if (c.poison == null) c.poison = 0;
  if (c.burnTurns == null) c.burnTurns = 0;
  if (c.bleed == null) c.bleed = 0;
  if (c.campWeaponCareBattles == null) c.campWeaponCareBattles = 0;
  if (c.stunTurns == null) c.stunTurns = 0;
  if (c.stunResistTurns == null) c.stunResistTurns = 0;
  if (c.silenceTurns == null) c.silenceTurns = 0;
  if (c.statusImmuneTurns == null) c.statusImmuneTurns = 0;
  if (c.tauntTurns == null) c.tauntTurns = 0;
  if (!c.statMods) c.statMods = [];
  if (!c.skills) c.skills = {};
  if (!c.unlockedSkills) c.unlockedSkills = [];
  // 旧セーブ(applySkillChoiceがunlockedSkillsにdescを含めずに保存していたバグの影響を受けたセーブ)は
  // 技ボタン長押しの効果説明が空欄になり、ツールチップ自体が出なくなる(attachSkillLongPressTooltipの
  // if(!desc)returnで無言スキップされる)。SKILL_TREESから同じ職業・同じ名前の技を探してdescを補完する
  if (c.unlockedSkills.length && SKILL_TREES[c.classId]) {
    const tree = SKILL_TREES[c.classId];
    c.unlockedSkills.forEach((s) => {
      if (s.desc) return;
      Object.keys(tree).forEach((lvl) => {
        ["left", "right"].forEach((side) => {
          const def = tree[lvl][side];
          if (def && def.action && def.name === s.name) s.desc = def.desc;
        });
      });
    });
  }
  // initPassives()の初期値に、旧セーブに残っている値があればそれで上書きする形でマージする
  // (単純に足りないキーを足すだけだと、新しく追加したフィールドが未定義のままになりバグるため)
  c.passives = Object.assign(initPassives(), c.passives || {});
  // レベル上限を旧仕様(上限なし)から10に圧縮したため、それ以前のセーブで上限を超えているキャラは
  // 新しい成長式でLv10相当のステータスに再計算し直す(旧仕様のまま強すぎる状態で残さないため)
  if (c.level > MAX_LEVEL) {
    c.level = MAX_LEVEL;
    c.xp = 0;
    const cls = CLASSES[c.classId];
    const growth = 1 + MAX_LEVEL * 0.075;
    c.maxHp = Math.round(cls.hp * growth);
    c.hp = Math.min(c.hp, c.maxHp);
    c.atk = Math.round(cls.atk * growth);
    c.def = cls.def; // レベルによるdef成長は廃止(装備でのみ伸びる)
    c.spd = Math.round(cls.spd * (1 + MAX_LEVEL * 0.05));
    c.mag = Math.round(cls.mag * growth);
  }
  delete c.onsenCooldownUntil;
  delete c.lodgingCooldownUntil;
  delete c.corpseFloor;
  delete c.corpseExpireStep;
  return c;
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const loaded = JSON.parse(raw);
      loaded.classUpgrades = loaded.classUpgrades || {};
      loaded.timeOfDay = loaded.timeOfDay || "day";
      delete loaded.halfDayStep; // 瀕死ロスト判定を実時間ベースに移行したため廃止(criticalExpireMinutes参照)
      if (loaded.clockMinutes == null) loaded.clockMinutes = 12 * 60; // 旧セーブ用の初期値(正午扱い。次の町帰還/宿泊で実際の時間帯に同期される)
      if (loaded.dayCount == null) loaded.dayCount = 1; // 旧セーブ用の初期値(4月1日扱い)
      if (loaded.houseLevel == null) loaded.houseLevel = HOUSE_MAX_LEVEL; // 増築実装前の旧セーブは、元々の名簿上限だった10人を維持できるよう最大レベル扱いにする
      if (loaded.dojoLevel == null) loaded.dojoLevel = 0; // 旧セーブ用の初期値(道場未建築)
      if (loaded.magistrateLevel == null) loaded.magistrateLevel = 0; // 旧セーブ用の初期値(奉行所未建築)
      if (loaded.magistrateQuestDate == null) loaded.magistrateQuestDate = 0; // 旧セーブ用の初期値(依頼未生成)
      if (loaded.magistrateAvailableQuests == null) loaded.magistrateAvailableQuests = []; // 旧セーブ用の初期値(受注制への移行に伴い名称変更)
      if (loaded.magistrateQuestLastShown == null) loaded.magistrateQuestLastShown = {}; // 旧セーブ用の初期値
      if (loaded.acceptedQuest === undefined) loaded.acceptedQuest = null; // 旧セーブ用の初期値
      delete loaded.magistrateQuests; // 旧: 進捗を持つ配列だったが受注制への移行で不要に
      if (loaded.emergencyQuest === undefined) loaded.emergencyQuest = null; // 旧セーブ用の初期値(緊急依頼未発生)
      if (loaded.magistrateNormalClears == null) loaded.magistrateNormalClears = 0; // 旧セーブ用の初期値
      if (loaded.emergencyQuestEverAppeared == null) loaded.emergencyQuestEverAppeared = false; // 旧セーブ用の初期値
      if (loaded.defeatedOoInoshishi == null) loaded.defeatedOoInoshishi = false; // 旧セーブ用の初期値
      if (loaded.rescueQuestAccepted == null) loaded.rescueQuestAccepted = false; // 旧セーブ用の初期値(破綻寸前救済クエスト未受注)
      if (loaded.rescueQuestItemObtained == null) loaded.rescueQuestItemObtained = false; // 旧セーブ用の初期値
      if (loaded.travelPrepShopLevel == null) loaded.travelPrepShopLevel = 0; // 旧セーブ用の初期値(旅支度屋未建築)
      if (loaded.bagShopLevel == null) loaded.bagShopLevel = 0; // 旧セーブ用の初期値(鞄屋未建築)
      if (loaded.watchtowerLevel == null) loaded.watchtowerLevel = 0; // 旧セーブ用の初期値(見張り台未建築)
      if (loaded.stableLevel == null) loaded.stableLevel = 0; // 旧セーブ用の初期値(馬小屋未建築)
      if (loaded.henHouseLevel == null) loaded.henHouseLevel = 0; // 旧セーブ用の初期値(小屋未建築)
      if (loaded.teaHouseLevel == null) loaded.teaHouseLevel = 0; // 旧セーブ用の初期値(茶屋未建築)
      if (loaded.hotSpringKeeperLevel == null) loaded.hotSpringKeeperLevel = 0; // 旧セーブ用の初期値(湯守屋未建築)
      if (loaded.beeFarmLevel == null) loaded.beeFarmLevel = 0; // 旧セーブ用の初期値(養蜂場未建築)
      if (loaded.shrineLevel == null) loaded.shrineLevel = 0; // 旧セーブ用の初期値(神社未建築)
      if (loaded.gunpowderStoreLevel == null) loaded.gunpowderStoreLevel = 0; // 旧セーブ用の初期値(火薬庫未建築)
      if (loaded.karakuriLevel == null) loaded.karakuriLevel = 0; // 旧セーブ用の初期値(からくり屋敷未建築)
      if (loaded.ferryLevel == null) loaded.ferryLevel = 0; // 旧セーブ用の初期値(渡し船未建築)
      // 鍛冶屋の解禁制はこの機能追加より後から導入したため、それ以前のセーブは家レベルに関わらず
      // 既に鍛冶屋を使えていた。互換性のため、旧セーブ(この項目が無い=既存プレイヤー)は
      // 建築済み(1)扱いにする。新規セーブはdefaultState()通り0(未建築)から始まる
      if (loaded.shopLevel == null) loaded.shopLevel = 1;
      if (loaded.inventory && loaded.inventory.bomb == null) loaded.inventory.bomb = 0; // 旧セーブ用の初期値(爆弾未所持)
      if (loaded.inventory && loaded.inventory.soulShard == null) loaded.inventory.soulShard = 0; // 旧セーブ用の初期値(魂のかけら未所持)
      if (loaded.inventory && loaded.inventory.omamori == null) loaded.inventory.omamori = 0; // 旧セーブ用の初期値(お守り未所持)
      if (loaded.onsenEggDailyCount == null) loaded.onsenEggDailyCount = 0; // 旧セーブ用の初期値
      if (loaded.onsenEggDailyDate == null) loaded.onsenEggDailyDate = loaded.dayCount || 1; // 旧セーブ用の初期値
      if (loaded.omikujiDrawnDate == null) loaded.omikujiDrawnDate = 0; // 旧セーブ用の初期値(おみくじ未使用)
      if (loaded.omikujiLastTier === undefined) loaded.omikujiLastTier = null;
      if (loaded.omikujiLastLine == null) loaded.omikujiLastLine = "";
      if (loaded.omikujiLastSpeakerId === undefined) loaded.omikujiLastSpeakerId = null;
      if (loaded.omikujiEffect === undefined) loaded.omikujiEffect = null;
      if (loaded.omikujiFirstStrikePending == null) loaded.omikujiFirstStrikePending = false;
      if (loaded.pendingSkillChoices == null) loaded.pendingSkillChoices = []; // 旧セーブ用の初期値(未選択スキル無し)
      if (loaded.seenUnlockedBuildings == null) loaded.seenUnlockedBuildings = {}; // 旧セーブ用の初期値(NEWバッジ機能実装前は無条件で空扱い)
      if (loaded.seenUnlockedClasses == null) loaded.seenUnlockedClasses = {};
      delete loaded.worldStep;
      if (loaded.inventory) {
        delete loaded.inventory.holyWater;
        // 支援物資(回復薬+煙玉+温泉卵)の合計が上限を超えないよう、旧セーブや不整合分を補正する
        // (loadState内はまだ`state`が代入される前なので、supplyCap()ではなくloaded自身の値で計算する)
        const loadedSupplyCap = SUPPLY_CAP_BASE + (loaded.bagShopLevel || 0);
        loaded.inventory.potion = Math.min(loaded.inventory.potion || 0, loadedSupplyCap);
        loaded.inventory.smokeBomb = Math.min(loaded.inventory.smokeBomb || 0, Math.max(0, loadedSupplyCap - loaded.inventory.potion));
        loaded.inventory.onsenEgg = Math.min(loaded.inventory.onsenEgg || 0, Math.max(0, loadedSupplyCap - loaded.inventory.potion - loaded.inventory.smokeBomb));
        loaded.inventory.campingKit = Math.min(loaded.inventory.campingKit || 0, CAMPING_KIT_CAP);
      }
      const nowAbsoluteMinutes = ((loaded.dayCount || 1) - 1) * 1440 + (loaded.clockMinutes || 0);
      (loaded.roster || []).forEach((c) => normalizeCharacter(c, loaded.classUpgrades, nowAbsoluteMinutes));
      // 【重大バグ修正】__idSeqが保存されていなかったことに起因し、既に同じidを持つキャラが
      // 2人以上roster内に紛れ込んでいるセーブがあり得る(詳細はnextId()/syncIdSeqWithRoster()の
      // コメント参照)。後から現れた方にだけ新しい一意なidを振り直して衝突を解消してから、
      // 以後の採番がこの名簿の最大連番+1から続くように同期する
      {
        const seenIds = new Set();
        let maxSeq = 0;
        (loaded.roster || []).forEach((c) => {
          const m = /^c(\d+)$/.exec(c.id || "");
          if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
        });
        (loaded.roster || []).forEach((c) => {
          if (seenIds.has(c.id)) c.id = "c" + (++maxSeq);
          seenIds.add(c.id);
        });
        syncIdSeqWithRoster(loaded.roster);
      }
      return loaded;
    }
  } catch (e) {}
  return defaultState();
}

// __allies/__enemyAllies(かばう連携/貫き矢がengine.js側から他の味方/敵を参照するための自己参照。
// fieldParty自身を指すため循環参照になる)はJSON.stringifyできないので、保存対象から除外する
function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state, (key, value) => (key === "__allies" || key === "__enemyAllies") ? undefined : value));
}

