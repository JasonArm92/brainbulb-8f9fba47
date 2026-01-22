import React, { useEffect, useRef, useState } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
}

export const ParticleBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Disable particles on low-power devices or small screens
    const isLowPerf = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isSmallScreen = window.innerWidth < 768;
    
    if (isLowPerf || isSmallScreen) {
      setIsVisible(false);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createParticles = () => {
      // Reduced particle count for better performance
      const particleCount = Math.min(30, Math.floor((canvas.width * canvas.height) / 50000));
      particlesRef.current = [];

      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.3 + 0.1,
        });
      }
    };

    const drawParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      const len = particles.length;

      // Draw particles
      for (let i = 0; i < len; i++) {
        const particle = particles[i];
        
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Boundary check
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(280, 80%, 65%, ${particle.opacity})`;
        ctx.fill();
      }

      // Draw fewer connections
      for (let i = 0; i < len; i++) {
        const particle = particles[i];
        for (let j = i + 1; j < len; j++) {
          const other = particles[j];
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < 10000) { // 100px squared
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            const opacity = (1 - Math.sqrt(distSq) / 100) * 0.15;
            ctx.strokeStyle = `hsla(280, 80%, 65%, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animationRef.current = requestAnimationFrame(drawParticles);
    };

    resizeCanvas();
    createParticles();
    drawParticles();

    const handleResize = () => {
      resizeCanvas();
      createParticles();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.25 }}
    />
  );
};
