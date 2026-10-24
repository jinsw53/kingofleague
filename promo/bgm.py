import numpy as np, wave, sys
dur=float(sys.argv[1]); out=sys.argv[2]; seed=int(sys.argv[3])
sr=44100; n=int(sr*dur); bpm=124; beat=60/bpm
x=np.zeros(n)
rng=np.random.default_rng(seed)
def add(t0,sig,g=1.0):
    i=int(t0*sr)
    if i>=n: return
    s=sig[:n-i]; x[i:i+len(s)]+=s*g
def env(L,a=.005,d=.15):
    t=np.arange(L)/sr; return np.minimum(t/a,1)*np.exp(-t/d)
def pluck(f,L=.35):
    L=int(sr*L); t=np.arange(L)/sr
    return (np.sign(np.sin(2*np.pi*f*t))*.5+np.sin(2*np.pi*f*2*t)*.3)*env(L,.003,.12)
def bass(f,L=.45):
    L=int(sr*L); t=np.arange(L)/sr
    return np.sin(2*np.pi*f*t)*env(L,.005,.3)
def kick():
    L=int(sr*.25); t=np.arange(L)/sr
    f=120*np.exp(-t*25)+45
    return np.sin(2*np.pi*np.cumsum(f)/sr)*np.exp(-t*12)
def hat():
    L=int(sr*.05); return rng.standard_normal(L)*np.exp(-np.arange(L)/sr*90)*.3
def clap():
    L=int(sr*.18); return rng.standard_normal(L)*np.exp(-np.arange(L)/sr*28)*.5
mid=lambda m:440*2**((m-69)/12)
prog=[(57,[69,72,76,81]),(53,[65,69,72,77]),(48,[72,76,79,84]),(55,[67,71,74,79])]  # Am F C G
bars=int(dur/(beat*4))+1
for b in range(bars):
    r,ch=prog[b%4]
    for k in range(16):
        t=b*beat*4+k*beat/4
        add(t,pluck(mid(ch[(k*3 if k%2 else k)%4]+(12 if k%8>=4 else 0)),.3),.22)
    for k in range(4):
        t=b*beat*4+k*beat
        add(t,kick(),.9)
        add(t+beat/2,hat(),.5)
        if k%2==1: add(t,clap(),.45)
    for k in range(8):
        add(b*beat*4+k*beat/2,bass(mid(r-12)),.5)
x*=np.minimum(1,np.arange(n)/(sr*.3))
fade=int(sr*1.5); x[-fade:]*=np.linspace(1,0,fade)
x=np.tanh(x*1.2)*.5
w=wave.open(out,'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
w.writeframes((x*32767).astype(np.int16).tobytes()); w.close()
