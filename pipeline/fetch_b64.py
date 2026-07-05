import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image

COMFY_OUTPUT = Path(r"D:\Captures\ComfyUI_windows_portable\ComfyUI\output")


def build_b64_json(results_path, out_path):
    with open(results_path, encoding="utf-8") as f:
        results = json.load(f)
    out = {}
    for key, r in results.items():
        img = Image.open(COMFY_OUTPUT / r["filename"]).convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        out[key] = base64.b64encode(buf.getvalue()).decode("ascii")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f)
    print(f"wrote {out_path}: {len(out)} images")


if __name__ == "__main__":
    build_b64_json(sys.argv[1], sys.argv[2])
