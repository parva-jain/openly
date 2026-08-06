import { api } from "../http.js";
import type { JobDetailResponse } from "../contract.js";
import { handleAuthError, requireToken } from "./mark.js";

export async function showCommand(opts: { id: string; url?: string }): Promise<void> {
  const { url, token } = requireToken(opts.url);
  try {
    const { job, draft } = await api<JobDetailResponse>(url, `/api/jobs/${opts.id}`, { token });
    if (!draft) {
      console.log(
        `Job ${job.id} is "${job.status}"${job.error ? ` (${job.error})` : ""} — no draft yet.`,
      );
      return;
    }
    draft.variations.forEach((v, i) => {
      console.log(`\n--- variation ${i + 1} ---\n${v}`);
    });
  } catch (err) {
    handleAuthError(err);
  }
}
