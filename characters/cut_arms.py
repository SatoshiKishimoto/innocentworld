import json, numpy as np
from PIL import Image
from scipy import ndimage
# 1倍サイズでの座標：rect=切り取る腕の範囲, pivot=肩（回転の中心）, raise=上げる角度（ラジアン）
CFG = {
 'esper':{'rect':[0,62,14,84],'pivot':[13,68],'raise':2.0,'amp':0.45},
 'mimi': {'rect':[0,60,10,80],'pivot':[10,64],'raise':2.0,'amp':0.45},
 'lily': {'rect':[0,64,17,86],'pivot':[16,67],'raise':2.1,'amp':0.45,'ex':'hair'},
 'luke': {'rect':[8,0,29,111],'pivot':[26,70],'raise':0.15,'amp':0.22},
 'niko': {'rect':[0,44,15,68],'pivot':[14,62],'raise':0.3,'amp':0.45},
 'luna': {'rect':[4,34,30,62],'pivot':[27,58],'raise':0.35,'amp':0.4,'ex':'wing'},
 'flora':{'rect':[12,50,30,68],'pivot':[28,54],'raise':1.8,'amp':0.45,'ex':'wing'},
 'mock': {'rect':[0,56,22,90],'pivot':[20,70],'raise':1.4,'amp':0.4},
 'jiiji':{'rect':[0,0,27,112],'pivot':[25,74],'raise':0.12,'amp':0.2},
}
def excluded(rgb, kind):
    r, g, b = [rgb[...,i].astype(int) for i in range(3)]
    if kind == 'wing': return (b > r + 8) & (np.minimum(np.minimum(r, g), b) > 130)
    if kind == 'hair': return (r > 190) & (g > 95) & (g < 205) & (b < 120)
    return np.zeros(r.shape, bool)
out = {}
for k, c in CFG.items():
    im = np.array(Image.open(f'{k}.png').convert('RGBA')); H, W = im.shape[:2]
    x0,y0,x1,y1 = [v*2 for v in c['rect']]; x1 = min(x1, W); y1 = min(y1, H)
    a = im[...,3] > 0
    arm = np.zeros_like(a); arm[y0:y1, x0:x1] = a[y0:y1, x0:x1]
    if c.get('ex'):
        arm &= ~excluded(im[...,:3], c['ex'])
        # 色で分けたあと、肩につながっている部分だけを腕にする
        lab, n = ndimage.label(arm)
        if n > 1:
            px0, py0 = c['pivot'][0]*2, c['pivot'][1]*2
            d = ndimage.distance_transform_edt(lab == 0, return_indices=True)[1]
            keep = lab[d[0][min(py0,H-1), min(px0,W-1)], d[1][min(py0,H-1), min(px0,W-1)]]
            sizes = ndimage.sum(arm, lab, range(1, n+1))
            arm = (lab == keep) | np.isin(lab, [i+1 for i, sz in enumerate(sizes) if sz > 60 and i+1 != keep and False])
    body = a & ~arm
    armimg = im[y0:y1, x0:x1].copy(); armimg[~arm[y0:y1, x0:x1]] = 0
    # 腕を抜いた穴：体の内側にあたる部分は、近くの色でうめる
    closed = ndimage.binary_closing(body, structure=np.ones((3,3)), iterations=6) | body
    hole = closed & ~body
    lum = im[...,:3].astype(int).sum(2)
    src = body & (lum > 210)          # 黒い線ではなく、近くの塗りの色でうめる
    idx = ndimage.distance_transform_edt(~src, return_distances=False, return_indices=True)
    bim = im.copy(); bim[~body] = 0
    fill = im[idx[0], idx[1]]
    bim[hole] = fill[hole]; bim[hole, 3] = 255
    Image.fromarray(bim).save(f'{k}_body.png'); Image.fromarray(armimg).save(f'{k}_arm.png')
    px, py = c['pivot'][0]*2, c['pivot'][1]*2
    out[k] = {'w':W, 'h':H, 'rect':[x0,y0,x1,y1], 'pivot':[px,py], 'raise':c['raise'], 'amp':c['amp']}
json.dump(out, open('/tmp/claude-0/armcut/arms.json','w'))
print(json.dumps(out))
