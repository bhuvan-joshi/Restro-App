const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Import products from Excel file
 * @param {string} filePath - Path to the Excel file
 * @param {object} db - Database connection
 * @param {string} userId - ID of the user performing the import
 * @returns {Promise<object>} - Result of the import operation
 */
async function importProductsFromExcel(filePath, db, userId) {
  try {
    // Read the Excel file
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Find header row (usually the first row, but can be different)
    let headerRow = 0;
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      if (row && row.some(cell => cell && typeof cell === 'string' && 
          (cell.includes('DESCRIPTION') || cell.includes('SKU') || cell.includes('PRICE')))) {
        headerRow = i;
        break;
      }
    }
    
    // Extract headers
    const headers = data[headerRow].map(h => h ? h.toString().trim() : '');
    
    // Find column indexes
    const nameColIndex = headers.findIndex(h => h.includes('DESCRIPTION'));
    const skuColIndex = headers.findIndex(h => h.includes('SKU') || h.includes('ITEM'));
    const priceColIndex = headers.findIndex(h => h.includes('PRICE') || h.includes('COST'));
    const barcodeColIndex = headers.findIndex(h => h.includes('BARCODE') || h.includes('UPC') || h.includes('EAN'));
    
    if (nameColIndex === -1 || skuColIndex === -1) {
      throw new Error('Required columns not found in Excel file. Need columns for product name and SKU.');
    }
    
    // Process data rows
    const products = [];
    const errors = [];
    
    // Start from the row after header
    for (let i = headerRow + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0 || !row[nameColIndex] || !row[skuColIndex]) {
        continue; // Skip empty rows
      }
      
      const name = row[nameColIndex] ? row[nameColIndex].toString().trim() : '';
      const sku = row[skuColIndex] ? row[skuColIndex].toString().trim() : '';
      const price = row[priceColIndex] ? parseFloat(row[priceColIndex]) : 0;
      const barcode = row[barcodeColIndex] ? row[barcodeColIndex].toString().trim() : '';
      
      if (!name || !sku) {
        errors.push(`Row ${i + 1}: Missing required data (name or SKU)`);
        continue;
      }
      
      products.push({
        product_id: uuidv4(),
        name,
        sku,
        price: isNaN(price) ? 0 : price,
        description: '',
        image_path: null,
        category_id: null,
        barcode: barcode
      });
    }
    
    if (products.length === 0) {
      throw new Error('No valid products found in the Excel file');
    }
    
    // Insert products into database
    const importedProducts = await insertProductsIntoDatabase(db, products, userId);
    
    return {
      success: true,
      importedCount: importedProducts.length,
      errors: errors.length > 0 ? errors : null
    };
  } catch (error) {
    console.error('Excel import error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Insert products into the database
 * @param {object} db - Database connection
 * @param {Array} products - Array of product objects
 * @param {string} userId - ID of the user performing the import
 * @returns {Promise<Array>} - Array of imported products
 */
function insertProductsIntoDatabase(db, products, userId) {
  return new Promise((resolve, reject) => {
    // Start a transaction
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const importedProducts = [];
      let errors = [];
      
      // Process each product
      const processProduct = (index) => {
        if (index >= products.length) {
          // All products processed
          if (errors.length > 0) {
            db.run('ROLLBACK');
            reject(new Error(`Import failed: ${errors.join(', ')}`));
          } else {
            db.run('COMMIT');
            resolve(importedProducts);
          }
          return;
        }
        
        const product = products[index];
        
        // Check if SKU already exists
        db.get('SELECT product_id FROM products WHERE sku = ?', [product.sku], (err, existingProduct) => {
          if (err) {
            errors.push(`Database error checking SKU ${product.sku}: ${err.message}`);
            processProduct(index + 1);
            return;
          }
          
          if (existingProduct) {
            // Skip this product as SKU already exists
            processProduct(index + 1);
            return;
          }
          
          // Create placeholder image path (empty for now)
          const imagePath = null;
          
          // Insert the product
          db.run(
            `INSERT INTO products (
              product_id, 
              name, 
              description, 
              sku, 
              price,
              cost,
              image_path,
              category_id,
              barcode
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              product.product_id,
              product.name,
              product.description || null,
              product.sku,
              product.price,
              product.price, // Using price as cost for now
              imagePath,
              product.category_id || null,
              product.barcode || null
            ],
            function(err) {
              if (err) {
                errors.push(`Error inserting product ${product.sku}: ${err.message}`);
                processProduct(index + 1);
                return;
              }
              
              // Log the action in audit_log
              const logId = uuidv4();
              db.run(
                `INSERT INTO audit_log (
                  log_id, 
                  user_id, 
                  action, 
                  table_name, 
                  record_id, 
                  new_values
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  logId,
                  userId,
                  'CREATE',
                  'products',
                  product.product_id,
                  JSON.stringify(product)
                ],
                (err) => {
                  if (err) {
                    console.error('Error logging product import:', err);
                  }
                  
                  importedProducts.push(product);
                  processProduct(index + 1);
                }
              );
            }
          );
        });
      };
      
      // Start processing products
      processProduct(0);
    });
  });
}

module.exports = {
  importProductsFromExcel
};
