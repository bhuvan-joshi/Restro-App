const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

/**
 * @route   GET /api/inventory
 * @desc    Get inventory levels
 * @access  Private
 */
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const location = req.query.location || '';
  const lowStock = req.query.lowStock === 'true';
  
  let query = `
    SELECT 
      i.inventory_id,
      i.product_id,
      p.name AS product_name,
      p.sku,
      p.image_path,
      i.location_id,
      l.name AS location_name,
      i.quantity,
      i.min_quantity,
      i.max_quantity,
      CASE 
        WHEN i.quantity <= i.min_quantity THEN 'Low'
        WHEN i.max_quantity IS NOT NULL AND i.quantity >= i.max_quantity THEN 'Overstocked'
        ELSE 'OK'
      END AS stock_status
    FROM 
      inventory i
    JOIN 
      products p ON i.product_id = p.product_id
    JOIN 
      locations l ON i.location_id = l.location_id
    WHERE 
      (p.name LIKE ? OR p.sku LIKE ?)
  `;
  
  const params = [`%${search}%`, `%${search}%`];
  
  if (location) {
    query += ' AND i.location_id = ?';
    params.push(location);
  }
  
  if (lowStock) {
    query += ' AND i.quantity <= i.min_quantity';
  }
  
  query += ' ORDER BY p.name, l.name LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  // Get total count for pagination
  let countQuery = `
    SELECT COUNT(*) AS total
    FROM inventory i
    JOIN products p ON i.product_id = p.product_id
    JOIN locations l ON i.location_id = l.location_id
    WHERE (p.name LIKE ? OR p.sku LIKE ?)
  `;
  
  const countParams = [`%${search}%`, `%${search}%`];
  
  if (location) {
    countQuery += ' AND i.location_id = ?';
    countParams.push(location);
  }
  
  if (lowStock) {
    countQuery += ' AND i.quantity <= i.min_quantity';
  }
  
  db.get(countQuery, countParams, (err, countResult) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    
    db.all(query, params, (err, inventoryItems) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      const totalItems = countResult ? countResult.total : 0;
      const totalPages = Math.ceil(totalItems / limit);
      
      // Count low stock items for dashboard
      if (lowStock) {
        db.get(`
          SELECT COUNT(*) AS count
          FROM inventory
          WHERE quantity <= min_quantity
        `, [], (err, lowStockCount) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Server error' });
          }
          
          res.json({
            items: inventoryItems,
            pagination: {
              page,
              limit,
              totalItems,
              totalPages
            },
            summary: {
              lowStock: lowStockCount ? lowStockCount.count : 0
            }
          });
        });
      } else {
        res.json({
          items: inventoryItems,
          pagination: {
            page,
            limit,
            totalItems,
            totalPages
          }
        });
      }
    });
  });
});

/**
 * @route   GET /api/inventory/:id
 * @desc    Get inventory item by ID
 * @access  Private
 */
router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  
  db.get(
    `SELECT 
      i.inventory_id,
      i.product_id,
      p.name AS product_name,
      p.sku,
      p.image_path,
      i.location_id,
      l.name AS location_name,
      i.quantity,
      i.min_quantity,
      i.max_quantity,
      i.last_counted_at,
      i.created_at,
      i.updated_at
    FROM 
      inventory i
    JOIN 
      products p ON i.product_id = p.product_id
    JOIN 
      locations l ON i.location_id = l.location_id
    WHERE 
      i.inventory_id = ?`,
    [req.params.id],
    (err, inventoryItem) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      if (!inventoryItem) {
        return res.status(404).json({ message: 'Inventory item not found' });
      }
      
      // Get recent transactions for this inventory item
      db.all(
        `SELECT 
          t.transaction_id,
          t.transaction_type,
          t.quantity,
          t.previous_quantity,
          t.new_quantity,
          t.notes,
          t.created_at,
          u.username AS created_by
        FROM 
          inventory_transactions t
        JOIN 
          users u ON t.created_by = u.user_id
        WHERE 
          t.product_id = ? AND t.location_id = ?
        ORDER BY 
          t.created_at DESC
        LIMIT 10`,
        [inventoryItem.product_id, inventoryItem.location_id],
        (err, transactions) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Server error' });
          }
          
          res.json({
            ...inventoryItem,
            transactions
          });
        }
      );
    }
  );
});

