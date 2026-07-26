#!/usr/bin/env python3
"""
温泉村物語 - 髪色一括変換ツール
================================

input/ にある黒髪キャラPNG(背景透過)を、髪だけ別の色に変えて
output/<色名>/ に同じファイル名で出力する。

前提となる技術的な事実(実際の素材ピクセルを調査して確認済み):
  このアートスタイルでは、髪の塗り・髪の輪郭線・目や他パーツの輪郭線が
  すべてほぼ同一の「ほぼ純黒(RGB 0〜数程度)」で描かれている。そのため
  色(RGB/HSV)の値だけを見て「これは髪」「これは目の輪郭線」「これは
  紺色の鎧の陰」を機械的に区別することは出来ない(鎧の暗部も髪と同じくらい
  暗く沈むため、単純な明度しきい値では鎧まで拾ってしまう)。
  → このツールは「どのピクセルが髪か」を空間的なマスク(白黒画像)で
    判定し、マスク内だけを新しい色に置き換える方式を採用している。
  → マスク自動生成は、頭頂部付近から色の近いピクセルだけをたどる
    塗りつぶし(flood fill、色が離れた鎧などには飛び火しない)で
    髪本体の塊を検出したあと、目・眉・口の輪郭線(髪と同じ黒だが
    細い線で繋がっているだけ)を「一度収縮→最大の塊だけ残す→
    膨張で戻す」という形態学的処理で切り離し、最後に髪領域のすぐ
    近傍にある「取りこぼした暗いピクセル」(毛束の重なり部分等、
    周りより明るく塗られているせいで塗りつぶしの許容差を超えて
    しまった箇所)を拾い直す、という3段構えになっている。
    それでも稀に輪郭線の切れ端や取りこぼしが残ることがある。
    その場合は masks/ フォルダに生成されたマスクPNGを画像編集ソフトで
    白黒に手直ししてから再実行すればよい(このマスクは「同じキャラの
    表情差分」全部に使い回されるので、1グループにつき1枚だけ直せば済む)。
  → 髪の輪郭線自体は、マスクの外周を数px分だけ再彩色対象から除外する
    ことで黒のまま保っている(髪の塗りと輪郭線が同じ色である以上、
    マスク全体を均一に塗り替えると輪郭線まで色が変わってしまうため)。

グループ化:
  ファイル名の末尾が _mild / _severe / _panic 等(--variant-suffixesで指定)
  の場合、それを取り除いた名前を「グループキー」とする。
  例: class_samurai.png / class_samurai_mild.png / class_samurai_severe.png /
      class_samurai_panic.png は全て group key "class_samurai" になり、
      同じマスク1枚を共有する(表情差分は髪の位置・形が同一という前提)。

色の追加方法:
  下のHAIR_COLORSに { "色名": (R,G,B) } を1行足すだけでよい
  (RGBは「一番暗い影の部分がどの色に見えるべきか」のアンカー色。
  そこから明るいハイライトに向けて自然に白へ近づくグラデーションを
  自動生成するので、影色だけ決めればよい)。
"""

import argparse
import io
import sys
from pathlib import Path

# Windows(cp932コンソール)でも日本語・絵文字が文字化け/クラッシュしないようにUTF-8へ強制する
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import cv2
import numpy as np
from PIL import Image

# ============ 髪色の定義(ここに追加するだけで新しい色を増やせる) ============
# 値は「一番暗い影の部分の色」。そこから元のハイライトの明るさに応じて
# 自然に白へ近づくグラデーションをコード側で自動生成する
HAIR_COLORS = {
    "brown": (46, 28, 18),    # 和風に合う自然な焦げ茶
    "navy": (16, 22, 48),     # 和風に合う濃い藍色
    "silver": (88, 90, 96),   # 自然な白銀。影の色を白に近づけすぎると全体が平坦なグレー一色に
                              # 見えてしまう(ユーザー指摘: 銀髪だけ質感が無い)ため、他の色と
                              # 同程度の暗さを持たせて陰影の起伏がちゃんと残るようにしている
}

# 表情差分などのバリエーション接尾辞(これを取り除いた名前でグループ化する)
DEFAULT_VARIANT_SUFFIXES = ["_mild", "_severe", "_panic"]

