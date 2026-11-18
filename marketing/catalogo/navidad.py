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
# Árbol grande, pinos («Pinos que encantan»), árbol decorado, centros de mesa
# y rosas con «Feliz Navidad». Pinos (7) se había quitado en una sesión
# anterior y no quedó escrito acá; el cliente lo recordó el 17 de noviembre.
# Centros de mesa (9) se quita entera: sus fotos no eran arreglos de Lima
# Flores y no hay reales; el cliente prefirió sacarla a dejar recuadros vacíos.
# La portada de Canva se queda: se probó una nueva con la corona del moño
# rojo y el cliente prefirió la original (18 nov 2026).
# Orquídeas (12) sale a pedido del cliente, 18 nov 2026.
QUITAR = [6, 7, 8, 9, 11, 12]
SIN_FOTOS = []
# Las páginas nuevas entran después de la de Ramo Melissa, Box de rosas,
# Tulipanes y Arreglo Rossie: es la página de productos con flores.
DESPUES_DE = 10
# Box Gaby Café salió el 18 de noviembre de 2026, a pedido del cliente.
NUEVAS = ["box-yani", "box-rogelia"]
# Regalos corporativos (Cajita Noelia): la foto vieja era el Arreglo Rossie
# repetido. En el recuadro va la toma con los productos sueltos, al lado de la
# lista de lo que trae. El rect es la parte visible del recuadro de Canva: la
# imagen original se salía por el borde izquierdo y Canva la recortaba.
CAMBIAR_FOTO = {13: ((0, 492.19, 333.4, 948.19), "fotos/noelia-contenido.jpg")}
# Y abajo, la caja armada, entera (sin recorte: se calcula el alto con su
# proporción). En esa foto retocada la dirección decía «limaflorea.pe»; la
# «a» se cambió a mano por una «s» antes de guardarla en fotos/.
AGREGAR_FOTO = {13: ((205, 1050, 605), "fotos/noelia-armada.jpg")}


# Erratas del texto de Canva (página, línea tal cual está, línea corregida). Se
# reescribe la línea entera con la misma Space Mono, tamaño, color y línea base:
# es monoespaciada, así que una letra de más corre el resto un carácter y nada
# más. «6O» llevaba una letra O en vez de un cero.
ERRATAS = [
    (10, "TOQUES VERDE LIMON.", "TOQUES VERDE LIMÓN."),
    (10, "MEDIDAS: 60  CM DE", "MEDIDAS: 60 CM DE"),
    (10, "DEDIFERENTE COLOR.", "DE DIFERENTE COLOR."),
    (10, "55 CM DE DIAMETRO", "55 CM DE DIÁMETRO"),
    (10, "RAMO DETULIPANES", "RAMO DE TULIPANES"),
    (10, "MAS TE GUSTEN ", "MÁS TE GUSTEN"),
    (10, "MEDIDAS: 6O CM DE ALTO ", "MEDIDAS: 60 CM DE ALTO"),
    (12, "mantenimiento..", "mantenimiento."),
]
SPACE_MONO = AQUI / ".fontcache" / "SpaceMono-Regular.ttf"
SPACE_MONO_URL = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/spacemono/SpaceMono-Regular.ttf"


