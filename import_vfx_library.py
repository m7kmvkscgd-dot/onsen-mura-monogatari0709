# -*- coding: utf-8 -*-
# vfxアニメーションエディター用の取り込みスクリプト。
# iCloud Drive(温泉村物語用/VFX系)配下の素材を読み、ブラウザで使える形式に変換して
# assets/vfx_library/ へコピーし、エディター(vfx_editor.html)が読むmanifest(vfx_library_manifest.json)を書き出す。
# 「手動更新」運用のため常駐監視はせず、素材を追加したらこのスクリプトを都度実行し直す想定。
# 実行のたびにassets/vfx_library/を作り直す(古い素材が残り続けないように)。
#
# 対応する4つの取り込み元(2026-07-29に3つ追加):
#   1. brackeys_vfx_bundle/flipbooks/*_AxB.tga … 1枚にAxB(横x縦)コマが敷き詰められたスプライトシート。
#      黒背景+低アルファ(TGA、加算合成前提)。ファイル名末尾の"AxB"からグリッドを読み取り、
#      ラスタ順でframe_1.png, frame_2.png...に自動で切り出す。
#   2. brackeys_vfx_bundle/particles/alpha/*.png … 末尾が連番のものは1つのアニメの連続コマとみなし
#      まとめる。連番が1つしか無い名前はそのまま単発(1コマ)として扱う。ちゃんとしたアルファで作られている。
#   3. codemanu_vfx_free_pack/Effect_*/Frames/Effect_*_1/*.png … CodeManu「VFX Free Pack」(CC0)。
#      あらかじめ切り出し済みの連番フレームなので、スライスせずそのままコピー&連番振り直しのみ。
#      本物のアルファ透過で作られている(黒背景ではない)。
#   4. codemanu_pixel_effects_pack/*_spritesheet.png … CodeManu「Free Pixel Effects Pack」(CC0)。
#      1枚に正方形グリッドで敷き詰められたスプライトシート(1コマ100x100px、README.txt記載)。
#      本物のアルファ透過。グリッドはファイル名ではなく画像サイズ÷100から算出。
#   5. kenney_smoke_particles/PNG/<スタイル名>/*.png … Kenney「Smoke Particles」(CC0)。
#      連番だが中身はアニメの連続コマではなく、形の違う独立したバリエーション画像
#      (サイズがバラバラ=非連続と確認済み)。1枚1枚を単発(particle_single)として取り込む。
#
# source(エディター側での既定の重ね方=mix-blend-mode:screenを付けるかの判断に使う):
#   "spritesheet"        … 黒背景+低アルファ前提のflipbooks由来(既定でON=加算合成)
#   "particle_sequence"  … 連番アニメ。ちゃんとしたアルファで作られている(既定OFF)
#   "particle_single"    … 単発。同上(既定OFF)
#   "codemanu_alpha_seq"  … CodeManu VFX Free Packの連番フレーム。本物のアルファ(既定OFF)
#   "codemanu_alpha_sheet" … CodeManu Pixel Effects Packのスライス済みシート。本物のアルファ(既定OFF)
#   "kenney_alpha_particle" … Kenney Smoke Particlesの単発。本物のアルファ(既定OFF)
#
# tags: 素材名からのキーワード推測によるジャンル分け(fire/smoke/explosion/impact/blood/magic/
#   ice/electric/light/swirl)。エディター側の絞り込みタブ用。あくまで簡易的な自動分類なので、
#   違うと感じたらこのスクリプトのTAG_KEYWORDSを直接編集すればよい。
import os
import re
import json
import sys
import glob
import shutil
from PIL import Image

SRC_ROOT = r"C:\Users\keiic\iCloudDrive\温泉村物語用\VFX系"
OUT_DIR = "assets/vfx_library"
MANIFEST_PATH = "vfx_library_manifest.json"

GRID_RE = re.compile(r"_(\d+)x(\d+)$")
SEQ_RE = re.compile(r"^(.+?)_(\d+)(_a)?$")
NUM_SUFFIX_RE = re.compile(r"(\d+)$")

