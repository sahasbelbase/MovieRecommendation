import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from ..services.room_manager import room_manager

logger = logging.getLogger("rooms_router")

router = APIRouter(prefix="/rooms", tags=["Movie Night Group Match"])


class CreateRoomRequest(BaseModel):
    host_name: str = Field(..., description="Display name of the host creating the room")
    host_id: Optional[str] = Field(None, description="Optional user ID / UID")
    media_type: Optional[str] = Field("all", description="all, movie, tv, anime")
    genre: Optional[str] = Field("All", description="Genre filter, e.g., Comedy, Action, Horror")
    room_name: Optional[str] = Field(None, description="Optional custom room name")
    match_threshold: Optional[str] = Field("everyone", description="everyone or at_least_2")


class JoinRoomRequest(BaseModel):
    user_name: str = Field(..., description="Display name of the person joining")
    user_id: Optional[str] = Field(None, description="Optional user ID / UID")


class SwipeRequest(BaseModel):
    user_id: str = Field(..., description="Participant user ID")
    movie_id: int = Field(..., description="ID of the movie swiped")
    liked: bool = Field(..., description="True if swiped right (liked), False if swiped left (passed)")


class LeaveRoomRequest(BaseModel):
    user_id: str = Field(..., description="Participant user ID")


@router.post("/create")
async def create_room(req: CreateRoomRequest):
    """Creates a new Movie Night room, seeds a 30-item swipe deck, and returns the 4-letter room code"""
    try:
        room = await room_manager.create_room(
            host_name=req.host_name,
            host_id=req.host_id,
            media_type=req.media_type or "all",
            genre=req.genre or "All",
            room_name=req.room_name,
            match_threshold=req.match_threshold or "everyone"
        )
        return {"status": "success", "room": room}
    except Exception as e:
        logger.error(f"Failed to create room: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{code}/join")
async def join_room(code: str, req: JoinRoomRequest):
    """Joins an existing Movie Night room by 4-letter room code"""
    try:
        room = await room_manager.join_room(
            code=code,
            user_name=req.user_name,
            user_id=req.user_id
        )
        return {"status": "success", "room": room}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to join room {code}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{code}")
async def get_room(
    code: str,
    user_id: Optional[str] = Query(None, description="Current user ID to compute unswiped items")
):
    """Retrieves real-time room state, participant swipe counts, unswiped deck, and matches"""
    try:
        room = await room_manager.get_room_state(code=code, user_id=user_id)
        return {"status": "success", "room": room}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to fetch room {code}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{code}/swipe")
async def swipe_movie(code: str, req: SwipeRequest):
    """
    Submits a swipe on a movie.
    If the swipe causes a match (everyone or threshold liked it), returns is_match=True with movie details.
    """
    try:
        result = await room_manager.record_swipe(
            code=code,
            user_id=req.user_id,
            movie_id=req.movie_id,
            liked=req.liked
        )
        return {"status": "success", "result": result}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to record swipe in room {code}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{code}/matches")
async def get_matches(code: str):
    """Retrieves all matched movies agreed upon by room participants"""
    try:
        room = await room_manager.get_room_state(code=code)
        return {
            "status": "success",
            "room_code": code.upper(),
            "matches": room.get("matches", []),
            "total_matches": len(room.get("matches", []))
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to fetch matches for room {code}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{code}/leave")
async def leave_room(code: str, req: LeaveRoomRequest):
    """Leaves a Movie Night room"""
    try:
        await room_manager.leave_room(code=code, user_id=req.user_id)
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to leave room {code}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
