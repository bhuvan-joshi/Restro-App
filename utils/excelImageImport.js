const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Import products and images from Excel file
 * @param {string} filePath - Path to the Excel file
 * @param {object} db - Database connection
 * @param {string} userId - ID of the user performing the import
 * @returns {Promise<object>} - Result of the import operation
 */
async function importProductsWithImagesFromExcel(filePath, db, userId) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];
    
    // Build a map of imageId -> { buffer, extension }
    const imageMap = {};
    console.log('workbook.media details:');
    workbook.media.forEach(media => {
      if (media.type === 'image') {
        imageMap[media.id] = {
          buffer: media.buffer,
          extension: media.extension
        };
        console.log(`media.id: ${media.id}, extension: ${media.extension}`);
      }
    });
    // Also print all imageIds found in worksheet.getImages()
    const foundImageIds = worksheet.getImages().map(img => img.imageId);
    console.log('Image IDs found in worksheet.getImages():', foundImageIds);

    // Find headers and their column numbers
    let headerRow = null;
    let headers = [];
    worksheet.eachRow((row, rowNumber) => {
      if (!headerRow && row.values.some(v => typeof v === 'string' && (v.toUpperCase().includes('NAME') || v.toUpperCase().includes('DESCRIPTION') || v.toUpperCase().includes('SKU')))) {
        headerRow = rowNumber;
        // ExcelJS row.values is 1-based, so shift and ensure all are strings
        headers = row.values.slice(1).map(h => (typeof h === 'string' ? h.trim() : (h ? h.toString().trim() : '')));
      }
    });
    if (!headerRow) throw new Error('Header row not found');
    // Defensive: make sure headers is an array of strings
    headers = headers.map(h => (typeof h === 'string' ? h : (h ? h.toString() : '')));
    const nameColIndex = headers.findIndex(h => typeof h === 'string' && h.toUpperCase().includes('NAME'));
    const descColIndex = headers.findIndex(h => typeof h === 'string' && h.toUpperCase().includes('DESCRIPTION'));
    const imageNoColIndex = headers.findIndex(h => typeof h === 'string' && h.toUpperCase().includes('IMAGE'));
    const priceColIndex = headers.findIndex(h => typeof h === 'string' && (h.toUpperCase().includes('PRICE') || h.toUpperCase().includes('COST')));
    const barcodeColIndex = headers.findIndex(h => typeof h === 'string' && (h.toUpperCase().includes('BARCODE') || h.toUpperCase().includes('UPC') || h.toUpperCase().includes('EAN')));

    // Map (row, col) to imageId (ExcelJS stores images by cell position)
    const cellToImage = {};
    const images = worksheet.getImages();
    console.log('Images detected by worksheet.getImages():', images.length);
    images.forEach(img => {
      const row = img.range.tl.nativeRow + 1; // ExcelJS is 0-based
      const col = img.range.tl.nativeCol + 1; // ExcelJS is 0-based
      const key = `${row},${col}`;
      cellToImage[key] = img.imageId;
      console.log(`Mapped imageId ${img.imageId} to cell ${key}`);
    });
    console.log('workbook.media count:', workbook.media.length);
    console.log('cellToImage mapping:', cellToImage);

    const uploadsDir = path.join(__dirname, '../uploads/products');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const products = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRow) return;
      const values = row.values;
      let name = (nameColIndex !== -1 && values[nameColIndex]) ? values[nameColIndex].toString().trim() : '';
      if (!name && descColIndex !== -1 && values[descColIndex]) {
        name = values[descColIndex].toString().trim();
      }
      let description = (descColIndex !== -1 && values[descColIndex]) ? values[descColIndex].toString().trim() : '';
      let sku = '';
      if (imageNoColIndex !== -1 && values[imageNoColIndex]) {
        const imgVal = values[imageNoColIndex].toString();
        const match = imgVal.match(/(\d+)/);
        if (match) {
          sku = `arper-008-${match[1]}`;
        } else {
          sku = 'arper-008-unknown';
        }
      } else {
        sku = 'arper-008-unknown';
      }
      const price = priceColIndex !== -1 && values[priceColIndex] ? parseFloat(values[priceColIndex]) : 0;
      const barcode = barcodeColIndex !== -1 && values[barcodeColIndex] ? values[barcodeColIndex].toString().trim() : '';
      if (!name) return;

      // Handle image extraction
      let image_path = null;
      // Try to map image by IMAGE column (if present), else any image in the row
      let imageId = null;
      if (imageNoColIndex !== -1) {
        const key = `${rowNumber},${imageNoColIndex+1}`; // ExcelJS columns are 1-based
        imageId = cellToImage[key];
        if (imageId) {
          console.log(`Found image for row ${rowNumber} IMAGE column: ${key} -> ${imageId}`);
        }
      }
      // Fallback: check for any image in this row
      if (!imageId) {
        for (let col = 1; col <= headers.length; col++) {
          const key = `${rowNumber},${col}`;
          if (cellToImage[key]) {
            imageId = cellToImage[key];
            console.log(`Found fallback image for row ${rowNumber} col ${col}: ${key} -> ${imageId}`);
            break;
          }
        }
      }
      if (imageId && imageMap[imageId]) {
        const { buffer, extension } = imageMap[imageId];
        const filename = `product-${uuidv4()}.${extension}`;
        const filepath = path.join(uploadsDir, filename);
        fs.writeFileSync(filepath, buffer);
        image_path = `/uploads/products/${filename}`;
        console.log(`Saved image for row ${rowNumber}: ${image_path}`);
      } else {
        if (imageId) {
          console.log(`ImageId ${imageId} found for row ${rowNumber} but no image data in imageMap.`);
        } else {
          console.log(`No image for row ${rowNumber}`);
        }
      }

      products.push({
        product_id: uuidv4(),
        name,
        sku,
        price: isNaN(price) ? 0 : price,
        description,
        image_path,
        category_id: null,
        barcode: barcode
      });
    });

    if (products.length === 0) throw new Error('No valid products found in the Excel file');

    const importedProducts = await require('./excelImport').insertProductsIntoDatabase(db, products, userId);
    return {
      success: true,
      importedCount: importedProducts.length,
      errors: null
    };
  } catch (error) {
    console.error('Excel import error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  importProductsWithImagesFromExcel
};
