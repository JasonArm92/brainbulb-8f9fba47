import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Play, Monitor, Sparkles, ExternalLink, Code2, Zap, Layers, ArrowUpRight } from "lucide-react";
import { ProjectModal } from "@/components/ProjectModal";
import { MagneticButton } from "@/components/MagneticButton";
import { AnimatedStats } from "@/components/AnimatedStats";
import { RippleEffect } from "@/components/RippleEffect";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import logoMain from "@/assets/logo-main.png";

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
    <div className="min-h-screen pb-24 relative overflow-hidden">
      {/* Simplified background - no heavy blur animations */}
      <div className="aurora-bg fixed inset-0 pointer-events-none" />
      
      {/* Static ambient orbs - reduced blur and no animations */}
      <div className="fixed top-[-10%] left-[-5%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full bg-gradient-to-br from-primary/20 via-primary-glow/10 to-transparent blur-3xl pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[35vw] h-[35vw] max-w-[400px] max-h-[400px] rounded-full bg-gradient-to-tl from-accent-cyan/15 via-primary/10 to-transparent blur-3xl pointer-events-none" />
      
      {/* Static tech grid - simplified */}
      <div className="tech-grid fixed inset-0 pointer-events-none opacity-30" />
      
      
      <div className="max-w-7xl mx-auto pt-16 px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-24 pt-8">
          {/* Floating badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-8 animate-slide-up-premium border border-glass-border">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green"></span>
            </span>
            <span className="text-sm font-medium text-muted-foreground">Available for new projects</span>
          </div>

          {/* Logo with glow */}
          <div className="relative inline-block mb-10">
            <div className="absolute inset-0 bg-gradient-primary blur-[60px] opacity-40 animate-glow-pulse scale-150" />
            <img 
              src={logoMain}
              alt="Brain Bulb Web Design" 
              className="h-28 md:h-36 relative z-10 animate-float-gentle drop-shadow-2xl"
            />
          </div>

          {/* Main heading with gradient text */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-8 tracking-tight leading-[0.9] animate-slide-up-premium font-display">
            <span className="block text-foreground">Websites That</span>
            <span className="block gradient-text mt-2">Break The Mold</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto animate-slide-up-premium leading-relaxed stagger-2">
            We craft <span className="text-foreground font-medium">boundary-pushing</span> digital experiences 
            that captivate audiences and <span className="gradient-text-static font-semibold">transform businesses</span>.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16 animate-slide-up-premium stagger-3">
            <MagneticButton 
              variant="cta" 
              size="lg"
              onClick={() => navigate("/portfolio")}
              className="text-lg px-10 py-7 rounded-full shadow-glow group relative overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2">
                <Play className="w-5 h-5 group-hover:scale-125 transition-transform duration-300" />
                Explore Our Work
                <Sparkles className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
              </span>
            </MagneticButton>
            <MagneticButton 
              variant="glass" 
              size="lg"
              onClick={() => navigate("/contact")}
              className="text-lg px-10 py-7 rounded-full group neon-glow"
            >
              Start Your Project
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform duration-300" />
            </MagneticButton>
          </div>

          {/* Floating metrics */}
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 animate-slide-up-premium stagger-4">
            {[
              { value: "50+", label: "Projects Delivered" },
              { value: "98%", label: "Client Satisfaction" },
              { value: "5★", label: "Average Rating" },
            ].map((metric, index) => (
              <div key={index} className="text-center group">
                <div className="text-3xl md:text-4xl font-bold gradient-text group-hover:scale-110 transition-transform duration-300">{metric.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio Showcase */}
        <div className="relative max-w-6xl mx-auto mb-20">
          <div className="glass-card rounded-[2rem] shadow-premium p-6 md:p-10 animate-glass-appear border border-glass-border relative overflow-hidden noise-texture">
            {/* Animated border gradient */}
            <div className="absolute inset-0 rounded-[2rem] p-[1px] bg-gradient-to-br from-primary/50 via-accent-cyan/30 to-accent-pink/50 opacity-50 animate-gradient-x" style={{ backgroundSize: '200% 200%' }} />
            
            {/* Technical scan line effect */}
            <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden rounded-[2rem]">
              <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line" />
            </div>
            
            {/* Window header */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-glass-border/50 relative z-10">
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  <div className="w-3 h-3 bg-destructive rounded-full shadow-lg hover:scale-125 transition-transform cursor-pointer" />
                  <div className="w-3 h-3 bg-warning rounded-full shadow-lg hover:scale-125 transition-transform cursor-pointer" />
                  <div className="w-3 h-3 bg-success rounded-full shadow-lg hover:scale-125 transition-transform cursor-pointer" />
                </div>
                <span className="text-sm font-medium text-muted-foreground font-mono tracking-wider">Portfolio.exe</span>
              </div>
              <Button 
                variant="glass" 
                size="sm"
                onClick={() => navigate("/portfolio")}
                className="text-xs rounded-full px-4 group"
              >
                <span>View All</span>
                <ArrowUpRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Button>
            </div>
            
            {/* Project grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 relative z-10">
              {featuredProjects.map((project, index) => (
                <RippleEffect
                  key={project.id}
                  className="group relative aspect-[4/3] rounded-2xl overflow-hidden bg-muted/50 hover:scale-[1.02] transition-all duration-500 shadow-glass hover:shadow-glow border border-glass-border animate-border-dance cursor-pointer perspective-card"
                  onClick={() => setSelectedProject(project.id)}
                  style={{ animationDelay: `${index * 0.5}s` }}
                >
                  <img 
                    src={project.images[0]} 
                    alt={project.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent opacity-80 group-hover:opacity-95 transition-all duration-300">
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold uppercase tracking-wider">{project.category}</span>
                      </div>
                      <div className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{project.title}</div>
                    </div>
                  </div>
                  {/* Hover icon */}
                  <div className="absolute top-3 right-3 w-9 h-9 bg-primary/30 backdrop-blur-md rounded-xl flex items-center justify-center border border-primary/40 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:scale-100 scale-90">
                    <ExternalLink className="w-4 h-4 text-primary-foreground" />
                  </div>
                </RippleEffect>
              ))}
            </div>
            
            <div className="text-center mt-8 pt-4 border-t border-glass-border relative z-10">
              <p className="text-sm text-muted-foreground font-mono">
                <span className="gradient-text-static">Click any project</span> to view detailed case study →
              </p>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 font-display">
              Why Choose <span className="gradient-text">Brain Bulb</span>?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We combine cutting-edge technology with artistic vision to deliver exceptional results.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                icon: <Code2 className="w-8 h-8" />,
                title: "Technical Excellence",
                description: "Engineered with cutting-edge technologies and industry-best practices for unmatched performance.",
                color: "from-primary to-primary-glow",
                accent: "primary"
              },
              {
                icon: <Zap className="w-8 h-8" />,
                title: "Lightning Fast",
                description: "Optimized architecture delivering exceptional speed across all devices and network conditions.",
                color: "from-accent-cyan to-accent-green",
                accent: "cyan"
              },
              {
                icon: <Layers className="w-8 h-8" />,
                title: "Scalable Systems",
                description: "Future-proof infrastructure designed to grow seamlessly with your business expansion.",
                color: "from-accent-pink to-accent-orange",
                accent: "pink"
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="glass-card rounded-3xl p-8 text-center shadow-glass hover:shadow-premium transition-all duration-500 animate-slide-up-premium hover:scale-[1.02] border border-glass-border group relative overflow-hidden"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                {/* Gradient background on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
                
                <div className="relative z-10">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 backdrop-blur-sm border border-glass-border shadow-glow group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 bg-gradient-to-br ${feature.color}`}>
                    <div className="text-primary-foreground">
                      {feature.icon}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-4 group-hover:gradient-text transition-all duration-300 font-display">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Animated Stats Section */}
        <div className="mb-20">
          <AnimatedStats />
        </div>

        {/* Call to Action */}
        <div className="glass-card rounded-[2rem] p-8 md:p-16 shadow-glow animate-glass-appear border border-glass-border relative overflow-hidden group noise-texture">
          {/* Aurora effect on hover */}
          <div className="aurora-bg absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          
          {/* Content */}
          <div className="relative z-10 text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 font-display">
              Ready to <span className="gradient-text">Transform</span> Your Digital Presence?
            </h2>
            <p className="text-muted-foreground mb-10 max-w-2xl mx-auto text-lg leading-relaxed">
              Join industry leaders who've revolutionized their business with our elite web design expertise.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <MagneticButton 
                variant="cta" 
                size="lg"
                onClick={() => navigate("/pricing")}
                className="text-lg px-10 py-6 rounded-full shadow-glow group"
              >
                View Pricing
                <ArrowUpRight className="w-5 h-5 ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </MagneticButton>
              <MagneticButton 
                variant="glass" 
                size="lg"
                onClick={() => navigate("/about")}
                className="text-lg px-10 py-6 rounded-full neon-glow"
              >
                Learn About Us
              </MagneticButton>
            </div>
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
