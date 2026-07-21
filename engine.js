// ダンジョン1: ゲームロジック本体(キャラ生成・ダメージ計算・戦闘・死体/ロスト管理)

let __idSeq = 1;
let __enemySeq = 1;
function nextId() {
  return "c" + __idSeq++;
}
// 【重大バグ修正】__idSeqはstateに保存されず、ページを読み込むたびに1から再スタートしていた。
// そのため一度セーブ&リロードした後に新しい仲間を作ると、既に名簿にいるキャラ(例: 最初に
// 作ったc1)と同じidが再び採番されてしまい、getRosterChar()がidの一致で最初に見つけた方を
// 返す都合上「別のキャラのステータスが開く」等、id参照全般が壊れるバグを引き起こしていた。
// ロード直後にこれを呼び、既存roster内の最大の連番+1から採番を再開させることで衝突を防ぐ
function syncIdSeqWithRoster(roster) {
  let maxSeq = 0;
  (roster || []).forEach((c) => {
    const m = /^c(\d+)$/.exec(c.id || "");
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  });
  __idSeq = Math.max(__idSeq, maxSeq + 1);
}

// 魔力0の物理職(盗賊/忍者など)も自分の得意技を使えるよう、MPには最低ライン(10)を必ず持たせる
function maxMpFor(mag) {
  return 10 + Math.round(mag * 1.2);
}
// クラスごとの基礎MP上限。CLASSES[classId].maxMpで明示的に指定されていればそれを優先し(魔力に連動させたくない
// 個別調整用)、無ければ従来通り魔力から自動計算する
function baseMaxMpFor(classId) {
  const c = CLASSES[classId];
  return c.maxMp != null ? c.maxMp : maxMpFor(c.mag);
}

// classUpgrades: { weapon: tierIndex(0=未購入), armor: tierIndex(0=未購入) } — 職業単位の恒久装備。
// 上位ティアを買うと下位ティアから乗り換わる(加算ではなく差し替え)。個別のキャラごとの装備管理は無く、
// 「その職業への投資」として全メンバー(既存+以後仲間にする人)に一律で乗る(MVPとしての単純化)。
// 防具を1段階買うごとのMP上限の伸び方。1→2→1→2→1と交互に増える(累計: 1,3,4,6,7)。
// 添字0(未購入)は0のまま
const ARMOR_MP_BONUS = [0, 1, 3, 4, 6, 7];
function computeEquipBonus(classId, classUpgrades) {
  const bonus = { atk: 0, def: 0, mag: 0, mp: 0 };
  const eq = EQUIPMENT[classId];
  const owned = (classUpgrades && classUpgrades[classId]) || {};
  if (eq && owned.weapon > 0) {
    const t = eq.weapon[owned.weapon - 1];
    bonus[t.statKey] += t.bonus;
  }
  if (eq && owned.armor > 0) {
    const t = eq.armor[owned.armor - 1];
    bonus[t.statKey] += t.bonus;
    bonus.mp += ARMOR_MP_BONUS[owned.armor] || 0;
  }
  return bonus;
}

// そのクラスの誰かが指定レベルに到達しているか(装備ティア解禁判定に使う)
function classHasReachedLevel(characters, classId, level) {
  return characters.some((c) => c.classId === classId && c.status !== "lost" && c.level >= level);
}

function createCharacter(name, classId, classUpgrades) {
  const c = CLASSES[classId];
  const equipBonus = computeEquipBonus(classId, classUpgrades);
  const maxMp = baseMaxMpFor(classId) + (equipBonus.mp || 0);
  return {
    id: nextId(),
    name,
    classId,
    label: name,
    personality: ACTIVE_PERSONALITIES[Math.floor(Math.random() * ACTIVE_PERSONALITIES.length)], // 吹き出しセリフの言い回しに使う
    level: 1,
    xp: 0,
    maxHp: c.hp,
    hp: c.hp,
    maxMp,
    mp: maxMp,
    atk: c.atk,
    def: c.def,
    spd: c.spd,
    mag: c.mag,
    accuracy: c.accuracy,
    equipBonus,
    fatigue: 0, // 0〜100。潜り続けるほど溜まり、戦闘力を下げる(町では抜けない。温泉で回復)
    guarding: false,
    guardProtectCount: 0, // かばう構え中に身代わりになった回数。2に達したら強制的に構えを解除する
    reloading: false, // 砲術士の砲撃を使った直後、次の自分のターンは装填で動けない
    fleeState: null, // null | "preparing"(逃走準備中) | "fled"(この戦闘から逃げた)。戦闘開始のたびリセットされる
    status: "active", // active | critical | lost
    onsenLockUntilMinutes: null, // 入浴した時点から見て翌朝(dawn=4:30)の絶対分数。この値を過ぎるまでパーティ編成に組み込めない
    onsenPendingRelief: false, // 入浴済みでまだ「リラックスできた！」演出(ストレス減少)を再生していない場合true
    criticalFloor: null,
    criticalExpireMinutes: null, // ロストするゲーム内絶対分数(この値を過ぎるとtickCriticalExpiryでロストになる)
    carryingId: null, // 担いでいる瀕死の仲間のid(いなければnull)。担いでいる間は素早さ半減+攻撃/技が使えない
    carriedBy: null, // 自分が瀕死の時、誰に担がれているか(担がれていなければnull)
    poison: 0, // 毒の蓄積値。自分のターンが来るたびにこの値分ダメージを受け、1減る
    bleed: 0, // 出血の蓄積値。毒と同じ減衰式だが、技の付与量は毒より低めに設計する。出血中は攻撃力-10%
    burnTurns: 0, // 炎上の残りターン数。自分のターンが来るたびに最大HP割合のダメージを受ける(ターン数のみ減り、減衰しない)
    stunTurns: 0, // スタン(行動不能)の残りターン数
    stunResistTurns: 0, // スタンを受けた直後の一定ターン、スタン確率が大幅に下がる(連続スタンロック防止)
    silenceTurns: 0, // 沈黙(技が使えず通常攻撃のみ)の残りターン数
    statusImmuneTurns: 0, // 状態異常を受け付けない残りターン数
    tauntTurns: 0, // 挑発中の残りターン数(かばう同様、敵から必ず狙われる)
    statMods: [], // [{stat, mult, turns}] 一時的なステータス倍率(バフ/デバフ)。effectiveStatで乗算される
    campWeaponCareBattles: 0, // 野営「武器の手入れ」の攻撃力バフ残り戦闘回数。startBattle()ではリセットせず、戦闘終了時に1減る
    guaranteedCritNext: false, // 反射神経(evadeCritCounter)などで、次の自分の攻撃だけ確定会心にするフラグ
    skills: {}, // { level: "left"|"right" } スキルツリーで選んだ側の記録
    unlockedSkills: [], // 選んだ能動スキル(action持ち)のリスト。戦闘中の行動選択に追加される
    passives: initPassives(), // スキルツリーの永続受動効果をまとめて保持するオブジェクト
    transformForm: null, // 忍の「変化の術」で変身中のform("karasu"|"gama"|"hebi"|null)
    formCooldowns: {}, // 変身中のform専用スキル(丸呑み/脱皮/毒液散布等)ごとの残りクールタイム。キーはformSkillsのkey
    hawkTurnsLeft: 0, // 狩人「鷹を呼ぶ」: 鷹が出現している残りターン数(0=いない)
    hawkGuardTargetId: null, // 「味方を守れ」で鷹が庇っている対象のid(いなければnull)
  };
}

// レベル上限を10に圧縮したことに伴う再設計(旧: 上限なしで(20+level*15)*4.5)。
// 「新レベルN = 旧レベル4N-3〜4Nの4段分をまとめたもの」という考え方で、旧式で旧レベル1〜36を上る
// のに必要だった経験値の合計と同じ総量になるよう、新レベル1〜9の必要経験値を等差数列(1080*level-45)で
// 割り振ってある(結果として新レベル1=1035, 新レベル9=9675と、終盤ほど1段の重みが大きくなる)
// 終盤2段(Lv8→9/Lv9→10)だけ個別に引き上げてある。最後の技がなかなか取れない程度の足止めに
// 留め、道中全体を重くする(=苦痛の水増し)のは避ける、という判断。遠征シミュレーション
// (最適撤退・侍4人・回復薬10個)でLv8→9が平均5回前後、Lv9→10が平均7回前後になるよう逆算した値。
// レベル1〜7の必要量には一切手を付けていない
function xpToNext(level) {
  if (level === 8) return 1700;
  if (level === 9) return 2700;
  return Math.round((1080 * level - 45) * 0.11025); // ユーザー指示で必要経験値を現状からさらに1割短縮(0.1225 * 0.9)
}

// レベルアップ時、職業ごとの基礎値にレベル依存の成長率をかけて再計算する。
// HPは全快させず、最大値が増えた分だけ現在値に上乗せする(戦闘中の連続レベルアップが実質全回復になっていたバグの修正)。
// 成長率はダクソン/XCOM的に「Lv10でも2倍未満」に収まるよう抑えてある(旧0.1=Lv10で2.0倍から、
// 序盤の階層で装備済みの高レベルキャラが無双しすぎるという指摘を受けさらに緩和。Lv10で1.75倍)。
// 防御力はレベルでは一切伸ばさず、常に職業の基礎値のまま固定する(装備(甲冑)だけが伸びしろになる)
// HPのレベル成長を、全職業共通の固定加算テーブルに変更(旧: 基礎HP×1.75の掛け算式)。
// 掛け算だと素のHPが多い職業(槍士等)ほど伸びる絶対量も大きくなり、レベルが上がるほど
// タンクと脆い職のHP差が開いていってしまっていたため、Lv10到達時点で全職業共通+20になる
// 加算式に統一した(職業間のHP差は常に一定のまま)
const HP_LEVEL_BONUS = { 2: 2, 3: 4, 4: 7, 5: 9, 6: 11, 7: 13, 8: 16, 9: 18, 10: 20 };
function levelUp(character, log) {
  if (character.level >= MAX_LEVEL) return;
  character.level++;
  const c = CLASSES[character.classId];
  const growth = 1 + character.level * 0.075; // Lv10で1.75倍。攻撃力/魔力は引き続きこの掛け算式で成長する
  const oldMaxHp = character.maxHp;
  character.maxHp = c.hp + (HP_LEVEL_BONUS[character.level] || 0);
  character.hp = Math.min(character.maxHp, character.hp + (character.maxHp - oldMaxHp));
  character.atk = Math.round(c.atk * growth);
  character.def = c.def; // レベルによるdef成長は廃止(装備でのみ伸びる)。defは今や固定%そのものの値
  character.spd = Math.round(c.spd * (1 + character.level * 0.05));
  character.mag = Math.round(c.mag * growth); // 魔法威力/治癒量は引き続き伸びる。MPの上限だけはレベルで伸ばさない(maxMp/mpは据え置き)
  log(`${character.label}はレベル${character.level}になった！`);
}

// フィールドに出ている(ダンジョンに潜っている)キャラに1階分の疲労(ストレス)を加算する。
// amountを省略すると往路の基本値(FATIGUE_PER_FLOOR)、帰路はdungeon.js側でFATIGUE_PER_FLOOR_RETREATを渡す
function advanceFatigue(characters, amount) {
  const add = amount == null ? FATIGUE_PER_FLOOR : amount;
  characters.forEach((c) => {
    if (c.status === "active") {
      c.fatigue = Math.min(FATIGUE_MAX, c.fatigue + add);
    }
  });
}

// 温泉: レベル1でONSEN_FLAT_COST、以降レベルごとにONSEN_COST_PER_LEVELずつ上がる
function onsenCost(level) {
  return ONSEN_FLAT_COST + (level - 1) * ONSEN_COST_PER_LEVEL;
}

// 入浴後、翌朝(dawn=4:30)にならなければパーティ編成に組み込めない
// (宿泊の可否には影響しない、宿泊は別途c.status==="active"のみで判定している)
function isOnsenLocked(character, absoluteMinutes) {
  return character.onsenLockUntilMinutes != null && absoluteMinutes < character.onsenLockUntilMinutes;
}

// 生存していて、かつ温泉の入浴ロック中でなければ冒険に連れて行ける(宿屋の宿泊可否には影響しない)
function isAvailable(character, absoluteMinutes) {
  if (character.status !== "active") return false;
  if (absoluteMinutes != null && isOnsenLocked(character, absoluteMinutes)) return false;
  return true;
}

// 温泉に入る。以後翌朝(早朝4:30)までパーティ編成に組み込めない。
// 【仕様変更】ストレスはこの時点では減らさない。入浴が明ける(翌朝になる)瞬間に町画面へ
// 「温泉でリラックスできた！」ポップアップを出しながら演出的に減らす(collectReadyOnsenReliefs参照)。
// そのため実際のfatigue減算はここでは行わず、onsenPendingReliefを立てておくだけにとどめる
function useOnsen(character, absoluteMinutes) {
  character.onsenLockUntilMinutes = nextMorningAbsoluteMinutes(absoluteMinutes);
  character.onsenPendingRelief = true;
  // 次の遠征中限定のランダムバフを付与する(野営する、または町へ帰ると失効する)
  character.onsenBuffKey = pickOnsenBuff();
}
// 入浴ロックが明けた(=翌朝になった)のに、まだ「リラックスできた！」演出を再生していないキャラを
// 集め、この時点で実際にストレスを減らして一覧を返す(呼び出し元がポップアップ表示に使う)。
// 町画面(renderTown)からのみ呼ぶ想定(探索/戦闘パートでは表示不要という仕様のため)
function collectReadyOnsenReliefs(roster, absoluteMinutes) {
  const ready = roster.filter((c) => c.onsenPendingRelief && c.onsenLockUntilMinutes != null && absoluteMinutes >= c.onsenLockUntilMinutes);
  return ready.map((c) => {
    const before = c.fatigue || 0;
    const relief = (state.hotSpringKeeperLevel || 0) > 0 ? HOT_SPRING_KEEPER_FATIGUE_RELIEF : ONSEN_FATIGUE_RELIEF;
    const after = Math.max(0, before - relief);
    c.fatigue = after;
    c.onsenPendingRelief = false;
    return { id: c.id, name: c.name, classId: c.classId, before, after };
  });
}
// バフ「ぽかぽか」(最大HP+7%)は他のバフと違い実効ステータス計算だけでは足りず、実際のHPの
// 器そのものを一時的に増やす必要があるため、遠征開始時(enterDungeon)に一度だけ加算し、
// バフが失効するタイミング(clearOnsenBuff)で同じ量を正しく差し引く
function applyOnsenHpBuffOnDeparture(character) {
  if (character.onsenBuffKey === "pokapoka" && !character.onsenHpBonusAmount) {
    const bonus = Math.round(character.maxHp * 0.07);
    character.maxHp += bonus;
    character.hp += bonus;
    character.onsenHpBonusAmount = bonus;
  }
}
// 野営する/町へ戻るタイミングで呼び、バフ(と「ぽかぽか」で加算した分のHP)を失効させる
function clearOnsenBuff(character) {
  if (character.onsenHpBonusAmount) {
    character.maxHp = Math.max(1, character.maxHp - character.onsenHpBonusAmount);
    character.hp = Math.min(character.maxHp, Math.max(0, character.hp - character.onsenHpBonusAmount));
    character.onsenHpBonusAmount = 0;
  }
  character.onsenBuffKey = null;
}

// 滝行許可証: そのキャラが選んだスキル(character.skills)を全て取り消し、レベル2〜現在レベルの
// 選択を全てやり直せるようにする。devSetCharacterLevel(town.js)と同じ「Lv1の素の値まで戻してから
// levelUp()を現在レベル分だけ再生する」方式で、スキル由来のステータス増分(hpMult等)を含まない
// クリーンな状態に巻き戻す。passivesもinitPassives()で完全に作り直す(蓄積した加算/配列を個別に
// 取り消すのは値の組み合わせによっては不可能なため、素の状態から再構築する方が確実)
function resetAllSkills(character) {
  const targetLevel = character.level;
  const c = CLASSES[character.classId];
  character.level = 1;
  character.maxHp = c.hp; character.atk = c.atk; character.def = c.def; character.spd = c.spd; character.mag = c.mag;
  character.passives = initPassives();
  character.skills = {};
  for (let i = 1; i < targetLevel; i++) levelUp(character, () => {});
  character.hp = character.maxHp;
  character.mp = character.maxMp;
  character.xp = 0;
  // 既にこのキャラの選択待ちとして積まれている分は重複しないよう先に取り除いてから、
  // レベル2〜現在レベルの全レベル分を選択待ちとして積み直す
  state.pendingSkillChoices = state.pendingSkillChoices.filter((e) => e.characterId !== character.id);
  for (let lv = 2; lv <= targetLevel; lv++) state.pendingSkillChoices.push({ characterId: character.id, level: lv });
}

// 石長比売の御守で戦闘開始時に加算した最大HP+5%分を、戦闘終了時(勝利/逃走/全滅どれでも)に差し引く
function clearOmamoriIwanagaBonus(characters) {
  characters.forEach((c) => {
    if (c.omamoriIwanagaHpBonusAmount) {
      c.maxHp = Math.max(1, c.maxHp - c.omamoriIwanagaHpBonusAmount);
      c.hp = Math.min(c.maxHp, Math.max(0, c.hp - c.omamoriIwanagaHpBonusAmount));
      c.omamoriIwanagaHpBonusAmount = 0;
    }
  });
}

// 宿屋に宿泊し、HP/MPを全回復+ストレスを少量回復する(宿泊自体は冒険可否に影響しない)
function useLodging(character) {
  character.hp = character.maxHp;
  character.mp = character.maxMp;
  character.fatigue = Math.max(0, (character.fatigue || 0) - LODGE_FATIGUE_RELIEF);
}

// 茶屋の「一休み」: HP/MPを割合回復する(ストレスには影響しない)
function useTeahouseRest(character) {
  character.hp = Math.min(character.maxHp, character.hp + Math.round(character.maxHp * TEAHOUSE_REST_HP_RATIO));
  character.mp = Math.min(character.maxMp, character.mp + Math.round(character.maxMp * TEAHOUSE_REST_MP_RATIO));
}
// 茶屋の菓子: 回復薬と同じ支援物資として持ち歩き、道具メニューから選んだ1人に食べさせて
// HP/MPを菓子ごとの割合だけ回復する(消費・在庫管理は呼び出し元で行う)。戻り値のhealHpは
// 回復薬等と同じくポップアップ表示(+◯)に使う
function useTeahouseSnack(snack, target, log) {
  const healHp = Math.round(target.maxHp * snack.hpPct);
  const healMp = target.maxMp > 0 ? Math.round(target.maxMp * snack.mpPct) : 0;
  target.hp = Math.min(target.maxHp, target.hp + healHp);
  target.mp = Math.min(target.maxMp, target.mp + healMp);
  log(`${target.label}は${snack.ja}を食べてHP${healHp}・MP${healMp}回復！`);
  return healHp;
}

// ストレスの段階(0=平常, 1=40〜59, 2=60〜79, 3=80〜99, 4=100=発狂)
function stressTier(fatigue) {
  const f = fatigue || 0;
  if (f >= 100) return 4;
  if (f >= 80) return 3;
  if (f >= 60) return 2;
  if (f >= 40) return 1;
  return 0;
}

// キャラの立ち絵を、ストレス値に応じて丸ごと差し替える(黒もやもやの透過オーバーレイ方式は廃止)。
// 50%超=軽度、75%超=重度、100=発狂。表情の切り替えはstressTier()(セリフ判定等で使う40/60/80/100の
// 4段階)とは別基準のため、ここでは直接fatigueの値を見る
function characterPortraitSrc(c) {
  const cls = CLASSES[c.classId];
  const f = c.fatigue || 0;
  const variants = CLASS_STRESS_IMAGES[c.classId];
  if (f >= 100) return variants.panic;
  if (f > 75) return variants.severe;
  if (f > 50) return variants.mild;
  return cls.image;
}

// ステータス詳細画面専用。ストレス無し(50%以下)の時だけCLASS_STATUS_PORTRAITを使い、
// ストレスがある時はcharacterPortraitSrc()と同じくCLASS_STRESS_IMAGESを使う
function statusPortraitSrc(c) {
  if ((c.fatigue || 0) <= 50) return CLASS_STATUS_PORTRAIT[c.classId];
  return characterPortraitSrc(c);
}

