"""
Migration script to add dex_accounts table.
Run this script to add multi-account support for DEX monitoring.
"""

import sys
import os
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models.database import engine, Base, DexAccount
from sqlalchemy import inspect, text

def check_table_exists(table_name: str) -> bool:
    """Check if a table exists in the database."""
    inspector = inspect(engine)
    return table_name in inspector.get_table_names()

def run_migration():
    """Run the migration to add dex_accounts table."""

    print("🔍 Checking if dex_accounts table already exists...")

    if check_table_exists('dex_accounts'):
        print("✅ Table 'dex_accounts' already exists. Migration not needed.")
        return

    print("📝 Creating dex_accounts table...")

    # Create the table
    DexAccount.__table__.create(engine)

    print("✅ Successfully created dex_accounts table!")

    # Verify table was created
    if check_table_exists('dex_accounts'):
        print("✅ Verified: dex_accounts table exists in database")

        # Show table schema
        inspector = inspect(engine)
        columns = inspector.get_columns('dex_accounts')
        print("\n📋 Table schema:")
        for col in columns:
            print(f"   - {col['name']}: {col['type']}")
    else:
        print("❌ Error: Table creation verification failed")
        sys.exit(1)

if __name__ == "__main__":
    try:
        run_migration()
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)
