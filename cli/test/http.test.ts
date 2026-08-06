import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { api, ApiError } from "../src/http.js";

let server: Server;
let base: string;

before(async () => {
  server = createServer((req, res) => {
    if (req.url === "/ok") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ hello: "world", auth: req.headers.authorization ?? null }));
    } else if (req.url === "/bad") {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "nope" }));
    } else if (req.url === "/nocontent") {
      res.writeHead(204);
      res.end();
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(() => server.close());

describe("http", () => {
  test("GET returns parsed json and sends the bearer token", async () => {
    const res = await api<{ hello: string; auth: string }>(base, "/ok", { token: "t1" });
    assert.equal(res.hello, "world");
    assert.equal(res.auth, "Bearer t1");
  });

  test("non-2xx throws ApiError carrying status + backend message", async () => {
    await assert.rejects(
      () => api(base, "/bad"),
      (e: unknown) => e instanceof ApiError && e.status === 400 && e.message === "nope",
    );
  });

  test("204 resolves to undefined", async () => {
    const res = await api(base, "/nocontent", { method: "DELETE" });
    assert.equal(res, undefined);
  });

  test("unreachable host throws ApiError status 0", async () => {
    await assert.rejects(
      () => api("http://127.0.0.1:1", "/ok"),
      (e: unknown) => e instanceof ApiError && e.status === 0,
    );
  });
});
