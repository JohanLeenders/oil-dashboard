import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        '14': 'repeat(14, minmax(0, 1fr))',
      },
      colors: {
        // OIL Design Tokens (Wave 9)
        'oil-bg': 'var(--color-bg-main)',
        'oil-card': 'var(--color-bg-card)',
        'oil-elevated': 'var(--color-bg-elevated)',
        'oil-border': 'var(--color-border-subtle)',
        'oil-border-hover': 'var(--color-border-hover)',
        'oil-orange': 'var(--color-oil-orange)',
        'oil-orange-hover': 'var(--color-oil-orange-hover)',
        'oil-gold': 'var(--color-data-gold)',
        'oil-green': 'var(--color-data-green)',
        'oil-red': 'var(--color-data-red)',
        'oil-text': 'var(--color-text-main)',
        'oil-muted': 'var(--color-text-muted)',
        'oil-dim': 'var(--color-text-dim)',
        // Legacy Oranjehoen brand colors (backward compat)
        oranje: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // Legacy status colors
        status: {
          green: '#22c55e',
          yellow: '#eab308',
          orange: '#f97316',
          red: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
        brand: ['var(--font-brand)', 'Playfair Display', 'serif'],
      },
      borderRadius: {
        'oil': '12px',
      },
      backdropBlur: {
        'oil': '12px',
      },
    },
  },
  plugins: [],
};

export default config;
