# アリカ v1 用：描き込まれたチェック柄の除去（外周からつながる部分＋目視で確認した閉じた部分）
import sys; sys.dont_write_bytecode=True
from PIL import Image; import numpy as np
from scipy import ndimage
sys.path.insert(0,'tools'); import check_character_png as chk
src,dst=sys.argv[1],sys.argv[2]
a=np.array(Image.open(src).convert('RGBA')); rgb=a[...,:3].astype(int); mx,mn=rgb.max(2),rgb.min(2)
cand=(mx-mn<=10)&(mn>=215); bg=chk.outside_transparent(cand)
lab,n=ndimage.label(cand&~bg)
# 目視でチェック柄と確認した閉じた部分の中心（y, x）：髪のすき間、杖・腕・体のすき間
seeds=[(78,583),(133,421),(251,807),(359,829),(506,198),(729,240),(667,925),(728,323),(792,869),(902,827),(941,99),(980,329),(1011,249),(1046,340)]
cent={}
for i in range(1,n+1):
  ys,xs=np.where(lab==i)
  if len(ys)>=150: cent[i]=(ys.mean(),xs.mean())
ids={min(cent,key=lambda k:(cent[k][0]-y)**2+(cent[k][1]-x)**2) for y,x in seeds}
bg2=bg|np.isin(lab,list(ids))
al=np.where(bg2,0,255).astype(float); rim=(~bg2)&chk.dilate(bg2,1)
soft=np.clip(np.maximum((mx-mn)/40.0,(215-mn)/60.0),0.35,1.0)
a[...,3]=np.where(rim,soft*255,al).astype(np.uint8); Image.fromarray(a).save(dst)
