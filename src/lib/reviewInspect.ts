/**
 * Reads an uploaded review HTML file: brand, CRO/SEO type, counts and a
 * preview image. Supports both report layouts — `const DATA = {...}` (Audit Hub
 * reports) and `const IMG = {...}` / `const PAGES = [...]` (Claude reviews).
 */
import type { ReviewStats, ReviewType } from "@/lib/claudeReviews";

export interface ReviewInfo {
  type: ReviewType | null;
  known: boolean;
  brand: string;
  name: string;
  domain: string;
  date: string;
  thumb: string;
  stats: ReviewStats;
}

interface ReportData {
  site?: { name?: string; domain?: string; date?: string; logo?: string };
  pages?: { key: string; issues?: { lvl?: string }[] }[];
  areas?: { issues?: { lvl?: string }[] }[];
  images?: Record<string, string>;
}

function readData(text: string): ReportData | null {
  const a = text.indexOf("const DATA = "), img = text.indexOf("const IMG = DATA.images;");
  if (a < 0 || img < a) return null;
  try {
    return JSON.parse(text.slice(a + 13, text.lastIndexOf(";", img))) as ReportData;
  } catch {
    return null;
  }
}

/** Claude reviews: first desktop screenshot plus finding counts from the PAGES block. */
function readClaudeLayout(text: string) {
  const pagesAt = text.indexOf("const PAGES = [");
  if (pagesAt < 0) return null;
  const shot = text.match(/_desktop"?\s*:\s*"(data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+)"/);
  const end = text.indexOf("\nconst ", pagesAt + 15);
  const block = text.slice(pagesAt, end > 0 ? end : undefined);
  const levels = [...block.matchAll(/\blvl"?\s*:\s*"(\w+)"/g)].map((m) => m[1]);
  const pages = (block.match(/\bkey"?\s*:\s*"[^"]+"\s*,\s*name"?\s*:/g) || []).length;
  const domain = (block.match(/\burl"?\s*:\s*"https?:\/\/(?:www\.)?([^/"]+)/) || [])[1] || "";
  return {
    shot: shot?.[1] ?? "",
    domain,
    stats: {
      pages,
      findings: levels.filter((l) => l !== "strength").length,
      critical: levels.filter((l) => l === "critical").length,
    },
  };
}

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((ok, bad) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = bad;
    i.src = src;
  });

async function makeThumb(shot: string, logo: string, siteName: string, type: ReviewType): Promise<string> {
  const cv = document.createElement("canvas");
  cv.width = 640;
  cv.height = 400;
  const g = cv.getContext("2d");
  if (!g) return "";
  if (shot) {
    try {
      const im = await loadImg(shot);
      const h = (im.naturalWidth * 400) / 640;
      g.drawImage(im, 0, 0, im.naturalWidth, Math.min(h, im.naturalHeight), 0, 0, 640, 400 * Math.min(1, im.naturalHeight / h));
      return cv.toDataURL("image/jpeg", 0.72);
    } catch {
      /* fall through to the branded card */
    }
  }
  // no screenshot (SEO reports): a clean branded card
  const grd = g.createLinearGradient(0, 0, 640, 400);
  if (type === "seo") {
    grd.addColorStop(0, "#EEF4FF");
    grd.addColorStop(1, "#D6E4FF");
  } else {
    grd.addColorStop(0, "#FFF4EC");
    grd.addColorStop(1, "#FFE2CC");
  }
  g.fillStyle = grd;
  g.fillRect(0, 0, 640, 400);
  g.fillStyle = type === "seo" ? "#3B82F6" : "#FB6D28";
  g.globalAlpha = 0.12;
  g.beginPath();
  g.arc(560, 360, 220, 0, 7);
  g.fill();
  g.globalAlpha = 1;
  let drewLogo = false;
  if (logo) {
    try {
      const im = await loadImg(logo);
      const r = Math.min(360 / im.naturalWidth, 80 / im.naturalHeight);
      const w = im.naturalWidth * r, h = im.naturalHeight * r;
      g.fillStyle = "#fff";
      g.beginPath();
      g.roundRect((640 - w) / 2 - 22, 150 - 16, w + 44, h + 32, 14);
      g.fill();
      g.drawImage(im, (640 - w) / 2, 150, w, h);
      drewLogo = true;
    } catch {
      /* no logo */
    }
  }
  if (!drewLogo) {
    g.fillStyle = "#201E1E";
    g.font = "800 44px Manrope, sans-serif";
    g.textAlign = "center";
    g.fillText(siteName || "Audit", 320, 200);
  }
  g.fillStyle = "#201E1E";
  g.font = "800 22px Manrope, sans-serif";
  g.textAlign = "center";
  g.fillText(type === "seo" ? "SEO AUDIT" : "CRO AUDIT", 320, 300);
  return cv.toDataURL("image/jpeg", 0.8);
}

export async function inspectReview(text: string, fileName: string): Promise<ReviewInfo> {
  const d = readData(text);
  const claude = d ? null : readClaudeLayout(text);
  const title = ((text.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "").trim();
  const type: ReviewType | null = d
    ? d.areas ? "seo" : "cro"
    : /seo/i.test(`${fileName} ${title}`) ? "seo" : /cro/i.test(`${fileName} ${title}`) || claude ? "cro" : null;
  const strip = (s: string) =>
    s.replace(/\.html?$/i, "").replace(/[-_]+/g, " ").replace(/\b(cro|seo)\b|\baudit\b|\breview\b|my amazon guy/gi, "").replace(/\s+/g, " ").trim();
  const base = strip(title) || strip(fileName).replace(/\b\w/g, (c) => c.toUpperCase());
  const brand = d?.site?.name || base || "Untitled";
  const all = d ? (d.pages || d.areas || []).flatMap((p) => p.issues || []) : [];
  const first = d?.pages?.[0];
  const shot = (first && d?.images?.[`${first.key}_desktop`]) || claude?.shot || "";
  return {
    type,
    known: Boolean(d || claude),
    brand,
    name: title || `${brand} ${type === "seo" ? "SEO" : "CRO"} Audit`,
    domain: d?.site?.domain || claude?.domain || "",
    date: d?.site?.date || "",
    thumb: await makeThumb(shot, d?.site?.logo || "", d?.site?.name || brand, type || "cro"),
    stats: d
      ? {
          pages: (d.pages || d.areas || []).length,
          findings: all.filter((x) => x.lvl !== "strength").length,
          critical: all.filter((x) => x.lvl === "critical").length,
        }
      : claude?.stats ?? {},
  };
}
