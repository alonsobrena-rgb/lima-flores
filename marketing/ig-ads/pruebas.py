#!/usr/bin/env python3
"""Arma la hoja de prueba de los formatos nuevos.

No es la galería de la campaña: acá no hay copy de anuncio ni objetivo ni
público. Es una hoja para decidir una sola cosa — si el formato entra o no
entra — así que muestra dos piezas de cada uno, en los tamaños en que se van a
publicar, y dice qué problema resuelve cada plantilla.

    node marketing/ig-ads/build.mjs --pruebas && python3 marketing/ig-ads/pruebas.py

Salida: pruebas.html, autocontenida.
"""
import base64
import io
import json
import os
import re
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(RAIZ, 'design'))
import build as D  # noqa: E402  — reutiliza el cacheo de tipografías y del logo

TOKENS = dict(re.findall(r'(--[a-z0-9-]+)\s*:\s*([^;]+);',
                         open(os.path.join(RAIZ, 'design/direcciones/florencia.css'),
                              encoding='utf-8').read(), re.I))

# Qué resuelve cada formato nuevo. Va acá y no en el JSON porque es el argumento
# de la propuesta, no un dato de la pieza.
FORMATOS = [
    ('vitrina', 'La vitrina', 'Arco',
     'La foto dentro de un arco, apoyada en una repisa. Es la única forma del '
     'sistema que no es un rectángulo, así que se hace notar sin tapar nada de '
     'la foto ni gritar. Es la puerta de una florería europea, que es el encargo '
     'de la marca dicho con una sola figura.',
     'Público frío, y presentación de producto donde la foto aguanta el silencio: '
     'orquídeas, floreros, cualquier toma de estudio sobre fondo limpio.'),
    ('tira', 'La tira', 'Tres piezas',
     'Tres productos del catálogo en columnas, cada uno con su nombre y su '
     'precio, todos apoyados en la misma repisa. Es el único formato que no '
     'vende un producto sino un surtido — que es lo que hace una carretilla de '
     'flores: no ofrece una flor, ofrece para elegir.',
     'Donde un carrusel no cabe. Una sola imagen que ya muestra el rango de '
     'precio, y sirve de portada de categoría: ramos, cajas, orquídeas.'),
    ('cifra', 'La cifra', 'El precio manda',
     'El precio a tamaño de titular, en el rosa de la marca. Los otros formatos '
     'lo dicen en letra chica al pie; acá el número es el anuncio, y la foto va '
     'a sangre arriba con el logotipo apoyado directo sobre ella.',
     'Final del embudo: retargeting de quien ya vio el producto y lo único que '
     'le falta saber es cuánto cuesta. Es la respuesta directa al «poco vendedor».'),
]


