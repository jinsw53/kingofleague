# usage: python3 bgm_calm.py dur out.wav  -- soft pad, no drums
import sys, wave
import numpy as np
dur = float(sys.argv[1]); out = sys.argv[2]
sr = 44100; n = int(sr * dur); bpm = 84; beat = 60 / bpm; bar = beat * 4
x = np.zeros(n); mid = lambda m: 440 * 2 ** ((m - 69) / 12)
prog = [(45, [57, 60, 64, 67]), (41, [53, 57, 60, 64]), (48, [55, 60, 64, 67]), (43, [55, 59, 62, 67])]
def add(t0, s, g):
    i = int(t0 * sr)
    if i < n: s = s[:n - i]; x[i:i + len(s)] += s * g
for b in range(int(dur / bar) + 2):
    r, ch = prog[b % 4]; t0 = b * bar
    L = int(sr * (bar + .8)); t = np.arange(L) / sr
    e = np.minimum(t / .7, 1) * np.minimum((bar + .8 - t) / .8, 1)
    pad = sum(np.sin(2 * np.pi * mid(m) * t) + .35 * np.sin(4 * np.pi * mid(m) * t) for m in ch) * e
    add(t0, pad, .09)
    Lb = int(sr * bar); tb = np.arange(Lb) / sr
    add(t0, np.sin(2 * np.pi * mid(r) * tb) * np.minimum(tb / .05, 1) * np.exp(-tb * .6), .32)
    for k, m in enumerate([ch[2] + 12, ch[3] + 12]):
        Lk = int(sr * 1.4); tk = np.arange(Lk) / sr
        add(t0 + (k * 2 + 1) * beat, np.sin(2 * np.pi * mid(m) * tk) * np.exp(-tk * 3.2), .07)
d = int(sr * .24); y = x.copy(); y[d:] += x[:-d] * .28
x = y * np.minimum(np.arange(n) / (sr * 1.0), 1)
f = int(sr * 1.8); x[-f:] *= np.linspace(1, 0, f)
x = np.tanh(x * 1.4) * .6
w = wave.open(out, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
w.writeframes((x * 32767).astype(np.int16).tobytes()); w.close()