// ストレスによる攻撃力/防御力/素早さ/魔力の低下率。stressTier(立ち絵の切り替え用、40/60/80/100の
// 4段階)とは独立した、ユーザー指定の6段階刻み(10%ごとに+5%ずつ悪化、100%だけ突出して重い)。
// 旧仕様にあった「発狂中は50%の確率で行動不能になる」は廃止し、常に(弱体化した状態で)行動できる
function fatigueMalus(fatigue) {
  const f = fatigue || 0;
  if (f >= 100) return 0.40;
  if (f >= 90) return 0.30;
  if (f >= 80) return 0.25;
  if (f >= 70) return 0.20;
  if (f >= 60) return 0.15;
  if (f >= 50) return 0.10;
  return 0;
}

// 疲労を反映した実効ステータス(敵にはfatigueが無いのでそのまま返る)
// 疲労減衰は素の能力値にのみかかり、装備ボーナスは減衰後に加算する(装備は疲労で劣化しない)
function effectiveStat(entity, key) {
  const base = entity[key] || 0;
  let result;
  if (entity.fatigue == null) {
    result = base; // 敵など疲労を持たない対象はそのまま
  } else {
    const fatigued = base * (1 - fatigueMalus(entity.fatigue));
    const equip = (entity.equipBonus && entity.equipBonus[key]) || 0;
    result = Math.max(1, Math.round(fatigued + equip));
    if (key === "spd" && entity.carryingId) result = Math.max(1, Math.round(result * 0.5)); // 仲間を担いでいる間は素早さ半減
  }
  // 温泉バフ(血行促進=攻撃力+5%、湯上がり=素早さ+5%)。次の遠征中限定、野営/帰還で失効する
  if (key === "atk" && entity.onsenBuffKey === "kekkou") result = Math.max(1, Math.round(result * 1.05));
  if (key === "spd" && entity.onsenBuffKey === "yuagari") result = Math.max(1, Math.round(result * 1.05));
  // 出血中は常時攻撃力-10%(敵/味方どちらにも適用)
  if (key === "atk" && (entity.bleed || 0) > 0) result = Math.max(1, Math.round(result * 0.9));
  // 出血弱点②(ENEMY_WEAKNESS)を持つ敵は、出血中さらに防御力-30%が乗る
  if (key === "def" && (entity.bleed || 0) > 0) {
    const w = enemyWeaknessType(entity, "bleed");
    if (w && w.tier === 2) result = Math.max(1, Math.round(result * 0.7));
  }
  // スキルツリーの一時バフ/デバフ(statMods)を乗算で適用。敵side/味方side問わず(デバフ技が敵にも掛かるため)適用する
  if (entity.statMods && entity.statMods.length) {
    let mult = 1;
    entity.statMods.forEach((m) => { if (m.stat === key) mult *= m.mult; });
    result = Math.max(1, Math.round(result * mult));
  }
  // スキルツリーの永続受動効果(atk/mag/def/spdの倍率)を適用。magはatkMultを流用する(陰陽師/僧侶の術威力もこれで底上げされる)
  if (entity.passives && (key === "atk" || key === "mag" || key === "def" || key === "spd")) {
    const p = entity.passives;
    const permMult = (key === "atk" || key === "mag") ? p.atkMult : key === "def" ? p.defMult : p.spdMult;
    if (permMult !== 1) result = Math.max(1, Math.round(result * permMult));
  }
  // HP割合条件つきの受動効果(武士道など、HP◯%以下で攻撃力/防御力up、といったもの)
  if (entity.passives && entity.passives.conditionalMods && entity.passives.conditionalMods.length && (key === "atk" || key === "mag" || key === "def" || key === "spd")) {
    activeConditionalMods(entity).forEach((m) => {
      if (!m.statMult) return;
      m.statMult.forEach((sm) => { if (sm.stat === key) result = Math.max(1, Math.round(result * sm.mult)); });
    });
  }
  // 状態フラグ条件つきの受動効果(挑発中/装填中/かばう中など、entity自身の一時状態を見て乗算する汎用フック)
  if (entity.passives && entity.passives.flagMods && entity.passives.flagMods.length && (key === "atk" || key === "mag" || key === "def" || key === "spd")) {
    entity.passives.flagMods.forEach((fm) => {
      if (fm.stat !== key) return;
      if (entity[fm.flag]) result = Math.max(1, Math.round(result * fm.mult));
    });
  }
  // 撃破時スタック系の受動効果(修羅・槍鬼など)。重複回数ぶん倍率を線形に積み増す
  if (entity.passives && entity.passives.onKill && entity.passives.onKillStacks > 0 && (key === "atk" || key === "mag" || key === "def" || key === "spd")) {
    entity.passives.onKill.statMult.forEach((sm) => {
      if (sm.stat !== key) return;
      const totalMult = 1 + (sm.mult - 1) * entity.passives.onKillStacks;
      result = Math.max(1, Math.round(result * totalMult));
    });
  }
  // 野営「武器の手入れ」の攻撃力バフ(戦闘回数でカウントするため、ターン基準のstatModsとは別枠)
  if (key === "atk" && entity.campWeaponCareBattles > 0) {
    result = Math.max(1, Math.round(result * CAMP_WEAPON_CARE_ATK_MULT));
  }
  // ターン経過で積み上がる攻撃力バフ(百戦錬磨など)
  if (key === "atk" && entity.passives && entity.passives.turnStackAtkBuff && entity.turnStackAtkStacks > 0) {
    result = Math.max(1, Math.round(result * (1 + entity.passives.turnStackAtkBuff.perTurn * entity.turnStackAtkStacks)));
  }
  return result;
}

// 野営: HP/MPを割合回復し、ストレスを固定量回復する(宿泊とは異なり全回復ではない)
function useCampRest(character) {
  character.hp = Math.min(character.maxHp, character.hp + Math.round(character.maxHp * CAMP_HP_RELIEF));
  character.mp = Math.min(character.maxMp, character.mp + Math.round(character.maxMp * CAMP_MP_RELIEF));
  character.fatigue = Math.max(0, (character.fatigue || 0) - CAMP_STRESS_RELIEF);
}

// 一時的なステータス修正(バフ/デバフ)を付与する。同じstatへの既存の修正は上書き(重ね掛けで際限なく増えないように)
function applyStatMod(entity, stat, mult, turns) {
  entity.statMods = entity.statMods || [];
  const existing = entity.statMods.find((m) => m.stat === stat);
  if (existing) { existing.mult = mult; existing.turns = turns; }
  else entity.statMods.push({ stat, mult, turns });
}
// 蓄積型の一時ステータス変化(迅雷突き/鎧砕きの防御デバフ、剛槍の攻撃バフなど)。使うたびにkey別のスタックを
// 1増やし(maxStacksで頭打ち)、そのスタック数×perStackぶんの変化量でapplyStatModを呼ぶ(期間は毎回リセット)。
// perStackは符号付き(デバフなら負の値、バフなら正の値)
function applyStackingStatMod(entity, key, stat, perStack, maxStacks, turns) {
  entity.stackCounters = entity.stackCounters || {};
  const stacks = Math.min(maxStacks, (entity.stackCounters[key] || 0) + 1);
  entity.stackCounters[key] = stacks;
  applyStatMod(entity, stat, 1 + perStack * stacks, turns);
}
// 自分のターンが来るたびに残りターン数を1減らし、0になったものは消す
function tickStatMods(entity) {
  if (!entity.statMods || !entity.statMods.length) return;
  entity.statMods.forEach((m) => { m.turns--; });
  entity.statMods = entity.statMods.filter((m) => m.turns > 0);
}

// 伊邪那岐命の御守: 戦闘中最初に受けるはずだった状態異常1回を打ち消す(パーティ共有の使い捨てフラグ、
// startBattle()側でhasOmamori("izanagi")の時だけ全員に同じ参照オブジェクトを配って実現する)
function blockedByOmamoriIzanagi(entity) {
  const g = entity.passives && entity.passives.omamoriIzanagiPending;
  if (!g || g.used) return false;
  g.used = true;
  return true;
}
// 図鑑の弱点システム(ENEMY_WEAKNESS、data.js)用ヘルパー。指定した種類(bleed/poison/burn)の
// 弱点を持つ敵ならその定義を、持たなければnullを返す
function enemyWeaknessType(entity, type) {
  const w = ENEMY_WEAKNESS[entity.id];
  return w && w.type === type ? w : null;
}
const SPIRIT_WEAKNESS_DMG_MULT = 1.5; // 霊力弱点(ENEMY_WEAKNESS type:"spirit")を持つ敵の被ダメージ倍率
const POISON_MAX_STACKS = 6; // (旧)毒蓄積の上限。2026-07-18ユーザー指示で天井撤廃済み、現在はどこも参照しない(module.exports互換のため定義だけ残置)
// ボス保険: 毒/出血の天井撤廃(2026-07-18)に伴い、ボス級だけはDOTで溶けないよう
// 1ティックのダメージを最大HPのこの割合で頭打ちにする(雑魚・味方には適用しない)
const DOT_TICK_BOSS_CAP_RATIO = 0.06;
function dotTickBossCap(entity, dmg) {
  if (!entity.isBoss && !entity.isMidBoss) return dmg;
  return Math.min(dmg, Math.max(1, Math.round(entity.maxHp * DOT_TICK_BOSS_CAP_RATIO)));
}
// 毒を付与する。重ね掛けは加算ではなく現在値との大きい方に上書きする(無限に積み上がらないように)
function applyPoison(entity, stacks) {
  if (entity.statusImmuneTurns > 0) return;
  if (blockedByOmamoriIzanagi(entity)) return;
  // 2026-07-18ユーザー指示: 「最大値で上書き・上限6」から「加算式・天井なし」へ変更。
  // 暴走対策はボス級への1ティック上限(dotTickBossCap)側で行う
  entity.poison = (entity.poison || 0) + stacks;
  // 毒弱点②: 詠唱・予告中(大技の構え)に毒を受けると、その大技は中断される
  const w = enemyWeaknessType(entity, "poison");
  if (w && w.tier === 2 && entity.bigAttackPending) entity.bigAttackPending = false;
}
// 毒: 自分のターンが来るたびに蓄積値分のダメージを受け、蓄積値が1減る(ダーケストダンジョン方式)。
// 毒弱点(bleed/burnと同じくENEMY_WEAKNESS)を持つ敵はダメージ2倍(tier1/2共通)
function tickPoison(entity, log) {
  if (!entity.poison || entity.poison <= 0) return 0;
  const weak = !!enemyWeaknessType(entity, "poison");
  const dmg = Math.min(entity.hp, dotTickBossCap(entity, Math.round(entity.poison * (weak ? 2 : 1))));
  entity.hp = Math.max(0, entity.hp - dmg);
  log(`${entity.label}は毒で${dmg}ダメージ！`);
  entity.poison = Math.max(0, entity.poison - 1);
  return dmg;
}
// 炎上: 毒(固定ダメージ・蓄積減衰)とは違う性質のDOTとして、最大HPの割合ダメージ・ターン数固定(減衰なし)にしてある。
// 低HPの相手には毒が、高HPのタンク相手には炎上がよく効く、という住み分けを狙った設計
function applyBurn(entity, turns) {
  if (entity.statusImmuneTurns > 0) return;
  if (blockedByOmamoriIzanagi(entity)) return;
  entity.burnTurns = Math.max(entity.burnTurns || 0, turns);
}
const BLEED_MAX_STACKS = 5; // (旧)出血蓄積の上限。2026-07-18ユーザー指示で天井撤廃済み、現在はどこも参照しない(module.exports互換のため定義だけ残置)
// 出血: 毒(重ね掛けは大きい方に上書き)とは違い、こちらは加算で積み上がる方式にしてある
// (磯魚などの低威力多段ヒットで着実に蓄積していく手触りを狙ったもの、上限で頭打ちにはなる)。
// 技側の付与量を毒より低めに設定する運用にしてあり、代わりに出血中は常時攻撃力-10%が乗る(effectiveStat側)
function applyBleed(entity, stacks) {
  if (entity.statusImmuneTurns > 0) return;
  if (blockedByOmamoriIzanagi(entity)) return;
  // 2026-07-18ユーザー指示: 上限5を撤廃して天井なしの加算式に(毒と同じ扱い)
  entity.bleed = (entity.bleed || 0) + stacks;
}
// 出血弱点を持つ敵はダメージ2倍(tier1/2共通)。防御力低下(tier2)はeffectiveStat側で別途処理する
function tickBleed(entity, log) {
  if (!entity.bleed || entity.bleed <= 0) return 0;
  const weak = !!enemyWeaknessType(entity, "bleed");
  const dotMult = (entity.passives && entity.passives.dotDamageMult) || 1;
  const dmg = Math.min(entity.hp, dotTickBossCap(entity, Math.max(1, Math.round(entity.bleed * (weak ? 2 : 1) * dotMult))));
  entity.hp = Math.max(0, entity.hp - dmg);
  log(`${entity.label}は出血で${dmg}ダメージ！`);
  entity.bleed = Math.max(0, entity.bleed - 1);
  return dmg;
}
// 戦闘終了時(勝利/逃走)に、生き残った味方の毒/炎上/出血を自動的に治す。戦闘のたびに持ち越される
// 鬱陶しさをなくすための措置(スタン等の他の状態異常はターン制でその場で切れるため対象外)
function clearDotEffects(characters) {
  characters.forEach((c) => { c.poison = 0; c.burnTurns = 0; c.bleed = 0; });
}
// 狩人「鷹を呼ぶ」も戦闘をまたいで持ち越さない。startBattle()側では次の戦闘の頭でリセットしていたが、
// 戦闘終了(探索画面に戻る)時点ではリセットしていなかったため、鷹の残りターンが残ったまま
// 探索中の味方バーにもバッジが表示され続けてしまっていた不具合の修正
function clearHawkState(characters) {
  characters.forEach((c) => { c.hawkTurnsLeft = 0; c.hawkGuardTargetId = null; c.hawkFlightActive = false; });
}
// かばうの構えも戦闘をまたいで持ち越さない(勝利/逃走/全滅、いずれの戦闘終了経路でも解除する)
function clearGuardState(characters) {
  characters.forEach((c) => { c.guarding = false; c.guardProtectCount = 0; });
}

// 忍の「変化の術」: カラス/ガマ/ヘビいずれかへの変身。ステータスは変身前(装備込み)の値にform倍率を
// 掛けた新しい値へ直接置き換える(一時バフのstatModsとは別枠。乗算バフ等は変身後の値にさらに乗る)。
// 変身前の状態(HP/ステータス/ストレス/デバフ)は__preTransformに退避し、解除時にそのまま復元する
function enterTransform(character, formKey) {
  const form = TRANSFORM_FORMS[formKey];
  character.__preTransform = {
    hp: character.hp, maxHp: character.maxHp, atk: character.atk, def: character.def, spd: character.spd,
    fatigue: character.fatigue,
  };
  character.transformForm = formKey;
  character.maxHp = Math.max(1, Math.round(character.maxHp * form.hpMult));
  character.hp = character.maxHp; // 変身直後は新しい姿の最大HPで満タンになる
  character.atk = Math.max(1, Math.round(character.atk * form.atkMult));
  character.def = Math.max(1, Math.round(character.def * form.defMult));
  character.spd = Math.max(1, Math.round(character.spd * form.spdMult));
  // ストレスの概念が無くなる(fatigueMalusが掛からなくなり、ストレス落書きオーバーレイも出なくなる)
  character.fatigue = 0;
  // 変身前のデバフは一切引き継がない
  character.poison = 0; character.bleed = 0; character.burnTurns = 0;
  character.stunTurns = 0; character.silenceTurns = 0; character.statMods = [];
  character.isFlying = !!form.isFlying;
  character.formCooldowns = {};
}
// 変身解除: 任意解除・戦闘不能相当のダメージ・野営開始、いずれの経路からも呼ばれる共通処理。
// 戦闘終了(勝利/逃走/全滅)では自動解除しない仕様(ユーザー指示により撤廃)なので、戦闘をまたいで
// 変身状態のまま探索を続けられる。変身中に得ていたデバフは解除後にも一切引き継がず、HPは変身前の値
// (このダメージで変身中に0になった場合でも、瀕死にはせず変身前のHPのまま)に戻す
function revertTransform(character) {
  if (!character.transformForm || !character.__preTransform) return;
  const pre = character.__preTransform;
  character.maxHp = pre.maxHp;
  character.hp = Math.min(pre.maxHp, Math.max(1, pre.hp));
  character.atk = pre.atk; character.def = pre.def; character.spd = pre.spd;
  character.fatigue = pre.fatigue;
  character.poison = 0; character.bleed = 0; character.burnTurns = 0;
  character.stunTurns = 0; character.silenceTurns = 0; character.statMods = [];
  character.isFlying = false;
  character.transformForm = null;
  character.formCooldowns = {};
  character.__preTransform = null;
}
// 炎上弱点を持つ敵はダメージ2倍(tier1/2共通)。tier2は「炎上が自然に消えない」ため、
// 弱点を持たない/tier1の場合だけturnsを減らす(tier2は0にならず燃え続ける)
function tickBurn(entity, log) {
  if (!entity.burnTurns || entity.burnTurns <= 0) return 0;
  const w = enemyWeaknessType(entity, "burn");
  const dmg = Math.max(1, Math.round(entity.maxHp * BURN_DAMAGE_PCT * (w ? 2 : 1)));
  entity.hp = Math.max(0, entity.hp - dmg);
  log(`${entity.label}は炎上で${dmg}ダメージ！${w ? "(炎上は弱点！)" : ""}`);
  if (!(w && w.tier === 2)) entity.burnTurns--;
  return dmg;
}
function applyStun(entity, turns) {
  if (entity.statusImmuneTurns > 0) return;
  if (blockedByOmamoriIzanagi(entity)) return;
  entity.stunTurns = Math.max(entity.stunTurns || 0, turns);
  // 不動明王の御守: 味方がスタンした時、その間だけ防御力が2倍になる(敵には効かない。
  // instanceIdを持つのは敵のみなので、それが無い=味方で判定する)
  if (entity.instanceId === undefined && hasOmamori("fudo")) {
    applyStatMod(entity, "def", 2.0, entity.stunTurns);
  }
  // スタンした相手には一定ターン、スタン抵抗(resistedChance側で参照)を大幅に付与する。
  // 連続でスタンし続けられる「スタンロック」を防ぐための措置(通常のstatusResistMultとは別枠)
  entity.stunResistTurns = Math.max(entity.stunResistTurns || 0, STUN_RESIST_TURNS);
  // 大技の構え中(bigAttackPending)にスタンが入ると、構え自体を完全に潰す(止める対抗策)。
  // 新しい間隔を1回抽選し直し、また一から仕切り直しにする
  if (entity.bigAttackPending) {
    entity.bigAttackPending = false;
    entity.bigAttackCountdown = rollBigAttackCountdown(entity);
  }
}
function applySilence(entity, turns) {
  if (entity.statusImmuneTurns > 0) return;
  if (blockedByOmamoriIzanagi(entity)) return;
  entity.silenceTurns = Math.max(entity.silenceTurns || 0, turns);
}
// 伊邪那美命の御守: 戦闘中最初に自分が敵へ与える状態異常を強化する(パーティ共有の使い捨てフラグ)。
// 毒/出血のような蓄積値系はスタック+2、それ以外の種類は消費するだけで数値上のボーナスは無い
function consumeOmamoriIzanami(actor) {
  const g = actor && actor.passives && actor.passives.omamoriIzanamiPending;
  if (!g || g.used) return false;
  g.used = true;
  return true;
}
// 自分のターンの一番最初に呼ぶ共通処理(毒/炎上のダメージ+継続回復+バフ/デバフの残りターン消化)。ダメージ量を返す
function tickTurnStartEffects(entity, log) {
  if (entity.stunResistTurns > 0) entity.stunResistTurns--;
  const poisonDmg = tickPoison(entity, log);
  const burnDmg = tickBurn(entity, log);
  const bleedDmg = tickBleed(entity, log);
  const dmg = poisonDmg + burnDmg + bleedDmg;
  // 温泉バフ「湯治」: 自分のターンの最初に毎回HPの2%を回復する
  if (entity.hp > 0 && entity.onsenBuffKey === "touji") {
    const heal = Math.max(1, Math.round(entity.maxHp * 0.02));
    entity.hp = Math.min(entity.maxHp, entity.hp + heal);
    log(`${entity.label}は湯治の効果で${heal}回復した！`);
  }
  // hpRegenPct: statMods便乗の継続回復タグ(mult欄に割合を入れて流用)。明鏡止水・仁王立ちなど
  if (entity.hp > 0 && entity.statMods) {
    entity.statMods.forEach((m) => {
      if (m.stat === "hpRegenPct") {
        const heal = Math.max(1, Math.round(entity.maxHp * m.mult));
        entity.hp = Math.min(entity.maxHp, entity.hp + heal);
        log(`${entity.label}は${heal}回復した！`);
      }
    });
  }
  tickStatMods(entity);
  // 狩人「鷹を呼ぶ」: 出現ターン数を自分のターンが来るたびに1減らし、切れたら飛び去る
  if (entity.hawkTurnsLeft > 0) {
    entity.hawkTurnsLeft--;
    if (entity.hawkTurnsLeft <= 0) {
      entity.hawkGuardTargetId = null;
      log(`${entity.label}の鷹は飛び去っていった。`);
    }
  }
  if (entity.statusImmuneTurns > 0) entity.statusImmuneTurns--;
  if (entity.tauntTurns > 0) entity.tauntTurns--;
  if (entity.passives && entity.passives.onKillStacks > 0) {
    entity.passives.onKillStacksTurns--;
    if (entity.passives.onKillStacksTurns <= 0) entity.passives.onKillStacks = 0;
  }
  // 百戦錬磨など: 自分のターンが来るたびに攻撃力が少しずつ積み上がる(maxTurnsで頭打ち、戦闘中ずっと持続)
  if (entity.passives && entity.passives.turnStackAtkBuff) {
    const b = entity.passives.turnStackAtkBuff;
    entity.turnStackAtkStacks = Math.min(b.maxTurns, (entity.turnStackAtkStacks || 0) + 1);
  }
  // 覇気など: 自分のターン開始時、確率で状態異常を自動で治す(type:"all"は毒/出血/炎上/スタン/沈黙をまとめて対象にする)
  if (entity.hp > 0 && entity.passives && entity.passives.turnStartCureChance) {
    const tc = entity.passives.turnStartCureChance;
    const hasIt = tc.type === "all" ? hasStatusAilment(entity)
      : tc.type === "bleed" ? (entity.bleed || 0) > 0
      : tc.type === "poison" ? (entity.poison || 0) > 0 : false;
    if (hasIt && Math.random() < tc.chance) {
      if (tc.type === "all") {
        entity.poison = 0; entity.burnTurns = 0; entity.bleed = 0; entity.stunTurns = 0; entity.silenceTurns = 0;
      } else if (tc.type === "bleed") entity.bleed = 0;
      else if (tc.type === "poison") entity.poison = 0;
      log(`${entity.label}は気迫で${tc.type === "all" ? "状態異常" : tc.type === "bleed" ? "出血" : "毒"}を癒した！`);
    }
  }
  // 心眼の構えなど: 「このターン」限定の無効化反撃が不発のまま自分の次のターンを迎えたら解除する
  if (entity.nullifyCounterTurnsLeft > 0) {
    entity.nullifyCounterTurnsLeft--;
    if (entity.nullifyCounterTurnsLeft <= 0) entity.nullifyCounterMult = null;
  }
  return { total: dmg, poison: poisonDmg, burn: burnDmg, bleed: bleedDmg };
}

