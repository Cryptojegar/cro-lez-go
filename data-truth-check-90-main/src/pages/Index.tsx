import { useState, useEffect } from "react";
import { AuditHeader } from "@/components/audit/AuditHeader";
import { ProgressBar } from "@/components/audit/ProgressBar";
import { AuditSection } from "@/components/audit/AuditSection";
import { PDFGenerator } from "@/components/audit/PDFGenerator";
import { auditSections, AuditItem } from "@/data/auditSections";

const Index = () => {
  const [auditData, setAuditData] = useState({
    preparedBy: '',
    date: new Date().toISOString().split('T')[0],
    websiteUrl: ''
  });

  const [sections, setSections] = useState(auditSections);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('cro-audit-data');
    const savedSections = localStorage.getItem('cro-audit-sections');
    
    if (savedData) {
      setAuditData(JSON.parse(savedData));
    }
    
    if (savedSections) {
      setSections(JSON.parse(savedSections));
    }
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('cro-audit-data', JSON.stringify(auditData));
  }, [auditData]);

  useEffect(() => {
    localStorage.setItem('cro-audit-sections', JSON.stringify(sections));
  }, [sections]);

  const handleItemUpdate = (sectionId: string, itemId: string, updates: Partial<AuditItem>) => {
    setSections(prevSections => 
      prevSections.map(section => 
        section.id === sectionId 
          ? {
              ...section,
              items: section.items.map(item => 
                item.id === itemId ? { ...item, ...updates } : item
              )
            }
          : section
      )
    );
  };

  // Calculate progress statistics
  const totalItems = sections.reduce((total, section) => total + section.items.length, 0);
  const completedItems = sections.reduce((total, section) => 
    total + section.items.filter(item => item.status !== null).length, 0);
  const passedItems = sections.reduce((total, section) => 
    total + section.items.filter(item => item.status === 'pass').length, 0);
  const failedItems = sections.reduce((total, section) => 
    total + section.items.filter(item => item.status === 'fail').length, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <AuditHeader 
          auditData={auditData}
          onDataChange={setAuditData}
        />

        <ProgressBar
          totalItems={totalItems}
          completedItems={completedItems}
          passedItems={passedItems}
          failedItems={failedItems}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {sections.map(section => (
              <AuditSection
                key={section.id}
                section={section}
                onItemUpdate={handleItemUpdate}
              />
            ))}
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <PDFGenerator
                auditData={auditData}
                sections={sections}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
