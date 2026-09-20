from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Response
from pydantic import BaseModel
from typing import Optional, List, Any
from ..core.auth import get_current_user_required
from ..services.user_data import user_data_service

router = APIRouter(prefix="/users", tags=["Users"])

class MarkWatchedRequest(BaseModel):
    movie: dict
    rating: Optional[float] = None
    review: Optional[str] = None

@router.get("/watched")
async def get_user_watched(user: dict = Depends(get_current_user_required)):
    return await user_data_service.get_watched_list(user["uid"])

@router.post("/watched")
async def mark_movie_watched(payload: MarkWatchedRequest, user: dict = Depends(get_current_user_required)):
    record = await user_data_service.mark_watched(user["uid"], payload.movie, rating=payload.rating, review=payload.review)
    return {"status": "success", "record": record}

@router.delete("/watched/{movie_id}")
async def unmark_movie_watched(movie_id: int, user: dict = Depends(get_current_user_required)):
    success = await user_data_service.unmark_watched(user["uid"], movie_id)
    return {"status": "success" if success else "not_found"}

# Watchlist ("Want to Watch" / "Watch Later") Endpoints
class WatchlistRequest(BaseModel):
    movie: dict

@router.get("/watchlist")
async def get_user_watchlist(user: dict = Depends(get_current_user_required)):
    """Returns the user's Watchlist / Want to Watch list"""
    return await user_data_service.get_watchlist(user["uid"])

@router.post("/watchlist")
async def add_to_watchlist(payload: WatchlistRequest, user: dict = Depends(get_current_user_required)):
    """Adds a movie to the user's Watchlist"""
    record = await user_data_service.add_to_watchlist(user["uid"], payload.movie)
    return {"status": "success", "record": record}

@router.delete("/watchlist/{movie_id}")
async def remove_from_watchlist(movie_id: int, user: dict = Depends(get_current_user_required)):
    """Removes a movie from the user's Watchlist"""
    success = await user_data_service.remove_from_watchlist(user["uid"], movie_id)
    return {"status": "success" if success else "not_found"}

# "Not Interested" Endpoints (Strict Exclusion)
class NotInterestedRequest(BaseModel):
    movie: dict

@router.get("/not-interested")
async def get_user_not_interested(user: dict = Depends(get_current_user_required)):
    """Returns list of movies the user marked as Not Interested"""
    return await user_data_service.get_not_interested_list(user["uid"])

@router.post("/not-interested")
async def mark_not_interested(payload: NotInterestedRequest, user: dict = Depends(get_current_user_required)):
    """Marks a movie as Not Interested so it is never shown again in recommendations or decks"""
    record = await user_data_service.mark_not_interested(user["uid"], payload.movie)
    return {"status": "success", "record": record}

@router.delete("/not-interested/{movie_id}")
async def unmark_not_interested(movie_id: int, user: dict = Depends(get_current_user_required)):
    """Removes a movie from the Not Interested list (undo)"""
    success = await user_data_service.unmark_not_interested(user["uid"], movie_id)
    return {"status": "success" if success else "not_found"}

@router.get("/unwatched")
async def get_user_unwatched(user: dict = Depends(get_current_user_required)):
    """Returns list of movies the user skipped or marked unwatched"""
    return await user_data_service.get_unwatched_list(user["uid"])

@router.post("/unwatched")
async def mark_movie_unwatched(payload: dict, user: dict = Depends(get_current_user_required)):
    """Records an unwatched/skipped movie internally to prevent repeated recommendations"""
    movie = payload.get("movie", payload)
    record = await user_data_service.mark_unwatched(user["uid"], movie)
    return {"status": "success", "record": record}

@router.get("/export")
async def export_user_data(
    format: str = Query("json", pattern="^(json|csv)$"),
    user: dict = Depends(get_current_user_required)
):
    content, media_type = await user_data_service.export_data(user["uid"], format_type=format)
    filename = f"cinematch_watched_{user['uid'][:8]}.{format}"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.post("/import")
async def import_user_data(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user_required)
):
    content_bytes = await file.read()
    content_str = content_bytes.decode("utf-8", errors="ignore")
    count = await user_data_service.import_data(user["uid"], content_str, filename=file.filename or "import.json")
    return {"status": "success", "imported_count": count}
