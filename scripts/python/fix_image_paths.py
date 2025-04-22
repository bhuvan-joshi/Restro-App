import os
import sqlite3
import shutil
import uuid
from PIL import Image, ImageDraw, ImageFont

# Constants
DB_FILE = 'arper_inventory.db'
UPLOADS_FOLDER = 'uploads/products'
PLACEHOLDER_COLOR = (200, 200, 200)  # Light gray

def ensure_uploads_folder():
    """Ensure the uploads folder exists"""
    if not os.path.exists(UPLOADS_FOLDER):
        os.makedirs(UPLOADS_FOLDER, exist_ok=True)
        print(f"Created uploads folder: {UPLOADS_FOLDER}")
    else:
        print(f"Uploads folder exists: {UPLOADS_FOLDER}")

def create_placeholder_image(product_name, target_path, size=(300, 300)):
    """Create a placeholder image with the product name"""
    try:
        # Create a new image with a light gray background
        img = Image.new('RGB', size, PLACEHOLDER_COLOR)
        draw = ImageDraw.Draw(img)
        
        # Try to use a default font
        try:
            font = ImageFont.truetype("arial.ttf", 20)
        except:
            font = ImageFont.load_default()
        
        # Draw the product name
        text = product_name
        if len(text) > 30:
            text = text[:27] + "..."
        
        # Calculate text position to center it
        text_width = draw.textlength(text, font=font)
        text_position = ((size[0] - text_width) / 2, size[1] / 2 - 10)
        
        # Draw the text
        draw.text(text_position, text, fill=(0, 0, 0), font=font)
        
        # Save the image
        img.save(target_path)
        print(f"Created placeholder image for {product_name} at {target_path}")
        return True
    except Exception as e:
        print(f"Error creating placeholder image: {e}")
        return False

def fix_image_paths():
    """Fix all product image paths in the database"""
    ensure_uploads_folder()
    
    # Check if database exists
    if not os.path.exists(DB_FILE):
        print(f"Error: Database file '{DB_FILE}' not found!")
        return
    
    # Connect to database
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Get all products
    cursor.execute("""
        SELECT product_id, name, image_path
        FROM products
        ORDER BY name
    """)
    
    products = cursor.fetchall()
    print(f"Found {len(products)} products in database")
    
    # Track statistics
    updated_count = 0
    placeholder_count = 0
    
    # Process each product
    for i, product in enumerate(products):
        product_id, name, current_image = product
        
        print(f"\nProcessing product {i+1}/{len(products)}: {name}")
        
        # Generate a simple filename using a UUID
        new_filename = f"product_{uuid.uuid4()}.jpg"
        target_path = os.path.join(UPLOADS_FOLDER, new_filename)
        
        # Create a placeholder image for this product
        create_placeholder_image(name, target_path)
        
        # Update the database with the new image path
        db_image_path = f"/uploads/products/{new_filename}"
        
        # Log the path being stored
        print(f"Updating product {product_id} ({name}) with image path: {db_image_path}")
        
        try:
            # Use parameterized query to avoid any string formatting issues
            cursor.execute(
                "UPDATE products SET image_path = ? WHERE product_id = ?",
                (db_image_path, product_id)
            )
            
            # Verify the update
            cursor.execute("SELECT image_path FROM products WHERE product_id = ?", (product_id,))
            stored_path = cursor.fetchone()[0]
            
            if stored_path != db_image_path:
                print(f"WARNING: Path mismatch for product {product_id}. Expected: {db_image_path}, Stored: {stored_path}")
                # Try to fix it with a direct update
                cursor.execute("UPDATE products SET image_path = ? WHERE product_id = ?", (db_image_path, product_id))
                conn.commit()  # Commit immediately after the fix
            
            updated_count += 1
            
            # Verify the image file exists
            if os.path.exists(target_path) and os.path.getsize(target_path) > 0:
                print(f"Image file verified: {target_path}")
            else:
                print(f"WARNING: Image file does not exist or is empty: {target_path}")
                placeholder_count += 1
                
        except Exception as e:
            print(f"Error updating database for product {product_id}: {e}")
        
        # Commit after each product to ensure changes are saved
        conn.commit()
    
    # Final commit
    conn.commit()
    conn.close()
    
    print(f"\nResults:")
    print(f"- {updated_count} products updated with images")
    print(f"- {placeholder_count} products had issues and received placeholders")

if __name__ == "__main__":
    fix_image_paths()
