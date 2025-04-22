const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

// Create data directory if it doesn't exist
const dataDir = path.dirname(config.database.filename);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Connect to database
const db = new sqlite3.Database(config.database.filename, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }
  console.log('Connected to the SQLite database');
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Create tables
const createTables = () => {
  return new Promise((resolve, reject) => {
    console.log('Creating tables...');
    
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'staff')),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating users table:', err.message);
        reject(err);
        return;
      }
      
      // Categories table
      db.run(`
        CREATE TABLE IF NOT EXISTS categories (
          category_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          parent_category_id TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (parent_category_id) REFERENCES categories (category_id)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating categories table:', err.message);
          reject(err);
          return;
        }
        
        // Products table
        db.run(`
          CREATE TABLE IF NOT EXISTS products (
            product_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            sku TEXT UNIQUE NOT NULL,
            price REAL,
            cost REAL,
            image_path TEXT,
            category_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories (category_id)
          )
        `, (err) => {
          if (err) {
            console.error('Error creating products table:', err.message);
            reject(err);
            return;
          }
          
          // Locations table
          db.run(`
            CREATE TABLE IF NOT EXISTS locations (
              location_id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT,
              type TEXT NOT NULL,
              address TEXT,
              city TEXT,
              state TEXT,
              postal_code TEXT,
              country TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `, (err) => {
            if (err) {
              console.error('Error creating locations table:', err.message);
              reject(err);
              return;
            }
            
            // Inventory table
            db.run(`
              CREATE TABLE IF NOT EXISTS inventory (
                inventory_id TEXT PRIMARY KEY,
                product_id TEXT NOT NULL,
                location_id TEXT NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 0,
                min_quantity INTEGER NOT NULL DEFAULT 0,
                max_quantity INTEGER,
                last_counted_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products (product_id),
                FOREIGN KEY (location_id) REFERENCES locations (location_id),
                UNIQUE(product_id, location_id)
              )
            `, (err) => {
              if (err) {
                console.error('Error creating inventory table:', err.message);
                reject(err);
                return;
              }
              
              // Inventory transactions table
              db.run(`
                CREATE TABLE IF NOT EXISTS inventory_transactions (
                  transaction_id TEXT PRIMARY KEY,
                  product_id TEXT NOT NULL,
                  location_id TEXT NOT NULL,
                  transaction_type TEXT NOT NULL CHECK(transaction_type IN ('receive', 'issue', 'transfer', 'adjust', 'count')),
                  quantity INTEGER NOT NULL,
                  previous_quantity INTEGER,
                  new_quantity INTEGER,
                  reference_id TEXT,
                  notes TEXT,
                  created_by TEXT NOT NULL,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (product_id) REFERENCES products (product_id),
                  FOREIGN KEY (location_id) REFERENCES locations (location_id),
                  FOREIGN KEY (created_by) REFERENCES users (user_id)
                )
              `, (err) => {
                if (err) {
                  console.error('Error creating inventory_transactions table:', err.message);
                  reject(err);
                  return;
                }
                
                // Audit log table
                db.run(`
                  CREATE TABLE IF NOT EXISTS audit_log (
                    log_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    table_name TEXT,
                    record_id TEXT,
                    old_values TEXT,
                    new_values TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (user_id)
                  )
                `, (err) => {
                  if (err) {
                    console.error('Error creating audit_log table:', err.message);
                    reject(err);
                    return;
                  }
                  
                  console.log('Tables created successfully');
                  resolve();
                });
              });
            });
          });
        });
      });
    });
  });
};

// Create admin user
const createAdminUser = async () => {
  return new Promise((resolve, reject) => {
    console.log('Creating admin user...');
    
    // Check if admin user already exists
    db.get('SELECT user_id FROM users WHERE username = ?', ['admin'], async (err, user) => {
      if (err) {
        console.error('Error checking for admin user:', err.message);
        reject(err);
        return;
      }
      
      if (user) {
        console.log('Admin user already exists');
        resolve();
        return;
      }
      
      try {
        // Create admin user
        const userId = uuidv4();
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);
        
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
            'admin',
            'admin@arper.com',
            hashedPassword,
            'Admin',
            'User',
            'admin'
          ],
          (err) => {
            if (err) {
              console.error('Error creating admin user:', err.message);
              reject(err);
              return;
            }
            
            console.log('Admin user created successfully');
            console.log('Username: admin');
            console.log('Password: admin123');
            resolve();
          }
        );
      } catch (err) {
        console.error('Error creating admin user:', err.message);
        reject(err);
      }
    });
  });
};

// Create sample data
const createSampleData = () => {
  return new Promise((resolve, reject) => {
    console.log('Creating sample data...');
    
    // Check if sample data already exists
    db.get('SELECT COUNT(*) as count FROM products', [], (err, result) => {
      if (err) {
        // Table might not exist yet, continue with creation
        console.log('No existing products found, creating sample data...');
      } else if (result.count > 0) {
        console.log('Sample data already exists, skipping creation');
        return resolve();
      }
      
      // Sample categories
      const categories = [
        {
          category_id: uuidv4(),
          name: 'Electronics',
          description: 'Electronic devices and components'
        },
        {
          category_id: uuidv4(),
          name: 'Office Supplies',
          description: 'Supplies for office use'
        },
        {
          category_id: uuidv4(),
          name: 'Furniture',
          description: 'Office and home furniture'
        }
      ];
      
      const insertCategories = () => {
        return new Promise((resolve, reject) => {
          let completed = 0;
          
          categories.forEach(category => {
            db.run(
              `INSERT INTO categories (
                category_id, 
                name, 
                description
              ) VALUES (?, ?, ?)`,
              [
                category.category_id,
                category.name,
                category.description
              ],
              (err) => {
                if (err) {
                  console.error(`Error creating category ${category.name}:`, err.message);
                  reject(err);
                  return;
                }
                
                completed++;
                if (completed === categories.length) {
                  resolve();
                }
              }
            );
          });
        });
      };
      
      // Sample locations
      const locations = [
        {
          location_id: uuidv4(),
          name: 'Main Warehouse',
          description: 'Main storage facility',
          type: 'Warehouse',
          address: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          postal_code: '12345',
          country: 'USA'
        },
        {
          location_id: uuidv4(),
          name: 'Office Storage',
          description: 'Storage room in the main office',
          type: 'Storage Room',
          address: '456 Office Blvd',
          city: 'Anytown',
          state: 'CA',
          postal_code: '12345',
          country: 'USA'
        }
      ];
      
      const insertLocations = () => {
        return new Promise((resolve, reject) => {
          let completed = 0;
          
          locations.forEach(location => {
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
                location.location_id,
                location.name,
                location.description,
                location.type,
                location.address,
                location.city,
                location.state,
                location.postal_code,
                location.country
              ],
              (err) => {
                if (err) {
                  console.error(`Error creating location ${location.name}:`, err.message);
                  reject(err);
                  return;
                }
                
                completed++;
                if (completed === locations.length) {
                  resolve();
                }
              }
            );
          });
        });
      };
      
      const getCategories = () => {
        return new Promise((resolve, reject) => {
          db.all('SELECT category_id, name FROM categories', [], (err, rows) => {
            if (err) {
              console.error('Error getting categories:', err.message);
              reject(err);
              return;
            }
            resolve(rows);
          });
        });
      };
      
      const getLocations = () => {
        return new Promise((resolve, reject) => {
          db.all('SELECT location_id, name FROM locations', [], (err, rows) => {
            if (err) {
              console.error('Error getting locations:', err.message);
              reject(err);
              return;
            }
            resolve(rows);
          });
        });
      };
      
      const getAdminUser = () => {
        return new Promise((resolve, reject) => {
          db.get('SELECT user_id FROM users WHERE username = ?', ['admin'], (err, user) => {
            if (err) {
              console.error('Error getting admin user:', err.message);
              reject(err);
              return;
            }
            
            if (!user) {
              console.error('Admin user not found');
              reject(new Error('Admin user not found'));
              return;
            }
            
            resolve(user);
          });
        });
      };
      
      // Insert categories and locations
      Promise.all([insertCategories(), insertLocations()])
        .then(() => Promise.all([getCategories(), getLocations(), getAdminUser()]))
        .then(([categoryRows, locationRows, adminUser]) => {
          // Sample products
          const products = [
            {
              product_id: uuidv4(),
              name: 'Laptop',
              description: 'Business laptop computer',
              sku: 'ELEC-001',
              price: 1200.00,
              cost: 900.00,
              category_id: categoryRows.find(c => c.name === 'Electronics')?.category_id
            },
            {
              product_id: uuidv4(),
              name: 'Office Chair',
              description: 'Ergonomic office chair',
              sku: 'FURN-001',
              price: 250.00,
              cost: 150.00,
              category_id: categoryRows.find(c => c.name === 'Furniture')?.category_id
            },
            {
              product_id: uuidv4(),
              name: 'Printer Paper',
              description: 'A4 printer paper, 500 sheets',
              sku: 'OFSP-001',
              price: 5.99,
              cost: 3.50,
              category_id: categoryRows.find(c => c.name === 'Office Supplies')?.category_id
            }
          ];
          
          const insertProducts = () => {
            return new Promise((resolve, reject) => {
              let completed = 0;
              
              products.forEach(product => {
                db.run(
                  `INSERT INTO products (
                    product_id, 
                    name, 
                    description, 
                    sku, 
                    price,
                    cost,
                    category_id
                  ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [
                    product.product_id,
                    product.name,
                    product.description,
                    product.sku,
                    product.price,
                    product.cost,
                    product.category_id
                  ],
                  (err) => {
                    if (err) {
                      console.error(`Error creating product ${product.name}:`, err.message);
                      reject(err);
                      return;
                    }
                    
                    completed++;
                    if (completed === products.length) {
                      resolve();
                    }
                  }
                );
              });
            });
          };
          
          return insertProducts().then(() => {
            return new Promise((resolve, reject) => {
              db.all('SELECT product_id, name FROM products', [], (err, productRows) => {
                if (err) {
                  console.error('Error getting products:', err.message);
                  reject(err);
                  return;
                }
                
                // Sample inventory
                const inventoryItems = [];
                
                productRows.forEach(product => {
                  locationRows.forEach(location => {
                    inventoryItems.push({
                      inventory_id: uuidv4(),
                      product_id: product.product_id,
                      location_id: location.location_id,
                      quantity: Math.floor(Math.random() * 100) + 10,
                      min_quantity: 5,
                      max_quantity: 100
                    });
                  });
                });
                
                let completed = 0;
                
                inventoryItems.forEach(item => {
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
                      item.inventory_id,
                      item.product_id,
                      item.location_id,
                      item.quantity,
                      item.min_quantity,
                      item.max_quantity
                    ],
                    (err) => {
                      if (err) {
                        console.error(`Error creating inventory item:`, err.message);
                        reject(err);
                        return;
                      }
                      
                      // Create initial transaction
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
                          item.product_id,
                          item.location_id,
                          'receive',
                          item.quantity,
                          0,
                          item.quantity,
                          'Initial inventory setup',
                          adminUser.user_id
                        ],
                        (err) => {
                          if (err) {
                            console.error(`Error creating transaction:`, err.message);
                            reject(err);
                            return;
                          }
                          
                          completed++;
                          if (completed === inventoryItems.length) {
                            console.log('Sample data created successfully');
                            resolve();
                          }
                        }
                      );
                    }
                  );
                });
              });
            });
          });
        })
        .then(() => {
          resolve();
        })
        .catch(err => {
          console.error('Error creating sample data:', err);
          reject(err);
        });
    });
  });
};

// Run initialization
const initializeDatabase = async () => {
  try {
    // Create tables
    await createTables();
    
    // Create admin user
    await createAdminUser();
    
    // Create sample data
    await createSampleData();
    
    console.log('Database initialization completed successfully');
  } catch (err) {
    console.error('Database initialization failed:', err);
  } finally {
    // Close database connection
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed');
      }
    });
  }
};

// Run initialization
initializeDatabase(); 