import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Eye, EyeOff } from "lucide-react";

interface SheetData {
  name: string;
  data: any[];
  headers: string[];
  rowCount: number;
}

interface SheetProcessorProps {
  sheets: SheetData[];
  selectedSheets: string[];
  onSheetSelection: (sheetNames: string[]) => void;
  onPreviewSheet: (sheetName: string) => void;
}

const SheetProcessor = ({ sheets, selectedSheets, onSheetSelection, onPreviewSheet }: SheetProcessorProps) => {
  const [previewSheet, setPreviewSheet] = useState<string | null>(null);

  const handleSheetToggle = (sheetName: string, checked: boolean) => {
    if (checked) {
      onSheetSelection([...selectedSheets, sheetName]);
    } else {
      onSheetSelection(selectedSheets.filter(name => name !== sheetName));
    }
  };

  const toggleSelectAll = () => {
    if (selectedSheets.length === sheets.length) {
      onSheetSelection([]);
    } else {
      onSheetSelection(sheets.map(sheet => sheet.name));
    }
  };

  const togglePreview = (sheetName: string) => {
    if (previewSheet === sheetName) {
      setPreviewSheet(null);
    } else {
      setPreviewSheet(sheetName);
      onPreviewSheet(sheetName);
    }
  };

  if (sheets.length === 0) return null;

  return (
    <Card className="audit-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Available Sheets ({sheets.length})
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSelectAll}
          >
            {selectedSheets.length === sheets.length ? 'Deselect All' : 'Select All'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          {sheets.map((sheet) => (
            <div key={sheet.name} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id={sheet.name}
                    checked={selectedSheets.includes(sheet.name)}
                    onCheckedChange={(checked) => handleSheetToggle(sheet.name, checked as boolean)}
                  />
                  <div>
                    <label htmlFor={sheet.name} className="font-medium cursor-pointer">
                      {sheet.name}
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary">{sheet.rowCount} rows</Badge>
                      <Badge variant="outline">{sheet.headers.length} columns</Badge>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => togglePreview(sheet.name)}
                >
                  {previewSheet === sheet.name ? (
                    <><EyeOff className="h-4 w-4 mr-2" /> Hide</>
                  ) : (
                    <><Eye className="h-4 w-4 mr-2" /> Preview</>
                  )}
                </Button>
              </div>

              {previewSheet === sheet.name && (
                <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                  <h4 className="font-medium mb-2">Headers Preview:</h4>
                  <div className="flex flex-wrap gap-1">
                    {sheet.headers.slice(0, 10).map((header, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {header}
                      </Badge>
                    ))}
                    {sheet.headers.length > 10 && (
                      <Badge variant="outline" className="text-xs">
                        +{sheet.headers.length - 10} more
                      </Badge>
                    )}
                  </div>
                  
                  {sheet.data.length > 0 && (
                    <div className="mt-3">
                      <h4 className="font-medium mb-2">Sample Data (First Row):</h4>
                      <div className="text-sm text-muted-foreground max-h-24 overflow-y-auto">
                        {Object.entries(sheet.data[0]).slice(0, 5).map(([key, value]) => (
                          <div key={key} className="flex gap-2">
                            <span className="font-medium">{key}:</span>
                            <span className="truncate">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SheetProcessor;