import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface WindowState {
  id: string;
  title: string;
  component: ReactNode;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  icon?: string;
  isResizable?: boolean;
}

interface WindowManagerContextType {
  windows: WindowState[];
  activeWindowId: string | null;
  openWindow: (window: Omit<WindowState, 'zIndex'>) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updateWindowPosition: (id: string, position: { x: number; y: number }) => void;
  updateWindowSize: (id: string, size: { width: number; height: number }) => void;
  toggleMinimize: (id: string) => void;
  restoreWindow: (id: string) => void;
}

const WindowManagerContext = createContext<WindowManagerContextType | null>(null);

export const useWindowManager = () => {
  const context = useContext(WindowManagerContext);
  if (!context) {
    throw new Error('useWindowManager must be used within a WindowManagerProvider');
  }
  return context;
};

interface WindowManagerProviderProps {
  children: ReactNode;
}

export const WindowManagerProvider: React.FC<WindowManagerProviderProps> = ({ children }) => {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [nextZIndex, setNextZIndex] = useState(100);

  const openWindow = useCallback((windowData: Omit<WindowState, 'zIndex'>) => {
    const newWindow: WindowState = {
      ...windowData,
      zIndex: nextZIndex,
    };
    
    setWindows(prev => {
      // Check if window already exists
      const existing = prev.find(w => w.id === windowData.id);
      if (existing) {
        // Focus existing window
        setActiveWindowId(windowData.id);
        return prev.map(w => 
          w.id === windowData.id 
            ? { ...w, zIndex: nextZIndex, isMinimized: false }
            : w
        );
      }
      return [...prev, newWindow];
    });
    
    setActiveWindowId(windowData.id);
    setNextZIndex(prev => prev + 1);
  }, [nextZIndex]);

  const closeWindow = useCallback((id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
    setActiveWindowId(prev => prev === id ? null : prev);
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => 
      w.id === id ? { ...w, isMinimized: true } : w
    ));
    if (activeWindowId === id) {
      setActiveWindowId(null);
    }
  }, [activeWindowId]);

  const maximizeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => 
      w.id === id 
        ? { 
            ...w, 
            isMaximized: !w.isMaximized,
            position: w.isMaximized ? w.position : { x: 0, y: 0 },
            size: w.isMaximized ? w.size : { width: window.innerWidth, height: window.innerHeight - 80 }
          }
        : w
    ));
  }, []);

  const focusWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => 
      w.id === id ? { ...w, zIndex: nextZIndex } : w
    ));
    setActiveWindowId(id);
    setNextZIndex(prev => prev + 1);
  }, [nextZIndex]);

  const updateWindowPosition = useCallback((id: string, position: { x: number; y: number }) => {
    setWindows(prev => prev.map(w => 
      w.id === id ? { ...w, position } : w
    ));
  }, []);

  const updateWindowSize = useCallback((id: string, size: { width: number; height: number }) => {
    setWindows(prev => prev.map(w => 
      w.id === id ? { ...w, size } : w
    ));
  }, []);

  const toggleMinimize = useCallback((id: string) => {
    setWindows(prev => prev.map(w => 
      w.id === id ? { ...w, isMinimized: !w.isMinimized } : w
    ));
    
    const window = windows.find(w => w.id === id);
    if (window?.isMinimized) {
      setActiveWindowId(id);
      focusWindow(id);
    } else {
      if (activeWindowId === id) {
        setActiveWindowId(null);
      }
    }
  }, [windows, activeWindowId, focusWindow]);

  const restoreWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => 
      w.id === id 
        ? { ...w, isMinimized: false, isMaximized: false }
        : w
    ));
    focusWindow(id);
  }, [focusWindow]);

  const value: WindowManagerContextType = {
    windows,
    activeWindowId,
    openWindow,
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    focusWindow,
    updateWindowPosition,
    updateWindowSize,
    toggleMinimize,
    restoreWindow,
  };

  return (
    <WindowManagerContext.Provider value={value}>
      {children}
    </WindowManagerContext.Provider>
  );
};