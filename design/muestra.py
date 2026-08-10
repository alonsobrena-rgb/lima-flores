#!/usr/bin/env python3
"""La misma tienda con las tres pieles y un interruptor para cambiarlas en vivo.

Es lo que se le manda a la dueña junto con los sistemas de diseño: en vez de
comparar tres capturas, aprieta un botón y ve la misma tienda cambiar de marca
delante suyo. Decidir así toma un minuto; decidir con capturas toma una semana.

    python3 design/build.py && python3 design/muestra.py

Salida: salida/muestra.html — autocontenida, se abre sola y va por WhatsApp.
"""
import os
import re

import build as B

PIELES = ['florencia', 'paris', 'amsterdam']

NOMBRES = {
    'florencia': ('Florencia', '#9E2B5E'),
    'paris': ('París', '#B33A48'),
    'amsterdam': ('Ámsterdam', '#0B6E30'),
}


def sin_comentarios(css):
    return re.sub(r'/\*.*?\*/', '', css, flags=re.S)


def escamado(css, piel):
    """Encierra cada regla bajo [data-piel="…"] para que las tres convivan.

    Los archivos de dirección son CSS plano — sin @media ni anidamiento — así
    que alcanza con prefijar selectores. `:root` pasa a ser el propio atributo,
    que va en el <html>.
    """
    ambito = f'[data-piel="{piel}"]'
    fuera = []
    for bloque in sin_comentarios(css).split('}'):
        if '{' not in bloque:
            continue
        selector, _, cuerpo = bloque.partition('{')
        partes = []
        for sel in selector.split(','):
            sel = sel.strip()
            if not sel:
                continue
            partes.append(ambito if sel == ':root' else f'{ambito} {sel}')
        if partes:
            fuera.append(f'{",".join(partes)}{{{cuerpo.strip()}}}')
    return '\n'.join(fuera)


# El interruptor no toma prestada ninguna de las tres paletas: si lo hiciera,
# esa dirección jugaría de local.
MANDO = """
:root{--mando-bg:#17191C;--mando-tinta:#F2F3F1;--mando-apag:#8C9297}
.mando{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99;
  background:var(--mando-bg);color:var(--mando-tinta);border-radius:999px;
  padding:7px 8px;display:flex;align-items:center;gap:5px;
  box-shadow:0 10px 34px rgba(0,0,0,.3),0 2px 8px rgba(0,0,0,.2);
  font:500 13px/1 'IBM Plex Mono',ui-monospace,monospace}
.mando b{font-weight:500;color:var(--mando-apag);padding:0 10px 0 8px;
  letter-spacing:.1em;text-transform:uppercase;font-size:10.5px}
.mando button{font:inherit;border:0;cursor:pointer;color:var(--mando-tinta);
  background:transparent;padding:10px 15px;border-radius:999px;
  display:flex;align-items:center;gap:7px;letter-spacing:.02em;
  transition:background .15s ease}
.mando button:hover{background:rgba(255,255,255,.09)}
.mando button:focus-visible{outline:2px solid var(--mando-tinta);outline-offset:2px}
.mando button[aria-pressed="true"]{background:rgba(255,255,255,.16)}
.mando i{width:9px;height:9px;border-radius:50%;display:block}
.aviso{position:fixed;left:50%;bottom:74px;transform:translateX(-50%);z-index:99;
  background:rgba(23,25,28,.92);color:#C9CDD1;border-radius:8px;padding:8px 14px;
  font:400 12px/1.4 'IBM Plex Mono',ui-monospace,monospace;max-width:min(92vw,560px);
  text-align:center}
@media (max-width:620px){
  .mando{gap:2px;padding:6px}
  .mando b{display:none}
  .mando button{padding:9px 11px;font-size:12px}
  .aviso{font-size:11px;bottom:70px}
}
@media print{.mando,.aviso{display:none}}
.aviso{transition:opacity .25s ease}
.aviso[hidden]{display:none}
body{padding-bottom:104px}
"""

