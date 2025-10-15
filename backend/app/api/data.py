"""
Data API endpoints for retrieving and managing monitoring data.
Uses Repository and Service layers for data access and business logic.
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
import json

from app.models.database import MonitoringData, get_db_session
from app.schemas.monitoring import MonitoringDataResponse, MonitorSummary
from app.repositories.monitoring import MonitoringRepository
from app.services.monitoring import MonitoringService
from app.core.logger import get_logger
from pydantic import BaseModel

logger = get_logger(__name__)
router = APIRouter()


@router.get("/data", response_model=List[MonitoringDataResponse])
async def get_monitoring_data(
    monitor_id: Optional[str] = Query(None, description="Filter by monitor ID"),
    limit: int = Query(100, description="Number of records to return", ge=1, le=1000),
    offset: int = Query(0, description="Number of records to skip", ge=0),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    order_by: str = Query("timestamp", description="Order by field"),
    order_dir: str = Query("desc", description="Order direction (asc/desc)")
) -> List[MonitoringDataResponse]:
    """
    Retrieve monitoring data with optional filtering and pagination.
    Uses MonitoringRepository for data access.
    """
    db = get_db_session()

    try:
        repo = MonitoringRepository(db)

        # Parse date filters
        start_dt = None
        end_dt = None

        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")

        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")

        # Use repository method based on filters
        if start_dt and end_dt:
            records = repo.get_by_date_range(
                start_date=start_dt,
                end_date=end_dt,
                monitor_id=monitor_id,
                limit=limit
            )
        elif monitor_id:
            records = repo.get_by_monitor_id(
                monitor_id=monitor_id,
                limit=limit,
                offset=offset,
                order_by=order_by,
                order_dir=order_dir
            )
        else:
            # Get all records (no specific filters)
            # Note: Could add a get_all method to repository if needed
            records = repo.get_by_monitor_id(
                monitor_id=monitor_id or "",
                limit=limit,
                offset=offset,
                order_by=order_by,
                order_dir=order_dir
            ) if monitor_id else []

        return [MonitoringDataResponse.from_orm(record) for record in records]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving monitoring data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        db.close()


@router.get("/webhook-monitors", response_model=List[MonitorSummary])
async def get_monitor_summaries() -> List[MonitorSummary]:
    """
    Get summary statistics for all webhook monitors (legacy endpoint).
    Uses MonitoringService for business logic.
    """
    db = get_db_session()

    try:
        # Use service to get enriched summaries
        service = MonitoringService(db)
        summaries = service.get_all_monitors_summary()

        # Convert to Pydantic models
        result = []
        for summary in summaries:
            result.append(MonitorSummary(**summary))

        return result

    except Exception as e:
        logger.error(f"Error retrieving monitor summaries: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        db.close()


@router.get("/chart-data/{monitor_id}")
async def get_chart_data(
    monitor_id: str,
    days: int = Query(7, description="Number of days to include", ge=1, le=365)
) -> Dict[str, Any]:
    """
    Get chart data for a specific monitor in a format suitable for plotting.
    Uses MonitoringRepository for data access.
    """
    db = get_db_session()

    try:
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # Use repository to get data
        repo = MonitoringRepository(db)
        records = repo.get_by_date_range(
            start_date=start_date,
            end_date=end_date,
            monitor_id=monitor_id,
            limit=10000  # Large limit for chart data
        )

        if not records:
            return {
                "monitor_id": monitor_id,
                "data": [],
                "summary": {
                    "total_points": 0,
                    "date_range": f"{start_date.date()} to {end_date.date()}"
                }
            }

        # Downsample data to max 500 points for performance
        MAX_POINTS = 500
        if len(records) > MAX_POINTS:
            # Calculate sampling interval
            interval = len(records) // MAX_POINTS
            sampled_records = []
            for i in range(0, len(records), interval):
                sampled_records.append(records[i])
            # Always include the last point
            if records[-1] not in sampled_records:
                sampled_records.append(records[-1])
            records_to_chart = sampled_records
        else:
            records_to_chart = records

        # Format data for charting
        chart_data = []
        for record in records_to_chart:
            chart_data.append({
                "timestamp": record.timestamp.isoformat(),
                "value": record.value,
                "status": record.status,
                "is_change": record.is_change,
                "url": record.url
            })

        # Calculate summary statistics (use all records, not just sampled)
        values = [r.value for r in records if r.value is not None]
        summary = {
            "total_points": len(records),
            "displayed_points": len(records_to_chart),
            "date_range": f"{start_date.date()} to {end_date.date()}",
            "value_range": {
                "min": min(values) if values else None,
                "max": max(values) if values else None,
                "avg": sum(values) / len(values) if values else None
            },
            "changes_detected": sum(1 for r in records if r.is_change),
            "latest_value": records[-1].value if records else None,
            "latest_timestamp": records[-1].timestamp.isoformat() if records else None
        }

        return {
            "monitor_id": monitor_id,
            "monitor_name": records[0].monitor_name,
            "url": records[0].url,
            "data": chart_data,
            "summary": summary
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        db.close()


@router.delete("/data/{record_id}")
async def delete_monitoring_record(record_id: int) -> Dict[str, Any]:
    """
    Delete a specific monitoring record.
    Uses MonitoringRepository for data access.
    """
    db = get_db_session()

    try:
        repo = MonitoringRepository(db)
        record = repo.get_by_id(record_id)

        if not record:
            raise HTTPException(status_code=404, detail="Record not found")

        db.delete(record)
        db.commit()

        return {
            "status": "success",
            "message": f"Record {record_id} deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting record {record_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        db.close()


@router.patch("/monitors/{monitor_id}/unit")
async def update_monitor_unit(monitor_id: str, unit: str = None) -> Dict[str, Any]:
    """
    Update the display unit for all data of a specific monitor.
    """
    db = get_db_session()

    try:
        updated_count = db.query(MonitoringData).filter(
            MonitoringData.monitor_id == monitor_id
        ).update({"unit": unit})

        db.commit()

        return {
            "status": "success",
            "message": f"Updated unit to '{unit}' for {updated_count} records",
            "monitor_id": monitor_id,
            "unit": unit
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        db.close()


@router.patch("/monitors/{monitor_id}/decimal-places")
async def update_monitor_decimal_places(monitor_id: str, decimal_places: int = Query(..., ge=0, le=10)) -> Dict[str, Any]:
    """
    Update the number of decimal places to display for a specific monitor.
    """
    db = get_db_session()

    try:
        updated_count = db.query(MonitoringData).filter(
            MonitoringData.monitor_id == monitor_id
        ).update({"decimal_places": decimal_places})

        db.commit()

        return {
            "status": "success",
            "message": f"Updated decimal places to {decimal_places} for {updated_count} records",
            "monitor_id": monitor_id,
            "decimal_places": decimal_places
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        db.close()


@router.delete("/monitors/{monitor_id}")
async def delete_monitor_data(monitor_id: str) -> Dict[str, Any]:
    """
    Delete all data for a specific monitor.
    """
    db = get_db_session()

    try:
        deleted_count = db.query(MonitoringData).filter(
            MonitoringData.monitor_id == monitor_id
        ).delete()

        db.commit()

        return {
            "status": "success",
            "message": f"Deleted {deleted_count} records for monitor {monitor_id}"
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        db.close()


@router.post("/generate-sample")
async def generate_sample_data() -> Dict[str, Any]:
    """
    Generate sample monitoring data for testing purposes.
    """
    import random
    from datetime import datetime, timedelta

    db = get_db_session()

    try:
        # Generate sample data for multiple monitors
        monitors = [
            {"id": "website_homepage", "name": "Website Homepage", "url": "https://example.com"},
            {"id": "api_status", "name": "API Status", "url": "https://api.example.com/status"},
            {"id": "pricing_page", "name": "Pricing Page", "url": "https://example.com/pricing"},
            {"id": "user_dashboard", "name": "User Dashboard", "url": "https://app.example.com/dashboard"}
        ]

        records_created = 0
        base_time = datetime.utcnow() - timedelta(days=7)

        for monitor in monitors:
            # Generate data points over the last 7 days
            for hour in range(0, 7 * 24, 2):  # Every 2 hours
                timestamp = base_time + timedelta(hours=hour)

                # Generate realistic values with some variation
                base_value = random.uniform(50, 200)
                variation = random.uniform(-20, 20)
                value = round(base_value + variation, 2)

                # Randomly mark some as changes
                is_change = random.random() < 0.1  # 10% chance of change

                record = MonitoringData(
                    monitor_id=monitor["id"],
                    monitor_name=monitor["name"],
                    url=monitor["url"],
                    value=value,
                    status="changed" if is_change else "unchanged",
                    timestamp=timestamp,
                    webhook_received_at=timestamp,
                    is_change=is_change,
                    change_type="increase" if is_change and random.random() > 0.5 else "decrease" if is_change else None
                )

                db.add(record)
                records_created += 1

        db.commit()

        return {
            "status": "success",
            "message": f"Generated {records_created} sample records across {len(monitors)} monitors"
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error generating sample data: {str(e)}")
    finally:
        db.close()


@router.delete("/clear-all")
async def clear_all_data() -> Dict[str, Any]:
    """
    Clear all monitoring data from the database.
    """
    db = get_db_session()

    try:
        deleted_count = db.query(MonitoringData).delete()
        db.commit()

        return {
            "status": "success",
            "message": f"Cleared all data: {deleted_count} records deleted"
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error clearing data: {str(e)}")
    finally:
        db.close()


@router.post("/execute")
async def execute_command(command_data: Dict[str, str]) -> Dict[str, Any]:
    """
    Execute a system command (for deployment management).
    Note: This is a simplified implementation for demo purposes.
    In production, you should implement proper security and command validation.
    """
    import subprocess
    import shlex

    try:
        command = command_data.get("command", "")

        if not command:
            raise HTTPException(status_code=400, detail="No command provided")

        # For security, only allow specific safe commands
        allowed_commands = [
            "systemctl status",
            "systemctl start",
            "systemctl stop",
            "systemctl restart",
            "git pull",
            "pip install",
            "docker ps",
            "docker images",
            "tail -n 20"
        ]

        # Check if command starts with any allowed prefix
        is_allowed = any(command.startswith(allowed_cmd) for allowed_cmd in allowed_commands)

        if not is_allowed:
            return {
                "success": False,
                "error": "Command not allowed for security reasons",
                "output": ""
            }

        # Execute the command with timeout
        try:
            result = subprocess.run(
                shlex.split(command),
                capture_output=True,
                text=True,
                timeout=30
            )

            return {
                "success": result.returncode == 0,
                "output": result.stdout if result.returncode == 0 else result.stderr,
                "error": result.stderr if result.returncode != 0 else None
            }

        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "Command timed out after 30 seconds",
                "output": ""
            }
        except FileNotFoundError:
            return {
                "success": False,
                "error": f"Command not found: {command.split()[0]}",
                "output": ""
            }

    except Exception as e:
        return {
            "success": False,
            "error": f"Error executing command: {str(e)}",
            "output": ""
        }


# Constant card management endpoints
class ConstantUpdate(BaseModel):
    """Model for updating constant cards."""
    name: Optional[str] = None
    value: Optional[float] = None
    unit: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class ConstantCreate(BaseModel):
    """Model for creating constant cards."""
    name: str
    value: float
    unit: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = '#3b82f6'


@router.post("/constant")
async def create_constant(constant: ConstantCreate):
    """Create a new constant card."""
    import uuid

    db = get_db_session()
    try:
        # Generate unique monitor_id
        monitor_id = f"const-{uuid.uuid4()}"

        # Create new constant as monitoring_data entry
        new_constant = MonitoringData(
            monitor_id=monitor_id,
            monitor_name=constant.name,
            monitor_type='constant',
            url='',
            value=constant.value,
            unit=constant.unit,
            description=constant.description,
            color=constant.color,
            status='active',
            timestamp=datetime.utcnow(),
            webhook_received_at=datetime.utcnow()
        )

        db.add(new_constant)
        db.commit()

        return {
            "success": True,
            "message": "Constant created",
            "monitor_id": monitor_id
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create constant: {str(e)}")
    finally:
        db.close()


@router.put("/constant/{monitor_id}")
async def update_constant(monitor_id: str, update: ConstantUpdate):
    """Update a constant card (monitor with type='constant')."""
    db = get_db_session()
    try:
        # Get the constant's latest record
        constant = db.query(MonitoringData).filter(
            MonitoringData.monitor_id == monitor_id,
            MonitoringData.monitor_type == 'constant'
        ).order_by(desc(MonitoringData.timestamp)).first()

        if not constant:
            raise HTTPException(status_code=404, detail="Constant not found")

        # Update fields
        if update.name is not None:
            constant.monitor_name = update.name
        if update.value is not None:
            constant.value = update.value
        if update.unit is not None:
            constant.unit = update.unit
        if update.description is not None:
            constant.description = update.description
        if update.color is not None:
            constant.color = update.color

        constant.timestamp = datetime.utcnow()
        db.commit()

        return {"success": True, "message": "Constant updated"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update constant: {str(e)}")
    finally:
        db.close()


@router.delete("/constant/{monitor_id}")
async def delete_constant(monitor_id: str):
    """Delete a constant card."""
    db = get_db_session()
    try:
        # Delete all records for this constant
        deleted = db.query(MonitoringData).filter(
            MonitoringData.monitor_id == monitor_id,
            MonitoringData.monitor_type == 'constant'
        ).delete()

        if deleted == 0:
            raise HTTPException(status_code=404, detail="Constant not found")

        db.commit()
        return {"success": True, "message": f"Deleted {deleted} record(s)"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete constant: {str(e)}")
    finally:
        db.close()