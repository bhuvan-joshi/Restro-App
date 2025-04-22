const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');

/**
 * @route   GET /api/transactions/summary/daily
 * @desc    Get daily transaction summary
 * @access  Private (Admin, Manager)
 */
router.get('/summary/daily', auth, (req, res) => {
  // Check user role
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  
  const db = req.app.locals.db;
  const startDate = req.query.startDate || '';
  const endDate = req.query.endDate || '';
  const locationId = req.query.locationId || '';
  
  let query = `
    SELECT 
      date(t.created_at) AS date,
      t.transaction_type,
      COUNT(*) AS transaction_count,
      SUM(CASE WHEN t.quantity > 0 THEN t.quantity ELSE 0 END) AS total_in,
      SUM(CASE WHEN t.quantity < 0 THEN ABS(t.quantity) ELSE 0 END) AS total_out
    FROM 
      inventory_transactions t
    WHERE 1=1
  `;
  
  const queryParams = [];
  
  if (startDate) {
    query += ' AND t.created_at >= ?';
    queryParams.push(startDate);
  }
  
  if (endDate) {
    query += ' AND t.created_at <= ?';
    queryParams.push(endDate + ' 23:59:59');
  }
  
  if (locationId) {
    query += ' AND t.location_id = ?';
    queryParams.push(locationId);
  }
  
  query += ' GROUP BY date(t.created_at), t.transaction_type ORDER BY date(t.created_at) DESC, t.transaction_type';
  
  db.all(query, queryParams, (err, summary) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    
    res.json({ summary });
  });
});

/**
 * @route   GET /api/transactions/summary/product
 * @desc    Get product transaction summary
 * @access  Private (Admin, Manager)
 */
router.get('/summary/product', auth, (req, res) => {
  // Check user role
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  
  const db = req.app.locals.db;
  const startDate = req.query.startDate || '';
  const endDate = req.query.endDate || '';
  const locationId = req.query.locationId || '';
  
  let query = `
    SELECT 
      t.product_id,
      p.name AS product_name,
      p.sku,
      COUNT(*) AS transaction_count,
      SUM(CASE WHEN t.quantity > 0 THEN t.quantity ELSE 0 END) AS total_in,
      SUM(CASE WHEN t.quantity < 0 THEN ABS(t.quantity) ELSE 0 END) AS total_out,
      SUM(t.quantity) AS net_change
    FROM 
      inventory_transactions t
    JOIN
      products p ON t.product_id = p.product_id
    WHERE 1=1
  `;
  
  const queryParams = [];
  
  if (startDate) {
    query += ' AND t.created_at >= ?';
    queryParams.push(startDate);
  }
  
  if (endDate) {
    query += ' AND t.created_at <= ?';
    queryParams.push(endDate + ' 23:59:59');
  }
  
  if (locationId) {
    query += ' AND t.location_id = ?';
    queryParams.push(locationId);
  }
  
  query += ' GROUP BY t.product_id ORDER BY net_change DESC';
  
  db.all(query, queryParams, (err, summary) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    
    res.json({ summary });
  });
});

/**
 * @route   GET /api/transactions/summary/user
 * @desc    Get user transaction summary
 * @access  Private (Admin only)
 */
router.get('/summary/user', auth, (req, res) => {
  // Check user role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  
  const db = req.app.locals.db;
  const startDate = req.query.startDate || '';
  const endDate = req.query.endDate || '';
  
  let query = `
    SELECT 
      t.created_by AS user_id,
      u.username,
      u.email,
      COUNT(*) AS transaction_count,
      COUNT(DISTINCT t.product_id) AS product_count,
      COUNT(DISTINCT t.location_id) AS location_count,
      COUNT(DISTINCT date(t.created_at)) AS days_active
    FROM 
      inventory_transactions t
    JOIN
      users u ON t.created_by = u.user_id
    WHERE 1=1
  `;
  
  const queryParams = [];
  
  if (startDate) {
    query += ' AND t.created_at >= ?';
    queryParams.push(startDate);
  }
  
  if (endDate) {
    query += ' AND t.created_at <= ?';
    queryParams.push(endDate + ' 23:59:59');
  }
  
  query += ' GROUP BY t.created_by ORDER BY transaction_count DESC';
  
  db.all(query, queryParams, (err, summary) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    
    res.json({ summary });
  });
});

/**
 * @route   GET /api/transactions/:id
 * @desc    Get transaction by ID
 * @access  Private
 */
