// Helpers compartidos para el panel admin (Pedidos · Productos · Studio).
// El admin habla con el backend Node; si se sirve aparte, VITE_API_BASE apunta
// a Railway. Vacío = mismo origen. Siempre con credentials para la cookie.
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '';

export const apiUrl = (path: string) => API_BASE + path;

// Resuelve la ruta de una imagen para mostrarla desde el admin:
// - URL absoluta → tal cual
// - /api/... (imagen subida a la BD) → prefija el backend
// - /products/x.jpg → servida por el origen propio del app
export function resolveImg(path?: string | null): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
  if (path.startsWith('/api/')) return apiUrl(path);
  return path;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('No se pudo leer el archivo'));
    r.readAsDataURL(file);
  });
}

export class AuthError extends Error {
  constructor() { super('Sesión expirada'); this.name = 'AuthError'; }
}

async function parse(r: Response) {
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403) throw new AuthError();
  if (!r.ok) throw new Error((data as any).error || 'HTTP ' + r.status);
  return data;
}

export async function adminGet(path: string) {
  return parse(await fetch(apiUrl(path), { credentials: 'include' }));
}

// Descarga binaria (imagen/PDF) con la cookie de sesión. Lanza AuthError en 401/403.
export async function adminGetBlob(path: string): Promise<Blob> {
  const r = await fetch(apiUrl(path), { credentials: 'include' });
  if (r.status === 401 || r.status === 403) throw new AuthError();
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error((data as any).error || 'HTTP ' + r.status);
  }
  return r.blob();
}

// POST con JSON que devuelve binario (imagen/PDF). Devuelve el blob y las headers
// (p. ej. X-Card-Template para saber qué plantilla salió al azar).
export async function adminPostBlob(path: string, body: unknown): Promise<{ blob: Blob; headers: Headers }> {
  const r = await fetch(apiUrl(path), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (r.status === 401 || r.status === 403) throw new AuthError();
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error((data as any).error || 'HTTP ' + r.status);
  }
  return { blob: await r.blob(), headers: r.headers };
}

export async function adminSend(path: string, method: string, body?: unknown) {
  return parse(await fetch(apiUrl(path), {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }));
}
