# -*- coding: utf-8 -*-
# vfxアニメーションエディター用の取り込みスクリプト。
# iCloud Drive(温泉村物語用/VFX系)配下の素材を読み、ブラウザで使える形式に変換して
# assets/vfx_library/ へコピーし、エディター(vfx_editor.html)が読むmanifest(vfx_library_manifest.json)を書き出す。
# 「手動更新」運用のため常駐監視はせず、素材を追加したらこのスクリプトを都度実行し直す想定。
# 実行のたびにassets/vfx_library/を作り直す(古い素材が残り続けないように)。
#
# 対応する2形式:
#   1. flipbooks/*_AxB.tga … 1枚にAxB(横x縦)コマが敷き詰められたスプライトシート。
#      ファイル名末尾の"AxB"からグリッドを読み取り、ラスタ順(左上から右へ、行ごとに下へ)で
#      frame_1.png, frame_2.png... に自動で切り出す(このゲームの通常攻撃VFXと同じ「連番PNG」形式に統一するため)。
#   2. particles/alpha/*.png … 末尾が連番(例: scorch_01_a, scorch_02_a, scorch_03_a)のものは
#      「1つのアニメの連続コマ」とみなして番号順にframe_1.png...へまとめる(ユーザー指摘: 単発の
#      静止画ではなく繋がったアニメーション素材だった)。連番が1つしか無い名前(flare_01_aなど)は
#      そのまま単発(1コマ)のエントリとして扱う。particles/opague(不透明・黒背景版、加算合成向け)は
#      取り込み対象外。
#
# source(エディター側での既定の重ね方の判断に使う):
#   "spritesheet"      … 黒背景+低アルファの加算合成前提が多いflipbooks由来(既定で加算重ね)
#   "particle_sequence" … particles/alphaの連番グループ(通常のアルファ合成で作られている)
#   "particle_single"   … particles/alphaの単発(同上)
import os
import re
import json
import sys
import shutil
from PIL import Image

SRC_ROOT = r"C:\Users\keiic\iCloudDrive\温泉村物語用\VFX系"
OUT_DIR = "assets/vfx_library"
MANIFEST_PATH = "vfx_library_manifest.json"

GRID_RE = re.compile(r"_(\d+)x(\d+)$")
SEQ_RE = re.compile(r"^(.+?)_(\d+)(_a)?$")

def slice_flipbook(tga_path, base_name):
    im = Image.open(tga_path).convert("RGBA")
    m = GRID_RE.search(base_name)
    if not m:
        print(f"  [skip] グリッド指定(_AxB)が見つからない: {base_name}")
        return None
    cols, rows = int(m.group(1)), int(m.group(2))
    if im.width % cols != 0 or im.height % rows != 0:
        print(f"  [warn] {base_name}: 画像サイズ{im.size}が{cols}x{rows}で割り切れません(端数切り捨て)")
    cell_w, cell_h = im.width // cols, im.height // rows
    out_subdir = os.path.join(OUT_DIR, base_name)
    os.makedirs(out_subdir, exist_ok=True)
    frame = 0
    for row in range(rows):
        for col in range(cols):
            frame += 1
            box = (col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h)
            cell = im.crop(box)
            cell.save(os.path.join(out_subdir, f"frame_{frame}.png"))
    return {
        "id": base_name,
        "label": base_name,
        "category": "flipbook",
        "source": "spritesheet",
        "framePrefix": f"{OUT_DIR}/{base_name}/frame_",
        "frameCount": frame,
        "cellW": cell_w,
        "cellH": cell_h,
    }

def import_particle_group(prefix, files_in_order, particles_dir):
    # files_in_order: [(番号, ファイル名), ...] 番号昇順
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
    }

def main():
    if not os.path.isdir(SRC_ROOT):
        print(f"iCloudの取り込み元フォルダが見つかりません: {SRC_ROOT}")
        sys.exit(1)
    if os.path.isdir(OUT_DIR):
        shutil.rmtree(OUT_DIR)
    manifest = []

    flipbooks_dir = os.path.join(SRC_ROOT, "brackeys_vfx_bundle", "flipbooks")
    if os.path.isdir(flipbooks_dir):
        print("=== flipbooks(スプライトシート)を切り出し中 ===")
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
        print("=== particles/alpha(連番はアニメ化、単発はそのまま)を取り込み中 ===")
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

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"\n合計 {len(manifest)} 件を {MANIFEST_PATH} に書き出しました。")

if __name__ == "__main__":
    main()
