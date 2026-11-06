"""Catálogo de Navidad: edita el PDF del año pasado (Canva, 9:16) en vez de
rehacerlo, porque el diseño navideño se mantiene.

    python3 -I marketing/catalogo/navidad.py <catalogo-del-año-pasado.pdf>

Antes hay que generar las páginas verticales de los productos nuevos:

    FORMATO=historia node marketing/catalogo/build.mjs

Los cambios están escritos acá y no en el PDF a mano para que, si el cliente
pide otro ajuste, se vuelva a correr desde el original y no se acumulen
ediciones sobre ediciones.
"""
import sys
from pathlib import Path

import pymupdf

AQUI = Path(__file__).resolve().parent
SALIDA = AQUI / "navidad" / "catalogo-navidad.pdf"

# Numeración del PDF original, contando desde 1, como la dice el cliente.
QUITAR = [6, 8, 11]  # árbol grande, árbol decorado, rosas con «Feliz Navidad»
# Centros de mesa: las fotos no son arreglos de Lima Flores. Se quitan y se
# dejan los recuadros vacíos para las fotos reales.
SIN_FOTOS = [9]
# Las páginas nuevas entran después de la de Ramo Melissa, Box de rosas,
# Tulipanes y Arreglo Rossie: es la página de productos con flores.
DESPUES_DE = 10
NUEVAS = ["box-yani", "box-rogelia", "box-gaby-cafe"]


def main(origen: str) -> None:
    doc = pymupdf.open(origen)
    ancho, alto = doc[0].rect.width, doc[0].rect.height

    for n in SIN_FOTOS:
        pag = doc[n - 1]
        # delete_image deja la imagen transparente: se ve el fondo de la página
        # y los marcos, que en Canva son trazos aparte, siguen en su lugar.
        for info in pag.get_images(full=True):
            pag.delete_image(info[0])

    # Las nuevas se insertan antes de borrar, mientras la numeración del
    # original todavía vale.
    for k, pid in enumerate(NUEVAS):
        jpg = AQUI / "paginas-historia" / f"{pid}.jpg"
        if not jpg.exists():
            sys.exit(f"falta {jpg}: corre antes FORMATO=historia node marketing/catalogo/build.mjs")
        nueva = doc.new_page(pno=DESPUES_DE + k, width=ancho, height=alto)
        nueva.insert_image(nueva.rect, filename=str(jpg))

    # Las páginas a quitar corren de lugar las que están después de la
    # inserción; se calculan sobre la numeración ya con las nuevas adentro.
    corridas = [n - 1 + (len(NUEVAS) if n > DESPUES_DE else 0) for n in QUITAR]
    doc.delete_pages(corridas)

    SALIDA.parent.mkdir(exist_ok=True)
    doc.save(SALIDA, garbage=4, deflate=True)
    print(f"{doc.page_count} páginas → {SALIDA.relative_to(AQUI.parent.parent)}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
