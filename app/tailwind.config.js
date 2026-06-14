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

        // ── Lima Flores raw palette (from site/css/lf-design/tokens/colors.css) ──
        ivory: { 50: '#FBF9F4', 100: '#F6F3EC', 200: '#EFEAE0', 300: '#E4DDD0', 400: '#CFC6B6' },
        ink: { 300: '#B4ADA4', 400: '#8E8A86', 500: '#6E6862', 700: '#4A443F', 900: '#2A2623' },
        rosa: { 50: '#FBEEF2', 100: '#F4D6E0', 200: '#E7AFC2', 300: '#D584A1', 500: '#9E2B5E', 600: '#842049', 700: '#6A1A3B' },
        verde: { 100: '#E8ECE1', 300: '#B6C2A7', 500: '#7E8E6E', 700: '#5A6850' },
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
        serifAlt: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}
