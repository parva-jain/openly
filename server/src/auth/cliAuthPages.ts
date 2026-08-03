// Minimal server-rendered pages for the CLI auth flows. Deliberately bare;
// the M6 dashboard will host proper versions. `esc` prevents the reflected
// query params from injecting markup.
function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

const shell = (title: string, body: string): string =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font:16px system-ui;max-width:22rem;margin:4rem auto;padding:0 1rem}
input,button{font:inherit;width:100%;padding:.6rem;margin:.3rem 0;box-sizing:border-box}
button{cursor:pointer}</style></head><body>${body}</body></html>`;

/** Loopback login form. Carries the flow params as hidden fields. */
export function loopbackLoginPage(params: {
  port: string;
  state: string;
  codeChallenge: string;
  error?: string;
}): string {
  return shell(
    "Authorize Openly CLI",
    `<h2>Authorize Openly CLI</h2>
${params.error ? `<p style="color:#c00">${esc(params.error)}</p>` : ""}
<form method="post" action="/cli-auth">
<input type="hidden" name="port" value="${esc(params.port)}">
<input type="hidden" name="state" value="${esc(params.state)}">
<input type="hidden" name="code_challenge" value="${esc(params.codeChallenge)}">
<input name="email" type="email" placeholder="email" required autofocus>
<input name="password" type="password" placeholder="password" required>
<button type="submit">Log in &amp; authorize</button>
</form>`,
  );
}

/** Device-activation page: login + enter the user_code. */
export function activatePage(params: { userCode?: string; error?: string }): string {
  return shell(
    "Activate Openly CLI",
    `<h2>Activate Openly CLI</h2>
${params.error ? `<p style="color:#c00">${esc(params.error)}</p>` : ""}
<form method="post" action="/activate">
<input name="email" type="email" placeholder="email" required autofocus>
<input name="password" type="password" placeholder="password" required>
<input name="user_code" placeholder="code (e.g. WDJB-MJHT)" value="${esc(params.userCode ?? "")}" required>
<button type="submit">Approve</button>
</form>`,
  );
}

export function successPage(): string {
  return shell(
    "Done",
    `<h2>&#10003; Authorized</h2><p>You can close this tab and return to your terminal.</p>`,
  );
}
