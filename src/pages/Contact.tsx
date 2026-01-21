import React from "react";
import { Mail, Phone, MapPin, Clock, Zap, Sparkles } from "lucide-react";
import { AIChatContact } from "@/components/AIChatContact";

export const Contact = () => {

  return (
    <div className="min-h-screen bg-background py-16 px-4 pb-24 tech-grid relative overflow-hidden">
      {/* Aurora background effect */}
      <div className="aurora-bg fixed inset-0 pointer-events-none" />
      
      {/* Ambient effects */}
      <div className="fixed top-1/3 left-0 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[150px] pointer-events-none animate-float-rotate" />
      <div className="fixed bottom-1/3 right-0 w-[400px] h-[400px] bg-primary-glow/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 left-1/2 w-[300px] h-[300px] bg-accent-orange/10 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto pt-12 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-6 px-5 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm shadow-glass">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-mono text-primary font-semibold">Contact Us</span>
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 gradient-text">
            Let's Engineer Your Vision
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Ready to transform your digital presence? 
            <span className="block mt-3 text-primary font-semibold">Connect with our team of experts today.</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* AI Chat Contact Form */}
          <div className="glass-card rounded-3xl p-8 md:p-10 shadow-glass border border-glass-border relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <h2 className="text-2xl font-bold mb-8 text-foreground">Discuss Your Project</h2>
              <AIChatContact />
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-8">
            <div className="glass-card rounded-3xl p-10 shadow-glass hover:shadow-premium transition-all duration-500 animate-glass-appear border border-glass-border relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <h2 className="text-2xl font-bold mb-10 text-foreground">Get in Touch</h2>
                
                <div className="space-y-8">
                  <div className="flex items-start gap-5 group/item">
                    <div className="bg-primary/10 p-4 rounded-2xl backdrop-blur-sm border border-primary/20 shadow-glass group-hover/item:shadow-glow transition-all duration-300 group-hover/item:scale-110">
                      <Mail className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold mb-2 text-foreground text-lg">Email</h3>
                      <p className="text-primary font-semibold mb-1">hello@brainbulbwebdesign.com</p>
                      <p className="text-sm text-muted-foreground font-mono">24h response guarantee</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-5 group/item">
                    <div className="bg-primary/10 p-4 rounded-2xl backdrop-blur-sm border border-primary/20 shadow-glass group-hover/item:shadow-glow transition-all duration-300 group-hover/item:scale-110">
                      <Phone className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold mb-2 text-foreground text-lg">Phone</h3>
                      <p className="text-primary font-semibold mb-1">(555) 123-4567</p>
                      <p className="text-sm text-muted-foreground font-mono">Mon-Fri, 9AM-6PM EST</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-5 group/item">
                    <div className="bg-primary/10 p-4 rounded-2xl backdrop-blur-sm border border-primary/20 shadow-glass group-hover/item:shadow-glow transition-all duration-300 group-hover/item:scale-110">
                      <MapPin className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold mb-2 text-foreground text-lg">Location</h3>
                      <p className="text-primary font-semibold mb-1">Remote & On-Site</p>
                      <p className="text-sm text-muted-foreground font-mono">Global service delivery</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-3xl p-8 md:p-10 shadow-glass hover:shadow-premium transition-all duration-500 border border-glass-border relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="bg-primary/10 p-3 rounded-xl backdrop-blur-sm border border-primary/20">
                    <Clock className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Project Timeline</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-4 border-b border-border group/timeline hover:border-primary/30 transition-colors">
                    <span className="font-semibold text-foreground">Initial Consultation</span>
                    <span className="text-primary font-mono font-bold">24-48h</span>
                  </div>
                  <div className="flex justify-between items-center py-4 border-b border-border group/timeline hover:border-primary/30 transition-colors">
                    <span className="font-semibold text-foreground">Proposal & Contract</span>
                    <span className="text-primary font-mono font-bold">2-3 days</span>
                  </div>
                  <div className="flex justify-between items-center py-4 border-b border-border group/timeline hover:border-primary/30 transition-colors">
                    <span className="font-semibold text-foreground">Design & Development</span>
                    <span className="text-primary font-mono font-bold">2-4 weeks</span>
                  </div>
                  <div className="flex justify-between items-center py-4">
                    <span className="font-semibold text-foreground">Launch & Support</span>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      <span className="text-primary font-mono font-bold">Ongoing</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};