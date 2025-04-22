import os
import sqlite3
import pandas as pd
import openpyxl
from PIL import Image, ImageDraw, ImageFont
import glob
import shutil
import uuid
import sys
import time
import random
import re
import argparse

# Configuration
DB_FILE = "./data/arper_inventory.db"  # Updated to match the actual database name
DEFAULT_EXCEL_FILE = "PL- ARPER.xlsx"
UPLOADS_FOLDER = "uploads/products"
MAX_RETRIES = 3
RETRY_DELAY = 1.5

def ensure_uploads_folder():
    """Ensure the uploads folder exists"""
    # Ensure data directory exists
    data_dir = os.path.dirname(DB_FILE)
    if not os.path.exists(data_dir):
        os.makedirs(data_dir, exist_ok=True)
        print(f"Created data directory: {data_dir}")
    
    # Ensure uploads folder exists
    if not os.path.exists(UPLOADS_FOLDER):
        os.makedirs(UPLOADS_FOLDER, exist_ok=True)
        print(f"Created uploads folder: {UPLOADS_FOLDER}")
    else:
        print(f"Uploads folder exists: {UPLOADS_FOLDER}")

def get_image_files():
    """Find all image files in current directory and subdirectories"""
    image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.gif']
    image_files = []
    
    for ext in image_extensions:
        image_files.extend(glob.glob(f"**/{ext}", recursive=True))
    
    print(f"Found {len(image_files)} image files")
    return image_files

def find_image_by_name(image_name, image_files):
    """Find an image file by name (case insensitive)"""
    if not image_name:
        return None
    
    # Clean the image name
    image_name = image_name.strip()
    image_name_lower = image_name.lower()
    
    # Try exact match first
    for file_path in image_files:
        filename = os.path.basename(file_path)
        if filename.lower() == image_name_lower:
            return file_path
    
    # Try contained match (e.g., IMG_8454 in filename)
    for file_path in image_files:
        if image_name_lower in file_path.lower():
            return file_path
    
    return None

def create_placeholder_image(product_name, save_path, width=400, height=300):
    """Create a colored image with product text"""
    # Generate a color based on the product name
    name_hash = sum(ord(c) for c in product_name)
    r = (name_hash * 33) % 200 + 55  # Keep colors not too dark (55-255)
    g = (name_hash * 89) % 200 + 55
    b = (name_hash * 144) % 200 + 55
    
    # Create image
    img = Image.new('RGB', (width, height), color=(r, g, b))
    draw = ImageDraw.Draw(img)
    
    # Add text
    try:
        font = ImageFont.load_default()
    except:
        # If error, just create a blank image
        img.save(save_path)
        return
    
    # Wrap text to fit
    words = product_name.split()
    lines = []
    current_line = []
    
    for word in words:
        current_line.append(word)
        if len(' '.join(current_line)) > 20:  # arbitrary threshold
            lines.append(' '.join(current_line[:-1]))
            current_line = [word]
    
    if current_line:
        lines.append(' '.join(current_line))
    
    # Draw text in center
    y_position = height // 2 - (len(lines) * 15) // 2
    for line in lines:
        text_width = len(line) * 7  # Rough estimate
        x_position = (width - text_width) // 2
        draw.text((x_position, y_position), line, fill=(255, 255, 255), font=font)
        y_position += 20
    
    # Save image
    img.save(save_path)
    print(f"Created placeholder for {product_name}")

def copy_file_with_retry(src, dst, product_name, max_retries=MAX_RETRIES):
    """Attempt to copy a file with retries and exponential backoff using read/write approach"""
    # Make sure the destination directory exists
    dst_dir = os.path.dirname(dst)
    if not os.path.exists(dst_dir):
        os.makedirs(dst_dir, exist_ok=True)
    
    # Verify source file exists
    if not os.path.exists(src):
        print(f"Error: Source file does not exist: {src}")
        return False
    
    for attempt in range(max_retries):
        try:
            # Use a read/write approach instead of shutil.copy2
            with open(src, 'rb') as src_file:
                image_data = src_file.read()
                
            with open(dst, 'wb') as dst_file:
                dst_file.write(image_data)
            
            # Verify the file was copied successfully
            if os.path.exists(dst) and os.path.getsize(dst) > 0:
                print(f"Copied image for {product_name}: {src} -> {dst}")
                return True
            else:
                print(f"File copy failed: Destination file does not exist or is empty: {dst}")
                time.sleep(0.5)  # Short delay before retry
        except Exception as e:
            delay = RETRY_DELAY * (attempt + 1) + random.uniform(0, 0.5)
            print(f"Attempt {attempt+1}/{max_retries} failed: {e}")
            print(f"Waiting {delay:.2f}s before retry...")
            time.sleep(delay)
    
    print(f"All {max_retries} attempts failed to copy image for {product_name}")
    return False

