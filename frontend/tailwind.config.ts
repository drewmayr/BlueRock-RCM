import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#bcd3ff",
          300: "#8eb6ff",
          400: "#598dff",
          500: "#3563f5",
          600: "#1f44e0",
          700: "#1a35c4",
          800: "#1c2f9e",
          900: "#1d2d7d",
          950: "#161d4d",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
