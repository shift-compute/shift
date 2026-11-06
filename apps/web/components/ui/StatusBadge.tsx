export type BadgeTone = "neutral" | "active" | "done" | "bad" | "wait";

export function StatusBadge({ tone = "neutral", children }: { tone?: BadgeTone; children: string }) {
  return (
    <span className="status-badge" data-tone={tone}>
      {children}
    </span>
  );
}
