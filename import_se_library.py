# -*- coding: utf-8 -*-
# VFXアニメーションエディター用のSE(効果音)取り込みスクリプト。import_vfx_library.pyと対の関係。
# iCloud Drive(温泉村物語用/SE系)配下の素材を読み、assets/se_library/ へコピーし、
# エディター(vfx_editor.html)が読むmanifest(se_library_manifest.json)を書き出す。
# 「手動更新」運用のため常駐監視はせず、素材を追加したらこのスクリプトを都度実行し直す想定。
# 実行のたびにassets/se_library/を作り直す(古い素材が残り続けないように)。
#
# 取り込み元(2026-07-29、毒/出血/炎上のダメージ音+汎用打撃音を探した結果):
#   ogart_80_rpg_sfx      … 「80 CC0 RPG SFX」by rubberduck(OpenGameArt.org、CC0)。
#                            blade/creature_hurt/creature_slime/creature_monster/spell_fire等
#   ogart_80_creature_sfx … 「80 CC0 creature SFX」by rubberduck(OpenGameArt.org、CC0)。
#                            hurt/roar/scream/burble/grunt等の生物系リアクション音
#   ogart_100_cc0_sfx_selected … 「100 CC0 SFX」(OpenGameArt.org、CC0)から爆発/打撃/水音のみ抜粋
#                            (元パックは食器/トイレ等の生活音が大半でこのゲームに合わないため一部のみ)
#   kenney_impact_sounds  … Kenney「Impact Sounds」(CC0)からfootstep系を除いた打撃/衝撃音一式
#
# 音声ファイルはVFXと違って画像処理(スライス等)が不要なため、単純にコピー+マニフェスト生成のみ。
# 再生時間はmutagenで取得(無ければ取得をスキップして続行、必須の依存関係にはしない)。
#
# tags: ファイル名からのキーワード推測によるジャンル分け(fire/poison/impact/blood/magic/
#   explosion/metal/creature/misc)。エディター側の絞り込みタブ用。VFXのguess_tags()と同じ考え方。
import os
import re
import json
import sys
import shutil

try:
    from mutagen.oggvorbis import OggVorbis
    HAS_MUTAGEN = True
except ImportError:
    HAS_MUTAGEN = False

SRC_ROOT = r"C:\Users\keiic\iCloudDrive\温泉村物語用\SE系"
OUT_DIR = "assets/se_library"
MANIFEST_PATH = "se_library_manifest.json"

SE_TAG_KEYWORDS = {
    "fire": ["fire", "spellfire"],
    "poison": ["slime", "burble", "spit"],
    "impact": ["impact", "hit", "blade", "punch", "wood", "glass", "plank", "tin", "plate",
               "bell", "generic", "mining"],
    "blood": ["hurt", "plop"],
    "magic": ["spell", "gem"],
    "explosion": ["explosion", "blast"],
    "metal": ["metal", "chain", "metalclick", "metallatch", "metalpot"],
    "creature": ["creature", "monster", "roar", "scream", "howl", "grunt", "growl", "die",
                 "troll", "alien", "bug", "weird", "eat", "bark"],
    "misc": ["item", "coin", "gem", "stone", "wood", "lock", "book", "misc", "cough", "cute",
             "burp", "nose", "ooh", "snore"],
}


def guess_se_tags(name):
    name_norm = name.lower().replace("_", "").replace(" ", "").replace("-", "")
    tags = [tag for tag, kws in SE_TAG_KEYWORDS.items() if any(kw in name_norm for kw in kws)]
    return tags or ["other"]


def get_duration(path):
    if not HAS_MUTAGEN:
        return None
    try:
        return round(OggVorbis(path).info.length, 2)
    except Exception:
        return None


PACKS = [
    {"dir": "ogart_80_rpg_sfx", "label": "80 CC0 RPG SFX", "license": "CC0"},
    {"dir": "ogart_80_creature_sfx", "label": "80 CC0 creature SFX", "license": "CC0"},
    {"dir": "ogart_100_cc0_sfx_selected", "label": "100 CC0 SFX(抜粋)", "license": "CC0"},
    {"dir": "kenney_impact_sounds", "label": "Kenney Impact Sounds", "license": "CC0"},
]


def import_pack(src_root, pack):
    src_dir = os.path.join(src_root, pack["dir"])
    if not os.path.isdir(src_dir):
        return []
    entries = []
    out_subdir = os.path.join(OUT_DIR, pack["dir"])
    os.makedirs(out_subdir, exist_ok=True)
    for fn in sorted(os.listdir(src_dir)):
        if not fn.lower().endswith((".ogg", ".wav", ".mp3")):
            continue
        name = os.path.splitext(fn)[0]
        src_path = os.path.join(src_dir, fn)
        out_path = os.path.join(out_subdir, fn)
        shutil.copyfile(src_path, out_path)
        entries.append({
            "id": f"{pack['dir']}/{name}",
            "label": name,
            "pack": pack["label"],
            "src": out_path.replace("\\", "/"),
            "duration": get_duration(src_path),
            "tags": guess_se_tags(name),
        })
    return entries


def main():
    if not os.path.isdir(SRC_ROOT):
        print(f"iCloudの取り込み元フォルダが見つかりません: {SRC_ROOT}")
        sys.exit(1)
    if os.path.isdir(OUT_DIR):
        shutil.rmtree(OUT_DIR)
    manifest = []
    for pack in PACKS:
        print(f"=== {pack['dir']}({pack['label']})を取り込み中 ===")
        entries = import_pack(SRC_ROOT, pack)
        manifest.extend(entries)
        print(f"  -> {len(entries)}件を取り込み")
    if not HAS_MUTAGEN:
        print("[note] mutagenが無いため再生時間の取得をスキップしました(pip install mutagenで有効化できます)")
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"\n合計 {len(manifest)} 件を {MANIFEST_PATH} に書き出しました。")


if __name__ == "__main__":
    main()
