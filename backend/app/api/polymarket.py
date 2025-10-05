"""
Polymarket API endpoints for fetching and analyzing prediction markets.
"""

import json
import requests
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.database import (
    PolymarketMarket,
    PolymarketAnalysis,
    get_db_session
)
from pydantic import BaseModel

router = APIRouter()

POLYMARKET_API_URL = "https://clob.polymarket.com"


class MarketResponse(BaseModel):
    """Response model for market data."""
    id: int
    condition_id: str
    question: str
    description: Optional[str]
    market_slug: Optional[str]
    end_date_iso: Optional[datetime]
    active: bool
    closed: bool
    tokens: List[Dict[str, Any]]
    tags: List[str]
    fetched_at: datetime


class AnalysisRequest(BaseModel):
    """Request model for market analysis."""
    condition_id: str
    model_name: Optional[str] = "gpt-4"


@router.post("/polymarket/fetch")
async def fetch_polymarket_markets(
    limit: int = Query(20, description="Number of markets to fetch", ge=1, le=100),
    force_refresh: bool = Query(False, description="Force refresh even if data exists")
) -> Dict[str, Any]:
    """
    Fetch markets from Polymarket API and store them in database.
    """
    db = get_db_session()

    try:
        # Fetch from Polymarket API
        response = requests.get(
            f"{POLYMARKET_API_URL}/markets",
            params={"limit": limit},
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        markets_data = data.get("data", [])
        stored_count = 0
        updated_count = 0

        for market_data in markets_data:
            condition_id = market_data.get("condition_id")

            # Skip if no condition_id or if archived
            if not condition_id or market_data.get("archived"):
                continue

            # Check if market already exists
            existing = db.query(PolymarketMarket).filter(
                PolymarketMarket.condition_id == condition_id
            ).first()

            # Parse dates
            end_date = None
            if market_data.get("end_date_iso"):
                try:
                    end_date = datetime.fromisoformat(
                        market_data["end_date_iso"].replace("Z", "+00:00")
                    )
                except:
                    pass

            game_start = None
            if market_data.get("game_start_time"):
                try:
                    game_start = datetime.fromisoformat(
                        market_data["game_start_time"].replace("Z", "+00:00")
                    )
                except:
                    pass

            # Prepare market data
            market_dict = {
                "question_id": market_data.get("question_id"),
                "question": market_data.get("question", ""),
                "description": market_data.get("description"),
                "market_slug": market_data.get("market_slug"),
                "end_date_iso": end_date,
                "game_start_time": game_start,
                "icon": market_data.get("icon"),
                "image": market_data.get("image"),
                "active": market_data.get("active", True),
                "closed": market_data.get("closed", False),
                "archived": market_data.get("archived", False),
                "tokens_json": json.dumps(market_data.get("tokens", [])),
                "tags": ",".join(market_data.get("tags", [])),
                "updated_at": datetime.utcnow()
            }

            if existing:
                # Update existing market
                for key, value in market_dict.items():
                    setattr(existing, key, value)
                updated_count += 1
            else:
                # Create new market
                new_market = PolymarketMarket(
                    condition_id=condition_id,
                    **market_dict
                )
                db.add(new_market)
                stored_count += 1

        db.commit()

        return {
            "success": True,
            "message": f"Fetched {len(markets_data)} markets from Polymarket",
            "stored_new": stored_count,
            "updated_existing": updated_count,
            "total_processed": stored_count + updated_count
        }

    except requests.RequestException as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch from Polymarket API: {str(e)}"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )
    finally:
        db.close()


@router.get("/polymarket/markets", response_model=List[MarketResponse])
async def get_polymarket_markets(
    active_only: bool = Query(True, description="Only return active markets"),
    limit: int = Query(20, description="Number of markets to return", ge=1, le=100),
    offset: int = Query(0, description="Offset for pagination", ge=0)
) -> List[MarketResponse]:
    """
    Get stored Polymarket markets from database.
    """
    db = get_db_session()

    try:
        query = db.query(PolymarketMarket)

        if active_only:
            query = query.filter(
                PolymarketMarket.active == True,
                PolymarketMarket.closed == False,
                PolymarketMarket.archived == False
            )

        query = query.order_by(desc(PolymarketMarket.fetched_at))
        query = query.offset(offset).limit(limit)

        markets = query.all()

        # Convert to response format
        results = []
        for market in markets:
            tokens = json.loads(market.tokens_json) if market.tokens_json else []
            tags = market.tags.split(",") if market.tags else []

            results.append(MarketResponse(
                id=market.id,
                condition_id=market.condition_id,
                question=market.question,
                description=market.description,
                market_slug=market.market_slug,
                end_date_iso=market.end_date_iso,
                active=market.active,
                closed=market.closed,
                tokens=tokens,
                tags=tags,
                fetched_at=market.fetched_at
            ))

        return results

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        db.close()


@router.post("/polymarket/analyze")
async def analyze_market(request: AnalysisRequest) -> Dict[str, Any]:
    """
    Analyze a Polymarket market using LLM.
    For MVP, this returns a placeholder. You can integrate with OpenAI/Anthropic API later.
    """
    db = get_db_session()

    try:
        # Get market data
        market = db.query(PolymarketMarket).filter(
            PolymarketMarket.condition_id == request.condition_id
        ).first()

        if not market:
            raise HTTPException(status_code=404, detail="Market not found")

        # Parse tokens
        tokens = json.loads(market.tokens_json) if market.tokens_json else []

        # Format data for LLM
        market_context = f"""
Market Question: {market.question}

Description: {market.description or 'N/A'}

Options and Current Odds:
"""
        for token in tokens:
            outcome = token.get("outcome", "Unknown")
            price = token.get("price", 0)
            probability = f"{price * 100:.1f}%" if price else "N/A"
            market_context += f"- {outcome}: {probability}\n"

        market_context += f"""
End Date: {market.end_date_iso or 'N/A'}
Status: {'Active' if market.active else 'Inactive'}
"""

        # For MVP, return formatted context
        # TODO: Integrate with actual LLM API (OpenAI/Anthropic)
        analysis_text = f"""Market Analysis (Placeholder)

{market_context}

[TODO: Integrate LLM analysis here]
To integrate actual LLM analysis:
1. Add OpenAI or Anthropic API key to environment
2. Call API with this context
3. Store and return the analysis
"""

        # Store analysis
        analysis = PolymarketAnalysis(
            condition_id=request.condition_id,
            analysis_text=analysis_text,
            model_name=request.model_name
        )
        db.add(analysis)
        db.commit()

        return {
            "success": True,
            "condition_id": request.condition_id,
            "analysis": analysis_text,
            "market_context": market_context
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    finally:
        db.close()


@router.get("/polymarket/analysis/{condition_id}")
async def get_market_analysis(condition_id: str) -> Dict[str, Any]:
    """
    Get the latest analysis for a market.
    """
    db = get_db_session()

    try:
        analysis = db.query(PolymarketAnalysis).filter(
            PolymarketAnalysis.condition_id == condition_id
        ).order_by(desc(PolymarketAnalysis.created_at)).first()

        if not analysis:
            raise HTTPException(
                status_code=404,
                detail="No analysis found for this market"
            )

        return {
            "condition_id": analysis.condition_id,
            "analysis": analysis.analysis_text,
            "model_name": analysis.model_name,
            "created_at": analysis.created_at.isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        db.close()
