"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Entrance and scroll reveals. `prefers-reduced-motion` snaps these in CSS
 * (`.shift-enter`); positional motion also skips inside the library.
 */
export function Entrance({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={join("shift-enter", className)}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.72, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={join("shift-enter", className)}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** One line of the hero, each word rising into place the way a display lockup does. */
export function RevealLine({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <span className={join("block", className)}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>
          <span className="inline-block overflow-hidden align-bottom pb-[0.12em]">
            <motion.span
              className="shift-enter inline-block"
              initial={{ y: "115%" }}
              animate={{ y: "0%" }}
              transition={{ duration: 0.7, delay: 0.16 + index * 0.055, ease: EASE }}
            >
              {word}
            </motion.span>
          </span>
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}

export function MotionLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const reduce = useReducedMotion() === true;
  return (
    <motion.a href={href} className={className} whileHover={reduce ? undefined : { y: -2 }} transition={{ duration: 0.22, ease: EASE }}>
      {children}
    </motion.a>
  );
}

export function Lift({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion() === true;
  return (
    <motion.div className={className} whileHover={reduce ? undefined : { y: -4 }} transition={{ duration: 0.28, ease: EASE }}>
      {children}
    </motion.div>
  );
}

function join(a: string, b?: string) {
  return b ? `${a} ${b}` : a;
}
