import React from "react";
import { Button } from "@/components/ui/button";
import { Check, Star, Zap } from "lucide-react";
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
        "relative glass-card rounded-3xl p-8 shadow-glass hover:shadow-premium transition-all duration-500 border border-glass-border group overflow-hidden",
        plan.popular && "border-primary shadow-premium scale-105",
        className
      )}
      style={style}
    >
      {plan.popular && (
        <>
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
            <div className="bg-gradient-primary text-primary-foreground px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-glow border border-primary/30">
              <Star className="w-4 h-4 fill-current" />
              Most Popular
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary-glow/10 opacity-50 animate-pulse" />
        </>
      )}
      
      {!plan.popular && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      )}
      
      <div className="text-center mb-8 relative z-10">
        <div className="inline-block mb-3 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm">
          <h3 className="text-sm font-mono font-bold text-primary">{plan.name}</h3>
        </div>
        <div className="mb-4">
          {plan.price === "enquiry" ? (
            <div className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">Custom Pricing</div>
          ) : (
            <>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">£{plan.price}</span>
                <span className="text-muted-foreground text-sm font-mono">starting at</span>
              </div>
            </>
          )}
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">{plan.description}</p>
      </div>
      
      <ul className="space-y-4 mb-8 relative z-10">
        {plan.features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3 group/feature">
            <div className={cn(
              "mt-0.5 shrink-0 p-1 rounded-lg border transition-all duration-300",
              feature.included 
                ? "bg-success/10 border-success/30 group-hover/feature:shadow-glow" 
                : "bg-muted/30 border-muted/50"
            )}>
              <Check 
                className={cn(
                  "w-4 h-4",
                  feature.included ? "text-success" : "text-muted-foreground"
                )} 
              />
            </div>
            <span className={cn(
              "text-sm leading-relaxed",
              feature.included ? "text-foreground font-medium" : "text-muted-foreground line-through"
            )}>
              {feature.text}
            </span>
          </li>
        ))}
      </ul>
      
      <Button 
        variant={plan.popular ? "cta" : "glass"}
        size="lg"
        className="w-full rounded-2xl relative z-10 group/button"
      >
        {plan.ctaText || "Get Started"}
        <Zap className="w-4 h-4 ml-2 group-hover/button:scale-110 transition-transform" />
      </Button>
    </div>
  );
};
