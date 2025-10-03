import React from 'react';
import { useCountUp } from '@/hooks/useCountUp';
import { TrendingUp, Users, Award, Zap } from 'lucide-react';

const stats = [
  { value: 500, suffix: '+', label: 'Projects Completed', icon: TrendingUp },
  { value: 98, suffix: '%', label: 'Client Satisfaction', icon: Users },
  { value: 50, suffix: '+', label: 'Industry Awards', icon: Award },
  { value: 99, suffix: '%', label: 'Performance Score', icon: Zap },
];

export const AnimatedStats = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} index={index} />
      ))}
    </div>
  );
};

const StatCard = ({ 
  value, 
  suffix, 
  label, 
  icon: Icon, 
  index 
}: { 
  value: number; 
  suffix: string; 
  label: string; 
  icon: any; 
  index: number;
}) => {
  const { count, elementRef } = useCountUp(value, 2500);

  return (
    <div
      ref={elementRef}
      className="glass-card rounded-3xl p-6 text-center shadow-glass hover:shadow-premium transition-all duration-500 hover:scale-105 border border-glass-border group relative overflow-hidden"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative z-10">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-2xl mb-4 backdrop-blur-sm border border-primary/20 shadow-glow group-hover:scale-110 transition-transform duration-500">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div className="text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent mb-2">
          {count}{suffix}
        </div>
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
      </div>
    </div>
  );
};
