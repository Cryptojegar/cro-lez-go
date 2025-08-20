import { useState } from "react";
import { Calendar, User, Globe } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import croAuditLogo from "@/assets/cro-audit-logo.png";

interface AuditHeaderProps {
  auditData: {
    preparedBy: string;
    date: string;
    websiteUrl: string;
  };
  onDataChange: (data: any) => void;
}

export const AuditHeader = ({ auditData, onDataChange }: AuditHeaderProps) => {
  const updateField = (field: string, value: string) => {
    onDataChange({ ...auditData, [field]: value });
  };

  return (
    <Card className="audit-header p-6 mb-8">
      <div className="flex items-center gap-4 mb-6">
        <img 
          src={croAuditLogo} 
          alt="CRO Audit" 
          className="h-12 w-auto"
        />
        <div>
          <h1 className="text-3xl font-bold text-primary">CRO AUDIT REPORT</h1>
          <p className="text-muted-foreground">Conversion Rate Optimization Analysis</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label htmlFor="preparedBy" className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Prepared By
          </Label>
          <Input
            id="preparedBy"
            value={auditData.preparedBy}
            onChange={(e) => updateField('preparedBy', e.target.value)}
            placeholder="Enter your name"
            className="bg-input border-border focus:ring-primary"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date" className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Date
          </Label>
          <Input
            id="date"
            type="date"
            value={auditData.date}
            onChange={(e) => updateField('date', e.target.value)}
            className="bg-input border-border focus:ring-primary"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="websiteUrl" className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Website URL
          </Label>
          <Input
            id="websiteUrl"
            value={auditData.websiteUrl}
            onChange={(e) => updateField('websiteUrl', e.target.value)}
            placeholder="https://example.com"
            className="bg-input border-border focus:ring-primary"
          />
        </div>
      </div>
    </Card>
  );
};