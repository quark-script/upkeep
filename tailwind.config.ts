import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Vault theme (default)
        bg: '#0E0E10',
        panel: '#16161A',
        'panel-inset': '#1C1C20',
        text: '#EDEAE3',
        'text-dim': '#9A968D',
        'text-faint': '#5C5851',
        accent: '#B0413E',
        'accent-text': '#EDEAE3',
        success: '#9CB084',
        warn: '#D5A45F',
        danger: '#B0413E',
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'serif'],
        sans: ['"Inter Tight"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        card: '14px',
        'card-lg': '22px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.03) inset, 0 18px 40px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}

export default config
