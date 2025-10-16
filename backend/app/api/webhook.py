"""
Webhook API endpoints for receiving Distill monitoring data.
Uses Service layer for business logic.
"""

from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
import json
import os

from app.models.database import WebhookData, get_db_session
from app.schemas.monitoring import DistillWebhookPayload
from app.services.webhook import WebhookService
from app.repositories.webhook_repo import WebhookRepository
from app.core.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()

# Get webhook secret from environment variable
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")


def verify_webhook_token(token: Optional[str] = None) -> bool:
    """
    Verify webhook authentication token from URL parameter.

    Args:
        token: Token from URL query parameter (?token=xxx)

    Returns:
        True if token is valid

    Raises:
        HTTPException: If token is missing or invalid
    """
    # If no secret is configured, allow all requests (backward compatibility)
    if not WEBHOOK_SECRET:
        logger.warning("WEBHOOK_SECRET not configured - webhook is not protected!")
        return True

    # Check if token is provided
    if not token:
        logger.warning("Webhook request rejected - missing token parameter")
        raise HTTPException(
            status_code=401,
            detail="Missing authentication token. Please provide ?token=xxx in URL."
        )

    # Verify token matches
    if token != WEBHOOK_SECRET:
        logger.warning(f"Webhook request rejected - invalid token")
        raise HTTPException(
            status_code=403,
            detail="Invalid authentication token"
        )

    return True




@router.post("/distill-debug")
async def receive_distill_webhook_debug(request: Request) -> Dict[str, Any]:
    """
    Debug endpoint to capture raw Distill webhook payloads.

    This endpoint logs the raw payload to help debug format mismatches.
    """
    try:
        # Get raw body
        body = await request.body()
        raw_payload = body.decode('utf-8')

        # Try to parse as JSON
        try:
            json_payload = json.loads(raw_payload)
            logger.info(f"RAW DISTILL PAYLOAD (JSON): {json.dumps(json_payload, indent=2)}")
        except json.JSONDecodeError:
            logger.info(f"RAW DISTILL PAYLOAD (TEXT): {raw_payload}")

        # Log headers
        headers = dict(request.headers)
        logger.info(f"DISTILL HEADERS: {json.dumps(headers, indent=2)}")

        return {
            "status": "success",
            "message": "Debug payload logged",
            "payload_length": len(raw_payload),
            "content_type": request.headers.get("content-type"),
            "received_at": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Error in debug webhook: {e}")
        return {
            "status": "error",
            "message": str(e),
            "received_at": datetime.utcnow().isoformat()
        }


@router.post("/distill")
async def receive_distill_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    token: Optional[str] = Query(None)
) -> Dict[str, Any]:
    """
    Receive webhook data from Distill Web Monitor.

    This endpoint accepts monitoring data from Distill and stores it in the database.
    Uses MonitoringService for business logic (parsing, saving, alert checking).

    **Authentication:**
    Requires ?token=xxx query parameter with the configured secret token.
    """
    # Verify token first
    verify_webhook_token(token)

    db = get_db_session()

    try:
        # Get raw body first for debugging
        body = await request.body()
        raw_payload = body.decode('utf-8')

        # Log raw payload and headers for debugging
        headers = dict(request.headers)
        logger.info(f"RAW DISTILL WEBHOOK PAYLOAD: {raw_payload}")
        logger.info(f"DISTILL WEBHOOK HEADERS: {json.dumps(headers, indent=2)}")

        # Try to parse as JSON
        try:
            json_data = json.loads(raw_payload)
            logger.info(f"PARSED JSON PAYLOAD: {json.dumps(json_data, indent=2)}")
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON: {e}")
            raise HTTPException(status_code=400, detail="Invalid JSON payload")

        # Try to validate with Pydantic model
        try:
            payload = DistillWebhookPayload(**json_data)
            logger.info(f"VALIDATED PAYLOAD: {payload.model_dump_json()}")
        except Exception as e:
            logger.error(f"Pydantic validation failed: {e}")
            logger.error(f"Expected fields: monitor_id, url, status, timestamp")
            logger.error(f"Received fields: {list(json_data.keys())}")
            raise HTTPException(status_code=422, detail=f"Validation error: {str(e)}")

        # Validate required fields (for Distill format)
        monitor_id = payload.id or payload.monitor_id
        url = payload.uri or payload.url
        text = payload.text or payload.text_value

        if not monitor_id:
            raise HTTPException(status_code=400, detail="id or monitor_id is required")
        if not url:
            raise HTTPException(status_code=400, detail="uri or url is required")
        if not text:
            raise HTTPException(status_code=400, detail="text or text_value is required")

        # Use service layer to process webhook (all business logic)
        webhook_service = WebhookService(db)
        saved_record = webhook_service.process_webhook(payload)

        return {
            "status": "success",
            "message": "Webhook data received and processed",
            "data": {
                "id": saved_record.id,
                "monitor_id": saved_record.monitor_id,
                "timestamp": saved_record.timestamp.isoformat(),
                "received_at": saved_record.webhook_received_at.isoformat()
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing webhook: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        db.close()


@router.post("/test")
async def test_webhook(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Test endpoint for webhook functionality.

    Accepts any JSON payload and returns it back with a timestamp.
    Useful for testing webhook integration without storing data.
    """
    return {
        "status": "success",
        "message": "Test webhook received",
        "received_data": data,
        "received_at": datetime.utcnow().isoformat()
    }


@router.get("/status")
async def webhook_status() -> Dict[str, Any]:
    """
    Get webhook service status and statistics.
    Uses MonitoringRepository for data access.
    """
    db = get_db_session()

    try:
        # Use repository for data access
        webhook_repo = WebhookRepository(db)

        # Get all monitors summary
        summaries = webhook_repo.get_all_monitors_summary()

        # Calculate totals
        total_records = sum(s['total_records'] for s in summaries)
        unique_monitors = len(summaries)

        # Get latest timestamp across all monitors
        latest_timestamp = None
        for s in summaries:
            if s['latest_timestamp']:
                if not latest_timestamp or s['latest_timestamp'] > latest_timestamp:
                    latest_timestamp = s['latest_timestamp']

        return {
            "status": "operational",
            "webhook_endpoint": "/webhook/distill",
            "statistics": {
                "total_records": total_records,
                "unique_monitors": unique_monitors,
                "latest_record": latest_timestamp.isoformat() if latest_timestamp else None
            }
        }

    except Exception as e:
        logger.error(f"Error getting webhook status: {e}")
        return {
            "status": "error",
            "message": str(e)
        }
    finally:
        db.close()


@router.get("/webhooks/{monitor_id}/history")
async def get_webhook_history(
    monitor_id: str,
    limit: int = Query(50, description="Number of records to return", ge=1, le=1000)
) -> list[Dict[str, Any]]:
    """
    Get historical webhook data for a specific monitor.
    Returns records in descending order (newest first).
    """
    db = get_db_session()

    try:
        webhook_repo = WebhookRepository(db)
        records = webhook_repo.get_by_monitor_id(
            monitor_id=monitor_id,
            limit=limit,
            order_by="timestamp",
            order_dir="desc"
        )

        # Format records for frontend
        history = []
        for record in records:
            history.append({
                "timestamp": record.timestamp.isoformat() if record.timestamp else None,
                "value": record.value,
                "unit": record.unit,
                "status": record.status,
                "is_change": record.is_change,
            })

        return history

    except Exception as e:
        logger.error(f"Error fetching webhook history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")
    finally:
        db.close()