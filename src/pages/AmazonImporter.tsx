import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Upload, 
  Download, 
  FileText, 
  CheckCircle, 
  AlertTriangle,
  Package,
  ArrowRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

interface AmazonProduct {
  title?: string;
  asin?: string;
  price?: string;
  description?: string;
  category?: string;
  brand?: string;
  sku?: string;
  weight?: string;
  dimensions?: string;
  images?: string[];
  [key: string]: any;
}

const AmazonImporter = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState<string | null>(null);
  const [productCount, setProductCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setProcessedData(null);
      setProductCount(0);
    }
  };

  const processAmazonData = async () => {
    if (!file) {
      toast({
        title: "Error",
        description: "Please select a file to process",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      let amazonProducts: AmazonProduct[] = [];
      
      // Check if file is Excel format
      if (file.name.toLowerCase().endsWith('.xlsx') || 
          file.name.toLowerCase().endsWith('.xlsm') || 
          file.name.toLowerCase().endsWith('.xls')) {
        
        // Parse Excel file
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        console.log('Excel data parsed:', jsonData);
        console.log('First row (headers):', jsonData[0]);
        console.log('Total rows:', jsonData.length);
        
        if (jsonData.length > 1) {
          const headers = (jsonData[0] as string[]).map(h => String(h).trim());
          console.log('Processed headers:', headers);
          
          amazonProducts = (jsonData.slice(1) as any[][])
            .filter(row => row && row.some(cell => cell !== null && cell !== undefined && cell !== ''))
            .map((row, index) => {
              const product: AmazonProduct = {};
              headers.forEach((header, colIndex) => {
                const value = row[colIndex];
                if (value !== null && value !== undefined) {
                  product[header.toLowerCase().replace(/\s+/g, '_')] = String(value).trim();
                }
              });
              console.log(`Product ${index + 1}:`, product);
              return product;
            });
          
          console.log('Total products parsed:', amazonProducts.length);
        }
      } else {
        // Parse text-based files (JSON, CSV, TXT)
        const text = await file.text();
        
        try {
          // Try parsing as JSON first
          const jsonData = JSON.parse(text);
          amazonProducts = Array.isArray(jsonData) ? jsonData : [jsonData];
        } catch {
          // If JSON parsing fails, try CSV parsing
          const lines = text.split('\n');
          const headers = lines[0].split(',').map(h => h.trim());
          
          amazonProducts = lines.slice(1)
            .filter(line => line.trim())
            .map(line => {
              const values = line.split(',');
              const product: AmazonProduct = {};
              headers.forEach((header, index) => {
                product[header.toLowerCase()] = values[index]?.trim() || '';
              });
              return product;
            });
        }
      }

      // Convert to Shopify CSV format - if data already has Shopify columns, use them directly
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

      console.log('Converting products to Shopify format...');
      
      const shopifyRows = amazonProducts.map((product, index) => {
        console.log(`Converting product ${index + 1}:`, product);
        
        // Check if data already has Shopify-style columns
        const hasShopifyFormat = product.handle || product.title || product['body_(html)'];
        
        let row: string[];
        
        if (hasShopifyFormat) {
          // Data is already in Shopify format, map directly
          row = [
            product.handle || product.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `product-${index + 1}`,
            product.title || 'Untitled Product',
            product['body_(html)'] || product.body || product.description || '',
            product.vendor || 'Unknown Brand',
            product['product_category'] || product.category || '',
            product.type || product.category || '',
            product.tags || '',
            product.published || 'true',
            product['option1_name'] || 'Title',
            product['option1_value'] || 'Default Title',
            product['variant_sku'] || product.sku || '',
            product['variant_grams'] || product.weight || '0',
            product['variant_inventory_tracker'] || 'shopify',
            product['variant_inventory_qty'] || '1',
            product['variant_inventory_policy'] || 'deny',
            product['variant_fulfillment_service'] || 'manual',
            product['variant_price'] || product.price || '0.00',
            product['variant_compare_at_price'] || '',
            product['variant_requires_shipping'] || 'true',
            product['variant_taxable'] || 'true',
            product['variant_barcode'] || '',
            product['image_src'] || '',
            product['image_position'] || '1',
            product['image_alt_text'] || product.title || '',
            product['gift_card'] || 'false',
            product['seo_title'] || product.title || '',
            product['seo_description'] || product.description || '',
            product['variant_weight_unit'] || 'kg',
            product['variant_tax_code'] || '',
            product['cost_per_item'] || '',
            product.status || 'active'
          ];
        } else {
          // Convert from Amazon format to Shopify format
          const handle = (product.title || product.asin || `product-${index + 1}`)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

          row = [
            handle,
            product.title || 'Untitled Product',
            product.description || '',
            product.brand || 'Unknown Brand',
            product.category || '',
            product.category || '',
            product.category ? product.category.replace(/[>]/g, ',') : '',
            'true',
            'Title',
            'Default Title',
            product.sku || product.asin || '',
            product.weight || '0',
            'shopify',
            '1',
            'deny',
            'manual',
            product.price || '0.00',
            '',
            'true',
            'true',
            product.upc || product.ean || '',
            product.images?.[0] || '',
            '1',
            product.title || '',
            'false',
            product.title || '',
            product.description || '',
            'kg',
            '',
            '',
            'active'
          ];
        }
        
        console.log(`Converted row ${index + 1}:`, row);
        return row;
      });

      // Create CSV content
      const csvContent = [
        shopifyHeaders.join(','),
        ...shopifyRows.map(row => 
          row.map(field => 
            typeof field === 'string' && (field.includes(',') || field.includes('"')) 
              ? `"${field.replace(/"/g, '""')}"` 
              : field
          ).join(',')
        )
      ].join('\n');

      setProcessedData(csvContent);
      setProductCount(amazonProducts.length);

      toast({
        title: "Processing Complete",
        description: `Successfully converted ${amazonProducts.length} products to Shopify CSV format`,
      });

    } catch (error) {
      console.error('Processing error:', error);
      toast({
        title: "Processing Failed",
        description: "Unable to process the Amazon data. Please check the file format.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadCSV = () => {
    if (!processedData) return;

    const blob = new Blob([processedData], { type: 'text/csv;charset=utf-8;' });
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

        {/* Upload Section */}
        <Card className="audit-card mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Amazon Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="file-upload">Select Amazon CLR Data File</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".json,.csv,.txt,.xlsx,.xlsm,.xls"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Supported formats: JSON, CSV, TXT, Excel (.xlsx, .xlsm, .xls)
              </p>
            </div>

            {file && (
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-sm text-muted-foreground">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              </div>
            )}

            <Button 
              onClick={processAmazonData} 
              disabled={!file || isProcessing}
              size="lg"
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Convert to Shopify Format
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Section */}
        {processedData && (
          <Card className="audit-card mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                Conversion Complete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-success/10 rounded-lg">
                  <div className="text-2xl font-bold text-success mb-1">
                    {productCount}
                  </div>
                  <div className="text-sm text-muted-foreground">Products Converted</div>
                </div>
                
                <div className="text-center p-4 bg-primary/10 rounded-lg">
                  <div className="text-2xl font-bold text-primary mb-1">
                    CSV
                  </div>
                  <div className="text-sm text-muted-foreground">Format Ready</div>
                </div>
                
                <div className="text-center p-4 bg-accent/10 rounded-lg">
                  <div className="text-2xl font-bold text-accent-foreground mb-1">
                    100%
                  </div>
                  <div className="text-sm text-muted-foreground">Shopify Compatible</div>
                </div>
              </div>

              <Separator />

              <Button 
                onClick={downloadCSV}
                size="lg"
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Shopify CSV
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="audit-card">
          <CardHeader>
            <CardTitle>How to Use This Tool</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="p-3 rounded-lg bg-primary/10 w-fit mx-auto mb-3">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">1. Upload Your Data</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your Amazon CLR data file in JSON, CSV, or TXT format
                </p>
              </div>
              
              <div className="text-center">
                <div className="p-3 rounded-lg bg-primary/10 w-fit mx-auto mb-3">
                  <ArrowRight className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">2. Convert Data</h3>
                <p className="text-sm text-muted-foreground">
                  Our tool automatically converts your Amazon data to Shopify CSV format
                </p>
              </div>
              
              <div className="text-center">
                <div className="p-3 rounded-lg bg-primary/10 w-fit mx-auto mb-3">
                  <Download className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">3. Import to Shopify</h3>
                <p className="text-sm text-muted-foreground">
                  Download the CSV and import it directly into your Shopify store
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Important Notes
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• Ensure your Amazon data includes product titles, prices, and descriptions</li>
                <li>• Product images should be accessible via URL for proper import</li>
                <li>• Review the generated CSV before importing to Shopify</li>
                <li>• The tool maps common Amazon fields to Shopify's required columns</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AmazonImporter;