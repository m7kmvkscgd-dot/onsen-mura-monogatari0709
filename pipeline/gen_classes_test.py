import json
import time
import urllib.request

BASE = "http://127.0.0.1:8189"

# ダンジョン1: 8職業の美少女デフォルメ(ちびキャラ)イラスト、テスト生成
# 新デザパイプ①のbattle_charテストと同じくFLUX.2-klein-4b(LoRAなし)で試す。右30度ほど向いた構図を指定
STYLE = ("chibi anime girl illustration, super-deformed proportions with a large head and small body, "
         "clean bold vector linework, flat cel-shaded coloring, big sparkling expressive eyes, "
         "standing pose turned slightly to her right in a three-quarter view (about a 30-degree turn, "
         "not fully facing forward, not a side profile), full body, centered, solid plain dark "
         "background, no text, no logo, no watermark")

# key: (label, description)
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


def build_workflow(prompt_text, seed, filename_prefix):
    return {
        "prompt": {
            "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "flux-2-klein-4b.safetensors", "weight_dtype": "default"}},
            "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_3_4b.safetensors", "type": "flux2", "device": "default"}},
            "3": {"class_type": "VAELoader", "inputs": {"vae_name": "flux2-vae.safetensors"}},
            "4": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt_text, "clip": ["2", 0]}},
            "14": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["4", 0]}},
            "6": {"class_type": "EmptyFlux2LatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
            "7": {"class_type": "RandomNoise", "inputs": {"noise_seed": seed}},
            "8": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler"}},
            "9": {"class_type": "Flux2Scheduler", "inputs": {"steps": 4, "width": 1024, "height": 1024}},
            "10": {"class_type": "CFGGuider", "inputs": {"model": ["1", 0], "positive": ["4", 0], "negative": ["14", 0], "cfg": 1}},
            "11": {"class_type": "SamplerCustomAdvanced", "inputs": {"noise": ["7", 0], "guider": ["10", 0], "sampler": ["8", 0], "sigmas": ["9", 0], "latent_image": ["6", 0]}},
            "12": {"class_type": "VAEDecode", "inputs": {"samples": ["11", 0], "vae": ["3", 0]}},
            "13": {"class_type": "SaveImage", "inputs": {"images": ["12", 0], "filename_prefix": filename_prefix}},
        }
    }


def submit(prompt_text, seed, filename_prefix):
    wf = build_workflow(prompt_text, seed, filename_prefix)
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
    seed = 51000
    for key, (label, desc) in CLASSES.items():
        text = f"{STYLE} Character: {desc}"
        t0 = time.time()
        r = submit(text, seed, f"dungeon1_class_{key}_test")
        h = wait(r["prompt_id"])
        elapsed = time.time() - t0
        fname = h[r["prompt_id"]]["outputs"]["13"]["images"][0]["filename"]
        results[key] = {"label": label, "desc": desc, "filename": fname}
        print(key, fname, f"{elapsed:.1f}s")
        seed += 1

    with open("classes_test_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("TOTAL:", len(results))
