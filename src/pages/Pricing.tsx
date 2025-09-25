import React from "react";
import { PricingCard } from "@/components/PricingCard";

const pricingPlans = [
  {
    name: "Starter",
    price: 497,
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
    price: 997,
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
    price: 1497, 
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
    price: 0,
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
    <div className="min-h-screen bg-gradient-os py-16 px-4">
      <div className="max-w-7xl mx-auto pt-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Choose the perfect plan for your business. All packages include responsive design, 
            modern development practices, and professional results.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {pricingPlans.map((plan, index) => (
            <PricingCard 
              key={plan.name} 
              plan={plan}
              className={index === 3 ? "md:col-span-2 lg:col-span-1" : ""}
            />
          ))}
        </div>

        <div className="mt-16 bg-gradient-window border border-border rounded-lg p-8 text-center shadow-window">
          <h2 className="text-2xl font-bold mb-4">Why Choose Brain Bulb Web Design?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div>
              <h3 className="font-semibold mb-2">⚡ Fast Delivery</h3>
              <p className="text-sm text-muted-foreground">
                Most projects completed within 2-4 weeks, depending on complexity.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">🎨 Modern Design</h3>
              <p className="text-sm text-muted-foreground">
                Clean, professional designs that work perfectly on all devices.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">🔧 Ongoing Support</h3>
              <p className="text-sm text-muted-foreground">
                We don't disappear after launch. Continued support to keep you running smoothly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};