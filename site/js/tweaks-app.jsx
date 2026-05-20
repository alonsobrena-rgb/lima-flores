/* global React, ReactDOM, TweaksPanel, TweakSection, TweakRadio, TweakSelect, useTweaks */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "atelier",
  "display": "cormorant",
  "density": "aire"
}/*EDITMODE-END*/;

const PALETTES = {
  atelier:  { label: 'Atelier',   note: 'Cálido — bone, ink y musgo. La esencia.' },
  nocturno: { label: 'Nocturno',  note: 'Oscuro y dramático — ink dominante, acentos terracota.' },
  provence: { label: 'Provence',  note: 'Romántico — papel crema con acentos terracota.' },
  botanico: { label: 'Botánico',  note: 'Verde profundo — más jardín, menos café.' }
};
const DISPLAYS = {
  cormorant: { label: 'Cormorant',     note: 'Serif ligero editorial · el actual.' },
  playfair:  { label: 'Playfair',      note: 'Alto contraste · revista de moda.' },
  dmserif:   { label: 'DM Serif',      note: 'Robusto y moderno.' },
  italiana:  { label: 'Italiana',      note: 'Delicado, de pasarela.' }
};
const DENSITIES = {
  aire:      { label: 'Aire',      note: 'Ritmo intermedio.' },
  pasarela:  { label: 'Pasarela',  note: 'Aire generoso, tipografía más grande.' },
  galeria:   { label: 'Galería',   note: 'Compacto, denso, museo de bolsillo.' }
};

function applyTweaks(t) {
  const html = document.documentElement;
  html.dataset.palette = t.palette;
  html.dataset.display = t.display;
  html.dataset.density = t.density;
  // Header dark/light over hero on nocturno
  const header = document.querySelector('.header');
  if (header) {
    if (t.palette === 'nocturno') header.dataset.theme = 'dark';
    else header.dataset.theme = 'dark'; // hero is always dark, keep dark over hero
  }
}

function LimaTweaks() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  React.useEffect(() => applyTweaks(t), [t.palette, t.display, t.density]);

  return (
    <TweaksPanel title="Tweaks · Lima Flores">
      <TweakSection label="Paleta · mood" />
      <TweakSelect
        label="Carácter visual"
        value={t.palette}
        options={Object.keys(PALETTES).map(k => ({ value: k, label: PALETTES[k].label }))}
        onChange={(v) => setTweak('palette', v)}
      />
      <div style={{
        font: 'italic 11px/1.4 "Cormorant Garamond", serif',
        color: 'rgba(41,38,27,.55)',
        padding: '2px 0 4px',
        marginTop: -4
      }}>{PALETTES[t.palette]?.note}</div>

      <TweakSection label="Tipografía display" />
      <TweakSelect
        label="Familia editorial"
        value={t.display}
        options={Object.keys(DISPLAYS).map(k => ({ value: k, label: DISPLAYS[k].label }))}
        onChange={(v) => setTweak('display', v)}
      />
      <div style={{
        font: '11px/1.4 ui-sans-serif, system-ui, sans-serif',
        color: 'rgba(41,38,27,.55)',
        padding: '2px 0 4px',
        marginTop: -4
      }}>{DISPLAYS[t.display]?.note}</div>
      <div style={{
        fontFamily: t.display === 'playfair' ? 'Playfair Display, serif'
                  : t.display === 'dmserif' ? 'DM Serif Display, serif'
                  : t.display === 'italiana' ? 'Italiana, serif'
                  : 'Cormorant Garamond, serif',
        fontSize: 30,
        lineHeight: 0.95,
        letterSpacing: '-0.018em',
        color: '#29261b',
        padding: '10px 12px',
        background: 'rgba(255,255,255,.4)',
        borderRadius: 8,
        marginTop: 2
      }}>
        Flores que <em style={{ fontStyle: 'italic' }}>dicen</em>.
      </div>

      <TweakSection label="Densidad editorial" />
      <TweakRadio
        label="Ritmo"
        value={t.density}
        options={Object.keys(DENSITIES)}
        onChange={(v) => setTweak('density', v)}
      />
      <div style={{
        font: '11px/1.4 ui-sans-serif, system-ui, sans-serif',
        color: 'rgba(41,38,27,.55)',
        padding: '2px 0 4px',
        marginTop: -4
      }}>{DENSITIES[t.density]?.note}</div>
    </TweaksPanel>
  );
}

// Apply current values immediately (without waiting for activation) so the page
// reflects the persisted defaults from disk.
applyTweaks(TWEAK_DEFAULTS);

const root = ReactDOM.createRoot(document.getElementById('tweaks-root'));
root.render(<LimaTweaks />);