def jpg(ruta, ancho, calidad=80):
    im = Image.open(ruta).convert('RGB')
    if im.width > ancho:
        im = im.resize((ancho, round(ancho * im.height / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=calidad, optimize=True, progressive=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


CSS = """
*{box-sizing:border-box}
:root{
  --blanco:%(--bg-page)s; --alt:%(--bg-alt)s; --linea:%(--border)s;
  --tinta:%(--text-strong)s; --cuerpo:%(--text-body)s; --apag:%(--text-muted)s;
  --tenue:%(--text-faint)s; --rosa:%(--accent)s; --verde:%(--leaf)s;
}
html{-webkit-text-size-adjust:100%%}
body{margin:0;background:var(--blanco);color:var(--cuerpo);
  font:400 16.5px/1.6 'Jost',-apple-system,sans-serif}
img{display:block;max-width:100%%;height:auto}
.wrap{max-width:1060px;margin:0 auto;padding:0 30px}
.d{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-weight:500;
  letter-spacing:-.018em;line-height:1.02;color:var(--tinta)}
.d em{font-style:italic;color:var(--rosa)}
.rot{font-size:11.5px;font-weight:500;letter-spacing:.22em;text-transform:uppercase;
  color:var(--rosa);margin:0 0 12px}

.tapa{padding-block:70px 44px;border-bottom:1px solid var(--linea)}
.tapa .marca{height:62px;width:auto;margin-bottom:28px}
h1{font-size:clamp(36px,5.4vw,58px);margin:0 0 18px;max-width:22ch}
.tapa p{max-width:66ch;color:var(--apag);margin:0 0 14px}
.tapa p:last-child{margin:0}

.fmt{padding-block:56px;border-bottom:1px solid var(--linea)}
.cab{display:grid;grid-template-columns:1fr;gap:8px}
.cab h2{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;
  font-weight:500;font-size:clamp(30px,4.2vw,46px);margin:2px 0 0;color:var(--tinta);
  letter-spacing:-.018em}
.cab .clave{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--tenue)}
.dos{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:16px}
.dos p{margin:0;color:var(--apag)}
.dos b{color:var(--tinta);font-weight:500;display:block;font-size:11.5px;
  letter-spacing:.2em;text-transform:uppercase;margin-bottom:8px;color:var(--rosa)}
.piezas{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));
  gap:26px;margin-top:34px;align-items:start}
.pieza{border:1px solid var(--linea);border-radius:8px;overflow:hidden;background:var(--blanco)}
.pieza .arte{background:var(--alt)}
.pieza .pie{padding:14px 18px 16px;display:flex;justify-content:space-between;
  align-items:baseline;gap:12px}
.pieza .pie span{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--tenue)}
.pieza .pie b{font-weight:400;font-size:14.5px;color:var(--cuerpo)}

.cierre{padding-block:52px 92px}
.nota{border:1px solid var(--linea);border-radius:8px;padding:24px 26px;color:var(--apag);
  margin-top:22px}
.nota h3{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;
  font-weight:500;font-size:24px;margin:0 0 10px;color:var(--tinta)}
.nota p{margin:0 0 12px;max-width:72ch}
.nota p:last-child{margin:0}
.nota b{color:var(--tinta);font-weight:500}
.nota code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;
  background:var(--alt);padding:2px 6px;border-radius:4px}
@media (max-width:720px){
  .wrap{padding:0 18px}
  .dos{grid-template-columns:1fr}
  .piezas{grid-template-columns:1fr}
}
"""


def main():
    datos = json.load(open(os.path.join(HERE, 'pruebas.json'), encoding='utf-8'))
    anuncios = datos['ads']

    faltan = [a['code'] for a in anuncios
              if not os.path.exists(os.path.join(HERE, 'pruebas', f"{a['code']}.jpg"))]
    if faltan:
        sys.exit(f'faltan pruebas ({", ".join(faltan)}): corre node build.mjs --pruebas')

    bloques = []
    for clave, nombre, tag, que, cuando in FORMATOS:
        piezas = ''.join(f"""
        <article class="pieza">
          <div class="arte"><img src="{jpg(os.path.join(HERE, 'pruebas', a['code'] + '.jpg'), 620)}"
            alt="{a['title']}"></div>
          <div class="pie"><b>{a['title'].split('·', 1)[1].strip()}</b>
            <span>{a['format']}</span></div>
        </article>""" for a in anuncios if a['template'] == clave)
        bloques.append(f"""
  <section class="fmt"><div class="wrap">
    <div class="cab">
      <span class="clave">{clave} · {tag}</span>
      <h2>{nombre}</h2>
    </div>
    <div class="dos">
      <p><b>Qué hace</b>{que}</p>
      <p><b>Cuándo conviene</b>{cuando}</p>
    </div>
    <div class="piezas">{piezas}</div>
  </div></section>""")

    html = f"""<title>Tres formatos nuevos · Lima Flores</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>{D.css_fuentes('florencia')}
{CSS % TOKENS}</style>

<header class="tapa"><div class="wrap">
  <img class="marca" src="{D.imagen('logo.png', 420)}" alt="Lima Flores">
  <p class="rot">Prueba de formato</p>
  <h1 class="d">Tres plantillas nuevas, <em>dos piezas de cada una</em></h1>
  <p>Los nueve formatos que ya están en la campaña resuelven el mismo problema
  de nueve maneras: una foto, un titular y un precio. Estos tres cambian la
  pregunta — uno le da forma a la foto, otro muestra un surtido en vez de un
  producto, y el tercero pone el precio a tamaño de titular.</p>
  <p>Ninguno está publicado todavía. Están armados con fotos, nombres y precios
  reales del catálogo, con el sistema Florencia, y viven en un carril aparte
  (<code>pruebas.json</code>) que no toca los 32 anuncios de la campaña.</p>
</div></header>

{''.join(bloques)}

<section class="cierre"><div class="wrap">
  <p class="rot">Antes de publicarlos</p>
  <h2 class="d" style="font-size:36px;margin:0">Lo que falta decidir</h2>
  <div class="nota">
    <h3>Tres cosas</h3>
    <p><b>Cuáles entran.</b> Pueden entrar los tres, dos o uno. Cada uno que
    entre se suma a <code>ads.json</code> con su copy de anuncio, su objetivo y
    su público, igual que los otros nueve, y aparece en la galería de la
    campaña.</p>
    <p><b>La tira necesita curaduría.</b> Los otros formatos toman un producto
    del catálogo; este toma tres y hay que elegir cuáles van juntos. Los dos
    ejemplos agrupan por categoría — tres ramos, tres cajas — pero también
    podría agrupar por precio, por color o por ocasión.</p>
    <p><b>La cifra dice el precio a gritos.</b> Es a propósito: es la respuesta
    al diagnóstico de que la marca se veía poco vendedora. Conviene usarla solo
    al final del embudo, donde ya no molesta, y no como primera impresión.</p>
  </div>
</div></section>"""

    destino = os.path.join(HERE, 'pruebas.html')
    open(destino, 'w', encoding='utf-8').write(html)
    print(f'  ✓ pruebas.html   {round(os.path.getsize(destino) / 1024)} KB'
          f'   {len(anuncios)} piezas, {len(FORMATOS)} formatos')


if __name__ == '__main__':
    main()
