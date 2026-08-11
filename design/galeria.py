#!/usr/bin/env python3
"""Arma la galería que se le manda a la clienta para que elija dirección.

Depende de que `build.py` ya haya dejado las capturas en salida/capturas/.
No inventa nada: cada dirección se muestra con su captura real, la de
escritorio y la de teléfono, a página completa.

La página que envuelve las tres direcciones es deliberadamente neutra — gris de
pared de galería, tipografía de ficha técnica — porque si la galería tomara
prestada la paleta de alguna de las tres, esa saldría con ventaja.

    python3 design/build.py && python3 design/galeria.py

Salida: salida/galeria.html (autocontenida, se puede mandar por WhatsApp).
"""
import base64
import io
import os

from PIL import Image

import build as B

HERE = B.HERE
CAPS = os.path.join(B.SALIDA, 'capturas')

# Cada dirección: cómo se llama, qué propone y qué cuesta elegirla.
# `firma` es el color con el que se rotula en la galería: el suyo, para que se
# reconozca de lejos sin que la página tome partido.
DIRECCIONES = [
    dict(
        clave='florencia', letra='A', nombre='Florencia', firma='#9E2B5E',
        lema='Contención. Aire, blanco total, y una sola rosa.',
        parrafo='La más elegante de las tres, y la que ya existía: es el sistema '
                'que armaste en Claude Design, corregido. La portada respira antes '
                'de que aparezca el catálogo, los títulos van en Cormorant Garamond '
                'con itálicas de verdad, y el rosa aparece poco — un botón, un '
                'precio, un enlace. Vende por deseo, no por insistencia.',
        paleta=[('#FFFFFF', 'Blanco'), ('#9E2B5E', 'Rosa'),
                ('#88A65C', 'Verde'), ('#2A2623', 'Tinta')],
        tipos='Cormorant Garamond para títulos, Jost para texto y UI',
        gana=['La más elegante. Se paga sola en percepción de precio.',
              'El rosa sale del ramo del logo: el color es de la marca, no prestado.',
              'Las itálicas del Cormorant conversan con la caligrafía del logotipo.'],
        cuesta=['Es la que menos empuja a comprar: hay que bajar para ver el catálogo.',
                'Al ser la más vacía, amplifica cualquier foto floja.'],
    ),
    dict(
        clave='paris', letra='B', nombre='París', firma='#B33A48',
        lema='La etiqueta atada. Papel, filete de tinta y un listón.',
        parrafo='La tienda de la esquina con el toldo a rayas. Todo lo que es dato '
                '— precio, medida, categoría — se compone como una etiqueta de papel '
                'recortada, con filete de tinta y esquinas casi rectas. El azul lino '
                'de la cinta es el 1,4% del logo: los toques celestes de la acuarela.',
        paleta=[('#FBF6EC', 'Papel'), ('#B33A48', 'Listón'),
                ('#E8B1A6', 'Durazno'), ('#61709B', 'Azul lino')],
        tipos='Bodoni Moda para títulos, Karla para texto, precios y etiquetas',
        gana=['La etiqueta con precio y “Agregar” va en cada pieza, siempre visible.',
              'Vende insistiendo con elegancia, no gritando.',
              'Bodoni le da un aire de perfumería que ninguna de las otras tiene.'],
        cuesta=['Bodoni es de contraste alto: en pantalla chica se ve frágil.',
                'Es la más ornamentada. Si el catálogo crece mucho, se recarga.'],
    ),
    dict(
        clave='amsterdam', letra='C', nombre='Ámsterdam', firma='#0B6E30',
        lema='El puesto del mercado. Entras y ya estás frente a los baldes.',
        parrafo='La única que usa el verde como color de marca — y es raro, porque '
                'el verde es el 29% del ramo del logo y estaba sin usar. Acá no hay '
                'portada: entras y ya estás en el catálogo. Títulos en minúscula, '
                'todo un punto más grande y más cerca. El encanto no es el vacío, '
                'es la abundancia ordenada.',
        paleta=[('#F6F1DF', 'Crema'), ('#0B6E30', 'Verde pintado'),
                ('#D95F7D', 'Rosa tulipán'), ('#F1E5B9', 'Mantequilla')],
        tipos='Petrona en minúsculas para títulos, Hanken Grotesk para texto',
        gana=['La más vendedora de las tres, y sin gritar: vende mostrando.',
              'El catálogo es lo primero que se ve. Cero scroll para empezar a comprar.',
              'La más cercana y la más fácil de leer en teléfono.'],
        cuesta=['Con la grilla llena, las fotos disparejas se vuelven imposibles de esconder.',
                'Es la menos “de lujo” de las tres. Gana calidez, cede solemnidad.'],
    ),
]


