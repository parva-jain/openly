// Server entrypoint: wire real dependencies (Postgres + AI service), start the
// background worker, and start listening.
import { createApp } from "./app.js";
import * as ai from "./aiService.js";
import { config } from "./config.js";
import { createDb } from "./db/client.js";
import { startWorker } from "./worker.js";

const { db } = createDb();
const app = createApp({ db, ai });
const stopWorker = startWorker({ db, ai }, config.workerPollMs);

const server = app.listen(config.port, () => {
  console.log(`openly-backend listening on http://localhost:${config.port}`);
  console.log(`  -> AI service: ${config.pythonServiceUrl}`);
  console.log(`  -> worker polling every ${config.workerPollMs}ms`);
});

// Graceful shutdown: stop the worker loop, then close the HTTP server.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    stopWorker();
    server.close(() => process.exit(0));
  });
}
