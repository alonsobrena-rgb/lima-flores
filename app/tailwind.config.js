/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── shadcn semantic tokens (HSL vars, alpha-aware) ──
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },

        // ── Paleta cruda del sistema Florencia (design/direcciones/florencia.css).
        //    Los nombres se mantienen para no tocar 40 archivos; los valores son
        //    los nuevos. `ivory` ya no es marfil: es la escala de blancos.
        ivory: { 50: '#FFFFFF', 100: '#FFFFFF', 200: '#F4F4F3', 300: '#E6E5E3', 400: '#CBC9C6' },
        //    ink-400 es el gris exacto del logotipo, medido sobre el archivo.
        ink: { 300: '#B4ADA4', 400: '#A2A19F', 500: '#6E6862', 600: '#4A443F', 700: '#4A443F', 800: '#2A2623', 900: '#2A2623' },
        rosa: { 50: '#FBEEF2', 100: '#F4D6E0', 200: '#E7AFC2', 300: '#D584A1', 500: '#9E2B5E', 600: '#842049', 700: '#6A1A3B' },
        //    El salvia anterior (#7E8E6E) no existe en el logotipo: se reemplaza
        //    por el verde medido del ramo.
        verde: { 100: '#EDF1E4', 300: '#B6C2A7', 500: '#88A65C', 700: '#5A6850' },
        pesca: { 100: '#FBF0DE', 300: '#F0D9B5', 500: '#E3B785' },
        blush: { 100: '#FCEEF1', 300: '#E7B8C6' },
        surface: { DEFAULT: '#FFFFFF', card: '#FDFCF8' },
      },
      keyframes: {
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        marquee: 'marquee 36s linear infinite',
      },
      fontFamily: {
        sans: ['Jost', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      // 4 / 8 / 14 / pill — radii-shadows.html del sistema.
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '14px',
        pill: '999px',
      },
    },
  },
  plugins: [],
}
