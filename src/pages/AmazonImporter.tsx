import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Package,
  ArrowRight,
  Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import FileUpload from "@/components/importer/FileUpload";
import SheetProcessor from "@/components/importer/SheetProcessor";
import DataValidator from "@/components/importer/DataValidator";
import CSVPreview from "@/components/importer/CSVPreview";
import { validateProductData } from "@/utils/dataValidation";

interface SheetData {
  name: string;
  data: any[];
  headers: string[];
  rowCount: number;
}

interface ValidationResult {
  type: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  count?: number;
}

const AmazonImporter = () => {
  const [clrFile, setCLRFile] = useState<File | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState<string | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [validProducts, setValidProducts] = useState(0);
  const { toast } = useToast();

  const handleCLRFileUpload = async (file: File) => {
    setCLRFile(file);
    setProcessedData(null);
    setProductCount(0);
    setSheets([]);
    setSelectedSheets([]);
    setValidationResults([]);
    
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      const sheetData: SheetData[] = workbook.SheetNames.map(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length > 1) {
          const headers = (jsonData[0] as string[]).map(h => String(h).trim());
          const data = (jsonData.slice(1) as any[][])
            .filter(row => row && row.some(cell => cell !== null && cell !== undefined && cell !== ''))
            .map(row => {
              const product: any = {};
              headers.forEach((header, colIndex) => {
                const value = row[colIndex];
                if (value !== null && value !== undefined) {
                  product[header.toLowerCase().replace(/\s+/g, '_')] = String(value).trim();
                }
              });
              return product;
            });
          
          return {
            name: sheetName,
            data,
            headers,
            rowCount: data.length
          };
        }
        
        return {
          name: sheetName,
          data: [],
          headers: [],
          rowCount: 0
        };
      });
      
      setSheets(sheetData.filter(sheet => sheet.rowCount > 0));
      setSelectedSheets(sheetData.filter(sheet => sheet.rowCount > 0).map(sheet => sheet.name));
      
      toast({
        title: "File Processed",
        description: `Found ${sheetData.filter(sheet => sheet.rowCount > 0).length} sheets with data`,
      });
      
    } catch (error) {
      console.error('Error processing CLR file:', error);
      toast({
        title: "Processing Failed",
        description: "Unable to process the CLR file. Please check the file format.",
        variant: "destructive",
      });
    }
  };

  const handleTemplateUpload = (file: File) => {
    setTemplateFile(file);
  };

  const processSelectedSheets = async () => {
    if (selectedSheets.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one sheet to process",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Combine data from selected sheets
      let allProducts: any[] = [];
      
      selectedSheets.forEach(sheetName => {
        const sheet = sheets.find(s => s.name === sheetName);
        if (sheet) {
          allProducts = [...allProducts, ...sheet.data];
        }
      });

      console.log('Combined products from sheets:', allProducts.length);

      // Validate data
      const { results, validProducts: validCount } = validateProductData(allProducts);
      setValidationResults(results);
      setValidProducts(validCount);

      // Standard Shopify CSV headers
      const shopifyHeaders = [
        'Handle',
        'Title', 
        'Body (HTML)',
        'Vendor',
        'Product Category',
        'Type',
        'Tags',
        'Published',
        'Option1 Name',
        'Option1 Value',
        'Variant SKU',
        'Variant Grams',
        'Variant Inventory Tracker',
        'Variant Inventory Qty',
        'Variant Inventory Policy',
        'Variant Fulfillment Service',
        'Variant Price',
        'Variant Compare At Price',
        'Variant Requires Shipping',
        'Variant Taxable',
        'Variant Barcode',
        'Image Src',
        'Image Position',
        'Image Alt Text',
        'Gift Card',
        'SEO Title',
        'SEO Description',
        'Variant Weight Unit',
        'Variant Tax Code',
        'Cost per item',
        'Status'
      ];

      const shopifyRows = allProducts.map((product, index) => {
        // Auto-detect format and map fields intelligently
        const getFieldValue = (fieldNames: string[]) => {
          for (const name of fieldNames) {
            if (product[name] !== undefined && product[name] !== null && product[name] !== '') {
              return String(product[name]).trim();
            }
          }
          return '';
        };

        // Generate handle
        const title = getFieldValue(['title', 'Title', 'product_name', 'Product Name', 'name', 'Name']);
        const handle = title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : `product-${index + 1}`;

        // Map fields with fallbacks
        const price = getFieldValue(['variant_price', 'price', 'Price', 'unit_price', 'Unit Price']) || '0.00';
        const description = getFieldValue(['body_(html)', 'description', 'Description', 'product_description', 'Product Description']);
        const brand = getFieldValue(['vendor', 'brand', 'Brand', 'manufacturer', 'Manufacturer']) || 'Unknown Brand';
        const category = getFieldValue(['product_category', 'category', 'Category', 'type', 'Type']);
        const sku = getFieldValue(['variant_sku', 'sku', 'SKU', 'product_id', 'Product ID', 'asin', 'ASIN']);
        const imageUrl = getFieldValue(['image_src', 'image_url', 'Image URL', 'main_image', 'Main Image']);

        // Validate price format
        const validPrice = price && !isNaN(parseFloat(price)) ? parseFloat(price).toFixed(2) : '0.00';

        return [
          handle,
          title || 'Untitled Product',
          description,
          brand,
          category,
          category,
          category ? category.replace(/[>]/g, ',') : '',
          'true',
          'Title',
          'Default Title',
          sku,
          '0', // weight in grams
          'shopify',
          '1', // inventory qty
          'deny',
          'manual',
          validPrice,
          '', // compare at price
          'true',
          'true',
          '', // barcode
          imageUrl,
          '1', // image position
          title || '',
          'false', // gift card
          title || '', // SEO title
          description.substring(0, 160) || '', // SEO description
          'kg',
          '', // tax code
          '', // cost per item
          'active'
        ];
      });

      // Create CSV content with proper escaping
      const csvContent = [
        shopifyHeaders.join(','),
        ...shopifyRows.map(row => 
          row.map(field => {
            const stringField = String(field || '');
            // Escape fields that contain commas, quotes, or newlines
            if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
              return `"${stringField.replace(/"/g, '""')}"`;
            }
            return stringField;
          }).join(',')
        )
      ].join('\n');

      setProcessedData(csvContent);
      setProductCount(allProducts.length);

      toast({
        title: "Processing Complete",
        description: `Successfully converted ${allProducts.length} products to Shopify CSV format`,
      });

    } catch (error) {
      console.error('Processing error:', error);
      toast({
        title: "Processing Failed",
        description: "Unable to process the data. Please check the file format.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadCSV = () => {
    if (!processedData) return;

    // Create CSV with UTF-8 BOM for better Excel compatibility
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + processedData;
    
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `shopify-products-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Download Started",
      description: "Your Shopify CSV file is being downloaded",
    });
  };

  const handlePreviewSheet = (sheetName: string) => {
    console.log('Previewing sheet:', sheetName);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="audit-header rounded-lg p-8 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Package className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Amazon to Shopify Product Importer</h1>
              <p className="text-muted-foreground mt-1">
                Convert your Amazon product data to Shopify-compatible CSV format
              </p>
            </div>
          </div>
        </div>

        {/* File Upload Section */}
        <div className="mb-8">
          <FileUpload
            onCLRFileUpload={handleCLRFileUpload}
            onTemplateUpload={handleTemplateUpload}
            clrFile={clrFile}
            templateFile={templateFile}
          />
        </div>

        {/* Sheet Processing Section */}
        {sheets.length > 0 && (
          <div className="mb-8">
            <SheetProcessor
              sheets={sheets}
              selectedSheets={selectedSheets}
              onSheetSelection={setSelectedSheets}
              onPreviewSheet={handlePreviewSheet}
            />
          </div>
        )}

        {/* Process Button */}
        {selectedSheets.length > 0 && (
          <Card className="audit-card mb-8">
            <CardContent className="pt-6">
              <Button 
                onClick={processSelectedSheets} 
                disabled={isProcessing}
                size="lg"
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2 animate-spin" />
                    Processing {selectedSheets.length} sheet(s)...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Convert {selectedSheets.length} Sheet(s) to Shopify Format
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Validation Results */}
        {validationResults.length > 0 && (
          <div className="mb-8">
            <DataValidator
              validationResults={validationResults}
              totalProducts={productCount}
              validProducts={validProducts}
            />
          </div>
        )}

        {/* CSV Preview Section */}
        {processedData && (
          <div className="mb-8">
            <CSVPreview
              csvData={processedData}
              productCount={productCount}
              onDownload={downloadCSV}
            />
          </div>
        )}

        {/* Instructions */}
        <Card className="audit-card">
          <CardHeader>
            <CardTitle>How to Use This Enhanced Tool</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="p-3 rounded-lg bg-primary/10 w-fit mx-auto mb-3">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">1. Upload CLR File</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your Amazon CLR data file with multiple sheets support
                </p>
              </div>
              
              <div className="text-center">
                <div className="p-3 rounded-lg bg-primary/10 w-fit mx-auto mb-3">
                  <ArrowRight className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">2. Select Sheets</h3>
                <p className="text-sm text-muted-foreground">
                  Choose which sheets to process and preview their contents
                </p>
              </div>
              
              <div className="text-center">
                <div className="p-3 rounded-lg bg-primary/10 w-fit mx-auto mb-3">
                  <ArrowRight className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">3. Validate & Convert</h3>
                <p className="text-sm text-muted-foreground">
                  Auto-validate data and convert to Shopify CSV format
                </p>
              </div>
              
              <div className="text-center">
                <div className="p-3 rounded-lg bg-primary/10 w-fit mx-auto mb-3">
                  <Download className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">4. Preview & Download</h3>
                <p className="text-sm text-muted-foreground">
                  Preview results and download the Shopify-ready CSV
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AmazonImporter;