// Optional standalone worker process. Run with `npm run worker` if you prefer to
// run the automation engine separately from the API (set ENABLE_SCHEDULER=false on the API).
import { startScheduler } from "./scheduler";
import { prisma } from "../lib/prisma";

console.log("[worker] BlueRock RCM automation worker starting");
startScheduler();

async function shutdown() {
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
