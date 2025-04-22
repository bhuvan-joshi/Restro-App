import os
import sqlite3
import pandas as pd
import uuid
import shutil
from PIL import Image, ImageDraw, ImageFont

# Configuration
EXCEL_FILE = "PL- ARPER.xlsx"
DB_FILE = "./data/inventory.db"
IMAGES_FOLDER = "./images"
UPLOADS_FOLDER = "./uploads/products"

def import_excel_data():
    """Import data from Excel file into SQLite database"""
    print(f"Importing data from Excel file: {EXCEL_FILE}")
    
    # Check if files and folders exist
    if not os.path.exists(EXCEL_FILE):
        print(f"Error: Excel file '{EXCEL_FILE}' not found!")
        return
    
    if not os.path.exists(DB_FILE):
        print(f"Error: Database file '{DB_FILE}' not found!")
        return
    
    if not os.path.exists(UPLOADS_FOLDER):
        os.makedirs(UPLOADS_FOLDER, exist_ok=True)
        print(f"Created uploads folder: {UPLOADS_FOLDER}")
    
    try:
        # Read Excel file
        df = pd.read_excel(EXCEL_FILE)
        print(f"Read {len(df)} rows from Excel file")
        
        # Print column names for debugging
        print(f"Columns in Excel: {df.columns.tolist()}")
        
        # Sample data
        print("\nSample data:")
        print(df.head(5))
        
        # Identify the correct columns for product data
        name_col = next((col for col in df.columns if 'DESCRIPTION' in str(col)), None)
        qty_col = next((col for col in df.columns if 'QTY' in str(col)), None)
        image_col = next((col for col in df.columns if 'IMAGE NO' in str(col)), None)
        rack_col = next((col for col in df.columns if 'RACK' in str(col)), None)
        remarks_col = next((col for col in df.columns if 'REMARKS' in str(col)), None)
        
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
        
        if category:
            category_id = category[0]
        else:
            cursor.execute(
                "INSERT INTO categories (category_id, name) VALUES (?, ?)",
                (category_id, 'Office Supplies')
            )
            conn.commit()
            print("Created 'Office Supplies' category")
        
        # Create main warehouse location if it doesn't exist
        warehouse_id = str(uuid.uuid4())
        cursor.execute("SELECT location_id FROM locations WHERE name = 'Main Warehouse'")
        warehouse = cursor.fetchone()
        
        if warehouse:
            warehouse_id = warehouse[0]
        else:
            cursor.execute(
                """INSERT INTO locations 
                   (location_id, name, description, type) 
                   VALUES (?, ?, ?, ?)""",
                (warehouse_id, 'Main Warehouse', 'Main storage location', 'Warehouse')
            )
            conn.commit()
            print("Created 'Main Warehouse' location")
        
        # Process each row in the Excel file
        products_added = 0
        products_updated = 0
        
        # Keep track of duplicate product names
        product_name_count = {}
        
        for _, row in df.iterrows():
            # Skip rows with no product name
            if pd.isna(row[name_col]):
                continue
            
            # Generate a unique ID for this product
            product_id = str(uuid.uuid4())
            inventory_id = str(uuid.uuid4())
            
            # Get product data
            product_name = str(row[name_col]).strip()
            
            # Skip the header row if it exists
            if product_name.lower() == 'description':
                continue
                
            try:
                quantity = int(row[qty_col])
            except (ValueError, TypeError):
                quantity = 1  # Default quantity if invalid
                
            image_no = str(row[image_col]).strip() if not pd.isna(row[image_col]) else ''
            rack_location = str(row[rack_col]).strip() if not pd.isna(row[rack_col]) else ''
            description = str(row[remarks_col]).strip() if not pd.isna(row[remarks_col]) else ''
            
            # Handle duplicate product names by adding a suffix
            if product_name in product_name_count:
                product_name_count[product_name] += 1
                original_name = product_name
                product_name = f"{original_name} ({product_name_count[original_name]})"
            else:
                product_name_count[product_name] = 0
            
            # Handle image file
            image_path = None
            if image_no and not pd.isna(image_no):
                # Look for the image file with this ID
                source_image_path = find_image_file(image_no)
                if source_image_path:
                    # Copy and rename to the uploads folder
                    image_filename = f"product_{product_id}{os.path.splitext(source_image_path)[1]}"
                    destination_path = os.path.join(UPLOADS_FOLDER, image_filename)
                    try:
                        shutil.copy2(source_image_path, destination_path)
                        print(f"Copied image: {source_image_path} -> {destination_path}")
                        image_path = f"/uploads/products/{image_filename}"
                    except Exception as e:
                        print(f"Error copying image: {e}")
                else:
                    # Create a placeholder image with the image number
                    image_path = create_placeholder_image(image_no, product_id)
            
            # Set fallback image path if still none
            if not image_path:
                image_path = "/uploads/products/placeholder.png"
            
            # Handle rack location - create or get rack location ID
            location_id = warehouse_id  # Default to main warehouse
            if rack_location and rack_location.strip():
                # Check if this rack location exists
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
                    conn.commit()
                    print(f"Created rack location: {rack_location}")
            
            # Generate a SKU
            sku = f"ARPER-{products_added + 1:03d}-{int(pd.Timestamp.now().timestamp())}"
            
            # Insert new product
            cursor.execute(
                """INSERT INTO products 
                   (product_id, name, description, sku, price, cost, image_path, category_id) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (product_id, product_name, description, sku, 0.0, 0.0, image_path, category_id)
            )
            
            # Insert inventory entry
            cursor.execute(
                """INSERT INTO inventory 
                   (inventory_id, product_id, location_id, quantity) 
                   VALUES (?, ?, ?, ?)""",
                (inventory_id, product_id, location_id, quantity)
            )
            
            products_added += 1
            print(f"Added product: {product_name} (Rack: {rack_location}, Image: {image_no})")
            
        conn.commit()
        print(f"\nImport completed: {products_added} products added, {products_updated} products updated")
        
    except Exception as e:
        print(f"Error importing data: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

def find_image_file(image_no):
    """Find an image file based on image_no in the IMAGES_FOLDER"""
    if not image_no or not os.path.exists(IMAGES_FOLDER):
        return None
        
    # Clean the image number
    image_no = str(image_no).strip()
    
    # Look for files with the image number in the name
    for root, dirs, files in os.walk(IMAGES_FOLDER):
        for file in files:
            if image_no in file and file.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                return os.path.join(root, file)
    
    # If not found, check if there's a file with this exact name
    potential_files = [
        os.path.join(IMAGES_FOLDER, f"{image_no}.png"),
        os.path.join(IMAGES_FOLDER, f"{image_no}.jpg"),
        os.path.join(IMAGES_FOLDER, f"{image_no}.jpeg")
    ]
    
    for file in potential_files:
        if os.path.exists(file):
            return file
    
    return None

def create_placeholder_image(text, product_id):
    """Create a placeholder image with the given text"""
    width, height = 400, 400
    background_color = (240, 240, 240)
    text_color = (100, 100, 100)
    
    # Create a new image with the given background color
    image = Image.new('RGB', (width, height), background_color)
    draw = ImageDraw.Draw(image)
    
    # Try to load a font, use default if not available
    try:
        font = ImageFont.truetype("arial.ttf", 40)
    except IOError:
        font = ImageFont.load_default()
    
    # Draw the text in the center of the image
    text_width, text_height = draw.textsize(text, font=font) if hasattr(draw, 'textsize') else (200, 40)
    position = ((width - text_width) // 2, (height - text_height) // 2)
    draw.text(position, text, fill=text_color, font=font)
    
    # Save the image
    filename = f"product_{product_id}.png"
    filepath = os.path.join(UPLOADS_FOLDER, filename)
    image.save(filepath)
    
    print(f"Created placeholder image: {filepath}")
    return f"/uploads/products/{filename}"

if __name__ == "__main__":
    import_excel_data()
