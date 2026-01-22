import React from "react";
import { Button } from "@/components/ui/button";
import { Lightbulb, Users, Code, Award, Zap, Heart, Target, Rocket, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MagneticButton } from "@/components/MagneticButton";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import logoIcon from "@/assets/logo-icon.png";

export const About = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-background py-16 px-4 pb-24 tech-grid relative overflow-hidden">
      {/* Simplified background */}
      <div className="aurora-bg fixed inset-0 pointer-events-none" />
      
      {/* Static ambient effects - reduced blur */}
      <div className="fixed top-1/4 right-0 w-[300px] h-[300px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 left-0 w-[250px] h-[250px] bg-primary-glow/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-6xl mx-auto pt-12 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-4 mb-8 glass-card px-8 py-4 rounded-2xl shadow-glass border border-glass-border">
            <img src={logoIcon} alt="Brain Bulb" className="w-14 h-14" />
            <h1 className="text-4xl md:text-5xl font-bold gradient-text">About Brain Bulb</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            <span className="text-primary font-semibold">Industry-leading</span> web experiences engineered to transform businesses in the digital landscape.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-20">
          {/* Our Story */}
          <div className="glass-card rounded-3xl p-10 shadow-glass hover:shadow-premium transition-all duration-500 border border-glass-border relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="bg-primary/10 p-4 rounded-2xl backdrop-blur-sm border border-primary/20 shadow-glow">
                  <Lightbulb className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Our Story</h2>
              </div>
              <div className="space-y-6 text-muted-foreground leading-relaxed">
                <p className="relative pl-5 border-l-2 border-primary/40">
                  Brain Bulb Web Design was founded with a <span className="text-primary font-semibold">revolutionary mission</span>: to make industry-leading web design 
                  accessible to businesses of all scales. We believe every visionary idea deserves exceptional digital execution.
                </p>
                <p className="relative pl-5 border-l-2 border-primary/40">
                  Our team combines <span className="text-primary font-semibold">cutting-edge creativity</span> with advanced technical expertise to deliver websites that not only 
                  exceed aesthetic expectations but perform at enterprise levels.
                </p>
                <p className="relative pl-5 border-l-2 border-primary/40">
                  From ambitious startups to Fortune 500 enterprises, we've empowered hundreds of clients 
                  to <span className="text-primary font-semibold">dominate their digital presence</span> and achieve transformative business outcomes.
                </p>
              </div>
            </div>
          </div>

          {/* Our Approach */}
          <div className="glass-card rounded-3xl p-10 shadow-glass hover:shadow-premium transition-all duration-500 border border-glass-border relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="bg-primary/10 p-4 rounded-2xl backdrop-blur-sm border border-primary/20 shadow-glow">
                  <Target className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Our Methodology</h2>
              </div>
              <div className="space-y-6">
                <div className="flex items-start gap-5 group/item">
                  <div className="bg-primary/10 p-3 rounded-xl backdrop-blur-sm border border-primary/20 shadow-glass group-hover/item:shadow-glow transition-all duration-300">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-2 text-foreground">Client-Obsessed</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Your vision is our blueprint. We deeply understand requirements and deliver precision-engineered solutions.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-5 group/item">
                  <div className="bg-primary/10 p-3 rounded-xl backdrop-blur-sm border border-primary/20 shadow-glass group-hover/item:shadow-glow transition-all duration-300">
                    <Rocket className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-2 text-foreground">Cutting-Edge Technology</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      We leverage the latest frameworks and tools to ensure blazing-fast, secure, and infinitely scalable solutions.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-5 group/item">
                  <div className="bg-primary/10 p-3 rounded-xl backdrop-blur-sm border border-primary/20 shadow-glass group-hover/item:shadow-glow transition-all duration-300">
                    <Heart className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-2 text-foreground">Strategic Partnership</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Beyond building websites, we forge lasting partnerships with comprehensive ongoing support and growth strategies.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="mb-20">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-mono text-primary font-semibold">Services</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 gradient-text">Elite Services</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Enterprise-grade solutions engineered for maximum impact</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "Custom Web Engineering",
                description: "Bespoke, pixel-perfect designs engineered to your exact specifications and business objectives.",
                icon: "🎨",
              },
              {
                title: "E-commerce Platforms", 
                description: "Enterprise e-commerce solutions with advanced payment processing and intelligent inventory management.",
                icon: "🛒",
              },
              {
                title: "Technical SEO",
                description: "Advanced search optimization strategies to dominate rankings and maximize organic traffic.",
                icon: "📈",
              },
              {
                title: "Infrastructure Management",
                description: "24/7 monitoring, proactive updates, and military-grade security to keep your site performing at peak.",
                icon: "🔧",
              },
              {
                title: "Performance Optimization",
                description: "Advanced speed optimization and performance tuning for exceptional user experiences.",
                icon: "⚡",
              },
              {
                title: "Responsive Architecture",
                description: "Flawless experiences across all devices, from mobile to 4K displays.",
                icon: "📱",
              }
            ].map((service, index) => (
              <div 
                key={index} 
                className="glass-card rounded-3xl p-8 shadow-glass hover:shadow-premium transition-all duration-500 hover:scale-[1.02] border border-glass-border relative overflow-hidden group animate-slide-up-fade"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="text-5xl mb-5">{service.icon}</div>
                  <h3 className="font-bold mb-3 text-lg text-foreground group-hover:text-primary transition-colors">{service.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center glass-card rounded-3xl p-12 md:p-16 shadow-premium border border-glass-border relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary-glow/10 opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 gradient-text">Ready to Transform Your Digital Future?</h2>
            <p className="text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed text-lg">
              Let's engineer your vision into a <span className="text-primary font-semibold">world-class website</span> that drives measurable results. 
              Schedule your strategic consultation today.
            </p>
            <MagneticButton 
              variant="default" 
              size="lg" 
              className="rounded-2xl shadow-glow px-12 py-6 text-lg"
              onClick={() => navigate("/contact")}
            >
              Get Started Today
              <Zap className="w-5 h-5 ml-2" />
            </MagneticButton>
          </div>
        </div>
      </div>
    </div>
  );
};