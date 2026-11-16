#!/usr/bin/env python3
# 立ち姿の体の緑を、基準の絵（走る姿）の色に寄せ、指定した範囲の濃い斑点を薄くする（ハル用。範囲はハルの立ち姿に合わせて指定）
# 使い方: python3 tools/recolor_to_reference.py 補正する.png 基準.png 出力.png 斑点マスク.png
import sys, numpy as np
from PIL import Image
from skimage import color
from scipy import ndimage as ndi
src_f, ref_f, out_f, mask_f = sys.argv[1:5]
src=np.array(Image.open(src_f).convert('RGBA')); ref=np.array(Image.open(ref_f).convert('RGBA'))
def gmask(a):
    hsv=color.rgb2hsv(a[...,:3]/255.0)
    return (a[...,3]==255)&(hsv[...,0]>80/360)&(hsv[...,0]<170/360)&(hsv[...,1]>0.35)
gs, gr = gmask(src), gmask(ref)
lab=color.rgb2lab(src[...,:3]/255.0); labr=color.rgb2lab(ref[...,:3]/255.0)
L=lab[...,0].copy()
# 斑点：体の緑の内側（黄色・羽・背景から離れた所）にある、周りより暗い「かたまり」だけ
w=gs.astype(float); sig=45
Ls=ndi.gaussian_filter(L*w,sig)/np.maximum(ndi.gaussian_filter(w,sig),1e-3)
notgreen=(src[...,3]>=12)&~gs; bg=src[...,3]<12
d_ng=ndi.distance_transform_edt(~notgreen); d_bg=ndi.distance_transform_edt(~bg)
# 斑点がある場所（目で確認して指定）：頭の上・背中・太もも・尻尾。とさか（濃い緑のしま模様はデザイン）は含めない
H_,W_=L.shape; box=np.zeros_like(gs)
for x0,y0,x1,y1 in [(0.17,0.17,0.33,0.28),(0.49,0.66,0.66,0.80),(0.62,0.66,0.92,0.78)]:
    box[int(y0*H_):int(y1*H_), int(x0*W_):int(x1*W_)]=True
cand=gs&box&((Ls-L)>4)&(L>40)&(d_ng>6)&(d_bg>26)
cand=ndi.binary_opening(cand,structure=np.ones((3,3)),iterations=3)
cand=ndi.binary_fill_holes(ndi.binary_closing(cand,iterations=3))&gs       # 細い線（輪郭の影・骨のふち）を消す
lbl,n=ndi.label(cand); sizes=ndi.sum(cand,lbl,range(1,n+1))
# 丸みのある形だけ：面積に対して外接枠が細長すぎないもの
keep=np.zeros(n+1,bool)
for i,s in enumerate(sizes,1):
    if s<250 or s>30000: continue
    sl=ndi.find_objects((lbl==i).astype(int))[0]; h=sl[0].stop-sl[0].start; ww=sl[1].stop-sl[1].start
    if s/(h*ww)>0.35 and max(h,ww)/max(1,min(h,ww))<3.5: keep[i]=True
spot=keep[lbl]
soft=np.clip(ndi.gaussian_filter(ndi.binary_dilation(spot,iterations=3).astype(float),4),0,1)*gs
lab[...,0]=L+soft*0.7*np.clip(Ls-L,0,None)
# 緑の色を走る姿に寄せる（明るさは順位を保って対応づけ、色味は平均を移す）
Lg=lab[...,0][gs]; q=np.linspace(0,100,101); blend=0.75
mapL=np.interp(Lg,np.percentile(Lg,q),np.percentile(labr[...,0][gr],q))
lab[...,0][gs]=Lg*(1-blend)+mapL*blend
da=labr[...,1][gr].mean()-lab[...,1][gs].mean(); db=labr[...,2][gr].mean()-lab[...,2][gs].mean()
lab[...,1][gs]+=da*blend; lab[...,2][gs]+=db*blend
edge=ndi.gaussian_filter(gs.astype(float),1.5)
out=color.lab2rgb(lab); orig=src[...,:3]/255.0
res=orig*(1-edge[...,None])+out*edge[...,None]
o=np.dstack([(np.clip(res,0,1)*255).round().astype(np.uint8),src[...,3]])
Image.fromarray(o,'RGBA').save(out_f); Image.fromarray((spot*255).astype(np.uint8)).save(mask_f)
a2=o.astype(int); m=gs&(a2[...,1]>a2[...,0]+40)&(a2[...,1]>a2[...,2]+40)
print('斑点として補正した範囲',int(spot.sum()),'px／',int(keep.sum()),'か所　補正後の緑平均RGB',a2[...,:3][m].mean(0).round().astype(int).tolist())
