import { useEffect, useRef } from "react";

export default function NeuralParticles({ theme }) {
  const canvasRef = useRef(null);
  const mouseRef  = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animId;

    const isDark = !document.body.classList.contains("light-theme");
    
    // Luxury Cobalt Palette
    const NODE_COLOR  = isDark ? "rgba(0,242,255," : "rgba(0,102,255,"; 
    const LINE_COLOR  = isDark ? "rgba(0,242,255," : "rgba(0,102,255,";
    const PULSE_COLOR = isDark ? "rgba(0,255,136," : "rgba(0,200,100,";

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Mouse parallax tracking ───────────────────────────
    const handleMouse = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    canvas.parentElement?.addEventListener("mousemove", handleMouse);

    // ── Build nodes ──────────────────────────
    const NUM = Math.min(Math.floor((canvas.width * canvas.height) / 14000), 70);
    const CONNECT_DIST = 160;
    const PARALLAX_STRENGTH = 0.012; // subtle parallax factor

    const nodes = Array.from({ length: NUM }, () => ({
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height,
      ox: 0, oy: 0,   // offsets for parallax
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r:  Math.random() * 2 + 1.5,
      depth: Math.random() * 0.8 + 0.2,  // parallax depth (0.2 = far, 1.0 = close)
      pulse: Math.random() > 0.85,
      pulseT: Math.random() * Math.PI * 2,
    }));

    // ── Data-packet dots ─────────────
    const packets = [];
    const spawnPacket = () => {
      const a = Math.floor(Math.random() * nodes.length);
      const b = Math.floor(Math.random() * nodes.length);
      if (a === b) return;
      const dx = nodes[b].x - nodes[a].x;
      const dy = nodes[b].y - nodes[a].y;
      if (Math.hypot(dx, dy) > CONNECT_DIST) return;
      packets.push({ a, b, t: 0, speed: 0.008 + Math.random() * 0.012 });
    };

    let frame = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      if (frame % 40 === 0) spawnPacket();

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const mx = mouseRef.current.x || cx;
      const my = mouseRef.current.y || cy;
      // Normalize mouse offset from center (-1 to 1)
      const normX = (mx - cx) / cx;
      const normY = (my - cy) / cy;

      // ── Move nodes + apply parallax offset ──
      nodes.forEach(n => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width)  n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
        if (n.pulse) n.pulseT += 0.04;

        // Smooth interpolation of parallax offset
        const targetOx = -normX * PARALLAX_STRENGTH * n.depth * canvas.width;
        const targetOy = -normY * PARALLAX_STRENGTH * n.depth * canvas.height;
        n.ox += (targetOx - n.ox) * 0.05;
        n.oy += (targetOy - n.oy) * 0.05;
      });

      // ── Draw edges ──
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx   = (nodes[j].x + nodes[j].ox) - (nodes[i].x + nodes[i].ox);
          const dy   = (nodes[j].y + nodes[j].oy) - (nodes[i].y + nodes[i].oy);
          const dist = Math.hypot(dx, dy);
          if (dist < CONNECT_DIST) {
            const alpha = (1 - dist / CONNECT_DIST) * (isDark ? 0.3 : 0.6); // Sharper in light mode
            ctx.beginPath();
            ctx.strokeStyle = `${LINE_COLOR}${alpha})`;
            ctx.lineWidth = isDark ? 0.8 : 1.5;

            if (!isDark) {
                ctx.shadowBlur = 4;
                ctx.shadowColor = "rgba(0, 102, 255, 0.3)";
            }

            ctx.moveTo(nodes[i].x + nodes[i].ox, nodes[i].y + nodes[i].oy);
            ctx.lineTo(nodes[j].x + nodes[j].ox, nodes[j].y + nodes[j].oy);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }
      }

      // ── Draw nodes ──
      nodes.forEach(n => {
        const px = n.x + n.ox;
        const py = n.y + n.oy;
        const glow = n.pulse ? 0.5 + 0.5 * Math.sin(n.pulseT) : 0.6;

        ctx.beginPath();
        ctx.arc(px, py, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `${NODE_COLOR}${isDark ? glow : 0.9})`;
        
        if (!isDark) {
            ctx.shadowBlur = n.pulse ? 15 : 6;
            ctx.shadowColor = "rgba(0, 102, 255, 0.5)";
        }

        ctx.fill();
        ctx.shadowBlur = 0;

        if (n.pulse) {
          const ringR = n.r + 4 + 4 * Math.sin(n.pulseT);
          const ringAlpha = (isDark ? 0.2 : 0.45) * (0.5 + 0.5 * Math.sin(n.pulseT));
          ctx.beginPath();
          ctx.arc(px, py, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = `${PULSE_COLOR}${ringAlpha})`;
          ctx.lineWidth = isDark ? 1 : 2;
          ctx.stroke();
        }
      });

      // ── Draw traveling data packets ──
      packets.forEach((p, idx) => {
        p.t += p.speed;
        if (p.t >= 1) { packets.splice(idx, 1); return; }
        const ax = nodes[p.a].x + nodes[p.a].ox;
        const ay = nodes[p.a].y + nodes[p.a].oy;
        const bx = nodes[p.b].x + nodes[p.b].ox;
        const by = nodes[p.b].y + nodes[p.b].oy;
        const px2 = ax + (bx - ax) * p.t;
        const py2 = ay + (by - ay) * p.t;

        ctx.beginPath();
        ctx.arc(px2, py2, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `${PULSE_COLOR}0.9)`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px2, py2, 4, 0, Math.PI * 2);
        ctx.fillStyle = `${PULSE_COLOR}0.2)`;
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      canvas.parentElement?.removeEventListener("mousemove", handleMouse);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:  "absolute",
        inset:     0,
        width:     "100%",
        height:    "100%",
        zIndex:    1,
        pointerEvents: "none",
      }}
    />
  );
}
