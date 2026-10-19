/** @type {import('tailwindcss').Config} */
module.exports = {
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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
