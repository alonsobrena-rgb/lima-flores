#!/usr/bin/env python3
"""Arma la galería de la campaña para mandarla al cliente.

Sale de `ads.json` y de los JPEG que deja `build.mjs` —y de `videos.json` con
los MP4 de `marketing/video/`—: el copy que se pega en el administrador de
anuncios y el que se ve en la pieza son el mismo dato, así no se desincronizan.

El video no se embebe. Son 7 MB, que en base64 se vuelven 10 y hay que bajarlos
enteros antes de ver la primera pieza; va por su URL (`/galeria/VID-01.mp4`, la
sirve `server.js` con soporte de Range) y la página se queda liviana. Es la
única cosa que la galería no trae adentro, y por eso el archivo tiene que estar
desplegado junto a ella.

La página va vestida con el sistema Florencia — los mismos tokens que visten los
creativos — porque acá no se está comparando marcas: se está mostrando una.

    node marketing/ig-ads/build.mjs && python3 marketing/ig-ads/galeria.py

Salida: galeria.html, autocontenida.
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
import build as D  # noqa: E402  — reutiliza el cacheo de tipografías y fotos

TOKENS = dict(re.findall(r'(--[a-z0-9-]+)\s*:\s*([^;]+);',
                         open(os.path.join(RAIZ, 'design/direcciones/florencia.css'),
                              encoding='utf-8').read(), re.I))


def jpg(ruta, ancho, calidad=78):
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
.wrap{max-width:1120px;margin:0 auto;padding:0 30px}
.d{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-weight:500;
  letter-spacing:-.018em;line-height:1.02;color:var(--tinta)}
.d em{font-style:italic;color:var(--rosa)}
.rot{font-size:11.5px;font-weight:500;letter-spacing:.22em;text-transform:uppercase;
  color:var(--rosa);margin:0 0 12px}

.tapa{padding-block:70px 46px;border-bottom:1px solid var(--linea)}
.tapa .marca{height:64px;width:auto;margin-bottom:30px}
h1{font-size:clamp(38px,5.6vw,62px);margin:0 0 20px;max-width:20ch}
.tapa p{max-width:64ch;color:var(--apag);margin:0 0 14px}
.cifras{display:flex;gap:34px;flex-wrap:wrap;margin-top:30px;padding-top:26px;
  border-top:1px solid var(--linea)}
.cifra b{display:block;font:500 italic 40px/1 'Cormorant Garamond',serif;color:var(--tinta)}
.cifra span{font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--tenue)}

.prod{padding-block:56px;border-bottom:1px solid var(--linea)}
.prodCab h2{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;
  font-weight:500;font-size:clamp(30px,4vw,44px);margin:4px 0 0;color:var(--tinta);
  letter-spacing:-.018em}
.prodCab p{color:var(--apag);margin:10px 0 0;max-width:62ch}
.piezas{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));
  gap:26px;margin-top:34px}
.pieza{border:1px solid var(--linea);border-radius:8px;overflow:hidden;
  display:flex;flex-direction:column;background:var(--blanco)}
.pieza .arte{background:var(--alt)}
.pieza .arte video{display:block;width:100%%;height:auto;aspect-ratio:9/16;background:#000}
.pieza .ficha{padding:20px 22px 24px;display:flex;flex-direction:column;gap:10px;flex:1}
.cab{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.cod{font-size:12px;font-weight:500;letter-spacing:.16em;color:var(--rosa)}
.fmt{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--tenue)}
.pieza h3{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;
  font-weight:500;font-size:23px;margin:0;color:var(--tinta);letter-spacing:-.018em}
.dato{font-size:14px;color:var(--apag);margin:0}
.dato b{color:var(--tinta);font-weight:500}
.copia{background:var(--alt);border-radius:4px;padding:14px 16px;font-size:14px;
  line-height:1.55;white-space:pre-wrap;margin:0}
.tags{font-size:13px;color:var(--verde);word-spacing:.3em}
.porque{font-size:13.5px;color:var(--apag);border-left:2px solid var(--rosa);
  padding-left:13px;margin:0}

.cierre{padding-block:52px 92px}
.tabla{overflow-x:auto;margin-top:24px}
table{border-collapse:collapse;width:100%%;min-width:640px;font-size:14.5px}
th,td{text-align:left;padding:13px 14px;border-bottom:1px solid var(--linea);
  vertical-align:top}
th{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--tenue);
  font-weight:500}
.nota{margin-top:32px;border:1px solid var(--linea);border-radius:8px;
  padding:24px 26px;color:var(--apag)}
.nota h3{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;
  font-weight:500;font-size:24px;margin:0 0 10px;color:var(--tinta)}
.nota p{margin:0 0 12px;max-width:72ch}
.nota p:last-child{margin:0}
.nota b{color:var(--tinta);font-weight:500}
@media (max-width:720px){
  .wrap{padding:0 18px}
  .piezas{grid-template-columns:1fr}
}
"""


