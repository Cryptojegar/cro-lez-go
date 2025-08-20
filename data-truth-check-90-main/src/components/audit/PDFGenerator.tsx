import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AuditSection } from "@/data/auditSections";
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
          
          // Optimal dimensions for PDF display
          const OPTIMAL_MAX_WIDTH = 600;
          const OPTIMAL_MAX_HEIGHT = 400;
          
          let width = img.width;
          let height = img.height;

          // Only resize if image is larger than optimal dimensions
          // If smaller, retain original size to avoid unnecessary white space
          if (width > OPTIMAL_MAX_WIDTH || height > OPTIMAL_MAX_HEIGHT) {
            const aspectRatio = width / height;
            
            // Calculate new dimensions maintaining aspect ratio
            if (width > height) {
              width = Math.min(width, OPTIMAL_MAX_WIDTH);
              height = width / aspectRatio;
            } else {
              height = Math.min(height, OPTIMAL_MAX_HEIGHT);
              width = height * aspectRatio;
            }
            
            // Final check to ensure neither dimension exceeds limits
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
          resolve(canvas.toDataURL('image/jpeg', 0.8));
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
    // Refresh the page to reload default data
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

      const imageData: Record<string, string> = {};
      for (const section of sections) {
        for (const item of section.items) {
          if (item.image) {
            try {
              imageData[item.id] = await compressImage(item.image);
            } catch (error) {
              console.warn(`Failed to process image for item ${item.id}:`, error);
            }
          }
        }
      }
      
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Fixed dimensions for consistent rendering
      const RENDER_WIDTH = 794; // A4 width in pixels at 96 DPI
      const RENDER_HEIGHT = 1123; // A4 height in pixels at 96 DPI
      
      // Generate cover page
      const coverHTML = `
        <div style="
          width: ${RENDER_WIDTH}px;
          height: ${RENDER_HEIGHT}px;
          padding: 60px 80px;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #363636 0%, #2a2a2a 100%);
          color: white;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          position: relative;
          overflow: hidden;
        ">
          <div style="position: absolute; top: 20px; right: 20px; bottom: 20px; left: 20px; border: 2px solid #F2CA05; border-radius: 20px; opacity: 0.3;"></div>
          <div style="position: relative; z-index: 2;">
            <div style="text-align: center; margin-bottom: 40px;">
              <img src="${croAuditLogo}" style="
                height: 120px; 
                display: block;
                margin: 0 auto;
                filter: brightness(0) invert(1);
              " alt="CRO Audit Logo" />
            </div>
            <h1 style="
              font-size: 42px; 
              font-weight: 700; 
              margin: 0 0 20px 0; 
              letter-spacing: -1px;
              line-height: 1.2;
            ">Conversion Rate Optimization</h1>
            <h2 style="
              font-size: 28px; 
              font-weight: 300; 
              margin: 0 0 60px 0; 
              color: #F2CA05;
            ">Analysis Report</h2>
            
            <div style="
              background: rgba(242, 202, 5, 0.1);
              backdrop-filter: blur(10px);
              border-radius: 20px;
              padding: 40px;
              margin: 40px 0;
              border: 1px solid rgba(242, 202, 5, 0.3);
            ">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; text-align: left;">
                <div>
                  <div style="font-size: 14px; color: #F2CA05; margin-bottom: 8px; font-weight: 600;">Website</div>
                  <div style="font-size: 18px; font-weight: 600; word-break: break-all;">${auditData.websiteUrl || 'Not specified'}</div>
                </div>
                <div>
                  <div style="font-size: 14px; color: #F2CA05; margin-bottom: 8px; font-weight: 600;">Prepared by</div>
                  <div style="font-size: 18px; font-weight: 600;">${auditData.preparedBy || 'Not specified'}</div>
                </div>
                <div>
                  <div style="font-size: 14px; color: #F2CA05; margin-bottom: 8px; font-weight: 600;">Date</div>
                  <div style="font-size: 18px; font-weight: 600;">${auditData.date || 'Not specified'}</div>
                </div>
                <div>
                  <div style="font-size: 14px; color: #F2CA05; margin-bottom: 8px; font-weight: 600;">Pass Rate</div>
                  <div style="font-size: 24px; font-weight: 700; color: #F2CA05;">${completedItems > 0 ? Math.round((passedItems/completedItems)*100) : 0}%</div>
                </div>
              </div>
            </div>
            
            <div style="
              display: grid; 
              grid-template-columns: repeat(4, 1fr); 
              gap: 20px; 
              margin-top: 40px;
              text-align: center;
            ">
              <div style="background: rgba(242, 202, 5, 0.15); padding: 20px; border-radius: 12px; border: 1px solid rgba(242, 202, 5, 0.3);">
                <div style="font-size: 28px; font-weight: 700; margin-bottom: 5px; color: #F2CA05;">${totalItems}</div>
                <div style="font-size: 12px; opacity: 0.8;">Total Items</div>
              </div>
              <div style="background: rgba(242, 202, 5, 0.15); padding: 20px; border-radius: 12px; border: 1px solid rgba(242, 202, 5, 0.3);">
                <div style="font-size: 28px; font-weight: 700; margin-bottom: 5px; color: #F2CA05;">${completedItems}</div>
                <div style="font-size: 12px; opacity: 0.8;">Completed</div>
              </div>
              <div style="background: rgba(34, 197, 94, 0.2); padding: 20px; border-radius: 12px; border: 1px solid rgba(34, 197, 94, 0.4);">
                <div style="font-size: 28px; font-weight: 700; margin-bottom: 5px; color: #22c55e;">${passedItems}</div>
                <div style="font-size: 12px; opacity: 0.8;">Passed</div>
              </div>
              <div style="background: rgba(239, 68, 68, 0.2); padding: 20px; border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.4);">
                <div style="font-size: 28px; font-weight: 700; margin-bottom: 5px; color: #ef4444;">${failedItems}</div>
                <div style="font-size: 12px; opacity: 0.8;">Failed</div>
              </div>
            </div>
          </div>
        </div>
      `;

      const coverDiv = document.createElement('div');
      coverDiv.style.position = 'absolute';
      coverDiv.style.left = '-9999px';
      coverDiv.style.top = '0px';
      coverDiv.innerHTML = coverHTML;
      document.body.appendChild(coverDiv);

      const coverCanvas = await html2canvas(coverDiv, {
        scale: 1,
        useCORS: true,
        width: RENDER_WIDTH,
        height: RENDER_HEIGHT,
        backgroundColor: null
      });
      
      pdf.addImage(coverCanvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, pdfWidth, pdfHeight);
      document.body.removeChild(coverDiv);

      // Generate Table of Contents page
      pdf.addPage();
      
      const tocHTML = `
        <div style="
           width: ${RENDER_WIDTH}px;
           height: ${RENDER_HEIGHT}px;
           padding: 40px 60px;
           box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f8f9fa;
          color: #363636;
        ">
           <div style="text-align: center; margin-bottom: 35px;">
             <h1 style="
              font-size: 32px; 
              font-weight: 700; 
              color: #2c2c2c; 
              margin: 0 0 16px 0;
              letter-spacing: -1px;
            ">Table of Contents</h1>
            <div style="
              width: 100px; 
              height: 3px; 
              background: linear-gradient(90deg, #F2CA05 0%, #e6b400 100%); 
              margin: 0 auto; 
              border-radius: 2px;
            "></div>
          </div>
          
          <div style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px;
            max-width: 720px;
            margin: 0 auto;
          ">
            ${sections.map((section, index) => `
              <div style="
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-radius: 12px;
                padding: 18px;
                position: relative;
                overflow: hidden;
                box-shadow: 0 3px 8px rgba(0, 0, 0, 0.06);
                min-height: 90px;
                display: flex;
                flex-direction: column;
                cursor: pointer;
              ">
                <div style="
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  height: 3px;
                  background: linear-gradient(90deg, #F2CA05 0%, #e6b400 100%);
                "></div>
                
                <div style="position: relative; z-index: 2; padding-top: 4px; flex: 1; display: flex; flex-direction: column;">
                  <div style="
                    display: flex; 
                    align-items: flex-start; 
                    margin-bottom: 8px;
                  ">
                    <div style="
                      width: 28px;
                      height: 28px;
                      background: linear-gradient(135deg, #F2CA05 0%, #e6b400 100%);
                      border-radius: 6px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      margin-right: 10px;
                      font-weight: 700;
                      font-size: 12px;
                      color: #2c2c2c;
                      flex-shrink: 0;
                    ">${String(index + 1).padStart(2, '0')}</div>
                    <div style="flex: 1; min-width: 0;">
                      <h3 style="
                        font-size: 14px; 
                        font-weight: 700; 
                        color: #2c2c2c; 
                        margin: 0 0 3px 0;
                        line-height: 1.2;
                      ">${section.title}</h3>
                    </div>
                  </div>
                  <p style="
                    color: #6b7280; 
                    font-size: 11px; 
                    margin: 0 0 12px 0; 
                    line-height: 1.3;
                    padding-left: 38px;
                    flex: 1;
                  ">${section.description}</p>
                  
                  <div style="
                    display: flex;
                    justify-content: flex-end;
                    margin-top: auto;
                  ">
                    <div style="
                      background: rgba(242, 202, 5, 0.12);
                      border: 1px solid rgba(242, 202, 5, 0.25);
                      border-radius: 16px;
                      padding: 4px 10px;
                      display: inline-flex;
                      align-items: center;
                    ">
                      <span style="
                        font-size: 10px; 
                        font-weight: 600; 
                        color: #b45309;
                      ">${section.items.length} Items</span>
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      const tocDiv = document.createElement('div');
      tocDiv.style.position = 'absolute';
      tocDiv.style.left = '-9999px';
      tocDiv.innerHTML = tocHTML;
      document.body.appendChild(tocDiv);

      const tocCanvas = await html2canvas(tocDiv, {
        scale: 1,
        useCORS: true,
        width: RENDER_WIDTH,
        height: RENDER_HEIGHT,
        backgroundColor: 'white'
      });
      
      pdf.addImage(tocCanvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, pdfWidth, pdfHeight);
      document.body.removeChild(tocDiv);

      // Store page numbers for each section for TOC links
      const sectionPages: Record<number, number> = {};

      // Generate content pages for each section
      for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
        const section = sections[sectionIndex];
        
        // Store the page number where this section starts
        sectionPages[sectionIndex] = pdf.internal.pages.length;
        
        pdf.addPage();
        
        let currentY = 0;
        
        // Section header with modern design
        const sectionHeaderHTML = `
          <div style="
            width: ${RENDER_WIDTH}px;
            padding: 40px 60px 0;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: white;
          ">
            <div style="
              background: linear-gradient(135deg, #363636 0%, #2a2a2a 100%);
              color: white;
              padding: 30px;
              border-radius: 16px;
              margin-bottom: 30px;
              box-shadow: 0 10px 25px rgba(54, 54, 54, 0.15);
              position: relative;
              overflow: hidden;
            ">
              <div style="
                position: absolute;
                top: -50%;
                right: -10%;
                width: 200px;
                height: 200px;
                background: radial-gradient(circle, rgba(242, 202, 5, 0.1) 0%, transparent 70%);
                border-radius: 50%;
              "></div>
              <div style="position: relative; z-index: 2;">
                <div style="
                  display: flex;
                  align-items: center;
                  margin-bottom: 16px;
                ">
                  <div style="
                    width: 40px;
                    height: 40px;
                    background: #F2CA05;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 16px;
                    font-weight: 700;
                    font-size: 16px;
                    color: #363636;
                  ">${String(sectionIndex + 1).padStart(2, '0')}</div>
                  <h2 style="
                    font-size: 28px; 
                    font-weight: 700; 
                    margin: 0;
                    letter-spacing: -0.5px;
                  ">${section.title}</h2>
                </div>
                <p style="
                  font-size: 16px; 
                  margin: 0; 
                  color: rgba(255, 255, 255, 0.9);
                  line-height: 1.5;
                ">${section.description}</p>
                <div style="
                  margin-top: 16px;
                  padding: 12px 16px;
                  background: rgba(242, 202, 5, 0.1);
                  border-radius: 8px;
                  border-left: 3px solid #F2CA05;
                ">
                  <span style="
                    font-size: 14px;
                    color: #F2CA05;
                    font-weight: 600;
                  ">${section.items.length} items to review in this section</span>
                </div>
              </div>
            </div>
          </div>
        `;
        
        const headerDiv = document.createElement('div');
        headerDiv.style.position = 'absolute';
        headerDiv.style.left = '-9999px';
        headerDiv.innerHTML = sectionHeaderHTML;
        document.body.appendChild(headerDiv);

        const headerCanvas = await html2canvas(headerDiv, {
          scale: 1,
          useCORS: true,
          width: RENDER_WIDTH,
          backgroundColor: 'white'
        });
        
        document.body.removeChild(headerDiv);
        
        const headerHeight = (headerCanvas.height * pdfWidth) / RENDER_WIDTH;
        pdf.addImage(
          headerCanvas.toDataURL('image/jpeg', 0.9),
          'JPEG',
          0,
          0,
          pdfWidth,
          headerHeight
        );
        
        currentY = headerHeight + 5;
        
        // Process items
        for (const item of section.items) {
          const statusConfig = {
            pass: { text: '✓ PASS', bg: '#dcfce7', color: '#166534', border: '#22c55e' },
            fail: { text: '✗ FAIL', bg: '#fef2f2', color: '#dc2626', border: '#ef4444' },
            null: { text: '○ PENDING', bg: '#fefce8', color: '#F2CA05', border: '#F2CA05' }
          };
          
          const status = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.null;
          const imageHTML = (item.image && imageData[item.id]) ? 
            `<div style="margin-top: 16px; text-align: center;">
              <img src="${imageData[item.id]}" style="
                border-radius: 8px; 
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                display: block;
                margin: 0 auto;
                max-width: 500px;
                max-height: 300px;
                width: auto;
                height: auto;
              " alt="Issue screenshot" />
            </div>` : '';
          
          const explanationHTML = item.explanation ? 
            `<div style="
              margin-top: 16px; 
              padding: 20px; 
              background: #f8fafc; 
              border-radius: 12px; 
              border-left: 4px solid #F2CA05;
              position: relative;
            ">
              <div style="
                font-weight: 600; 
                color: #363636; 
                margin-bottom: 8px; 
                font-size: 14px;
              ">💡 Issue & Recommendations</div>
              <div style="
                color: #475569; 
                line-height: 1.6; 
                font-size: 14px;
              ">${item.explanation}</div>
            </div>` : '';

          const itemHTML = `
            <div style="
              width: ${RENDER_WIDTH}px;
              padding: 20px 60px;
              box-sizing: border-box;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: white;
            ">
              <div style="
                background: white;
                border-radius: 16px;
                padding: 24px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                border: 1px solid #e2e8f0;
                margin-bottom: 16px;
              ">
                <div style="
                  font-weight: 700; 
                  font-size: 18px; 
                  color: #1e293b; 
                  margin-bottom: 12px;
                  line-height: 1.4;
                ">${item.title}</div>
                
                <p style="
                  color: #64748b; 
                  font-size: 14px; 
                  line-height: 1.6; 
                  margin: 0 0 16px 0;
                ">${item.description}</p>
                
                <div style="margin-bottom: 16px;">
                  <span style="
                    display: inline-flex;
                    align-items: center;
                    padding: 8px 16px; 
                    border-radius: 20px; 
                    font-size: 13px; 
                    font-weight: 600;
                    background: ${status.bg};
                    color: ${status.color};
                    border: 1px solid ${status.border};
                  ">${status.text}</span>
                </div>
                
                ${explanationHTML}
                ${imageHTML}
              </div>
            </div>
          `;

          const itemDiv = document.createElement('div');
          itemDiv.style.position = 'absolute';
          itemDiv.style.left = '-9999px';
          itemDiv.innerHTML = itemHTML;
          document.body.appendChild(itemDiv);

          const itemCanvas = await html2canvas(itemDiv, {
            scale: 1,
            useCORS: true,
            width: RENDER_WIDTH,
            backgroundColor: 'white'
          });
          
          document.body.removeChild(itemDiv);
          
          const itemHeight = (itemCanvas.height * pdfWidth) / RENDER_WIDTH;
          
          // Check if item fits on current page
          if (currentY + itemHeight > pdfHeight - 20) {
            pdf.addPage();
            currentY = 10;
          }
          
          pdf.addImage(
            itemCanvas.toDataURL('image/jpeg', 0.9),
            'JPEG',
            0,
            currentY,
            pdfWidth,
            itemHeight
          );
          
          currentY += itemHeight + 2;
        }
      }

      // After generating all content, go back and add clickable links to TOC
      // Go to TOC page (page 2)
      pdf.setPage(2);
      
      // Add clickable areas for each section in TOC with FIXED positioning
      sections.forEach((section, index) => {
        // FIXED CALCULATIONS - measured from actual PDF layout
        // Title + separator takes ~45mm, content starts at ~50mm
        const headerEndMM = 50;
        const firstSectionStartMM = 52; // Very close to where first section actually starts
        const sectionHeightMM = 20; // Actual height of each TOC item
        const sectionSpacingMM = 22; // Actual spacing between items
        
        const yPositionMM = firstSectionStartMM + (index * sectionSpacingMM);
        const linkHeightMM = sectionHeightMM;
        const linkWidthMM = pdfWidth - 20; // Almost full width minus margins
        const linkX = 10; // Small left margin
        
        // Add internal link to the section page
        if (sectionPages[index]) {
          pdf.link(linkX, yPositionMM, linkWidthMM, linkHeightMM, { 
            pageNumber: sectionPages[index] 
          });
          
          // Debug: Add a semi-transparent rectangle to see clickable areas (remove in production)
          // pdf.setFillColor(255, 0, 0, 0.2);
          // pdf.rect(linkX, yPositionMM, linkWidthMM, linkHeightMM, 'F');
        }
      });

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
        
        <div className="rounded-lg p-4 border" style={{ 
          backgroundColor: '#1f1f1f', 
          borderColor: '#404040' 
        }}>
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: '#a1a1aa' }}>Progress</span>
            <span className="font-semibold text-white">
              {completedItems}/{totalItems} items ({Math.round((completedItems/totalItems)*100)}%)
            </span>
          </div>
          <div className="mt-2 rounded-full h-2" style={{ backgroundColor: '#404040' }}>
            <div 
              className="h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${(completedItems/totalItems)*100}%`,
                backgroundColor: '#F2CA05'
              }}
            />
          </div>
        </div>

        <Button 
          onClick={generatePDF}
          disabled={isGenerating || completedItems === 0}
          className="w-full h-12 text-white font-semibold rounded-lg transition-all duration-200 hover:opacity-90 border-0"
          style={{ 
            backgroundColor: isGenerating || completedItems === 0 
              ? '#555555' 
              : '#F2CA05',
            color: isGenerating || completedItems === 0 ? '#a1a1aa' : '#363636'
          }}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 mr-3 animate-spin" />
              Generating Modern Report...
            </>
          ) : (
            <>
              <FileDown className="h-5 w-5 mr-3" />
              Download PDF Report
            </>
          )}
        </Button>
        
        <Button 
          onClick={clearCache}
          variant="outline"
          className="w-full h-10 mt-3 border-2 transition-all duration-200 hover:bg-muted"
          style={{ 
            borderColor: '#F2CA05',
            color: '#F2CA05'
          }}
        >
          Clear Cache & Start New Audit
        </Button>
        
        {completedItems === 0 && (
          <div className="text-center p-4 rounded-lg border" style={{ 
            backgroundColor: 'rgba(242, 202, 5, 0.1)', 
            borderColor: 'rgba(242, 202, 5, 0.3)' 
          }}>
            <p className="text-sm font-medium" style={{ color: '#F2CA05' }}>
              Complete at least one audit item to generate your report.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};