/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F9FAFB",
        foreground: "#111827",
        muted: "#6B7280",
        border: "#E5E7EB",
        "surface-tint": "#EEF2FF",
        "tag-bg": "#F3F4F6",
        primary: {
          DEFAULT: "#444CE7",
          hover: "#3A42D8",
          soft: "#C7D2FE",
          background: "#E0E7FF",
          tint: "#EEF2FF",
          foreground: "#ffffff",
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#444CE7',
          600: '#3A42D8',
          700: '#3338a8',
          800: '#2b2f8a',
          900: '#23266b',
          950: '#181a4d',
        },
        accent: {
          DEFAULT: "#444CE7",
          hover: "#3A42D8",
          foreground: "#ffffff",
        },
        card: {
          DEFAULT: "#FFFFFF",
          surface: "#EEF2FF",
          border: "#E5E7EB",
        },
        success: "#10b981",
        warning: "#f59e0b",
        error: "#DC2626",
        destructive: "#DC2626",
        "ai-core": "#444CE7"
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(17, 24, 39, 0.08), 0 1px 2px -1px rgba(17, 24, 39, 0.06)",
      }
    },
  },
  plugins: [],
}
