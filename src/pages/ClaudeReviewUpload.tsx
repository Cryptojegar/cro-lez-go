import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { SiteTabs } from "@/components/layout/SiteTabs";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Flag,
  GripVertical,
  KeyRound,
  LayoutGrid,
  Link2,
  List,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sun,
  Trash2,
  Type,
  Upload,
  X,
} from "lucide-react";
import type {
  ClaudeReview,
  RepoConfig,
  ReviewManifest,
  ReviewStatus,
  ReviewType,
  TokenSource,
} from "@/lib/claudeReviews";
import {
  MAX_REVIEW_BYTES,
  RESERVED_SLUGS,
  deleteReview,
  getRepoConfig,
  getToken,
  isRepoConfigured,
  loadRepoManifestData,
  publishReview,
  renameReview,
  reviewShareUrl,
  saveManifest,
  saveRepoConfig,
  saveToken,
  slugify,
  tokenSource,
} from "@/lib/claudeReviews";
import type { ReviewInfo } from "@/lib/reviewInspect";
import { inspectReview } from "@/lib/reviewInspect";
import "./ClaudeReviewUpload.css";

/* ---------- constants & helpers ---------- */
const TYPES: Record<ReviewType, string> = { cro: "CRO", seo: "SEO" };
const STATUS: Record<ReviewStatus, string> = {
  draft: "Draft",
  ready: "Ready to send",
  sent: "Sent",
  won: "Won",
  archived: "Archived",
};
const SORTS = {
  custom: "Custom order",
  new: "Newest added",
  updated: "Recently updated",
  az: "Name A–Z",
  old: "Oldest added",
} as const;
type SortKey = keyof typeof SORTS;
type View = "grid" | "list";
type Theme = "light" | "dark";

const THUMBS_KEY = "claude-review-thumbs";
const ls = {
  get: (k: string, d: string) => {
    try {
      return localStorage.getItem(k) ?? d;
    } catch {
      return d;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage full or blocked */
    }
  },
};

const typeOf = (r: ClaudeReview): ReviewType =>
  r.type ?? (/\bseo\b/i.test(`${r.title} ${r.file}`) ? "seo" : "cro");
const statusOf = (r: ClaudeReview): ReviewStatus => r.status ?? "draft";
const host = () => window.location.host;
const shortLink = (slug: string) => `${host()}/${slug}`;
const fmtDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const fmtSize = (b: number) =>
  b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
const cleanTags = (t: string | string[]) =>
  [
    ...new Set(
      (Array.isArray(t) ? t : String(t || "").split(","))
        .map((x) => String(x).trim().slice(0, 40))
        .filter(Boolean),
    ),
  ].slice(0, 12);
const statsLine = (r: ClaudeReview) => {
  const s = r.stats || {};
  const out: string[] = [];
  if (s.pages) out.push(`${s.pages} ${typeOf(r) === "seo" ? "areas" : "pages"}`);
  if (s.findings) out.push(`${s.findings} findings`);
  if (s.critical) out.push(`${s.critical} critical`);
  return out;
};
const rid = () => Math.random().toString(36).slice(2, 10);
const errText = (e: unknown) => (e instanceof Error ? e.message : "Unexpected error.");

const loadLocalThumbs = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(THUMBS_KEY) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
};

interface QueueRow {
  id: string;
  file: File;
  state: "reading" | "ready" | "uploading" | "done" | "failed";
  info?: ReviewInfo;
  name: string;
  type: ReviewType;
  slug: string;
  status: ReviewStatus;
  tags: string;
  progress: number;
  error?: string;
  result?: ClaudeReview;
}

interface ToastState {
  msg: string;
  action?: { label: string; run: () => void };
}

/* ---------- native <dialog> wrapper (stays inside .rh so the theme applies) ---------- */
function Modal({
  open,
  onClose,
  wide,
  labelledBy,
  canClose = () => true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  wide?: boolean;
  labelledBy: string;
  canClose?: () => boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`rh-dlg${wide ? " wide" : ""}`}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        if (canClose()) onClose();
      }}
    >
      {open && children}
    </dialog>
  );
}

