#!/usr/bin/env python3
"""La cama de música de los videos, sintetizada acá.

No es una pista de un banco: se genera con numpy, así que no hay licencia que
revisar ni derechos de autor que reclamar en Instagram — y suena igual en cada
render. Si algún día se compra una pista de verdad, se deja el wav en
`marketing/video/musica/` con el mismo nombre y `build.mjs` la usa sin cambios.

Qué suena: un arpegio lento en fa mayor con ataque suave y cola larga, y debajo
un colchón de dos notas que respira. Nada de percusión ni de melodía con
carácter — la música acompaña al ramo, no compite con él.

    python3 marketing/video/musica.py 14      # 14 segundos

Deja `marketing/video/musica/cama-<segundos>s.wav`.
"""
import math
import pathlib
import struct
import sys
import wave

import numpy as np

SR = 44100
AQUI = pathlib.Path(__file__).resolve().parent
DESTINO = AQUI / 'musica'

# Fa mayor, en un registro medio para que no pelee con la voz de un reel.
def nota(n: str) -> float:
    """Frecuencia de la nota, con el la4 en 440 Hz."""
    nombres = {'do': 0, 'do#': 1, 're': 2, 'mi♭': 3, 'mi': 4, 'fa': 5,
               'fa#': 6, 'sol': 7, 'sol#': 8, 'la': 9, 'si♭': 10, 'si': 11}
    cuerpo, octava = n[:-1], int(n[-1])
    return 440.0 * 2 ** ((nombres[cuerpo] + 12 * (octava - 4) - 9) / 12)


ARPEGIO = ['fa3', 'la3', 'do4', 'fa4', 'mi4', 'do4', 'la3', 'do4']
COLCHON = ['fa2', 'do3']
PASO = 0.62          # segundos entre notas del arpegio
COLA = 2.4           # cuánto tarda una nota en apagarse


def pulso(freq: float, dur: float, amp: float) -> np.ndarray:
    """Una nota: seno con dos armónicos débiles y caída exponencial."""
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    onda = (np.sin(2 * math.pi * freq * t)
            + 0.22 * np.sin(2 * math.pi * 2 * freq * t)
            + 0.08 * np.sin(2 * math.pi * 3 * freq * t))
    ataque = np.clip(t / 0.06, 0, 1)          # sin clic al empezar
    return amp * onda * ataque * np.exp(-t / (COLA / 3))


def reverberar(x: np.ndarray, segundos: float = 1.1) -> np.ndarray:
    """Cola de sala: convolución con ruido que decae. Barata y suficiente."""
    n = int(SR * segundos)
    impulso = np.random.default_rng(7).normal(0, 1, n) * np.exp(-np.linspace(0, 6, n))
    impulso[0] = 1.0
    return np.convolve(x, impulso / np.abs(impulso).sum() * 1.6, mode='full')[:len(x)]


def cama(dur: float) -> np.ndarray:
    total = int(SR * dur)
    mezcla = np.zeros(total + int(SR * COLA))

    for i in range(int(dur / PASO) + 1):
        inicio = int(i * PASO * SR)
        f = nota(ARPEGIO[i % len(ARPEGIO)])
        # La primera vuelta entra más suave: el video empieza antes que la música.
        amp = 0.16 * (0.6 + 0.4 * min(1, i / 4))
        p = pulso(f, COLA, amp)
        mezcla[inicio:inicio + len(p)] += p

    # Colchón: dos notas largas que suben y bajan muy despacio.
    t = np.linspace(0, dur, total, endpoint=False)
    respiro = 0.5 + 0.5 * np.sin(2 * math.pi * t / 7.5 - math.pi / 2)
    for n in COLCHON:
        mezcla[:total] += 0.05 * respiro * np.sin(2 * math.pi * nota(n) * t)

    mezcla = mezcla[:total]
    mezcla = 0.72 * mezcla + 0.28 * reverberar(mezcla)

    # Entradas y salidas: 1,2 s para entrar y 2,2 s para irse.
    ent, sal = int(SR * 1.2), int(SR * 2.2)
    mezcla[:ent] *= np.linspace(0, 1, ent)
    mezcla[-sal:] *= np.linspace(1, 0, sal)

    pico = np.abs(mezcla).max()
    return mezcla / pico * 0.5 if pico else mezcla     # ≈ −6 dBFS de pico


def main() -> None:
    dur = float(sys.argv[1]) if len(sys.argv) > 1 else 14.0
    DESTINO.mkdir(exist_ok=True)
    x = cama(dur)
    # Estéreo apenas abierto: el canal derecho llega 12 ms tarde.
    retardo = int(SR * 0.012)
    der = np.concatenate([np.zeros(retardo), x])[:len(x)]
    pcm = (np.stack([x, der], axis=1) * 32767).astype('<i2')

    salida = DESTINO / f'cama-{dur:g}s.wav'
    with wave.open(str(salida), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(salida, f'{salida.stat().st_size // 1024} kB')


if __name__ == '__main__':
    main()
