#!/usr/bin/env python3
"""Saca los colores reales del logo, para no inventar paletas.

El logo es un ramo en acuarela sobre el logotipo gris. Interesa el ramo: se
descartan los píxeles transparentes, los casi-blancos del papel y los grises
del logotipo (baja saturación), y lo que queda se agrupa por tono.

    python3 design/colores-logo.py [ruta-al-logo.png]
"""
import colorsys
import os
import sys
from collections import defaultdict

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POR_DEFECTO = os.path.join(RAIZ, 'site/assets/logo.png')

# Un píxel cuenta como "color del ramo" si está bien opaco, tiene saturación
# de verdad y no es ni casi-blanco ni casi-negro.
ALFA_MIN = 200
SAT_MIN = 0.18
VAL_MIN = 0.12
VAL_MAX = 0.985


def familias(ruta, cortes=18):
    im = Image.open(ruta).convert('RGBA')
    if max(im.size) > 900:                       # basta para contar tonos
        f = 900 / max(im.size)
        im = im.resize((round(im.width * f), round(im.height * f)), Image.LANCZOS)

    cubos = defaultdict(lambda: [0, 0, 0, 0])    # tono -> [n, r, g, b]
    hondos = defaultdict(list)                   # tono -> [(v, rgb), ...]
    grises = [0, 0, 0, 0]
    for r, g, b, a in im.convert('RGBA').getdata():
        if a < ALFA_MIN:
            continue
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if not (VAL_MIN < v < VAL_MAX):
            continue
        if s < SAT_MIN:                          # el logotipo y sus antialias
            grises[0] += 1
            grises[1] += r; grises[2] += g; grises[3] += b
            continue
        tono = int(h * cortes) % cortes
        c = cubos[tono]
        c[0] += 1
        c[1] += r; c[2] += g; c[3] += b
        hondos[tono].append((v - s / 2, (r, g, b)))   # oscuro y saturado

    salida = []
    for tono, (n, r, g, b) in cubos.items():
        # el "hondo": la mediana del 8% más oscuro-y-saturado de la familia.
        muestra = sorted(hondos[tono])[:max(1, len(hondos[tono]) * 8 // 100)]
        hr, hg, hb = muestra[len(muestra) // 2][1]
        salida.append((n, tono * 360 // cortes, f'#{r//n:02X}{g//n:02X}{b//n:02X}',
                       f'#{hr:02X}{hg:02X}{hb:02X}'))
    salida.sort(reverse=True)

    if grises[0]:
        n = grises[0]
        gris = f'#{grises[1]//n:02X}{grises[2]//n:02X}{grises[3]//n:02X}'
    else:
        gris = None
    return salida, gris, sum(c[0] for c in cubos.values())


def main():
    ruta = sys.argv[1] if len(sys.argv) > 1 else POR_DEFECTO
    fams, gris, total = familias(ruta)
    print(f'{os.path.relpath(ruta, RAIZ)} — {total} píxeles con color\n')
    print(f'{"tono":>5}  {"medio":>8}  {"hondo":>8}  {"%":>6}')
    for n, tono, medio, hondo in fams:
        if n / total < 0.012:                    # ruido de antialias
            continue
        print(f'{tono:>4}°  {medio:>8}  {hondo:>8}  {100*n/total:>5.1f}%')
    print(f'\ngris del logotipo: {gris}')


if __name__ == '__main__':
    main()
