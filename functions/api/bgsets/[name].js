// 背景セット預かり所API(個別セット)
// GET    /api/bgsets/:name            → {name, images:{dawn:dataURL,...}} 画像込み(Claudeの取得・エディタのプレビュー用)
// GET    /api/bgsets/:name?phase=day  → 指定の1枚だけ
// DELETE /api/bgsets/:name            → セットごと削除(全時間帯)
// DELETE /api/bgsets/:name?phase=day  → 指定の1枚だけ削除
const PHASES = ["dawn", "asa", "day", "dusk", "night"];

function targetPhases(request) {
  const only = new URL(request.url).searchParams.get("phase");
  return only ? PHASES.filter((p) => p === only) : PHASES;
}

export async function onRequestGet({ env, params, request }) {
  const images = {};
  for (const p of targetPhases(request)) {
    const v = await env.REQUESTS_KV.get(`bgset:${params.name}:${p}`);
    if (v) images[p] = v;
  }
  if (!Object.keys(images).length) return new Response("not found", { status: 404 });
  return Response.json({ name: params.name, images });
}

export async function onRequestDelete({ env, params, request }) {
  for (const p of targetPhases(request)) {
    await env.REQUESTS_KV.delete(`bgset:${params.name}:${p}`);
  }
  return Response.json({ ok: true });
}
