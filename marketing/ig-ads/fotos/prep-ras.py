#!/usr/bin/env python3
"""Recorta cada foto del catálogo al ras del producto.

`prep-fotos.py` recorta una toma solo cuando el recorte gana bastante: si el
producto ya ocupa más del 85% del cuadro, deja la original, porque recortar por
recortar cambia el encuadre sin ganar nada.

Eso vale mientras el hueco de la foto tenga la misma proporción que la toma. No
la tiene casi nunca. Con `contain` el navegador ajusta el *cuadro*, no el
producto: si el cuadro trae aire alrededor, el producto encoge — y encoge más
cuanto más se diferencien las proporciones. Medido sobre la campaña, el producto
ocupaba en promedio el 15% del lienzo.

Así que acá se recorta siempre, al ras y con el mismo margen para todas. El
producto queda tocando dos bordes de su hueco, que es lo más grande que puede
ser sin que se corte nada.

    python3 marketing/ig-ads/fotos/prep-ras.py

Salida: fotos/ras/<foto>.jpg + fotos/ras/encuadres.json. Lee la lista de fotos de
ads.json y pruebas.json — tanto el `photo` de cada anuncio como las `piezas` de
las tiras — así que basta con agregar un anuncio para que su foto entre al
recorte en la siguiente corrida.
"""
import json
import os
import sys

from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ADS = os.path.dirname(HERE)
FOTOS = os.path.join(os.path.dirname(os.path.dirname(ADS)), 'site/assets/products')
SALIDA = os.path.join(HERE, 'ras')

# Margen que se le deja al producto, en fracción del lado recortado. Cumple dos
# funciones: que el producto no choque contra el borde del hueco, y darle de
# comer al recorte. El hueco casi nunca tiene la proporción de la toma, así que
# entrando a sangre se pierde esa diferencia — y conviene que lo primero que se
# pierda sea aire y no un pétalo.
MARGEN = 0.09
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
            if a.get('photo'):
                fotos.add(a['photo'])
            for p in a.get('creative', {}).get('piezas', []):
                fotos.add(p['photo'])

    if not fotos:
        sys.exit('no encontré fotos en ads.json ni en pruebas.json')

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
        # El tamaño del recorte lo necesita el generador para decidir, hueco por
        # hueco, si el producto entra contenido o a sangre.
        encuadres[f] = {'fondo': '#%02X%02X%02X' % fondo,
                        'w': recorte.width, 'h': recorte.height}
        orig = Image.open(origen)
        print(f'  ✓ {f:44} {orig.width}×{orig.height} → {recorte.width}×{recorte.height}'
              f'  fondo {encuadres[f]["fondo"]}')

    json.dump(encuadres, open(os.path.join(SALIDA, 'encuadres.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2, sort_keys=True)
    print(f'\n{len(encuadres)} fotos recortadas en fotos/ras/')


if __name__ == '__main__':
    main()
