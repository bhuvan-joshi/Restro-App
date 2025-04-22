/**
 * Application configuration
 */
const path = require('path');

module.exports = {
  // JWT settings
  jwtSecret: process.env.JWT_SECRET || 'arper_inventory_secret_key',
  jwtExpiresIn: '24h', // Token expiration time
  
  // Database configuration
  database: {
    filename: process.env.DB_FILENAME || path.join(__dirname, 'data', 'inventory.db')
  },
  
  // Server configuration
  server: {
    port: process.env.PORT || 8001
  }
}; 