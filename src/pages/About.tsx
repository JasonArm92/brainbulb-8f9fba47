import React from "react";
import { Button } from "@/components/ui/button";
import { Lightbulb, Users, Code, Award, Zap, Heart, Target, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const About = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-gradient-hero py-16 px-4 pb-24 tech-grid relative overflow-hidden">
      {/* Ambient effects */}
      <div className="fixed top-1/4 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/4 left-0 w-96 h-96 bg-primary-glow/15 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto pt-12 relative z-10">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6 glass-card px-6 py-3 rounded-2xl shadow-glass border border-glass-border">
            <img src="/src/assets/logo-icon.png" alt="Brain Bulb" className="w-12 h-12" />
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">About Brain Bulb</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            <span className="text-primary font-semibold">Industry-leading</span> web experiences engineered to transform businesses in the digital landscape.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {/* Our Story */}
          <div className="glass-card rounded-3xl p-10 shadow-glass hover:shadow-premium transition-all duration-500 border border-glass-border relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-primary/10 p-3 rounded-2xl backdrop-blur-sm border border-primary/20 shadow-glow">
                  <Lightbulb className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">Our Story</h2>
              </div>
              <div className="space-y-6 text-muted-foreground leading-relaxed">
                <p className="relative pl-4 border-l-2 border-primary/30">
                  Brain Bulb Web Design was founded with a <span className="text-primary font-semibold">revolutionary mission</span>: to make industry-leading web design 
                  accessible to businesses of all scales. We believe every visionary idea deserves exceptional digital execution.
                </p>
                <p className="relative pl-4 border-l-2 border-primary/30">
                  Our team combines <span className="text-primary font-semibold">cutting-edge creativity</span> with advanced technical expertise to deliver websites that not only 
                  exceed aesthetic expectations but perform at enterprise levels. We focus on user experience, modern design 
                  principles, and bleeding-edge technology.
                </p>
                <p className="relative pl-4 border-l-2 border-primary/30">
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
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-primary/10 p-3 rounded-2xl backdrop-blur-sm border border-primary/20 shadow-glow">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">Our Methodology</h2>
              </div>
              <div className="space-y-6">
                <div className="flex items-start gap-4 group/item">
                  <div className="bg-primary/10 p-3 rounded-2xl backdrop-blur-sm border border-primary/20 shadow-glass group-hover/item:shadow-glow transition-shadow">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-2 text-foreground">Client-Obsessed</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Your vision is our blueprint. We deeply understand requirements and deliver precision-engineered solutions.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 group/item">
                  <div className="bg-primary/10 p-3 rounded-2xl backdrop-blur-sm border border-primary/20 shadow-glass group-hover/item:shadow-glow transition-shadow">
                    <Rocket className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-2 text-foreground">Cutting-Edge Technology</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      We leverage the latest frameworks and tools to ensure blazing-fast, secure, and infinitely scalable solutions.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 group/item">
                  <div className="bg-primary/10 p-3 rounded-2xl backdrop-blur-sm border border-primary/20 shadow-glass group-hover/item:shadow-glow transition-shadow">
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
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">Elite Services</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Enterprise-grade solutions engineered for maximum impact</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "Custom Web Engineering",
                description: "Bespoke, pixel-perfect designs engineered to your exact specifications and business objectives.",
                icon: "🎨",
                gradient: "from-primary/20 to-transparent"
              },
              {
                title: "E-commerce Platforms", 
                description: "Enterprise e-commerce solutions with advanced payment processing and intelligent inventory management.",
                icon: "🛒",
                gradient: "from-primary-glow/20 to-transparent"
              },
              {
                title: "Technical SEO",
                description: "Advanced search optimization strategies to dominate rankings and maximize organic traffic.",
                icon: "📈",
                gradient: "from-primary-deep/20 to-transparent"
              },
              {
                title: "Infrastructure Management",
                description: "24/7 monitoring, proactive updates, and military-grade security to keep your site performing at peak.",
                icon: "🔧",
                gradient: "from-primary/20 to-transparent"
              },
              {
                title: "Performance Optimization",
                description: "Advanced speed optimization and performance tuning for exceptional user experiences.",
                icon: "⚡",
                gradient: "from-primary-glow/20 to-transparent"
              },
              {
                title: "Responsive Architecture",
                description: "Flawless experiences across all devices, from mobile to 4K displays.",
                icon: "📱",
                gradient: "from-primary-deep/20 to-transparent"
              }
            ].map((service, index) => (
              <div 
                key={index} 
                className="glass-card rounded-3xl p-8 shadow-glass hover:shadow-premium transition-all duration-500 hover:scale-105 border border-glass-border relative overflow-hidden group"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${service.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className="relative z-10">
                  <div className="text-4xl mb-4 filter drop-shadow-glow">{service.icon}</div>
                  <h3 className="font-bold mb-3 text-lg bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">{service.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center glass-card rounded-3xl p-12 shadow-premium border border-glass-border relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary-glow/10 opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">Ready to Transform Your Digital Future?</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed text-lg">
              Let's engineer your vision into a <span className="text-primary font-semibold">world-class website</span> that drives measurable results. 
              Schedule your strategic consultation today.
            </p>
            <Button 
              variant="cta" 
              size="lg" 
              className="rounded-2xl shadow-glow px-10 py-6 text-lg"
              onClick={() => navigate("/contact")}
            >
              Get Started Today
              <Zap className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
