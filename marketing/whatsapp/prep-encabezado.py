#!/usr/bin/env python3
"""Prepara la foto del encabezado de una plantilla de WhatsApp.

WhatsApp muestra el encabezado **apaisado** (Meta recomienda 1125 × 600) y las
fotos del catálogo son verticales: metidas ahí de cualquier manera, el recorte
se come el box o las rosas. Acá se aplica la regla 1 de
`.claude/skills/piezas-graficas/SKILL.md`, la misma que usa el pipeline de
anuncios: se mide el fondo de la toma, se recorta hasta el producto y se apoya
con `contain` sobre un lienzo **de ese mismo color medido**. El producto entra
entero, ocupa todo el alto disponible y no se ve ninguna costura, porque el
lienzo es del color que ya tenía la foto.

    python3 marketing/whatsapp/prep-encabezado.py box-simona.jpg

Sale en `marketing/whatsapp/encabezados/`. El archivo se sube tal cual desde el
panel al crear la plantilla (Admin → Promociones WhatsApp → Plantillas).
"""
import importlib.util
import os
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.join(HERE, '../..')
ORIG = os.path.join(RAIZ, 'app/public/products')
SALIDA = os.path.join(HERE, 'encabezados')

ANCHO, ALTO = 1125, 600   # el tamaño que recomienda Meta para el header de imagen
AIRE = 36                 # margen arriba y abajo, en px de lienzo
MARGEN = 0.035            # aire alrededor del producto dentro del recorte

# La detección de fondo y del recuadro del producto es la del pipeline de
# anuncios: una sola implementación, para que las dos piezas encuadren igual.
_spec = importlib.util.spec_from_file_location(
    'prep_fotos', os.path.join(RAIZ, 'marketing/ig-ads/fotos/prep-fotos.py'))
prep_fotos = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(prep_fotos)


def encabezado(nombre):
    im = Image.open(os.path.join(ORIG, nombre)).convert('RGB')
    fondo = prep_fotos.color_fondo(im)
    bx0, by0, bx1, by1 = prep_fotos.recuadro_producto(im, fondo)

    w, h = im.size
    mx, my = (bx1 - bx0) * MARGEN, (by1 - by0) * MARGEN
    caja = (max(0, int((bx0 - mx) * w)), max(0, int((by0 - my) * h)),
            min(w, int((bx1 + mx) * w)), min(h, int((by1 + my) * h)))
    prod = im.crop(caja)

    # contain: el producto entra entero, tan grande como deje el lado que ate
    disp_w, disp_h = ANCHO - AIRE * 2, ALTO - AIRE * 2
    escala = min(disp_w / prod.size[0], disp_h / prod.size[1])
    prod = prod.resize((round(prod.size[0] * escala), round(prod.size[1] * escala)),
                       Image.LANCZOS)

    lienzo = Image.new('RGB', (ANCHO, ALTO), fondo)
    lienzo.paste(prod, ((ANCHO - prod.size[0]) // 2, (ALTO - prod.size[1]) // 2))

    os.makedirs(SALIDA, exist_ok=True)
    destino = os.path.join(SALIDA, os.path.splitext(nombre)[0] + '.jpg')
    lienzo.save(destino, quality=92, optimize=True, progressive=True)
    print(f'  {nombre:<28} {im.size} → {ANCHO}×{ALTO}  producto {prod.size}  '
          f'fondo #{fondo[0]:02X}{fondo[1]:02X}{fondo[2]:02X}')
    return destino


if __name__ == '__main__':
    fotos = sys.argv[1:] or ['box-simona.jpg']
    for f in fotos:
        encabezado(f)
