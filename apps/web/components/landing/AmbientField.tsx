"use client";

import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

const SPRING = { stiffness: 90, damping: 24, mass: 0.55 };

/**
 * Full-bleed field behind the home page: a drifting dot grid and CardArt
 * washes (Sky, Teal). A pointer eases the layers; CSS keeps them
 * moving when the pointer is still. Touch does not drag the field.
 * Reduced motion snaps to the rest pose: no parallax and no loop.
 */
export function AmbientField() {
  const root = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, SPRING);
  const sy = useSpring(py, SPRING);
  const skyX = useTransform(sx, (v) => v * 46);
  const skyY = useTransform(sy, (v) => v * 32);
  const tealX = useTransform(sx, (v) => v * 88);
  const tealY = useTransform(sy, (v) => v * 60);
  const lowX = useTransform(sx, (v) => v * 32);
  const lowY = useTransform(sy, (v) => v * 22);
  const gridX = useTransform(sx, (v) => v * 64);
  const gridY = useTransform(sy, (v) => v * 40);
  const glowX = useTransform(sx, (v) => v * 280);
  const glowY = useTransform(sy, (v) => v * 160);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let listening = false;

    const mark = (on: boolean) => {
      const node = root.current;
      if (!node) return;
      if (on) node.dataset.pointer = "on";
      else delete node.dataset.pointer;
    };

    const rest = () => {
      px.set(0);
      py.set(0);
      sx.jump(0);
      sy.jump(0);
      mark(false);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      px.set(pointerAxis(event.clientX, window.innerWidth));
      py.set(pointerAxis(event.clientY, window.innerHeight));
      const node = root.current;
      if (!node) return;
      mark(true);
    };

    const onLeave = () => {
      px.set(0);
      py.set(0);
      mark(false);
    };

    const sync = () => {
      const allow = !reduce.matches;
      if (allow && !listening) {
        window.addEventListener("pointermove", onMove, { passive: true });
        document.documentElement.addEventListener("mouseleave", onLeave);
        listening = true;
        return;
      }
      if (!allow && listening) {
        window.removeEventListener("pointermove", onMove);
        document.documentElement.removeEventListener("mouseleave", onLeave);
        listening = false;
      }
      if (!allow) rest();
    };

    sync();
    reduce.addEventListener("change", sync);
    return () => {
      reduce.removeEventListener("change", sync);
      if (listening) {
        window.removeEventListener("pointermove", onMove);
        document.documentElement.removeEventListener("mouseleave", onLeave);
      }
    };
  }, [px, py, sx, sy]);

  return (
    <div ref={root} className="landing-ambient" aria-hidden="true">
      <Drift x={skyX} y={skyY}>
        <div className="landing-orb landing-orb-sky" />
      </Drift>
      <Drift x={tealX} y={tealY}>
        <div className="landing-orb landing-orb-teal" />
      </Drift>
      <Drift x={lowX} y={lowY}>
        <div className="landing-orb landing-orb-low" />
      </Drift>
      <Drift x={glowX} y={glowY}>
        <div className="landing-glow" />
      </Drift>
      <Drift x={gridX} y={gridY}>
        <div className="landing-grid" />
      </Drift>
    </div>
  );
}

function Drift({ x, y, children }: { x: MotionValue<number>; y: MotionValue<number>; children: ReactNode }) {
  return (
    <motion.div className="landing-parallax" style={{ x, y }}>
      {children}
    </motion.div>
  );
}

/** -1 at the left or top edge, 1 at the right or bottom, 0 at the center. */
function pointerAxis(client: number, size: number): number {
  if (size <= 0) return 0;
  const n = (client / size - 0.5) * 2;
  if (n < -1) return -1;
  if (n > 1) return 1;
  return n;
}
