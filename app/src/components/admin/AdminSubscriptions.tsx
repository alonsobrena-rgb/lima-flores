// Las suscripciones ya NO se editan desde este panel: se gestionan por completo
// en el panel de Culqi (listar, pausar, cancelar, ver cobros). Esta sección solo
// muestra un aviso con el enlace al panel.
const CULQI_PANEL = 'https://culqipanel.culqi.com/login';

export function AdminSubscriptions() {
  return (
    <div className="mx-auto max-w-xl border border-border bg-surface p-8 text-center md:p-12">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rosa-50 text-rosa-500">
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-3.46-7.1" /><path d="M21 4v5h-5" />
        </svg>
      </div>
      <h2 className="mt-5 font-display text-2xl font-medium text-ink-900">Las suscripciones se gestionan en Culqi</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-foreground/65">
        El listado, los cobros recurrentes, las pausas y las cancelaciones se administran
        directamente desde el panel de Culqi. Aquí ya no hay editor de suscripciones.
      </p>
      <a
        href={CULQI_PANEL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-7 inline-flex items-center gap-2 bg-rosa-500 px-6 py-3 text-[13px] font-medium uppercase tracking-[0.14em] text-ivory-50 transition-colors hover:bg-rosa-600"
      >
        Abrir panel de Culqi
        <span aria-hidden>→</span>
      </a>
    </div>
  );
}
