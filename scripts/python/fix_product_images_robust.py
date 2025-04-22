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

# Configuration
DB_FILE = "./data/inventory.db"
EXCEL_FILE = "PL- ARPER.xlsx"
UPLOADS_FOLDER = "./uploads/products"
IMAGES_FOLDER = "./images"  # Folder containing external images if available

def ensure_folders_exist():
    """Ensure all required folders exist"""
    os.makedirs(UPLOADS_FOLDER, exist_ok=True)
    os.makedirs(IMAGES_FOLDER, exist_ok=True)
    print(f"Ensured folders exist: {UPLOADS_FOLDER}, {IMAGES_FOLDER}")

def find_images_in_directory():
    """Find all image files in the images directory"""
    image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.gif']
    image_files = []
    
    for ext in image_extensions:
        image_files.extend(glob.glob(os.path.join(IMAGES_FOLDER, f"**/{ext}"), recursive=True))
    
    print(f"Found {len(image_files)} image files in {IMAGES_FOLDER}")
    return image_files

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
    
    # Limit text length to avoid overflow
    display_text = text[:20] if len(text) > 20 else text
    draw.text(position, display_text, fill=text_color, font=font)
    
    # Save the image
    filename = f"product_{product_id}.jpg"
    filepath = os.path.join(UPLOADS_FOLDER, filename)
    
    try:
        image.save(filepath)
        print(f"Created placeholder image: {filepath}")
        return f"/uploads/products/{filename}"
    except Exception as e:
        print(f"Error creating placeholder image: {e}")
        return None

def fix_product_images():
    """Create images for all products in the database"""
    ensure_folders_exist()
    
    # Check if database exists
    if not os.path.exists(DB_FILE):
        print(f"Error: Database file '{DB_FILE}' not found!")
        return
    
    # Find all image files in the images directory
    image_files = find_images_in_directory()
    
    # Connect to database
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    try:
        # Get all products
        cursor.execute("""
            SELECT p.product_id, p.name, p.sku, p.image_path, l.name as rack_number
            FROM products p
            LEFT JOIN inventory i ON p.product_id = i.product_id
            LEFT JOIN locations l ON i.location_id = l.location_id AND l.type = 'Rack'
            ORDER BY p.name
        """)
        
        products = cursor.fetchall()
        print(f"Found {len(products)} products in database")
        
        # Track statistics
        updated_count = 0
        
        # Process each product
        for i, product in enumerate(products):
            product_id, name, sku, current_image, rack_number = product if len(product) == 5 else (*product, None)
            
            print(f"\nProcessing product {i+1}/{len(products)}: {name} (SKU: {sku}, Rack: {rack_number})")
            
            # Create a placeholder image for the product
            image_path = create_placeholder_image(name, product_id)
            
            if image_path:
                # Update the database with the image path
                cursor.execute(
                    "UPDATE products SET image_path = ? WHERE product_id = ?",
                    (image_path, product_id)
                )
                updated_count += 1
        
        # Commit changes
        conn.commit()
        print(f"\nUpdated {updated_count} products with placeholder images")
        
    except Exception as e:
        print(f"Error fixing product images: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    fix_product_images()
