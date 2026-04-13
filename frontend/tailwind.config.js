/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0f172a',
        panel: '#111827',
        accent: '#22c55e',
        accentSoft: '#86efac',
        danger: '#f43f5e'
      }
    }
  },
  plugins: []
};
