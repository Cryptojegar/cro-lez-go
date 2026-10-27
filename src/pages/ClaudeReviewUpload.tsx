import { useEffect, useMemo, useRef, useState } from "react";
import { SiteTabs } from "@/components/layout/SiteTabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FileCode2,
  Github,
  KeyRound,
  Link2,
  Loader2,
  RefreshCw,
  Settings2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import type { ClaudeReview, RepoConfig } from "@/lib/claudeReviews";
import {
  MAX_REVIEW_BYTES,
  deleteReview,
  getRepoConfig,
  getToken,
  loadRepoManifest,
  publishReview,
  reviewShareUrl,
  saveRepoConfig,
  saveToken,
  slugify,
  slugValidationError,
} from "@/lib/claudeReviews";

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const extractTitle = (html: string, fallback: string): string => {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return (match?.[1] ?? "").trim() || fallback;
};

const ClaudeReviewUpload = () => {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [html, setHtml] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [lastPublished, setLastPublished] = useState<ClaudeReview | null>(null);

  const [token, setToken] = useState(() => getToken());
  const [repoConfig, setRepoConfig] = useState<RepoConfig>(() => getRepoConfig());
  const [showSettings, setShowSettings] = useState(() => !getToken());

  const [reviews, setReviews] = useState<ClaudeReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  const slugError = slugValidationError(slug);
  const existingReview = useMemo(
    () => reviews.find((review) => review.slug === slug),
    [reviews, slug],
  );
  const shareUrl = slug && !slugError ? reviewShareUrl(slug) : "";

  useEffect(() => {
    let active = true;
    setLoadingReviews(true);
    loadRepoManifest()
      .then((list) => {
        if (active) setReviews(list);
      })
      .finally(() => {
        if (active) setLoadingReviews(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const refreshReviews = async () => {
    setLoadingReviews(true);
    try {
      setReviews(await loadRepoManifest());
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    if (!/\.html?$/i.test(file.name)) {
      toast({
        title: "Wrong file type",
        description: "Upload the .html file you downloaded from Claude.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_REVIEW_BYTES) {
      toast({
        title: "File too large",
        description: `Keep reviews under ${formatBytes(MAX_REVIEW_BYTES)}.`,
        variant: "destructive",
      });
      return;
    }

    const text = await file.text();
    if (!/<!doctype html|<html|<body/i.test(text)) {
      toast({
        title: "Not an HTML document",
        description: "That file does not look like a standalone HTML page.",
        variant: "destructive",
      });
      return;
    }

    const baseSlug = slugify(file.name);
    setHtml(text);
    setFileName(file.name);
    setFileSize(file.size);
    setLastPublished(null);
    if (!slugTouched || !slug) setSlug(baseSlug);
    setTitle(extractTitle(text, baseSlug));

    toast({
      title: "File loaded",
      description: `${file.name} (${formatBytes(file.size)}) is ready to publish.`,
    });
  };

  const copyShareUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: url });
    } catch {
      toast({
        title: "Copy failed",
        description: "Select the link manually and copy it.",
        variant: "destructive",
      });
    }
  };

  const handlePublish = async () => {
    if (!html) {
      toast({
        title: "No file selected",
        description: "Choose the HTML file you want to publish first.",
        variant: "destructive",
      });
      return;
    }

    if (slugError) {
      toast({ title: "Check the link name", description: slugError, variant: "destructive" });
      return;
    }

    if (!token.trim()) {
      setShowSettings(true);
      toast({
        title: "GitHub token required",
        description: "Publishing writes the file into the site repository. Add a token below.",
        variant: "destructive",
      });
      return;
    }

    setPublishing(true);
    try {
      saveToken(token);
      saveRepoConfig(repoConfig);

      const review = await publishReview({
        html,
        slug,
        title,
        config: repoConfig,
        token: token.trim(),
        existing: reviews,
      });

      setLastPublished(review);
      setReviews((current) => [review, ...current.filter((item) => item.slug !== review.slug)]);

      toast({
        title: "Review published",
        description: `${reviewShareUrl(review.slug)} is live once the site finishes deploying.`,
      });
    } catch (error) {
      toast({
        title: "Publish failed",
        description: error instanceof Error ? error.message : "Unexpected error.",
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async (review: ClaudeReview) => {
    const confirmed = window.confirm(
      `Remove "${review.title}"? The link /${review.slug} will stop working.`,
    );
    if (!confirmed) return;

    if (!token.trim()) {
      setShowSettings(true);
      toast({
        title: "GitHub token required",
        description: "Deleting also updates the repository.",
        variant: "destructive",
      });
      return;
    }

    setDeletingSlug(review.slug);
    try {
      saveToken(token);
      saveRepoConfig(repoConfig);
      await deleteReview({
        slug: review.slug,
        config: repoConfig,
        token: token.trim(),
        existing: reviews,
      });
      setReviews((current) => current.filter((item) => item.slug !== review.slug));
      toast({ title: "Review removed", description: `/${review.slug} was deleted.` });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Unexpected error.",
        variant: "destructive",
      });
    } finally {
      setDeletingSlug(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <SiteTabs />

        <div className="audit-header rounded-lg p-8 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <UploadCloud className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Claude Review Upload</h1>
              <p className="text-muted-foreground mt-1">
                Upload the HTML review you exported from Claude and give clients a clean link.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-primary" /> Pick the .html file
            </span>
            <span aria-hidden="true">→</span>
            <span className="inline-flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" /> Choose the link name
            </span>
            <span aria-hidden="true">→</span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Publish
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <Card className="audit-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UploadCloud className="h-5 w-5" />
                  Upload review HTML
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      inputRef.current?.click();
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    void handleFile(event.dataTransfer.files?.[0]);
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
                    dragging
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/30 hover:border-primary/60 hover:bg-secondary/50",
                  )}
                >
                  <UploadCloud className="h-10 w-10 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">
                      Drag &amp; drop the HTML file here
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse — .html / .htm up to {formatBytes(MAX_REVIEW_BYTES)}
                    </p>
                  </div>
                  {fileName && (
                    <Badge variant="secondary" className="mt-1">
                      <FileCode2 className="h-3 w-3" />
                      {fileName} · {formatBytes(fileSize)}
                    </Badge>
                  )}
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  accept=".html,.htm,text/html"
                  className="hidden"
                  onChange={(event) => {
                    void handleFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />

                <div className="space-y-2">
                  <Label htmlFor="reviewTitle" className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    Review title
                  </Label>
                  <Input
                    id="reviewTitle"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Oramune CRO Audit"
                    className="bg-input border-border focus:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reviewSlug" className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-primary" />
                    Link name
                  </Label>
                  <div className="flex items-stretch gap-2">
                    <span className="inline-flex items-center rounded-md border border-border bg-secondary px-3 text-sm text-muted-foreground">
                      {window.location.origin}/
                    </span>
                    <Input
                      id="reviewSlug"
                      value={slug}
                      onChange={(event) => {
                        setSlugTouched(true);
                        setSlug(slugify(event.target.value));
                      }}
                      placeholder="oramune"
                      className="bg-input border-border focus:ring-primary"
                    />
                    {shareUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Copy link"
                        onClick={() => void copyShareUrl(shareUrl)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {slugError ? (
                    <p className="flex items-center gap-2 text-sm text-warning">
                      <AlertTriangle className="h-4 w-4" />
                      {slugError}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Clients open <span className="text-primary">{shareUrl}</span>
                      {existingReview && " — this replaces the review already published there."}
                    </p>
                  )}
                </div>

                <Separator />

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    onClick={() => void handlePublish()}
                    disabled={publishing || !html || Boolean(slugError)}
                  >
                    {publishing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-4 w-4" />
                        Publish review
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setShowSettings((value) => !value)}>
                    <Settings2 className="h-4 w-4" />
                    GitHub settings
                  </Button>
                </div>

                {showSettings && (
                  <div className="space-y-4 rounded-lg border border-border bg-secondary/30 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Github className="h-4 w-4 text-primary" />
                      Publish target (saved in this browser only)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="repoOwner">Owner</Label>
                        <Input
                          id="repoOwner"
                          value={repoConfig.owner}
                          onChange={(event) =>
                            setRepoConfig({ ...repoConfig, owner: event.target.value })
                          }
                          className="bg-input border-border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="repoName">Repository</Label>
                        <Input
                          id="repoName"
                          value={repoConfig.repo}
                          onChange={(event) =>
                            setRepoConfig({ ...repoConfig, repo: event.target.value })
                          }
                          className="bg-input border-border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="repoBranch">Branch</Label>
                        <Input
                          id="repoBranch"
                          value={repoConfig.branch}
                          onChange={(event) =>
                            setRepoConfig({ ...repoConfig, branch: event.target.value })
                          }
                          className="bg-input border-border"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="githubToken" className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-primary" />
                        GitHub token (Contents: read &amp; write)
                      </Label>
                      <Input
                        id="githubToken"
                        type="password"
                        value={token}
                        onChange={(event) => setToken(event.target.value)}
                        placeholder="github_pat_..."
                        autoComplete="off"
                        className="bg-input border-border"
                      />
                      <p className="text-xs text-muted-foreground">
                        Create a fine-grained token with <em>Contents: Read and write</em> for{" "}
                        {repoConfig.owner}/{repoConfig.repo} at
                        github.com/settings/personal-access-tokens/new. Reviews are committed to{" "}
                        <code>public/</code> and served to clients from there.
                      </p>
                    </div>
                  </div>
                )}

                {lastPublished && (
                  <div className="rounded-lg border border-primary/40 bg-primary/10 p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {lastPublished.title} is published
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                      <a
                        href={`/${lastPublished.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                      >
                        /{lastPublished.slug}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void copyShareUrl(reviewShareUrl(lastPublished.slug))}
                      >
                        <Copy className="h-3 w-3" />
                        Copy client link
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <div className="sticky top-6">
              <Card className="audit-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Live preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {html ? (
                    <iframe
                      title="Review preview"
                      srcDoc={html}
                      sandbox="allow-scripts allow-popups allow-forms allow-modals"
                      className="h-[520px] w-full rounded-md border border-border bg-white"
                    />
                  ) : (
                    <div className="flex h-[320px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
                      <FileCode2 className="h-8 w-8 text-primary" />
                      Your review appears here once you pick a file.
                    </div>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    The preview is sandboxed. Clients see exactly this page at{" "}
                    <span className="text-primary">
                      {shareUrl || `${window.location.origin}/<link>`}
                    </span>
                    .
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* LIBRARY */}
        <Card className="audit-card mt-6">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <FileCode2 className="h-5 w-5" />
                Published reviews
                <Badge variant="secondary">{reviews.length}</Badge>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void refreshReviews()}
                disabled={loadingReviews}
              >
                {loadingReviews ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingReviews ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading published reviews...
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing published yet. Upload an HTML review above to create the first client link.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {reviews.map((review) => (
                  <li
                    key={review.slug}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{review.title}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        /{review.slug} · {review.file}
                        {review.size ? ` · ${formatBytes(review.size)}` : ""}
                        {review.uploadedAt ? ` · ${formatDate(review.uploadedAt)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void copyShareUrl(reviewShareUrl(review.slug))}
                      >
                        <Copy className="h-3 w-3" />
                        Copy link
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <a href={`/${review.slug}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3 w-3" />
                          Open
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${review.title}`}
                        disabled={deletingSlug === review.slug}
                        onClick={() => void handleDelete(review)}
                      >
                        {deletingSlug === review.slug ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default ClaudeReviewUpload;
