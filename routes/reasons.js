const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');

/**
 * @route   GET /api/reasons
 * @desc    Get all reasons by type
 * @access  Private
 */
router.get('/', auth, (req, res) => {
  const { type } = req.query;
  const db = req.app.locals.db;
  
  let query = 'SELECT * FROM reasons';
  const params = [];
  
  if (type) {
    query += ' WHERE type = ?';
    params.push(type);
  }
  
  query += ' ORDER BY reason';
  
  db.all(query, params, (err, reasons) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    
    res.json({ reasons });
  });
});

/**
 * @route   POST /api/reasons
 * @desc    Add a new reason
 * @access  Private
 */
router.post('/', [
  auth,
  body('reason', 'Reason is required').notEmpty(),
  body('type', 'Type is required').isIn(['receive', 'issue', 'adjust'])
], (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { reason, type } = req.body;
  const db = req.app.locals.db;
  
  // Check if reason already exists for this type
  db.get(
    'SELECT * FROM reasons WHERE reason = ? AND type = ?',
    [reason, type],
    (err, existingReason) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      if (existingReason) {
        return res.status(400).json({ message: 'Reason already exists for this type' });
      }
      
      // Insert new reason
      db.run(
        'INSERT INTO reasons (reason, type) VALUES (?, ?)',
        [reason, type],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Server error' });
          }
          
          res.status(201).json({
            reason_id: this.lastID,
            reason,
            type
          });
        }
      );
    }
  );
});

/**
 * @route   DELETE /api/reasons/:id
 * @desc    Delete a reason
 * @access  Private
 */
router.delete('/:id', auth, (req, res) => {
  const { id } = req.params;
  const db = req.app.locals.db;
  
  db.run(
    'DELETE FROM reasons WHERE reason_id = ?',
    [id],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Reason not found' });
      }
      
      res.json({ message: 'Reason deleted successfully' });
    }
  );
});

module.exports = router;
