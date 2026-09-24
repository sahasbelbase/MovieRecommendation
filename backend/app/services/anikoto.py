import asyncio
import logging
import re
import time
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger("anikoto_service")

ANIKOTO_BASE_URL = "https://anikotoapi.site"

# Cache store
_cache: Dict[str, Any] = {}
_cache_expiry: Dict[str, float] = {}

def _get_from_cache(key: str) -> Optional[Any]:
    now = time.time()
    if key in _cache and _cache_expiry.get(key, 0) > now:
        return _cache[key]
    return None

def _set_cache(key: str, data: Any, ttl: int = 600) -> None:
    _cache[key] = data
    _cache_expiry[key] = time.time() + ttl

def _normalize_title(title: str) -> str:
    if not title:
        return ""
    # Remove special characters, season indicators, punctuation, and multiple spaces
    cleaned = re.sub(r'[\(\)\[\]\{\}\-_:;!?,.\'"]+', ' ', title.lower())
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

class AnikotoService:
    """
    Client for Anikoto Anime API (https://anikotoapi.site/).
    Fetches daily anime episode updates, series details, and MegaPlay embed links.
    """
    def __init__(self, base_url: str = ANIKOTO_BASE_URL):
        self.base_url = base_url.rstrip("/")
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(10.0, connect=5.0),
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                    "Accept": "application/json"
                }
            )
        return self._client

    async def get_recent_anime(self, page: int = 1, per_page: int = 30) -> List[dict]:
        """
        Fetches recent anime entries from /recent-anime.
        Cached for 10 minutes to respect rate limits.
        """
        cache_key = f"anikoto_recent_{page}_{per_page}"
        cached = _get_from_cache(cache_key)
        if cached is not None:
            return cached

        try:
            url = f"{self.base_url}/recent-anime"
            params = {"page": page, "per_page": per_page}
            resp = await self.client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("data", [])
                _set_cache(cache_key, results, ttl=600)
                return results
            else:
                logger.warning(f"Anikoto recent anime HTTP {resp.status_code}")
                return []
        except Exception as e:
            logger.error(f"Error fetching Anikoto recent anime: {e}")
            return []

    async def get_series(self, series_id: int) -> Optional[dict]:
        """
        Fetches full anime details and episode embed URLs from /series/{id}.
        """
        cache_key = f"anikoto_series_{series_id}"
        cached = _get_from_cache(cache_key)
        if cached is not None:
            return cached

        try:
            url = f"{self.base_url}/series/{series_id}"
            resp = await self.client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok") and data.get("data"):
                    result = data["data"]
                    _set_cache(cache_key, result, ttl=900)
                    return result
            logger.warning(f"Anikoto series {series_id} returned HTTP {resp.status_code}")
            return None
        except Exception as e:
            logger.error(f"Error fetching Anikoto series {series_id}: {e}")
            return None

    async def match_anime_by_title(self, title: str) -> Optional[dict]:
        """
        Finds a matching anime from Anikoto's recent catalog by comparing normalized titles,
        alternative names, and slugs.
        """
        if not title:
            return None

        clean_query = _normalize_title(title)
        cache_key = f"anikoto_match_{clean_query}"
        cached = _get_from_cache(cache_key)
        if cached is not None:
            return cached

        # Check multi-page recent anime feed
        recent_pages = await asyncio.gather(*[
            self.get_recent_anime(page=p, per_page=30) for p in range(1, 4)
        ])
        
        all_anime = [item for page_data in recent_pages for item in page_data]

        best_match = None
        for item in all_anime:
            item_title = _normalize_title(item.get("title", ""))
            item_alt = _normalize_title(item.get("alternative", ""))
            item_titles = _normalize_title(item.get("titles", ""))
            item_slug = (item.get("slug") or "").replace("-", " ")

            if clean_query == item_title or clean_query == item_alt:
                best_match = item
                break
            if clean_query in item_title or item_title in clean_query:
                best_match = item
                break
            if clean_query in item_titles or clean_query in item_slug:
                best_match = item
                break

        if best_match:
            _set_cache(cache_key, best_match, ttl=1800)
        return best_match

    async def get_anime_episode_embed(self, title: str, episode_number: int = 1, lang: str = "sub") -> Optional[str]:
        """
        Resolves an anime title and episode to an Anikoto embed URL (MegaPlay stream).
        """
        matched = await self.match_anime_by_title(title)
        if not matched or not matched.get("id"):
            return None

        series = await self.get_series(matched["id"])
        if not series:
            return None

        episodes = series.get("episodes", [])
        for ep in episodes:
            if ep.get("number") == episode_number:
                embed_urls = ep.get("embed_url", {})
                if lang == "dub" and embed_urls.get("dub"):
                    return embed_urls["dub"]
                return embed_urls.get("sub") or embed_urls.get("dub")

        # Fallback to first episode if matching episode number not explicitly labeled
        if episodes:
            embed_urls = episodes[0].get("embed_url", {})
            return embed_urls.get(lang) or embed_urls.get("sub") or embed_urls.get("dub")

        return None

anikoto_service = AnikotoService()
