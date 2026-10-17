"""
innocent world クリスマスパレードのテーマ（オリジナル曲・ループ用）
  python3 music/xmas.py   … music/xmas.mp3 を作ります（最後から最初へ切れ目なくつながる）
楽器の音は music/compose.py（パレードのテーマ）と同じものに、鈴（スレイベル）とチェレスタを加えています。
"""
import os, subprocess
import numpy as np
from scipy.signal import fftconvolve, butter, lfilter
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 44100
BPM = 132
S16 = 60/BPM/4
BAR = S16*16
rng = np.random.default_rng(1225)
NOTE = {'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'Ab':8,'A':9,'Bb':10,'B':11}
def m(name): return 12*(int(name[-1])+1) + NOTE[name[:-1]]
def hz(x): return 440.0*2**((x-69)/12)
CHORD = {'C':[48,52,55],'F':[53,57,60],'G':[55,59,62],'G7':[55,59,62,65],'Am':[57,60,64],'Em':[52,55,59],'Dm':[50,53,57],
         'D7':[50,54,57,60],'E7':[52,56,59,62],'C7':[48,52,55,58],'Fm':[53,56,60],'Bb':[58,62,65],'D':[50,54,57],'A7':[57,61,64,67]}

# ---------------- 曲（オリジナル）：(音名, 16分音符の数) ----------------
INTRO = ['C','Am','F','G7']
A_CH  = ['C','C','F','C','Dm','G7','C','G7']
A_MEL = [[('G4',4),('C5',4),('E5',4),('G5',4)], [('A5',4),('G5',4),('E5',4),('C5',4)],
         [('F5',4),('A5',4),('C6',6),('A5',2)], [('G5',8),('E5',8)],
         [('D5',4),('E5',4),('F5',4),('A5',4)], [('G5',4),('F5',4),('D5',4),('B4',4)],
         [('C5',4),('E5',4),('G5',4),('C6',4)], [('B5',8),('G5',8)]]
B_CH  = ['Am','Em','F','C','Dm','A7','Dm','G7']
B_MEL = [[('A5',8),('E5',8)], [('G5',6),('F5',2),('E5',8)], [('F5',4),('A5',4),('C6',4),('A5',4)], [('G5',16)],
         [('F5',6),('E5',2),('D5',4),('F5',4)], [('E5',4),('C#5',4),('E5',4),('A5',4)], [('D6',8),('A5',8)], [('B5',4),('A5',4),('G5',4),('F5',4)]]
C_CH  = ['C','E7','Am','C7','F','G7','C','C']
C_MEL = [[('E6',6),('D6',2),('C6',8)], [('B5',6),('G#5',2),('E5',8)], [('A5',4),('C6',4),('E6',4),('C6',4)], [('G5',8),('Bb5',8)],
         [('A5',6),('C6',2),('F6',8)], [('E6',4),('D6',4),('B5',4),('G5',4)], [('C6',8),('G5',4),('E5',4)], [('C6',16)]]
BR_CH = ['Am','F','C','G','Am','F','D7','G7']
BR_MEL= [[('E5',4),('A5',4),('C6',8)], [('A5',8),('F5',8)], [('G5',4),('C6',4),('E6',8)], [('D6',16)],
         [('C6',4),('B5',4),('A5',4),('E5',4)], [('F5',4),('A5',4),('C6',4),('F6',4)], [('F#5',4),('A5',4),('D6',4),('C6',4)], [('B5',4),('D6',4),('G6',4),('F6',4)]]
TURN_CH = ['F','G','C','G7']          # 最後：もとの調に戻ってイントロへつなぐ
TURN_MEL= [[('A5',4),('C6',4),('F6',8)], [('D6',4),('B5',4),('G5',8)], [('E5',4),('G5',4),('C6',8)], [('B5',4),('G5',4),('F5',4),('D5',4)]]

SECTIONS = [('intro', INTRO, None, 0), ('A', A_CH, A_MEL, 0), ('A2', A_CH, A_MEL, 0), ('B', B_CH, B_MEL, 0),
            ('C', C_CH, C_MEL, 0), ('BR', BR_CH, BR_MEL, 0), ('C2', C_CH, C_MEL, 2), ('C3', C_CH, C_MEL, 2), ('turn', TURN_CH, TURN_MEL, 0)]
total_bars = sum(len(s[1]) for s in SECTIONS)
LOOP = total_bars*BAR
LEN = int((LOOP + 6.0)*SR)
L = np.zeros(LEN); R = np.zeros(LEN); VERB = np.zeros((2, LEN))
def put(sig, t, pan=0.0, rev=0.2):
    i = int(t*SR); n = min(len(sig), LEN-i)
    if n <= 0: return
    gl = np.cos((pan+1)*np.pi/4); gr = np.sin((pan+1)*np.pi/4)
    L[i:i+n] += sig[:n]*gl; R[i:i+n] += sig[:n]*gr
    VERB[0, i:i+n] += sig[:n]*gl*rev; VERB[1, i:i+n] += sig[:n]*gr*rev

src = open(os.path.join(HERE, 'compose.py'), encoding='utf-8').read()
exec(src[src.index('def env('):src.index('# ---------------- 組み立て')], globals())

# ---------------- クリスマスの楽器 ----------------
def sleigh(t, vol=0.06, pan=0.45):
    """スレイベル（鈴）：高い金属の響き＋シャラッという粒"""
    n = int(0.35*SR); tt = np.arange(n)/SR
    nz = bp(rng.standard_normal(n), 5500, 12000)*np.exp(-tt*18)
    ring = sum(np.sin(2*np.pi*f*tt + rng.random()*6)*np.exp(-tt*d) for f, d in ((2730,22),(3950,26),(5210,30),(6470,34)))
    put((nz*0.9 + ring*0.25)*vol, t, pan, 0.25)
def celesta(midi, t, vol=0.07, pan=-0.3):
    f = hz(midi); n = int(1.6*SR); tt = np.arange(n)/SR
    sig = np.sin(2*np.pi*f*tt)*np.exp(-tt*2.2) + 0.35*np.sin(2*np.pi*4*f*tt)*np.exp(-tt*6) + 0.15*np.sin(2*np.pi*2*f*tt)*np.exp(-tt*3)
    put(sig*vol*np.minimum(1, tt/0.002), t, pan, 0.5)
def tones(ch, tr): return [x+tr for x in CHORD[ch]]
def wide(ch, tr):
    t = tones(ch, tr); mid = sorted(((x-60) % 12)+60 for x in t)
    return [t[0]-12] + mid + [mid[0]+12]

t0 = 0.0
for name, chords, mels, tr in SECTIONS:
    nb = len(chords)
    big = name in ('C', 'C2', 'C3')
    for b, ch in enumerate(chords):
        tb = t0 + b*BAR; v = wide(ch, tr); tt = tones(ch, tr); root = tt[0]; last = b == nb-1
        # 弦と合唱
        strings(v, tb, BAR, (0.07 if name == 'intro' else 0.1) * (1.25 if big else 1))
        if name in ('B', 'C', 'C2', 'C3', 'BR'): choir(v[1:4], tb, BAR, 0.06 if name in ('B','BR') else 0.09)
        # チェレスタのアルペジオ（雪がきらめく）
        arp = [tt[0]+24, tt[1]+24, tt[2]+24, tt[1]+24]
        for k in range(8): celesta(arp[k % 4] + (12 if k >= 4 and name == 'intro' else 0), tb + k*2*S16, 0.05 if name != 'intro' else 0.07, -0.4 if k % 2 else 0.4)
        if name == 'intro': continue
        # 行進のリズム：低音（ズン）と金管の刻み（チャッ）
        for k in range(4):
            bn = root - 12 if k % 2 == 0 else root - 5
            bass(bn if bn >= 33 else bn + 12, tb + k*4*S16, 3.4*S16, 0.3)
            if k % 2 == 1: brass([x+12 for x in v[1:4]], tb + k*4*S16, S16*2, 0.09 if big else 0.07)
        # 打楽器
        bigdrum(tb, 0.45 if big else 0.35); bigdrum(tb + 8*S16, 0.32)
        for k in (4, 12): snare(tb + k*S16, 0.22 if big else 0.17)
        for k in range(8): sleigh(tb + k*2*S16, 0.05 if k % 2 else 0.075)
        if big:
            for k in range(8): sleigh(tb + (k*2+1)*S16, 0.035, -0.4)
            if b % 2 == 0: crash(tb, 0.18)
            for k in (2, 6, 10, 14): glock(tt[(k//4) % 3] + 24, tb + k*S16, 0.05)
        if b == 0: timpani(root - 24 if root - 24 >= 36 else root - 12, tb, 0.5); crash(tb, 0.2)
        if last and name in ('A2', 'B', 'BR', 'C3'):
            for k in range(8, 16): snare(tb + k*S16, 0.05 + (k-8)*0.028)
            swell(tb, BAR, 0.09)
    # メロディ
    if mels:
        for b, bar in enumerate(mels):
            tt_ = t0 + b*BAR
            for nm, d in bar:
                mm = m(nm) + tr
                if name in ('A',): lead(mm, d*S16, tt_, 'soft'); celesta(mm + 12, tt_, 0.05)
                elif name in ('A2', 'turn'): lead(mm, d*S16, tt_, 'horn'); glock(mm + 12, tt_, 0.04)
                elif name in ('B', 'BR'): lead(mm, d*S16, tt_, 'soft'); lead(mm - 12, d*S16, tt_, 'horn')
                else: lead(mm, d*S16, tt_, 'brass'); lead(mm - 12, d*S16, tt_, 'horn'); glock(mm + 12, tt_, 0.035)
                tt_ += d*S16
    t0 += nb*BAR

ir_n = int(3.4*SR); tt = np.arange(ir_n)/SR
ir = [lp(rng.standard_normal(ir_n), 6000)*np.exp(-tt*2.0)*(1 - np.exp(-tt*60)) for _ in range(2)]
L += fftconvolve(VERB[0], ir[0])[:LEN]*0.075; R += fftconvolve(VERB[1], ir[1])[:LEN]*0.075
mix = np.stack([L, R], 1)
loopN = int(round(LOOP*SR)); tail = mix[loopN:]; mix = mix[:loopN].copy(); mix[:len(tail)] += tail   # 余韻を頭に重ねて、切れ目なくループ
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix*1.6)/np.tanh(1.6)
mix *= 0.93
wav = os.path.join(HERE, 'xmas.wav')
wavfile.write(wav, SR, (mix*32767).astype(np.int16))
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-b:a', '192k', os.path.join(HERE, 'xmas.mp3')], check=True)
print(f'done: {total_bars} bars, loop {LOOP:.4f} s')
