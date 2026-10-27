/**
 * Claude Review publishing helpers.
 *
 * The app is a static Vite SPA, so an uploaded HTML file cannot be stored on a
 * server. Instead a review is published straight into this repository through
 * the GitHub Contents API (public/<slug>.html) together with a small manifest
 * (public/claude-reviews.json). The host then serves it to clients at
 * `/<slug>` (resolved by the ReviewView route) and `/<slug>.html`.
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

/** Reviews in their custom order, plus old link names that forward to new ones. */
export interface ReviewManifest {
  reviews: ClaudeReview[];
  aliases: Record<string, string>;
}

export interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
}

/**
 * Nothing is hardcoded on purpose: the publish target is entered once in the
 * browser (localStorage) so the owner/repository names never appear in the
 * public JavaScript bundle or on screen.
 */
export const DEFAULT_REPO: RepoConfig = {
  owner: "",
  repo: "",
  branch: "main",
};

export const isRepoConfigured = (config: RepoConfig): boolean =>
  Boolean(config.owner.trim() && config.repo.trim() && config.branch.trim());

/** Manifest is committed next to the reviews inside `public/`. */
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
  "index",
  "assets",
  "api",
  "claude-reviews",
  THUMB_DIR,
];

const CONFIG_KEY = "claude-review-repo-config";
const TOKEN_KEY = "claude-review-github-token";

/**
 * Optional build-time fallback token. `VITE_*` variables are inlined into the
 * JavaScript bundle, so this value is PUBLIC: anyone can read it from the
 * deployed site. It only exists for throwaway internal setups — a token typed
 * into the browser (localStorage, set through the "Connect" prompt) always wins
 * and is the recommended path.
 */
const ENV_TOKEN = ((import.meta.env.VITE_GITHUB_TOKEN as string | undefined) ?? "").trim();

export type TokenSource = "browser" | "env" | "none";

const storedToken = (): string => localStorage.getItem(TOKEN_KEY)?.trim() ?? "";

export const MAX_REVIEW_BYTES = 15 * 1024 * 1024; // 15 MB

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
/* Local settings (browser only)                                              */
/* -------------------------------------------------------------------------- */

export const getRepoConfig = (): RepoConfig => {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...DEFAULT_REPO, ...(JSON.parse(raw) as Partial<RepoConfig>) };
  } catch {
    /* ignore malformed values */
  }
  return { ...DEFAULT_REPO };
};

export const saveRepoConfig = (config: RepoConfig): void => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
};

export const getToken = (): string => storedToken() || ENV_TOKEN;

export const tokenSource = (): TokenSource => {
  if (storedToken()) return "browser";
  if (ENV_TOKEN) return "env";
  return "none";
};

export const saveToken = (token: string): void => {
  const trimmed = token.trim();
  if (trimmed) localStorage.setItem(TOKEN_KEY, trimmed);
  else localStorage.removeItem(TOKEN_KEY);
};

/* -------------------------------------------------------------------------- */
/* GitHub Contents API                                                        */
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

const contentsUrl = (config: RepoConfig, path: string): string =>
  `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

const githubHeaders = (token?: string): Record<string, string> => ({
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const apiError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const data = (await response.json()) as { message?: string };
    if (data?.message) return `${fallback}: ${data.message} (HTTP ${response.status})`;
  } catch {
    /* body was not JSON */
  }
  if (response.status === 401) return `${fallback}: the GitHub token was rejected.`;
  if (response.status === 403) return `${fallback}: the GitHub token is missing write access.`;
  if (response.status === 404) return `${fallback}: repository or path not found.`;
  return `${fallback} (HTTP ${response.status})`;
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
<p>Opening the review… <a href="../${slug}.html">Continue to ${safeTitle}</a></p>
<script>window.location.replace("../${slug}.html");</script>
</body>
</html>
`;
};

export const readRepoFile = async (
  path: string,
  config: RepoConfig = getRepoConfig(),
  token: string = getToken(),
): Promise<RemoteFile | null> => {
  const response = await fetch(
    `${contentsUrl(config, path)}?ref=${encodeURIComponent(config.branch)}`,
    { headers: githubHeaders(token) },
  );

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await apiError(response, `Could not read ${path}`));

  // GitHub inlines `content` for files up to 1 MB. Bigger files come back with
  // `encoding: "none"`, but the `sha` is always present and that is all the
  // write/delete calls below need.
  const data = (await response.json()) as { sha: string; content?: string };
  return { sha: data.sha, text: data.content ? base64Decode(data.content) : "" };
};

