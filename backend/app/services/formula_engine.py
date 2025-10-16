"""
Formula Engine
Parses and evaluates formulas with variable substitution.
"""

import re
import json
from typing import Dict, List, Set, Optional, Any, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from app.core.logger import get_logger
from app.models.database import Monitor, MonitorValue, WebhookData, FundingRate, SpotPrice

logger = get_logger(__name__)


class FormulaEngine:
    """
    Engine for parsing and evaluating monitor formulas.

    Supported syntax:
    - Variables: ${monitor:id}, ${webhook:id}, ${funding:exchange-symbol}, ${spot:exchange-symbol}
    - Operators: +, -, *, /, %, ()
    - Functions: abs(), max(), min()

    Examples:
    - "${monitor:btc} - ${monitor:eth}"
    - "abs(${monitor:a} - ${monitor:b}) / 100"
    - "max(${monitor:x}, ${monitor:y})"
    - "${funding:lighter-BTC}" - Lighter BTC funding rate
    - "${spot:binance-BTC}" - Binance BTC spot price
    - "(${spot:binance-BTC} - ${spot:lighter-BTC}) / ${spot:binance-BTC} * 100" - Price spread
    """

    # Variable pattern: ${type:id}
    VAR_PATTERN = re.compile(r'\$\{([^:]+):([^}]+)\}')

    def __init__(self, db: Session):
        self.db = db

    def parse_formula(self, formula: str) -> Tuple[str, Set[str]]:
        """
        Parse formula and extract dependencies.

        Args:
            formula: Formula string

        Returns:
            Tuple of (parsed_expression, dependencies)
            - parsed_expression: Formula with variables replaced by placeholders
            - dependencies: Set of dependency identifiers (e.g., "monitor:btc")
        """
        dependencies = set()

        def replace_var(match):
            var_type = match.group(1)
            var_id = match.group(2)
            dep_id = f"{var_type}:{var_id}"
            dependencies.add(dep_id)
            # Replace with Python variable name
            return f"_v_{var_type}_{var_id.replace('-', '_').replace('.', '_')}"

        parsed = self.VAR_PATTERN.sub(replace_var, formula)
        return parsed, dependencies

    def resolve_dependencies(self, dependencies: Set[str]) -> Dict[str, Optional[float]]:
        """
        Resolve all dependencies to their current values.

        Args:
            dependencies: Set of dependency identifiers

        Returns:
            Dictionary mapping variable names to values
        """
        values = {}

        for dep in dependencies:
            dep_type, dep_id = dep.split(':', 1)
            var_name = f"_v_{dep_type}_{dep_id.replace('-', '_').replace('.', '_')}"

            if dep_type == 'monitor':
                # Get value from another monitor
                monitor = self.db.query(Monitor).filter(Monitor.id == dep_id).first()
                if monitor:
                    # Recursively evaluate the monitor's formula
                    result = self.evaluate(monitor.formula)
                    values[var_name] = result
                else:
                    values[var_name] = None

            elif dep_type == 'webhook':
                # Direct access to webhook data
                latest = self.db.query(WebhookData).filter(
                    WebhookData.monitor_id == dep_id
                ).order_by(WebhookData.timestamp.desc()).first()
                values[var_name] = latest.value if latest else None

            elif dep_type == 'funding':
                # Access funding rate data: ${funding:lighter-BTC}
                parts = dep_id.split('-', 1)
                if len(parts) == 2:
                    exchange, symbol = parts
                    latest = self.db.query(FundingRate).filter(
                        FundingRate.exchange == exchange.lower(),
                        FundingRate.symbol == symbol.upper()
                    ).order_by(FundingRate.timestamp.desc()).first()
                    values[var_name] = latest.annualized_rate if latest else None
                else:
                    logger.warning(f"Invalid funding reference format: {dep_id}")
                    values[var_name] = None

            elif dep_type == 'spot':
                # Access spot price data: ${spot:binance-BTC}
                parts = dep_id.split('-', 1)
                if len(parts) == 2:
                    exchange, symbol = parts
                    latest = self.db.query(SpotPrice).filter(
                        SpotPrice.exchange == exchange.lower(),
                        SpotPrice.symbol == symbol.upper()
                    ).order_by(SpotPrice.timestamp.desc()).first()
                    values[var_name] = latest.price if latest else None
                else:
                    logger.warning(f"Invalid spot reference format: {dep_id}")
                    values[var_name] = None

            else:
                logger.warning(f"Unknown dependency type: {dep_type}")
                values[var_name] = None

        return values

    def evaluate(self, formula: str) -> Optional[float]:
        """
        Evaluate a formula and return the result.

        Args:
            formula: Formula string

        Returns:
            Calculated value or None if evaluation fails
        """
        try:
            # Parse formula
            parsed_expr, dependencies = self.parse_formula(formula)

            # Resolve dependencies
            values = self.resolve_dependencies(dependencies)

            # Check if any value is None
            if any(v is None for v in values.values()):
                logger.debug(f"Cannot evaluate formula, missing values: {formula}")
                return None

            # Build safe evaluation context
            safe_context = {
                'abs': abs,
                'max': max,
                'min': min,
                '__builtins__': {}  # Disable built-in functions for security
            }
            safe_context.update(values)

            # Evaluate expression
            result = eval(parsed_expr, safe_context, {})
            return float(result)

        except Exception as e:
            logger.error(f"Error evaluating formula '{formula}': {e}")
            return None

    def check_circular_dependency(self, monitor_id: str, formula: str) -> bool:
        """
        Check if a formula would create circular dependency.

        Args:
            monitor_id: ID of the monitor being checked
            formula: Formula to check

        Returns:
            True if circular dependency detected, False otherwise
        """
        visited = set()

        def check_deps(current_formula: str, path: Set[str]) -> bool:
            _, dependencies = self.parse_formula(current_formula)

            for dep in dependencies:
                dep_type, dep_id = dep.split(':', 1)

                # Only check monitor dependencies
                if dep_type != 'monitor':
                    continue

                # Circular dependency detected
                if dep_id == monitor_id or dep_id in path:
                    logger.warning(f"Circular dependency detected: {monitor_id} -> {dep_id}")
                    return True

                # Check this monitor's dependencies
                if dep_id not in visited:
                    visited.add(dep_id)
                    monitor = self.db.query(Monitor).filter(Monitor.id == dep_id).first()
                    if monitor:
                        # Check the monitor's formula for circular dependencies
                        if check_deps(monitor.formula, path | {dep_id}):
                            return True

            return False

        return check_deps(formula, {monitor_id})

    def get_dependencies(self, formula: str) -> List[str]:
        """
        Get list of dependency identifiers from a formula.

        Args:
            formula: Formula string

        Returns:
            List of dependency identifiers
        """
        _, dependencies = self.parse_formula(formula)
        return sorted(list(dependencies))

    def compute_monitor_value(self, monitor_id: str) -> Optional[float]:
        """
        Compute and cache value for a monitor.
        Only creates new record if value has changed.

        Args:
            monitor_id: Monitor ID

        Returns:
            Computed value or None
        """
        monitor = self.db.query(Monitor).filter(Monitor.id == monitor_id).first()
        if not monitor or not monitor.enabled:
            return None

        # Evaluate the formula (works for constants, references, and computed formulas)
        value = self.evaluate(monitor.formula)
        dependencies = self.get_dependencies(monitor.formula)

        # Only cache if value is not None
        if value is None:
            return None

        # Get latest cached value
        latest = self.db.query(MonitorValue).filter(
            MonitorValue.monitor_id == monitor_id
        ).order_by(MonitorValue.computed_at.desc()).first()

        # Only create new record if value changed (or no previous value)
        should_update = False
        if latest is None:
            should_update = True
        else:
            # Compare with some tolerance for floating point precision
            value_changed = abs(value - latest.value) > 1e-10
            if value_changed:
                should_update = True

        if should_update:
            cached = MonitorValue(
                monitor_id=monitor_id,
                value=value,
                computed_at=datetime.utcnow(),
                dependencies=json.dumps(dependencies)
            )
            self.db.add(cached)
            self.db.commit()
            logger.debug(f"Updated monitor {monitor_id}: {latest.value if latest else 'None'} -> {value}")
        else:
            logger.debug(f"Monitor {monitor_id} value unchanged: {value}")

        return value

    def recompute_dependent_monitors(self, changed_dependency: str):
        """
        Recompute all monitors that depend on a changed data source.

        Args:
            changed_dependency: Dependency identifier that changed (e.g., "webhook:xxx")
        """
        # Find all enabled monitors
        all_monitors = self.db.query(Monitor).filter(Monitor.enabled == True).all()

        recomputed = []
        for monitor in all_monitors:
            deps = self.get_dependencies(monitor.formula)
            if changed_dependency in deps:
                value = self.compute_monitor_value(monitor.id)
                if value is not None:
                    recomputed.append(monitor.id)
                    logger.debug(f"Recomputed monitor {monitor.id}: {value}")

        return recomputed
