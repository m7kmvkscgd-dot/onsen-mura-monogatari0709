// ============ skills.js: スキル系譜(レベルアップ時のスキル選択UI) ============
function queueSkillChoices(list) {
  list.filter((entry) => SKILL_TREES[entry.character.classId] && SKILL_TREES[entry.character.classId][entry.level])
    .forEach((entry) => { state.pendingSkillChoices.push({ characterId: entry.character.id, level: entry.level }); });
}

// 宿屋の名簿から、指定したキャラの未選択スキルを1件選ばせる。同じキャラに複数レベル分溜まっていれば、
// 選び終えるたびに再帰的に呼び直して1つずつ順番に出す。画面はXCOM風の「系譜」一覧(習得済み/選択中/
// 未到達を1本のリストで見せる)を参考に、レベル2〜10を縦に並べて表示する
function openSkillChoiceFor(characterId) {
  const idx = state.pendingSkillChoices.findIndex((e) => e.characterId === characterId);
  if (idx === -1) return;
  const { level } = state.pendingSkillChoices[idx];
  const character = getRosterChar(characterId);
  const overlay = document.getElementById("skillChoiceOverlay");
  const tree = character && SKILL_TREES[character.classId];
  if (!character || !tree || !tree[level]) {
    state.pendingSkillChoices.splice(idx, 1);
    saveState();
    return;
  }
  overlay.style.display = "block";
  renderSkillTreeContent(character, level);
}

// 宿屋の名簿/ステータス詳細画面から、選択待ちの有無に関わらずいつでも系譜を閲覧できるようにする入口。
// pendingLevelを渡さない(閲覧専用)ので、どのスキルも「選択待ち」扱いにならず決定ボタンも出ない
function viewSkillTree(characterId, onClose) {
  const character = getRosterChar(characterId);
  if (!character || !SKILL_TREES[character.classId]) return;
  const overlay = document.getElementById("skillChoiceOverlay");
  overlay.style.display = "block";
  renderSkillTreeContent(character, null, onClose);
}

// 実際にスキル選択を確定させる。選び終えたら、同じキャラにまだ選択待ちが残っていれば続けて出し、
// 無ければオーバーレイを閉じて名簿を再描画する(「🎓スキル選択」バッジが消える)
function resolveSkillChoice(character, level, side, skill) {
  applySkillChoice(character, { ...skill, side }, level);
  playSfx("skill_confirm");
  const idx = state.pendingSkillChoices.findIndex((e) => e.characterId === character.id && e.level === level);
  if (idx !== -1) state.pendingSkillChoices.splice(idx, 1);
  saveState();
  if (state.pendingSkillChoices.some((e) => e.characterId === character.id)) {
    openSkillChoiceFor(character.id);
  } else {
    document.getElementById("skillChoiceOverlay").style.display = "none";
    renderRosterList();
  }
}

