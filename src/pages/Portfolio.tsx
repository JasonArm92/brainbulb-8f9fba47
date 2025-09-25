import React, { useState } from "react";
import { PortfolioWindow } from "@/components/PortfolioWindow";
import { Button } from "@/components/ui/button";
import { Folder, Image } from "lucide-react";
import { cn } from "@/lib/utils";

// Sample portfolio data
const projects = [
  {
    id: "1",
    title: "TechCorp Solutions",
    description: "Modern corporate website with responsive design and advanced functionality.",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400",
    technologies: ["React", "TypeScript", "Tailwind CSS"],
    liveUrl: "https://example.com",
    featured: true
  },
  {
    id: "2", 
    title: "Local Restaurant",
    description: "Beautiful restaurant website with online ordering system.",
    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400",
    technologies: ["HTML", "CSS", "JavaScript"],
    liveUrl: "https://example.com"
  },
  {
    id: "3",
    title: "E-commerce Store", 
    description: "Full-featured online store with payment integration.",
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400",
    technologies: ["React", "Node.js", "Stripe"],
    liveUrl: "https://example.com"
  },
  {
    id: "4",
    title: "Healthcare Clinic",
    description: "Professional healthcare website with appointment booking.",
    image: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400",
    technologies: ["WordPress", "PHP", "MySQL"]
  },
  {
    id: "5",
    title: "Creative Agency",
    description: "Dynamic portfolio site showcasing creative work.",
    image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400",
    technologies: ["Vue.js", "GSAP", "CSS3"]
  },
  {
    id: "6",
    title: "SaaS Platform",
    description: "Modern SaaS dashboard with user management system.",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400",
    technologies: ["React", "Redux", "Material-UI"],
    liveUrl: "https://example.com"
  }
];

interface OpenWindow {
  projectId: string;
  position: { x: number; y: number };
  isMinimized: boolean;
}

export const Portfolio = () => {
  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([]);

  const openProject = (projectId: string) => {
    if (openWindows.find(w => w.projectId === projectId)) {
      // Bring to front or unminimize if already open
      setOpenWindows(prev => 
        prev.map(w => 
          w.projectId === projectId 
            ? { ...w, isMinimized: false }
            : w
        )
      );
      return;
    }

    // Calculate position with some randomness
    const baseOffset = openWindows.length * 30;
    const position = {
      x: 100 + baseOffset + Math.random() * 100,
      y: 50 + baseOffset + Math.random() * 50
    };

    setOpenWindows(prev => [
      ...prev,
      { projectId, position, isMinimized: false }
    ]);
  };

  const closeProject = (projectId: string) => {
    setOpenWindows(prev => prev.filter(w => w.projectId !== projectId));
  };

  const minimizeProject = (projectId: string) => {
    setOpenWindows(prev =>
      prev.map(w =>
        w.projectId === projectId
          ? { ...w, isMinimized: true }
          : w
      )
    );
  };

  return (
    <div className="min-h-screen bg-gradient-hero py-16 px-4 pb-24">
      <div className="max-w-6xl mx-auto pt-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Portfolio Explorer</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Click on any project folder to open it in a new window. Drag windows around and explore our work!
          </p>
        </div>

        {/* Desktop Icons Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => openProject(project.id)}
              className="flex flex-col items-center p-4 rounded-lg hover:bg-accent/50 transition-colors group"
            >
              <div className="mb-2 relative">
                <Folder className="w-12 h-12 text-primary group-hover:scale-110 transition-transform" />
                {project.featured && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full"></div>
                )}
              </div>
              <span className="text-sm font-medium text-center">{project.title}</span>
            </button>
          ))}
        </div>

        {/* Open Windows */}
        {openWindows.map((window) => {
          const project = projects.find(p => p.id === window.projectId);
          if (!project) return null;

          return (
            <PortfolioWindow
              key={window.projectId}
              project={project}
              position={window.position}
              onClose={() => closeProject(window.projectId)}
              onMinimize={() => minimizeProject(window.projectId)}
              isMinimized={window.isMinimized}
            />
          );
        })}
      </div>
    </div>
  );
};