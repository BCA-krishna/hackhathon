/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0f172a',
        panel: '#212f4e',
        accent: '#22c55e',
        accentSoft: '#86efac',
        danger: '#f43f5e'
      }
    }
  },
  plugins: []
};
