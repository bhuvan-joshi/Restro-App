import os
import sqlite3
import uuid
from PIL import Image, ImageDraw, ImageFont

# Configuration
DB_FILE = "./data/inventory.db"
UPLOADS_FOLDER = "./uploads/products"

def create_placeholder_images():
    """Create placeholder images for all products in the database"""
    print(f"Creating placeholder images for all products")
    
    # Check if database exists
    if not os.path.exists(DB_FILE):
        print(f"Error: Database file '{DB_FILE}' not found!")
        return
    
    # Ensure uploads folder exists
    if not os.path.exists(UPLOADS_FOLDER):
        os.makedirs(UPLOADS_FOLDER, exist_ok=True)
        print(f"Created uploads folder: {UPLOADS_FOLDER}")
    
    # Connect to database
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    try:
        # Get all products
        cursor.execute("SELECT product_id, name FROM products")
        products = cursor.fetchall()
        
        print(f"Found {len(products)} products")
        
        # Create placeholder image for each product
        for product_id, product_name in products:
            image_path = create_placeholder_image(product_name, product_id)
            
            # Update product image path in database
            cursor.execute(
                "UPDATE products SET image_path = ? WHERE product_id = ?",
                (image_path, product_id)
            )
        
        # Commit changes
        conn.commit()
        print(f"Created placeholder images for {len(products)} products")
        
    except Exception as e:
        print(f"Error creating placeholder images: {e}")
        conn.rollback()
    finally:
        conn.close()

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
    text_width, text_height = 200, 40  # Approximate values
    position = ((width - text_width) // 2, (height - text_height) // 2)
    draw.text(position, text[:20], fill=text_color, font=font)  # Limit text length
    
    # Save the image
    filename = f"product_{product_id}.png"
    filepath = os.path.join(UPLOADS_FOLDER, filename)
    image.save(filepath)
    
    print(f"Created placeholder image: {filepath}")
    return f"/uploads/products/{filename}"

if __name__ == "__main__":
    create_placeholder_images()
