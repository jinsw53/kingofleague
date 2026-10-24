# usage: python3 sfx.py events.json dur out.wav
import json, sys, wave
import numpy as np
sr = 44100
ev = json.load(open(sys.argv[1])); dur = float(sys.argv[2]); out = sys.argv[3]
MIN_GAP = .6
n = int(sr * dur); x = np.zeros(n)
rng = np.random.default_rng(7)

def band(sig, lo, hi):
    S = np.fft.rfft(sig); f = np.fft.rfftfreq(len(sig), 1 / sr)
    S[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(S, len(sig))

def add(t, s, g):
    i = int(max(0, t) * sr)
    if i >= n: return
    s = s[:n - i]; x[i:i + len(s)] += s * g

def env(L, a, d):
    t = np.arange(L) / sr
    return np.minimum(t / a, 1) * np.exp(-t / d)

def whoosh():
    L = int(sr * .5); nz = rng.standard_normal(L)
    b1, b2, b3 = band(nz, 150, 700), band(nz, 600, 2500), band(nz, 2000, 7000)
    k = np.linspace(0, 1, L)
    s = b1 * np.clip(1 - k * 2.2, 0, 1) + b2 * np.clip(1 - abs(k - .45) * 3, 0, 1) + b3 * np.clip(k * 2.2 - .9, 0, 1)
    e = np.sin(np.pi * k) ** 2
    return s / (np.abs(s).max() + 1e-9) * e

def pop(f0=520, f1=1100):
    L = int(sr * .16); t = np.arange(L) / sr
    f = f0 + (f1 - f0) * (1 - np.exp(-t * 35))
    s = np.sin(2 * np.pi * np.cumsum(f) / sr) + .3 * np.sin(4 * np.pi * np.cumsum(f) / sr)
    return s * env(L, .002, .05)

def tick(f=780, bright=1.0):
    L = int(sr * .14); t = np.arange(L) / sr
    nz = band(rng.standard_normal(L), 2500, 8000) * env(L, .002, .025) * .6 * bright
    return nz + np.sin(2 * np.pi * f * t) * env(L, .002, .04) * .55

def thump():
    L = int(sr * .7); t = np.arange(L) / sr
    f = 48 + 90 * np.exp(-t * 14)
    s = np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-t * 5)
    sh = band(rng.standard_normal(L), 5000, 12000) * np.exp(-t * 8) * .25
    return s + sh

def chime(base=880):
    L = int(sr * 1.0); t = np.arange(L) / sr; s = np.zeros(L)
    for j, m in enumerate([1, 1.25, 1.5, 2]):
        d = int(sr * .07 * j); ss = np.sin(2 * np.pi * base * m * t[:L - d]) * np.exp(-t[:L - d] * 5)
        s[d:] += ss * .5
    return s

cnt = 0; last_any = -9; last_scene = -9
for e in sorted(ev, key=lambda v: v['t']):
    k, t = e['k'], e['t']
    if k == 'scene':
        add(t - .12, whoosh(), .55); last_scene = t; cnt += 1; continue
    if k == 'logo':
        add(t, thump(), .9); add(t + .08, chime(988), .35); last_any = t; cnt += 1; continue
    # 장면 전환음이 겹치는 구간과, 직전 소리와 너무 가까운 소리는 생략
    if t - last_scene < .3 or t - last_any < MIN_GAP: continue
    last_any = t; cnt += 1
    if k in ('pop', 'spin'): add(t + .03, pop(480 + (cnt % 4) * 80, 1000 + (cnt % 4) * 100), .5)
    elif k == 'left': add(t + .03, tick(700, 1.0), .5)
    elif k == 'right': add(t + .03, tick(860, 1.0), .5)
    else: add(t + .03, tick(1020, .8), .42)
x = np.tanh(x * 1.1)
w = wave.open(out, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
w.writeframes((x * .9 * 32767).astype(np.int16).tobytes()); w.close()
print('events used', cnt)
