import json

with open('b64_classes_test.json', encoding='utf-8') as f:
    imgs_flux = json.load(f)
with open('b64_classes_noobai_test.json', encoding='utf-8') as f:
    imgs_noobai = json.load(f)
with open('classes_test_results.json', encoding='utf-8') as f:
    results = json.load(f)

order = list(results.keys())


def row_html(key):
    r = results[key]
    return (
        '<div class="row">'
        '<div class="pair">'
        '<figure><img src="data:image/jpeg;base64,' + imgs_flux[key] + '" loading="lazy" /><figcaption>FLUX.2-klein-4b</figcaption></figure>'
        '<figure><img src="data:image/jpeg;base64,' + imgs_noobai[key] + '" loading="lazy" /><figcaption>NoobAI-XL</figcaption></figure>'
        '</div>'
        '<p class="type-label">' + r['label'] + '</p>'
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
  .wrap { max-width: 700px; margin: 0 auto; }
  h1 { font-size: 1.3rem; margin: 0 0 0.5rem; }
  .lede { color: var(--text-muted); margin: 0 0 1.8rem; font-size: 0.9rem; }
  .row { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 0.8rem; margin-bottom: 1rem; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
  .pair figure { margin: 0; }
  .pair img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; display: block; border-radius: 6px; background: var(--surface-2); }
  .pair figcaption { text-align: center; font-size: 0.72rem; color: var(--text-muted); margin-top: 0.3rem; }
  .type-label { font-weight: 700; font-size: 1rem; text-align: center; margin: 0.6rem 0 0; }
"""

html = f"""<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ダンジョン1 職業キャラ 画風比較</title>
<style>{css}</style></head><body>
<div class="wrap">
  <h1>ダンジョン1 — 職業キャラ 画風比較(FLUX vs NoobAI-XL)</h1>
  <p class="lede">左: 現行のFLUX.2-klein-4b / 右: NoobAI-XL(アニメ特化SDXL)。同じ職業説明文から生成。</p>
  {rows}
</div>
</body></html>
"""

with open('classes_compare.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("written", len(html))