# ============ 自動マスク生成のパラメータ ============
ALPHA_OPAQUE_THRESHOLD = 10  # これを超えるアルファ値のみ処理対象(透過部分は無視)
FLOODFILL_TOLERANCE = 10     # 髪シード色からのRGB各chの許容差(小さいほど鎧等への飛び火を防げる)
DETACH_KERNEL_SIZE = 5       # 目・眉・口の輪郭線(髪と同じ黒だが細い線)を切り離すための収縮/膨張カーネル
DETACH_ITERATIONS = 2        # ↑を何回繰り返すか(大きいほど細い線をよく切り離せるが、細い毛束も削れやすくなる)
MASK_BLUR_KSIZE = 5          # マスクの輪郭を少しだけぼかして境界を自然にする(奇数)
OUTLINE_PRESERVE_PX = 3      # マスクの外周をこの幅だけ再彩色対象から除外し、髪の輪郭線(黒)を保つ
RECOVER_DILATE_PX = 20       # 検出済み髪領域からこの距離以内にある取りこぼしピクセルを拾い直す
RECOVER_VALUE_THRESHOLD = 180  # これ未満のV(明度)なら「肌等ではなく髪の一部」とみなして拾う


def load_rgba(path: Path) -> np.ndarray:
    img = Image.open(path).convert("RGBA")
    return np.array(img)