/** Reads a file's raw bytes, including files over 1 MB. */
const readRepoRawResponse = async (
  path: string,
  config: RepoConfig,
  token: string,
): Promise<Response | null> => {
  const response = await fetch(
    `${contentsUrl(config, path)}?ref=${encodeURIComponent(config.branch)}`,
    { headers: { ...githubHeaders(token), Accept: "application/vnd.github.raw+json" } },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await apiError(response, `Could not read ${path}`));
  return response;
};

/** Writes content that is already base64 encoded (used for preview images). */
export const writeRepoBase64 = async (
  path: string,
  content: string,
  message: string,
  config: RepoConfig = getRepoConfig(),
  token: string = getToken(),
): Promise<void> => {
  if (!token) {
    throw new Error("Add a GitHub token with Contents read & write access first.");
  }

  const existing = await readRepoFile(path, config, token);

  const response = await fetch(contentsUrl(config, path), {
    method: "PUT",
    headers: { ...githubHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content,
      branch: config.branch,
      ...(existing ? { sha: existing.sha } : {}),
    }),
  });

  if (!response.ok) throw new Error(await apiError(response, `Could not publish ${path}`));
};

export const writeRepoFile = async (
  path: string,
  text: string,
  message: string,
  config: RepoConfig = getRepoConfig(),
  token: string = getToken(),
): Promise<void> => writeRepoBase64(path, base64Encode(text), message, config, token);

export const deleteRepoFile = async (
  path: string,
  message: string,
  config: RepoConfig = getRepoConfig(),
  token: string = getToken(),
): Promise<void> => {
  if (!token) {
    throw new Error("Add a GitHub token with Contents read & write access first.");
  }

  const existing = await readRepoFile(path, config, token);
  if (!existing) return;

  const response = await fetch(contentsUrl(config, path), {
    method: "DELETE",
    headers: { ...githubHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha: existing.sha, branch: config.branch }),
  });

  if (!response.ok) throw new Error(await apiError(response, `Could not delete ${path}`));
};

/* -------------------------------------------------------------------------- */
/* Manifest (the list of published reviews)                                   */
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

/** Reads the manifest straight from the repository (always up to date). */
export const loadRepoManifestData = async (
  config: RepoConfig = getRepoConfig(),
  token: string = getToken(),
): Promise<ReviewManifest> => {
  try {
    if (isRepoConfigured(config)) {
      const remote = await readRepoFile(MANIFEST_REPO_PATH, config, token);
      if (remote) return parseManifestData(remote.text);
    }
  } catch {
    /* fall back to the deployed copy below */
  }
  return loadPublishedManifestData();
};

export const loadRepoManifest = async (
  config: RepoConfig = getRepoConfig(),
  token: string = getToken(),
): Promise<ClaudeReview[]> => (await loadRepoManifestData(config, token)).reviews;

export const saveManifest = async (
  manifest: ReviewManifest,
  message: string,
  config: RepoConfig = getRepoConfig(),
  token: string = getToken(),
): Promise<void> => {
  const payload = `${JSON.stringify(
    { reviews: manifest.reviews, aliases: manifest.aliases },
    null,
    2,
  )}\n`;
  await writeRepoFile(MANIFEST_REPO_PATH, payload, message, config, token);
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
  config?: RepoConfig;
  token?: string;
  manifest?: ReviewManifest;
}

/**
 * Publishes (or replaces) a review: the HTML, the `/<slug>` redirect stub, an
 * optional preview image and the manifest. Replacing keeps the review's place
 * in the custom order and its existing details unless new ones are given.
 */