const ClaudeReviewUpload = () => {
  /* theme: always starts light when the page opens */
  const [theme, setTheme] = useState<Theme>("light");

  /* data */
  const [manifest, setManifestState] = useState<ReviewManifest>({ reviews: [], aliases: {} });
  const manifestRef = useRef(manifest);
  const setManifest = useCallback((next: ReviewManifest) => {
    manifestRef.current = next;
    setManifestState(next);
  }, []);
  const [loading, setLoading] = useState(true);
  const [localThumbs, setLocalThumbs] = useState<Record<string, string>>(loadLocalThumbs);
  const thumbTried = useRef(new Set<string>());

  /* GitHub connection */
  const [token, setToken] = useState(() => getToken());
  const [tokenSourceState, setTokenSourceState] = useState<TokenSource>(() => tokenSource());
  const [repoConfig, setRepoConfig] = useState<RepoConfig>(() => getRepoConfig());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showTargetEditor, setShowTargetEditor] = useState(false);

  /* filters */
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [q, setQ] = useState(params.get("q") || "");
  const [cat, setCat] = useState<"all" | ReviewType>(() => {
    const c = params.get("category");
    return c === "cro" || c === "seo" ? c : "all";
  });
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewStatus>(() => {
    const s = params.get("status") as ReviewStatus | null;
    return s && s in STATUS ? s : "all";
  });
  const [tag, setTag] = useState(params.get("tag") || "");
  const [sort, setSort] = useState<SortKey>(() => {
    const s = ls.get("review-hub-sort", "custom");
    return s in SORTS ? (s as SortKey) : "custom";
  });
  const [view, setView] = useState<View>(() => (ls.get("review-hub-view", "grid") === "list" ? "list" : "grid"));

  /* selection, menus, dialogs */
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<Set<string>>(new Set());
  const deleteTimers = useRef(new Map<string, number>());
  const [menu, setMenu] = useState<{ slug: string; rect: DOMRect } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const [confirmSlugs, setConfirmSlugs] = useState<string[] | null>(null);
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [toastState, setToastState] = useState<ToastState | null>(null);
  const [toastShow, setToastShow] = useState(false);
  const toastTimer = useRef<number>();

  /* uploads */
  const [uploadOpen, setUploadOpen] = useState(false);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const [dzOn, setDzOn] = useState(false);
  const [dropOn, setDropOn] = useState(false);
  const filePick = useRef<HTMLInputElement>(null);
  const fileReplace = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /* repo writes run one at a time so manifest updates never overwrite each other */
  const writeChain = useRef<Promise<unknown>>(Promise.resolve());
  const [writing, setWriting] = useState(0);
  const enqueue = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    setWriting((n) => n + 1);
    const p = writeChain.current.then(fn);
    writeChain.current = p.catch(() => undefined);
    return p.finally(() => setWriting((n) => n - 1));
  }, []);

  const toast = useCallback((msg: string, action?: ToastState["action"]) => {
    setToastState({ msg, action });
    setToastShow(true);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastShow(false), action ? 6500 : 3200);
  }, []);

  /* ---------- page setup: font, body colour ---------- */
  useEffect(() => {
    const id = "rh-manrope";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap";
      document.head.appendChild(link);
    }
  }, []);
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = theme === "dark" ? "#161515" : "#F8F9FA";
    return () => {
      document.body.style.background = prev;
    };
  }, [theme]);

  /* ---------- load ---------- */
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setManifest(await loadRepoManifestData());
    } finally {
      setLoading(false);
    }
  }, [setManifest]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  /* previews for reviews published without one (for example older reviews) — kept in this browser */
  useEffect(() => {
    if (loading) return;
    const todo = manifest.reviews
      .filter((r) => !r.thumb && !localThumbs[r.slug] && !thumbTried.current.has(r.slug))
      .slice(0, 4);
    if (!todo.length) return;
    let active = true;
    (async () => {
      for (const r of todo) {
        thumbTried.current.add(r.slug);
        try {
          const res = await fetch(`/${r.file}`);
          if (!res.ok) continue;
          const info = await inspectReview(await res.text(), r.origName || r.file);
          if (!active || !info.thumb) continue;
          setLocalThumbs((cur) => {
            const next = { ...cur, [r.slug]: info.thumb };
            ls.set(THUMBS_KEY, JSON.stringify(next));
            return next;
          });
        } catch {
          /* try again next time */
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [loading, manifest.reviews, localThumbs]);

  const rememberThumb = (slug: string, dataUrl: string) => {
    setLocalThumbs((cur) => {
      const next = { ...cur, [slug]: dataUrl };
      ls.set(THUMBS_KEY, JSON.stringify(next));
      return next;
    });
  };

  /* keep filters in the address bar */
  useEffect(() => {
    const p = new URLSearchParams();
    if (cat !== "all") p.set("category", cat);
    if (q) p.set("q", q);
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (tag) p.set("tag", tag);
    window.history.replaceState(null, "", window.location.pathname + (p.toString() ? `?${p}` : ""));
  }, [cat, q, statusFilter, tag]);

  /* warn before leaving while GitHub is still being updated */
  useEffect(() => {
    const busy = writing > 0 || pendingDelete.size > 0;
    if (!busy) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [writing, pendingDelete]);

  /* ---------- GitHub connection ---------- */
  const connectToken = (): string => {
    const entered = window.prompt(
      "Paste your GitHub token (fine-grained, Contents: Read and write).\nIt is stored in this browser only and is never displayed again.",
    );
    if (entered === null) return "";
    const trimmed = entered.trim();
    if (!trimmed) {
      toast("Nothing saved — no token was entered.");
      return "";
    }
    saveToken(trimmed);
    setToken(trimmed);
    setTokenSourceState(tokenSource());
    toast("GitHub connected. The token is stored in this browser only.");
    void refresh();
    return trimmed;
  };

  const forgetToken = () => {
    saveToken("");
    setToken(getToken());
    setTokenSourceState(tokenSource());
    toast("Token forgotten. Publishing and editing stay off until you connect again.");
  };

  const updateRepoConfig = (patch: Partial<RepoConfig>) => {
    setRepoConfig((current) => {
      const next = { ...current, ...patch };
      saveRepoConfig(next);
      return next;
    });
  };

  /** Returns the token to use, or "" when the target or the token is missing. */
  const ensureReady = (): string => {
    if (!isRepoConfigured(repoConfig)) {
      setSettingsOpen(true);
      setShowTargetEditor(true);
      toast("Set the publish target once — it stays in this browser and is never shown again.");
      return "";
    }
    if (token.trim()) return token.trim();
    const t = connectToken();
    if (!t) toast("Connect GitHub first: changes are saved into the site repository.");
    return t;
  };

  /** Saves the manifest as it is when this write runs; reloads from GitHub if it fails. */
  const persist = (next: ReviewManifest, message: string, okMsg?: string) => {
    const t = ensureReady();
    if (!t) return;
    setManifest(next);
    enqueue(() => saveManifest(manifestRef.current, message, repoConfig, t))
      .then(() => okMsg && toast(okMsg))
      .catch((e) => {
        toast(`Couldn't save: ${errText(e)}`);
        void refresh();
      });
  };

  /* ---------- derived lists ---------- */
  const reviews = manifest.reviews;
  const live = useMemo(() => reviews.filter((r) => !pendingDelete.has(r.slug)), [reviews, pendingDelete]);
  const counts = useMemo(() => {
    const c = { all: live.length, cro: 0, seo: 0 };
    live.forEach((r) => c[typeOf(r)]++);
    return c;
  }, [live]);
  const inCat = useMemo(() => live.filter((r) => cat === "all" || typeOf(r) === cat), [live, cat]);
  const statusCounts = useMemo(() => {
    const sc: Record<string, number> = { all: inCat.length };
    (Object.keys(STATUS) as ReviewStatus[]).forEach((k) => (sc[k] = inCat.filter((r) => statusOf(r) === k).length));
    return sc;
  }, [inCat]);
  const tags = useMemo(
    () => [...new Set(inCat.flatMap((r) => r.tags || []))].sort((a, b) => a.localeCompare(b)),
    [inCat],
  );
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = inCat.filter(
      (r) =>
        (statusFilter === "all" || statusOf(r) === statusFilter) &&
        (!tag || (r.tags || []).includes(tag)) &&
        (!needle ||
          [r.title, r.brand, r.domain, r.slug, r.notes, ...(r.tags || []), TYPES[typeOf(r)], STATUS[statusOf(r)]]
            .join(" ")
            .toLowerCase()
            .includes(needle)),
    );
    const created = (r: ClaudeReview) => r.uploadedAt || "";
    const updated = (r: ClaudeReview) => r.updatedAt || r.uploadedAt || "";
    const by: Partial<Record<SortKey, (a: ClaudeReview, b: ClaudeReview) => number>> = {
      new: (a, b) => created(b).localeCompare(created(a)),
      old: (a, b) => created(a).localeCompare(created(b)),
      updated: (a, b) => updated(b).localeCompare(updated(a)),
      az: (a, b) => a.title.localeCompare(b.title),
    };
    const fn = by[sort];
    if (fn) list = [...list].sort(fn);
    return list;
  }, [inCat, q, statusFilter, tag, sort]);
  const canDrag = sort === "custom" && !selecting;
  const bySlug = (slug: string) => manifestRef.current.reviews.find((r) => r.slug === slug);
  const title = cat === "all" ? "All reviews" : `${TYPES[cat]} reviews`;

  /* ---------- slugs ---------- */
  const uniqueSlug = (wanted: string, exceptSlug?: string, alsoTaken: Set<string> = new Set()) => {
    let base = slugify(wanted) || "review";
    if (RESERVED_SLUGS.includes(base)) base += "-review";
    const { reviews: list, aliases } = manifestRef.current;
    const taken = (s: string) =>
      alsoTaken.has(s) ||
      list.some((r) => r.slug === s && r.slug !== exceptSlug) ||
      (aliases[s] !== undefined && aliases[s] !== exceptSlug);
    let s = base;
    let n = 2;
    while (taken(s)) s = `${base}-${n++}`;
    return s;
  };

  /* ---------- actions ---------- */
  const copyLink = async (slug?: string) => {
    if (!slug) return;
    const url = reviewShareUrl(slug);
    try {
      await navigator.clipboard.writeText(url);
      toast(`Link copied: ${shortLink(slug)}`);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };

  const quickUpdate = (slug: string, changes: Partial<ClaudeReview>, msg?: string) => {
    const now = new Date().toISOString();
    const next = {
      ...manifestRef.current,
      reviews: manifestRef.current.reviews.map((r) => (r.slug === slug ? { ...r, ...changes, updatedAt: now } : r)),
    };
    persist(next, `Update Claude review: ${slug}`, msg);
  };

  const toggleSel = (slug: string) =>
    setSel((cur) => {
      const next = new Set(cur);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  const bulkStatus = (st: ReviewStatus) => {
    const slugs = [...sel];
    const now = new Date().toISOString();
    const next = {
      ...manifestRef.current,
      reviews: manifestRef.current.reviews.map((r) => (sel.has(r.slug) ? { ...r, status: st, updatedAt: now } : r)),
    };
    persist(next, `Set ${slugs.length} Claude review(s) to ${st}`, `${slugs.length} review${slugs.length === 1 ? "" : "s"} set to "${STATUS[st]}".`);
  };

  /* delete with undo */
  const askDelete = (slugs: string[]) => {
    if (!slugs.length || !ensureReady()) return;
    setConfirmSlugs(slugs);
  };
  const commitDelete = (slug: string) => {
    deleteTimers.current.delete(slug);
    const t = token.trim();
    enqueue(() => deleteReview({ slug, config: repoConfig, token: t, manifest: manifestRef.current }))
      .then((next) => setManifest(next))
      .catch((e) => {
        toast(`Couldn't delete: ${errText(e)}`);
        void refresh();
      })
      .finally(() =>
        setPendingDelete((cur) => {
          const n = new Set(cur);
          n.delete(slug);
          return n;
        }),
      );
  };
  const doDelete = () => {
    const slugs = confirmSlugs || [];
    setConfirmSlugs(null);
    const items = slugs.map(bySlug).filter(Boolean) as ClaudeReview[];
    if (!items.length) return;
    setPendingDelete((cur) => new Set([...cur, ...items.map((i) => i.slug)]));
    items.forEach((i) => deleteTimers.current.set(i.slug, window.setTimeout(() => commitDelete(i.slug), 6500)));
    setSel(new Set());
    toast(`${items.length === 1 ? `"${items[0].title}"` : `${items.length} reviews`} deleted.`, {
      label: "Undo",
      run: () => {
        items.forEach((i) => {
          window.clearTimeout(deleteTimers.current.get(i.slug));
          deleteTimers.current.delete(i.slug);
        });
        setPendingDelete((cur) => {
          const n = new Set(cur);
          items.forEach((i) => n.delete(i.slug));
          return n;
        });
        toast("Restored.");
      },
    });
  };

  /* drag to reorder */
  const dragSlug = useRef<string | null>(null);
  const [dropMark, setDropMark] = useState<{ slug: string; after: boolean } | null>(null);
  const onDragStart = (slug: string) => (e: React.DragEvent) => {
    dragSlug.current = slug;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/x-review", slug);
  };
  const onDragEnd = () => {
    dragSlug.current = null;
    setDropMark(null);
  };
  const onDragOverItem = (slug: string) => (e: React.DragEvent) => {
    if (!dragSlug.current || dragSlug.current === slug) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const after = view === "list" ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2;
    setDropMark((cur) => (cur?.slug === slug && cur.after === after ? cur : { slug, after }));
  };
  const onDropItem = (slug: string) => (e: React.DragEvent) => {
    const moving = dragSlug.current;
    if (!moving) return;
    e.preventDefault();
    e.stopPropagation();
    const after = dropMark?.slug === slug ? dropMark.after : false;
    onDragEnd();
    const ids = visible.map((r) => r.slug).filter((s) => s !== moving);
    ids.splice(ids.indexOf(slug) + (after ? 1 : 0), 0, moving);
    const pos = new Map(ids.map((s, k) => [s, k]));
    const all = manifestRef.current.reviews;
    const moved = all.filter((r) => pos.has(r.slug)).sort((a, b) => (pos.get(a.slug) ?? 0) - (pos.get(b.slug) ?? 0));
    let k = 0;
    const next = { ...manifestRef.current, reviews: all.map((r) => (pos.has(r.slug) ? moved[k++] : r)) };
    persist(next, "Reorder Claude reviews", "Order saved.");
  };

  /* inline rename */
  const finishRename = (slug: string, el: HTMLElement, save: boolean) => {
    setRenaming(null);
    const r = bySlug(slug);
    const v = el.textContent?.trim() || "";
    if (r && save && v && v !== r.title) quickUpdate(slug, { title: v }, "Renamed.");
    else if (r) el.textContent = r.title;
  };

  /* replace a file */
  const pickReplace = (slug: string) => {
    replaceTarget.current = slug;
    if (fileReplace.current) {
      fileReplace.current.value = "";
      fileReplace.current.click();
    }
  };
  const onReplaceFile = async (file?: File) => {
    const slug = replaceTarget.current;
    if (!file || !slug) return;
    if (!/\.html?$/i.test(file.name)) return toast("Please choose an .html file.");
    if (file.size > MAX_REVIEW_BYTES) return toast(`Keep reviews under ${fmtSize(MAX_REVIEW_BYTES)}.`);
    const t = ensureReady();
    if (!t) return;
    toast("Uploading the new file…");
    try {
      const html = await file.text();
      const info = await inspectReview(html, file.name);
      const { manifest: next } = await enqueue(() =>
        publishReview({
          html,
          slug,
          details: { origName: file.name, ...(info.known ? { stats: info.stats } : {}) },
          thumbDataUrl: info.thumb || undefined,
          config: repoConfig,
          token: t,
          manifest: manifestRef.current,
        }),
      );
      setManifest(next);
      if (info.thumb) rememberThumb(slug, info.thumb);
      toast("File replaced. The link stays the same.");
    } catch (e) {
      toast(`Couldn't replace the file: ${errText(e)}`);
    }
  };

  /* ---------- uploads ---------- */
  const openUpload = (files: File[] = []) => {
    if (!uploadOpen) {
      setQueue([]);
      setUploadOpen(true);
    }
    if (files.length) void addToQueue(files);
  };
  const patchRow = (id: string, patch: Partial<QueueRow>) =>
    setQueue((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addToQueue = async (files: File[]) => {
    for (const file of files) {
      if (!/\.html?$/i.test(file.name)) {
        toast(`${file.name} isn't an HTML file, so it was skipped.`);
        continue;
      }
      if (file.size > MAX_REVIEW_BYTES) {
        toast(`${file.name} is over ${fmtSize(MAX_REVIEW_BYTES)}, so it was skipped.`);
        continue;
      }
      const row: QueueRow = {
        id: rid(),
        file,
        state: "reading",
        name: "",
        type: "cro",
        slug: "",
        status: "draft",
        tags: "",
        progress: 0,
      };
      setQueue((cur) => [...cur, row]);
      try {
        const text = await file.text();
        if (!/<!doctype html|<html|<body/i.test(text)) throw new Error("not html");
        const info = await inspectReview(text, file.name);
        const taken = new Set(queueRef.current.filter((r) => r.id !== row.id && r.slug).map((r) => r.slug));
        const guessType = info.type || (cat !== "all" ? cat : "cro");
        // The file name becomes the link name (oramune.html → /oramune), as before.
        const wanted = slugify(file.name) || slugify(info.brand);
        patchRow(row.id, {
          info,
          name: info.name,
          type: guessType,
          slug: taken.has(wanted) ? uniqueSlug(wanted, undefined, taken) : wanted,
          state: "ready",
        });
      } catch {
        patchRow(row.id, { state: "failed", error: "Couldn't read this file. Is it a standalone HTML page?" });
      }
    }
  };
  const previewRow = (row: QueueRow) => {
    const url = URL.createObjectURL(row.file);
    window.open(url, "_blank", "noopener");
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  const runUploads = async () => {
    const rows = queueRef.current.filter((r) => r.state === "ready" || (r.state === "failed" && r.info));
    if (!rows.length) return;
    const t = ensureReady();
    if (!t) return;
    let done = 0;
    for (const row of rows) {
      const slug = slugify(row.slug);
      const bad = !slug ? "Add a link name." : RESERVED_SLUGS.includes(slug) ? `"${slug}" is reserved by the app.` : "";
      if (bad) {
        patchRow(row.id, { state: "failed", error: bad });
        continue;
      }
      patchRow(row.id, { state: "uploading", progress: 0.15, error: undefined });
      try {
        const html = await row.file.text();
        patchRow(row.id, { progress: 0.45 });
        const info = row.info as ReviewInfo;
        const { review, manifest: next } = await enqueue(() =>
          publishReview({
            html,
            slug,
            title: row.name || info.name,
            details: {
              brand: info.brand,
              domain: info.domain,
              date: info.date,
              type: row.type,
              status: row.status,
              tags: cleanTags(row.tags),
              stats: info.stats,
              origName: row.file.name,
            },
            thumbDataUrl: info.thumb || undefined,
            config: repoConfig,
            token: t,
            manifest: manifestRef.current,
          }),
        );
        setManifest(next);
        if (info.thumb) rememberThumb(slug, info.thumb);
        patchRow(row.id, { state: "done", progress: 1, result: review });
        done++;
      } catch (e) {
        patchRow(row.id, { state: "failed", progress: 1, error: `Upload failed: ${errText(e)} Click Upload to try again.` });
      }
    }
    if (done) toast(`${done} review${done === 1 ? "" : "s"} published. Links go live once the site redeploys.`);
  };
  const uploading = queue.some((r) => r.state === "uploading");
  const readyCount = queue.filter((r) => r.state === "ready" || (r.state === "failed" && r.info)).length;

  /* drop files anywhere on the page */
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Boolean(e.dataTransfer && [...e.dataTransfer.types].includes("Files"));
    const enter = (e: DragEvent) => {
      if (!hasFiles(e) || uploadOpen) return;
      depth++;
      setDropOn(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDropOn(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDropOn(false);
      if (!uploadOpen && e.dataTransfer) openUpload([...e.dataTransfer.files]);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  });

  /* "/" focuses search, Escape closes the menu */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
      const el = document.activeElement as HTMLElement | null;
      if (e.key === "/" && el && !/input|textarea|select/i.test(el.tagName) && !el.isContentEditable && !document.querySelector("dialog[open]")) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    const onScroll = () => setMenu(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menu]);
  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return setMenuPos(null);
    const r = menu.rect, mw = menuRef.current.offsetWidth, mh = menuRef.current.offsetHeight;
    setMenuPos({
      left: Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw)),
      top: r.bottom + mh + 8 > window.innerHeight ? Math.max(8, r.top - mh - 6) : r.bottom + 6,
    });
  }, [menu]);

  /* ---------- render pieces ---------- */
  const thumbSrc = (r: ClaudeReview) => localThumbs[r.slug] || (r.thumb ? `/${r.thumb}` : "");
  const renderThumb = (r: ClaudeReview) => {
    const src = thumbSrc(r);
    return (
      <>
        <div className={`rh-fallback ${typeOf(r)}`}>
          <b>{(r.brand || r.title).charAt(0)}</b>
        </div>
        {src && (
          <img
            className="shot"
            src={src}
            alt=""
            loading="lazy"
            onError={(e) => e.currentTarget.remove()}
          />
        )}
      </>
    );
  };
  const renderName = (r: ClaudeReview, Tag: "h3" | "b") => (
    <Tag
      title="Double-click to rename"
      contentEditable={renaming === r.slug}
      suppressContentEditableWarning
      ref={(el: HTMLElement | null) => {
        if (el && renaming === r.slug && document.activeElement !== el) {
          el.focus();
          const range = document.createRange();
          range.selectNodeContents(el);
          const s = window.getSelection();
          s?.removeAllRanges();
          s?.addRange(range);
        }
      }}
      onDoubleClick={() => setRenaming(r.slug)}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (renaming !== r.slug) return;
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          finishRename(r.slug, e.currentTarget, true);
        }
        if (e.key === "Escape") {
          e.preventDefault();
          finishRename(r.slug, e.currentTarget, false);
        }
      }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => renaming === r.slug && finishRename(r.slug, e.currentTarget, true)}
    >
      {r.title}
    </Tag>
  );
  const dragProps = (slug: string) =>
    canDrag
      ? {
          draggable: true,
          onDragStart: onDragStart(slug),
          onDragEnd,
          onDragOver: onDragOverItem(slug),
          onDrop: onDropItem(slug),
        }
      : {};
  const dropClass = (slug: string) =>
    dropMark?.slug === slug ? (dropMark.after ? " drop-after" : " drop-before") : "";
  const openMenu = (slug: string) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu((cur) => (cur?.slug === slug ? null : { slug, rect }));
  };

  const results = () => {
    if (loading) return <div className="rh-spin" aria-label="Loading" />;
    if (!live.length)
      return (
        <div className="rh-empty">
          <div className="ic">
            <Upload />
          </div>
          <h2>No reviews yet</h2>
          <p>
            Drag and drop Claude review HTML files here, or click below. Each one gets its own link, like{" "}
            <b>{host()}/brand-name</b>.
          </p>
          <button className="rh-btn rh-btn-primary" onClick={() => openUpload()}>
            <Plus /> Add your first review
          </button>
        </div>
      );
    if (!visible.length)
      return (
        <div className="rh-empty">
          <div className="ic">
            <Search />
          </div>
          <h2>No reviews match</h2>
          <p>Try a different search or clear the filters.</p>
          <button
            className="rh-btn rh-btn-secondary"
            onClick={() => {
              setQ("");
              setStatusFilter("all");
              setTag("");
            }}
          >
            Clear filters
          </button>
        </div>
      );
    if (view === "list")
      return (
        <div className="rh-card rh-tblwrap rh-list">
          <table className="rh-ltable">
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>Review</th>
                <th>Type</th>
                <th>Status</th>
                <th>Findings</th>
                <th>Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.slug} className={`${sel.has(r.slug) ? "sel-on" : ""}${dropClass(r.slug)}`} {...dragProps(r.slug)}>
                  <td>
                    {selecting ? (
                      <input
                        type="checkbox"
                        className="rh-lcheck"
                        checked={sel.has(r.slug)}
                        onChange={() => toggleSel(r.slug)}
                        aria-label={`Select ${r.title}`}
                      />
                    ) : canDrag ? (
                      <span className="rh-lhandle" title="Drag to reorder">
                        <GripVertical />
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <div className="rh-lname">
                      <span className="lg">
                        {thumbSrc(r) ? <img src={thumbSrc(r)} alt="" onError={(e) => e.currentTarget.remove()} /> : <b>{(r.brand || r.title).charAt(0)}</b>}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        {renderName(r, "b")}
                        <small>{shortLink(r.slug)}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`rh-tp rh-tp-${typeOf(r)}`}>{TYPES[typeOf(r)]}</span>
                  </td>
                  <td>
                    <span className={`rh-st s-${statusOf(r)}`}>{STATUS[statusOf(r)]}</span>
                  </td>
                  <td>{statsLine(r).slice(1).join(" · ") || "–"}</td>
                  <td>{fmtDate(r.uploadedAt)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <a className="rh-btn rh-btn-secondary rh-btn-sm" href={`/${r.slug}`} target="_blank" rel="noreferrer">
                      Open
                    </a>{" "}
                    <button className="rh-more" onClick={openMenu(r.slug)} aria-label={`More actions for ${r.title}`}>
                      <MoreHorizontal />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    return (
      <div className="rh-grid">
        {visible.map((r) => (
          <article key={r.slug} className={`rh-card rh-acard${sel.has(r.slug) ? " sel-on" : ""}${dropClass(r.slug)}`} {...dragProps(r.slug)}>
            <a
              className="rh-thumb"
              href={`/${r.slug}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${r.title}`}
              onClick={(e) => {
                if (selecting) {
                  e.preventDefault();
                  toggleSel(r.slug);
                }
              }}
            >
              {renderThumb(r)}
              <span className={`rh-tp rh-tp-${typeOf(r)}`}>{TYPES[typeOf(r)]}</span>
            </a>
            {selecting ? (
              <button className="rh-check" onClick={() => toggleSel(r.slug)} aria-label={`Select ${r.title}`} aria-pressed={sel.has(r.slug)}>
                <Check />
              </button>
            ) : canDrag ? (
              <span className="rh-handle" title="Drag to reorder" aria-hidden="true">
                <GripVertical />
              </span>
            ) : null}
            <div className="rh-ab">
              <div className="rh-arow">
                <span className={`rh-st s-${statusOf(r)}`}>{STATUS[statusOf(r)]}</span>
                <button className="rh-more" onClick={openMenu(r.slug)} aria-label={`More actions for ${r.title}`}>
                  <MoreHorizontal />
                </button>
              </div>
              {renderName(r, "h3")}
              <div className="rh-meta">
                {[r.domain, r.date || fmtDate(r.uploadedAt)].filter(Boolean).map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
              {statsLine(r).length > 0 && (
                <div className="rh-meta">
                  {statsLine(r).map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              )}
              {(r.tags || []).length > 0 && (
                <div className="rh-tags">
                  {(r.tags || []).map((t) => (
                    <span className="rh-tag" key={t}>
                      #{t}
                    </span>
                  ))}
                </div>
              )}
              <div className="rh-acts">
                <a className="rh-btn rh-btn-primary rh-btn-sm" href={`/${r.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink /> Open
                </a>
                <button className="rh-btn rh-btn-secondary rh-btn-sm" onClick={() => void copyLink(r.slug)}>
                  <Link2 /> Copy link
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    );
  };

  const menuReview = menu ? bySlug(menu.slug) : undefined;
  const editReview = editSlug ? bySlug(editSlug) : undefined;
  const confirmItems = (confirmSlugs || []).map(bySlug).filter(Boolean) as ClaudeReview[];

  return (
    <div className="rh" data-theme={theme}>
      <div className="rh-wrap">
        <div className="rh-top">
          <SiteTabs />
          <button
            className="rh-icon-btn"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </button>
        </div>

        <div className="rh-head">
          <div>
            <div className="rh-kicker">Claude Review Upload</div>
            <h1>{title}</h1>
            <p>
              {counts.all} review{counts.all === 1 ? "" : "s"} in total. Drag and drop Claude HTML files anywhere on this
              page to publish them — each file name becomes the client link.
            </p>
          </div>
          <div className="rh-head-acts">
            <button className="rh-btn rh-btn-ghost" onClick={() => void refresh()} disabled={loading} aria-label="Refresh">
              <RefreshCw /> Refresh
            </button>
            <button className="rh-btn rh-btn-secondary" onClick={() => setSettingsOpen(true)}>
              <Settings2 /> Settings
            </button>
            <button
              className="rh-btn rh-btn-secondary"
              onClick={() => {
                setSelecting((s) => !s);
                setSel(new Set());
              }}
            >
              {selecting ? "Done selecting" : "Select"}
            </button>
            <button className="rh-btn rh-btn-primary" onClick={() => filePick.current?.click()}>
              <Plus /> Add review
            </button>
          </div>
        </div>

        <div className="rh-seg" role="group" aria-label="Category">
          {(["all", "cro", "seo"] as const).map((k) => (
            <button
              key={k}
              aria-pressed={cat === k}
              onClick={() => {
                setCat(k);
                setStatusFilter("all");
                setTag("");
              }}
            >
              {k === "all" ? "All" : TYPES[k]} <span className="c">{counts[k]}</span>
            </button>
          ))}
        </div>

        <div className="rh-toolbar">
          <label className="rh-search">
            <Search />
            <input
              ref={searchRef}
              type="search"
              placeholder="Search by brand, website, link or tag…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search reviews"
            />
            <kbd>/</kbd>
          </label>
          <select className="rh-sel" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter by tag">
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select
            className="rh-sel"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortKey);
              ls.set("review-hub-sort", e.target.value);
            }}
            aria-label="Sort"
          >
            {(Object.entries(SORTS) as [SortKey, string][]).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <div className="rh-seg" role="group" aria-label="View">
            {(["grid", "list"] as View[]).map((v) => (
              <button
                key={v}
                aria-pressed={view === v}
                aria-label={v === "grid" ? "Grid view" : "List view"}
                onClick={() => {
                  setView(v);
                  ls.set("review-hub-view", v);
                }}
              >
                {v === "grid" ? <LayoutGrid /> : <List />}
              </button>
            ))}
          </div>
        </div>

        <div className="rh-chips" role="group" aria-label="Filter by status">
          <button className="rh-chip" aria-pressed={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
            All statuses <span className="c">{statusCounts.all}</span>
          </button>
          {(Object.entries(STATUS) as [ReviewStatus, string][]).map(([k, v]) => (
            <button key={k} className="rh-chip" aria-pressed={statusFilter === k} onClick={() => setStatusFilter(k)}>
              <span className={`rh-st bare s-${k}`} />
              {v} <span className="c">{statusCounts[k]}</span>
            </button>
          ))}
        </div>

        {selecting && (
          <div className="rh-bulk">
            <span>
              <b>{sel.size}</b> selected
            </span>
            <button className="rh-btn rh-btn-ghost rh-btn-sm" onClick={() => setSel(new Set(visible.map((r) => r.slug)))}>
              Select all shown
            </button>
            <span className="rh-spacer" />
            <select
              className="rh-sel"
              value=""
              disabled={!sel.size}
              onChange={(e) => e.target.value && bulkStatus(e.target.value as ReviewStatus)}
            >
              <option value="">Set status…</option>
              {(Object.entries(STATUS) as [ReviewStatus, string][]).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button className="rh-btn rh-btn-danger rh-btn-sm" disabled={!sel.size} onClick={() => askDelete([...sel])}>
              <Trash2 /> Delete
            </button>
          </div>
        )}

        <div>{results()}</div>
      </div>

      <button className="rh-fab" onClick={() => openUpload()} aria-label="Add reviews">
        <Plus />
      </button>

      <div className={`rh-drop${dropOn ? " on" : ""}`} aria-hidden="true">
        <div className="rh-drop-box">
          <Upload />
          <h2>Drop to publish reviews</h2>
          <p>Claude HTML review files. We'll create a client link for each one.</p>
        </div>
      </div>

      <input
        ref={filePick}
        type="file"
        accept=".html,.htm,text/html"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) openUpload([...e.target.files]);
          e.target.value = "";
        }}
      />
      <input ref={fileReplace} type="file" accept=".html,.htm,text/html" hidden onChange={(e) => void onReplaceFile(e.target.files?.[0])} />

      {/* actions menu */}
      {menu && menuReview && (
        <div
          ref={menuRef}
          className="rh-menu"
          role="menu"
          style={menuPos ? { left: menuPos.left, top: menuPos.top } : { left: -9999, top: 0 }}
        >
          <a href={`/${menuReview.slug}`} target="_blank" rel="noreferrer" role="menuitem" onClick={() => setMenu(null)}>
            <ExternalLink /> Open review
          </a>
          <button role="menuitem" onClick={() => (setMenu(null), void copyLink(menuReview.slug))}>
            <Link2 /> Copy link
          </button>
          <button role="menuitem" onClick={() => (setMenu(null), setRenaming(menuReview.slug))}>
            <Type /> Rename
          </button>
          <button role="menuitem" onClick={() => (setMenu(null), setEditSlug(menuReview.slug))}>
            <Pencil /> Edit details &amp; link
          </button>
          <button role="menuitem" onClick={() => (setMenu(null), pickReplace(menuReview.slug))}>
            <Upload /> Replace file
          </button>
          <a href={`/${menuReview.file}`} download={menuReview.file} role="menuitem" onClick={() => setMenu(null)}>
            <Download /> Download HTML
          </a>
          <hr />
          <div className="lbl">Status</div>
          {(Object.entries(STATUS) as [ReviewStatus, string][]).map(([k, v]) => (
            <button
              key={k}
              role="menuitemradio"
              aria-checked={statusOf(menuReview) === k}
              onClick={() => {
                setMenu(null);
                quickUpdate(menuReview.slug, { status: k }, `Status set to "${v}".`);
              }}
            >
              <span className={`rh-st bare s-${k}`} />
              {v}
              {statusOf(menuReview) === k ? " ✓" : ""}
            </button>
          ))}
          <div className="lbl">Move to</div>
          <button
            role="menuitem"
            onClick={() => {
              setMenu(null);
              const to: ReviewType = typeOf(menuReview) === "cro" ? "seo" : "cro";
              quickUpdate(menuReview.slug, { type: to }, `Moved to ${TYPES[to]} reviews.`);
            }}
          >
            <Flag /> {typeOf(menuReview) === "cro" ? "SEO reviews" : "CRO reviews"}
          </button>
          <hr />
          <button role="menuitem" className="danger" onClick={() => (setMenu(null), askDelete([menuReview.slug]))}>
            <Trash2 /> Delete
          </button>
        </div>
      )}

      {/* delete confirmation */}
      <Modal open={Boolean(confirmSlugs && confirmItems.length)} onClose={() => setConfirmSlugs(null)} labelledBy="rhCfTitle">
        <div className="rh-dlg-h">
          <div>
            <h2 id="rhCfTitle">Delete {confirmItems.length === 1 ? "this review" : `${confirmItems.length} reviews`}?</h2>
            <p>
              {confirmItems.length === 1 ? (
                <>
                  <b>{confirmItems[0].title}</b> and its link <b>{shortLink(confirmItems[0].slug)}</b> will stop working.
                </>
              ) : (
                "Their links will stop working."
              )}{" "}
              You can undo for a few seconds.
            </p>
          </div>
        </div>
        <div className="rh-dlg-f">
          <button className="rh-btn rh-btn-secondary" onClick={() => setConfirmSlugs(null)}>
            Cancel
          </button>
          <button className="rh-btn rh-btn-danger" onClick={doDelete} autoFocus>
            <Trash2 /> Delete
          </button>
        </div>
      </Modal>

      {/* edit details */}
      <Modal open={Boolean(editReview)} onClose={() => setEditSlug(null)} labelledBy="rhEditTitle">
        {editReview && (
          <EditForm
            key={editReview.slug}
            review={editReview}
            onClose={() => setEditSlug(null)}
            onDelete={() => {
              setEditSlug(null);
              askDelete([editReview.slug]);
            }}
            onReplace={() => {
              setEditSlug(null);
              pickReplace(editReview.slug);
            }}
            uniqueSlug={uniqueSlug}
            onSave={async (changes, newSlug) => {
              const t = ensureReady();
              if (!t) return false;
              const now = new Date().toISOString();
              const slug = editReview.slug;
              const next = {
                ...manifestRef.current,
                reviews: manifestRef.current.reviews.map((r) => (r.slug === slug ? { ...r, ...changes, updatedAt: now } : r)),
              };
              setManifest(next);
              try {
                await enqueue(() => saveManifest(manifestRef.current, `Update Claude review: ${slug}`, repoConfig, t));
                if (newSlug && newSlug !== slug) {
                  toast("Moving the review to its new link…");
                  const moved = await enqueue(() =>
                    renameReview({ from: slug, to: newSlug, config: repoConfig, token: t, manifest: manifestRef.current }),
                  );
                  setManifest(moved);
                  if (localThumbs[slug]) rememberThumb(newSlug, localThumbs[slug]);
                }
                setEditSlug(null);
                toast(newSlug && newSlug !== slug ? `Saved. New link: ${shortLink(newSlug)} — the old one forwards there.` : "Saved.");
                return true;
              } catch (e) {
                void refresh();
                throw e;
              }
            }}
          />
        )}
      </Modal>

      {/* upload */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} wide labelledBy="rhUpTitle" canClose={() => {
        if (uploading) toast("Please wait for the upload to finish.");
        return !uploading;
      }}>
        <div className="rh-dlg-h">
          <div>
            <h2 id="rhUpTitle">Add reviews</h2>
            <p>Drop Claude HTML review files here. We read the brand from each file and the file name becomes its link.</p>
          </div>
          <button
            type="button"
            className="rh-x"
            aria-label="Close"
            onClick={() => (uploading ? toast("Please wait for the upload to finish.") : setUploadOpen(false))}
          >
            <X />
          </button>
        </div>
        <div className="rh-dlg-b">
          <label
            className={`rh-dz${dzOn ? " on" : ""}`}
            onDragEnter={(e) => (e.preventDefault(), setDzOn(true))}
            onDragOver={(e) => (e.preventDefault(), setDzOn(true))}
            onDragLeave={() => setDzOn(false)}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDzOn(false);
              void addToQueue([...e.dataTransfer.files]);
            }}
          >
            <Upload />
            <b>Drag and drop review files here</b>
            <small>or click to choose · .html files up to {fmtSize(MAX_REVIEW_BYTES)}</small>
            <input
              type="file"
              accept=".html,.htm,text/html"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) void addToQueue([...e.target.files]);
                e.target.value = "";
              }}
            />
          </label>
          <div className="rh-up-list">
            {queue.map((r) => {
              if (r.state === "reading")
                return (
                  <div className="rh-up" key={r.id}>
                    <div className="rh-up-top">
                      <FileText />
                      <span className="fn">{r.file.name}</span>
                      <small>Reading…</small>
                    </div>
                  </div>
                );
              const busy = r.state === "uploading" || r.state === "done";
              const replaces = !busy && reviews.some((x) => x.slug === slugify(r.slug));
              return (
                <div className={`rh-up ${r.state}`} key={r.id}>
                  <div className="rh-up-top">
                    <FileText />
                    <span className="fn">{r.file.name}</span>
                    <small>{fmtSize(r.file.size)}</small>
                    <button type="button" className="rh-btn rh-btn-ghost rh-btn-sm" onClick={() => previewRow(r)}>
                      <Eye /> Preview
                    </button>
                    {!busy && (
                      <button className="rh-x" aria-label="Remove" onClick={() => setQueue((cur) => cur.filter((x) => x.id !== r.id))}>
                        <X />
                      </button>
                    )}
                  </div>
                  {r.info && !r.info.known && (
                    <p className="note">This doesn't look like one of our review files. It will still upload, but check the name and category.</p>
                  )}
                  {r.state === "failed" && !r.info ? (
                    <p className="rh-err">{r.error}</p>
                  ) : (
                    <>
                      <div className="rh-grid2">
                        <label className="rh-field">
                          <span>Review title</span>
                          <input value={r.name} disabled={busy} onChange={(e) => patchRow(r.id, { name: e.target.value })} />
                        </label>
                        <label className="rh-field">
                          <span>Category</span>
                          <select value={r.type} disabled={busy} onChange={(e) => patchRow(r.id, { type: e.target.value as ReviewType })}>
                            {(Object.entries(TYPES) as [ReviewType, string][]).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v} review
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="rh-field">
                        <span>Link</span>
                        <div className="rh-slug">
                          <span>{host()}/</span>
                          <input value={r.slug} disabled={busy} onChange={(e) => patchRow(r.id, { slug: slugify(e.target.value) })} />
                        </div>
                        {replaces && <small>This replaces the review already published at this link.</small>}
                      </label>
                      <div className="rh-grid2">
                        <label className="rh-field">
                          <span>Status</span>
                          <select value={r.status} disabled={busy} onChange={(e) => patchRow(r.id, { status: e.target.value as ReviewStatus })}>
                            {(Object.entries(STATUS) as [ReviewStatus, string][]).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="rh-field">
                          <span>Tags</span>
                          <input value={r.tags} placeholder="shopify, supplements" disabled={busy} onChange={(e) => patchRow(r.id, { tags: e.target.value })} />
                        </label>
                      </div>
                    </>
                  )}
                  {(busy || (r.state === "failed" && r.info)) && (
                    <div className="rh-bar">
                      <i style={{ width: `${Math.round(r.progress * 100)}%` }} />
                    </div>
                  )}
                  {r.state === "done" && r.result && (
                    <div className="rh-up-done">
                      ✓ Published at <code>{shortLink(r.result.slug)}</code>
                      <button className="rh-btn rh-btn-secondary rh-btn-sm" onClick={() => void copyLink(r.result?.slug)}>
                        <Link2 /> Copy link
                      </button>
                      <a className="rh-btn rh-btn-secondary rh-btn-sm" href={`/${r.result.slug}`} target="_blank" rel="noreferrer">
                        <ExternalLink /> Open
                      </a>
                    </div>
                  )}
                  {r.state === "failed" && r.info && <p className="rh-err">{r.error}</p>}
                </div>
              );
            })}
          </div>
        </div>
        <div className="rh-dlg-f">
          <button className="rh-btn rh-btn-secondary" onClick={() => (uploading ? toast("Please wait for the upload to finish.") : setUploadOpen(false))}>
            Close
          </button>
          <button className="rh-btn rh-btn-primary" disabled={!readyCount || uploading} onClick={() => void runUploads()}>
            <Upload /> Upload{readyCount ? ` ${readyCount} review${readyCount === 1 ? "" : "s"}` : ""}
          </button>
        </div>
      </Modal>

      {/* settings: GitHub connection and publish target */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} labelledBy="rhSetTitle">
        <div className="rh-dlg-h">
          <div>
            <h2 id="rhSetTitle">Settings</h2>
            <p>Publishing writes each review into the site repository on GitHub.</p>
          </div>
          <button type="button" className="rh-x" aria-label="Close" onClick={() => setSettingsOpen(false)}>
            <X />
          </button>
        </div>
        <div className="rh-dlg-b">
          <div className="rh-panel">
            <h3>GitHub connection</h3>
            <p>
              Connect asks for a token once and keeps it in this browser's storage only — it is never shown on the page and
              never committed. Use a fine-grained token with <em>Contents: Read and write</em> for the publishing repository.
            </p>
            <div className="rh-row">
              <span className={`rh-badge ${tokenSourceState === "none" ? "no" : "ok"}`}>
                {tokenSourceState === "none" ? <AlertTriangle /> : <CheckCircle2 />}
                {tokenSourceState === "browser"
                  ? "Connected — token saved in this browser"
                  : tokenSourceState === "env"
                    ? "Using build-time token"
                    : "Not connected"}
              </span>
              <span style={{ flex: 1 }} />
              <button className="rh-btn rh-btn-secondary rh-btn-sm" onClick={() => connectToken()}>
                <KeyRound /> {tokenSourceState === "none" ? "Connect" : "Replace"}
              </button>
              {tokenSourceState === "browser" && (
                <button className="rh-btn rh-btn-ghost rh-btn-sm" onClick={forgetToken}>
                  <Trash2 /> Forget
                </button>
              )}
            </div>
            {tokenSourceState === "env" && (
              <div className="rh-warn">
                <AlertTriangle />
                <span>
                  <code>VITE_GITHUB_TOKEN</code> is compiled into the public JavaScript bundle, so anyone can read it from the
                  deployed site. Use Connect instead and remove that variable from the build environment.
                </span>
              </div>
            )}
          </div>
          <div className="rh-panel">
            <div className="rh-row" style={{ alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <h3>Publish target</h3>
                <p>
                  {showTargetEditor
                    ? "Stored in this browser only — nothing is committed."
                    : isRepoConfigured(repoConfig)
                      ? "Set. The owner, repository and branch are not displayed on this screen."
                      : "Not set yet — press Change target to fill it in once."}
                </p>
              </div>
              <button className="rh-btn rh-btn-ghost rh-btn-sm" onClick={() => setShowTargetEditor((v) => !v)}>
                <Settings2 /> {showTargetEditor ? "Hide target" : "Change target"}
              </button>
            </div>
            {showTargetEditor && (
              <div className="rh-grid2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                <label className="rh-field">
                  <span>Owner</span>
                  <input value={repoConfig.owner} onChange={(e) => updateRepoConfig({ owner: e.target.value })} />
                </label>
                <label className="rh-field">
                  <span>Repository</span>
                  <input value={repoConfig.repo} onChange={(e) => updateRepoConfig({ repo: e.target.value })} />
                </label>
                <label className="rh-field">
                  <span>Branch</span>
                  <input value={repoConfig.branch} onChange={(e) => updateRepoConfig({ branch: e.target.value })} />
                </label>
              </div>
            )}
          </div>
        </div>
        <div className="rh-dlg-f">
          <button
            className="rh-btn rh-btn-primary"
            onClick={() => {
              setSettingsOpen(false);
              void refresh();
            }}
          >
            Done
          </button>
        </div>
      </Modal>

      <div className={`rh-toast${toastShow ? " show" : ""}${toastState?.action ? " has-act" : ""}`} role="status" aria-live="polite">
        <span>{toastState?.msg}</span>
        {toastState?.action && (
          <button
            type="button"
            onClick={() => {
              setToastShow(false);
              toastState.action?.run();
            }}
          >
            {toastState.action.label}
          </button>
        )}
      </div>
    </div>
  );
};

/* ---------- edit details form ---------- */
function EditForm({
  review,
  onClose,
  onDelete,
  onReplace,
  onSave,
  uniqueSlug,
}: {
  review: ClaudeReview;
  onClose: () => void;
  onDelete: () => void;
  onReplace: () => void;
  onSave: (changes: Partial<ClaudeReview>, newSlug?: string) => Promise<boolean>;
  uniqueSlug: (wanted: string, exceptSlug?: string) => string;
}) {
  const [f, setF] = useState({
    title: review.title,
    brand: review.brand || "",
    domain: review.domain || "",
    slug: review.slug,
    type: typeOf(review),
    status: statusOf(review),
    date: review.date || "",
    tags: (review.tags || []).join(", "),
    notes: review.notes || "",
  });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((cur) => ({ ...cur, [k]: e.target.value }));
  const clean = slugify(f.slug);
  const slugNote =
    clean !== f.slug
      ? `Will be saved as: ${clean || "review"}`
      : clean !== review.slug
        ? `New link: ${host()}/${clean}. The old link will forward here.`
        : "Lowercase letters, numbers and dashes. If you change it, the old link forwards to the new one.";

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setErr("");
        const wanted = clean || review.slug;
        const newSlug = wanted !== review.slug ? uniqueSlug(wanted, review.slug) : undefined;
        try {
          await onSave(
            {
              title: f.title.trim() || review.title,
              brand: f.brand.trim(),
              domain: f.domain.trim(),
              type: f.type,
              status: f.status,
              date: f.date.trim(),
              tags: cleanTags(f.tags),
              notes: f.notes.trim(),
            },
            newSlug,
          );
        } catch (er) {
          setErr(errText(er));
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="rh-dlg-h">
        <div>
          <h2 id="rhEditTitle">Edit review</h2>
          <p>Change the name, link, status and notes.</p>
        </div>
        <button type="button" className="rh-x" aria-label="Close" onClick={onClose}>
          <X />
        </button>
      </div>
      <div className="rh-dlg-b">
        <label className="rh-field">
          <span>Review title</span>
          <input value={f.title} onChange={set("title")} required maxLength={120} />
        </label>
        <div className="rh-grid2">
          <label className="rh-field">
            <span>Brand</span>
            <input value={f.brand} onChange={set("brand")} maxLength={120} />
          </label>
          <label className="rh-field">
            <span>Website</span>
            <input value={f.domain} onChange={set("domain")} maxLength={200} placeholder="example.com" />
          </label>
        </div>
        <label className="rh-field">
          <span>Link</span>
          <div className="rh-slug">
            <span>{host()}/</span>
            <input value={f.slug} onChange={set("slug")} maxLength={60} />
          </div>
          <small>{slugNote}</small>
        </label>
        <div className="rh-grid2">
          <label className="rh-field">
            <span>Category</span>
            <select value={f.type} onChange={set("type")}>
              {(Object.entries(TYPES) as [ReviewType, string][]).map(([k, v]) => (
                <option key={k} value={k}>
                  {v} review
                </option>
              ))}
            </select>
          </label>
          <label className="rh-field">
            <span>Status</span>
            <select value={f.status} onChange={set("status")}>
              {(Object.entries(STATUS) as [ReviewStatus, string][]).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="rh-grid2">
          <label className="rh-field">
            <span>Review date</span>
            <input value={f.date} onChange={set("date")} maxLength={40} placeholder="October 2026" />
          </label>
          <label className="rh-field">
            <span>Tags</span>
            <input value={f.tags} onChange={set("tags")} placeholder="shopify, supplements" />
            <small>Separate with commas.</small>
          </label>
        </div>
        <label className="rh-field">
          <span>Notes (only your team sees these here)</span>
          <textarea value={f.notes} onChange={set("notes")} maxLength={2000} placeholder="Sent to the founder on Oct 24, follow up next week…" />
        </label>
        <div className="rh-field">
          <span>File</span>
          <div className="rh-meta">
            <span>{review.origName || review.file}</span>
            {review.size ? <span>{fmtSize(review.size)}</span> : null}
            <span>updated {fmtDate(review.updatedAt || review.uploadedAt)}</span>
          </div>
          <button type="button" className="rh-btn rh-btn-secondary rh-btn-sm" style={{ marginTop: 8 }} onClick={onReplace}>
            <Upload /> Replace file
          </button>
        </div>
        <p className="rh-err">{err}</p>
      </div>
      <div className="rh-dlg-f">
        <button type="button" className="rh-btn rh-btn-ghost" onClick={onDelete}>
          <Trash2 /> Delete
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" className="rh-btn rh-btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="rh-btn rh-btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

export default ClaudeReviewUpload;
