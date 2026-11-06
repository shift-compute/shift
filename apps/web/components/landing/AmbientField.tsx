"use client";

import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

/** Weighted attraction: the wash leans after the pointer and settles without a bounce. */
const SPRING = { stiffness: 62, damping: 20, mass: 0.9 };

/**
 * Full-bleed field behind the home page. Sky, Teal and the dot grid are
 * pulled toward the pointer by a fraction of the viewport, like soft gravity.
 * CSS keeps a small drift while the pointer is still. Touch does not drag
 * the field. Reduced motion snaps to the rest pose: no pull and no loop.
 */
export function AmbientField() {
  const root = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, SPRING);
  const sy = useSpring(py, SPRING);
  const vw = useMotionValue(1);
  const vh = useMotionValue(1);
  const skyX = useReach(sx, vw, 0.2);
  const skyY = useReach(sy, vh, 0.16);
  const tealX = useReach(sx, vw, 0.28);
  const tealY = useReach(sy, vh, 0.2);
  const lowX = useReach(sx, vw, 0.14);
  const lowY = useReach(sy, vh, 0.12);
  const gridX = useReach(sx, vw, 0.13);
  const gridY = useReach(sy, vh, 0.1);
  const glowX = useReach(sx, vw, 0.4);
  const glowY = useReach(sy, vh, 0.32);

  useEffect(() => {
    const measure = () => {
      vw.set(window.innerWidth);
      vh.set(window.innerHeight);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [vw, vh]);

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

/** Portion of the viewport the layer travels toward the pointer at the screen edge. */
function useReach(axis: MotionValue<number>, span: MotionValue<number>, portion: number) {
  return useTransform([axis, span], ([offset, size]: number[]) => (offset ?? 0) * (size ?? 0) * portion);
}

/** -1 at the left or top edge, 1 at the right or bottom, 0 at the center. */
function pointerAxis(client: number, size: number): number {
  if (size <= 0) return 0;
  const n = (client / size - 0.5) * 2;
  if (n < -1) return -1;
  if (n > 1) return 1;
  return n;
}
