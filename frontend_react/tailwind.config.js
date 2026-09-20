/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        canvas: '#09090b',
        surface: {
          DEFAULT: '#121215',
          hover: '#18181d',
          card: '#16161a',
        },
        border: {
          subtle: '#27272a',
          hover: '#3f3f46',
        },
        accent: {
          watched: '#10b981',
          rating: '#f59e0b',
          crimson: '#e11d48',
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
