import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Play, Monitor, Sparkles } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-hero pb-24 px-4">
      <div className="max-w-6xl mx-auto pt-12">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-4 mb-8">
              <img 
                src="/src/assets/logo-main.png" 
                alt="Brain Bulb Web Design" 
                className="h-20 animate-fade-in"
              />
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-slide-up">
              Web Design That
              <span className="block text-primary">Sparks Success</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-4xl mx-auto animate-slide-up">
              Professional websites that capture your vision and drive results. 
              From concept to launch, we create digital experiences that make your business shine.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12 animate-slide-up">
              <Button 
                variant="cta" 
                size="lg"
                onClick={() => navigate("/portfolio")}
                className="text-lg px-8 py-4"
              >
                <Play className="w-5 h-5 mr-2" />
                Explore Our Work
              </Button>
              <Button 
                variant="glass" 
                size="lg"
                onClick={() => navigate("/contact")}
                className="text-lg px-8 py-4"
              >
                Start Your Project
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>

          <div className="relative max-w-4xl mx-auto mb-16">
            <div className="glass-card rounded-2xl shadow-premium p-6 animate-glass-appear">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-glass-border">
                <div className="flex gap-1">
                  <div className="w-3 h-3 bg-destructive rounded-full"></div>
                  <div className="w-3 h-3 bg-warning rounded-full"></div>
                  <div className="w-3 h-3 bg-success rounded-full"></div>
                </div>
                <span className="text-sm text-muted-foreground ml-2">Portfolio Desktop</span>
              </div>
              
              <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                {[
                  "TechCorp Solutions",
                  "Local Restaurant", 
                  "E-commerce Store",
                  "Healthcare Clinic",
                  "Creative Agency",
                  "SaaS Platform"
                ].map((project, index) => (
                  <button
                    key={project}
                    className="flex flex-col items-center p-3 rounded-lg hover:bg-accent/50 transition-colors group"
                    onClick={() => navigate("/portfolio")}
                  >
                    <Monitor className="w-8 h-8 text-primary mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-xs text-center">{project}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {[
              {
                icon: <Sparkles className="w-8 h-8 text-primary" />,
                title: "Modern Design",
                description: "Clean, professional designs that capture your brand and engage your audience."
              },
              {
                icon: <Monitor className="w-8 h-8 text-primary" />,
                title: "Responsive & Fast",
                description: "Websites that look perfect and load quickly on all devices and screen sizes."
              },
              {
                icon: <ArrowRight className="w-8 h-8 text-primary" />,
                title: "Results Driven",
                description: "Strategic design focused on converting visitors into customers and driving growth."
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="glass-card rounded-2xl p-6 text-center shadow-glass hover:shadow-premium transition-all duration-500 animate-slide-up-premium hover:scale-105"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Call to Action */}
          <div className="text-center glass-card rounded-2xl p-8 shadow-premium animate-glass-appear">
            <h2 className="text-3xl font-bold mb-4">Ready to Illuminate Your Online Presence?</h2>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Join hundreds of satisfied clients who've transformed their business with our web design expertise.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                variant="cta" 
                size="lg"
                onClick={() => navigate("/pricing")}
              >
                View Pricing
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => navigate("/about")}
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
    </div>
  );
};

export default Index;
