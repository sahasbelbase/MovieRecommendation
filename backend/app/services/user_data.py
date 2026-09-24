import os
import json
import csv
import io
import time
import logging
from typing import List, Optional, Dict, Any
from ..core.config import settings
from ..core.auth import firebase_initialized

logger = logging.getLogger("user_data")

class UserDataService:
    def __init__(self):
        self.dev_cache_file = os.path.join(settings.CACHE_DIR, "dev_users_data.json")
        os.makedirs(settings.CACHE_DIR, exist_ok=True)
        self._firestore_db = None

    @property
    def db(self):
        if self._firestore_db is None and firebase_initialized:
            try:
                from firebase_admin import firestore
                self._firestore_db = firestore.client()
            except Exception as e:
                logger.warning(f"Could not connect to Firestore: {e}")
        return self._firestore_db

    # Local dev cache helpers
    def _read_dev_store(self) -> dict:
        if os.path.exists(self.dev_cache_file):
            try:
                with open(self.dev_cache_file, "r") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def _write_dev_store(self, data: dict):
        with open(self.dev_cache_file, "w") as f:
            json.dump(data, f, indent=2)

    def _touch_user_activity(self, user_id: str, email: Optional[str] = None):
        """Updates last_used_date on the user's document in Firestore"""
        if not self.db:
            return
        try:
            from datetime import datetime, timezone
            now_dt = datetime.now(timezone.utc)
            formatted_date = now_dt.strftime("%b %d, %Y, %I:%M:%S %p UTC")
            user_doc = self.db.collection("users").document(user_id)
            doc_snap = user_doc.get()
            data = {
                "user_id": user_id,
                "last_used_date": formatted_date,
                "last_used_at": now_dt.isoformat(),
                "last_used_timestamp": int(now_dt.timestamp() * 1000),
            }
            if email:
                data["identifier"] = email
            if not doc_snap.exists:
                data["created"] = formatted_date
                data["signed_in"] = formatted_date
                data["provider"] = "google.com"
                data["is_vip"] = False
            user_doc.set(data, merge=True)
        except Exception as e:
            logger.debug(f"User activity touch error: {e}")

    async def get_watched_list(self, user_id: str) -> List[dict]:
        """Returns list of watched movies for user"""
        if self.db:
            try:
                docs = self.db.collection("users").document(user_id).collection("watched").order_by("watched_at", direction="DESCENDING").stream()
                return [doc.to_dict() for doc in docs]
            except Exception as e:
                logger.error(f"Firestore get_watched_list error: {e}")

        # Fallback to dev store
        store = self._read_dev_store()
        user_movies = store.get(user_id, {}).get("watched", {})
        movies = list(user_movies.values())
        movies.sort(key=lambda x: x.get("watched_at", 0), reverse=True)
        return movies

    async def get_watched_ids(self, user_id: str) -> List[int]:
        """Returns just the list of movie IDs the user has watched"""
        movies = await self.get_watched_list(user_id)
        return [int(m["id"]) for m in movies if "id" in m]

    async def mark_watched(self, user_id: str, movie: dict, rating: Optional[float] = None, review: Optional[str] = None) -> dict:
        """Saves a movie to the user's watched list"""
        movie_id = int(movie["id"])
        record = {
            "id": movie_id,
            "title": movie.get("title", "Untitled"),
            "poster_url": movie.get("poster_url"),
            "year": movie.get("year", ""),
            "vote_average": movie.get("vote_average", 0.0),
            "genres": movie.get("genres", []),
            "media_type": movie.get("media_type", "movie"),
            "watched_at": time.time(),
            "rating": rating,
            "review": review,
        }

        if self.db:
            try:
                doc_ref = self.db.collection("users").document(user_id).collection("watched").document(str(movie_id))
                doc_ref.set(record)
                # If it was previously in unwatched, watchlist, or not_interested, remove from them
                self.db.collection("users").document(user_id).collection("unwatched").document(str(movie_id)).delete()
                self.db.collection("users").document(user_id).collection("watchlist").document(str(movie_id)).delete()
                self.db.collection("users").document(user_id).collection("not_interested").document(str(movie_id)).delete()
                self._touch_user_activity(user_id)
                return record
            except Exception as e:
                logger.error(f"Firestore mark_watched error: {e}")

        store = self._read_dev_store()
        if user_id not in store:
            store[user_id] = {"watched": {}, "unwatched": {}, "watchlist": {}, "not_interested": {}}
        if "watched" not in store[user_id]:
            store[user_id]["watched"] = {}
        store[user_id]["watched"][str(movie_id)] = record
        # Remove from unwatched, watchlist, and not_interested if present
        if "unwatched" in store[user_id] and str(movie_id) in store[user_id]["unwatched"]:
            del store[user_id]["unwatched"][str(movie_id)]
        if "watchlist" in store[user_id] and str(movie_id) in store[user_id]["watchlist"]:
            del store[user_id]["watchlist"][str(movie_id)]
        if "not_interested" in store[user_id] and str(movie_id) in store[user_id]["not_interested"]:
            del store[user_id]["not_interested"][str(movie_id)]
        self._write_dev_store(store)
        return record

    async def mark_unwatched(self, user_id: str, movie: dict) -> dict:
        """
        Saves a movie to the user's skipped / unwatched list internally.
        Ensures it won't be repeatedly served in Swipe Mode or under recommendations.
        """
        movie_id = int(movie["id"])
        record = {
            "id": movie_id,
            "title": movie.get("title", "Untitled"),
            "poster_url": movie.get("poster_url"),
            "year": movie.get("year", ""),
            "vote_average": movie.get("vote_average", 0.0),
            "genres": movie.get("genres", []),
            "media_type": movie.get("media_type", "movie"),
            "skipped_at": time.time(),
        }

        if self.db:
            try:
                doc_ref = self.db.collection("users").document(user_id).collection("unwatched").document(str(movie_id))
                doc_ref.set(record)
                self._touch_user_activity(user_id)
                return record
            except Exception as e:
                logger.error(f"Firestore mark_unwatched error: {e}")

        store = self._read_dev_store()
        if user_id not in store:
            store[user_id] = {"watched": {}, "unwatched": {}}
        if "unwatched" not in store[user_id]:
            store[user_id]["unwatched"] = {}
        store[user_id]["unwatched"][str(movie_id)] = record
        self._write_dev_store(store)
        return record

    async def get_unwatched_list(self, user_id: str) -> List[dict]:
        """Returns list of movies the user skipped or marked unwatched"""
        if self.db:
            try:
                docs = self.db.collection("users").document(user_id).collection("unwatched").order_by("skipped_at", direction="DESCENDING").stream()
                return [doc.to_dict() for doc in docs]
            except Exception as e:
                logger.error(f"Firestore get_unwatched_list error: {e}")

        store = self._read_dev_store()
        user_unwatched = store.get(user_id, {}).get("unwatched", {})
        movies = list(user_unwatched.values())
        movies.sort(key=lambda x: x.get("skipped_at", 0), reverse=True)
        return movies

    async def get_unwatched_ids(self, user_id: str) -> List[int]:
        """Returns just the list of movie IDs the user has marked unwatched / skipped"""
        if self.db:
            try:
                docs = self.db.collection("users").document(user_id).collection("unwatched").stream()
                return [int(doc.id) for doc in docs]
            except Exception as e:
                logger.error(f"Firestore get_unwatched_ids error: {e}")

        store = self._read_dev_store()
        unwatched = store.get(user_id, {}).get("unwatched", {})
        return [int(k) for k in unwatched.keys()]

    async def get_all_excluded_ids(self, user_id: str) -> List[int]:
        """
        Returns the union of watched movie IDs, skipped/unwatched movie IDs, watchlist IDs,
        and not-interested movie IDs.
        Used to ensure titles are never repeatedly shown in Swipe Mode or recommendation cards.
        """
        import asyncio
        results = await asyncio.gather(
            self.get_watched_ids(user_id),
            self.get_unwatched_ids(user_id),
            self.get_watchlist_ids(user_id),
            self.get_not_interested_ids(user_id),
            return_exceptions=True
        )
        combined = []
        for res in results:
            if isinstance(res, list):
                combined.extend(res)
        return list(set(combined))

    async def unmark_watched(self, user_id: str, movie_id: int) -> bool:
        """Removes a movie from the user's watched list"""
        if self.db:
            try:
                self.db.collection("users").document(user_id).collection("watched").document(str(movie_id)).delete()
                return True
            except Exception as e:
                logger.error(f"Firestore unmark_watched error: {e}")

        store = self._read_dev_store()
        if user_id in store and "watched" in store[user_id]:
            if str(movie_id) in store[user_id]["watched"]:
                del store[user_id]["watched"][str(movie_id)]
                self._write_dev_store(store)
                return True
        return False

    async def get_watchlist(self, user_id: str) -> List[dict]:
        """Returns list of movies in the user's Watchlist / Want to Watch list"""
        if self.db:
            try:
                docs = self.db.collection("users").document(user_id).collection("watchlist").order_by("added_at", direction="DESCENDING").stream()
                return [doc.to_dict() for doc in docs]
            except Exception as e:
                logger.error(f"Firestore get_watchlist error: {e}")

        store = self._read_dev_store()
        user_watchlist = store.get(user_id, {}).get("watchlist", {})
        movies = list(user_watchlist.values())
        movies.sort(key=lambda x: x.get("added_at", 0), reverse=True)
        return movies

    async def get_watchlist_ids(self, user_id: str) -> List[int]:
        """Returns just the list of movie IDs in the user's watchlist"""
        movies = await self.get_watchlist(user_id)
        return [int(m["id"]) for m in movies if "id" in m]

    async def add_to_watchlist(self, user_id: str, movie: dict) -> dict:
        """Adds a movie to the user's Watchlist / Want to Watch list"""
        movie_id = int(movie["id"])
        record = {
            "id": movie_id,
            "title": movie.get("title", "Untitled"),
            "poster_url": movie.get("poster_url"),
            "backdrop_url": movie.get("backdrop_url"),
            "year": movie.get("year", ""),
            "vote_average": movie.get("vote_average", 0.0),
            "genres": movie.get("genres", []),
            "media_type": movie.get("media_type", "movie"),
            "added_at": time.time(),
            "rotten_tomatoes": movie.get("rotten_tomatoes"),
            "imdb_rating": movie.get("imdb_rating")
        }

        if self.db:
            try:
                doc_ref = self.db.collection("users").document(user_id).collection("watchlist").document(str(movie_id))
                doc_ref.set(record)
                self._touch_user_activity(user_id)
                return record
            except Exception as e:
                logger.error(f"Firestore add_to_watchlist error: {e}")

        store = self._read_dev_store()
        if user_id not in store:
            store[user_id] = {"watched": {}, "unwatched": {}, "watchlist": {}}
        if "watchlist" not in store[user_id]:
            store[user_id]["watchlist"] = {}
        store[user_id]["watchlist"][str(movie_id)] = record
        self._write_dev_store(store)
        return record

    async def remove_from_watchlist(self, user_id: str, movie_id: int) -> bool:
        """Removes a movie from the user's watchlist"""
        if self.db:
            try:
                self.db.collection("users").document(user_id).collection("watchlist").document(str(movie_id)).delete()
                return True
            except Exception as e:
                logger.error(f"Firestore remove_from_watchlist error: {e}")

        store = self._read_dev_store()
        if user_id in store and "watchlist" in store[user_id]:
            if str(movie_id) in store[user_id]["watchlist"]:
                del store[user_id]["watchlist"][str(movie_id)]
                self._write_dev_store(store)
                return True
        return False

    async def get_not_interested_list(self, user_id: str) -> List[dict]:
        """Returns list of movies the user marked as Not Interested"""
        if self.db:
            try:
                docs = self.db.collection("users").document(user_id).collection("not_interested").order_by("marked_at", direction="DESCENDING").stream()
                return [doc.to_dict() for doc in docs]
            except Exception as e:
                logger.error(f"Firestore get_not_interested_list error: {e}")

        store = self._read_dev_store()
        user_ni = store.get(user_id, {}).get("not_interested", {})
        movies = list(user_ni.values())
        movies.sort(key=lambda x: x.get("marked_at", 0), reverse=True)
        return movies

    async def get_not_interested_ids(self, user_id: str) -> List[int]:
        """Returns just the list of movie IDs marked as Not Interested"""
        if self.db:
            try:
                docs = self.db.collection("users").document(user_id).collection("not_interested").stream()
                return [int(doc.id) for doc in docs]
            except Exception as e:
                logger.error(f"Firestore get_not_interested_ids error: {e}")

        store = self._read_dev_store()
        user_ni = store.get(user_id, {}).get("not_interested", {})
        return [int(k) for k in user_ni.keys()]

    async def mark_not_interested(self, user_id: str, movie: dict) -> dict:
        """Marks a movie as Not Interested, removing from watchlist/watched if present"""
        movie_id = int(movie["id"])
        record = {
            "id": movie_id,
            "title": movie.get("title", "Untitled"),
            "poster_url": movie.get("poster_url"),
            "backdrop_url": movie.get("backdrop_url"),
            "year": movie.get("year", ""),
            "vote_average": movie.get("vote_average", 0.0),
            "genres": movie.get("genres", []),
            "media_type": movie.get("media_type", "movie"),
            "marked_at": time.time(),
        }

        if self.db:
            try:
                doc_ref = self.db.collection("users").document(user_id).collection("not_interested").document(str(movie_id))
                doc_ref.set(record)
                # Remove from watchlist if present
                self.db.collection("users").document(user_id).collection("watchlist").document(str(movie_id)).delete()
                self._touch_user_activity(user_id)
                return record
            except Exception as e:
                logger.error(f"Firestore mark_not_interested error: {e}")

        store = self._read_dev_store()
        if user_id not in store:
            store[user_id] = {"watched": {}, "unwatched": {}, "watchlist": {}, "not_interested": {}}
        if "not_interested" not in store[user_id]:
            store[user_id]["not_interested"] = {}
        store[user_id]["not_interested"][str(movie_id)] = record
        if "watchlist" in store[user_id] and str(movie_id) in store[user_id]["watchlist"]:
            del store[user_id]["watchlist"][str(movie_id)]
        self._write_dev_store(store)
        return record

    async def unmark_not_interested(self, user_id: str, movie_id: int) -> bool:
        """Removes a movie from the user's Not Interested list (undo)"""
        if self.db:
            try:
                self.db.collection("users").document(user_id).collection("not_interested").document(str(movie_id)).delete()
                return True
            except Exception as e:
                logger.error(f"Firestore unmark_not_interested error: {e}")

        store = self._read_dev_store()
        if user_id in store and "not_interested" in store[user_id]:
            if str(movie_id) in store[user_id]["not_interested"]:
                del store[user_id]["not_interested"][str(movie_id)]
                self._write_dev_store(store)
                return True
        return False

    async def export_data(self, user_id: str, format_type: str = "json") -> tuple[str, str]:
        """
        Exports user's watched data as JSON or CSV.
        Returns (file_content, media_type).
        """
        watched = await self.get_watched_list(user_id)
        if format_type.lower() == "csv":
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=["id", "title", "year", "rating", "genres", "watched_at"])
            writer.writeheader()
            for m in watched:
                writer.writerow({
                    "id": m.get("id"),
                    "title": m.get("title"),
                    "year": m.get("year"),
                    "rating": m.get("rating", ""),
                    "genres": ", ".join(m.get("genres", [])),
                    "watched_at": m.get("watched_at")
                })
            return output.getvalue(), "text/csv"

        return json.dumps(watched, indent=2), "application/json"

    async def import_data(self, user_id: str, content: str, filename: str) -> int:
        """
        Imports watched movies from JSON or Letterboxd/IMDb CSV.
        Returns count of imported movies.
        """
        imported_count = 0
        if filename.endswith(".json"):
            items = json.loads(content)
            for item in items:
                if "id" in item:
                    await self.mark_watched(user_id, item, rating=item.get("rating"))
                    imported_count += 1
        elif filename.endswith(".csv"):
            # Letterboxd or general CSV import
            reader = csv.DictReader(io.StringIO(content))
            for row in reader:
                # Handles Letterboxd format (Name, Year, Rating, etc.) or our CSV format (id, title, year, rating)
                title = row.get("Name") or row.get("title") or row.get("Title")
                year = row.get("Year") or row.get("year")
                rating_str = row.get("Rating") or row.get("rating")
                rating = float(rating_str) if rating_str else None
                movie_id = row.get("id")

                if movie_id:
                    movie_obj = {"id": int(movie_id), "title": title, "year": year}
                    await self.mark_watched(user_id, movie_obj, rating=rating)
                    imported_count += 1
                elif title:
                    # Search TMDB or catalog to resolve ID
                    from .tmdb import tmdb_service
                    res = await tmdb_service.search_movies(title)
                    if res:
                        best_match = res[0]
                        await self.mark_watched(user_id, best_match, rating=rating)
                        imported_count += 1

        return imported_count

user_data_service = UserDataService()
