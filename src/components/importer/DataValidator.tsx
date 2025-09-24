import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";

interface ValidationResult {
  type: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  count?: number;
}

interface DataValidatorProps {
  validationResults: ValidationResult[];
  totalProducts: number;
  validProducts: number;
}

const DataValidator = ({ validationResults, totalProducts, validProducts }: DataValidatorProps) => {
  const errors = validationResults.filter(r => r.type === 'error');
  const warnings = validationResults.filter(r => r.type === 'warning');
  const infos = validationResults.filter(r => r.type === 'info');

  const validationScore = totalProducts > 0 ? (validProducts / totalProducts) * 100 : 0;

  const getIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'info':
        return <Info className="h-4 w-4 text-info" />;
      default:
        return <CheckCircle className="h-4 w-4 text-success" />;
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (validationResults.length === 0) return null;

  return (
    <Card className="audit-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Data Validation Results
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Validation Score */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Data Quality Score</span>
            <span className="font-medium">{validationScore.toFixed(1)}%</span>
          </div>
          <Progress value={validationScore} className="h-2" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{validProducts} valid products</span>
            <span>{totalProducts} total products</span>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-destructive/10 rounded-lg">
            <div className="text-2xl font-bold text-destructive">{errors.length}</div>
            <div className="text-sm text-muted-foreground">Errors</div>
          </div>
          <div className="text-center p-3 bg-warning/10 rounded-lg">
            <div className="text-2xl font-bold text-warning">{warnings.length}</div>
            <div className="text-sm text-muted-foreground">Warnings</div>
          </div>
          <div className="text-center p-3 bg-info/10 rounded-lg">
            <div className="text-2xl font-bold text-info">{infos.length}</div>
            <div className="text-sm text-muted-foreground">Info</div>
          </div>
        </div>

        {/* Validation Details */}
        {validationResults.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Validation Details</h4>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {validationResults.map((result, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                  {getIcon(result.type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getBadgeVariant(result.type) as any} className="text-xs">
                        {result.field}
                      </Badge>
                      {result.count && (
                        <Badge variant="outline" className="text-xs">
                          {result.count} items
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{result.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DataValidator;