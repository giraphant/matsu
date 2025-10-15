#!/usr/bin/env python3
"""
Test script for Monitor System API

Run with: python test_monitor_api.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.models.database import SessionLocal, Monitor, MonitorValue
from app.services.monitor_service import MonitorService
from app.services.formula_engine import FormulaEngine
from app.core.logger import get_logger

logger = get_logger(__name__)


def test_constant_monitor():
    """Test creating and evaluating a constant monitor."""
    logger.info("\n" + "=" * 60)
    logger.info("Test 1: Constant Monitor")
    logger.info("=" * 60)

    db = SessionLocal()
    try:
        service = MonitorService(db)

        # Create constant monitor
        monitor = service.create_monitor(
            name="Test Threshold",
            monitor_type="constant",
            formula="100",
            unit=""
        )

        logger.info(f"✓ Created constant monitor: {monitor.id}")

        # Get with value
        result = service.get_monitor_with_value(monitor.id)
        logger.info(f"✓ Monitor value: {result['value']}")

        assert result['value'] == 100.0, "Value should be 100"
        logger.info("✓ Test passed!")

        return monitor.id

    finally:
        db.close()


def test_computed_monitor(const_monitor_id):
    """Test creating a computed monitor."""
    logger.info("\n" + "=" * 60)
    logger.info("Test 2: Computed Monitor")
    logger.info("=" * 60)

    db = SessionLocal()
    try:
        service = MonitorService(db)

        # Create another constant for testing
        monitor_a = service.create_monitor(
            name="Test Value A",
            monitor_type="constant",
            formula="200",
            unit=""
        )
        logger.info(f"✓ Created constant A: {monitor_a.id}")

        # Create computed monitor: A - threshold
        formula = f"${{monitor:{monitor_a.id}}} - ${{monitor:{const_monitor_id}}}"
        computed = service.create_monitor(
            name="Test Difference",
            monitor_type="computed",
            formula=formula,
            unit=""
        )
        logger.info(f"✓ Created computed monitor: {computed.id}")
        logger.info(f"  Formula: {formula}")

        # Get value
        result = service.get_monitor_with_value(computed.id)
        logger.info(f"✓ Computed value: {result['value']} (expected: 100)")

        assert result['value'] == 100.0, "Value should be 200 - 100 = 100"
        logger.info("✓ Test passed!")

        return computed.id

    finally:
        db.close()


def test_formula_evaluation():
    """Test formula engine directly."""
    logger.info("\n" + "=" * 60)
    logger.info("Test 3: Formula Engine")
    logger.info("=" * 60)

    db = SessionLocal()
    try:
        engine = FormulaEngine(db)

        # Test parsing
        formula = "${monitor:abc} + ${monitor:def} * 2"
        parsed, deps = engine.parse_formula(formula)
        logger.info(f"✓ Parsed formula: {parsed}")
        logger.info(f"✓ Dependencies: {deps}")

        assert "monitor:abc" in deps
        assert "monitor:def" in deps
        logger.info("✓ Test passed!")

    finally:
        db.close()


def test_circular_dependency():
    """Test circular dependency detection."""
    logger.info("\n" + "=" * 60)
    logger.info("Test 4: Circular Dependency Detection")
    logger.info("=" * 60)

    db = SessionLocal()
    try:
        service = MonitorService(db)

        # Create monitor A
        monitor_a = service.create_monitor(
            name="Monitor A",
            monitor_type="constant",
            formula="10",
            unit=""
        )
        logger.info(f"✓ Created monitor A: {monitor_a.id}")

        # Try to create monitor B that references itself (should fail)
        formula = f"${{monitor:temp_b}} + 1"
        engine = FormulaEngine(db)
        has_cycle = engine.check_circular_dependency("temp_b", formula)

        assert has_cycle, "Should detect self-reference"
        logger.info("✓ Detected self-reference correctly")

        logger.info("✓ Test passed!")

    finally:
        db.close()


def cleanup_test_monitors():
    """Clean up test monitors."""
    logger.info("\n" + "=" * 60)
    logger.info("Cleanup: Removing test monitors")
    logger.info("=" * 60)

    db = SessionLocal()
    try:
        # Remove all test monitors
        test_monitors = db.query(Monitor).filter(
            Monitor.name.like("Test%")
        ).all()

        for monitor in test_monitors:
            db.query(MonitorValue).filter(MonitorValue.monitor_id == monitor.id).delete()
            db.delete(monitor)
            logger.info(f"✓ Removed: {monitor.id}")

        db.commit()
        logger.info("✓ Cleanup complete")

    finally:
        db.close()


def main():
    """Run all tests."""
    logger.info("\n" + "=" * 60)
    logger.info("Monitor System API Tests")
    logger.info("=" * 60)

    try:
        # Test 1: Constant monitor
        const_id = test_constant_monitor()

        # Test 2: Computed monitor
        computed_id = test_computed_monitor(const_id)

        # Test 3: Formula engine
        test_formula_evaluation()

        # Test 4: Circular dependency
        test_circular_dependency()

        # Cleanup
        cleanup_test_monitors()

        logger.info("\n" + "=" * 60)
        logger.info("ALL TESTS PASSED! ✓")
        logger.info("=" * 60)

        return 0

    except Exception as e:
        logger.error(f"\n✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
