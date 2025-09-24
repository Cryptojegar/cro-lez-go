import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, Download, FileText } from "lucide-react";

interface CSVPreviewProps {
  csvData: string;
  productCount: number;
  onDownload: () => void;
}

const CSVPreview = ({ csvData, productCount, onDownload }: CSVPreviewProps) => {
  const [showPreview, setShowPreview] = useState(false);

  const parseCSVForPreview = () => {
    const lines = csvData.split('\n');
    const headers = lines[0]?.split(',') || [];
    const rows = lines.slice(1, 6); // Show first 5 rows
    
    return { headers, rows, totalRows: lines.length - 1 };
  };

  const { headers, rows, totalRows } = parseCSVForPreview();

  return (
    <Card className="audit-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CSV Preview
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? 'Hide' : 'Show'} Preview
            </Button>
            <Button
              onClick={onDownload}
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-success/10 rounded-lg">
            <div className="text-2xl font-bold text-success">{productCount}</div>
            <div className="text-sm text-muted-foreground">Products</div>
          </div>
          <div className="text-center p-3 bg-primary/10 rounded-lg">
            <div className="text-2xl font-bold text-primary">{headers.length}</div>
            <div className="text-sm text-muted-foreground">Columns</div>
          </div>
          <div className="text-center p-3 bg-accent/10 rounded-lg">
            <div className="text-2xl font-bold text-accent-foreground">{totalRows}</div>
            <div className="text-sm text-muted-foreground">Total Rows</div>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold">CSV</div>
            <div className="text-sm text-muted-foreground">Format</div>
          </div>
        </div>

        {/* Headers Preview */}
        <div>
          <h4 className="font-medium mb-2">Shopify Columns ({headers.length})</h4>
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
            {headers.map((header, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {header.replace(/"/g, '')}
              </Badge>
            ))}
          </div>
        </div>

        {/* CSV Table Preview */}
        {showPreview && (
          <div className="space-y-2">
            <h4 className="font-medium">Data Preview (First 5 rows)</h4>
            <ScrollArea className="h-64 w-full border rounded-lg">
              <div className="p-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      {headers.slice(0, 6).map((header, index) => (
                        <th key={index} className="text-left p-2 font-medium">
                          {header.replace(/"/g, '')}
                        </th>
                      ))}
                      {headers.length > 6 && (
                        <th className="text-left p-2 font-medium">...</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIndex) => {
                      const cells = row.split(',');
                      return (
                        <tr key={rowIndex} className="border-b">
                          {cells.slice(0, 6).map((cell, cellIndex) => (
                            <td key={cellIndex} className="p-2 truncate max-w-32">
                              {cell.replace(/"/g, '')}
                            </td>
                          ))}
                          {cells.length > 6 && (
                            <td className="p-2">...</td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CSVPreview;