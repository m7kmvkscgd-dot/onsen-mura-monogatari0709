import json

with open('b64_classes_noobai_variants.json', encoding='utf-8') as f:
    imgs = json.load(f)
with open('classes_noobai_variants_results.json', encoding='utf-8') as f:
    results = json.load(f)

order = list(results.keys())


def row_html(key):
    r = results[key]
    imgs_html = "\n".join(
        f'<figure><img src="data:image/jpeg;base64,{b64}" loading="lazy" /><figcaption>案{i+1}</figcaption></figure>'
        for i, b64 in enumerate(imgs[key])
    )
    return (
        '<div class="row">'
        f'<p class="type-label">{r["label"]}</p>'
        f'<div class="variants">{imgs_html}</div>'
        '</div>'
    )


rows = "\n".join(row_html(k) for k in order)

css = """
  :root {
    --bg: #eef1ee; --surface: #ffffff; --surface-2: #f5f7f4;
    --text: #1f2623; --text-muted: #5c6a63; --accent: #2f4c73;
    --accent-soft: #dbe3ec; --border: #d5dbd3;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #14181b; --surface: #1c2226; --surface-2: #20272b;
      --text: #e8ecea; --text-muted: #9aa79f; --accent: #8fadcf;
      --accent-soft: #253244; --border: #2a3236;
    }
  }
  * { box-sizing: border-box; }
  body {
    background: var(--bg); color: var(--text);
    font-family: "Yu Gothic", "Hiragino Sans", "Meiryo", system-ui, sans-serif;
    margin: 0; padding: 2rem 1.5rem 4rem; line-height: 1.6;
  }
  .wrap { max-width: 720px; margin: 0 auto; }
  h1 { font-size: 1.3rem; margin: 0 0 0.5rem; }
  .lede { color: var(--text-muted); margin: 0 0 1.8rem; font-size: 0.9rem; }
  .row { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 0.8rem; margin-bottom: 1rem; }
  .type-label { font-weight: 700; font-size: 1rem; margin: 0 0 0.5rem; }
  .variants { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
  .variants figure { margin: 0; }
  .variants img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; display: block; border-radius: 6px; background: var(--surface-2); }
  .variants figcaption { text-align: center; font-size: 0.7rem; color: var(--text-muted); margin-top: 0.2rem; }
"""

html = f"""<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ダンジョン1 職業キャラ 当たり探し</title>
<style>{css}</style></head><body>
<div class="wrap">
  <h1>ダンジョン1 — 8職業×3パターン 当たり探し</h1>
  <p class="lede">NoobAI-XL、同じ職業説明文でシード違い3枚ずつ。各職業で一番いい案を教えてください。</p>
  {rows}
</div>
</body></html>
"""

with open('classes_variants.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("written", len(html))
