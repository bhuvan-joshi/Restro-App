const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const { importProductsFromExcel } = require('../utils/excelImport');
const { templatePath } = require('../utils/createExcelTemplate');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/products');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'product-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
    return cb(new Error('Only image files are allowed!'), false);
  }
  cb(null, true);
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  }
});

/**
 * @route   GET /api/products
 * @desc    Get all products with pagination and filtering
 * @access  Private
 */
router.get('/', auth, (req, res) => {
  const { search, categoryId, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  
  const db = req.app.locals.db;
  
  let query = `
    SELECT 
      p.*, 
      c.name as category_name, 
      l.name as rack_location_name,
      l.location_id as rack_location_id,
      COALESCE(i.total_quantity, 0) as total_quantity
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.category_id
    LEFT JOIN (
      SELECT i.product_id, l.location_id, l.name
      FROM inventory i
      JOIN locations l ON i.location_id = l.location_id
      WHERE l.type = 'Rack'
      GROUP BY i.product_id
    ) l ON p.product_id = l.product_id
    LEFT JOIN (
      SELECT product_id, SUM(quantity) as total_quantity
      FROM inventory
      GROUP BY product_id
    ) i ON p.product_id = i.product_id
    WHERE 1=1
  `;
  
  const queryParams = [];
  
  if (search) {
    query += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ? OR p.barcode = ?)`;
    queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, search);
  }
  
  if (categoryId) {
    query += ` AND p.category_id = ?`;
    queryParams.push(categoryId);
  }
  
  // Count total products for pagination
  db.get(`SELECT COUNT(*) as count FROM products p WHERE 1=1 ${
    search ? ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ? OR p.barcode = ?)' : ''
  } ${
    categoryId ? ' AND p.category_id = ?' : ''
  }`, queryParams, (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    
    const totalProducts = result.count;
    const totalPages = Math.ceil(totalProducts / limit);
    
    // Get products with pagination
    db.all(`${query} ORDER BY p.name LIMIT ? OFFSET ?`, 
      [...queryParams, limit, offset], 
      (err, products) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        
        res.json({
          products,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages,
            totalProducts
          }
        });
      }
    );
  });
});

/**
 * @route   GET /api/products/:id
 * @desc    Get a single product by ID
 * @access  Private
 */
router.get('/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  
  db.get(
    `SELECT 
      p.product_id, 
      p.name, 
      p.description, 
      p.sku, 
      p.price,
      p.cost,
      p.image_path,
      p.category_id,
      p.barcode,
      c.name AS category_name,
      p.created_at,
      p.updated_at,
      (SELECT l.name FROM inventory i 
       JOIN locations l ON i.location_id = l.location_id 
       WHERE i.product_id = p.product_id AND l.type = 'Rack' 
       LIMIT 1) AS rack_location_name,
      (SELECT l.location_id FROM inventory i 
       JOIN locations l ON i.location_id = l.location_id 
       WHERE i.product_id = p.product_id AND l.type = 'Rack' 
       LIMIT 1) AS rack_location_id
    FROM 
      products p
    LEFT JOIN 
      categories c ON p.category_id = c.category_id
    WHERE 
      p.product_id = ?`,
    [req.params.id],
    (err, product) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      // Get inventory information
      db.all(
        `SELECT 
          i.inventory_id,
          i.location_id,
          l.name AS location_name,
          i.quantity,
          i.min_quantity,
          i.max_quantity,
          i.created_at,
          i.updated_at
        FROM 
          inventory i
        LEFT JOIN
          locations l ON i.location_id = l.location_id
        WHERE 
          i.product_id = ?`,
        [req.params.id],
        (err, inventory) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Server error' });
          }
          
          // Get inventory summary
          db.get(
            `SELECT 
              SUM(quantity) AS total_quantity,
              COUNT(DISTINCT location_id) AS location_count
            FROM 
              inventory
            WHERE 
              product_id = ?`,
            [req.params.id],
            (err, summary) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Server error' });
              }
              
              // Get recent transactions
              db.all(
                `SELECT 
                  t.transaction_id,
                  t.transaction_type,
                  t.quantity,
                  t.location_id,
                  l.name AS location_name,
                  t.created_by,
                  u.username,
                  t.created_at
                FROM 
                  inventory_transactions t
                LEFT JOIN
                  locations l ON t.location_id = l.location_id
                LEFT JOIN
                  users u ON t.created_by = u.user_id
                WHERE 
                  t.product_id = ?
                ORDER BY
                  t.created_at DESC
                LIMIT 5`,
                [req.params.id],
                (err, recentTransactions) => {
                  if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ message: 'Server error' });
                  }
                  
                  res.json({
                    ...product,
                    inventory,
                    summary: {
                      totalQuantity: summary ? summary.total_quantity : 0,
                      locationCount: summary ? summary.location_count : 0
                    },
                    recentTransactions
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

/**
 * @route   POST /api/products
 * @desc    Create a new product
 * @access  Private (Admin, Manager)
 */
router.post(
  '/',
  auth,
  upload.single('image'),
  [
    body('name', 'Name is required').notEmpty(),
    body('sku', 'SKU is required').notEmpty(),
    body('price', 'Price must be a positive number').isFloat({ min: 0 }),
    body('cost', 'Cost must be a positive number').optional().isFloat({ min: 0 }),
    body('description').optional(),
    body('categoryId').optional(),
    body('rackLocationId').optional(),
    body('barcode').optional()
  ],
  (req, res) => {
    // Check user role
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // If there was a file upload, delete it
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      }
      
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      name,
      description,
      sku,
      price,
      cost,
      categoryId,
      rackLocationId,
      barcode
    } = req.body;
    
    const db = req.app.locals.db;
    
    // Check if SKU already exists
    db.get('SELECT product_id FROM products WHERE sku = ?', [sku], (err, existingProduct) => {
      if (err) {
        console.error('Database error:', err);
        
        // If there was a file upload, delete it
        if (req.file) {
          fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
          });
        }
        
        return res.status(500).json({ message: 'Server error' });
      }
      
      if (existingProduct) {
        // If there was a file upload, delete it
        if (req.file) {
          fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
          });
        }
        
        return res.status(400).json({ message: 'SKU already exists' });
      }
      
      // Check if category exists (if provided)
      if (categoryId) {
        db.get('SELECT category_id FROM categories WHERE category_id = ?', [categoryId], (err, category) => {
          if (err) {
            console.error('Database error:', err);
            
            // If there was a file upload, delete it
            if (req.file) {
              fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
              });
            }
            
            return res.status(500).json({ message: 'Server error' });
          }
          
          if (!category) {
            // If there was a file upload, delete it
            if (req.file) {
              fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
              });
            }
            
            return res.status(404).json({ message: 'Category not found' });
          }
          
          createProduct();
        });
      } else {
        createProduct();
      }
    });
    
    function createProduct() {
      const productId = uuidv4();
      const imagePath = req.file ? `/uploads/products/${req.file.filename}` : null;
      
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
          productId,
          name,
          description || null,
          sku,
          price,
          cost || null,
          imagePath,
          categoryId || null,
          barcode || null
        ],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            
            // If there was a file upload, delete it
            if (req.file) {
              fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
              });
            }
            
            return res.status(500).json({ message: 'Server error' });
          }
          
          // If rack location is provided, create an inventory entry
          if (rackLocationId) {
            const inventoryId = uuidv4();
            db.run(
              `INSERT INTO inventory (
                inventory_id,
                product_id,
                location_id,
                quantity
              ) VALUES (?, ?, ?, ?)`,
              [
                inventoryId,
                productId,
                rackLocationId,
                0 // Initial quantity is 0
              ],
              (err) => {
                if (err) {
                  console.error('Error creating inventory record:', err);
                  // Continue with response as the product was created successfully
                }
              }
            );
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
              req.user.id,
              'CREATE',
              'products',
              productId,
              JSON.stringify({
                ...req.body,
                image_path: imagePath
              })
            ]
          );
          
          res.status(201).json({
            product_id: productId,
            name,
            description,
            sku,
            price,
            cost,
            image_path: imagePath,
            category_id: categoryId,
            barcode,
            message: 'Product created successfully'
          });
        }
      );
    }
  }
);

/**
 * @route   PUT /api/products/:id
 * @desc    Update a product
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id',
  auth,
  upload.single('image'),
  [
    body('name', 'Name is required').notEmpty(),
    body('sku', 'SKU is required').notEmpty(),
    body('price', 'Price must be a positive number').isFloat({ min: 0 }),
    body('cost', 'Cost must be a positive number').optional().isFloat({ min: 0 }),
    body('description').optional(),
    body('categoryId').optional(),
    body('rackLocationId').optional(),
    body('barcode').optional()
  ],
  (req, res) => {
    // Check user role
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // If there was a file upload, delete it
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      }
      
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      name,
      description,
      sku,
      price,
      cost,
      categoryId,
      rackLocationId,
      barcode
    } = req.body;
    
    const db = req.app.locals.db;
    
    // Check if product exists
    db.get('SELECT * FROM products WHERE product_id = ?', [req.params.id], (err, currentProduct) => {
      if (err) {
        console.error('Database error:', err);
        
        // If there was a file upload, delete it
        if (req.file) {
          fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
          });
        }
        
        return res.status(500).json({ message: 'Server error' });
      }
      
      if (!currentProduct) {
        // If there was a file upload, delete it
        if (req.file) {
          fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
          });
        }
        
        return res.status(404).json({ message: 'Product not found' });
      }
      
      // Check if SKU already exists for another product
      db.get('SELECT product_id FROM products WHERE sku = ? AND product_id != ?', [sku, req.params.id], (err, existingProduct) => {
        if (err) {
          console.error('Database error:', err);
          
          // If there was a file upload, delete it
          if (req.file) {
            fs.unlink(req.file.path, (err) => {
              if (err) console.error('Error deleting file:', err);
            });
          }
          
          return res.status(500).json({ message: 'Server error' });
        }
        
        if (existingProduct) {
          // If there was a file upload, delete it
          if (req.file) {
            fs.unlink(req.file.path, (err) => {
              if (err) console.error('Error deleting file:', err);
            });
          }
          
          return res.status(400).json({ message: 'SKU already exists for another product' });
        }
        
        // Check if category exists (if provided)
        if (categoryId) {
          db.get('SELECT category_id FROM categories WHERE category_id = ?', [categoryId], (err, category) => {
            if (err) {
              console.error('Database error:', err);
              
              // If there was a file upload, delete it
              if (req.file) {
                fs.unlink(req.file.path, (err) => {
                  if (err) console.error('Error deleting file:', err);
                });
              }
              
              return res.status(500).json({ message: 'Server error' });
            }
            
            if (!category) {
              // If there was a file upload, delete it
              if (req.file) {
                fs.unlink(req.file.path, (err) => {
                  if (err) console.error('Error deleting file:', err);
                });
              }
              
              return res.status(404).json({ message: 'Category not found' });
            }
            
            updateProduct(currentProduct);
          });
        } else {
          updateProduct(currentProduct);
        }
      });
    });
    
    function updateProduct(currentProduct) {
      // Handle image update
      let imagePath = currentProduct.image_path;
      
      if (req.file) {
        // Delete old image if it exists
        if (currentProduct.image_path) {
          const oldImagePath = path.join(__dirname, '..', currentProduct.image_path);
          fs.unlink(oldImagePath, (err) => {
            if (err && err.code !== 'ENOENT') {
              console.error('Error deleting old image:', err);
            }
          });
        }
        
        // Set new image path
        imagePath = `/uploads/products/${req.file.filename}`;
      }
      
      db.run(
        `UPDATE products SET 
          name = ?, 
          description = ?, 
          sku = ?, 
          price = ?,
          cost = ?,
          image_path = ?,
          category_id = ?,
          barcode = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE product_id = ?`,
        [
          name,
          description || null,
          sku,
          price,
          cost || null,
          imagePath,
          categoryId || null,
          barcode || null,
          req.params.id
        ],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            
            // If there was a file upload, delete it
            if (req.file) {
              fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
              });
            }
            
            return res.status(500).json({ message: 'Server error' });
          }
          
          if (this.changes === 0) {
            // If there was a file upload, delete it
            if (req.file) {
              fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
              });
            }
            
            return res.status(404).json({ message: 'Product not found' });
          }
          
          // Update rack location if provided
          if (rackLocationId) {
            // First check if there's an existing inventory record
            db.get(
              `SELECT inventory_id FROM inventory 
               WHERE product_id = ? AND location_id IN (
                 SELECT location_id FROM locations WHERE type = 'Rack'
               )`,
              [req.params.id],
              (err, existingInventory) => {
                if (err) {
                  console.error('Database error:', err);
                  // Continue with response as the product was updated successfully
                } else {
                  if (existingInventory) {
                    // Update existing inventory record
                    db.run(
                      `UPDATE inventory SET location_id = ? WHERE inventory_id = ?`,
                      [rackLocationId, existingInventory.inventory_id],
                      (err) => {
                        if (err) {
                          console.error('Error updating rack location:', err);
                        }
                      }
                    );
                  } else {
                    // Create new inventory record
                    const inventoryId = uuidv4();
                    db.run(
                      `INSERT INTO inventory (inventory_id, product_id, location_id, quantity) 
                       VALUES (?, ?, ?, ?)`,
                      [inventoryId, req.params.id, rackLocationId, 0],
                      (err) => {
                        if (err) {
                          console.error('Error creating rack location inventory:', err);
                        }
                      }
                    );
                  }
                }
              }
            );
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
              old_values,
              new_values
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              logId,
              req.user.id,
              'UPDATE',
              'products',
              req.params.id,
              JSON.stringify(currentProduct),
              JSON.stringify({
                ...req.body,
                image_path: imagePath
              })
            ]
          );
          
          res.json({
            product_id: req.params.id,
            name,
            description,
            sku,
            price,
            cost,
            image_path: imagePath,
            category_id: categoryId,
            barcode,
            message: 'Product updated successfully'
          });
        }
      );
    }
  }
);

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete a product
 * @access  Private (Admin only)
 */
router.delete('/:id', auth, (req, res) => {
  // Check user role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  
  const db = req.app.locals.db;
  
  // Check if product has inventory
  db.get('SELECT SUM(quantity) as total FROM inventory WHERE product_id = ?', [req.params.id], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    
    if (result.total > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete product with existing inventory. Please remove inventory first.' 
      });
    }
    
    // Get the current product data for audit log
    db.get('SELECT * FROM products WHERE product_id = ?', [req.params.id], (err, currentProduct) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      if (!currentProduct) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      // Delete the product
      db.run('DELETE FROM products WHERE product_id = ?', [req.params.id], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ message: 'Product not found' });
        }
        
        // Delete the product image if it exists
        if (currentProduct.image_path) {
          const imagePath = path.join(__dirname, '..', currentProduct.image_path);
          fs.unlink(imagePath, (err) => {
            if (err && err.code !== 'ENOENT') {
              console.error('Error deleting product image:', err);
            }
          });
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
            old_values
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            logId,
            req.user.id,
            'DELETE',
            'products',
            req.params.id,
            JSON.stringify(currentProduct)
          ]
        );
        
        res.json({ message: 'Product deleted successfully' });
      });
    });
  });
});

/**
 * @route   POST /api/products/import
 * @desc    Import products from Excel file
 * @access  Private (Admin only)
 */
router.post(
  '/import',
  auth,
  upload.single('excelFile'),
  async (req, res) => {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an Excel file.' });
    }

    // Check if file is an Excel file
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    if (fileExt !== '.xlsx' && fileExt !== '.xls') {
      // Remove the uploaded file if it's not an Excel file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Please upload a valid Excel file (.xlsx or .xls).' });
    }

    try {
      // Process the Excel file using our JavaScript utility
      const db = req.app.locals.db;
      const result = await importProductsFromExcel(req.file.path, db, req.user.id);

      // Remove the uploaded file after processing
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('Error removing temporary file:', err);
      }

      if (!result.success) {
        return res.status(500).json({ 
          message: 'Error importing products from Excel.', 
          error: result.error 
        });
      }

      return res.status(200).json({ 
        message: `Successfully imported ${result.importedCount} products.`,
        importedCount: result.importedCount,
        errors: result.errors
      });
    } catch (err) {
      console.error('Error processing Excel import:', err);
      
      // Remove the uploaded file if there was an error
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error('Error removing temporary file:', unlinkErr);
      }
      
      return res.status(500).json({ 
        message: 'Error processing Excel import.', 
        error: err.message 
      });
    }
  }
);

/**
 * @route   GET /api/products/import-template
 * @desc    Download product import Excel template
 * @access  Public
 */
router.get('/import-template', (req, res) => {
  res.download(templatePath, 'product_import_template.xlsx', (err) => {
    if (err) {
      console.error('Error downloading template:', err);
      res.status(500).json({ message: 'Error downloading template file' });
    }
  });
});

module.exports = router;