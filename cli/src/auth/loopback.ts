// Loopback browser login (default). Starts a throwaway local server, opens the
// backend login page with a PKCE challenge + state, receives the one-time code
// on /callback, and exchanges it for a CLI token.
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { api } from "../http.js";
import { openBrowser } from "../util/browser.js";
import type { TokenResponse } from "../contract.js";

const b64url = (buf: Buffer): string => buf.toString("base64url");

export async function loopbackLogin(baseUrl: string): Promise<TokenResponse> {
  const state = b64url(randomBytes(16));
  const codeVerifier = b64url(randomBytes(32));
  const codeChallenge = b64url(createHash("sha256").update(codeVerifier).digest());

  return new Promise<TokenResponse>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      res
        .writeHead(200, { "content-type": "text/html" })
        .end("<h2>&#10003; Authorized — you can close this tab.</h2>");
      server.close();

      const code = url.searchParams.get("code");
      if (!code || url.searchParams.get("state") !== state) {
        reject(new Error("login failed (state mismatch or no code)"));
        return;
      }
      api<TokenResponse>(baseUrl, "/auth/cli/exchange", {
        method: "POST",
        body: { code, code_verifier: codeVerifier },
      })
        .then(resolve)
        .catch(reject);
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      const loginUrl = `${baseUrl}/cli-auth?port=${port}&state=${state}&code_challenge=${codeChallenge}`;
      console.log(`Opening your browser to log in:\n  ${loginUrl}\n`);
      openBrowser(loginUrl);
    });
  });
}
