import json

with open('b64_classes_test.json', encoding='utf-8') as f:
    imgs = json.load(f)
with open('classes_test_results.json', encoding='utf-8') as f:
    results = json.load(f)

order = list(results.keys())


def card_html(key):
    r = results[key]
    return (
        '<figure class="card">'
        '<img src="data:image/jpeg;base64,' + imgs[key] + '" alt="' + r['label'] + '" loading="lazy" />'
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
  .wrap { max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 1.4rem; margin: 0 0 0.5rem; }
  .lede { color: var(--text-muted); margin: 0 0 1.8rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.7rem; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .card img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; display: block; background: var(--surface-2); }
  .card figcaption { padding: 0.5rem; text-align: center; }
  .type-label { font-weight: 700; font-size: 0.9rem; }
"""

html = f"""<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><title>ダンジョン1 職業キャラ デザインテスト</title>
<style>{css}</style></head><body>
<div class="wrap">
  <h1>ダンジョン1 — 8職業キャラ デザインテスト</h1>
  <p class="lede">美少女デフォルメ、右30度の三分の一視点、FLUX.2-klein-4b(LoRAなし)、1024×1024、steps=4。</p>
  <div class="grid">{cards}</div>
</div>
</body></html>
"""

with open('classes_test.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("written", len(html))
