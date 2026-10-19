/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        txbg: '#0B0714',
        txpanel: '#140C24',
        txpurple: '#7C3AED',
        txviolet: '#A855F7',
        txorange: '#FF7A18',
        txgreen: '#25D366',
        ink: '#14171C',
        paper: '#F5F6F8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.05), 0 1px 3px rgba(16,24,40,.08)',
        pop: '0 8px 24px rgba(16,24,40,.12)',
      },
    },
  },
  plugins: [],
};
