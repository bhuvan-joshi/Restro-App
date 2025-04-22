import sqlite3
import os
import pandas as pd
import uuid

# Configuration - same as import_excel_data.py
EXCEL_FILE = "PL- ARPER.xlsx"
DB_FILE = "./data/inventory.db"

def update_rack_locations():
    """Update rack locations for all products based on Excel data"""
    print(f"Updating rack locations from Excel file: {EXCEL_FILE}")
    
    # Check if files exist
    if not os.path.exists(EXCEL_FILE):
        print(f"Error: Excel file '{EXCEL_FILE}' not found!")
        return
    
    if not os.path.exists(DB_FILE):
        print(f"Error: Database file '{DB_FILE}' not found!")
        return
    
    # Connect to database
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    try:
        # Read Excel file
        df = pd.read_excel(EXCEL_FILE)
        print(f"Read {len(df)} rows from Excel file")
        
        # Print column names for debugging
        print(f"Columns in Excel: {df.columns.tolist()}")
        
        # Identify the correct columns for product data
        name_col = next((col for col in df.columns if 'DESCRIPTION' in str(col)), None)
        rack_col = next((col for col in df.columns if 'RACK' in str(col)), None)
        
        # Fallback based on observation from import_excel_data.py
        if not name_col:
            name_col = 'Unnamed: 1'  # Fallback based on observation
        if not rack_col:
            rack_col = 'Unnamed: 5'  # Fallback based on observation
            
        print(f"\nUsing columns:")
        print(f"  Product Name: {name_col}")
        print(f"  Rack Location: {rack_col}")
        
        # Process each row
        products_updated = 0
        racks_created = 0
        
        for _, row in df.iterrows():
            # Skip rows with no product name
            if pd.isna(row[name_col]):
                continue
                
            # Get product data
            product_name = str(row[name_col]).strip()
            rack_location = str(row[rack_col]).strip() if not pd.isna(row[rack_col]) else ''
            
            if not product_name:
                continue
            
            # Check if product exists
            cursor.execute("SELECT product_id FROM products WHERE name = ?", (product_name,))
            product = cursor.fetchone()
            
            if not product:
                print(f"Product not found: {product_name}")
                continue
            
            product_id = product[0]
            
            if not rack_location:
                print(f"No rack location for product: {product_name}")
                continue
                
            print(f"Processing product: {product_name}, Rack: {rack_location}")
            
            # Handle rack location - create or get rack location ID
            cursor.execute("SELECT location_id FROM locations WHERE name = ? AND type = 'Rack'", (rack_location,))
            rack = cursor.fetchone()
            
            if rack:
                location_id = rack[0]
            else:
                # Create new rack location
                location_id = str(uuid.uuid4())
                cursor.execute(
                    """INSERT INTO locations 
                       (location_id, name, description, type) 
                       VALUES (?, ?, ?, ?)""",
                    (location_id, rack_location, f'Rack location {rack_location}', 'Rack')
                )
                racks_created += 1
                print(f"Created rack location: {rack_location}")
            
            # Check if inventory entry exists for this product and location
            cursor.execute(
                "SELECT inventory_id FROM inventory WHERE product_id = ? AND location_id = ?",
                (product_id, location_id)
            )
            existing_inventory = cursor.fetchone()
            
            if existing_inventory:
                # Update inventory entry
                cursor.execute(
                    """UPDATE inventory SET 
                       updated_at = CURRENT_TIMESTAMP
                       WHERE product_id = ? AND location_id = ?""",
                    (product_id, location_id)
                )
            else:
                # Create new inventory entry
                inventory_id = str(uuid.uuid4())
                cursor.execute(
                    """INSERT INTO inventory 
                       (inventory_id, product_id, location_id, quantity) 
                       VALUES (?, ?, ?, ?)""",
                    (inventory_id, product_id, location_id, 1)
                )
            
            products_updated += 1
            print(f"Updated product: {product_name} with rack location: {rack_location}")
        
        conn.commit()
        print(f"\nUpdate completed: {products_updated} products updated, {racks_created} rack locations created")
        
    except Exception as e:
        print(f"Error updating rack locations: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    update_rack_locations()
