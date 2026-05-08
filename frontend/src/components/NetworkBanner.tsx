import { useEffect, useRef } from 'react';

interface Node {
  x: number;
  baseY: number;
  y: number;
  radius: number;
  phase: number;
  speed: number;
  amplitude: number;
}

export function NetworkBanner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let nodes: Node[] = [];
    const CONNECTION_DIST = 180;
    const NODE_COUNT = 40;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      initNodes(rect.width, rect.height);
    }

    function initNodes(w: number, h: number) {
      nodes = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        nodes.push({
          x: (w * 0.05) + Math.random() * (w * 0.9),
          baseY: (h * 0.15) + Math.random() * (h * 0.7),
          y: 0,
          radius: 3 + Math.random() * 8,
          phase: Math.random() * Math.PI * 2,
          speed: 0.3 + Math.random() * 0.7,
          amplitude: 10 + Math.random() * 25,
        });
      }
    }

    function draw(t: number) {
      const rect = canvas!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx!.clearRect(0, 0, w, h);

      // subtle grid
      ctx!.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx!.lineWidth = 0.5;
      const gridSize = 40;
      for (let x = 0; x < w; x += gridSize) {
        ctx!.beginPath();
        ctx!.moveTo(x, 0);
        ctx!.lineTo(x, h);
        ctx!.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx!.beginPath();
        ctx!.moveTo(0, y);
        ctx!.lineTo(w, y);
        ctx!.stroke();
      }

      // update node positions
      const time = t * 0.001;
      for (const n of nodes) {
        n.y = n.baseY + Math.sin(time * n.speed + n.phase) * n.amplitude;
      }

      // connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.4;
            ctx!.beginPath();
            ctx!.strokeStyle = `rgba(100, 210, 200, ${alpha})`;
            ctx!.lineWidth = 1;
            ctx!.moveTo(a.x, a.y);
            // curved connections
            const midX = (a.x + b.x) / 2;
            const midY = (a.y + b.y) / 2 + Math.sin(time * 0.5 + i) * 15;
            ctx!.quadraticCurveTo(midX, midY, b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      // nodes
      for (const n of nodes) {
        // outer glow
        const grad = ctx!.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius * 3);
        grad.addColorStop(0, 'rgba(100, 210, 200, 0.15)');
        grad.addColorStop(1, 'rgba(100, 210, 200, 0)');
        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.radius * 3, 0, Math.PI * 2);
        ctx!.fill();

        // ring
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx!.strokeStyle = 'rgba(100, 210, 200, 0.6)';
        ctx!.lineWidth = 1.5;
        ctx!.stroke();

        // inner dot
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.radius * 0.4, 0, Math.PI * 2);
        ctx!.fillStyle = 'rgba(140, 230, 200, 0.8)';
        ctx!.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    resize();
    animId = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <section className="w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-48 md:h-64 lg:h-80 bg-[#0a0a0a]"
        style={{ display: 'block' }}
      />
    </section>
  );
}
