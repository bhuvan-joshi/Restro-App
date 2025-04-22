const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const CSV_FILE = 'product_image_mapping.csv';
const DB_FILE = path.join('data', 'inventory.db'); // adjust if your DB file is elsewhere
const IMAGE_DIR = path.join('excel_extracted_images', 'media');

// 1. Parse CSV
const rows = fs.readFileSync(CSV_FILE, 'utf8').split(/\r?\n/).filter(Boolean);
const headers = rows[0].split(',').map(h => h.replace(/"/g, ''));
const imageNoIdx = headers.findIndex(h => h.toUpperCase().replace(/\s/g, '') === 'IMAGENO');
const imageIdx = headers.findIndex(h => h.trim().toLowerCase() === 'image');
if (imageNoIdx === -1 || imageIdx === -1) {
  console.error('IMAGE NO or image column not found in CSV.');
  process.exit(1);
}

// 2. Connect to SQLite
const db = new sqlite3.Database(DB_FILE, sqlite3.OPEN_READWRITE, err => {
  if (err) throw err;
});

db.serialize(() => {
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(s => s.replace(/"/g, ''));
    const imageNo = cols[imageNoIdx];
    const image = cols[imageIdx];
    if (!imageNo || !image) continue;
    // Only process IMAGE NO values like IMG_XXXX
    const imgMatch = imageNo.match(/IMG_(\d{4,})/i);
    if (!imgMatch) {
      console.warn(`Skipping row with non-standard IMAGE NO: ${imageNo}`);
      continue;
    }
    const sku = `arper-008-${imgMatch[1]}`;
    const imagePath = `/uploads/products/${image}`;
    db.run('UPDATE products SET image_path = ? WHERE sku = ?', [imagePath, sku], function(err) {
      if (err) {
        console.error(`Failed to update SKU ${sku}:`, err.message);
      } else if (this.changes > 0) {
        console.log(`Updated SKU ${sku} with image ${imagePath}`);
      } else {
        console.log(`No product found for SKU ${sku}`);
      }
    });
  }
});

db.on('close', () => console.log('Database connection closed'));
db.close();