def corregir_erratas(doc) -> None:
    if not SPACE_MONO.exists():
        import urllib.request
        SPACE_MONO.parent.mkdir(exist_ok=True)
        urllib.request.urlretrieve(SPACE_MONO_URL, SPACE_MONO)
    for n, viejo, nuevo in ERRATAS:
        pag = doc[n - 1]
        span = next((s for b in pag.get_text("dict")["blocks"] for l in b.get("lines", [])
                     for s in l["spans"] if s["text"] == viejo), None)
        if span is None:
            sys.exit(f"errata no encontrada en la página {n}: {viejo!r}")
        pag.add_redact_annot(pymupdf.Rect(span["bbox"]), fill=False)
        pag.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE,
                             graphics=pymupdf.PDF_REDACT_LINE_ART_NONE)
        c = span["color"]
        pag.insert_text(span["origin"], nuevo, fontsize=span["size"], fontname="spacemono",
                        fontfile=str(SPACE_MONO),
                        color=((c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255))


SPACE_MONO_BOLD = AQUI / ".fontcache" / "SpaceMono-Bold.ttf"
SPACE_MONO_BOLD_URL = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/spacemono/SpaceMono-Bold.ttf"


def pagina_ramos(doc, raiz: Path) -> None:
    """Página 10 (ramos), pedidos del cliente del 18 de noviembre de 2026:
    - Tulipanes sale (foto, marco y texto).
    - Arreglo Rossie sube a ese hueco, para que no quede un agujero en medio.
    - Box de rosas lleva la foto de la tienda (box-de-luxe.jpg): la de Canva
      dejaba el box chico y perdido en el blanco.
    La redacción quita solo lo que cubre entero (REMOVE_IF_COVERED): el fondo
    de la página también es un dibujo y con «si lo toca» se borraba."""
    if not SPACE_MONO_BOLD.exists():
        import urllib.request
        urllib.request.urlretrieve(SPACE_MONO_BOLD_URL, SPACE_MONO_BOLD)
    pag = doc[9]
    dy = 202  # Rossie: del marco en y 892 al y 690, justo bajo el box de rosas
    spans = [s for b in pag.get_text("dict")["blocks"] for l in b.get("lines", [])
             for s in l["spans"] if s["bbox"][1] >= 985 and s["bbox"][0] < 460]
    rossie = pag.parent.extract_image(79)["image"]
    marco = pymupdf.Rect(494.97, 892.2, 749.76, 1196.93)
    for r in [pymupdf.Rect(20, 638, 375, 990), pymupdf.Rect(340, 700, 700, 870),
              pymupdf.Rect(60, 985, 460, 1175), pymupdf.Rect(460, 885, 790, 1205),
              pymupdf.Rect(450, 350, 735, 750)]:  # desde y 350: más arriba corta «MEDIDAS» del Ramo Melissa
        pag.add_redact_annot(r, fill=False)
    pag.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_REMOVE,
                         graphics=pymupdf.PDF_REDACT_LINE_ART_REMOVE_IF_COVERED)
    for s in spans:
        bold = "Bold" in s["font"]
        c = s["color"]
        pag.insert_text((s["origin"][0], s["origin"][1] - dy), s["text"].rstrip(), fontsize=s["size"],
                        fontname="spacemonob" if bold else "spacemono",
                        fontfile=str(SPACE_MONO_BOLD if bold else SPACE_MONO),
                        color=((c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255))
    # La foto de Rossie se mostraba más ancha que su marco (Canva recortaba con
    # el marco): se recorta a lo visible antes de volver a ponerla.
    nuevo = marco + (0, -dy, 0, -dy)
    pag.insert_image(nuevo, stream=recorte_bytes(rossie, (470, 892, 774, 1197), marco))
    pag.draw_rect(nuevo, color=(0, 0, 0), width=1.5)
    luxe = pymupdf.Rect(455.25, 362.64, 729.0, 642.9)
    pag.insert_image(luxe, stream=recorte(raiz / "app/public/products/box-de-luxe.jpg", tuple(luxe)))
    pag.draw_rect(luxe, color=(0, 0, 0), width=1.5)
    # Sin tulipanes queda libre el pie: los adornos dorados del propio original.
    # (show_pdf_page no acepta el mismo documento: se copia la página 4 aparte.)
    with pymupdf.open() as copia:
        copia.insert_pdf(doc, from_page=3, to_page=3)
        pag.show_pdf_page(pymupdf.Rect(40, 1150, 400, 1365), copia, 0, clip=pymupdf.Rect(450, 0, 810, 215))


def pagina_web(doc) -> None:
    """Última página (14 del original): la dirección de la web bajo el WhatsApp,
    pedida por el cliente el 18 nov 2026. Va donde estaba el adorno colgante,
    que baja y se achica para que entren los dos. Mismo verde y Space Mono
    Bold del «ATENDEMOS PEDIDOS», un punto más chica para no competir."""
    pag = doc[13]
    adorno = pymupdf.Pixmap(pymupdf.Pixmap(doc, 105), pymupdf.Pixmap(doc, 304))
    pag.add_redact_annot(pymupdf.Rect(360, 1345, 445, 1440), fill=False)
    pag.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_REMOVE,
                         graphics=pymupdf.PDF_REDACT_LINE_ART_NONE)
    web = "www.limaflores.pe"
    tam = 26
    fuente = pymupdf.Font(fontfile=str(SPACE_MONO_BOLD))
    ancho = fuente.text_length(web, fontsize=tam)
    pag.insert_text(((810 - ancho) / 2, 1374), web, fontsize=tam, fontname="spacemonob",
                    fontfile=str(SPACE_MONO_BOLD), color=(0x51 / 255, 0x5f / 255, 0x1e / 255))
    pag.insert_image(pymupdf.Rect(381, 1386, 429, 1440), pixmap=adorno)


