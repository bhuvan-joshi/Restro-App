import os
import sqlite3
import requests
import random
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO

# Configuration
DB_FILE = "./arper_inventory.db"  # Main database file
UPLOADS_FOLDER = "uploads/products"

# Furniture image sources by category
CHAIR_IMAGES = [
    "https://images.pexels.com/photos/1350789/pexels-photo-1350789.jpeg",
    "https://images.pexels.com/photos/5695904/pexels-photo-5695904.jpeg",
    "https://images.pexels.com/photos/2082090/pexels-photo-2082090.jpeg",
    "https://images.pexels.com/photos/106839/pexels-photo-106839.jpeg",
    "https://images.pexels.com/photos/5705090/pexels-photo-5705090.jpeg",
    "https://images.pexels.com/photos/5705074/pexels-photo-5705074.jpeg",
    "https://images.pexels.com/photos/6489007/pexels-photo-6489007.jpeg",
    "https://images.pexels.com/photos/1668860/pexels-photo-1668860.jpeg"
]

TABLE_IMAGES = [
    "https://images.pexels.com/photos/1957478/pexels-photo-1957478.jpeg",
    "https://images.pexels.com/photos/3097112/pexels-photo-3097112.jpeg",
    "https://images.pexels.com/photos/2762247/pexels-photo-2762247.jpeg", 
    "https://images.pexels.com/photos/3932929/pexels-photo-3932929.jpeg",
    "https://images.pexels.com/photos/4846437/pexels-photo-4846437.jpeg",
    "https://images.pexels.com/photos/1813502/pexels-photo-1813502.jpeg",
    "https://images.pexels.com/photos/9876607/pexels-photo-9876607.jpeg"
]

SOFA_IMAGES = [
    "https://images.pexels.com/photos/3757055/pexels-photo-3757055.jpeg",
    "https://images.pexels.com/photos/1866149/pexels-photo-1866149.jpeg",
    "https://images.pexels.com/photos/276528/pexels-photo-276528.jpeg",
    "https://images.pexels.com/photos/2079249/pexels-photo-2079249.jpeg",
    "https://images.pexels.com/photos/2986011/pexels-photo-2986011.jpeg", 
    "https://images.pexels.com/photos/210265/pexels-photo-210265.jpeg"
]

STOOL_IMAGES = [
    "https://images.pexels.com/photos/1148955/pexels-photo-1148955.jpeg",
    "https://images.pexels.com/photos/4099354/pexels-photo-4099354.jpeg",
    "https://images.pexels.com/photos/5706294/pexels-photo-5706294.jpeg",
    "https://images.pexels.com/photos/5706265/pexels-photo-5706265.jpeg",
    "https://images.pexels.com/photos/9813639/pexels-photo-9813639.jpeg",
    "https://images.pexels.com/photos/5706211/pexels-photo-5706211.jpeg",
    "https://images.pexels.com/photos/5705937/pexels-photo-5705937.jpeg"
]

# Miscellaneous images for other items
OTHER_IMAGES = CHAIR_IMAGES + TABLE_IMAGES + SOFA_IMAGES + STOOL_IMAGES

def ensure_uploads_folder():
    """Ensure the uploads folder exists"""
    if not os.path.exists(UPLOADS_FOLDER):
        os.makedirs(UPLOADS_FOLDER, exist_ok=True)
        print(f"Created directory: {UPLOADS_FOLDER}")

def create_color_image(product_name, save_path, width=400, height=300):
    """Create a colored image with product text when no real image is available"""
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
        # Try to use a default font
        font = ImageFont.truetype("arial.ttf", 20)
    except IOError:
        font = ImageFont.load_default()
    
    # Format product name
    product_name = product_name[:50]  # Limit length
    words = product_name.split()
    lines = []
    current_line = []
    
    for word in words:
        test_line = ' '.join(current_line + [word])
        # Estimate text width
        text_width = len(test_line) * 10  # Rough estimate
        
        if text_width <= width - 40:  # Leave margin
            current_line.append(word)
        else:
            if current_line:
                lines.append(' '.join(current_line))
            current_line = [word]
    
    if current_line:
        lines.append(' '.join(current_line))
    
    # Draw text lines
    y_position = (height - len(lines) * 24) // 2
    for line in lines:
        # Center text
        text_width = len(line) * 10  # Approximate width
        x_position = (width - text_width) // 2
        draw.text((x_position, y_position), line, fill=(255, 255, 255), font=font)
        y_position += 24
    
    # Save image
    img.save(save_path)
    print(f"Created color image for {product_name}")
    return True

def download_image(url, save_path, product_name):
    """Download an image from URL and save it to the specified path"""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        img = Image.open(BytesIO(response.content))
        img.save(save_path)
        print(f"Downloaded image from {url}")
        return True
    except Exception as e:
        print(f"Error downloading image {url}: {e}")
        # Create a colored placeholder instead
        return create_color_image(product_name, save_path)

def fix_product_images():
    """Fix images for all products in the database"""
    ensure_uploads_folder()
    
    # Check if database exists
    if not os.path.exists(DB_FILE):
        print(f"Error: Database file '{DB_FILE}' not found!")
        return
    
    try:
        # Connect to SQLite database
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # Check if products table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='products'")
        if not cursor.fetchone():
            print("Error: Products table not found in database!")
            conn.close()
            return
        
        # Get all products
        cursor.execute("""
            SELECT product_id, name 
            FROM products 
            ORDER BY name
        """)
        
        products = cursor.fetchall()
        print(f"Found {len(products)} products in database")
        
        # Process each product
        updated_count = 0
        for product in products:
            product_id = product[0]
            product_name = product[1]
            
            # Categorize product by name for better image matching
            category = "other"
            product_name_lower = product_name.lower()
            
            if any(term in product_name_lower for term in ["chair"]):
                category = "chair"
            elif any(term in product_name_lower for term in ["stool"]):
                category = "stool"
            elif any(term in product_name_lower for term in ["table", "desk"]):
                category = "table"
            elif any(term in product_name_lower for term in ["sofa", "couch", "lounge"]):
                category = "sofa"
            
            # Select appropriate image category
            image_list = OTHER_IMAGES
            if category == "chair":
                image_list = CHAIR_IMAGES
            elif category == "stool":
                image_list = STOOL_IMAGES
            elif category == "table":
                image_list = TABLE_IMAGES
            elif category == "sofa":
                image_list = SOFA_IMAGES
            
            # Select random image from category
            image_url = random.choice(image_list)
            
            # Generate unique filename with proper extension
            file_ext = os.path.splitext(image_url.split('/')[-1])[1]
            if not file_ext:
                file_ext = ".jpg"  # Default to jpg if no extension found
                
            image_filename = f"product_{product_id}{file_ext}"
            image_path = os.path.join(UPLOADS_FOLDER, image_filename)
            
            # Download the image
            try:
                if download_image(image_url, image_path, product_name):
                    # Update product in database with new image path
                    db_image_path = f"/uploads/products/{image_filename}"
                    cursor.execute(
                        "UPDATE products SET image_path = ? WHERE product_id = ?",
                        (db_image_path, product_id)
                    )
                    updated_count += 1
                    print(f"Updated product {product_name} with image: {db_image_path}")
            except Exception as e:
                print(f"Error processing {product_name}: {e}")
        
        # Commit changes
        conn.commit()
        print(f"\nSuccessfully updated {updated_count} products with images.")
        
    except Exception as e:
        print(f"Database error: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    fix_product_images() 