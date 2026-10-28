/**
 * Audit publishing helpers (the Audits tab).
 *
 * An audit is published into the site repository through the app's own
 * server (`/api`, see server/api.mjs), which holds the GitHub token as a
 * secret and forwards to the GitHub Contents API. The browser never sees the
 * token.
 *
 * Files: public/<slug>.html, a public/<slug>/index.html redirect stub, an
 * optional preview image and the manifest public/claude-reviews.json. The
 * site serves the audit to clients at `/<slug>` (ReviewView) and `/<slug>.html`.
 */

export type ReviewType = "cro" | "seo";
export type ReviewStatus = "draft" | "ready" | "sent" | "won" | "archived";

export interface ReviewStats {
  pages?: number;
  findings?: number;
  critical?: number;
}

export interface ClaudeReview {
  slug: string;
  title: string;
  file: string;
  uploadedAt: string;
  size?: number;
  /* Hub details — all optional so older manifests keep working. */
  updatedAt?: string;
  brand?: string;
  domain?: string;
  date?: string;
  type?: ReviewType;
  status?: ReviewStatus;
  tags?: string[];
  notes?: string;
  stats?: ReviewStats;
  /** Preview image path inside `public/`, e.g. `review-thumbs/oramune.jpg`. */
  thumb?: string;
  origName?: string;
}

/** Audits in their custom order, plus old link names that forward to new ones. */
export interface ReviewManifest {
  reviews: ClaudeReview[];
  aliases: Record<string, string>;
}

/** Manifest is committed next to the audits inside `public/`. */
export const MANIFEST_FILE = "claude-reviews.json";
export const MANIFEST_REPO_PATH = `public/${MANIFEST_FILE}`;

/**
 * Preview images are separate files so the manifest stays small (the Contents
 * API only inlines files up to 1 MB).
 */
export const THUMB_DIR = "review-thumbs";

/** Slugs that would collide with the app's own routes. */
export const RESERVED_SLUGS = [
  "domain-checkup",
  "claude-review-upload",
  "audits",
  "index",
  "assets",
  "api",
  "claude-reviews",
  THUMB_DIR,
];

export const MAX_REVIEW_BYTES = 15 * 1024 * 1024; // 15 MB

/** Keys older versions used to keep a GitHub token in the browser. */
const LEGACY_KEYS = ["claude-review-github-token", "claude-review-repo-config"];
export const forgetLegacyBrowserToken = (): void => {
  try {
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage blocked */
  }
};

/* -------------------------------------------------------------------------- */
/* Slug / URL helpers                                                         */
/* -------------------------------------------------------------------------- */

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\.html?$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export const isValidSlug = (value: string): boolean =>
  /^[a-z0-9][a-z0-9-]{0,59}$/.test(value);

export const slugValidationError = (value: string): string | null => {
  if (!value) return "Add a link name (for example: oramune).";
  if (!isValidSlug(value)) {
    return "Use lowercase letters, numbers and dashes only (1-60 characters).";
  }
  if (RESERVED_SLUGS.includes(value)) {
    return `"${value}" is reserved by the app. Pick another link name.`;
  }
  return null;
};

export const reviewShareUrl = (slug: string): string =>
  `${window.location.origin}/${slug}`;

export const reviewFileUrl = (file: string): string =>
  `${window.location.origin}/${file}`;

/* -------------------------------------------------------------------------- */
/* Server status                                                              */
/* -------------------------------------------------------------------------- */

export interface ServerState {
  /** The server answered at all (false when the site is served without server.mjs). */
  available: boolean;
  /** GITHUB_TOKEN and GITHUB_REPO are set on the server. */
  configured: boolean;
}

export const getServerState = async (): Promise<ServerState> => {
  try {
    const response = await fetch("/api/session", { cache: "no-store" });
    const type = response.headers.get("content-type") || "";
    if (!response.ok || !type.includes("application/json")) return { available: false, configured: false };
    const data = (await response.json()) as { configured?: boolean };
    return { available: true, configured: Boolean(data.configured) };
  } catch {
    return { available: false, configured: false };
  }
};

