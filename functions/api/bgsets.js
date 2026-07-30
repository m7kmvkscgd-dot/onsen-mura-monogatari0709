// 背景セット預かり所API(quest_editor.htmlの「背景セット」タブとClaude Codeの両方が使う)
// スマホから時間帯別の背景写真をKVへアップロードしておき、Claudeが取得→圧縮→assets/bg/へ反映する中継地点。
// キーは "bgset:<セット名>:<時間帯>" で1枚1キー(一覧はキー名だけで組めるので画像本体を読まずに済む)
// GET  /api/bgsets → [{name, phases:["dawn",...]}] 一覧(画像本体なし)
// POST /api/bgsets → {name, phase, image(dataURL)} 1枚アップロード(同じ枠への再アップロードは上書き)
const PHASES = ["dawn", "asa", "day", "dusk", "night"];

export async function onRequestGet({ env }) {
  const list = await env.REQUESTS_KV.list({ prefix: "bgset:" });
  const sets = {};
  for (const k of list.keys) {
    const parts = k.name.split(":");
    if (parts.length !== 3) continue;
    (sets[parts[1]] = sets[parts[1]] || []).push(parts[2]);
  }
  const items = Object.keys(sets).sort().map((name) => ({
    name,
    phases: PHASES.filter((p) => sets[name].includes(p)),
  }));
  return Response.json(items);
}

export async function onRequestPost({ env, request }) {
  let data;
  try { data = await request.json(); } catch (e) { return new Response("bad json", { status: 400 }); }
  const name = String(data.name || "").trim();
  // セット名はそのままassets/bg/のファイル名の頭(<name>_day.jpg等)になるため英小文字始まりに限定する
  if (!/^[a-z][a-z0-9_]{1,29}$/.test(name)) return new Response("bad name", { status: 400 });
  if (!PHASES.includes(data.phase)) return new Response("bad phase", { status: 400 });
  const image = data.image;
  if (typeof image !== "string" || !image.startsWith("data:image/") || image.length > 4000000) {
    return new Response("bad image", { status: 400 });
  }
  await env.REQUESTS_KV.put(`bgset:${name}:${data.phase}`, image);
  return Response.json({ ok: true, name, phase: data.phase });
}
