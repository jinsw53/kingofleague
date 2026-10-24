# usage: python3 bgm_epic.py dur out.wav -- 시네마틱 메탈: 스트링·리드 멜로디·필인·라이저, 인트로→전개→클라이맥스, 스테레오
import sys, wave
import numpy as np
dur = float(sys.argv[1]); out = sys.argv[2]
sr = 44100; n = int(sr * dur); bpm = 144; beat = 60 / bpm; step = beat / 4; bar = beat * 4
rng = np.random.default_rng(5)
mid = lambda m: 440 * 2 ** ((m - 69) / 12)
roots = [40, 36, 38, 35]
chords = [[64, 67, 71, 76], [60, 64, 67, 72], [62, 66, 69, 74], [59, 63, 66, 71]]   # Em C D B(장3화음)
lead_notes = [(76, 79), (79, 76), (78, 74), (75, 71)]
pat = [[1,1,1,0,1,1,0,1, 1,1,0,1,2,0,0,0],
       [1,1,1,0,1,1,3,1, 1,1,0,1,1,1,2,0]]
nb = int(dur / bar) + 2
def sect(b):   # 0 인트로, 1 전개, 2 빌드, 3 클라이맥스
    return 0 if b < 4 else 1 if b < 10 else 2 if b < 14 else 3
L_, R_, D_ = np.zeros(n), np.zeros(n), np.zeros(n)
def put(a, t0, s, g):
    i = int(t0 * sr)
    if 0 <= i < n: s = s[:n - i]; a[i:i + len(s)] += s * g
saw = lambda f, t: 2 * ((f * t) % 1) - 1
def gchord(root, L, decay, third, det):
    Ls = int(sr * L); t = np.arange(Ls) / sr
    s = sum(saw(mid(m) * det, t) for m in [root, root + (3 if third else 7), root + 12])
    return np.tanh(s * 1.6) * np.minimum(t / .003, 1) * np.exp(-t / decay)
def kick():
    L = int(sr * .14); t = np.arange(L) / sr
    return np.sin(2 * np.pi * np.cumsum(90 * np.exp(-t * 40) + 55) / sr) * np.exp(-t * 22) + rng.standard_normal(L) * np.exp(-t * 90) * .15
def snare():
    L = int(sr * .22); t = np.arange(L) / sr
    return (rng.standard_normal(L) * .8 + np.sin(2 * np.pi * 190 * t)) * np.exp(-t * 20)
def tom(f):
    L = int(sr * .3); t = np.arange(L) / sr
    return np.sin(2 * np.pi * np.cumsum(f * (1 + .6 * np.exp(-t * 18))) / sr) * np.exp(-t * 11)
def hat(): L = int(sr * .05); return rng.standard_normal(L) * np.exp(-np.arange(L) / sr * 110)
def crash(): L = int(sr * 1.6); t = np.arange(L) / sr; return rng.standard_normal(L) * np.exp(-t * 2.6)
def riser(Ls):
    L = int(sr * Ls); t = np.arange(L) / sr; k = t / Ls
    return rng.standard_normal(L) * k ** 2 * np.sin(2 * np.pi * (200 + 1800 * k) * t) * .8
def strings(notes, Ls, det):
    L = int(sr * Ls); t = np.arange(L) / sr
    e = np.minimum(t / .5, 1) * np.minimum((Ls - t) / .35, 1)
    return sum(saw(mid(m) * det, t) + saw(mid(m) * det * 1.004, t) for m in notes) * e
def lead(m, Ls):
    L = int(sr * Ls); t = np.arange(L) / sr
    f = mid(m) * (1 + .006 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(t / .3, 1))
    ph = np.cumsum(f) / sr
    s = np.tanh(2.2 * (2 * (ph % 1) - 1 + .4 * np.sign(np.sin(2 * np.pi * ph))))
    return s * np.minimum(t / .02, 1) * np.minimum((Ls - t) / .08, 1) * (.6 + .4 * np.exp(-t * 2))
for b in range(nb):
    r = roots[b % 4]; p = pat[(b // 2) % 2]; t0 = b * bar; sc = sect(b)
    ch = chords[b % 4]
    # 스트링 패드(전 구간) — 좌우로 살짝 시차
    sg = strings(ch, bar + .35, 1.0)
    put(L_, t0, sg, .035); put(R_, t0 + .012, sg, .035)
    if sc == 3: sh = strings([m + 12 for m in ch], bar + .35, 1.0); put(L_, t0, sh, .02); put(R_, t0 + .01, sh, .02)
    # 기타 리프
    if sc >= 1 or b >= 2:
        for k, v in enumerate(p):
            if sc == 0 and k % 4: continue          # 인트로는 박마다 한 번
            ts = t0 + k * step
            if v:
                a = (.16, .05) if v != 2 else (.9, .4)
                put(L_, ts, gchord(r + 12, a[0], a[1], v == 3, .996), 1.0)
                put(R_, ts, gchord(r + 12, a[0], a[1], v == 3, 1.004), 1.0)
                if sc >= 1: put(D_, ts, kick(), 1.0)
    # 드럼
    if sc >= 1:
        for k in range(16):
            ts = t0 + k * step
            if k in (4, 12): put(D_, ts, snare(), .9)
            if k % 2 == 0: put(D_, ts, hat(), .25)
    if b % 4 == 0 and b > 0: put(D_, t0, crash(), .5)
    if b == 0: put(D_, t0, kick(), 1.0)
    # 4마디마다 탐 필인 + 라이저
    if b % 4 == 3:
        for k, f in enumerate([180, 150, 120, 100]): put(D_, t0 + (12 + k) * step, tom(f), .8)
        put(L_, t0 + bar / 2, riser(bar / 2), .35); put(R_, t0 + bar / 2, riser(bar / 2), .35)
    # 리드 멜로디(전개 후반부부터)
    if sc >= 2 or (sc == 1 and b >= 8):
        for h, m in enumerate(lead_notes[b % 4]):
            lg = lead(m, bar / 2 - .02); put(L_, t0 + h * bar / 2, lg, .12); put(R_, t0 + h * bar / 2 + .009, lg, .12)
            if sc == 3: lh = lead(m + 12, bar / 2 - .02); put(L_, t0 + h * bar / 2, lh, .05); put(R_, t0 + h * bar / 2, lh, .05)
# 기타 중음 스쿱 / 고음 컷
f = np.fft.rfftfreq(n, 1 / sr)
def eq(x):
    S = np.fft.rfft(x); S[(f > 1200) & (f < 3200)] *= .55; S[f > 6000] *= np.exp(-(f[f > 6000] - 6000) / 1500); return np.fft.irfft(S, n)
L_, R_ = eq(L_), eq(R_)
L = L_ * .55 + D_ * .8; R = R_ * .55 + D_ * .8
env = np.minimum(np.arange(n) / (sr * .4), 1); fd = int(sr * 1.6); env[-fd:] *= np.linspace(1, 0, fd)
st = np.tanh(np.stack([L * env, R * env], 1) * 1.1) * .6
w = wave.open(out, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
w.writeframes((st * 32767).astype(np.int16).tobytes()); w.close()
