/**
 * Production server (Dokploy runs `npm start` after `npm run build`).
 * Serves the built site from dist/ and the Audits API on $PORT (default 3000).
 * The GitHub token is read from the environment at runtime — see server/api.mjs.
 *
 * Published audits are served straight from GitHub, so a freshly uploaded
 * audit's link works immediately instead of after the next redeploy.
 */
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createApiHandler, fetchRepoRaw, githubConfig } from "./server/api.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "dist");
const PORT = Number(process.env.PORT) || 3000;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const api = createApiHandler(process.env);
const gh = githubConfig(process.env);

/** Files the Audits tab publishes: the manifest, preview images, /<slug>.html and /<slug>/index.html. */
const isPublished = (path) =>
  path === "/claude-reviews.json" ||
  /^\/review-thumbs\/[a-z0-9-]+\.jpg$/.test(path) ||
  (/^\/[a-z0-9][a-z0-9-]*\.html$/.test(path) && path !== "/index.html") ||
  /^\/[a-z0-9][a-z0-9-]*\/index\.html$/.test(path);

const cache = new Map(); // path -> { at, body }
async function publishedFile(path) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < 10_000) return hit.body;
  const body = await fetchRepoRaw(gh, `public${path}`).catch(() => null);
  if (cache.size > 200) cache.clear();
  cache.set(path, { at: Date.now(), body });
  return body;
}

function serveFile(res, file, method) {
  const ext = extname(file).toLowerCase();
  res.writeHead(200, {
    "Content-Type": TYPES[ext] || "application/octet-stream",
    // hashed build assets never change; everything else is re-checked
    "Cache-Control": file.includes(`${sep}assets${sep}`) ? "public, max-age=31536000, immutable" : "no-cache",
  });
  if (method === "HEAD") return res.end();
  createReadStream(file).pipe(res);
}

createServer(async (req, res) => {
  if ((req.url || "").startsWith("/api/")) return api(req, res);
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405).end();
    return;
  }
  try {
    const path = decodeURIComponent(new URL(req.url || "/", "http://local").pathname);

    if (gh.configured && isPublished(path)) {
      const body = await publishedFile(path);
      if (body) {
        res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream", "Cache-Control": "no-cache" });
        return res.end(req.method === "HEAD" ? undefined : body);
      }
    }

    const file = normalize(join(ROOT, path));
    if (file.startsWith(ROOT)) {
      const info = await stat(file).catch(() => null);
      if (info?.isFile()) return serveFile(res, file, req.method);
    }
    // Everything else is a page of the app (e.g. /audits, /oramune).
    return serveFile(res, join(ROOT, "index.html"), req.method);
  } catch {
    res.writeHead(400).end();
  }
}).listen(PORT, () => {
  console.log(`Listening on port ${PORT}${gh.configured ? "" : " — uploading is off until GITHUB_TOKEN and GITHUB_REPO are set"}`);
});
