// ============ state.js: 状態管理(初期状態・グローバルなstate・時間帯/カレンダー計算・名簿ユーティリティ) ============
// ============ 状態管理 ============

function defaultState() {
  return {
    gold: 170,
    roster: [],
    activePartyIds: [],
    inventory: { potion: 5, smokeBomb: 2, campingKit: 0, onsenEgg: 0, bomb: 0, soulShard: 0 },
    omamoriOwned: [], // 所持中のお守りid一覧(重複しない)
    omamoriEquipped: [], // 装備中のお守りid一覧(最大OMAMORI_EQUIP_MAX個、パーティ共有)
    shrineFirstVisitRewardGiven: false, // 神社を初めて訪れた時のサービス(魂のかけら3個)を渡し済みか
    seenEnemyIds: [], // 図鑑: 遭遇済みの敵id一覧(重複しない、倒す必要はなく戦闘で出会った時点で記録)
    bestiaryLastViewedCount: 0, // 最後に図鑑タブを開いた時点のseenEnemyIds.length。増えていればNEWバッジを出す
    classUpgrades: {}, // { classId: { weapon: bool, armor: bool } }
    timeOfDay: "day", // "dawn" | "day" | "dusk" | "night"。ダンジョン往復や宿屋での宿泊で進む
    clockMinutes: 12 * 60, // 探索中に「進む」で進む時計(0〜1439分)。初期値は正午
    dayCount: 1, // ゲーム内の経過日数(1 = 4月1日)。深夜0時を跨ぐ、または宿泊で翌朝になるたびに+1
    houseLevel: 1, // 増築で上がる家のレベル(1=名簿上限2人、以降1レベルごとに+1人、最大10人)。出発パーティ(戦闘に出す人数)は常に4人までで、これとは別
    dojoLevel: 0, // 増築の1つ、道場のレベル(0=未建築、1=建築済み)。冒険に同行しなかった名簿の仲間にも経験値の一部が入るようになる
    magistrateLevel: 0, // 増築の1つ、奉行所のレベル(0=未建築、1=建築済み。家レベル2で解禁)。依頼を受けられるようになる
    magistrateQuestDate: 0, // 依頼を最後に張り替えたdayCount(0=未生成)
    magistrateAvailableQuests: [], // 本日張り出されている依頼のid一覧(最大QUEST_BOARD_SIZE件)。受注制のため進捗は持たない
    magistrateQuestLastShown: {}, // { questId: dayCount } 直近で張り出された日。QUEST_COOLDOWN_DAYS日は再抽選対象から外す
    acceptedQuest: null, // 受注中の依頼。{enemyId, targetFloor, count}。同時に1件までしか受けられない
    emergencyQuest: null, // 緊急依頼(序盤ボス級の指名討伐)。進行中は{enemyId, kills, claimed}、無い時はnull
    magistrateNormalClears: 0, // 通常の討伐依頼を受け取った累計件数(EMERGENCY_QUEST_CLEAR_THRESHOLD件で緊急依頼が1件発生し、消費されて0に戻る)
    emergencyQuestEverAppeared: false, // 一番最初の緊急依頼は必ず荒熊にするためのフラグ(発生済みならfalse→trueにし、以降はランダム)
    defeatedOoInoshishi: false, // 大猪(猪の依頼の中ボス)を一度でも倒したか。緊急依頼の解禁条件の1つ(一度trueになったらそのまま)
    rescueQuestAccepted: false, // 破綻寸前パーティ救済クエスト(薬草摘み)を受注中かどうか
    rescueQuestItemObtained: false, // 森の対象階層で薬草を入手済みかどうか(受注中のみ意味を持つ)
    travelPrepShopLevel: 0, // 増築の1つ、旅支度屋のレベル(0=未建築、1=建築済み。家レベル3で解禁)。出発画面で野営具を購入できるようになる
    bagShopLevel: 0, // 増築の1つ、鞄屋のレベル(0=未建築、1=建築済み。家レベル5で解禁)。支援物資の所持上限が1増える
    watchtowerLevel: 0, // 増築の1つ、見張り台のレベル(0=未建築、1=建築済み。家レベル6で解禁)。村襲撃時の援護射撃(未実装、建物のみ)
    stableLevel: 0, // 増築の1つ、馬小屋のレベル(0=未建築、1=建築済み。家レベル7で解禁)。馬購入で移動速度アップ(未実装、建物のみ)
    henHouseLevel: 0, // 増築の1つ、鶏小屋のレベル(0=未建築、1=建築済み。家レベル5で解禁)。効果は未定(建物のみ)
    teaHouseLevel: 0, // 増築の1つ、茶屋のレベル(0=未建築、1=建築済み。家レベル6で解禁)。深淵の森15層の進路選択に「茶屋」が必ず現れ、一休み(HP/MP回復)や買い物ができるようになる
    hotSpringKeeperLevel: 0, // 増築の1つ、湯守屋のレベル(0=未建築、1=建築済み。家レベル6で解禁)。効果は未定(建物のみ)
    beeFarmLevel: 0, // 増築の1つ、養蜂場のレベル(0=未建築、1=建築済み。家レベル8で解禁)。効果は未定(建物のみ)
    shrineLevel: 0, // 増築の1つ、神社のレベル(0=未建築、1=建築済み。家レベル4で解禁)。僧侶が雇えるようになり、おみくじを引けるようになる
    gunpowderStoreLevel: 0, // 増築の1つ、火薬庫のレベル(0=未建築、1=建築済み。家レベル6で解禁)。砲術士が雇えるようになり、出発画面で爆弾を購入できるようになる
    karakuriLevel: 0, // 増築の1つ、からくり屋敷のレベル(0=未建築、1=建築済み。家レベル3で解禁)。忍が雇えるようになり、戦闘中の「消火」が使えるようになる
    ferryLevel: 0, // 増築の1つ、渡し船のレベル(0=未建築、1=建築済み。家レベル7で解禁)。効果は未定(建物のみ)
    shopLevel: 0, // 増築の1つ、鍛冶屋のレベル(0=未建築、1=建築済み。家レベル2で解禁)。他の施設と同じく解禁前は町画面にボタン自体を表示しない。
    // ただし新規追加した制限のため、この機能追加より前からのセーブでは常に鍛冶屋が使えていたので、
    // loadState()側で「旧セーブは既に建築済み扱いにする」互換処理を入れてある(save.js参照)
    pendingSkillChoices: [], // レベルアップで未選択のスキル({characterId, level}の配列)。宿屋の名簿から選ぶ
    onsenEggDailyCount: 0, // 温泉の売店で本日買った温泉卵の数(1日2個まで、翌朝リセット)
    onsenEggDailyDate: 1, // 上記カウントが対応しているdayCount(値が変わったらリセットする)
    omikujiDrawnDate: 0, // 最後におみくじを引いたdayCount(0=未使用。1日1回、dayCountが変わるとまた引ける)
    omikujiLastTier: null, // 最後に引いたおみくじの結果(daikichi/chukichi/kichi/shokichi/kyou)。表示用
    omikujiLastLine: "", // 最後に引いた時に仲間が喋った一言(表示用)
    omikujiLastSpeakerId: null, // 上記セリフを喋ったキャラのid(結果画面にポートレートを出すため)
    omikujiEffect: null, // 次の遠征に適用される効果(daikichi/chukichi/kichi/shokichi、kyouはnullのまま)。遠征終了時にクリアする
    omikujiFirstStrikePending: false, // 小吉: 次の遠征の最初の戦闘だけ先制確定にする(1戦闘使ったら消費)
    seenUnlockedBuildings: {}, // { stateKey: true } 建築可能(houseLevel到達済み・未建築)になった施設を一度でも増築画面で見たか。NEWバッジの表示制御用
    seenUnlockedClasses: {}, // { classId: true } 雇用可能になった職業を一度でも宿屋の職業一覧で見たか。NEWバッジの表示制御用
    onsenKeeperLinePeriod: null, // 温泉の湯守りキャラのセリフが最後に選ばれた「2日区切りの周期番号」(1日おき更新、renderOnsen参照)
    onsenKeeperLineIndex: 0, // 上記周期の間、ずっと表示し続けるONSEN_KEEPER_LINESのインデックス
    tavernKeeperLinePeriod: null, // 宿屋の女将キャラの同種のフィールド(renderTavern参照)
    tavernKeeperLineIndex: 0,
    // 建物が解禁した「新しい導線」をちゃんと見つけられるようにするNEWバッジ用フラグ群。
    // 見た瞬間に消える(showXxxやrenderXxxの中でtrueにする)方式で、seenUnlockedBuildingsと同じ考え方
    seenShrineTab: false, // 温泉の⛩️神社タブ(お守り奉納)を開いたか
    seenOmikujiTab: false, // 出発準備画面の⛩️おみくじタブを開いたか
    seenCampingKitSupply: false, // 旅支度屋解禁後、出発準備画面(支度タブ=野営具の購入欄)を見たか
    seenBombSupply: false, // 火薬庫解禁後、出発準備画面(支度タブ=爆弾の購入欄)を見たか
  };
}

