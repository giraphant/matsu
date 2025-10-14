#!/usr/bin/env python3
"""
Test script for Repository and Service layers.
"""

import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

from app.models.database import get_db_session, create_tables
from app.repositories.monitoring import MonitoringRepository
from app.repositories.alert import AlertRepository, AlertStateRepository
from app.repositories.pushover import PushoverRepository
from app.services.monitoring import MonitoringService
from app.services.pushover import PushoverService
from app.schemas.monitoring import DistillWebhookPayload

def test_repository_layer():
    """Test Repository layer."""
    print("\n=== Testing Repository Layer ===")

    db = get_db_session()
    try:
        # Test MonitoringRepository
        print("\n1. Testing MonitoringRepository...")
        monitoring_repo = MonitoringRepository(db)

        # Get all monitors summary
        summaries = monitoring_repo.get_all_monitors_summary()
        print(f"   ✓ Found {len(summaries)} monitors")

        if summaries:
            monitor_id = summaries[0]['monitor_id']
            print(f"   ✓ Testing with monitor: {monitor_id}")

            # Get summary statistics
            summary = monitoring_repo.get_summary_statistics(monitor_id)
            print(f"   ✓ Summary: {summary['total_records']} records")

            # Get latest record
            latest = monitoring_repo.get_latest(monitor_id)
            if latest:
                print(f"   ✓ Latest record: {latest.value} at {latest.timestamp}")

        # Test AlertRepository
        print("\n2. Testing AlertRepository...")
        alert_repo = AlertRepository(db)
        alerts = alert_repo.get_all()
        print(f"   ✓ Found {len(alerts)} alert configurations")

        # Test PushoverRepository
        print("\n3. Testing PushoverRepository...")
        pushover_repo = PushoverRepository(db)
        config = pushover_repo.get_config()
        if config:
            print(f"   ✓ Pushover is configured")
        else:
            print(f"   ✓ Pushover not configured")

        print("\n✅ Repository layer tests passed!")
        return True

    except Exception as e:
        print(f"\n❌ Repository layer test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def test_service_layer():
    """Test Service layer."""
    print("\n=== Testing Service Layer ===")

    db = get_db_session()
    try:
        # Test MonitoringService
        print("\n1. Testing MonitoringService...")
        monitoring_service = MonitoringService(db)

        # Get all monitors summary (with business logic)
        summaries = monitoring_service.get_all_monitors_summary()
        print(f"   ✓ Found {len(summaries)} monitors with enriched data")

        if summaries:
            for summary in summaries[:3]:  # Show first 3
                print(f"   - {summary['monitor_name']}: {summary['status']}")

        # Test PushoverService
        print("\n2. Testing PushoverService...")
        pushover_service = PushoverService(db)
        is_configured = pushover_service.is_configured()
        print(f"   ✓ Pushover configured: {is_configured}")

        print("\n✅ Service layer tests passed!")
        return True

    except Exception as e:
        print(f"\n❌ Service layer test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def test_webhook_processing():
    """Test webhook processing through service."""
    print("\n=== Testing Webhook Processing ===")

    db = get_db_session()
    try:
        print("\n1. Creating test webhook payload...")

        # Create a test payload
        payload = DistillWebhookPayload(
            id="test-monitor-arch",
            name="Architecture Test Monitor",
            uri="https://example.com/test",
            text="123.45",
            monitor_id="test-monitor-arch",
            monitor_name="Architecture Test Monitor",
            url="https://example.com/test",
            text_value="123.45",
            status="monitored",
            timestamp=None,
            is_change=False,
            change_type=None,
            previous_value=None,
            value=None
        )

        print(f"   ✓ Payload created: {payload.id}")

        # Process webhook through service
        print("\n2. Processing webhook through MonitoringService...")
        monitoring_service = MonitoringService(db)
        result = monitoring_service.process_webhook(payload)

        print(f"   ✓ Webhook processed successfully!")
        print(f"   - Monitor ID: {result.monitor_id}")
        print(f"   - Value: {result.value}")
        print(f"   - Timestamp: {result.timestamp}")

        print("\n✅ Webhook processing test passed!")
        return True

    except Exception as e:
        print(f"\n❌ Webhook processing test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("Testing Repository and Service Layer Architecture")
    print("=" * 60)

    # Ensure database tables exist
    create_tables()

    # Run tests
    results = []
    results.append(("Repository Layer", test_repository_layer()))
    results.append(("Service Layer", test_service_layer()))
    results.append(("Webhook Processing", test_webhook_processing()))

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    for name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{name}: {status}")

    all_passed = all(result[1] for result in results)

    if all_passed:
        print("\n🎉 All tests passed! Architecture refactoring successful!")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Please review the errors above.")
        sys.exit(1)
