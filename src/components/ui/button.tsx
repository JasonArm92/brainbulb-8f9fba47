import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-gradient-primary text-primary-foreground hover:shadow-glow hover:scale-[1.02] shadow-glass",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90 hover:scale-[1.02]",
        outline: "border-0.5 border-border/50 bg-background/30 backdrop-blur-xl hover:bg-accent/50 hover:border-border",
        secondary: "bg-secondary/60 backdrop-blur-xl text-secondary-foreground hover:bg-secondary/80 hover:scale-[1.02]",
        ghost: "hover:bg-accent/40 backdrop-blur-xl hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Apple-Style Variants
        glass: "glass-card border-glass-border text-foreground hover:bg-accent/20 shadow-glass hover:scale-[1.02]",
        premium: "bg-gradient-primary text-primary-foreground hover:scale-[1.02] shadow-premium hover:shadow-glow",
        taskbar: "bg-taskbar-hover/30 backdrop-blur-xl border-0.5 border-glass-border text-taskbar-foreground hover:bg-taskbar-hover/50 hover:scale-[1.02]",
        floating: "glass shadow-elevated hover:shadow-premium hover:scale-[1.02] text-foreground border-glass-border",
        cta: "bg-gradient-primary text-primary-foreground hover:scale-[1.05] shadow-glow hover:shadow-premium font-bold tracking-tight relative before:absolute before:inset-0 before:bg-gradient-primary before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-200",
      },
      size: {
        default: "h-11 px-6 py-2.5",
        sm: "h-9 rounded-xl px-4 text-xs",
        lg: "h-12 rounded-2xl px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
