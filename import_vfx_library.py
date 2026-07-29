# -*- coding: utf-8 -*-
# vfxアニメーションエディター用の取り込みスクリプト。
# iCloud Drive(温泉村物語用/VFX系)配下の素材を読み、ブラウザで使える形式に変換して
# assets/vfx_library/ へコピーし、エディター(vfx_editor.html)が読むmanifest(vfx_library_manifest.json)を書き出す。
# 「手動更新」運用のため常駐監視はせず、素材を追加したらこのスクリプトを都度実行し直す想定。
#
# 対応する2形式:
#   1. flipbooks/*_AxB.tga  … 1枚にAxB(横x縦)コマが敷き詰められたスプライトシート。
#      ファイル名末尾の"AxB"からグリッドを読み取り、ラスタ順(左上から右へ、行ごとに下へ)で
#      frame_1.png, frame_2.png... に自動で切り出す(このゲームの通常攻撃VFXと同じ「連番PNG」形式に統一するため)。
#   2. particles/alpha/*.png … 単体の静止パーティクル画像。1コマ(frames=1)のエントリとして扱う。
#      particles/opague(不透明・黒背景版)は加算合成向けでそのままの重ね描きに向かないため取り込み対象外。
import os
import re
import json
import sys
from PIL import Image

SRC_ROOT = r"C:\Users\keiic\iCloudDrive\温泉村物語用\VFX系"
OUT_DIR = "assets/vfx_library"
MANIFEST_PATH = "vfx_library_manifest.json"

GRID_RE = re.compile(r"_(\d+)x(\d+)$")

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
        "framePrefix": f"{OUT_DIR}/{base_name}/frame_",
        "frameCount": frame,
        "cellW": cell_w,
        "cellH": cell_h,
    }

def import_particle(png_path, base_name):
    im = Image.open(png_path).convert("RGBA")
    out_path = os.path.join(OUT_DIR, "particles", f"{base_name}.png")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    im.save(out_path)
    return {
        "id": f"particles/{base_name}",
        "label": base_name,
        "category": "particle",
        "singleSrc": out_path.replace("\\", "/"),
        "frameCount": 1,
        "cellW": im.width,
        "cellH": im.height,
    }

def main():
    if not os.path.isdir(SRC_ROOT):
        print(f"iCloudの取り込み元フォルダが見つかりません: {SRC_ROOT}")
        sys.exit(1)
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
        print("=== particles/alpha(単体パーティクル)を取り込み中 ===")
        for fn in sorted(os.listdir(particles_dir)):
            if not fn.lower().endswith(".png"):
                continue
            base_name = os.path.splitext(fn)[0]
            entry = import_particle(os.path.join(particles_dir, fn), base_name)
            manifest.append(entry)
        print(f"  -> {len([e for e in manifest if e['category'] == 'particle'])}件取り込み")

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"\n合計 {len(manifest)} 件を {MANIFEST_PATH} に書き出しました。")

if __name__ == "__main__":
    main()
