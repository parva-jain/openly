// Request/response shapes for the backend endpoints the CLI calls. Kept small
// and standalone (design §2): the CLI owns its own contract types.
export interface TokenResponse {
  token: string;
  expires_at: string;
}
export interface DeviceStartResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
  expires_in: number;
}
export interface DevicePending {
  status: "authorization_pending" | "slow_down";
}
export interface JobCreateResponse {
  jobId: string;
  status: string;
}
export interface JobSummary {
  id: string;
  createdAt: string;
  status: string;
  contentType: string;
  intent: string;
}
export interface JobsListResponse {
  jobs: JobSummary[];
}
export interface JobDetailResponse {
  job: JobSummary & { error: string | null };
  draft: { variations: string[] } | null;
}
