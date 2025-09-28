import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Play, Monitor, Sparkles, ExternalLink } from "lucide-react";
import { ProjectModal } from "@/components/ProjectModal";

// Featured projects data for homepage showcase
const featuredProjects = [
  {
    id: "1",
    title: "TechCorp Solutions",
    description: "Modern corporate website with responsive design and advanced functionality.",
    fullDescription: "A comprehensive corporate website built for TechCorp Solutions, featuring a modern design system, responsive layout, and advanced functionality including client portals, service showcases, and integrated contact systems. The site was designed to establish TechCorp as a leader in their industry while providing an exceptional user experience across all devices.",
    images: [
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800",
      "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800",
      "https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=800",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800"
    ],
    technologies: ["React", "TypeScript", "Tailwind CSS", "Node.js", "PostgreSQL"],
    liveUrl: "https://example.com",
    githubUrl: "https://github.com/example",
    featured: true,
    client: "TechCorp Solutions",
    category: "Corporate Website",
    duration: "6 weeks",
    year: "2024",
    challenges: [
      "Complex data visualization requirements",
      "Integration with legacy systems",
      "High-performance requirements for large datasets",
      "Multi-language support implementation"
    ],
    results: [
      "40% increase in user engagement",
      "60% reduction in page load times",
      "100% accessibility compliance achieved",
      "Mobile traffic increased by 75%"
    ]
  },
  {
    id: "2", 
    title: "Bella Vista Restaurant",
    description: "Beautiful restaurant website with online ordering system.",
    fullDescription: "An elegant restaurant website for Bella Vista, featuring an immersive visual experience, online reservation system, and integrated ordering platform. The design emphasizes the restaurant's premium dining experience while making it easy for customers to book tables and order takeaway.",
    images: [
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800",
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800",
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
      "https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=800"
    ],
    technologies: ["React", "Stripe", "Firebase", "CSS3"],
    liveUrl: "https://example.com",
    client: "Bella Vista Restaurant",
    category: "Restaurant & Hospitality",
    duration: "4 weeks",
    year: "2024",
    challenges: [
      "Real-time table availability system",
      "Payment processing integration",
      "Menu management system",
      "Mobile-first ordering experience"
    ],
    results: [
      "Online orders increased by 150%",
      "Table booking efficiency improved by 80%",
      "Customer satisfaction scores up 25%",
      "Average order value increased by 30%"
    ]
  },
  {
    id: "3",
    title: "StyleHub E-commerce", 
    description: "Full-featured online store with payment integration.",
    fullDescription: "A complete e-commerce solution for StyleHub, featuring advanced product filtering, wishlist functionality, secure payment processing, and comprehensive admin dashboard. Built with scalability in mind to handle high traffic volumes and extensive product catalogs.",
    images: [
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800",
      "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800",
      "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800",
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800"
    ],
    technologies: ["React", "Node.js", "Stripe", "MongoDB", "Redis"],
    liveUrl: "https://example.com",
    githubUrl: "https://github.com/example",
    client: "StyleHub Fashion",
    category: "E-commerce",
    duration: "8 weeks",
    year: "2023",
    challenges: [
      "Complex inventory management",
      "Multi-currency payment processing",
      "Advanced search and filtering",
      "Performance optimization for mobile"
    ],
    results: [
      "Sales conversion rate up 45%",
      "Page load speed improved by 50%",
      "Customer retention increased by 35%",
      "Mobile purchases up 120%"
    ]
  },
  {
    id: "4",
    title: "MediCare Plus Clinic",
    description: "Professional healthcare website with appointment booking.",
    fullDescription: "A comprehensive healthcare website for MediCare Plus Clinic, featuring patient portals, online appointment scheduling, telemedicine integration, and HIPAA-compliant secure messaging. The design prioritizes accessibility and ease of use for patients of all ages.",
    images: [
      "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800",
      "https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800",
      "https://images.unsplash.com/photo-1551076805-e1869033e561?w=800",
      "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=800"
    ],
    technologies: ["WordPress", "PHP", "MySQL", "HIPAA Tools"],
    client: "MediCare Plus Clinic",
    category: "Healthcare",
    duration: "5 weeks",
    year: "2024",
    challenges: [
      "HIPAA compliance requirements",
      "Integration with medical software",
      "Appointment scheduling system",
      "Patient data security"
    ],
    results: [
      "Appointment bookings up 90%",
      "Patient satisfaction improved by 40%",
      "Administrative workload reduced by 50%",
      "No-show rates decreased by 25%"
    ]
  },
  {
    id: "5",
    title: "Zenith Creative Agency",
    description: "Dynamic portfolio site showcasing creative work.",
    fullDescription: "An innovative portfolio website for Zenith Creative Agency, featuring interactive animations, case study presentations, and dynamic content management. The site showcases the agency's creative capabilities while providing an engaging user experience that reflects their brand identity.",
    images: [
      "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800",
      "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800",
      "https://images.unsplash.com/photo-1558655146-d09347e92766?w=800",
      "https://images.unsplash.com/photo-1560472355-536de3962603?w=800"
    ],
    technologies: ["Vue.js", "GSAP", "CSS3", "Nuxt.js"],
    client: "Zenith Creative Agency",
    category: "Creative Portfolio",
    duration: "6 weeks",
    year: "2023",
    challenges: [
      "Complex animation sequences",
      "Performance with heavy media content",
      "Cross-browser compatibility",
      "Dynamic content management"
    ],
    results: [
      "Client inquiries increased by 200%",
      "Portfolio engagement up 85%",
      "Award recognition for design excellence",
      "Social media shares up 300%"
    ]
  },
  {
    id: "6",
    title: "DataFlow SaaS Platform",
    description: "Modern SaaS dashboard with user management system.",
    fullDescription: "A sophisticated SaaS platform for DataFlow, featuring comprehensive analytics dashboards, user management systems, API integrations, and scalable architecture. Built to handle enterprise-level data processing while maintaining an intuitive user interface.",
    images: [
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800",
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800",
      "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800",
      "https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=800"
    ],
    technologies: ["React", "Redux", "Material-UI", "Node.js", "AWS"],
    liveUrl: "https://example.com",
    githubUrl: "https://github.com/example",
    client: "DataFlow Technologies",
    category: "SaaS Platform",
    duration: "12 weeks",
    year: "2023",
    challenges: [
      "Real-time data visualization",
      "Scalable architecture design",
      "Complex user permissions",
      "API performance optimization"
    ],
    results: [
      "User adoption rate increased by 180%",
      "Data processing speed improved by 70%",
      "Customer churn reduced by 40%",
      "Revenue growth of 250%"
    ]
  }
];

