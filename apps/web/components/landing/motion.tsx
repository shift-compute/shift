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

/**
 * One line of the hero, each word rising into place the way a display lockup does.
 * `parts` mixes text with inline nodes (hero tiles); a node rises as one word.
 */
export function RevealLine({ text, parts, className, delay = 0.16 }: { text?: string; parts?: readonly ReactNode[]; className?: string; delay?: number }) {
  const items: ReactNode[] = (parts ?? [text ?? ""]).flatMap((part) => (typeof part === "string" ? part.split(" ").filter(Boolean) : [part]));
  return (
    <span className={join("block", className)}>
      {items.map((item, index) => (
        <span key={index}>
          <span className={typeof item === "string" ? "inline-block overflow-hidden align-bottom pb-[0.12em]" : "inline-block align-bottom pb-[0.12em]"}>
            <motion.span
              className="shift-enter inline-block"
              initial={typeof item === "string" ? { y: "115%" } : { y: "40%", scale: 0.6, opacity: 0 }}
              animate={{ y: "0%", scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, delay: delay + index * 0.055, ease: EASE }}
            >
              {item}
            </motion.span>
          </span>
          {index < items.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}

const LIFT = { type: "spring", stiffness: 460, damping: 28, mass: 0.55 } as const;

export function MotionLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const reduce = useReducedMotion() === true;
  return (
    <motion.a
      href={href}
      className={className}
      whileHover={reduce ? undefined : { y: -3, scale: 1.025 }}
      whileTap={reduce ? undefined : { y: 0, scale: 0.975 }}
      transition={LIFT}
    >
      {children}
    </motion.a>
  );
}

export function Lift({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion() === true;
  return (
    <motion.div className={join("lift-card", className)} whileHover={reduce ? undefined : { y: -6 }} transition={LIFT}>
      {children}
    </motion.div>
  );
}

function join(a: string, b?: string) {
  return b ? `${a} ${b}` : a;
}