TAG_KEYWORDS = {
    "fire": ["fire", "flame", "magma", "burn", "scorch", "flamelash"],
    "smoke": ["smoke", "cloud", "puff", "fart", "dirt", "wispy", "dust"],
    "explosion": ["explosion", "kaboom", "blast", "bighit"],
    # 「hit」は"white"等に偶然含まれ誤爆するため使わず、具体的な複合語のみで判定する
    "impact": ["impact", "weaponhit", "bighit", "smallhit", "magickahit", "slash", "scratch", "muzzle"],
    "blood": ["blood"],
    "magic": ["magic", "spell", "casting", "bubble", "symbol", "trace", "window",
              "charge", "phantom", "anima", "effect", "midnight", "protection"],
    "ice": ["freezing", "ice", "frost"],
    "electric": ["electric", "spark", "shield"],
    "light": ["light", "star", "spotlight", "flare", "flash", "constellation",
              "loading", "glow", "powerchords"],
    "swirl": ["vortex", "wheel", "twirl", "tentacle", "worm", "spin", "nebula",
              "hyperspeed", "circle", "ring"],
}


def guess_tags(name):
    name_norm = name.lower().replace("_", "").replace(" ", "")
    tags = [tag for tag, kws in TAG_KEYWORDS.items() if any(kw in name_norm for kw in kws)]
    return tags or ["other"]


def col_edges(n, count):
    # 画像サイズがcount(コマ数)で割り切れない場合に、列を追うごとにズレが蓄積しないよう、
    # 各境界を「その都度、画像全体に対する比率から丸めて」計算する(隣接コマ間で最大1pxしかブレない)
    return [round(i * n / count) for i in range(count + 1)]


def slice_grid(im, cols, rows, out_subdir):
    x_edges = col_edges(im.width, cols)
    y_edges = col_edges(im.height, rows)
    os.makedirs(out_subdir, exist_ok=True)
    frame = 0
    for row in range(rows):
        for col in range(cols):
            frame += 1
            box = (x_edges[col], y_edges[row], x_edges[col + 1], y_edges[row + 1])
            im.crop(box).save(os.path.join(out_subdir, f"frame_{frame}.png"))
    return frame


def slice_flipbook(tga_path, base_name):
    im = Image.open(tga_path).convert("RGBA")
    m = GRID_RE.search(base_name)
    if not m:
        print(f"  [skip] グリッド指定(_AxB)が見つからない: {base_name}")
        return None
    cols, rows = int(m.group(1)), int(m.group(2))
    if im.width % cols != 0 or im.height % rows != 0:
        print(f"  [note] {base_name}: 画像サイズ{im.size}は{cols}x{rows}で割り切れないため、コマごとに比率丸めで境界を計算します(蓄積ズレ無し)")
    out_subdir = os.path.join(OUT_DIR, base_name)
    frame_count = slice_grid(im, cols, rows, out_subdir)
    cell_w, cell_h = round(im.width / cols), round(im.height / rows)
    return {
        "id": base_name,
        "label": base_name,
        "category": "flipbook",
        "source": "spritesheet",
        "framePrefix": f"{OUT_DIR}/{base_name}/frame_",
        "frameCount": frame_count,
        "cellW": cell_w,
        "cellH": cell_h,
        "tags": guess_tags(base_name),
    }


def import_particle_group(prefix, files_in_order, particles_dir):
    first_im = Image.open(os.path.join(particles_dir, files_in_order[0][1])).convert("RGBA")
    if len(files_in_order) == 1:
        out_path = os.path.join(OUT_DIR, "particles", f"{prefix}.png")
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        first_im.save(out_path)
        return {
            "id": f"particles/{prefix}",
            "label": prefix,
            "category": "particle",
            "source": "particle_single",
            "singleSrc": out_path.replace("\\", "/"),
            "frameCount": 1,
            "cellW": first_im.width,
            "cellH": first_im.height,
            "tags": guess_tags(prefix),
        }
    out_subdir = os.path.join(OUT_DIR, "particles_seq", prefix)
    os.makedirs(out_subdir, exist_ok=True)
    for i, (_, fn) in enumerate(files_in_order, start=1):
        im = Image.open(os.path.join(particles_dir, fn)).convert("RGBA")
        im.save(os.path.join(out_subdir, f"frame_{i}.png"))
    return {
        "id": f"particles_seq/{prefix}",
        "label": prefix,
        "category": "flipbook",
        "source": "particle_sequence",
        "framePrefix": f"{OUT_DIR}/particles_seq/{prefix}/frame_",
        "frameCount": len(files_in_order),
        "cellW": first_im.width,
        "cellH": first_im.height,
        "tags": guess_tags(prefix),
    }


