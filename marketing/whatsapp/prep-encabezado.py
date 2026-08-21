#!/usr/bin/env python3
"""Prepara la foto apaisada del encabezado de una plantilla de WhatsApp.

WhatsApp muestra el encabezado en 1.91:1 y la toma de catálogo es vertical
(1707 × 2560): puesta ahí, el recorte se comería el box o las rosas. Acá se
hace lo mismo que en los anuncios —regla 1 de piezas-graficas—: se recorta la
foto hasta el producto, se mide el color del fondo y el producto entra con
`contain` sobre un lienzo de ese mismo color. Nada cortado, ninguna costura.

    python3 marketing/whatsapp/prep-encabezado.py box-simona.jpg
"""
import os
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
# prep-fotos.py no es un nombre de módulo importable; se carga a mano.
import importlib.util
_spec = importlib.util.spec_from_file_location(
    'prep_fotos', os.path.join(HERE, '../ig-ads/fotos/prep-fotos.py'))
prep = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(prep)

ORIG = os.path.join(HERE, '../../app/public/products')
ANCHO, ALTO = 1600, 838          # 1.91:1, el encabezado de WhatsApp
MARGEN_LIENZO = 0.035           # aire entre el producto y el filo, el mismo de prep-fotos


def main(nombre):
    im = Image.open(os.path.join(ORIG, nombre)).convert('RGB')
    fondo = prep.color_fondo(im)
    bx0, by0, bx1, by1 = prep.recuadro_producto(im, fondo)
    w, h = im.size
    mx, my = (bx1 - bx0) * prep.MARGEN, (by1 - by0) * prep.MARGEN
    caja = (max(0, int((bx0 - mx) * w)), max(0, int((by0 - my) * h)),
            min(w, int((bx1 + mx) * w)), min(h, int((by1 + my) * h)))
    rec = im.crop(caja)

    util = (int(ANCHO * (1 - 2 * MARGEN_LIENZO)), int(ALTO * (1 - 2 * MARGEN_LIENZO)))
    foto = rec.copy()
    foto.thumbnail(util, Image.LANCZOS)          # contain: nunca corta

    lienzo = Image.new('RGB', (ANCHO, ALTO), fondo)
    lienzo.paste(foto, ((ANCHO - foto.size[0]) // 2, (ALTO - foto.size[1]) // 2))

    salida = os.path.join(HERE, 'encabezados', nombre)
    os.makedirs(os.path.dirname(salida), exist_ok=True)
    lienzo.save(salida, quality=90, optimize=True, progressive=True)
    print(f'  {nombre}: {im.size} → recorte {rec.size} → {lienzo.size} '
          f'sobre #%02X%02X%02X' % fondo)
    print(f'  {salida}  ({os.path.getsize(salida) // 1024} KB)')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'box-simona.jpg')
