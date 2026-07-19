"""
背景をマゼンタ(#FF00FF)ベタ塗りで生成した敵イラストを透過PNGに変換する。
単純な二値抜き(背景色に完全一致するピクセルだけ消す)だとフチがギザギザ+
色フリンジが残るため、背景色との距離に応じてアルファ値を滑らかに0〜255へ
遷移させるフェザリング処理を行う。

使い方:
    python chroma_key_transparent.py 入力.png 出力.png
    python chroma_key_transparent.py 入力ディレクトリ 出力ディレクトリ  (一括処理)
"""
import sys
from pathlib import Path
from PIL import Image
import numpy as np

KEY_COLOR = np.array([255, 0, 255])  # マゼンタ
# この距離未満は完全透明、この距離を超えたら完全不透明。間は線形補間でなめらかに
INNER_THRESHOLD = 60
OUTER_THRESHOLD = 140


def chroma_key_feather(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    arr = np.array(rgba).astype(np.float32)
    rgb = arr[:, :, :3]
    dist = np.linalg.norm(rgb - KEY_COLOR, axis=2)
    alpha = np.clip((dist - INNER_THRESHOLD) / (OUTER_THRESHOLD - INNER_THRESHOLD), 0, 1) * 255
    # 元のアルファ(既に透過済みの箇所)より大きくはしない
    arr[:, :, 3] = np.minimum(arr[:, :, 3], alpha)
    # 縁のマゼンタ色にじみ(色フリンジ)を軽減するため、半透明になった縁のピクセルは
    # マゼンタ成分を抜いた色に寄せる(デスピル)
    edge_mask = (arr[:, :, 3] > 0) & (arr[:, :, 3] < 255)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    despill_r = np.minimum(r, (g + b) / 2)
    despill_b = np.minimum(b, (g + r) / 2)
    arr[:, :, 0] = np.where(edge_mask, despill_r, r)
    arr[:, :, 2] = np.where(edge_mask, despill_b, b)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


def process_one(src: Path, dst: Path):
    img = Image.open(src)
    result = chroma_key_feather(img)
    dst.parent.mkdir(parents=True, exist_ok=True)
    result.save(dst)
    print(f"OK: {src.name} -> {dst}")


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    src_path = Path(sys.argv[1])
    dst_path = Path(sys.argv[2])
    if src_path.is_dir():
        for f in sorted(src_path.glob("*.png")):
            process_one(f, dst_path / f.name)
    else:
        process_one(src_path, dst_path)


if __name__ == "__main__":
    main()