GUION = """
<script>
(function(){
  var raiz = document.documentElement;
  document.querySelectorAll('.mando button').forEach(function(b){
    b.addEventListener('click', function(){
      raiz.dataset.piel = b.dataset.piel;
      var pista = document.querySelector('.aviso');
      if (pista) pista.hidden = true;
      document.querySelectorAll('.mando button').forEach(function(o){
        o.setAttribute('aria-pressed', String(o === b));
      });
      window.scrollTo({top: 0, behavior: 'smooth'});
    });
  });
})();
</script>
"""


def variantes(campo):
    """Las tres versiones del mismo texto, una por piel."""
    etiqueta = {'catalogo': 'h2 class="solo"'}[campo]
    tag = etiqueta.split()[0]
    piezas = []
    for piel in PIELES:
        texto = B.DIRECCIONES[piel][campo]
        piezas.append(f'<{etiqueta} data-piel="{piel}">{texto}</{tag}>')
    return ''.join(piezas)


def main():
    plantilla = open(os.path.join(B.HERE, 'tienda.html'), encoding='utf-8').read()

    fuentes = '\n'.join(B.css_fuentes(p) for p in PIELES + ['galeria'])
    tokens = '\n'.join(
        escamado(open(os.path.join(B.HERE, 'direcciones', f'{p}.css'),
                      encoding='utf-8').read(), p)
        for p in PIELES)
    # Cada texto existe tres veces en el HTML; se muestra el de la piel activa.
    tokens += '\n[data-piel] .solo[data-piel]{display:none}\n' + '\n'.join(
        f'[data-piel="{p}"] .solo[data-piel="{p}"]{{display:block}}' for p in PIELES)

    src = (plantilla
           .replace('{{FUENTES}}', fuentes)
           .replace('{{TOKENS}}', tokens + '\n' + MANDO)
           .replace('{{TARJETAS}}', B.tarjetas())
           .replace('{{SISTEMA}}', open(os.path.join(B.HERE, 'sistema.html'),
                                        encoding='utf-8').read())
           .replace('{{HERO}}', '\n'.join(
               open(os.path.join(B.HERE, 'heroes', f'{p}.html'),
                    encoding='utf-8').read() for p in PIELES)))

    # El título del catálogo es lo único que queda con tres versiones sueltas;
    # el resto del copy de cada dirección ya viene dentro de su hero.
    src = src.replace('<h2>{{TITULO_CATALOGO}}</h2>', variantes('catalogo'))

    def sub(m):
        nombre, _, ancho = m.group(1).partition('@')
        return B.imagen(nombre, int(ancho) if ancho else None)
    src = re.sub(r'\{\{IMG:([^}]+)\}\}', sub, src)

    botones = ''.join(
        f'<button data-piel="{p}" aria-pressed="{str(p == PIELES[0]).lower()}">'
        f'<i style="background:{NOMBRES[p][1]}"></i>{NOMBRES[p][0]}</button>'
        for p in PIELES)

    src = src.replace('<meta charset="utf-8">',
                      f'<meta charset="utf-8">\n<meta name="viewport" '
                      f'content="width=device-width,initial-scale=1">')
    src = src.replace('<header>', f'''<div class="aviso">La misma tienda, tres marcas.
Aprieta abajo para cambiarla.</div>
<nav class="mando" aria-label="Elegir dirección de diseño">
  <b>Dirección</b>{botones}
</nav>

<header>''', 1)
    src += GUION

    # La piel inicial va en el <html>, que este archivo no declara: se agrega
    # con una línea de script antes de que pinte nada.
    src = src.replace('<meta charset="utf-8">',
                      '<script>document.documentElement.dataset.piel="florencia"</script>\n'
                      '<meta charset="utf-8">', 1)

    destino = os.path.join(B.SALIDA, 'muestra.html')
    open(destino, 'w', encoding='utf-8').write(src)
    print(f'  ✓ muestra.html   {round(os.path.getsize(destino) / 1024)} KB')


if __name__ == '__main__':
    main()
