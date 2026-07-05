import json

with open('b64_classes_ipadapter_test.json', encoding='utf-8') as f:
    imgs = json.load(f)
with open('classes_ipadapter_test_results.json', encoding='utf-8') as f:
    results = json.load(f)

order = list(results.keys())


def card_html(key):
    r = results[key]
    return (
        '<figure class="card">'
        '<img src="data:image/jpeg;base64,' + imgs[key] + '" loading="lazy" />'
        '<figcaption><span class="type-label">' + r['label'] + '</span></figcaption>'
        '</figure>'
    )


cards = "\n".join(card_html(k) for k in order)

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
  .wrap { max-width: 900px; margin: 0 auto; }
  h1 { font-size: 1.3rem; margin: 0 0 0.5rem; }
  .lede { color: var(--text-muted); margin: 0 0 1.8rem; font-size: 0.9rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.8rem; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .card img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; display: block; background: var(--surface-2); }
  .card figcaption { padding: 0.6rem; text-align: center; }
  .type-label { font-weight: 700; font-size: 0.9rem; }
"""

html = f"""<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>IPAdapter画風転写テスト</title>
<style>{css}</style></head><body>
<div class="wrap">
  <h1>侍の画風をIPAdapterで転写するテスト</h1>
  <p class="lede">samurai_style_ref.pngをスタイル参照(style transferモード)、weight=0.5と0.7で比較。</p>
  <div class="grid">{cards}</div>
</div>
</body></html>
"""

with open('classes_ipadapter_test.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("written", len(html))