function renderSkillTreeContent(character, pendingLevel, onClose) {
  const c2 = CLASSES[character.classId];
  const tree = SKILL_TREES[character.classId];
  const treeNames = SKILL_TREE_NAMES[character.classId];
  const content = document.getElementById("skillChoiceContent");
  const levels = Object.keys(tree).map(Number).sort((a, b) => a - b);
  const rowsHtml = levels.map((lv) => {
    const chosenSide = character.skills && character.skills[lv];
    const isPending = lv === pendingLevel;
    const rowState = isPending ? "pending" : chosenSide ? "done" : "locked";
    const sideClass = (side) => {
      if (isPending) return "pending-choice";
      if (chosenSide) return chosenSide === side ? "chosen" : "rejected";
      return "locked";
    };
    const optHtml = (side) => `
      <button class="skill-tree-opt ${side} ${sideClass(side)}" data-level="${lv}" data-side="${side}">
        <span class="skill-tree-opt-name">${tree[lv][side].name}</span>
      </button>
    `;
    return `
      <div class="skill-tree-row-wrap" data-level="${lv}">
        <div class="skill-tree-row ${rowState}">
          ${optHtml("left")}
          <div class="skill-tree-level-badge"><span>Lv${lv}</span></div>
          ${optHtml("right")}
        </div>
        <div class="skill-tree-inline-detail" style="display:none;"></div>
      </div>
    `;
  }).join("");
  const hintText = pendingLevel != null
    ? `Lv${pendingLevel}で新しいスキルを1つ選べます。スキル名をタップすると、その下に説明が開きます`
    : "スキル名をタップすると、その下に説明が開きます";
  content.innerHTML = `
    <button class="big" id="skillTreeBackBtn" style="margin-bottom:0.8rem;">戻る</button>
    <div class="skill-tree-header">
      <div class="skill-tree-charname">${character.name}</div>
      <div class="skill-tree-classname">${c2.ja}の系譜</div>
      <p class="skill-tree-hint">${hintText}</p>
    </div>
    <div class="skill-tree-names">
      <span class="skill-tree-name left">${treeNames.left}</span>
      <span class="skill-tree-name-spacer"></span>
      <span class="skill-tree-name right">${treeNames.right}</span>
    </div>
    <div class="skill-tree-rows">${rowsHtml}</div>
  `;
  document.getElementById("skillTreeBackBtn").onclick = () => {
    document.getElementById("skillChoiceOverlay").style.display = "none";
    if (onClose) onClose();
    else renderRosterList();
  };
  // スキル名をタップすると、そのスキルの真下にだけ説明(+選択待ちの行なら決定ボタン)を開く。
  // 別のスキルをタップすると前に開いていたものは閉じる(アコーディオン式、同時に1つだけ開く)
  content.querySelectorAll(".skill-tree-opt").forEach((btn) => {
    const lv = Number(btn.dataset.level);
    const side = btn.dataset.side;
    const skill = tree[lv][side];
    btn.onclick = () => {
      const wrap = btn.closest(".skill-tree-row-wrap");
      const detail = wrap.querySelector(".skill-tree-inline-detail");
      const alreadyOpenForThis = detail.style.display !== "none" && detail.dataset.side === side;
      content.querySelectorAll(".skill-tree-inline-detail").forEach((d) => { d.style.display = "none"; d.innerHTML = ""; });
      if (alreadyOpenForThis) return;
      const isThisPending = lv === pendingLevel;
      const chosenSide = character.skills && character.skills[lv];
      // 「未取得」のスキル(選択待ちのレベルは両側とも例外的に見せる。選択済みのレベルは選ばなかった
      // 方の枝、まだ到達していないレベルは両方が対象)は、名前は見せたまま効果の説明だけ隠す
      const isAcquired = isThisPending || chosenSide === side;
      detail.dataset.side = side;
      detail.innerHTML = `
        <h4>Lv${lv}・【${side === "left" ? "左" : "右"}】${skill.name}</h4>
        ${isAcquired ? `<p>${skill.desc}</p>` : `<p class="skill-tree-hidden-desc">まだ習得していないため、効果は確認できません。</p>`}
        ${isThisPending ? `<button class="big primary skill-confirm-btn">このスキルに決める</button>` : ""}
      `;
      detail.style.display = "block";
      if (isThisPending) {
        detail.querySelector(".skill-confirm-btn").onclick = () => resolveSkillChoice(character, lv, side, skill);
      }
    };
  });
}

// パーティ全員(生きているメンバー)が一人ずつ逃げ切った時。誰も倒れていないので瀕死ペナルティ無しでそのまま探索画面に戻る
// 討伐依頼(受注制)の固定戦闘から、討伐せずに逃げた(個別逃走が全員そろった/煙玉を使った)場合、
// 以後は追いかけてくる状態にする(逃げる/battleがnullになる前に判定する必要があるためbattle=null直前に呼ぶ)
