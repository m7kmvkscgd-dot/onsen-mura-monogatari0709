import json
import time
import urllib.request

BASE = "http://127.0.0.1:8189"

# ダンジョン1: 8職業のキャラをNoobAI-XL(アニメ特化SDXL)で再生成するテスト
# (新デザパイプ①側のstyle_compare_testでNoobAI-XLの方が明確に高品質と判断されたため乗り換え)
# v2/v3で「侍の画風に寄せる」ためのスタイルタグ追加を試したが、どちらも他キャラの服装/anatomyが
# 崩れる結果になったため撤回。侍の良さは狙って出したものではなく良いガチャだった可能性が高く、
# 元のシンプルなプロンプト(v1)に戻して安定性を優先する
POSITIVE_STYLE = ("masterpiece, best quality, amazing quality, very aesthetic, absurdres, 1girl, solo, "
                   "chibi, super deformed, large head, small body, standing, turned slightly to the "
                   "right, three-quarter view, facing to the right side, full body, centered, plain "
                   "dark background")
NEGATIVE = ("worst quality, low quality, jpeg artifacts, blurry, ugly, deformed, bad anatomy, extra "
            "fingers, extra limbs, missing fingers, watermark, signature, text, realistic, photo, 3d, "
            "facing forward, front view")

# key: (label, description) — gen_classes_test.pyと同じ設定を流用
CLASSES = {
    "fighter": ("戦士",
        "a sturdy fighter girl in polished plate armor over a simple tunic, wielding a short sword and "
        "round shield, short brown hair, a brave confident expression"),
    "mage": ("魔法使い",
        "a mage girl in a flowing blue robe with a tall pointed wizard hat, holding a wooden staff "
        "topped with a glowing crystal, long violet hair, a curious mystical expression"),
    "priest": ("僧侶",
        "a priest girl in white-and-gold holy robes with a simple veil, holding a small mace with a "
        "holy symbol, soft platinum-blonde hair, a gentle kind expression"),
    "thief": ("盗賊",
        "a thief girl in a dark hooded cloak and leather outfit, twin daggers at her belt, short messy "
        "auburn hair peeking from the hood, a sly playful smirk"),
    "samurai": ("侍",
        "a samurai girl in traditional lamellar armor over a red-and-white kimono, a katana sheathed at "
        "her hip, long black hair tied back, a calm disciplined expression"),
    "ninja": ("忍者",
        "a ninja girl in a fitted dark grey-and-purple outfit with a face scarf pulled down, kunai "
        "strapped to her thigh, short black hair, a sharp stealthy gaze"),
    "sage": ("賢者",
        "a sage girl in an ornate robe blending arcane purple and holy white, holding a tall staff "
        "topped with both a crystal and a small holy emblem, silver hair, a wise serene expression"),
    "paladin": ("パラディン",
        "a paladin girl in gleaming golden-white holy armor with a small holy-water flask at her belt, "
        "a sword and a kite shield marked with a holy emblem, long golden hair, a righteous determined "
        "expression"),
}


def build_workflow(positive_text, negative_text, seed, filename_prefix):
    return {
        "prompt": {
            "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "noobaiXLNAIXL_epsilonPred11Version.safetensors"}},
            "4": {"class_type": "CLIPTextEncode", "inputs": {"text": positive_text, "clip": ["1", 1]}},
            "5": {"class_type": "CLIPTextEncode", "inputs": {"text": negative_text, "clip": ["1", 1]}},
            "6": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
            "7": {"class_type": "KSampler", "inputs": {
                "model": ["1", 0], "positive": ["4", 0], "negative": ["5", 0], "latent_image": ["6", 0],
                "seed": seed, "steps": 28, "cfg": 6.0, "sampler_name": "euler_ancestral", "scheduler": "karras", "denoise": 1.0,
            }},
            "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["1", 2]}},
            "13": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": filename_prefix}},
        }
    }


def submit(wf):
    data = json.dumps(wf).encode("utf-8")
    req = urllib.request.Request(f"{BASE}/prompt", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read())


def wait(pid):
    while True:
        with urllib.request.urlopen(f"{BASE}/history/{pid}", timeout=10) as resp:
            h = json.loads(resp.read())
        if h:
            return h
        time.sleep(1)


if __name__ == "__main__":
    results = {}
    seed = 71000
    for key, (label, desc) in CLASSES.items():
        positive = f"{POSITIVE_STYLE}, {desc}"
        t0 = time.time()
        r = submit(build_workflow(positive, NEGATIVE, seed, f"dungeon1_class_{key}_noobai"))
        h = wait(r["prompt_id"])
        elapsed = time.time() - t0
        fname = h[r["prompt_id"]]["outputs"]["13"]["images"][0]["filename"]
        results[key] = {"label": label, "desc": desc, "filename": fname}
        print(key, fname, f"{elapsed:.1f}s")
        seed += 1

    with open("classes_noobai_test_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("TOTAL:", len(results))
