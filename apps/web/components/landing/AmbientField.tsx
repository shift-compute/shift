"use client";

import { useEffect, useRef } from "react";

/** Per-frame ease toward the pointer. No velocity term, so it cannot bounce. */
const FOLLOW = 0.18;

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
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let frame = 0;
    let running = false;
    let lastPointer = 0;

    const paint = () => {
      node.style.setProperty("--pull-x", `${x.toFixed(1)}px`);
      node.style.setProperty("--pull-y", `${y.toFixed(1)}px`);
    };

    const rest = () => {
      targetX = 0;
      targetY = 0;
      x = 0;
      y = 0;
      delete node.dataset.pointer;
      paint();
    };

    const tick = () => {
      x += (targetX - x) * FOLLOW;
      y += (targetY - y) * FOLLOW;
      if (Math.abs(targetX - x) < 0.4 && Math.abs(targetY - y) < 0.4) {
        x = targetX;
        y = targetY;
        paint();
        running = false;
        return;
      }
      paint();
      frame = requestAnimationFrame(tick);
    };

    const kick = () => {
      if (running) return;
      running = true;
      frame = requestAnimationFrame(tick);
    };

    const aim = (clientX: number, clientY: number) => {
      if (reduce.matches) {
        rest();
        return;
      }
      targetX = clientX - window.innerWidth / 2;
      targetY = clientY - window.innerHeight / 2;
      node.dataset.pointer = "on";
      kick();
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
      kick();
    };

    const onReduce = () => {
      if (reduce.matches) rest();
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