// 装備購入後、既存の該当職業メンバー全員のequipBonusを再計算する
function refreshEquipBonus(characters, classId, classUpgrades) {
  const bonus = computeEquipBonus(classId, classUpgrades);
  const baseMaxMp = baseMaxMpFor(classId);
  characters.forEach((c) => {
    if (c.classId === classId) {
      c.equipBonus = bonus;
      const newMaxMp = baseMaxMp + (bonus.mp || 0);
      const delta = newMaxMp - c.maxMp;
      c.maxMp = newMaxMp;
      c.mp = Math.max(0, Math.min(newMaxMp, c.mp + delta)); // MP上限が増えた分、現在MPにもそのまま上乗せする
    }
  });
}

// 魔力0の物理職(盗賊/忍者/戦士/侍)にも最低10のMPを持たせてあるので、自分の技は使える。
// MPはレベルアップで伸びなくなった(下記levelUp参照)ため、一度の遠征で4〜5回使える程度を目安に
// guard以外は旧コストの半分にしてある。guardは他の技より軽いが、無制限に連発できないよう1だけ消費させる
const ABILITY_MP_COST = { magicAttack: 3, magicAttackAll: 6, heal: 3, critAttack: 2, powerAttack: 3, physicalAttackAll: 3, preciseShot: 2, cannonShot: 4, guard: 1 };
function abilityMpCost(abilityType, actor) {
  // 変化の術で変身中はMPの概念が無くなる(かばう等も無料で使える)
  if (actor && actor.transformForm) return 0;
  let cost = ABILITY_MP_COST[abilityType] || 0;
  // 温泉バフ「英気充填」: MP消費-10%
  if (actor && actor.onsenBuffKey === "eikijuten") cost = Math.max(0, Math.round(cost * 0.9));
  // スキルツリーの固定MP割引(舞の型など)
  if (actor && actor.passives && actor.passives.abilityMpDiscount && actor.passives.abilityMpDiscount[abilityType]) {
    cost = Math.max(0, cost - actor.passives.abilityMpDiscount[abilityType]);
  }
  return cost;
}

function grantXp(character, amount, log) {
  if (character.status !== "active") return;
  if (character.level >= MAX_LEVEL) return; // 上限到達後は経験値を受け取らない(溜まり続けるのを防ぐ)
  character.xp += amount;
  let guardCounter = 0;
  while (character.level < MAX_LEVEL && character.xp >= xpToNext(character.level) && guardCounter < 50) {
    character.xp -= xpToNext(character.level);
    levelUp(character, log);
    guardCounter++;
  }
  if (character.level >= MAX_LEVEL) character.xp = 0;
}

// 防御力による軽減率。defは「そのキャラ/敵の被ダメ軽減%」を直接表す固定値(旧: K/(K+def)の
// 逓減式だったが、防御力が数値なのか%なのか直感的に分からないという問題があったため、
// 「防御力30」=「30%軽減」とそのまま読める方式に全面刷新した)。
// Kは技ごとの防御貫通性(旧式の名残)。通常攻撃で使うK=18を新基準(貫通0%=defがそのまま軽減%になる)
// とし、それより大きいK(貫通しやすい技)はプラスの貫通%に、それより小さいK(スキルツリーの大半の
// 技が使うK=15など、通常攻撃より防御に弱い技)はマイナスの貫通%(=軽減が通常よりきつく効く)に
// 自動変換される。ただし会心の一撃/会心の一矢/呪符ノ術の3つだけは「防御に弱すぎる」という違和感が
// あったユーザー指示によりK=18(貫通0%)を強制し、代わりに各技のmult側で威力を再調整して
// 黄金バランスを維持した(engine.js内の各roll関数のコメント参照)
function mitigation(def, K) {
  const defPierce = 1 - 18 / K;
  const reduction = Math.min(0.9, Math.max(0, Math.max(0, def) / 100 * (1 - defPierce)));
  return 1 - reduction;
}
// 命中した際の最終ダメージにランダムな幅(±pct)を掛ける。割合式では加算乱数より掛け算の方が自然
function withVariance(value, pct) {
  return value * (1 + (Math.random() * 2 - 1) * pct);
}
function rollBasicAttack(atk, def) {
  return Math.max(1, Math.round(withVariance(atk * mitigation(def, 18), 0.15)));
}
function rollMagicAttack(mag, def) {
  return Math.max(1, Math.round(withVariance(mag * 1.41 * mitigation(def, 18), 0.12))); // 防御%直接方式への移行時、通常攻撃と同じ貫通0%を強制し(旧K8=防御に弱すぎる違和感の解消)、旧K8相当の強さを維持するようmultを1.8→1.41に再調整。旧MAGIC_MIN_EFFECTIVE_DEF(序盤の低防御力の敵への過剰貫通対策)は不要になったため廃止
}
function rollPowerAttack(atk, def) {
  return Math.max(1, Math.round(withVariance(atk * 1.6 * mitigation(def, 22), 0.15)));
}
function rollCritAttack(atk, def) {
  return Math.max(1, Math.round(withVariance(atk * 1.47 * mitigation(def, 18), 0.15))); // 防御%直接方式への移行時、通常攻撃と同じ貫通0%を強制し、旧K12相当の強さを維持するようmultを1.56→1.47に再調整
}
// 狩人の会心の一矢。会心の一撃と同じ防御貫通の性質(弓は鎧の隙間を狙う)
function rollPreciseShot(atk, def) {
  return Math.max(1, Math.round(withVariance(atk * 1.40 * mitigation(def, 18), 0.15))); // 防御%直接方式への移行時、通常攻撃と同じ貫通0%を強制し、旧K12相当の強さを維持するようmultを1.485→1.40に再調整
}
// 砲術士の砲撃。渾身の一撃よりさらに重いが、使うと次のターンは装填で動けなくなる(呼び出し側で処理)
function rollCannonShot(atk, def) {
  return Math.max(1, Math.round(withVariance(atk * 2.4 * mitigation(def, 26), 0.2)));
}
function rollHeal(mag) {
  return Math.max(5, Math.round(mag * 1.5 + Math.random() * 5));
}

// ============ スキルツリー(XCOM風、レベルアップごとに2択で1つ選ぶ) ============
// character.passives: 選んだ受動スキルの効果をまとめて蓄積するオブジェクト(常時参照される)
function initPassives() {
  return {
    atkMult: 1, defMult: 1, spdMult: 1, // hpMultは適用時に直接maxHpへ反映するのでここでは保持しない
    critRateAdd: 0, critDmgAdd: 0, accuracyAdd: 0, evasionAdd: 0,
    statusResistMult: 0, dodgeChance: 0, counterChance: 0, counterMult: 1,
    mpDiscountPct: 0, mpRefundChance: 0,
    onceGuardType: null, onceGuardUsed: false,
    firstAttackBonusMult: 0, firstAttackUsed: false,
    onKill: null, // {statMult:[{stat,mult}], turns, maxStacks}
    onKillStacks: 0, onKillStacksTurns: 0,
    onHitInflicts: [], // [{type, chance, value, turns}] 通常攻撃に乗る状態異常付与(複数スキルぶん積み上がる)
    executeBonus: null, // {belowPct, mult} HPが閾値以下の相手への追加ダメージ倍率
    executeCritBonus: [], // [{belowPct, addRate, cmp}] 対象のHP割合条件つき追加会心率(剣豪など)。配列なので閾値違いを複数持てる
    woundBonuses: [], // [{mult, ailment}] 状態異常(ailment未指定なら何らかの状態異常全般、指定時はそれだけ)を負っている相手への追加ダメージ倍率。
    // 同じクラスが複数のailment条件違いを選べるよう配列にしてある(単一フィールドだと後から選んだ方が上書きしてしまうため)
    conditionalMods: [], // [{cmp, value, statMult:[{stat,mult}]|null, dmgTakenMult:number|null, evasionAdd:number|null}] (stat基準は常にhpPct)
    flagMods: [], // [{flag, stat, mult}] entity自身の一時状態(tauntTurns/reloading/guardingなど)が真の間だけ乗算する汎用フック
    evadeCritCounter: false, // 回避に成功した直後、次の自分の攻撃が確定会心になる(反射神経など)
    onCritSelfBuff: null, // {stat, mult} 自分が会心を出した直後、次の自分の1ターンだけそのステータスが上がる(連斬など)
    fasterFoeDmgReduction: null, // 数値(mult) 自分より素早い相手から受けるダメージを軽減する(疾風など)
    ailmentCritBonus: [], // [{ailment, addRate}] 対象が特定の状態異常を負っている時の追加会心率(毒を負わせた敵に会心、など)。配列なので複数のailment条件を持てる
    onEvadeSelfBuff: null, // {stat, mult} 回避に成功した直後、次の自分の1ターンだけそのステータスが上がる(影分身など)
    executeAccuracyBonus: null, // {belowPct, addRate, cmp} 対象のHP割合条件つき命中率ボーナス(弱点看破など)
    comboFollowup: [], // [{tag, stat, mult}] 特定のcomboTag技を使った直後、次の自分の1ターンだけ効果を得る(連射の心得など)。配列なので同じ技に複数の追撃効果を紐付けられる
    discountWhileFlag: null, // {statModName, pct} 特定のstatMod(reloadImmuneなど)が有効な間だけMP消費を追加割引する(装填術など)
    healBonusRules: [], // [{trigger:"targetHpBelow"|"selfHpAbove"|"onCleanse", value, mult}] 回復量への条件つき倍率(治癒術・慈愛など)
    mpOnCleanse: 0, // 状態異常を解除する回復/バフを使うたび、これだけMPが回復する(生命力循環など)
    guardCounter: false, // かばうが敵の攻撃を防いだ瞬間、確実に反撃する(会心の返し)
    guardCritCounter: false, // かばうが成功した直後、次の自分の攻撃が確定会心になる(居合の構え)
    guardMpRefund: false, // かばうが成功するとMPが1回復する(心眼)
    guardTurnFree: false, // かばうを使ってもターンを消費せず、続けて別の行動を選べる(金剛)
    extraGuardMitigation: 1, // かばう成功時の被ダメージにさらに掛かる倍率(1=無効化。金剛など)
    debuffCritBonuses: [], // [{stat, addRate}] 対象の指定ステータス(atk/def/spd)が下がっている時の追加会心率(隙討ち・拍子外し・弱者狩り・衰弱撃ちなど)。
    // 誰がそのデバフを与えたかは問わないため、デバフを持つ別クラスと組み合わせるほど機能する
    stackedWoundBonusPerAilment: 0, // 対象が負っている状態異常の「種類数」×この値、ダメージ倍率が伸びる(1+n*value)。
    // 複数クラスがそれぞれ違う状態異常を持ち寄るほど強くなる(百鬼断・急所連撃・気枯らしの術など)
    allyGuardCritAdd: 0, // 自分以外の生存中の仲間が今かばっている間、追加会心率(連携の呼吸など)
    allyGuardDmgMult: 1, // 自分以外の仲間がかばっている間、自分の与ダメージ倍率(援護薙ぎ・援護砲撃など)
    allyGuardDmgTakenMult: 1, // 自分以外の仲間がかばっている間、自分の被ダメージ倍率(護りの薙刀など)
    guardPartyAtkBuff: 0, // 自分のかばうが成功した瞬間、味方全体に3ターンの攻撃力+この値を配る(鼓舞の盾)
    bleedFollowupOnHit: false, // 出血中の敵への通常攻撃が命中した時、出血スタックを3追加する(追い討ち)
    abilityMpDiscount: {}, // { abilityType: 固定MP割引量 } 職業の基本アビリティ(薙ぎ払い等)のMP消費を固定値で下げる(舞の型など)
    abilityOnHitInflicts: {}, // { abilityType: [{type,chance,value,valueMin,valueMax,turns}] } 特定の職業基本アビリティ(薙ぎ払い等)が命中した敵にだけ状態異常を付与する(旋風薙ぎなど)
    abilityAoeSelfBuffs: {}, // { abilityType: [{stat,perHitMult,turns}] } 特定の職業基本アビリティ(薙ぎ払い等)が命中した敵の数に応じて自分に一時バフを与える(円舞など)
    onCritExtraAttackChance: 0, // 自分が会心を出した直後、この確率でもう一度通常攻撃できる(対象再選択可、通常攻撃のみ。連斬など)
    dotDamageMult: 1, // 出血ダメージの倍率(黒曜、1未満で軽減。tickBleedのみ参照)
    allyCritSelfCritBuff: 0, // 自分以外の仲間が会心を出した直後、次の自分の1ターンだけ会心率がこの値だけ上がる(闘志など)
    turnStackAtkBuff: null, // {perTurn, maxTurns} 自分のターンが来るたびに攻撃力がperTurnずつ上がる(maxTurnsで頭打ち。百戦錬磨など)
    turnStartCureChance: null, // {type, chance} 自分のターン開始時、この確率で状態異常を自動で治す(type:"bleed"/"poison"/"all"。覇気など)
    preFirstHitEvasionAdd: 0, // その戦闘で初めて敵に攻撃を受けるまで、回避率がこの値だけ上がる(忍足など)
    onKillEvasionBonus: 0, // 敵を倒した直後、次の1回だけ受ける攻撃への回避率がこの値だけ上がる(修羅刃など。蓄積しない)
    onHitSelfHealPct: 0, // 通常攻撃が敵に命中するたび、自分の最大HPのこの割合だけ回復する(未使用、汎用フックとして残置)
    onEvadeCounterMult: 0, // 敵の攻撃を回避した瞬間、この攻撃力倍率で反撃する(瞬身の順など)
    onEvadeMpRestore: 0, // 敵の攻撃を回避した瞬間、MPをこれだけ回復する(空蝉など)
    guardFreeChance: 0, // かばうを使った時、この確率でMP消費が0になる(未使用、汎用フックとして残置)
    onHitLifestealPct: 0, // 通常攻撃で与えたダメージのこの割合だけ自分のHPを回復する(覇気など)
    onDamagedSelfHealPct: 0, // 敵からダメージを受けるたび、自分の最大HPのこの割合だけ回復する(不動の構えなど)
    onHitSelfStackBuff: null, // {stat, perStack, maxStacks, turns} 通常攻撃が命中するたび、自分のステータスが蓄積的に上がる(剛槍など)
  };
}
const BASE_CRIT_RATE = 0.05; // 全キャラ共通の会心率の下限(スキルツリーで底上げされる)
const BASE_CRIT_DMG_MULT = 1.55; // 会心時のダメージ倍率の基準(スキルツリーでさらに加算される)。
// 敵はpassivesを持たずrollCritMultiplierが常に1を返す(=会心しない)ため、この値の変更は
// 実質的に味方→敵の会心ダメージにのみ影響する(ユーザー指示で1.5→1.55に+5%)