const HOUSE_MAX_LEVEL = 9; // レベル9で名簿上限10人に達し、それ以上は増築できない
function houseUpgradeCost(level) {
  if (level === 1) return 90; // レベル1→2
  if (level === 2) return 250; // レベル2→3
  return 250 + (level - 2) * 100; // レベル3以降は1レベルごとに250Gから+100Gずつ上がる(レベル3→4=350G、4→5=450G…)
}
function rosterCapacity() {
  return Math.min(10, (state.houseLevel || 1) + 1);
}
const DOJO_LEVEL1_COST = 50; // 道場レベル1の建築費用
const DOJO_LEVEL2_COST = 100; // 道場レベル1→2の増築費用
const DOJO_MAX_LEVEL = 2;
const DOJO_UNLOCK_HOUSE_LEVEL = 3; // 家レベルがこの値に達するまで道場は建築できない
const DOJO_XP_SHARE_BY_LEVEL = { 1: 0.3, 2: 0.35 }; // 道場のレベルごとの、同行しなかった仲間が受け取る経験値の割合

// 図鑑: 出発準備画面のタブとして使えるようになる(建物ではなく家レベルのみで解禁)
const BESTIARY_UNLOCK_HOUSE_LEVEL = 2;
// 奉行所: 依頼を受けられるようになる
const MAGISTRATE_UNLOCK_HOUSE_LEVEL = 2;
const MAGISTRATE_COST = 10;
// 鍛冶屋: 建築すると装備の購入ができるようになる
const SHOP_UNLOCK_HOUSE_LEVEL = 2;
const SHOP_COST = 10;
// 旅支度屋: 建築すると出発画面で野営具を購入できるようになる(実際に効果があるレベル1の施設)
const TRAVEL_PREP_SHOP_UNLOCK_HOUSE_LEVEL = 3;
const TRAVEL_PREP_SHOP_COST = 100;
// 鞄屋: 支援物資の所持上限が1増える(唯一、実際に効果があるレベル1の施設)
const BAG_SHOP_UNLOCK_HOUSE_LEVEL = 4;
const BAG_SHOP_LEVEL1_COST = 75;
function supplyCap() {
  return SUPPLY_CAP_BASE + (state.bagShopLevel || 0);
}
// 見張り台: 村襲撃時の援護射撃(建物のみ、襲撃システム自体は未実装)
const WATCHTOWER_UNLOCK_HOUSE_LEVEL = 5;
const WATCHTOWER_COST = 200;
// 馬屋: 馬を購入すると出発時の移動速度が上がる(建物のみ、馬購入・移動速度アップ自体は未実装)
const STABLE_UNLOCK_HOUSE_LEVEL = 7;
const STABLE_COST = 200;
// 鶏小屋: 効果は未定(建物のみ、未実装)
const HEN_HOUSE_UNLOCK_HOUSE_LEVEL = 4;
const HEN_HOUSE_COST = 200;
// 茶屋: 効果は未定(建物のみ、未実装)
const TEA_HOUSE_UNLOCK_HOUSE_LEVEL = 6;
const TEA_HOUSE_COST = 250;
// 湯守屋: 効果は未定(建物のみ、未実装)
const HOT_SPRING_KEEPER_UNLOCK_HOUSE_LEVEL = 4;
const HOT_SPRING_KEEPER_COST = 200;
// 火薬庫: 建築すると砲術士が雇えるようになり、出発画面で爆弾(敵全体に防御無視ダメージ)を購入できるようになる
const GUNPOWDER_STORE_UNLOCK_HOUSE_LEVEL = 5;
const GUNPOWDER_STORE_COST = 200;
// からくり屋敷: 建築すると忍が雇えるようになり、戦闘中の「消火」が使えるようになる
const KARAKURI_UNLOCK_HOUSE_LEVEL = 3;
const KARAKURI_COST = 50;
// 養蜂場: 効果は未定(建物のみ、未実装)
const BEE_FARM_UNLOCK_HOUSE_LEVEL = 6;
const BEE_FARM_COST = 300;
// 神社: 建築すると僧侶が雇えるようになり、出発画面でおみくじを引けるようになる。温泉から入れる
// お守りガチャ(魂のかけらを捧げるとお守りがもらえる)もここで解禁される
const SHRINE_UNLOCK_HOUSE_LEVEL = 4;
const SHRINE_COST = 200;
// 渡し船: 効果は未定(建物のみ、未実装)
const FERRY_UNLOCK_HOUSE_LEVEL = 7;
const FERRY_COST = 250;

