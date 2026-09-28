"""Prepare the two user-supplied Mixkit reference recordings for the game.

Usage: python scripts/import_reference_foley.py PAGE_WAV WOOD_WAV
The background music and earlier foley versions are not modified.
"""

from pathlib import Path
import sys
import wave

import numpy as np


OUT = Path(__file__).resolve().parents[1] / "assets" / "audio"


def load_mono(path):
    with wave.open(str(path), "rb") as source:
        channels = source.getnchannels()
        rate = source.getframerate()
        if source.getsampwidth() != 2 or channels not in (1, 2):
            raise ValueError(f"Expected 16-bit mono/stereo PCM WAV: {path}")
        samples = np.frombuffer(source.readframes(source.getnframes()), dtype="<i2")
    return rate, samples.reshape(-1, channels).astype(np.float64).mean(axis=1)


def save(path, rate, samples):
    pcm = np.clip(np.rint(samples), -32768, 32767).astype("<i2")
    with wave.open(str(OUT / path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(rate)
        output.writeframes(pcm.tobytes())
    print(f"{path}: {len(pcm) / rate:.3f}s, {rate} Hz, mono")


def main(page_path, wood_path):
    page_rate, pages = load_mono(page_path)
    if not 2 <= len(pages) / page_rate <= 3:
        raise ValueError("Page-turn reference must fit the 2–3 second opening cue")
    save("pages-turn-v3.wav", page_rate, pages)

    wood_rate, wood = load_mono(wood_path)
    if len(wood) > wood_rate:
        raise ValueError("Wood-hit reference exceeds the one-second closing cue")
    # Keep the supplied impact intact; its natural decay ends before the cue does.
    wood = np.pad(wood, (0, wood_rate - len(wood)))
    save("scroll-wood-v3.wav", wood_rate, wood)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(Path(sys.argv[1]), Path(sys.argv[2]))