def _uri(im, calidad):
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=calidad, optimize=True, progressive=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


def _jpg(ruta, ancho, calidad=80):
    im = Image.open(ruta).convert('RGB')
    if im.width > ancho:
        im = im.resize((ancho, round(ancho * im.height / im.width)), Image.LANCZOS)
    return _uri(im, calidad)


def _tiras(ruta, partes, calidad=82):
    """La captura de teléfono es larguísima. Se corta en tiras verticales para
    que se lea completa al lado de la de escritorio y no en un chorizo."""
    im = Image.open(ruta).convert('RGB')
    paso = -(-im.height // partes)
    return [_uri(im.crop((0, i * paso, im.width, min((i + 1) * paso, im.height))), calidad)
            for i in range(partes)]


# Pared de galería: gris frío con una pizca de verde, láminas montadas encima.
# Los tokens se declaran completos en :root y solo se redefinen para oscuro, así
# la página se sostiene con o sin preferencia declarada.
CSS = """
*{box-sizing:border-box}
:root{
  --muro:#E4E6E1; --lamina:#FBFBF9; --borde:#CFD2CB;
  --tinta:#14171A; --tinta-60:#585F63; --tinta-30:#8A9095;
  --sombra:0 1px 2px rgba(20,23,26,.06),0 8px 28px rgba(20,23,26,.08);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --muro:#15181A; --lamina:#1E2225; --borde:#333A3D;
    --tinta:#ECEEEA; --tinta-60:#A0A7AB; --tinta-30:#767D82;
    --sombra:0 1px 2px rgba(0,0,0,.4),0 10px 30px rgba(0,0,0,.34);
  }
}
:root[data-theme="dark"]{
  --muro:#15181A; --lamina:#1E2225; --borde:#333A3D;
  --tinta:#ECEEEA; --tinta-60:#A0A7AB; --tinta-30:#767D82;
  --sombra:0 1px 2px rgba(0,0,0,.4),0 10px 30px rgba(0,0,0,.34);
}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--muro);color:var(--tinta);
  font:400 16.5px/1.65 'IBM Plex Sans',ui-sans-serif,system-ui,sans-serif}
img{display:block;max-width:100%;height:auto}
.wrap{max-width:1120px;margin:0 auto;padding:0 28px}

/* rótulos: todo lo que es dato y no prosa va en mono */
.rot{font:500 11px/1.4 'IBM Plex Mono',ui-monospace,monospace;letter-spacing:.13em;
  text-transform:uppercase;color:var(--tinta-30);margin:0 0 12px}

.tapa{padding-block:78px 54px}
.tapa .marca{height:60px;width:auto;margin-bottom:32px}
h1{font-size:clamp(31px,4.6vw,50px);line-height:1.08;letter-spacing:-.025em;
  font-weight:600;margin:0 0 22px;max-width:19ch;text-wrap:balance}
.tapa p{max-width:64ch;color:var(--tinta-60);margin:0 0 15px}
.indice{display:flex;gap:10px;flex-wrap:wrap;margin-top:32px}
.indice a{font:500 13px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;
  text-decoration:none;color:var(--tinta);background:var(--lamina);
  border:1px solid var(--borde);border-radius:999px;padding:11px 17px;
  transition:transform .15s ease}
.indice a:hover{transform:translateY(-2px)}
.indice a:focus-visible{outline:2px solid var(--tinta);outline-offset:3px}
.indice a i{font-style:normal;display:inline-block;width:8px;height:8px;
  border-radius:50%;margin-right:8px;vertical-align:1px}

/* cada dirección va montada en una lámina sobre la pared */
.dir{padding-block:0 46px}
.lam{background:var(--lamina);border:1px solid var(--borde);border-radius:4px;
  box-shadow:var(--sombra);padding:44px clamp(22px,3.4vw,46px) 46px}
.cab{display:flex;align-items:baseline;gap:16px;flex-wrap:wrap}
.chapa{font:500 11px/1 'IBM Plex Mono',monospace;letter-spacing:.14em;
  color:#fff;padding:7px 11px;border-radius:3px}
h2{font-size:clamp(27px,3.6vw,40px);line-height:1.05;letter-spacing:-.025em;
  font-weight:600;margin:0}
.lema{font-size:clamp(17px,2.1vw,21px);line-height:1.4;margin:16px 0 0;max-width:50ch}
.cuerpo{color:var(--tinta-60);max-width:64ch;margin:15px 0 0}

.ficha{display:grid;grid-template-columns:auto 1fr;gap:14px 34px;margin-top:38px;
  padding-top:26px;border-top:1px solid var(--borde);align-items:start}
.ficha dt{font:500 11px/1.9 'IBM Plex Mono',monospace;letter-spacing:.13em;
  text-transform:uppercase;color:var(--tinta-30);white-space:nowrap}
.ficha dd{margin:0}
.paleta{display:flex;gap:8px;flex-wrap:wrap}
.tono{width:58px;font:400 10px/1.3 'IBM Plex Mono',monospace;color:var(--tinta-30);
  text-align:center;letter-spacing:0;overflow-wrap:break-word}
.tono i{display:block;width:58px;height:40px;border-radius:2px;
  box-shadow:inset 0 0 0 1px rgba(20,23,26,.2);margin-bottom:6px}
.ficha ul{margin:0;padding-left:17px}
.ficha li{margin-bottom:6px;color:var(--tinta-60)}
.ficha li::marker{color:var(--tinta-30)}

.pantallas{margin-top:40px}
.tiras{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:34px;
  align-items:start}
.placa{border:1px solid var(--borde);border-radius:3px;overflow:hidden;
  background:var(--muro)}
.pie{font:400 11px/1.4 'IBM Plex Mono',monospace;letter-spacing:.08em;
  text-transform:uppercase;color:var(--tinta-30);margin:10px 0 0}

.cierre{padding-block:24px 96px}
.tabla{overflow-x:auto;margin-top:26px;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse;width:100%;min-width:680px;font-size:15px;
  font-variant-numeric:tabular-nums}
th,td{text-align:left;padding:14px;border-bottom:1px solid var(--borde);
  vertical-align:top}
th{font:500 11px/1.4 'IBM Plex Mono',monospace;letter-spacing:.13em;
  text-transform:uppercase;color:var(--tinta-30)}
td:first-child{font-weight:600;white-space:nowrap}
.nota{margin-top:36px;background:var(--lamina);border:1px solid var(--borde);
  border-radius:4px;box-shadow:var(--sombra);padding:26px 28px;color:var(--tinta-60)}
.nota p{margin:0 0 12px;max-width:70ch}
.nota p:last-child{margin:0}
.nota b{color:var(--tinta);font-weight:600}

@media (prefers-reduced-motion:reduce){*{transition:none!important}}
@media (max-width:860px){
  .wrap{padding:0 18px}
  .tapa{padding-block:46px 34px}
  .lam{padding:30px 20px 34px}
  .ficha{grid-template-columns:1fr;gap:6px 0}
  .ficha dt{margin-top:16px}
  .tiras{grid-template-columns:1fr;gap:20px}
  .cierre{padding-block:12px 64px}
}
"""


def bloque(d):
    esc = _jpg(os.path.join(CAPS, f"{d['clave']}-desktop.png"), 1000, 78)
    tiras = ''.join(
        f'<div class="placa"><img src="{u}" alt="Dirección {d["letra"]} en teléfono,'
        f' parte {i} de 3"></div>'
        for i, u in enumerate(_tiras(os.path.join(CAPS, f"{d['clave']}-movil.png"), 3), 1))

    tonos = ''.join(f'<div class="tono"><i style="background:{hexa}"></i>{nombre}</div>'
                    for hexa, nombre in d['paleta'])
    gana = ''.join(f'<li>{x}</li>' for x in d['gana'])
    cuesta = ''.join(f'<li>{x}</li>' for x in d['cuesta'])

    return f"""
<section class="dir" id="{d['clave']}"><div class="wrap"><div class="lam">
  <div class="cab">
    <span class="chapa" style="background:{d['firma']}">DIRECCIÓN {d['letra']}</span>
    <h2>{d['nombre']}</h2>
  </div>
  <p class="lema">{d['lema']}</p>
  <p class="cuerpo">{d['parrafo']}</p>

  <dl class="ficha">
    <dt>Paleta</dt><dd><div class="paleta">{tonos}</div></dd>
    <dt>Tipografía</dt><dd>{d['tipos']}</dd>
    <dt>Qué gana</dt><dd><ul>{gana}</ul></dd>
    <dt>Qué cuesta</dt><dd><ul>{cuesta}</ul></dd>
  </dl>

  <div class="pantallas">
    <div class="placa"><img src="{esc}" alt="Dirección {d['letra']} vista en computadora"></div>
    <p class="pie">Computadora · página completa</p>
    <div class="tiras">{tiras}</div>
    <p class="pie">Teléfono · página completa, leída de izquierda a derecha</p>
  </div>
</div></div></section>"""


def main():
    faltan = [d['clave'] for d in DIRECCIONES
              if not os.path.exists(os.path.join(CAPS, f"{d['clave']}-desktop.png"))]
    if faltan:
        raise SystemExit(f'faltan capturas ({", ".join(faltan)}): corre design/build.py')

    indice = ''.join(
        f'<a href="#{d["clave"]}"><i style="background:{d["firma"]}"></i>'
        f'{d["letra"]} · {d["nombre"]}</a>' for d in DIRECCIONES)
    filas = ''.join(f"""
    <tr><td>{d['letra']} · {d['nombre']}</td><td>{d['lema']}</td>
    <td>{d['gana'][0]}</td><td>{d['cuesta'][0]}</td></tr>""" for d in DIRECCIONES)

    html = f"""<title>Lima Flores · tres direcciones de diseño</title>
<style>{B.css_fuentes('galeria')}
{CSS}</style>

<header class="tapa"><div class="wrap">
  <img class="marca" src="{B.imagen('logo.png', 420)}" alt="Lima Flores">
  <h1>Tres maneras de que la tienda se vea como Lima&nbsp;Flores</h1>
  <p>Las tres son la misma tienda: la misma portada, el mismo catálogo, la misma
  ficha de producto, con las fotos y los precios que hoy están en el sistema. Lo
  único que cambia es la marca — el color, la tipografía y en qué orden aparecen
  las cosas. Así la comparación es entre marcas y no entre maquetas.</p>
  <p><b>El logo no se toca, y los colores tampoco se inventaron.</b> Los tres
  juegos de color salen de medir el ramo acuarelado del logotipo: resulta ser
  52% rosa, 29% verde, 13% durazno y crema, y 1,4% azul. Cada dirección elige
  cuál de esas familias manda.</p>
  <p>La idea es elegir una. Después se puede ajustar sobre la elegida — mover un
  color, subir el catálogo, suavizar un título — pero conviene partir de una sola.</p>
  <nav class="indice">{indice}</nav>
</div></header>

{''.join(bloque(d) for d in DIRECCIONES)}

<section class="cierre"><div class="wrap">
  <p class="rot">Resumen</p>
  <h2>Las tres, en una línea</h2>
  <div class="tabla"><table>
    <tr><th>Dirección</th><th>Propuesta</th><th>Su mayor virtud</th>
        <th>Su mayor costo</th></tr>
    {filas}
  </table></div>
  <div class="nota">
    <p><b>Qué mirar para decidir.</b> No cuál se ve más linda en la captura, sino
    cuál se parece más a cómo quieres que te recuerden: la florería elegante que
    se hace desear (Florencia), la tienda de barrio que te atiende y te etiqueta
    el ramo (París), o el puesto lleno de flores al que entras a comprar
    (Ámsterdam).</p>
    <p>Si la duda es entre vender más y verse mejor: Ámsterdam vende más hoy,
    Florencia sostiene mejor el precio en el tiempo, y París está en el medio.</p>
    <p>Todo lo que se lee en las tres — precios, medidas, qué trae cada caja,
    cómo funciona la entrega — sale del catálogo real. Las entregas son al día
    siguiente: se elige el día y una franja de 30 minutos. Ninguna dirección
    promete entrega el mismo día.</p>
  </div>
</div></section>"""

    destino = os.path.join(B.SALIDA, 'galeria.html')
    open(destino, 'w', encoding='utf-8').write(html)
    print(f'  ✓ galeria.html   {round(os.path.getsize(destino) / 1024)} KB')


if __name__ == '__main__':
    main()
