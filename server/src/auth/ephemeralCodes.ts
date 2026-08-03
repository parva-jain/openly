// Short-lived state for the CLI auth flows: one-time authorization codes
// (loopback) and pending device requests. In-memory with per-entry TTL.
// Labeled simplest-thing choice (design §4.3.1): fine for a single backend
// instance; move to Postgres/Redis only if we ever scale out horizontally.
interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class EphemeralStore<T> {
  private readonly map = new Map<string, Entry<T>>();

  set(key: string, value: T, ttlMs: number): void {
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  get(key: string): T | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (Date.now() > e.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    return e.value;
  }

  /** Get and remove — for single-use codes. */
  take(key: string): T | undefined {
    const v = this.get(key);
    if (v !== undefined) this.map.delete(key);
    return v;
  }

  update(key: string, value: T): void {
    const e = this.map.get(key);
    if (e) e.value = value;
  }
}
