from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path


SAMPLE_RATE = 22050
RNG = random.Random(42)
ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / "assets" / "audio"


def midi_to_freq(note: int) -> float:
    return 440.0 * (2.0 ** ((note - 69) / 12.0))


def clamp(value: float, minimum: float = -1.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def envelope(t: float, duration: float, attack: float, release: float, sustain: float = 1.0) -> float:
    if t < 0.0 or t > duration:
        return 0.0

    if attack > 0.0 and t < attack:
        return t / attack

    if release > 0.0 and t > duration - release:
        return max(0.0, (duration - t) / release) * sustain

    return sustain


def osc(phase: float, waveform: str) -> float:
    cycle = (phase / (math.pi * 2.0)) % 1.0
    if waveform == "sine":
        return math.sin(phase)
    if waveform == "triangle":
        return 2.0 * abs(2.0 * cycle - 1.0) - 1.0
    if waveform == "square":
        return 1.0 if math.sin(phase) >= 0.0 else -1.0
    if waveform == "softsquare":
        return math.tanh(math.sin(phase) * 2.8)
    return 2.0 * cycle - 1.0


def add_note(
    buffer: list[float],
    start: float,
    duration: float,
    freq: float,
    amp: float,
    waveform: str = "sine",
    attack: float = 0.01,
    release: float = 0.08,
    vibrato_depth: float = 0.0,
    vibrato_rate: float = 0.0,
    detune: tuple[float, ...] = (),
    noise_amount: float = 0.0,
) -> None:
    start_index = max(0, int(start * SAMPLE_RATE))
    length = max(1, int(duration * SAMPLE_RATE))
    detuned = (0.0,) + detune

    for offset in range(length):
        index = start_index + offset
        if index >= len(buffer):
            break

        t = offset / SAMPLE_RATE
        env = envelope(t, duration, attack, release)
        if env <= 0.0:
            continue

        value = 0.0
        for cents in detuned:
            freq_mod = freq * (2.0 ** (cents / 1200.0))
            if vibrato_depth and vibrato_rate:
                freq_mod *= 1.0 + vibrato_depth * math.sin(math.pi * 2.0 * vibrato_rate * t)
            phase = math.pi * 2.0 * freq_mod * t
            value += osc(phase, waveform)

        value /= len(detuned)
        if noise_amount:
            value += RNG.uniform(-1.0, 1.0) * noise_amount

        buffer[index] += value * amp * env


def add_kick(buffer: list[float], start: float, amp: float = 1.0) -> None:
    start_index = int(start * SAMPLE_RATE)
    length = int(0.36 * SAMPLE_RATE)
    for offset in range(length):
        index = start_index + offset
        if index >= len(buffer):
            break
        t = offset / SAMPLE_RATE
        env = math.exp(-8.5 * t)
        freq = 148.0 - 112.0 * min(1.0, t / 0.18)
        phase = math.pi * 2.0 * freq * t + 18.0 * math.exp(-14.0 * t)
        click = math.exp(-150.0 * t) * 0.45
        buffer[index] += (math.sin(phase) * env + click) * amp


def add_snare(buffer: list[float], start: float, amp: float = 0.8) -> None:
    start_index = int(start * SAMPLE_RATE)
    length = int(0.22 * SAMPLE_RATE)
    for offset in range(length):
        index = start_index + offset
        if index >= len(buffer):
            break
        t = offset / SAMPLE_RATE
        env = math.exp(-20.0 * t)
        noise = RNG.uniform(-1.0, 1.0) * env
        body = math.sin(math.pi * 2.0 * 180.0 * t) * math.exp(-12.0 * t) * 0.45
        buffer[index] += (noise * 0.7 + body) * amp


def add_hat(buffer: list[float], start: float, amp: float = 0.35) -> None:
    start_index = int(start * SAMPLE_RATE)
    length = int(0.08 * SAMPLE_RATE)
    last_noise = 0.0
    for offset in range(length):
        index = start_index + offset
        if index >= len(buffer):
            break
        t = offset / SAMPLE_RATE
        env = math.exp(-42.0 * t)
        noise = RNG.uniform(-1.0, 1.0)
        high_pass = noise - last_noise * 0.65
        last_noise = noise
        buffer[index] += high_pass * env * amp


def normalize(buffer: list[float], peak: float = 0.92) -> list[float]:
    current_peak = max(abs(value) for value in buffer) or 1.0
    scale = peak / current_peak
    return [clamp(value * scale) for value in buffer]


def write_wav(path: Path, samples: list[float]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = b"".join(struct.pack("<h", int(clamp(sample) * 32767.0)) for sample in samples)
    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(SAMPLE_RATE)
        wav_file.writeframes(pcm)


def render_bgm() -> list[float]:
    tempo = 132
    beat = 60.0 / tempo
    bar = beat * 4.0
    total_bars = 16
    duration = bar * total_bars
    buffer = [0.0] * int(duration * SAMPLE_RATE)

    chords = [
        [52, 55, 59, 62],
        [48, 52, 55, 59],
        [55, 59, 62, 67],
        [50, 57, 62, 64],
    ]
    lead_patterns = [
        [0, 2, 1, 3, 2, 1, 0, 2],
        [1, 2, 3, 2, 1, 0, 1, 3],
        [0, 1, 2, 4, 2, 1, 3, 2],
        [3, 2, 1, 0, 1, 2, 3, 1],
    ]

    for bar_index in range(total_bars):
        chord = chords[bar_index % len(chords)]
        pattern = lead_patterns[bar_index % len(lead_patterns)]
        start = bar_index * bar

        for note in chord:
            add_note(
                buffer,
                start,
                bar,
                midi_to_freq(note + 12),
                amp=0.075,
                waveform="saw",
                attack=0.12,
                release=0.14,
                detune=(-7.0, 7.0),
            )

        root = chord[0]
        for beat_index in range(4):
            note = root if beat_index in (0, 2) else root + 7
            add_note(
                buffer,
                start + beat * beat_index,
                beat * 0.88,
                midi_to_freq(note - 12),
                amp=0.18,
                waveform="softsquare",
                attack=0.005,
                release=0.1,
            )

        for step in range(8):
            note = chord[pattern[step] % len(chord)] + 12 + (12 if step in (3, 7) else 0)
            add_note(
                buffer,
                start + step * beat * 0.5,
                beat * 0.42,
                midi_to_freq(note),
                amp=0.13,
                waveform="triangle",
                attack=0.004,
                release=0.07,
                vibrato_depth=0.003,
                vibrato_rate=5.4,
                detune=(-4.0, 4.0),
            )

        add_kick(buffer, start + beat * 0.0, 0.62)
        add_kick(buffer, start + beat * 1.5, 0.42)
        add_kick(buffer, start + beat * 2.0, 0.58)
        add_kick(buffer, start + beat * 3.25, 0.36)
        add_snare(buffer, start + beat * 1.0, 0.34)
        add_snare(buffer, start + beat * 3.0, 0.4)

        for step in range(8):
            add_hat(buffer, start + step * beat * 0.5, 0.15 if step % 2 == 0 else 0.09)

    return normalize(buffer, 0.94)


def render_shot() -> list[float]:
    duration = 0.17
    buffer = [0.0] * int(duration * SAMPLE_RATE)
    for i in range(len(buffer)):
        t = i / SAMPLE_RATE
        env = envelope(t, duration, 0.002, 0.1)
        freq = 960.0 - 510.0 * (t / duration)
        phase = math.pi * 2.0 * freq * t
        buffer[i] = (osc(phase, "saw") * 0.65 + math.sin(phase * 1.7) * 0.2) * env
    return normalize(buffer, 0.9)


def render_laser() -> list[float]:
    duration = 0.28
    buffer = [0.0] * int(duration * SAMPLE_RATE)
    for i in range(len(buffer)):
        t = i / SAMPLE_RATE
        env = envelope(t, duration, 0.004, 0.14)
        freq = 680.0 + 140.0 * math.sin(t * 18.0)
        phase = math.pi * 2.0 * freq * t
        shimmer = math.sin(math.pi * 2.0 * freq * 2.02 * t) * 0.35
        buffer[i] = (osc(phase, "triangle") * 0.58 + shimmer) * env
    return normalize(buffer, 0.9)


def render_explosion() -> list[float]:
    duration = 0.72
    buffer = [0.0] * int(duration * SAMPLE_RATE)
    for i in range(len(buffer)):
        t = i / SAMPLE_RATE
        env = math.exp(-5.2 * t)
        noise = RNG.uniform(-1.0, 1.0) * env
        rumble = math.sin(math.pi * 2.0 * (95.0 - 45.0 * t) * t) * math.exp(-4.0 * t)
        buffer[i] = noise * 0.68 + rumble * 0.52
    return normalize(buffer, 0.9)


def render_hit() -> list[float]:
    duration = 0.24
    buffer = [0.0] * int(duration * SAMPLE_RATE)
    for i in range(len(buffer)):
        t = i / SAMPLE_RATE
        env = envelope(t, duration, 0.001, 0.12)
        freq = 240.0 - 120.0 * (t / duration)
        phase = math.pi * 2.0 * freq * t
        buffer[i] = (math.sin(phase) * 0.7 + RNG.uniform(-1.0, 1.0) * 0.18) * env
    return normalize(buffer, 0.9)


def render_pickup() -> list[float]:
    duration = 0.52
    buffer = [0.0] * int(duration * SAMPLE_RATE)
    notes = [76, 79, 83, 88]
    for index, note in enumerate(notes):
        add_note(
            buffer,
            index * 0.09,
            0.18,
            midi_to_freq(note),
            amp=0.28,
            waveform="triangle",
            attack=0.004,
            release=0.1,
            detune=(-3.0, 3.0),
        )
    return normalize(buffer, 0.88)


def render_alert() -> list[float]:
    duration = 0.86
    buffer = [0.0] * int(duration * SAMPLE_RATE)
    for i in range(len(buffer)):
        t = i / SAMPLE_RATE
        env = envelope(t, duration, 0.004, 0.12)
        freq = 420.0 if int(t / 0.12) % 2 == 0 else 620.0
        phase = math.pi * 2.0 * freq * t
        buffer[i] = osc(phase, "softsquare") * 0.52 * env
    return normalize(buffer, 0.9)


def render_beam() -> list[float]:
    duration = 1.1
    buffer = [0.0] * int(duration * SAMPLE_RATE)
    for i in range(len(buffer)):
        t = i / SAMPLE_RATE
        env = envelope(t, duration, 0.08, 0.18)
        rise = min(1.0, t / 0.45)
        freq = 160.0 + 780.0 * rise
        phase = math.pi * 2.0 * freq * t
        buffer[i] = (osc(phase, "saw") * 0.42 + math.sin(phase * 0.5) * 0.24) * env
    return normalize(buffer, 0.92)


def render_victory() -> list[float]:
    duration = 1.4
    buffer = [0.0] * int(duration * SAMPLE_RATE)
    sequence = [(0.0, 76), (0.18, 79), (0.38, 83), (0.62, 88)]
    for start, note in sequence:
        add_note(
            buffer,
            start,
            0.45,
            midi_to_freq(note),
            amp=0.32,
            waveform="triangle",
            attack=0.004,
            release=0.14,
            detune=(-5.0, 5.0),
        )
    return normalize(buffer, 0.9)


def render_failure() -> list[float]:
    duration = 1.0
    buffer = [0.0] * int(duration * SAMPLE_RATE)
    sequence = [(0.0, 52), (0.22, 50), (0.46, 45)]
    for start, note in sequence:
        add_note(
            buffer,
            start,
            0.38,
            midi_to_freq(note),
            amp=0.33,
            waveform="softsquare",
            attack=0.002,
            release=0.12,
        )
    return normalize(buffer, 0.9)


def main() -> None:
    renders = {
        "bgm-neon-strike.wav": render_bgm(),
        "sfx-shot.wav": render_shot(),
        "sfx-laser.wav": render_laser(),
        "sfx-explosion.wav": render_explosion(),
        "sfx-hit.wav": render_hit(),
        "sfx-pickup.wav": render_pickup(),
        "sfx-alert.wav": render_alert(),
        "sfx-beam.wav": render_beam(),
        "sfx-victory.wav": render_victory(),
        "sfx-failure.wav": render_failure(),
    }

    for name, samples in renders.items():
        write_wav(AUDIO_DIR / name, samples)
        print(f"generated {name}")


if __name__ == "__main__":
    main()
