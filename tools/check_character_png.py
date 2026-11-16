#!/usr/bin/env python3
"""
キャラクター画像（透過PNG）の自動検査ツール

使い方:
  python3 tools/check_character_png.py characters2/*.png
  python3 tools/check_character_png.py characters3/ --out characters3/_check --target 1536

調べること（数値で判断できるものだけ）:
  1. 形式      … PNG か、透明（アルファ）を持っているか
  2. 解像度    … 高さが目標（標準 1536px）に足りているか
  3. 余白      … 上下左右に透明な余白があるか（目安：高さの5%以上、かつ16px以上）
  4. 端への接触 … 絵が画像の端に接していないか（接している＝「欠損の疑い」。欠損とは断定しない）
  5. 内側の半透明 … 背景から離れた内側（目・歯・口・翼の膜など）に半透明の画素がないか
  6. 穴         … 外とつながっていない透明部分（腕と体のすき間など。意図したものか目視で確認）
  7. 足もと     … いちばん下の不透明な行の位置（足もとの基準をそろえるため）

最終判断は必ず公式イラストとの目視比較で行うこと。このツールの結果は「目視で見るべき所」を示すためのもの。

出力:
  --out を付けると、画像ごとの診断画像（余白・端への接触・内側の半透明を色で表示）と
  report.json / report.md を書き出す。
"""
import argparse, json, os, sys, glob
import numpy as np
from PIL import Image, ImageDraw

ALPHA_OPAQUE = 250      # これ以上を「不透明」とみなす
ALPHA_VISIBLE = 12      # これ以上を「絵がある」とみなす
EDGE_BAND = 3           # 背景からこの距離（px）以内は「輪郭」とみなし、半透明でもよい


def dilate(mask, r):
    """正方形の近傍で r 回ふくらませる（scipy なしで動くように）"""
    m = mask.copy()
    for _ in range(r):
        n = m.copy()
        n[1:, :] |= m[:-1, :]; n[:-1, :] |= m[1:, :]; n[:, 1:] |= m[:, :-1]; n[:, :-1] |= m[:, 1:]
        n[1:, 1:] |= m[:-1, :-1]; n[:-1, :-1] |= m[1:, 1:]; n[1:, :-1] |= m[:-1, 1:]; n[:-1, 1:] |= m[1:, :-1]
        m = n
    return m


def outside_transparent(transparent):
    """画像の外周につながっている透明部分（＝背景）を求める（4近傍の塗りつぶし）"""
    H, W = transparent.shape
    bg = np.zeros_like(transparent)
    stack = [(y, x) for x in range(W) for y in (0, H - 1)] + [(y, x) for y in range(H) for x in (0, W - 1)]
    while stack:
        y, x = stack.pop()
        if y < 0 or y >= H or x < 0 or x >= W or bg[y, x] or not transparent[y, x]:
            continue
        bg[y, x] = True
        stack += [(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)]
    return bg


