import React, { useState } from "react";
import { X, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OSWindowProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  defaultPosition?: { x: number; y: number };
  onClose?: () => void;
  isMinimized?: boolean;
  onMinimize?: () => void;
}

export const OSWindow = ({ 
  title, 
  children, 
  className, 
  defaultPosition = { x: 0, y: 0 },
  onClose,
  isMinimized = false,
  onMinimize
}: OSWindowProps) => {
  const [position, setPosition] = useState(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  if (isMinimized) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute bg-gradient-window border border-border rounded-lg shadow-window z-10 min-w-80 animate-window-open",
        isDragging && "cursor-grabbing",
        className
      )}
      style={{
        left: position.x,
        top: position.y
      }}
    >
      {/* Window Title Bar */}
      <div 
        className="flex items-center justify-between p-3 border-b border-border/30 cursor-grab active:cursor-grabbing bg-gradient-to-r from-accent/50 to-accent/30 rounded-t-lg"
        onMouseDown={handleMouseDown}
      >
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <div className="flex items-center gap-1">
          {onMinimize && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-accent/70"
              onClick={onMinimize}
            >
              <Minimize2 className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 hover:bg-accent/70"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
          {onClose && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
              onClick={onClose}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Window Content */}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};