// レベルアップで選んだスキルを反映する。受動効果はpassivesに蓄積し、能動スキルはunlockedSkillsに追加する。
// level引数は「このスキルを選んだのはレベル何の時か」を明示的に渡すためのもの。
// character.levelを使わない理由: 1戦で2レベル以上連続で上がった場合、スキル選択が全て終わる前に
// character.levelは既に最終レベルまで進んでしまっているため、character.levelをキーに使うと
// 複数のレベル分の選択が同じキーに上書きされて記録が消えてしまうバグがあった
function applySkillChoice(character, skill, level) {
  character.skills = character.skills || {};
  character.skills[level] = skill.side;
  if (skill.passive) {
    const p = character.passives;
    const add = skill.passive;
    if (add.atkMult) p.atkMult *= add.atkMult;
    if (add.defMult) p.defMult *= add.defMult;
    if (add.spdMult) p.spdMult *= add.spdMult;
    if (add.hpMult) {
      // maxHpはeffectiveStat経由ではなく直接持つ値なので、levelUpと同じ要領でその場で底上げする
      const oldMax = character.maxHp;
      character.maxHp = Math.round(character.maxHp * add.hpMult);
      character.hp += character.maxHp - oldMax;
    }
    if (add.critRateAdd) p.critRateAdd += add.critRateAdd;
    if (add.critDmgAdd) p.critDmgAdd += add.critDmgAdd;
    if (add.accuracyAdd) p.accuracyAdd += add.accuracyAdd;
    if (add.evasionAdd) p.evasionAdd += add.evasionAdd;
    if (add.statusResistMult) p.statusResistMult = Math.min(0.9, p.statusResistMult + add.statusResistMult);
    if (add.dodgeChance) p.dodgeChance = Math.min(0.6, p.dodgeChance + add.dodgeChance);
    if (add.counterChance) { p.counterChance = Math.min(0.6, p.counterChance + add.counterChance); p.counterMult = add.counterMult || p.counterMult; }
    if (add.mpDiscountPct) p.mpDiscountPct = Math.min(0.6, p.mpDiscountPct + add.mpDiscountPct);
    if (add.mpRefundChance) p.mpRefundChance = Math.min(0.6, p.mpRefundChance + add.mpRefundChance);
    if (add.onceGuardType) p.onceGuardType = add.onceGuardType;
    if (add.firstAttackBonusMult) p.firstAttackBonusMult = add.firstAttackBonusMult;
    if (add.onKill) p.onKill = add.onKill;
    if (add.conditionalMod) p.conditionalMods.push(add.conditionalMod);
    if (add.onHitInflict) p.onHitInflicts.push(add.onHitInflict);
    if (add.executeBonus) p.executeBonus = add.executeBonus;
    if (add.executeCritBonus) p.executeCritBonus.push(add.executeCritBonus);
    if (add.woundBonus) p.woundBonuses.push(add.woundBonus);
    if (add.flagMod) p.flagMods.push(add.flagMod);
    if (add.evadeCritCounter) p.evadeCritCounter = true;
    if (add.guardCounter) p.guardCounter = true;
    if (add.guardCritCounter) p.guardCritCounter = true;
    if (add.guardMpRefund) p.guardMpRefund = true;
    if (add.guardTurnFree) p.guardTurnFree = true;
    if (add.extraGuardMitigation) p.extraGuardMitigation *= add.extraGuardMitigation;
    if (add.onCritSelfBuff) p.onCritSelfBuff = add.onCritSelfBuff;
    if (add.fasterFoeDmgReduction) p.fasterFoeDmgReduction = add.fasterFoeDmgReduction;
    if (add.ailmentCritBonus) p.ailmentCritBonus.push(add.ailmentCritBonus);
    if (add.onEvadeSelfBuff) p.onEvadeSelfBuff = add.onEvadeSelfBuff;
    if (add.executeAccuracyBonus) p.executeAccuracyBonus = add.executeAccuracyBonus;
    if (add.comboFollowup) p.comboFollowup.push(add.comboFollowup);
    if (add.discountWhileFlag) p.discountWhileFlag = add.discountWhileFlag;
    if (add.healBonusRule) p.healBonusRules.push(add.healBonusRule);
    if (add.mpOnCleanse) p.mpOnCleanse += add.mpOnCleanse;
    if (add.debuffCritBonus) p.debuffCritBonuses.push(add.debuffCritBonus);
    if (add.stackedWoundBonusPerAilment) p.stackedWoundBonusPerAilment += add.stackedWoundBonusPerAilment;
    if (add.allyGuardCritAdd) p.allyGuardCritAdd += add.allyGuardCritAdd;
    if (add.allyGuardDmgMult) p.allyGuardDmgMult *= add.allyGuardDmgMult;
    if (add.allyGuardDmgTakenMult) p.allyGuardDmgTakenMult *= add.allyGuardDmgTakenMult;
    if (add.guardPartyAtkBuff) p.guardPartyAtkBuff += add.guardPartyAtkBuff;
    if (add.bleedFollowupOnHit) p.bleedFollowupOnHit = true;
    if (add.abilityMpDiscount) {
      p.abilityMpDiscount = p.abilityMpDiscount || {};
      Object.keys(add.abilityMpDiscount).forEach((k) => {
        p.abilityMpDiscount[k] = (p.abilityMpDiscount[k] || 0) + add.abilityMpDiscount[k];
      });
    }
    if (add.abilityOnHitInflict) {
      p.abilityOnHitInflicts = p.abilityOnHitInflicts || {};
      Object.keys(add.abilityOnHitInflict).forEach((k) => {
        p.abilityOnHitInflicts[k] = p.abilityOnHitInflicts[k] || [];
        p.abilityOnHitInflicts[k].push(add.abilityOnHitInflict[k]);
      });
    }
    if (add.abilityAoeSelfBuff) {
      p.abilityAoeSelfBuffs = p.abilityAoeSelfBuffs || {};
      Object.keys(add.abilityAoeSelfBuff).forEach((k) => {
        p.abilityAoeSelfBuffs[k] = p.abilityAoeSelfBuffs[k] || [];
        p.abilityAoeSelfBuffs[k].push(add.abilityAoeSelfBuff[k]);
      });
    }
    if (add.onCritExtraAttackChance) p.onCritExtraAttackChance = add.onCritExtraAttackChance;
    if (add.dotDamageMult) p.dotDamageMult *= add.dotDamageMult;
    if (add.allyCritSelfCritBuff) p.allyCritSelfCritBuff += add.allyCritSelfCritBuff;
    if (add.turnStackAtkBuff) p.turnStackAtkBuff = add.turnStackAtkBuff;
    if (add.turnStartCureChance) p.turnStartCureChance = add.turnStartCureChance;
    if (add.preFirstHitEvasionAdd) p.preFirstHitEvasionAdd += add.preFirstHitEvasionAdd;
    if (add.onKillEvasionBonus) p.onKillEvasionBonus += add.onKillEvasionBonus;
    if (add.onHitSelfHealPct) p.onHitSelfHealPct += add.onHitSelfHealPct;
    if (add.onEvadeCounterMult) p.onEvadeCounterMult = add.onEvadeCounterMult;
    if (add.onEvadeMpRestore) p.onEvadeMpRestore += add.onEvadeMpRestore;
    if (add.guardFreeChance) p.guardFreeChance = Math.min(1, p.guardFreeChance + add.guardFreeChance);
    if (add.onHitLifestealPct) p.onHitLifestealPct += add.onHitLifestealPct;
    if (add.onDamagedSelfHealPct) p.onDamagedSelfHealPct += add.onDamagedSelfHealPct;
    if (add.onHitSelfStackBuff) p.onHitSelfStackBuff = add.onHitSelfStackBuff;
  }
  if (skill.action) {
    character.unlockedSkills = character.unlockedSkills || [];
    character.unlockedSkills.push({ id: skill.id, name: skill.name, desc: skill.desc, mp: skill.mp, action: skill.action, comboTag: skill.comboTag });
  }
}

// HP割合条件つきの受動効果(気迫・武士道など)を、現在のHPに応じて都度評価する
function activeConditionalMods(character) {
  if (!character.passives || !character.passives.conditionalMods.length) return [];
  const hpPct = character.maxHp > 0 ? character.hp / character.maxHp : 1;
  return character.passives.conditionalMods.filter((m) => (m.cmp === "gte" ? hpPct >= m.value : hpPct <= m.value));
}
// 被ダメージ軽減系の受動効果(気迫・仁王立ちなど、statMods経由のものも含む)をまとめて乗算で返す
// 回復量に影響する条件つきボーナスをまとめて判定する(治癒術・慈愛・生命の奇跡・慈悲の心など)。
// targetHpBelow: 対象のHP割合が閾値以下 / selfHpAbove: 自分(施術者)のHP割合が閾値以上 / onCleanse: 状態異常解除を伴う回復の時
function healBonusMultiplier(actor, target, wasCleanse) {
  let mult = 1;
  if (!actor.passives || !actor.passives.healBonusRules || !actor.passives.healBonusRules.length) return mult;
  actor.passives.healBonusRules.forEach((r) => {
    if (r.trigger === "targetHpBelow" && target && target.maxHp > 0 && target.hp / target.maxHp <= r.value) mult *= r.mult;
    if (r.trigger === "selfHpAbove" && actor.maxHp > 0 && actor.hp / actor.maxHp >= r.value) mult *= r.mult;
    if (r.trigger === "onCleanse" && wasCleanse) mult *= r.mult;
  });
  return mult;
}
function damageTakenMultiplier(character) {
  let mult = 1;
  activeConditionalMods(character).forEach((m) => { if (m.dmgTakenMult) mult *= m.dmgTakenMult; });
  if (character.statMods) character.statMods.forEach((m) => { if (m.stat === "dmgTaken") mult *= m.mult; });
  if (character.passives && character.passives.flagMods) {
    character.passives.flagMods.forEach((fm) => { if (fm.stat === "dmgTaken" && character[fm.flag]) mult *= fm.mult; });
  }
  // 自分以外の仲間がかばっている間の被ダメージ倍率(護りの薙刀など)
  if (character.passives && character.passives.allyGuardDmgTakenMult !== 1 && anyOtherAllyGuarding(character)) {
    mult *= character.passives.allyGuardDmgTakenMult;
  }
  return mult;
}
// 会心判定。会心なら会心時ダメージ倍率を、外れなら1を返す
function rollCritMultiplier(actor, extraCritRate, target) {
  const p = actor.passives;
  if (!p) return 1;
  // 直前に回避成功した時などに1回だけ立つ「次の攻撃は確定会心」フラグ(反射神経など)。使ったら消費する
  if (actor.guaranteedCritNext) {
    actor.guaranteedCritNext = false;
    return BASE_CRIT_DMG_MULT + p.critDmgAdd;
  }
  // おみくじ「吉」: 戦闘全体で共有する残り回数(誰の攻撃でも消費する)。味方の攻撃にのみ関わるため、
  // 敵の攻撃(passivesを持たずこの関数の先頭で既にreturnしている)には影響しない
  if (typeof battle !== "undefined" && battle && battle.omikujiGuaranteedCritsLeft > 0) {
    battle.omikujiGuaranteedCritsLeft--;
    return BASE_CRIT_DMG_MULT + p.critDmgAdd;
  }
  // 温泉バフ「気分爽快」: 会心率+5%
  const onsenCritBonus = actor.onsenBuffKey === "kibunsoukai" ? 0.05 : 0;
  // 対象のHP割合条件つき会心率ボーナス(剣豪など、弱った敵ほど会心が出やすい系。cmp:"gte"なら逆に高HP時に発動)。
  // 配列なので閾値違いを複数持てる場合は全部チェックして合算する
  let executeCritAdd = 0;
  if (p.executeCritBonus && p.executeCritBonus.length && target && target.maxHp > 0) {
    const hpPct = target.hp / target.maxHp;
    p.executeCritBonus.forEach((eb) => {
      const matched = (eb.cmp || "lte") === "lte" ? hpPct <= eb.belowPct : hpPct >= eb.belowPct;
      if (matched) executeCritAdd += eb.addRate;
    });
  }
  // 対象が特定の状態異常を負っている時の追加会心率(毒を負わせた敵に会心、など)。複数条件を合算する
  let ailmentCritAdd = 0;
  if (p.ailmentCritBonus && p.ailmentCritBonus.length && target) {
    p.ailmentCritBonus.forEach((ac) => { if (hasSpecificAilment(target, ac.ailment)) ailmentCritAdd += ac.addRate; });
  }
  // 対象の指定ステータスが下がっている時の追加会心率(隙討ち・拍子外し・弱者狩り・衰弱撃ちなど)
  let debuffCritAdd = 0;
  if (p.debuffCritBonuses && p.debuffCritBonuses.length && target) {
    p.debuffCritBonuses.forEach((db) => { if (hasStatDebuff(target, db.stat)) debuffCritAdd += db.addRate; });
  }
  // 自分以外の仲間がかばっている間の追加会心率(連携の呼吸など)
  const allyGuardCritAdd = p.allyGuardCritAdd > 0 && anyOtherAllyGuarding(actor) ? p.allyGuardCritAdd : 0;
  // 一時的な会心率/会心ダメージバフ(闘志・明鏡止水など)。statMods経由でevasionAddと同じ加算方式で乗る
  let tempCritRateAdd = 0, tempCritDmgAdd = 0;
  if (actor.statMods) {
    actor.statMods.forEach((m) => {
      if (m.stat === "critRateAdd") tempCritRateAdd += m.mult;
      if (m.stat === "critDmgAdd") tempCritDmgAdd += m.mult;
    });
  }
  const rate = BASE_CRIT_RATE + p.critRateAdd + tempCritRateAdd + onsenCritBonus + executeCritAdd + ailmentCritAdd + debuffCritAdd + allyGuardCritAdd + (extraCritRate || 0);
  if (Math.random() < rate) return BASE_CRIT_DMG_MULT + p.critDmgAdd + tempCritDmgAdd;
  return 1;
}
// スキルツリーの技のMPコストに、そのキャラのMP割引を適用する
function skillMpCost(actor, baseMp) {
  // 変化の術で変身中はMPの概念自体が無くなる(変身をかけるための消費自体はtransformFormがまだnullの
  // 状態で判定されるため、ここでの0化は「変身後の他の技」向けの安全策)
  if (actor.transformForm) return 0;
  let discount = (actor.passives && actor.passives.mpDiscountPct) || 0;
  // 温泉バフ「英気充填」: MP消費-10%(他の割引と乗算ではなく加算で重ねる)
  if (actor.onsenBuffKey === "eikijuten") discount += 0.1;
  // 特定のstatMod(土嚢展開のreloadImmuneなど)が有効な間だけ追加割引(装填術など)
  if (actor.passives && actor.passives.discountWhileFlag && actor.statMods) {
    const d = actor.passives.discountWhileFlag;
    if (actor.statMods.some((m) => m.stat === d.statModName)) discount += d.pct;
  }
  return Math.max(0, Math.round(baseMp * (1 - discount)));
}
// 状態異常の付与確率に、対象の耐性(statusResistMult)を適用する。
// typeが"stun"かつ対象がスタン抵抗中(stunResistTurns>0、直近でスタンされた直後)の場合は、
// 通常のstatusResistMultとは別枠でさらに大きく確率を下げる(連続スタンロック防止)
function resistedChance(target, baseChance, type) {
  let resist = (target.passives && target.passives.statusResistMult) || 0;
  // 温泉バフ「美肌」: 状態異常耐性+20%
  if (target.onsenBuffKey === "bihada") resist += 0.2;
  let chance = baseChance * (1 - resist);
  if (type === "stun" && target.stunResistTurns > 0) chance *= STUN_RESIST_MULT;
  return chance;
}

// スキルツリーの能動スキル(単体/範囲攻撃、バフ、回復など)を実行する汎用リゾルバ。
// target: 単体系はentity1体、範囲系(action.aoe)は配列
function useTreeSkill(actor, target, skill, log) {
  const action = skill.action;
  // 煙幕など: アイテムを消費して発動する技。MPが足りていても道具が無ければ発動できない(MP消費前に判定する)
  if (action.kind === "buffPartyConsumeItem" && (state.inventory[action.item] || 0) <= 0) {
    log(`${actor.label}は${(ITEMS[action.item] && ITEMS[action.item].ja) || "道具"}を持っていない！`);
    return { failed: true };
  }
  const cost = skillMpCost(actor, skill.mp);
  if (cost > 0) {
    if (actor.mp < cost) { log(`${actor.label}はMPが足りない！`); return { failed: true }; }
    const refund = actor.passives && Math.random() < actor.passives.mpRefundChance;
    if (!refund) actor.mp -= cost;
  }
  // コンボタグ: 特定の技(comboTagで印付け)を使った時点で、次の自分の1ターンだけ効果を得る受動を発動する
  // (連射の心得・式神召喚など)。actionの種類(damage/heal/buffSelf等)を問わず「使った」時点で一律に判定する
  if (skill.comboTag && actor.passives && actor.passives.comboFollowup && actor.passives.comboFollowup.length) {
    actor.passives.comboFollowup.forEach((f) => {
      if (f.tag === skill.comboTag) applyStatMod(actor, f.stat, f.mult, 2);
    });
  }
  // 変化の術: MP消費とコンボタグ判定だけここで済ませ、実際にどのformへ変身するかの選択とenterTransform()の
  // 呼び出しはindex.html側のUI(3択の表示)に任せる
  if (action.kind === "transform") return {};
  if (action.kind === "summonHawk") {
    if (actor.hawkTurnsLeft > 0) { log(`${actor.label}の鷹は既に出ている！`); return { failed: true }; }
    actor.hawkTurnsLeft = action.turns;
    actor.hawkGuardTargetId = null;
    log(`${actor.label}は鷹を呼び出した！`);
    return { summonedHawk: true };
  }
  // 心眼の構えなど: このターン限定で、敵の単体攻撃を1度だけ完全に無効化して反撃する(applyDamageToTarget側で消費・処理する)
  if (action.kind === "guardCounterSelf") {
    actor.nullifyCounterMult = action.mult || 0.8;
    actor.nullifyCounterTurnsLeft = 2; // 「次の自分の1ターンまで」を表す既存の慣習(連斬のonCritSelfBuffと同じturns:2)
    log(`${actor.label}は${skill.name}を構えた！`);
    return { buffed: true };
  }
  // 身代わりの術: 次に受ける攻撃を(全体攻撃を含め)完全に無効化する(applyDamageToTarget側で消費・処理する)
  if (action.kind === "shieldSelf") {
    actor.migawariShieldActive = true;
    log(`${actor.label}は${skill.name}を唱えた！`);
    return { buffed: true };
  }
  // 撒菱など: ターンを消費せずに敵全体へデバフを撒く
  if (action.kind === "debuffAllNoCost") {
    const pool = typeof targetableEnemies === "function" ? targetableEnemies() : [];
    pool.forEach((e) => applyStatMod(e, action.stat || "spd", 1 - (action.value || 0.3), action.turns || 3));
    log(`${actor.label}は${skill.name}を放った！`);
    return { aoeDebuffed: true, noCost: true };
  }
  // 影縫いなど: ターンを消費せずに敵単体を確定でスタンさせる
  if (action.kind === "stunNoCost") {
    if (Math.random() < resistedChance(target, action.chance != null ? action.chance : 1, "stun")) {
      applyStun(target, action.turns || 1);
      log(`${actor.label}は${target.label}を${skill.name}で縫い止めた！`);
      return { stunned: true, noCost: true };
    }
    log(`${target.label}は${actor.label}の${skill.name}をかわした！`);
    return { stunned: false, noCost: true };
  }
  if (action.kind === "buffSelf" || action.kind === "buffParty" || action.kind === "buffPartyConsumeItem" || action.kind === "buffPartyNoCost") {
    if (action.kind === "buffPartyConsumeItem") state.inventory[action.item]--;
    const targets = action.kind === "buffSelf" ? [actor] : target;
    targets.forEach((t) => {
      (action.stats || []).forEach((s) => applyStatMod(t, s.stat, s.mult, action.turns));
      if (action.hpRegenPct) applyStatMod(t, "hpRegenPct", action.hpRegenPct, action.turns); // effectiveStatでは使わず、tick時に直接参照する目印として保持
      if (action.cleanse) {
        t.poison = 0; t.burnTurns = 0; t.bleed = 0; t.stunTurns = 0; t.silenceTurns = 0;
        if (actor.passives && actor.passives.mpOnCleanse) actor.mp = Math.min(actor.maxMp, actor.mp + actor.passives.mpOnCleanse);
      }
      if (action.statusImmuneTurns) t.statusImmuneTurns = Math.max(t.statusImmuneTurns || 0, action.statusImmuneTurns);
      if (action.tauntTurns) t.tauntTurns = Math.max(t.tauntTurns || 0, action.tauntTurns);
    });
    log(`${actor.label}は${skill.name}を使った！`);
    return { buffed: true };
  }
  if (action.kind === "heal") {
    const targets = action.aoe ? target : [target];
    const heals = targets.map((t) => {
      const bonusMult = healBonusMultiplier(actor, t, !!action.cleanse);
      const heal = Math.round(applyOnsenHealBonus(t, Math.max(1, Math.round(t.maxHp * action.healPct))) * bonusMult);
      if (t.status === "critical" && action.reviveHpPct) {
        return { target: t, revived: true, heal: 0 };
      }
      t.hp = Math.min(t.maxHp, t.hp + heal);
      if (action.cleanse) {
        t.poison = 0; t.burnTurns = 0; t.bleed = 0; t.stunTurns = 0; t.silenceTurns = 0;
        if (actor.passives && actor.passives.mpOnCleanse) actor.mp = Math.min(actor.maxMp, actor.mp + actor.passives.mpOnCleanse);
      }
      log(`${actor.label}は${t.label}を${heal}回復！`);
      return { target: t, heal };
    });
    return { healed: heals };
  }
  // 乱れ斬り(改)など: 通常のhits>1(単体への連撃)とは別枠で、1振りごとに対象をランダムに選び直す
  // (targetは呼び出し元で選ばせず、targetableEnemies()から都度抽選する)
  if (action.kind === "damageRandomMulti") {
    const hits = action.hits || 3;
    const atkStat = action.useMag ? effectiveStat(actor, "mag") : effectiveStat(actor, "atk");
    const randomHits = [];
    for (let i = 0; i < hits; i++) {
      const pool = typeof targetableEnemies === "function" ? targetableEnemies() : [];
      if (!pool.length) break;
      const t = pool[Math.floor(Math.random() * pool.length)];
      if (!rollHit(actor, t, skillRangeType(actor, skill))) {
        log(`${t.label}は${actor.label}の${skill.name}をかわした！`);
        randomHits.push({ target: t, hit: false, dmg: 0, crit: false });
        continue;
      }
      const def = effectiveStat(t, "def") * (1 - (action.defPierce || 0));
      const rawHit = Math.max(1, Math.round(withVariance(atkStat * action.mult * mitigation(def, 15), 0.15)));
      const dmg = applyDamageToTarget(t, rawHit, log, actor.label, actor, null, null, null, action.useMag);
      randomHits.push({ target: t, hit: true, dmg, crit: lastHitWasCrit });
    }
    return { randomHits };
  }
  // selfReload: 砲術士の一部の技(貫通弾・一斉砲撃など)は、命中/回避に関わらず撃てば次の自分のターンは
  // 装填で動けなくなる(cannonShotと同じ仕様)。大威力の代わりに手数が落ちる、というトレードオフの表現
  if (action.selfReload) actor.reloading = true;
  // 守り槍など: 攻撃と同時に自分もかばう体勢に入る
  if (action.alsoGuard) { actor.guarding = true; actor.guardProtectCount = 0; }
  // ダメージ系(単体/範囲/連撃)。会心判定/被ダメージ軽減/覚悟等の一度きり効果/反撃はapplyDamageToTarget側で一括処理する
  const targets = action.aoe ? target : [target];
  const skillRange = skillRangeType(actor, skill);
  // hitChance: 通常のrollHit(相手の回避率で変動)を使わず、固定の命中率で判定したい技用
  // (痺れ矢・豪雨など、命中率とスタン率を独立した数値としてユーザーが明示指定したい場合に使う)
  const rolledHit = (t) => {
    if (action.guaranteedHit) return true;
    if (action.hitChance != null) return Math.random() < action.hitChance;
    return rollHit(actor, t, skillRange);
  };
  const results = targets.map((t) => {
    if (!rolledHit(t)) {
      log(`${t.label}は${actor.label}の${skill.name}をかわした！`);
      // 技が外れても鷹は独立して追撃する(全体攻撃は除く)
      const hawkTargetMiss = !action.aoe ? maybeHawkFollowup(actor, t, log) : null;
      return { hit: false, dmg: 0, crit: false, hawkTargetId: hawkTargetMiss ? hawkTargetMiss.instanceId : null };
    }
    // 「連突き」「二連射」のようなhits>1の技は、以前は合計ダメージを1回のapplyDamageToTargetに
    // まとめていたため見た目上は1回しか殴っていないように見えていた(ユーザー指摘により修正)。
    // 今はヒットごとに個別にapplyDamageToTargetを呼び、hitsList配列で1振りずつの結果を返す。
    // これにより呼び出し元(battle.js)がヒットごとに別々の攻撃モーション/ダメージポップアップ/
    // 鷹の追撃(狩人が鷹を出している間は1振りごとに鷹も追撃する)を再生できる
    const hits = action.hits || 1;
    const atkStat = action.useMag ? effectiveStat(actor, "mag") : effectiveStat(actor, "atk");
    const defPierce = action.defPierce || 0;
    const def = effectiveStat(t, "def") * (1 - defPierce);
    const hitsList = [];
    const hawkTargetIds = [];
    let totalDmg = 0;
    let anyCrit = false;
    // 単体対象の多段ヒット技(連突き/二連射)は、以前は各振りのログ行(ダメージ・鷹の追撃等)を
    // その場ですぐblogへ流していたため、VFXは振りごとに間を置いて再生されるのに文字ログだけ
    // 先に全部まとめて出てしまい「テキストが二連撃に見えない」というユーザー指摘があった。
    // 単体多段ヒットの時だけログを振りごとにhitLogLinesへ溜め、battle.js側でVFXと同じ
    // タイミングで1振りずつblogへ流すようにする(範囲技の乱舞はbattle.js側が個別ヒット演出に
    // 対応していないため、ログを溜めても流す場所が無く消えてしまう。従来通り即時ログのまま維持する)
    const deferHitLog = !action.aoe && hits > 1;
    for (let i = 0; i < hits; i++) {
      if (t.hp <= 0) break; // 既に倒している相手には残りの振りを空撃ちしない
      let rawHit = Math.max(1, Math.round(withVariance(atkStat * (action.mult / hits) * mitigation(def, 15), 0.15)));
      const hpPct = t.maxHp > 0 ? t.hp / t.maxHp : 1;
      if (action.executeBonus && hpPct <= action.executeBonus.belowPct) rawHit = Math.round(rawHit * action.executeBonus.mult);
      const hitLogLines = [];
      const hitLog = deferHitLog ? (msg) => hitLogLines.push(msg) : log;
      const dmg = applyDamageToTarget(t, rawHit, hitLog, actor.label, actor, null, null, null, action.useMag);
      const crit = lastHitWasCrit; // このヒット固有の会心判定を確保しておく(この後のデバフ付与処理はlastHitWasCritに影響しない)
      if (crit) anyCrit = true;
      totalDmg += dmg;
      // 全体攻撃には乗せない(全ての敵に追撃が入ると強すぎるため)。対象を倒していれば鷹は別の敵をランダムに狙う
      const hawkTarget = !action.aoe ? maybeHawkFollowup(actor, t, hitLog) : null;
      hitsList.push({ dmg, crit, logLines: hitLogLines });
      if (hawkTarget) hawkTargetIds.push(hawkTarget.instanceId);
    }
    if (action.inflict && Math.random() < resistedChance(t, action.inflict.chance, action.inflict.type)) {
      const izanamiBoost = consumeOmamoriIzanami(actor) ? 2 : 0;
      if (action.inflict.type === "poison") applyPoison(t, resolveValue(action.inflict, 3) + izanamiBoost);
      if (action.inflict.type === "bleed") applyBleed(t, resolveValue(action.inflict, 2) + izanamiBoost);
      if (action.inflict.type === "burn") applyBurn(t, action.inflict.turns || 3);
      if (action.inflict.type === "stun") applyStun(t, action.inflict.turns || 1);
      if (action.inflict.type === "silence") applySilence(t, action.inflict.turns || 2);
      if (action.inflict.type === "atkDown") applyStatMod(t, "atk", 1 - (action.inflict.value || 0.2), action.inflict.turns || 3);
      if (action.inflict.type === "defDown") applyStatMod(t, "def", 1 - (action.inflict.value || 0.2), action.inflict.turns || 3);
      if (action.inflict.type === "spdDown") applyStatMod(t, "spd", 1 - (action.inflict.value || 0.2), action.inflict.turns || 3);
      if (action.inflict.type === "dmgTakenUp") applyStatMod(t, "dmgTaken", 1 + (action.inflict.value || 0.1), action.inflict.turns || 3);
      // 迅雷突き/鎧砕きなど: 使うたびに防御デバフが蓄積する(maxStacksで頭打ち)
      if (action.inflict.type === "defDownStack") applyStackingStatMod(t, "spearDefDownStack", "def", -(action.inflict.value || 0.2), action.inflict.maxStacks || 2, action.inflict.turns || 3);
    }
    const shotDown = maybeShootDown(actor, t);
    return { hit: true, dmg: totalDmg, shotDown, crit: anyCrit, hawkTargetId: hawkTargetIds[0] || null, hits: hitsList, hawkTargetIds };
  });
  return { dmgs: results };
}

