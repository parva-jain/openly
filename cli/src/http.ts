// Tiny fetch wrapper: base URL + optional bearer + JSON. Network failures and
// non-2xx responses become ApiError so commands can handle them uniformly.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiOptions {
  method?: string;
  token?: string;
  body?: unknown;
}

export async function api<T>(baseUrl: string, path: string, opts: ApiOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(baseUrl + path, {
      method: opts.method ?? "GET",
      headers: {
        ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, `cannot reach backend at ${baseUrl}`);
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(res.status, (data.error as string) ?? `HTTP ${res.status}`);
  }
  return data as T;
}
