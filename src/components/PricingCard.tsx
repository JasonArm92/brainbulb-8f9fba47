import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Sparkles } from "lucide-react";
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
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate("/checkout", { state: { plan } });
  };

  return (
    <div 
      className={cn(
        "relative group h-full",
        className
      )}
      style={style}
    >
      {/* Glow effect on hover */}
      <div className={cn(
        "absolute -inset-[1px] rounded-[2rem] opacity-0 group-hover:opacity-100 transition-all duration-700 blur-sm",
        plan.popular ? "bg-gradient-primary" : "bg-primary/30"
      )} />
      
      {/* Main card */}
      <div className={cn(
        "relative h-full rounded-[2rem] p-[1px] transition-all duration-500",
        plan.popular ? "bg-gradient-primary" : "bg-gradient-to-b from-primary/20 to-transparent"
      )}>
        <div className="h-full rounded-[calc(2rem-1px)] bg-background/95 backdrop-blur-xl p-8 flex flex-col">
          
          {/* Header */}
          <div className="mb-8">
            {plan.popular && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-primary text-primary-foreground text-xs font-bold mb-4 shadow-glow">
                <Sparkles className="w-3.5 h-3.5" />
                Most Popular
              </div>
            )}
            
            <h3 className="text-2xl font-bold mb-2 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              {plan.name}
            </h3>
            
            <p className="text-sm text-muted-foreground leading-relaxed">
              {plan.description}
            </p>
          </div>
          
          {/* Pricing */}
          <div className="mb-8 pb-8 border-b border-border/50">
            {plan.price === "enquiry" ? (
              <div className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Custom Pricing
              </div>
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="text-sm text-muted-foreground">from</span>
                <span className="text-5xl font-bold tracking-tight bg-gradient-to-br from-foreground via-primary to-foreground bg-clip-text text-transparent">
                  £{plan.price}
                </span>
              </div>
            )}
          </div>
          
          {/* Features */}
          <ul className="space-y-3 mb-8 flex-grow">
            {plan.features.map((feature, index) => (
              <li 
                key={index} 
                className={cn(
                  "flex items-start gap-3 text-sm transition-all duration-300",
                  feature.included ? "opacity-100" : "opacity-40"
                )}
              >
                <div className={cn(
                  "shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 transition-all duration-300",
                  feature.included 
                    ? "bg-primary/10 ring-1 ring-primary/30" 
                    : "bg-muted/30 ring-1 ring-muted/30"
                )}>
                  <Check 
                    className={cn(
                      "w-3 h-3",
                      feature.included ? "text-primary" : "text-muted-foreground"
                    )} 
                  />
                </div>
                <span className={cn(
                  "leading-relaxed",
                  feature.included ? "text-foreground" : "text-muted-foreground"
                )}>
                  {feature.text}
                </span>
              </li>
            ))}
          </ul>
          
          {/* CTA */}
          <Button 
            variant={plan.popular ? "default" : "outline"}
            size="lg"
            onClick={handleGetStarted}
            className={cn(
              "w-full rounded-2xl group/button relative overflow-hidden transition-all duration-300",
              plan.popular && "bg-gradient-primary hover:shadow-glow border-0"
            )}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {plan.ctaText || "Get Started"}
              <ArrowRight className="w-4 h-4 group-hover/button:translate-x-1 transition-transform" />
            </span>
          </Button>
          
        </div>
      </div>
    </div>
  );
};