// 現在のフロアに応じて敵を1体抽選する(内部用)。深さによる強さの違いはENEMIESの4段階ティア
// (序盤/中盤/後半/終盤)に任せており、階層に応じて変動する倍率は持たない。hp/atk/defは
// 全てENEMIES側に実戦でそのまま使う最終値として直接書かれている。
// onlyBoss=trueの場合はそのフロアで出現可能なボスだけに絞る(ボスフロアで確実にボスを出すため)
// mode: true(旧onlyBossの後方互換) = ボスのみ、"swarm" = 大群系のみ、それ以外 = 通常(大群系は除外。
// 大群系はpickEncounterForFloorの枠抽選経由でのみ出す)
// 大技が来るまでの残りターン数を、敵ごとの間隔設定(bigAttackCycle: {avg, variance, instant}、
// data.js側で敵ごとに個別指定。未設定なら全敵共通デフォルトBIG_ATTACK_CYCLE_LENGTHの固定間隔)から
// 1回分だけ抽選する。avg±variance(最低1)の範囲でランダムな間隔を選び、そこから「発動ターン自体」の
// 1を引いた値がカウントダウンの初期値になる(残り1で予告、残り0で発動)
function rollBigAttackCountdown(def) {
  const cfg = def && def.bigAttackCycle;
  const avg = cfg && cfg.avg != null ? cfg.avg : BIG_ATTACK_CYCLE_LENGTH;
  const variance = (cfg && cfg.variance) || 0;
  const lo = Math.max(1, avg - variance);
  const hi = Math.max(lo, avg + variance);
  const interval = lo + Math.floor(Math.random() * (hi - lo + 1));
  return interval - 1;
}
// ENEMIESカタログの素の1体(pick)から、実際の戦闘インスタンス(instanceId付与)を作る。
// hp/atk/defは全てENEMIES側に「実戦でそのまま使う最終値」として直接書かれているため、
// ここでの追加スケーリングは一切行わない(旧ENEMY_SCALE等の倍率は廃止し、生値へ織り込み済み)。
// 通常抽選(pickEnemyForFloor)と、緊急依頼専用の狙い撃ちスポーン(instantiateEnemyById)の両方から使う共通処理
function instantiateEnemy(pick) {
  const hp = pick.hp;
  // bigAttackCycle.instant指定の敵は、遭遇後いきなり最初のターンで大技が来る(予告無しの奇襲)。
  // それ以外は通常通りサイクル間隔を1回抽選し、さらにその中でランダムな初期位相にずらす
  // (同種の敵が複数体並んだ時に全員が同時に予告/発動して見えるのを防ぐため)
  const instant = pick.bigAttackCycle && pick.bigAttackCycle.instant;
  const initialCountdown = instant ? 0 : Math.floor(Math.random() * (rollBigAttackCountdown(pick) + 1));
  return {
    ...pick,
    instanceId: "e" + __enemySeq++,
    label: pick.ja,
    hp,
    maxHp: hp,
    bigAttackCountdown: initialCountdown,
    bigAttackPending: false,
  };
}
// 緊急依頼の対象など、通常の階層抽選を経由せず特定の種族idを名指しでスポーンさせる時に使う
function instantiateEnemyById(id) {
  const pick = ENEMIES[id];
  return pick ? instantiateEnemy(pick) : null;
}
// 新規ステージ(廃城下町/門/古城等)は敵データを実装するまでの間、戦闘発生率を強制的に0にするための
// 判定用ヘルパー(dungeon.jsのrollEncounter参照)。ENEMIESに該当stageの敵が1体でも登録されたら
// 自動的に通常通り戦闘が発生するようになる(このヘルパー自体の変更は不要)
function stageHasEnemies(stage) {
  return Object.values(ENEMIES).some((e) => (e.stage || "forest") === (stage || "forest"));
}
function pickEnemyForFloor(floor, mode, stage) {
  const eligible = Object.values(ENEMIES).filter((e) => {
    if ((e.stage || "forest") !== (stage || "forest")) return false;
    if (floor < e.minFloor || floor > e.maxFloor) return false;
    if (e.questOnly) return false; // 緊急依頼専用の敵は通常の階層抽選には出ない(instantiateEnemyByIdからのみ出す)
    if (mode === true) return !!e.isBoss;
    if (mode === "swarm") return !!e.isSwarm;
    return !e.isSwarm;
  });
  if (mode === true && eligible.length === 0) return null;
  const weighted = [];
  eligible.forEach((e) => {
    const weight = e.isBoss ? (floor % 15 === 0 ? 6 : 1) : 10;
    for (let i = 0; i < weight; i++) weighted.push(e);
  });
  const pick = weighted[Math.floor(Math.random() * weighted.length)];
  return instantiateEnemy(pick);
}

// ボス追撃モード(dungeon.js)を見送って(捕まえずに)遠征を終えた時、その時点のHPをここに記録する。
// state.woundedBosses = { [enemyId]: { hp, maxHp, fledAtMinutes } }。時間経過で少しずつ回復し
// (1時間につき最大HPの2%)、完全回復したら記録を消して通常の満タンHP出現に戻る。stateに保存する
// ことで、アプリを閉じて後日再開した場合でも「実際の経過時間ぶん回復している」状態が維持される
const BOSS_WOUND_HEAL_PER_HOUR_RATIO = 0.02;
function woundedBossCurrentHp(enemyId, maxHp) {
  const w = state.woundedBosses && state.woundedBosses[enemyId];
  if (!w) return null;
  const elapsedHours = Math.max(0, (absoluteGameMinutes() - w.fledAtMinutes) / 60);
  const healed = w.hp + elapsedHours * BOSS_WOUND_HEAL_PER_HOUR_RATIO * w.maxHp;
  if (healed >= w.maxHp) {
    delete state.woundedBosses[enemyId];
    return null; // 完全回復。記録を消し、通常通り満タンHPで出現させる
  }
  return Math.min(maxHp, Math.round(healed));
}
// そのフロアの遭遇を組み立てる。ボスフロア(15の倍数、階層1.5倍化に伴い10→15)は必ず単体。
// それ以外は、まず「大群が絡むか」を1回だけ判定し(SWARM_ENCOUNTER_CHANCE)、絡む場合は
// pickSwarmInvolvedEncounterで直接まとめて組み立てる(3枠それぞれ独立に大群判定すると、
// 6体まで揃う確率が0.15^3のようにほぼ0まで潰れてしまうため、複数回のサイコロを重ねる設計を避けた)。
// 絡まない場合は従来通り1〜3体の通常敵のみ。
// 雑魚集団は範囲攻撃(魔法使いのメテオ/忍者の乱れ突き)で効率よく削れる、という職業差別化の要
function pickEncounterForFloor(floor, stage) {
  // 洞窟はまだボス個体を用意していないため、15の倍数フロアでも通常のボスフロア判定(必ず単体)は適用しない
  // (ユーザー指示、2026-07-19)。将来ここに洞窟専用ボスを置く時に外す想定
  if (floor % 15 === 0 && stage !== "cave") {
    const boss = pickEnemyForFloor(floor, true, stage);
    if (boss) {
      const woundedHp = woundedBossCurrentHp(boss.id, boss.maxHp);
      if (woundedHp != null) boss.hp = woundedHp; // 見送った手負いのまま(回復途中なら回復途中のHPで)再出現させる
    }
    return [boss || pickEnemyForFloor(floor, undefined, stage)];
  }
  const hasSwarmHere = Object.values(ENEMIES).some((e) => (e.stage || "forest") === (stage || "forest") && e.isSwarm && floor >= e.minFloor && floor <= e.maxFloor);
  if (hasSwarmHere && Math.random() < SWARM_ENCOUNTER_CHANCE) {
    return applyGroupNerf(pickSwarmInvolvedEncounter(floor, stage));
  }
  const roll = Math.random();
  let count = 1;
  if (floor >= 6) { // 複数体出現の解禁階も階層1.5倍化に合わせて4→6
    if (roll < 0.45) count = 1;
    else if (roll < 0.8) count = 2;
    else count = 3;
  }
  const enemies = [];
  for (let i = 0; i < count; i++) {
    const e = pickEnemyForFloor(floor, undefined, stage);
    if (e.isBoss) return [e]; // ボス個体が紛れたら単体に差し戻す
    enemies.push(e);
  }
  return applyGroupNerf(enemies);
}

// 大群が絡むと決まった時の中身。65%は「大群のみ3〜6体」(6体の内訳20%=大群絡み全体の13%≒毎回の1.95%程度)、
// 35%は「通常1〜2体+大群2体」の混成にする
function pickSwarmInvolvedEncounter(floor, stage) {
  const enemies = [];
  if (Math.random() < 0.65) {
    const roll = Math.random();
    let swarmCount;
    if (roll < 0.15) swarmCount = 3;
    else if (roll < 0.5) swarmCount = 4;
    else if (roll < 0.8) swarmCount = 5;
    else swarmCount = 6;
    for (let i = 0; i < swarmCount; i++) enemies.push(pickEnemyForFloor(floor, "swarm", stage));
  } else {
    const normalCount = Math.random() < 0.5 ? 1 : 2;
    for (let i = 0; i < normalCount; i++) {
      const e = pickEnemyForFloor(floor, undefined, stage);
      if (!e.isBoss) enemies.push(e); // ボスが紛れたらこの枠は諦める(滅多に起きない)
    }
    for (let i = 0; i < 2; i++) enemies.push(pickEnemyForFloor(floor, "swarm", stage));
  }
  return enemies;
}

// 頭数が多いほど、行動回数(=敵側の総攻撃回数)が増えて理不尽にならないよう1体あたりの数値を弱める
function applyGroupNerf(enemies) {
  if (enemies.length > 1) {
    const nerfTable = { 2: 0.8, 3: 0.65, 4: 0.55, 5: 0.48, 6: 0.42 };
    const nerf = nerfTable[enemies.length] || 0.4;
    enemies.forEach((e) => {
      e.hp = Math.max(1, Math.round(e.hp * nerf));
      e.maxHp = e.hp;
      e.atk = Math.max(1, Math.round(e.atk * nerf));
    });
  }
  return enemies;
}

const TRASH_MOB_GOLD_MULT = 0.9; // 雑魚(非ボス)戦のゴールド報酬を10%ナーフ。ボスはそのまま
function goldReward(enemy) {
  const base = enemy.goldMin + Math.floor(Math.random() * (enemy.goldMax - enemy.goldMin + 1));
  return enemy.isBoss ? base : Math.round(base * TRASH_MOB_GOLD_MULT);
}

