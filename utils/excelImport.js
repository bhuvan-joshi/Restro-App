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
    const nameColIndex = headers.findIndex(h => h.toUpperCase().includes('NAME'));
    const descColIndex = headers.findIndex(h => h.toUpperCase().includes('DESCRIPTION'));
    const imageNoColIndex = headers.findIndex(h => h.toUpperCase().includes('IMAGE'));
    const priceColIndex = headers.findIndex(h => h.toUpperCase().includes('PRICE') || h.toUpperCase().includes('COST'));
    const barcodeColIndex = headers.findIndex(h => h.toUpperCase().includes('BARCODE') || h.toUpperCase().includes('UPC') || h.toUpperCase().includes('EAN'));

    if ((nameColIndex === -1 && descColIndex === -1)) {
      throw new Error('Required columns not found in Excel file. Need a column for product name or description.');
    }
    
    // Process data rows
    const products = [];
    const errors = [];
    
    // Start from the row after header
    for (let i = headerRow + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) {
        continue; // Skip empty rows
      }
      // Name: prefer NAME, fallback to DESCRIPTION
      let name = (nameColIndex !== -1 && row[nameColIndex]) ? row[nameColIndex].toString().trim() : '';
      if (!name && descColIndex !== -1 && row[descColIndex]) {
        name = row[descColIndex].toString().trim();
      }
      // Description: DESCRIPTION column if present
      let description = (descColIndex !== -1 && row[descColIndex]) ? row[descColIndex].toString().trim() : '';
      // SKU: arper-008-<number part of image no>
      let sku = '';
      if (imageNoColIndex !== -1 && row[imageNoColIndex]) {
        const imgVal = row[imageNoColIndex].toString();
        const match = imgVal.match(/(\d+)/);
        if (match) {
          sku = `arper-008-${match[1]}`;
        } else {
          sku = 'arper-008-unknown';
        }
      } else {
        sku = 'arper-008-unknown';
      }
      const price = priceColIndex !== -1 && row[priceColIndex] ? parseFloat(row[priceColIndex]) : 0;
      const barcode = barcodeColIndex !== -1 && row[barcodeColIndex] ? row[barcodeColIndex].toString().trim() : '';
      if (!name) {
        errors.push(`Row ${i + 1}: Missing required data (name)`);
        continue;
      }
      products.push({
        product_id: uuidv4(),
        name,
        sku,
        price: isNaN(price) ? 0 : price,
        description,
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
      
      // Helper: extract image number from SKU (arper-008-<number>)
      function extractImageNo(sku) {
        const match = sku.match(/arper-008-(\d+)/);
        return match ? match[1] : null;
      }

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
        const imageNo = extractImageNo(product.sku);
        
        // First, check if a product with the same SKU exists
        db.get('SELECT * FROM products WHERE sku = ?', [product.sku], (err, skuProduct) => {
          if (err) {
            errors.push(`Database error checking SKU ${product.sku}: ${err.message}`);
            processProduct(index + 1);
            return;
          }
          if (skuProduct) {
            // Update the existing product by SKU
            db.run(
              `UPDATE products SET 
                name = ?,
                description = ?,
                price = ?,
                cost = ?,
                barcode = ?
              WHERE product_id = ?`,
              [
                product.name,
                product.description || null,
                product.price,
                product.price, // cost
                product.barcode || null,
                skuProduct.product_id
              ],
              function(err) {
                if (err) {
                  errors.push(`Error updating product (SKU: ${product.sku}): ${err.message}`);
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
                    'UPDATE',
                    'products',
                    skuProduct.product_id,
                    JSON.stringify(product)
                  ],
                  (err) => {
                    if (err) {
                      console.error('Error logging product update:', err);
                    }
                    importedProducts.push(product);
                    processProduct(index + 1);
                  }
                );
              }
            );
          } else {
            // If not found by SKU, check by description and image number
            db.get(
              'SELECT * FROM products WHERE description = ? AND sku LIKE ?',
              [product.description || '', `%arper-008-${imageNo}%`],
              (err, existingProduct) => {
                if (err) {
                  errors.push(`Database error checking product (desc: ${product.description}, imageNo: ${imageNo}): ${err.message}`);
                  processProduct(index + 1);
                  return;
                }
                if (existingProduct) {
                  // Update the existing product
                  db.run(
                    `UPDATE products SET 
                      name = ?,
                      sku = ?,
                      price = ?,
                      cost = ?,
                      barcode = ?
                    WHERE product_id = ?`,
                    [
                      product.name,
                      product.sku,
                      product.price,
                      product.price, // cost
                      product.barcode || null,
                      existingProduct.product_id
                    ],
                    function(err) {
                      if (err) {
                        errors.push(`Error updating product (desc: ${product.description}, imageNo: ${imageNo}): ${err.message}`);
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
                          'UPDATE',
                          'products',
                          existingProduct.product_id,
                          JSON.stringify(product)
                        ],
                        (err) => {
                          if (err) {
                            console.error('Error logging product update:', err);
                          }
                          importedProducts.push(product);
                          processProduct(index + 1);
                        }
                      );
                    }
                  );
                } else {
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
                      null,
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
                }
              }
            );
          }
        });
      };
      // Start processing products
      processProduct(0);
    });
  });
}

module.exports = {
  importProductsFromExcel,
  insertProductsIntoDatabase
};
