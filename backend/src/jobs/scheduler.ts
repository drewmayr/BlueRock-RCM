import cron, { ScheduledTask } from "node-cron";
import { env } from "../config/env";
import {
  processDueEnrollments,
  processScheduledMessages,
  processAgedLeads,
  detectCrossSells,
  runAutomationCycle,
} from "../services/automation";

let tasks: ScheduledTask[] = [];
let running = false;

/** Light, time-sensitive pass: advance enrollments and deliver due messages. */
async function lightPass(): Promise<void> {
  if (running) return; // avoid overlapping runs
  running = true;
  try {
    const stepped = await processDueEnrollments();
    const messages = await processScheduledMessages();
    if (stepped || messages) {
      console.log(`[scheduler] advanced ${stepped} step(s), delivered ${messages} message(s)`);
    }
  } catch (err) {
    console.error("[scheduler] light pass error", err);
  } finally {
    running = false;
  }
}

/** Daily pass: detect aged leads, recurring life events, and cross-sell opportunities. */
async function dailyPass(): Promise<void> {
  try {
    const summary = await runAutomationCycle();
    console.log("[scheduler] daily pass", summary);
  } catch (err) {
    console.error("[scheduler] daily pass error", err);
  }
}

export function startScheduler(): void {
  if (!env.scheduler.enabled) {
    console.log("[scheduler] disabled via ENABLE_SCHEDULER=false");
    return;
  }
  // Light pass on the configured cadence (default: every minute).
  tasks.push(cron.schedule(env.scheduler.cron, lightPass));
  // Heavy pass once daily at 08:00 server time.
  tasks.push(cron.schedule("0 8 * * *", dailyPass));
  console.log(`[scheduler] started (light="${env.scheduler.cron}", daily="0 8 * * *")`);

  // Run aged-lead + cross-sell detection shortly after boot so a fresh deploy is immediately useful.
  setTimeout(() => {
    processAgedLeads().catch((e) => console.error("[scheduler] startup aged-lead pass", e));
    detectCrossSells().catch((e) => console.error("[scheduler] startup cross-sell pass", e));
  }, 8000);
}

export function stopScheduler(): void {
  tasks.forEach((t) => t.stop());
  tasks = [];
}
