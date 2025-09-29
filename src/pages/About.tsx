import React from "react";
import { Button } from "@/components/ui/button";
import { Lightbulb, Users, Code, Award, Zap, Heart } from "lucide-react";

export const About = () => {
  return (
    <div className="min-h-screen bg-gradient-hero py-16 px-4 pb-24 relative">
      {/* Tech ambiance */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="max-w-6xl mx-auto pt-12 relative z-10">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6 relative">
            <div className="absolute inset-0 bg-primary/20 blur-2xl animate-pulse"></div>
            <img src="/src/assets/logo-icon.png" alt="Brain Bulb" className="w-16 h-16 relative z-10" style={{ filter: 'drop-shadow(0 0 20px hsl(130 100% 50% / 0.5))' }} />
            <h1 className="text-4xl md:text-5xl font-bold relative z-10" style={{ textShadow: '0 0 30px hsl(130 100% 50% / 0.2)' }}>About Brain Bulb</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            We're passionate about creating exceptional web experiences that help businesses thrive in the digital world.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16 relative">
          {/* Connecting tech line */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-full bg-gradient-to-b from-transparent via-primary/20 to-transparent hidden lg:block"></div>
          
          {/* Our Story */}
          <div className="glass-card rounded-3xl p-10 shadow-glass hover:shadow-glow transition-all duration-500 border border-glass-border relative tech-corners group overflow-hidden">
            {/* Tech overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <div className="flex items-center gap-3 mb-6 relative">
              <div className="bg-primary/10 p-3 rounded-2xl backdrop-blur-sm border border-primary/20">
                <Lightbulb className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Our Story</h2>
            </div>
            <div className="space-y-6 text-muted-foreground leading-relaxed">
              <p>
                Brain Bulb Web Design was founded with a simple mission: to make professional web design 
                accessible to businesses of all sizes. We believe every great idea deserves a great website.
              </p>
              <p>
                Our team combines creativity with technical expertise to deliver websites that not only 
                look stunning but perform exceptionally. We focus on user experience, modern design 
                principles, and cutting-edge technology.
              </p>
              <p>
                From small startups to established enterprises, we've helped hundreds of clients 
                establish their online presence and achieve their digital goals.
              </p>
            </div>
          </div>

          {/* Our Approach */}
          <div className="glass-card rounded-3xl p-10 shadow-glass hover:shadow-glow transition-all duration-500 border border-glass-border relative tech-corners group overflow-hidden">
            {/* Tech overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/0 via-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <div className="flex items-center gap-3 mb-6 relative">
              <div className="bg-primary/10 p-3 rounded-2xl backdrop-blur-sm border border-primary/20">
                <Code className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Our Approach</h2>
            </div>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-2xl backdrop-blur-sm border border-primary/20">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Client-Focused</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Your vision drives our design. We listen, understand, and deliver exactly what you need.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-2xl backdrop-blur-sm border border-primary/20">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Modern Technology</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We use the latest tools and frameworks to ensure fast, secure, and scalable websites.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-2xl backdrop-blur-sm border border-primary/20">
                  <Heart className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Long-term Partnership</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We don't just build websites; we build lasting relationships with ongoing support.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12 relative" style={{ textShadow: '0 0 20px hsl(130 100% 50% / 0.2)' }}>
            <span className="inline-block tech-corners">What We Do</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative">
            {[
              {
                title: "Custom Web Design",
                description: "Unique, responsive designs tailored to your brand and goals.",
                icon: "🎨"
              },
              {
                title: "E-commerce Development", 
                description: "Full-featured online stores with payment processing and inventory management.",
                icon: "🛒"
              },
              {
                title: "SEO Optimization",
                description: "Search engine optimization to help your site rank higher and attract more visitors.",
                icon: "📈"
              },
              {
                title: "Website Maintenance",
                description: "Ongoing support, updates, and security monitoring to keep your site running smoothly.",
                icon: "🔧"
              },
              {
                title: "Performance Optimization",
                description: "Speed optimization and performance tuning for better user experience.",
                icon: "⚡"
              },
              {
                title: "Mobile-First Design",
                description: "Websites that work perfectly on all devices, from phones to desktops.",
                icon: "📱"
              }
            ].map((service, index) => (
              <div 
                key={index} 
                className="glass-card rounded-3xl p-8 shadow-glass hover:shadow-glow transition-all duration-500 hover:scale-105 border border-glass-border relative tech-corners group overflow-hidden"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Holographic effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/5 to-secondary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                <div className="text-3xl mb-4 relative group-hover:scale-110 transition-transform duration-300">{service.icon}</div>
                <h3 className="font-semibold mb-3 text-lg">{service.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center glass-card rounded-3xl p-10 shadow-glow border border-glass-border relative tech-corners overflow-hidden">
          {/* Tech pattern overlay */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, hsl(130 100% 50% / 0.1) 10px, hsl(130 100% 50% / 0.1) 11px)',
          }}></div>
          
          <h2 className="text-2xl font-bold mb-6 relative" style={{ textShadow: '0 0 20px hsl(130 100% 50% / 0.3)' }}>Ready to Start Your Project?</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            Let's turn your ideas into a stunning website that drives results. 
            Contact us today for a free consultation and project quote.
          </p>
          <Button variant="cta" size="lg" className="rounded-2xl shadow-glow">
            Get Started Today
          </Button>
        </div>
      </div>
    </div>
  );
};