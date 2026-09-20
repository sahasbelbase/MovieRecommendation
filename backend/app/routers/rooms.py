import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from ..services.room_manager import room_manager
from ..services.theater_manager import theater_manager
from ..services.tmdb import tmdb_service

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


class StartTheaterRequest(BaseModel):
    host_id: str = Field(..., description="Host user ID")
    host_name: str = Field(..., description="Host display name")
    movie: Optional[Dict[str, Any]] = Field(None, description="Movie object (title, poster_path, id, etc.)")
    video_source: Optional[Dict[str, Any]] = Field(None, description="Optional custom video source (type, src, title)")


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


@router.post("/{code}/theater/start")
async def start_theater(code: str, req: StartTheaterRequest):
    """
    Starts or connects to a Cinematch Theater (Watch Party) session.
    Automatically fetches official TMDB YouTube trailer if no video source is provided.
    """
    try:
        video_src = req.video_source
        if not video_src and req.movie and req.movie.get("id"):
            try:
                videos = await tmdb_service.get_videos(
                    item_id=req.movie["id"],
                    media_type=req.movie.get("media_type", "movie")
                )
                if videos:
                    primary_vid = videos[0]
                    video_src = {
                        "type": "youtube",
                        "src": primary_vid["key"],
                        "title": f"{req.movie.get('title') or req.movie.get('name', 'Movie')} - {primary_vid.get('name', 'Trailer')}"
                    }
            except Exception as e:
                logger.warning(f"Could not auto-fetch trailer for movie in theater: {e}")

        session = theater_manager.get_or_create_session(
            room_code=code,
            host_id=req.host_id,
            host_name=req.host_name,
            movie=req.movie,
            video_source=video_src
        )
        return {"status": "success", "theater": session}
    except Exception as e:
        logger.error(f"Failed to start theater in room {code}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{code}/theater/state")
async def get_theater_state(code: str):
    """Retrieves the current synchronized playback and participant state for a theater"""
    state = theater_manager.get_current_state(code)
    if not state:
        raise HTTPException(status_code=404, detail="Theater session not found for this room")
    return {"status": "success", "theater": state}


@router.websocket("/{code}/theater/ws")
async def theater_websocket(
    websocket: WebSocket,
    code: str,
    user_id: str = Query(..., description="Participant user ID"),
    user_name: str = Query(..., description="Participant display name")
):
    """
    Bi-directional synchronized watch party WebSocket stream.
    Broadcasts play/pause/seek events, reactions, live chat, and WebRTC signaling.
    """
    await theater_manager.register_connection(
        websocket=websocket,
        room_code=code,
        user_id=user_id,
        user_name=user_name
    )
    try:
        while True:
            data = await websocket.receive_json()
            await theater_manager.handle_message(websocket, data)
    except WebSocketDisconnect:
        logger.info(f"WebSocket client {user_name} disconnected from room {code}")
    except Exception as e:
        logger.warning(f"Theater WebSocket error for {user_name} in room {code}: {e}")
    finally:
        await theater_manager.remove_connection(websocket)
