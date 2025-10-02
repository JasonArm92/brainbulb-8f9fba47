import React from "react";
import { Mail, Phone, MapPin, Clock, Zap } from "lucide-react";
import { AIChatContact } from "@/components/AIChatContact";

export const Contact = () => {

  return (
    <div className="min-h-screen bg-gradient-hero py-16 px-4 pb-24 tech-grid relative overflow-hidden">
      {/* Ambient effects */}
      <div className="fixed top-1/3 left-0 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/3 right-0 w-96 h-96 bg-primary-glow/15 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto pt-12 relative z-10">
        <div className="text-center mb-12">
          <div className="inline-block mb-4 px-4 py-1 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm">
            <span className="text-sm font-mono text-primary font-semibold">Contact Us</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-br from-foreground via-primary to-foreground bg-clip-text text-transparent">
            Let's Engineer Your Vision
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Ready to transform your digital presence? 
            <span className="block mt-2 text-primary font-semibold">Connect with our team of experts today.</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* AI Chat Contact Form */}
          <div className="glass-card rounded-3xl p-8 shadow-glass border border-glass-border relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">Discuss Your Project</h2>
              <AIChatContact />
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-8">
            <div className="glass-card rounded-3xl p-10 shadow-glass hover:shadow-premium transition-all duration-500 animate-glass-appear border border-glass-border relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <h2 className="text-2xl font-bold mb-8 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">Get in Touch</h2>
                
                <div className="space-y-8">
                  <div className="flex items-start gap-4 group/item">
                    <div className="bg-primary/10 p-3 rounded-2xl backdrop-blur-sm border border-primary/20 shadow-glass group-hover/item:shadow-glow transition-shadow">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold mb-2 text-foreground">Email</h3>
                      <p className="text-primary font-semibold mb-1">hello@brainbulbwebdesign.com</p>
                      <p className="text-sm text-muted-foreground font-mono">24h response guarantee</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 group/item">
                    <div className="bg-primary/10 p-3 rounded-2xl backdrop-blur-sm border border-primary/20 shadow-glass group-hover/item:shadow-glow transition-shadow">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold mb-2 text-foreground">Phone</h3>
                      <p className="text-primary font-semibold mb-1">(555) 123-4567</p>
                      <p className="text-sm text-muted-foreground font-mono">Mon-Fri, 9AM-6PM EST</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 group/item">
                    <div className="bg-primary/10 p-3 rounded-2xl backdrop-blur-sm border border-primary/20 shadow-glass group-hover/item:shadow-glow transition-shadow">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold mb-2 text-foreground">Location</h3>
                      <p className="text-primary font-semibold mb-1">Remote & On-Site</p>
                      <p className="text-sm text-muted-foreground font-mono">Global service delivery</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-3xl p-8 shadow-glass hover:shadow-premium transition-all duration-500 border border-glass-border relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-primary/10 p-2 rounded-xl backdrop-blur-sm border border-primary/20">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">Project Timeline</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-glass-border/30 group/timeline hover:border-primary/30 transition-colors">
                    <span className="text-sm font-semibold text-foreground">Initial Consultation</span>
                    <span className="text-sm text-primary font-mono font-bold">24-48h</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-glass-border/30 group/timeline hover:border-primary/30 transition-colors">
                    <span className="text-sm font-semibold text-foreground">Proposal & Contract</span>
                    <span className="text-sm text-primary font-mono font-bold">2-3 days</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-glass-border/30 group/timeline hover:border-primary/30 transition-colors">
                    <span className="text-sm font-semibold text-foreground">Design & Development</span>
                    <span className="text-sm text-primary font-mono font-bold">2-4 weeks</span>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm font-semibold text-foreground">Launch & Support</span>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      <span className="text-sm text-primary font-mono font-bold">Ongoing</span>
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
