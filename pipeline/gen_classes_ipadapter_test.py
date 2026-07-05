import json
import time
import urllib.request

from gen_classes_noobai_test import CLASSES, NEGATIVE, POSITIVE_STYLE

BASE = "http://127.0.0.1:8189"
REF_IMAGE = "samurai_style_ref.png"  # ComfyUI/input/ に配置済み(侍のNoobAI生成結果)

# 侍の画風をIPAdapterで他キャラに転写するテスト。style transferモードで構図/ポーズは縛らず画風だけ寄せる
TEST_CLASSES = ["ninja", "thief", "fighter"]


def build_workflow(positive_text, negative_text, seed, filename_prefix, weight):
    return {
        "prompt": {
            "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "noobaiXLNAIXL_epsilonPred11Version.safetensors"}},
            "20": {"class_type": "LoadImage", "inputs": {"image": REF_IMAGE}},
            "21": {"class_type": "CLIPVisionLoader", "inputs": {"clip_name": "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors"}},
            "22": {"class_type": "IPAdapterModelLoader", "inputs": {"ipadapter_file": "ip-adapter-plus_sdxl_vit-h.safetensors"}},
            "23": {"class_type": "IPAdapterAdvanced", "inputs": {
                "model": ["1", 0], "ipadapter": ["22", 0], "image": ["20", 0], "clip_vision": ["21", 0],
                "weight": weight, "weight_type": "style transfer", "combine_embeds": "concat",
                "start_at": 0.0, "end_at": 1.0, "embeds_scaling": "V only",
            }},
            "4": {"class_type": "CLIPTextEncode", "inputs": {"text": positive_text, "clip": ["1", 1]}},
            "5": {"class_type": "CLIPTextEncode", "inputs": {"text": negative_text, "clip": ["1", 1]}},
            "6": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
            "7": {"class_type": "KSampler", "inputs": {
                "model": ["23", 0], "positive": ["4", 0], "negative": ["5", 0], "latent_image": ["6", 0],
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
    seed = 95000
    weights = [0.5, 0.7]
    for key in TEST_CLASSES:
        label, desc = CLASSES[key]
        positive = f"{POSITIVE_STYLE}, {desc}"
        for w in weights:
            t0 = time.time()
            r = submit(build_workflow(positive, NEGATIVE, seed, f"dungeon1_ipa_{key}_w{w}", w))
            h = wait(r["prompt_id"])
            elapsed = time.time() - t0
            fname = h[r["prompt_id"]]["outputs"]["13"]["images"][0]["filename"]
            results[f"{key}_w{w}"] = {"label": f"{label} (weight={w})", "filename": fname}
            print(key, w, fname, f"{elapsed:.1f}s")
            seed += 1

    with open("classes_ipadapter_test_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("TOTAL:", len(results))
