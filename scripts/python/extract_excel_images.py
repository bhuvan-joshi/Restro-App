import os
import sqlite3
import openpyxl
from openpyxl_image_loader import SheetImageLoader
import pandas as pd
from PIL import Image

# Configuration
DB_FILE = "./arper_inventory.db"  # Main database file
EXCEL_FILE = "PL- ARPER.xlsx"  # Excel file containing images
UPLOADS_FOLDER = "uploads/products"

def ensure_uploads_folder():
    """Ensure the uploads folder exists"""
    if not os.path.exists(UPLOADS_FOLDER):
        os.makedirs(UPLOADS_FOLDER, exist_ok=True)
        print(f"Created directory: {UPLOADS_FOLDER}")

def extract_images_from_excel():
    """Extract images embedded in the Excel file and map them to products"""
    ensure_uploads_folder()
    
    # Check if the Excel file exists
    if not os.path.exists(EXCEL_FILE):
        print(f"Error: Excel file '{EXCEL_FILE}' not found!")
        return
        
    print(f"Looking for database at: {os.path.abspath(DB_FILE)}")
    if not os.path.exists(DB_FILE):
        print(f"Error: Database file '{DB_FILE}' not found!")
        return
    
    # Connect to SQLite database
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Get all products from the database
    cursor.execute("""
        SELECT product_id, name, image_path 
        FROM products 
        ORDER BY name
    """)
    
    products = cursor.fetchall()
    print(f"Found {len(products)} products in database")
    
    # Load the Excel file to find header row
    print(f"Loading Excel file: {EXCEL_FILE}")
    df = pd.read_excel(EXCEL_FILE, header=None, engine='openpyxl')
    
    # Find the header row by looking for "SR No" or "DESCRIPTION"
    header_row = None
    for i in range(min(20, len(df))):
        row = df.iloc[i]
        for cell in row:
            if isinstance(cell, str) and ('SR No' in cell or 'DESCRIPTION' in cell or 'IMAGE NO' in cell):
                header_row = i
                break
        if header_row is not None:
            break
    
    if header_row is None:
        print("Could not find header row, assuming first row")
        header_row = 0
    
    # Load the Excel sheet with the image loader
    wb = openpyxl.load_workbook(EXCEL_FILE)
    sheet = wb.active
    image_loader = SheetImageLoader(sheet)
    
    # Find column indices
    df = pd.read_excel(EXCEL_FILE, header=header_row, engine='openpyxl')
    
    # Clean column names
    df.columns = [str(col).strip() for col in df.columns]
    print(f"Columns in Excel: {df.columns.tolist()}")
    
    # Identify the relevant columns
    name_col = next((col for col in df.columns if 'DESCRIPTION' in col), None)
    image_no_col = next((col for col in df.columns if 'IMAGE NO' in col), None)
    image_col = next((col for col in df.columns if col == 'IMAGE'), None)
    
    if not name_col:
        name_col = 'Unnamed: 1'  # Fallback based on observation
    if not image_no_col:
        image_no_col = 'Unnamed: 3' # Fallback based on observation
    if not image_col:
        image_col = 'Unnamed: 4' # Fallback based on observation
        
    print(f"Using columns: Product Name='{name_col}', Image No='{image_no_col}', Image='{image_col}'")
    
    # Create a mapping from product name to product_id
    product_name_to_id = {}
    product_id_to_name = {}
    for product in products:
        product_id, product_name, _ = product
        product_name_to_id[product_name] = product_id
        product_id_to_name[product_id] = product_name
    
    # Extract images from Excel and save them
    updated_count = 0
    skipped_count = 0
    not_found_count = 0
    
    # List all cells with images
    if hasattr(image_loader, '_images'):
        print(f"Total images found in Excel: {len(image_loader._images)}")
        print(f"Images in these cells: {list(image_loader._images.keys())[:10]}...")
    else:
        print("No _images attribute found in image_loader")
    
    # Process each row in the Excel
    for index, row in df.iterrows():
        # Skip rows with no product name
        if pd.isna(row[name_col]) or row[name_col] == 'DESCRIPTION':
            continue
            
        product_name = str(row[name_col]).strip()
        
        # Look for product in database
        product_id = None
        for db_product in products:
            db_id, db_name, _ = db_product
            if db_name.strip() == product_name:
                product_id = db_id
                break
        
        if not product_id:
            print(f"Could not find product '{product_name}' in database")
            not_found_count += 1
            continue
            
        # Try to get image from the IMAGE column
        excel_row = index + header_row + 2  # +2 for Excel's 1-indexed rows and header offset
        
        # Construct cell references for both potential image columns
        image_cell_refs = []
        
        # IMAGE column (usually E)
        if image_col:
            if isinstance(image_col, int):
                col_letter = chr(65 + image_col)
            else:
                col_idx = df.columns.get_loc(image_col)
                col_letter = chr(65 + col_idx)
            image_cell_refs.append(f"{col_letter}{excel_row}")

        # IMAGE NO column (usually D)
        if image_no_col:
            if isinstance(image_no_col, int):
                col_letter = chr(65 + image_no_col)
            else:
                col_idx = df.columns.get_loc(image_no_col)
                col_letter = chr(65 + col_idx)
            image_cell_refs.append(f"{col_letter}{excel_row}")
            
        # Also try neighboring cells
        for cell_ref in list(image_cell_refs):
            col_letter = cell_ref[0]
            for offset in [-1, 1, 2]:
                new_col_letter = chr(ord(col_letter) + offset)
                image_cell_refs.append(f"{new_col_letter}{excel_row}")
                
        print(f"Processing row {excel_row}, product: {product_name}, checking cells: {image_cell_refs}")
            
        # Try all possible cells
        image_found = False
        for cell_ref in image_cell_refs:
            try:
                if cell_ref in image_loader._images:
                    img = image_loader.get(cell_ref)
                    
                    # Save the image to the uploads folder
                    file_ext = ".jpg"  # Default to jpg
                    new_filename = f"product_{product_id}{file_ext}"
                    target_path = os.path.join(UPLOADS_FOLDER, new_filename)
                    
                    img.save(target_path)
                    print(f"Saved image from {cell_ref} to {target_path}")
                    
                    # Update database
                    db_image_path = f"/uploads/products/{new_filename}"
                    cursor.execute(
                        "UPDATE products SET image_path = ? WHERE product_id = ?",
                        (db_image_path, product_id)
                    )
                    updated_count += 1
                    print(f"Updated product {product_name} with image from Excel")
                    image_found = True
                    break
            except Exception as e:
                print(f"Error with cell {cell_ref}: {e}")
        
        if not image_found:
            print(f"No image found for {product_name} in any of the checked cells")
    
    # Commit changes and close connections
    conn.commit()
    conn.close()
    wb.close()
    
    print(f"\nResults:")
    print(f"- {updated_count} products updated with images from Excel")
    print(f"- {skipped_count} products already had proper images")
    print(f"- {not_found_count} products in Excel not found in database")

if __name__ == "__main__":
    extract_images_from_excel() 