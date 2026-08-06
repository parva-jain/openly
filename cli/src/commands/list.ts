import { api } from "../http.js";
import type { JobsListResponse } from "../contract.js";
import { handleAuthError, requireToken } from "./mark.js";

export async function listCommand(opts: { url?: string }): Promise<void> {
  const { url, token } = requireToken(opts.url);
  try {
    const { jobs } = await api<JobsListResponse>(url, "/api/jobs", { token });
    if (jobs.length === 0) {
      console.log("No jobs yet.");
      return;
    }
    for (const j of jobs) {
      const when = new Date(j.createdAt).toISOString().slice(5, 16).replace("T", " ");
      console.log(
        `${j.id}  ${when}  ${j.status.padEnd(10)}  ${j.contentType.padEnd(20)}  ${j.intent.slice(0, 50)}`,
      );
    }
  } catch (err) {
    handleAuthError(err);
  }
}
