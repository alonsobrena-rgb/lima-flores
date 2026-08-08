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
        clave='a', letra='A', nombre='Mercado', firma='#C4471F',
        lema='El catálogo manda. Entras y ya estás comprando.',
        parrafo='Es la más directa de las tres. La foto grande vende el ánimo, '
                'pero abajo aparece el catálogo casi de inmediato, con el precio '
                'siempre visible y el botón de agregar en cada pieza. Los tres '
                'puntos del inicio responden lo que la gente pregunta antes de '
                'pagar: cuándo llega, qué pasa si se acaba, si va con tarjeta.',
        paleta=[('#FDF6EC', 'Crema'), ('#C4471F', 'Terracota'),
                ('#2F5D3A', 'Verde hoja'), ('#211A15', 'Tinta')],
        tipos='Fraunces para los títulos, Karla para el texto',
        gana=['La ruta a la compra es la más corta de las tres.',
              'Precio y “Agregar” siempre a la vista, sin entrar a la ficha.',
              'La más fácil de mantener: soporta fotos disparejas sin romperse.'],
        cuesta=['Es la más convencional. Se parece a otras tiendas buenas.',
                'La marca se apoya en el color y la tipografía, no en la puesta.'],
    ),
    dict(
        clave='b', letra='B', nombre='Atelier', firma='#A83A62',
        lema='Cada pieza es una pieza, con su número y su ficha.',
        parrafo='Trata el catálogo como un taller y no como un depósito: papel, '
                'kraft, números correlativos y los precios en máquina de escribir. '
                'La ficha de producto pasa a ser una tabla de datos — qué trae, '
                'cuánto pesa, cuándo llega — que es justo lo que convence a quien '
                'está gastando doscientos soles en algo que no puede tocar.',
        paleta=[('#F3EFE6', 'Papel'), ('#E7DAC4', 'Kraft'),
                ('#A83A62', 'Magenta'), ('#7E8E6E', 'Salvia')],
        tipos='Newsreader para los títulos, Courier Prime para precios y datos',
        gana=['La que más se aleja de “tienda genérica”. Tiene autor.',
              'Justifica el precio: se lee artesanal, no de supermercado.',
              'La tabla de la ficha responde dudas sin que nadie escriba por WhatsApp.'],
        cuesta=['Pide fotos parejas: con fondos disparejos pierde la mitad de la gracia.',
                'Es la más lenta de leer. Compra por antojo, no por apuro.'],
    ),
    dict(
        clave='c', letra='C', nombre='Botánica', firma='#D8226B',
        lema='Verde profundo, magenta que grita, y una barra que no te suelta.',
        parrafo='La más contemporánea y la más agresiva comercialmente. Bloques '
                'de color a sangre, una cinta de datos en lima con las cuatro '
                'garantías, y una barra de compra fija abajo que sigue al cliente '
                'por toda la ficha. Es la que mejor se ve en Instagram y la que '
                'mejor conversa con los anuncios que ya están hechos.',
        paleta=[('#12301E', 'Verde profundo'), ('#F0EDE4', 'Crema'),
                ('#D8226B', 'Magenta'), ('#C6E36B', 'Lima')],
        tipos='Bricolage Grotesque para los títulos, Archivo para el texto',
        gana=['La más vendedora: barra de compra fija y llamados imposibles de perder.',
              'El verde oscuro hace que las flores salten. Las fotos ganan.',
              'Es la que más se parece a los anuncios de Instagram ya producidos.'],
        cuesta=['Es la más arriesgada. Fuerte, y a quien no le gusta, no le gusta.',
                'El fondo oscuro obliga a usar el logo en versión clara.'],
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
  <p>Las tres están armadas sobre las mismas tres pantallas reales — portada,
  catálogo y ficha de producto — con las fotos y los precios que hoy están en la
  tienda. No son bocetos: son páginas que ya funcionan, para que la comparación
  sea justa.</p>
  <p>El logo no se toca en ninguna. Lo que cambia es la puesta: el color, la
  tipografía, cuánto tarda el catálogo en aparecer y cuán insistente es el botón
  de comprar.</p>
  <p>La idea es elegir una. Después se puede ajustar sobre la elegida — cambiar
  un color, subir el catálogo, suavizar un título — pero conviene partir de una
  sola.</p>
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
    cuál se parece más a cómo quieres que te recuerden: la tienda rápida y
    confiable (A), el taller que arma cada pieza (B), o la marca joven y frontal
    que empuja la compra (C).</p>
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
