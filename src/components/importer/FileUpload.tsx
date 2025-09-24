import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, X } from "lucide-react";

interface FileUploadProps {
  onCLRFileUpload: (file: File) => void;
  onTemplateUpload: (file: File) => void;
  clrFile: File | null;
  templateFile: File | null;
}

const FileUpload = ({ onCLRFileUpload, onTemplateUpload, clrFile, templateFile }: FileUploadProps) => {
  const clrInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);

  const handleCLRUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onCLRFileUpload(file);
  };

  const handleTemplateUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onTemplateUpload(file);
  };

  const removeCLRFile = () => {
    onCLRFileUpload(null as any);
    if (clrInputRef.current) clrInputRef.current.value = '';
  };

  const removeTemplateFile = () => {
    onTemplateUpload(null as any);
    if (templateInputRef.current) templateInputRef.current.value = '';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* CLR File Upload */}
      <Card className="audit-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload CLR File
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="clr-upload">Amazon CLR Data File</Label>
            <Input
              id="clr-upload"
              type="file"
              accept=".xlsx,.xlsm,.xls,.csv"
              onChange={handleCLRUpload}
              ref={clrInputRef}
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Excel files with multiple sheets supported
            </p>
          </div>

          {clrFile && (
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{clrFile.name}</span>
                  <span className="text-sm text-muted-foreground">
                    ({(clrFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={removeCLRFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template Upload */}
      <Card className="audit-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Template CSV (Optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="template-upload">Shopify Product Template</Label>
            <Input
              id="template-upload"
              type="file"
              accept=".csv"
              onChange={handleTemplateUpload}
              ref={templateInputRef}
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Optional: Use your own Shopify template
            </p>
          </div>

          {templateFile && (
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{templateFile.name}</span>
                  <span className="text-sm text-muted-foreground">
                    ({(templateFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={removeTemplateFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FileUpload;