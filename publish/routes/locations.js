const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

/**
 * @route   GET /api/locations
 * @desc    Get all locations
 * @access  Private
 */
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const { type } = req.query;
  
  let query = `
    SELECT 
      l.location_id, 
      l.name, 
      l.description, 
      l.type,
      l.address,
      l.city,
      l.state,
      l.postal_code,
      l.country,
      l.created_at,
      l.updated_at,
      (SELECT COUNT(*) FROM inventory WHERE location_id = l.location_id) AS inventory_count,
      (SELECT SUM(quantity) FROM inventory WHERE location_id = l.location_id) AS total_items
    FROM 
      locations l
    WHERE 1=1
  `;
  
  const queryParams = [];
  
  if (type) {
    query += ` AND l.type = ?`;
    queryParams.push(type);
  }
  
  query += ` ORDER BY l.name`;
  
  db.all(query, queryParams, (err, locations) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    
    res.json({ locations });
  });
});

/**
 * @route   GET /api/locations/:id
 * @desc    Get location by ID
 * @access  Private
 */
router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  
  db.get(
    `SELECT 
      l.location_id, 
      l.name, 
      l.description, 
      l.type,
      l.address,
      l.city,
      l.state,
      l.postal_code,
      l.country,
      l.created_at,
      l.updated_at
    FROM 
      locations l
    WHERE 
      l.location_id = ?`,
    [req.params.id],
    (err, location) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      if (!location) {
        return res.status(404).json({ message: 'Location not found' });
      }
      
      // Get inventory at this location
      db.all(
        `SELECT 
          i.inventory_id,
          i.product_id,
          p.name AS product_name,
          p.sku,
          p.image_path,
          i.quantity,
          i.min_quantity,
          i.max_quantity
        FROM 
          inventory i
        JOIN 
          products p ON i.product_id = p.product_id
        WHERE 
          i.location_id = ?
        ORDER BY 
          p.name
        LIMIT 10`,
        [req.params.id],
        (err, inventory) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Server error' });
          }
          
          // Get inventory summary
          db.get(
            `SELECT 
              COUNT(DISTINCT product_id) AS product_count,
              SUM(quantity) AS total_quantity,
              COUNT(CASE WHEN quantity < min_quantity THEN 1 END) AS low_stock_count
            FROM 
              inventory
            WHERE 
              location_id = ?`,
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
                  t.product_id,
                  p.name AS product_name,
                  t.quantity,
                  t.user_id,
                  u.username,
                  t.created_at
                FROM 
                  transactions t
                JOIN
                  products p ON t.product_id = p.product_id
                JOIN
                  users u ON t.user_id = u.user_id
                WHERE 
                  t.location_id = ?
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
                    ...location,
                    inventory,
                    summary: {
                      productCount: summary ? summary.product_count : 0,
                      totalQuantity: summary ? summary.total_quantity : 0,
                      lowStockCount: summary ? summary.low_stock_count : 0
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
 * @route   POST /api/locations
 * @desc    Create a new location
 * @access  Private (Admin, Manager)
 */
router.post(
  '/',
  [
    body('name', 'Name is required').notEmpty(),
    body('type', 'Type is required').notEmpty(),
    body('description').optional(),
    body('address').optional(),
    body('city').optional(),
    body('state').optional(),
    body('postalCode').optional(),
    body('country').optional()
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
      name,
      description,
      type,
      address,
      city,
      state,
      postalCode,
      country
    } = req.body;
    
    const db = req.app.locals.db;
    const locationId = uuidv4();
    
    db.run(
      `INSERT INTO locations (
        location_id, 
        name, 
        description, 
        type,
        address,
        city,
        state,
        postal_code,
        country
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        locationId,
        name,
        description || null,
        type,
        address || null,
        city || null,
        state || null,
        postalCode || null,
        country || null
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
            'locations',
            locationId,
            JSON.stringify(req.body)
          ]
        );
        
        res.status(201).json({
          location_id: locationId,
          name,
          description,
          type,
          address,
          city,
          state,
          postal_code: postalCode,
          country,
          message: 'Location created successfully'
        });
      }
    );
  }
);

/**
 * @route   PUT /api/locations/:id
 * @desc    Update a location
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id',
  [
    body('name', 'Name is required').notEmpty(),
    body('type', 'Type is required').notEmpty(),
    body('description').optional(),
    body('address').optional(),
    body('city').optional(),
    body('state').optional(),
    body('postalCode').optional(),
    body('country').optional()
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
      name,
      description,
      type,
      address,
      city,
      state,
      postalCode,
      country
    } = req.body;
    
    const db = req.app.locals.db;
    
    // Get the current location data for audit log
    db.get('SELECT * FROM locations WHERE location_id = ?', [req.params.id], (err, currentLocation) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      if (!currentLocation) {
        return res.status(404).json({ message: 'Location not found' });
      }
      
      db.run(
        `UPDATE locations SET 
          name = ?, 
          description = ?, 
          type = ?,
          address = ?,
          city = ?,
          state = ?,
          postal_code = ?,
          country = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE location_id = ?`,
        [
          name,
          description || null,
          type,
          address || null,
          city || null,
          state || null,
          postalCode || null,
          country || null,
          req.params.id
        ],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Server error' });
          }
          
          if (this.changes === 0) {
            return res.status(404).json({ message: 'Location not found' });
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
              'locations',
              req.params.id,
              JSON.stringify(currentLocation),
              JSON.stringify(req.body)
            ]
          );
          
          res.json({
            location_id: req.params.id,
            name,
            description,
            type,
            address,
            city,
            state,
            postal_code: postalCode,
            country,
            message: 'Location updated successfully'
          });
        }
      );
    });
  }
);

/**
 * @route   DELETE /api/locations/:id
 * @desc    Delete a location
 * @access  Private (Admin only)
 */
router.delete('/:id', (req, res) => {
  // Check user role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  
  const db = req.app.locals.db;
  
  // Check if location has inventory
  db.get('SELECT COUNT(*) as count FROM inventory WHERE location_id = ?', [req.params.id], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    
    if (result.count > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete location with existing inventory. Please remove inventory first.' 
      });
    }
    
    // Get the current location data for audit log
    db.get('SELECT * FROM locations WHERE location_id = ?', [req.params.id], (err, currentLocation) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      if (!currentLocation) {
        return res.status(404).json({ message: 'Location not found' });
      }
      
      // Delete the location
      db.run('DELETE FROM locations WHERE location_id = ?', [req.params.id], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ message: 'Location not found' });
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
            'locations',
            req.params.id,
            JSON.stringify(currentLocation)
          ]
        );
        
        res.json({ message: 'Location deleted successfully' });
      });
    });
  });
});

module.exports = router;