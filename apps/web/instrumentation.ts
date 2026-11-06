/**
 * Once, when the Node server starts. A build without env must not fail: recovery needs the database,
 * and a missing config is logged by name only.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  try {
    const { recoverWebInterruptions } = await import("./lib/recover");
    const report = await recoverWebInterruptions();
    if (report.runs.length > 0 || report.tasks.length > 0) {
      console.log(`recovered ${report.runs.length} stuck run(s) and ${report.tasks.length} task(s)`);
    }
  } catch (err) {
    console.error("recover:", err instanceof Error ? err.name : "unknown error");
  }
}
