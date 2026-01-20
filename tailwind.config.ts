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
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
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
          cyan: "hsl(var(--accent-cyan))",
          orange: "hsl(var(--accent-orange))",
          pink: "hsl(var(--accent-pink))",
          green: "hsl(var(--accent-green))",
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
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      backgroundImage: {
        'gradient-hero': 'var(--gradient-hero)',
        'gradient-glass': 'var(--gradient-glass)',
        'gradient-card': 'var(--gradient-card)',
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-text': 'var(--gradient-text)',
        'gradient-aurora': 'var(--gradient-aurora)',
      },
      boxShadow: {
        'glass': 'var(--shadow-glass)',
        'elevated': 'var(--shadow-elevated)',
        'taskbar': 'var(--shadow-taskbar)',
        'glow': 'var(--shadow-glow)',
        'premium': 'var(--shadow-premium)',
        'neon': 'var(--shadow-neon)',
      },
      backdropBlur: {
        'taskbar': 'var(--taskbar-blur)',
      },
      transitionTimingFunction: {
        'smooth': 'var(--transition-smooth)',
        'spring': 'var(--transition-spring)',
        'glass': 'var(--transition-glass)',
        'creative': 'var(--transition-creative)',
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
            transform: "scale(0.95) translateY(20px)",
            filter: "blur(8px)",
          },
          "100%": { 
            opacity: "1", 
            transform: "scale(1) translateY(0)",
            filter: "blur(0px)",
          },
        },
        "float-gentle": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "glow-pulse": {
          "0%, 100%": { 
            boxShadow: "0 0 20px hsl(var(--primary) / 0.3), 0 0 40px hsl(var(--primary) / 0.15)" 
          },
          "50%": { 
            boxShadow: "0 0 40px hsl(var(--primary) / 0.5), 0 0 80px hsl(var(--primary) / 0.25)" 
          },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "50%": { opacity: "0.6" },
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
            transform: "translateY(30px) scale(0.95)",
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
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "morph": {
          "0%, 100%": { borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%" },
          "25%": { borderRadius: "30% 60% 70% 40% / 50% 60% 30% 60%" },
          "50%": { borderRadius: "50% 60% 30% 60% / 30% 60% 70% 40%" },
          "75%": { borderRadius: "60% 40% 60% 30% / 70% 30% 50% 60%" },
        },
        "tilt": {
          "0%, 100%": { transform: "rotateY(0deg) rotateX(0deg)" },
          "25%": { transform: "rotateY(5deg) rotateX(2deg)" },
          "75%": { transform: "rotateY(-5deg) rotateX(-2deg)" },
        },
        "float-rotate": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "25%": { transform: "translateY(-10px) rotate(2deg)" },
          "75%": { transform: "translateY(-5px) rotate(-2deg)" },
        },
        "wiggle": {
          "0%, 100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
        "bounce-gentle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
        "accordion-up": "accordion-up 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
        "glass-appear": "glass-appear 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
        "float-gentle": "float-gentle 6s ease-in-out infinite",
        "shimmer": "shimmer 3s ease-in-out infinite",
        "glow-pulse": "glow-pulse 4s ease-in-out infinite",
        "slide-up-premium": "slide-up-premium 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
        "scan-line": "scan-line 4s ease-in-out infinite",
        "data-flow": "data-flow 20s ease infinite",
        "border-beam": "border-beam 3s linear infinite",
        "fade-in": "fade-in 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
        "gradient-x": "gradient-x 8s ease infinite",
        "morph": "morph 8s ease-in-out infinite",
        "tilt": "tilt 10s ease-in-out infinite",
        "float-rotate": "float-rotate 6s ease-in-out infinite",
        "wiggle": "wiggle 0.5s ease-in-out",
        "bounce-gentle": "bounce-gentle 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
