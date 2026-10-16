"""
innocent world フィナーレ花火の音楽（オリジナル曲・1回きり・約67秒）
  python3 music/fireworks.py   … music/fireworks.mp3 を作ります
楽器の音は music/compose.py（パレードのテーマ）と同じものを使い、響きをそろえています。
花火の打ち上げは index.html の FW_SHOW で、この曲の小節に合わせてあります（108拍/分・4/4拍子）。
"""
import os, subprocess
import numpy as np
from scipy.signal import fftconvolve, butter, lfilter
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 44100
BPM = 108
S16 = 60/BPM/4
BAR = S16*16
rng = np.random.default_rng(23)
NOTE = {'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11}
def m(name): return 12*(int(name[-1])+1) + NOTE[name[:-1]]
def hz(x): return 440.0*2**((x-69)/12)

CHORD = {'D':[50,54,57],'G':[55,59,62],'Em':[52,55,59],'A':[57,61,64],'A7':[57,61,64,67],'Bm':[59,62,66],
         'B7':[59,63,66,69],'E':[52,56,59],'C#m':[61,64,68],'F#m':[54,57,61],'Asus':[57,62,64]}

# 曲の構成（小節数）：イントロ4 → 主題8 → 盛り上がり4 → 転調した主題8 → フィナーレ4（最後の和音をのばす）
INTRO = ['D','D','G','A']
A_CH  = ['D','G','Em','A','Bm','G','A7','D']
A_MEL = [[('D5',4),('F#5',4),('A5',8)], [('B5',6),('A5',2),('G5',4),('F#5',4)], [('E5',4),('F#5',4),('G5',4),('B5',4)], [('A5',16)],
         [('D6',6),('C#6',2),('B5',4),('A5',4)], [('G5',6),('F#5',2),('E5',4),('D5',4)], [('E5',4),('G5',4),('F#5',4),('E5',4)], [('D5',16)]]
BUILD = ['G','A','Bm','B7']
BUILD_MEL = [[('B4',4),('D5',4),('G5',8)], [('C#5',4),('E5',4),('A5',8)], [('D5',4),('F#5',4),('B5',8)], [('D#5',4),('F#5',4),('A5',4),('B5',4)]]
FIN = ['E','A','B7','E']
FIN_MEL = [[('E6',8),('B5',8)], [('C#6',8),('A5',8)], [('B5',4),('D#6',4),('F#6',4),('A6',4)], [('E6',16)]]

SECTIONS = [('intro', INTRO, None, 0), ('A', A_CH, A_MEL, 0), ('build', BUILD, BUILD_MEL, 0), ('A2', A_CH, A_MEL, 2), ('fin', FIN, FIN_MEL, 0)]
total_bars = sum(len(s[1]) for s in SECTIONS)
LEN = int((total_bars*BAR + 6.0)*SR)
L = np.zeros(LEN); R = np.zeros(LEN); VERB = np.zeros((2, LEN))
def put(sig, t, pan=0.0, rev=0.2):
    i = int(t*SR); n = min(len(sig), LEN-i)
    if n <= 0: return
    gl = np.cos((pan+1)*np.pi/4); gr = np.sin((pan+1)*np.pi/4)
    L[i:i+n] += sig[:n]*gl; R[i:i+n] += sig[:n]*gr
    VERB[0, i:i+n] += sig[:n]*gl*rev; VERB[1, i:i+n] += sig[:n]*gr*rev

# パレードのテーマと同じ楽器を読み込む
src = open(os.path.join(HERE, 'compose.py'), encoding='utf-8').read()
exec(src[src.index('def env('):src.index('# ---------------- 組み立て')], globals())

def chord_tones(ch, tr): return [x+tr for x in CHORD[ch]]
def wide(ch, tr):
    t = chord_tones(ch, tr); mid = sorted(((x-60) % 12)+60 for x in t)
    return [t[0]-12] + mid + [mid[0]+12]
def low(x): return x-24 if x-24 >= 36 else x-12

t0 = 0.0
for name, chords, mels, tr in SECTIONS:
    nb = len(chords)
    for b, ch in enumerate(chords):
        tb = t0 + b*BAR; v = wide(ch, tr); root = chord_tones(ch, tr)[0]; last = b == nb-1
        hit = name == 'fin' and last
        if name == 'intro':
            # 弦のトレモロとティンパニのロールで、だんだん大きく
            strings(v, tb, BAR, 0.06 + 0.035*b, att=0.4)
            choir(v[1:4], tb, BAR, 0.03*b)
            k = 16
            for i in range(k): timpani(low(root), tb + i*S16, (0.05 + 0.1*(b + i/k)/4))
            if b >= 2:
                swell(tb, BAR, 0.08 + 0.04*b)
                for i, x in enumerate(chord_tones(ch, tr)): bell(x+24, tb + i*S16*2, 0.05)
            if last: crash(tb + BAR - 0.01, 0.0)
            continue
        tutti = name in ('A2', 'fin')
        # 和音：弦・合唱・金管
        strings(v, tb, BAR*(0.45 if hit else 1), 0.13 if tutti else 0.11)
        choir(v[1:4], tb, BAR*(0.45 if hit else 1), 0.09 if tutti else 0.06)
        if not hit:
            for k, ln in ((0, 6), (8, 6)): brass([x+12 for x in v[1:4]], tb + k*S16, S16*ln, 0.12 if tutti else 0.09)
        bass(root-12 if root-12 >= 33 else root, tb, BAR/2*0.95, 0.34); bass((root+7)-12 if root-5 >= 33 else root+7, tb+BAR/2, BAR/2*0.95, 0.3)
        # 打楽器：ゆったりした行進のリズム
        timpani(low(root), tb, 0.55 if tutti else 0.45); timpani(low(root)+7, tb + 8*S16, 0.35)
        bigdrum(tb, 0.6 if tutti else 0.5); bigdrum(tb + 8*S16, 0.45)
        for k in (4, 12): snare(tb + k*S16, 0.22 if tutti else 0.16)
        if b % 2 == 0: crash(tb, 0.24 if tutti else 0.16)
        # お祝いの鐘（グロッケン）
        for k in range(0, 16, 4 if tutti else 8): glock(chord_tones(ch, tr)[(k//4) % 3] + 24, tb + k*S16, 0.05)
        if name == 'build':
            for i in range(16): snare(tb + i*S16, 0.04 + 0.06*(b + i/16)/4)
            swell(tb, BAR, 0.08 + 0.03*b)
            if last:
                for i in range(16): timpani(low(root), tb + i*S16, 0.15 + i*0.03)
        if last and name == 'A':
            for i in range(8, 16): snare(tb + i*S16, 0.06 + (i-8)*0.03)
        if hit:   # 最後の「ジャーン！」をのばす
            strings(v + [v[2]+12], tb, BAR*1.6, 0.16, att=0.05)
            choir(v[1:4] + [v[1]+12], tb, BAR*1.6, 0.12)
            brass([x+12 for x in v[1:4]] + [v[1]+24], tb, BAR*1.4, 0.16)
            for i in range(24): timpani(low(root), tb + BAR*0.6 + i*S16*0.5, 0.25 + i*0.012)
            crash(tb, 0.32); crash(tb + BAR*1.25, 0.35); bigdrum(tb, 0.8); bigdrum(tb + BAR*1.25, 0.9); timpani(low(root), tb + BAR*1.25, 0.8)
            for i, x in enumerate([v[1]+24, v[2]+24, v[3]+24, v[1]+36]): glock(x, tb + BAR*1.25 + i*0.06, 0.07)
    # メロディ
    if mels:
        kind = 'brass' if name in ('A2', 'fin') else ('soft' if name == 'build' else 'horn')
        for b, bar in enumerate(mels):
            tt = t0 + b*BAR
            for nm, d in bar:
                lead(m(nm)+tr, d*S16, tt, kind)
                if name in ('A2', 'fin'): lead(m(nm)+tr-12, d*S16, tt, 'horn')
                if name == 'build': lead(m(nm)+tr, d*S16, tt, 'horn')
                tt += d*S16
    t0 += nb*BAR

ir_n = int(3.6*SR); tt = np.arange(ir_n)/SR
ir = [lp(rng.standard_normal(ir_n), 5500)*np.exp(-tt*1.8)*(1 - np.exp(-tt*60)) for _ in range(2)]
L += fftconvolve(VERB[0], ir[0])[:LEN]*0.08; R += fftconvolve(VERB[1], ir[1])[:LEN]*0.08
mix = np.stack([L, R], 1)
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix*1.6)/np.tanh(1.6)
f = int(0.01*SR); mix[:f] *= np.linspace(0, 1, f)[:, None]
fo = int(1.5*SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix *= 0.93
wav = os.path.join(HERE, 'fireworks.wav')
wavfile.write(wav, SR, (mix*32767).astype(np.int16))
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-b:a', '192k', os.path.join(HERE, 'fireworks.mp3')], check=True)
print(f'done: {total_bars} bars, {total_bars*BAR:.2f} s (+ ending), file {len(mix)/SR:.1f} s')
