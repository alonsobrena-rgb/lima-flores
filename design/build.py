#!/usr/bin/env python3
"""Arma las direcciones de diseño como páginas autocontenidas y las fotografía.

Cada dirección es un HTML propio en direcciones/: no comparten CSS a propósito,
porque lo que se está comparando no es una paleta sino tres maneras distintas de
componer la misma tienda. Este script solo resuelve lo aburrido — meter las
tipografías y las fotos dentro del archivo — para que cada página se pueda abrir
y mandar por WhatsApp sin depender de nada.

    python3 design/build.py

Salida: salida/<dir>.html + capturas en salida/capturas/.
"""
import base64
import io
import os
import re
import subprocess
import sys
import urllib.request

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(HERE)
FOTOS = os.path.join(RAIZ, 'site/assets/products')
ASSETS = os.path.join(RAIZ, 'site/assets')
MARCA = os.path.join(RAIZ, 'marketing/ig-ads/marca')
CACHE = os.path.join(HERE, '.cache')
SALIDA = os.path.join(HERE, 'salida')

UA = ('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) '
      'Chrome/126 Safari/537.36')

# Las familias que usa cada dirección. Se bajan una vez y quedan en .cache/.
FUENTES = {
    'florencia': ['Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600',
                  'Jost:wght@300;400;500;600'],
    'paris': ['Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,600;1,6..96,400',
              'Karla:wght@400;500;600;700'],
    'amsterdam': ['Petrona:ital,wght@0,400;0,500;0,600;0,700;1,400',
                  'Hanken+Grotesk:wght@400;500;600;700'],
    # La galería no es una de las direcciones: usa una voz de ficha técnica a
    # propósito, para no competir con ninguna de las tres que está presentando.
    'galeria': ['IBM+Plex+Sans:wght@400;500;600;700',
                'IBM+Plex+Mono:wght@400;500'],
}

# Los mismos seis productos en las tres, con sus precios y fotos reales del
# catálogo. Si cambiaran entre direcciones, la comparación no valdría nada.
PRODUCTOS = [
    ('Box Rogelia', 'Arreglos', 210, 'box-rogelia-3.jpg'),
    ('Florero Forti', 'Arreglos', 210, 'florero-forti.jpg'),
    ('Orquídea Sunrise', 'Orquídeas', 215, 'orquidea-sunrise-de-dos-varas.jpg'),
    ('Tulipanes de amor', 'Floreros', 195, 'tulipanes-de-amor.jpg'),
    ('Box Lila', 'Arreglos', 180, 'box-lila.jpg'),
    ('Ramo Luana', 'Ramos', 180, 'ramo-luana.jpg'),
]

# Lo único que cambia de copy entre direcciones es el tono del titular. El
# resto del texto es idéntico, y todo sale del catálogo o de checkout.js.
DIRECCIONES = {
    'florencia': dict(
        eyebrow='Miraflores · desde 2017',
        titular='Flores frescas,<br>armadas <em>a mano</em>',
        catalogo='El catálogo de esta semana'),
    'paris': dict(
        eyebrow='Flores y diseño · Miraflores',
        titular='Tres tallos,<br>papel y <em>un listón</em>',
        catalogo='Lo que llegó esta semana'),
    'amsterdam': dict(
        eyebrow='Miraflores · desde 2017',
        titular='Flores frescas<br>tres veces por semana',
        catalogo='El puesto de esta semana'),
}


