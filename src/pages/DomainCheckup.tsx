import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Globe, 
  Search, 
  Zap, 
  BarChart3, 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Clock,
  Database,
  Cpu
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SiteTabs } from "@/components/layout/SiteTabs";

interface DomainAnalysis {
  domain: string;
  cms: {
    detected: boolean;
    platform: string;
    confidence: number;
  };
  analytics: {
    googleAnalytics: boolean;
    googleSearchConsole: boolean;
    facebookPixel: boolean;
  };
  performance: {
    loadTime: number;
    status: 'fast' | 'moderate' | 'slow';
    grade: string;
  };
  dns: {
    aRecord: string[];
    txtRecords: string[];
    mxRecords: string[];
  };
  security: {
    ssl: boolean;
    httpToHttps: boolean;
  };
}

const DomainCheckup = () => {
  const [domain, setDomain] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<DomainAnalysis | null>(null);
  const { toast } = useToast();

  const analyzeDomain = async () => {
    if (!domain.trim()) {
      toast({
        title: "Error",
        description: "Please enter a domain name",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    
    try {
      // Simulate API calls - in a real implementation, you'd call actual APIs
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock data - replace with actual API calls
      const mockAnalysis: DomainAnalysis = {
        domain: domain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
        cms: {
          detected: Math.random() > 0.3,
          platform: ['WordPress', 'Shopify', 'Webflow', 'Wix', 'Custom'][Math.floor(Math.random() * 5)],
          confidence: Math.floor(Math.random() * 40) + 60
        },
        analytics: {
          googleAnalytics: Math.random() > 0.4,
          googleSearchConsole: Math.random() > 0.6,
          facebookPixel: Math.random() > 0.7
        },
        performance: {
          loadTime: Math.random() * 3 + 1,
          status: Math.random() > 0.6 ? 'fast' : Math.random() > 0.3 ? 'moderate' : 'slow',
          grade: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)]
        },
        dns: {
          aRecord: ['192.168.1.1', '203.0.113.1'],
          txtRecords: ['v=spf1 include:_spf.google.com ~all', 'google-site-verification=abc123'],
          mxRecords: ['10 mail.example.com', '20 mail2.example.com']
        },
        security: {
          ssl: Math.random() > 0.2,
          httpToHttps: Math.random() > 0.3
        }
      };

      // Determine performance status based on load time
      if (mockAnalysis.performance.loadTime < 2) {
        mockAnalysis.performance.status = 'fast';
      } else if (mockAnalysis.performance.loadTime < 4) {
        mockAnalysis.performance.status = 'moderate';
      } else {
        mockAnalysis.performance.status = 'slow';
      }

      setAnalysis(mockAnalysis);
      
      toast({
        title: "Analysis Complete",
        description: `Successfully analyzed ${mockAnalysis.domain}`,
      });
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: "Unable to analyze domain. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getStatusIcon = (status: boolean | string) => {
    if (typeof status === 'boolean') {
      return status ? (
        <CheckCircle className="h-5 w-5 text-success" />
      ) : (
        <XCircle className="h-5 w-5 text-destructive" />
      );
    }
    
    if (status === 'fast') return <CheckCircle className="h-5 w-5 text-success" />;
    if (status === 'moderate') return <AlertTriangle className="h-5 w-5 text-warning" />;
    return <XCircle className="h-5 w-5 text-destructive" />;
  };

  const getStatusBadge = (status: boolean | string, labels?: {true?: string, false?: string}) => {
    if (typeof status === 'boolean') {
      return (
        <Badge variant={status ? "default" : "destructive"}>
          {status ? (labels?.true || "Detected") : (labels?.false || "Not Found")}
        </Badge>
      );
    }
    
    const variant = status === 'fast' ? 'default' : status === 'moderate' ? 'secondary' : 'destructive';
    return <Badge variant={variant}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Section tabs */}
        <SiteTabs />

        {/* Header */}
        <div className="audit-header rounded-lg p-8 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Globe className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Domain Checkup</h1>
              <p className="text-muted-foreground mt-1">
                Comprehensive analysis of your website's technical foundation
              </p>
            </div>
          </div>
        </div>

        {/* Domain Input */}
        <Card className="audit-card mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Analyze Your Domain
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="Enter domain (e.g. example.com)"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && analyzeDomain()}
                className="flex-1"
              />
              <Button 
                onClick={analyzeDomain} 
                disabled={isAnalyzing}
                size="lg"
              >
                {isAnalyzing ? (
                  <>
                    <Cpu className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Run Analysis
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {analysis && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CMS Detection */}
            <Card className="audit-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  CMS Detection
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Platform Detected</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(analysis.cms.detected)}
                    {getStatusBadge(analysis.cms.detected)}
                  </div>
                </div>
                {analysis.cms.detected && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Platform</span>
                      <Badge variant="outline">{analysis.cms.platform}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Confidence</span>
                      <span className="text-sm font-medium">{analysis.cms.confidence}%</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Analytics & Tracking */}
            <Card className="audit-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Analytics & Tracking
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Google Analytics</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(analysis.analytics.googleAnalytics)}
                    {getStatusBadge(analysis.analytics.googleAnalytics)}
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="font-medium">Search Console</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(analysis.analytics.googleSearchConsole)}
                    {getStatusBadge(analysis.analytics.googleSearchConsole)}
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="font-medium">Facebook Pixel</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(analysis.analytics.facebookPixel)}
                    {getStatusBadge(analysis.analytics.facebookPixel)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance */}
            <Card className="audit-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Loading Speed</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(analysis.performance.status)}
                    {getStatusBadge(analysis.performance.status)}
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Load Time</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {analysis.performance.loadTime.toFixed(2)}s
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Performance Grade</span>
                  <Badge variant="outline">{analysis.performance.grade}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Security */}
            <Card className="audit-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">SSL Certificate</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(analysis.security.ssl)}
                    {getStatusBadge(analysis.security.ssl, {true: "Valid", false: "Missing"})}
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="font-medium">HTTPS Redirect</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(analysis.security.httpToHttps)}
                    {getStatusBadge(analysis.security.httpToHttps, {true: "Active", false: "Missing"})}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* DNS Records */}
            <Card className="audit-card lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  DNS Records
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    A Records
                    <Badge variant="outline">{analysis.dns.aRecord.length}</Badge>
                  </h4>
                  <div className="space-y-2">
                    {analysis.dns.aRecord.map((record, index) => (
                      <div key={index} className="p-3 bg-muted/30 rounded-md">
                        <code className="text-sm">{record}</code>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    TXT Records
                    <Badge variant="outline">{analysis.dns.txtRecords.length}</Badge>
                  </h4>
                  <div className="space-y-2">
                    {analysis.dns.txtRecords.map((record, index) => (
                      <div key={index} className="p-3 bg-muted/30 rounded-md">
                        <code className="text-sm break-all">{record}</code>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    MX Records
                    <Badge variant="outline">{analysis.dns.mxRecords.length}</Badge>
                  </h4>
                  <div className="space-y-2">
                    {analysis.dns.mxRecords.map((record, index) => (
                      <div key={index} className="p-3 bg-muted/30 rounded-md">
                        <code className="text-sm">{record}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Analysis Tips */}
        {analysis && (
          <Card className="audit-card mt-8">
            <CardHeader>
              <CardTitle>Analysis Summary & Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-success/10 rounded-lg">
                  <div className="text-2xl font-bold text-success mb-1">
                    {[
                      analysis.cms.detected,
                      analysis.analytics.googleAnalytics,
                      analysis.analytics.googleSearchConsole,
                      analysis.performance.status === 'fast',
                      analysis.security.ssl,
                      analysis.security.httpToHttps
                    ].filter(Boolean).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Checks Passed</div>
                </div>
                
                <div className="text-center p-4 bg-warning/10 rounded-lg">
                  <div className="text-2xl font-bold text-warning mb-1">
                    {analysis.performance.status === 'moderate' ? 1 : 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Needs Attention</div>
                </div>
                
                <div className="text-center p-4 bg-destructive/10 rounded-lg">
                  <div className="text-2xl font-bold text-destructive mb-1">
                    {6 - [
                      analysis.cms.detected,
                      analysis.analytics.googleAnalytics,
                      analysis.analytics.googleSearchConsole,  
                      analysis.performance.status !== 'slow',
                      analysis.security.ssl,
                      analysis.security.httpToHttps
                    ].filter(Boolean).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Issues Found</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DomainCheckup;