import { useEffect, useRef } from 'react';
import anime from 'animejs';

const PARTICLE_COUNT = 80;

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

export function SparkleBox({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<{ x: number; y: number; alpha: number; size: number; tx: number; ty: number }[]>([]);
  const animRef = useRef<ReturnType<typeof requestAnimationFrame>>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d')!;
    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * window.devicePixelRatio;
      canvas.height = h * window.devicePixelRatio;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();

    // Init particles along edges + scattered inside
    const particles = Array.from({ length: PARTICLE_COUNT }, () => {
      const onEdge = Math.random() < 0.6;
      let x: number, y: number;
      if (onEdge) {
        const edge = Math.floor(Math.random() * 4);
        switch (edge) {
          case 0: x = Math.random() * w; y = randomBetween(-2, 4); break;
          case 1: x = Math.random() * w; y = h + randomBetween(-4, 2); break;
          case 2: x = randomBetween(-2, 4); y = Math.random() * h; break;
          default: x = w + randomBetween(-4, 2); y = Math.random() * h; break;
        }
      } else {
        x = Math.random() * w;
        y = Math.random() * h;
      }
      return {
        x, y,
        alpha: 0,
        size: randomBetween(1, 2.5),
        tx: x + randomBetween(-20, 20),
        ty: y + randomBetween(-20, 20),
      };
    });
    particlesRef.current = particles;

    // Animate particles with anime.js — staggered fade in/out + drift
    const animateParticles = () => {
      anime({
        targets: particles,
        alpha: [
          { value: () => randomBetween(0.3, 1), duration: () => randomBetween(800, 2000), easing: 'easeInOutSine' },
          { value: 0, duration: () => randomBetween(800, 2000), easing: 'easeInOutSine' },
        ],
        x: () => ({ value: (el: any) => el.tx + randomBetween(-15, 15), duration: randomBetween(2000, 4000) }),
        y: () => ({ value: (el: any) => el.ty + randomBetween(-10, 10), duration: randomBetween(2000, 4000) }),
        delay: anime.stagger(40, { from: 'center' }),
        complete: animateParticles,
        easing: 'easeInOutSine',
      });
    };
    animateParticles();

    // Render loop
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        if (p.alpha <= 0) continue;
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
      anime.remove(particles);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative inline-block border border-white/[0.08] rounded-2xl overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 1 }}
      />
      <div className="relative z-10 px-8 py-6 md:px-12 md:py-8 bg-gradient-to-br from-white/[0.03] to-transparent">
        {children}
      </div>
    </div>
  );
}
