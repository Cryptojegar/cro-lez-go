import { Card } from "@/components/ui/card";
import { CheckCircle, XCircle, Circle } from "lucide-react";

interface ProgressBarProps {
  totalItems: number;
  completedItems: number;
  passedItems: number;
  failedItems: number;
}

export const ProgressBar = ({ 
  totalItems, 
  completedItems, 
  passedItems, 
  failedItems 
}: ProgressBarProps) => {
  const completionPercentage = Math.round((completedItems / totalItems) * 100);
  const passRate = completedItems > 0 ? Math.round((passedItems / completedItems) * 100) : 0;

  return (
    <Card className="audit-card p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Audit Progress</h2>
        <div className="text-2xl font-bold text-primary">
          {completionPercentage}%
        </div>
      </div>

      <div className="space-y-4">
        {/* Progress Bar */}
        <div className="w-full bg-secondary rounded-full h-3">
          <div 
            className="audit-progress h-3 rounded-full transition-all duration-300"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Circle className="h-4 w-4 text-muted-foreground" />
            <span>Total: {totalItems}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <span>Passed: {passedItems}</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            <span>Failed: {failedItems}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-primary"></div>
            <span>Pass Rate: {passRate}%</span>
          </div>
        </div>
      </div>
    </Card>
  );
};