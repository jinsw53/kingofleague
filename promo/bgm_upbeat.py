# usage: python3 bgm_upbeat.py dur out.wav -- 신나는 하우스풍, 고음 줄여서 효과음·목소리 자리 확보
import sys, wave
import numpy as np
dur = float(sys.argv[1]); out = sys.argv[2]
sr = 44100; n = int(sr * dur); bpm = 116; beat = 60 / bpm; bar = beat * 4
rng = np.random.default_rng(3)
mid = lambda m: 440 * 2 ** ((m - 69) / 12)
prog = [(36, [60, 64, 67]), (43, [59, 62, 67]), (45, [57, 60, 64]), (41, [57, 60, 65])]   # C G Am F
x = np.zeros(n); duck = np.ones(n)
def add(t0, s, g, arr=None):
    a = x if arr is None else arr
    i = int(t0 * sr)
    if 0 <= i < n: s = s[:n - i]; a[i:i + len(s)] += s * g
def kick():
    L = int(sr * .28); t = np.arange(L) / sr
    return np.sin(2 * np.pi * np.cumsum(110 * np.exp(-t * 28) + 46) / sr) * np.exp(-t * 11)
def clap():
    L = int(sr * .2); t = np.arange(L) / sr
    return rng.standard_normal(L) * np.exp(-t * 26)
def hat():
    L = int(sr * .05); return rng.standard_normal(L) * np.exp(-np.arange(L) / sr * 100)
def tone(f, L, a=.004, d=.2, sq=.0):
    Ls = int(sr * L); t = np.arange(Ls) / sr
    w = np.sin(2 * np.pi * f * t) + sq * np.sign(np.sin(2 * np.pi * f * t))
    return w * np.minimum(t / a, 1) * np.exp(-t / d)
for b in range(int(dur / bar) + 2):
    r, ch = prog[b % 4]; t0 = b * bar
    for k in range(4):
        tk = t0 + k * beat
        add(tk, kick(), 1.0)
        i = int(tk * sr); duck[i:i + int(sr * .22)] *= np.linspace(.45, 1, min(int(sr * .22), n - i)) if i < n else 1
        if k % 2 == 1: add(tk, clap(), .35)
        add(tk + beat / 2, hat(), .22)
        add(tk + beat / 2, tone(mid(r), beat * .45, .005, .16, .15), .8)       # 오프비트 베이스
        add(tk + beat / 2, sum(tone(mid(m), .18, .003, .07, .25) for m in ch), .16)  # 스탭 코드
    for k, m in enumerate([ch[2] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24]):        # 가벼운 아르페지오
        add(t0 + k * beat, tone(mid(m), .5, .003, .14), .16)
# 패드(킥에 맞춰 눌림)
pad = np.zeros(n)
for b in range(int(dur / bar) + 2):
    r, ch = prog[b % 4]; t0 = b * bar; L = int(sr * (bar + .3)); t = np.arange(L) / sr
    e = np.minimum(t / .3, 1) * np.minimum((bar + .3 - t) / .3, 1)
    add(t0, sum(np.sin(2 * np.pi * mid(m) * t) for m in ch) * e, .08, pad)
x = x + pad * duck
S = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / sr); S[f > 4500] *= np.exp(-(f[f > 4500] - 4500) / 1500); x = np.fft.irfft(S, n)
x *= np.minimum(np.arange(n) / (sr * .5), 1)
fd = int(sr * 1.6); x[-fd:] *= np.linspace(1, 0, fd)
x = np.tanh(x * 1.1) * .6
w = wave.open(out, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
w.writeframes((x * 32767).astype(np.int16).tobytes()); w.close()
