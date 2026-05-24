import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { startScheduler, stopScheduler } from "./jobs/scheduler";

async function main() {
  const app = createApp();

  // Verify the database connection before accepting traffic.
  await prisma.$connect();
  console.log("[db] connected");

  const server = app.listen(env.port, () => {
    console.log(`[server] BlueRock RCM API listening on port ${env.port} (${env.nodeEnv})`);
  });

  startScheduler();

  const shutdown = async (signal: string) => {
    console.log(`[server] ${signal} received, shutting down`);
    stopScheduler();
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[server] fatal startup error", err);
  process.exit(1);
});
