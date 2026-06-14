// Composición de ADS para Meta EN EL NAVEGADOR (Canvas 2D).
// Toma una imagen de fondo (la generada con Higgsfield o la foto del producto) y
// le compone, DENTRO de las safe zones de Meta, el logo + titular + precio + CTA.
// Exporta PNG 1080×1080 o 1080×1920 listo para subir a Meta Ads.
//
// Safe zones (insets desde cada borde, en px sobre lienzo de 1080 de ancho):
//   · Cuadrado 1080×1080 (feed 1:1): la UI casi no tapa → margen de respiro 64px.
//   · Vertical 1080×1920 (Stories/Reels): 250px arriba y 360px abajo cubren el
//     perfil, el caption, los botones laterales y el CTA del sistema.

export type AdSize = 'square' | 'vertical';

export const AD_DIMS: Record<AdSize, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  vertical: { w: 1080, h: 1920 },
};

export const SAFE: Record<AdSize, { top: number; bottom: number; left: number; right: number }> = {
  square: { top: 64, bottom: 64, left: 64, right: 64 },
  vertical: { top: 250, bottom: 360, left: 72, right: 72 },
};

export type AdTheme = 'dark' | 'light';
export type TextPlacement = 'top' | 'bottom';

export type AdContent = {
  size: AdSize;
  bg?: HTMLImageElement | null;
  headline?: string;
  subtitle?: string;
  price?: string;
  cta?: string;
  showGuides?: boolean;
  placement?: TextPlacement;
  theme?: AdTheme;
};

const COL = {
  rosa: '#9E2B5E',
  gold: '#C9A96A',
  ink: '#1B1A17',
  ivory: '#F4EFE5',
};

// ─── Logo (cacheado) ────────────────────────────────────────────────────────
let _logo: HTMLImageElement | null = null;
let _logoTry: Promise<HTMLImageElement | null> | null = null;
function loadLogo(): Promise<HTMLImageElement | null> {
  if (_logo) return Promise.resolve(_logo);
  if (_logoTry) return _logoTry;
  _logoTry = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { _logo = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = '/assets/logo.png';
  });
  return _logoTry;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    img.src = src;
  });
}

async function ensureFonts() {
  try {
    const f: any = (document as any).fonts;
    if (!f) return;
    await Promise.all([
      f.load('600 80px "Cormorant Garamond"'),
      f.load('italic 80px "Cormorant Garamond"'),
      f.load('500 28px "Jost"'),
      f.load('400 28px "Jost"'),
    ]);
    await f.ready;
  } catch { /* fallback del sistema */ }
}