SIN_ETIQUETAS = re.compile(r'<[^>]+>')

VIDEOS = os.path.join(RAIZ, 'marketing/video')


def ficha(codigo, formato, titulo, filas, a):
    """El pie de una pieza. Es el mismo para una foto y para un video: cambia el
    arte de arriba y qué se lista en `filas`, no la estructura."""
    datos = ''.join(f'\n            <p class="dato"><b>{k}</b> {v}</p>' for k, v in filas)
    return f"""
          <div class="ficha">
            <div class="cab"><span class="cod">{codigo}</span>
              <span class="fmt">{formato}</span></div>
            <h3>{titulo}</h3>{datos}
            <p class="copia">{a['primaryText'].strip()}</p>
            <p class="dato"><b>Botón</b> {a['cta']} · <b>Etapa</b> {a['funnel']}</p>
            <p class="tags">{' '.join(a['hashtags'])}</p>
            <p class="porque">{a['why']}</p>
          </div>"""


def main():
    datos = json.load(open(os.path.join(HERE, 'ads.json'), encoding='utf-8'))
    productos, anuncios = datos['products'], datos['ads']
    videos = json.load(open(os.path.join(VIDEOS, 'videos.json'), encoding='utf-8'))['videos']

    faltan = [a['code'] for a in anuncios
              if not os.path.exists(os.path.join(HERE, 'creativos', f"{a['code']}.jpg"))]
    faltan += [v['code'] for v in videos
               if not os.path.exists(os.path.join(VIDEOS, 'creativos', f"{v['code']}.mp4"))]
    if faltan:
        sys.exit(f'faltan piezas ({", ".join(faltan)}): corre node build.mjs'
                 ' — y node marketing/video/build.mjs si falta un VID')

    bloques = []
    for p in productos:
        piezas = []
        for a in (x for x in anuncios if x['product'] == p['id']):
            fmt = a.get('format') or ('9:16' if a['template'] == 'story' else '4:5')
            piezas.append(f"""
        <article class="pieza">
          <div class="arte"><img src="{jpg(os.path.join(HERE, 'creativos', a['code'] + '.jpg'), 640)}"
            alt="{a['title']}"></div>
          {ficha(a['code'], f"{fmt} · {a['template']}", a['title'],
                 [('Titular', a['headline']), ('Descripción', a['description'])], a)}
        </article>""")
        # El #t=0.5 no es un adorno: sin poster, Chrome deja el recuadro en negro
        # hasta que alguien le da a play. Pidiendo medio segundo, el navegador
        # busca ese cuadro y lo pinta — y medio segundo adentro el rótulo todavía
        # no entró, así que lo que se ve es la toma.
        #
        # El aspect-ratio del CSS tampoco sobra: hasta que llegan los metadatos,
        # un <video> mide 300x150, así que sin él la tarjeta nace achatada y da
        # un salto cuando el video carga.
        for v in (x for x in videos if x['product'] == p['id']):
            piezas.append(f"""
        <article class="pieza">
          <div class="arte">
            <video controls playsinline preload="metadata"
              src="/galeria/{v['code']}.mp4#t=0.5"></video>
          </div>
          {ficha(v['code'], '9:16 · video', v['title'],
                 [('Rótulo', SIN_ETIQUETAS.sub('', v['sub'])),
                  ('Cierre', SIN_ETIQUETAS.sub('', v['cierre']) + ' ' + v['cierreSub']),
                  ('Descripción', f"{v['footer']} · {v['price']}")], v)}
        </article>""")
        bloques.append(f"""
  <section class="prod"><div class="wrap">
    <div class="prodCab">
      <p class="rot">{p['num']} · {p['categoryLabel']} · S/ {p['price']}</p>
      <h2>{p['name']}</h2>
      <p>{p['angle']} — {p['audience']}</p>
    </div>
    <div class="piezas">{''.join(piezas)}</div>
  </div></section>""")

    # La galería agrupa por producto, así que una pieza cuyo `product` no esté en
    # `products` no cae en ningún bloque y desaparece sin decir nada. El panel de
    # admin la encolaría igual —lee `ads.json` en plano— y las dos vistas dejarían
    # de mostrar lo mismo. Si eso pasa, mejor que reviente acá.
    puestas = sum(len([x for x in anuncios if x['product'] == p['id']])
                  + len([x for x in videos if x['product'] == p['id']]) for p in productos)
    if puestas != len(anuncios) + len(videos):
        ids = {p['id'] for p in productos}
        sueltas = [x['code'] for x in anuncios + videos if x['product'] not in ids]
        sys.exit(f'estas piezas no caen en ningún producto y se perderían: {", ".join(sueltas)}')

    filas = ''.join(f'<tr><td>{a}</td><td>{b}</td></tr>' for a, b in [
        ('«Eliges el día y la hora»', '<code>app/src/pages/Checkout.tsx</code> — la fecha mínima es mañana; franjas en <code>lib/delivery.ts</code>'),
        ('«Entrega en Lima Metropolitana»', 'landing'),
        ('«Flores frescas los lunes, miércoles y viernes»', 'landing'),
        ('«Si algo se acaba, te avisamos en menos de una hora»', 'landing'),
        ('«No vendemos flores. Vendemos pequeños momentos de calma»', 'landing, manifiesto'),
        ('«Armado a mano» · «Atelier en Miraflores desde 2017»', 'landing'),
        ('Medidas, florero, tarjeta y composición de cada pieza', '<code>db/products.seed.json</code>'),
        ('Reseñas de Diego V. y Camila R.', 'landing, reseñas verificadas 2025'),
        ('Advertencia de alcohol de IG-28', '<code>db/products.seed.json</code>, ficha del Box Yani'),
    ])

    html = f"""<title>Campaña IG · Lima Flores</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>{D.css_fuentes('florencia')}
{CSS % TOKENS}</style>

<header class="tapa"><div class="wrap">
  <img class="marca" src="{D.imagen('logo.png', 420)}" alt="Lima Flores">
  <p class="rot">Campaña de Instagram</p>
  <h1 class="d">{len(anuncios) + len(videos)} piezas, <em>un solo sistema</em></h1>
  <p>Todas las piezas se visten con el sistema de diseño de la tienda: los mismos
  colores medidos en el ramo del logotipo, la misma Cormorant Garamond en itálica
  para los titulares y la misma Jost para todo lo demás. El generador lee los
  tokens del sistema, así que si la marca cambia, los creativos cambian con ella.</p>
  <p>Las fotos son las del catálogo. No se generó ninguna imagen con IA, y cada
  afirmación del texto sale de una fuente del proyecto — la tabla del final dice
  cuál.</p>
  <div class="cifras">
    <div class="cifra"><b>{len(anuncios)}</b><span>Piezas fijas</span></div>
    <div class="cifra"><b>{len(videos)}</b><span>{'Video' if len(videos) == 1 else 'Videos'}</span></div>
    <div class="cifra"><b>{len(productos)}</b><span>Productos</span></div>
    <div class="cifra"><b>9</b><span>Formatos</span></div>
    <div class="cifra"><b>0</b><span>Imágenes de IA</span></div>
  </div>
</div></header>

{''.join(bloques)}

<section class="cierre"><div class="wrap">
  <p class="rot">Respaldo</p>
  <h2 class="d" style="font-size:38px;margin:0 0 4px">De dónde sale cada dato</h2>
  <div class="tabla"><table>
    <tr><th>Afirmación</th><th>Fuente</th></tr>{filas}
  </table></div>

  <div class="nota">
    <h3>Tres cosas antes de publicar</h3>
    <p><b>Las entregas son al día siguiente.</b> El cliente elige el día y una
    franja de 30 minutos, con 24 horas de anticipación. Ninguna pieza promete
    entrega el mismo día, aunque la landing todavía lo diga: manda el código del
    checkout, no la landing.</p>
    <p><b>IG-28 lleva alcohol.</b> El Box Yani incluye una botella de 200 ml, así
    que cae en la categoría de alcohol de Meta: necesita segmentación <b>+18</b> en
    el conjunto de anuncios y lleva la advertencia legal en el texto. Sin eso, Meta
    lo rechaza.</p>
    <p><b>Meta pide poder respaldar los testimonios.</b> Conviene tener a mano de
    dónde salió la reseña de Diego V. antes de publicar IG-05.</p>
  </div>
</div></section>"""

    destino = os.path.join(HERE, 'galeria.html')
    open(destino, 'w', encoding='utf-8').write(html)
    print(f'  ✓ galeria.html   {round(os.path.getsize(destino) / 1024)} KB'
          f'   {len(anuncios)} piezas + {len(videos)} video(s)')


if __name__ == '__main__':
    main()
