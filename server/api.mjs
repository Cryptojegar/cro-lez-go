/**
 * Server side of the Audits tab.
 *
 * The GitHub token lives only here, read from the container's environment at
 * runtime (Dokploy → Environment) — it is never sent to the browser. Requests
 * to /api/github/contents/<path> are forwarded to the GitHub Contents API, and
 * only files inside public/ can be touched.
 *
 * Environment variables:
 *   GITHUB_TOKEN    fine-grained token, Contents: Read and write on the repo
 *   GITHUB_REPO     owner/repository (default: Cryptojegar/cro-lez-go)
 *   GITHUB_BRANCH   branch to publish to (default: main)
 */

const MAX_BODY = 40 * 1024 * 1024; // a 15 MB audit is ~20 MB once base64 encoded
const PATH_PREFIX = "public/";

const readBody = (req) =>
  new Promise((ok, bad) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        bad(Object.assign(new Error("Request too large."), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => ok(Buffer.concat(chunks)));
    req.on("error", bad);
  });

const send = (res, status, data) => {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
};

/** This site's own repository; override with GITHUB_REPO if it ever moves. */
const DEFAULT_REPO = "Cryptojegar/cro-lez-go";

export function githubConfig(env = process.env) {
  const token = (env.GITHUB_TOKEN || "").trim();
  const repo = (env.GITHUB_REPO || DEFAULT_REPO).trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
  const branch = (env.GITHUB_BRANCH || "main").trim();
  return { token, repo, branch, configured: Boolean(token && /^[\w.-]+\/[\w.-]+$/.test(repo)) };
}

// GITHUB_API only exists for local testing against a fake GitHub.
const API = (process.env.GITHUB_API || "https://api.github.com").replace(/\/$/, "");
const contentsUrl = (repo, path) =>
  `${API}/repos/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;

const ghHeaders = (token, accept) => ({
  Accept: accept,
  "X-GitHub-Api-Version": "2022-11-28",
  Authorization: `Bearer ${token}`,
  "User-Agent": "audits-hub",
});

/** Raw bytes of a repo file, or null when it doesn't exist (used to serve new uploads before a redeploy). */
export async function fetchRepoRaw(cfg, path) {
  if (!cfg.configured) return null;
  const response = await fetch(`${contentsUrl(cfg.repo, path)}?ref=${encodeURIComponent(cfg.branch)}`, {
    headers: ghHeaders(cfg.token, "application/vnd.github.raw+json"),
  });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

export function createApiHandler(env = process.env) {
  const cfg = githubConfig(env);
  const notSetUp = "Publishing isn't set up on the server: add GITHUB_TOKEN to the app's environment in Dokploy, then redeploy.";

  return async function handle(req, res, next) {
    const url = new URL(req.url || "/", "http://local");
    if (!url.pathname.startsWith("/api/")) return next ? next() : false;

    try {
      if (url.pathname === "/api/session" && req.method === "GET") {
        return send(res, 200, { configured: cfg.configured });
      }

      if (url.pathname.startsWith("/api/github/contents/")) {
        if (!cfg.configured) return send(res, 503, { message: notSetUp });
        const path = decodeURIComponent(url.pathname.slice("/api/github/contents/".length));
        if (!path.startsWith(PATH_PREFIX) || path.split("/").some((p) => p === ".." || p === "")) {
          return send(res, 403, { message: "Only files inside public/ can be changed." });
        }
        if (!["GET", "PUT", "DELETE"].includes(req.method)) return send(res, 405, { message: "Method not allowed." });

        let body;
        if (req.method !== "GET") {
          const data = JSON.parse((await readBody(req)).toString() || "{}");
          body = JSON.stringify({ ...data, branch: cfg.branch });
        }
        const raw = req.headers.accept === "application/vnd.github.raw+json";
        const upstream = await fetch(
          `${contentsUrl(cfg.repo, path)}${req.method === "GET" ? `?ref=${encodeURIComponent(cfg.branch)}` : ""}`,
          {
            method: req.method,
            headers: {
              ...ghHeaders(cfg.token, raw ? "application/vnd.github.raw+json" : "application/vnd.github+json"),
              ...(body ? { "Content-Type": "application/json" } : {}),
            },
            body,
          },
        );
        const out = Buffer.from(await upstream.arrayBuffer());
        res.writeHead(upstream.status, {
          "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
          "Cache-Control": "no-store",
        });
        return res.end(out);
      }

      return send(res, 404, { message: "Not found." });
    } catch (e) {
      return send(res, e.status || 500, { message: e.message || "Server error." });
    }
  };
}
