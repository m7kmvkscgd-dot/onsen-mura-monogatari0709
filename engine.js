// ダンジョン1: ゲームロジック本体(キャラ生成・ダメージ計算・戦闘・死体/ロスト管理)

let __idSeq = 1;
let __enemySeq = 1;
let __cloneSeq = 1;
let __shikigamiSeq = 1;
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
    status: "active", // active | lost(戦闘不能=即ロスト。瀕死(critical)は2026-07-26の3人化転換で廃止)
    onsenLockUntilMinutes: null, // 入浴した時点から見て翌朝(dawn=4:30)の絶対分数。この値を過ぎるまでパーティ編成に組み込めない
    onsenPendingRelief: false, // 入浴済みでまだ「リラックスできた！」演出(ストレス減少)を再生していない場合true
    poison: 0, // 毒の蓄積値。自分のターンが来るたびにこの値分ダメージを受け、1減る
    bleed: 0, // 出血の蓄積値。毒と同じ減衰式だが、技の付与量は毒より低めに設計する(旧・攻撃力-10%の一律補正は2026-07-30廃止)
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
    hagakiCritStack: 0, // 覇気: 自分が会心を出すたびに積み上がる会心率の加算値(戦闘開始時にリセット)
    nextSkillFreeMp: false, // 残心: 敵を倒した直後、次に使うスキルのMP消費を0にするフラグ(戦闘開始時にリセット)
  };
}

// レベル上限を10に圧縮したことに伴う再設計(旧: 上限なしで(20+level*15)*4.5)。
// 「新レベルN = 旧レベル4N-3〜4Nの4段分をまとめたもの」という考え方で、旧式で旧レベル1〜36を上る
// のに必要だった経験値の合計と同じ総量になるよう、新レベル1〜9の必要経験値を等差数列(1080*level-45)で
// 割り振ってある(結果として新レベル1=1035, 新レベル9=9675と、終盤ほど1段の重みが大きくなる)。
// 【2026-07-27】終盤2段(Lv8→9=1700/Lv9→10=2700)の個別引き上げ壁はユーザー指示で撤去し全レベル同じ式に統一。
// その上で「Lv3までの立ち上がりは今のペースが気持ちいい、それ以降がぬるい」というユーザー判断により、
// Lv3→4以降を×1.5に伸ばした(114/233/528/707/885/1064/1244/1422/1601、カンスト累計7798)。
// 中盤以降は1レベル≈3遠征のペース想定(森15〜30層往復の実XPシミュレーションに基づく)
function xpToNext(level) {
  const base = Math.round((1080 * level - 45) * 0.11025); // 旧来の等差式(ユーザー指示の1割短縮込み、0.1225*0.9)
  return level >= 3 ? Math.round(base * 1.5) : base;
}

