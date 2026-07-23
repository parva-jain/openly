// Typed client for the Python AI service.
//
// This is the ONLY place in the Node backend that knows how to talk to Python.
// Everything else calls these functions and gets typed results back — so the
// HTTP boundary is isolated in one module. Uses Node's built-in fetch.

import { config } from "./config.js";
import type {
  DraftRequest,
  DraftResponse,
  FuseRequest,
  FuseResponse,
} from "./types.js";

/** Error thrown when the Python service returns a non-2xx response. */
export class AiServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "AiServiceError";
  }
}

async function postJson<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
  let res: Response;
  try {
    res = await fetch(`${config.pythonServiceUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    // Network-level failure (service down, DNS, etc.).
    throw new AiServiceError(
      `Could not reach AI service at ${config.pythonServiceUrl}${path}`,
      503,
      cause,
    );
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => undefined);
    throw new AiServiceError(
      `AI service returned ${res.status} for ${path}`,
      res.status,
      detail,
    );
  }
  return (await res.json()) as TRes;
}

export function draft(req: DraftRequest): Promise<DraftResponse> {
  return postJson<DraftRequest, DraftResponse>("/draft", req);
}

export function fuse(req: FuseRequest): Promise<FuseResponse> {
  return postJson<FuseRequest, FuseResponse>("/fuse", req);
}

/** Liveness of the downstream AI service. */
export async function aiHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${config.pythonServiceUrl}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