/**
 * @route   POST /api/inventory
 * @desc    Create a new inventory record
 * @access  Private (Admin, Manager)
 */
router.post(
  '/',
  [
    body('productId', 'Product ID is required').notEmpty(),
    body('locationId', 'Location ID is required').notEmpty(),
    body('quantity', 'Quantity is required').isInt({ min: 0 }),
    body('minQuantity', 'Minimum quantity must be a non-negative integer').optional().isInt({ min: 0 }),
    body('maxQuantity', 'Maximum quantity must be a positive integer').optional().isInt({ min: 1 })
  ],
  (req, res) => {
    // Check user role
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      productId,
      locationId,
      quantity,
      minQuantity,
      maxQuantity
    } = req.body;
    
    const db = req.app.locals.db;
    
    // Check if product exists
    db.get('SELECT product_id FROM products WHERE product_id = ?', [productId], (err, product) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      // Check if location exists
      db.get('SELECT location_id FROM locations WHERE location_id = ?', [locationId], (err, location) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        
        if (!location) {
          return res.status(404).json({ message: 'Location not found' });
        }
        
        // Check if inventory record already exists for this product and location
        db.get(
          'SELECT inventory_id FROM inventory WHERE product_id = ? AND location_id = ?',
          [productId, locationId],
          (err, existingInventory) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ message: 'Server error' });
            }
            
            if (existingInventory) {
              return res.status(400).json({ 
                message: 'Inventory record already exists for this product and location' 
              });
            }
            
            const inventoryId = uuidv4();
            
            // Create inventory record
            db.run(
              `INSERT INTO inventory (
                inventory_id,
                product_id,
                location_id,
                quantity,
                min_quantity,
                max_quantity,
                last_counted_at
              ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
              [
                inventoryId,
                productId,
                locationId,
                quantity,
                minQuantity || 0,
                maxQuantity || null
              ],
              function(err) {
                if (err) {
                  console.error('Database error:', err);
                  return res.status(500).json({ message: 'Server error' });
                }
                
                // Record inventory transaction
                const transactionId = uuidv4();
                db.run(
                  `INSERT INTO inventory_transactions (
                    transaction_id,
                    product_id,
                    location_id,
                    transaction_type,
                    quantity,
                    previous_quantity,
                    new_quantity,
                    notes,
                    created_by
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    transactionId,
                    productId,
                    locationId,
                    'receive',
                    quantity,
                    0,
                    quantity,
                    'Initial inventory setup',
                    req.user.id
                  ],
                  function(err) {
                    if (err) {
                      console.error('Database error:', err);
                      return res.status(500).json({ message: 'Server error' });
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
                        'inventory',
                        inventoryId,
                        JSON.stringify(req.body)
                      ]
                    );
                    
                    res.status(201).json({
                      inventory_id: inventoryId,
                      product_id: productId,
                      location_id: locationId,
                      quantity,
                      min_quantity: minQuantity || 0,
                      max_quantity: maxQuantity || null,
                      message: 'Inventory record created successfully'
                    });
                  }
                );
              }
            );
          }
        );
      });
    });
  }
);