def check(path, target=1536, min_margin_px=16, min_margin_ratio=0.05):
    r = {'file': path, 'issues': [], 'notes': []}
    im = Image.open(path)
    r['format'] = im.format; r['mode'] = im.mode; W, H = im.size; r['width'] = W; r['height'] = H
    has_alpha = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
    r['has_alpha'] = bool(has_alpha)
    if im.format != 'PNG':
        r['issues'].append('PNGではない')
    if not has_alpha:
        r['issues'].append('透明（アルファ）がない')
        return r
    a = np.array(im.convert('RGBA'))[..., 3]
    vis = a >= ALPHA_VISIBLE
    if not vis.any():
        r['issues'].append('絵がない（すべて透明）'); return r

    # 2. 解像度
    r['target_height'] = target
    if H < target:
        r['issues'].append(f'高さ不足：{H}px（目標 {target}px、{H/target:.0%}）')

    # 3. 余白
    ys, xs = np.where(vis)
    m = {'top': int(ys.min()), 'bottom': int(H - 1 - ys.max()), 'left': int(xs.min()), 'right': int(W - 1 - xs.max())}
    r['margin_px'] = m
    need = max(min_margin_px, int(round(H * min_margin_ratio)))
    r['margin_needed_px'] = need
    names = {'top': '上', 'bottom': '下', 'left': '左', 'right': '右'}
    short = [names[k] for k, v in m.items() if v < need]
    if short:
        r['issues'].append('余白不足：' + '・'.join(f"{names[k]} {m[k]}px" for k in m if m[k] < need) + f'（必要 {need}px）')

    # 4. 端への接触（欠損の疑い）
    edges = {'top': vis[0, :], 'bottom': vis[-1, :], 'left': vis[:, 0], 'right': vis[:, -1]}
    touch = {}
    for k, e in edges.items():
        n = int(e.sum())
        if n:
            idx = np.where(e)[0]
            # つながった区間の最長（短い接触は輪郭の詰めすぎ、長い接触は切り落としの疑い）
            runs, start, prev = [], idx[0], idx[0]
            for i in idx[1:]:
                if i != prev + 1: runs.append(prev - start + 1); start = i
                prev = i
            runs.append(prev - start + 1)
            touch[k] = {'pixels': n, 'longest_run': int(max(runs))}
    r['edge_touch'] = touch
    if touch:
        strong = [names[k] for k, v in touch.items() if v['longest_run'] >= 20]
        weak = [names[k] for k, v in touch.items() if v['longest_run'] < 20]
        if strong:
            r['issues'].append('端に長く接している（切り落としの疑い・要目視）：' + '・'.join(f"{names[k]} {touch[k]['longest_run']}px" for k in touch if touch[k]['longest_run'] >= 20))
        if weak:
            r['notes'].append('端に少し接している（切り抜きが詰めすぎの可能性・要目視）：' + '・'.join(weak))

    # 5. 内側の半透明
    transparent = a < ALPHA_VISIBLE
    bg = outside_transparent(transparent)
    # 輪郭＝外の背景だけでなく、閉じた透明部分（髪のすき間など）のふちも含める
    near_bg = dilate(transparent, EDGE_BAND)
    inner = vis & ~near_bg
    semi = inner & (a < ALPHA_OPAQUE)
    r['inner_pixels'] = int(inner.sum()); r['inner_semitransparent'] = int(semi.sum())
    ratio = semi.sum() / max(1, inner.sum())
    r['inner_semitransparent_ratio'] = round(float(ratio), 5)
    if ratio > 0.001:
        r['issues'].append(f'内側に半透明の画素：{int(semi.sum())}px（内側の {ratio:.2%}）')

    # 輪郭のなめらかさ（輪郭帯の中に中間の透明度があるか）
    band = vis & near_bg
    mid = band & (a < ALPHA_OPAQUE)
    r['edge_antialias_ratio'] = round(float(mid.sum() / max(1, band.sum())), 3)
    if r['edge_antialias_ratio'] < 0.05:
        r['notes'].append('輪郭がギザギザの可能性（輪郭に中間の透明度がほとんどない）')

    # 白い縁取り（ステッカー風の外枠）があるか
    rgb = np.array(im.convert('RGBA'))[..., :3].astype(int)
    rim = vis & dilate(bg, 2)
    whiteish = rim & (rgb.min(2) > 225) & ((rgb.max(2) - rgb.min(2)) < 25)
    r['white_rim_ratio'] = round(float(whiteish.sum() / max(1, rim.sum())), 3)
    if r['white_rim_ratio'] > 0.35:
        r['notes'].append(f"白い縁取りあり（輪郭の {r['white_rim_ratio']:.0%}）")

    # 6. 穴（外とつながっていない透明部分）
    holes = transparent & ~bg
    r['hole_pixels'] = int(holes.sum())
    if holes.sum() > 0.002 * vis.sum():
        r['notes'].append(f"閉じた透明部分あり：{int(holes.sum())}px（腕と体のすき間など。意図どおりか要目視）")

    # 7. 足もと
    r['foot_row'] = int(ys.max()); r['foot_margin_px'] = m['bottom']
    r['content_box'] = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
    r['content_height_px'] = int(ys.max() - ys.min() + 1)

    r['_masks'] = (vis, semi, holes)
    r['status'] = '要対応' if r['issues'] else ('要目視' if r['notes'] else '問題なし')
    return r


