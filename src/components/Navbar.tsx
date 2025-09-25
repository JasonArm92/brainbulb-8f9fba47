import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { Monitor, User, DollarSign, Mail, Menu, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "/", label: "Home", icon: Home },
  { id: "/portfolio", label: "Portfolio", icon: Monitor },
  { id: "/about", label: "About", icon: User },
  { id: "/pricing", label: "Pricing", icon: DollarSign },
  { id: "/contact", label: "Contact", icon: Mail },
];

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 bg-taskbar/95 backdrop-blur-sm border-b border-border shadow-taskbar z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <img 
              src="/src/assets/logo-icon.png" 
              alt="Brain Bulb Web Design" 
              className="w-8 h-8"
            />
            <div className="hidden sm:block">
              <img 
                src="/src/assets/logo-main.png" 
                alt="Brain Bulb Web Design" 
                className="h-8"
              />
            </div>
            <span className="sm:hidden font-bold text-taskbar-foreground">Brain Bulb</span>
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.id;
              
              return (
                <Button
                  key={item.id}
                  variant="taskbar"
                  size="sm"
                  className={cn(
                    "flex items-center gap-2",
                    isActive && "bg-taskbar-active text-primary-foreground"
                  )}
                  onClick={() => navigate(item.id)}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button variant="taskbar" size="sm">
              <Menu className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden border-t border-border/30 py-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.id;
              
              return (
                <Button
                  key={item.id}
                  variant="taskbar"
                  size="sm"
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap",
                    isActive && "bg-taskbar-active text-primary-foreground"
                  )}
                  onClick={() => navigate(item.id)}
                >
                  <Icon className="w-3 h-3" />
                  <span className="text-xs">{item.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};