/**
 * @route   PUT /api/inventory/:id
 * @desc    Update inventory settings (min/max quantities)
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id',
  [
    body('minQuantity', 'Minimum quantity must be a non-negative integer').optional().isInt({ min: 0 }),
    body('maxQuantity', 'Maximum quantity must be a positive integer').optional().isInt({ min: 1 })
  ],
  (req, res) => {
    // Check user role
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      minQuantity,
      maxQuantity
    } = req.body;
    
    const db = req.app.locals.db;
    
    // Get current inventory record for audit log
    db.get('SELECT * FROM inventory WHERE inventory_id = ?', [req.params.id], (err, currentInventory) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      if (!currentInventory) {
        return res.status(404).json({ message: 'Inventory record not found' });
      }
      
      // Update inventory settings
      db.run(
        `UPDATE inventory SET 
          min_quantity = ?,
          max_quantity = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE inventory_id = ?`,
        [
          minQuantity !== undefined ? minQuantity : currentInventory.min_quantity,
          maxQuantity !== undefined ? maxQuantity : currentInventory.max_quantity,
          req.params.id
        ],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Server error' });
          }
          
          if (this.changes === 0) {
            return res.status(404).json({ message: 'Inventory record not found' });
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
              'inventory',
              req.params.id,
              JSON.stringify({
                min_quantity: currentInventory.min_quantity,
                max_quantity: currentInventory.max_quantity
              }),
              JSON.stringify({
                min_quantity: minQuantity !== undefined ? minQuantity : currentInventory.min_quantity,
                max_quantity: maxQuantity !== undefined ? maxQuantity : currentInventory.max_quantity
              })
            ]
          );
          
          res.json({
            inventory_id: req.params.id,
            min_quantity: minQuantity !== undefined ? minQuantity : currentInventory.min_quantity,
            max_quantity: maxQuantity !== undefined ? maxQuantity : currentInventory.max_quantity,
            message: 'Inventory settings updated successfully'
          });
        }
      );
    });
  }
);

/**
 * @route   POST /api/inventory/adjust
 * @desc    Adjust inventory to a specific quantity
 * @access  Private
 */
