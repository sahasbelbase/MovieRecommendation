import logging
from typing import List, Optional, Dict, Any
from .tmdb import tmdb_service

logger = logging.getLogger("vector_store")

class VectorStoreService:
    def __init__(self):
        self.is_ready: bool = True

    def initialize(self):
        """No-op: API-driven catalog replaces local CSV vector store."""
        self.is_ready = True

    async def search_similar(self, movie_id: int, excluded_ids: Optional[List[int]] = None, limit: int = 10) -> List[dict]:
        """Finds movies similar to movie_id via direct TMDB API query"""
        recs = await tmdb_service.get_recommendations(movie_id, media_type="movie")
        excluded = set(excluded_ids or []) | {movie_id}
        return [m for m in recs if m["id"] not in excluded][:limit]

    async def search_by_text(self, query: str, excluded_ids: Optional[List[int]] = None, limit: int = 10) -> List[dict]:
        """Performs search via live TMDB multi-search API"""
        results = await tmdb_service.search_multi(query)
        excluded = set(excluded_ids or [])
        return [m for m in results if m.get("id") and m["id"] not in excluded][:limit]

    async def get_tailored_recommendations(
        self,
        liked_movie_ids: List[int],
        excluded_ids: Optional[List[int]] = None,
        suppress_franchise_terms: Optional[List[str]] = None,
        limit: int = 15
    ) -> List[dict]:
        """Fetches dynamic recommendations from TMDB API for user's favorite titles"""
        import asyncio
        excluded = set(excluded_ids or []) | set(liked_movie_ids)
        
        # Query top 3 liked movies concurrently
        tasks = [
            tmdb_service.get_recommendations(mid, media_type="movie")
            for mid in liked_movie_ids[:3]
        ]
        results_list = await asyncio.gather(*tasks, return_exceptions=True)
        
        combined = []
        seen = set()
        for res in results_list:
            if isinstance(res, list):
                for item in res:
                    mid = item.get("id")
                    if mid and mid not in excluded and mid not in seen:
                        seen.add(mid)
                        combined.append(item)
                        if len(combined) >= limit:
                            break
        return combined[:limit]

vector_store = VectorStoreService()
