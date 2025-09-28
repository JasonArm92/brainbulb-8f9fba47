import React from "react";
import { Mail, Phone, MapPin } from "lucide-react";
import { AIChatContact } from "@/components/AIChatContact";

export const Contact = () => {

  return (
    <div className="min-h-screen bg-gradient-hero py-16 px-4 pb-24">
      <div className="max-w-6xl mx-auto pt-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Let's Start Your Project
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Ready to transform your ideas into a stunning website? Get in touch and let's discuss your vision.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* AI Chat Contact Form */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Let's Discuss Your Project</h2>
            <AIChatContact />
          </div>

          {/* Contact Info */}
          <div className="space-y-8">
            <div className="glass-card rounded-3xl p-10 shadow-glass hover:shadow-glow transition-all duration-500 animate-glass-appear border border-glass-border">
              <h2 className="text-2xl font-bold mb-8">Get in Touch</h2>
              
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

            <div className="glass-card rounded-3xl p-8 shadow-glass hover:shadow-glow transition-all duration-500 border border-glass-border">
              <h3 className="text-xl font-bold mb-6">Project Timeline</h3>
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