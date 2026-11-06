import { createDb, createRouterClient, loadWorkerConfig, redactString, tick } from "@shift/core";
import cron from "node-cron";
import { runNight } from "./night";
import { createRunFlag, startNightLoop, withNightFlag } from "./run-flag";
import { SWEEP_CRON, createSweepLock, prismaSweeperStore, recoverInterruptedRuns, recoverInterruptedTasks, sweepEphemeralKeys } from "./sweeper";

const config = loadWorkerConfig();
const db = createDb(config.DATABASE_URL);
const router = createRouterClient({ baseUrl: config.ZG_ROUTER_BASE_URL });
const sweeperStore = prismaSweeperStore(db);
const log = (message: string) => console.log(`${new Date().toISOString()} ${redactString(message)}`);

const nightFlag = createRunFlag();

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "unknown error";
}

const runSweep = createSweepLock(async () => {
  try {
    await sweepEphemeralKeys({
      store: sweeperStore,
      keys: router,
      masterKey: config.SHIFT_MASTER_KEY,
      ...(config.SHIFT_MASTER_KEY_PREV ? { previousMasterKey: config.SHIFT_MASTER_KEY_PREV } : {}),
      log,
    });
  } catch (err) {
    log(`sweep error: ${errorText(err)}`);
  }
});

// Every minute. The in-process flag stops a slow night from overlapping with the next tick of this same process;
// the database lock (acquireNight) does the same across processes. The flag is released at the hard stop even
// if a tick is still awaiting, so a hung upload cannot block every later tick.
function startNightCron(): void {
  startNightLoop(
    (expression, task) => {
      cron.schedule(expression, task);
    },
    () => {
      void runTick();
    },
  );
}

async function runTick(): Promise<void> {
  await withNightFlag(nightFlag, config.NIGHT_HARD_STOP_UTC, new Date(), log, async () => {
    try {
      await tick({
        db,
        startUtc: config.NIGHT_START_UTC,
        hardStopUtc: config.NIGHT_HARD_STOP_UTC,
        log,
        runNight: async (nightId) => {
          try {
            await runNight({ db, config, nightId, log });
            // anchorNight has stored the root, manifest and anchor tx when the batch had leaves.
            // recordNightDonations has stored donationsTx when the night had a positive donation.
            // This update does not clear them.
            await db.night.update({ where: { id: nightId }, data: { status: "DONE", finishedAt: new Date() } });
          } catch (err) {
            await db.night.update({ where: { id: nightId }, data: { status: "FAILED", finishedAt: new Date() } });
            throw err;
          }
        },
      });
    } catch (err) {
      log(`tick error: ${errorText(err)}`);
    }
  });
}

async function boot(): Promise<void> {
  // Plan §9.4. A crashed batch leaves tasks RUNNING. Put back the ones with no Router request id
  // before the scheduler starts. A live batch marks RUNNING before the request id is stored, so this
  // must not run again on the 10-minute sweep.
  try {
    const requeued = await recoverInterruptedTasks(sweeperStore);
    if (requeued.length > 0) log(`requeued ${requeued.length} interrupted task(s) with no request id`);
    const closed = await recoverInterruptedRuns(sweeperStore);
    if (closed.length > 0) log(`closed ${closed.length} interrupted run(s)`);
  } catch (err) {
    log(`recover error: ${errorText(err)}`);
  }

  startNightCron();
  cron.schedule(SWEEP_CRON, () => {
    void runSweep();
  });
  log(`worker started · window ${config.NIGHT_START_UTC}-${config.NIGHT_HARD_STOP_UTC} UTC · sweeper every 10 minutes`);
  void runSweep();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    log(`${signal} received, shutting down`);
    void db.$disconnect().finally(() => process.exit(0));
  });
}

void boot();
