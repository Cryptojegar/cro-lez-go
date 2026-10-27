import { NavLink } from "react-router-dom";
import { ClipboardCheck, Globe, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface SiteTab {
  to: string;
  label: string;
  icon: typeof ClipboardCheck;
}

const tabs: SiteTab[] = [
  { to: "/", label: "CRO Audit", icon: ClipboardCheck },
  { to: "/domain-checkup", label: "Domain Checkup", icon: Globe },
  { to: "/claude-review-upload", label: "Claude Review Upload", icon: UploadCloud },
];

export const SiteTabs = ({ className }: { className?: string }) => (
  <nav aria-label="Main sections" className={cn("mb-6", className)}>
    <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-card/60 p-2 backdrop-blur-sm">
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            cn(
              "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-[var(--shadow-yellow)]"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </div>
  </nav>
);

export default SiteTabs;
