"""
Monitor System API endpoints.
New unified monitor management.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.models.database import get_db, AlertRule
from app.services.monitor_service import MonitorService
from app.services.alert_engine import AlertEngine
from app.core.logger import get_logger
import json

router = APIRouter()
logger = get_logger(__name__)


# ============================================================================
# Request/Response Models
# ============================================================================

class MonitorCreate(BaseModel):
    """Request model for creating a monitor."""
    name: str
    formula: str
    unit: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    decimal_places: int = 2
    category: Optional[str] = None


class MonitorUpdate(BaseModel):
    """Request model for updating a monitor."""
    name: Optional[str] = None
    formula: Optional[str] = None
    unit: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    decimal_places: Optional[int] = None
    category: Optional[str] = None
    enabled: Optional[bool] = None


class MonitorResponse(BaseModel):
    """Response model for monitor."""
    id: str
    name: str
    formula: str
    unit: Optional[str]
    description: Optional[str]
    color: Optional[str]
    decimal_places: int
    category: Optional[str]
    enabled: bool
    value: Optional[float]
    computed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class AlertRuleCreate(BaseModel):
    """Request model for creating alert rule."""
    name: str
    condition: str
    level: str = 'medium'
    cooldown_seconds: int = 300
    actions: List[str] = ['pushover']


class AlertRuleUpdate(BaseModel):
    """Request model for updating alert rule."""
    name: Optional[str] = None
    condition: Optional[str] = None
    level: Optional[str] = None
    enabled: Optional[bool] = None
    cooldown_seconds: Optional[int] = None
    actions: Optional[List[str]] = None


class AlertRuleResponse(BaseModel):
    """Response model for alert rule."""
    id: str
    name: str
    condition: str
    level: str
    enabled: bool
    cooldown_seconds: int
    actions: List[str]
    created_at: datetime
    updated_at: datetime


# ============================================================================
# Monitor Endpoints
# ============================================================================

@router.post("/monitors", response_model=MonitorResponse)
async def create_monitor(monitor: MonitorCreate, db: Session = Depends(get_db)):
    """Create a new monitor."""
    try:
        service = MonitorService(db)
        created = service.create_monitor(
            name=monitor.name,
            formula=monitor.formula,
            unit=monitor.unit,
            description=monitor.description,
            color=monitor.color,
            decimal_places=monitor.decimal_places,
            category=monitor.category
        )

        if not created:
            raise HTTPException(status_code=400, detail="Failed to create monitor")

        # Get with value
        monitor_data = service.get_monitor_with_value(created.id)
        return MonitorResponse(**monitor_data)

    except Exception as e:
        logger.error(f"Error creating monitor: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/monitors", response_model=List[MonitorResponse])
async def get_all_monitors(db: Session = Depends(get_db)):
    """Get all monitors with their current values."""
    try:
        service = MonitorService(db)
        monitors = service.get_all_monitors_with_values()
        return [MonitorResponse(**m) for m in monitors]

    except Exception as e:
        logger.error(f"Error retrieving monitors: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/monitors/{monitor_id}", response_model=MonitorResponse)
async def get_monitor(monitor_id: str, db: Session = Depends(get_db)):
    """Get a specific monitor."""
    try:
        service = MonitorService(db)
        monitor_data = service.get_monitor_with_value(monitor_id)

        if not monitor_data:
            raise HTTPException(status_code=404, detail="Monitor not found")

        return MonitorResponse(**monitor_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving monitor: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/monitors/{monitor_id}", response_model=MonitorResponse)
async def update_monitor(
    monitor_id: str,
    updates: MonitorUpdate,
    db: Session = Depends(get_db)
):
    """Update a monitor."""
    try:
        service = MonitorService(db)

        # Build updates dict
        update_dict = updates.dict(exclude_unset=True)

        updated = service.update_monitor(monitor_id, update_dict)

        if not updated:
            raise HTTPException(status_code=404, detail="Monitor not found or update failed")

        # Get with value
        monitor_data = service.get_monitor_with_value(updated.id)
        return MonitorResponse(**monitor_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating monitor: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/monitors/{monitor_id}")
async def delete_monitor(monitor_id: str, db: Session = Depends(get_db)):
    """Delete a monitor."""
    try:
        service = MonitorService(db)
        success = service.delete_monitor(monitor_id)

        if not success:
            raise HTTPException(status_code=404, detail="Monitor not found")

        return {"message": "Monitor deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting monitor: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/monitors/recompute")
async def recompute_all_monitors(db: Session = Depends(get_db)):
    """Manually trigger recomputation of all monitors."""
    try:
        service = MonitorService(db)
        recomputed = service.recompute_all()
        return {
            "message": f"Recomputed {len(recomputed)} monitors",
            "monitors": recomputed
        }

    except Exception as e:
        logger.error(f"Error recomputing monitors: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/monitors/{monitor_id}/history")
async def get_monitor_history(
    monitor_id: str,
    limit: int = 50,
    hours: int = 24,
    db: Session = Depends(get_db)
):
    """
    Get historical values for a monitor with uniform sampling.

    Args:
        monitor_id: Monitor ID
        limit: Maximum number of data points to return (default: 50)
        hours: Time range in hours (default: 24)

    Returns:
        List of {timestamp, value} uniformly sampled over the time range
    """
    try:
        from app.models.database import MonitorValue
        from datetime import timedelta

        # Calculate time range
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=hours)

        # Get all values in time range
        values = db.query(MonitorValue).filter(
            MonitorValue.monitor_id == monitor_id,
            MonitorValue.computed_at >= start_time,
            MonitorValue.computed_at <= end_time
        ).order_by(MonitorValue.computed_at.asc()).all()

        # If we have fewer values than limit, return all
        if len(values) <= limit:
            return [
                {
                    "timestamp": int(v.computed_at.timestamp() * 1000),  # milliseconds
                    "value": v.value
                }
                for v in values
            ]

        # Uniform sampling: pick evenly distributed points
        sampled = []
        step = len(values) / limit
        for i in range(limit):
            index = int(i * step)
            v = values[index]
            sampled.append({
                "timestamp": int(v.computed_at.timestamp() * 1000),
                "value": v.value
            })

        return sampled

    except Exception as e:
        logger.error(f"Error retrieving monitor history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Alert Rule Endpoints
# ============================================================================

@router.post("/alert-rules", response_model=AlertRuleResponse)
async def create_alert_rule(rule: AlertRuleCreate, db: Session = Depends(get_db)):
    """Create a new alert rule."""
    try:
        import uuid

        alert_rule = AlertRule(
            id=f"alert_{uuid.uuid4().hex[:12]}",
            name=rule.name,
            condition=rule.condition,
            level=rule.level,
            cooldown_seconds=rule.cooldown_seconds,
            actions=json.dumps(rule.actions),
            enabled=True
        )

        db.add(alert_rule)
        db.commit()
        db.refresh(alert_rule)

        return AlertRuleResponse(
            id=alert_rule.id,
            name=alert_rule.name,
            condition=alert_rule.condition,
            level=alert_rule.level,
            enabled=alert_rule.enabled,
            cooldown_seconds=alert_rule.cooldown_seconds,
            actions=json.loads(alert_rule.actions),
            created_at=alert_rule.created_at,
            updated_at=alert_rule.updated_at
        )

    except Exception as e:
        logger.error(f"Error creating alert rule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alert-rules", response_model=List[AlertRuleResponse])
async def get_all_alert_rules(db: Session = Depends(get_db)):
    """Get all alert rules."""
    try:
        rules = db.query(AlertRule).all()

        return [
            AlertRuleResponse(
                id=rule.id,
                name=rule.name,
                condition=rule.condition,
                level=rule.level,
                enabled=rule.enabled,
                cooldown_seconds=rule.cooldown_seconds,
                actions=json.loads(rule.actions) if rule.actions else [],
                created_at=rule.created_at,
                updated_at=rule.updated_at
            )
            for rule in rules
        ]

    except Exception as e:
        logger.error(f"Error retrieving alert rules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/alert-rules/{rule_id}", response_model=AlertRuleResponse)
async def update_alert_rule(
    rule_id: str,
    updates: AlertRuleUpdate,
    db: Session = Depends(get_db)
):
    """Update an alert rule."""
    try:
        rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()

        if not rule:
            raise HTTPException(status_code=404, detail="Alert rule not found")

        # Apply updates
        if updates.name is not None:
            rule.name = updates.name
        if updates.condition is not None:
            rule.condition = updates.condition
        if updates.level is not None:
            rule.level = updates.level
        if updates.enabled is not None:
            rule.enabled = updates.enabled
        if updates.cooldown_seconds is not None:
            rule.cooldown_seconds = updates.cooldown_seconds
        if updates.actions is not None:
            rule.actions = json.dumps(updates.actions)

        rule.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(rule)

        return AlertRuleResponse(
            id=rule.id,
            name=rule.name,
            condition=rule.condition,
            level=rule.level,
            enabled=rule.enabled,
            cooldown_seconds=rule.cooldown_seconds,
            actions=json.loads(rule.actions),
            created_at=rule.created_at,
            updated_at=rule.updated_at
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating alert rule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/alert-rules/{rule_id}")
async def delete_alert_rule(rule_id: str, db: Session = Depends(get_db)):
    """Delete an alert rule."""
    try:
        rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()

        if not rule:
            raise HTTPException(status_code=404, detail="Alert rule not found")

        db.delete(rule)
        db.commit()

        return {"message": "Alert rule deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting alert rule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alert-rules/by-monitor/{monitor_id}", response_model=List[AlertRuleResponse])
async def get_alert_rules_by_monitor(monitor_id: str, db: Session = Depends(get_db)):
    """Get all alert rules that reference a specific monitor."""
    try:
        rules = db.query(AlertRule).filter(
            AlertRule.condition.like(f'%${{monitor:{monitor_id}}}%')
        ).all()

        return [
            AlertRuleResponse(
                id=rule.id,
                name=rule.name,
                condition=rule.condition,
                level=rule.level,
                enabled=rule.enabled,
                cooldown_seconds=rule.cooldown_seconds,
                actions=json.loads(rule.actions) if rule.actions else [],
                created_at=rule.created_at,
                updated_at=rule.updated_at
            )
            for rule in rules
        ]

    except Exception as e:
        logger.error(f"Error retrieving alert rules for monitor {monitor_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alert-rules/check")
async def check_alerts(db: Session = Depends(get_db)):
    """Manually trigger alert checking."""
    try:
        engine = AlertEngine(db)
        triggered = engine.check_all_alerts()

        return {
            "message": f"Checked all alerts, {len(triggered)} triggered",
            "triggered_alerts": triggered
        }

    except Exception as e:
        logger.error(f"Error checking alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))
