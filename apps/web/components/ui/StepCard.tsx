"use client";

import type { KeyboardEvent, ReactNode } from "react";

export type StepState = "current" | "done" | "upcoming";

interface Props {
  index: number;
  title: string;
  state: StepState;
  last?: boolean;
  onSelect: () => void;
  children: ReactNode;
}

/**
 * One step of a stepper. The card is focusable: Enter or Space selects it.
 * Inputs, links and buttons inside keep their own keys, so only the card itself reacts.
 */
export function StepCard({ index, title, state, last = false, onSelect, children }: Props) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  }

  return (
    <li className="relative list-none">
      {!last && <span aria-hidden className="step-line" />}
      <div
        role="group"
        tabIndex={0}
        aria-label={`Step ${index}: ${title}${state === "done" ? " (done)" : state === "current" ? " (current)" : ""}`}
        aria-current={state === "current" ? "step" : undefined}
        data-state={state}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a,input,button,label,textarea")) return;
          onSelect();
        }}
        onKeyDown={onKeyDown}
        className="step-card surface-card surface-card-hover cursor-pointer"
      >
        <span className="step-badge" aria-hidden>
          {state === "done" ? (
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10.5l4 4 8-9" />
            </svg>
          ) : (
            index
          )}
        </span>
        <div className="step-body min-w-0">
          <h2 className="text-lg font-semibold">{title}</h2>
          {children}
        </div>
      </div>
    </li>
  );
}
