"use client";

import { useEffect, useRef } from "react";

/**
 * Underdamped springs (damping ratio below 1) so the wash trails the
 * pointer, overshoots once, and settles. Targets are -1..1, and CSS
 * turns that into the first field's short travel (sky 46px, teal 88px,
 * grid 64px, light 280px). A small wander keeps it from sitting still.
 */
const WASH = { k: 14, d: 4.6 };
const GLOW = { k: 26, d: 7.4 };

type Spring = { x: number; y: number; vx: number; vy: number };

/**
 * Full-bleed field behind the home page. The wash is pulled toward the
 * pointer with `translate` (the idle drift keeps `transform`, so the two
 * compose). The dot grid slides under a fixed mask. Touch does not drag.
 * Reduced motion snaps to the rest pose: no pull and no loop.
 */
export function AmbientField() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wash: Spring = { x: 0, y: 0, vx: 0, vy: 0 };
    const glow: Spring = { x: 0, y: 0, vx: 0, vy: 0 };
    let targetX = 0;
    let targetY = 0;
    let frame = 0;
    let last = performance.now();
    let lastPointer = 0;

    const paint = (now: number) => {
      const t = now / 1000;
      const driftX = Math.sin(t * 0.55) * 0.05 + Math.sin(t * 0.19) * 0.02;
      const driftY = Math.cos(t * 0.41) * 0.04 + Math.sin(t * 0.17) * 0.015;
      node.style.setProperty("--pull-x", (wash.x + driftX).toFixed(3));
      node.style.setProperty("--pull-y", (wash.y + driftY).toFixed(3));
      node.style.setProperty("--glow-x", (glow.x + driftX * 0.6).toFixed(3));
      node.style.setProperty("--glow-y", (glow.y + driftY * 0.6).toFixed(3));
    };

    const rest = () => {
      targetX = 0;
      targetY = 0;
      wash.x = 0;
      wash.y = 0;
      wash.vx = 0;
      wash.vy = 0;
      glow.x = 0;
      glow.y = 0;
      glow.vx = 0;
      glow.vy = 0;
      delete node.dataset.pointer;
      node.style.setProperty("--pull-x", "0");
      node.style.setProperty("--pull-y", "0");
      node.style.setProperty("--glow-x", "0");
      node.style.setProperty("--glow-y", "0");
    };

    const step = (body: Spring, k: number, d: number, tx: number, ty: number, dt: number) => {
      const ax = (tx - body.x) * k - body.vx * d;
      const ay = (ty - body.y) * k - body.vy * d;
      body.vx += ax * dt;
      body.vy += ay * dt;
      body.x += body.vx * dt;
      body.y += body.vy * dt;
    };

    const tick = (now: number) => {
      if (reduce.matches) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      step(wash, WASH.k, WASH.d, targetX, targetY, dt);
      step(glow, GLOW.k, GLOW.d, targetX, targetY, dt);
      paint(now);
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (reduce.matches || frame !== 0) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const aim = (clientX: number, clientY: number) => {
      if (reduce.matches) {
        rest();
        return;
      }
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      targetX = clamp((clientX / width - 0.5) * 2);
      targetY = clamp((clientY / height - 0.5) * 2);
      node.dataset.pointer = "on";
      start();
    };

    const onPointer = (event: PointerEvent) => {
      lastPointer = performance.now();
      if (event.pointerType === "touch") return;
      aim(event.clientX, event.clientY);
    };

    const onMouse = (event: MouseEvent) => {
      if (performance.now() - lastPointer < 80) return;
      if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) return;
      aim(event.clientX, event.clientY);
    };

    const onLeave = (event: MouseEvent) => {
      if (event.relatedTarget !== null) return;
      targetX = 0;
      targetY = 0;
      delete node.dataset.pointer;
      start();
    };

    const onReduce = () => {
      if (reduce.matches) {
        cancelAnimationFrame(frame);
        frame = 0;
        rest();
        return;
      }
      start();
    };

    onReduce();
    reduce.addEventListener("change", onReduce);
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("mousemove", onMouse, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      reduce.removeEventListener("change", onReduce);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("mousemove", onMouse);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={root} className="landing-ambient" aria-hidden="true">
      <div className="landing-orb landing-orb-sky landing-pull-sky" />
      <div className="landing-orb landing-orb-teal landing-pull-teal" />
      <div className="landing-orb landing-orb-low landing-pull-low" />
      <div className="landing-glow landing-pull-glow" />
      <div className="landing-grid" />
    </div>
  );
}

function clamp(value: number): number {
  if (value < -1) return -1;
  if (value > 1) return 1;
  return value;
}
