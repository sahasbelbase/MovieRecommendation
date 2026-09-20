import asyncio
import logging
import time
from typing import Dict, List, Optional, Set, Tuple, Any
from fastapi import WebSocket

logger = logging.getLogger("theater_manager")


class TheaterManager:
    def __init__(self):
        # room_code -> session dictionary
        self._sessions: Dict[str, dict] = {}
        # room_code -> set of active WebSockets
        self._connections: Dict[str, Set[WebSocket]] = {}
        # websocket -> (room_code, user_id)
        self._socket_metadata: Dict[WebSocket, Tuple[str, str]] = {}
        self._lock = asyncio.Lock()

    def get_or_create_session(
        self,
        room_code: str,
        host_id: str,
        host_name: str,
        movie: Optional[dict] = None,
        video_source: Optional[dict] = None
    ) -> dict:
        """Initializes or returns an active theater session for a given room code"""
        room_code = room_code.upper()
        now = time.time()

        if room_code not in self._sessions:
            default_source = video_source or {
                "type": "youtube",
                "src": "",
                "title": (movie.get("title") if movie else "Cinema Stream")
            }

            self._sessions[room_code] = {
                "room_code": room_code,
                "host_id": host_id,
                "host_name": host_name,
                "movie": movie or {},
                "video_source": default_source,
                "playback": {
                    "is_playing": False,
                    "current_time": 0.0,
                    "playback_rate": 1.0,
                    "updated_at": now
                },
                "participants": {
                    host_id: {
                        "id": host_id,
                        "name": host_name,
                        "is_host": True,
                        "joined_at": now
                    }
                },
                "chat_history": [],
                "webrtc_streamer_id": None,
                "created_at": now
            }
            logger.info(f"Created new theater session for room {room_code}")
        else:
            session = self._sessions[room_code]
            if movie and not session.get("movie"):
                session["movie"] = movie
            if video_source:
                session["video_source"] = video_source

        return self.get_current_state(room_code)

    def get_current_state(self, room_code: str) -> Optional[dict]:
        """Returns the synchronized state with time adjusted for elapsed playback"""
        room_code = room_code.upper()
        if room_code not in self._sessions:
            return None

        session = self._sessions[room_code]
        playback = session["playback"]
        now = time.time()

        # Dynamically compute current elapsed time if playing
        computed_time = playback["current_time"]
        if playback["is_playing"]:
            elapsed = (now - playback["updated_at"]) * playback["playback_rate"]
            computed_time += max(0.0, elapsed)

        return {
            "room_code": session["room_code"],
            "host_id": session["host_id"],
            "host_name": session["host_name"],
            "movie": session["movie"],
            "video_source": session["video_source"],
            "playback": {
                "is_playing": playback["is_playing"],
                "current_time": round(computed_time, 2),
                "playback_rate": playback["playback_rate"],
                "updated_at": now
            },
            "participants": list(session["participants"].values()),
            "chat_history": session["chat_history"][-50:],
            "webrtc_streamer_id": session["webrtc_streamer_id"],
            "server_time": now
        }

    async def register_connection(
        self,
        websocket: WebSocket,
        room_code: str,
        user_id: str,
        user_name: str
    ):
        """Registers a newly connected WebSocket client to the room's theater session"""
        room_code = room_code.upper()
        await websocket.accept()

        async with self._lock:
            if room_code not in self._connections:
                self._connections[room_code] = set()
            self._connections[room_code].add(websocket)
            self._socket_metadata[websocket] = (room_code, user_id)

            # Ensure session exists or add participant
            if room_code in self._sessions:
                session = self._sessions[room_code]
                session["participants"][user_id] = {
                    "id": user_id,
                    "name": user_name,
                    "is_host": (user_id == session["host_id"]),
                    "joined_at": time.time()
                }

        logger.info(f"WebSocket client {user_name} ({user_id}) joined theater room {room_code}")

        # Send initial full synchronization state to the newly connected peer
        state = self.get_current_state(room_code)
        if state:
            await websocket.send_json({
                "type": "INITIAL_SYNC",
                "state": state
            })

            # Broadcast participant join to other peers
            await self.broadcast(room_code, {
                "type": "PARTICIPANT_JOINED",
                "participant": {
                    "id": user_id,
                    "name": user_name,
                    "is_host": (user_id == state["host_id"])
                },
                "participants": state["participants"]
            }, exclude=websocket)

    async def remove_connection(self, websocket: WebSocket):
        """Removes a disconnected WebSocket client and notifies room participants"""
        removed = None
        room_code = None
        user_id = None

        async with self._lock:
            meta = self._socket_metadata.pop(websocket, None)
            if not meta:
                return

            room_code, user_id = meta
            if room_code in self._connections:
                self._connections[room_code].discard(websocket)
                if not self._connections[room_code]:
                    del self._connections[room_code]

            if room_code in self._sessions:
                session = self._sessions[room_code]
                removed = session["participants"].pop(user_id, None)

                # If host leaves and other participants remain, transfer host
                if session["host_id"] == user_id and session["participants"]:
                    next_host_id = next(iter(session["participants"]))
                    session["host_id"] = next_host_id
                    session["host_name"] = session["participants"][next_host_id]["name"]
                    session["participants"][next_host_id]["is_host"] = True
                    logger.info(f"Host transferred to {session['host_name']} in room {room_code}")

        if removed and room_code:
            logger.info(f"Client {removed['name']} left theater room {room_code}")
            state = self.get_current_state(room_code)
            if state:
                await self.broadcast(room_code, {
                    "type": "PARTICIPANT_LEFT",
                    "user_id": user_id,
                    "new_host_id": state["host_id"],
                    "participants": state["participants"]
                })

    async def handle_message(self, websocket: WebSocket, data: dict):
        """Processes an incoming theater event from a client"""
        meta = self._socket_metadata.get(websocket)
        if not meta:
            return

        room_code, user_id = meta
        if room_code not in self._sessions:
            return

        session = self._sessions[room_code]
        event_type = data.get("type")
        payload = data.get("payload") if isinstance(data.get("payload"), dict) else data
        now = time.time()

        def get_time(default_val=0.0):
            if "currentTime" in payload:
                return float(payload["currentTime"])
            if "current_time" in payload:
                return float(payload["current_time"])
            return float(default_val)

        if event_type == "PLAY":
            time_val = get_time(session["playback"]["current_time"])
            session["playback"]["is_playing"] = True
            session["playback"]["current_time"] = time_val
            session["playback"]["updated_at"] = now

            await self.broadcast(room_code, {
                "type": "PLAY",
                "currentTime": time_val,
                "current_time": time_val,
                "sender_id": user_id,
                "server_time": now
            }, exclude=websocket)

        elif event_type == "PAUSE":
            time_val = get_time(session["playback"]["current_time"])
            session["playback"]["is_playing"] = False
            session["playback"]["current_time"] = time_val
            session["playback"]["updated_at"] = now

            await self.broadcast(room_code, {
                "type": "PAUSE",
                "currentTime": time_val,
                "current_time": time_val,
                "sender_id": user_id,
                "server_time": now
            }, exclude=websocket)

        elif event_type == "SEEK":
            time_val = get_time(0.0)
            session["playback"]["current_time"] = time_val
            session["playback"]["updated_at"] = now

            await self.broadcast(room_code, {
                "type": "SEEK",
                "currentTime": time_val,
                "current_time": time_val,
                "sender_id": user_id,
                "server_time": now
            }, exclude=websocket)

        elif event_type == "CHANGE_SOURCE":
            new_source = payload.get("source") or payload.get("video_source")
            if new_source:
                session["video_source"] = new_source
                session["playback"]["is_playing"] = False
                session["playback"]["current_time"] = 0.0
                session["playback"]["updated_at"] = now

                await self.broadcast(room_code, {
                    "type": "SOURCE_CHANGED",
                    "source": new_source,
                    "video_source": new_source,
                    "sender_id": user_id
                })

        elif event_type == "REACTION":
            emoji = payload.get("emoji", "❤️")
            user_name = session["participants"].get(user_id, {}).get("name", "Someone")

            await self.broadcast(room_code, {
                "type": "REACTION",
                "emoji": emoji,
                "user_id": user_id,
                "user_name": user_name,
                "id": f"react_{int(now * 1000)}"
            }, exclude=websocket)

        elif event_type == "CHAT":
            text = (payload.get("text") or "").strip()
            if text:
                user_name = session["participants"].get(user_id, {}).get("name", "Guest")
                video_time = get_time(0.0)
                msg = {
                    "id": payload.get("id") or f"msg_{int(now * 1000)}",
                    "user_id": user_id,
                    "user_name": user_name,
                    "text": text[:500],
                    "timestamp": now,
                    "video_time": video_time
                }
                session["chat_history"].append(msg)
                if len(session["chat_history"]) > 100:
                    session["chat_history"] = session["chat_history"][-100:]

                await self.broadcast(room_code, {
                    "type": "CHAT",
                    "message": msg,
                    "text": text[:500],
                    "sender_name": user_name,
                    "user_id": user_id
                })

        elif event_type == "WEBRTC_SIGNAL":
            # Direct peer-to-peer or broadcast WebRTC signaling (Offer/Answer/ICE)
            target_id = payload.get("target_id")
            signal = payload.get("signal")
            stream_action = payload.get("stream_action")  # "start_screen" | "stop_screen"

            if stream_action == "start_screen":
                session["webrtc_streamer_id"] = user_id
                session["video_source"] = {
                    "type": "webrtc",
                    "src": user_id,
                    "title": f"{session['participants'].get(user_id, {}).get('name', 'Host')}'s Screen Stream"
                }
            elif stream_action == "stop_screen":
                if session["webrtc_streamer_id"] == user_id:
                    session["webrtc_streamer_id"] = None

            # Relay signal
            relay_msg = {
                "type": "WEBRTC_SIGNAL",
                "sender_id": user_id,
                "sender_name": session["participants"].get(user_id, {}).get("name", "Peer"),
                "signal": signal,
                "stream_action": stream_action
            }

            if target_id:
                await self.send_to_user(room_code, target_id, relay_msg)
            else:
                await self.broadcast(room_code, relay_msg, exclude=websocket)

    async def broadcast(self, room_code: str, message: dict, exclude: Optional[WebSocket] = None):
        """Broadcasts a JSON message to all active WebSockets in the room"""
        connections = self._connections.get(room_code.upper(), set()).copy()
        for ws in connections:
            if ws != exclude:
                try:
                    await ws.send_json(message)
                except Exception as e:
                    logger.debug(f"Failed to send to client in room {room_code}: {e}")

    async def send_to_user(self, room_code: str, target_user_id: str, message: dict):
        """Sends a JSON message to a specific user in the room"""
        room_code = room_code.upper()
        for ws, (rc, uid) in self._socket_metadata.items():
            if rc == room_code and uid == target_user_id:
                try:
                    await ws.send_json(message)
                except Exception as e:
                    logger.debug(f"Failed to send direct message to user {target_user_id}: {e}")


theater_manager = TheaterManager()
