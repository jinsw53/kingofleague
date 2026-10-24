# usage: python3 bgm_metal.py dur out.wav -- 팜뮤트 파워코드 리프 + 더블 킥 (메탈풍, 중음 스쿱으로 목소리·효과음 자리 확보)
import sys, wave
import numpy as np
dur = float(sys.argv[1]); out = sys.argv[2]
sr = 44100; n = int(sr * dur); bpm = 144; beat = 60 / bpm; step = beat / 4; bar = beat * 4
rng = np.random.default_rng(11)
mid = lambda m: 440 * 2 ** ((m - 69) / 12)
roots = [40, 36, 38, 35]   # E C D B (낮은 음)
# 한 마디 16스텝: 0 쉼 / 1 팜뮤트 / 2 길게 울리는 파워코드 / 3 단3도 치기
pat = [[1,1,1,0,1,1,0,1, 1,1,0,1,2,0,0,0],
       [1,1,1,0,1,1,3,1, 1,1,0,1,1,1,2,0]]
gtr = np.zeros(n); drm = np.zeros(n)
def add(a, t0, s, g):
    i = int(t0 * sr)
    if 0 <= i < n: s = s[:n - i]; a[i:i + len(s)] += s * g
def saw(f, t): return 2 * ((f * t) % 1) - 1
def chord(root, L, decay, third=False):
    Ls = int(sr * L); t = np.arange(Ls) / sr
    notes = [root, root + (3 if third else 7), root + 12]
    s = sum(saw(mid(m) * 1.003, t) + saw(mid(m) * .997, t) for m in notes)
    s = np.tanh(s * 3.2)                                   # 디스토션
    return s * np.minimum(t / .003, 1) * np.exp(-t / decay)
def kick():
    L = int(sr * .14); t = np.arange(L) / sr
    return np.sin(2 * np.pi * np.cumsum(90 * np.exp(-t * 40) + 55) / sr) * np.exp(-t * 22) + rng.standard_normal(L) * np.exp(-t * 90) * .15
def snare():
    L = int(sr * .22); t = np.arange(L) / sr
    return (rng.standard_normal(L) * .8 + np.sin(2 * np.pi * 190 * t)) * np.exp(-t * 20)
def hat(): L = int(sr * .05); return rng.standard_normal(L) * np.exp(-np.arange(L) / sr * 110)
def crash():
    L = int(sr * 1.3); t = np.arange(L) / sr; return rng.standard_normal(L) * np.exp(-t * 3.2)
for b in range(int(dur / bar) + 2):
    r = roots[b % 4]; p = pat[(b // 2) % 2]; t0 = b * bar
    for k, v in enumerate(p):
        ts = t0 + k * step
        if v == 1: add(gtr, ts, chord(r + 12, .16, .05), 1.0)
        elif v == 2: add(gtr, ts, chord(r + 12, .9, .4), 1.1)
        elif v == 3: add(gtr, ts, chord(r + 12, .16, .05, True), 1.0)
        if v in (1, 2, 3): add(drm, ts, kick(), 1.0)       # 더블 킥이 기타를 따라감
        if k in (4, 12): add(drm, ts, snare(), .9)
        if k % 2 == 0: add(drm, ts, hat(), .25)
    if b % 4 == 0: add(drm, t0, crash(), .45)
# 중음 스쿱(1.2~3.5kHz)과 고음 컷 → 보컬·효과음 대역 확보
S = np.fft.rfft(gtr); f = np.fft.rfftfreq(n, 1 / sr)
S[(f > 1200) & (f < 3500)] *= .35; S[f > 5500] *= np.exp(-(f[f > 5500] - 5500) / 1500)
gtr = np.fft.irfft(S, n)
x = gtr * .55 + drm * .8
x *= np.minimum(np.arange(n) / (sr * .4), 1)
fd = int(sr * 1.4); x[-fd:] *= np.linspace(1, 0, fd)
x = np.tanh(x * 1.1) * .6
w = wave.open(out, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
w.writeframes((x * 32767).astype(np.int16).tobytes()); w.close()
