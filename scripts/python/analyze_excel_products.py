import pandas as pd
import os

# Configuration - same as import_excel_data.py
EXCEL_FILE = "PL- ARPER.xlsx"

def analyze_excel():
    """Analyze the Excel file to understand product data"""
    print(f"Analyzing Excel file: {EXCEL_FILE}")
    
    # Check if file exists
    if not os.path.exists(EXCEL_FILE):
        print(f"Error: Excel file '{EXCEL_FILE}' not found!")
        return
    
    try:
        # Read Excel file
        df = pd.read_excel(EXCEL_FILE)
        print(f"Total rows in Excel: {len(df)}")
        
        # Print column names for debugging
        print(f"Columns in Excel: {df.columns.tolist()}")
        
        # Identify the product name column
        name_col = next((col for col in df.columns if 'DESCRIPTION' in str(col)), None)
        if not name_col:
            name_col = 'Unnamed: 1'  # Fallback based on observation
        
        # Count non-empty product names
        non_empty_count = df[name_col].notna().sum()
        print(f"Non-empty product names: {non_empty_count}")
        
        # Print first 5 rows with product names
        print("\nFirst 5 products:")
        products = df[df[name_col].notna()][[name_col]].head(5)
        for _, row in products.iterrows():
            print(f"  - {row[name_col]}")
        
        # Print last 5 rows with product names
        print("\nLast 5 products:")
        products = df[df[name_col].notna()][[name_col]].tail(5)
        for _, row in products.iterrows():
            print(f"  - {row[name_col]}")
        
        # Check for duplicate product names
        duplicates = df[df[name_col].notna()][name_col].duplicated()
        duplicate_count = duplicates.sum()
        print(f"\nDuplicate product names: {duplicate_count}")
        
        if duplicate_count > 0:
            print("\nDuplicate products:")
            duplicate_products = df[df[name_col].notna()][df[name_col].duplicated(keep=False)].sort_values(by=name_col)[[name_col]]
            for _, row in duplicate_products.iterrows():
                print(f"  - {row[name_col]}")
        
        # Check for rows that might be headers or separators
        potential_headers = df[(df[name_col].notna()) & (df[name_col].str.isupper().fillna(False))]
        print(f"\nPotential headers/separators: {len(potential_headers)}")
        if len(potential_headers) > 0:
            print("\nPotential headers:")
            for _, row in potential_headers.head(10).iterrows():
                print(f"  - {row[name_col]}")
        
    except Exception as e:
        print(f"Error analyzing Excel file: {e}")

if __name__ == "__main__":
    analyze_excel()
