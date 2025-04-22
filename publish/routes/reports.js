const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

/**
 * @route   GET /api/reports/inventory/status
 * @desc    Get inventory status report
 * @access  Private
 */
router.get('/inventory/status', auth, (req, res) => {
  const db = req.app.locals.db;
  const locationId = req.query.locationId || '';
  const categoryId = req.query.categoryId || '';
  const lowStockOnly = req.query.lowStock === 'true';
  
  let query = `
    SELECT 
      p.product_id,
      p.name AS product_name,
      p.sku,
      p.image_path,
      c.category_id,
      c.name AS category_name,
      l.location_id,
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
    LEFT JOIN 
      categories c ON p.category_id = c.category_id
    WHERE 1=1
  `;
  
  const queryParams = [];
  
  if (locationId) {
    query += ' AND i.location_id = ?';
    queryParams.push(locationId);
  }
  
  if (categoryId) {
    query += ' AND p.category_id = ?';
    queryParams.push(categoryId);
  }
  
  if (lowStockOnly) {
    query += ' AND i.quantity <= i.min_quantity';
  }
  
  query += ' ORDER BY stock_status, p.name, l.name';
  
  db.all(query, queryParams, (err, items) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    
    // Get summary counts
    const summary = {
      totalItems: items.length,
      lowStock: items.filter(item => item.stock_status === 'Low').length,
      overstocked: items.filter(item => item.stock_status === 'Overstocked').length,
      ok: items.filter(item => item.stock_status === 'OK').length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0)
    };
    
    res.json({
      items,
      summary,
      filters: {
        locationId: locationId || null,
        categoryId: categoryId || null,
        lowStockOnly
      }
    });
  });
});

/**
 * @route   GET /api/reports/inventory/value
 * @desc    Get inventory value report
 * @access  Private (Admin, Manager)
 */
router.get('/inventory/value', auth, (req, res) => {
  // Check user role
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  
  const db = req.app.locals.db;
  const locationId = req.query.locationId || '';
  const categoryId = req.query.categoryId || '';
  
  let query = `
    SELECT 
      p.product_id,
      p.name AS product_name,
      p.sku,
      p.price,
      p.cost,
      c.category_id,
      c.name AS category_name,
      l.location_id,
      l.name AS location_name,
      i.quantity,
      (i.quantity * p.cost) AS total_cost,
      (i.quantity * p.price) AS total_value,
      ((i.quantity * p.price) - (i.quantity * p.cost)) AS potential_profit
    FROM 
      inventory i
    JOIN 
      products p ON i.product_id = p.product_id
    JOIN 
      locations l ON i.location_id = l.location_id
    LEFT JOIN 
      categories c ON p.category_id = c.category_id
    WHERE 
      p.cost IS NOT NULL AND p.price IS NOT NULL
  `;
  
  const queryParams = [];
  
  if (locationId) {
    query += ' AND i.location_id = ?';
    queryParams.push(locationId);
  }
  
  if (categoryId) {
    query += ' AND p.category_id = ?';
    queryParams.push(categoryId);
  }
  
  query += ' ORDER BY total_value DESC';
  
  db.all(query, queryParams, (err, items) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    
    // Get summary totals
    const summary = {
      totalItems: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      totalCost: items.reduce((sum, item) => sum + item.total_cost, 0),
      totalValue: items.reduce((sum, item) => sum + item.total_value, 0),
      potentialProfit: items.reduce((sum, item) => sum + item.potential_profit, 0)
    };
    
    // Get category breakdown
    const categoryBreakdown = {};
    items.forEach(item => {
      const categoryName = item.category_name || 'Uncategorized';
      if (!categoryBreakdown[categoryName]) {
        categoryBreakdown[categoryName] = {
          quantity: 0,
          cost: 0,
          value: 0
        };
      }
      categoryBreakdown[categoryName].quantity += item.quantity;
      categoryBreakdown[categoryName].cost += item.total_cost;
      categoryBreakdown[categoryName].value += item.total_value;
    });
    
    // Get location breakdown
    const locationBreakdown = {};
    items.forEach(item => {
      if (!locationBreakdown[item.location_name]) {
        locationBreakdown[item.location_name] = {
          quantity: 0,
          cost: 0,
          value: 0
        };
      }
      locationBreakdown[item.location_name].quantity += item.quantity;
      locationBreakdown[item.location_name].cost += item.total_cost;
      locationBreakdown[item.location_name].value += item.total_value;
    });
    
    res.json({
      items,
      summary,
      categoryBreakdown,
      locationBreakdown,
      filters: {
        locationId: locationId || null,
        categoryId: categoryId || null
      }
    });
  });
});

/**
 * @route   GET /api/reports/inventory/movement
 * @desc    Get inventory movement report
 * @access  Private
 */
