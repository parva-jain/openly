import { readConfig, resolveUrl } from "../config.js";
import { api, ApiError } from "../http.js";
import { captureWindow } from "../capture.js";
import { contentTypeNames, isContentType, isSessionAnchored } from "../content-types.js";
import type { JobCreateResponse } from "../contract.js";

/** Read the token or exit with a clear "log in first" message. */
export function requireToken(flagUrl?: string): { url: string; token: string } {
  const url = resolveUrl(flagUrl);
  const { token } = readConfig();
  if (!token) {
    console.error("Not logged in — run `openly login` first.");
    process.exit(1);
  }
  return { url, token };
}

export async function markCommand(opts: {
  type: string;
  intent: string;
  url?: string;
  window?: number;
  capture?: boolean;
  noCapture?: boolean;
}): Promise<void> {
  if (!isContentType(opts.type)) {
    console.error(
      `Unknown content type "${opts.type}". Valid: ${contentTypeNames().join(", ")}`,
    );
    process.exit(1);
  }
  const { url, token } = requireToken(opts.url);

  const doCapture = opts.noCapture ? false : opts.capture ? true : isSessionAnchored(opts.type);
  const sessionContext = doCapture ? captureWindow(opts.window ?? 30) : null;

  try {
    const res = await api<JobCreateResponse>(url, "/api/jobs", {
      method: "POST",
      token,
      body: { content_type: opts.type, intent: opts.intent, session_context: sessionContext },
    });
    const captured = sessionContext
      ? `${sessionContext.length} chars captured`
      : "no session window";
    console.log(`✓ queued job ${res.jobId} (${res.status}; ${captured})`);
  } catch (err) {
    handleAuthError(err);
  }
}

export function handleAuthError(err: unknown): never {
  if (err instanceof ApiError) {
    if (err.status === 401) console.error("Session expired or revoked — run `openly login`.");
    else console.error(`Error: ${err.message}`);
    process.exit(1);
  }
  throw err;
}
