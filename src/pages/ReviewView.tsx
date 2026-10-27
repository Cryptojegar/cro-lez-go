import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileWarning, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClaudeReview } from "@/lib/claudeReviews";
import { loadPublishedManifest } from "@/lib/claudeReviews";

const ReviewView = () => {
  const { slug } = useParams<{ slug: string }>();
  const [review, setReview] = useState<ClaudeReview | null>(null);
  const [status, setStatus] = useState<"loading" | "found" | "missing">("loading");

  useEffect(() => {
    let active = true;
    const normalized = (slug ?? "").toLowerCase();
    setStatus("loading");

    loadPublishedManifest().then((reviews) => {
      if (!active) return;
      const match = reviews.find((item) => item.slug === normalized) ?? null;
      setReview(match);
      setStatus(match ? "found" : "missing");
    });

    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (review) document.title = review.title;
  }, [review]);

  const frameSrc = useMemo(() => (review ? `/${review.file}` : ""), [review]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "missing" || !review) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="audit-card p-8 max-w-md text-center">
          <FileWarning className="h-10 w-10 text-warning mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Review not found</h1>
          <p className="text-muted-foreground mb-6">
            There is no Claude review published at <code className="text-primary">/{slug}</code> yet.
          </p>
          <div className="flex flex-col gap-2">
            <Link to="/claude-review-upload">
              <Button className="w-full">Upload a review</Button>
            </Link>
            <Link to="/">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="h-4 w-4" />
                Back to CRO Audit
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-white">
      <iframe
        src={frameSrc}
        title={review.title}
        className="block h-full w-full border-0"
      />
    </div>
  );
};

export default ReviewView;
