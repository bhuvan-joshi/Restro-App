const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

/**
 * @route   GET /api/categories
 * @desc    Get all categories
 * @access  Private
 */
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  
  db.all(
    `SELECT 
      category_id, 
      name, 
      description, 
      parent_category_id, 
      created_at, 
      updated_at
    FROM categories 
    ORDER BY name`,
    (err, categories) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      res.json({ 
        categories,
        totalCategories: categories.length
      });
    }
  );
});

/**
 * @route   GET /api/categories/:id
 * @desc    Get category by ID
 * @access  Private
 */
router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  
  db.get(
    `SELECT 
      c.category_id, 
      c.name, 
      c.description, 
      c.parent_category_id,
      p.name AS parent_category_name,
      c.created_at,
      c.updated_at
    FROM 
      categories c
    LEFT JOIN 
      categories p ON c.parent_category_id = p.category_id
    WHERE 
      c.category_id = ?`,
    [req.params.id],
    (err, category) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }
      
      // Get child categories
      db.all(
        `SELECT 
          category_id, 
          name, 
          description
        FROM 
          categories
        WHERE 
          parent_category_id = ?
        ORDER BY 
          name`,
        [req.params.id],
        (err, childCategories) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Server error' });
          }
          
          // Get products in this category
          db.all(
            `SELECT 
              p.product_id,
              p.name,
              p.sku,
              p.image_path,
              (SELECT SUM(quantity) FROM inventory WHERE product_id = p.product_id) AS total_quantity
            FROM 
              products p
            WHERE 
              p.category_id = ?
            ORDER BY 
              p.name
            LIMIT 10`,
            [req.params.id],
            (err, products) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Server error' });
              }
              
              // Get product count
              db.get(
                `SELECT 
                  COUNT(*) AS product_count
                FROM 
                  products
                WHERE 
                  category_id = ?`,
                [req.params.id],
                (err, summary) => {
                  if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ message: 'Server error' });
                  }
                  
                  res.json({
                    ...category,
                    childCategories,
                    products,
                    summary: {
                      productCount: summary ? summary.product_count : 0
                    }
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
 * @route   POST /api/categories
 * @desc    Create a new category
 * @access  Private (Admin, Manager)
 */
router.post(
  '/',
  [
    body('name', 'Name is required').notEmpty(),
    body('description').optional(),
    body('parentCategoryId').optional()
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
      parentCategoryId
    } = req.body;
    
    const db = req.app.locals.db;
    
    // Check if parent category exists (if provided)
    if (parentCategoryId) {
      db.get('SELECT category_id FROM categories WHERE category_id = ?', [parentCategoryId], (err, parentCategory) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        
        if (!parentCategory) {
          return res.status(404).json({ message: 'Parent category not found' });
        }
        
        createCategory();
      });
    } else {
      createCategory();
    }
    
    function createCategory() {
      const categoryId = uuidv4();
      
      db.run(
        `INSERT INTO categories (
          category_id, 
          name, 
          description, 
          parent_category_id
        ) VALUES (?, ?, ?, ?)`,
        [
          categoryId,
          name,
          description || null,
          parentCategoryId || null
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
              'categories',
              categoryId,
              JSON.stringify(req.body)
            ]
          );
          
          res.status(201).json({
            category_id: categoryId,
            name,
            description,
            parent_category_id: parentCategoryId,
            message: 'Category created successfully'
          });
        }
      );
    }
  }
);

/**
 * @route   PUT /api/categories/:id
 * @desc    Update a category
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id',
  [
    body('name', 'Name is required').notEmpty(),
    body('description').optional(),
    body('parentCategoryId').optional()
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
      parentCategoryId
    } = req.body;
    
    const db = req.app.locals.db;
    
    // Check if category exists
    db.get('SELECT * FROM categories WHERE category_id = ?', [req.params.id], (err, currentCategory) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      if (!currentCategory) {
        return res.status(404).json({ message: 'Category not found' });
      }
      
      // Check for circular reference
      if (parentCategoryId === req.params.id) {
        return res.status(400).json({ message: 'Category cannot be its own parent' });
      }
      
      // Check if parent category exists (if provided)
      if (parentCategoryId) {
        db.get('SELECT category_id FROM categories WHERE category_id = ?', [parentCategoryId], (err, parentCategory) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Server error' });
          }
          
          if (!parentCategory) {
            return res.status(404).json({ message: 'Parent category not found' });
          }
          
          // Check for circular reference in hierarchy
          checkCircularReference(parentCategoryId, req.params.id, (hasCircular) => {
            if (hasCircular) {
              return res.status(400).json({ message: 'Circular reference detected in category hierarchy' });
            }
            
            updateCategory(currentCategory);
          });
        });
      } else {
        updateCategory(currentCategory);
      }
    });
    
    function checkCircularReference(categoryId, targetId, callback) {
      db.get('SELECT parent_category_id FROM categories WHERE category_id = ?', [categoryId], (err, category) => {
        if (err || !category || !category.parent_category_id) {
          return callback(false);
        }
        
        if (category.parent_category_id === targetId) {
          return callback(true);
        }
        
        checkCircularReference(category.parent_category_id, targetId, callback);
      });
    }
    
    function updateCategory(currentCategory) {
      db.run(
        `UPDATE categories SET 
          name = ?, 
          description = ?, 
          parent_category_id = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE category_id = ?`,
        [
          name,
          description || null,
          parentCategoryId || null,
          req.params.id
        ],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Server error' });
          }
          
          if (this.changes === 0) {
            return res.status(404).json({ message: 'Category not found' });
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
              'categories',
              req.params.id,
              JSON.stringify(currentCategory),
              JSON.stringify(req.body)
            ]
          );
          
          res.json({
            category_id: req.params.id,
            name,
            description,
            parent_category_id: parentCategoryId,
            message: 'Category updated successfully'
          });
        }
      );
    }
  }
);

/**
 * @route   DELETE /api/categories/:id
 * @desc    Delete a category
 * @access  Private (Admin only)
 */
router.delete('/:id', (req, res) => {
  // Check user role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  
  const db = req.app.locals.db;
  
  // Check if category has products
  db.get('SELECT COUNT(*) as count FROM products WHERE category_id = ?', [req.params.id], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    
    if (result.count > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete category with existing products. Please reassign products first.' 
      });
    }
    
    // Check if category has child categories
    db.get('SELECT COUNT(*) as count FROM categories WHERE parent_category_id = ?', [req.params.id], (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      if (result.count > 0) {
        return res.status(400).json({ 
          message: 'Cannot delete category with child categories. Please remove child categories first.' 
        });
      }
      
      // Get the current category data for audit log
      db.get('SELECT * FROM categories WHERE category_id = ?', [req.params.id], (err, currentCategory) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        
        if (!currentCategory) {
          return res.status(404).json({ message: 'Category not found' });
        }
        
        // Delete the category
        db.run('DELETE FROM categories WHERE category_id = ?', [req.params.id], function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Server error' });
          }
          
          if (this.changes === 0) {
            return res.status(404).json({ message: 'Category not found' });
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
              'categories',
              req.params.id,
              JSON.stringify(currentCategory)
            ]
          );
          
          res.json({ message: 'Category deleted successfully' });
        });
      });
    });
  });
});

module.exports = router; 