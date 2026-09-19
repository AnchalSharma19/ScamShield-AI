"use client";

import { useEffect, useRef } from "react";

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  hue: number;
}

/** Brand blue hue range, matching the app's primary palette. */
const HUE_MIN = 215;
const HUE_MAX = 255;

export function CursorSparkles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let sparks: Spark[] = [];
    let animationFrame: number;
    let lastX = -1;
    let lastY = -1;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function spawn(x: number, y: number) {
      const count = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        sparks.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 1.6,
          vy: (Math.random() - 0.5) * 1.6 - 0.4,
          life: 1,
          size: Math.random() * 2.2 + 1,
          hue: HUE_MIN + Math.random() * (HUE_MAX - HUE_MIN),
        });
      }
    }

    function handleMouseMove(e: MouseEvent) {
      // Skip points too close to the last spawn so a fast swipe doesn't flood the array.
      if (lastX >= 0 && Math.hypot(e.clientX - lastX, e.clientY - lastY) < 8) return;
      lastX = e.clientX;
      lastY = e.clientY;
      spawn(e.clientX, e.clientY);
    }
    window.addEventListener("mousemove", handleMouseMove);

    function tick() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const s of sparks) {
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.01;
        s.life -= 0.025;

        const alpha = Math.max(s.life, 0);
        const radius = Math.max(s.size * s.life, 0);
        ctx!.save();
        ctx!.globalAlpha = alpha;
        ctx!.shadowBlur = 8;
        ctx!.shadowColor = `hsl(${s.hue}, 90%, 65%)`;
        ctx!.fillStyle = `hsl(${s.hue}, 90%, 70%)`;
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, radius, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
      }
      sparks = sparks.filter((s) => s.life > 0);
      animationFrame = requestAnimationFrame(tick);
    }
    animationFrame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50"
    />
  );
}
