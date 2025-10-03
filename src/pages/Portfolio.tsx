import React, { useState } from "react";
import { ProjectModal } from "@/components/ProjectModal";
import { Button } from "@/components/ui/button";
import { Monitor, ExternalLink, Calendar, User, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RippleEffect } from "@/components/RippleEffect";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

// Enhanced portfolio data with photo reels and detailed information
const projects = [
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

export const Portfolio = () => {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const categories = ["all", "Corporate Website", "E-commerce", "Healthcare", "Creative Portfolio", "SaaS Platform", "Restaurant & Hospitality"];
  
  const filteredProjects = filterCategory === "all" 
    ? projects 
    : projects.filter(project => project.category === filterCategory);

  const openProject = (projectId: string) => {
    setSelectedProject(projectId);
  };

  const closeProject = () => {
    setSelectedProject(null);
  };

  return (
    <div className="min-h-screen bg-gradient-hero py-16 px-4 pb-24 tech-grid relative overflow-hidden">
      {/* Ambient effects */}
      <div className="fixed top-0 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 left-1/4 w-96 h-96 bg-primary-glow/15 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto pt-12 relative z-10">
        <div className="text-center mb-12">
          <div className="inline-block mb-4 px-4 py-1 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm">
            <span className="text-sm font-mono text-primary font-semibold">Portfolio</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-br from-foreground via-primary to-foreground bg-clip-text text-transparent">Our Elite Projects</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Engineered solutions that set industry benchmarks.
            <span className="block mt-2 text-primary font-medium">Click any project to explore detailed case studies and technical insights.</span>
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((category) => (
            <Button
              key={category}
              variant={filterCategory === category ? "cta" : "glass"}
              size="sm"
              onClick={() => setFilterCategory(category)}
              className="capitalize rounded-xl font-medium"
            >
              <Code2 className="w-3 h-3 mr-1" />
              {category === "all" ? "All Projects" : category}
            </Button>
          ))}
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map((project, index) => (
            <RippleEffect
              key={project.id}
              className="glass-card rounded-3xl overflow-hidden shadow-glass hover:shadow-premium transition-all duration-500 cursor-pointer group animate-slide-up-fade hover:scale-105 border border-glass-border relative"
              style={{ animationDelay: `${index * 0.1}s` }}
              onClick={() => openProject(project.id)}
            >
              <div className="aspect-video relative overflow-hidden">
                <img 
                  src={project.images[0]} 
                  alt={project.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-4 left-4 right-4">
                    <Button variant="cta" size="sm" className="w-full">
                      <Monitor className="w-4 h-4 mr-2" />
                      View Project
                    </Button>
                  </div>
                </div>
                {project.featured && (
                  <div className="absolute top-3 right-3 bg-gradient-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold shadow-glow">
                    Featured
                  </div>
                )}
                <div className="absolute top-3 left-3 glass-card text-foreground px-3 py-1 rounded-full text-xs font-medium border border-glass-border">
                  {project.images.length} Photos
                </div>
              </div>
              
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-primary font-bold bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                    {project.category}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">{project.year}</span>
                </div>
                <h3 className="text-xl font-bold mb-2 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">{project.title}</h3>
                <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{project.description}</p>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3" />
                    <span className="font-mono">{project.client}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    <span className="font-mono">{project.duration}</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {project.technologies.slice(0, 3).map((tech) => (
                    <span 
                      key={tech}
                      className="px-2 py-1 bg-primary/10 text-primary rounded-lg text-xs font-semibold border border-primary/20"
                    >
                      {tech}
                    </span>
                  ))}
                  {project.technologies.length > 3 && (
                    <span className="px-2 py-1 glass-card text-muted-foreground rounded-lg text-xs font-medium border border-glass-border">
                      +{project.technologies.length - 3}
                    </span>
                  )}
                </div>
              </div>
            </RippleEffect>
          ))}
        </div>

        {/* Project Modal */}
        {selectedProject && (
          <ProjectModal
            project={projects.find(p => p.id === selectedProject)!}
            isOpen={!!selectedProject}
            onClose={closeProject}
          />
        )}
      </div>
    </div>
  );
};
