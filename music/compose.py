"""
innocent world パレードのテーマ（オリジナル曲）
作曲・音源生成スクリプト。実行すると music/parade.wav と parade.mp3 を作ります。
  python3 music/compose.py        … ループ用（parade.mp3）と、1曲版（parade_full.mp3）の両方を作ります
"""
import sys
import numpy as np
from scipy.signal import butter, lfilter, fftconvolve
import subprocess, os

SR = 44100
BPM = 120
S16 = 60 / BPM / 4          # 16分音符の長さ（秒）
BAR = S16 * 16
rng = np.random.default_rng(7)

NOTE = {'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11}
def m(name):
    p, o = name[:-1], int(name[-1])
    return 12*(o+1) + NOTE[p]
def hz(midi): return 440.0 * 2**((midi-69)/12)

CHORD = {'C':[60,64,67],'Am':[57,60,64],'F':[53,57,60],'G':[55,59,62],'G7':[55,59,62,65],
         'Em':[52,55,59],'Dm':[50,53,57],'C/E':[52,55,60],'D':[50,54,57],'Bb':[58,62,65]}

# ---------------- 曲（メロディは (音名, 16分音符いくつ) で書く。'r' は休符） ----------------
A = [  # Aメロ 16小節
 [('E4',4),('G4',2),('C5',2),('E5',4),('D5',4)],
 [('C5',6),('B4',2),('A4',8)],
 [('A4',2),('C5',2),('F5',4),('E5',2),('D5',2),('C5',4)],
 [('D5',12),('r',4)],
 [('E5',4),('D5',2),('C5',2),('G4',4),('C5',4)],
 [('E5',4),('A5',4),('G5',4),('E5',4)],
 [('F5',4),('E5',2),('D5',2),('C5',4),('A4',4)],
 [('B4',8),('D5',8)],
 [('E4',4),('G4',2),('C5',2),('E5',4),('D5',4)],
 [('C5',6),('B4',2),('A4',8)],
 [('A4',2),('C5',2),('F5',4),('E5',2),('D5',2),('C5',4)],
 [('D5',12),('r',4)],
 [('A5',4),('G5',2),('F5',2),('E5',4),('D5',4)],
 [('G5',4),('F5',4),('E5',4),('D5',4)],
 [('C5',12),('r',4)],
 [('G4',2),('A4',2),('B4',2),('D5',2),('F5',4),('G5',4)],
]
A_CH = ['C','Am','F','G','C','Am','F','G','C','Am','F','G','F','G','C','G7']

B = [  # Bメロ 8小節
 [('C5',4),('A4',4),('C5',4),('F5',4)],
 [('D5',12),('B4',4)],
 [('E5',4),('G5',4),('E5',4),('B4',4)],
 [('C5',12),('r',4)],
 [('D5',4),('F5',4),('A5',4),('F5',4)],
 [('G5',4),('F5',4),('E5',4),('D5',4)],
 [('E5',4),('G5',4),('C6',8)],
 [('B5',4),('A5',4),('G5',4),('F5',4)],
]
B_CH = ['F','G','Em','Am','Dm','G','C','G7']

CH = [  # サビ 16小節
 [('G5',6),('E5',2),('C5',4),('E5',4)],
 [('D5',6),('B4',2),('G4',8)],
 [('C5',2),('D5',2),('E5',4),('A5',4),('G5',4)],
 [('F5',12),('r',4)],
 [('G5',6),('E5',2),('C6',4),('G5',4)],
 [('B5',4),('A5',4),('G5',4),('D5',4)],
 [('A5',4),('G5',4),('F5',4),('E5',4)],
 [('D5',12),('r',4)],
 [('G5',6),('E5',2),('C5',4),('E5',4)],
 [('D5',6),('B4',2),('G4',8)],
 [('C5',2),('D5',2),('E5',4),('A5',4),('G5',4)],
 [('F5',12),('r',4)],
 [('F5',4),('E5',4),('D5',4),('A5',4)],
 [('G5',4),('F5',4),('D5',4),('B4',4)],
 [('C5',8),('E5',4),('G5',4)],
 [('C6',16)],
]
CH_CH = ['C','G','Am','F','C','G','F','G','C','G','Am','F','Dm','G','C','C']

BR = [  # 間奏 8小節
 [('A4',8),('E5',8)], [('F5',8),('C5',8)], [('E5',8),('G5',8)], [('D5',16)],
 [('A4',8),('C5',8)], [('F5',8),('A5',8)], [('G5',16)], [('G5',8),('B5',8)],
]
BR_CH = ['Am','F','C','G','Am','F','G','G7']

INTRO_CH = ['C','Am','F','G','C','Am','F','G']
OUTRO_CH = ['C','F','G','C']

# セクション：(名前, コード, メロディ, 移調, 編成)
SECTIONS = [
 ('intro',  INTRO_CH, None, 0, dict(arp=1, pad=1, bass='half', drums='intro', riser=True)),
 ('A',      A_CH,     A,    0, dict(arp=1, pad=1, bass='march', drums='march', lead='square')),
 ('B',      B_CH,     B,    0, dict(arp=1, pad=1, bass='march', drums='build', lead='square', roll=True)),
 ('chorus', CH_CH,    CH,   0, dict(arp=1, pad=1, bass='drive', drums='full', lead='brass', glock=1, clap=1)),
 ('bridge', BR_CH,    BR,   0, dict(arp=0, pad=1, bass='half', drums='light', lead='soft', glock=2, roll=True, riser=True)),
 ('chorus2',CH_CH,    CH,   2, dict(arp=1, pad=1, bass='drive', drums='full', lead='brass', glock=1, clap=1)),
 ('outro',  OUTRO_CH, [[('E5',4),('G5',4),('C6',8)],[('A5',8),('F5',8)],[('G5',4),('B5',4),('D6',8)],[('C6',16)]], 2,
             dict(arp=1, pad=1, bass='half', drums='end', lead='brass', glock=1)),
]

MODE = sys.argv[1] if len(sys.argv) > 1 else 'loop'
if MODE == 'loop':
    # ループ用：最後はニ長調から B♭→C→G7 を通って、自然にイントロ（ハ長調）へ戻る
    SECTIONS[-1] = ('turn', ['D','Bb','C','G7'],
        [[('F#5',4),('A5',4),('D6',8)],[('D6',8),('F5',8)],[('E5',4),('G5',4),('C6',8)],[('B5',4),('A5',4),('G5',4),('F5',4)]], 0,
        dict(arp=1, pad=1, bass='march', drums='full', lead='brass', glock=1, roll=True))
total_bars = sum(len(s[1]) for s in SECTIONS)
LEN = int((total_bars*BAR + 4.0) * SR)
L = np.zeros(LEN); R = np.zeros(LEN); VERB = np.zeros((2, LEN))

def put(sig, t, pan=0.0, rev=0.2):
    i = int(t*SR); n = min(len(sig), LEN-i)
    if n <= 0: return
    gl = np.cos((pan+1)*np.pi/4); gr = np.sin((pan+1)*np.pi/4)
    L[i:i+n] += sig[:n]*gl; R[i:i+n] += sig[:n]*gr
    VERB[0, i:i+n] += sig[:n]*gl*rev; VERB[1, i:i+n] += sig[:n]*gr*rev

def env(n, a, d, s, r, hold):
    t = np.arange(n)/SR; h = max(hold, a+d)
    e = np.interp(t, [0, a, a+d, h], [0, 1, s, s])
    rel = t > h; e[rel] = s*np.exp(-(t[rel]-h)/(r/3))
    return e

def saw(f, n, detune=0.0, phase=0.0):
    t = np.arange(n)/SR; f = f*2**(detune/1200); out = np.zeros(n)
    K = int(min(28, 14000//f))
    for k in range(1, K+1): out += np.sin(2*np.pi*k*f*t + phase*k)/k
    return out*0.6
def pulse(f, n, width=0.25):
    t = np.arange(n)/SR; out = np.zeros(n)
    K = int(min(24, 12000//f))
    for k in range(1, K+1): out += np.sin(np.pi*k*width)/k*np.cos(2*np.pi*k*f*t)
    return out*0.9
def lp(x, fc, order=2):
    b, a = butter(order, min(fc, SR*0.45)/(SR/2), 'low'); return lfilter(b, a, x)
def hp(x, fc, order=2):
    b, a = butter(order, fc/(SR/2), 'high'); return lfilter(b, a, x)
def bp(x, lo, hi):
    b, a = butter(2, [lo/(SR/2), hi/(SR/2)], 'band'); return lfilter(b, a, x)

# ---------------- 楽器 ----------------
def sawv(f, n, detune=0.0, ph=0.0, vib=0.0035, kmax=14000):
    """ビブラート付きのノコギリ波（倍音を必要な分だけ足す）"""
    t = np.arange(n)/SR; f = f*2**(detune/1200)
    p = 2*np.pi*f*t - (f*vib/5.2)*np.cos(2*np.pi*5.2*t + ph)
    out = np.zeros(n); K = int(max(1, min(28, kmax//f)))
    for k in range(1, K+1): out += np.sin(k*p + ph*k)/k
    return out*0.6

def strings(notes, t, dur, vol, att=0.25):
    n = int((dur+0.9)*SR); e = env(n, att, 0.3, 0.9, 0.8, dur)
    for i, mm in enumerate(notes):
        f = hz(mm); sig = sum(sawv(f, n, d, rng.random()*6, kmax=3200) for d in (-11, 0, 12))
        sig = hp(lp(sig, 3600), 110)
        put(sig*e*vol/len(notes)**0.5, t + i*0.004, (-0.6, 0.6, -0.25, 0.25, 0)[i % 5], 0.55)

def choir(notes, t, dur, vol):
    n = int((dur+0.9)*SR); e = env(n, 0.4, 0.3, 0.9, 0.9, dur)
    for i, mm in enumerate(notes):
        f = hz(mm); src = sum(sawv(f, n, d, rng.random()*6, vib=0.006, kmax=4200) for d in (-14, -4, 9))
        sig = bp(src, 600, 900)*1.0 + bp(src, 1050, 1350)*0.6 + lp(src, 400)*0.5   # 「アー」の響き
        put(sig*e*vol/len(notes)**0.5, t, (-0.4, 0.4, 0)[i % 3], 0.6)

def brass(notes, t, dur, vol):
    n = int((dur+0.35)*SR); tt = np.arange(n)/SR; e = env(n, 0.02, 0.12, 0.75, 0.25, dur)
    k = np.exp(-tt*7)
    for i, mm in enumerate(notes):
        f = hz(mm); src = sawv(f, n, -7, kmax=6000) + sawv(f, n, 7, kmax=6000)
        sig = lp(src, 4200)*k + lp(src, 1500)*(1-k)
        put(sig*e*vol/len(notes)**0.5, t, (-0.3, 0.3, 0, -0.15, 0.15)[i % 5], 0.35)

def timpani(midi, t, vol=0.5):
    f = hz(midi); n = int(1.6*SR); tt = np.arange(n)/SR
    sig = (np.sin(2*np.pi*f*tt)*np.exp(-tt*2.2) + 0.5*np.sin(2*np.pi*1.5*f*tt)*np.exp(-tt*3.5)
           + 0.25*np.sin(2*np.pi*1.99*f*tt)*np.exp(-tt*5) + lp(rng.standard_normal(n), 350)*np.exp(-tt*25)*1.5)
    put(sig*vol, t, -0.1, 0.45)

def bigdrum(t, vol=0.55):
    n = int(0.8*SR); tt = np.arange(n)/SR
    fr = 42 + 40*np.exp(-tt*18); ph = 2*np.pi*np.cumsum(fr)/SR
    put((np.sin(ph)*np.exp(-tt*4.5) + lp(rng.standard_normal(n), 250)*np.exp(-tt*30)*0.8)*vol, t, 0, 0.25)

def lead(midi, dur, t, kind):
    f = hz(midi); n = int((dur+0.3)*SR); tt = np.arange(n)/SR
    if kind == 'horn':      # Aメロ：やわらかい金管
        sig = sawv(f, n, -6, kmax=5000) + sawv(f, n, 6, kmax=5000)
        k = np.exp(-tt*9); sig = lp(sig, 4200)*k + lp(sig, 2600)*(1-k)
        e = env(n, 0.035, 0.15, 0.8, 0.18, dur*0.95); vol = 0.34
    elif kind == 'brass':   # サビ：力強い金管
        sig = sawv(f, n, -9, kmax=7000) + sawv(f, n, 0, kmax=7000) + sawv(f, n, 9, kmax=7000)
        k = np.exp(-tt*6); sig = lp(sig, 6000)*k + lp(sig, 3400)*(1-k)
        e = env(n, 0.025, 0.15, 0.85, 0.2, dur*0.96); vol = 0.33
    else:                   # 間奏：フルートのようにやさしく
        sig = np.sin(2*np.pi*f*tt) + 0.25*np.sin(2*np.pi*2*f*tt) + 0.06*lp(rng.standard_normal(n), 3000)
        e = env(n, 0.08, 0.3, 0.7, 0.4, dur*0.9); vol = 0.34
    put(sig*e*vol, t, 0.0, 0.3)
    # 弦楽器で1オクターブ下をなぞって厚みを出す
    if kind in ('horn', 'brass') and dur >= S16*2:
        strings([midi-12], t, dur, 0.05 if kind == 'horn' else 0.07, att=0.06)

def bell(midi, t, vol=0.07, pan=0.0, decay=0.3):
    f = hz(midi); n = int((decay*3)*SR); tt = np.arange(n)/SR
    sig = np.sin(2*np.pi*f*tt + 0.8*np.exp(-tt/0.05)*np.sin(2*np.pi*3*f*tt))*np.exp(-tt/decay)
    put(sig*vol, t, pan, 0.4)

def glock(midi, t, vol=0.09, pan=0.35):
    f = hz(midi); n = int(1.6*SR); tt = np.arange(n)/SR
    sig = (np.sin(2*np.pi*f*tt)*np.exp(-tt/0.6) + 0.5*np.sin(2*np.pi*2.76*f*tt)*np.exp(-tt/0.25)
           + 0.25*np.sin(2*np.pi*5.4*f*tt)*np.exp(-tt/0.1))
    put(sig*vol, t, pan, 0.45)

def bass(midi, t, dur, vol=0.32):
    f = hz(midi); n = int((dur+0.1)*SR); tt = np.arange(n)/SR
    sig = sawv(f, n, 0, vib=0, kmax=1800)*0.5 + np.sin(2*np.pi*f*tt)*0.9 + np.sin(2*np.pi*f/2*tt)*0.35
    sig = lp(sig, 700)
    e = env(n, 0.006, 0.1, 0.7, 0.08, dur*0.9)
    put(sig*e*vol, t, 0.0, 0.05)

def kick(t, vol=0.7):
    n = int(0.35*SR); tt = np.arange(n)/SR
    fr = 48 + 100*np.exp(-tt*26); ph = 2*np.pi*np.cumsum(fr)/SR
    put(np.sin(ph)*np.exp(-tt*8)*vol, t, 0, 0.04)
def snare(t, vol=0.32):
    n = int(0.3*SR); tt = np.arange(n)/SR
    nz = bp(rng.standard_normal(n), 900, 6500)*np.exp(-tt*16)
    tone = np.sin(2*np.pi*180*tt)*np.exp(-tt*28)
    put((nz*0.8 + tone*0.6)*vol, t, 0.05, 0.35)
def hat(t, vol=0.05, open_=False):
    n = int((0.25 if open_ else 0.06)*SR); tt = np.arange(n)/SR
    put(hp(rng.standard_normal(n), 7500)*np.exp(-tt*(12 if open_ else 70))*vol, t, 0.3, 0.1)
def clap(t, vol=0.18):
    n = int(0.3*SR); tt = np.arange(n)/SR; sig = np.zeros(n)
    for k, d in enumerate([0, 0.011, 0.023]):
        i = int(d*SR); sig[i:] += bp(rng.standard_normal(n-i), 900, 5000)*np.exp(-tt[:n-i]*(60 if k < 2 else 14))
    put(sig*vol, t, -0.2, 0.4)
def crash(t, vol=0.2):
    n = int(3.0*SR); tt = np.arange(n)/SR
    put(hp(rng.standard_normal(n), 3800)*np.exp(-tt*1.3)*vol, t, -0.25, 0.4)
def swell(t, dur, vol=0.12):   # シンバルが盛り上がる音
    n = int(dur*SR); tt = np.arange(n)/SR
    put(hp(rng.standard_normal(n), 3000)*(tt/dur)**2.5*vol, t, 0.2, 0.5)

def voicing(ch, tr, top=72):
    """和音を弦楽器・合唱向けに広げる（低音＋中音域）"""
    tones = [x+tr for x in CHORD[ch]]
    mid = sorted(((x - 60) % 12) + 60 for x in tones)
    return [tones[0]-12] + mid + [mid[0]+12]

# セクションごとの重ね方（0〜1）
ORCH = {
 'intro':  dict(str=0.080, choir=0.000, timp=1, stab=0, big=0),
 'A':      dict(str=0.080, choir=0.000, timp=0, stab=1, big=1),
 'B':      dict(str=0.104, choir=0.040, timp=1, stab=1, big=1),
 'chorus': dict(str=0.120, choir=0.064, timp=1, stab=2, big=1),
 'bridge': dict(str=0.104, choir=0.056, timp=0, stab=0, big=0),
 'chorus2':dict(str=0.128, choir=0.072, timp=1, stab=2, big=1),
 'outro':  dict(str=0.128, choir=0.072, timp=1, stab=3, big=1),
 'turn':   dict(str=0.128, choir=0.072, timp=1, stab=3, big=1),
}

# ---------------- 組み立て ----------------
t0 = 0.0
for name, chords, mel, tr, o in SECTIONS:
    nb = len(chords); oc = ORCH[name]
    for b, ch in enumerate(chords):
        tb = t0 + b*BAR; tones = [x+tr for x in CHORD[ch]]; root = tones[0]
        last = b == nb-1; final_hit = (name == 'outro' and last)
        v = voicing(ch, tr)
        # 弦楽合奏（Bメロは小節ごとにだんだん大きく）
        sv = oc['str'] * ((0.6 + 0.5*b/nb) if name in ('B', 'intro') else 1)
        strings(v, tb, BAR*(0.5 if final_hit else 1), sv)
        if oc['choir']: choir(v[1:4], tb, BAR*(0.5 if final_hit else 1), oc['choir'])
        # 金管の和音
        if oc['stab'] == 1:
            brass([x+12 for x in v[1:4]], tb, S16*3, 0.10)
        elif oc['stab'] == 2:
            for k, ln in ((0, 3), (6, 2), (8, 3), (14, 2)): brass([x+12 for x in v[1:4]], tb + k*S16, S16*ln, 0.11)
        elif oc['stab'] == 3:
            brass([x+12 for x in v[1:4]] + [v[1]+24], tb, BAR*(0.5 if final_hit else 0.9), 0.13)
        # アルペジオ（電飾のきらめき：控えめに）
        if o.get('arp'):
            seq = [0,1,2,1, 0,1,2,3, 0,1,2,1, 2,1,0,1]
            for k in range(16):
                idx = seq[k]; mm = tones[idx % len(tones)] + 24 + (12 if idx == 3 else 0)
                bell(mm if mm < 100 else mm-12, tb + k*S16, 0.028 if name != 'intro' else 0.045, -0.5 if k % 2 else 0.5)
        # ベース
        bs = o.get('bass')
        if bs == 'half':
            bass(root-12, tb, BAR/2*0.95); bass(root-12+7, tb+BAR/2, BAR/2*0.95)
        elif bs in ('march', 'drive'):
            pat = [0,0,7,0, 0,0,7,12] if bs == 'march' else [0,12,0,12, 7,12,0,12]
            for k in range(8): bass(root-12+pat[k], tb + k*2*S16, 2*S16*0.9, 0.3 if bs == 'march' else 0.28)
        # ティンパニ・大太鼓
        if oc['timp']:
            timpani(root-24 if root-24 >= 36 else root-12, tb, 0.42)
            if name in ('chorus', 'chorus2', 'turn', 'outro'): timpani(root-24+7 if root-24 >= 36 else root-12+7, tb + 8*S16, 0.3)
        if oc['big']:
            for k in (0, 8): bigdrum(tb + k*S16, 0.5 if name in ('chorus', 'chorus2', 'turn', 'outro') else 0.38)
        # ドラム
        dr = o.get('drums')
        if b == 0 and name != 'intro': crash(tb)
        if dr == 'intro':
            if b >= 4:
                for k in range(4): kick(tb + k*4*S16, 0.4)
            for k in range(8): hat(tb + k*2*S16, 0.03)
        elif dr in ('march', 'build', 'full', 'light'):
            for k in range(4):
                if dr != 'light' or k % 2 == 0: kick(tb + k*4*S16, 0.6 if dr == 'full' else 0.52)
            for k in (1, 3): snare(tb + k*4*S16, 0.28 if dr != 'light' else 0.16)
            if dr in ('march', 'build'): snare(tb + 15*S16, 0.1)
            for k in range(8): hat(tb + k*2*S16, 0.045 if dr != 'light' else 0.028)
            if dr == 'full':
                for k in range(8): hat(tb + (k*2+1)*S16, 0.025)
                hat(tb + 14*S16, 0.04, True)
            if dr == 'build' and b >= 4:
                for k in range(16): hat(tb + k*S16, 0.022)
        elif dr == 'end':
            if b < nb-1:
                for k in range(4): kick(tb + k*4*S16, 0.6)
                for k in (1, 3): snare(tb + k*4*S16)
                for k in range(8): hat(tb + k*2*S16)
            else:
                crash(tb, 0.28); kick(tb, 0.85); snare(tb, 0.35); bigdrum(tb, 0.7); timpani(root-24 if root-24 >= 36 else root-12, tb, 0.6)
        if o.get('clap'):
            for k in (1, 3): clap(tb + k*4*S16)
        # 区切り：スネアロール＋ティンパニロール＋シンバルの盛り上がり
        if last and (o.get('roll') or name in ('A', 'intro')) and dr != 'end':
            for k in range(8, 16): snare(tb + k*S16, 0.05 + (k-8)*0.028)
            if oc['timp'] or name in ('A', 'bridge'):
                for k in range(8, 16): timpani(root-24 if root-24 >= 36 else root-12, tb + k*S16, 0.08 + (k-8)*0.03)
            swell(tb, BAR, 0.1)
        # 鉄琴（サビの合いの手）
        if o.get('glock') == 1 and not final_hit:
            for k in (2, 6, 10, 14): glock(tones[(k//4) % len(tones)] + 24, tb + k*S16, 0.05)
        if o.get('glock') == 2:
            for k in (0, 4, 8, 12): glock(tones[(k//4) % len(tones)] + 24, tb + k*S16, 0.07, -0.35)
    if o.get('riser'): swell(t0 + (nb-1)*BAR, BAR, 0.14)
    # メロディ
    if mel:
        kind = {'square':'horn'}.get(o.get('lead', 'square'), o.get('lead', 'square'))
        for b, bar in enumerate(mel):
            tt = t0 + b*BAR
            for nm, d in bar:
                if nm != 'r': lead(m(nm)+tr, d*S16, tt, kind)
                tt += d*S16
    t0 += nb*BAR

# 最後の和音をのばす
if MODE == 'full':
    for mm in [60,64,67,72]: glock(mm+2+12, t0 - BAR, 0.07)

# ---------------- 残響とマスタリング ----------------
ir_n = int(3.2*SR); tt = np.arange(ir_n)/SR
ir = [lp(rng.standard_normal(ir_n), 5500)*np.exp(-tt*2.0)*(1 - np.exp(-tt*60)) for _ in range(2)]
wetL = fftconvolve(VERB[0], ir[0])[:LEN]; wetR = fftconvolve(VERB[1], ir[1])[:LEN]
L += wetL*0.075; R += wetR*0.075
mix = np.stack([L, R], 1)
if MODE == 'loop':
    # 曲の長さちょうどで切り、はみ出した余韻を頭に重ねる（つなぎ目が切れない）
    loopN = int(round(total_bars*BAR*SR))
    tail = mix[loopN:]; mix = mix[:loopN].copy(); mix[:len(tail)] += tail
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix*1.6)/np.tanh(1.6)  # 軽いソフトクリップで音圧をそろえる
if MODE == 'full':
    fade = int(0.02*SR); mix[:fade] *= np.linspace(0, 1, fade)[:, None]
mix *= 0.92

here = os.path.dirname(os.path.abspath(__file__))
base = 'parade' if MODE == 'loop' else 'parade_full'
wav = os.path.join(here, base + '.wav')
from scipy.io import wavfile
wavfile.write(wav, SR, (mix*32767).astype(np.int16))
mp3 = os.path.join(here, base + '.mp3')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-b:a', '160k', mp3], check=True)
print(f'done ({MODE}): {total_bars} bars, {len(mix)/SR:.3f} s')
if len(sys.argv) <= 1:
    subprocess.run([sys.executable, os.path.abspath(__file__), 'full'], check=True)
