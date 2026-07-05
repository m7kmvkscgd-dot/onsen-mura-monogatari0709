import json
import time
import urllib.request

from gen_classes_noobai_test import CLASSES, NEGATIVE, POSITIVE_STYLE, build_workflow

BASE = "http://127.0.0.1:8189"
VARIANTS_PER_CLASS = 3


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
    seed = 81000
    for key, (label, desc) in CLASSES.items():
        positive = f"{POSITIVE_STYLE}, {desc}"
        variants = []
        for v in range(VARIANTS_PER_CLASS):
            t0 = time.time()
            r = submit(build_workflow(positive, NEGATIVE, seed, f"dungeon1_class_{key}_v{v}"))
            h = wait(r["prompt_id"])
            elapsed = time.time() - t0
            fname = h[r["prompt_id"]]["outputs"]["13"]["images"][0]["filename"]
            variants.append(fname)
            print(key, v, fname, f"{elapsed:.1f}s")
            seed += 1
        results[key] = {"label": label, "desc": desc, "filenames": variants}

    with open("classes_noobai_variants_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("TOTAL:", len(results))
