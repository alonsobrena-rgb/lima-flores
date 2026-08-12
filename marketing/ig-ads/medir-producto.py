#!/usr/bin/env python3
"""Mide cuánto del lienzo ocupa el producto en cada creativo.

Es una medida aproximada y a propósito: cuenta los píxeles con color — los
pétalos, el papel, la caja — contra los que son papel, tinta o gris. El texto de
marca también tiene color, pero ocupa una fracción mínima del lienzo, así que no
mueve la aguja. Sirve para lo único que hace falta: comparar antes y después, y
tener un número en vez de una discusión sobre si «se ve chico».

    python3 marketing/ig-ads/medir-producto.py            # los creativos
    python3 marketing/ig-ads/medir-producto.py pruebas    # el banco de formatos
"""
import colorsys
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))

# Un píxel cuenta como producto si tiene color de verdad. El umbral de valor
# descarta las sombras hondas, que no son producto ni fondo.
SAT_MIN = 0.22
VAL_MIN = 0.14


def color_frac(ruta, lado=200):
    im = Image.open(ruta).convert('RGB').resize((lado, lado), Image.LANCZOS)
    n = 0
    for r, g, b in im.getdata():
        _, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if s >= SAT_MIN and v >= VAL_MIN:
            n += 1
    return n / (lado * lado)


def main():
    banco = len(sys.argv) > 1 and sys.argv[1] == 'pruebas'
    datos = json.load(open(os.path.join(HERE, 'pruebas.json' if banco else 'ads.json'),
                           encoding='utf-8'))
    carpeta = os.path.join(HERE, 'pruebas' if banco else 'creativos')

    filas = []
    for a in datos['ads']:
        ruta = os.path.join(carpeta, f"{a['code']}.jpg")
        if not os.path.exists(ruta):
            continue
        filas.append((a['code'], a['template'], color_frac(ruta)))

    filas.sort(key=lambda f: f[2])
    for cod, tpl, frac in filas:
        barra = '█' * round(frac * 40)
        print(f'  {cod:14} {tpl:9} {frac * 100:5.1f}%  {barra}')

    med = sum(f[2] for f in filas) / len(filas)
    print(f'\n  {len(filas)} piezas · promedio {med * 100:.1f}%'
          f' · peor {filas[0][2] * 100:.1f}% ({filas[0][0]})'
          f' · mejor {filas[-1][2] * 100:.1f}% ({filas[-1][0]})')

    porTpl = {}
    for _, tpl, frac in filas:
        porTpl.setdefault(tpl, []).append(frac)
    print()
    for tpl, fs in sorted(porTpl.items(), key=lambda kv: sum(kv[1]) / len(kv[1])):
        print(f'  {tpl:9} {sum(fs) / len(fs) * 100:5.1f}%  ({len(fs)})')


if __name__ == '__main__':
    main()