// dibuja la imagen de fondo tipo object-fit: cover
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number) {
  const ir = img.width / img.height;
  const cr = W / H;
  let dw = W, dh = H, dx = 0, dy = 0;
  if (ir > cr) { dh = H; dw = H * ir; dx = (W - dw) / 2; }
  else { dw = W; dh = W / ir; dy = (H - dh) / 2; }
  ctx.drawImage(img, dx, dy, dw, dh);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function setLS(ctx: CanvasRenderingContext2D, px: number) { try { (ctx as any).letterSpacing = px + 'px'; } catch { /* */ } }

export async function renderAd(canvas: HTMLCanvasElement, c: AdContent): Promise<void> {
  const size = c.size;
  const { w: W, h: H } = AD_DIMS[size];
  const safe = SAFE[size];
  const placement: TextPlacement = c.placement || (size === 'vertical' ? 'bottom' : 'bottom');
  const theme: AdTheme = c.theme || 'dark';
  const [, logo] = await Promise.all([ensureFonts(), loadLogo()]);

  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);

  // Fondo
  if (c.bg) drawCover(ctx, c.bg, W, H);
  else { ctx.fillStyle = '#E9E2D4'; ctx.fillRect(0, 0, W, H); }

  // Scrim para legibilidad del texto, del lado donde va el bloque.
  const scrimDark = theme === 'dark';
  const g = ctx.createLinearGradient(0, placement === 'bottom' ? H : 0, 0, placement === 'bottom' ? 0 : H);
  const a = scrimDark ? '0.62' : '0.55';
  g.addColorStop(0, scrimDark ? `rgba(20,18,16,${a})` : `rgba(248,245,239,${a})`);
  g.addColorStop(0.45, scrimDark ? 'rgba(20,18,16,0.12)' : 'rgba(248,245,239,0.12)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const ink = scrimDark ? COL.ivory : COL.ink;
  const accent = scrimDark ? COL.gold : COL.rosa;
  const cx = W / 2;
  const maxTextW = W - safe.left - safe.right;
  ctx.textAlign = 'center';

  // ── Logo: SIEMPRE arriba al centro (puede salir del marco seguro de Meta) ──
  let logoBottomY = 0;
  if (logo) {
    const lW = size === 'vertical' ? 300 : 240;
    const lH = (logo.height / logo.width) * lW;
    const top = size === 'vertical' ? 72 : 52;
    // Velo suave detrás del logo para que lea sobre la foto.
    const tg = ctx.createLinearGradient(0, 0, 0, top + lH + 48);
    tg.addColorStop(0, scrimDark ? 'rgba(20,18,16,0.45)' : 'rgba(248,245,239,0.5)');
    tg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = tg;
    ctx.fillRect(0, 0, W, top + lH + 48);
    ctx.drawImage(logo, cx - lW / 2, top, lW, lH);
    logoBottomY = top + lH;
  }

  // ── Bloque de texto (titular · subtítulo · precio · CTA), en la safe zone ──

  // Precalcular alturas
  const headline = (c.headline || '').trim();
  const subtitle = (c.subtitle || '').trim();
  const price = (c.price || '').trim();
  const cta = (c.cta || '').trim();

  let hSize = size === 'vertical' ? 92 : 76;
  ctx.font = `600 ${hSize}px "Cormorant Garamond"`;
  let hLines = wrap(ctx, headline, maxTextW);
  while (hLines.length > 3 && hSize > 44) { hSize -= 4; ctx.font = `600 ${hSize}px "Cormorant Garamond"`; hLines = wrap(ctx, headline, maxTextW); }
  const hLineH = hSize * 1.04;

  const subSize = 30;
  const priceSize = size === 'vertical' ? 56 : 48;
  const ctaH = 84;

  const gapHead = subtitle ? 22 : 0, gapPrice = price ? 30 : 0, gapCta = cta ? 40 : 0;
  const blockH =
    (headline ? hLines.length * hLineH : 0) +
    (subtitle ? gapHead + subSize : 0) +
    (price ? gapPrice + priceSize : 0) +
    (cta ? gapCta + ctaH : 0);

  // y inicial: dentro de la safe zone, pegado al borde elegido con un respiro.
  const pad = 18;
  let y = placement === 'bottom'
    ? (H - safe.bottom - pad - blockH)
    // En 'top', arrancar bajo el logo si éste invade la zona de texto.
    : Math.max(safe.top + pad, logoBottomY + 28);
  // Si el bloque no cabe, lo subimos/centramos en la banda segura.
  const bandTop = safe.top, bandBottom = H - safe.bottom;
  if (y < bandTop) y = bandTop + Math.max(0, ((bandBottom - bandTop) - blockH) / 2);

  // Titular
  if (headline) {
    ctx.fillStyle = ink;
    ctx.font = `600 ${hSize}px "Cormorant Garamond"`;
    ctx.textBaseline = 'top';
    for (const ln of hLines) { ctx.fillText(ln, cx, y); y += hLineH; }
  }

  // Subtítulo
  if (subtitle) {
    y += gapHead;
    ctx.fillStyle = scrimDark ? 'rgba(244,239,229,0.82)' : 'rgba(27,26,23,0.72)';
    ctx.font = `400 ${subSize}px "Jost"`; setLS(ctx, 1);
    ctx.textBaseline = 'top';
    const sl = wrap(ctx, subtitle, maxTextW);
    for (const ln of sl) { ctx.fillText(ln, cx, y); y += subSize * 1.4; }
    setLS(ctx, 0);
    y -= subSize * 0.4;
  }

  // Precio
  if (price) {
    y += gapPrice;
    ctx.fillStyle = accent;
    ctx.font = `italic 600 ${priceSize}px "Cormorant Garamond"`;
    ctx.textBaseline = 'top';
    ctx.fillText(price, cx, y);
    y += priceSize;
  }

  // CTA (pill)
  if (cta) {
    y += gapCta;
    ctx.font = '500 28px "Jost"'; setLS(ctx, 3);
    const tw = ctx.measureText(cta.toUpperCase()).width;
    const pw = tw + 76, ph = ctaH, px = cx - pw / 2;
    ctx.fillStyle = accent;
    roundRect(ctx, px, y, pw, ph, ph / 2); ctx.fill();
    ctx.fillStyle = scrimDark ? COL.ink : COL.ivory;
    ctx.textBaseline = 'middle';
    ctx.fillText(cta.toUpperCase(), cx, y + ph / 2 + 2);
    setLS(ctx, 0);
  }

  // ── Guías de safe zone (no se exportan; el front re-renderiza sin ellas) ──
  if (c.showGuides) drawGuides(ctx, W, H, safe);
}

function drawGuides(ctx: CanvasRenderingContext2D, W: number, H: number, safe: { top: number; bottom: number; left: number; right: number }) {
  ctx.save();
  // Bandas que tapa la UI de Meta (rojo translúcido)
  ctx.fillStyle = 'rgba(214,40,40,0.16)';
  ctx.fillRect(0, 0, W, safe.top);
  ctx.fillRect(0, H - safe.bottom, W, safe.bottom);
  ctx.fillRect(0, safe.top, safe.left, H - safe.top - safe.bottom);
  ctx.fillRect(W - safe.right, safe.top, safe.right, H - safe.top - safe.bottom);
  // Rect de zona segura (dashed)
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3; ctx.setLineDash([16, 12]);
  ctx.strokeRect(safe.left, safe.top, W - safe.left - safe.right, H - safe.top - safe.bottom);
  ctx.setLineDash([]);
  // Etiquetas
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '500 22px "Jost"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (safe.top >= 40) ctx.fillText('UI DE META', W / 2, safe.top / 2);
  if (safe.bottom >= 40) ctx.fillText('UI DE META · CTA', W / 2, H - safe.bottom / 2);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