def sanitize_filename(filename):
    """Sanitize a filename to remove invalid characters"""
    # Replace invalid characters with underscores
    invalid_chars = r'[<>:"/\\|?*]'
    sanitized = re.sub(invalid_chars, '_', filename)
    
    # Limit length to avoid path too long errors
    if len(sanitized) > 50:
        sanitized = sanitized[:47] + '...'
    
    return sanitized

def extract_images_from_excel(excel_file=DEFAULT_EXCEL_FILE):
    """Extract images from Excel file and return a dictionary of product_id -> image_path"""
    print(f"Extracting images from Excel file: {excel_file}")
    
    # Create a temporary directory for extracted images
    temp_dir = os.path.join(os.path.dirname(os.path.abspath(excel_file)), "temp_excel_images")
    os.makedirs(temp_dir, exist_ok=True)
    
    # Load Excel file
    try:
        workbook = openpyxl.load_workbook(excel_file)
    except Exception as e:
        print(f"Error loading Excel file: {e}")
        return {}
    
    # Dictionary to store extracted images
    extracted_images = {}
    
    # Process each sheet
    for sheet_name in workbook.sheetnames:
        sheet = workbook[sheet_name]
        print(f"Processing sheet: {sheet_name}")
        
        # Load sheet data into DataFrame for easier processing
        df = pd.read_excel(excel_file, sheet_name=sheet_name, header=None)
        print(f"DataFrame shape: {df.shape}")
        
        # Extract product identifiers from the sheet (SKUs and names)
        product_ids = set()
        sku_column = None
        name_column = None
        
        # Try to find SKU and name columns
        for col in range(df.shape[1]):
            for row in range(min(10, df.shape[0])):  # Check first 10 rows
                cell_value = str(df.iloc[row, col]).strip() if not pd.isna(df.iloc[row, col]) else ""
                
                # Look for SKU-like patterns (ARPER-XXX)
                if re.match(r'^[A-Z0-9]+-[A-Z0-9]+$', cell_value):
                    sku_column = col
                
                # Look for description/name column
                if cell_value.upper() in ["DESCRIPTION", "PRODUCT NAME", "ITEM"]:
                    name_column = col
        
        # Extract images from the sheet
        for image in sheet._images:
            try:
                # Get image data
                image_data = workbook._images[image.ref]
                
                # Generate a unique filename
                image_filename = f"excel_image_{uuid.uuid4()}.png"
                image_path = os.path.join(temp_dir, image_filename)
                
                # Save the image
                with open(image_path, 'wb') as f:
                    f.write(image_data)
                
                # Try to associate with a product
                # Get the cell where the image is anchored
                anchor_cell = image.anchor
                if hasattr(anchor_cell, 'to'):
                    row = anchor_cell.to.row
                    col = anchor_cell.to.col
                else:
                    row = anchor_cell._from.row
                    col = anchor_cell._from.col
                
                # Try to find the product name or SKU in nearby cells
                product_identifier = None
                
                # Check the cell itself
                if 0 <= row < df.shape[0] and 0 <= col < df.shape[1]:
                    cell_value = str(df.iloc[row, col]).strip() if not pd.isna(df.iloc[row, col]) else ""
                    if cell_value:
                        product_identifier = cell_value
                
                # If no identifier found, check nearby cells
                if not product_identifier:
                    # Check cells in the same row
                    for c in range(df.shape[1]):
                        if 0 <= row < df.shape[0]:
                            cell_value = str(df.iloc[row, c]).strip() if not pd.isna(df.iloc[row, c]) else ""
                            if cell_value and c != col:
                                product_identifier = cell_value
                                break
                
                # If still no identifier, use the image filename
                if not product_identifier:
                    product_identifier = image_filename
                
                # Add to extracted images
                extracted_images[product_identifier] = image_path
                print(f"Extracted image for '{product_identifier}': {image_path}")
                
            except Exception as e:
                print(f"Error extracting image: {e}")
    
    print(f"Extracted {len(extracted_images)} images from Excel")
    return extracted_images

