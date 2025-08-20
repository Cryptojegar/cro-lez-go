import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronRight, Check, X, Camera, Upload, CircleDot } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AuditSection as AuditSectionType, AuditItem } from "@/data/auditSections";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface AuditSectionProps {
  section: AuditSectionType;
  onItemUpdate: (sectionId: string, itemId: string, updates: Partial<AuditItem>) => void;
}

export const AuditSection = ({ section, onItemUpdate }: AuditSectionProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement }>({});
  
  const isValidStatus = (status: any) => {
    return status && typeof status === 'string' && ['pass', 'fail', 'optional'].includes(status);
  };
  
  const completedItems = section.items.filter(item => isValidStatus(item.status)).length;
  const passedItems = section.items.filter(item => item.status === 'pass').length;
  const failedItems = section.items.filter(item => item.status === 'fail').length;
  const optionalItems = section.items.filter(item => item.status === 'optional').length;

  const handleStatusChange = (itemId: string, status: 'pass' | 'fail' | 'optional') => {
    const updates: Partial<AuditItem> = { status };
    
    // Clear image when switching to 'pass' status
    if (status === 'pass') {
      updates.image = null;
      updates.explanation = '';
    }
    
    onItemUpdate(section.id, itemId, updates);
  };

  const handleExplanationChange = (itemId: string, explanation: string) => {
    onItemUpdate(section.id, itemId, { explanation });
  };

  const handleImageUpload = (itemId: string, file: File | null) => {
    onItemUpdate(section.id, itemId, { image: file });
  };

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent, itemId: string) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') === 0) {
          const file = item.getAsFile();
          if (file) {
            handleImageUpload(itemId, file);
            e.preventDefault();
          }
        }
      }
    };

    // Add paste listeners to textareas
    Object.entries(textareaRefs.current).forEach(([itemId, textarea]) => {
      const pasteHandler = (e: ClipboardEvent) => handlePaste(e, itemId);
      textarea.addEventListener('paste', pasteHandler);
      
      // Cleanup
      return () => textarea.removeEventListener('paste', pasteHandler);
    });
  }, [section.items]);

  return (
    <Card className="audit-card">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="audit-section p-6 cursor-pointer hover:bg-muted/20 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown className="h-5 w-5 text-primary" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-primary" />
                )}
                <div>
                  <h3 className="text-xl font-semibold">{section.title}</h3>
                  <p className="text-muted-foreground text-sm">{section.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-success">{passedItems} passed</span>
                <span className="text-destructive">{failedItems} failed</span>
                <span className="text-warning">{optionalItems} optional</span>
                <span className="text-muted-foreground">
                  {completedItems}/{section.items.length} completed
                </span>
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-6 pb-6 space-y-4">
            {section.items.map((item) => (
              <div key={item.id} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-medium">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={item.status === 'pass' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleStatusChange(item.id, 'pass')}
                      className={item.status === 'pass' ? 'bg-success hover:bg-success/90' : ''}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={item.status === 'fail' ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => handleStatusChange(item.id, 'fail')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={item.status === 'optional' ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => handleStatusChange(item.id, 'optional')}
                      className={item.status === 'optional' ? 'bg-warning hover:bg-warning/90 text-warning-foreground' : ''}
                    >
                      <CircleDot className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {(item.status === 'fail' || item.status === 'optional') && (
                  <div className="space-y-3 pt-3 border-t border-border">
                    <div>
                      <Label htmlFor={`explanation-${item.id}`} className="text-sm font-medium">
                        {item.status === 'fail' ? 'Issue & Recommendations' : 'Optional Notes & Suggestions'}
                      </Label>
                      <Textarea
                        ref={(el) => {
                          if (el) textareaRefs.current[item.id] = el;
                        }}
                        id={`explanation-${item.id}`}
                        value={item.explanation || ''}
                        onChange={(e) => handleExplanationChange(item.id, e.target.value)}
                        placeholder={
                          item.status === 'fail' 
                            ? "Describe the issue and provide recommendations for improvement... (You can also paste images here with Ctrl+V)" 
                            : "Add optional notes or suggestions... (You can also paste images here with Ctrl+V)"
                        }
                        className="mt-1 bg-input border-border"
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Camera className="h-4 w-4" />
                        Upload Screenshot (Optional) - You can also paste with Ctrl+V
                      </Label>
                      <div className="mt-1 flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            handleImageUpload(item.id, file);
                          }}
                          className="bg-input border-border"
                        />
                        {item.image && (
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-12 rounded border border-border overflow-hidden bg-muted">
                              <img 
                                src={URL.createObjectURL(item.image)} 
                                alt="Uploaded screenshot" 
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex items-center gap-1 text-sm text-success">
                              <Upload className="h-4 w-4" />
                              Image uploaded
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};