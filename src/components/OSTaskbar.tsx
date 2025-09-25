import React from "react";
import { Monitor, User, DollarSign, Mail, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OSTaskbarProps {
  activeSection?: string;
  onNavigate?: (section: string) => void;
}

const taskbarItems = [
  { id: "home", label: "Desktop", icon: Monitor },
  { id: "portfolio", label: "Portfolio", icon: Menu },
  { id: "about", label: "About", icon: User },
  { id: "pricing", label: "Pricing", icon: DollarSign },
  { id: "contact", label: "Contact", icon: Mail },
];

export const OSTaskbar = ({ activeSection = "home", onNavigate }: OSTaskbarProps) => {
  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-taskbar border-t border-border shadow-taskbar z-50">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Start Menu & Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="taskbar"
            size="sm"
            className="font-semibold"
          >
            <img src="/src/assets/logo-icon.png" alt="Brain Bulb" className="w-4 h-4" />
            Brain Bulb
          </Button>
          
          <div className="flex items-center gap-1 ml-4">
            {taskbarItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant="taskbar"
                  size="sm"
                  className={cn(
                    "flex items-center gap-2",
                    activeSection === item.id && "bg-taskbar-active text-primary-foreground"
                  )}
                  onClick={() => onNavigate?.(item.id)}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* System Tray */}
        <div className="flex items-center gap-4 text-sm text-taskbar-foreground">
          <div className="hidden md:block">
            {currentTime}
          </div>
        </div>
      </div>
    </div>
  );
};