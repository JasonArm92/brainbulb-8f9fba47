import React from "react";
import { Mail, Phone, MapPin } from "lucide-react";
import { AIChatContact } from "@/components/AIChatContact";

export const Contact = () => {

  return (
    <div className="min-h-screen bg-gradient-hero py-16 px-4 pb-24 relative">
      {/* Tech ambiance */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-32 left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-32 right-20 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '3s' }}></div>
      </div>

      <div className="max-w-6xl mx-auto pt-12 relative z-10">
        <div className="text-center mb-12 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-20 bg-gradient-to-b from-primary/50 to-transparent"></div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 relative" style={{ textShadow: '0 0 30px hsl(130 100% 50% / 0.3)' }}>
            <span className="inline-block tech-corners">Let's Start Your Project</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Ready to transform your ideas into a stunning website? Get in touch and let's discuss your vision.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 relative">
          {/* Tech connector */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-full bg-gradient-to-b from-transparent via-primary/20 to-transparent hidden lg:block"></div>
          
          {/* AI Chat Contact Form */}
          <div className="relative">
            <h2 className="text-2xl font-bold mb-6 relative" style={{ textShadow: '0 0 20px hsl(130 100% 50% / 0.2)' }}>Let's Discuss Your Project</h2>
            <AIChatContact />
          </div>

          {/* Contact Info */}
          <div className="space-y-8 relative">
            <div className="glass-card rounded-3xl p-10 shadow-glass hover:shadow-glow transition-all duration-500 animate-glass-appear border border-glass-border relative tech-corners group overflow-hidden">
              {/* Holographic overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <h2 className="text-2xl font-bold mb-8 relative" style={{ textShadow: '0 0 20px hsl(130 100% 50% / 0.2)' }}>Get in Touch</h2>
              
              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-2xl backdrop-blur-sm border border-primary/20">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Email</h3>
                    <p className="text-muted-foreground mb-1">hello@brainbulbwebdesign.com</p>
                    <p className="text-sm text-muted-foreground">We typically respond within 24 hours</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-2xl backdrop-blur-sm border border-primary/20">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Phone</h3>
                    <p className="text-muted-foreground mb-1">(555) 123-4567</p>
                    <p className="text-sm text-muted-foreground">Mon-Fri, 9AM-6PM EST</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-2xl backdrop-blur-sm border border-primary/20">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Location</h3>
                    <p className="text-muted-foreground mb-1">Remote & On-Site</p>
                    <p className="text-sm text-muted-foreground">Serving clients nationwide</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-3xl p-8 shadow-glass hover:shadow-glow transition-all duration-500 border border-glass-border relative tech-corners group overflow-hidden">
              {/* Tech pattern */}
              <div className="absolute inset-0 opacity-5" style={{
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 15px, hsl(130 100% 50% / 0.1) 15px, hsl(130 100% 50% / 0.1) 16px)',
              }}></div>
              
              <h3 className="text-xl font-bold mb-6 relative" style={{ textShadow: '0 0 15px hsl(130 100% 50% / 0.2)' }}>Project Timeline</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-glass-border/30">
                  <span className="text-sm font-medium">Initial Consultation</span>
                  <span className="text-sm text-muted-foreground">24-48 hours</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-glass-border/30">
                  <span className="text-sm font-medium">Proposal & Contract</span>
                  <span className="text-sm text-muted-foreground">2-3 days</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-glass-border/30">
                  <span className="text-sm font-medium">Design & Development</span>
                  <span className="text-sm text-muted-foreground">2-4 weeks</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-medium">Launch & Support</span>
                  <span className="text-sm text-muted-foreground">Ongoing</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};