def camel_to_snake(name):
    return re.sub(r"(?<=[a-z0-9])(?=[A-Z0-9])", "_", name).lower()


def import_codemanu_vfx_free(src_root):
    root = os.path.join(src_root, "codemanu_vfx_free_pack")
    if not os.path.isdir(root):
        return []
    entries = []
    for effect_dir in sorted(os.listdir(root)):
        if not effect_dir.startswith("Effect_"):
            continue
        matches = glob.glob(os.path.join(root, effect_dir, "Frames", "Effect_*_1"))
        if not matches:
            print(f"  [skip] Framesフォルダが見つからない: {effect_dir}")
            continue
        frames_dir = matches[0]
        files = sorted(
            (fn for fn in os.listdir(frames_dir) if fn.lower().endswith(".png")),
            key=lambda fn: int(NUM_SUFFIX_RE.search(os.path.splitext(fn)[0]).group(1)),
        )
        if not files:
            continue
        slug = camel_to_snake(effect_dir[len("Effect_"):])
        out_subdir = os.path.join(OUT_DIR, "codemanu_vfx_free", slug)
        os.makedirs(out_subdir, exist_ok=True)
        first_im = None
        for i, fn in enumerate(files, start=1):
            im = Image.open(os.path.join(frames_dir, fn)).convert("RGBA")
            if first_im is None:
                first_im = im
            im.save(os.path.join(out_subdir, f"frame_{i}.png"))
        entries.append({
            "id": f"codemanu_vfx_free/{slug}",
            "label": slug,
            "category": "flipbook",
            "source": "codemanu_alpha_seq",
            "framePrefix": f"{OUT_DIR}/codemanu_vfx_free/{slug}/frame_",
            "frameCount": len(files),
            "cellW": first_im.width,
            "cellH": first_im.height,
            "tags": guess_tags(slug),
        })
    return entries


PIXEL_EFFECTS_RE = re.compile(r"^\d+_(.+)_spritesheet$")


def import_codemanu_pixel_effects(src_root):
    root = os.path.join(src_root, "codemanu_pixel_effects_pack")
    if not os.path.isdir(root):
        return []
    entries = []
    for fn in sorted(os.listdir(root)):
        if not fn.lower().endswith("_spritesheet.png"):
            continue
        base = os.path.splitext(fn)[0]
        m = PIXEL_EFFECTS_RE.match(base)
        slug = m.group(1) if m else base
        im = Image.open(os.path.join(root, fn)).convert("RGBA")
        # README.txt: 1コマ100x100px固定の正方形グリッド
        cols, rows = round(im.width / 100), round(im.height / 100)
        out_subdir = os.path.join(OUT_DIR, "codemanu_pixel_effects", slug)
        frame_count = slice_grid(im, cols, rows, out_subdir)
        cell_w, cell_h = round(im.width / cols), round(im.height / rows)
        entries.append({
            "id": f"codemanu_pixel_effects/{slug}",
            "label": slug,
            "category": "flipbook",
            "source": "codemanu_alpha_sheet",
            "framePrefix": f"{OUT_DIR}/codemanu_pixel_effects/{slug}/frame_",
            "frameCount": frame_count,
            "cellW": cell_w,
            "cellH": cell_h,
            "tags": guess_tags(slug),
        })
    return entries


