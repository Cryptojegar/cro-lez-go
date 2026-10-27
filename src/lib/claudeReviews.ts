/**
 * Claude Review publishing helpers.
 *
 * The app is a static Vite SPA, so an uploaded HTML file cannot be stored on a
 * server. Instead a review is published straight into this repository through
 * the GitHub Contents API (public/<slug>.html) together with a small manifest
 * (public/claude-reviews.json). The host then serves it to clients at
 * `/<slug>` (resolved by the ReviewView route) and `/<slug>.html`.
 */

export interface ClaudeReview {
  slug: string;
  title: string;
  file: string;
  uploadedAt: string;
  size?: number;
}

export interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
}

export const DEFAULT_REPO: RepoConfig = {
  owner: "Cryptojegar",
  repo: "cro-lez-go",
  branch: "main",
};

/** Manifest is committed next to the reviews inside `public/`. */
export const MANIFEST_FILE = "claude-reviews.json";
export const MANIFEST_REPO_PATH = `public/${MANIFEST_FILE}`;

/** Slugs that would collide with the app's own routes. */
export const RESERVED_SLUGS = [
  "domain-checkup",
  "claude-review-upload",
  "index",
  "assets",
  "api",
  "claude-reviews",
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

const base64Encode = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

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

export const writeRepoFile = async (
  path: string,
  text: string,
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
      content: base64Encode(text),
      branch: config.branch,
      ...(existing ? { sha: existing.sha } : {}),
    }),
  });

  if (!response.ok) throw new Error(await apiError(response, `Could not publish ${path}`));
};

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

const parseManifest = (raw: string): ClaudeReview[] => {
  const parsed = JSON.parse(raw) as ClaudeReview[] | { reviews?: ClaudeReview[] };
  const list = Array.isArray(parsed) ? parsed : parsed?.reviews ?? [];
  return list
    .filter((item): item is ClaudeReview =>
      Boolean(item && typeof item.slug === "string" && typeof item.file === "string"),
    )
    .map((item) => ({ ...item, title: item.title || item.slug }))
    .sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? ""));
};

/** Reads the manifest deployed with the site (used by client-facing pages). */
export const loadPublishedManifest = async (): Promise<ClaudeReview[]> => {
  try {
    const response = await fetch(`/${MANIFEST_FILE}`, { cache: "no-store" });
    if (!response.ok) return [];
    return parseManifest(await response.text());
  } catch {
    return [];
  }
};

/** Reads the manifest straight from the repository (always up to date). */
export const loadRepoManifest = async (
  config: RepoConfig = getRepoConfig(),
  token: string = getToken(),
): Promise<ClaudeReview[]> => {
  try {
    const remote = await readRepoFile(MANIFEST_REPO_PATH, config, token);
    if (remote) return parseManifest(remote.text);
  } catch {
    /* fall back to the deployed copy below */
  }
  return loadPublishedManifest();
};

const saveManifest = async (
  reviews: ClaudeReview[],
  message: string,
  config: RepoConfig,
  token: string,
): Promise<void> => {
  const payload = `${JSON.stringify({ reviews }, null, 2)}\n`;
  await writeRepoFile(MANIFEST_REPO_PATH, payload, message, config, token);
};

export interface PublishReviewInput {
  html: string;
  slug: string;
  title?: string;
  config?: RepoConfig;
  token?: string;
  existing?: ClaudeReview[];
}

export const publishReview = async ({
  html,
  slug,
  title,
  config = getRepoConfig(),
  token = getToken(),
  existing,
}: PublishReviewInput): Promise<ClaudeReview> => {
  const validationError = slugValidationError(slug);
  if (validationError) throw new Error(validationError);
  if (!html.trim()) throw new Error("The HTML file is empty.");

  const review: ClaudeReview = {
    slug,
    title: (title || slug).trim(),
    file: `${slug}.html`,
    uploadedAt: new Date().toISOString(),
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

  const current = (existing ?? (await loadRepoManifest(config, token))).filter(
    (item) => item.slug !== slug,
  );
  await saveManifest(
    [review, ...current].sort((a, b) =>
      (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? ""),
    ),
    `Update Claude review manifest (${slug})`,
    config,
    token,
  );

  return review;
};

export interface DeleteReviewInput {
  slug: string;
  config?: RepoConfig;
  token?: string;
  existing?: ClaudeReview[];
}

export const deleteReview = async ({
  slug,
  config = getRepoConfig(),
  token = getToken(),
  existing,
}: DeleteReviewInput): Promise<void> => {
  const current = existing ?? (await loadRepoManifest(config, token));
  const review = current.find((item) => item.slug === slug);

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
  }

  await saveManifest(
    current.filter((item) => item.slug !== slug),
    `Update Claude review manifest (removed ${slug})`,
    config,
    token,
  );
};
