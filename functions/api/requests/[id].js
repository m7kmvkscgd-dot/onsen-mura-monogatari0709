// 要望・バグ報告API(個別項目)
// GET   /api/requests/:id → 単体JSON(画像込み)
// PATCH /api/requests/:id → {status?, note?}を部分更新(Claudeの対応記録、ユーザーの確認済み化)

export async function onRequestGet({ env, params }) {
  const it = await env.REQUESTS_KV.get("req:" + params.id, "json");
  return it ? Response.json(it) : new Response("not found", { status: 404 });
}

export async function onRequestPatch({ env, params, request }) {
  const key = "req:" + params.id;
  const it = await env.REQUESTS_KV.get(key, "json");
  if (!it) return new Response("not found", { status: 404 });
  let data;
  try { data = await request.json(); } catch (e) { return new Response("bad json", { status: 400 }); }
  if (data.status && ["open", "done", "closed"].includes(data.status)) it.status = data.status;
  if (typeof data.note === "string") it.note = data.note.slice(0, 20000);
  await env.REQUESTS_KV.put(key, JSON.stringify(it));
  return Response.json({ ok: true });
}
