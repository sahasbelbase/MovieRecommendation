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

    async def mark_watched(self, user_id: str, movie: dict, rating: Optional[float] = None) -> dict:
        """Saves a movie to the user's watched list"""
        movie_id = int(movie["id"])
        record = {
            "id": movie_id,
            "title": movie.get("title", "Untitled"),
            "poster_url": movie.get("poster_url"),
            "year": movie.get("year", ""),
            "vote_average": movie.get("vote_average", 0.0),
            "genres": movie.get("genres", []),
            "watched_at": time.time(),
            "rating": rating,
        }

        if self.db:
            try:
                doc_ref = self.db.collection("users").document(user_id).collection("watched").document(str(movie_id))
                doc_ref.set(record)
                return record
            except Exception as e:
                logger.error(f"Firestore mark_watched error: {e}")

        store = self._read_dev_store()
        if user_id not in store:
            store[user_id] = {"watched": {}}
        store[user_id]["watched"][str(movie_id)] = record
        self._write_dev_store(store)
        return record

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
