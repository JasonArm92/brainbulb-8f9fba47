import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Minimize2, Maximize2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWindowManager } from "@/hooks/useWindowManager";

interface WindowProps {
  id: string;
  title: string;
  children: React.ReactNode;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  isResizable?: boolean;
  className?: string;
}

export const Window: React.FC<WindowProps> = ({
  id,
  title,
  children,
  position,
  size,
  isMinimized,
  isMaximized,
  zIndex,
  isResizable = true,
  className
}) => {
  const {
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    focusWindow,
    updateWindowPosition,
    updateWindowSize,
    activeWindowId
  } = useWindowManager();

  const windowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string>('');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const isActive = activeWindowId === id;

  // Handle window dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    
    focusWindow(id);
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  }, [position, isMaximized, focusWindow, id]);

  // Handle resize
  const handleResizeStart = useCallback((e: React.MouseEvent, handle: string) => {
    if (isMaximized) return;
    
    e.stopPropagation();
    focusWindow(id);
    setIsResizing(true);
    setResizeHandle(handle);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    });
  }, [isMaximized, focusWindow, id, size]);

  // Mouse move handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && !isMaximized) {
        const newPosition = {
          x: Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - size.width)),
          y: Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - size.height - 80))
        };
        updateWindowPosition(id, newPosition);
      }

      if (isResizing && !isMaximized) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;
        let newX = position.x;
        let newY = position.y;

        if (resizeHandle.includes('e')) {
          newWidth = Math.max(300, resizeStart.width + deltaX);
        }
        if (resizeHandle.includes('w')) {
          newWidth = Math.max(300, resizeStart.width - deltaX);
          newX = position.x + (resizeStart.width - newWidth);
        }
        if (resizeHandle.includes('s')) {
          newHeight = Math.max(200, resizeStart.height + deltaY);
        }
        if (resizeHandle.includes('n')) {
          newHeight = Math.max(200, resizeStart.height - deltaY);
          newY = position.y + (resizeStart.height - newHeight);
        }

        updateWindowSize(id, { width: newWidth, height: newHeight });
        if (newX !== position.x || newY !== position.y) {
          updateWindowPosition(id, { x: newX, y: newY });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle('');
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart, resizeHandle, position, size, id, updateWindowPosition, updateWindowSize, isMaximized]);

  // Don't render if minimized
  if (isMinimized) {
    return null;
  }

  const windowStyle = isMaximized 
    ? { 
        left: 0, 
        top: 0, 
        width: '100vw', 
        height: 'calc(100vh - 80px)',
        zIndex 
      }
    : { 
        left: position.x, 
        top: position.y, 
        width: size.width, 
        height: size.height,
        zIndex 
      };

  return (
    <>
      <div
        ref={windowRef}
        className={cn(
          "absolute glass-card border border-glass-border shadow-premium animate-window-open",
          isActive && "ring-1 ring-primary/50",
          isDragging && "cursor-grabbing select-none",
          isResizing && "select-none",
          className
        )}
        style={windowStyle}
        onClick={() => focusWindow(id)}
      >
        {/* Title Bar */}
        <div 
          className={cn(
            "flex items-center justify-between px-4 py-2 border-b border-glass-border cursor-grab active:cursor-grabbing rounded-t-lg",
            "bg-gradient-to-r from-accent/30 to-accent/10",
            isActive && "from-primary/20 to-primary/5"
          )}
          onMouseDown={handleMouseDown}
          onDoubleClick={() => maximizeWindow(id)}
        >
          <h3 className="text-sm font-medium text-foreground select-none">{title}</h3>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-accent/70"
              onClick={(e) => {
                e.stopPropagation();
                minimizeWindow(id);
              }}
            >
              <Minimize2 className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-accent/70"
              onClick={(e) => {
                e.stopPropagation();
                maximizeWindow(id);
              }}
            >
              {isMaximized ? <Square className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
              onClick={(e) => {
                e.stopPropagation();
                closeWindow(id);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        {/* Content */}
        <div className={cn(
          "overflow-auto",
          isMaximized ? "h-[calc(100%-40px)]" : `h-[${size.height - 40}px]`
        )}>
          {children}
        </div>

        {/* Resize Handles */}
        {isResizable && !isMaximized && (
          <>
            {/* Corner handles */}
            <div 
              className="absolute top-0 left-0 w-2 h-2 cursor-nw-resize"
              onMouseDown={(e) => handleResizeStart(e, 'nw')}
            />
            <div 
              className="absolute top-0 right-0 w-2 h-2 cursor-ne-resize"
              onMouseDown={(e) => handleResizeStart(e, 'ne')}
            />
            <div 
              className="absolute bottom-0 left-0 w-2 h-2 cursor-sw-resize"
              onMouseDown={(e) => handleResizeStart(e, 'sw')}
            />
            <div 
              className="absolute bottom-0 right-0 w-2 h-2 cursor-se-resize"
              onMouseDown={(e) => handleResizeStart(e, 'se')}
            />
            
            {/* Edge handles */}
            <div 
              className="absolute top-0 left-2 right-2 h-1 cursor-n-resize"
              onMouseDown={(e) => handleResizeStart(e, 'n')}
            />
            <div 
              className="absolute bottom-0 left-2 right-2 h-1 cursor-s-resize"
              onMouseDown={(e) => handleResizeStart(e, 's')}
            />
            <div 
              className="absolute left-0 top-2 bottom-2 w-1 cursor-w-resize"
              onMouseDown={(e) => handleResizeStart(e, 'w')}
            />
            <div 
              className="absolute right-0 top-2 bottom-2 w-1 cursor-e-resize"
              onMouseDown={(e) => handleResizeStart(e, 'e')}
            />
          </>
        )}
      </div>
    </>
  );
};