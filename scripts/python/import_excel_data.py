import pandas as pd
import sqlite3
import os
import uuid
import shutil
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import datetime
import sys
import argparse

# Configuration
DEFAULT_EXCEL_FILE = "PL- ARPER.xlsx"
DB_FILE = "./data/arper_inventory.db"  # Updated to match the actual database name
IMAGES_FOLDER = "PL- ARPER_files"  # Folder containing the Excel images
UPLOADS_FOLDER = "uploads/products"  # Target folder for product images

def create_uploads_folder():
    """Create the uploads folder if it doesn't exist"""
    if not os.path.exists(UPLOADS_FOLDER):
        os.makedirs(UPLOADS_FOLDER, exist_ok=True)
        print(f"Created directory: {UPLOADS_FOLDER}")

def import_excel_data(excel_file=DEFAULT_EXCEL_FILE, user_id=None):
    """Import data from Excel into SQLite database"""
    # Check if the Excel file exists
    if not os.path.exists(excel_file):
        print(f"Error: Excel file '{excel_file}' not found.")
        return

    # Check if the database file exists
    if not os.path.exists(DB_FILE):
        print(f"Error: Database file '{DB_FILE}' not found.")
        return

    # Read the Excel file
    print(f"Reading Excel file: {excel_file}")
    try:
        # First, read the file to identify the header row
        df = pd.read_excel(excel_file, header=None, engine='openpyxl')
        
        # Find the header row by looking for "SR No" or "DESCRIPTION"
        header_row = None
        for i in range(min(10, len(df))):
            row = df.iloc[i]
            for cell in row:
                if isinstance(cell, str) and ('SR No' in cell or 'DESCRIPTION' in cell):
                    header_row = i
                    break
            if header_row is not None:
                break
                
        if header_row is None:
            print("Could not find header row, assuming first row")
            header_row = 0
        
        # Now read with the correct header
        df = pd.read_excel(excel_file, header=header_row, engine='openpyxl')
        
        # Clean column names
        df.columns = [str(col).strip() for col in df.columns]
        
        # Print column names for debugging
        print(f"Columns in Excel: {df.columns.tolist()}")
        
        # Sample data
        print("\nSample data:")
        print(df.head(5))
        
        # Identify the correct columns for product data
        name_col = next((col for col in df.columns if 'DESCRIPTION' in col), None)
        qty_col = next((col for col in df.columns if 'QTY' in col), None)
        image_col = next((col for col in df.columns if 'IMAGE NO' in col), None)
        rack_col = next((col for col in df.columns if 'RACK' in col), None)
        remarks_col = next((col for col in df.columns if 'REMARKS' in col), None)
        
        if not name_col:
            name_col = 'Unnamed: 1'  # Fallback based on observation
        if not qty_col:
            qty_col = 'Unnamed: 2'   # Fallback based on observation
        if not image_col:
            image_col = 'Unnamed: 3' # Fallback based on observation
        if not rack_col:
            rack_col = 'Unnamed: 5' # Fallback based on observation
        if not remarks_col:
            remarks_col = 'Unnamed: 6' # Fallback based on observation
            
        print(f"\nUsing columns:")
        print(f"  Product Name: {name_col}")
        print(f"  Quantity: {qty_col}")
        print(f"  Image: {image_col}")
        print(f"  Rack Location: {rack_col}")
        print(f"  Remarks: {remarks_col}")
        
        # Connect to SQLite database
        print(f"\nConnecting to database: {DB_FILE}")
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # Create 'Office Supplies' category if it doesn't exist
        category_id = str(uuid.uuid4())
        cursor.execute("SELECT category_id FROM categories WHERE name = 'Office Supplies'")
        category = cursor.fetchone()
        
        if not category:
            print("Creating 'Office Supplies' category")
            cursor.execute(
                "INSERT INTO categories (category_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (category_id, 'Office Supplies', 'Imported office supplies from Excel', datetime.datetime.now(), datetime.datetime.now())
            )
            conn.commit()
        else:
            category_id = category[0]
            
        # Get admin user ID if not provided
        if not user_id:
            user_id = get_admin_user_id(cursor)
            
        if not user_id:
            print("Error: Could not find an admin user.")
            conn.close()
            return
            
        # Create uploads folder if it doesn't exist
        create_uploads_folder()
        
        # Process each row
        imported_count = 0
        for _, row in df.iterrows():
            # Skip rows without a product name
            product_name = row.get(name_col)
            if not product_name or pd.isna(product_name) or str(product_name).strip() == '':
                continue
                
            product_name = str(product_name).strip()
            
            # Get quantity
            quantity = row.get(qty_col, 0)
            if pd.isna(quantity):
                quantity = 0
            try:
                quantity = float(quantity)
            except (ValueError, TypeError):
                quantity = 0
                
            # Get image number
            image_no = row.get(image_col)
            if pd.isna(image_no):
                image_no = None
            else:
                image_no = str(image_no).strip()
                
            # Get rack location
            rack_location = row.get(rack_col)
            if pd.isna(rack_location):
                rack_location = None
            else:
                rack_location = str(rack_location).strip()
                
            # Get remarks
            remarks = row.get(remarks_col)
            if pd.isna(remarks):
                remarks = None
            else:
                remarks = str(remarks).strip()
                
            print(f"\nProcessing product: {product_name}")
            print(f"  Quantity: {quantity}")
            print(f"  Image: {image_no}")
            print(f"  Rack: {rack_location}")
            print(f"  Remarks: {remarks}")
            
            # Generate a product ID
            product_id = str(uuid.uuid4())
            
            # Generate a SKU from the product name
            sku = ''.join(c for c in product_name if c.isalnum())[:8].upper()
            
            # Find or create image
            image_path = None
            if image_no:
                # Try to find the image file
                image_file = find_image_file(image_no)
                if image_file:
                    # Copy to uploads folder
                    dest_path = os.path.join(UPLOADS_FOLDER, f"{product_id}.jpg")
                    try:
                        shutil.copy2(image_file, dest_path)
                        image_path = f"/uploads/products/{product_id}.jpg"
                        print(f"  Copied image to {dest_path}")
                    except Exception as e:
                        print(f"  Error copying image: {e}")
                else:
                    # Create a placeholder image
                    dest_path = os.path.join(UPLOADS_FOLDER, f"{product_id}.jpg")
                    create_placeholder_image(image_no, dest_path)
                    image_path = f"/uploads/products/{product_id}.jpg"
                    print(f"  Created placeholder image at {dest_path}")
            
            # Insert product into database
            try:
                cursor.execute(
                    """
                    INSERT INTO products (
                        product_id, name, description, sku, price, cost, 
                        category_id, image_path, created_at, updated_at, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        product_id, 
                        product_name, 
                        remarks or f"Imported from Excel: {product_name}", 
                        sku, 
                        0.0,  # Default price
                        0.0,  # Default cost
                        category_id,
                        image_path,
                        datetime.datetime.now(),
                        datetime.datetime.now(),
                        user_id
                    )
                )
                
                # Find or create rack location
                location_id = None
                if rack_location:
                    cursor.execute("SELECT location_id FROM locations WHERE name = ? AND type = 'Rack'", (rack_location,))
                    location = cursor.fetchone()
                    
                    if location:
                        location_id = location[0]
                    else:
                        location_id = str(uuid.uuid4())
                        cursor.execute(
                            """
                            INSERT INTO locations (
                                location_id, name, description, type, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?)
                            """,
                            (
                                location_id,
                                rack_location,
                                f"Rack location imported from Excel",
                                'Rack',
                                datetime.datetime.now(),
                                datetime.datetime.now()
                            )
                        )
                
                # Add inventory entry if quantity > 0 and location exists
                if quantity > 0 and location_id:
                    inventory_id = str(uuid.uuid4())
                    cursor.execute(
                        """
                        INSERT INTO inventory (
                            inventory_id, product_id, location_id, quantity, 
                            created_at, updated_at, created_by
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            inventory_id,
                            product_id,
                            location_id,
                            quantity,
                            datetime.datetime.now(),
                            datetime.datetime.now(),
                            user_id
                        )
                    )
                
                conn.commit()
                imported_count += 1
                print(f"  Successfully imported product: {product_name}")
                
            except Exception as e:
                conn.rollback()
                print(f"  Error importing product: {e}")
                
        print(f"\nSuccessfully imported {imported_count} products.")
        conn.close()
        return imported_count
        
    except Exception as e:
        print(f"Error processing Excel file: {e}")
        return 0

