// "Síguenos en Instagram" — galería de posts recientes de @lima_flores.
// En vivo: trae los últimos posts desde /api/instagram (Instagram Graph API).
// Si el backend no tiene token configurado (o falla), cae a una galería curada
// de fotos del catálogo que enlazan al perfil — la sección nunca se ve rota.
import { useEffect, useState } from 'react';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { Seccion, enlaceTexto } from './Seccion';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '';
const PROFILE = 'https://instagram.com/lima_flores';
const HANDLE = '@lima_flores';

type IgPost = { id: string; image: string; permalink: string; caption?: string; type?: string };

// Defensa: aunque el feed viene de nuestro backend (Graph API con nuestro token),
// no confiamos ciegamente en el permalink/imagen. Solo aceptamos URLs https:// (o
// rutas /internas para el respaldo); cualquier otra cosa (javascript:, data:) cae
// a un valor seguro para no habilitar XSS por href.
const safeHttps = (url: unknown, fallback: string): string => {
  if (typeof url !== 'string') return fallback;
  if (url.startsWith('/')) return url; // ruta interna del respaldo curado
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? url : fallback;
  } catch { return fallback; }
};
const sanitizePost = (p: IgPost): IgPost => ({
  ...p,
  permalink: safeHttps(p.permalink, PROFILE),
  image: safeHttps(p.image, PROFILE),
});

// Respaldo curado (fotos del catálogo) cuando el feed en vivo no está disponible.
// Todas enlazan al perfil de Instagram.
const FALLBACK: IgPost[] = [
  '/products/ramo-de-24-rosas.jpg',
  '/products/florero-de-20-tulipanes-2.jpg',
  '/products/box-de-luxe.jpg',
  '/products/orquidea-rosado-vintage.jpg',
  '/products/tulipanes-de-amor.jpg',
  '/products/arreglo-rossie.jpg',
  '/products/ramo-de-10-tulipanes.jpg',
  '/products/box-valentina.jpg',
].map((image, i) => ({ id: 'fb-' + i, image, permalink: PROFILE }));

function IgGlyph({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 1.62c-3.15 0-3.52.01-4.76.07-1.15.05-1.77.24-2.19.4-.55.22-.94.47-1.35.88-.41.41-.66.8-.88 1.35-.16.42-.35 1.04-.4 2.19-.06 1.24-.07 1.61-.07 4.76s.01 3.52.07 4.76c.05 1.15.24 1.77.4 2.19.22.55.47.94.88 1.35.41.41.8.66 1.35.88.42.16 1.04.35 2.19.4 1.24.06 1.61.07 4.76.07s3.52-.01 4.76-.07c1.15-.05 1.77-.24 2.19-.4.55-.22.94-.47 1.35-.88.41-.41.66-.8.88-1.35.16-.42.35-1.04.4-2.19.06-1.24.07-1.61.07-4.76s-.01-3.52-.07-4.76c-.05-1.15-.24-1.77-.4-2.19a3.6 3.6 0 0 0-.88-1.35 3.6 3.6 0 0 0-1.35-.88c-.42-.16-1.04-.35-2.19-.4-1.24-.06-1.61-.07-4.76-.07Zm0 2.76a5.3 5.3 0 1 1 0 10.6 5.3 5.3 0 0 1 0-10.6Zm0 8.74a3.44 3.44 0 1 0 0-6.88 3.44 3.44 0 0 0 0 6.88Zm6.74-8.94a1.24 1.24 0 1 1-2.48 0 1.24 1.24 0 0 1 2.48 0Z" />
    </svg>
  );
}

export const InstagramGallery = () => {
  const [posts, setPosts] = useState<IgPost[]>(FALLBACK);

  useEffect(() => {
    let alive = true;
    fetch(API_BASE + '/api/instagram')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((d) => {
        if (!alive) return;
        if (d && Array.isArray(d.posts) && d.posts.length) setPosts(d.posts.slice(0, 8).map(sanitizePost));
      })
      .catch(() => { /* se mantiene el respaldo curado */ });
    return () => { alive = false; };
  }, []);

  return (
    <Seccion>
        <header className="mb-16 grid gap-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-12">
          <Reveal>
            <p className="rotulo">Síguenos</p>
            <h2 className="display mt-4 text-[clamp(2.3rem,5.4vw,4.6rem)] leading-[0.98] text-ink-900">
              Lima Flores<br />en <em>Instagram.</em>
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="sm:pb-2">
            <a
              href={PROFILE}
              target="_blank"
              rel="noopener noreferrer"
              className={`${enlaceTexto} inline-flex items-center gap-2.5`}
            >
              <IgGlyph className="h-4 w-4" />
              Seguir {HANDLE}
              <span aria-hidden="true">→</span>
            </a>
          </Reveal>
        </header>

        <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {posts.map((p) => (
            <StaggerItem key={p.id}>
              <a
                href={p.permalink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={p.caption ? `Ver en Instagram: ${p.caption}` : 'Ver publicación en Instagram'}
                className="group relative block aspect-square overflow-hidden bg-secondary"
              >
                <img
                  src={p.image}
                  alt={p.caption || 'Publicación de Lima Flores en Instagram'}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-ink-900/0 opacity-0 transition-all duration-300 group-hover:bg-ink-900/35 group-hover:opacity-100">
                  <IgGlyph className="h-8 w-8 text-ivory-50 drop-shadow" />
                </div>
              </a>
            </StaggerItem>
          ))}
        </Stagger>
    </Seccion>
  );
};
