"""
enemy_prompt_generator.htmlの「次の2体」を順番通りに消化していく前提で、
Screenshotsフォルダ(またはdefault指定フォルダ)に保存された生成画像を
更新時刻の古い順に読み、まだ処理していない敵ペアへ順番に割り当てて
上下2枚にクロップ・保存するバッチ処理。

前提: enemies AREAS配列の並び順で「次の2体」を使い続けていること。
      撮り直し画像が混ざる場合は事前に該当ファイルを消しておくか、
      呼び出し側(Claude)に伝えて手動で調整すること。

使い方:
    node _areas_extract.js > areas.json   (AREAS定義を更新した場合は再実行)
    python process_batch.py <入力フォルダ> <出力フォルダ>
"""
import sys
import json
from pathlib import Path
from PIL import Image
import numpy as np

if sys.stdout.encoding is None or sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

PROGRESS_FILE = Path(__file__).parent / "enemy_batch_progress.json"
AREAS_FILE = Path(__file__).parent / "areas.json"
IMG_EXTS = {".png", ".jpg", ".jpeg"}


def load_progress():
    return json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))


def save_progress(data):
    PROGRESS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def flat_enemy_list():
    areas = json.loads(AREAS_FILE.read_text(encoding="utf-8"))
    flat = []
    for a in areas:
        for name, desc in a["enemies"]:
            flat.append({"area": a["area"], "name": name, "desc": desc})
    return flat


def find_split_row(alpha: np.ndarray) -> int:
    h = alpha.shape[0]
    row_sum = alpha.sum(axis=1)
    lo, hi = int(h * 0.35), int(h * 0.75)
    window = row_sum[lo:hi]
    return lo + int(np.argmin(window))


def sanitize(name: str) -> str:
    return "".join(c for c in name if c not in '\\/:*?"<>|')


def process_one(src: Path, pair, out_dir: Path):
    img = Image.open(src).convert("RGBA")
    arr = np.array(img)
    alpha = arr[:, :, 3]
    if alpha.min() == 255:
        print(f"  警告: {src.name} にアルファチャンネルが無い(透明部分が無い)。マゼンタ等で生成した画像の可能性があるためスキップ")
        return False
    split_y = find_split_row(alpha)
    top = img.crop((0, 0, img.width, split_y))
    bottom = img.crop((0, split_y, img.width, img.height))
    name1 = sanitize(pair[0]["name"])
    name2 = sanitize(pair[1]["name"])
    out_dir.mkdir(parents=True, exist_ok=True)
    top.save(out_dir / f"{name1}.png")
    bottom.save(out_dir / f"{name2}.png")
    print(f"  OK: {src.name} -> {name1}.png / {name2}.png (split at y={split_y}/{img.height})")
    return True


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    in_dir = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])

    progress = load_progress()
    flat = flat_enemy_list()
    done_names = set(progress["done"])
    remaining = [e for e in flat if e["name"] not in done_names]

    processed_files = set(progress["processedFiles"])
    candidates = [
        f for f in in_dir.iterdir()
        if f.is_file() and f.suffix.lower() in IMG_EXTS and f.name not in processed_files
    ]
    candidates.sort(key=lambda f: f.stat().st_mtime)

    if not candidates:
        print("新しい画像ファイルが見つかりません")
        return

    print(f"新規ファイル {len(candidates)}件 / 未処理の敵ペア {len(remaining)//2}組")

    idx = 0
    for f in candidates:
        if idx + 1 >= len(remaining):
            print(f"割り当て先の敵ペアが尽きました。{f.name}以降は未処理のまま残ります")
            break
        pair = (remaining[idx], remaining[idx + 1])
        print(f"{f.name} -> {pair[0]['name']} / {pair[1]['name']}")
        ok = process_one(f, pair, out_dir)
        progress["processedFiles"].append(f.name)
        if ok:
            progress["done"].extend([pair[0]["name"], pair[1]["name"]])
            idx += 2
        save_progress(progress)

    total = len(flat)
    print(f"進捗: {len(progress['done'])}/{total} 完了")


if __name__ == "__main__":
    main()
