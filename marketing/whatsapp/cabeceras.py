#!/usr/bin/env python3
"""Prepara la foto de cabecera de cada plantilla de WhatsApp.

El problema, ya anotado en `box-simona.md`: las tomas del catálogo son
cuadradas o verticales y el encabezado de una plantilla se muestra apaisado.
Metida tal cual, WhatsApp recorta — y lo que recorta es el producto.

La salida es 1.91:1 con el producto **entero**, nunca un recorte que lo corte
(regla 1 de .claude/skills/piezas-graficas/SKILL.md).

Lo que no funcionó, y por qué está escrito así ahora: el primer intento metía
la foto contenida sobre un lienzo pintado del color medido en las esquinas,
igual que `marketing/ig-ads/fotos/prep-fotos.py`. Ahí el relleno es un color
plano y **el ciclorama de estas tomas es un degradado**, así que el borde de la
foto se veía como un rectángulo dentro de la cabecera: exactamente el recuadro
que la regla 2 prohíbe. Es el mismo hallazgo que ya tenía anotado `cifra` en
el README de ig-ads.

Ahora el relleno sale de la propia foto: se estira su franja de borde, que es
fondo puro, hasta cubrir los lados. El degradado continúa fila por fila y la
unión no existe, porque el relleno arranca con los mismos píxeles que el borde.

Para que esa franja sea fondo y no producto, el recorte se hace al recuadro del
producto **más un margen** que se toma del fondo que la toma ya traía alrededor
(las tres tienen entre 5% y 20% por lado). Así el producto queda lo más grande
que da el alto y los bordes siguen siendo ciclorama.

    python3 marketing/whatsapp/cabeceras.py
"""
import json
import os

from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../..'))
ORIG = os.path.join(ROOT, 'app/public/products')
OUT = os.path.join(HERE, 'cabeceras')

# 1.91:1 es lo que la industria recomienda para que el cliente de WhatsApp no
# recorte ni haga zoom. Meta solo la impone en carruseles; para una cabecera de
# imagen no documenta proporción, así que se usa la segura.
LIENZO = (1200, 628)
TOLERANCIA = 26     # cuánto se puede alejar un píxel del fondo y seguir siéndolo
AIRE = 0.04         # margen de fondo que se deja alrededor del producto
FRANJA = 10         # ancho de la franja de borde que se estira para rellenar
MAX_BYTES = 5 * 1024 * 1024   # tope de Meta para el archivo de muestra