router.get('/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  
  db.get(
    `SELECT 
      t.transaction_id, 
      t.product_id,
      p.name AS product_name,
      p.sku,
      t.location_id,
      l.name AS location_name,
      t.transaction_type,
      t.quantity,
      t.previous_quantity,
      t.new_quantity,
      t.reference_id,
      t.notes,
      t.created_at,
      t.created_by,
      COALESCE(u.username, 'System') AS created_by_username
    FROM 
      inventory_transactions t
    JOIN 
      products p ON t.product_id = p.product_id
    JOIN 
      locations l ON t.location_id = l.location_id
    LEFT JOIN 
      users u ON t.created_by = u.user_id
    WHERE 
      t.transaction_id = ?`,
    [req.params.id],
    (err, transaction) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      if (!transaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }
      
      // If this transaction has a reference ID, get the related transaction
      if (transaction.reference_id) {
        db.get(
          `SELECT 
            t.transaction_id, 
            t.product_id,
            p.name AS product_name,
            t.location_id,
            l.name AS location_name,
            t.transaction_type,
            t.quantity,
            t.notes,
            t.created_at
          FROM 
            inventory_transactions t
          JOIN 
            products p ON t.product_id = p.product_id
          JOIN 
            locations l ON t.location_id = l.location_id
          WHERE 
            t.transaction_id = ?`,
          [transaction.reference_id],
          (err, relatedTransaction) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ message: 'Server error' });
            }
            
            res.json({
              ...transaction,
              relatedTransaction: relatedTransaction || null
            });
          }
        );
      } else {
        // Check if this transaction is referenced by other transactions
        db.all(
          `SELECT 
            t.transaction_id, 
            t.product_id,
            p.name AS product_name,
            t.location_id,
            l.name AS location_name,
            t.transaction_type,
            t.quantity,
            t.notes,
            t.created_at
          FROM 
            inventory_transactions t
          JOIN 
            products p ON t.product_id = p.product_id
          JOIN 
            locations l ON t.location_id = l.location_id
          WHERE 
            t.reference_id = ?`,
          [transaction.transaction_id],
          (err, relatedTransactions) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ message: 'Server error' });
            }
            
            res.json({
              ...transaction,
              relatedTransactions: relatedTransactions || []
            });
          }
        );
      }
    }
  );
});

/**
 * @route   GET /api/transactions
 * @desc    Get all transactions with pagination and filtering
 * @access  Private
 */
router.get('/', auth, (req, res) => {
  const db = req.app.locals.db;
  
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  
  const productId = req.query.productId || '';
  const locationId = req.query.locationId || '';
  const transactionType = req.query.transactionType || '';
  const startDate = req.query.startDate || '';
  const endDate = req.query.endDate || '';
  const userId = req.query.userId || '';
  
  let query = `
    SELECT 
      t.transaction_id, 
      t.product_id,
      p.name AS product_name,
      p.sku,
      t.location_id,
      l.name AS location_name,
      t.transaction_type,
      t.quantity,
      t.previous_quantity,
      t.new_quantity,
      t.reference_id,
      t.notes,
      t.created_at,
      t.created_by,
      COALESCE(u.username, 'System') AS created_by_username
    FROM 
      inventory_transactions t
    LEFT JOIN 
      products p ON t.product_id = p.product_id
    LEFT JOIN 
      locations l ON t.location_id = l.location_id
    LEFT JOIN 
      users u ON t.created_by = u.user_id
    WHERE 1=1
  `;
  
  const queryParams = [];
  
  if (productId) {
    query += ' AND t.product_id = ?';
    queryParams.push(productId);
  }
  
  if (locationId) {
    query += ' AND t.location_id = ?';
    queryParams.push(locationId);
  }
  
  if (transactionType) {
    query += ' AND t.transaction_type = ?';
    queryParams.push(transactionType);
  }
  
  if (startDate) {
    query += ' AND t.created_at >= ?';
    queryParams.push(startDate);
  }
  
  if (endDate) {
    query += ' AND t.created_at <= ?';
    queryParams.push(endDate + ' 23:59:59');
  }
  
  if (userId) {
    query += ' AND t.created_by = ?';
    queryParams.push(userId);
  }
  
  // Count total transactions for pagination
  let countQuery = `
    SELECT COUNT(*) as count 
    FROM inventory_transactions t
    WHERE 1=1
  `;
  
  const countParams = [];
  
  if (productId) {
    countQuery += ' AND t.product_id = ?';
    countParams.push(productId);
  }
  
  if (locationId) {
    countQuery += ' AND t.location_id = ?';
    countParams.push(locationId);
  }
  
  if (transactionType) {
    countQuery += ' AND t.transaction_type = ?';
    countParams.push(transactionType);
  }
  
  if (startDate) {
    countQuery += ' AND t.created_at >= ?';
    countParams.push(startDate);
  }
  
  if (endDate) {
    countQuery += ' AND t.created_at <= ?';
    countParams.push(endDate + ' 23:59:59');
  }
  
  if (userId) {
    countQuery += ' AND t.created_by = ?';
    countParams.push(userId);
  }
  
  db.get(countQuery, countParams, (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    
    const totalTransactions = result.count;
    const totalPages = Math.ceil(totalTransactions / limit);
    
    console.log(`Fetching transactions page ${page}, offset: ${offset}, limit: ${limit}, total: ${totalTransactions}`);
    
    // Add sorting and pagination to the query
    query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);
    
    db.all(query, queryParams, (err, transactions) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      console.log(`Retrieved ${transactions.length} transactions for page ${page}`);
      
      res.json({
        transactions,
        pagination: {
          page,
          limit,
          totalTransactions,
          totalPages
        }
      });
    });
  });
});

module.exports = router;