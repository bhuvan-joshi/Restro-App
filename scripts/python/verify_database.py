import sqlite3
import os
import pandas as pd
import tabulate

def verify_database():
    """Verify the database structure and imported data."""
    db_file = "arper_inventory.db"
    
    if not os.path.exists(db_file):
        print(f"Database file not found: {db_file}")
        return
    
    # Connect to SQLite database
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    
    print(f"Connected to database: {db_file}")
    
    # Get list of tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = cursor.fetchall()
    print(f"\nDatabase contains {len(tables)} tables:")
    for i, table in enumerate(tables):
        print(f"{i+1}. {table[0]}")
    
    # Get list of views
    cursor.execute("SELECT name FROM sqlite_master WHERE type='view' ORDER BY name")
    views = cursor.fetchall()
    print(f"\nDatabase contains {len(views)} views:")
    for i, view in enumerate(views):
        print(f"{i+1}. {view[0]}")
    
    # Check table counts
    print("\nTable row counts:")
    for table in tables:
        table_name = table[0]
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        count = cursor.fetchone()[0]
        print(f"{table_name}: {count} rows")
    
    # Sample data from products table
    print("\nSample products (first 5):")
    cursor.execute("SELECT product_id, name, image_path FROM products LIMIT 5")
    products = cursor.fetchall()
    print(tabulate.tabulate(products, headers=["Product ID", "Name", "Image Path"], tablefmt="grid"))
    
    # Sample data from locations table
    print("\nAll locations:")
    cursor.execute("SELECT location_id, name, description FROM locations")
    locations = cursor.fetchall()
    print(tabulate.tabulate(locations, headers=["Location ID", "Name", "Description"], tablefmt="grid"))
    
    # Sample data from inventory table
    print("\nSample inventory (first 5):")
    cursor.execute("""
    SELECT 
        i.inventory_id, 
        p.name AS product_name, 
        l.name AS location_name, 
        i.quantity 
    FROM 
        inventory i
    JOIN 
        products p ON i.product_id = p.product_id
    JOIN 
        locations l ON i.location_id = l.location_id
    LIMIT 5
    """)
    inventory = cursor.fetchall()
    print(tabulate.tabulate(inventory, headers=["Inventory ID", "Product", "Location", "Quantity"], tablefmt="grid"))
    
    # Check inventory by location
    print("\nInventory summary by location:")
    cursor.execute("""
    SELECT 
        l.name AS location_name, 
        COUNT(i.inventory_id) AS item_count,
        SUM(i.quantity) AS total_quantity
    FROM 
        inventory i
    JOIN 
        locations l ON i.location_id = l.location_id
    GROUP BY 
        l.name
    """)
    inventory_by_location = cursor.fetchall()
    print(tabulate.tabulate(inventory_by_location, headers=["Location", "Item Count", "Total Quantity"], tablefmt="grid"))
    
    # Close connection
    conn.close()

if __name__ == "__main__":
    verify_database() 