def diagnostic(path, r, out_png):
    """診断画像：左＝チェック柄の上に元画像、右＝判定の色分け"""
    im = Image.open(path).convert('RGBA'); W, H = im.size
    vis, semi, holes = r['_masks']
    tile = 16
    chk = np.indices((H, W)).sum(0) // tile % 2
    base = np.where(chk[..., None] == 0, 210, 245).astype(np.uint8).repeat(3, 2)
    left = Image.fromarray(base, 'RGB'); left.paste(im, (0, 0), im)
    right = np.full((H, W, 3), 255, np.uint8)
    right[vis] = (200, 205, 215)
    right[holes] = (120, 200, 255)
    right[semi] = (230, 0, 200)
    right = Image.fromarray(right, 'RGB')
    d = ImageDraw.Draw(right)
    x0, y0, x1, y1 = r['content_box']; need = r['margin_needed_px']
    d.rectangle([need, need, W - 1 - need, H - 1 - need], outline=(0, 160, 80), width=2)       # 必要な余白の線
    d.rectangle([x0, y0, x1, y1], outline=(60, 60, 60), width=1)                               # 絵の範囲
    for k, v in r['edge_touch'].items():                                                       # 端への接触
        col = (230, 30, 30) if v['longest_run'] >= 20 else (255, 150, 0)
        if k == 'top': d.line([0, 0, W, 0], fill=col, width=5)
        if k == 'bottom': d.line([0, H - 1, W, H - 1], fill=col, width=5)
        if k == 'left': d.line([0, 0, 0, H], fill=col, width=5)
        if k == 'right': d.line([W - 1, 0, W - 1, H], fill=col, width=5)
    d.line([0, r['foot_row'], W, r['foot_row']], fill=(0, 120, 255), width=1)                   # 足もと
    out = Image.new('RGB', (W * 2 + 8, H), 'white'); out.paste(left, (0, 0)); out.paste(right, (W + 8, 0))
    out.save(out_png)


def main():
    ap = argparse.ArgumentParser(description='キャラクター透過PNGの自動検査')
    ap.add_argument('paths', nargs='+', help='PNGファイルまたはフォルダ')
    ap.add_argument('--target', type=int, default=1536, help='目標の高さ（px）')
    ap.add_argument('--margin-px', type=int, default=16, help='余白の最小（px）')
    ap.add_argument('--margin-ratio', type=float, default=0.05, help='余白の最小（高さに対する割合）')
    ap.add_argument('--out', help='診断画像とレポートを書き出すフォルダ')
    ap.add_argument('--strict', action='store_true', help='「要対応」が1件でもあれば終了コード1')
    a = ap.parse_args()
    files = []
    for p in a.paths:
        files += sorted(glob.glob(os.path.join(p, '*.png'))) if os.path.isdir(p) else [p]
    if a.out: os.makedirs(a.out, exist_ok=True)
    results = []
    for f in files:
        r = check(f, a.target, a.margin_px, a.margin_ratio)
        if a.out and '_masks' in r:
            diagnostic(f, r, os.path.join(a.out, os.path.splitext(os.path.basename(f))[0] + '_check.png'))
        r.pop('_masks', None); results.append(r)
        print(f"[{r.get('status', '要対応')}] {f}  {r.get('width')}x{r.get('height')}")
        for i in r['issues']: print('   要対応：' + i)
        for n in r['notes']: print('   要目視：' + n)
    if a.out:
        json.dump(results, open(os.path.join(a.out, 'report.json'), 'w'), ensure_ascii=False, indent=1)
        with open(os.path.join(a.out, 'report.md'), 'w') as fo:
            fo.write('# キャラクター画像 自動検査レポート\n\n')
            fo.write(f'目標の高さ {a.target}px／必要な余白：高さの{a.margin_ratio:.0%}以上かつ{a.margin_px}px以上。\n')
            fo.write('「端に接している」は欠損の**疑い**。最終判断は公式イラストとの目視比較で行う。\n\n')
            fo.write('| 画像 | 判定 | 大きさ | 余白（上/下/左/右） | 端への接触（最長） | 内側の半透明 | メモ |\n|---|---|---|---|---|---|---|\n')
            for r in results:
                m = r.get('margin_px', {})
                t = '、'.join(f"{ {'top':'上','bottom':'下','left':'左','right':'右'}[k]}{v['longest_run']}px" for k, v in r.get('edge_touch', {}).items()) or 'なし'
                fo.write(f"| {os.path.basename(r['file'])} | {r.get('status','要対応')} | {r.get('width')}×{r.get('height')} | "
                         f"{m.get('top','-')}/{m.get('bottom','-')}/{m.get('left','-')}/{m.get('right','-')} | {t} | "
                         f"{r.get('inner_semitransparent',0)}px | {'<br>'.join(r['issues'] + r['notes'])} |\n")
    if a.strict and any(r['issues'] for r in results): sys.exit(1)


if __name__ == '__main__':
    main()
