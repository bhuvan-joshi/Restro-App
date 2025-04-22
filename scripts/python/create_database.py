import pandas as pd
import sqlite3
import os
import datetime
import uuid

def create_database():
    """Create an enterprise-grade inventory management database based on the Excel data."""
    db_file = "arper_inventory.db"
    
    # Connect to SQLite database (will create if it doesn't exist)
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    
    print(f"Creating database: {db_file}")
    
    # Create tables with proper relationships and constraints
    
    # 1. Users table for authentication and authorization
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        first_name TEXT,
        last_name TEXT,
        role TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_login TEXT,
        CONSTRAINT valid_role CHECK (role IN ('admin', 'manager', 'staff', 'readonly'))
    )
    ''')
    
    # 2. Categories for product organization
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS categories (
        category_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        parent_category_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_category_id) REFERENCES categories (category_id)
    )
    ''')
    
    # 3. Locations for inventory storage
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS locations (
        location_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        parent_location_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_location_id) REFERENCES locations (location_id)
    )
    ''')
    
    # 4. Products table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS products (
        product_id TEXT PRIMARY KEY,
        sku TEXT UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        category_id TEXT,
        image_path TEXT,
        unit_of_measure TEXT DEFAULT 'each',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (category_id)
    )
    ''')
    
    # 5. Inventory table to track stock levels
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS inventory (
        inventory_id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        location_id TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        min_quantity INTEGER DEFAULT 0,
        max_quantity INTEGER,
        last_counted_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (product_id),
        FOREIGN KEY (location_id) REFERENCES locations (location_id),
        UNIQUE (product_id, location_id)
    )
    ''')
    
    # 6. Inventory transactions for audit trail
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS inventory_transactions (
        transaction_id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        location_id TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        previous_quantity INTEGER NOT NULL,
        new_quantity INTEGER NOT NULL,
        reference_id TEXT,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (product_id),
        FOREIGN KEY (location_id) REFERENCES locations (location_id),
        FOREIGN KEY (created_by) REFERENCES users (user_id),
        CONSTRAINT valid_transaction_type CHECK (transaction_type IN ('receive', 'issue', 'transfer', 'adjust', 'count'))
    )
    ''')
    
    # 7. Suppliers table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS suppliers (
        supplier_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        contact_person TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        notes TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # 8. Purchase orders
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS purchase_orders (
        po_id TEXT PRIMARY KEY,
        supplier_id TEXT NOT NULL,
        order_date TEXT NOT NULL,
        expected_delivery_date TEXT,
        status TEXT DEFAULT 'draft',
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers (supplier_id),
        FOREIGN KEY (created_by) REFERENCES users (user_id),
        CONSTRAINT valid_status CHECK (status IN ('draft', 'submitted', 'partial', 'received', 'cancelled'))
    )
    ''')
    
    # 9. Purchase order items
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS purchase_order_items (
        po_item_id TEXT PRIMARY KEY,
        po_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity_ordered INTEGER NOT NULL,
        quantity_received INTEGER DEFAULT 0,
        unit_price REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (po_id) REFERENCES purchase_orders (po_id),
        FOREIGN KEY (product_id) REFERENCES products (product_id)
    )
    ''')
    
    # 10. Audit log for system-wide tracking
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS audit_log (
        log_id TEXT PRIMARY KEY,
        user_id TEXT,
        action TEXT NOT NULL,
        table_name TEXT,
        record_id TEXT,
        old_values TEXT,
        new_values TEXT,
        ip_address TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (user_id)
    )
    ''')
    
    # 11. Settings table for application configuration
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT,
        setting_type TEXT DEFAULT 'string',
        description TEXT,
        updated_by TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (updated_by) REFERENCES users (user_id)
    )
    ''')
    
    # Create indexes for performance
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory (product_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory (location_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_product ON inventory_transactions (product_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON inventory_transactions (created_at)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders (supplier_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders (status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items (po_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log (user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log (action)')
    
    # Create views for common queries
    cursor.execute('''
    CREATE VIEW IF NOT EXISTS vw_inventory_levels AS
    SELECT 
        p.product_id, 
        p.name AS product_name, 
        p.sku, 
        c.name AS category,
        l.name AS location,
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
    LEFT JOIN 
        categories c ON p.category_id = c.category_id
    JOIN 
        locations l ON i.location_id = l.location_id
    ''')
    
    # Insert default admin user
    admin_id = str(uuid.uuid4())
    cursor.execute('''
    INSERT OR IGNORE INTO users (user_id, username, password_hash, email, first_name, last_name, role)
    VALUES (?, 'admin', 'change_this_password_hash', 'admin@arper.com', 'Admin', 'User', 'admin')
    ''', (admin_id,))
    
    # Insert default settings
    cursor.execute('''
    INSERT OR IGNORE INTO settings (setting_key, setting_value, setting_type, description)
    VALUES 
        ('company_name', 'Arper', 'string', 'Company name for reports and UI'),
        ('low_stock_notification', 'true', 'boolean', 'Enable low stock notifications'),
        ('default_currency', 'USD', 'string', 'Default currency for pricing'),
        ('inventory_count_frequency', '90', 'integer', 'Days between inventory counts')
    ''')
    
    # Commit changes
    conn.commit()
    print("Database schema created successfully.")
    
    # Import data from Excel if available
    try:
        import_excel_data(conn, admin_id)
    except Exception as e:
        print(f"Error importing Excel data: {e}")
    
    # Close connection
    conn.close()
    print(f"Database created at: {os.path.abspath(db_file)}")

def import_excel_data(conn, admin_id):
    """Import data from the Excel file into the database."""
    excel_file = "PL- ARPER.xlsx"
    if not os.path.exists(excel_file):
        print(f"Excel file not found: {excel_file}")
        return
    
    print(f"Importing data from Excel file: {excel_file}")
    
    # Read Excel with pandas - using header=None to manually handle headers
    df = pd.read_excel(excel_file, sheet_name="PL", header=None)
    
    # Find the header row (usually row 1 based on our analysis)
    header_row = 1  # This is 0-indexed in pandas
    
    # Extract column names from the header row
    column_names = df.iloc[header_row].tolist()
    
    # Create a new DataFrame with proper headers, skipping the header row
    data_df = df.iloc[header_row+1:].reset_index(drop=True)
    data_df.columns = range(len(data_df.columns))  # Reset to numeric columns
    
    # Map the column indices to meaningful names based on our analysis
    column_mapping = {
        0: 'SR_NO',
        1: 'DESCRIPTION',
        2: 'QTY',
        3: 'IMAGE_NO',
        4: 'IMAGE',
        5: 'RACK_NO',
        6: 'REMARKS'
    }
    
    # Map Excel columns to database fields
    cursor = conn.cursor()
    
    # Create default category for imported products
    category_id = str(uuid.uuid4())
    cursor.execute('''
    INSERT INTO categories (category_id, name, description)
    VALUES (?, 'Imported Products', 'Products imported from Excel')
    ''', (category_id,))
    
    # Create default location based on RACK NO column
    location_mappings = {}
    
    # Extract unique rack numbers from column 5 (RACK_NO)
    rack_column = 5
    unique_racks = set()
    
    for rack in data_df[rack_column].dropna().unique():
        rack_name = str(rack).strip()
        if rack_name:
            unique_racks.add(rack_name)
    
    print(f"Found {len(unique_racks)} unique rack locations")
    
    for rack_name in unique_racks:
        location_id = str(uuid.uuid4())
        cursor.execute('''
        INSERT INTO locations (location_id, name, description)
        VALUES (?, ?, ?)
        ''', (location_id, rack_name, f"Location imported from Excel: {rack_name}"))
        location_mappings[rack_name] = location_id
    
    # Default location for items without a rack
    default_location_id = str(uuid.uuid4())
    cursor.execute('''
    INSERT INTO locations (location_id, name, description)
    VALUES (?, 'Default Location', 'Default location for items without a specified rack')
    ''', (default_location_id,))
    
    # Import products and inventory
    imported_count = 0
    
    for idx, row in data_df.iterrows():
        try:
            # Skip rows without a description
            if pd.isna(row[1]):  # DESCRIPTION is in column 1
                continue
                
            # Create product
            product_id = str(uuid.uuid4())
            product_name = str(row[1]).strip()  # DESCRIPTION
            image_path = str(row[3]) if not pd.isna(row[3]) else ""  # IMAGE_NO
            
            cursor.execute('''
            INSERT INTO products (product_id, name, description, category_id, image_path)
            VALUES (?, ?, ?, ?, ?)
            ''', (product_id, product_name, product_name, category_id, image_path))
            
            # Get location
            rack = str(row[5]).strip() if not pd.isna(row[5]) else ""  # RACK_NO
            location_id = location_mappings.get(rack, default_location_id)
            
            # Create inventory record
            inventory_id = str(uuid.uuid4())
            quantity = int(row[2]) if not pd.isna(row[2]) else 0  # QTY
            
            cursor.execute('''
            INSERT INTO inventory (inventory_id, product_id, location_id, quantity)
            VALUES (?, ?, ?, ?)
            ''', (inventory_id, product_id, location_id, quantity))
            
            # Record initial inventory transaction
            transaction_id = str(uuid.uuid4())
            cursor.execute('''
            INSERT INTO inventory_transactions 
            (transaction_id, product_id, location_id, transaction_type, quantity, previous_quantity, new_quantity, notes, created_by)
            VALUES (?, ?, ?, 'receive', ?, 0, ?, 'Initial import from Excel', ?)
            ''', (transaction_id, product_id, location_id, quantity, quantity, admin_id))
            
            imported_count += 1
            
        except Exception as e:
            print(f"Error importing row {idx+1}: {e}")
    
    conn.commit()
    print(f"Successfully imported {imported_count} products from Excel")

if __name__ == "__main__":
    create_database() 