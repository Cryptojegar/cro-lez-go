import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Globe, FileText } from "lucide-react";
import croAuditLogo from "@/assets/cro-audit-logo.png";

export const Header = () => {
  const location = useLocation();

  return (
    <header className="audit-header sticky top-0 z-50 border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src={croAuditLogo} alt="CRO Audit" className="h-8 w-auto" />
            <span className="text-xl font-bold text-foreground">CRO Tools</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-2">
            <Link to="/">
              <Button 
                variant={location.pathname === "/" ? "default" : "ghost"}
                size="sm"
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                CRO Audit
              </Button>
            </Link>
            
            <Link to="/domain-checkup">
              <Button 
                variant={location.pathname === "/domain-checkup" ? "default" : "ghost"}
                size="sm"
                className="flex items-center gap-2"
              >
                <Globe className="h-4 w-4" />
                Domain Checkup
              </Button>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};