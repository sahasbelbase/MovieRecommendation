import asyncio
import logging
import random
import string
import time
from typing import Dict, List, Optional, Any
from .tmdb import tmdb_service

logger = logging.getLogger("room_manager")

# Characters for easy-to-read, unambiguous 4-letter room codes
ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

# Rooms expire after 12 hours of inactivity
ROOM_TTL_SECONDS = 12 * 3600


class RoomManager:
    def __init__(self):
        # Key: uppercase 4-letter room code -> dict
        self._rooms: Dict[str, dict] = {}
        self._lock = asyncio.Lock()

    def _generate_code(self) -> str:
        """Generates a unique 4-character uppercase room code"""
        for _ in range(50):
            code = "".join(random.choices(ROOM_CODE_CHARS, k=4))
            if code not in self._rooms:
                return code
        # Fallback to 5 chars if collision space is crowded
        return "".join(random.choices(ROOM_CODE_CHARS, k=5))

    async def _fetch_deck_candidates(
        self,
        media_type: str = "all",
        genre: str = "All",
        limit: int = 30
    ) -> List[dict]:
        """Fetches 25-30 curated, high-quality candidate titles for the room deck"""
        candidates: List[dict] = []
        seen_ids = set()

        clean_genre = (genre or "").strip()
        has_genre = clean_genre and clean_genre.lower() != "all"

        try:
            if has_genre:
                # Targeted genre discovery
                results = await asyncio.gather(
                    tmdb_service.discover_by_genre(clean_genre, media_type=media_type, sort_by="popularity.desc"),
                    tmdb_service.discover_by_genre(clean_genre, media_type=media_type, sort_by="vote_average.desc"),
                    return_exceptions=True
                )
                pop_items = results[0] if isinstance(results[0], list) else []
                top_items = results[1] if isinstance(results[1], list) else []
                interleaved = []
                for p, t in zip(pop_items, top_items):
                    interleaved.extend([p, t])
                candidates = interleaved
            elif media_type == "movie":
                results = await asyncio.gather(
                    tmdb_service.get_trending_movies(),
                    tmdb_service.get_rotten_tomatoes_picks(limit=15),
                    tmdb_service.get_top_rated(media_type="movie"),
                    return_exceptions=True
                )
                for r in results:
                    if isinstance(r, list):
                        candidates.extend(r)
            elif media_type == "tv":
                results = await asyncio.gather(
                    tmdb_service.get_trending_tv(),
                    tmdb_service.get_top_rated(media_type="tv"),
                    return_exceptions=True
                )
                for r in results:
                    if isinstance(r, list):
                        candidates.extend(r)
            elif media_type == "anime":
                results = await asyncio.gather(
                    tmdb_service.get_trending_anime(),
                    tmdb_service.get_top_rated_anime(),
                    return_exceptions=True
                )
                for r in results:
                    if isinstance(r, list):
                        candidates.extend(r)
            else:
                # "all" media: blend of movies, trending shows, and critic picks
                results = await asyncio.gather(
                    tmdb_service.get_trending_all(time_window="day"),
                    tmdb_service.get_rotten_tomatoes_picks(limit=15),
                    return_exceptions=True
                )
                for r in results:
                    if isinstance(r, list):
                        candidates.extend(r)

        except Exception as e:
            logger.error(f"Error fetching deck candidates for room: {e}")

        # Filter out items without poster or overview
        valid_deck: List[dict] = []
        for m in candidates:
            m_id = m.get("id")
            if not m_id or m_id in seen_ids:
                continue
            if not m.get("poster_url") or not m.get("title"):
                continue
            seen_ids.add(m_id)
            valid_deck.append({
                "id": m["id"],
                "title": m["title"],
                "media_type": m.get("media_type", "movie"),
                "year": m.get("year", ""),
                "poster_url": m.get("poster_url"),
                "backdrop_url": m.get("backdrop_url") or m.get("poster_url"),
                "genres": m.get("genres", []),
                "vote_average": m.get("vote_average", 0.0),
                "imdb_rating": m.get("imdb_rating"),
                "rotten_tomatoes": m.get("rotten_tomatoes"),
                "overview": m.get("overview", "")
            })
            if len(valid_deck) >= limit:
                break

        # If external fetch was empty, fallback to rich catalog items
        if not valid_deck:
            for item in tmdb_service._get_fallback_top_250("movies")[:limit]:
                valid_deck.append(item)

        return valid_deck

    async def create_room(
        self,
        host_name: str,
        host_id: Optional[str] = None,
        media_type: str = "all",
        genre: str = "All",
        room_name: Optional[str] = None,
        match_threshold: str = "everyone"
    ) -> dict:
        """Creates a new Movie Night room and seeds the candidate swipe deck"""
        async with self._lock:
            self._cleanup_expired_rooms()

            code = self._generate_code()
            user_id = host_id or f"user_{code}_host_{int(time.time())}"
            clean_host_name = host_name.strip() or "Host"
            display_room_name = (room_name or "").strip() or f"{clean_host_name}'s Movie Night"

            # Fetch deck
            deck = await self._fetch_deck_candidates(media_type=media_type, genre=genre, limit=30)

            now = time.time()
            room_data = {
                "code": code,
                "name": display_room_name,
                "host_id": user_id,
                "host_name": clean_host_name,
                "media_type": media_type,
                "genre": genre,
                "match_threshold": match_threshold,  # "everyone" or "at_least_2"
                "created_at": now,
                "last_active": now,
                "deck": deck,
                "participants": {
                    user_id: {
                        "user_id": user_id,
                        "name": clean_host_name,
                        "is_host": True,
                        "joined_at": now,
                        "swipe_count": 0
                    }
                },
                "swipes": {
                    user_id: {}  # movie_id -> bool
                },
                "matches": []  # List of { movie: dict, matched_at: float, liked_by: List[str] }
            }

            self._rooms[code] = room_data
            logger.info(f"Created room {code} by {clean_host_name} with {len(deck)} deck items.")
            return self._format_room_response(code, user_id)

    async def join_room(
        self,
        code: str,
        user_name: str,
        user_id: Optional[str] = None
    ) -> dict:
        """Joins an existing room by 4-letter room code"""
        clean_code = code.strip().upper()
        clean_name = user_name.strip() or "Guest"

        async with self._lock:
            if clean_code not in self._rooms:
                raise ValueError(f"Room '{clean_code}' not found or has expired.")

            room = self._rooms[clean_code]
            uid = user_id or f"user_{clean_code}_{int(time.time() * 1000) % 100000}"

            # If user is already registered, update their name and timestamp
            if uid in room["participants"]:
                room["participants"][uid]["name"] = clean_name
            else:
                room["participants"][uid] = {
                    "user_id": uid,
                    "name": clean_name,
                    "is_host": (uid == room["host_id"]),
                    "joined_at": time.time(),
                    "swipe_count": 0
                }
                if uid not in room["swipes"]:
                    room["swipes"][uid] = {}

            room["last_active"] = time.time()
            logger.info(f"User {clean_name} ({uid}) joined room {clean_code}.")
            return self._format_room_response(clean_code, uid)

    async def record_swipe(
        self,
        code: str,
        user_id: str,
        movie_id: int,
        liked: bool
    ) -> dict:
        """
        Records a user's swipe (like=True, pass=False) and checks if a match has occurred.
        Returns whether a match was formed, along with the matched movie details.
        """
        clean_code = code.strip().upper()

        async with self._lock:
            if clean_code not in self._rooms:
                raise ValueError(f"Room '{clean_code}' not found.")

            room = self._rooms[clean_code]
            room["last_active"] = time.time()

            if user_id not in room["participants"]:
                raise ValueError("User is not a participant in this room.")

            # Record swipe
            room["swipes"][user_id][movie_id] = liked
            room["participants"][user_id]["swipe_count"] = len(room["swipes"][user_id])

            is_match = False
            matched_movie = None
            liked_by_names = []

            # Only check for matches if user liked the movie
            if liked:
                participant_ids = list(room["participants"].keys())
                num_participants = len(participant_ids)

                # Find all participants who liked this movie
                liker_ids = [
                    uid for uid in participant_ids
                    if room["swipes"].get(uid, {}).get(movie_id) is True
                ]
                liked_by_names = [room["participants"][uid]["name"] for uid in liker_ids]

                # Match rules:
                # 1. Must have at least 2 participants who liked it
                # 2. If match_threshold is "everyone", all currently registered participants must have liked it
                threshold = room.get("match_threshold", "everyone")
                threshold_met = False

                if threshold == "at_least_2":
                    threshold_met = len(liker_ids) >= 2
                else:
                    # Default: "everyone"
                    threshold_met = len(liker_ids) >= max(2, num_participants)

                # Check if already recorded in room matches
                already_matched = any(m["movie"]["id"] == movie_id for m in room["matches"])

                if threshold_met and not already_matched:
                    # Find movie object from deck
                    movie_obj = next((m for m in room["deck"] if m["id"] == movie_id), None)
                    if movie_obj:
                        is_match = True
                        matched_movie = movie_obj
                        match_entry = {
                            "movie": movie_obj,
                            "matched_at": time.time(),
                            "liked_by": liked_by_names
                        }
                        room["matches"].append(match_entry)
                        logger.info(f"🎉 IT'S A MATCH in room {clean_code}: '{movie_obj['title']}' liked by {liked_by_names}!")

            return {
                "room_code": clean_code,
                "movie_id": movie_id,
                "liked": liked,
                "is_match": is_match,
                "matched_movie": matched_movie,
                "liked_by": liked_by_names,
                "total_matches": len(room["matches"]),
                "user_swipe_count": room["participants"][user_id]["swipe_count"]
            }

    async def get_room_state(self, code: str, user_id: Optional[str] = None) -> dict:
        """Retrieves real-time room status, participants, matches, and unswiped deck"""
        clean_code = code.strip().upper()
        async with self._lock:
            if clean_code not in self._rooms:
                raise ValueError(f"Room '{clean_code}' not found or has expired.")
            room = self._rooms[clean_code]
            room["last_active"] = time.time()
            return self._format_room_response(clean_code, user_id)

    async def leave_room(self, code: str, user_id: str) -> dict:
        """Removes a user from a room"""
        clean_code = code.strip().upper()
        async with self._lock:
            if clean_code not in self._rooms:
                return {"status": "ok"}
            room = self._rooms[clean_code]
            if user_id in room["participants"]:
                del room["participants"][user_id]
            if user_id in room["swipes"]:
                del room["swipes"][user_id]

            # If no participants remain, delete room
            if not room["participants"]:
                del self._rooms[clean_code]
                logger.info(f"Room {clean_code} deleted because all participants left.")
            return {"status": "ok"}

    def _format_room_response(self, code: str, user_id: Optional[str] = None) -> dict:
        """Formats the sanitized room data for API clients"""
        room = self._rooms[code]
        user_swipes = room["swipes"].get(user_id, {}) if user_id else {}
        swiped_ids = set(user_swipes.keys())

        # Unswiped items for this specific user
        unswiped_deck = [m for m in room["deck"] if m["id"] not in swiped_ids]

        participants_list = [
            {
                "user_id": p["user_id"],
                "name": p["name"],
                "is_host": p.get("is_host", False),
                "swipe_count": len(room["swipes"].get(p["user_id"], {})),
                "is_you": (p["user_id"] == user_id)
            }
            for p in room["participants"].values()
        ]

        return {
            "code": room["code"],
            "name": room["name"],
            "host_name": room["host_name"],
            "media_type": room["media_type"],
            "genre": room["genre"],
            "match_threshold": room["match_threshold"],
            "created_at": room["created_at"],
            "deck_total": len(room["deck"]),
            "unswiped_count": len(unswiped_deck),
            "user_swipe_count": len(user_swipes),
            "is_host": (user_id == room["host_id"]) if user_id else False,
            "participants": participants_list,
            "unswiped_deck": unswiped_deck,
            "matches": room["matches"]
        }

    def _cleanup_expired_rooms(self):
        """Removes rooms older than ROOM_TTL_SECONDS"""
        now = time.time()
        expired = [
            code for code, r in self._rooms.items()
            if now - r.get("last_active", now) > ROOM_TTL_SECONDS
        ]
        for code in expired:
            del self._rooms[code]
            logger.info(f"Pruned expired room {code}")


room_manager = RoomManager()