def import_kenney_smoke(src_root):
    root = os.path.join(src_root, "kenney_smoke_particles", "PNG")
    if not os.path.isdir(root):
        return []
    entries = []
    for style_dir in sorted(os.listdir(root)):
        style_path = os.path.join(root, style_dir)
        if not os.path.isdir(style_path):
            continue
        style_slug = re.sub(r"\s+", "_", style_dir.strip()).lower()
        for fn in sorted(os.listdir(style_path)):
            if not fn.lower().endswith(".png"):
                continue
            name = os.path.splitext(fn)[0]
            im = Image.open(os.path.join(style_path, fn)).convert("RGBA")
            out_path = os.path.join(OUT_DIR, "kenney_smoke", f"{name}.png")
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            im.save(out_path)
            entries.append({
                "id": f"kenney_smoke/{name}",
                "label": f"kenney_{name}",
                "category": "particle",
                "source": "kenney_alpha_particle",
                "singleSrc": out_path.replace("\\", "/"),
                "frameCount": 1,
                "cellW": im.width,
                "cellH": im.height,
                "tags": guess_tags(style_slug),
            })
    return entries


def main():
    if not os.path.isdir(SRC_ROOT):
        print(f"iCloudの取り込み元フォルダが見つかりません: {SRC_ROOT}")
        sys.exit(1)
    if os.path.isdir(OUT_DIR):
        shutil.rmtree(OUT_DIR)
    manifest = []

    flipbooks_dir = os.path.join(SRC_ROOT, "brackeys_vfx_bundle", "flipbooks")
    if os.path.isdir(flipbooks_dir):
        print("=== brackeys_vfx_bundle/flipbooks(スプライトシート)を切り出し中 ===")
        for fn in sorted(os.listdir(flipbooks_dir)):
            if not fn.lower().endswith(".tga"):
                continue
            base_name = os.path.splitext(fn)[0]
            print(f"  {fn} ...")
            entry = slice_flipbook(os.path.join(flipbooks_dir, fn), base_name)
            if entry:
                manifest.append(entry)
                print(f"    -> {entry['frameCount']}コマ ({entry['cellW']}x{entry['cellH']}px/コマ)")

    particles_dir = os.path.join(SRC_ROOT, "brackeys_vfx_bundle", "particles", "alpha")
    if os.path.isdir(particles_dir):
        print("=== brackeys_vfx_bundle/particles/alpha(連番はアニメ化、単発はそのまま)を取り込み中 ===")
        groups = {}
        singles = []
        for fn in sorted(os.listdir(particles_dir)):
            if not fn.lower().endswith(".png"):
                continue
            base = os.path.splitext(fn)[0]
            m = SEQ_RE.match(base)
            if not m:
                singles.append((base, fn))
                continue
            groups.setdefault(m.group(1), []).append((int(m.group(2)), fn))
        seq_count, single_count = 0, 0
        for prefix in sorted(groups):
            items = sorted(groups[prefix])
            entry = import_particle_group(prefix, items, particles_dir)
            manifest.append(entry)
            if len(items) > 1:
                seq_count += 1
                print(f"  {prefix}: {len(items)}コマの連番アニメとして統合")
            else:
                single_count += 1
        for base, fn in singles:
            entry = import_particle_group(base, [(1, fn)], particles_dir)
            manifest.append(entry)
            single_count += 1
        print(f"  -> 連番アニメ{seq_count}種、単発{single_count}件を取り込み")

    print("=== codemanu_vfx_free_pack(切り出し済み連番フレーム)を取り込み中 ===")
    entries = import_codemanu_vfx_free(SRC_ROOT)
    manifest.extend(entries)
    print(f"  -> {len(entries)}種を取り込み")

    print("=== codemanu_pixel_effects_pack(正方形グリッドのスプライトシート)を切り出し中 ===")
    entries = import_codemanu_pixel_effects(SRC_ROOT)
    manifest.extend(entries)
    print(f"  -> {len(entries)}種を取り込み")

    print("=== kenney_smoke_particles(単発バリエーション)を取り込み中 ===")
    entries = import_kenney_smoke(SRC_ROOT)
    manifest.extend(entries)
    print(f"  -> {len(entries)}件を取り込み")

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"\n合計 {len(manifest)} 件を {MANIFEST_PATH} に書き出しました。")


if __name__ == "__main__":
    main()
