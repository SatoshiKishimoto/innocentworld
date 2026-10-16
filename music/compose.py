"""
innocent world パレードのテーマ（オリジナル曲・オーケストラ版）
  python3 music/compose.py   … ループ用 parade.mp3 と 1曲版 parade_full.mp3 を作ります
"""
import sys, os, subprocess
import numpy as np
from scipy.signal import butter, lfilter, fftconvolve
from scipy.io import wavfile

MODE = sys.argv[1] if len(sys.argv) > 1 else 'loop'
SR = 44100
BPM = 116
S16 = 60/BPM/4
BAR = S16*16
rng = np.random.default_rng(11)

NOTE = {'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11}
def m(name): return 12*(int(name[-1])+1) + NOTE[name[:-1]]
def hz(x): return 440.0*2**((x-69)/12)

CH = {'F':[53,57,60],'Bb':[58,62,65],'C':[48,52,55],'C7':[48,52,55,58],'Dm':[50,53,57],'Gm':[55,58,62],
      'Am':[57,60,64],'A7':[57,61,64,67],'D7':[50,54,57,60],'G':[55,59,62],'Eb':[51,55,58],'Em':[52,55,59]}

# ---------------- 曲 ----------------
A_MEL = [
 [('C5',3),('D5',1),('F5',4),('A5',4),('G5',4)],
 [('F5',6),('E5',2),('F5',8)],
 [('D5',3),('E5',1),('F5',4),('Bb5',4),('A5',4)],
 [('G5',8),('F5',4),('E5',4)],
 [('D5',3),('E5',1),('F5',4),('A5',4),('D6',4)],
 [('C6',6),('Bb5',2),('A5',4),('G5',4)],
 [('G5',3),('A5',1),('Bb5',4),('A5',4),('G5',4)],
 [('F5',12),('r',4)],
]
A_CH = ['F','F','Bb','C','Dm','Bb','C7','F']
A2_LAST = [('F5',8),('r',4),('C5',2),('E5',2)]

B_MEL = [
 [('F5',6),('D5',2),('Bb4',8)],
 [('C5',6),('E5',2),('G5',8)],
 [('A5',6),('G5',2),('E5',4),('C5',4)],
 [('D5',16)],
 [('Bb5',6),('A5',2),('G5',4),('D5',4)],
 [('E5',6),('F5',2),('G5',8)],
 [('F5',4),('D5',4),('Bb4',4),('D5',4)],
 [('C5',4),('E5',4),('G5',4),('Bb5',4)],
]
B_CH = ['Bb','C','Am','Dm','Gm','C','Bb','C7']

C_MEL = [
 [('C6',8),('A5',4),('F5',4)],
 [('D6',6),('C6',2),('Bb5',4),('F5',4)],
 [('G5',4),('Bb5',4),('D6',6),('C6',2)],
 [('C6',12),('r',4)],
 [('A5',4),('C6',4),('E6',6),('D6',2)],
 [('D6',6),('C6',2),('Bb5',4),('A5',4)],
 [('C6',6),('Bb5',2),('A5',4),('G5',4)],
 [('F5',12),('r',4)],
 [('C6',8),('A5',4),('F5',4)],
 [('D6',6),('C6',2),('Bb5',4),('F5',4)],
 [('G5',4),('Bb5',4),('D6',6),('C6',2)],
 [('C6',12),('r',4)],
 [('A5',4),('C6',4),('E6',6),('D6',2)],
 [('D6',4),('E6',4),('F6',8)],
 [('E6',6),('D6',2),('C6',4),('Bb5',4)],
 [('F6',8),('C6',4),('A5',4)],
]
C_CH = ['F','Bb','Gm','C','Am','Dm','C7','F','F','Bb','Gm','C','Am','Dm','C7','F']

BR_MEL = [
 [('A4',3),('Bb4',1),('D5',4),('F5',4),('E5',4)],
 [('D5',12),('r',4)],
 [('G4',3),('A4',1),('Bb4',4),('D5',4),('G5',4)],
 [('E5',8),('C#5',8)],
 [('A5',3),('G5',1),('F5',4),('E5',4),('D5',4)],
 [('F5',8),('D5',8)],
 [('E5',4),('G5',4),('C6',4),('Bb5',4)],
 [('D5',4),('F#5',4),('A5',4),('C6',4)],
]
BR_CH = ['Dm','Bb','Gm','A7','Dm','Bb','C','D7']

INTRO_MEL = [None, None, [('C5',3),('D5',1),('F5',4),('A5',4),('G5',4)], [('F5',4),('C5',4),('F5',8)], None, None, None, None]
INTRO_CH = ['F','F','F','F','F','C7','F','C7']

if MODE == 'loop':   # ト長調から E♭→F→C7 を通ってイントロ（ヘ長調）へ戻る
    END_MEL = [[('D6',12),('r',4)], [('Eb6',8),('Bb5',8)], [('C6',8),('A5',8)], [('G5',4),('Bb5',4),('C6',4),('E6',4)]]
    END_CH = ['G','Eb','F','C7']
else:                # 1曲版：ト長調で堂々と終わる
    END_MEL = [[('D6',3),('E6',1),('D6',4),('B5',4),('G5',4)], [('E6',8),('C6',8)], [('D6',3),('C6',1),('B5',4),('A5',4),('F#5',4)], [('G5',16)]]
    END_CH = ['G','Em','D7','G']

SECTIONS = [
 ('intro', INTRO_CH, INTRO_MEL, 0),
 ('A1', A_CH, A_MEL, 0),
 ('A2', A_CH, A_MEL[:7] + [A2_LAST], 0),
 ('B', B_CH, B_MEL, 0),
 ('C', C_CH, C_MEL, 0),
 ('BR', BR_CH, BR_MEL, 0),
 ('C2', C_CH, C_MEL, 2),
 ('END', END_CH, END_MEL, 0),
]
total_bars = sum(len(s[1]) for s in SECTIONS)
LOOP_SEC = total_bars*BAR
LEN = int((LOOP_SEC + 5.0)*SR)
OUT = np.zeros((2, LEN)); VERB = np.zeros((2, LEN))

def put(sig, t, pan=0.0, rev=0.3):
    i = int(t*SR); n = min(len(sig), LEN-i)
    if n <= 0 or i < 0: return
    gl = np.cos((pan+1)*np.pi/4); gr = np.sin((pan+1)*np.pi/4)
    OUT[0, i:i+n] += sig[:n]*gl; OUT[1, i:i+n] += sig[:n]*gr
    VERB[0, i:i+n] += sig[:n]*gl*rev; VERB[1, i:i+n] += sig[:n]*gr*rev

# ---------------- 音づくりの道具 ----------------
def lp(x, fc, o=2):
    b, a = butter(o, min(fc, SR*0.45)/(SR/2), 'low'); return lfilter(b, a, x)
def hp(x, fc, o=2):
    b, a = butter(o, fc/(SR/2), 'high'); return lfilter(b, a, x)
def bp(x, lo, hi, o=2):
    b, a = butter(o, [lo/(SR/2), min(hi, SR*0.45)/(SR/2)], 'band'); return lfilter(b, a, x)
def adsr(n, a, d, s, r, hold):
    t = np.arange(n)/SR; h = max(hold, a+d)
    e = np.interp(t, [0, a, a+d, h], [0, 1, s, s]); rel = t > h
    e[rel] = s*np.exp(-(t[rel]-h)/max(r/3, 1e-3)); return e
def phase(f, n, vib=0.0, rate=5.5, delay=0.25, scoop=0.0, detune=0.0):
    """ビブラート（少し遅れて掛かる）と、音の出だしのしゃくり上げ付きの位相"""
    t = np.arange(n)/SR
    fi = f*2**(detune/1200)*np.ones(n)
    if vib: fi *= 1 + vib*np.sin(2*np.pi*rate*t + rng.random()*6)*np.clip((t-delay)/0.3, 0, 1)
    if scoop: fi *= 2**(-scoop/1200*np.exp(-t/0.035))
    return 2*np.pi*np.cumsum(fi)/SR + rng.random()*6
def harm(ph, f, amps, kmax=9000):
    out = np.zeros(len(ph))
    for k, a in enumerate(amps, 1):
        if k*f > kmax: break
        if a: out += a*np.sin(k*ph)
    return out
SAW = [1/k for k in range(1, 31)]

# ---------------- 楽器 ----------------
def strings(midi, t, dur, vol, sect='vln', att=0.09, trem=False, pan=None):
    f = hz(midi); n = int((dur+0.45)*SR)
    nv, kmax, cut = {'vln':(6,7000,5200), 'vla':(4,5000,3800), 'vc':(4,4000,3000), 'cb':(3,2500,1600)}[sect]
    sig = np.zeros(n)
    for v in range(nv):
        ph = phase(f, n, vib=0.004, rate=5.2+rng.random()*0.8, delay=0.18, detune=rng.normal(0, 7))
        sig += harm(ph, f, SAW, kmax)
    sig = lp(sig, cut) + 0.35*bp(sig, 2500, 3500)
    sig = hp(sig, {'vln':180,'vla':120,'vc':60,'cb':35}[sect])
    e = adsr(n, att, 0.15, 0.85, 0.35, dur)
    if trem: e *= 0.65 + 0.35*np.sin(2*np.pi*13*np.arange(n)/SR)
    p = pan if pan is not None else {'vln':-0.45,'vla':0.15,'vc':0.35,'cb':0.5}[sect]
    put(sig*e*vol/nv**0.5*0.5, t, p, 0.45)

def pizz(midi, t, vol, pan=0.4):
    f = hz(midi); n = int(0.9*SR); tt = np.arange(n)/SR; sig = np.zeros(n); ph = 2*np.pi*f*tt
    for k in range(1, 9):
        if k*f > 6000: break
        sig += np.sin(k*ph)/k*np.exp(-tt*(4 + 3.5*k))
    put(lp(sig, 3500)*np.minimum(1, tt/0.002)*vol, t, pan, 0.4)

def brass(midi, t, dur, vol, kind='tpt', pan=None, accent=1.0):
    f = hz(midi); n = int((dur+0.3)*SR)
    nv, lo, hi, p0 = {'tpt':(3,1400,6200,0.2), 'hn':(4,700,2300,-0.15), 'tbn':(3,600,2600,0.35), 'tuba':(2,300,1000,0.45)}[kind]
    raw = np.zeros(n)
    for v in range(nv):
        ph = phase(f, n, vib=0.0025 if kind in ('tpt','hn') else 0.0, rate=5.0, delay=0.3, scoop=30, detune=rng.normal(0, 5))
        raw += harm(ph, f, SAW, 9000)
    e = adsr(n, 0.03 if kind != 'tuba' else 0.04, 0.12, 0.78, 0.18, dur)
    bright = np.clip(e*accent, 0, 1)**1.6
    sig = lp(raw, lo)*(1-bright) + lp(raw, hi)*bright
    put(sig*e*vol/nv**0.5*0.42, t, pan if pan is not None else p0, 0.32)

def wind(midi, t, dur, vol, kind='fl', pan=None):
    f = hz(midi); n = int((dur+0.3)*SR)
    ph = phase(f, n, vib=0.005 if kind != 'cl' else 0.002, rate=5.3, delay=0.15)
    amps = {'fl':[1,0.22,0.06,0.02], 'cl':[1,0.05,0.45,0.03,0.22,0.02,0.1], 'ob':[0.6,1,0.8,0.5,0.3,0.15]}[kind]
    sig = harm(ph, f, amps, 8000)
    if kind == 'fl': sig += 0.06*bp(rng.standard_normal(n), f*0.8, f*3)
    if kind == 'ob': sig = lp(sig, 3600)
    e = adsr(n, 0.05, 0.1, 0.85, 0.15, dur)
    put(sig*e*vol*0.5, t, pan if pan is not None else {'fl':-0.2,'cl':0.05,'ob':0.1}[kind], 0.4)

def glock(midi, t, vol=0.08, pan=-0.3):
    f = hz(midi); n = int(1.8*SR); tt = np.arange(n)/SR
    sig = (np.sin(2*np.pi*f*tt)*np.exp(-tt/0.7) + 0.4*np.sin(2*np.pi*2.76*f*tt)*np.exp(-tt/0.22)
           + 0.2*np.sin(2*np.pi*5.4*f*tt)*np.exp(-tt/0.08))
    put(sig*vol, t, pan, 0.45)

def harp(midi, t, vol=0.1, pan=-0.6):
    f = hz(midi); n = int(2.2*SR); tt = np.arange(n)/SR; sig = np.zeros(n)
    for k in range(1, 7):
        if k*f > 7000: break
        sig += np.sin(2*np.pi*k*f*tt)/(k**1.3)*np.exp(-tt*(1.2 + 1.6*k))
    put(sig*np.minimum(1, tt/0.003)*vol, t, pan, 0.5)

def choir(midis, t, dur, vol):
    n = int((dur+0.8)*SR); e = adsr(n, 0.35, 0.3, 0.9, 0.7, dur)
    for i, mm in enumerate(midis):
        f = hz(mm); src = np.zeros(n)
        for v in range(4):
            src += harm(phase(f, n, vib=0.006, rate=4.8+rng.random(), delay=0.2, detune=rng.normal(0, 9)), f, SAW, 5000)
        sig = bp(src, 650, 950)*1.0 + bp(src, 1050, 1300)*0.55 + bp(src, 2400, 3000)*0.2 + lp(src, 350)*0.35
        put(sig*e*vol*0.25, t, (-0.35, 0.35, 0.0, -0.15)[i % 4], 0.6)

def timpani(midi, t, vol=0.5):
    f = hz(midi); n = int(2.0*SR); tt = np.arange(n)/SR
    sig = (np.sin(2*np.pi*f*tt)*np.exp(-tt*1.8) + 0.45*np.sin(2*np.pi*1.5*f*tt)*np.exp(-tt*2.8)
           + 0.25*np.sin(2*np.pi*1.98*f*tt)*np.exp(-tt*4) + 1.2*lp(rng.standard_normal(n), 400)*np.exp(-tt*30))
    put(sig*vol, t, 0.1, 0.45)
def timp_roll(midi, t, dur, v0, v1):
    k = int(dur/(S16/2))
    for i in range(k): timpani(midi, t + i*S16/2, (v0 + (v1-v0)*i/max(1, k-1))*0.5)
def bassdrum(t, vol=0.5):
    n = int(1.3*SR); tt = np.arange(n)/SR
    fr = 50 + 25*np.exp(-tt*12); ph = 2*np.pi*np.cumsum(fr)/SR
    put((np.sin(ph)*np.exp(-tt*3.2) + 0.6*lp(rng.standard_normal(n), 300)*np.exp(-tt*20))*vol, t, 0, 0.4)
def snare(t, vol=0.25):
    n = int(0.28*SR); tt = np.arange(n)/SR
    sig = bp(rng.standard_normal(n), 1800, 9000)*np.exp(-tt*20)*0.9 + np.sin(2*np.pi*200*tt)*np.exp(-tt*35)*0.5
    put(sig*vol, t, 0.1, 0.3)
def snare_roll(t, dur, v0, v1):
    k = int(dur/(S16/2))
    for i in range(k): snare(t + i*S16/2, v0 + (v1-v0)*i/max(1, k-1))
def cymbal(t, vol=0.25):
    n = int(3.5*SR); tt = np.arange(n)/SR
    sig = hp(rng.standard_normal(n), 3500)*np.exp(-tt*1.1)
    for fr in (3200, 4870, 6230, 7740): sig += 0.08*np.sin(2*np.pi*fr*tt)*np.exp(-tt*1.6)
    put(sig*vol, t, -0.3, 0.5)
def triangle(t, vol=0.06):
    n = int(2.0*SR); tt = np.arange(n)/SR
    sig = sum(a*np.sin(2*np.pi*fr*tt)*np.exp(-tt*d) for fr, a, d in ((1620,1,1.4),(4250,0.6,2),(7330,0.4,3)))
    put(sig*vol, t, -0.45, 0.5)

# ---------------- 編曲 ----------------
def mid_voicing(tones):
    return sorted(((x - 57) % 12) + 57 for x in tones)

hn_prev = 64
def horn_counter(tones, t, dur, vol):
    """ホルンの対旋律：和音の中で、前の音にいちばん近い音を選んでなめらかにつなぐ"""
    global hn_prev
    pcs = [c % 12 for c in tones]
    cand = [x for x in range(57, 72) if x % 12 in pcs and x != hn_prev] or [hn_prev]
    nxt = min(cand, key=lambda x: (abs(x - hn_prev), x)); hn_prev = nxt
    brass(nxt, t, dur, vol, 'hn')

def melody_notes(mel, trn):
    out = []; tt = 0
    for nm, d in mel:
        if nm != 'r': out.append((m(nm)+trn, tt, d*S16))
        tt += d*S16
    return out

def low(x): return x-12 if x-12 >= 40 else x

t0 = 0.0
for name, chords, mels, trn in SECTIONS:
    nb = len(chords)
    for b, ch in enumerate(chords):
        tb = t0 + b*BAR
        tones = [x+trn for x in CH[ch]]; root = tones[0]; fifth = root + 7
        mv = mid_voicing(tones)
        mel = mels[b]
        notes = melody_notes(mel, trn) if mel else []
        last = b == nb-1
        bass_root = root - 12 if root - 12 >= 33 else root
        pcs = [x % 12 for x in tones]
        if name == 'intro':
            if b < 2:
                for x in mv: strings(x+12, tb, BAR, 0.16, 'vln', att=0.3, trem=True)
                strings(bass_root, tb, BAR, 0.18, 'vc', att=0.3, trem=True)
                timp_roll(low(root), tb, BAR, 0.15 + 0.25*b, 0.4 + 0.3*b)
                if b == 1: snare_roll(tb + BAR/2, BAR/2, 0.05, 0.3)
            elif b < 4:
                if b == 2: cymbal(tb, 0.3); bassdrum(tb, 0.7)
                for midi, st, d in notes:   # 3度下でハモるファンファーレ
                    brass(midi, tb+st, d, 0.5, 'tpt')
                    lower = next(x for x in range(midi-3, midi-6, -1) if x % 12 in pcs or x == midi-5)
                    brass(lower, tb+st, d, 0.36, 'tpt', pan=0.0)
                    brass(midi-12, tb+st, d, 0.32, 'hn')
                for x in mv: brass(x-12, tb, BAR*0.95, 0.22, 'tbn')
                brass(bass_root-12, tb, BAR*0.95, 0.3, 'tuba')
                timpani(low(root), tb, 0.55)
                if b == 3: snare_roll(tb + BAR*0.5, BAR*0.5, 0.06, 0.3)
            else:
                for k, bt in enumerate((0, 4, 8, 12)):
                    if k % 2 == 0:
                        bn = bass_root if k == 0 else (fifth-12 if fifth-12 >= 33 else fifth)
                        brass(bn-12 if bn-12 >= 28 else bn, tb+bt*S16, S16*3, 0.3, 'tuba'); pizz(bn, tb+bt*S16, 0.25, 0.5)
                        bassdrum(tb+bt*S16, 0.3)
                    else:
                        for x in mv: brass(x, tb+bt*S16, S16*2, 0.13, 'hn'); strings(x, tb+bt*S16, S16*1.5, 0.07, 'vla', att=0.02)
                for k in (0, 2, 3, 4, 6, 8, 10, 11, 12, 14): snare(tb + k*S16, 0.13 if k not in (4, 12) else 0.2)
                glock(m('F6') if ch == 'F' else m('E6'), tb, 0.06)
                if last: snare_roll(tb + BAR*0.75, BAR*0.25, 0.08, 0.3)
        else:
            tutti = name in ('C', 'C2', 'END')
            soft = name in ('B', 'BR')
            # 伴奏：ズン・チャッ（Bと間奏はピチカートで軽く）
            for k, bt in enumerate((0, 4, 8, 12)):
                if k % 2 == 0:
                    bn = bass_root if k == 0 else (fifth-12 if fifth-12 >= 33 else fifth)
                    if soft: pizz(bn, tb+bt*S16, 0.3, 0.5); pizz(bn+12, tb+bt*S16, 0.18, 0.35)
                    else:
                        brass(bn-12 if bn-12 >= 28 else bn, tb+bt*S16, S16*3, 0.33 if tutti else 0.27, 'tuba')
                        strings(bn, tb+bt*S16, S16*3, 0.17, 'cb', att=0.02); strings(bn+12, tb+bt*S16, S16*3, 0.11, 'vc', att=0.02)
                else:
                    for x in mv:
                        if soft: pizz(x, tb+bt*S16, 0.12, 0.15)
                        else: brass(x, tb+bt*S16, S16*2, 0.12 if tutti else 0.1, 'hn'); strings(x, tb+bt*S16, S16*1.6, 0.06, 'vla', att=0.02)
            # のばす和音（弦・合唱）
            final_hit = MODE == 'full' and name == 'END' and last
            if name in ('B', 'C', 'C2', 'BR', 'END', 'A2') and not final_hit:
                for x in mv: strings(x, tb, BAR, 0.07 if name in ('A2', 'BR') else 0.1, 'vla', att=0.25)
                strings(bass_root+12, tb, BAR, 0.08, 'vc', att=0.25)
            if name in ('C', 'C2', 'END') and not final_hit:
                choir([x+12 for x in mv], tb, BAR, 0.11 if name == 'C' else 0.14)
            # メロディ
            for midi, st, d in notes:
                if name == 'A1':
                    brass(midi, tb+st, d, 0.55, 'tpt'); glock(midi+12, tb+st, 0.05)
                    if d >= S16*4: wind(midi+12, tb+st, d, 0.12, 'fl')
                elif name == 'A2':
                    brass(midi, tb+st, d, 0.5, 'tpt'); strings(midi, tb+st, d, 0.3, 'vln', att=0.04)
                    wind(midi+12, tb+st, d, 0.16, 'fl'); strings(midi-12, tb+st, d, 0.16, 'vla', att=0.05)
                elif name == 'B':
                    strings(midi, tb+st, d, 0.42, 'vln', att=0.12); wind(midi-12, tb+st, d, 0.2, 'cl')
                    strings(midi-12, tb+st, d, 0.2, 'vc', att=0.15)
                elif name == 'BR':
                    wind(midi+12 if midi < m('A5') else midi, tb+st, d, 0.3, 'fl'); wind(midi, tb+st, d, 0.18, 'cl')
                else:  # サビ：トランペット＋バイオリン＋フルート（上）＋トロンボーン（下）
                    brass(midi, tb+st, d, 0.5, 'tpt', accent=1.1); strings(midi, tb+st, d, 0.36, 'vln', att=0.04)
                    wind(midi+12 if midi+12 <= m('C7') else midi, tb+st, d, 0.13, 'fl')
                    brass(midi-12, tb+st, d, 0.24, 'tbn')
                    if name != 'C': glock(midi+12 if midi+12 <= m('C7') else midi, tb+st, 0.045)
            if name in ('C', 'C2'):
                horn_counter(tones, tb, BAR/2, 0.2); horn_counter(tones, tb+BAR/2, BAR/2, 0.2)
            if soft:
                arp = sorted(set(x for x in range(53, 89) if x % 12 in pcs))[:8]
                for k, x in enumerate(arp): harp(x, tb + k*2*S16, 0.09)
            # 打楽器
            if not soft and not final_hit:
                for bt in (0, 8): bassdrum(tb + bt*S16, 0.42 if tutti else 0.32)
                for k in (0, 2, 3, 4, 6, 8, 10, 11, 12, 14): snare(tb + k*S16, (0.2 if k in (4, 12) else 0.11) * (1.15 if tutti else 1))
            elif soft:
                if b % 2 == 0: triangle(tb, 0.05)
                for k in (4, 12): snare(tb + k*S16, 0.06)
            if b % 4 == 0 and (tutti or name == 'A2'): cymbal(tb, 0.24 if tutti else 0.16)
            if tutti and b % 4 == 0: timpani(low(root), tb, 0.5)
            if b == 0 and name in ('A1', 'B', 'C', 'C2', 'END'): cymbal(tb, 0.28); timpani(low(root), tb, 0.55)
            if last and name in ('A1', 'A2', 'B', 'C'): snare_roll(tb + BAR*0.75, BAR*0.25, 0.06, 0.28)
            if last and name == 'B': timp_roll(low(root), tb + BAR/2, BAR/2, 0.15, 0.6)
            if name == 'BR' and b >= 6:
                timp_roll(m('D3'), tb, BAR, 0.1 + 0.25*(b-6), 0.35 + 0.35*(b-6)); snare_roll(tb, BAR, 0.04 + 0.1*(b-6), 0.12 + 0.2*(b-6))
                if b == 7:   # バイオリンの駆け上がり → 最後のサビへ
                    scale = [m(x) for x in ['D5','E5','F#5','G5','A5','B5','C6','D6','E6','F#6','G6','A6','B6','C7','D7','E7']]
                    for k, x in enumerate(scale): strings(x-12, tb + k*S16, S16*1.2, 0.18 + 0.02*k, 'vln', att=0.01)
            if final_hit:   # 1曲版の最後の「じゃーん！」
                for x in mv: brass(x+12, tb, BAR*0.9, 0.3, 'tpt'); brass(x, tb, BAR*0.9, 0.25, 'hn'); strings(x+12, tb, BAR*0.9, 0.2, 'vln')
                brass(bass_root-12, tb, BAR*0.9, 0.35, 'tuba'); choir([x+12 for x in mv], tb, BAR*0.9, 0.15)
                timp_roll(low(root), tb, BAR*0.5, 0.3, 0.8); cymbal(tb + BAR*0.5, 0.38); bassdrum(tb + BAR*0.5, 0.8); timpani(low(root), tb+BAR*0.5, 0.8)
            if name == 'END' and MODE == 'loop' and last:
                snare_roll(tb + BAR*0.5, BAR*0.5, 0.06, 0.3)
    t0 += nb*BAR

# ---------------- 残響（コンサートホール）とマスタリング ----------------
ir_n = int(3.2*SR); tt = np.arange(ir_n)/SR
ir = [lp(rng.standard_normal(ir_n), 5000)*np.exp(-tt*2.2)*(1-np.exp(-tt*80)) for _ in range(2)]
early = np.zeros(ir_n)
for d, g in ((0.011, 0.5), (0.019, 0.35), (0.027, 0.3), (0.041, 0.2)): early[int(d*SR)] += g
OUT[0] += fftconvolve(VERB[0], ir[0] + early)[:LEN]*0.06
OUT[1] += fftconvolve(VERB[1], ir[1] + early)[:LEN]*0.06
mix = OUT.T.copy()
if MODE == 'loop':
    loopN = int(round(LOOP_SEC*SR)); tail = mix[loopN:]; mix = mix[:loopN].copy(); mix[:len(tail)] += tail
mix = hp(mix.T, 30).T
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix*1.5)/np.tanh(1.5)
if MODE == 'full':
    f = int(0.02*SR); mix[:f] *= np.linspace(0, 1, f)[:, None]
    mix = mix[:int((LOOP_SEC + 4.0)*SR)]
mix *= 0.93

here = os.path.dirname(os.path.abspath(__file__))
base = 'parade' if MODE == 'loop' else 'parade_full'
wav = os.path.join(here, base + '.wav')
wavfile.write(wav, SR, (mix*32767).astype(np.int16))
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-b:a', '192k', os.path.join(here, base + '.mp3')], check=True)
print(f'done ({MODE}): {total_bars} bars, loop {LOOP_SEC:.3f} s, file {len(mix)/SR:.2f} s')
if len(sys.argv) <= 1:
    subprocess.run([sys.executable, os.path.abspath(__file__), 'full'], check=True)
