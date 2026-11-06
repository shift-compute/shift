/** A night run left RUNNING after disconnect would block the next run. Closing it does not invent a Router result. */
export const DISCONNECT_RUN_ERROR = "The account disconnected before this run finished.";

export async function closeRunsOnDisconnect(
  db: {
    nightRun: {
      updateMany(args: {
        where: { userId: string; status: "RUNNING" };
        data: { status: "FAILED"; error: string };
      }): Promise<{ count: number }>;
    };
  },
  userId: string,
): Promise<number> {
  const result = await db.nightRun.updateMany({
    where: { userId, status: "RUNNING" },
    data: { status: "FAILED", error: DISCONNECT_RUN_ERROR },
  });
  return result.count;
}
