const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'arper-inventory-secret-key';

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post(
  '/login',
  [
    body('username', 'Username is required').notEmpty(),
    body('password', 'Password is required').notEmpty()
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;
    const db = req.app.locals.db;

    // Find user by username
    db.get(
      'SELECT * FROM users WHERE username = ? AND is_active = 1',
      [username],
      async (err, user) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Server error' });
        }

        if (!user) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }

        // For the first login with the default admin account
        if (user.password_hash === 'change_this_password_hash' && password === 'admin') {
          // Generate token
          const payload = {
            user: {
              id: user.user_id,
              username: user.username,
              role: user.role
            }
          };

          jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: '8h' },
            (err, token) => {
              if (err) throw err;
              
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
                },
                message: 'Please change your default password'
              });
            }
          );
          return;
        }

        // Check password
        try {
          const isMatch = await bcrypt.compare(password, user.password_hash);

          if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
          }

          // Generate token
          const payload = {
            user: {
              id: user.user_id,
              username: user.username,
              role: user.role
            }
          };

          jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: '8h' },
            (err, token) => {
              if (err) throw err;
              
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
        } catch (err) {
          console.error('Password comparison error:', err);
          res.status(500).json({ message: 'Server error' });
        }
      }
    );
  }
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = req.app.locals.db;
    
    db.get(
      'SELECT user_id, username, email, first_name, last_name, role FROM users WHERE user_id = ?',
      [decoded.user.id],
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
          role: user.role
        });
      }
    );
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(403).json({ message: 'Invalid or expired token' });
  }
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post(
  '/change-password',
  [
    body('currentPassword', 'Current password is required').notEmpty(),
    body('newPassword', 'New password must be at least 6 characters').isLength({ min: 6 })
  ],
  (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const { currentPassword, newPassword } = req.body;
      const db = req.app.locals.db;
      
      db.get(
        'SELECT * FROM users WHERE user_id = ?',
        [decoded.user.id],
        async (err, user) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Server error' });
          }
          
          if (!user) {
            return res.status(404).json({ message: 'User not found' });
          }
          
          // Special case for default admin password
          if (user.password_hash === 'change_this_password_hash' && currentPassword === 'admin') {
            // Hash the new password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);
            
            // Update password
            db.run(
              'UPDATE users SET password_hash = ? WHERE user_id = ?',
              [hashedPassword, user.user_id],
              function(err) {
                if (err) {
                  console.error('Database error:', err);
                  return res.status(500).json({ message: 'Server error' });
                }
                
                if (this.changes === 0) {
                  return res.status(500).json({ message: 'Failed to update password' });
                }
                
                res.json({ message: 'Password updated successfully' });
              }
            );
            return;
          }
          
          // Check current password
          try {
            const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
            
            if (!isMatch) {
              return res.status(401).json({ message: 'Current password is incorrect' });
            }
            
            // Hash the new password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);
            
            // Update password
            db.run(
              'UPDATE users SET password_hash = ? WHERE user_id = ?',
              [hashedPassword, user.user_id],
              function(err) {
                if (err) {
                  console.error('Database error:', err);
                  return res.status(500).json({ message: 'Server error' });
                }
                
                if (this.changes === 0) {
                  return res.status(500).json({ message: 'Failed to update password' });
                }
                
                res.json({ message: 'Password updated successfully' });
              }
            );
          } catch (err) {
            console.error('Password comparison error:', err);
            res.status(500).json({ message: 'Server error' });
          }
        }
      );
    } catch (err) {
      console.error('Token verification error:', err);
      res.status(403).json({ message: 'Invalid or expired token' });
    }
  }
);

module.exports = router; 