def find_image_file(image_no):
    """Find an image file based on image_no in the IMAGES_FOLDER"""
    if not image_no:
        return None
        
    # Clean the image number
    image_no = image_no.strip()
    
    # Check if IMAGES_FOLDER exists
    if not os.path.exists(IMAGES_FOLDER):
        print(f"Images folder '{IMAGES_FOLDER}' not found.")
        return None
        
    # Look for image files with the image number in the name
    for root, _, files in os.walk(IMAGES_FOLDER):
        for file in files:
            if image_no.lower() in file.lower() and file.lower().endswith(('.jpg', '.jpeg', '.png', '.gif')):
                return os.path.join(root, file)
                
    # If not found in IMAGES_FOLDER, look in the current directory
    for ext in ['.jpg', '.jpeg', '.png', '.gif']:
        potential_file = f"{image_no}{ext}"
        if os.path.exists(potential_file):
            return potential_file
            
    return None

def create_placeholder_image(image_no, output_path, width=400, height=300):
    """Create a placeholder image with the image number as text"""
    try:
        # Generate a color based on the image number
        if image_no:
            # Use a hash of the image number to generate a color
            hash_val = sum(ord(c) for c in image_no)
            r = (hash_val * 13) % 200 + 55  # Keep colors not too dark (55-255)
            g = (hash_val * 17) % 200 + 55
            b = (hash_val * 19) % 200 + 55
        else:
            # Default color if no image number
            r, g, b = 200, 200, 200
            
        # Create a new image with the generated color
        img = Image.new('RGB', (width, height), color=(r, g, b))
        draw = ImageDraw.Draw(img)
        
        # Add text
        try:
            # Try to use a font
            font = ImageFont.load_default()
            
            # Draw the image number
            text = f"Image: {image_no}" if image_no else "No Image"
            text_width = draw.textlength(text, font=font)
            text_position = ((width - text_width) // 2, height // 2)
            
            draw.text(
                text_position,
                text,
                fill=(255, 255, 255),
                font=font
            )
        except Exception as e:
            print(f"Error adding text to placeholder image: {e}")
            
        # Save the image
        img.save(output_path)
        print(f"Created placeholder image: {output_path}")
        return True
    except Exception as e:
        print(f"Error creating placeholder image: {e}")
        return False

def get_admin_user_id(cursor):
    """Get the admin user ID from the database"""
    cursor.execute("SELECT user_id FROM users WHERE role = 'admin' LIMIT 1")
    admin = cursor.fetchone()
    return admin[0] if admin else None

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Import Excel data into SQLite database')
    parser.add_argument('excel_file', nargs='?', help='Path to the Excel file', default=DEFAULT_EXCEL_FILE)
    parser.add_argument('user_id', nargs='?', help='User ID for the import operation', default=None)
    args = parser.parse_args()
    
    # Print arguments for debugging
    print(f"Excel file: {args.excel_file}")
    print(f"User ID: {args.user_id}")
    
    # Run the import
    import_excel_data(excel_file=args.excel_file, user_id=args.user_id)