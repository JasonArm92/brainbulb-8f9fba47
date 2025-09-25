import React from "react";
import { OSWindow } from "./OSWindow";
import { Button } from "@/components/ui/button";
import { ExternalLink, Code } from "lucide-react";

interface Project {
  id: string;
  title: string;
  description: string;
  image: string;
  technologies: string[];
  liveUrl?: string;
  featured?: boolean;
}

interface PortfolioWindowProps {
  project: Project;
  onClose?: () => void;
  position?: { x: number; y: number };
  isMinimized?: boolean;
  onMinimize?: () => void;
}

export const PortfolioWindow = ({ 
  project, 
  onClose, 
  position,
  isMinimized,
  onMinimize 
}: PortfolioWindowProps) => {
  return (
    <OSWindow
      title={`Project: ${project.title}`}
      onClose={onClose}
      defaultPosition={position}
      isMinimized={isMinimized}
      onMinimize={onMinimize}
      className="max-w-md"
    >
      <div className="space-y-4">
        <div className="aspect-video rounded-lg overflow-hidden bg-muted">
          <img 
            src={project.image} 
            alt={project.title}
            className="w-full h-full object-cover"
          />
        </div>
        
        <div>
          <h4 className="font-semibold text-lg mb-2">{project.title}</h4>
          <p className="text-muted-foreground text-sm mb-3">{project.description}</p>
          
          <div className="flex flex-wrap gap-1 mb-4">
            {project.technologies.map((tech) => (
              <span 
                key={tech}
                className="px-2 py-1 bg-accent text-accent-foreground rounded text-xs"
              >
                {tech}
              </span>
            ))}
          </div>
          
          <div className="flex gap-2">
            {project.liveUrl && (
              <Button variant="cta" size="sm" asChild>
                <a href={project.liveUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  View Live
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm">
              <Code className="w-3 h-3 mr-1" />
              Details
            </Button>
          </div>
        </div>
      </div>
    </OSWindow>
  );
};