// レベルアップ時、職業ごとの基礎値にレベル依存の成長率をかけて再計算する。
// HPは全快させず、最大値が増えた分だけ現在値に上乗せする(戦闘中の連続レベルアップが実質全回復になっていたバグの修正)。
// 成長率はダクソン/XCOM的に「Lv10でも2倍未満」に収まるよう抑えてある(旧0.1=Lv10で2.0倍から、
// 序盤の階層で装備済みの高レベルキャラが無双しすぎるという指摘を受けさらに緩和。Lv10で1.675倍、下記参照)。
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
  // Lv1(素の値、成長率1.0)からLv2への伸びだけ突出して大きくなっていた継ぎ目のズレを解消するため、
  // (レベル-1)を使う式に変更。Lv2の成長率がLv1の1.0から地続きになり、Lv10到達時は1.75倍→1.675倍になる
  const growth = 1 + (character.level - 1) * 0.075;
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
  // 鬼神化/明鏡止水中は専用立ち絵(ユーザー提供2026-07-30)がストレス差分より優先される
  // (鬼神化中はストレスの影響を受けない設定なので、ストレス表情に切り替わらないのは仕様とも整合する)
  if (c.kishinTurns > 0) return "assets/class_samurai_kishin.png";
  if (c.meikyoTurns > 0) return "assets/class_samurai_meikyo.png";
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
  if (c.kishinTurns > 0 || c.meikyoTurns > 0) return characterPortraitSrc(c); // 変身中は戦闘と同じ専用立ち絵
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
    // 鬼神化/明鏡止水中はストレスの能力低下を受けない(ユーザー仕様2026-07-30)
    const stressImmune = entity.kishinTurns > 0 || entity.meikyoTurns > 0;
    const fatigued = base * (1 - (stressImmune ? 0 : fatigueMalus(entity.fatigue)));
    const equip = (entity.equipBonus && entity.equipBonus[key]) || 0;
    result = Math.max(1, Math.round(fatigued + equip));
  }
  // 温泉バフ(血行促進=攻撃力+5%、湯上がり=素早さ+5%)。次の遠征中限定、野営/帰還で失効する
  if (key === "atk" && entity.onsenBuffKey === "kekkou") result = Math.max(1, Math.round(result * 1.05));
  if (key === "spd" && entity.onsenBuffKey === "yuagari") result = Math.max(1, Math.round(result * 1.05));
  // 性格の癖「守りたい一心」(優しい): HPが3割を切った仲間がいる間、素早さが上がる
  // (行動順が前に来るので回復薬を先に届けられる。素早さ由来の回避も連動して少し上がる)
  if (key === "spd") {
    const quirk = personalityQuirk(entity);
    if (quirk && quirk.allyLowHpSpd && typeof fieldParty !== "undefined" && Array.isArray(fieldParty) && fieldParty.includes(entity)) {
      const hurtAlly = fieldParty.some((a) => a !== entity && a.status === "active" && a.hp > 0 && a.maxHp > 0 && a.hp / a.maxHp <= quirk.allyLowHpSpd.belowPct);
      if (hurtAlly) result = Math.max(1, Math.round(result * quirk.allyLowHpSpd.mult));
    }
  }
  // 【廃止2026-07-30】旧・「出血中は常時攻撃力-10%」の一律補正はユーザー指示で削除
  // (MP0で出血をばら撒ける疾風斬り等と合わさると強すぎるため。出血による攻撃力低下は
  //  弱点システム(ENEMY_WEAKNESS.effectsのatkDown、敵ごとに図鑑エディタで設定)にのみ任せる)
  // 弱点属性(bleed/poison/burn)のeffects(atkDown/defDown/spdDown、図鑑エディタで設定)による継続デバフ。
  // 対応するDOTが現在アクティブな間だけ-30%が乗る(旧tier1/2システムの後継、2026-07-21)
  if ((key === "atk" || key === "def" || key === "spd") && weaknessEffectActive(entity, key + "Down")) {
    result = Math.max(1, Math.round(result * WEAKNESS_EFFECT_STAT_MULT));
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
  // 複数段が同時に発動していても複利(掛け算の重ねがけ)にならないよう、差分(mult-1)を合算してから1回だけ乗算する
  if (entity.passives && entity.passives.conditionalMods && entity.passives.conditionalMods.length && (key === "atk" || key === "mag" || key === "def" || key === "spd")) {
    let totalDelta = 0;
    activeConditionalMods(entity).forEach((m) => {
      if (!m.statMult) return;
      m.statMult.forEach((sm) => { if (sm.stat === key) totalDelta += (sm.mult - 1); });
    });
    if (totalDelta !== 0) result = Math.max(1, Math.round(result * (1 + totalDelta)));
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
  // 黒曜など: 特定ステータスへのデバフを完全に無効化する(誰が与えたデバフでも一律で弾く)
  if (mult < 1 && entity.passives && entity.passives.debuffImmuneStats && entity.passives.debuffImmuneStats.includes(stat)) return;
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
// bleed/poison/burnのうち、現在アクティブなDOT側の弱点定義にeffects(atkDown/defDown/spdDown、
// 図鑑エディタのチェックボックス)がstatKeyを含んでいれば true。旧tier1/2システムの後継
const WEAKNESS_EFFECT_STAT_MULT = 0.7; // -30%
function weaknessEffectActive(entity, statKey) {
  const checks = [
    { active: (entity.bleed || 0) > 0, w: enemyWeaknessType(entity, "bleed") },
    { active: (entity.poison || 0) > 0, w: enemyWeaknessType(entity, "poison") },
    { active: (entity.burnTurns || 0) > 0, w: enemyWeaknessType(entity, "burn") },
  ];
  return checks.some(({ active, w }) => active && w && w.effects && w.effects.includes(statKey));
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
}
// 毒: 自分のターンが来るたびに蓄積値分のダメージを受け、蓄積値が1減る(ダーケストダンジョン方式)。
// 毒弱点(bleed/burnと同じくENEMY_WEAKNESS)を持つ敵はダメージ2倍
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
// 技側の付与量を毒より低めに設定する運用にしてある(旧・出血中の攻撃力-10%一律補正は2026-07-30廃止)
function applyBleed(entity, stacks) {
  if (entity.statusImmuneTurns > 0) return;
  if (blockedByOmamoriIzanagi(entity)) return;
  // 2026-07-18ユーザー指示: 上限5を撤廃して天井なしの加算式に(毒と同じ扱い)
  entity.bleed = (entity.bleed || 0) + stacks;
}
// 出血弱点を持つ敵はダメージ2倍。effectsで指定した継続ステータスデバフはeffectiveStat側で別途処理する
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
  // ボス級は割合を8%→3%に下げる(弱点で2倍=6%。毒/出血のdotTickBossCap(6%)と同水準に収まる。
  // 以前はボスにも8%(弱点16%)がそのまま入っており、%DOTがボスHPプールに効きすぎていた)
  const pct = (entity.isBoss || entity.isMidBoss) ? BURN_DAMAGE_PCT_BOSS : BURN_DAMAGE_PCT;
  const dmg = Math.max(1, Math.round(entity.maxHp * pct * (w ? 2 : 1)));
  entity.hp = Math.max(0, entity.hp - dmg);
  log(`${entity.label}は炎上で${dmg}ダメージ！${w ? "(炎上は弱点！)" : ""}`);
  entity.burnTurns--;
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
  // 新しい間隔を1回抽選し直し、また一から仕切り直しにする(狙われていたターゲット予告も一緒に消す)
  if (entity.bigAttackPending) {
    entity.bigAttackPending = false;
    entity.bigAttackCountdown = rollBigAttackCountdown(entity);
    entity.bigAttackTelegraphTargetId = null;
  }
}
function applySilence(entity, turns) {
  if (entity.statusImmuneTurns > 0) return;
  if (blockedByOmamoriIzanagi(entity)) return;
  // 性格の癖「元より無口」(無口): もともと喋らないので黙らせようがない=沈黙が一切効かない
  const quirk = personalityQuirk(entity);
  if (quirk && quirk.silenceImmune) return;
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
// opts.skipDots: 毒/出血/炎上のダメージ適用だけを飛ばす(敵ターンのDOT停止演出(effects.jsの
// playEnemyDotStopSequence)が先にtickBurn等を1種類ずつ直接呼んで適用済みのケース用。
// 二重適用を防ぎつつ、DOT以外のターン開始処理はここに一本化したまま保つ、2026-07-31)
function tickTurnStartEffects(entity, log, opts) {
  if (entity.stunResistTurns > 0) entity.stunResistTurns--;
  const skipDots = !!(opts && opts.skipDots);
  const poisonDmg = skipDots ? 0 : tickPoison(entity, log);
  const burnDmg = skipDots ? 0 : tickBurn(entity, log);
  const bleedDmg = skipDots ? 0 : tickBleed(entity, log);
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
const ABILITY_MP_COST = { magicAttack: 2, magicAttackAll: 4, heal: 3, critAttack: 2, powerAttack: 3, physicalAttackAll: 3, preciseShot: 2, cannonShot: 4, guard: 1 };
function abilityMpCost(abilityType, actor) {
  // 変化の術で変身中はMPの概念が無くなる(かばう等も無料で使える)
  if (actor && actor.transformForm) return 0;
  // 残心: 敵を倒した直後の1回だけ、次に使う技のMP消費を0にする(消費判定はskillMpCost/呼び出し元で行う)
  if (actor && actor.nextSkillFreeMp) return 0;
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
  if (character.isClone || character.isShikigami) return; // 分身/式神は経験値を受け取らない(分身はclassIdを持つがCLASSES参照は意味を持たない一時オブジェクト、式神はclassId自体を持たない)
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
    mpDiscountPct: 0, mpDiscountFlat: 0, mpRefundChance: 0, // mpDiscountFlat: 技のMP消費から固定値を引く(%割引のmpDiscountPctとは別枠、加算式。陰陽極意など)
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
    flyingBonus: null, // {mult} 対象がisFlyingの間、与ダメージ倍率(隼落としなど)
    onCritSelfStackCritRate: 0, // 自分が会心を出すたびに、会心率がこの値だけ加算的に積み上がる(戦闘中ずっと持続、覇気など)
    onKillNextSkillFree: false, // 敵を倒した直後、次に使うスキルのMP消費が0になる(1回限り、残心など)
    counterCritRateAdd: 0, // 迎撃/反撃(counterChance)の反撃ダメージにこの値だけ会心率が上乗せされる(燕返しなど)
    counterDamageBonus: 0, // 迎撃/反撃(counterChance)のダメージ倍率にこの値を加算する(counterMultとは別枠、加算式。天衣無縫など)
    onRecallMpRestore: 0, // 式神を帰還させた瞬間、MPをこれだけ回復する(帰還)。未取得ならrecallShikigamiは無償だがMPは回復しない
    onConsecutiveSameTargetMp: 0, // 同じ敵に2回連続で通常攻撃するごとに、MPをこれだけ回復する(霊魂吸収)
    shikigamiProtect: false, // 自分の式神が場に出ている間、敵のランダム/単体大技のターゲットから除外される(式神の加護。挑発/かばうの引きつけは対象外)
    onShikigamiDownPartyHealPct: 0, // 自分の式神が力尽きた瞬間、味方全員のHPをこの割合だけ回復する(魂養術)
    bigAttackPendingDmgBonus: 0, // 大技予告中(bigAttackPending)の敵への追加ダメージ倍率(BIG_ATTACK_EXPOSED_BONUSとは別枠、加算式)
    evasionVsAilmentAdd: [], // [{ailment, add}] 特定の状態異常を負っている敵から攻撃される時、回避率がこの値だけ上がる(血痕追跡など)
    noCostSummonShikigami: false, // 式神召喚を使ってもターンを消費しない(神速召喚)。summonShikigami自体のaction.noCostは
    // 誰でも無条件になってしまうため付けず、battle.js側でこのフラグを見て個別に分岐する
    debuffImmuneStats: [], // ["atk"|"def"|"spd"] このステータスへのデバフを完全に無効化する(applyStatMod側で弾く。黒曜など)
  };
}

// ============ 追加の1枠(影分身/式神)============
// fieldParty(戦闘に出る枠)は通常3人までだが、忍者「影分身の術」・陰陽師「式神召喚」だけは一時的に1体を追加できる。
// 同時に存在できるのはどちらか1体まで(isClone/isShikigamiのどちらかが既にいたら新規召喚は弾く)。
// 忍者の隣に並ぶよう、pushではなく召喚者のすぐ後ろにspliceで挿入する
function insertNextToOwner(entity, owner) {
  const idx = fieldParty.indexOf(owner);
  fieldParty.splice(idx >= 0 ? idx + 1 : fieldParty.length, 0, entity);
}
// 影分身: HPは本体の最大HPの75%、MPは0(通常攻撃しか使わないため）。atk/def/spd/magは本体の「素の値」を
// そのままコピーし、passivesも本体のものを丸ごと複製することで、effectiveStat()側の通常の計算経路
// (statMods/passives.atkMult/conditionalMods等)がそのまま働き、本体が選んだ忍者のパッシブ全てが
// 分身にも正しく乗る(二重計上を避けるため、ここではeffectiveStat後の「実効値」ではなく素の値を渡す)。
// statusImmuneTurnsを非常に大きい値にすることで、既存の状態異常付与処理(apply系関数はどれも
// entity.statusImmuneTurns>0なら早期returnする)を素通りさせずに全て弾く
function makeCloneFor(actor) {
  const maxHp = Math.max(1, Math.round(actor.maxHp * 0.75));
  return {
    id: "clone" + (__cloneSeq++),
    isClone: true,
    ownerId: actor.id,
    classId: actor.classId,
    name: `${actor.name}の分身`,
    label: `${actor.name}の分身`,
    status: "active", fleeState: null,
    level: actor.level,
    maxHp, hp: maxHp,
    maxMp: 0, mp: 0,
    atk: actor.atk, def: actor.def, spd: actor.spd, mag: actor.mag,
    passives: Object.assign(initPassives(), JSON.parse(JSON.stringify(actor.passives || {}))),
    statMods: [], poison: 0, bleed: 0, burnTurns: 0, stunTurns: 0, silenceTurns: 0,
    statusImmuneTurns: 9999,
    fatigue: 0,
  };
}
// 陰陽師本人の現在レベルで召喚できる式神タイプの一覧(SHIKIGAMI_DEFSのunlockLevel<=owner.levelで絞り込み)。
// usedTypesを渡すと、この戦闘で既に召喚→帰還/消滅させたタイプを除外する(同じ戦闘での連続召喚禁止のため)
function unlockedShikigamiTypes(owner, usedTypes) {
  const used = usedTypes || owner.__usedShikigamiTypes || new Set();
  return Object.keys(SHIKIGAMI_DEFS).filter((key) => {
    const def = SHIKIGAMI_DEFS[key];
    if (def.unlockLevel != null && owner.level < def.unlockLevel) return false;
    if (used.has(key)) return false;
    return true;
  });
}
// 式神を生成する。ステータスはSHIKIGAMI_DEFS[typeKey]のhpFrom/atkFrom/spdFrom(術者の現在ステータス基準)から算出。
// iconImgがあればui.js側でそれを表示し、無ければemoji仮アイコンにフォールバックする
function makeShikigami(actor, typeKey) {
  const def = SHIKIGAMI_DEFS[typeKey];
  const maxHp = Math.max(1, def.hpFrom(actor));
  return {
    id: "skg" + (__shikigamiSeq++),
    isShikigami: true,
    shikigamiType: typeKey,
    ownerId: actor.id,
    name: def.name,
    label: def.name,
    emoji: def.emoji,
    iconImg: def.iconImg,
    isFlying: !!def.isFlying,
    status: "active", fleeState: null,
    level: actor.level,
    maxHp, hp: maxHp,
    maxMp: 0, mp: 0,
    atk: Math.max(1, def.atkFrom(actor)),
    def: 3,
    spd: Math.max(1, def.spdFrom(actor)),
    mag: 0,
    passives: initPassives(),
    statMods: [], poison: 0, bleed: 0, burnTurns: 0, stunTurns: 0, silenceTurns: 0,
    fatigue: 0,
    specialCooldown: 0, // 0=いつでも特技が使える状態。使用すると各タイプのcooldownturnsにリセットされる
  };
}
// 式神帰還: 戦闘中・探索中どちらからでも呼べる。MP消費0・ターン消費0で式神を消す。
// 「帰還」スキル(L4右、onRecallMpRestore)を選んでいる場合のみ、陰陽師のMPをその分回復する
// (以前は無条件でMP+1していたが、スキルツリーの正式な選択肢として切り出されたため取得者限定に変更)。
// 帰還したタイプはowner.__usedShikigamiTypesに記録し、同じ戦闘中は再召喚できないようにする
// (消滅=撃破された場合の記録はbattle.jsのhandleFieldDeaths側で行う)。
// battle.order(その場の手番リスト)がまだこの式神を参照していても、statusを"recalled"にしてから
// spliceすることで、同じ参照先オブジェクトのstatusチェック(processNext側)が手番を正しくスキップする
function recallShikigami(owner) {
  const idx = fieldParty.findIndex((c) => c.isShikigami && c.ownerId === owner.id);
  if (idx === -1) return false;
  const recalled = fieldParty[idx];
  recalled.status = "recalled";
  fieldParty.splice(idx, 1);
  owner.__usedShikigamiTypes = owner.__usedShikigamiTypes || new Set();
  if (recalled.shikigamiType) owner.__usedShikigamiTypes.add(recalled.shikigamiType);
  if (owner.passives && owner.passives.onRecallMpRestore) owner.mp = Math.min(owner.maxMp, owner.mp + owner.passives.onRecallMpRestore);
  return true;
}
// 麒麟(onSummon.kind:"aoeAttack")/龍神(onSummon.kind:"partySpdBuff")など、召喚した瞬間に自動発動する効果
function applyShikigamiOnSummon(shiki, owner, log) {
  const def = SHIKIGAMI_DEFS[shiki.shikigamiType];
  if (!def || !def.onSummon) return;
  const os = def.onSummon;
  if (os.kind === "aoeAttack") {
    const targets = typeof targetableEnemies === "function" ? targetableEnemies() : [];
    targets.forEach((t) => {
      const dmg = Math.max(1, Math.round(withVariance(shiki.atk * os.mult * mitigation(effectiveStat(t, "def"), 15), 0.15)));
      applyDamageToTarget(t, dmg, log, shiki.label, shiki, null, null, os.name);
      if (os.stunChance && Math.random() < os.stunChance) applyStun(t, 1);
    });
    if (targets.length) log(`${shiki.label}の${os.name}が炸裂した！`);
  } else if (os.kind === "partySpdBuff") {
    (owner.__allies || fieldParty.filter((c) => !c.isClone && !c.isShikigami)).forEach((c) => {
      if (c.status === "active") applyStatMod(c, "spd", 1 + os.mult, os.turns);
    });
    log(`${shiki.label}の${os.name}で味方全体の素早さが上がった！`);
  }
}
// 式神の自律行動を1ターン分解決する(battle.jsのisShikigami分岐から呼ばれる)。
// 戻り値のkindをbattle.js側が見て対応する演出(ポップアップ/SFX)を出す:
//   "none"(対象なしで何もしなかった) / "guard"(庇う構えを取った) / "attack"|"multiAttack"(通常/特技攻撃) /
//   "heal"(味方単体回復) / "shield"(味方単体に結界付与)
// 特技(special)はspecialCooldownが0の時だけ判定し、条件(allyHpBelowPct等)を満たせば発動してcooldownをリセットする。
// 条件を満たさない場合はcooldownを0のまま維持し(=毎ターン判定し続ける)、その代わりに通常行動を取る
function resolveShikigamiAction(actor, log) {
  const def = SHIKIGAMI_DEFS[actor.shikigamiType];
  if (!def) return { kind: "none" };
  const allies = (actor.__allies || fieldParty.filter((c) => !c.isClone)).filter((c) => c.status === "active" && c !== actor);
  const enemies = typeof targetableEnemies === "function" ? targetableEnemies() : [];
  if (actor.specialCooldown > 0) actor.specialCooldown--;
  // 龍神: 毎ターンHP回復(行動の成否とは独立して常に発動)
  let regen = 0;
  if (def.turnRegenPct && actor.hp > 0) {
    const before = actor.hp;
    actor.hp = Math.min(actor.maxHp, actor.hp + Math.max(1, Math.round(actor.maxHp * def.turnRegenPct)));
    regen = actor.hp - before;
  }
  // 紙人形: 味方にHP50%未満がいれば庇う(通常攻撃はしない)
  if (def.ai === "guardIfAllyLow") {
    if (allies.some((a) => a.hp / a.maxHp < 0.5)) {
      actor.guarding = true;
      actor.guardProtectCount = 0;
      log(`${actor.label}は仲間を庇う構えを取った！`);
      return { kind: "guard", regen };
    }
    return Object.assign(resolveShikigamiBasicAttack(actor, def, enemies, log), { regen });
  }
  if (def.special && actor.specialCooldown <= 0) {
    const result = tryShikigamiSpecial(actor, def, allies, enemies, log);
    if (result) return Object.assign(result, { regen });
  }
  return Object.assign(resolveShikigamiBasicAttack(actor, def, enemies, log), { regen });
}
// 妖狐/白鶴/龍神など通常時の単体攻撃、狛犬はbasicHits:2でランダムな敵へ連撃する
function resolveShikigamiBasicAttack(actor, def, enemies, log) {
  if (!enemies.length) return { kind: "none" };
  const hits = def.basicHits || 1;
  const results = [];
  for (let i = 0; i < hits; i++) {
    const pool = typeof targetableEnemies === "function" ? targetableEnemies() : enemies;
    if (!pool.length) break;
    const target = pool[Math.floor(Math.random() * pool.length)];
    const r = performAttack(actor, target, log);
    results.push({ target, dmg: r.dmg, hit: r.hit, crit: r.crit, hawkTargetId: r.hawkTargetId });
  }
  if (!results.length) return { kind: "none" };
  return hits > 1
    ? { kind: "multiAttack", hits: results }
    : { kind: "attack", target: results[0].target, dmg: results[0].dmg, hit: results[0].hit, crit: results[0].crit };
}
// 各式神の特技(special)を判定・実行する。条件を満たせなければnullを返し(cooldownは消費しない)、
// 呼び出し元(resolveShikigamiAction)が通常攻撃にフォールバックする
function tryShikigamiSpecial(actor, def, allies, enemies, log) {
  const sp = def.special;
  const rollSingleHit = (target, mult, bigAttackName) => {
    const dmg = Math.max(1, Math.round(withVariance(actor.atk * mult * mitigation(effectiveStat(target, "def"), 15), 0.15)));
    return applyDamageToTarget(target, dmg, log, actor.label, actor, null, null, bigAttackName);
  };
  if (sp.kind === "singleAttack") {
    if (!enemies.length) return null;
    const target = enemies[Math.floor(Math.random() * enemies.length)];
    const finalDmg = rollSingleHit(target, sp.mult, sp.name);
    if (sp.inflict) applyTreeInflict(target, sp.inflict, actor);
    actor.specialCooldown = sp.cooldown;
    log(`${actor.label}の${sp.name}！`);
    return { kind: "attack", target, dmg: finalDmg, hit: true, special: true };
  }
  if (sp.kind === "stunSingleAttack") {
    if (!enemies.length) return null;
    const target = enemies[Math.floor(Math.random() * enemies.length)];
    const finalDmg = rollSingleHit(target, sp.mult, sp.name);
    applyStun(target, 1);
    actor.specialCooldown = sp.cooldown;
    log(`${actor.label}の${sp.name}！`);
    return { kind: "attack", target, dmg: finalDmg, hit: true, special: true };
  }
  if (sp.kind === "healLowestAllyIfBelow") {
    const candidates = allies.filter((a) => a.hp / a.maxHp <= sp.allyHpBelowPct).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    if (!candidates.length) return null;
    const lowest = candidates[0];
    const heal = Math.max(1, Math.round(lowest.maxHp * sp.healPct));
    lowest.hp = Math.min(lowest.maxHp, lowest.hp + heal);
    actor.specialCooldown = sp.cooldown;
    log(`${actor.label}の${sp.name}！${lowest.label}のHPが回復した！`);
    return { kind: "heal", target: lowest, heal, special: true };
  }
  if (sp.kind === "shieldLowestAllyIfBelow") {
    const candidates = allies.filter((a) => a.hp / a.maxHp <= sp.allyHpBelowPct).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    if (!candidates.length) return null;
    const lowest = candidates[0];
    const owner = (actor.__allies && actor.__allies.find((c) => c.id === actor.ownerId)) || fieldParty.find((c) => c.id === actor.ownerId);
    const barrierHp = Math.max(1, Math.round((owner ? owner.maxHp : actor.maxHp) * sp.barrierPct));
    lowest.barrierHp = barrierHp;
    lowest.barrierMaxHp = barrierHp;
    actor.specialCooldown = sp.cooldown;
    log(`${actor.label}の${sp.name}！${lowest.label}に結界を付与した！`);
    return { kind: "shield", target: lowest, barrierHp, special: true };
  }
  if (sp.kind === "aoeSilence") {
    if (!enemies.length) return null;
    const hits = enemies.map((t) => {
      const finalDmg = rollSingleHit(t, sp.mult, sp.name);
      applySilence(t, sp.turns);
      return { target: t, dmg: finalDmg };
    });
    actor.specialCooldown = sp.cooldown;
    log(`${actor.label}の${sp.name}！`);
    return { kind: "multiAttack", hits, special: true };
  }
  return null;
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
    if (add.mpDiscountFlat) p.mpDiscountFlat += add.mpDiscountFlat;
    if (add.mpRefundChance) p.mpRefundChance = Math.min(0.6, p.mpRefundChance + add.mpRefundChance);
    if (add.onceGuardType) p.onceGuardType = add.onceGuardType;
    if (add.firstAttackBonusMult) p.firstAttackBonusMult = add.firstAttackBonusMult;
    if (add.onKill) p.onKill = add.onKill;
    if (add.conditionalMod) p.conditionalMods.push(add.conditionalMod);
    if (add.conditionalMods) add.conditionalMods.forEach((cm) => p.conditionalMods.push(cm)); // 1スキルで複数段のHP条件を同時に持たせたい場合(武士道など)
    if (add.onHitInflict) p.onHitInflicts.push(add.onHitInflict);
    if (add.executeBonus) p.executeBonus = add.executeBonus;
    if (add.executeCritBonus) p.executeCritBonus.push(add.executeCritBonus);
    if (add.woundBonus) p.woundBonuses.push(add.woundBonus);
    if (add.flyingBonus) p.flyingBonus = add.flyingBonus;
    if (add.flagMod) p.flagMods.push(add.flagMod);
    if (add.evadeCritCounter) p.evadeCritCounter = true;
    if (add.guardCounter) p.guardCounter = true;
    if (add.guardCritCounter) p.guardCritCounter = true;
    if (add.guardMpRefund) p.guardMpRefund = true;
    if (add.guardTurnFree) p.guardTurnFree = true;
    if (add.extraGuardMitigation) p.extraGuardMitigation *= add.extraGuardMitigation;
    if (add.onCritSelfBuff) p.onCritSelfBuff = add.onCritSelfBuff;
    // スキルエディタ差分2026-07-30で追加した新パッシブ群
    if (add.onDamagedAtkStack) p.onDamagedAtkStack = add.onDamagedAtkStack; // 武士道(被弾ごとに攻撃力スタック)
    if (add.bigAttackPendingCritAdd) p.bigAttackPendingCritAdd = add.bigAttackPendingCritAdd; // 必中撃ち(大技予告中の敵へ会心率+)
    if (add.onShootDownMpRestore) p.onShootDownMpRestore = add.onShootDownMpRestore; // 集中(打ち落とし発生時MP回復)
    if (add.onHitAilmentSelfSpdBuff) p.onHitAilmentSelfSpdBuff = add.onHitAilmentSelfSpdBuff; // 狩猟本能(状態異常の敵に攻撃で自分の素早さバフ)
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
    if (add.onCritSelfStackCritRate) p.onCritSelfStackCritRate += add.onCritSelfStackCritRate;
    if (add.onKillNextSkillFree) p.onKillNextSkillFree = true;
    if (add.counterCritRateAdd) p.counterCritRateAdd += add.counterCritRateAdd;
    if (add.counterDamageBonus) p.counterDamageBonus += add.counterDamageBonus;
    if (add.onRecallMpRestore) p.onRecallMpRestore += add.onRecallMpRestore;
    if (add.onConsecutiveSameTargetMp) p.onConsecutiveSameTargetMp += add.onConsecutiveSameTargetMp;
    if (add.shikigamiProtect) p.shikigamiProtect = true;
    if (add.onShikigamiDownPartyHealPct) p.onShikigamiDownPartyHealPct += add.onShikigamiDownPartyHealPct;
    if (add.bigAttackPendingDmgBonus) p.bigAttackPendingDmgBonus += add.bigAttackPendingDmgBonus;
    if (add.evasionVsAilmentAdd) p.evasionVsAilmentAdd.push(add.evasionVsAilmentAdd);
    if (add.noCostSummonShikigami) p.noCostSummonShikigami = true;
    if (add.debuffImmuneStats) add.debuffImmuneStats.forEach((s) => { if (!p.debuffImmuneStats.includes(s)) p.debuffImmuneStats.push(s); });
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
  // 性格の癖「どっしり構え」(のんびり): 受けるダメージが常時少しだけ下がる
  const quirk = personalityQuirk(character);
  if (quirk && quirk.dmgTakenMult) mult *= quirk.dmgTakenMult;
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
  // 性格の癖「減らず口」(生意気): 会心率が常時少しだけ上がる
  const quirk = personalityQuirk(actor);
  const quirkCritAdd = (quirk && quirk.critRateAdd) || 0;
  // 必中撃ち(スキルエディタ2026-07-30): 大技予告中(bigAttackPending)の敵への追加会心率
  const bigAtkPendingCritAdd = p.bigAttackPendingCritAdd > 0 && target && target.bigAttackPending ? p.bigAttackPendingCritAdd : 0;
  const rate = BASE_CRIT_RATE + p.critRateAdd + tempCritRateAdd + onsenCritBonus + executeCritAdd + ailmentCritAdd + debuffCritAdd + allyGuardCritAdd + (extraCritRate || 0) + (actor.hagakiCritStack || 0) + quirkCritAdd + bigAtkPendingCritAdd;
  if (Math.random() < rate) return BASE_CRIT_DMG_MULT + p.critDmgAdd + tempCritDmgAdd;
  return 1;
}
// スキルツリーの技のMPコストに、そのキャラのMP割引を適用する
function skillMpCost(actor, baseMp, action) {
  // 変化の術で変身中はMPの概念自体が無くなる(変身をかけるための消費自体はtransformFormがまだnullの
  // 状態で判定されるため、ここでの0化は「変身後の他の技」向けの安全策)
  if (actor.transformForm) return 0;
  // 残心: 敵を倒した直後の1回だけ、次に使う技のMP消費を0にする
  if (actor.nextSkillFreeMp) return 0;
  let discount = (actor.passives && actor.passives.mpDiscountPct) || 0;
  // 温泉バフ「英気充填」: MP消費-10%(他の割引と乗算ではなく加算で重ねる)
  if (actor.onsenBuffKey === "eikijuten") discount += 0.1;
  // 特定のstatMod(土嚢展開のreloadImmuneなど)が有効な間だけ追加割引(装填術など)
  if (actor.passives && actor.passives.discountWhileFlag && actor.statMods) {
    const d = actor.passives.discountWhileFlag;
    if (actor.statMods.some((m) => m.stat === d.statModName)) discount += d.pct;
  }
  let flat = (actor.passives && actor.passives.mpDiscountFlat) || 0;
  // 明鏡止水中: 心眼のMP消費-1(ユーザー仕様2026-07-30。actionは呼び出し元が任意で渡す)
  if (action && action.kind === "guardCounterSelf" && actor.meikyoTurns > 0) flat += 1;
  return Math.max(0, Math.round(baseMp * (1 - discount)) - flat);
}

// 侍の変身/構え(鬼神化・明鏡止水)のターン経過。自分のターンの頭でbattle.jsが呼ぶ。
// 発動ターンを1ターン目と数え、設定ターン数ぶん行動したら次の自分のターンの頭で解ける
function tickSamuraiForms(actor, log) {
  if (actor.meikyoTurns > 0) {
    actor.fatigue = Math.max(0, (actor.fatigue || 0) - 1); // 毎ターンストレスを1回復
    actor.meikyoTurns--;
    if (actor.meikyoTurns === 0) log(`${actor.label}の明鏡止水が静かに解けた。`);
  }
  if (actor.kishinTurns > 0) {
    actor.kishinTurns--;
    if (actor.kishinTurns === 0) log(`${actor.label}の鬼の力が抜けていった…`);
  }
}
// 状態異常の付与確率に、対象の耐性(statusResistMult)を適用する。
// typeが"stun"かつ対象がスタン抵抗中(stunResistTurns>0、直近でスタンされた直後)の場合は、
// 通常のstatusResistMultとは別枠でさらに大きく確率を下げる(連続スタンロック防止)
function resistedChance(target, baseChance, type) {
  let resist = (target.passives && target.passives.statusResistMult) || 0;
  // 性格の癖「動じない」(冷静): 状態異常全般にかかりにくい
  const quirk = personalityQuirk(target);
  if (quirk && quirk.statusResistAdd) resist += quirk.statusResistAdd;
  // 温泉バフ「美肌」: 状態異常耐性+20%
  if (target.onsenBuffKey === "bihada") resist += 0.2;
  let chance = baseChance * (1 - resist);
  if (type === "stun" && target.stunResistTurns > 0) chance *= STUN_RESIST_MULT;
  return chance;
}

// スキルツリー技のaction.inflict1件ぶんを判定して適用する。action.inflictは単一オブジェクトでも
// 配列(複数の状態異常を同時に付与、水遁符など)でも渡せる。会心/毒/出血の値・炎上のターン数は
// value/turnsの固定値だけでなくvalueMin/valueMax・turnsMin/turnsMaxのランダム範囲にも対応する
function applyTreeInflict(t, inflict, actor) {
  if (!inflict) return;
  const list = Array.isArray(inflict) ? inflict : [inflict];
  const izanamiBoost = list.some((inf) => inf.type === "poison" || inf.type === "bleed") && consumeOmamoriIzanami(actor) ? 2 : 0;
  list.forEach((inf) => {
    if (Math.random() >= resistedChance(t, inf.chance, inf.type)) return;
    if (inf.type === "poison") applyPoison(t, resolveValue(inf, 3) + izanamiBoost);
    if (inf.type === "bleed") applyBleed(t, resolveValue(inf, 2) + izanamiBoost);
    if (inf.type === "burn") applyBurn(t, resolveTurns(inf));
    if (inf.type === "stun") applyStun(t, inf.turns || 1);
    if (inf.type === "silence") applySilence(t, inf.turns || 2);
    if (inf.type === "atkDown") applyStatMod(t, "atk", 1 - (inf.value || 0.2), inf.turns || 3);
    if (inf.type === "defDown") applyStatMod(t, "def", 1 - (inf.value || 0.2), inf.turns || 3);
    if (inf.type === "spdDown") applyStatMod(t, "spd", 1 - (inf.value || 0.2), inf.turns || 3);
    if (inf.type === "dmgTakenUp") applyStatMod(t, "dmgTaken", 1 + (inf.value || 0.1), inf.turns || 3);
    // 水月(改)など: この攻撃を受けた敵1体だけを、一定ターンの間ずっとactor(術者)に狙わせる
    if (inf.type === "forceTarget") { t.forcedTargetId = actor.id; t.forcedTargetTurns = inf.turns || 2; }
    // 迅雷突き/鎧砕きなど: 使うたびに防御デバフが蓄積する(maxStacksで頭打ち)
    if (inf.type === "defDownStack") applyStackingStatMod(t, "spearDefDownStack", "def", -(inf.value || 0.2), inf.maxStacks || 2, inf.turns || 3);
  });
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
  const cost = skillMpCost(actor, skill.mp, skill.action);
  if (actor.nextSkillFreeMp) actor.nextSkillFreeMp = false; // 残心: 次に使う技1回だけ無償化、ここで消費する
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
  // 影分身の術(忍者)/式神召喚(陰陽師): 追加の1枠はどちらか1体まで(既に出ていたら弾く)
  if (action.kind === "summonClone") {
    if (fieldParty.some((c) => c.isClone || c.isShikigami)) { log(`これ以上仲間を呼び出せない！`); return { failed: true }; }
    insertNextToOwner(makeCloneFor(actor), actor);
    log(`${actor.label}は${skill.name}を唱えた！`);
    return { summoned: true };
  }
  if (action.kind === "summonShikigami") {
    // 式神召喚自体のmp消費は0固定(skill.mp)で、実際のコストは選んだ式神の種類ごとに個別にかかる。
    // battle.js側のタイプ選択ピッカーがtarget引数の位置にtypeKey(文字列)を渡す呼び出し規約
    if (fieldParty.some((c) => c.isClone || c.isShikigami)) { log(`これ以上仲間を呼び出せない！`); return { failed: true }; }
    const typeKey = target;
    const skDef = SHIKIGAMI_DEFS[typeKey];
    if (!skDef) { log(`式神の種類が正しく選ばれていない！`); return { failed: true }; }
    if (actor.mp < skDef.mp) { log(`${actor.label}はMPが足りない！`); return { failed: true }; }
    actor.mp -= skDef.mp;
    const shiki = makeShikigami(actor, typeKey);
    insertNextToOwner(shiki, actor);
    log(`${actor.label}は${skDef.name}を呼び出した！`);
    applyShikigamiOnSummon(shiki, actor, log);
    return { summoned: true, shikigami: shiki };
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
  // 結界術: 味方単体に、術者の最大HPの一定割合ぶんの数値シールド(barrierHp)を付与する。
  // 既に結界が残っている場合は上書き(重ね掛けで際限なく増えないよう、applyStatModと同じ思想)
  if (action.kind === "shieldAlly") {
    const barrierHp = Math.max(1, Math.round(actor.maxHp * (action.barrierPct || 0.5)));
    target.barrierHp = barrierHp;
    target.barrierMaxHp = barrierHp;
    log(`${actor.label}は${target.label}に${skill.name}をかけた！(結界HP${barrierHp})`);
    return { shielded: true, barrierHp };
  }
  // 憑依: 自分の式神を消滅させ(帰還のMP回復は発生しない)、敵単体の攻撃力をこのターンの間半減させる
  if (action.kind === "dismissShikigamiDebuff") {
    const idx = fieldParty.findIndex((c) => c.isShikigami && c.ownerId === actor.id);
    if (idx === -1) { log(`${actor.label}には式神がいない！`); return { failed: true }; }
    fieldParty[idx].status = "recalled";
    fieldParty.splice(idx, 1);
    applyStatMod(target, "atk", 1 - (action.value || 0.5), action.turns || 1);
    log(`${actor.label}は式神を消し去り、${target.label}に${skill.name}をかけた！`);
    return { debuffed: true };
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
  // 鬼神化(2026-07-30): 遠征中一度だけの変身。全快+全状態異常解除+ストレス+100(発動時に即座に乗るが、
  // 鬼神化中はストレスの影響を受けない=解けた後に一気に重さが来るデザイン、ユーザー確定)。
  // ターン消費なし(battle.js側がnoCostで行動選択へ戻す)。戦闘終了で必ず解除(clearBattleTransientForms)
  if (action.kind === "kishinka") {
    actor.kishinkaUsed = true;
    actor.kishinTurns = action.turns || 5;
    actor.hp = actor.maxHp;
    actor.poison = 0; actor.burnTurns = 0; actor.bleed = 0; actor.stunTurns = 0; actor.silenceTurns = 0;
    actor.fatigue = Math.min(FATIGUE_MAX, (actor.fatigue || 0) + 100);
    log(`${actor.label}は鬼の力を解放した！傷が癒え、目が赤く染まっていく…！`);
    return { buffed: true };
  }
  if (action.kind === "buffSelf" || action.kind === "buffParty" || action.kind === "buffPartyConsumeItem" || action.kind === "buffPartyNoCost") {
    if (action.kind === "buffPartyConsumeItem") state.inventory[action.item]--;
    // 明鏡止水/百花繚乱(2026-07-30): statMods以外の状態フラグもここで立てる
    if (action.meikyo) actor.meikyoTurns = action.turns || 3;
    if (action.hyakka) actor.hyakkaActive = true;
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
      // 影分身はいずれの方法でも回復不可(呪文/アイテム共通の安全弁。UI側の対象一覧でも別途除外済み)
      if (t.isClone) { log(`${t.label}は分身のため回復できない！`); return { target: t, heal: 0 }; }
      if (t.isShikigami) { log(`${t.label}は式神のため回復できない！`); return { target: t, heal: 0 }; }
      const bonusMult = healBonusMultiplier(actor, t, !!action.cleanse);
      const heal = Math.round(applyOnsenHealBonus(t, Math.max(1, Math.round(t.maxHp * action.healPct))) * bonusMult);
      // reviveHpPct(蘇生系)は瀕死廃止(戦闘不能=即ロスト)により蘇生対象が存在しなくなったため、
      // 通常の回復としてだけ機能する(スキル自体の整理はスキル棚卸しの際に行う)
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
      applyTreeInflict(t, action.inflict, actor);
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
  // 迅雷突き(pickTargets:2)は呼び出し元が選んだ対象の配列をそのまま渡してくる(同じ敵2回も可)
  const targets = action.aoe ? target : (Array.isArray(target) ? target : [target]);
  const skillRange = skillRangeType(actor, skill);
  // 千本桜(scalingPerHitMult): この戦闘で敵に命中させた回数(__battleHitCount)に応じて威力が積み上がる。
  // 倍率はこの技自身のヒットで増える前の値で固定する(ループ前に1回だけ計算)
  let actionMult = action.mult;
  if (action.scalingPerHitMult) {
    actionMult += Math.min(action.scalingMaxHits || 30, actor.__battleHitCount || 0) * action.scalingPerHitMult;
  }
  // hitChance: 通常のrollHit(相手の回避率で変動)を使わず、固定の命中率で判定したい技用
  // (痺れ矢・豪雨など、命中率とスタン率を独立した数値としてユーザーが明示指定したい場合に使う)
  const rolledHit = (t) => {
    if (action.guaranteedHit) return true;
    if (action.hitChance != null) return Math.random() < action.hitChance;
    return rollHit(actor, t, skillRange);
  };
  const results = targets.map((t) => {
    // 迅雷突きで同じ敵を2回選び、1発目で倒した場合など: 既に倒れている対象への振りは空振り扱い
    if (t.hp <= 0) return { hit: false, dmg: 0, crit: false, hawkTargetId: null };
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
      let rawHit = Math.max(1, Math.round(withVariance(atkStat * (actionMult / hits) * mitigation(def, 15), 0.15)));
      const hpPct = t.maxHp > 0 ? t.hp / t.maxHp : 1;
      if (action.executeBonus && hpPct <= action.executeBonus.belowPct) rawHit = Math.round(rawHit * action.executeBonus.mult);
      const hitLogLines = [];
      const hitLog = deferHitLog ? (msg) => hitLogLines.push(msg) : log;
      // 鬼神斬りなど: action.extraCritRateで追加会心率を乗せられる
      const dmg = applyDamageToTarget(t, rawHit, hitLog, actor.label, actor, null, action.extraCritRate || null, null, action.useMag);
      // 鬼神斬り(lifestealPct): 与えたダメージの一部を吸収して回復する
      if (action.lifestealPct && dmg > 0 && actor.hp > 0) {
        const drained = Math.max(1, Math.round(dmg * action.lifestealPct));
        actor.hp = Math.min(actor.maxHp, actor.hp + drained);
        hitLog(`${actor.label}は${drained}のHPを吸収した！`);
      }
      const crit = lastHitWasCrit; // このヒット固有の会心判定を確保しておく(この後のデバフ付与処理はlastHitWasCritに影響しない)
      if (crit) anyCrit = true;
      totalDmg += dmg;
      // 全体攻撃には乗せない(全ての敵に追撃が入ると強すぎるため)。対象を倒していれば鷹は別の敵をランダムに狙う
      const hawkTarget = !action.aoe ? maybeHawkFollowup(actor, t, hitLog) : null;
      hitsList.push({ dmg, crit, logLines: hitLogLines });
      if (hawkTarget) hawkTargetIds.push(hawkTarget.instanceId);
    }
    applyTreeInflict(t, action.inflict, actor);
    // 水月など: 敵の自己強化(攻撃力/防御力/素早さの上昇、被ダメージ軽減)だけを解除する。デバフは残す
    if (action.dispelTargetBuffs && t.statMods) {
      t.statMods = t.statMods.filter((m) => !((["atk", "def", "spd"].includes(m.stat) && m.mult > 1) || (m.stat === "dmgTaken" && m.mult < 1)));
    }
    const shotDown = maybeShootDown(actor, t, action);
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
// 大技が来るまでの残りターン数を、敵ごとの間隔設定(bigAttackCycle: {min, max, instant}、
// data.js側で敵ごとに個別指定。未設定なら全敵共通デフォルトBIG_ATTACK_CYCLE_LENGTHの固定間隔)から
// 1回分だけ抽選する。最短〜最長(最低1)の範囲でランダムな間隔を選び、そこから「発動ターン自体」の
// 1を引いた値がカウントダウンの初期値になる(残り1で予告、残り0で発動)。
// 2026-07-28にavg±variance方式から最短/最長の直接指定へ変更(「5〜7ターンおき」のような指定を可能に、
// ユーザー要望)。エディタの古いエクスポート(avg/variance)が貼られても読めるよう後方互換を残してある
function rollBigAttackCountdown(def) {
  const cfg = def && def.bigAttackCycle;
  let lo, hi;
  if (cfg && cfg.min != null) {
    lo = Math.max(1, cfg.min);
    hi = Math.max(lo, cfg.max != null ? cfg.max : cfg.min);
  } else {
    const avg = cfg && cfg.avg != null ? cfg.avg : BIG_ATTACK_CYCLE_LENGTH;
    const variance = (cfg && cfg.variance) || 0;
    lo = Math.max(1, avg - variance);
    hi = Math.max(lo, avg + variance);
  }
  const interval = lo + Math.floor(Math.random() * (hi - lo + 1));
  return interval - 1;
}
// ENEMIESカタログの素の1体(pick)から、実際の戦闘インスタンス(instanceId付与)を作る。
// hp/atk/defは全てENEMIES側に「実戦でそのまま使う最終値」として直接書かれているため、
// ここでの追加スケーリングは一切行わない(旧ENEMY_SCALE等の倍率は廃止し、生値へ織り込み済み)。
// 通常抽選(pickEnemyForFloor)と、緊急依頼専用の狙い撃ちスポーン(instantiateEnemyById)の両方から使う共通処理
function instantiateEnemy(pick) {
  const hp = pick.hp;
  // 【予告なし大技は全面禁止(2026-08-02ユーザー指示「予告のターンには必ず短冊と溜めモーション。
  // 1ターン目でも例外ではない」)】初期カウントは必ず1以上=どの敵も発動の前に必ず「構え」の
  // 予告ターン(赤オーラ+震え+技名短冊)を1回挟む。instant指定(化け茸の奇襲)は「初手が予告」の
  // 最速値1として扱い、発動は最短でも2手番目。通常の敵はサイクル間隔を1回抽選し、その中の
  // ランダムな初期位相(1以上)にずらす(同種の敵が複数体並んだ時の同時予告/発動を防ぐため)
  const instant = pick.bigAttackCycle && pick.bigAttackCycle.instant;
  const initialCountdown = instant ? 1 : Math.max(1, Math.floor(Math.random() * (rollBigAttackCountdown(pick) + 1)));
  // extraBigAttacksを持つボス/中ボスは、初手のローテーション位置もランダムにする
  // (同じボスと何度戦っても毎回同じ技から始まる単調さを避けるため)
  const extraCount = pick.extraBigAttacks ? pick.extraBigAttacks.length : 0;
  const initialBigAttackIndex = extraCount > 0 ? Math.floor(Math.random() * (extraCount + 1)) : 0;
  // 設定画面の「高耐久モード」: 防御力アップ(defBonusPct)は敵の防御力にその値を直接加算し(乗算ではない。
  // 例: def15の敵にdefBonusPct20を選ぶとdef35になる。defは被ダメ軽減%そのものの値のため)、
  // 攻撃力ダウン(atkReductionPct)は敵の攻撃力にその割合を掛けて減らす(乗算。例: 20を選ぶと攻撃力×0.8)。
  // 2つは独立した設定で、どちらも0なら無効(お試し高難易度/低難易度化設定)。
  // atk/defは全ての戦闘計算式がenemy.atk/target.defとして生値のまま直接参照するため、
  // effectiveStat側ではなくここ(スポーン時点)で織り込むのが確実
  const defBonusPct = state.highDurabilityDefBonusPct || 0;
  const atkReductionPct = state.highDurabilityAtkReductionPct || 0;
  const atk = atkReductionPct > 0 ? Math.max(1, Math.round(pick.atk * (1 - atkReductionPct / 100))) : pick.atk;
  const def = defBonusPct > 0 ? pick.def + defBonusPct : pick.def;
  // (旧・透過立ち絵のテストモード限定差し替えは2026-08-01の本採用でENEMIES定義へ焼き込み済み。
  //  image/frameless/spriteScaleは...pickのスプレッドでそのまま流れる)
  return {
    ...pick,
    instanceId: "e" + __enemySeq++,
    label: pick.ja,
    hp,
    maxHp: hp,
    atk,
    def,
    bigAttackCountdown: initialCountdown,
    bigAttackPending: false,
    bigAttackIndex: initialBigAttackIndex,
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
      // 大群(isSwarm)は頭数ナーフの完全対象外(2026-07-28ユーザー指示。以前は効き半分だった)。
      // 「元から弱い代わりに数で来る」のが大群の設計で、カタログHP=実戦HPになることで
      // 敵エディタでの確殺ライン調整(例: こうもり13=薙ぎ払いほぼ2確)がそのまま実戦に効く
      if (e.isSwarm) return;
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
  const reward = enemy.isBoss ? base : Math.round(base * TRASH_MOB_GOLD_MULT);
  // 設定画面の「金調整」: 敵1体ごとに選んだ額(1〜10)を定額で差し引く。ボスにも適用、0未満にはしない
  return Math.max(0, reward - (state.goldDropAdjustment || 0));
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
  // 性格の癖「用心深い」(怖がり): 戦闘の最初のラウンドだけ回避が上がる(様子を見ながら戦い始める)
  const quirk = personalityQuirk(entity);
  const firstRoundAdd = quirk && quirk.firstRoundEvasionAdd && typeof battle !== "undefined" && battle && battle.roundsTotal <= 1 ? quirk.firstRoundEvasionAdd : 0;
  const flyingAdd = entity.isFlying ? FLYING_EVASION_BONUS : 0; // 飛行(🪽)の敵は空中にいる分、素早さ由来の回避率とは別に+5%
  // 忍足など: その戦闘で初めて敵に攻撃を受けるまで回避率が上がる(hasBeenHitThisBattleはapplyDamageToTarget側で実際に被弾した時に立てる)
  const preFirstHitAdd = entity.passives && entity.passives.preFirstHitEvasionAdd && !entity.hasBeenHitThisBattle ? entity.passives.preFirstHitEvasionAdd : 0;
  return Math.min(0.9, base + passiveAdd + timedAdd + condAdd + fleeingAdd + flyingAdd + preFirstHitAdd + firstRoundAdd);
}
function accuracyOf(entity, target) {
  const base = entity.accuracy != null ? entity.accuracy : BASE_ACCURACY;
  let addTotal = (entity.passives && entity.passives.accuracyAdd) || 0;
  // 性格の癖「丁寧な仕事」(真面目): 命中が常時少しだけ上がる
  const quirk = personalityQuirk(entity);
  if (quirk && quirk.accuracyAdd) addTotal += quirk.accuracyAdd;
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
const FLYING_MELEE_ACCURACY_PENALTY = 0.20; // 0.25→0.20(2026-08-01ユーザー指示でナーフ)
const FLYING_EVASION_BONUS = 0.05; // 飛行の敵自身の回避率+5%(素早さ由来の回避とは別枠、遠距離攻撃にも効く)
const FLYING_MIN_HIT_CHANCE = 0.10; // 通常のMIN_HIT_CHANCEより低い専用の下限(飛行を狙い撃ちする近接が機能しなくなりすぎないよう最低限だけ確保)
// 狩人/砲術士が飛行の敵に攻撃を命中させた時、この確率で「撃ち落とす」(以後isFlyingが解除され近接も当てやすくなる)
const SHOOT_DOWN_CHANCE = 0.8;
function canTriggerShootDown(actor, action) {
  return actor.classId === "hunter" || actor.classId === "gunner" || !!(action && action.canShootDown);
}
function maybeShootDown(actor, target, action) {
  if (!canTriggerShootDown(actor, action) || !target.isFlying) return false;
  if (Math.random() >= SHOOT_DOWN_CHANCE) return false;
  target.isFlying = false;
  applyStun(target, 1); // 撃ち落とした敵は1ターンだけ地に落ちて怯む(スタン)
  // 集中(onShootDownMpRestore、スキルエディタ2026-07-30): 打ち落としが発生した時、自分のMPを回復する
  if (actor.passives && actor.passives.onShootDownMpRestore > 0 && actor.maxMp > 0) {
    actor.mp = Math.min(actor.maxMp, actor.mp + actor.passives.onShootDownMpRestore);
  }
  return true;
}
// 命中判定。相手の回避率でどれだけ削られてもMIN_HIT_CHANCE未満にはならない(かわされ過ぎるストレスを避けるため)。
// スキルツリーの「完全回避」系受動(見切り・分身など)は、この命中率とは別枠の追加判定として先に効く
function rollHit(actor, target, rangeType) {
  let dodge = (target.passives && target.passives.dodgeChance) || 0;
  if (target.statMods) target.statMods.forEach((m) => { if (m.stat === "dodgeChance") dodge += m.mult; });
  if (dodge > 0 && Math.random() < dodge) return false;
  // 血痕追跡など: 攻撃者が特定の状態異常を負っている時、対象の回避率が上がる
  let extraEvasion = 0;
  if (target.passives && target.passives.evasionVsAilmentAdd && target.passives.evasionVsAilmentAdd.length) {
    target.passives.evasionVsAilmentAdd.forEach((ev) => { if (hasSpecificAilment(actor, ev.ailment)) extraEvasion += ev.add; });
  }
  let chance = Math.max(MIN_HIT_CHANCE, Math.min(0.99, accuracyOf(actor, target) - evasionChance(target) - extraEvasion));
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
function performAttack(actor, target, log, opts) {
  // 出血中の対象かどうかは攻撃前(=この攻撃自身の効果が乗る前)の状態で判定する
  const wasBleeding = (target.bleed || 0) > 0;
  const hpBeforeHit = target.hp; // 貫き矢(通常攻撃のオーバーキル貫通)判定用
  // opts.atkMult: 形見「うつろの狐面」の2回攻撃(威力50%×2)など、通常攻撃の1振りの威力を割り引く時に使う。
  // ダメージ式はatkに線形(atk×mitigation)なので、atkに掛ければそのまま威力倍率になる
  const atkMult = (opts && opts.atkMult) || 1;
  const result = rollAttackOrMiss(actor, target, () => rollBasicAttack(Math.max(1, Math.round(effectiveStat(actor, "atk") * atkMult)), target.def), log, undefined, normalAttackRangeType(actor));
  // ヘビに変身中は、通常攻撃が命中すると確実に毒3を付与する
  if (result.hit && actor.transformForm === "hebi") applyPoison(target, 3);
  // 狩人「追い討ち」: 出血中の敵への通常攻撃が命中すると、出血スタックを3追加する
  if (result.hit && wasBleeding && actor.passives && actor.passives.bleedFollowupOnHit && target.hp > 0) applyBleed(target, 3);
  // 狩人「貫き矢」: 通常攻撃で敵を倒した時だけ発動する(ダメージ倍率は据え置き、通常攻撃そのものは強化しない)
  if (result.hit && actor.passives && actor.passives.overkillPierce) applyOverkillPierce(target, hpBeforeHit, result.dmg, log, actor);
  // 陰陽師「霊魂吸収」: 同じ敵に2回連続で通常攻撃するごとにMP回復。命中したかどうかは問わず「同じ相手を狙い続けた」時点でカウントする
  if (actor.passives && actor.passives.onConsecutiveSameTargetMp && target.instanceId !== undefined) {
    if (actor.__lastNormalAtkTargetId === target.instanceId) actor.__consecutiveNormalAtkCount = (actor.__consecutiveNormalAtkCount || 0) + 1;
    else { actor.__lastNormalAtkTargetId = target.instanceId; actor.__consecutiveNormalAtkCount = 1; }
    if (actor.__consecutiveNormalAtkCount >= 2) {
      actor.mp = Math.min(actor.maxMp, actor.mp + actor.passives.onConsecutiveSameTargetMp);
      actor.__consecutiveNormalAtkCount = 0;
    }
  }
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
  // 【村襲撃/大規模戦】バリケードが立っている間、飛行以外の敵→味方の攻撃は全てバリケードが肩代わりする
  // (ユーザー確定仕様2026-07-27: 全肩代わり。攻撃ごと受け止めるため付随する状態異常も味方には届かない)。
  // raidBarricadeHpは通常プレイでは常に0なので、襲撃時以外この分岐は素通りする
  if (actor && actor.instanceId !== undefined && target.instanceId === undefined && !actor.isFlying && typeof raidBarricadeHp !== "undefined" && raidBarricadeHp > 0) {
    applyRaidBarricadeDamage(dmg);
    return 0;
  }
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
  // 形見「逆月の鏡片」: 分離した影が、敵からの次の攻撃1回を身代わりで無効化する(戦闘中のみ、反撃なし)。
  // 忍者の身代わりの術(migawariShieldActive)と同じ「完全無効化」枠だが、由来が別のため独立フラグで持つ
  if (actor && actor.instanceId !== undefined && target.katamiShadowGuard) {
    target.katamiShadowGuard = false;
    log(`${target.label}の影が${actorLabel}の攻撃を受け止め、静かに散った！`);
    return 0;
  }
  // 身代わりの術: 次に受ける攻撃を(全体攻撃を含め)完全に無効化する。反撃は無い、心眼の構えとは別枠
  if (actor && target.migawariShieldActive) {
    target.migawariShieldActive = false;
    log(`${target.label}は${actorLabel}の攻撃を身代わりの術で無効化した！`);
    return 0;
  }
  // 心眼の構えなど: 「このターン」限定で、敵の攻撃を1度だけ完全に無効化してその場で反撃する
  if (actor && target.nullifyCounterTurnsLeft > 0) {
    // 武士道(onDamagedAtkStack): 心眼でダメージを0化した被弾でも「敵からダメージを受けた」扱いで
    // スタックが増える(ユーザー指定「(武士道は蓄積する)」)。通常被弾側の加算は下の実ダメージ適用部
    if (actor.instanceId !== undefined && target.passives && target.passives.onDamagedAtkStack) {
      const b = target.passives.onDamagedAtkStack;
      applyStackingStatMod(target, "bushido", "atk", b.perStack, b.maxStacks, 99);
    }
    // 天衣無縫(counterDamageBonus)など: 反撃系スキル全般に加算で乗る想定のため、心眼の反撃倍率にもここで足す
    const counterMult = (target.nullifyCounterMult || 0.8) + (target.passives && target.passives.counterDamageBonus || 0);
    target.nullifyCounterTurnsLeft = 0;
    target.nullifyCounterMult = null;
    // 防御力は他の「威力X%」スキルと同じmitigation(K=15)方式で減算する(以前は「def×0.5を定額で引く」
    // 方式だったため、槍士のように素のatkが低いクラスは防御力の高い敵相手だと常に最低保証の1ダメージに
    // 張り付いてしまっていた。ユーザー指摘により修正)
    const counterDmg = Math.max(1, Math.round(effectiveStat(target, "atk") * counterMult * mitigation(effectiveStat(actor, "def"), 15)));
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
  // 性格の戦闘癖(PERSONALITY_QUIRKS): 熱血「危地で燃える」=自分のHPが低い間の与ダメ増、
  // お調子者「ノリで戦う」=会心を出した次の自分のターンの与ダメ増(下のstatMod "quirkNoriDmg"を参照)
  if (actor) {
    const actorQuirk = personalityQuirk(actor);
    if (actorQuirk && actorQuirk.lowHpDmg && actor.maxHp > 0 && actor.hp / actor.maxHp <= actorQuirk.lowHpDmg.belowPct) {
      dmg = Math.round(dmg * actorQuirk.lowHpDmg.mult);
    }
    if (actor.statMods) {
      actor.statMods.forEach((m) => { if (m.stat === "quirkNoriDmg") dmg = Math.round(dmg * m.mult); });
    }
  }
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
  // 飛行の敵への追加ダメージ倍率(隼落としなど)
  if (actor && actor.passives && actor.passives.flyingBonus && target.isFlying) {
    dmg = Math.round(dmg * actor.passives.flyingBonus.mult);
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
    // 性格の癖「ノリで戦う」(お調子者): 会心を出すと次の自分の1ターンだけ与ダメージが上がる
    // (連斬のonCritSelfBuffと同じturns:2方式。statMod "quirkNoriDmg"は上の与ダメ計算部が参照する)
    if (lastHitWasCrit) {
      const critQuirk = personalityQuirk(actor);
      if (critQuirk && critQuirk.afterCritDmg) applyStatMod(actor, "quirkNoriDmg", critQuirk.afterCritDmg.mult, 2);
    }
    // 覇気: 自分が会心を出すたびに、会心率が加算的に積み上がる(戦闘中ずっと持続)
    if (lastHitWasCrit && actor.passives && actor.passives.onCritSelfStackCritRate) {
      actor.hagakiCritStack = (actor.hagakiCritStack || 0) + actor.passives.onCritSelfStackCritRate;
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
  // 大技の構え中(bigAttackPending)の敵は隙だらけとみなし、受けるダメージが増える(押し切る対抗策)。
  // 全員共通の底上げ(BIG_ATTACK_EXPOSED_BONUS)に、狩人「連射の心得」改め新スキルの追加ボーナスを
  // 加算する(乗算の重ねがけで複利にならないよう、どちらも「+◯%」の差分としてまとめて1回だけ乗算する)
  if (target.bigAttackPending) {
    const bonus = (BIG_ATTACK_EXPOSED_BONUS - 1) + (actor && actor.passives && actor.passives.bigAttackPendingDmgBonus ? actor.passives.bigAttackPendingDmgBonus : 0);
    dmg = Math.round(dmg * (1 + bonus));
  }
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
  // 結界術(barrierHp): 陰陽師が付与した数値シールドが残っていれば先にそこから減算し、残りだけHPに通す
  if (target.barrierHp > 0 && dmg > 0) {
    const barrierAbsorbed = Math.min(target.barrierHp, dmg);
    target.barrierHp -= barrierAbsorbed;
    dmg -= barrierAbsorbed;
    log(`${target.label}の結界が${barrierAbsorbed}ダメージを防いだ！`);
  }
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
    // 覚悟: HP1でこらえるのに加え、状態異常も全て解除する(浄化などと同じ範囲、statMods=デバフには触れない)
    target.poison = 0; target.burnTurns = 0; target.bleed = 0; target.stunTurns = 0; target.silenceTurns = 0;
    log(dmgLine);
    log(`${target.label}は覚悟を決めて致命傷をこらえた！`);
  } else {
    target.hp = Math.max(0, target.hp - dmg);
    log(dmgLine);
  }
  // 武士道(onDamagedAtkStack): 敵からダメージを受けるごとに攻撃力が積み上がる(1回+10%、最大+30%。
  // スキルエディタ2026-07-30)。stackCountersは戦闘開始時にリセットされるため戦闘中のみ持続。
  // turns:99は「この戦闘中ずっと」の意(statModsも戦闘開始時に全消しされる)
  if (actor && actor.instanceId !== undefined && dmg > 0 && target.hp > 0 && target.passives && target.passives.onDamagedAtkStack) {
    const bushido = target.passives.onDamagedAtkStack;
    applyStackingStatMod(target, "bushido", "atk", bushido.perStack, bushido.maxStacks, 99);
  }
  // 狩猟本能(onHitAilmentSelfSpdBuff): 状態異常を負っている敵へ攻撃した時、自分の素早さが上がる
  // (applyStatModは同statを上書きするため重ねがけはされない。スキルエディタ2026-07-30)
  if (actor && actor.instanceId === undefined && target.instanceId !== undefined && actor.passives && actor.passives.onHitAilmentSelfSpdBuff && hasSpecificAilment(target, undefined)) {
    const hb = actor.passives.onHitAilmentSelfSpdBuff;
    applyStatMod(actor, "spd", hb.mult, hb.turns);
  }
  // 千本桜の威力スケール用: この戦闘で敵に攻撃を命中させた回数(多段/範囲は1ヒット=1カウント。
  // 反撃・投石器・鷹はapplyDamageToTargetを通らない/actorが敵側のため数えない)
  if (actor && actor.instanceId === undefined && target.instanceId !== undefined && dmg > 0) {
    actor.__battleHitCount = (actor.__battleHitCount || 0) + 1;
  }
  // かばう中(logSuffix==="(かばう)")かつ「会心の返し」(guardCounter、100%確定反撃)持ちの場合は、
  // ここでの汎用「迎撃」(counterChance、被弾時の確率反撃)を重ねて発動させない。
  // 会心の返しはhandleGuardSynergyPassives側で別途0.5秒後の専用演出込みで確実に反撃するため、
  // 両方の受動を選んでいると同じ1回の被弾に対して敵へ二重に反撃ダメージが入ってしまっていた
  const guardCounterWillHandleIt = logSuffix === "(かばう)" && target.passives && target.passives.guardCounter;
  if (actor && target.hp > 0 && target.passives && target.passives.counterChance > 0 && !guardCounterWillHandleIt && Math.random() < target.passives.counterChance) {
    // 燕返し(counterCritRateAdd)/天衣無縫(counterDamageBonus)など: 反撃そのものにも会心判定と加算ダメージ補正を乗せる
    const counterCritMult = rollCritMultiplier(target, target.passives.counterCritRateAdd || 0, actor);
    const counterDamageMult = (target.passives.counterMult || 1) + (target.passives.counterDamageBonus || 0);
    // 防御力は他の「威力X%」スキルと同じmitigation(K=15)方式で減算する(def×0.5の定額減算だと
    // 素のatkが低いクラスが防御力の高い敵相手に常に最低保証の1ダメージへ張り付いていたため修正)
    const counterDmg = Math.max(1, Math.round(effectiveStat(target, "atk") * counterDamageMult * counterCritMult * mitigation(effectiveStat(actor, "def"), 15)));
    actor.hp = Math.max(0, actor.hp - counterDmg);
    log(`${target.label}は反撃した！${actorLabel}に${counterDmg}ダメージ！${counterCritMult > 1 ? "会心の反撃！" : ""}`);
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
  // 残心: 敵を倒した直後、次に使うスキルのMP消費を0にする(1回限り、abilityMpCost/skillMpCostで消費する)
  if (actor && actor.passives && actor.passives.onKillNextSkillFree && target.hp <= 0) {
    actor.nextSkillFreeMp = true;
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
        if (oh.type === "poison") applyPoison(target, resolveValue(oh, 3) + izanamiBoost);
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
  if (actor.nextSkillFreeMp) actor.nextSkillFreeMp = false; // 残心: 次に使う技1回だけ無償化、ここで消費する
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
    return rollAoeAttack(actor, target, (t) => Math.max(1, Math.round(rollMagicAttack(effectiveStat(actor, "mag"), t.def) * 0.561)), log, ABILITY_RANGE_TYPE.magicAttackAll, true);
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
    // 「会心の一矢」の名前通り、通常の会心率(基本5%)に+20%を上乗せし、合計25%で急所を突く
    return rollAttackOrMiss(actor, target, () => rollPreciseShot(effectiveStat(actor, "atk"), target.def), log, 0.20, ABILITY_RANGE_TYPE.preciseShot);
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

// かばう(guarding)の身代わり成功率。100%だと絶対に守り切れてしまうため上限を設けてあり、
// 失敗分は守り切れず別の味方が狙われる。構えてから最初の1回だけ98%(ユーザー指示2026-07-26、
// 「構えたのに初手からすり抜けた」という理不尽さを減らす)、2人目以降を続けてかばう時は従来の95%。
// 挑発(tauntTurns)はタンク側の強制引きつけなので100%のまま変えない
const GUARD_FIRST_REDIRECT_CHANCE = 0.98;
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
  if (!guardian) return null;
  const chance = (guardian.guardProtectCount || 0) === 0 ? GUARD_FIRST_REDIRECT_CHANCE : GUARD_REDIRECT_CHANCE;
  if (Math.random() < chance) return guardian;
  return null;
}
// 陰陽師「式神の加護」: 自分の式神が場に出ている間、ランダム/単体大技の抽選プールから除外する
// (挑発/かばうによる明示的な引きつけはfindGuardTargetが別途処理するため対象外)。
// 除外すると誰も残らない場合(式神の加護持ちしかいない等)はそのままaliveを返し、必ず1人は選べるようにする
function poolExcludingShikigamiProtected(alive) {
  const filtered = alive.filter((t) => !(t.passives && t.passives.shikigamiProtect && fieldParty.some((c) => c.isShikigami && c.ownerId === t.id && c.status === "active")));
  return filtered.length ? filtered : alive;
}
// 水月(改)など: この敵が一定ターンの間だけ特定の術者に狙いを固定されている場合、その相手を返す。
// findGuardTarget(挑発/かばう)より優先度が高い。呼び出すたびに1ターン分消費するので、単体攻撃/大技どちらでも
// 「この敵が1回行動した」タイミングで自然に減っていく(対象が既に戦闘不能などでいなければ null を返し通常選択に戻す)
function resolveForcedTarget(enemy, alive) {
  if (!enemy.forcedTargetId || !(enemy.forcedTargetTurns > 0)) return null;
  const id = enemy.forcedTargetId;
  enemy.forcedTargetTurns--;
  if (enemy.forcedTargetTurns <= 0) enemy.forcedTargetId = null;
  return alive.find((t) => t.id === id) || null;
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
    // 天衣無縫(counterDamageBonus)など: 見切り/瞬身の順の回避反撃にも加算で乗る
    const evadeCounterMult = target.passives.onEvadeCounterMult + (target.passives.counterDamageBonus || 0);
    // 防御力は他の「威力X%」スキルと同じmitigation(K=15)方式で減算する(def×0.5の定額減算からの修正、上記参照)
    const counterDmg = Math.max(1, Math.round(effectiveStat(target, "atk") * evadeCounterMult * mitigation(effectiveStat(enemy, "def"), 15)));
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
    // 防御力は他の「威力X%」スキルと同じmitigation(K=15)方式で減算する(def×0.5の定額減算からの修正、上記参照)
    counterDmg = Math.max(1, Math.round(effectiveStat(target, "atk") * mitigation(effectiveStat(enemy, "def"), 15)));
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
// ============ 襲撃戦の集中狙い分散(2026-07-28、初回テストプレイの感想対応) ============
// 襲撃戦(raidBattleActive)のみ: 同一ラウンド内で既に敵の攻撃対象になった味方は、以降の敵の
// ターゲット抽選で選ばれる重みが下がる(2回目0.70倍、3回目以降0.35倍。ユーザー指定値)。
// 完全禁止ではなく「偏りの裾を刈る」ソフト分散のため、集中砲火の緊張感は残しつつ事故死を減らす。
// カウントはラウンドの節目(nextRound)でリセット。通常戦闘は従来通りの等確率のまま。
// 大技の予告時ターゲット確定(pickBigAttackSingleTarget)は従来通り等確率(予告→かばうの対抗プレイを
// 変えないため)だが、着弾はカウントに含めるので同ラウンドの通常攻撃はその味方を避けやすくなる
const RAID_FOCUS_WEIGHTS = [1, 0.70, 0.35];
function raidFocusSpreadActive() {
  return typeof raidBattleActive !== "undefined" && raidBattleActive
    && typeof battle !== "undefined" && battle && battle.raidRoundTargetCounts;
}
function pickRaidSpreadTarget(pool) {
  if (!pool.length) return null;
  if (!raidFocusSpreadActive()) return pool[Math.floor(Math.random() * pool.length)];
  const weights = pool.map((m) => {
    const n = battle.raidRoundTargetCounts[m.id] || 0;
    return RAID_FOCUS_WEIGHTS[Math.min(n, RAID_FOCUS_WEIGHTS.length - 1)];
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}
function noteRaidFocusTarget(member) {
  if (!member || !raidFocusSpreadActive()) return;
  battle.raidRoundTargetCounts[member.id] = (battle.raidRoundTargetCounts[member.id] || 0) + 1;
}

// opts.atkMult: この一撃だけ攻撃力に掛ける倍率(三面替え・狐面の連続攻撃で1発あたりを軽くする用。
// battle.jsの敵通常攻撃ループが渡す。未指定=従来どおり等倍)
function enemyAttack(enemy, targets, log, opts) {
  const atkVal = Math.max(1, Math.round(enemy.atk * ((opts && opts.atkMult) || 1)));
  // 【村襲撃】バリケードが立っている間、飛行以外の敵は味方ではなくバリケード自体を攻撃対象にする
  // (以前は味方を狙った攻撃を着弾時に柵へ差し替えていたため、味方の回避判定で柵が無傷になったり
  // 見切り反撃が柵越しに発動する矛盾があった。ユーザー指摘2026-07-27)。柵は動けないので必中、
  // ダメージは防御0相当の素の攻撃ロール。通常プレイはraidBarricadeHp=0のためこの分岐は素通り
  if (typeof raidBarricadeHp !== "undefined" && raidBarricadeHp > 0 && !enemy.isFlying) {
    const dmg = rollBasicAttack(atkVal, 0);
    log(`${enemy.label}はバリケードに${dmg}ダメージ！`);
    applyRaidBarricadeDamage(dmg);
    return { target: null, dmg, hit: true, barricade: true };
  }
  const alive = targets.filter((t) => t.hp > 0);
  if (!alive.length) return null;
  const guardian = resolveForcedTarget(enemy, alive) || findGuardTarget(alive);
  const pickPool = guardian ? alive : poolExcludingShikigamiProtected(alive);
  const target = guardian || pickRaidSpreadTarget(pickPool);
  noteRaidFocusTarget(target); // 襲撃戦の集中狙い分散用カウント(かばう/挑発で引きつけた分も対象)
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
  let rawDmg = rollBasicAttack(atkVal, effectiveStat(target, "def"));
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
  // atkDown/defDown/spdDown/dmgTakenUpはapplyStatModを直接呼ぶため、他の状態異常(poison/bleed/burn/
  // stun/silence)と違いstatusImmuneTurnsのチェックを個別に持っていなかった(既存の抜け穴)。分身の
  // 「状態異常にならない」を正しく機能させるため、ここで一括してガードする(天恵の祈り等の既存の
  // 状態異常無効バフにもこの4種が今後正しく効くようになる、望ましい副次効果)
  if (target.statusImmuneTurns > 0) return;
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
// bigAttack(1つ目、全敵必須)とextraBigAttacks(ボス/中ボス専用、任意の追加分)を合わせた
// 「その敵が使う大技」の一覧。順番はローテーション順そのもの(1つ目→追加分を順に)
function bigAttackPool(enemyDef) {
  const pool = [enemyDef.bigAttack];
  if (enemyDef.extraBigAttacks && enemyDef.extraBigAttacks.length) pool.push(...enemyDef.extraBigAttacks);
  return pool.filter(Boolean);
}
// 大技が発動する時、実際に使うプロファイルを選ぶ。プールが1つだけなら常にそれ(従来通り)。
// 2つ以上あるボス/中ボスは、bigAttackIndexを毎回進めながら順番に回す(ランダム抽選ではなく固定巡回)
function pickBigAttackProfile(enemy) {
  const pool = bigAttackPool(enemy);
  if (pool.length <= 1) return pool[0];
  const idx = (enemy.bigAttackIndex || 0) % pool.length;
  enemy.bigAttackIndex = idx + 1;
  return pool[idx];
}
// 予告(bigAttackPending)の時点で「次に来る技」の名前だけを覗き見る(インデックスは進めない)
function peekNextBigAttackName(enemy) {
  const pool = bigAttackPool(enemy);
  if (!pool.length) return "大技";
  const idx = pool.length <= 1 ? 0 : (enemy.bigAttackIndex || 0) % pool.length;
  return (pool[idx] && pool[idx].name) || "大技";
}
// 予告(bigAttackPending)の時点で「次に来る技」のプロファイル本体(mult/aoe/ignoreGuardian等)を覗き見る
// (peekNextBigAttackNameと同じくインデックスは進めない)。ターゲット予告/致死判定の見積もりに使う
function peekNextBigAttackProfile(enemy) {
  const pool = bigAttackPool(enemy);
  if (!pool.length) return null;
  const idx = pool.length <= 1 ? 0 : (enemy.bigAttackIndex || 0) % pool.length;
  return pool[idx] || null;
}
// 大技の単体ターゲット選定ロジック(enemyBigAttackから抽出。予告時の先読みと実発動時とで
// 全く同じ結果になるよう共通化した)。aoe技は対象を選ばない(呼び出し元でnullを扱う)
function pickBigAttackSingleTarget(enemy, alive, profile) {
  const forced = resolveForcedTarget(enemy, alive);
  const guardian = forced || (profile.ignoreGuardian ? null : findGuardTarget(alive));
  const pool = guardian ? alive : poolExcludingShikigamiProtected(alive);
  // 水月の強制ターゲットで選ばれたかどうかを予告確定(commitBigAttackTelegraphTarget)側が
  // 記録できるように印を残す(発動時の「かばうによる引きつけ上書き」を強制ターゲット時だけ抑止するため)
  enemy.__bigAttackPickWasForced = !!forced;
  return guardian || pool[Math.floor(Math.random() * pool.length)];
}
// 予告(bigAttackPending=true)の瞬間に呼ぶ。単体大技なら実際に狙う相手をここで確定し
// (enemy.bigAttackTelegraphTargetId)、発動時(enemyBigAttack)も同じ相手を狙わせることで
// 「予告で表示された対象」と「実際に狙われる対象」がズレないようにする。全体大技(aoe)は対象を
// 選ばないため何もしない。プロファイルはpeekNextBigAttackProfileで覗き見るだけ(インデックスは
// 進めない)ので、実発動時にpickBigAttackProfileが返す技と必ず一致する
function commitBigAttackTelegraphTarget(enemy, alive) {
  const profile = peekNextBigAttackProfile(enemy);
  if (!profile || profile.aoe || !alive.length) { enemy.bigAttackTelegraphTargetId = null; enemy.bigAttackTelegraphForced = false; return; }
  const target = pickBigAttackSingleTarget(enemy, alive, profile);
  enemy.bigAttackTelegraphTargetId = target ? target.id : null;
  // 水月の強制ターゲットで確定した予告は、発動時のかばう/挑発の引きつけでも上書きさせない
  enemy.bigAttackTelegraphForced = !!enemy.__bigAttackPickWasForced;
}
// 大技を受けた場合の想定ダメージ(かばう軽減や乱数変動は考慮しない素の見積もり)。
// mid: 中央値(変動なしの素の計算) / max: 上振れした場合の目安(+15%、rollBasicAttackの変動幅上限と同じ)
function predictBigAttackDamage(enemy, target, profile) {
  let mult = profile.mult;
  const base = enemy.atk * mitigation(effectiveStat(target, "def"), 18) * mult;
  return { mid: Math.max(1, Math.round(base)), max: Math.max(1, Math.round(base * 1.15)) };
}
// HP警告(⚠️)判定: 予告中の大技を(未かばう想定で)受けた場合、上振れの見積もりで戦闘不能(HP0)に
// なる可能性があるかどうか。20%以下に落ち込む程度では出さず、実際に上振れで死にうる場合だけに絞った
// (ユーザー指示、2026-07-25)。falseでも乱数次第では実際に致死級になり得るため、あくまで目安であることに注意
function isBigAttackLethalRisk(enemy, target, profile) {
  const predicted = predictBigAttackDamage(enemy, target, profile);
  return (target.hp - predicted.max) <= 0;
}
// 予告中の大技でこのallyId(味方)が狙われているかどうかを調べる(ui.js側のカード描画から呼ぶ)。
// 該当する敵が複数いる場合は最初に見つかったものを返す(同時に複数体から単体大技の予告を受ける状況は稀)
function findBigAttackThreatFor(allyId) {
  if (typeof battle === "undefined" || !battle || !battle.enemies) return null;
  const enemy = battle.enemies.find((e) => e.hp > 0 && e.bigAttackPending && e.bigAttackTelegraphTargetId === allyId);
  if (!enemy) return null;
  const profile = peekNextBigAttackProfile(enemy);
  if (!profile) return null;
  return { enemy, profile };
}
// 敵カード上の📜アイコンをタップした時に出す、その敵の大技の説明文。予告ターン(bigAttackPending)を
// 待たずにいつでも確認できるようにするため、data.js側の手書きテキストではなくbigAttackプロファイル
// (mult/debuff/aoe/ignoreGuardian)から機械的に組み立てる(全103体を漏れなくカバーできる)。
// extraBigAttacksを持つボス/中ボスは、技ごとに名前付きで列挙する
// 1つの大技プロファイルを文章化する(bigAttackSummaryText/ターゲットマークのツールチップ両方から使う共通部品)
function describeBigAttackProfile(p) {
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
// describeBigAttackProfileの簡潔版(ターゲットマークのツールチップ専用、1〜2行に収める。
// ignoreGuardianの言及は省略し、威力%と状態異常の有無だけを「・」区切りで並べる)
function describeBigAttackShort(p) {
  const parts = [];
  if (p.aoe) parts.push("全体攻撃");
  parts.push(`威力${Math.round((p.mult != null ? p.mult : 1) * 100)}%`);
  if (p.debuff) {
    const tooltipKey = DEBUFF_TYPE_TOOLTIP_KEY[p.debuff.type] || p.debuff.type;
    const info = STATUS_TOOLTIPS[tooltipKey];
    const name = info ? info.title : p.debuff.type;
    parts.push(`命中で${name}の危険`);
  }
  return parts.join("・");
}
function bigAttackSummaryText(enemyDef) {
  const pool = bigAttackPool(enemyDef);
  if (!pool.length) return "詳細不明の一撃を放つ。";
  if (pool.length === 1) return describeBigAttackProfile(pool[0]);
  return pool.map((p) => `【${p.name || "大技"}】${describeBigAttackProfile(p)}`).join("\n");
}

// enemyの「大技」。かばう/挑発中の仲間がいればその1人だけに(引きつける対抗策)、いなければ
// 生存中の味方全員に襲いかかる。全敵がbigAttackプロファイル(見た目/生態に合わせた専用の威力+デバフ)を
// 持っている前提(data.js ENEMIES、汎用フォールバックは廃止済み、2026-07-19)。ボス/中ボスはextraBigAttacksで
// 複数の大技をローテーション巡回できる(pickBigAttackProfile参照)。
// 敵自身が毒/炎上状態なら威力がさらに下がる(削る対抗策)。結果は対象ごとの配列で返す
function enemyBigAttack(enemy, targets, log) {
  const alive = targets.filter((t) => t.hp > 0);
  if (!alive.length) return [];
  const profile = pickBigAttackProfile(enemy);
  // 【村襲撃】バリケードが立っている間は大技も柵に叩き込まれる(1発ぶんを柵が丸ごと受ける。必中)。
  // 飛行の敵は従来通り柵を飛び越えて味方を狙う
  if (typeof raidBarricadeHp !== "undefined" && raidBarricadeHp > 0 && !enemy.isFlying) {
    let bMult = profile.mult;
    const dmg = Math.max(1, Math.round(rollBasicAttack(enemy.atk, 0) * bMult));
    enemy.bigAttackTelegraphTargetId = null;
    enemy.bigAttackTelegraphForced = false;
    log(`${enemy.label}の${profile.name || "大技"}！ バリケードに${dmg}ダメージ！`);
    applyRaidBarricadeDamage(dmg);
    return [{ target: null, dmg, hit: true, barricade: true }];
  }
  // 大技は敵1体につき1人だけを狙う(以前は「かばう中の人がいなければ全員に当たる」実質AOEに
  // なっていて難易度が高くなりすぎていたため単体攻撃に統一した)。ignoreGuardian: 鬼火の業火など
  // 「誰か1人が庇っても防ぎきれない」大技は、かばう/挑発による引きつけを無視してランダムな1人を狙う。
  // aoe: 天狗の「扇の突風」のような特別な敵専用の全体大技(生存中の味方全員に当たる。
  // 全員が対象なのでかばう/挑発の引きつけ先選択は行わないが、各自のかばう軽減40%は個別に効く)。
  // 予告時点でcommitBigAttackTelegraphTargetが対象を確定済みならそれを使う(ターゲットマーク表示と
  // 実際の被弾対象がズレないように)。対象が既にaliveから外れている場合のみ改めて抽選する。
  // 【不具合修正2026-07-26】ただし発動時点でかばう/挑発の引きつけが立っていればそちらを最優先する。
  // 予告対象の確定は「予告を見てかばうを選ぶ」より時系列で必ず前のため、予告対象を無条件に
  // 優先すると、かばうが大技に一切反応できなくなっていた(「予告→タンクがかばって受け止める」
  // という本来の対抗プレイの復旧)。ignoreGuardianの大技と、水月の強制ターゲットで確定した予告
  // (bigAttackTelegraphForced)は従来通り引きつけを無視する。照準マークの表示位置は予告対象の
  // ままだが、かばうが成功した=マークの相手を守り切った、という結果なのでズレとしては扱わない
  const telegraphed = enemy.bigAttackTelegraphTargetId != null ? alive.find((t) => t.id === enemy.bigAttackTelegraphTargetId) : null;
  const interceptor = !profile.aoe && !profile.ignoreGuardian && !(telegraphed && enemy.bigAttackTelegraphForced) ? findGuardTarget(alive) : null;
  const singleTarget = !profile.aoe ? (interceptor || telegraphed || pickBigAttackSingleTarget(enemy, alive, profile)) : null;
  noteRaidFocusTarget(singleTarget); // 襲撃戦の集中狙い分散用カウント(全体大技はカウント対象外)
  enemy.bigAttackTelegraphTargetId = null;
  enemy.bigAttackTelegraphForced = false;
  const hitTargets = profile.aoe ? alive : [singleTarget];
  let mult = profile.mult;
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
    pickEnemyForFloor, pickEncounterForFloor, instantiateEnemyById, goldReward, performAttack, useAbility, usePotion, useOnsenEgg, enemyAttack, enemyBigAttack, resolveDebuffEffect, rollBigAttackCountdown, applyGroupNerf, bigAttackPool, pickBigAttackProfile, peekNextBigAttackName, bigAttackSummaryText,
    turnOrder, simulateBattle, simulateBattleMulti,
    xpToNext, levelUp, grantXp, maxMpFor, baseMaxMpFor, abilityMpCost,
    advanceFatigue, fatigueMalus, stressTier, effectiveStat, computeEquipBonus, refreshEquipBonus, classHasReachedLevel,
    onsenCost, useOnsen, isOnsenLocked, collectReadyOnsenReliefs, useLodging, useCampRest, isAvailable, evasionChance, accuracyOf, rollHit,
    applyStatMod, tickStatMods, applyPoison, tickPoison, applyBurn, tickBurn, applyBleed, tickBleed, BLEED_MAX_STACKS, clearDotEffects, applyStun, applySilence, tickTurnStartEffects, POISON_MAX_STACKS,
    initPassives, applySkillChoice, useTreeSkill, rollCritMultiplier, damageTakenMultiplier, activeConditionalMods,
    skillMpCost, resistedChance, applyDamageToTarget, BASE_CRIT_RATE, BASE_CRIT_DMG_MULT, mitigation, withVariance,
    enterTransform, revertTransform,
  };
}
