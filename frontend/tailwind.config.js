/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta Corporativa / Referencia
        'navy-dark': '#1E1E2C',
        'orange-accent': '#F29F67',
        'blue-support': '#3B8FF3',
        'teal-support': '#34B1AA',
        'yellow-support': '#E0B50F',
        // Fondos
        'app-bg': '#F4F7F6',
        'panel-bg': '#FFFFFF'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'], // Tipografía limpia para dashboards
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      }
    },
  },
  plugins: [],
}