"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import type { BrandLogo } from "./logos";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * A rounded square sized to the headline (`em`), sitting between words.
 * It flips through its reel slowly; `offset` staggers tiles so they never
 * change together. A one-logo reel stays put, as does reduced motion.
 * Decorative: the headline reads the same without it.
 */
export function IconTile({ reel, offset = 0, interval = 4000 }: { reel: readonly BrandLogo[]; offset?: number; interval?: number }) {
  const reduce = useReducedMotion() === true;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce || reel.length < 2) return;
    let id: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      setIndex((i) => (i + 1) % reel.length);
      id = setInterval(() => setIndex((i) => (i + 1) % reel.length), interval);
    }, interval + offset);
    return () => {
      clearTimeout(start);
      if (id) clearInterval(id);
    };
  }, [reduce, reel.length, interval, offset]);

  const logo = reel[index] ?? reel[0];
  if (!logo) return null;

  return (
    <span
      className="relative mx-[0.06em] inline-block h-[0.86em] w-[0.86em] align-[-0.1em] [perspective:600px]"
      title={logo.label}
      aria-hidden="true"
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={logo.id}
          className="absolute inset-0 overflow-hidden rounded-[0.24em] bg-surface shadow-[0_0.08em_0.22em_rgb(15_23_42/0.16)] ring-1 ring-ink/10"
          initial={{ rotateX: -90, y: "-30%", opacity: 0 }}
          animate={{ rotateX: 0, y: "0%", opacity: 1 }}
          exit={{ rotateX: 90, y: "30%", opacity: 0 }}
          transition={{ duration: 0.9, ease: EASE }}
        >
          <img
            src={logo.src}
            alt=""
            draggable={false}
            className="h-full w-full object-contain"
            style={{ transform: logo.zoom ? `scale(${logo.zoom})` : undefined, padding: logo.pad }}
          />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
