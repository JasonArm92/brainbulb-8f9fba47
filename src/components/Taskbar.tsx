import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { Monitor, User, DollarSign, Mail, Home, Search, LogIn, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logoIcon from "@/assets/logo-icon.png";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, signOut, isAdmin } = useAuth();

  const currentTime = new Date().toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });

  const handleAuthAction = () => {
    if (user) {
      if (isAdmin) {
        navigate('/admin');
      } else {
        navigate('/client');
      }
    } else {
      navigate('/admin-auth');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <>
      {/* Mobile Menu */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 p-4">
        <div className="glass-card rounded-3xl shadow-premium border border-glass-border">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-white/10 transition-all duration-300"
            >
              <img 
                src={logoIcon} 
                alt="Brain Bulb" 
                className="w-6 h-6"
              />
            </button>
            
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <button className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-white/10 transition-all duration-300">
                    <Menu className="w-5 h-5" />
                  </button>
                </SheetTrigger>
                <SheetContent side="bottom" className="glass-card border-t border-glass-border rounded-t-3xl">
                  <div className="py-4 space-y-2">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.id;
                      
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            navigate(item.id);
                            setMobileMenuOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                            isActive 
                              ? "bg-primary text-primary-foreground shadow-glow" 
                              : "hover:bg-white/10 text-foreground"
                          )}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-base font-medium">{item.label}</span>
                        </button>
                      );
                    })}
                    
                    <div className="pt-4 border-t border-glass-border space-y-2">
                      {user ? (
                        <>
                          <button
                            onClick={() => {
                              handleAuthAction();
                              setMobileMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-all duration-300"
                          >
                            <User className="w-5 h-5" />
                            <span className="text-base font-medium">My Account</span>
                          </button>
                          <button
                            onClick={() => {
                              handleSignOut();
                              setMobileMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-destructive/10 text-destructive transition-all duration-300"
                          >
                            <LogOut className="w-5 h-5" />
                            <span className="text-base font-medium">Sign Out</span>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            navigate('/admin-auth');
                            setMobileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary text-primary-foreground shadow-glow transition-all duration-300"
                        >
                          <LogIn className="w-5 h-5" />
                          <span className="text-base font-medium">Sign In</span>
                        </button>
                      )}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Taskbar */}
      <div className="hidden md:block fixed bottom-0 left-1/2 -translate-x-1/2 z-50 mb-4">
        <div className="glass-card rounded-3xl shadow-premium border border-glass-border">
          <div className="flex items-center gap-2 px-4 py-2">
          {/* Logo */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center justify-center w-12 h-12 rounded-2xl hover:bg-white/10 transition-all duration-300 group"
          >
            <img 
              src={logoIcon} 
              alt="Brain Bulb" 
              className="w-7 h-7 group-hover:scale-110 transition-transform duration-300"
            />
          </button>
          
          {/* Divider */}
          <div className="w-px h-6 bg-border/50"></div>

          {/* Center Navigation */}
          <div className="flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={cn(
                    "relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-300 group min-w-[60px]",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-glow" 
                      : "hover:bg-white/10 text-foreground/70 hover:text-foreground"
                  )}
                >
                  <Icon className={cn(
                    "w-5 h-5 transition-all duration-300",
                    isActive ? "scale-110" : "group-hover:scale-110"
                  )} />
                  <span className="text-[10px] font-medium leading-none">
                    {item.label}
                  </span>
                  
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
          
          {/* Right Section */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-accent/50 transition-all duration-300 group"
            >
              <Search className="w-4 h-4 text-foreground/70 group-hover:text-foreground transition-colors duration-300" />
            </button>
            
            <ThemeToggle />
            
            {/* Auth Button */}
            {user ? (
              <>
                <Button
                  onClick={handleAuthAction}
                  variant="ghost"
                  size="sm"
                  className="rounded-xl hover:bg-white/10"
                >
                  <User className="w-4 h-4 mr-2" />
                  {isAdmin ? 'Admin' : 'Account'}
                </Button>
                <Button
                  onClick={handleSignOut}
                  variant="ghost"
                  size="sm"
                  className="rounded-xl hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </>
            ) : (
              <Button
                onClick={() => navigate('/admin-auth')}
                size="sm"
                className="rounded-xl shadow-glow"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            )}
            
            {/* Time */}
            <div className="flex items-center justify-center min-w-[60px] h-10 px-3 rounded-xl hover:bg-white/10 transition-all duration-300 cursor-default">
              <span className="text-xs font-medium text-foreground/80">
                {currentTime}
              </span>
            </div>
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
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg px-4">
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
    </>
  );
};