def _baja(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read()


def css_fuentes(clave):
    """@font-face con las woff2 embebidas: la página no depende de la red."""
    cacheado = os.path.join(CACHE, f'fuentes-{clave}.css')
    if os.path.exists(cacheado):
        return open(cacheado, encoding='utf-8').read()

    piezas = []
    for familia in FUENTES[clave]:
        css = _baja(f'https://fonts.googleapis.com/css2?family={familia}&display=swap').decode()
        # Solo el subset latino: es lo único que usa el copy.
        for bloque in [b for b in css.split('/*') if b.startswith(' latin */')]:
            m = re.search(r'url\((https:[^)]+\.woff2)\)', bloque)
            if not m:
                continue
            nombre = re.search(r"font-family:\s*'([^']+)'", bloque).group(1)
            estilo = re.search(r'font-style:\s*(\w+)', bloque).group(1)
            peso = re.search(r'font-weight:\s*([\d\s]+);', bloque).group(1).strip()
            b64 = base64.b64encode(_baja(m.group(1))).decode()
            piezas.append(
                f"@font-face{{font-family:'{nombre}';font-style:{estilo};"
                f"font-weight:{peso};font-display:swap;"
                f"src:url(data:font/woff2;base64,{b64}) format('woff2')}}")

    os.makedirs(CACHE, exist_ok=True)
    salida = '\n'.join(piezas)
    open(cacheado, 'w', encoding='utf-8').write(salida)
    return salida


def imagen(ruta, ancho=None):
    """Data URI de una foto, opcionalmente reescalada para no inflar el archivo."""
    for base in (FOTOS, ASSETS, MARCA):
        p = os.path.join(base, ruta)
        if os.path.exists(p):
            break
    else:
        raise FileNotFoundError(ruta)

    im = Image.open(p)
    if ruta.endswith('.png'):
        buf = io.BytesIO()
        if ancho and im.width > ancho:
            im = im.resize((ancho, round(ancho * im.height / im.width)), Image.LANCZOS)
        im.save(buf, 'PNG', optimize=True)
        return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()

    im = im.convert('RGB')
    if ancho and im.width > ancho:
        im = im.resize((ancho, round(ancho * im.height / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=80, optimize=True, progressive=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


def chromium():
    for base in ('/opt/pw-browsers',):
        if not os.path.isdir(base):
            continue
        for d in os.listdir(base):
            p = os.path.join(base, d, 'chrome-linux/chrome')
            if os.path.exists(p):
                return p
    raise RuntimeError('no encontré Chromium')


# Chromium no acepta un viewport de menos de 500px de ancho: pedirle 430 rinde a
# 500 y recorta, que es exactamente lo que hace parecer rota una página que está
# bien. Para los anchos de teléfono se mete la página en un iframe del ancho real
# dentro de una ventana de 500, y después se recorta la banda sobrante.
MIN_VIEWPORT = 500

BANCO = """<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:#fff}
iframe{border:0;display:block;width:{{W}}px;height:{{H}}px}</style>
<iframe src="{{SRC}}" scrolling="no"></iframe>"""


def _chrome(args, ancho, alto):
    subprocess.run([chromium(), '--headless=new', '--no-sandbox', '--disable-gpu',
                    '--hide-scrollbars', '--force-device-scale-factor=1',
                    '--allow-file-access-from-files', '--virtual-time-budget=12000',
                    f'--window-size={ancho},{alto}'] + args,
                   check=True, capture_output=True)


def _banco(html, ancho, alto):
    """Escribe el envoltorio con el iframe y devuelve su ruta."""
    ruta = os.path.join(CACHE, f'banco-{ancho}.html')
    os.makedirs(CACHE, exist_ok=True)
    open(ruta, 'w', encoding='utf-8').write(
        BANCO.replace('{{W}}', str(ancho)).replace('{{H}}', str(alto))
             .replace('{{SRC}}', f'file://{html}'))
    return ruta


# Dentro del iframe se mide el body: el <html> se estira hasta el alto del marco.
SONDA = """<script>addEventListener('load',()=>{
  const m=document.querySelector('iframe');
  const alto=m?m.contentDocument.body.scrollHeight
             :document.documentElement.scrollHeight;
  const i=document.createElement('i');i.textContent='@@'+alto+'@@';
  document.body.appendChild(i);})</script>"""


def alto_real(html, ancho):
    """Alto de la página al ancho pedido, medido en el navegador."""
    if ancho < MIN_VIEWPORT:
        fuente = _banco(html, ancho, 900)
    else:
        fuente = os.path.join(CACHE, 'sonda.html')
        open(fuente, 'w', encoding='utf-8').write(
            open(html, encoding='utf-8').read())
    with open(fuente, 'a', encoding='utf-8') as fh:
        fh.write(SONDA)

    salida = subprocess.run(
        [chromium(), '--headless=new', '--no-sandbox', '--disable-gpu',
         '--hide-scrollbars', '--allow-file-access-from-files',
         '--virtual-time-budget=12000', f'--window-size={max(ancho, MIN_VIEWPORT)},900',
         '--dump-dom', f'file://{fuente}'],
        capture_output=True, text=True).stdout
    m = re.findall(r'@@(\d+)@@', salida)
    if not m:
        raise RuntimeError(f'no pude medir {os.path.basename(html)} @{ancho}')
    return int(m[-1])


def captura(html, destino, ancho):
    """El viewport queda ~78px más bajo que --window-size, así que se pide de más
    y se recorta al alto real de la página."""
    alto = alto_real(html, ancho)
    if ancho < MIN_VIEWPORT:
        fuente = _banco(html, ancho, alto)
        ventana = MIN_VIEWPORT
    else:
        fuente, ventana = html, ancho
    _chrome([f'--screenshot={destino}', f'file://{fuente}'], ventana, alto + 200)
    Image.open(destino).crop((0, 0, ancho, alto)).save(destino)
    return alto


def tarjetas():
    """Las seis tarjetas del catálogo. Iguales en las tres direcciones."""
    piezas = []
    for nombre, cat, precio, foto in PRODUCTOS:
        piezas.append(f"""      <article class="card">
        <div class="foto"><img src="{imagen(foto, 620)}" alt="{nombre}"></div>
        <div class="cuerpo">
          <span class="cat">{cat}</span>
          <h3>{nombre}</h3>
          <div class="compra">
            <span class="precio">S/ {precio}</span>
            <button class="add">Agregar</button>
          </div>
        </div>
      </article>""")
    return '\n'.join(piezas)


def main():
    os.makedirs(os.path.join(SALIDA, 'capturas'), exist_ok=True)
    plantilla = open(os.path.join(HERE, 'tienda.html'), encoding='utf-8').read()
    caps = os.path.join(SALIDA, 'capturas')
    tarjetas_html = tarjetas()

    for clave, copy in DIRECCIONES.items():
        tokens = os.path.join(HERE, 'direcciones', f'{clave}.css')
        if not os.path.exists(tokens):
            sys.exit(f'falta {os.path.relpath(tokens, RAIZ)}')

        src = (plantilla
               .replace('{{FUENTES}}', css_fuentes(clave))
               .replace('{{TOKENS}}', open(tokens, encoding='utf-8').read())
               .replace('{{EYEBROW}}', copy['eyebrow'])
               .replace('{{TITULAR}}', copy['titular'])
               .replace('{{TITULO_CATALOGO}}', copy['catalogo'])
               .replace('{{TARJETAS}}', tarjetas_html))

        # {{IMG:archivo.jpg}} o {{IMG:archivo.jpg@900}} para fijar el ancho
        def sub(m):
            nombre, _, ancho = m.group(1).partition('@')
            return imagen(nombre, int(ancho) if ancho else None)
        src = re.sub(r'\{\{IMG:([^}]+)\}\}', sub, src)

        destino = os.path.join(SALIDA, f'{clave}.html')
        open(destino, 'w', encoding='utf-8').write(src)
        kb = round(os.path.getsize(destino) / 1024)

        alto = captura(destino, os.path.join(caps, f'{clave}-desktop.png'), 1440)
        altoM = captura(destino, os.path.join(caps, f'{clave}-movil.png'), 430)
        print(f'  ✓ {clave:<12} {kb:>5} KB   1440×{alto}   430×{altoM}')

    print(f'\n{len(DIRECCIONES)} direcciones en {os.path.relpath(SALIDA, RAIZ)}/')


if __name__ == '__main__':
    main()
