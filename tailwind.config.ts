import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
          deep: "hsl(var(--primary-deep))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        taskbar: {
          DEFAULT: "hsl(var(--taskbar))",
          foreground: "hsl(var(--taskbar-foreground))",
          active: "hsl(var(--taskbar-active))",
          hover: "hsl(var(--taskbar-hover))",
        },
        glass: {
          border: "hsl(var(--glass-border))",
          bg: "hsl(var(--glass-bg))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        'gradient-hero': 'var(--gradient-hero)',
        'gradient-glass': 'var(--gradient-glass)',
        'gradient-card': 'var(--gradient-card)',
        'gradient-primary': 'var(--gradient-primary)',
      },
      boxShadow: {
        'glass': 'var(--shadow-glass)',
        'elevated': 'var(--shadow-elevated)',
        'taskbar': 'var(--shadow-taskbar)',
        'glow': 'var(--shadow-glow)',
        'premium': 'var(--shadow-premium)',
      },
      backdropBlur: {
        'taskbar': 'var(--taskbar-blur)',
      },
      transitionTimingFunction: {
        'smooth': 'var(--transition-smooth)',
        'spring': 'var(--transition-spring)',
        'glass': 'var(--transition-glass)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "glass-appear": {
          "0%": { 
            opacity: "0", 
            transform: "scale(0.98) translateY(8px)",
            filter: "blur(4px)",
          },
          "100%": { 
            opacity: "1", 
            transform: "scale(1) translateY(0)",
            filter: "blur(0px)",
          },
        },
        "float-gentle": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "glow-pulse": {
          "0%, 100%": { 
            boxShadow: "0 0 16px hsl(var(--primary) / 0.2), 0 0 32px hsl(var(--primary) / 0.08)" 
          },
          "50%": { 
            boxShadow: "0 0 24px hsl(var(--primary) / 0.3), 0 0 48px hsl(var(--primary) / 0.12)" 
          },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "50%": { opacity: "0.3" },
          "100%": { transform: "translateY(100%)", opacity: "0" },
        },
        "data-flow": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "border-beam": {
          "0%": { offsetDistance: "0%" },
          "100%": { offsetDistance: "100%" },
        },
        "slide-up-premium": {
          "0%": { 
            opacity: "0", 
            transform: "translateY(20px) scale(0.98)",
          },
          "100%": { 
            opacity: "1", 
            transform: "translateY(0) scale(1)",
          },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
        "accordion-up": "accordion-up 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
        "glass-appear": "glass-appear 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)",
        "float-gentle": "float-gentle 5s ease-in-out infinite",
        "shimmer": "shimmer 2.5s ease-in-out infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "slide-up-premium": "slide-up-premium 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)",
        "scan-line": "scan-line 3s ease-in-out infinite",
        "data-flow": "data-flow 15s ease infinite",
        "border-beam": "border-beam 2.5s linear infinite",
        "fade-in": "fade-in 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