const Index = () => {
  const navigate = useNavigate();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-hero pb-24 px-4">
      <div className="max-w-6xl mx-auto pt-12">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-4 mb-8">
            <img 
              src="/src/assets/logo-main.png" 
              alt="Brain Bulb Web Design" 
              className="h-30 animate-fade-in"
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
              className="text-lg px-8 py-4 rounded-2xl shadow-glow"
            >
              <Play className="w-5 h-5 mr-2" />
              Explore Our Work
            </Button>
            <Button 
              variant="glass" 
              size="lg"
              onClick={() => navigate("/contact")}
              className="text-lg px-8 py-4 rounded-2xl"
            >
              Start Your Project
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>

          <div className="relative max-w-6xl mx-auto mb-16">
            <div className="glass-card rounded-3xl shadow-premium p-8 animate-glass-appear border border-glass-border">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-glass-border/50">
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-destructive rounded-full"></div>
                    <div className="w-3 h-3 bg-warning rounded-full"></div>
                    <div className="w-3 h-3 bg-success rounded-full"></div>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground ml-2">Portfolio Desktop</span>
                </div>
                <Button 
                  variant="glass" 
                  size="sm"
                  onClick={() => navigate("/portfolio")}
                  className="text-xs rounded-xl"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  View All
                </Button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {featuredProjects.map((project, index) => (
                  <button
                    key={project.id}
                    className="group relative aspect-video rounded-2xl overflow-hidden bg-muted hover:scale-105 transition-all duration-300 shadow-glass hover:shadow-glow"
                    onClick={() => setSelectedProject(project.id)}
                  >
                    <img 
                      src={project.images[0]} 
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <div className="text-xs text-primary font-medium mb-1">{project.category}</div>
                        <div className="text-sm font-semibold text-foreground truncate">{project.title}</div>
                      </div>
                    </div>
                    <div className="absolute top-3 right-3 w-7 h-7 bg-primary/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <Monitor className="w-4 h-4 text-primary" />
                    </div>
                  </button>
                ))}
              </div>
              
              <div className="text-center mt-6 pt-4 border-t border-glass-border">
                <p className="text-sm text-muted-foreground">Click any project above to view detailed case study</p>
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
                className="glass-card rounded-3xl p-8 text-center shadow-glass hover:shadow-glow transition-all duration-500 animate-slide-up-premium hover:scale-105 border border-glass-border"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-6 backdrop-blur-sm border border-primary/20">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-4">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Call to Action */}
          <div className="text-center glass-card rounded-3xl p-10 shadow-glow animate-glass-appear border border-glass-border backdrop-blur-xl">
            <h2 className="text-3xl font-bold mb-6">Ready to Illuminate Your Online Presence?</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto text-lg leading-relaxed">
              Join hundreds of satisfied clients who've transformed their business with our web design expertise.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                variant="cta" 
                size="lg"
                onClick={() => navigate("/pricing")}
                className="rounded-2xl shadow-glow"
              >
                View Pricing
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => navigate("/about")}
                className="rounded-2xl"
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>

        {/* Project Modal */}
        {selectedProject && (
          <ProjectModal
            project={featuredProjects.find(p => p.id === selectedProject)!}
            isOpen={!!selectedProject}
            onClose={() => setSelectedProject(null)}
          />
        )}
    </div>
  );
};

export default Index;
