import React from "react";
import { Button } from "@/components/ui/button";
import { Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface PricingFeature {
  text: string;
  included: boolean;
}

interface PricingPlan {
  name: string;
  price: number | string;
  description: string;
  features: PricingFeature[];
  popular?: boolean;
  ctaText?: string;
}

interface PricingCardProps {
  plan: PricingPlan;
  className?: string;
  style?: React.CSSProperties;
}

export const PricingCard = ({ plan, className, style }: PricingCardProps) => {
  return (
    <div 
      className={cn(
        "relative glass-card rounded-3xl p-8 shadow-glass hover:shadow-glow transition-all duration-500 border border-glass-border tech-corners group overflow-hidden",
        plan.popular && "border-primary shadow-glow scale-105 animate-glow-pulse",
        className
      )}
      style={style}
    >
      {/* Holographic overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/5 to-secondary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      
      {/* Tech scan line for popular */}
      {plan.popular && (
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse"></div>
      )}
      
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-gradient-primary text-primary-foreground px-6 py-2 rounded-full text-sm font-semibold flex items-center gap-2 shadow-glow relative">
            <div className="absolute inset-0 bg-primary/50 blur-xl animate-pulse"></div>
            <Star className="w-4 h-4 relative z-10" />
            <span className="relative z-10">Most Popular</span>
          </div>
        </div>
      )}
      
      <div className="text-center mb-8 relative z-10">
        <h3 className="text-xl font-bold mb-3" style={{ textShadow: plan.popular ? '0 0 20px hsl(130 100% 50% / 0.3)' : 'none' }}>{plan.name}</h3>
        <div className="mb-3">
          {plan.price === "enquiry" ? (
            <span className="text-2xl font-bold text-primary">Price on Enquiry</span>
          ) : (
            <>
              <span className="text-3xl font-bold text-primary">£{plan.price}</span>
              <span className="text-muted-foreground ml-2">starting at</span>
            </>
          )}
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">{plan.description}</p>
      </div>
      
      <ul className="space-y-4 mb-8 relative z-10">
        {plan.features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <Check 
              className={cn(
                "w-5 h-5 mt-0.5 shrink-0",
                feature.included ? "text-success" : "text-muted-foreground"
              )} 
            />
            <span className={cn(
              "text-sm leading-relaxed",
              !feature.included && "text-muted-foreground line-through"
            )}>
              {feature.text}
            </span>
          </li>
        ))}
      </ul>
      
      <Button 
        variant={plan.popular ? "cta" : "glass"}
        size="lg"
        className="w-full rounded-2xl relative z-10"
      >
        {plan.ctaText || "Get Started"}
      </Button>
    </div>
  );
};