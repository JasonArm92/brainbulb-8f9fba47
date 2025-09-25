import React from "react";
import { Button } from "@/components/ui/button";
import { Lightbulb, Users, Code, Award, Zap, Heart } from "lucide-react";

export const About = () => {
  return (
    <div className="min-h-screen bg-gradient-os py-16 px-4">
      <div className="max-w-6xl mx-auto pt-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6">
            <img src="/src/assets/logo-icon.png" alt="Brain Bulb" className="w-16 h-16" />
            <h1 className="text-4xl md:text-5xl font-bold">About Brain Bulb</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            We're passionate about creating exceptional web experiences that help businesses thrive in the digital world.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* Our Story */}
          <div className="bg-gradient-window border border-border rounded-lg p-8 shadow-window">
            <div className="flex items-center gap-3 mb-6">
              <Lightbulb className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">Our Story</h2>
            </div>
            <div className="space-y-4 text-muted-foreground">
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
          <div className="bg-gradient-window border border-border rounded-lg p-8 shadow-window">
            <div className="flex items-center gap-3 mb-6">
              <Code className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">Our Approach</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Client-Focused</h3>
                  <p className="text-sm text-muted-foreground">
                    Your vision drives our design. We listen, understand, and deliver exactly what you need.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Modern Technology</h3>
                  <p className="text-sm text-muted-foreground">
                    We use the latest tools and frameworks to ensure fast, secure, and scalable websites.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <Heart className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Long-term Partnership</h3>
                  <p className="text-sm text-muted-foreground">
                    We don't just build websites; we build lasting relationships with ongoing support.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">What We Do</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              <div key={index} className="bg-gradient-window border border-border rounded-lg p-6 shadow-window hover:shadow-lg transition-shadow">
                <div className="text-2xl mb-3">{service.icon}</div>
                <h3 className="font-semibold mb-2">{service.title}</h3>
                <p className="text-sm text-muted-foreground">{service.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center bg-gradient-window border border-border rounded-lg p-8 shadow-window">
          <h2 className="text-2xl font-bold mb-4">Ready to Start Your Project?</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Let's turn your ideas into a stunning website that drives results. 
            Contact us today for a free consultation and project quote.
          </p>
          <Button variant="cta" size="lg">
            Get Started Today
          </Button>
        </div>
      </div>
    </div>
  );
};