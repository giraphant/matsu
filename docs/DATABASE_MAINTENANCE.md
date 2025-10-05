# Database Maintenance Guide

## Overview

The Matsu monitoring system uses SQLite for data storage. While SQLite is highly efficient, regular maintenance helps ensure optimal performance as data accumulates.

## Performance Considerations

### Current Optimizations

1. **Data Downsampling**: Chart queries automatically limit to 500 data points
2. **Indexed Columns**: `monitor_id` and `timestamp` are indexed for fast queries
3. **Efficient Queries**: Backend uses smart sampling to reduce data transfer

### Potential Issues with Large Datasets

- **Database Size**: Millions of records can make the DB file large (100MB+)
- **Query Performance**: Even with indexes, queries slow down with massive tables
- **Disk Space**: Long-term monitoring can consume significant storage

## Data Cleanup Script

### Usage

The `cleanup_old_data.py` script helps maintain database health by removing old records.

#### View Database Statistics

```bash
cd backend
python cleanup_old_data.py --stats
```

Output example:
```
Database Statistics:
  Total records: 1,234,567
  Oldest record: 2024-01-01 00:00:00
  Newest record: 2025-10-05 12:00:00
  Data age span: 278 days

Records per monitor:
    eth-price: 456,789
    btc-funding: 345,678
    gas-tracker: 234,567
```

#### Dry Run (Preview)

See what would be deleted without actually deleting:

```bash
python cleanup_old_data.py --days 90 --dry-run
```

Output example:
```
Database cleanup analysis:
  Total records: 1,234,567
  Cutoff date: 2025-07-07
  Records older than 90 days: 456,789
  Records to keep: 777,778
  Percentage to delete: 37.01%

[DRY RUN] Would delete 456,789 records
Run without --dry-run flag to actually delete the data
```

#### Actual Cleanup

Delete records older than 90 days (default):

```bash
python cleanup_old_data.py
```

Or specify custom retention period:

```bash
# Keep only last 30 days
python cleanup_old_data.py --days 30

# Keep last 180 days (6 months)
python cleanup_old_data.py --days 180
```

The script will:
1. Show statistics and ask for confirmation
2. Delete old records
3. Run `VACUUM` to reclaim disk space
4. Display final statistics

### Recommended Retention Periods

- **Active Monitoring**: 30-90 days (for frequently updated data)
- **Historical Analysis**: 180-365 days (if you need trend analysis)
- **Archive Everything**: Don't use cleanup (manually export if needed)

## Automated Cleanup (Optional)

### Using Cron

Add to crontab to run monthly cleanup:

```bash
# Edit crontab
crontab -e

# Add this line to cleanup data older than 90 days on 1st of each month at 2 AM
0 2 1 * * cd /home/distill-webhook-visualizer/backend && python cleanup_old_data.py --days 90 > /home/distill-webhook-visualizer/logs/cleanup.log 2>&1
```

### Manual Schedule

Run cleanup script monthly or quarterly based on your data volume.

## Database Backup

Before major cleanups, consider backing up your database:

```bash
# Backup database
cp data/monitoring.db data/monitoring.db.backup-$(date +%Y%m%d)

# Or with compression
tar -czf data/monitoring.db.backup-$(date +%Y%m%d).tar.gz data/monitoring.db
```

## Performance Tips

1. **Monitor Database Size**: Check `data/monitoring.db` file size regularly
2. **Run VACUUM Periodically**: The cleanup script does this, or run manually:
   ```bash
   sqlite3 data/monitoring.db "VACUUM;"
   ```
3. **Check Query Performance**: Use `--stats` to understand data distribution
4. **Adjust Retention**: Balance between history needs and performance

## When to Worry

- Database file > 500MB: Consider more aggressive cleanup
- Queries taking > 2 seconds: Time to cleanup old data
- Disk space < 10GB free: Urgent cleanup needed

## Alternative: Data Export

If you want to keep old data but remove from active DB:

```bash
# Export old data to CSV
sqlite3 data/monitoring.db << EOF
.mode csv
.output archive-$(date +%Y%m%d).csv
SELECT * FROM monitoring_data WHERE timestamp < datetime('now', '-90 days');
.quit
EOF

# Then run cleanup
python cleanup_old_data.py --days 90
```
