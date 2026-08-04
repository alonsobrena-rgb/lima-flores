#!/usr/bin/env python3
"""Prepara el logo de Lima Flores para los creativos.

Parte de site/assets/logo.png (el original de la página) y saca dos archivos:

  logo.png        recortado al contenido, listo para fondos claros.
  logo-claro.png  misma marca para fondos oscuros: la caligrafía gris pasa a
                  color hueso y la acuarela se queda como está, porque los
                  rosas y verdes ya contrastan contra un fondo oscuro.

Solo hay que volver a correrlo si cambia el logo de la página:

    python3 marketing/ig-ads/marca/prep-logo.py
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '../../../site/assets/logo.png')
ANCHO = 700           # de sobra: en el creativo se usa a ~150 px
HUESO = (244, 239, 229)
UMBRAL_SAT = 0.15     # por debajo de esto lo tratamos como caligrafía gris


def main():
    im = Image.open(SRC).convert('RGBA')
    im = im.crop(im.getchannel('A').getbbox())          # fuera el aire sobrante
    im = im.resize((ANCHO, round(ANCHO * im.height / im.width)), Image.LANCZOS)
    im.save(os.path.join(HERE, 'logo.png'))

    # La forma de las letras vive en el canal alfa, así que reemplazar el RGB
    # por hueso conserva el trazo y su antialiasing intactos.
    claro = im.copy()
    px = claro.load()
    for y in range(claro.height):
        for x in range(claro.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            mx, mn = max(r, g, b), min(r, g, b)
            sat = 0 if mx == 0 else (mx - mn) / mx
            if sat < UMBRAL_SAT:
                px[x, y] = (*HUESO, a)
    claro.save(os.path.join(HERE, 'logo-claro.png'))

    for f in ('logo.png', 'logo-claro.png'):
        p = os.path.join(HERE, f)
        print(f'  {f}  {Image.open(p).size}  {round(os.path.getsize(p)/1024)} KB')


if __name__ == '__main__':
    main()
