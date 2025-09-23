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
      const text = await file.text();
      
      // Parse the Amazon CLR data (assuming it's JSON or CSV format)
      let amazonProducts: AmazonProduct[] = [];
      
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

      // Convert to Shopify CSV format
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

      const shopifyRows = amazonProducts.map(product => {
        const handle = (product.title || product.asin || 'product')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

        return [
          handle, // Handle
          product.title || 'Untitled Product', // Title
          product.description || '', // Body (HTML)
          product.brand || 'Unknown Brand', // Vendor
          product.category || '', // Product Category
          product.category || '', // Type
          product.category ? product.category.replace(/[>]/g, ',') : '', // Tags
          'true', // Published
          'Title', // Option1 Name
          'Default Title', // Option1 Value
          product.sku || product.asin || '', // Variant SKU
          product.weight || '0', // Variant Grams
          'shopify', // Variant Inventory Tracker
          '1', // Variant Inventory Qty
          'deny', // Variant Inventory Policy
          'manual', // Variant Fulfillment Service
          product.price || '0.00', // Variant Price
          '', // Variant Compare At Price
          'true', // Variant Requires Shipping
          'true', // Variant Taxable
          product.upc || product.ean || '', // Variant Barcode
          product.images?.[0] || '', // Image Src
          '1', // Image Position
          product.title || '', // Image Alt Text
          'false', // Gift Card
          product.title || '', // SEO Title
          product.description || '', // SEO Description
          'kg', // Variant Weight Unit
          '', // Variant Tax Code
          '', // Cost per item
          'active' // Status
        ];
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
                accept=".json,.csv,.txt"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Supported formats: JSON, CSV, TXT
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