export const publishReview = async ({
  html,
  slug,
  title,
  details = {},
  thumbDataUrl,
  config = getRepoConfig(),
  token = getToken(),
  manifest,
}: PublishReviewInput): Promise<{ review: ClaudeReview; manifest: ReviewManifest }> => {
  const validationError = slugValidationError(slug);
  if (validationError) throw new Error(validationError);
  if (!html.trim()) throw new Error("The HTML file is empty.");

  const current = manifest ?? (await loadRepoManifestData(config, token));
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

  await writeRepoFile(
    `public/${review.file}`,
    html,
    `Publish Claude review: ${slug}`,
    config,
    token,
  );

  await writeRepoFile(
    `public/${slug}/index.html`,
    redirectStub(slug, review.title),
    `Add /${slug} redirect for Claude review`,
    config,
    token,
  );

  if (thumbDataUrl) {
    await writeRepoBase64(
      `public/${thumbPath(slug)}`,
      dataUrlBase64(thumbDataUrl),
      `Add preview image for Claude review: ${slug}`,
      config,
      token,
    );
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
  await saveManifest(next, `Update Claude review manifest (${slug})`, config, token);

  return { review, manifest: next };
};

export interface RenameReviewInput {
  from: string;
  to: string;
  config?: RepoConfig;
  token?: string;
  manifest: ReviewManifest;
}

/**
 * Moves a review to a new link name. The old link keeps working: its redirect
 * stub now points at the new file and the manifest remembers the alias.
 */
export const renameReview = async ({
  from,
  to,
  config = getRepoConfig(),
  token = getToken(),
  manifest,
}: RenameReviewInput): Promise<ReviewManifest> => {
  const validationError = slugValidationError(to);
  if (validationError) throw new Error(validationError);
  const review = manifest.reviews.find((item) => item.slug === from);
  if (!review) throw new Error("That review no longer exists.");
  if (from === to) return manifest;

  let html: string | null = null;
  const remote = await readRepoRawResponse(`public/${review.file}`, config, token).catch(() => null);
  if (remote) html = await remote.text();
  if (html === null) {
    const response = await fetch(`/${review.file}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not read ${review.file} to move it.`);
    html = await response.text();
  }

  const moved: ClaudeReview = {
    ...review,
    slug: to,
    file: `${to}.html`,
    updatedAt: new Date().toISOString(),
  };

  await writeRepoFile(`public/${moved.file}`, html, `Move Claude review: ${from} -> ${to}`, config, token);
  await writeRepoFile(
    `public/${to}/index.html`,
    redirectStub(to, moved.title),
    `Add /${to} redirect for Claude review`,
    config,
    token,
  );
  // The old /<from> stub now forwards to the new file.
  await writeRepoFile(
    `public/${from}/index.html`,
    redirectStub(to, moved.title),
    `Forward /${from} to /${to}`,
    config,
    token,
  );
  await deleteRepoFile(`public/${review.file}`, `Remove old Claude review file: ${from}`, config, token);

  if (review.thumb) {
    const image = await readRepoRawResponse(`public/${review.thumb}`, config, token).catch(() => null);
    if (image) {
      const content = bytesToBase64(new Uint8Array(await image.arrayBuffer()));
      await writeRepoBase64(`public/${thumbPath(to)}`, content, `Move preview image: ${from} -> ${to}`, config, token);
      await deleteRepoFile(`public/${review.thumb}`, `Remove old preview image: ${from}`, config, token);
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
  await saveManifest(next, `Update Claude review manifest (${from} -> ${to})`, config, token);
  return next;
};

export interface DeleteReviewInput {
  slug: string;
  config?: RepoConfig;
  token?: string;
  manifest?: ReviewManifest;
}

export const deleteReview = async ({
  slug,
  config = getRepoConfig(),
  token = getToken(),
  manifest,
}: DeleteReviewInput): Promise<ReviewManifest> => {
  const current = manifest ?? (await loadRepoManifestData(config, token));
  const review = current.reviews.find((item) => item.slug === slug);

  if (review) {
    await deleteRepoFile(
      `public/${review.file}`,
      `Remove Claude review: ${slug}`,
      config,
      token,
    );
    await deleteRepoFile(
      `public/${review.slug}/index.html`,
      `Remove /${review.slug} redirect for Claude review`,
      config,
      token,
    );
    if (review.thumb) {
      await deleteRepoFile(`public/${review.thumb}`, `Remove preview image: ${slug}`, config, token);
    }
  }

  // Old link names that forwarded here stop working too.
  const aliases: Record<string, string> = {};
  for (const [from, to] of Object.entries(current.aliases)) {
    if (to === slug) {
      await deleteRepoFile(`public/${from}/index.html`, `Remove /${from} forward`, config, token);
    } else {
      aliases[from] = to;
    }
  }

  const next: ReviewManifest = {
    reviews: current.reviews.filter((item) => item.slug !== slug),
    aliases,
  };
  await saveManifest(next, `Update Claude review manifest (removed ${slug})`, config, token);
  return next;
};
