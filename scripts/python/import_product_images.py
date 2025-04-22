import os
import sqlite3
import requests
import random
import shutil
import glob
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO

# Configuration
DB_FILE = "./arper_inventory.db"  # Main database file
UPLOADS_FOLDER = "uploads/products"
EXCEL_IMAGES_FOLDER = "PL- ARPER_files"  # Folder containing the Excel images
IMAGE_SOURCES = [
    # More reliable furniture image sources
    "https://images.pexels.com/photos/1350789/pexels-photo-1350789.jpeg",  # Office chair
    "https://images.pexels.com/photos/5695904/pexels-photo-5695904.jpeg",  # Chair
    "https://images.pexels.com/photos/2082090/pexels-photo-2082090.jpeg",  # Chair
    "https://images.pexels.com/photos/1957478/pexels-photo-1957478.jpeg",  # Desk
    "https://images.pexels.com/photos/3097112/pexels-photo-3097112.jpeg",  # Table
    "https://images.pexels.com/photos/2762247/pexels-photo-2762247.jpeg",  # Table
    "https://images.pexels.com/photos/3757055/pexels-photo-3757055.jpeg",  # Sofa
    "https://images.pexels.com/photos/1866149/pexels-photo-1866149.jpeg",  # Sofa
    "https://images.pexels.com/photos/276528/pexels-photo-276528.jpeg",  # Sofa
    "https://images.pexels.com/photos/1148955/pexels-photo-1148955.jpeg",  # Stool
    "https://images.pexels.com/photos/3932929/pexels-photo-3932929.jpeg",  # Table
    "https://images.pexels.com/photos/6489007/pexels-photo-6489007.jpeg",  # Chair
    "https://images.pexels.com/photos/1350789/pexels-photo-1350789.jpeg",  # Chair
    "https://images.pexels.com/photos/1668860/pexels-photo-1668860.jpeg",  # Chair
    "https://images.pexels.com/photos/2079249/pexels-photo-2079249.jpeg",  # Sofa
    "https://images.pexels.com/photos/2986011/pexels-photo-2986011.jpeg",  # Sofa
    "https://images.pexels.com/photos/4846437/pexels-photo-4846437.jpeg",  # Desk
    "https://images.pexels.com/photos/106839/pexels-photo-106839.jpeg",  # Office chair
    "https://images.pexels.com/photos/5705090/pexels-photo-5705090.jpeg",  # Office chair
    "https://images.pexels.com/photos/5705074/pexels-photo-5705074.jpeg",  # Office chair
    "https://images.pexels.com/photos/210265/pexels-photo-210265.jpeg",  # Sofa
    "https://images.pexels.com/photos/4099354/pexels-photo-4099354.jpeg", # Stool
    "https://images.pexels.com/photos/5706294/pexels-photo-5706294.jpeg", # Stool
    "https://images.pexels.com/photos/5706265/pexels-photo-5706265.jpeg", # Chair
    "https://images.pexels.com/photos/9813639/pexels-photo-9813639.jpeg", # Chair
    "https://images.pexels.com/photos/5706211/pexels-photo-5706211.jpeg", # Chair
    "https://images.pexels.com/photos/5705937/pexels-photo-5705937.jpeg", # Chair
    "https://images.pexels.com/photos/1813502/pexels-photo-1813502.jpeg", # Wooden table
    "https://images.pexels.com/photos/9876607/pexels-photo-9876607.jpeg"  # Desk
]

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
    
    # Draw product name (wrapped to fit)
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
    print(f"Created color image for {product_name}: {save_path}")
    return True

def find_existing_image(image_no):
    """Find an image file using more robust search methods"""
    image_paths = []
    
    # Check in the EXCEL_IMAGES_FOLDER first
    if os.path.exists(EXCEL_IMAGES_FOLDER):
        # Try direct match
        direct_matches = glob.glob(os.path.join(EXCEL_IMAGES_FOLDER, f"*{image_no}*.*"))
        if direct_matches:
            image_paths.extend(direct_matches)
        
        # Try case-insensitive match
        for file in os.listdir(EXCEL_IMAGES_FOLDER):
            if image_no.lower() in file.lower() and os.path.join(EXCEL_IMAGES_FOLDER, file) not in image_paths:
                image_paths.append(os.path.join(EXCEL_IMAGES_FOLDER, file))
    
    # Check in the current directory
    direct_matches = glob.glob(f"*{image_no}*.*")
    if direct_matches:
        image_paths.extend(direct_matches)
    
    # Look for any supported image extensions
    for ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']:
        # Check with exact name
        exact_path = f"{image_no}{ext}"
        if os.path.exists(exact_path) and exact_path not in image_paths:
            image_paths.append(exact_path)
        
        # Check with case-insensitive match in current directory
        for file in os.listdir('.'):
            if file.lower().endswith(ext) and image_no.lower() in file.lower() and file not in image_paths:
                image_paths.append(file)
    
    # If we found images, return the first one
    if image_paths:
        print(f"Found image for {image_no}: {image_paths[0]}")
        return image_paths[0]
    
    return None

