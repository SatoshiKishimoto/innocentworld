#!/usr/bin/env python3
"""
キャラクター画像を標準素材の形にそろえるツール

使い方:
  python3 tools/normalize_character_png.py 受け取った画像.png characters3/hal_run.png
  （オプション）--height 1536  --margin 0.08  --bg auto|white|none

行うこと:
  1. 背景を抜く
     - すでに透明な画像はそのまま使う。
     - 白い（または単色の）背景は、画像の外周からつながった部分だけを透明にする
       （目・歯・服の白など、キャラクターの内側の白は残す）。
     - 背景と接する外側の1〜2pxだけを半透明にして、輪郭をなめらかにする。
  2. 絵の範囲で切り出し、絵の高さが「仕上がりの高さ×(1−2×余白)」になるよう拡大・縮小する
     （元が小さい場合は警告を出す。拡大は画質が落ちるため、元の画像を大きく作ってもらうのが原則）。
  3. 上下左右に透明な余白を付け、足もと（いちばん下の点）を下の余白の線にそろえる。
  4. 仕上がりを自動検査（check_character_png.py）にかける。
"""
import argparse, os, sys
import numpy as np
from PIL import Image

sys.dont_write_bytecode = True   # tools/ に __pycache__ を作らない
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check_character_png as chk


def remove_background(rgba, mode='auto', tol=18):
    a = rgba[..., 3].astype(int); rgb = rgba[..., :3].astype(int)
    H, W = a.shape
    if mode == 'none':
        return rgba
    if mode == 'auto' and (a < 250).mean() > 0.05:
        return rgba                          # すでに透明な背景がある
    # 背景色＝四隅の色の中央値
    corners = np.array([rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]])
    bgc = np.median(corners, 0) if mode == 'auto' else np.array([255, 255, 255])
    near = (np.abs(rgb - bgc).max(2) <= tol)
    bg = chk.outside_transparent(near)
    out = rgba.copy()
    out[..., 3] = np.where(bg, 0, 255).astype(np.uint8)
    # 背景に接する縁だけ、背景色との近さに応じて半透明に
    rim = (~bg) & chk.dilate(bg, 1)
    d = np.abs(rgb - bgc).max(2)
    soft = np.clip(d / (tol * 4.0), 0.35, 1.0)
    out[..., 3] = np.where(rim, (soft * 255).astype(np.uint8), out[..., 3])
    return out


def main():
    ap = argparse.ArgumentParser(description='キャラクター画像を標準素材にそろえる')
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--height', type=int, default=1536, help='仕上がりの高さ（px）')
    ap.add_argument('--margin', type=float, default=0.08, help='上下左右の余白（高さに対する割合）')
    ap.add_argument('--bg', default='auto', choices=['auto', 'white', 'none'], help='背景の抜き方')
    ap.add_argument('--alpha-cut', type=int, default=0, help='この値以下の透明度を完全な透明にする（背景に薄い光（グロー）が付いた透過PNG用。例：40）。あわせて透明度240以上は不透明にする')
    a = ap.parse_args()

    im = Image.open(a.src).convert('RGBA'); rgba = np.array(im)
    # ChatGPTの透過PNGは、体の内側がほぼ不透明（透明度252〜253）のことがある。240以上は完全な不透明にそろえる
    al0 = rgba[..., 3]
    if ((al0 >= 240) & (al0 < 255)).sum() > 0.2 * max(1, (al0 >= 240).sum()):
        rgba = rgba.copy(); rgba[..., 3] = np.where(al0 >= 240, 255, al0).astype(np.uint8)
        print('ほぼ不透明（透明度240〜254）の画素を不透明にそろえました')
    if a.alpha_cut:
        al = rgba[..., 3].astype(int)
        al = np.where(al <= a.alpha_cut, 0, np.where(al >= 240, 255, (al - a.alpha_cut) * 255 // (240 - a.alpha_cut)))
        rgba = rgba.copy(); rgba[..., 3] = al.astype(np.uint8)
        print(f'薄い光（透明度{a.alpha_cut}以下）を取り除きました')
    rgba = remove_background(rgba, a.bg)
    vis = rgba[..., 3] >= chk.ALPHA_VISIBLE
    if not vis.any(): sys.exit('絵が見つかりません')
    ys, xs = np.where(vis)
    crop = Image.fromarray(rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA')

    m = int(round(a.height * a.margin))
    target_h = a.height - 2 * m
    scale = target_h / crop.height
    if scale > 1.05:
        print(f'注意：元の絵の高さ {crop.height}px を {scale:.2f} 倍に拡大します。画質が落ちるため、元の画像を大きく作り直してもらうのが望ましい。')
    size = (max(1, round(crop.width * scale)), target_h)
    new = crop.resize(size, Image.LANCZOS)
    # 拡大・縮小で輪郭のぼかしが内側まで広がらないように：
    # 背景から3px以上内側は、元の透明度（最近傍で拡大したもの）を使う。
    # こうすると、目や歯は不透明のまま、元から半透明の部分（妖精の羽など）はそのまま残る
    na = np.array(new); near_a = np.array(crop.resize(size, Image.NEAREST))[..., 3]
    bgm = na[..., 3] < chk.ALPHA_VISIBLE   # 外の背景と閉じた透明部分の両方
    inner = ~chk.dilate(bgm, chk.EDGE_BAND)
    na[..., 3] = np.where(inner, near_a, na[..., 3])
    new = Image.fromarray(na, 'RGBA')
    W = new.width + 2 * m
    canvas = Image.new('RGBA', (W, a.height), (0, 0, 0, 0))
    canvas.paste(new, (m, a.height - m - new.height), new)    # 足もとを下の余白の線に
    os.makedirs(os.path.dirname(os.path.abspath(a.dst)), exist_ok=True)
    canvas.save(a.dst, optimize=True)
    print(f'保存：{a.dst}（{W}×{a.height}px、余白 {m}px）')

    r = chk.check(a.dst, a.height)
    r.pop('_masks', None)
    print(f"自動検査：{r.get('status')}")
    for i in r['issues']: print('   要対応：' + i)
    for n in r['notes']: print('   要目視：' + n)
    print('最後に、元の公式イラストと並べて目視で確認してください。')


if __name__ == '__main__':
    main()
