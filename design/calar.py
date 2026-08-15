#!/usr/bin/env python3
"""Calados de fotos de producto: quita el fondo y recorta a la caja del ramo.

Los calados viven en `app/public/calados/` y se usan en las cabeceras, donde el
producto pasa por delante del titular como las orquídeas en la portada. Sobre
blanco el recorte solo tiene que soltar la pared del estudio: ni sombra propia ni
borde, que se notarían.

    pip install rembg onnxruntime          # el modelo u2net se baja solo
    python3 design/calar.py products/funebre-corona-eternidad.jpg

Deja los PNG en `/tmp/calados/`; míralos sobre blanco antes de exportarlos a
webp y meterlos en `app/public/calados/`. **No todas las fotos calan bien**: las
tomas cenitales quedan como una mancha y las varas finas de orquídea se pierden.
Sirven las siluetas reconocibles —una corona sobre trípode, un ramo de pie—, que
además son las que dejan huecos por donde se lee el titular.

Ojo con lo de siempre: esto recorta una foto real del catálogo, no inventa una
flor. Ninguna imagen de producto se genera con IA salvo que el cliente lo pida.
"""
import sys, pathlib
from PIL import Image, ImageFilter
import numpy as np
from rembg import remove, new_session

PUB = pathlib.Path(__file__).resolve().parent.parent / 'app/public'
OUT = pathlib.Path('/tmp/calados')
OUT.mkdir(exist_ok=True)
SES = new_session('u2net')


def calar(rel, destino=None, ancho_max=1800):
    src = PUB / rel
    im = Image.open(src).convert('RGB')
    # Trabajar a resolución cómoda: el modelo entra a 320 px, no hace falta 2560.
    if im.width > ancho_max:
        im = im.resize((ancho_max, round(im.height * ancho_max / im.width)), Image.LANCZOS)
    out = remove(im, session=SES, post_process_mask=True).convert('RGBA')

    a = np.array(out)[:, :, 3]
    ys, xs = np.where(a > 12)
    if len(xs) == 0:
        raise SystemExit(f'{rel}: máscara vacía')
    out = out.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

    # Un pelo de suavizado en el canal alfa: el borde del modelo viene duro y
    # sobre blanco se nota el diente de sierra.
    r, g, b, al = out.split()
    al = al.filter(ImageFilter.GaussianBlur(0.6))
    out = Image.merge('RGBA', (r, g, b, al))

    nombre = destino or (pathlib.Path(rel).stem + '.png')
    out.save(OUT / nombre)
    print(nombre.ljust(42), out.size)
    return out


if __name__ == '__main__':
    for rel in sys.argv[1:]:
        calar(rel)