def fix_product_images(excel_file=DEFAULT_EXCEL_FILE):
    """Fix product images by extracting from Excel and updating database"""
    print("Starting product image fix process...")
    
    # Ensure uploads folder exists
    ensure_uploads_folder()
    
    # Connect to the database
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        print(f"Connected to database: {DB_FILE}")
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return
    
    # Get all products without images
    cursor.execute("""
        SELECT product_id, name, sku 
        FROM products 
        WHERE image_path IS NULL OR image_path = ''
    """)
    products_without_images = cursor.fetchall()
    print(f"Found {len(products_without_images)} products without images")
    
    # Get all products with placeholder images
    cursor.execute("""
        SELECT product_id, name, sku 
        FROM products 
        WHERE image_path LIKE '%placeholder%'
    """)
    products_with_placeholders = cursor.fetchall()
    print(f"Found {len(products_with_placeholders)} products with placeholder images")
    
    # Combine both lists
    products_to_fix = products_without_images + products_with_placeholders
    print(f"Total products to fix: {len(products_to_fix)}")
    
    if not products_to_fix:
        print("No products need image fixes")
        conn.close()
        return
    
    # Get all image files in the current directory and subdirectories
    image_files = get_image_files()
    
    # Try to extract images from Excel
    excel_images = extract_images_from_excel(excel_file)
    
    # Process each product
    fixed_count = 0
    for product_id, name, sku in products_to_fix:
        print(f"\nProcessing product: {name} (SKU: {sku})")
        
        # Generate a sanitized filename
        safe_name = sanitize_filename(name)
        image_path = os.path.join(UPLOADS_FOLDER, f"{product_id}.jpg")
        db_image_path = f"/uploads/products/{product_id}.jpg"
        
        # Try to find an image by SKU or name
        found_image = None
        
        # First, check Excel extracted images
        if sku in excel_images:
            found_image = excel_images[sku]
            print(f"Found image in Excel by SKU: {found_image}")
        elif name in excel_images:
            found_image = excel_images[name]
            print(f"Found image in Excel by name: {found_image}")
        else:
            # Try to find partial matches in Excel images
            for key, path in excel_images.items():
                if sku and sku in key:
                    found_image = path
                    print(f"Found image in Excel by partial SKU match: {found_image}")
                    break
                elif name and name.lower() in key.lower():
                    found_image = path
                    print(f"Found image in Excel by partial name match: {found_image}")
                    break
        
        # If not found in Excel, try to find in filesystem
        if not found_image:
            # Try by SKU first
            if sku:
                found_image = find_image_by_name(sku, image_files)
                if found_image:
                    print(f"Found image by SKU: {found_image}")
            
            # If not found by SKU, try by name
            if not found_image and name:
                found_image = find_image_by_name(name, image_files)
                if found_image:
                    print(f"Found image by name: {found_image}")
        
        # If an image was found, copy it
        if found_image:
            if copy_file_with_retry(found_image, image_path, name):
                # Update the database
                cursor.execute(
                    "UPDATE products SET image_path = ? WHERE product_id = ?",
                    (db_image_path, product_id)
                )
                conn.commit()
                fixed_count += 1
                print(f"Updated database with image path: {db_image_path}")
        else:
            # Create a placeholder image
            print(f"No image found for {name}, creating placeholder")
            create_placeholder_image(name, image_path)
            
            # Update the database
            cursor.execute(
                "UPDATE products SET image_path = ? WHERE product_id = ?",
                (db_image_path, product_id)
            )
            conn.commit()
            fixed_count += 1
            print(f"Updated database with placeholder image: {db_image_path}")
    
    print(f"\nFixed images for {fixed_count} products")
    conn.close()

def main():
    """Main function to process command line arguments"""
    parser = argparse.ArgumentParser(description='Fix product images')
    parser.add_argument('--excel_file', help='Path to the Excel file', default=DEFAULT_EXCEL_FILE)
    args = parser.parse_args()
    
    fix_product_images(args.excel_file)

if __name__ == "__main__":
    main()