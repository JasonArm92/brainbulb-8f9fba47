import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { Monitor, User, DollarSign, Mail, Home, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "/", label: "Home", icon: Home },
  { id: "/portfolio", label: "Portfolio", icon: Monitor },
  { id: "/about", label: "About", icon: User },
  { id: "/pricing", label: "Pricing", icon: DollarSign },
  { id: "/contact", label: "Contact", icon: Mail },
];

export const Taskbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const currentTime = new Date().toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
  
  const currentDate = new Date().toLocaleDateString('en-GB', { 
    weekday: 'short',
    day: '2-digit',
    month: '2-digit'
  });

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Premium taskbar with glass morphism */}
      <div className="glass backdrop-blur-xl border-t border-glass-border shadow-taskbar">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Start Menu & Logo */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-taskbar-hover transition-all duration-300 group"
            >
              <div className="relative">
                <img 
                  src="/src/assets/logo-icon.png" 
                  alt="Brain Bulb" 
                  className="w-7 h-7 group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-primary/20 rounded-full scale-0 group-hover:scale-100 transition-transform duration-300"></div>
              </div>
              <span className="hidden sm:block font-semibold text-taskbar-foreground">
                Brain Bulb
              </span>
            </button>
            
            {/* Search button */}
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-2 rounded-lg hover:bg-taskbar-hover transition-all duration-300"
            >
              <Search className="w-5 h-5 text-taskbar-foreground" />
            </button>
          </div>

          {/* Center Navigation */}
          <div className="flex items-center gap-2 bg-glass-bg/50 rounded-2xl px-3 py-2 backdrop-blur-sm border border-glass-border">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-300 group relative overflow-hidden",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-glow" 
                      : "hover:bg-taskbar-hover text-taskbar-foreground"
                  )}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-primary rounded-xl"></div>
                  )}
                  
                  <div className="relative z-10">
                    <Icon className={cn(
                      "w-5 h-5 transition-transform duration-300",
                      isActive ? "scale-110" : "group-hover:scale-110"
                    )} />
                    <span className="text-xs font-medium hidden lg:block">
                      {item.label}
                    </span>
                  </div>
                  
                  {/* Hover glow effect */}
                  {!isActive && (
                    <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-20 rounded-xl transition-opacity duration-300"></div>
                  )}
                </button>
              );
            })}
          </div>

          {/* System Tray */}
          <div className="flex items-center gap-4">
            {/* System icons */}
            <div className="hidden md:flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-taskbar-hover transition-all duration-300">
                <Settings className="w-4 h-4 text-taskbar-foreground" />
              </button>
            </div>
            
            {/* Time and date */}
            <div className="text-right">
              <div className="text-sm font-semibold text-taskbar-foreground">
                {currentTime}
              </div>
              <div className="text-xs text-taskbar-foreground/70">
                {currentDate}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search overlay */}
      {isSearchOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setIsSearchOpen(false)}
        >
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md">
            <div className="glass-card rounded-2xl p-6 animate-glass-appear">
              <input
                type="text"
                placeholder="Search Brain Bulb Web Design..."
                className="w-full px-4 py-3 bg-input/50 border border-glass-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};