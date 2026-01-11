/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Основные цвета из дизайна
        primary: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },
        // Голубой акцент (кнопки)
        accent: {
          DEFAULT: "#36d1dc",
          light: "#5be7f0",
          dark: "#2bb8c3",
        },
        // Фиолетовый (заголовки, текст)
        purple: {
          DEFAULT: "#6c5ce7",
          light: "#a29bfe",
          dark: "#5849c2",
        },
        // Серые оттенки
        gray: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
        // Статусы
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
        // Аватары
        avatar: {
          green: "#a8e6cf",
          yellow: "#ffd93d",
          pink: "#ffb8d0",
          purple: "#c9b1ff",
          blue: "#a0d2eb",
        },
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
        "3xl": "24px",
      },
      boxShadow: {
        card: "0 2px 8px rgba(0, 0, 0, 0.08)",
        "card-hover": "0 4px 16px rgba(0, 0, 0, 0.12)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};
