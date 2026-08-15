#!/usr/bin/env python3
"""Baja las dos familias del sistema y las deja servidas por nosotros.

El sitio las pedía con un `@import` a Google Fonts. Eso ata cada carga a un
tercero: si la red del cliente tarda o el dominio está bloqueado, el navegador
pinta con la tipografía de respaldo —Georgia y la de sistema— y la página se ve
con otra letra. Con las fuentes en `app/public/fonts/` eso no puede pasar: se
sirven del mismo origen que el HTML.

Solo el subconjunto **latin**: ñ, las vocales acentuadas, las comillas angulares
y la raya larga están todas ahí. `latin-ext` es para otros idiomas y pesaba el
doble sin pintar un carácter nuestro.

    python3 design/fuentes.py        # rehace app/public/fonts/ y escribe el CSS

Imprime el bloque `@font-face` para pegar en `app/src/index.css`.
"""
import pathlib
import re
import urllib.request

RAIZ = pathlib.Path(__file__).resolve().parent.parent
DESTINO = RAIZ / 'app/public/fonts'
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

# Lo que el sitio usa de verdad: `.display` es Cormorant itálica 500 y
# `font-display` sale en 300/400/600; Jost va de 300 a 600.
FAMILIAS = [
    ('Cormorant Garamond', 'cormorant', 'ital,wght@0,300;0,400;0,500;0,600;1,400;1,500'),
    ('Jost', 'jost', 'wght@300;400;500;600'),
]


def css_de(familia: str, ejes: str) -> str:
    url = f'https://fonts.googleapis.com/css2?family={familia.replace(" ", "+")}:{ejes}&display=swap'
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    return urllib.request.urlopen(req).read().decode()


def main() -> None:
    DESTINO.mkdir(parents=True, exist_ok=True)
    for viejo in DESTINO.glob('*.woff2'):
        viejo.unlink()

    bloques = []
    for familia, mote, ejes in FAMILIAS:
        css = css_de(familia, ejes)
        # Cada @font-face viene precedido por un comentario con su subconjunto.
        for subconjunto, cuerpo in re.findall(r'/\* (\S+) \*/\s*(@font-face \{.*?\})', css, re.S):
            if subconjunto != 'latin':
                continue
            estilo = re.search(r'font-style: (\w+)', cuerpo).group(1)
            peso = re.search(r'font-weight: (\d+)', cuerpo).group(1)
            url = re.search(r'url\((https://[^)]+\.woff2)\)', cuerpo).group(1)
            nombre = f'{mote}-{peso}{"i" if estilo == "italic" else ""}.woff2'
            datos = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA})).read()
            (DESTINO / nombre).write_bytes(datos)
            rango = re.search(r'unicode-range: ([^;]+);', cuerpo).group(1)
            bloques.append(
                '@font-face {\n'
                f"  font-family: '{familia}';\n"
                f'  font-style: {estilo};\n'
                f'  font-weight: {peso};\n'
                '  font-display: swap;\n'
                f"  src: url('/fonts/{nombre}') format('woff2');\n"
                f'  unicode-range: {rango};\n'
                '}'
            )
            print(f'  {nombre:<22} {len(datos) // 1024} kB')

    print('\n' + '\n'.join(bloques))


if __name__ == '__main__':
    main()
