import { useEffect, useRef } from 'react';
// @ts-expect-error — animejs has no types
import anime from 'animejs';

type Dot = { x: number; y: number; alpha: number; scale: number };

const COLS = 20;
const ROWS = 12;
const DOT_SIZE = 3;
const GAP = 28;

export function SparkleBox({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<ReturnType<typeof requestAnimationFrame>>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const rect = container.getBoundingClientRect();
    const offsetX = (rect.width - (COLS - 1) * GAP) / 2;
    const offsetY = (rect.height - (ROWS - 1) * GAP) / 2 + 20;

    // Create grid dots
    const dots: Dot[] = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        dots.push({
          x: offsetX + col * GAP,
          y: offsetY + row * GAP,
          alpha: 0,
          scale: 1,
        });
      }
    }

    // Animate: staggered waves of dots lighting up and fading
    const runWave = () => {
      // Reset all
      dots.forEach(d => { d.alpha = 0; d.scale = 1; });

      // Pick random subset to light up (30-60%)
      const indices = dots.map((_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      const count = Math.floor(dots.length * (0.3 + Math.random() * 0.3));
      const active = indices.slice(0, count).map(i => dots[i]);

      anime({
        targets: active,
        alpha: [
          { value: () => 0.15 + Math.random() * 0.85, duration: () => 600 + Math.random() * 1200, easing: 'easeOutQuad' },
          { value: 0, duration: () => 800 + Math.random() * 1500, easing: 'easeInQuad' },
        ],
        scale: [
          { value: () => 1 + Math.random() * 0.8, duration: () => 600 + Math.random() * 1000, easing: 'easeOutQuad' },
          { value: 1, duration: () => 800 + Math.random() * 1000, easing: 'easeInQuad' },
        ],
        delay: anime.stagger(15, { grid: [COLS, ROWS], from: Math.floor(Math.random() * dots.length) }),
        complete: runWave,
      });
    };
    runWave();

    // Render loop
    const draw = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      for (const dot of dots) {
        if (dot.alpha <= 0.01) continue;
        const r = DOT_SIZE * dot.scale * 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${dot.alpha})`;
        ctx.fillRect(dot.x - r, dot.y - r, r * 2, r * 2);
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
      anime.remove(dots);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative border border-white/[0.08] rounded-2xl overflow-hidden bg-[#0f0f0f]"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 1 }}
      />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
