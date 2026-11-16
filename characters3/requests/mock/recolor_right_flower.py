import numpy as np, sys
from PIL import Image, ImageDraw, ImageFont
from skimage import color
from scipy import ndimage as ndi
T=sys.argv[1]
im=Image.open('characters3/requests/mock/mock_walk_v1.png').convert('RGBA'); a=np.array(im)
hsv=color.rgb2hsv(a[...,:3]/255.)
x0,y0,x1,y1=880,800,1070,1050
box=np.zeros(a.shape[:2],bool); box[y0:y1,x0:x1]=True
# 花の中心（茶色）を見つけ、そこからの距離で花びらだけに限る（黄緑の葉は含めない）
brown=box&(a[...,3]>200)&(hsv[...,0]>15/360)&(hsv[...,0]<45/360)&(hsv[...,2]<0.45)&(hsv[...,1]>0.4)
lb,n=ndi.label(brown); big=np.argmax(ndi.sum(brown,lb,range(1,n+1)))+1; cy,cx=ndi.center_of_mass(lb==big)
Y,X=np.indices(a.shape[:2]); r=np.hypot(Y-cy,X-cx)
H0=hsv[...,0]*360; S0=hsv[...,1]; V0=hsv[...,2]
petal=(H0>30)&(H0<62)&(S0>0.5)&(V0>0.45)
hi=(H0>35)&(H0<65)&(V0>0.9)&(S0>0.15)                       # 花びらのつやの明るい部分
wood=(H0<46)&(S0<0.8)&~hi                                     # 腕の木肌（花びらの影より彩度が低い）
leaf=(H0>57)&(S0>0.45)                                       # 黄緑の葉
pet=box&(a[...,3]>0)&(r<88)&(petal|hi)&~wood&~leaf
seed=pet&(r<70); lb2,_=ndi.label(pet); ids=np.unique(lb2[seed]); ids=ids[ids>0]; pet=np.isin(lb2,ids)
pet=ndi.binary_fill_holes(ndi.binary_closing(pet,iterations=2))&~brown&~leaf&~wood&(r<88)
armzone=(Y>cy+72)|((X<cx-30)&(Y>cy+48))|((X<cx+5)&(Y>cy+44))                                   # 花の左下は腕（花びらはない）
pet=pet&~armzone
w=np.clip(ndi.gaussian_filter(pet.astype(float),0.8)*1.4,0,1)*~wood*~leaf*(r<90)*~armzone
h=hsv.copy()
h[...,0]=np.clip((31+(hsv[...,0]*360-49.6)*0.5)/360,0,1); h[...,1]=np.clip(hsv[...,1]*0.86,0,1); h[...,2]=hsv[...,2]*0.93
new=color.hsv2rgb(h); res=a[...,:3]/255.*(1-w[...,None])+new*w[...,None]
out=a.copy(); out[...,:3]=(np.clip(res,0,1)*255).round().astype(np.uint8)
Image.fromarray(out,'RGBA').save(f'{T}/mock_walk_v2.png')
print('中心',int(cx),int(cy),'補正した画素',int(pet.sum()),'補正後の花びら平均HSV',(color.rgb2hsv(out[...,:3]/255.)[pet].mean(0)*[360,1,1]).round(2).tolist())
fb=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',26)
def crop(arr,bx): X0,Y0,X1,Y1=bx; c=Image.fromarray(arr[Y0:Y1,X0:X1]); return c.resize((c.width*2,c.height*2),Image.LANCZOS)
bxR=(840,740,1110,1110); bxL=(60,780,330,1150)
p=[(crop(a,bxR),'補正前（右手）'),(crop(out,bxR),'補正後（右手）'),(crop(a,bxL),'参考：左手のオレンジ')]
bg=(236,232,224); Hh=max(i.height for i,_ in p)
S=Image.new('RGB',(sum(i.width for i,_ in p)+160,Hh+70),bg); d=ImageDraw.Draw(S); x=40
for i,l in p: S.paste(i,(x,60),i); d.text((x,14),l,fill='black',font=fb); x+=i.width+40
S.save(f'{T}/flower_compare.png')
