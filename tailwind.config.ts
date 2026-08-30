import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d5d9e2',
          300: '#b0b8c9',
          400: '#8591aa',
          500: '#65728e',
          600: '#505b75',
          700: '#424a5f',
          800: '#394050',
          900: '#171a21',
          950: '#0d0f14',
        },
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d6fe',
          300: '#a4b9fc',
          400: '#8093f8',
          500: '#636ef1',
          600: '#4d4de5',
          700: '#413cc9',
          800: '#3634a3',
          900: '#313281',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
