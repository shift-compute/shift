import { createDb, loadWorkerConfig, tick } from "@shift/core";
import cron from "node-cron";
import { runNight } from "./night";

const config = loadWorkerConfig();
const db = createDb(config.DATABASE_URL);
const log = (message: string) => console.log(`${new Date().toISOString()} ${message}`);

let running = false;

// Every minute. The in-process flag stops a slow night from overlapping with the next tick of this same process;
// the database lock (acquireNight) does the same across processes.
cron.schedule("* * * * *", async () => {
  if (running) return;
  running = true;
  try {
    await tick({
      db,
      startUtc: config.NIGHT_START_UTC,
      hardStopUtc: config.NIGHT_HARD_STOP_UTC,
      log,
      runNight: async (nightId) => {
        try {
          await runNight({ db, config, nightId, log });
          await db.night.update({ where: { id: nightId }, data: { status: "DONE", finishedAt: new Date() } });
        } catch (err) {
          await db.night.update({ where: { id: nightId }, data: { status: "FAILED", finishedAt: new Date() } });
          throw err;
        }
      },
    });
  } catch (err) {
    log(`tick error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    running = false;
  }
});

log(`worker started · window ${config.NIGHT_START_UTC}-${config.NIGHT_HARD_STOP_UTC} UTC`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    log(`${signal} received, shutting down`);
    void db.$disconnect().finally(() => process.exit(0));
  });
}
