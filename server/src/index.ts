// Server entrypoint: create the app with real dependencies and start listening.
import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp();

app.listen(config.port, () => {
  console.log(`openly-backend listening on http://localhost:${config.port}`);
  console.log(`  -> AI service: ${config.pythonServiceUrl}`);
});
