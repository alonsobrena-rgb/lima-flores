// Generador de tarjetas de regalo EN EL NAVEGADOR (Canvas 2D).
// No depende del backend: dibuja el PNG localmente a partir del mensaje del
// pedido, eligiendo 1 de 5 plantillas de forma estable por id. Devuelve un
// canvas 1080×1350 listo para previsualizar y para descargar (toBlob).
//
// Paleta/tipografía del design system (mismas que site/css/lima.css):
//   bone #F4EFE5 · paper #FBF8F1 · ink #1B1A17 · moss-deep #2F3925
//   rosa #9E2B5E · gold #C9A96A · terra #B6855E

// Proporción 1.64:1 (alto:ancho) — tarjeta vertical estilizada.
export const CARD_W = 1080;
export const CARD_H = 1771; // 1080 × 1.64 ≈ 1771
export const CARD_NOTE_MAX = 220;

export const TEMPLATE_KEYS = ['atelier', 'jardin', 'blush', 'botanica', 'minimal'] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export type CardData = {
  id: string;
  note: string;
  recipient?: string | null;
  buyer?: string | null;
  template?: TemplateKey;
};

// Hash estable del id → misma plantilla siempre para el mismo pedido.
function templateForId(id: string): TemplateKey {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TEMPLATE_KEYS[h % TEMPLATE_KEYS.length];
}

// Asegura que las fuentes estén listas antes de dibujar (canvas usa web fonts
// solo si ya están cargadas en el documento).
// Logo Lima Flores (PNG con transparencia). Se carga una vez y se cachea.
let _logo: HTMLImageElement | null = null;
let _logoPromise: Promise<HTMLImageElement | null> | null = null;
const LOGO_SRC = '/assets/logo.png';
export function setLogoSrc(_src: string) { /* override para tests/harness */ (loadLogo as any)._src = _src; }
function loadLogo(): Promise<HTMLImageElement | null> {
  if (_logo) return Promise.resolve(_logo);
  if (_logoPromise) return _logoPromise;
  _logoPromise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { _logo = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = (loadLogo as any)._src || LOGO_SRC;
  });
  return _logoPromise;
}

async function ensureFonts() {
  try {
    const f: any = (document as any).fonts;
    if (!f) return;
    await Promise.all([
      f.load('italic 70px "Cormorant Garamond"'),
      f.load('600 70px "Cormorant Garamond"'),
      f.load('500 24px "Jost"'),
      f.load('400 24px "Jost"'),
    ]);
    await f.ready;
  } catch { /* fuentes fallback del sistema */ }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, px: number) {
  try { (ctx as any).letterSpacing = px + 'px'; } catch { /* navegadores viejos */ }
}

// ─── Ornamentos simples dibujados a mano ────────────────────────────────────
function flourish(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(cx - 90, cy); ctx.lineTo(cx - 16, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 90, cy); ctx.lineTo(cx + 16, cy); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

type Theme = {
  bg: (ctx: CanvasRenderingContext2D) => string | CanvasGradient;
  ink: string; wordmark: string; para: string; sig: string; sigWord: string;
  frame?: { color: string; inset: number; inner?: string };
  ornament: 'dot' | 'corners' | 'none';
  ornColor: string;
  logoBottom?: boolean;
};

const THEMES: Record<TemplateKey, Theme> = {
  atelier: {
    bg: () => '#FBF8F1', ink: '#1B1A17', wordmark: '#9E2B5E', para: '#9A9389',
    sig: '#9E2B5E', sigWord: 'Con cariño,', frame: { color: '#9E2B5E', inset: 46, inner: '#E7AFC2' },
    ornament: 'none', ornColor: '#9E2B5E',
  },
  jardin: {
    bg: (ctx) => { const g = ctx.createLinearGradient(0, 0, 0, CARD_H); g.addColorStop(0, '#3a472d'); g.addColorStop(0.6, '#2F3925'); g.addColorStop(1, '#232b1c'); return g; },
    ink: '#F4EFE5', wordmark: '#C9A96A', para: '#bcae8d', sig: '#C9A96A', sigWord: '—',
    frame: { color: 'rgba(201,169,106,0.55)', inset: 54 }, ornament: 'none', ornColor: '#C9A96A',
  },
  blush: {
    bg: (ctx) => { const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H); g.addColorStop(0, '#FBEEF2'); g.addColorStop(0.55, '#F7DCE6'); g.addColorStop(1, '#F0C9D8'); return g; },
    ink: '#6A1A3B', wordmark: '#9E2B5E', para: '#9E2B5E', sig: '#9E2B5E', sigWord: 'Con amor,',
    frame: { color: 'rgba(158,43,94,0.35)', inset: 50 }, ornament: 'none', ornColor: '#9E2B5E',
  },
  botanica: {
    bg: () => '#F4EFE5', ink: '#2F3925', wordmark: '#B6855E', para: '#8A9477',
    sig: '#B6855E', sigWord: '—', ornament: 'corners', ornColor: '#8A9477',
  },
  minimal: {
    bg: () => '#FFFFFF', ink: '#1B1A17', wordmark: '#9A9389', para: '#9A9389',
    sig: '#1B1A17', sigWord: '—', ornament: 'dot', ornColor: '#9E2B5E', logoBottom: true,
  },
};

export function getTemplate(data: CardData): TemplateKey {
  return data.template && TEMPLATE_KEYS.includes(data.template) ? data.template : templateForId(data.id);
}

