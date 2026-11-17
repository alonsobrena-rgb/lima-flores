"""Catálogo de Navidad: edita el PDF del año pasado (Canva, 9:16) en vez de
rehacerlo, porque el diseño navideño se mantiene.

    python3 -I marketing/catalogo/navidad.py <catalogo-del-año-pasado.pdf>

Antes hay que generar las páginas verticales de los productos nuevos y los
textos que se reescriben:

    FORMATO=historia node marketing/catalogo/build.mjs
    node marketing/catalogo/textos-navidad.mjs

Los cambios están escritos acá y no en el PDF a mano para que, si el cliente
pide otro ajuste, se vuelva a correr desde el original y no se acumulen
ediciones sobre ediciones.
"""
import json
import sys
from pathlib import Path

import pymupdf
from PIL import Image

AQUI = Path(__file__).resolve().parent
SALIDA = AQUI / "navidad" / "catalogo-navidad.pdf"

# Numeración del PDF original, contando desde 1, como la dice el cliente.
# Árbol grande, árbol decorado, centros de mesa y rosas con «Feliz Navidad».
# Centros de mesa (9) se quita entera: sus fotos no eran arreglos de Lima
# Flores y no hay reales; el cliente prefirió sacarla a dejar recuadros vacíos.
QUITAR = [6, 8, 9, 11]
SIN_FOTOS = []
# Las páginas nuevas entran después de la de Ramo Melissa, Box de rosas,
# Tulipanes y Arreglo Rossie: es la página de productos con flores.
DESPUES_DE = 10
NUEVAS = ["box-yani", "box-rogelia", "box-gaby-cafe"]
# Regalos corporativos: la foto vieja era el Arreglo Rossie repetido. Va la caja
# navideña, la toma de dentro de la caja porque muestra cómo llega el regalo.
# El rect es la parte visible del recuadro de Canva: la imagen original se
# salía por el borde izquierdo y Canva la recortaba con la página.
CAMBIAR_FOTO = {13: ((0, 492.19, 333.4, 948.19), "fotos/caja-navidena-dentro.jpg")}


def recorte(foto: Path, rect) -> bytes:
    """Recorta la foto a la proporción del recuadro, centrada. insert_image solo
    sabe encoger para que entre, y eso dejaría franjas vacías a los lados."""
    im = Image.open(foto).convert("RGB")
    w, h = im.size
    prop = (rect[2] - rect[0]) / (rect[3] - rect[1])
    if w / h > prop:
        nw = round(h * prop)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = round(w / prop)
        im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    import io
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=90)
    return buf.getvalue()


def main(origen: str) -> None:
    doc = pymupdf.open(origen)
    ancho, alto = doc[0].rect.width, doc[0].rect.height

    # Textos reescritos (textos-navidad.mjs). Se borra solo el texto viejo: la
    # redacción no toca imágenes ni dibujos y no pinta relleno, así que el
    # fondo y el logotipo que asoma por arriba del título quedan como estaban.
    manifiesto = AQUI / "navidad" / "textos" / "textos.json"
    if not manifiesto.exists():
        sys.exit("faltan los textos: corre antes node marketing/catalogo/textos-navidad.mjs")
    for t in json.loads(manifiesto.read_text(encoding="utf-8")):
        pag = doc[t["pagina"] - 1]
        for r in t["borrar"]:
            pag.add_redact_annot(pymupdf.Rect(r), fill=False)
        pag.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE,
                             graphics=pymupdf.PDF_REDACT_LINE_ART_NONE)
        with pymupdf.open(AQUI / "navidad" / "textos" / f"{t['id']}.pdf") as src:
            pag.show_pdf_page(pymupdf.Rect(t["rect"]), src, 0)

    for n in SIN_FOTOS:
        pag = doc[n - 1]
        # delete_image deja la imagen transparente: se ve el fondo de la página
        # y los marcos, que en Canva son trazos aparte, siguen en su lugar.
        for info in pag.get_images(full=True):
            pag.delete_image(info[0])

    for n, (rect, foto) in CAMBIAR_FOTO.items():
        pag = doc[n - 1]
        for info in pag.get_images(full=True):
            # Solo la foto del recuadro: el logotipo de arriba también es imagen.
            if any(r.intersects(pymupdf.Rect(rect)) for r in pag.get_image_rects(info[0])):
                pag.delete_image(info[0])
        pag.insert_image(pymupdf.Rect(rect), stream=recorte(AQUI / foto, rect))

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

    # Páginas enteras nuevas (textos-navidad.mjs). Van al final porque su
    # posición se cuenta sobre el PDF ya armado, con las quitadas fuera.
    for pg in json.loads((AQUI / "navidad" / "textos" / "paginas.json").read_text(encoding="utf-8")):
        with pymupdf.open(AQUI / "navidad" / "textos" / f"{pg['id']}.pdf") as src:
            doc.insert_pdf(src, start_at=pg["despues_de"])

    SALIDA.parent.mkdir(exist_ok=True)
    doc.save(SALIDA, garbage=4, deflate=True)
    print(f"{doc.page_count} páginas → {SALIDA.relative_to(AQUI.parent.parent)}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
