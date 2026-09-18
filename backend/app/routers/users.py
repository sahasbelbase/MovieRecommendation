from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Response
from pydantic import BaseModel
from typing import Optional, List, Any
from ..core.auth import get_current_user_required
from ..services.user_data import user_data_service

router = APIRouter(prefix="/users", tags=["Users"])

class MarkWatchedRequest(BaseModel):
    movie: dict
    rating: Optional[float] = None

@router.get("/watched")
async def get_user_watched(user: dict = Depends(get_current_user_required)):
    return await user_data_service.get_watched_list(user["uid"])

@router.post("/watched")
async def mark_movie_watched(payload: MarkWatchedRequest, user: dict = Depends(get_current_user_required)):
    record = await user_data_service.mark_watched(user["uid"], payload.movie, rating=payload.rating)
    return {"status": "success", "record": record}

@router.delete("/watched/{movie_id}")
async def unmark_movie_watched(movie_id: int, user: dict = Depends(get_current_user_required)):
    success = await user_data_service.unmark_watched(user["uid"], movie_id)
    return {"status": "success" if success else "not_found"}

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