// 素早さが高いほど回避率が上がる(敵にはfatigueが無いので疲労減衰の影響は受けない)。
// 逃走準備中(fleeState==="preparing")は、逃げ出そうと隙を伺っている分+25%回避率が上がる
function evasionChance(entity) {
  const spd = effectiveStat(entity, "spd");
  const base = Math.max(0, Math.min(EVASION_MAX, (spd - EVASION_SPD_BASELINE) * EVASION_SPD_FACTOR));
  const passiveAdd = (entity.passives && entity.passives.evasionAdd) || 0;
  let timedAdd = 0;
  if (entity.statMods) entity.statMods.forEach((m) => { if (m.stat === "evasionAdd") timedAdd += m.mult; });
  // HP割合条件つきの回避ボーナス(見切りなど)
  let condAdd = 0;
  if (entity.passives && entity.passives.conditionalMods && entity.passives.conditionalMods.length) {
    activeConditionalMods(entity).forEach((m) => { if (m.evasionAdd) condAdd += m.evasionAdd; });
  }
  // 状態フラグ条件つきの回避ボーナス(flagModsのうちstat==="evasionAdd"のもの、加算方式)
  if (entity.passives && entity.passives.flagMods) {
    entity.passives.flagMods.forEach((fm) => { if (fm.stat === "evasionAdd" && entity[fm.flag]) condAdd += fm.mult; });
  }
  const fleeingAdd = entity.fleeState === "preparing" ? 0.25 : 0;
  const flyingAdd = entity.isFlying ? FLYING_EVASION_BONUS : 0; // 飛行(🪽)の敵は空中にいる分、素早さ由来の回避率とは別に+5%
  // 忍足など: その戦闘で初めて敵に攻撃を受けるまで回避率が上がる(hasBeenHitThisBattleはapplyDamageToTarget側で実際に被弾した時に立てる)
  const preFirstHitAdd = entity.passives && entity.passives.preFirstHitEvasionAdd && !entity.hasBeenHitThisBattle ? entity.passives.preFirstHitEvasionAdd : 0;
  return Math.min(0.9, base + passiveAdd + timedAdd + condAdd + fleeingAdd + flyingAdd + preFirstHitAdd);
}
function accuracyOf(entity, target) {
  const base = entity.accuracy != null ? entity.accuracy : BASE_ACCURACY;
  let addTotal = (entity.passives && entity.passives.accuracyAdd) || 0;
  if (entity.statMods) entity.statMods.forEach((m) => { if (m.stat === "accuracyAdd") addTotal += m.mult; });
  // 対象のHP割合条件つき命中率ボーナス(弱点看破など)
  if (entity.passives && entity.passives.executeAccuracyBonus && target && target.maxHp > 0) {
    const b = entity.passives.executeAccuracyBonus;
    const hpPct = target.hp / target.maxHp;
    const matched = (b.cmp || "lte") === "lte" ? hpPct <= b.belowPct : hpPct >= b.belowPct;
    if (matched) addTotal += b.addRate;
  }
  return Math.min(0.99, base + addTotal);
}
// 近接/遠距離攻撃の判定。侍・忍者・槍士・薙刀士・僧侶・陰陽師の通常攻撃は近接、狩人・砲術士の
// 通常攻撃/スキルと陰陽師の魔法(呪符ノ術等)は遠距離。個別スキルにrangeTypeがあれば最優先で従う
// (忍者のスタン手裏剣など、クラスの既定と逆になる例外用)
const RANGED_NORMAL_ATTACK_CLASSES = new Set(["hunter", "gunner"]);
const RANGED_TREE_SKILL_CLASSES = new Set(["hunter", "gunner", "onmyoji"]);
const ABILITY_RANGE_TYPE = {
  magicAttack: "ranged", magicAttackAll: "ranged", // 陰陽師の魔法
  critAttack: "melee", powerAttack: "melee", physicalAttackAll: "melee", // 侍/忍者/薙刀士
  preciseShot: "ranged", cannonShot: "ranged", // 狩人/砲術士
};
function normalAttackRangeType(actor) {
  return RANGED_NORMAL_ATTACK_CLASSES.has(actor.classId) ? "ranged" : "melee";
}
function skillRangeType(actor, skill) {
  if (skill.rangeType) return skill.rangeType;
  return RANGED_TREE_SKILL_CLASSES.has(actor.classId) ? "ranged" : "melee";
}
// 飛行(🪽)の敵に対しては近接攻撃の命中率が下がる(遠距離攻撃は影響なし)
const FLYING_MELEE_ACCURACY_PENALTY = 0.25;
const FLYING_EVASION_BONUS = 0.05; // 飛行の敵自身の回避率+5%(素早さ由来の回避とは別枠、遠距離攻撃にも効く)
const FLYING_MIN_HIT_CHANCE = 0.10; // 通常のMIN_HIT_CHANCEより低い専用の下限(飛行を狙い撃ちする近接が機能しなくなりすぎないよう最低限だけ確保)
// 狩人/砲術士が飛行の敵に攻撃を命中させた時、この確率で「撃ち落とす」(以後isFlyingが解除され近接も当てやすくなる)
const SHOOT_DOWN_CHANCE = 0.8;
function canTriggerShootDown(actor) {
  return actor.classId === "hunter" || actor.classId === "gunner";
}
function maybeShootDown(actor, target) {
  if (!canTriggerShootDown(actor) || !target.isFlying) return false;
  if (Math.random() >= SHOOT_DOWN_CHANCE) return false;
  target.isFlying = false;
  applyStun(target, 1); // 撃ち落とした敵は1ターンだけ地に落ちて怯む(スタン)
  return true;
}
// 命中判定。相手の回避率でどれだけ削られてもMIN_HIT_CHANCE未満にはならない(かわされ過ぎるストレスを避けるため)。
// スキルツリーの「完全回避」系受動(見切り・分身など)は、この命中率とは別枠の追加判定として先に効く
function rollHit(actor, target, rangeType) {
  let dodge = (target.passives && target.passives.dodgeChance) || 0;
  if (target.statMods) target.statMods.forEach((m) => { if (m.stat === "dodgeChance") dodge += m.mult; });
  if (dodge > 0 && Math.random() < dodge) return false;
  let chance = Math.max(MIN_HIT_CHANCE, Math.min(0.99, accuracyOf(actor, target) - evasionChance(target)));
  // 修羅刃など: 敵を倒した直後の1回だけ、次に受ける攻撃への回避率が上がる(蓄積しない、この1回のロールで消費する)
  if (target.onKillEvasionBonusActive) {
    chance = Math.max(MIN_HIT_CHANCE, chance - (target.passives && target.passives.onKillEvasionBonus || 0));
    target.onKillEvasionBonusActive = false;
  }
  if (rangeType === "melee" && target.isFlying) chance = Math.max(FLYING_MIN_HIT_CHANCE, chance - FLYING_MELEE_ACCURACY_PENALTY);
  return Math.random() < chance;
}

// ダメージ技共通: 外れたら回避ログだけ出してダメージ無しで返す。rangeTypeは"melee"/"ranged"(飛行の敵への
// 命中率補正・撃ち落としの判定に使う)。shotDown: 狩人/砲術士が飛行の敵に命中させた時、確率で🪽を解除する
function rollAttackOrMiss(actor, target, rollFn, log, extraCritRate, rangeType, isMagic) {
  if (!rollHit(actor, target, rangeType)) {
    log(`${target.label}は${actor.label}の攻撃をかわした！`);
    const hawkTarget = maybeHawkFollowup(actor, target, log); // 本体の攻撃が外れても鷹は独立して追撃する
    return { hit: false, dmg: null, crit: false, hawkTargetId: hawkTarget ? hawkTarget.instanceId : null };
  }
  const dmg = applyDamageToTarget(target, rollFn(), log, actor.label, actor, null, extraCritRate, null, isMagic);
  const crit = lastHitWasCrit; // このヒット固有の会心判定(直後にshotDown等の別処理でlastHitWasCritが上書きされる前に確保する)
  const shotDown = maybeShootDown(actor, target);
  const hawkTarget = maybeHawkFollowup(actor, target, log); // 対象を倒していれば、鷹は別の生存中の敵をランダムに狙う
  return { hit: true, dmg, shotDown, crit, hawkTargetId: hawkTarget ? hawkTarget.instanceId : null };
}
// 範囲技共通: 対象ごとに個別に命中判定する
function rollAoeAttack(actor, targets, rollFn, log, rangeType, isMagic) {
  const hits = [];
  const dmgs = [];
  const shotDowns = [];
  const crits = [];
  targets.filter((t) => t.hp > 0).forEach((t) => {
    if (!rollHit(actor, t, rangeType)) {
      log(`${t.label}は${actor.label}の攻撃をかわした！`);
      hits.push(false);
      dmgs.push(null);
      shotDowns.push(false);
      crits.push(false);
      return;
    }
    const dmg = applyDamageToTarget(t, rollFn(t), log, actor.label, actor, null, null, null, isMagic);
    hits.push(true);
    dmgs.push(dmg);
    crits.push(lastHitWasCrit); // 対象ごとに個別記録(AOEの各ヒットで会心の有無が異なりうるため)
    shotDowns.push(maybeShootDown(actor, t));
  });
  return { hits, dmgs, shotDowns, crits };
}

// 狩人「貫き矢」パッシブ: 通常攻撃で対象を倒した時、余ったダメージ(overkill分)を「残りHPが一番低い」
// 別の生存中の敵にそのまま分け与える(ランダムだとフルHPの敵に飛んで無駄になることがあったため、
// 瀕死の敵を巻き込んで連鎖処刑する狙い撃ちにしてある)。会心判定やonHitInflict等は敵を倒した本体の
// 一撃だけのものなので、貫通側では再判定せず素の数値のまま流し込む(defensiveなdamageTakenMultiplier
// だけは対象自身の効果として尊重する)。貫通は最大2体まで、そこから先には連鎖しない(splashTarget自身が
// 倒れても再帰しない)。target.__enemyAllies はstartBattle()で敵全員に配られる、その戦闘の敵配列への自己参照
function applyOverkillPierce(target, hpBeforeHit, dmg, log, actor) {
  if (target.hp > 0) return;
  const overkill = dmg - hpBeforeHit;
  if (overkill <= 0 || !target.__enemyAllies) return;
  const others = target.__enemyAllies.filter((e) => e !== target && e.hp > 0);
  if (others.length === 0) return;
  const splashTarget = others.reduce((lowest, e) => (e.hp < lowest.hp ? e : lowest), others[0]);
  const splashDmg = Math.max(0, Math.round(overkill * damageTakenMultiplier(splashTarget)));
  splashTarget.hp = Math.max(0, splashTarget.hp - splashDmg);
  log(`貫通した一撃が${splashTarget.label}に${splashDmg}ダメージ！`);
  if (splashTarget.hp <= 0 && actor) lastEnemyKillActor = actor;
}
function performAttack(actor, target, log) {
  // 出血中の対象かどうかは攻撃前(=この攻撃自身の効果が乗る前)の状態で判定する
  const wasBleeding = (target.bleed || 0) > 0;
  const hpBeforeHit = target.hp; // 貫き矢(通常攻撃のオーバーキル貫通)判定用
  const result = rollAttackOrMiss(actor, target, () => rollBasicAttack(effectiveStat(actor, "atk"), target.def), log, undefined, normalAttackRangeType(actor));
  // ヘビに変身中は、通常攻撃が命中すると確実に毒3を付与する
  if (result.hit && actor.transformForm === "hebi") applyPoison(target, 3);
  // 狩人「追い討ち」: 出血中の敵への通常攻撃が命中すると、出血スタックを3追加する
  if (result.hit && wasBleeding && actor.passives && actor.passives.bleedFollowupOnHit && target.hp > 0) applyBleed(target, 3);
  // 狩人「貫き矢」: 通常攻撃で敵を倒した時だけ発動する(ダメージ倍率は据え置き、通常攻撃そのものは強化しない)
  if (result.hit && actor.passives && actor.passives.overkillPierce) applyOverkillPierce(target, hpBeforeHit, result.dmg, log, actor);
  return result;
}