def save_rgba(arr: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(arr, mode="RGBA").save(path)


def group_key_for(filename: str, suffixes: list[str]) -> str:
    stem = Path(filename).stem
    for suf in suffixes:
        if stem.endswith(suf):
            return stem[: -len(suf)]
    return stem


def _largest_opaque_bbox(opaque: np.ndarray):
    """不透明領域のうち最大の連結成分のbboxを返す(四隅に混じる浮きノイズ画素を無視するため)"""
    num, labels, stats, _ = cv2.connectedComponentsWithStats(opaque.astype(np.uint8), connectivity=8)
    areas = stats[1:, cv2.CC_STAT_AREA]
    main_label = 1 + int(np.argmax(areas))
    return stats[main_label]  # x, y, w, h, area


def auto_generate_mask(rgba: np.ndarray) -> np.ndarray:
    """
    透過キャラPNGから「髪と思われる領域」のソフトマスク(0〜255のグレースケール)を
    ヒューリスティックに生成する。

    手順:
      1. 頭頂部付近(キャラ本体のbbox上端、やや内側)にシードを置き、そこから色が近い
         ピクセルだけをたどる塗りつぶし(floodFill、FIXED_RANGEで濃淡グラデーションを
         伝っての飛び火を防止)を行う。これで「髪と同じ黒でも色が離れた紺色の鎧」等は
         自然に除外できるが、目・眉・口の輪郭線は髪と全く同じ黒なので、顔の輪郭線を
         伝って繋がってしまう。
      2. 収縮(erode)を繰り返して細い輪郭線の「橋」を切り離し、最大の塊(=髪本体、
         目や眉の細い輪郭線よりずっと太い)だけを残してから、同じ回数だけ膨張(dilate)
         して元の太さに戻す。最後に手順1の結果とAND演算し、輪郭線の切れ端が
         過剰に膨らまないようにする。
    """
    alpha = rgba[:, :, 3]
    opaque = alpha > ALPHA_OPAQUE_THRESHOLD
    if not opaque.any():
        return np.zeros(alpha.shape, dtype=np.uint8)

    rgb = rgba[:, :, :3].copy()
    value = rgba[:, :, :3].max(axis=2)
    h, w = rgb.shape[:2]

    x, y, bw, bh, _area = _largest_opaque_bbox(opaque)
    seed_x = x + bw // 2
    seed_y = y + max(3, int(bh * 0.03))  # 髪型によっては前髪が割れて中央が地肌の場合もあるため、後段の失敗検知で救済する

    ff_mask = np.zeros((h + 2, w + 2), np.uint8)
    ff_mask[1:-1, 1:-1][~opaque] = 1  # 透過部分は塗りつぶし対象外にしておく(バリア)
    tol = (FLOODFILL_TOLERANCE,) * 3
    flags = 8 | cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE | (255 << 8)
    cv2.floodFill(rgb.copy(), ff_mask, (seed_x, seed_y), (255, 255, 255), tol, tol, flags)
    filled = (ff_mask[1:-1, 1:-1] == 255).astype(np.uint8) * 255

    # シード位置がたまたまリボン・鉢金・地肌等(髪でない箇所)だった場合のフォールバック:
    # 塗りつぶし結果が小さすぎる/大きすぎるなら、bbox上端付近を縦横にずらして複数シードを
    # 試し、最も「それらしい」被覆率(3〜85%)になったものを採用する
    opaque_area = opaque.sum()
    coverage = filled.sum() / 255 / max(1, opaque_area)
    if coverage < 0.03 or coverage > 0.85:
        for y_ratio in (0.03, 0.08, 0.15, 0.25):
            if 0.03 <= coverage <= 0.85:
                break
            try_y = y + max(3, int(bh * y_ratio))
            for try_x in range(x + int(bw * 0.15), x + int(bw * 0.85), max(1, bw // 12)):
                if not opaque[try_y, try_x]:
                    continue
                m = np.zeros((h + 2, w + 2), np.uint8)
                m[1:-1, 1:-1][~opaque] = 1
                cv2.floodFill(rgb.copy(), m, (try_x, try_y), (255, 255, 255), tol, tol, flags)
                f = (m[1:-1, 1:-1] == 255).astype(np.uint8) * 255
                c = f.sum() / 255 / max(1, opaque_area)
                if 0.03 <= c <= 0.85:
                    filled, coverage = f, c
                    break

    # 目・眉・口の輪郭線(細い)を切り離す: 収縮→最大成分だけ残す→同じ分だけ膨張して戻す
    kernel = np.ones((DETACH_KERNEL_SIZE, DETACH_KERNEL_SIZE), np.uint8)
    eroded = cv2.erode(filled, kernel, iterations=DETACH_ITERATIONS)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(eroded, connectivity=8)
    if num_labels > 1:
        areas = stats[1:, cv2.CC_STAT_AREA]
        best_label = 1 + int(np.argmax(areas))
        isolated = (labels == best_label).astype(np.uint8) * 255
        restored = cv2.dilate(isolated, kernel, iterations=DETACH_ITERATIONS)
        mask = cv2.bitwise_and(restored, filled)
    else:
        mask = filled  # 収縮で消えてしまった場合は諦めて塗りつぶし結果をそのまま使う

    # 【一時的に無効化】髪の一部が周りより明るく塗られている(束のハイライト面等)と、
    # フロー塗りつぶしの許容差を超えてしまい、その部分だけ穴のように取りこぼされる
    # ことがある(狩人・砲術士で発生)。これを「近傍の暗いピクセルを拾い直す」処理で
    # 直そうとしたが、忍者の襟元・槍士の肩鎧など、髪のすぐ近くにある黒い服にまで
    # 色がにじんでしまう副作用が出たため、安全のため無効化した。再度直す時は
    # 「服ではなく髪だけ」を見分ける、より安全な条件を検討すること。
    # near = cv2.dilate(mask, np.ones((RECOVER_DILATE_PX * 2 + 1,) * 2, np.uint8))
    # recoverable = (value < RECOVER_VALUE_THRESHOLD) & opaque
    # mask = np.where((near > 127) & recoverable, 255, mask).astype(np.uint8)

    mask = cv2.GaussianBlur(mask, (MASK_BLUR_KSIZE, MASK_BLUR_KSIZE), 0)
    return mask


def build_lut(target_dark: tuple[int, int, int]) -> np.ndarray:
    """
    輝度0〜255を入力に取り、target_dark(輝度0相当)から白(255,255,255、輝度255相当)へ
    線形に補間したRGBを返す256x3のLUT。
    """
    lut = np.zeros((256, 3), dtype=np.float32)
    dark = np.array(target_dark, dtype=np.float32)
    white = np.array([255.0, 255.0, 255.0])
    t = np.linspace(0, 1, 256).reshape(256, 1)
    lut = dark * (1 - t) + white * t
    return np.clip(lut, 0, 255).astype(np.uint8)


def recolor_with_mask(rgba: np.ndarray, mask: np.ndarray, target_dark: tuple[int, int, int]) -> np.ndarray:
    """
    【重要】このアートスタイルでは髪の輪郭線(黒)と髪の塗り(黒)が全く同じ色のため、
    どちらも同じ濃さで再彩色すると、輪郭線まで新しい色に変わってしまい、他の線画
    (顔・目等)との統一感が崩れて「輪郭線が消えた」ように見える(実際にユーザー指摘あり)。
    輪郭線は常にマスクの一番外側の縁(髪と背景・肌の境界)にあるため、マスクを数px
    収縮させてから再彩色に使うことで、外周だけ元の黒を残し、内側の塗りだけ新しい色に
    変える。これにより他の線画と同じ太さ・濃さの黒い輪郭が保たれる
    """
    rgb = rgba[:, :, :3].astype(np.float32)
    alpha = rgba[:, :, 3]

    value = rgba[:, :, :3].max(axis=2)  # 元の明度(影〜ハイライトの度合い)を保持するため使う
    lut = build_lut(target_dark)
    recolored = lut[value]  # (H,W,3) 明度に応じた新しい色

    outline_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (OUTLINE_PRESERVE_PX * 2 + 1,) * 2)
    recolor_mask = cv2.erode(mask, outline_kernel)

    m = (recolor_mask.astype(np.float32) / 255.0)[:, :, None]  # (H,W,1) 0〜1のブレンド率
    out_rgb = rgb * (1 - m) + recolored.astype(np.float32) * m
    out_rgb = np.clip(out_rgb, 0, 255).astype(np.uint8)

    out = np.dstack([out_rgb, alpha])
    return out


def find_or_make_mask(group_key: str, first_file_rgba: np.ndarray, masks_dir: Path) -> np.ndarray:
    mask_path = masks_dir / f"{group_key}.png"
    if mask_path.exists():
        mask_img = Image.open(mask_path).convert("L")
        return np.array(mask_img)
    mask = auto_generate_mask(first_file_rgba)
    masks_dir.mkdir(parents=True, exist_ok=True)
    Image.fromarray(mask, mode="L").save(mask_path)
    coverage = (mask > 127).sum() / max(1, (first_file_rgba[:, :, 3] > ALPHA_OPAQUE_THRESHOLD).sum())
    print(f"  [自動マスク生成] {mask_path.name} (不透明領域の{coverage*100:.1f}%を髪と判定)")
    if coverage < 0.03 or coverage > 0.6:
        print(f"  ⚠ 髪の割合として不自然な数値です。{mask_path} を画像編集ソフトで確認・手直ししてから再実行してください")
    return mask


def main():
    parser = argparse.ArgumentParser(description="キャラPNGの髪色を一括変換する")
    parser.add_argument("--input", default="input", help="入力フォルダ(既定: input)")
    parser.add_argument("--output", default="output", help="出力フォルダ(既定: output)")
    parser.add_argument("--masks", default="masks", help="マスク保存/読込フォルダ(既定: masks)")
    parser.add_argument("--colors", default=",".join(HAIR_COLORS.keys()),
                         help=f"生成する色をカンマ区切りで指定(既定: 全色 = {','.join(HAIR_COLORS.keys())})")
    parser.add_argument("--variant-suffixes", default=",".join(DEFAULT_VARIANT_SUFFIXES),
                         help="表情差分等のグループ化に使う接尾辞(カンマ区切り)")
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_dir = Path(args.output)
    masks_dir = Path(args.masks)
    suffixes = [s for s in args.variant_suffixes.split(",") if s]
    colors = [c.strip() for c in args.colors.split(",") if c.strip()]

    unknown = [c for c in colors if c not in HAIR_COLORS]
    if unknown:
        print(f"未知の色名です: {unknown} (定義済み: {list(HAIR_COLORS.keys())})", file=sys.stderr)
        sys.exit(1)

    if not input_dir.exists():
        print(f"入力フォルダが見つかりません: {input_dir}", file=sys.stderr)
        sys.exit(1)

    png_files = sorted(input_dir.glob("*.png"))
    if not png_files:
        print(f"{input_dir} にPNGファイルがありません")
        sys.exit(0)

    # ファイル名でグループ化(表情差分をまとめる)
    groups: dict[str, list[Path]] = {}
    for f in png_files:
        key = group_key_for(f.name, suffixes)
        groups.setdefault(key, []).append(f)

    print(f"{len(png_files)}枚のPNGを{len(groups)}グループに分類しました")

    for color in colors:
        (output_dir / color).mkdir(parents=True, exist_ok=True)

    for group_key, files in sorted(groups.items()):
        print(f"\n[{group_key}] ({len(files)}枚: {', '.join(f.name for f in files)})")
        first_rgba = load_rgba(files[0])
        mask = find_or_make_mask(group_key, first_rgba, masks_dir)

        for f in files:
            rgba = load_rgba(f)
            file_mask = mask
            if rgba.shape[:2] != mask.shape[:2]:
                print(f"  ⚠ {f.name} は{group_key}の基準画像とサイズが異なるため、個別にマスクを自動生成します")
                file_mask = auto_generate_mask(rgba)
            for color in colors:
                target = HAIR_COLORS[color]
                out = recolor_with_mask(rgba, file_mask, target)
                save_rgba(out, output_dir / color / f.name)
            print(f"  ✓ {f.name} -> {', '.join(colors)}")

    print("\n完了しました。")


if __name__ == "__main__":
    main()