router.post(
  '/adjust',
  [
    body('inventory_id', 'Inventory ID is required').notEmpty(),
    body('quantity', 'Quantity must be a non-negative number').isInt({ min: 0 }),
    body('reason', 'Reason is required').notEmpty(),
    body('notes').optional()
  ],
  (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { inventory_id, quantity, reason, notes } = req.body;
    const db = req.app.locals.db;
    const transactionId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Combine reason and notes for the notes field in the database
    const combinedNotes = `Reason: ${reason}${notes ? `\nNotes: ${notes}` : ''}`;

    // Get the inventory item
    db.get(
      'SELECT i.*, p.product_id, l.location_id FROM inventory i JOIN products p ON i.product_id = p.product_id JOIN locations l ON i.location_id = l.location_id WHERE i.inventory_id = ?',
      [inventory_id],
      (err, inventoryItem) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Server error' });
        }

        if (!inventoryItem) {
          return res.status(404).json({ message: 'Inventory item not found' });
        }

        // No change in quantity
        if (inventoryItem.quantity === quantity) {
          return res.json({
            message: 'No change in inventory quantity',
            inventoryId: inventory_id,
            quantity: quantity
          });
        }

        // Begin transaction
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('Transaction begin error:', err);
            return res.status(500).json({ message: 'Server error' });
          }

          // Update inventory quantity
          db.run(
            'UPDATE inventory SET quantity = ?, updated_at = ? WHERE inventory_id = ?',
            [quantity, timestamp, inventory_id],
            (err) => {
              if (err) {
                console.error('Update inventory error:', err);
                db.run('ROLLBACK');
                return res.status(500).json({ message: 'Server error' });
              }

              // Record transaction
              db.run(
                `INSERT INTO inventory_transactions (
                  transaction_id, 
                  transaction_type, 
                  product_id, 
                  location_id, 
                  quantity, 
                  previous_quantity, 
                  new_quantity, 
                  notes, 
                  created_at, 
                  created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  transactionId,
                  'adjust',
                  inventoryItem.product_id,
                  inventoryItem.location_id,
                  Math.abs(quantity - inventoryItem.quantity), // Absolute change in quantity
                  inventoryItem.quantity,
                  quantity,
                  combinedNotes,
                  timestamp,
                  '1' // TODO: Replace with actual user ID from authentication
                ],
                (err) => {
                  if (err) {
                    console.error('Insert transaction error:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({ message: 'Server error' });
                  }

                  // Commit transaction
                  db.run('COMMIT', (err) => {
                    if (err) {
                      console.error('Transaction commit error:', err);
                      db.run('ROLLBACK');
                      return res.status(500).json({ message: 'Server error' });
                    }

                    res.json({
                      message: 'Inventory adjusted successfully',
                      inventoryId: inventory_id,
                      previousQuantity: inventoryItem.quantity,
                      newQuantity: quantity,
                      transactionId: transactionId
                    });
                  });
                }
              );
            }
          );
        });
      }
    );
  }
);

/**
 * @route   POST /api/inventory/transfer
 * @desc    Transfer inventory between locations
 * @access  Private
 */
router.post(
  '/transfer',
  [
    body('productId', 'Product ID is required').notEmpty(),
    body('fromLocationId', 'Source location ID is required').notEmpty(),
    body('toLocationId', 'Destination location ID is required').notEmpty(),
    body('quantity', 'Quantity is required').isInt({ min: 1 }),
    body('notes', 'Notes are required').notEmpty()
  ],
  (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      productId,
      fromLocationId,
      toLocationId,
      quantity,
      notes
    } = req.body;
    
    // Cannot transfer to the same location
    if (fromLocationId === toLocationId) {
      return res.status(400).json({ message: 'Cannot transfer to the same location' });
    }
    
    const db = req.app.locals.db;
    
    // Get source inventory record
    db.get(
      'SELECT * FROM inventory WHERE product_id = ? AND location_id = ?',
      [productId, fromLocationId],
      (err, sourceInventory) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        
        if (!sourceInventory) {
          return res.status(404).json({ message: 'Source inventory record not found' });
        }
        
        if (sourceInventory.quantity < quantity) {
          return res.status(400).json({ message: 'Not enough quantity available for transfer' });
        }
        
        // Get destination inventory record
        db.get(
          'SELECT * FROM inventory WHERE product_id = ? AND location_id = ?',
          [productId, toLocationId],
          (err, destInventory) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ message: 'Server error' });
            }
            
            // Begin transaction
            db.run('BEGIN TRANSACTION', (err) => {
              if (err) {
                console.error('Transaction error:', err);
                return res.status(500).json({ message: 'Server error' });
              }
              
              // Update source inventory
              const newSourceQuantity = sourceInventory.quantity - quantity;
              db.run(
                `UPDATE inventory SET 
                  quantity = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE product_id = ? AND location_id = ?`,
                [newSourceQuantity, productId, fromLocationId],
                function(err) {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('Database error:', err);
                    return res.status(500).json({ message: 'Server error' });
                  }
                  
                  // Record source transaction
                  const sourceTransactionId = uuidv4();
                  db.run(
                    `INSERT INTO inventory_transactions (
                      transaction_id,
                      product_id,
                      location_id,
                      transaction_type,
                      quantity,
                      previous_quantity,
                      new_quantity,
                      reference_id,
                      notes,
                      created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                      sourceTransactionId,
                      productId,
                      fromLocationId,
                      'transfer',
                      -quantity,
                      sourceInventory.quantity,
                      newSourceQuantity,
                      null,
                      `Transfer to ${toLocationId}: ${notes}`,
                      req.user.id
                    ],
                    function(err) {
                      if (err) {
                        db.run('ROLLBACK');
                        console.error('Database error:', err);
                        return res.status(500).json({ message: 'Server error' });
                      }
                      
                      // If destination inventory exists, update it
                      if (destInventory) {
                        const newDestQuantity = destInventory.quantity + quantity;
                        db.run(
                          `UPDATE inventory SET 
                            quantity = ?,
                            updated_at = CURRENT_TIMESTAMP
                          WHERE product_id = ? AND location_id = ?`,
                          [newDestQuantity, productId, toLocationId],
                          updateDestinationCallback
                        );
                      } else {
                        // Create new destination inventory
                        const inventoryId = uuidv4();
                        db.run(
                          `INSERT INTO inventory (
                            inventory_id,
                            product_id,
                            location_id,
                            quantity,
                            min_quantity,
                            max_quantity
                          ) VALUES (?, ?, ?, ?, ?, ?)`,
                          [
                            inventoryId,
                            productId,
                            toLocationId,
                            quantity,
                            0,
                            null
                          ],
                          updateDestinationCallback
                        );
                      }
                      
                      function updateDestinationCallback(err) {
                        if (err) {
                          db.run('ROLLBACK');
                          console.error('Database error:', err);
                          return res.status(500).json({ message: 'Server error' });
                        }
                        
                        // Record destination transaction
                        const destTransactionId = uuidv4();
                        const prevDestQuantity = destInventory ? destInventory.quantity : 0;
                        const newDestQuantity = prevDestQuantity + quantity;
                        
                        db.run(
                          `INSERT INTO inventory_transactions (
                            transaction_id,
                            product_id,
                            location_id,
                            transaction_type,
                            quantity,
                            previous_quantity,
                            new_quantity,
                            reference_id,
                            notes,
                            created_by
                          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                          [
                            destTransactionId,
                            productId,
                            toLocationId,
                            'transfer',
                            quantity,
                            prevDestQuantity,
                            newDestQuantity,
                            sourceTransactionId,
                            `Transfer from ${fromLocationId}: ${notes}`,
                            req.user.id
                          ],
                          function(err) {
                            if (err) {
                              db.run('ROLLBACK');
                              console.error('Database error:', err);
                              return res.status(500).json({ message: 'Server error' });
                            }
                            
                            // Commit transaction
                            db.run('COMMIT', (err) => {
                              if (err) {
                                db.run('ROLLBACK');
                                console.error('Transaction error:', err);
                                return res.status(500).json({ message: 'Server error' });
                              }
                              
                              res.json({
                                source_transaction_id: sourceTransactionId,
                                dest_transaction_id: destTransactionId,
                                product_id: productId,
                                from_location_id: fromLocationId,
                                to_location_id: toLocationId,
                                quantity,
                                message: 'Inventory transferred successfully'
                              });
                            });
                          }
                        );
                      }
                    }
                  );
                }
              );
            });
          }
        );
      }
    );
  }
);

/**
 * @route   POST /api/inventory/issue
 * @desc    Issue inventory (reduce quantity)
 * @access  Private
 */
router.post(
  '/issue',
  [
    body('inventory_id', 'Inventory ID is required').notEmpty(),
    body('quantity', 'Quantity must be a positive number').isInt({ min: 1 }),
    body('reason', 'Reason is required').notEmpty(),
    body('notes').optional()
  ],
  (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    console.log('Issue inventory request body:', req.body);

    const { inventory_id, quantity, reason, notes } = req.body;
    const db = req.app.locals.db;
    const transactionId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Combine reason and notes for the notes field in the database
    const combinedNotes = `Reason: ${reason}${notes ? `\nNotes: ${notes}` : ''}`;

    // Get the inventory item
    db.get(
      'SELECT i.*, p.product_id, l.location_id FROM inventory i JOIN products p ON i.product_id = p.product_id JOIN locations l ON i.location_id = l.location_id WHERE i.inventory_id = ?',
      [inventory_id],
      (err, inventoryItem) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Server error' });
        }

        if (!inventoryItem) {
          return res.status(404).json({ message: 'Inventory item not found' });
        }

        console.log('Found inventory item:', inventoryItem);

        // Check if there's enough quantity to issue
        if (inventoryItem.quantity < quantity) {
          return res.status(400).json({ 
            message: 'Not enough inventory to issue',
            available: inventoryItem.quantity
          });
        }

        const newQuantity = inventoryItem.quantity - quantity;

        // Begin transaction
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('Transaction begin error:', err);
            return res.status(500).json({ message: 'Server error' });
          }

          // Update inventory quantity
          db.run(
            'UPDATE inventory SET quantity = ?, updated_at = ? WHERE inventory_id = ?',
            [newQuantity, timestamp, inventory_id],
            (err) => {
              if (err) {
                console.error('Update inventory error:', err);
                db.run('ROLLBACK');
                return res.status(500).json({ message: 'Server error' });
              }

              console.log('Updated inventory quantity to:', newQuantity);

              // Construct the SQL query for debugging
              const sql = `INSERT INTO inventory_transactions (
                transaction_id, 
                transaction_type, 
                product_id, 
                location_id, 
                quantity, 
                previous_quantity, 
                new_quantity, 
                notes, 
                created_at, 
                created_by
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
              
              const params = [
                transactionId,
                'issue',
                inventoryItem.product_id,
                inventoryItem.location_id,
                quantity,
                inventoryItem.quantity,
                newQuantity,
                combinedNotes,
                timestamp,
                '1' // TODO: Replace with actual user ID from authentication
              ];
              
              console.log('SQL Query:', sql);
              console.log('SQL Params:', params);

              // Record transaction
              db.run(
                sql,
                params,
                (err) => {
                  if (err) {
                    console.error('Insert transaction error:', err);
                    console.error('SQL that caused error:', sql);
                    console.error('Params that caused error:', JSON.stringify(params));
                    db.run('ROLLBACK');
                    return res.status(500).json({ message: 'Server error' });
                  }

                  // Commit transaction
                  db.run('COMMIT', (err) => {
                    if (err) {
                      console.error('Transaction commit error:', err);
                      db.run('ROLLBACK');
                      return res.status(500).json({ message: 'Server error' });
                    }

                    res.json({
                      message: 'Inventory issued successfully',
                      inventoryId: inventory_id,
                      newQuantity: newQuantity,
                      transactionId: transactionId
                    });
                  });
                }
              );
            }
          );
        });
      }
    );
  }
);