// 直近で敵を倒した攻撃者(全滅時のセリフ抽選で「最後に倒した人物」を優先させるために使う)
let lastEnemyKillActor = null;
// 直近のapplyDamageToTargetで会心が発動したか(index.html側で被弾演出の揺れの強さを決めるのに使う)
let lastHitWasCrit = false;
// 直近のapplyDamageToTargetで狩人の鷹の追撃が発動したか(battle.js側で追撃演出を出すかどうかの判定に使う)
let lastHawkFollowupHappened = false;
// 「傷口狙い」系の受動効果が参照する、対象が何らかの状態異常を負っているかどうかの判定。
// 毒/炎上/スタン/沈黙に加え、能力低下(捕縛・崩しなどのstatMods、mult<1のもの)も対象に含める
function hasStatusAilment(target) {
  if ((target.poison || 0) > 0) return true;
  if ((target.burnTurns || 0) > 0) return true;
  if ((target.bleed || 0) > 0) return true;
  if ((target.stunTurns || 0) > 0) return true;
  if ((target.silenceTurns || 0) > 0) return true;
  if (target.statMods && target.statMods.some((m) => m.mult < 1)) return true;
  return false;
}
// woundBonus系の一部スキルは「状態異常全般」ではなく特定の状態異常(炎上/毒/スタン/能力低下)だけを
// 対象にしたい場合があるため、typeを指定できる版を用意する(type未指定ならhasStatusAilmentと同じ)
function hasSpecificAilment(target, type) {
  if (!type) return hasStatusAilment(target);
  if (type === "poison") return (target.poison || 0) > 0;
  if (type === "burn") return (target.burnTurns || 0) > 0;
  if (type === "bleed") return (target.bleed || 0) > 0;
  if (type === "stun") return (target.stunTurns || 0) > 0;
  if (type === "debuff") return !!(target.statMods && target.statMods.some((m) => m.mult < 1));
  return hasStatusAilment(target);
}
// 対象の指定ステータス(atk/def/spd)に、現在有効なデバフ(mult<1のstatMod)が乗っているかどうか。
// 隙討ち・拍子外し・弱者狩り・衰弱撃ちなど、誰がデバフを与えたかを問わない会心率ボーナス系が使う
function hasStatDebuff(target, stat) {
  return !!(target.statMods && target.statMods.some((m) => m.stat === stat && m.mult < 1));
}
// 状態異常の「種類数」(毒/炎上/出血/スタン/沈黙/能力低下のいずれか、最大6種)を数える。
// hasStatusAilmentの発展形で、単発の有無だけでなく「何種類重なっているか」を見て、複数クラスの
// 状態異常が揃うほど強くなるダメージボーナス(百鬼断・急所連撃・気枯らしの術など)に使う
function countDistinctAilments(target) {
  let n = 0;
  if ((target.poison || 0) > 0) n++;
  if ((target.burnTurns || 0) > 0) n++;
  if ((target.bleed || 0) > 0) n++;
  if ((target.stunTurns || 0) > 0) n++;
  if ((target.silenceTurns || 0) > 0) n++;
  if (target.statMods && target.statMods.some((m) => m.mult < 1)) n++;
  return n;
}
// 自分以外の生存中の仲間が、今かばっているかどうか(連携の呼吸・援護薙ぎ・護りの薙刀など、
// 「誰かがかばっている間」系のスキルが参照する)。__alliesはstartBattle()で全プレイヤーキャラに
// 配られる自パーティ全体への参照(index.html側)で、これを辿ることでengine.js単体では
// 本来アクセスできない「他の味方の状態」を、このフック専用に安全に参照できるようにしている
function anyOtherAllyGuarding(entity) {
  if (!entity.__allies) return false;
  return entity.__allies.some((c) => c !== entity && c.status === "active" && c.guarding);
}
// ダメージ適用の共通処理。会心判定/被ダメージ軽減/一度だけの生存効果(覚悟・空蝉)/反撃(迎撃)を
// ここでまとめて処理し、最終的に与えたダメージ量を返す。ログは「静香は鬼火に50ダメージ！」の1行のみ(技名などの装飾は付けない)
function applyDamageToTarget(target, dmg, log, actorLabel, actor, logSuffix, extraCritRate, bigAttackName, isMagic) {
  logSuffix = logSuffix || "";
  // 狩人「鷹を呼ぶ」の「味方を守れ」: 敵からの攻撃に限り、鷹が庇っている対象なら身代わりになって消滅する
  if (actor && actor.instanceId !== undefined && target.__allies) {
    const hawkOwner = target.__allies.find((c) => c.hawkGuardTargetId === target.id && c.hawkTurnsLeft > 0);
    if (hawkOwner) {
      hawkOwner.hawkTurnsLeft = 0;
      hawkOwner.hawkGuardTargetId = null;
      log(`${hawkOwner.label}の鷹が${target.label}をかばって消えた！`);
      return 0;
    }
  }
  // 身代わりの術: 次に受ける攻撃を(全体攻撃を含め)完全に無効化する。反撃は無い、心眼の構えとは別枠
  if (actor && target.migawariShieldActive) {
    target.migawariShieldActive = false;
    log(`${target.label}は${actorLabel}の攻撃を身代わりの術で無効化した！`);
    return 0;
  }
  // 心眼の構えなど: 「このターン」限定で、敵の攻撃を1度だけ完全に無効化してその場で反撃する
  if (actor && target.nullifyCounterTurnsLeft > 0) {
    const counterMult = target.nullifyCounterMult || 0.8;
    target.nullifyCounterTurnsLeft = 0;
    target.nullifyCounterMult = null;
    const counterDmg = Math.max(1, Math.round(effectiveStat(target, "atk") * counterMult - effectiveStat(actor, "def") * 0.5));
    actor.hp = Math.max(0, actor.hp - counterDmg);
    log(`${target.label}は${actorLabel}の攻撃を完全に無効化した！`);
    log(`${target.label}は${counterDmg}ダメージで反撃した！`);
    return 0;
  }
  if (actor && actor.passives && actor.passives.firstAttackBonusMult > 0 && !actor.passives.firstAttackUsed) {
    dmg = Math.round(dmg * (1 + actor.passives.firstAttackBonusMult));
    actor.passives.firstAttackUsed = true;
  }
  // 霊力弱点(ENEMY_WEAKNESS type:"spirit"): 実体を持たない敵は、魔力によるダメージ(陰陽師の呪符系・
  // useMag指定のスキル)にだけ被ダメージが1.5倍になる。物理攻撃には乗らない
  if (isMagic && enemyWeaknessType(target, "spirit")) dmg = Math.round(dmg * SPIRIT_WEAKNESS_DMG_MULT);
  // 常時発動の低HP追撃系の受動効果(暗殺術など): 対象のHPが閾値以下なら全ての攻撃にダメージ加算がかかる
  if (actor && actor.passives && actor.passives.executeBonus) {
    const hpPct = target.maxHp > 0 ? target.hp / target.maxHp : 1;
    if (hpPct <= actor.passives.executeBonus.belowPct) dmg = Math.round(dmg * actor.passives.executeBonus.mult);
  }
  // 傷口狙い系の受動効果: 対象が(指定があれば特定の、無ければ何らかの)状態異常を負っていれば追加ダメージ。
  // 同じクラスが複数持てるよう配列全部をチェックして掛け合わせる
  if (actor && actor.passives && actor.passives.woundBonuses && actor.passives.woundBonuses.length) {
    actor.passives.woundBonuses.forEach((wb) => {
      if (hasSpecificAilment(target, wb.ailment)) dmg = Math.round(dmg * wb.mult);
    });
  }
  // 複合デバフ系の受動効果: 対象に乗っている状態異常の「種類数」に応じてダメージが伸びる(百鬼断・急所連撃・気枯らしの術など)
  if (actor && actor.passives && actor.passives.stackedWoundBonusPerAilment > 0) {
    const ailmentCount = countDistinctAilments(target);
    if (ailmentCount > 0) dmg = Math.round(dmg * (1 + actor.passives.stackedWoundBonusPerAilment * ailmentCount));
  }
  // 自分以外の仲間がかばっている間の与ダメージ倍率(援護薙ぎ・援護砲撃など)
  if (actor && actor.passives && actor.passives.allyGuardDmgMult !== 1 && anyOtherAllyGuarding(actor)) {
    dmg = Math.round(dmg * actor.passives.allyGuardDmgMult);
  }
  lastHitWasCrit = false;
  if (actor) {
    const critMult = rollCritMultiplier(actor, extraCritRate, target);
    dmg = Math.round(dmg * critMult);
    lastHitWasCrit = critMult > 1;
    // 会心を出した直後、次の自分の1ターンだけ効果を得る受動(連斬など)。turns:2は「tickが自分の手番開始時に
    // 先に走る」仕様上、mid-action付与で"次の1ターンだけ"にするための必要値(reloadImmune等と同じ考え方)
    if (lastHitWasCrit && actor.passives && actor.passives.onCritSelfBuff) {
      const b = actor.passives.onCritSelfBuff;
      applyStatMod(actor, b.stat, b.mult, 2);
    }
    // 仲間が会心を出した直後、次の自分の1ターンだけ会心率が上がる受動(闘志など)
    if (lastHitWasCrit && actor.__allies) {
      actor.__allies.forEach((ally) => {
        if (ally !== actor && ally.status === "active" && ally.passives && ally.passives.allyCritSelfCritBuff) {
          applyStatMod(ally, "critRateAdd", ally.passives.allyCritSelfCritBuff, 2);
        }
      });
    }
  }
  // 自分より素早い相手から受けるダメージを軽減する受動(疾風など)。actorは攻撃側なので、
  // 敵からの攻撃(actor=敵)・味方からの攻撃(actor=味方)どちらでも同じロジックで比較できる
  if (target.passives && target.passives.fasterFoeDmgReduction && actor && effectiveStat(actor, "spd") > effectiveStat(target, "spd")) {
    dmg = Math.round(dmg * (1 - target.passives.fasterFoeDmgReduction));
  }
  // 大技の構え中(bigAttackPending)の敵は隙だらけとみなし、受けるダメージが増える(押し切る対抗策)
  if (target.bigAttackPending) dmg = Math.round(dmg * BIG_ATTACK_EXPOSED_BONUS);
  dmg = Math.max(0, Math.round(dmg * damageTakenMultiplier(target)));
  if (target.passives && target.passives.onceGuardType === "nullifyDamage" && !target.passives.onceGuardUsed) {
    target.passives.onceGuardUsed = true;
    log(`${target.label}は${actorLabel}の攻撃を完全に無効化した！`);
    return 0;
  }
  // 毘沙門天の御守: 戦闘開始時にランダムな味方一人へ配られるバリア(1回だけ攻撃を完全無効化)
  if (target.passives && target.passives.omamoriBishamonPending) {
    target.passives.omamoriBishamonPending = false;
    log(`${target.label}は毘沙門天の御守の加護で攻撃を完全に無効化した！`);
    return 0;
  }
  // 忍足など: 実際にダメージを受けた(=無効化されなかった)時点で「初めて攻撃を受けた」扱いにする
  if (actor && dmg > 0) target.hasBeenHitThisBattle = true;
  const lethal = target.hp - dmg <= 0;
  // 阿修羅突きなど: 「HPが満タンの敵」の判定はダメージを引く前の時点で見る(このダメージ自体で減った後では
  // 満タンでなくなってしまい絶対に発動しなくなるため)
  const wasFullHpBeforeThisHit = target.hp >= target.maxHp;
  // 大技のダメージ行は「Aの技名！Bは◯ダメージ！」の1行にまとめる(以前は「Aが技名を放った！」を
  // 別行で先に出していたが、ユーザー指示により統合した)。通常攻撃/技はこれまで通り「AはBに◯ダメージ！」のまま
  const dmgLine = bigAttackName ? `${actorLabel}の${bigAttackName}！${target.label}は${dmg}ダメージ${logSuffix}！` : `${actorLabel}は${target.label}に${dmg}ダメージ${logSuffix}！`;
  // おみくじ「大吉」: パーティ全員で共有する1回だけの致命傷耐え(同じオブジェクト参照を
  // 全員のpassivesに配っておくことで、誰が最初に致命傷を受けても消費は1回だけになる)
  if (lethal && target.passives && target.passives.sharedSurviveFatal && !target.passives.sharedSurviveFatal.used) {
    target.passives.sharedSurviveFatal.used = true;
    target.hp = 1;
    log(dmgLine);
    log(`${target.label}はお守りの力で致命傷をこらえた！`);
  } else if (lethal && target.passives && target.passives.omamoriSharedSurviveFatal && !target.passives.omamoriSharedSurviveFatal.used) {
    // 須佐之男命の御守: おみくじ大吉(sharedSurviveFatal、遠征単位)とは別枠の、戦闘単位の共有致命傷耐え
    target.passives.omamoriSharedSurviveFatal.used = true;
    target.hp = 1;
    log(dmgLine);
    log(`${target.label}は須佐之男命の御守の加護で致命傷をこらえた！`);
  } else if (lethal && typeof jizoBlessingActive !== "undefined" && jizoBlessingActive && fieldParty.includes(target)) {
    // 探索イベント「苔むしたお地蔵さま」の加護: 賽銭を納めていると、遠征中1回だけ味方の致命傷をHP1でこらえる。
    // おみくじ大吉/須佐之男の御守とはスロットを共有しない独立の枠(passivesの単一スロットを奪い合わないための別変数方式)
    jizoBlessingActive = false;
    target.hp = 1;
    log(dmgLine);
    log(`${target.label}はお地蔵さまの加護で致命傷をこらえた！`);
  } else if (lethal && target.passives && target.passives.onceGuardType === "surviveAtHp1" && !target.passives.onceGuardUsed) {
    target.passives.onceGuardUsed = true;
    target.hp = 1;
    log(dmgLine);
    log(`${target.label}は致命傷を気迫でこらえた！`);
  } else {
    target.hp = Math.max(0, target.hp - dmg);
    log(dmgLine);
  }
  // かばう中(logSuffix==="(かばう)")かつ「会心の返し」(guardCounter、100%確定反撃)持ちの場合は、
  // ここでの汎用「迎撃」(counterChance、被弾時の確率反撃)を重ねて発動させない。
  // 会心の返しはhandleGuardSynergyPassives側で別途0.5秒後の専用演出込みで確実に反撃するため、
  // 両方の受動を選んでいると同じ1回の被弾に対して敵へ二重に反撃ダメージが入ってしまっていた
  const guardCounterWillHandleIt = logSuffix === "(かばう)" && target.passives && target.passives.guardCounter;
  if (actor && target.hp > 0 && target.passives && target.passives.counterChance > 0 && !guardCounterWillHandleIt && Math.random() < target.passives.counterChance) {
    const counterDmg = Math.max(1, Math.round(effectiveStat(target, "atk") * (target.passives.counterMult || 1) - effectiveStat(actor, "def") * 0.5));
    actor.hp = Math.max(0, actor.hp - counterDmg);
    log(`${target.label}は反撃した！${actorLabel}に${counterDmg}ダメージ！`);
  }
  // 敵を倒した攻撃者を記録しておく(全滅時のセリフで「最後に倒した人物」を優先的に喋らせるために使う)
  if (actor && target.instanceId !== undefined && target.hp <= 0) {
    lastEnemyKillActor = actor;
  }
  // 撃破時スタック系の受動効果(修羅・槍鬼など): このダメージで倒したらスタックを積む
  if (actor && actor.passives && actor.passives.onKill && target.hp <= 0) {
    const ok = actor.passives.onKill;
    actor.passives.onKillStacks = Math.min(ok.maxStacks, (actor.passives.onKillStacks || 0) + 1);
    actor.passives.onKillStacksTurns = ok.turns;
  }
  // 修羅刃など: 敵を倒した直後、次に受ける1回の攻撃だけ回避率が上がる(蓄積しない、rollHit側で消費する)
  if (actor && actor.passives && actor.passives.onKillEvasionBonus && target.hp <= 0) {
    actor.onKillEvasionBonusActive = true;
  }
  // 通常攻撃に乗る状態異常付与の受動効果(毒刃・毒矢など): 攻撃が当たった時に確率判定する。複数選んでいれば全て判定する
  if (actor && actor.passives && actor.passives.onHitInflicts && target.hp > 0) {
    actor.passives.onHitInflicts.forEach((oh) => {
      // targetSlower条件つき(疾風の出血付与など): 対象が自分より素早さが遅い時だけ判定する
      if (oh.condition === "targetSlower" && !(effectiveStat(actor, "spd") > effectiveStat(target, "spd"))) return;
      // targetFullHp条件つき(阿修羅突きなど): このダメージを受ける前の時点で対象のHPが満タンだった時だけ判定する
      if (oh.condition === "targetFullHp" && !wasFullHpBeforeThisHit) return;
      if (Math.random() < resistedChance(target, oh.chance, oh.type)) {
        const izanamiBoost = consumeOmamoriIzanami(actor) ? 2 : 0;
        if (oh.type === "poison") applyPoison(target, (oh.value || 3) + izanamiBoost);
        if (oh.type === "bleed") applyBleed(target, resolveValue(oh, 2) + izanamiBoost);
        if (oh.type === "burn") applyBurn(target, oh.turns || 3);
        if (oh.type === "stun") applyStun(target, oh.turns || 1);
        if (oh.type === "atkDown") applyStatMod(target, "atk", 1 - (oh.value || 0.15), oh.turns || 3);
        if (oh.type === "defDown") applyStatMod(target, "def", 1 - (oh.value || 0.15), oh.turns || 3);
      }
    });
  }
  // 通常攻撃が命中するたび、自分の最大HPの一定割合を回復する(汎用フック、現状未使用)
  if (actor && actor.passives && actor.passives.onHitSelfHealPct) {
    const healAmt = Math.max(1, Math.round(actor.maxHp * actor.passives.onHitSelfHealPct));
    actor.hp = Math.min(actor.maxHp, actor.hp + healAmt);
  }
  // 覇気など: 通常攻撃で与えたダメージの一定割合だけ自分のHPを回復する
  if (actor && actor.passives && actor.passives.onHitLifestealPct && dmg > 0) {
    const healAmt = Math.max(1, Math.round(dmg * actor.passives.onHitLifestealPct));
    actor.hp = Math.min(actor.maxHp, actor.hp + healAmt);
  }
  // 剛槍など: 通常攻撃が命中するたび、自分のステータスが蓄積的に上がる
  if (actor && actor.passives && actor.passives.onHitSelfStackBuff) {
    const b = actor.passives.onHitSelfStackBuff;
    applyStackingStatMod(actor, "onHitSelfStackBuff", b.stat, b.perStack, b.maxStacks, b.turns);
  }
  // 不動の構えなど: 敵からダメージを受けるたび、自分の最大HPの一定割合を回復する
  if (target && target.passives && target.passives.onDamagedSelfHealPct && target.hp > 0) {
    const healAmt = Math.max(1, Math.round(target.maxHp * target.passives.onDamagedSelfHealPct));
    target.hp = Math.min(target.maxHp, target.hp + healAmt);
  }
  return dmg;
}
// 特定の職業基本アビリティ(薙ぎ払い等)がヒットした敵にだけ状態異常を付与する受動効果(旋風薙ぎなど)。
// applyDamageToTarget内のonHitInflicts(通常攻撃全般に乗る効果)とは別枠で、abilityType(呼び出し元が
// 明示的に渡す)が一致する時だけ判定する。呼び出し元(battle.js)がAOEアビリティの命中判定ループの中で
// ヒットした対象ごとに呼ぶ想定
function applyAbilityOnHitInflicts(actor, target, abilityType, log) {
  if (!actor || !actor.passives || !actor.passives.abilityOnHitInflicts || target.hp <= 0) return;
  const list = actor.passives.abilityOnHitInflicts[abilityType];
  if (!list) return;
  list.forEach((oh) => {
    if (Math.random() < resistedChance(target, oh.chance, oh.type)) {
      const izanamiBoost = consumeOmamoriIzanami(actor) ? 2 : 0;
      if (oh.type === "poison") applyPoison(target, (oh.value || 3) + izanamiBoost);
      if (oh.type === "bleed") applyBleed(target, resolveValue(oh, 2) + izanamiBoost);
      if (oh.type === "burn") applyBurn(target, oh.turns || 3);
      if (oh.type === "stun") applyStun(target, oh.turns || 1);
      if (oh.type === "atkDown") applyStatMod(target, "atk", 1 - (oh.value || 0.15), oh.turns || 3);
      if (oh.type === "defDown") applyStatMod(target, "def", 1 - (oh.value || 0.15), oh.turns || 3);
    }
  });
}
// 特定の職業基本アビリティ(薙ぎ払い等)が命中させた敵の数に応じて、自分に一時バフを与える受動効果(円舞など)。
// hitCountが0(1体も当たらなかった)場合は何もしない。呼び出し元(battle.js)がAOEアビリティの
// 命中判定ループが終わった後、実際に命中した数を渡して1回だけ呼ぶ想定
function applyAbilityAoeSelfBuffs(actor, abilityType, hitCount) {
  if (!actor || !actor.passives || !actor.passives.abilityAoeSelfBuffs || hitCount <= 0) return;
  const list = actor.passives.abilityAoeSelfBuffs[abilityType];
  if (!list) return;
  list.forEach((b) => {
    applyStatMod(actor, b.stat, hitCount * b.perHitMult, b.turns);
  });
}
// 狩人「鷹を呼ぶ」: 鷹が出ている間、狩人自身の単体攻撃(通常攻撃・単体アビリティ・単体スキル)に
// 鷹も追撃する。命中/回避のどちらでも呼ぶ想定(外れても鷹は独立して追撃する)。全体攻撃からは呼ばない
// (全ての敵に鷹の追撃が入ると強すぎるため、呼び出し元でaction.aoe等を見て呼び分ける)。
// actor=nullで再帰呼び出しすることで(爆弾の生ダメージ処理と同じ手法)会心・パッシブ等の副作用は
// 乗せず、出血付与だけ別途判定する。この再帰呼び出しがlastHitWasCritを上書きするため退避/復元する。
// 狩人本体の攻撃で対象を倒した場合は、鷹は生存中の別の敵をランダムに選んで追撃する(いなければ何もしない)。
// 呼び出し元(battle.js)が飛翔VFXを正しい対象へ向けられるよう、実際に攻撃した対象を返り値で返す
function maybeHawkFollowup(actor, target, log) {
  lastHawkFollowupHappened = false;
  if (!(actor && actor.classId === "hunter" && actor.hawkTurnsLeft > 0)) return null;
  let realTarget = target;
  if (target.hp <= 0) {
    const others = (target.__enemyAllies || []).filter((e) => e !== target && e.hp > 0);
    if (others.length === 0) return null;
    realTarget = others[Math.floor(Math.random() * others.length)];
  }
  const critFlagBeforeHawk = lastHitWasCrit;
  const hawkDmg = Math.max(1, Math.round(withVariance(effectiveStat(actor, "atk") * HAWK_FOLLOWUP_ATK_MULT * mitigation(effectiveStat(realTarget, "def"), 18), 0.15)));
  applyDamageToTarget(realTarget, hawkDmg, log, `${actor.label}の鷹`, null);
  lastHitWasCrit = critFlagBeforeHawk;
  lastHawkFollowupHappened = true;
  if (realTarget.hp > 0 && Math.random() < HAWK_FOLLOWUP_BLEED_CHANCE) applyBleed(realTarget, resolveValue({ valueMin: 1, valueMax: 3 }, 2));
  return realTarget;
}

// abilityType: 'magicAttack' | 'magicAttackAll' | 'heal' | 'critAttack' | 'powerAttack' | 'physicalAttackAll' | 'guard'
// target: 単体系は対象1体、全体系(...All)は生存中の敵配列、heal/guardはactor自身か味方1体
function useAbility(actor, target, abilityType, log) {
  let cost = abilityMpCost(abilityType, actor);
  // 鉄壁など: かばうのMP消費が一定確率で0になる
  if (abilityType === "guard" && cost > 0 && actor.passives && actor.passives.guardFreeChance > 0 && Math.random() < actor.passives.guardFreeChance) {
    cost = 0;
  }
  if (cost > 0) {
    if (actor.mp < cost) {
      log(`${actor.label}はMPが足りない！`);
      return { failed: true };
    }
    actor.mp -= cost;
  }
  if (abilityType === "guard") {
    actor.guarding = true;
    actor.guardProtectCount = 0;
    log(`${actor.label}は身を守る構え！`);
    return { guard: true };
  }
  if (abilityType === "magicAttack") {
    return rollAttackOrMiss(actor, target, () => rollMagicAttack(effectiveStat(actor, "mag"), target.def), log, undefined, ABILITY_RANGE_TYPE.magicAttack, true);
  }
  if (abilityType === "magicAttackAll") {
    return rollAoeAttack(actor, target, (t) => Math.max(1, Math.round(rollMagicAttack(effectiveStat(actor, "mag"), t.def) * 0.66)), log, ABILITY_RANGE_TYPE.magicAttackAll, true);
  }
  if (abilityType === "physicalAttackAll") {
    return rollAoeAttack(actor, target, (t) => Math.max(1, Math.round(rollBasicAttack(effectiveStat(actor, "atk"), t.def) * 0.95)), log, ABILITY_RANGE_TYPE.physicalAttackAll);
  }
  if (abilityType === "powerAttack") {
    return rollAttackOrMiss(actor, target, () => rollPowerAttack(effectiveStat(actor, "atk"), target.def), log, undefined, ABILITY_RANGE_TYPE.powerAttack);
  }
  if (abilityType === "critAttack") {
    return rollAttackOrMiss(actor, target, () => rollCritAttack(effectiveStat(actor, "atk"), target.def), log, undefined, ABILITY_RANGE_TYPE.critAttack);
  }
  if (abilityType === "preciseShot") {
    // 「会心の一矢」の名前通り、通常の会心率(基本5%)に+45%を上乗せし、合計50%で急所を突く
    return rollAttackOrMiss(actor, target, () => rollPreciseShot(effectiveStat(actor, "atk"), target.def), log, 0.45, ABILITY_RANGE_TYPE.preciseShot);
  }
  if (abilityType === "cannonShot") {
    actor.reloading = true; // 命中/回避に関わらず、撃った以上は次のターン装填で動けなくなる
    return rollAttackOrMiss(actor, target, () => rollCannonShot(effectiveStat(actor, "atk"), target.def), log, undefined, ABILITY_RANGE_TYPE.cannonShot);
  }
  if (abilityType === "heal") {
    const bonusMult = healBonusMultiplier(actor, target, false);
    const heal = Math.round(applyOnsenHealBonus(target, rollHeal(effectiveStat(actor, "mag"))) * bonusMult);
    target.hp = Math.min(target.maxHp, target.hp + heal);
    log(`${actor.label}は${target.label}を${heal}回復！`);
    return { heal };
  }
  return null;
}
// 温泉バフ「湯浴み」: 回復を受ける側がこのバフを持っていれば、回復量を+15%する
// (回復薬/温泉卵/治癒の術/スキルツリーの回復技、全ての回復経路で共通して使う)
function applyOnsenHealBonus(target, heal) {
  return target.onsenBuffKey === "yuami" ? Math.round(heal * 1.15) : heal;
}

function usePotion(target, log) {
  let ratio = POTION_HEAL_RATIO + (state.beeFarmLevel || 0) * BEE_FARM_POTION_BONUS_PER_LEVEL;
  if (hasOmamori("kannon")) ratio *= 1.30; // 観音菩薩の御守: 回復薬の回復量+30%
  const heal = applyOnsenHealBonus(target, Math.round(target.maxHp * ratio));
  target.hp = Math.min(target.maxHp, target.hp + heal);
  log(`${target.label}は回復薬で${heal}回復！`);
  return heal;
}

// 温泉卵: 回復薬と違い自分専用(呼び出し側でtarget=行動者本人を渡す前提)。ターンを消費しない点は
// index.html側(ボタンのonclickでfinishPlayerActionを呼ばない)で担保している
function useOnsenEgg(target, log) {
  let ratio = ONSEN_EGG_HEAL_RATIO + (state.henHouseLevel || 0) * HEN_HOUSE_ONSEN_EGG_BONUS_PER_LEVEL;
  if (hasOmamori("toyouke")) ratio *= 1.20; // 豊受大神の御守: 温泉たまごの回復量+20%
  const heal = applyOnsenHealBonus(target, Math.round(target.maxHp * ratio));
  target.hp = Math.min(target.maxHp, target.hp + heal);
  log(`${target.label}は温泉卵で${heal}回復！`);
  return heal;
}
// 鶏小屋の効果は一旦完全に廃止(ユーザー指示、後日作り直す予定)。建物自体(建築/増築)は
// 残したままにするため、容量は常に0を返し卵ポーチの補充・表示を無効化する
function henHouseEggPouchCapacity() {
  return 0;
}
// 購入済みの温泉卵(inventory.onsenEgg、supplyCapに含まれる)とポーチの温泉卵(onsenEggPouch、
// 含まれない)を合算した「実際に使える温泉卵の総数」。UIの残数表示・使用可否判定に使う
function totalOnsenEggCount() {
  return (state.inventory.onsenEgg || 0) + (state.inventory.onsenEggPouch || 0);
}
// 温泉卵を1個消費する。無料のポーチ分から先に減らし、無くなったら購入済みの分を減らす
function consumeOnsenEggFromInventory() {
  if ((state.inventory.onsenEggPouch || 0) > 0) state.inventory.onsenEggPouch--;
  else state.inventory.onsenEgg = Math.max(0, (state.inventory.onsenEgg || 0) - 1);
}