export async function renderCard(canvas: HTMLCanvasElement, data: CardData): Promise<TemplateKey> {
  const [, logo] = await Promise.all([ensureFonts(), loadLogo()]);
  const key = getTemplate(data);
  const t = THEMES[key];
  canvas.width = CARD_W; canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;
  const W = CARD_W, H = CARD_H, cx = W / 2;

  // Fondo
  ctx.fillStyle = t.bg(ctx) as any;
  ctx.fillRect(0, 0, W, H);

  // Marco
  if (t.frame) {
    ctx.strokeStyle = t.frame.color; ctx.lineWidth = 1.5;
    ctx.strokeRect(t.frame.inset, t.frame.inset, W - t.frame.inset * 2, H - t.frame.inset * 2);
    if (t.frame.inner) {
      ctx.strokeStyle = t.frame.inner; ctx.lineWidth = 1;
      const i2 = t.frame.inset + 10;
      ctx.strokeRect(i2, i2, W - i2 * 2, H - i2 * 2);
    }
  }

  ctx.textAlign = 'center';

  // Logo Lima Flores (reemplaza el wordmark de texto y el ramo del ornamento).
  const lw = t.logoBottom ? 230 : 300;
  const lh = (logo ? logo.height / logo.width : 0.557) * lw;
  const logoY = t.logoBottom ? (H - 150 - lh) : 96;
  if (logo) {
    ctx.drawImage(logo, cx - lw / 2, logoY, lw, lh);
  } else {
    // Fallback de texto si el logo no carga.
    ctx.textBaseline = 'alphabetic'; ctx.fillStyle = t.wordmark;
    ctx.font = '500 26px "Jost"'; setLetterSpacing(ctx, 6);
    ctx.fillText('LIMA FLORES', cx, t.logoBottom ? H - 96 : 150);
    setLetterSpacing(ctx, 0);
  }

  // Ornamentos (las flores del logo ya cubren el motivo superior).
  if (t.ornament === 'dot') { ctx.fillStyle = t.ornColor; ctx.beginPath(); ctx.arc(cx, 250, 7, 0, Math.PI * 2); ctx.fill(); }
  else if (t.ornament === 'corners') {
    drawCornerSprig(ctx, 96, 96, 1, t.ornColor);
    drawCornerSprig(ctx, W - 96, H - 96, -1, t.ornColor);
    flourish(ctx, cx, H - 150, t.ornColor);
  }

  // ── Bloque central: Para · mensaje · firma ──
  const note = (data.note || '').slice(0, CARD_NOTE_MAX).trim();
  const recipient = (data.recipient || '').trim();
  const buyer = (data.buyer || '').trim();

  // tamaño de fuente del mensaje según largo
  let size = 84;
  if (note.length > 60) size = 72;
  if (note.length > 110) size = 60;
  if (note.length > 160) size = 50;

  const maxMsgW = 770;
  const measure = (s: number) => { ctx.font = `italic 400 ${s}px "Cormorant Garamond"`; return wrapLines(ctx, note, maxMsgW); };
  let lines = measure(size);
  const maxMsgH = 470;
  while (lines.length * size * 1.18 > maxMsgH && size > 30) { size -= 2; lines = measure(size); }

  const lineH = size * 1.18;
  const paraH = recipient ? 30 : 0;
  const gap1 = recipient ? 60 : 0;
  const msgH = lines.length * lineH;
  const gap2 = buyer ? 56 : 0;
  const sigH = buyer ? 42 : 0;
  const totalH = paraH + gap1 + msgH + gap2 + sigH;
  // Centramos el bloque en la banda ENTRE el logo y el extremo opuesto, para que
  // a proporción 1.64:1 no quede cargado arriba con el fondo inferior vacío.
  const bottomReserve = t.ornament === 'corners' ? 220 : 96; // espacio para flourish/corner
  const bandTop = t.logoBottom ? 300 : (logoY + lh + 60);
  const bandBottom = t.logoBottom ? (logoY - 70) : (H - bottomReserve);
  let y = bandTop + Math.max(0, (bandBottom - bandTop - totalH) / 2);

  // Para X
  if (recipient) {
    ctx.fillStyle = t.para; ctx.font = '400 23px "Jost"'; setLetterSpacing(ctx, 8);
    ctx.textBaseline = 'top';
    ctx.fillText(('Para ' + recipient).toUpperCase(), cx, y);
    setLetterSpacing(ctx, 0);
    y += paraH + gap1;
  }

  // Mensaje
  ctx.fillStyle = t.ink; ctx.font = `italic 400 ${size}px "Cormorant Garamond"`; ctx.textBaseline = 'top';
  for (const ln of lines) { ctx.fillText(ln, cx, y); y += lineH; }

  // Firma (y ya quedó al final del bloque de mensaje tras el loop)
  if (buyer) {
    y += gap2;
    ctx.fillStyle = t.sig; ctx.font = 'italic 500 40px "Cormorant Garamond"'; ctx.textBaseline = 'top';
    ctx.fillText(`${t.sigWord} ${buyer}`, cx, y);
  }

  return key;
}

function drawCornerSprig(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + dir * 70, y + 20, x + dir * 110, y + 70, x + dir * 150, y + 150);
  ctx.stroke();
  const leaf = (t: number) => {
    const px = x + dir * (40 + t * 80), py = y + 20 + t * 90;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px - dir * 4, py - 22, px + dir * 18, py - 26);
    ctx.quadraticCurveTo(px + dir * 8, py - 8, px, py);
    ctx.stroke();
  };
  leaf(0.2); leaf(0.55); leaf(0.9);
  ctx.restore();
}

// Descarga el canvas como PNG.
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
