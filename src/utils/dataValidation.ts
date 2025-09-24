interface ValidationResult {
  type: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  count?: number;
}

interface ProductData {
  [key: string]: any;
}

export const validateProductData = (products: ProductData[]): {
  results: ValidationResult[];
  validProducts: number;
} => {
  const results: ValidationResult[] = [];
  let validProducts = 0;

  // Track validation issues
  const missingTitles = products.filter(p => !p.title && !p.Title);
  const missingPrices = products.filter(p => !p.price && !p.Price && !p['variant_price']);
  const invalidPrices = products.filter(p => {
    const price = p.price || p.Price || p['variant_price'];
    return price && (isNaN(parseFloat(price)) || parseFloat(price) < 0);
  });
  const missingSKUs = products.filter(p => !p.sku && !p.SKU && !p['variant_sku']);
  const missingDescriptions = products.filter(p => !p.description && !p.Description && !p['body_(html)']);
  const missingImages = products.filter(p => !p.image_src && !p['Image Src'] && !p.images);

  // Add validation results
  if (missingTitles.length > 0) {
    results.push({
      type: 'error',
      field: 'Title',
      message: 'Products missing titles will use default "Untitled Product"',
      count: missingTitles.length
    });
  }

  if (missingPrices.length > 0) {
    results.push({
      type: 'warning',
      field: 'Price',
      message: 'Products missing prices will default to $0.00',
      count: missingPrices.length
    });
  }

  if (invalidPrices.length > 0) {
    results.push({
      type: 'error',
      field: 'Price',
      message: 'Products with invalid price formats detected',
      count: invalidPrices.length
    });
  }

  if (missingSKUs.length > 0) {
    results.push({
      type: 'info',
      field: 'SKU',
      message: 'Products without SKUs - consider adding for inventory tracking',
      count: missingSKUs.length
    });
  }

  if (missingDescriptions.length > 0) {
    results.push({
      type: 'warning',
      field: 'Description',
      message: 'Products missing descriptions - important for SEO',
      count: missingDescriptions.length
    });
  }

  if (missingImages.length > 0) {
    results.push({
      type: 'warning',
      field: 'Images',
      message: 'Products without images - add URLs for better conversion',
      count: missingImages.length
    });
  }

  // Calculate valid products (those with at least title and valid price)
  validProducts = products.filter(product => {
    const hasTitle = product.title || product.Title;
    const price = product.price || product.Price || product['variant_price'];
    const hasValidPrice = price && !isNaN(parseFloat(price)) && parseFloat(price) >= 0;
    return hasTitle && (hasValidPrice || price === undefined || price === '');
  }).length;

  // Add summary info
  results.push({
    type: 'info',
    field: 'Summary',
    message: `${validProducts} of ${products.length} products passed validation`
  });

  return { results, validProducts };
};