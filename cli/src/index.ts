#!/usr/bin/env node
// openly CLI entrypoint. Minimal dispatch with node:util parseArgs — no
// commander/oclif (design §2: zero runtime deps).
import { parseArgs } from "node:util";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { markCommand } from "./commands/mark.js";
import { listCommand } from "./commands/list.js";
import { showCommand } from "./commands/show.js";
import { contentTypeNames } from "./content-types.js";

const USAGE = `openly — capture your work, draft it later.

Usage:
  openly login [--device] [--url <url>]
  openly logout
  openly mark <type> <intent> [--window <n>] [--capture|--no-capture] [--url <url>]
  openly list [--url <url>]
  openly show <job-id> [--url <url>]

Content types: ${contentTypeNames().join(", ")}
`;

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      url: { type: "string" },
      device: { type: "boolean" },
      window: { type: "string" },
      capture: { type: "boolean" },
      "no-capture": { type: "boolean" },
    },
  });

  switch (command) {
    case "login":
      await loginCommand({ url: values.url, device: values.device });
      break;
    case "logout":
      await logoutCommand();
      break;
    case "mark": {
      const [type, intent] = positionals;
      if (!type || !intent) {
        console.error("Usage: openly mark <type> <intent>");
        process.exit(1);
      }
      await markCommand({
        type,
        intent,
        url: values.url,
        window: values.window ? Number(values.window) : undefined,
        capture: values.capture,
        noCapture: values["no-capture"],
      });
      break;
    }
    case "list":
      await listCommand({ url: values.url });
      break;
    case "show": {
      const [id] = positionals;
      if (!id) {
        console.error("Usage: openly show <job-id>");
        process.exit(1);
      }
      await showCommand({ id, url: values.url });
      break;
    }
    default:
      console.log(USAGE);
      process.exit(command ? 1 : 0);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
