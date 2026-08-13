#!/usr/bin/env python3
"""Recorta al producto las fotos que van en una tira.

`prep-fotos.py` recorta una toma solo cuando el recorte gana bastante: si el
producto ya ocupa más del 85% del cuadro, deja la original, porque recortar por
recortar cambia el encuadre sin ganar nada. Para una foto sola eso está bien.

En una tira no. Ahí se ven tres juntas, y ese 15% de margen que a una le sobra y
a otra no es exactamente lo que hace que una se vea más chica que su vecina. Con
`contain` el navegador ajusta el *cuadro*, no el producto: si el cuadro trae
aire, el producto encoge. Así que para la tira se recorta siempre, al ras del
producto y con el mismo margen para todas — y recién ahí las tres entran del
mismo tamaño.

    python3 marketing/ig-ads/fotos/prep-tira.py

Salida: fotos/tira/<foto>.jpg + fotos/tira/encuadres.json. Lee la lista de fotos
de ads.json y pruebas.json, así que basta con agregar una tira para que su foto
entre al recorte en la siguiente corrida.
"""
import json
import os
import sys

from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ADS = os.path.dirname(HERE)
FOTOS = os.path.join(os.path.dirname(os.path.dirname(ADS)), 'app/public/products')
SALIDA = os.path.join(HERE, 'tira')

# Margen que se le deja al producto, en fracción del lado recortado. Sin nada de
# margen el producto choca contra el borde del panel y se ve apretado.
MARGEN = 0.03
# Un píxel cuenta como producto si se separa del fondo más que esto. Bajo de más
# y el degradado del ciclorama entra como producto; alto de más se come un
# pétalo claro.
UMBRAL = 16


def fondo_de(im):
    """El color del fondo, votado entre las cuatro esquinas."""
    w, h = im.size
    k = max(2, min(w, h) // 40)
    esquinas = [im.crop(c).resize((1, 1), Image.LANCZOS).getpixel((0, 0))
                for c in [(0, 0, k, k), (w - k, 0, w, k), (0, h - k, k, h), (w - k, h - k, w, h)]]
    return tuple(sorted(c[i] for c in esquinas)[1] for i in range(3))


def recortar(ruta):
    im = Image.open(ruta).convert('RGB')
    fondo = fondo_de(im)
    dif = ImageChops.difference(im, Image.new('RGB', im.size, fondo)).convert('L')
    caja = dif.point(lambda v: 255 if v > UMBRAL else 0).getbbox()
    if not caja:
        return None, fondo
    x0, y0, x1, y1 = caja
    pad = round(max(x1 - x0, y1 - y0) * MARGEN)
    caja = (max(0, x0 - pad), max(0, y0 - pad),
            min(im.width, x1 + pad), min(im.height, y1 + pad))
    return im.crop(caja), fondo


def main():
    fotos = set()
    for nombre in ('ads.json', 'pruebas.json'):
        ruta = os.path.join(ADS, nombre)
        if not os.path.exists(ruta):
            continue
        for a in json.load(open(ruta, encoding='utf-8'))['ads']:
            for p in a.get('creative', {}).get('piezas', []):
                fotos.add(p['photo'])

    if not fotos:
        sys.exit('ninguna tira en ads.json ni en pruebas.json: nada que recortar')

    os.makedirs(SALIDA, exist_ok=True)
    encuadres = {}
    for f in sorted(fotos):
        origen = os.path.join(FOTOS, f)
        if not os.path.exists(origen):
            sys.exit(f'no existe {origen}')
        recorte, fondo = recortar(origen)
        if recorte is None:
            sys.exit(f'{f}: no encontré el producto contra el fondo')
        recorte.save(os.path.join(SALIDA, f), 'JPEG', quality=92, optimize=True)
        encuadres[f] = {'fondo': '#%02X%02X%02X' % fondo}
        orig = Image.open(origen)
        print(f'  ✓ {f:44} {orig.width}×{orig.height} → {recorte.width}×{recorte.height}'
              f'  fondo {encuadres[f]["fondo"]}')

    json.dump(encuadres, open(os.path.join(SALIDA, 'encuadres.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2, sort_keys=True)
    print(f'\n{len(encuadres)} fotos recortadas en fotos/tira/')


if __name__ == '__main__':
    main()
