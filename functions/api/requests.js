// 要望・バグ報告API(requests.htmlのフォームとClaude Codeの両方が使う)
// GET  /api/requests        → 一覧JSON(軽さ優先で画像本体は省きimageCountのみ。?full=1で画像込み)
// POST /api/requests        → 新規作成 {category, body, images:[dataURL...]}
// ステータス: open=未対応 → done=対応済み(Claudeが対応メモ付きで変更) → closed=ユーザー確認済みで非表示

export async function onRequestGet({ env, request }) {
  const full = new URL(request.url).searchParams.get("full") === "1";
  const list = await env.REQUESTS_KV.list({ prefix: "req:" });
  const items = [];
  for (const k of list.keys) {
    const it = await env.REQUESTS_KV.get(k.name, "json");
    if (!it) continue;
    if (full) {
      items.push(it);
    } else {
      const { images, ...rest } = it;
      items.push({ ...rest, imageCount: (images || []).length });
    }
  }
  items.sort((a, b) => b.id - a.id);
  return Response.json(items);
}

export async function onRequestPost({ env, request }) {
  let data;
  try { data = await request.json(); } catch (e) { return new Response("bad json", { status: 400 }); }
  const body = String(data.body || "").slice(0, 20000).trim();
  if (!body) return new Response("body required", { status: 400 });
  const images = Array.isArray(data.images)
    ? data.images.slice(0, 4).filter((s) => typeof s === "string" && s.startsWith("data:image/") && s.length < 2000000)
    : [];
  const id = Date.now();
  const item = {
    id,
    category: ["bug", "wish", "other"].includes(data.category) ? data.category : "other",
    body,
    images,
    status: "open",
    note: "",
    createdAt: new Date().toISOString(),
  };
  await env.REQUESTS_KV.put("req:" + id, JSON.stringify(item));
  return Response.json({ ok: true, id });
}
