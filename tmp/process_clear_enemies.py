# 序盤10体の透過立ち絵をテストモード用に加工する(v2 2026-08-01)
# 新美術基準(奉行所パッケージ/00_敵イラスト制作基準.md)に従い、接地影の焼き込みを廃止
# (影はゲーム画面側の共通CSS表現)。アルファトリミング+最大辺320px縮小のみ行う
from PIL import Image
import os

SRC = r"C:\Users\keiic\iCloudDrive\温泉村物語用\敵キャラ\序盤10体_透過"
DST = r"C:\温泉村物語\assets\enemies\clear"
os.makedirs(DST, exist_ok=True)

MAP = {
    "01_野犬.png": "yaken",
    "02_猪.png": "inoshishi",
    "03_毒蛇.png": "dokuhebi",
    "04_大蜘蛛.png": "oogumo",
    "05_木霊.png": "kodama",
    "06_河童.png": "kappa",
    "07_一つ目小僧.png": "hitotsume_kozo",
    "08_化け狸.png": "bake_danuki",
    "09_鬼火.png": "onibi",
    "10_鎌鼬.png": "kamaitachi",
}

for fname, enemy_id in MAP.items():
    im = Image.open(os.path.join(SRC, fname)).convert("RGBA")
    bbox = im.split()[-1].getbbox()
    pad = 6
    l = max(0, bbox[0] - pad); t = max(0, bbox[1] - pad)
    r = min(im.width, bbox[2] + pad); b = min(im.height, bbox[3] + pad)
    im = im.crop((l, t, r, b))
    w, h = im.size
    scale = 320 / max(w, h)
    im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    out = os.path.join(DST, enemy_id + ".png")
    im.save(out, "PNG", optimize=True)
    print(enemy_id, im.size, os.path.getsize(out))