// ゲーム開始(dayCount=1の0:00)を起点とした絶対分数。温泉の入浴ロック(2時間)など、
// 日をまたぐ可能性のある時間比較はdayCount/clockMinutesを別々に見るのではなくこの値で行う
function absoluteGameMinutes() {
  return ((state.dayCount || 1) - 1) * 1440 + (state.clockMinutes || 0);
}

// dayCount(1始まり=4月1日)を「M月D日」の表示文字列に変換する。うるう年を考慮する必要がないよう
// 固定の平年(2001年)を基準日として使い、実カレンダーの月の日数だけを利用する
function formatGameDate(dayCount) {
  const d = new Date(2001, 3, 1);
  d.setDate(d.getDate() + ((dayCount || 1) - 1));
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

let state = loadState();
// ============ お守り共通ヘルパー ============
function hasOmamori(id) { return state.omamoriEquipped.includes(id); }
// 木花咲耶姫の御守: 回復薬を使っても20%の確率で消費しない
function consumePotion() {
  if (hasOmamori("konohanasakuya") && Math.random() < 0.20) return;
  state.inventory.potion--;
}
// 志那都比古神の御守: 煙玉を使っても35%の確率で消費しない
function consumeSmokeBomb() {
  if (hasOmamori("shinatsuhiko") && Math.random() < 0.35) return;
  state.inventory.smokeBomb--;
}
// ============ 図鑑 ============
// 戦闘に出現した敵を記録する(倒す必要はなく、出会った時点で登録される)
function markEnemiesSeen(enemyList) {
  let changed = false;
  enemyList.forEach((e) => {
    if (!state.seenEnemyIds.includes(e.id)) { state.seenEnemyIds.push(e.id); changed = true; }
  });
  if (changed) saveState();
}
function bestiaryHasNew() { return (state.seenEnemyIds || []).length > (state.bestiaryLastViewedCount || 0); }
// ============ 時間帯(早朝→朝→昼→夕→夜の5段階サイクル) ============
// 町・宿屋・深淵の森・海岸は5段階それぞれの絵を持つが、温泉は昼/夜2種類の絵しか無いため
// 早朝→朝→昼側、夕→夜側に寄せて表示する(dayLikeOf参照)
const TIME_PHASES = ["dawn", "asa", "day", "dusk", "night"];
const TIME_PHASE_LABEL = { dawn: "早朝", asa: "朝", day: "昼", dusk: "夕", night: "夜" };
// clockMinutes(0〜1439)を"HH:MM"表示に変換する。村パート(町画面)でのみ現在時刻を表示するために使う
function formatClockTime(clockMinutes) {
  const m = ((clockMinutes || 0) % 1440 + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
// 探索中の時計(0〜1439分 = 0:00〜23:59)。「進む」1回でMINUTES_PER_FLOOR_FORWARD分(深層に向かうのは時間がかかる)、
// 「帰還」1回でMINUTES_PER_FLOOR_RETREAT分(帰りは勝手知ったる道で少し早い)進み、
// 下記の時間割の境界を跨いだらtimeOfDayも自動で切り替わる(生活感覚に近い長さにしてあり、均等4分割ではない)
const MINUTES_PER_FLOOR_FORWARD = 30;
const MINUTES_PER_FLOOR_RETREAT = 20;
const PHASE_START_MINUTES = { dawn: 4 * 60 + 30, asa: 6 * 60 + 30, day: 10 * 60, dusk: 16 * 60, night: 19 * 60 }; // 早朝4:30/朝6:30/昼10:00/夕16:00/夜19:00
function phaseForClockMinutes(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  let phase = "night"; // 0:00〜4:29は前日の夜の続き
  TIME_PHASES.forEach((p) => { if (m >= PHASE_START_MINUTES[p]) phase = p; });
  return phase;
}
// 町に帰る/宿泊で時間帯が飛ぶ時は、時計をその時間帯の開始時刻に同期させる(探索中の時計と矛盾しないように)
function syncClockToPhase() {
  state.clockMinutes = PHASE_START_MINUTES[state.timeOfDay];
}
// 探索で1階進む/戻るごとに時計を進め、時間帯の境界を跨いだらtimeOfDayを切り替える。
// 深夜0時を跨いだ場合はdayCount(日にち)も1進める
function advanceExplorationClock(minutes) {
  if (state.clockMinutes == null) syncClockToPhase();
  const newTotal = state.clockMinutes + minutes;
  if (newTotal >= 1440) state.dayCount = (state.dayCount || 1) + 1;
  state.clockMinutes = newTotal % 1440;
  state.timeOfDay = phaseForClockMinutes(state.clockMinutes);
}
// asa(朝)は元々dawn(早朝)として使っていた絵(4:30〜6:30の新イラストに差し替える前のもの)を
// asa_*.jpgとして退避し、そのまま流用している。海岸はユーザー提供の5枚が揃っているためcoast_asa.jpgを使う
function advanceCalendar(applyPhase) {
  applyPhase();
  tickCriticalExpiry(state.roster, absoluteGameMinutes()); // 瀕死のまま猶予が切れた仲間をロストにする
  checkQuestDeadline(); // 受注中の依頼が期限切れになっていないか確認する
  pruneActiveParty();
  saveState();
  updateSceneBackgrounds();
}
// 冒険から町に帰った時: 時間帯は探索中の時計(advanceExplorationClock)で既に正しく進んでいるため、
// ここで追加のジャンプは行わない(旧: 朝→夕のように4段階のうち2つ分進めていたが撤廃)
function toggleTimeOfDay() {
  advanceCalendar(() => {});
}
// 宿屋で宿泊した時: 今が何時であっても必ず翌日の朝になる(dayCountも必ず1進める)。
// 起床時刻は野営の翌朝(5:30)と揃えてある(syncClockToPhaseの朝の開始値=5:00だとずれるため直接指定)
function advanceToNextMorning() {
  advanceCalendar(() => {
    state.dayCount = (state.dayCount || 1) + 1;
    state.timeOfDay = "dawn";
    state.clockMinutes = 5 * 60 + 30;
  });
}

function getRosterChar(id) {
  return state.roster.find((c) => c.id === id);
}

// 瀕死/ロストになった、または温泉の入浴ロック中になったキャラがパーティ編成の枠に
// 居座り続けないよう、activePartyIdsから現在isAvailable()でなくなった者を取り除く
function pruneActiveParty() {
  const now = absoluteGameMinutes();
  const seen = new Set();
  state.activePartyIds = state.activePartyIds.filter((id) => {
    const c = getRosterChar(id);
    if (!c || !isAvailable(c, now) || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, 4); // 何らかの原因で4人を超えて紛れ込んだ場合の保険(重複除去+上限強制)
}

// おみくじの効果を、遠征開始のタイミングでfieldPartyに実際に反映する。
// 大吉(sharedSurviveFatal)は前回の遠征の残り物が残っていないよう毎回クリアしてから、
// 今回omikujiEffectがdaikichiの時だけ全員に同じ参照オブジェクトを配り直す(1回だけ効く共有の命綱)
