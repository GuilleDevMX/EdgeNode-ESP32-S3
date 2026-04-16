/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Habilitar dark mode basado en clase CSS
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Variables CSS inyectadas desde index.css
        'app': 'var(--bg-app)',
        'panel': 'var(--bg-panel)',
        'border-color': 'var(--border-color)',
        'primary': 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        'accent': 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        'danger': 'var(--color-danger)',
        
        // Mapeo semántico de textos
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'muted': 'var(--text-muted)',
      },
      fontFamily: {
        // Tipografía técnica e industrial (DM Sans)
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'], 
        // Tipografía monoespaciada de código (JetBrains Mono)
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      }
    },
  },
  plugins: [],
}