/**
 * @route   POST /api/inventory/receive
 * @desc    Receive inventory (increase quantity)
 * @access  Private
 */
router.post(
  '/receive',
  [
    body('inventory_id', 'Inventory ID is required').notEmpty(),
    body('quantity', 'Quantity must be a positive number').isInt({ min: 1 }),
    body('reason', 'Reason is required').notEmpty(),
    body('notes').optional()
  ],
  (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { inventory_id, quantity, reason, notes } = req.body;
    const db = req.app.locals.db;
    const transactionId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Combine reason and notes for the notes field in the database
    const combinedNotes = `Reason: ${reason}${notes ? `\nNotes: ${notes}` : ''}`;

    // Get the inventory item
    db.get(
      'SELECT i.*, p.product_id, l.location_id FROM inventory i JOIN products p ON i.product_id = p.product_id JOIN locations l ON i.location_id = l.location_id WHERE i.inventory_id = ?',
      [inventory_id],
      (err, inventoryItem) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Server error' });
        }

        if (!inventoryItem) {
          return res.status(404).json({ message: 'Inventory item not found' });
        }

        const newQuantity = inventoryItem.quantity + quantity;

        // Begin transaction
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('Transaction begin error:', err);
            return res.status(500).json({ message: 'Server error' });
          }

          // Update inventory quantity
          db.run(
            'UPDATE inventory SET quantity = ?, updated_at = ? WHERE inventory_id = ?',
            [newQuantity, timestamp, inventory_id],
            (err) => {
              if (err) {
                console.error('Update inventory error:', err);
                db.run('ROLLBACK');
                return res.status(500).json({ message: 'Server error' });
              }

              // Record transaction
              db.run(
                `INSERT INTO inventory_transactions (
                  transaction_id, 
                  transaction_type, 
                  product_id, 
                  location_id, 
                  quantity, 
                  previous_quantity, 
                  new_quantity, 
                  notes, 
                  created_at, 
                  created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  transactionId,
                  'receive',
                  inventoryItem.product_id,
                  inventoryItem.location_id,
                  quantity,
                  inventoryItem.quantity,
                  newQuantity,
                  combinedNotes,
                  timestamp,
                  '1' // TODO: Replace with actual user ID from authentication
                ],
                (err) => {
                  if (err) {
                    console.error('Insert transaction error:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({ message: 'Server error' });
                  }

                  // Commit transaction
                  db.run('COMMIT', (err) => {
                    if (err) {
                      console.error('Transaction commit error:', err);
                      db.run('ROLLBACK');
                      return res.status(500).json({ message: 'Server error' });
                    }

                    res.json({
                      message: 'Inventory received successfully',
                      inventoryId: inventory_id,
                      newQuantity: newQuantity,
                      transactionId: transactionId
                    });
                  });
                }
              );
            }
          );
        });
      }
    );
  }
);

module.exports = router;