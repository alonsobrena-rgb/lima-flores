#!/usr/bin/env python3
"""La cama de música de los videos, sintetizada acá.

No es una pista de un banco: se genera con numpy, así que no hay licencia que
revisar ni derechos de autor que reclamar en Instagram — y suena igual en cada
render. Si algún día se compra una pista de verdad, se deja el wav en
`marketing/video/musica/` con el mismo nombre y `build.mjs` la usa sin cambios.

Qué suena: un arpegio lento en fa mayor con ataque suave y cola larga, y debajo
un colchón de dos notas que respira. Nada de percusión ni de melodía con
carácter — la música acompaña al ramo, no compite con él.

    python3 marketing/video/musica.py 14                  # 14 segundos
    python3 marketing/video/musica.py 21.4 --estilo jueves

Deja `marketing/video/musica/cama-<segundos>s.wav` (o `cama-<estilo>-<segundos>s.wav`).

El estilo `jueves` es otra cosa: guitarra rasgueada, bajo, una melodía de
campanitas y un shaker, a 96 por minuto. El arpegio de arriba sirve de cama
debajo de una toma lenta; con seis fotos que cambian cada compás se quedaba
quieto y el video se sentía más largo de lo que era. Ver `jueves()`.
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


# ── Estilo «jueves» ──────────────────────────────────────────────────────────
# 96 por minuto: un compás dura 2,5 s, que es exactamente lo que tarda VID-02 en
# pasar de un ramo al siguiente (2,9 s por lámina menos 0,4 de fundido). Los
# cambios de foto caen en el uno del compás y el corte se siente a tiempo.
# La música arranca 0,2 s tarde: el fundido de 0,4 s queda centrado en el uno.
BPM = 96
NEGRA = 60 / BPM
COMPAS = 4 * NEGRA
ARRANQUE = 0.2

# I–iii–IV–V en fa, dos vueltas y el fa final que se queda sonando bajo la
# portada. Voces de guitarra en posición abierta, de grave a agudo.
ACORDES = {
    'fa':   ['fa2', 'do3', 'fa3', 'la3', 'do4', 'fa4'],
    'lam':  ['la2', 'mi3', 'la3', 'do4', 'mi4'],
    'si♭':  ['si♭2', 'fa3', 'si♭3', 're4', 'fa4'],
    'do':   ['do3', 'mi3', 'sol3', 'do4', 'mi4'],
}
VUELTA = ['fa', 'lam', 'si♭', 'do', 'fa', 'lam', 'si♭', 'do', 'fa']

# Rasgueo en corcheas: abajo, —, abajo, arriba, —, arriba, abajo, arriba.
RASGUEO = [(0, 'abajo', 1.0), (2, 'abajo', .7), (3, 'arriba', .45),
           (5, 'arriba', .45), (6, 'abajo', .65), (7, 'arriba', .4)]

# La melodía: (compás, negra, nota). Pocas notas y siempre del acorde, para
# que se recuerde y no compita con la lectura.
MELODIA = [
    (0, 0, 'do5'), (0, 1.5, 'la4'), (0, 2, 'do5'), (0, 3, 'fa5'),
    (1, 0, 'mi5'), (1, 2, 'do5'), (1, 3, 'la4'),
    (2, 0, 're5'), (2, 1.5, 'fa5'), (2, 2, 're5'), (2, 3, 'si♭4'),
    (3, 0, 'do5'), (3, 1, 'mi5'), (3, 2, 'sol5'), (3, 3, 'mi5'),
    (4, 0, 'do5'), (4, 1.5, 'la4'), (4, 2, 'do5'), (4, 3, 'fa5'),
    (5, 0, 'mi5'), (5, 1.5, 'sol5'), (5, 2, 'mi5'), (5, 3, 'do5'),
    (6, 0, 're5'), (6, 2, 'fa5'), (6, 3, 're5'),
    (7, 0, 'mi5'), (7, 2, 'sol5'), (7, 3, 'mi5'),
    (8, 0, 'fa5'),
]


def cuerda(freq: float, dur: float, amp: float, brillo: float = .5) -> np.ndarray:
    """Cuerda pulsada (Karplus-Strong), calculada de a un período por vez.

    Cada período depende solo del anterior, así que se resuelve con numpy por
    bloques en vez de muestra a muestra: el video entero tarda un par de
    segundos en vez de un minuto."""
    n = max(2, int(round(SR / freq)))
    total = int(SR * dur)
    bloques = total // n + 2
    y = np.zeros(bloques * n)
    ruido = np.random.default_rng(int(freq * 10)).uniform(-1, 1, n)
    # Un ruido más oscuro da una púa más blanda: menos «clavicordio».
    for _ in range(int((1 - brillo) * 4)):
        ruido = 0.5 * (ruido + np.roll(ruido, 1))
    y[:n] = ruido
    caida = 0.996 ** (440 / freq) ** 0.3
    anterior_ult = 0.0
    for k in range(1, bloques):
        prev = y[(k - 1) * n:k * n]
        corrido = np.concatenate([[anterior_ult], prev[:-1]])
        anterior_ult = prev[-1]
        y[k * n:(k + 1) * n] = caida * 0.5 * (prev + corrido)
    y = y[:total]
    t = np.arange(total) / SR
    return amp * y * np.exp(-t / 1.6) * np.clip(t / 0.004, 0, 1)


def campana(freq: float, dur: float, amp: float) -> np.ndarray:
    """Celesta: parciales inarmónicos que se apagan antes cuanto más agudos."""
    t = np.arange(int(SR * dur)) / SR
    onda = (np.sin(2 * math.pi * freq * t) * np.exp(-t / 0.9)
            + 0.35 * np.sin(2 * math.pi * 2.76 * freq * t) * np.exp(-t / 0.25)
            + 0.12 * np.sin(2 * math.pi * 5.4 * freq * t) * np.exp(-t / 0.08))
    return amp * onda * np.clip(t / 0.003, 0, 1)


def bajo(freq: float, dur: float, amp: float) -> np.ndarray:
    t = np.arange(int(SR * dur)) / SR
    onda = np.sin(2 * math.pi * freq * t) + 0.3 * np.sin(2 * math.pi * 2 * freq * t)
    return amp * onda * np.exp(-t / 0.5) * np.clip(t / 0.01, 0, 1)


def shaker(amp: float) -> np.ndarray:
    n = int(SR * 0.07)
    ruido = np.random.default_rng(3).normal(0, 1, n)
    ruido = np.diff(ruido, prepend=0)                 # solo lo agudo
    t = np.arange(n) / SR
    return amp * ruido * np.clip(t / 0.01, 0, 1) * np.exp(-t / 0.02)


def jueves(dur: float) -> np.ndarray:
    mezcla = np.zeros(int(SR * (dur + 4)))

    def poner(x: np.ndarray, seg: float) -> None:
        i = int(seg * SR)
        if i >= len(mezcla):
            return
        x = x[:len(mezcla) - i]
        mezcla[i:i + len(x)] += x

    corchea = NEGRA / 2
    for c, nombre in enumerate(VUELTA):
        inicio = ARRANQUE + c * COMPAS
        if inicio > dur:
            break
        voces = ACORDES[nombre]
        final = c == len(VUELTA) - 1
        golpes = [(0, 'abajo', 1.0)] if final else RASGUEO
        for corch, sentido, fuerza in golpes:
            t0 = inicio + corch * corchea
            cuerdas = voces if sentido == 'abajo' else list(reversed(voces[-3:]))
            for j, n in enumerate(cuerdas):
                # 14 ms entre cuerda y cuerda: lo que tarda una púa en cruzarlas.
                poner(cuerda(nota(n), 4.0 if final else 2.2, 0.11 * fuerza,
                             brillo=.35 if sentido == 'abajo' else .55), t0 + j * 0.014)
        raiz = voces[0][:-1] + str(int(voces[0][-1]) - 1 if voces[0][-1] != '2' else 1)
        # El bajo va discreto: el parlante de un celular no baja de ~200 Hz, y
        # fuerte solo empujaba el compresor y apagaba la guitarra.
        poner(bajo(nota(raiz), 4.0 if final else 1.2, 0.09), inicio)
        if not final:
            poner(bajo(nota(raiz), 1.2, 0.06), inicio + 2 * NEGRA)
            # El shaker entra en el segundo compás: el primero es solo guitarra.
            if c >= 1:
                for k in range(8):
                    poner(shaker(0.05 if k % 2 else 0.025), inicio + k * corchea)

    for c, negra, n in MELODIA:
        poner(campana(nota(n), 3.0, 0.10), ARRANQUE + c * COMPAS + negra * NEGRA)

    total = int(SR * dur)
    mezcla = mezcla[:total]
    mezcla = 0.75 * mezcla + 0.25 * reverberar(mezcla, 1.4)

    # Las mismas curvas de entrada y salida que la cama: 0,3 s y 2,2 s. Entra
    # casi de golpe porque el primer rasgueo ES el arranque del video.
    ent, sal = int(SR * 0.3), int(SR * 2.2)
    mezcla[:ent] *= np.linspace(0, 1, ent)
    mezcla[-sal:] *= np.linspace(1, 0, sal)

    # Un celular no reproduce graves y suena bajito: se comprime con tanh y se
    # deja el pico en −3 dBFS en vez de −6, para que la música se oiga en el
    # parlante del teléfono sin distorsionar.
    mezcla = np.tanh(1.6 * mezcla / np.abs(mezcla).max())
    return mezcla / np.abs(mezcla).max() * 0.7


ESTILOS = {'cama': cama, 'jueves': jueves}


def main() -> None:
    args = sys.argv[1:]
    estilo = 'cama'
    if '--estilo' in args:
        i = args.index('--estilo')
        estilo = args[i + 1]
        del args[i:i + 2]
    dur = float(args[0]) if args else 14.0
    DESTINO.mkdir(exist_ok=True)
    x = ESTILOS[estilo](dur)
    # Estéreo apenas abierto: el canal derecho llega 12 ms tarde.
    retardo = int(SR * 0.012)
    der = np.concatenate([np.zeros(retardo), x])[:len(x)]
    pcm = (np.stack([x, der], axis=1) * 32767).astype('<i2')

    nombre = 'cama' if estilo == 'cama' else f'cama-{estilo}'
    salida = DESTINO / f'{nombre}-{dur:g}s.wav'
    with wave.open(str(salida), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(salida, f'{salida.stat().st_size // 1024} kB')


if __name__ == '__main__':
    main()
