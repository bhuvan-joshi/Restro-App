import os
import sqlite3
import shutil
import datetime

# Configuration
DB_FILE = "./data/inventory.db"
BACKUP_FOLDER = "./data/backups"

def reset_database():
    """Backup the current database and reset it to a clean state"""
    print(f"Backing up and resetting database: {DB_FILE}")
    
    # Check if database exists
    if not os.path.exists(DB_FILE):
        print(f"Error: Database file '{DB_FILE}' not found!")
        return
    
    # Create backup folder if it doesn't exist
    if not os.path.exists(BACKUP_FOLDER):
        os.makedirs(BACKUP_FOLDER, exist_ok=True)
        print(f"Created backup folder: {BACKUP_FOLDER}")
    
    # Create backup with timestamp
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(BACKUP_FOLDER, f"inventory_backup_{timestamp}.db")
    
    try:
        # Copy the database file to backup
        shutil.copy2(DB_FILE, backup_file)
        print(f"Created backup: {backup_file}")
        
        # Connect to database
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # Get list of tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        
        # Save schema for each table
        table_schemas = {}
        for table in tables:
            table_name = table[0]
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = cursor.fetchall()
            table_schemas[table_name] = columns
        
        # Delete all products and related inventory entries
        print("Deleting all products and inventory entries...")
        cursor.execute("DELETE FROM inventory")
        cursor.execute("DELETE FROM products")
        
        # Reset SQLite sequences if they exist
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='products' OR name='inventory'")
        
        # Commit changes
        conn.commit()
        print("Database reset completed successfully")
        
        return True
        
    except Exception as e:
        print(f"Error resetting database: {e}")
        return False
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    reset_database()
