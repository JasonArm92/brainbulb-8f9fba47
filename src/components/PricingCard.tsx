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
  price: number;
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
        "relative glass-card rounded-2xl p-6 shadow-glass hover:shadow-premium transition-all duration-500",
        plan.popular && "border-primary shadow-glow scale-105 animate-glow-pulse",
        className
      )}
      style={style}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <div className="bg-gradient-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 shadow-glow">
            <Star className="w-4 h-4" />
            Most Popular
          </div>
        </div>
      )}
      
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
        <div className="mb-2">
          <span className="text-3xl font-bold text-primary">£{plan.price}</span>
          <span className="text-muted-foreground ml-1">starting at</span>
        </div>
        <p className="text-muted-foreground text-sm">{plan.description}</p>
      </div>
      
      <ul className="space-y-3 mb-6">
        {plan.features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2">
            <Check 
              className={cn(
                "w-4 h-4 mt-0.5 shrink-0",
                feature.included ? "text-success" : "text-muted-foreground"
              )} 
            />
            <span className={cn(
              "text-sm",
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
        className="w-full"
      >
        {plan.ctaText || "Get Started"}
      </Button>
    </div>
  );
};