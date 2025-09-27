import React from 'react';
import { useWindowManager } from '@/hooks/useWindowManager';
import { Window } from './Window';

export const Desktop: React.FC = () => {
  const { windows } = useWindowManager();

  return (
    <div className="fixed inset-0 bg-gradient-hero overflow-hidden">
      {/* Desktop background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/90 to-background/95" />
      
      {/* Render all windows */}
      {windows.map((window) => (
        <Window
          key={window.id}
          id={window.id}
          title={window.title}
          position={window.position}
          size={window.size}
          isMinimized={window.isMinimized}
          isMaximized={window.isMaximized}
          zIndex={window.zIndex}
          isResizable={window.isResizable}
        >
          {window.component}
        </Window>
      ))}
    </div>
  );
};