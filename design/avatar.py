#!/usr/bin/env python3
"""El logotipo en cuadrado, sobre blanco, para foto de perfil.

Instagram (y WhatsApp, y Google) **recortan la foto de perfil en círculo**, así
que un logotipo centrado en el cuadrado pierde las esquinas. Acá se encaja dentro
del círculo inscrito, con un margen: lo que se ve es el logotipo entero, no un
recorte con suerte.

El logotipo no se toca —ni se deforma, ni se recolorea, ni se le pone sombra—;
solo se apoya sobre el blanco del sistema y se centra ópticamente por su caja
útil (la del alfa), que no es la del archivo: el PNG trae aire a los lados y
centrar por el archivo deja el ramo corrido.

    python3 design/avatar.py            # el logotipo entero, 1080 px
    python3 design/avatar.py --ramo     # solo el ramo, para tamaños chicos

Deja los PNG en `marketing/marca/`.

Lo de `--ramo` tiene motivo: en la app, la foto de perfil se ve a 110 px de lado.
Ahí el ramo se reconoce y «Flores y Diseño» no se lee ni de milagro. Es la
decisión clásica de una foto de perfil —el símbolo, no la firma entera— y por eso
va como archivo aparte y no como el principal: partir el logotipo es una decisión
de la casa, no del que exporta.
"""
import pathlib
import sys

from PIL import Image, ImageDraw
import numpy as np

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / 'app/public/assets/logo.png'
DESTINO = RAIZ / 'marketing/marca'
BLANCO = '#FFFFFF'          # blanco total del sistema — DESIGN.md
DIAMETRO = 0.86             # cuánto del lado ocupa el círculo seguro
DENTRO = 0.90               # cuánto de ese círculo puede ocupar el logotipo


def recortar_al_alfa(im: Image.Image) -> Image.Image:
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > 8)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def solo_el_ramo(im: Image.Image) -> Image.Image:
    """El bloque de arriba del logotipo: el ramo, sin la caligrafía.

    El corte no va a ojo: entre el ramo y la firma hay una franja casi vacía, y se
    busca la fila con menos tinta de esa zona.
    """
    filas = (np.array(im)[:, :, 3] > 8).sum(1)
    zona = range(int(len(filas) * 0.34), int(len(filas) * 0.55))
    corte = min(zona, key=lambda y: filas[y])
    return recortar_al_alfa(im.crop((0, 0, im.width, corte)))


def avatar(lado: int = 1080, ramo: bool = False) -> Image.Image:
    logo = Image.open(ORIGEN).convert('RGBA')
    logo = solo_el_ramo(logo) if ramo else recortar_al_alfa(logo)

    # El logotipo es apaisado: manda su ancho contra la cuerda del círculo.
    cabe = lado * DIAMETRO * DENTRO
    escala = min(cabe / logo.width, cabe / logo.height)
    logo = logo.resize((round(logo.width * escala), round(logo.height * escala)), Image.LANCZOS)

    lienzo = Image.new('RGB', (lado, lado), BLANCO)
    lienzo.paste(logo, ((lado - logo.width) // 2, (lado - logo.height) // 2), logo)
    return lienzo


def main() -> None:
    ramo = '--ramo' in sys.argv
    medidas = [a for a in sys.argv[1:] if a.isdigit()]
    lado = int(medidas[0]) if medidas else 1080
    DESTINO.mkdir(parents=True, exist_ok=True)
    im = avatar(lado, ramo)
    salida = DESTINO / f'avatar{"-ramo" if ramo else ""}-{lado}.png'
    im.save(salida)

    # Prueba: el mismo cuadrado con el círculo que Instagram va a recortar.
    prueba = im.copy()
    d = ImageDraw.Draw(prueba)
    m = lado * (1 - 1) / 2
    d.ellipse([m, m, lado - m - 1, lado - m - 1], outline='#9E2B5E', width=max(2, lado // 360))
    prueba.save(DESTINO / f'avatar{"-ramo" if ramo else ""}-{lado}-prueba.png')
    print(salida, im.size, f'{salida.stat().st_size // 1024} kB')


if __name__ == '__main__':
    main()
