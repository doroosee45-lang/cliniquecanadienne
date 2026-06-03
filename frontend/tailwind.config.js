/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { poppins: ['Poppins', 'sans-serif'] },
      colors: {
        primary: { DEFAULT: '#2563eb', dark: '#1d4ed8' },
      },
    },
  },
  plugins: [],
};
