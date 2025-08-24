/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/templates/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'off-white': '#fefefe',
        'dark': '#111',
      },
      fontFamily: {
        'serif': ['Georgia', 'serif'],
      },
    },
  },
  safelist: [
    'no-results',
    'reader-header',
    'reader-btn',
    'reader-title',
    'reader-controls',
    'reader-content'
  ],
  plugins: [],
}