def download_image(url, save_path, product_name):
    """Download an image from URL and save it to the specified path"""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        img = Image.open(BytesIO(response.content))
        img.save(save_path)
        print(f"Downloaded image to {save_path}")
        return True
    except Exception as e:
        print(f"Error downloading image {url}: {e}")
        # Create a colored placeholder instead
        return create_color_image(product_name, save_path)

def assign_product_images():
    """Assign images to products in the database"""
    ensure_uploads_folder()
    
    print(f"Looking for database at: {os.path.abspath(DB_FILE)}")
    if not os.path.exists(DB_FILE):
        print(f"Error: Database file '{DB_FILE}' not found!")
        return
    
    # Connect to SQLite database
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Check if the products table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='products'")
    if not cursor.fetchone():
        print("Error: Products table not found in database!")
        conn.close()
        return
    
    # Get all products
    cursor.execute("""
        SELECT product_id, name, image_path 
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
        current_image = product[2] if product[2] else None
        
        # Check if image needs updating
        if current_image:
            # Check if current image is a relative path without /uploads/ prefix
            if current_image and not current_image.startswith('/uploads/') and '/' not in current_image:
                # This is likely just an image name like 'IMG_8454'
                image_path = f"/uploads/products/{current_image}.jpg"
                print(f"Converting image path for {product_name}: {current_image} -> {image_path}")
                
                # Try to find the physical image for this name and copy it to uploads folder
                image_file = None
                
                # Look in the Excel images folder first
                if os.path.exists(EXCEL_IMAGES_FOLDER):
                    for file in os.listdir(EXCEL_IMAGES_FOLDER):
                        if current_image in file:
                            image_file = os.path.join(EXCEL_IMAGES_FOLDER, file)
                            break
                
                # Look in current directory
                if not image_file:
                    for file in os.listdir('.'):
                        if os.path.isfile(file) and current_image in file:
                            image_file = file
                            break
                
                # If image found, copy it to uploads folder
                if image_file:
                    # Ensure uploads folder exists
                    ensure_uploads_folder()
                    
                    # Create target filename
                    file_ext = os.path.splitext(image_file)[1] or '.jpg'
                    target_filename = f"{current_image}{file_ext}"
                    target_path = os.path.join(UPLOADS_FOLDER, target_filename)
                    
                    try:
                        # Copy the file
                        shutil.copy2(image_file, target_path)
                        print(f"Copied image: {image_file} -> {target_path}")
                        
                        # Update database with proper path
                        image_path = f"/uploads/products/{target_filename}"
                        cursor.execute(
                            "UPDATE products SET image_path = ? WHERE product_id = ?",
                            (image_path, product_id)
                        )
                        updated_count += 1
                    except Exception as e:
                        print(f"Error copying image {image_file}: {e}")
                        continue
                else:
                    print(f"Warning: Could not find physical image file for {current_image}")
            else:
                # Image already has a proper path - check if it points to a real file
                if current_image and current_image.startswith('/uploads/'):
                    physical_path = current_image[1:]  # Remove leading slash
                    if not os.path.exists(physical_path):
                        print(f"Warning: Image {current_image} referenced in database does not exist at {physical_path}")
                        # Could add logic here to create/download the image
        else:
            # Product has no image - assign a new one based on product name
            # Categorize product for better image matching
            category = 'other'
            if any(term in product_name.lower() for term in ['chair', 'stool']):
                category = 'chair'
            elif any(term in product_name.lower() for term in ['table', 'desk']):
                category = 'table'
            elif any(term in product_name.lower() for term in ['sofa', 'couch', 'lounge']):
                category = 'sofa'
            
            # Define image sources by category 
            image_sources = {
                "chair": [url for url in IMAGE_SOURCES if any(term in url.lower() for term in ["chair", "stool"])],
                "table": [url for url in IMAGE_SOURCES if any(term in url.lower() for term in ["table", "desk"])],
                "sofa": [url for url in IMAGE_SOURCES if any(term in url.lower() for term in ["sofa", "couch"])],
                "other": IMAGE_SOURCES
            }
            
            # Choose an image from appropriate sources
            category_images = image_sources.get(category, IMAGE_SOURCES)
            if category_images:
                image_url = random.choice(category_images)
                
                # Generate filename
                file_ext = os.path.splitext(image_url.split('/')[-1])[1]
                if not file_ext:
                    file_ext = ".jpg"  # Default to jpg if no extension found
                    
                image_filename = f"product_{product_id}{file_ext}"
                image_path_full = os.path.join(UPLOADS_FOLDER, image_filename)
                
                # Download the image or create placeholder
                if download_image(image_url, image_path_full, product_name):
                    image_path = f"/uploads/products/{image_filename}"
                    cursor.execute(
                        "UPDATE products SET image_path = ? WHERE product_id = ?",
                        (image_path, product_id)
                    )
                    updated_count += 1
                    print(f"Downloaded image for {product_name}: {image_path}")
    
    # Commit changes and close connection
    conn.commit()
    conn.close()
    
    print(f"\nSuccessfully updated {updated_count} products with images.")

if __name__ == "__main__":
    assign_product_images() 