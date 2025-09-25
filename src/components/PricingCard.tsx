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
}

export const PricingCard = ({ plan, className }: PricingCardProps) => {
  return (
    <div className={cn(
      "relative bg-gradient-window border border-border rounded-lg p-6 shadow-window",
      plan.popular && "border-primary shadow-lg scale-105",
      className
    )}>
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <div className="bg-gradient-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
            <Star className="w-3 h-3" />
            Most Popular
          </div>
        </div>
      )}
      
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
        <div className="mb-2">
          <span className="text-3xl font-bold text-primary">${plan.price}</span>
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
        variant={plan.popular ? "cta" : "osButton"}
        size="lg"
        className="w-full"
      >
        {plan.ctaText || "Get Started"}
      </Button>
    </div>
  );
};