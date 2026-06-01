import sqlite3
import os
import json

db_files = [
    r'E:\activedb\BPP_APP_active_db.sqlite',
    r'E:\activedb\BharatPP_active_db.sqlite',
    r'E:\activedb\Data_active_db.sqlite'
]

for p in db_files:
    print(f"\n==================================================")
    print(f"ANALYZING: {p}")
    print(f"==================================================")
    if os.path.exists(p):
        try:
            conn = sqlite3.connect(p)
            cursor = conn.cursor()
            
            # Print table schema
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            print("Tables:", tables)
            
            if 'store' in tables:
                cursor.execute("SELECT count(*) FROM store")
                count = cursor.fetchone()[0]
                print(f"Number of rows in 'store': {count}")
                
                # Fetch first 20 keys
                cursor.execute("SELECT key, length(value) FROM store LIMIT 50")
                rows = cursor.fetchall()
                print("Keys stored:")
                for key, val_len in rows:
                    cursor.execute("SELECT value FROM store WHERE key = ?", (key,))
                    val = cursor.fetchone()[0]
                    # Print preview
                    val_str = str(val)[:150]
                    print(f"  - {key} (length: {val_len}): {val_str}")
            conn.close()
        except Exception as e:
            print("ERROR:", str(e))
    else:
        print("FILE DOES NOT EXIST")
print("\n==================================================")
print("ANALYSIS COMPLETE")
