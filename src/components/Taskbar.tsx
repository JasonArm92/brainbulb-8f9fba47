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

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 mb-4">
      {/* Sleek floating taskbar */}
      <div className="glass-card rounded-3xl shadow-premium border border-glass-border">
        <div className="flex items-center gap-2 px-4 py-2">
          {/* Logo */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 px-3 py-2 rounded-2xl hover:bg-white/10 transition-all duration-300 group"
          >
            <div className="relative">
              <img 
                src="/src/assets/logo-icon.png" 
                alt="Brain Bulb" 
                className="w-6 h-6 group-hover:scale-110 transition-transform duration-300"
              />
            </div>
            <span className="hidden sm:block text-sm font-medium text-foreground">
              Brain Bulb
            </span>
          </button>
          
          {/* Divider */}
          <div className="w-px h-6 bg-border/50"></div>

          {/* Center Navigation */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={cn(
                    "relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 group",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-glow" 
                      : "hover:bg-white/10 text-foreground/70 hover:text-foreground"
                  )}
                >
                  <Icon className={cn(
                    "w-5 h-5 transition-all duration-300",
                    isActive ? "scale-110" : "group-hover:scale-110"
                  )} />
                  
                  {/* Active indicator dot */}
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary-foreground rounded-full"></div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-border/50"></div>
          
          {/* Search & System */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-white/10 transition-all duration-300 group"
            >
              <Search className="w-4 h-4 text-foreground/70 group-hover:text-foreground transition-colors duration-300" />
            </button>
            
            <button className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-white/10 transition-all duration-300 group">
              <Settings className="w-4 h-4 text-foreground/70 group-hover:text-foreground transition-colors duration-300" />
            </button>
            
            {/* Time */}
            <div className="flex items-center justify-center min-w-[60px] h-10 px-3 rounded-xl hover:bg-white/10 transition-all duration-300 cursor-default">
              <span className="text-xs font-medium text-foreground/80">
                {currentTime}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search overlay */}
      {isSearchOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={() => setIsSearchOpen(false)}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg">
            <div className="glass-card rounded-2xl p-6 animate-scale-in border border-glass-border">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search Brain Bulb Web Design..."
                  className="w-full pl-12 pr-4 py-4 bg-transparent border border-glass-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-300"
                  autoFocus
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};