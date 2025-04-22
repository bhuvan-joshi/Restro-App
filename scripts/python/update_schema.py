import sqlite3
import os

# Configuration
DB_FILE = "./data/inventory.db"  # Same as in import_excel_data.py

def update_schema():
    """Update the database schema to add type column to locations table"""
    print(f"Updating database schema for {DB_FILE}")
    
    # Check if database exists
    if not os.path.exists(DB_FILE):
        print(f"Error: Database file '{DB_FILE}' not found!")
        return
    
    # Connect to database
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    try:
        # Check if type column already exists
        cursor.execute("PRAGMA table_info(locations)")
        columns = cursor.fetchall()
        column_names = [column[1] for column in columns]
        
        if 'type' not in column_names:
            print("Adding 'type' column to locations table...")
            cursor.execute("ALTER TABLE locations ADD COLUMN type TEXT")
            print("Column added successfully")
            
            # Update existing locations to set type
            print("Updating existing locations...")
            
            # First, set default type for all locations
            cursor.execute("UPDATE locations SET type = 'General' WHERE type IS NULL")
            
            # Identify and update rack locations based on naming patterns
            cursor.execute("""
                UPDATE locations 
                SET type = 'Rack' 
                WHERE name LIKE 'R%' OR name LIKE 'Rack%' OR name LIKE '%Shelf%'
            """)
            
            # Commit changes
            conn.commit()
            print("Schema update completed successfully")
        else:
            print("Type column already exists in locations table")
        
    except Exception as e:
        print(f"Error updating schema: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    update_schema()
