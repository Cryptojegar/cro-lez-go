import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AuditSection, AuditItem } from "@/data/auditSections";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import croAuditLogo from "@/assets/cro-audit-logo.png";

interface PDFGeneratorProps {
  auditData: {
    preparedBy: string;
    date: string;
    websiteUrl: string;
  };
  sections: AuditSection[];
}

export const PDFGenerator = ({ auditData, sections }: PDFGeneratorProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          const OPTIMAL_MAX_WIDTH = 800;
          const OPTIMAL_MAX_HEIGHT = 600;
          
          let width = img.width;
          let height = img.height;

          if (width > OPTIMAL_MAX_WIDTH || height > OPTIMAL_MAX_HEIGHT) {
            const aspectRatio = width / height;
            
            if (width > height) {
              width = Math.min(width, OPTIMAL_MAX_WIDTH);
              height = width / aspectRatio;
            } else {
              height = Math.min(height, OPTIMAL_MAX_HEIGHT);
              width = height * aspectRatio;
            }
            
            if (width > OPTIMAL_MAX_WIDTH) {
              width = OPTIMAL_MAX_WIDTH;
              height = width / aspectRatio;
            }
            if (height > OPTIMAL_MAX_HEIGHT) {
              height = OPTIMAL_MAX_HEIGHT;
              width = height * aspectRatio;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const clearCache = () => {
    localStorage.removeItem('cro-audit-data');
    localStorage.removeItem('cro-audit-sections');
    toast({
      title: "Cache Cleared",
      description: "All audit data has been cleared. The page will refresh to start a new audit.",
    });
    window.location.reload();
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    
    try {
      const totalItems = sections.reduce((total, section) => total + section.items.length, 0);
      const completedItems = sections.reduce((total, section) => 
        total + section.items.filter(item => item.status !== null).length, 0);
      const passedItems = sections.reduce((total, section) => 
        total + section.items.filter(item => item.status === 'pass').length, 0);
      const failedItems = sections.reduce((total, section) => 
        total + section.items.filter(item => item.status === 'fail').length, 0);

      const imageData: Record<string, { dataUrl: string; width: number; height: number; }> = {};
      for (const section of sections) {
        for (const item of section.items) {
          if (item.image) {
            try {
              const dataUrl = await compressImage(item.image);
              const img = new Image();
              img.src = dataUrl;
              await img.decode();
              imageData[item.id] = { dataUrl, width: img.width, height: img.height };
            } catch (error) {
              console.warn(`Failed to process image for item ${item.id}:`, error);
            }
          }
        }
      }
      
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const RENDER_WIDTH = 794; 
      const RENDER_HEIGHT = 1123;
      
      // ## Page 1: Cover Page (As Is)
      const coverHTML = `<div style="width:${RENDER_WIDTH}px;height:${RENDER_HEIGHT}px;padding:60px 80px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#363636 0%,#2a2a2a 100%);color:white;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;position:relative;overflow:hidden;"><div style="position:absolute;top:20px;right:20px;bottom:20px;left:20px;border:2px solid #F2CA05;border-radius:20px;opacity:0.3;"></div><div style="position:relative;z-index:2;"><div style="text-align:center;margin-bottom:40px;"><img src="${croAuditLogo}" style="height:120px;display:block;margin:0 auto;filter:brightness(0) invert(1);" alt="CRO Audit Logo"/></div><h1 style="font-size:42px;font-weight:700;margin:0 0 20px 0;letter-spacing:-1px;line-height:1.2;">Conversion Rate Optimization</h1><h2 style="font-size:28px;font-weight:300;margin:0 0 60px 0;color:#F2CA05;">Analysis Report</h2><div style="background:rgba(242,202,5,0.1);backdrop-filter:blur(10px);border-radius:20px;padding:40px;margin:40px 0;border:1px solid rgba(242,202,5,0.3);"><div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;text-align:left;"><div><div style="font-size:14px;color:#F2CA05;margin-bottom:8px;font-weight:600;">Website</div><div style="font-size:18px;font-weight:600;word-break:break-all;">${auditData.websiteUrl||'Not specified'}</div></div><div><div style="font-size:14px;color:#F2CA05;margin-bottom:8px;font-weight:600;">Prepared by</div><div style="font-size:18px;font-weight:600;">${auditData.preparedBy||'Not specified'}</div></div><div><div style="font-size:14px;color:#F2CA05;margin-bottom:8px;font-weight:600;">Date</div><div style="font-size:18px;font-weight:600;">${auditData.date||'Not specified'}</div></div><div><div style="font-size:14px;color:#F2CA05;margin-bottom:8px;font-weight:600;">Pass Rate</div><div style="font-size:24px;font-weight:700;color:#F2CA05;">${completedItems>0?Math.round((passedItems/completedItems)*100):0}%</div></div></div></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-top:40px;text-align:center;"><div style="background:rgba(242,202,5,0.15);padding:20px;border-radius:12px;border:1px solid rgba(242,202,5,0.3);"><div style="font-size:28px;font-weight:700;margin-bottom:5px;color:#F2CA05;">${totalItems}</div><div style="font-size:12px;opacity:0.8;">Total Items</div></div><div style="background:rgba(242,202,5,0.15);padding:20px;border-radius:12px;border:1px solid rgba(242,202,5,0.3);"><div style="font-size:28px;font-weight:700;margin-bottom:5px;color:#F2CA05;">${completedItems}</div><div style="font-size:12px;opacity:0.8;">Completed</div></div><div style="background:rgba(34,197,94,0.2);padding:20px;border-radius:12px;border:1px solid rgba(34,197,94,0.4);"><div style="font-size:28px;font-weight:700;margin-bottom:5px;color:#22c55e;">${passedItems}</div><div style="font-size:12px;opacity:0.8;">Passed</div></div><div style="background:rgba(239,68,68,0.2);padding:20px;border-radius:12px;border:1px solid rgba(239,68,68,0.4);"><div style="font-size:28px;font-weight:700;margin-bottom:5px;color:#ef4444;">${failedItems}</div><div style="font-size:12px;opacity:0.8;">Failed</div></div></div></div></div>`;
      const coverDiv = document.createElement('div');
      coverDiv.style.position = 'absolute'; coverDiv.style.left = '-9999px';
      coverDiv.innerHTML = coverHTML;
      document.body.appendChild(coverDiv);
      const coverCanvas = await html2canvas(coverDiv, { scale: 1, useCORS: true, width: RENDER_WIDTH, height: RENDER_HEIGHT, backgroundColor: null });
      pdf.addImage(coverCanvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, pdfWidth, pdfHeight);
      document.body.removeChild(coverDiv);

      pdf.addPage();
      const sectionPages: Record<number, number> = {};

      const MARGIN = 15;
      const contentWidth = pdfWidth - (MARGIN * 2);
      
      const drawPageHeader = (section: AuditSection, index: number) => {
        pdf.setFillColor(42, 42, 42);
        pdf.rect(0, 0, pdfWidth, 25, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor('#F2CA05');
        pdf.text(`SECTION ${String(index + 1).padStart(2, '0')}`, MARGIN, 15);
        pdf.setFontSize(14);
        pdf.setTextColor(255, 255, 255);
        pdf.text(section.title, MARGIN, 21);
      };
      
      for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
        const section = sections[sectionIndex];
        pdf.addPage();
        sectionPages[sectionIndex] = pdf.internal.getNumberOfPages();
        drawPageHeader(section, sectionIndex);
        
        let currentY = 35;

        for (const item of section.items) {
          // **FINAL FIX: Added 'optional' status**
          const statusConfig = {
            pass: { text: 'PASS', bg: '#22c55e' },
            fail: { text: 'FAIL', bg: '#ef4444' },
            optional: { text: 'OPTIONAL', bg: '#64748b' }, // Neutral gray for optional
            null: { text: 'PENDING', bg: '#eab308' }
          };
          const status = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.null;
          
          let imageDimensions = { width: 0, height: 0 };
          if (imageData[item.id]) {
            const imgMeta = imageData[item.id];
            const aspectRatio = imgMeta.width / imgMeta.height;
            const maxImgWidth = contentWidth - 10;
            const maxImgHeight = 90;

            let finalWidth = maxImgWidth;
            let finalHeight = finalWidth / aspectRatio;

            if (finalHeight > maxImgHeight) {
                finalHeight = maxImgHeight;
                finalWidth = finalHeight * aspectRatio;
            }
            imageDimensions = { width: finalWidth, height: finalHeight };
          }

          let cardHeight = 20;
          pdf.setFont('helvetica', 'bold');
          const titleLines = pdf.splitTextToSize(item.title, contentWidth - 45);
          cardHeight += titleLines.length * 5;

          pdf.setFont('helvetica', 'normal');
          const descLines = pdf.splitTextToSize(item.description, contentWidth - 10);
          cardHeight += descLines.length * 5 + 5;

          if (item.explanation) {
            const expLines = pdf.splitTextToSize(item.explanation, contentWidth - 20);
            cardHeight += expLines.length * 5 + 15;
          }
          if (imageData[item.id]) {
            cardHeight += imageDimensions.height + 10;
          }

          if (currentY + cardHeight > pdfHeight - 20) {
            pdf.addPage();
            drawPageHeader(section, sectionIndex);
            currentY = 35;
          }
          
          const cardY = currentY;

          pdf.setFillColor(255, 255, 255);
          pdf.setDrawColor(229, 231, 235);
          pdf.setLineWidth(0.5);
          pdf.roundedRect(MARGIN, cardY, contentWidth, cardHeight, 3, 3, 'FD');
          pdf.setDrawColor("#F2CA05");
          pdf.setLineWidth(1);
          pdf.line(MARGIN, cardY, MARGIN + contentWidth, cardY);

          let textY = cardY + 12;

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          pdf.setFillColor(status.bg);
          pdf.setTextColor(255, 255, 255);
          const statusWidth = pdf.getStringUnitWidth(status.text) * pdf.getFontSize() / pdf.internal.scaleFactor + 8;
          pdf.roundedRect(pdfWidth - MARGIN - statusWidth, cardY + 8, statusWidth, 6, 3, 3, 'F');
          pdf.text(status.text, pdfWidth - MARGIN - statusWidth / 2, cardY + 12, { align: 'center' });

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(11);
          pdf.setTextColor(42, 42, 42);
          pdf.text(titleLines, MARGIN + 5, textY);
          textY += titleLines.length * 5 + 3;

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);
          pdf.text(descLines, MARGIN + 5, textY);
          textY += descLines.length * 5 + 5;

          if (item.explanation) {
            const expLines = pdf.splitTextToSize(item.explanation, contentWidth - 20);
            const expHeight = expLines.length * 5 + 8;
            pdf.setFillColor(254, 252, 232);
            pdf.roundedRect(MARGIN + 5, textY, contentWidth - 10, expHeight, 2, 2, 'F');
            pdf.setDrawColor("#F2CA05");
            pdf.setLineWidth(0.5);
            pdf.line(MARGIN + 5, textY, MARGIN + 5, textY + expHeight);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(80, 80, 80);
            pdf.text(expLines, MARGIN + 8, textY + 6);
            textY += expHeight + 5;
          }
          
          if (imageData[item.id]) {
            const imgData = imageData[item.id];
            const imgX = (pdfWidth - imageDimensions.width) / 2;
            pdf.addImage(imgData.dataUrl, 'JPEG', imgX, textY, imageDimensions.width, imageDimensions.height);
          }
          
          currentY += cardHeight + 8;
        }
      }
      
      pdf.setPage(2);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(28);
      pdf.setTextColor('#2c2c2c');
      pdf.text('Table of Contents', pdfWidth / 2, 35, { align: 'center' });
      pdf.setDrawColor('#F2CA05');
      pdf.setLineWidth(1);
      pdf.line(pdfWidth / 2 - 40, 39, pdfWidth / 2 + 40, 39);

      const tocStartY = 55;
      const col1X = 20;
      const tocColWidth = (pdfWidth - col1X * 2 - 10) / 2;
      const col2X = col1X + tocColWidth + 10;
      const tocItemHeight = 38;
      const tocVerticalGap = 8;

      sections.forEach((section, index) => {
        const rowIndex = Math.floor(index / 2);
        const colIndex = index % 2;
        const x = colIndex === 0 ? col1X : col2X;
        const y = tocStartY + rowIndex * (tocItemHeight + tocVerticalGap);
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(229, 231, 235);
        pdf.setLineWidth(0.2);
        pdf.roundedRect(x, y, tocColWidth, tocItemHeight, 3, 3, 'FD');
        pdf.setDrawColor('#F2CA05');
        pdf.setLineWidth(0.8);
        pdf.line(x, y, x + tocColWidth, y);
        const numBoxX = x + 4, numBoxY = y + 5, numBoxSize = 7;
        pdf.setFillColor('#F2CA05');
        pdf.roundedRect(numBoxX, numBoxY, numBoxSize, numBoxSize, 1.5, 1.5, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor('#2c2c2c');
        pdf.text(String(index + 1).padStart(2, '0'), numBoxX + numBoxSize / 2, numBoxY + 5.2, { align: 'center' });
        pdf.setFontSize(8);
        pdf.setTextColor('#2c2c2c');
        const titleLines = pdf.splitTextToSize(section.title, tocColWidth - 15);
        pdf.text(titleLines, x + 14, y + 9);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(107, 114, 128);
        const descLines = pdf.splitTextToSize(section.description, tocColWidth - 18);
        pdf.text(descLines, x + 14, y + 18);
        const badgeText = `${section.items.length} Items`;
        const badgeFontSize = 6;
        pdf.setFontSize(badgeFontSize);
        const badgeWidth = pdf.getStringUnitWidth(badgeText) * badgeFontSize / pdf.internal.scaleFactor + 5;
        const badgeX = x + tocColWidth - badgeWidth - 4;
        const badgeY = y + tocItemHeight - 9;
        pdf.setFillColor(254, 252, 232);
        pdf.setDrawColor(242, 202, 5, 0.5);
        pdf.setLineWidth(0.2);
        pdf.roundedRect(badgeX, badgeY, badgeWidth, 5, 2.5, 2.5, 'FD');
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(180, 83, 9);
        pdf.text(badgeText, badgeX + 2.5, badgeY + 3.5);
        if (sectionPages[index]) {
            pdf.link(x, y, tocColWidth, tocItemHeight, { pageNumber: sectionPages[index] });
        }
      });

      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 2; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        const footerText = `Page ${i} of ${totalPages} | ${auditData.websiteUrl}`;
        pdf.text(footerText, pdfWidth / 2, pdfHeight - 8, { align: 'center' });
      }

      const fileName = `CRO-Audit-Report-${auditData.websiteUrl.replace(/[^a-zA-Z0-9]/g, '-')}-${auditData.date}.pdf`;
      pdf.save(fileName);

      toast({
        title: "PDF Downloaded Successfully",
        description: "Your modern CRO audit report has been generated.",
      });

    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "Generation Failed",
        description: "Unable to create PDF report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const completedItems = sections.reduce((total, section) => 
    total + section.items.filter(item => item.status !== null).length, 0);
  const totalItems = sections.reduce((total, section) => total + section.items.length, 0);

  return (
    <Card className="audit-card p-6 border" style={{ 
      backgroundColor: '#2a2a2a', 
      borderColor: '#404040' 
    }}>
        <div className="space-y-6">
            <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4" style={{ background: '#363636' }}>
                    <FileDown className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-2 text-white">Generate PDF Report</h3>
                <p className="max-w-md mx-auto leading-relaxed" style={{ color: '#a1a1aa' }}>
                    Create a professional, modern PDF report with all audit findings, recommendations, and visual evidence.
                </p>
            </div>
            <div className="rounded-lg p-4 border" style={{ backgroundColor: '#1f1f1f', borderColor: '#404040' }}>
                <div className="flex items-center justify-between text-sm">
                    <span style={{ color: '#a1a1aa' }}>Progress</span>
                    <span className="font-semibold text-white">
                        {completedItems}/{totalItems} items ({totalItems > 0 ? Math.round((completedItems/totalItems)*100) : 0}%)
                    </span>
                </div>
                <div className="mt-2 rounded-full h-2" style={{ backgroundColor: '#404040' }}>
                    <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${totalItems > 0 ? (completedItems/totalItems)*100 : 0}%`, backgroundColor: '#F2CA05' }}/>
                </div>
            </div>
            <Button onClick={generatePDF} disabled={isGenerating || completedItems === 0} className="w-full h-12 text-white font-semibold rounded-lg transition-all duration-200 hover:opacity-90 border-0" style={{ backgroundColor: isGenerating || completedItems === 0 ? '#555555' : '#F2CA05', color: isGenerating || completedItems === 0 ? '#a1a1aa' : '#363636' }}>
                {isGenerating ? ( <> <Loader2 className="h-5 w-5 mr-3 animate-spin" /> Generating Report... </> ) : ( <> <FileDown className="h-5 w-5 mr-3" /> Download PDF Report </> )}
            </Button>
            <Button onClick={clearCache} variant="outline" className="w-full h-10 mt-3 border-2 transition-all duration-200 hover:bg-muted" style={{ borderColor: '#F2CA05', color: '#F2CA05' }}>
                Clear Cache & Start New Audit
            </Button>
            {completedItems === 0 && (
                <div className="text-center p-4 rounded-lg border" style={{ backgroundColor: 'rgba(242, 202, 5, 0.1)', borderColor: 'rgba(242, 202, 5, 0.3)' }}>
                    <p className="text-sm font-medium" style={{ color: '#F2CA05' }}>
                        Complete at least one audit item to generate your report.
                    </p>
                </div>
            )}
        </div>
    </Card>
  );
};