def color_fondo(im):
    """El fondo sale de las cuatro esquinas: es lo único que en una toma de
    catálogo seguro no es producto. Se promedia reduciendo cada esquina a 1×1,
    que es lo mismo que la media y no pasa por `getdata()`."""
    w, h = im.size
    m = max(2, min(w, h) // 40)
    esquinas = [(0, 0, m, m), (w - m, 0, w, m), (0, h - m, m, h), (w - m, h - m, w, h)]
    px = [im.crop(c).convert('RGB').resize((1, 1), Image.LANCZOS).getpixel((0, 0)) for c in esquinas]
    return tuple(sum(p[i] for p in px) // len(px) for i in range(3))


def recuadro_producto(im, fondo):
    """El rectángulo que ocupa el producto: todo lo que no es fondo."""
    chico = im.convert('RGB')
    chico.thumbnail((400, 400))
    w, h = chico.size
    px = chico.load()
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if (abs(r - fondo[0]) + abs(g - fondo[1]) + abs(b - fondo[2])) > TOLERANCIA * 3:
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    ew, eh = im.size[0] / w, im.size[1] / h
    return (int(min(xs) * ew), int(min(ys) * eh), int((max(xs) + 1) * ew), int((max(ys) + 1) * eh))


def recorte_con_aire(im, caja):
    """El recuadro del producto más un margen de fondo por lado. El margen es lo
    que después se estira: si el recorte llegara al ras del producto, el relleno
    de los lados sería producto embarrado en vez de ciclorama."""
    W, H = im.size
    x0, y0, x1, y1 = caja
    px = int((x1 - x0) * AIRE)
    py = int((y1 - y0) * AIRE)
    return (max(0, x0 - px), max(0, y0 - py), min(W, x1 + px), min(H, y1 + py))


def rellena_lados(foto, lienzo_size):
    """Pone la foto centrada y cubre lo que sobra a los lados estirando su
    propia franja de borde. Devuelve el lienzo y el margen usado."""
    lw, lh = lienzo_size
    fw, fh = foto.size
    x = (lw - fw) // 2
    lienzo = Image.new('RGB', lienzo_size)

    if x > 0:
        izq = foto.crop((0, 0, FRANJA, fh)).resize((x, fh), Image.LANCZOS)
        der = foto.crop((fw - FRANJA, 0, fw, fh)).resize((lw - fw - x, fh), Image.LANCZOS)
        # Un pelo de desenfoque: la franja trae el grano del sensor y estirarlo
        # 30 veces lo convierte en rayas horizontales.
        izq = izq.filter(ImageFilter.GaussianBlur(1.2))
        der = der.filter(ImageFilter.GaussianBlur(1.2))
        lienzo.paste(izq, (0, 0))
        lienzo.paste(der, (x + fw, 0))
    lienzo.paste(foto, (max(0, x), 0))
    return lienzo


def main():
    datos = json.load(open(os.path.join(HERE, 'plantillas.json'), encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)
    manifiesto = {}
    lw, lh = LIENZO

    for t in datos['plantillas']:
        im = Image.open(os.path.join(ORIG, t['photo'])).convert('RGB')
        fondo = color_fondo(im)
        caja = recuadro_producto(im, fondo)
        if caja:
            im = im.crop(recorte_con_aire(im, caja))

        # Se escala al alto del lienzo: así el producto queda lo más grande
        # posible y arriba y abajo no hay relleno, o sea no hay unión que tapar.
        escala = lh / im.size[1]
        if im.size[0] * escala > lw:          # una toma apaisada: manda el ancho
            escala = lw / im.size[0]
        foto = im.resize((max(1, round(im.size[0] * escala)),
                          max(1, round(im.size[1] * escala))), Image.LANCZOS)

        if foto.size[1] < lh:                  # solo pasa con tomas apaisadas
            marco = Image.new('RGB', LIENZO, fondo)
            marco.paste(foto, ((lw - foto.size[0]) // 2, (lh - foto.size[1]) // 2))
            lienzo = marco
        else:
            lienzo = rellena_lados(foto, LIENZO)

        dst = os.path.join(OUT, f"{t['name']}.jpg")
        lienzo.save(dst, 'JPEG', quality=88, optimize=True)
        peso = os.path.getsize(dst)
        if peso > MAX_BYTES:
            raise SystemExit(f"{t['name']}: {peso} bytes, por encima del tope de Meta ({MAX_BYTES}).")
        if lienzo.size != LIENZO:
            raise SystemExit(f"{t['name']}: salió {lienzo.size} y tenía que ser {LIENZO}.")

        manifiesto[t['name']] = {
            'foto': t['photo'],
            'fondo': '#%02X%02X%02X' % fondo,
            'lienzo': list(LIENZO),
            'foto_en_lienzo': list(foto.size),
        }
        print(f"  ✓ {t['name']:<18} {t['photo']:<22} fondo #%02X%02X%02X" % fondo
              + f"  foto {foto.size[0]}×{foto.size[1]} ({round(100 * foto.size[0] / lw)}% del ancho)"
              + f"  {peso // 1024} KB")

    json.dump(manifiesto, open(os.path.join(OUT, 'cabeceras.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2, sort_keys=True)
    print(f"\n{len(manifiesto)} cabeceras en marketing/whatsapp/cabeceras/")


if __name__ == '__main__':
    main()