router.get('/inventory/movement', auth, (req, res) => {
  const db = req.app.locals.db;
  const productId = req.query.productId || '';
  const locationId = req.query.locationId || '';
  const startDate = req.query.startDate || '';
  const endDate = req.query.endDate || '';
  
  let query = `
    SELECT 
      p.product_id,
      p.name AS product_name,
      p.sku,
      l.location_id,
      l.name AS location_name,
      t.transaction_type,
      SUM(CASE WHEN t.quantity > 0 THEN t.quantity ELSE 0 END) AS total_in,
      SUM(CASE WHEN t.quantity < 0 THEN ABS(t.quantity) ELSE 0 END) AS total_out,
      SUM(t.quantity) AS net_change,
      COUNT(*) AS transaction_count
    FROM 
      inventory_transactions t
    JOIN 
      products p ON t.product_id = p.product_id
    JOIN 
      locations l ON t.location_id = l.location_id
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
  
  if (startDate) {
    query += ' AND t.created_at >= ?';
    queryParams.push(startDate);
  }
  
  if (endDate) {
    query += ' AND t.created_at <= ?';
    queryParams.push(endDate + ' 23:59:59');
  }
  
  query += ' GROUP BY p.product_id, l.location_id, t.transaction_type';
  query += ' ORDER BY p.name, l.name, t.transaction_type';
  
  db.all(query, queryParams, (err, movements) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    
    // Get summary by product
    const productSummary = {};
    movements.forEach(movement => {
      const productKey = movement.product_id;
      if (!productSummary[productKey]) {
        productSummary[productKey] = {
          product_id: movement.product_id,
          product_name: movement.product_name,
          sku: movement.sku,
          total_in: 0,
          total_out: 0,
          net_change: 0,
          transaction_count: 0
        };
      }
      productSummary[productKey].total_in += movement.total_in;
      productSummary[productKey].total_out += movement.total_out;
      productSummary[productKey].net_change += movement.net_change;
      productSummary[productKey].transaction_count += movement.transaction_count;
    });
    
    // Get summary by location
    const locationSummary = {};
    movements.forEach(movement => {
      const locationKey = movement.location_id;
      if (!locationSummary[locationKey]) {
        locationSummary[locationKey] = {
          location_id: movement.location_id,
          location_name: movement.location_name,
          total_in: 0,
          total_out: 0,
          net_change: 0,
          transaction_count: 0
        };
      }
      locationSummary[locationKey].total_in += movement.total_in;
      locationSummary[locationKey].total_out += movement.total_out;
      locationSummary[locationKey].net_change += movement.net_change;
      locationSummary[locationKey].transaction_count += movement.transaction_count;
    });
    
    // Get summary by transaction type
    const typeSummary = {};
    movements.forEach(movement => {
      const typeKey = movement.transaction_type;
      if (!typeSummary[typeKey]) {
        typeSummary[typeKey] = {
          transaction_type: movement.transaction_type,
          total_in: 0,
          total_out: 0,
          net_change: 0,
          transaction_count: 0
        };
      }
      typeSummary[typeKey].total_in += movement.total_in;
      typeSummary[typeKey].total_out += movement.total_out;
      typeSummary[typeKey].net_change += movement.net_change;
      typeSummary[typeKey].transaction_count += movement.transaction_count;
    });
    
    // Get overall summary
    const overallSummary = {
      total_in: movements.reduce((sum, item) => sum + item.total_in, 0),
      total_out: movements.reduce((sum, item) => sum + item.total_out, 0),
      net_change: movements.reduce((sum, item) => sum + item.net_change, 0),
      transaction_count: movements.reduce((sum, item) => sum + item.transaction_count, 0)
    };
    
    res.json({
      movements,
      productSummary: Object.values(productSummary),
      locationSummary: Object.values(locationSummary),
      typeSummary: Object.values(typeSummary),
      overallSummary,
      filters: {
        productId: productId || null,
        locationId: locationId || null,
        startDate: startDate || null,
        endDate: endDate || null
      }
    });
  });
});

/**
 * @route   GET /api/reports/activity/user
 * @desc    Get user activity report
 * @access  Private (Admin only)
 */
router.get('/activity/user', auth, (req, res) => {
  // Check user role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  
  const db = req.app.locals.db;
  const userId = req.query.userId || '';
  const startDate = req.query.startDate || '';
  const endDate = req.query.endDate || '';
  
  let query = `
    SELECT 
      a.log_id,
      a.user_id,
      u.username,
      a.action,
      a.table_name,
      a.record_id,
      a.created_at
    FROM 
      audit_log a
    JOIN 
      users u ON a.user_id = u.user_id
    WHERE 1=1
  `;
  
  const queryParams = [];
  
  if (userId) {
    query += ' AND a.user_id = ?';
    queryParams.push(userId);
  }
  
  if (startDate) {
    query += ' AND a.created_at >= ?';
    queryParams.push(startDate);
  }
  
  if (endDate) {
    query += ' AND a.created_at <= ?';
    queryParams.push(endDate + ' 23:59:59');
  }
  
  query += ' ORDER BY a.created_at DESC LIMIT 1000';
  
  db.all(query, queryParams, (err, activities) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    
    // Get summary by user
    const userSummary = {};
    activities.forEach(activity => {
      const userKey = activity.user_id;
      if (!userSummary[userKey]) {
        userSummary[userKey] = {
          user_id: activity.user_id,
          username: activity.username,
          activity_count: 0,
          actions: {}
        };
      }
      userSummary[userKey].activity_count++;
      
      const actionKey = activity.action;
      if (!userSummary[userKey].actions[actionKey]) {
        userSummary[userKey].actions[actionKey] = 0;
      }
      userSummary[userKey].actions[actionKey]++;
    });
    
    // Get summary by action
    const actionSummary = {};
    activities.forEach(activity => {
      const actionKey = activity.action;
      if (!actionSummary[actionKey]) {
        actionSummary[actionKey] = {
          action: actionKey,
          count: 0
        };
      }
      actionSummary[actionKey].count++;
    });
    
    // Get summary by table
    const tableSummary = {};
    activities.forEach(activity => {
      const tableKey = activity.table_name;
      if (!tableKey) return;
      
      if (!tableSummary[tableKey]) {
        tableSummary[tableKey] = {
          table_name: tableKey,
          count: 0
        };
      }
      tableSummary[tableKey].count++;
    });
    
    res.json({
      activities,
      userSummary: Object.values(userSummary),
      actionSummary: Object.values(actionSummary),
      tableSummary: Object.values(tableSummary),
      filters: {
        userId: userId || null,
        startDate: startDate || null,
        endDate: endDate || null
      }
    });
  });
});

module.exports = router; 