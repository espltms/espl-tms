/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#f4f6f9",
        foreground: "#1e293b",
        surface: "#f8fafc",
        card: {
          DEFAULT: "#ffffff",
          border: "#e2e8f0",
        },
        brand: {
          primary: "#2563eb",     // Royal Corporate Blue
          secondary: "#d97706",   // Amber Gold accent
          success: "#059669",     // Emerald corporate green
          danger: "#dc2626",      // Confident red
          warning: "#ca8a04",     // Yellow
          slate: "#e2e8f0"        // Light border/muted
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "sans-serif"],
      },
      boxShadow: {
        glass: "0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06)",
        "glass-glow": "0 4px 14px rgba(37, 99, 235, 0.10)",
        "card": "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)",
        "card-hover": "0 4px 12px rgba(0, 0, 0, 0.08)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-in": "slideIn 0.4s ease-out",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(40px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      }
    },
  },
  plugins: [],
}
