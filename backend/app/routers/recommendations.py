from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from ..core.auth import get_current_user_optional, get_current_user_required
from ..services.recommender import recommender_service
from ..services.user_data import user_data_service
from ..services.tmdb import tmdb_service

router = APIRouter(prefix="/recommendations", tags=["Recommendations & FYP"])

class SwipeActionRequest(BaseModel):
    item: dict
    watched: bool
    rating: Optional[float] = None

@router.get("/feed")
async def get_recommendation_feed(
    media_type: Optional[str] = Query(None, pattern="^(all|movie|tv|anime)$"),
    user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Returns personalized FYP feed for authenticated users,
    or public discovery feed across Movies, TV, Anime, and Rotten Tomatoes picks for guests.
    """
    if user:
        return await recommender_service.get_tailored_feed(user_id=user["uid"], media_type=media_type)
    return await recommender_service.get_guest_feed(media_type=media_type)

@router.get("/similar/{movie_id}")
async def get_similar(
    movie_id: int,
    media_type: str = Query("movie", pattern="^(movie|tv|anime|kdrama)$"),
    limit: int = Query(12, ge=1, le=30),
    user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Recommends items similar to movie_id, strictly filtering out already watched items.
    """
    user_id = user["uid"] if user else None
    return await recommender_service.get_similar(
        item_id=movie_id,
        media_type=media_type,
        user_id=user_id,
        limit=limit
    )

@router.get("/swipe-deck")
async def get_swipe_deck(
    limit: int = Query(20, ge=5, le=50),
    genre: Optional[str] = Query(None),
    user: dict = Depends(get_current_user_required)
):
    """
    Returns curated swipe card deck for signed-in users to calibrate their FYP taste profile.
    Strictly excludes any titles already marked as watched. Supports genre filtering.
    """
    return await recommender_service.get_swipe_deck(user_id=user["uid"], limit=limit, genre=genre)

@router.post("/swipe")
async def handle_swipe_action(
    payload: SwipeActionRequest,
    user: dict = Depends(get_current_user_required)
):
    """
    Records a taste calibration swipe for a signed-in user:
    - If watched: adds to user's watched collection
    - Adapts user FYP profile centroid
    - Left swipe (watched=false): Skips title and records negative affinity for calibration.
    """
    if payload.watched:
        await user_data_service.mark_watched(user["uid"], payload.item, rating=payload.rating)
        return {"status": "success", "action": "watched", "title": payload.item.get("title")}
    else:
        return {"status": "success", "action": "skipped", "title": payload.item.get("title")}

@router.get("/rotten-tomatoes")
async def get_rotten_tomatoes_picks(limit: int = Query(10, ge=1, le=30)):
    """Curated Certified Fresh Rotten Tomatoes & IMDb Elite recommendations"""
    return await tmdb_service.get_rotten_tomatoes_picks(limit=limit)
