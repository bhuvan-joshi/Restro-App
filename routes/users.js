const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const auth = require('../middleware/auth');

/**
 * @route   POST /api/users/register
 * @desc    Register a new user
 * @access  Private (Admin only)
 */
router.post(
  '/register',
  [
    auth,
    body('username', 'Username is required').notEmpty(),
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    body('firstName', 'First name is required').notEmpty(),
    body('lastName', 'Last name is required').notEmpty(),
    body('role', 'Role is required').isIn(['admin', 'manager', 'staff'])
  ],
  async (req, res) => {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to register users' });
    }
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      username,
      email,
      password,
      firstName,
      lastName,
      role
    } = req.body;
    
    const db = req.app.locals.db;
    
    try {
      // Check if user already exists
      db.get('SELECT user_id FROM users WHERE email = ? OR username = ?', [email, username], async (err, user) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        
        if (user) {
          return res.status(400).json({ message: 'User already exists' });
        }
        
        // Create new user
        const userId = uuidv4();
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        db.run(
          `INSERT INTO users (
            user_id, 
            username, 
            email, 
            password, 
            first_name, 
            last_name, 
            role
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            username,
            email,
            hashedPassword,
            firstName,
            lastName,
            role
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
                'users',
                userId,
                JSON.stringify({
                  username,
                  email,
                  firstName,
                  lastName,
                  role
                })
              ]
            );
            
            res.status(201).json({
              user_id: userId,
              username,
              email,
              first_name: firstName,
              last_name: lastName,
              role,
              message: 'User registered successfully'
            });
          }
        );
      });
    } catch (err) {
      console.error('Server error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * @route   POST /api/users/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post(
  '/login',
  [
    body('username', 'Username is required').notEmpty(),
    body('password', 'Password is required').exists()
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { username, password } = req.body;
    
    const db = req.app.locals.db;
    
    try {
      // Check if user exists
      db.get(
        `SELECT 
          user_id, 
          username, 
          email, 
          password, 
          first_name, 
          last_name, 
          role, 
          is_active
        FROM users 
        WHERE username = ?`,
        [username],
        async (err, user) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Server error' });
          }
          
          if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
          }
          
          // Check if user is active
          if (!user.is_active) {
            return res.status(403).json({ message: 'Account is disabled' });
          }
          
          // Check password
          const isMatch = await bcrypt.compare(password, user.password);
          
          if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
          }
          
          // Create JWT payload
          const payload = {
            user: {
              id: user.user_id,
              username: user.username,
              role: user.role
            }
          };
          
          // Sign token
          jwt.sign(
            payload,
            config.jwtSecret,
            { expiresIn: '8h' },
            (err, token) => {
              if (err) throw err;
              
              // Log login
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
                  user.user_id,
                  'LOGIN',
                  'users',
                  user.user_id,
                  JSON.stringify({ timestamp: new Date() })
                ]
              );
              
              // Update last login time
              db.run(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?',
                [user.user_id]
              );
              
              res.json({
                token,
                user: {
                  id: user.user_id,
                  username: user.username,
                  email: user.email,
                  firstName: user.first_name,
                  lastName: user.last_name,
                  role: user.role
                }
              });
            }
          );
        }
      );
    } catch (err) {
      console.error('Server error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * @route   GET /api/users/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', auth, (req, res) => {
  const db = req.app.locals.db;
  
  db.get(
    `SELECT 
      user_id, 
      username, 
      email, 
      first_name, 
      last_name, 
      role, 
      is_active, 
      created_at, 
      last_login
    FROM users 
    WHERE user_id = ?`,
    [req.user.id],
    (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({
        id: user.user_id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at,
        lastLogin: user.last_login
      });
    }
  );
});

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Private (Admin only)
 */
router.get('/', auth, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  
  const db = req.app.locals.db;
  
  db.all(
    `SELECT 
      user_id, 
      username, 
      email, 
      first_name, 
      last_name, 
      role, 
      is_active, 
      created_at, 
      last_login
    FROM users 
    ORDER BY username`,
    (err, users) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      res.json({ users });
    }
  );
});

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (Admin only)
 */
router.get('/:id', auth, (req, res) => {
  // Check if user is admin or the user themselves
  if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
    return res.status(403).json({ message: 'Not authorized' });
  }
  
  const db = req.app.locals.db;
  
  db.get(
    `SELECT 
      user_id, 
      username, 
      email, 
      first_name, 
      last_name, 
      role, 
      is_active, 
      created_at, 
      last_login
    FROM users 
    WHERE user_id = ?`,
    [req.params.id],
    (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Get recent activity
      db.all(
        `SELECT 
          log_id, 
          action, 
          table_name, 
          record_id, 
          created_at
        FROM audit_log 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 10`,
        [req.params.id],
        (err, activity) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Server error' });
          }
          
          res.json({
            id: user.user_id,
            username: user.username,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            isActive: user.is_active,
            createdAt: user.created_at,
            lastLogin: user.last_login,
            recentActivity: activity
          });
        }
      );
    }
  );
});

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private (Admin or self)
 */
router.put(
  '/:id',
  [
    auth,
    body('email', 'Please include a valid email').optional().isEmail(),
    body('firstName', 'First name is required').optional().notEmpty(),
    body('lastName', 'Last name is required').optional().notEmpty(),
    body('role', 'Role is required').optional().isIn(['admin', 'manager', 'staff']),
    body('isActive', 'isActive must be a boolean').optional().isBoolean()
  ],
  (req, res) => {
    // Check if user is admin or the user themselves
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Regular users can't change their role or active status
    if (req.user.role !== 'admin' && (req.body.role || req.body.hasOwnProperty('isActive'))) {
      return res.status(403).json({ message: 'Not authorized to change role or active status' });
    }
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      email,
      firstName,
      lastName,
      role,
      isActive
    } = req.body;
    
    const db = req.app.locals.db;
    
    // Get current user data for audit log
    db.get('SELECT * FROM users WHERE user_id = ?', [req.params.id], (err, currentUser) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      if (!currentUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check if email is already in use by another user
      if (email && email !== currentUser.email) {
        db.get('SELECT user_id FROM users WHERE email = ? AND user_id != ?', [email, req.params.id], (err, existingUser) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Server error' });
          }
          
          if (existingUser) {
            return res.status(400).json({ message: 'Email already in use' });
          }
          
          updateUser();
        });
      } else {
        updateUser();
      }
      
      function updateUser() {
        // Build update query dynamically
        let updateFields = [];
        let updateValues = [];
        
        if (email) {
          updateFields.push('email = ?');
          updateValues.push(email);
        }
        
        if (firstName) {
          updateFields.push('first_name = ?');
          updateValues.push(firstName);
        }
        
        if (lastName) {
          updateFields.push('last_name = ?');
          updateValues.push(lastName);
        }
        
        if (role && req.user.role === 'admin') {
          updateFields.push('role = ?');
          updateValues.push(role);
        }
        
        if (isActive !== undefined && req.user.role === 'admin') {
          updateFields.push('is_active = ?');
          updateValues.push(isActive);
        }
        
        if (updateFields.length === 0) {
          return res.status(400).json({ message: 'No fields to update' });
        }
        
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        
        // Add user ID to values array
        updateValues.push(req.params.id);
        
        db.run(
          `UPDATE users SET ${updateFields.join(', ')} WHERE user_id = ?`,
          updateValues,
          function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ message: 'Server error' });
            }
            
            if (this.changes === 0) {
              return res.status(404).json({ message: 'User not found' });
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
                'users',
                req.params.id,
                JSON.stringify({
                  email: currentUser.email,
                  first_name: currentUser.first_name,
                  last_name: currentUser.last_name,
                  role: currentUser.role,
                  is_active: currentUser.is_active
                }),
                JSON.stringify({
                  email: email || currentUser.email,
                  first_name: firstName || currentUser.first_name,
                  last_name: lastName || currentUser.last_name,
                  role: role || currentUser.role,
                  is_active: isActive !== undefined ? isActive : currentUser.is_active
                })
              ]
            );
            
            res.json({
              id: req.params.id,
              username: currentUser.username,
              email: email || currentUser.email,
              firstName: firstName || currentUser.first_name,
              lastName: lastName || currentUser.last_name,
              role: role || currentUser.role,
              isActive: isActive !== undefined ? isActive : currentUser.is_active,
              message: 'User updated successfully'
            });
          }
        );
      }
    });
  }
);

/**
 * @route   PUT /api/users/:id/password
 * @desc    Change user password
 * @access  Private (Admin or self)
 */
router.put(
  '/:id/password',
  [
    auth,
    body('currentPassword', 'Current password is required').if((value, { req }) => req.user.id === req.params.id).notEmpty(),
    body('newPassword', 'New password must be at least 6 characters').isLength({ min: 6 })
  ],
  async (req, res) => {
    // Check if user is admin or the user themselves
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    const db = req.app.locals.db;
    
    try {
      // Get user
      db.get('SELECT * FROM users WHERE user_id = ?', [req.params.id], async (err, user) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        // If user is changing their own password, verify current password
        if (req.user.id === req.params.id) {
          const isMatch = await bcrypt.compare(currentPassword, user.password);
          
          if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
          }
        }
        
        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // Update password
        db.run(
          'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
          [hashedPassword, req.params.id],
          function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ message: 'Server error' });
            }
            
            if (this.changes === 0) {
              return res.status(404).json({ message: 'User not found' });
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
                'PASSWORD_CHANGE',
                'users',
                req.params.id,
                JSON.stringify({ timestamp: new Date() })
              ]
            );
            
            res.json({ message: 'Password updated successfully' });
          }
        );
      });
    } catch (err) {
      console.error('Server error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router; 