const messageOf = async (response: Response, fallback: string): Promise<string> => {
  try {
    const data = (await response.json()) as { message?: string };
    if (data?.message) return data.message;
  } catch {
    /* body was not JSON */
  }
  return `${fallback} (HTTP ${response.status})`;
};

/* -------------------------------------------------------------------------- */
/* Repository files (through /api/github/contents)                            */
/* -------------------------------------------------------------------------- */

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const base64Encode = (text: string): string => bytesToBase64(new TextEncoder().encode(text));

const base64Decode = (value: string): string => {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
};

const contentsUrl = (path: string): string =>
  `/api/github/contents/${path.split("/").map(encodeURIComponent).join("/")}`;

const apiError = async (response: Response, fallback: string): Promise<Error> => {
  const message = await messageOf(response, fallback);
  if (response.status === 403 && /resource not accessible|permission/i.test(message)) {
    return new Error(`${fallback}: the server's GitHub token is missing write access.`);
  }
  return new Error(`${fallback}: ${message}`);
};

export interface RemoteFile {
  sha: string;
  text: string;
}

/** `/oramune` works even on hosts without SPA fallback, thanks to this stub. */
const redirectStub = (slug: string, title: string): string => {
  const safeTitle = title.replace(/[<>&"]/g, (char) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[char] ?? char,
  );
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="../${slug}.html">
<meta http-equiv="refresh" content="0; url=../${slug}.html">
</head>
<body>
<p>Opening the audit… <a href="../${slug}.html">Continue to ${safeTitle}</a></p>
<script>window.location.replace("../${slug}.html");</script>
</body>
</html>
`;
};

export const readRepoFile = async (path: string): Promise<RemoteFile | null> => {
  const response = await fetch(contentsUrl(path), { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw await apiError(response, `Could not read ${path}`);

  // GitHub inlines `content` for files up to 1 MB. Bigger files come back with
  // `encoding: "none"`, but the `sha` is always present and that is all the
  // write/delete calls below need.
  const data = (await response.json()) as { sha: string; content?: string };
  return { sha: data.sha, text: data.content ? base64Decode(data.content) : "" };
};

/** Reads a file's raw bytes, including files over 1 MB. */
const readRepoRawResponse = async (path: string): Promise<Response | null> => {
  const response = await fetch(contentsUrl(path), {
    cache: "no-store",
    headers: { Accept: "application/vnd.github.raw+json" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw await apiError(response, `Could not read ${path}`);
  return response;
};

/** Writes content that is already base64 encoded (used for preview images). */
export const writeRepoBase64 = async (path: string, content: string, message: string): Promise<void> => {
  const existing = await readRepoFile(path);
  const response = await fetch(contentsUrl(path), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, content, ...(existing ? { sha: existing.sha } : {}) }),
  });
  if (!response.ok) throw await apiError(response, `Could not publish ${path}`);
};

export const writeRepoFile = async (path: string, text: string, message: string): Promise<void> =>
  writeRepoBase64(path, base64Encode(text), message);

export const deleteRepoFile = async (path: string, message: string): Promise<void> => {
  const existing = await readRepoFile(path);
  if (!existing) return;
  const response = await fetch(contentsUrl(path), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha: existing.sha }),
  });
  if (!response.ok) throw await apiError(response, `Could not delete ${path}`);
};

/* -------------------------------------------------------------------------- */
/* Manifest (the list of published audits)                                    */
/* -------------------------------------------------------------------------- */

const emptyManifest = (): ReviewManifest => ({ reviews: [], aliases: {} });

/** Keeps the stored order: that is the custom order the hub shows. */
const parseManifestData = (raw: string): ReviewManifest => {
  const parsed = JSON.parse(raw) as
    | ClaudeReview[]
    | { reviews?: ClaudeReview[]; aliases?: Record<string, string> };
  const list = Array.isArray(parsed) ? parsed : parsed?.reviews ?? [];
  const aliases = Array.isArray(parsed) ? {} : parsed?.aliases ?? {};
  return {
    reviews: list
      .filter((item): item is ClaudeReview =>
        Boolean(item && typeof item.slug === "string" && typeof item.file === "string"),
      )
      .map((item) => ({ ...item, title: item.title || item.slug })),
    aliases: aliases && typeof aliases === "object" ? { ...aliases } : {},
  };
};

/** Reads the manifest deployed with the site (used by client-facing pages). */
export const loadPublishedManifestData = async (): Promise<ReviewManifest> => {
  try {
    const response = await fetch(`/${MANIFEST_FILE}`, { cache: "no-store" });
    if (!response.ok) return emptyManifest();
    return parseManifestData(await response.text());
  } catch {
    return emptyManifest();
  }
};

export const loadPublishedManifest = async (): Promise<ClaudeReview[]> =>
  (await loadPublishedManifestData()).reviews;

/** Reads the manifest straight from the repository, else the deployed copy. */
export const loadRepoManifestData = async (): Promise<ReviewManifest> => {
  try {
    const remote = await readRepoFile(MANIFEST_REPO_PATH);
    if (remote) return parseManifestData(remote.text);
  } catch {
    /* server unavailable: fall back to the deployed copy */
  }
  return loadPublishedManifestData();
};

export const saveManifest = async (manifest: ReviewManifest, message: string): Promise<void> => {
  const payload = `${JSON.stringify({ reviews: manifest.reviews, aliases: manifest.aliases }, null, 2)}\n`;
  await writeRepoFile(MANIFEST_REPO_PATH, payload, message);
};

export const thumbPath = (slug: string): string => `${THUMB_DIR}/${slug}.jpg`;

/** Strips the `data:image/jpeg;base64,` prefix from a canvas data URL. */
const dataUrlBase64 = (dataUrl: string): string => dataUrl.slice(dataUrl.indexOf(",") + 1);

export type ReviewDetails = Partial<
  Omit<ClaudeReview, "slug" | "file" | "uploadedAt" | "size" | "thumb">
>;

export interface PublishReviewInput {
  html: string;
  slug: string;
  title?: string;
  details?: ReviewDetails;
  /** JPEG data URL of the preview image. */
  thumbDataUrl?: string;
  manifest?: ReviewManifest;
}

/**
 * Publishes (or replaces) an audit: the HTML, the `/<slug>` redirect stub, an
 * optional preview image and the manifest. Replacing keeps the audit's place
 * in the custom order and its existing details unless new ones are given.
 */
export const publishReview = async ({
  html,
  slug,
  title,
  details = {},
  thumbDataUrl,
  manifest,
}: PublishReviewInput): Promise<{ review: ClaudeReview; manifest: ReviewManifest }> => {
  const validationError = slugValidationError(slug);
  if (validationError) throw new Error(validationError);
  if (!html.trim()) throw new Error("The HTML file is empty.");

  const current = manifest ?? (await loadRepoManifestData());
  const previous = current.reviews.find((item) => item.slug === slug);
  const now = new Date().toISOString();

  const review: ClaudeReview = {
    ...previous,
    ...details,
    slug,
    title: (title || details.title || previous?.title || slug).trim(),
    file: `${slug}.html`,
    uploadedAt: previous?.uploadedAt ?? now,
    updatedAt: now,
    size: new Blob([html]).size,
  };

  await writeRepoFile(`public/${review.file}`, html, `Publish audit: ${slug}`);
  await writeRepoFile(`public/${slug}/index.html`, redirectStub(slug, review.title), `Add /${slug} redirect for audit`);

  if (thumbDataUrl) {
    await writeRepoBase64(`public/${thumbPath(slug)}`, dataUrlBase64(thumbDataUrl), `Add preview image for audit: ${slug}`);
    review.thumb = thumbPath(slug);
  }

  const aliases = { ...current.aliases };
  delete aliases[slug];
  const next: ReviewManifest = {
    reviews: previous
      ? current.reviews.map((item) => (item.slug === slug ? review : item))
      : [review, ...current.reviews],
    aliases,
  };
  await saveManifest(next, `Update audit manifest (${slug})`);

  return { review, manifest: next };
};

export interface RenameReviewInput {
  from: string;
  to: string;
  manifest: ReviewManifest;
}

/**
 * Moves an audit to a new link name. The old link keeps working: its redirect
 * stub now points at the new file and the manifest remembers the alias.
 */
export const renameReview = async ({ from, to, manifest }: RenameReviewInput): Promise<ReviewManifest> => {
  const validationError = slugValidationError(to);
  if (validationError) throw new Error(validationError);
  const review = manifest.reviews.find((item) => item.slug === from);
  if (!review) throw new Error("That audit no longer exists.");
  if (from === to) return manifest;

  let html: string | null = null;
  const remote = await readRepoRawResponse(`public/${review.file}`).catch(() => null);
  if (remote) html = await remote.text();
  if (html === null) {
    const response = await fetch(`/${review.file}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not read ${review.file} to move it.`);
    html = await response.text();
  }

  const moved: ClaudeReview = { ...review, slug: to, file: `${to}.html`, updatedAt: new Date().toISOString() };

  await writeRepoFile(`public/${moved.file}`, html, `Move audit: ${from} -> ${to}`);
  await writeRepoFile(`public/${to}/index.html`, redirectStub(to, moved.title), `Add /${to} redirect for audit`);
  // The old /<from> stub now forwards to the new file.
  await writeRepoFile(`public/${from}/index.html`, redirectStub(to, moved.title), `Forward /${from} to /${to}`);
  await deleteRepoFile(`public/${review.file}`, `Remove old audit file: ${from}`);

  if (review.thumb) {
    const image = await readRepoRawResponse(`public/${review.thumb}`).catch(() => null);
    if (image) {
      const content = bytesToBase64(new Uint8Array(await image.arrayBuffer()));
      await writeRepoBase64(`public/${thumbPath(to)}`, content, `Move preview image: ${from} -> ${to}`);
      await deleteRepoFile(`public/${review.thumb}`, `Remove old preview image: ${from}`);
      moved.thumb = thumbPath(to);
    } else {
      delete moved.thumb;
    }
  }

  const aliases = { ...manifest.aliases, [from]: to };
  for (const key of Object.keys(aliases)) if (aliases[key] === from) aliases[key] = to;
  delete aliases[to];

  const next: ReviewManifest = {
    reviews: manifest.reviews.map((item) => (item.slug === from ? moved : item)),
    aliases,
  };
  await saveManifest(next, `Update audit manifest (${from} -> ${to})`);
  return next;
};

export interface DeleteReviewInput {
  slug: string;
  manifest?: ReviewManifest;
}

export const deleteReview = async ({ slug, manifest }: DeleteReviewInput): Promise<ReviewManifest> => {
  const current = manifest ?? (await loadRepoManifestData());
  const review = current.reviews.find((item) => item.slug === slug);

  if (review) {
    await deleteRepoFile(`public/${review.file}`, `Remove audit: ${slug}`);
    await deleteRepoFile(`public/${review.slug}/index.html`, `Remove /${review.slug} redirect for audit`);
    if (review.thumb) await deleteRepoFile(`public/${review.thumb}`, `Remove preview image: ${slug}`);
  }

  // Old link names that forwarded here stop working too.
  const aliases: Record<string, string> = {};
  for (const [from, to] of Object.entries(current.aliases)) {
    if (to === slug) await deleteRepoFile(`public/${from}/index.html`, `Remove /${from} forward`);
    else aliases[from] = to;
  }

  const next: ReviewManifest = { reviews: current.reviews.filter((item) => item.slug !== slug), aliases };
  await saveManifest(next, `Update audit manifest (removed ${slug})`);
  return next;
};
