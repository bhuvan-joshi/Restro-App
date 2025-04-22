const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

/**
 * Create a sample Excel template for product imports
 * @returns {string} Path to the created template file
 */
function createProductImportTemplate() {
  // Create directory if it doesn't exist
  const templateDir = path.join(__dirname, '../public/templates');
  if (!fs.existsSync(templateDir)) {
    fs.mkdirSync(templateDir, { recursive: true });
  }
  
  // Define the template file path
  const templatePath = path.join(templateDir, 'product_import_template.xlsx');
  
  // Create a new workbook
  const workbook = xlsx.utils.book_new();
  
  // Sample data
  const data = [
    ['ITEM/SKU', 'DESCRIPTION', 'PRICE', 'BARCODE'],
    ['ABC123', 'Sample Product 1', 99.99, '123456789012'],
    ['DEF456', 'Sample Product 2', 149.99, '234567890123'],
    ['GHI789', 'Sample Product 3', 199.99, '345678901234']
  ];
  
  // Create a worksheet
  const worksheet = xlsx.utils.aoa_to_sheet(data);
  
  // Add the worksheet to the workbook
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Products');
  
  // Write to file
  xlsx.writeFile(workbook, templatePath);
  
  return templatePath;
}

// Create the template when this module is first required
const templatePath = createProductImportTemplate();

module.exports = {
  templatePath,
  createProductImportTemplate
};
