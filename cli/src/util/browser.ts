// Best-effort open a URL in the user's default browser. Never throws — if it
// fails, the caller still prints the URL for manual navigation.
import { spawn } from "node:child_process";

export function openBrowser(url: string): void {
  try {
    const [cmd, args]: [string, string[]] =
      process.platform === "darwin"
        ? ["open", [url]]
        : process.platform === "win32"
          ? ["cmd", ["/c", "start", "", url]]
          : ["xdg-open", [url]];
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    // ignore — the URL is printed by the caller
  }
}
