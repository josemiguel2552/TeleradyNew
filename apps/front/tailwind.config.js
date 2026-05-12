/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/pages/hospital/pricing/pricing.component.html",
    "./src/app/pages/hospital/pricing/pricing.component.scss",
    "./src/app/pages/hospital/pricing/pricing.component.ts",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Poppins;'], 
        'serif': ['Poppins;'],
      },
      colors: {
        '$primary-color-bh': '#0BBBEF',
        '$secondary-color-bh': '#981C80'
      },
    },
  },
  plugins: [],
}

