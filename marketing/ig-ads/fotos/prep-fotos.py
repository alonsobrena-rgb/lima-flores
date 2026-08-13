#!/usr/bin/env python3
"""Recorta cada foto del catálogo hasta el producto.

Las tomas del catálogo tienen el producto centrado y mucho fondo alrededor.
Al meterlas en un lienzo de otra proporción pasaba una de dos cosas: o se
recortaba y el ramo quedaba cortado, o entraba entera y el producto se veía
diminuto en medio del vacío.

Aquí se detecta el fondo (por las esquinas) y el recuadro que ocupa el
producto, y se guarda una versión recortada a ese recuadro más un margen. El
generador luego la mete con `contain` y pinta el contenedor del mismo color de
fondo: el producto entra completo, ocupa lo más posible y no se ve ninguna
costura.

Las fotos que ya llenan el encuadre —los macros y las de ambiente— se detectan
solas y se dejan como están.

    python3 marketing/ig-ads/fotos/prep-fotos.py
"""
import json
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ADS = os.path.join(HERE, '../ads.json')
ORIG = os.path.join(HERE, '../../../app/public/products')

ANALISIS = 400     # lado máximo para detectar el recuadro; de sobra y rápido
TOLERANCIA = 26    # cuánto se puede alejar un píxel del fondo y seguir siendo fondo
MARGEN = 0.035     # aire alrededor del producto, en proporción al recuadro
LLENA = 0.93       # si el producto ya ocupa esto en AMBOS ejes, la foto se deja intacta
MIN_LADO = 640     # por debajo de esto el recorte pierde más de lo que gana
MAX_AREA = 0.85    # si el recorte conserva más que esto, no ganó nada y estorba


def color_fondo(im):
    """El fondo se toma de las cuatro esquinas: es lo único que en una toma de
    catálogo seguro no es producto."""
    w, h = im.size
    m = max(2, min(w, h) // 40)
    esquinas = []
    for x0, y0 in ((0, 0), (w - m, 0), (0, h - m), (w - m, h - m)):
        esquinas += list(im.crop((x0, y0, x0 + m, y0 + m)).convert('RGB').getdata())
    return tuple(sorted(c[i] for c in esquinas)[len(esquinas) // 2] for i in range(3))


def recuadro_producto(im, fondo):
    """Recuadro de lo que no es fondo, en proporciones de 0 a 1."""
    ch = im.copy()
    ch.thumbnail((ANALISIS, ANALISIS), Image.BILINEAR)
    w, h = ch.size
    px = ch.load()
    x0, y0, x1, y1 = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            if abs(r - fondo[0]) + abs(g - fondo[1]) + abs(b - fondo[2]) > TOLERANCIA:
                if x < x0: x0 = x
                if y < y0: y0 = y
                if x > x1: x1 = x
                if y > y1: y1 = y
    if x1 <= x0 or y1 <= y0:
        return (0.0, 0.0, 1.0, 1.0)
    return (x0 / w, y0 / h, (x1 + 1) / w, (y1 + 1) / h)


def main():
    datos = json.load(open(ADS, encoding='utf-8'))
    fotos = sorted({a['photo'] for a in datos['ads']})
    manifiesto = {}

    for f in fotos:
        im = Image.open(os.path.join(ORIG, f)).convert('RGB')
        fondo = color_fondo(im)
        bx0, by0, bx1, by1 = recuadro_producto(im, fondo)
        # el eje menor manda: una orquídea puede ocupar todo el alto y solo un
        # tercio del ancho, y ahí el recorte lateral es justo lo que hace falta
        ocupa = min(bx1 - bx0, by1 - by0)
        hexa = '#%02X%02X%02X' % fondo

        if ocupa >= LLENA:
            # Macro o foto de ambiente: no hay fondo que quitar.
            manifiesto[f] = {'fondo': hexa, 'recortada': False}
            print(f'  = {f:<52} ya llena el encuadre')
            continue

        w, h = im.size
        mx, my = (bx1 - bx0) * MARGEN, (by1 - by0) * MARGEN
        caja = (max(0, int((bx0 - mx) * w)), max(0, int((by0 - my) * h)),
                min(w, int((bx1 + mx) * w)), min(h, int((by1 + my) * h)))
        rec = im.crop(caja)
        if min(rec.size) < MIN_LADO:
            manifiesto[f] = {'fondo': hexa, 'recortada': False}
            print(f'  = {f:<52} recorte descartado ({rec.size}): quedaría muy chica')
            continue
        if (rec.size[0] * rec.size[1]) / (w * h) > MAX_AREA:
            # Recortes de un 5-8%: no dan aire y sí cambian el encuadre.
            manifiesto[f] = {'fondo': hexa, 'recortada': False}
            print(f'  = {f:<52} recorte descartado: solo quitaba fondo de sobra')
            continue
        rec.save(os.path.join(HERE, f), quality=92, optimize=True, progressive=True)
        manifiesto[f] = {'fondo': hexa, 'recortada': True}
        print(f'  ✂ {f:<52} {im.size} → {rec.size}  fondo {hexa}')

    json.dump(manifiesto, open(os.path.join(HERE, 'encuadres.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2, sort_keys=True)
    n = sum(1 for v in manifiesto.values() if v['recortada'])
    print(f'\n{n} recortadas · {len(manifiesto) - n} intactas · encuadres.json')


if __name__ == '__main__':
    main()
