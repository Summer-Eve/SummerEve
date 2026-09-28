"""Original procedural score and foley; no external recordings or song melodies.
Run with Python + numpy. Output browser-compatible mono 22.05 kHz PCM WAV.
"""
from pathlib import Path
import wave
import numpy as np

RATE = 22050
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'audio'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(20260928)

def save(name, x, peak):
    x = x / max(np.max(np.abs(x)), 1e-9) * peak
    with wave.open(str(OUT / name), 'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(RATE)
        f.writeframes((x * 32767).astype('<i2').tobytes())
    print(f'{name}: {len(x)/RATE:.2f}s, {(OUT/name).stat().st_size/1024:.0f} KiB')

def tone(midi, duration, kind):
    t = np.arange(int(duration * RATE)) / RATE
    hz = 440 * 2 ** ((midi - 69) / 12)
    if kind == 'pluck':
        x = sum((1/k**1.6) * np.sin(2*np.pi*hz*k*t + .025*k) * np.exp(-t*(1.25+.43*k)) for k in range(1, 10))
        x *= 1-np.exp(-t*500)
    elif kind == 'flute':
        phase = 2*np.pi*hz*t + .032*np.sin(2*np.pi*4.8*t)*(1-np.exp(-t*2))
        x = np.sin(phase) + .14*np.sin(2*phase) + .045*np.sin(3*phase)
        x *= np.minimum(t/.16, 1) * np.clip((duration-t)/.32, 0, 1) * (.9+.1*np.sin(np.pi*t/duration))
    else:
        x = .7*np.sin(2*np.pi*hz*t)+.15*np.sin(2*np.pi*hz*1.003*t)+.12*np.sin(2*np.pi*hz*2*t)
        x *= np.minimum(t/.65, 1)*np.clip((duration-t)/.9, 0, 1)
    x *= np.clip((duration-t)/.03, 0, 1)
    return x

# 24 bars at 80 BPM: opening, recurring theme, lift, quiet return (72 seconds).
beat = .75
music = np.zeros(int(72*RATE))
def add_loop(at, signal, gain):
    indices = (int(at*RATE) + np.arange(len(signal))) % len(music)
    np.add.at(music, indices, signal*gain)

roots = [50, 46, 53, 48, 50, 46, 48, 50] * 3
motifs = [
 [(0,74,1.3),(1.5,77,.7),(2.5,79,1.2)],
 [(0,81,1.8),(2,79,.8),(3,77,.8)],
 [(0,74,1.1),(1.5,72,.7),(2.5,69,1.3)],
 [(0,72,2.2),(2.5,74,1.2)],
 [(0,77,1.1),(1.5,79,.8),(2.5,81,1.2)],
 [(0,84,1.7),(2,81,.8),(3,79,.7)],
 [(0,77,1.4),(1.5,74,.9),(3,72,.7)],
 [(0,74,2.6)]
]
for bar, root in enumerate(roots):
    start = bar*4*beat
    level = .74 if bar < 4 or bar >= 20 else 1
    add_loop(start, tone(root-12, 3.8, 'pad'), .065*level)
    add_loop(start, tone(root+7, 3.5, 'pad'), .025*level)
    for j, offset in enumerate([0,7,12,19,12,7]):
        add_loop(start+j*.5*beat, tone(root+offset, 2.6, 'pluck'), (.11 if j==0 else .065)*level)
    if bar >= 4:
        for b, note, length in motifs[(bar-4)%8]:
            octave = 0 if bar < 20 else -12
            add_loop(start+b*beat, tone(note+octave, length*beat, 'flute'), .105*level)
    if 12 <= bar < 20:
        add_loop(start+3.5*beat, tone(root+24, 2, 'pluck'), .055)
dry=music.copy()
for delay, gain in [(.097,.12),(.173,.1),(.277,.085),(.419,.065),(.683,.04),(.947,.025)]:
    music += np.roll(dry, int(delay*RATE))*gain
save('courtyard-story-v1.wav', music, .72)

# Several paper flex / leaf-turn swishes, with gentle contacts rather than white-noise hiss.
pages=np.zeros(int(2.4*RATE))
for at, dur, amp in [(0,.49,.72),(.38,.57,.85),(.87,.5,.78),(1.3,.6,.9),(1.82,.55,.65)]:
    n=int(dur*RATE); t=np.arange(n)/RATE
    noise=rng.standard_normal(n)
    smooth=np.convolve(noise,np.ones(7)/7,mode='same')
    band=smooth-np.convolve(smooth,np.ones(90)/90,mode='same')
    env=np.sin(np.pi*t/dur)**1.5
    flutter=.55+.45*np.sin(2*np.pi*(17*t+9*t*t))**2
    sound=band*env*flutter*amp
    tap=.025*np.sin(2*np.pi*430*t)*np.exp(-t*60)
    i=int(at*RATE); end=min(i+n,len(pages));pages[i:end]+=(sound+tap)[:end-i]
pages[-int(.05*RATE):]*=np.linspace(1,0,int(.05*RATE))
save('pages-turn-v1.wav', pages, .76)

# Single dry wood-on-wood contact with short resonant body and one-second decay window.
t=np.arange(RATE)/RATE
wood=sum(a*np.sin(2*np.pi*f*t)*np.exp(-t/d) for f,a,d in [(205,.62,.09),(437,.43,.047),(821,.22,.023),(1367,.1,.012)])
wood+=rng.standard_normal(RATE)*.3*np.exp(-t/.006)
wood*=np.minimum(t/.0007,1)
wood+=np.roll(wood,int(.034*RATE))*.07
wood[-220:]*=np.linspace(1,0,220)
save('scroll-wood-v1.wav', wood, .83)
