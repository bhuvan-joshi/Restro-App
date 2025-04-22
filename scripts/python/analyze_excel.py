import pandas as pd
import json
import os

def analyze_excel(file_path):
    # Read all sheets from the Excel file
    print(f"Reading Excel file: {file_path}")
    try:
        # Try with default engine
        excel_data = pd.read_excel(file_path, sheet_name=None, header=None)
    except Exception as e:
        print(f"Error with default engine: {e}")
        try:
            # Try with openpyxl engine explicitly
            excel_data = pd.read_excel(file_path, sheet_name=None, engine='openpyxl', header=None)
        except Exception as e:
            print(f"Error with openpyxl engine: {e}")
            return
    
    # Print basic info about the sheets
    print(f"Successfully read the Excel file. Found {len(excel_data)} sheets.")
    
    for sheet_name, df in excel_data.items():
        print(f"\n{'='*50}")
        print(f"SHEET: {sheet_name}")
        print(f"{'='*50}")
        print(f"Shape: {df.shape} (rows, columns)")
        
        # Try to identify header rows
        print("\nPotential header rows (first 5 rows):")
        for i in range(min(5, len(df))):
            print(f"Row {i}: {df.iloc[i].tolist()}")
        
        # Print data sample (skipping potential headers)
        print("\nData sample (rows 5-10):")
        if len(df) > 5:
            print(df.iloc[5:10].to_string())
        
        # Analyze data types
        print("\nColumn data types analysis:")
        for col in df.columns:
            # Skip first few rows which might be headers
            data_sample = df.iloc[5:, col].dropna()
            if len(data_sample) > 0:
                # Check if numeric
                numeric_count = sum(pd.to_numeric(data_sample, errors='coerce').notna())
                numeric_pct = numeric_count / len(data_sample) if len(data_sample) > 0 else 0
                
                # Check if date
                date_count = sum(pd.to_datetime(data_sample, errors='coerce').notna())
                date_pct = date_count / len(data_sample) if len(data_sample) > 0 else 0
                
                print(f"Column {col}:")
                print(f"  - Sample values: {data_sample.head(3).tolist()}")
                print(f"  - Likely numeric: {numeric_pct:.1%}")
                print(f"  - Likely date: {date_pct:.1%}")
                
                # Suggest data type
                if numeric_pct > 0.7:
                    suggested_type = "NUMERIC"
                elif date_pct > 0.7:
                    suggested_type = "DATE"
                else:
                    suggested_type = "TEXT"
                print(f"  - Suggested type: {suggested_type}")
        
        # Check for empty columns
        empty_cols = [col for col in df.columns if df[col].isna().sum() == len(df)]
        if empty_cols:
            print("\nEmpty columns:")
            for col in empty_cols:
                print(f"  - Column {col}")

if __name__ == "__main__":
    file_path = "PL- ARPER.xlsx"
    if os.path.exists(file_path):
        analyze_excel(file_path)
    else:
        print(f"File not found: {file_path}") 