// かばう(guarding)の身代わり成功率。100%だと絶対に守り切れてしまうため95%に抑えてあり、
// 5%は守り切れず別の味方が狙われる。挑発(tauntTurns)はタンク側の強制引きつけなので100%のまま変えない
const GUARD_REDIRECT_CHANCE = 0.95;
// かばうは元々「1回身代わりになったら構えが解除される」1発仕様だったが、ユーザー指示により、
// 身代わりになるたびにこの確率で構えが解除されず継続する(=続けてもう1人分かばえる)ようにした。
// 判定は身代わりの都度行うため、理論上は連続して複数人をかばい続けることもできる(50%→25%→12.5%...と
// 尻すぼみに確率が下がっていく)。当初65%だったが、2回連続で発動しやすすぎるとの指摘で50%にナーフした
const GUARD_CONTINUE_CHANCE = 0.50;
// 構えの継続確率が50%で残っていても、次の自分のターンが来るまでに守れるのは最大2人まで
// (3人目は守らせない)。2人目を守った時点で強制的に構えを解除する
const GUARD_MAX_PROTECT_COUNT = 2;
function findGuardTarget(alive) {
  const taunter = alive.find((t) => t.tauntTurns > 0);
  if (taunter) return taunter;
  const guardian = alive.find((t) => t.guarding);
  if (guardian && Math.random() < GUARD_REDIRECT_CHANCE) return guardian;
  return null;
}
// enemy一体がtargets(生存中の味方)を攻撃する。かばう中の仲間がいれば、タンクとして95%の確率で身代わりになって
// 大幅減衰した上で構えを消費する(誰もかばっていない、または5%で守り切れなければランダムに1人を攻撃する)
// 回避に成功した瞬間、evadeCritCounter持ちなら「次の自分の攻撃は確定会心」フラグを立て(反射神経)、
// onEvadeSelfBuff持ちなら次の自分の1ターンだけステータスが上がる(影分身)
function onEvadeSuccess(target, enemy, log) {
  if (target.passives && target.passives.evadeCritCounter) target.guaranteedCritNext = true;
  if (target.passives && target.passives.onEvadeSelfBuff) {
    const b = target.passives.onEvadeSelfBuff;
    applyStatMod(target, b.stat, b.mult, 2);
  }
  // 空蝉など: 回避に成功した瞬間、MPを回復する
  if (target.passives && target.passives.onEvadeMpRestore) {
    target.mp = Math.min(target.maxMp, target.mp + target.passives.onEvadeMpRestore);
  }
  // 瞬身の順など: 回避に成功した瞬間、指定倍率で反撃する
  if (target.passives && target.passives.onEvadeCounterMult && enemy && enemy.hp > 0) {
    const counterDmg = Math.max(1, Math.round(effectiveStat(target, "atk") * target.passives.onEvadeCounterMult - effectiveStat(enemy, "def") * 0.5));
    enemy.hp = Math.max(0, enemy.hp - counterDmg);
    log(`${target.label}は${enemy.label}に反撃した！${counterDmg}ダメージ！`);
  }
}
// かばうが敵の攻撃を防いだ瞬間に発動する槍士のスキルツリー効果(会心の返し/居合の構え/心眼)。
// enemyAttack/enemyBigAttackどちらの「target.guarding」消費ブロックからも同じ処理を呼べるよう共通化した
// 戻り値: 会心の返し(guardCounter)が実際に発動した場合はそのダメージ量、発動しなければnull。
// 呼び出し元(battle.js)がこの値を見て、敵の攻撃演出の少し後に反撃の演出を差し込めるようにするため
function handleGuardSynergyPassives(target, enemy, log) {
  if (!target.passives || target.hp <= 0) return null;
  if (target.passives.guardCritCounter) target.guaranteedCritNext = true;
  if (target.passives.guardMpRefund) target.mp = Math.min(target.maxMp, target.mp + 1);
  let counterDmg = null;
  if (target.passives.guardCounter && enemy.hp > 0) {
    counterDmg = Math.max(1, Math.round(effectiveStat(target, "atk") - effectiveStat(enemy, "def") * 0.5));
    // ここではenemy.hpを減らさない・ログも出さない。反撃の演出(playGuardCounterVisual、0.5秒後)と
    // 完全に同時になるよう、実際のHP減算とログ出力は演出発火のタイミングまで遅延させる
    // (以前はここで即座に減らしていたため、敵の攻撃演出の直後のrenderBattleScreen()で
    // 反撃エフェクトより先にHPバーだけ減って見えるズレがあった)
  }
  // かばうが成功した瞬間、味方全体に3ターンの攻撃力バフを配る(鼓舞の盾)。__alliesはstartBattle()で
  // 全プレイヤーキャラに配られる自パーティ全体への参照
  if (target.passives.guardPartyAtkBuff > 0 && target.__allies) {
    target.__allies.forEach((c) => { if (c.status === "active") applyStatMod(c, "atk", 1 + target.passives.guardPartyAtkBuff, 3); });
    log(`${target.label}の気迫が味方を鼓舞した！`);
  }
  return counterDmg;
}
function enemyAttack(enemy, targets, log) {
  const alive = targets.filter((t) => t.hp > 0);
  if (!alive.length) return null;
  const guardian = findGuardTarget(alive);
  const target = guardian || alive[Math.floor(Math.random() * alive.length)];
  // 戦闘中1回だけ確実に攻撃を回避する受動(分身など)。dodgeChance(確率式)とは別枠の確定回避
  if (target.passives && target.passives.onceGuardType === "dodgeOnce" && !target.passives.onceGuardUsed) {
    target.passives.onceGuardUsed = true;
    log(`${target.label}は${enemy.label}の攻撃を完全に見切ってかわした！`);
    onEvadeSuccess(target, enemy, log);
    return { target, dmg: null, hit: false };
  }
  if (!rollHit(enemy, target)) {
    log(`${target.label}は${enemy.label}の攻撃をかわした！`);
    onEvadeSuccess(target, enemy, log);
    return { target, dmg: null, hit: false };
  }
  let rawDmg = rollBasicAttack(enemy.atk, effectiveStat(target, "def"));
  let suffix = "";
  if (target.guarding) {
    rawDmg = Math.max(1, Math.round(rawDmg * 0.4));
    if (target.passives && target.passives.extraGuardMitigation !== 1) rawDmg = Math.max(1, Math.round(rawDmg * target.passives.extraGuardMitigation));
    target.guardProtectCount = (target.guardProtectCount || 0) + 1;
    if (target.guardProtectCount >= GUARD_MAX_PROTECT_COUNT || Math.random() >= GUARD_CONTINUE_CHANCE) target.guarding = false; // 50%で構え継続、50%で解除。ただし2人守ったら強制解除
    suffix = "(かばう)";
  }
  const dmg = applyDamageToTarget(target, rawDmg, log, enemy.label, enemy, suffix);
  const guardCounterDmg = suffix === "(かばう)" ? handleGuardSynergyPassives(target, enemy, log) : null;
  // 瀕死になった一撃は、既にHPが減っていて実際のダメージ量(dmg)が小さくても、
  // 気絶するという出来事自体が最大級のストレスになるはずなので、その場合はratio=1.0扱いで計算する
  const wentDown = target.hp <= 0;
  const stressGain = damageStress(wentDown ? target.maxHp : dmg, target.maxHp);
  target.fatigue = Math.min(FATIGUE_MAX, (target.fatigue || 0) + stressGain);
  if (stressGain > 0 && typeof popupOn === "function") popupOn(target.id, String(stressGain), "stress");
  // 敵固有の通常攻撃時デバフ(ぬらりこうもりの毒など)。かばう/挑発で同じ相手が何度も狙われ続けると
  // 蓄積が重なって危険域に達しやすい、という「かばうへの天敵」を演出するための仕組み。
  // stacking:trueは元々「加算される特殊仕様」だったが、2026-07-18の全DOT加算化で標準と同じ挙動になった
  // (蓄積値付きの専用ログを出すためだけに分岐を残している)
  if (!wentDown && enemy.onHitInflict && Math.random() < enemy.onHitInflict.chance) {
    if (enemy.onHitInflict.type === "poison" && enemy.onHitInflict.stacking && target.statusImmuneTurns <= 0) {
      target.poison = (target.poison || 0) + (enemy.onHitInflict.value || 1);
      log(`${target.label}は${enemy.label}に噛まれ、毒が蓄積した！(${target.poison})`);
    } else {
      resolveDebuffEffect(target, enemy.onHitInflict.type, enemy.onHitInflict, log);
    }
  }
  return { target, dmg, hit: true, guardCounterDmg };
}

// paramsにturnsMin/turnsMaxがあれば範囲内でランダムなターン数を、無ければ固定のturns(既定3)を返す
function resolveTurns(params) {
  if (params.turnsMin != null && params.turnsMax != null) {
    return params.turnsMin + Math.floor(Math.random() * (params.turnsMax - params.turnsMin + 1));
  }
  return params.turns || 3;
}
// paramsにvalueMin/valueMaxがあれば範囲内でランダムな値を、無ければ固定のvalue(fallback)を返す
function resolveValue(params, fallback) {
  if (params.valueMin != null && params.valueMax != null) {
    return params.valueMin + Math.floor(Math.random() * (params.valueMax - params.valueMin + 1));
  }
  return params.value || fallback;
}
// デバフ種別ごとの適用処理を共通化(大技の専用プロファイル・汎用ランダムプール・通常攻撃時デバフの
// いずれからも呼ぶ)。paramsはvalue(またはvalueMin/valueMaxの範囲指定)/turns(またはturnsMin/turnsMaxの範囲指定)を持つinflict設定オブジェクト
function resolveDebuffEffect(target, type, params, log) {
  params = params || {};
  if (type === "atkDown") { applyStatMod(target, "atk", 1 - (params.value || 0.15), resolveTurns(params)); log(`${target.label}は攻撃力が下がった！`); }
  if (type === "defDown") { applyStatMod(target, "def", 1 - (params.value || 0.15), resolveTurns(params)); log(`${target.label}は防御力が下がった！`); }
  if (type === "spdDown") { applyStatMod(target, "spd", 1 - (params.value || 0.2), resolveTurns(params)); log(`${target.label}は素早さが下がった！`); }
  if (type === "poison") { applyPoison(target, resolveValue(params, 3)); log(`${target.label}は毒を受けた！`); }
  if (type === "bleed") { applyBleed(target, resolveValue(params, 2)); log(`${target.label}は出血を負った！`); }
  if (type === "burn") { applyBurn(target, resolveTurns(params)); log(`${target.label}は炎上した！`); }
  if (type === "stun") { applyStun(target, params.turns || 1); log(`${target.label}はスタンした！`); }
  if (type === "silence") { applySilence(target, params.turns || 2); log(`${target.label}は沈黙した！`); }
  if (type === "dmgTakenUp") { applyStatMod(target, "dmgTaken", 1 + (params.value || 0.15), resolveTurns(params)); log(`${target.label}は呪いを受け、被ダメージが増えた！`); }
}

// debuff.typeの文字列がSTATUS_TOOLTIPSのキーと1対1でない箇所だけの変換表(spdDownは表示上「束縛」の
// tangleアイコンに相乗りしているため、キー名がズレている)
const DEBUFF_TYPE_TOOLTIP_KEY = { spdDown: "tangle" };
// 敵カード上の📜アイコンをタップした時に出す、その敵の大技の説明文。予告ターン(bigAttackPending)を
// 待たずにいつでも確認できるようにするため、data.js側の手書きテキストではなくbigAttackプロファイル
// (mult/debuff/aoe/ignoreGuardian)から機械的に組み立てる(全103体を漏れなくカバーできる)
function bigAttackSummaryText(enemyDef) {
  const p = enemyDef.bigAttack;
  if (!p) return "詳細不明の一撃を放つ。";
  const parts = [];
  if (p.aoe) parts.push("全体を巻き込む");
  if (p.ignoreGuardian) parts.push("誰か1人の盾では防ぎきれない");
  if (p.debuff) {
    const tooltipKey = DEBUFF_TYPE_TOOLTIP_KEY[p.debuff.type] || p.debuff.type;
    const info = STATUS_TOOLTIPS[tooltipKey];
    const name = info ? info.title : p.debuff.type;
    const chancePct = Math.round((p.debuff.chance != null ? p.debuff.chance : 1) * 100);
    parts.push(`命中時${chancePct}%の確率で【${name}】を与える`);
  } else {
    parts.push("状態異常は伴わない、純粋な一撃");
  }
  return parts.join("。") + "。";
}

// enemyの「大技」。かばう/挑発中の仲間がいればその1人だけに(引きつける対抗策)、いなければ
// 生存中の味方全員に襲いかかる。全敵がbigAttackプロファイル(見た目/生態に合わせた専用の威力+デバフ)を
// 持っている前提(data.js ENEMIES、汎用フォールバックは廃止済み、2026-07-19)。
// 敵自身が毒/炎上状態なら威力がさらに下がる(削る対抗策)。結果は対象ごとの配列で返す
function enemyBigAttack(enemy, targets, log) {
  const alive = targets.filter((t) => t.hp > 0);
  if (!alive.length) return [];
  const profile = enemy.bigAttack;
  // 大技は敵1体につき1人だけを狙う(以前は「かばう中の人がいなければ全員に当たる」実質AOEに
  // なっていて難易度が高くなりすぎていたため単体攻撃に統一した)。ignoreGuardian: 鬼火の業火など
  // 「誰か1人が庇っても防ぎきれない」大技は、かばう/挑発による引きつけを無視してランダムな1人を狙う。
  // aoe: 天狗の「扇の突風」のような特別な敵専用の全体大技(生存中の味方全員に当たる。
  // 全員が対象なのでかばう/挑発の引きつけ先選択は行わないが、各自のかばう軽減40%は個別に効く)
  const guardian = profile.ignoreGuardian ? null : findGuardTarget(alive);
  const singleTarget = guardian || alive[Math.floor(Math.random() * alive.length)];
  const hitTargets = profile.aoe ? alive : [singleTarget];
  let mult = profile.mult;
  if (enemy.poison > 0 || enemy.burnTurns > 0 || enemy.bleed > 0) mult = Math.max(0.2, mult - BIG_ATTACK_DOT_REDUCTION);
  const bigAttackName = (profile.name) || "大技";
  return hitTargets.map((target) => {
    if (target.passives && target.passives.onceGuardType === "dodgeOnce" && !target.passives.onceGuardUsed) {
      target.passives.onceGuardUsed = true;
      log(`${target.label}は${enemy.label}の${bigAttackName}を完全に見切ってかわした！`);
      onEvadeSuccess(target, enemy, log);
      return { target, dmg: null, hit: false };
    }
    if (!rollHit(enemy, target)) {
      log(`${target.label}は${enemy.label}の${bigAttackName}をかわした！`);
      onEvadeSuccess(target, enemy, log);
      return { target, dmg: null, hit: false };
    }
    let rawDmg = Math.round(rollBasicAttack(enemy.atk, effectiveStat(target, "def")) * mult);
    let suffix = "";
    if (target.guarding) {
      rawDmg = Math.max(1, Math.round(rawDmg * 0.4));
      if (target.passives && target.passives.extraGuardMitigation !== 1) rawDmg = Math.max(1, Math.round(rawDmg * target.passives.extraGuardMitigation));
      target.guardProtectCount = (target.guardProtectCount || 0) + 1;
      if (target.guardProtectCount >= GUARD_MAX_PROTECT_COUNT || Math.random() >= GUARD_CONTINUE_CHANCE) target.guarding = false; // 50%で構え継続、50%で解除。ただし2人守ったら強制解除
      suffix = "(かばう)";
    }
    const dmg = applyDamageToTarget(target, rawDmg, log, enemy.label, enemy, suffix, null, bigAttackName);
    const guardCounterDmg = suffix === "(かばう)" ? handleGuardSynergyPassives(target, enemy, log) : null;
    const wentDown = target.hp <= 0;
    const stressGain = damageStress(wentDown ? target.maxHp : dmg, target.maxHp);
    target.fatigue = Math.min(FATIGUE_MAX, (target.fatigue || 0) + stressGain);
    if (stressGain > 0 && typeof popupOn === "function") popupOn(target.id, String(stressGain), "stress");
    // 命中した対象ごとに独立してデバフ判定する(戦闘不能になった相手には付けない)
    if (!wentDown && profile.debuff && Math.random() < profile.debuff.chance) {
      resolveDebuffEffect(target, profile.debuff.type, profile.debuff, log);
    }
    return { target, dmg, hit: true, guardCounterDmg };
  });
}

// 被弾ダメージが自身の最大HPに占める割合に応じてストレスが溜まる。3割未満は増加なし、
// 3割で+2、8割で+15になるよう線形補間している(割合1.0=即死級の一撃で+20)
function damageStress(dmg, maxHp) {
  if (!maxHp) return 0;
  const ratio = Math.min(dmg / maxHp, 1);
  if (ratio < 0.3) return 0;
  return Math.round(26 * (ratio - 0.3) + 2);
}

// 戦闘不能になったキャラをそのフロアで瀕死にする(死体ではなく生存しているが動けない状態)。
// 別の仲間がそのフロアに到達し、救出コマンドを使えば連れ帰れる(ただし冒険はそこで終了する)。
// 誰も助けに来ないまま、実ゲーム内時間で2.5〜3.5日(CRITICAL_MIN_HOURS〜MAX_HOURS)経過すると
// ロスト(完全消滅)する。absoluteMinutesはその時点のゲーム内絶対分数(呼び出し側で算出)
function markCritical(character, floor, absoluteMinutes, stage) {
  character.status = "critical";
  character.hp = 0;
  character.criticalFloor = floor;
  character.criticalStage = stage || "forest"; // 森/海岸どちらで瀕死になったかも記録し、階層番号だけでは区別できない別ステージでの誤救出/誤表示を防ぐ
  const spanHours = CRITICAL_MIN_HOURS + Math.random() * (CRITICAL_MAX_HOURS - CRITICAL_MIN_HOURS);
  character.criticalExpireMinutes = absoluteMinutes + spanHours * 60;
}

// ゲーム内時間が進むたび(町へ帰る/宿泊はもちろん、ダンジョン内を歩き回っている間も)呼び、
// 期限切れの瀕死キャラをロストにする。ただし既に誰かに担がれている間は「救出済みで運搬中」
// なので、カウントダウンを進めない(ロストしない)
function tickCriticalExpiry(characters, absoluteMinutes) {
  characters.forEach((c) => {
    if (c.status === "critical" && !c.carriedBy && absoluteMinutes > c.criticalExpireMinutes) {
      c.status = "lost";
    }
  });
}

// 瀕死の仲間を救出する(HP半分で復活)。呼び出し側でその冒険を終了させて町に戻す
function rescueCritical(character) {
  if (character.status !== "critical") return false;
  character.status = "active";
  character.hp = 1; // 瀕死から復帰した直後はHP1(ぎりぎり生きている状態。全快ではない)
  character.criticalFloor = null;
  character.criticalExpireMinutes = null;
  character.carriedBy = null;
  return true;
}

// 速度順(疲労を反映した実効素早さ+ランダム性込み)で行動順を決める
function turnOrder(entities) {
  return [...entities].sort((a, b) => (effectiveStat(b, "spd") + Math.random() * 4) - (effectiveStat(a, "spd") + Math.random() * 4));
}

// Node.js検証用: 素朴なAI(常に通常攻撃)でパーティvs敵1体を1戦分自動再生する
function simulateBattle(party, enemy, log) {
  const alive = () => party.filter((p) => p.hp > 0);
  let turns = 0;
  while (enemy.hp > 0 && alive().length > 0 && turns < 200) {
    turns++;
    const order = turnOrder([...alive(), enemy]);
    for (const actor of order) {
      if (enemy.hp <= 0 || alive().length === 0) break;
      if (actor === enemy) {
        enemyAttack(enemy, alive(), log);
      } else if (actor.hp > 0) {
        performAttack(actor, enemy, log);
      }
    }
  }
  return { won: enemy.hp <= 0, turns, survivors: alive().length };
}

// Node.js検証用: パーティvs複数敵を自動再生する(素朴なAI: 各自ランダムな生存敵を攻撃)
function simulateBattleMulti(party, enemies, log) {
  const aliveParty = () => party.filter((p) => p.hp > 0);
  const aliveEnemies = () => enemies.filter((e) => e.hp > 0);
  let turns = 0;
  while (aliveEnemies().length > 0 && aliveParty().length > 0 && turns < 200) {
    turns++;
    const order = turnOrder([...aliveParty(), ...aliveEnemies()]);
    for (const actor of order) {
      if (aliveEnemies().length === 0 || aliveParty().length === 0) break;
      if (actor.hp <= 0) continue;
      if (enemies.includes(actor)) {
        enemyAttack(actor, aliveParty(), log);
      } else {
        const targets = aliveEnemies();
        if (targets.length) performAttack(actor, targets[Math.floor(Math.random() * targets.length)], log);
      }
    }
  }
  return { won: aliveEnemies().length === 0, turns, survivors: aliveParty().length };
}

if (typeof module !== "undefined") {
  module.exports = {
    createCharacter, rollBasicAttack, rollMagicAttack, rollPowerAttack, rollCritAttack, rollPreciseShot, rollCannonShot, rollHeal,
    pickEnemyForFloor, pickEncounterForFloor, instantiateEnemyById, goldReward, performAttack, useAbility, usePotion, useOnsenEgg, enemyAttack, enemyBigAttack, resolveDebuffEffect, rollBigAttackCountdown, applyGroupNerf,
    markCritical, tickCriticalExpiry, rescueCritical, turnOrder, simulateBattle, simulateBattleMulti,
    xpToNext, levelUp, grantXp, maxMpFor, baseMaxMpFor, abilityMpCost,
    advanceFatigue, fatigueMalus, stressTier, effectiveStat, computeEquipBonus, refreshEquipBonus, classHasReachedLevel,
    onsenCost, useOnsen, isOnsenLocked, collectReadyOnsenReliefs, useLodging, useCampRest, isAvailable, evasionChance, accuracyOf, rollHit,
    applyStatMod, tickStatMods, applyPoison, tickPoison, applyBurn, tickBurn, applyBleed, tickBleed, BLEED_MAX_STACKS, clearDotEffects, applyStun, applySilence, tickTurnStartEffects, POISON_MAX_STACKS,
    initPassives, applySkillChoice, useTreeSkill, rollCritMultiplier, damageTakenMultiplier, activeConditionalMods,
    skillMpCost, resistedChance, applyDamageToTarget, BASE_CRIT_RATE, BASE_CRIT_DMG_MULT, mitigation, withVariance,
    enterTransform, revertTransform,
  };
}