def recorte_bytes(datos: bytes, mostrado, visible) -> bytes:
    """De una imagen mostrada en el rect «mostrado», devuelve solo la parte que
    cae dentro de «visible»."""
    import io
    im = Image.open(io.BytesIO(datos)).convert("RGB")
    w, h = im.size
    x0, y0, x1, y1 = mostrado
    fx = lambda x: round((x - x0) / (x1 - x0) * w)
    fy = lambda y: round((y - y0) / (y1 - y0) * h)
    im = im.crop((fx(max(visible.x0, x0)), fy(max(visible.y0, y0)), fx(min(visible.x1, x1)), fy(min(visible.y1, y1))))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=92)
    return buf.getvalue()


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

    corregir_erratas(doc)
    pagina_ramos(doc, AQUI.parent.parent)
    pagina_web(doc)

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

    for n, ((x0, y0, x1), foto) in AGREGAR_FOTO.items():
        w, h = Image.open(AQUI / foto).size
        rect = pymupdf.Rect(x0, y0, x1, y0 + (x1 - x0) * h / w)
        doc[n - 1].insert_image(rect, filename=str(AQUI / foto))

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

    # «Más regalos corporativos» y «Complementos» se veían apagadas junto a las de
    # Canva: se le ponen los mismos adornos dorados, tomados del original para
    # no inventar otros. Copos (vectoriales) de la esquina de la página 4 y los
    # colgantes de regalos de la página 13. Abajo, donde la página está vacía.
    paginas = json.loads((AQUI / "navidad" / "textos" / "paginas.json").read_text(encoding="utf-8"))
    for pg in paginas:
        if pg["id"] not in ("mas-regalos", "complementos", "centro-mesa-taller"):
            continue
        dest = doc[pg["despues_de"]]
        # En la galería las fotos bajan hasta y≈1245: los adornos van más
        # abajo y más chicos para no taparlas.
        # Con tres productos «Más regalos» también baja a la franja de abajo.
        # Centro de ciprés (el cliente la vio «calata»): en los huecos de la
        # galería en zigzag, bajo el precio de la derecha y sobre el texto de
        # la izquierda.
        copos, colg = {
            "mas-regalos": (pymupdf.Rect(30, 1262, 245, 1390), pymupdf.Rect(650, 1255, 760, 1385)),
            "centro-mesa-taller": (pymupdf.Rect(470, 600, 730, 755), pymupdf.Rect(150, 790, 265, 927)),
        }.get(pg["id"], (pymupdf.Rect(30, 1262, 265, 1402), pymupdf.Rect(640, 1255, 760, 1398)))
        with pymupdf.open(origen) as orig:
            dest.show_pdf_page(copos, orig, 3, clip=pymupdf.Rect(450, 0, 810, 215))
            colgantes = orig.extract_image(97)
            mascara = orig.extract_image(294)
            pix = pymupdf.Pixmap(pymupdf.Pixmap(colgantes["image"]), pymupdf.Pixmap(mascara["image"]))
            dest.insert_image(colg, pixmap=pix)

    SALIDA.parent.mkdir(exist_ok=True)
    doc.save(SALIDA, garbage=4, deflate=True)
    print(f"{doc.page_count} páginas → {SALIDA.relative_to(AQUI.parent.parent)}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
