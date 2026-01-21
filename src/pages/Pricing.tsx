import React from "react";
import { PricingCard } from "@/components/PricingCard";
import { cn } from "@/lib/utils";
import { Zap, Award, Shield, Sparkles } from "lucide-react";

const pricingPlans = [
  {
    name: "Starter",
    price: 397,
    description: "Perfect for small businesses and personal projects",
    features: [
      { text: "Up to 5 pages", included: true },
      { text: "Mobile responsive design", included: true },
      { text: "Basic SEO optimization", included: true },
      { text: "Contact form", included: true },
      { text: "1 round of revisions", included: true },
      { text: "Social media integration", included: false },
      { text: "E-commerce functionality", included: false },
      { text: "Ongoing support", included: false }
    ],
    ctaText: "Start Building"
  },
  {
    name: "Professional", 
    price: 797,
    description: "Ideal for growing businesses that need more features",
    popular: true,
    features: [
      { text: "Up to 10 pages", included: true },
      { text: "Custom design & branding", included: true },
      { text: "Advanced SEO optimization", included: true },
      { text: "Multiple contact forms", included: true },
      { text: "2 rounds of revisions", included: true },
      { text: "Social media integration", included: true },
      { text: "Basic analytics setup", included: true },
      { text: "E-commerce functionality", included: false },
      { text: "3 months support", included: true }
    ],
    ctaText: "Most Popular"
  },
  {
    name: "Premium",
    price: 1197, 
    description: "Comprehensive solution for established businesses",
    features: [
      { text: "Unlimited pages", included: true },
      { text: "Premium custom design", included: true },
      { text: "Complete SEO package", included: true },
      { text: "Advanced forms & integrations", included: true },
      { text: "Unlimited revisions", included: true },
      { text: "Social media integration", included: true },
      { text: "Advanced analytics & tracking", included: true },
      { text: "E-commerce ready", included: true },
      { text: "6 months support", included: true },
      { text: "Performance optimization", included: true }
    ],
    ctaText: "Go Premium"
  },
  {
    name: "Enterprise",
    price: "enquiry",
    description: "Custom solutions for complex business needs",
    features: [
      { text: "Custom requirements analysis", included: true },
      { text: "Advanced functionality", included: true },
      { text: "Third-party integrations", included: true },
      { text: "Database development", included: true },
      { text: "User authentication systems", included: true },
      { text: "API development", included: true },
      { text: "Ongoing maintenance", included: true },
      { text: "Priority support", included: true },
      { text: "Training & documentation", included: true }
    ],
    ctaText: "Contact Us"
  }
];

export const Pricing = () => {
  return (
    <div className="min-h-screen bg-background py-16 px-4 pb-24 tech-grid relative overflow-hidden">
      {/* Aurora background effect */}
      <div className="aurora-bg fixed inset-0 pointer-events-none" />
      
      {/* Ambient effects */}
      <div className="fixed top-0 left-1/3 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[150px] pointer-events-none animate-float-rotate" />
      <div className="fixed bottom-0 right-1/3 w-[400px] h-[400px] bg-primary-glow/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed top-1/2 right-0 w-[300px] h-[300px] bg-accent-pink/10 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto pt-12 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-6 px-5 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm shadow-glass">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-mono text-primary font-semibold">Pricing Plans</span>
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 gradient-text">
            Elite Solutions, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            <span className="text-primary font-semibold">Industry-leading packages</span> with responsive design, 
            modern development practices, and exceptional results guaranteed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20 items-stretch">
          {pricingPlans.map((plan, index) => (
            <PricingCard 
              key={plan.name} 
              plan={plan}
              className={cn(
                "animate-slide-up-fade h-full",
                index === 3 ? "md:col-span-2 lg:col-span-1" : ""
              )}
              style={{ animationDelay: `${index * 0.1}s` }}
            />
          ))}
        </div>

        <div className="glass-card rounded-3xl p-10 md:p-14 text-center shadow-premium animate-glass-appear border border-glass-border relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary-glow/10 opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-10 gradient-text">Why Choose Brain Bulb?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-left">
              <div className="flex items-start gap-5 group/item">
                <div className="bg-primary/10 p-4 rounded-2xl backdrop-blur-sm border border-primary/20 shadow-glass group-hover/item:shadow-glow transition-all duration-300 group-hover/item:scale-110">
                  <Zap className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-3 text-foreground">Rapid Deployment</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Most projects delivered within 2-4 weeks with enterprise-grade quality, regardless of complexity.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-5 group/item">
                <div className="bg-primary/10 p-4 rounded-2xl backdrop-blur-sm border border-primary/20 shadow-glass group-hover/item:shadow-glow transition-all duration-300 group-hover/item:scale-110">
                  <Award className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-3 text-foreground">Award-Winning Design</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Industry-leading designs that perform flawlessly across all devices and platforms.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-5 group/item">
                <div className="bg-primary/10 p-4 rounded-2xl backdrop-blur-sm border border-primary/20 shadow-glass group-hover/item:shadow-glow transition-all duration-300 group-hover/item:scale-110">
                  <Shield className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-3 text-foreground">Elite Support</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    We're invested in your success. Continued support ensures peak performance long after launch.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};