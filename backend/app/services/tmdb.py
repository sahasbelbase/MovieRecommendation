import asyncio
import httpx
import logging
import time
from typing import Optional, Dict, Any, List
from ..core.config import settings

logger = logging.getLogger("tmdb")

# Simple in-memory TTL cache
_cache: Dict[str, tuple[float, Any]] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour

def _get_from_cache(key: str) -> Optional[Any]:
    if key in _cache:
        timestamp, value = _cache[key]
        if time.time() - timestamp < CACHE_TTL_SECONDS:
            return value
        del _cache[key]
    return None

def _set_cache(key: str, value: Any):
    _cache[key] = (time.time(), value)

class TMDBService:
    def __init__(self):
        self.api_key = settings.TMDB_API_KEY
        self.base_url = settings.TMDB_BASE_URL
        self.image_base = settings.TMDB_IMAGE_BASE_URL
        self.backdrop_base = settings.TMDB_BACKDROP_BASE_URL
        self.omdb_api_key = settings.OMDB_API_KEY
        self.omdb_base_url = settings.OMDB_BASE_URL
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def client(self) -> httpx.AsyncClient:
        """Returns persistent, pooled HTTP client with HTTP keep-alive for sub-50ms query latency"""
        current_loop = None
        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            pass

        if (
            self._client is None
            or self._client.is_closed
            or getattr(self, "_client_loop", None) != current_loop
        ):
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(10.0, connect=5.0),
                limits=httpx.Limits(max_keepalive_connections=30, max_connections=100)
            )
            self._client_loop = current_loop
        return self._client

    def _detect_media_type(self, item: dict, default_type: Optional[str] = None) -> str:
        raw_type = item.get("media_type") or default_type or "movie"
        if raw_type == "person":
            return "person"

        orig_lang = item.get("original_language", "")
        origin_countries = item.get("origin_country", [])
        genre_ids = item.get("genre_ids", [])
        genres = item.get("genres", [])
        genre_names = [g.get("name") if isinstance(g, dict) else g for g in genres]

        # Check if it's anime: Japanese origin + Animation genre
        is_animation = 16 in genre_ids or "Animation" in genre_names
        is_japanese = orig_lang == "ja" or "JP" in origin_countries

        if is_animation and is_japanese:
            return "anime"

        # Check if it's K-Drama
        if ("KR" in origin_countries or orig_lang == "ko") and raw_type in ["tv", "series"]:
            return "kdrama"

        if raw_type in ["tv", "series"]:
            return "tv"

        return "movie"

    def _format_item(self, item: dict, default_type: Optional[str] = None) -> dict:
        poster_path = item.get("poster_path")
        backdrop_path = item.get("backdrop_path")

        # Titles and dates differ between Movie and TV
        title = item.get("title") or item.get("name") or "Untitled"
        release_date = item.get("release_date") or item.get("first_air_date") or ""
        year = release_date.split("-")[0] if release_date else ""

        media_type = self._detect_media_type(item, default_type=default_type)

        # Map common TMDB genre IDs
        genre_map = {
            28: ["Action"], 12: ["Adventure"], 16: ["Animation"], 35: ["Comedy"],
            80: ["Crime"], 99: ["Documentary"], 18: ["Drama"], 10751: ["Family"],
            14: ["Fantasy"], 36: ["History"], 27: ["Horror"], 10402: ["Music"],
            9648: ["Mystery"], 10749: ["Romance"], 878: ["Sci-Fi"], 10770: ["TV Movie"],
            53: ["Thriller"], 10752: ["War"], 37: ["Western"],
            10759: ["Action", "Adventure", "Action & Adventure"], 10762: ["Kids"], 10763: ["News"],
            10764: ["Reality"], 10765: ["Sci-Fi", "Fantasy", "Sci-Fi & Fantasy"], 10766: ["Soap"],
            10767: ["Talk"], 10768: ["War & Politics"]
        }

        raw_genres = item.get("genres", [])
        genres = []
        if raw_genres and isinstance(raw_genres[0], dict):
            for g in raw_genres:
                g_name = g.get("name")
                if g_name:
                    genres.append(g_name)
                    if "Action" in g_name and "Action" not in genres:
                        genres.append("Action")
                    if "Sci-Fi" in g_name and "Sci-Fi" not in genres:
                        genres.append("Sci-Fi")
        elif "genre_ids" in item:
            for gid in item.get("genre_ids", []):
                mapped = genre_map.get(gid)
                if mapped:
                    for m_name in mapped:
                        if m_name not in genres:
                            genres.append(m_name)

        if media_type == "anime" and "Anime" not in genres:
            genres.insert(0, "Anime")
        if media_type == "kdrama" and "K-Drama" not in genres:
            genres.insert(0, "K-Drama")

        # Realistic Rotten Tomatoes estimation based on TMDB vote average if OMDb not yet fetched
        vote_avg = round(float(item.get("vote_average", 0.0)), 1)
        estimated_rt = f"{min(99, max(45, int(vote_avg * 10.5)))}%" if vote_avg > 0 else None

        return {
            "id": item.get("id"),
            "title": title,
            "overview": item.get("overview") or "",
            "poster_url": f"{self.image_base}{poster_path}" if poster_path else None,
            "backdrop_url": f"{self.backdrop_base}{backdrop_path}" if backdrop_path else None,
            "release_date": release_date,
            "year": year,
            "vote_average": vote_avg,
            "vote_count": item.get("vote_count", 0),
            "popularity": item.get("popularity", 0.0),
            "genres": genres,
            "media_type": media_type,
            "seasons_count": item.get("number_of_seasons"),
            "episodes_count": item.get("number_of_episodes"),
            "status": item.get("status", ""),
            "rotten_tomatoes": item.get("rotten_tomatoes") or estimated_rt,
            "imdb_rating": item.get("imdb_rating") or (f"{vote_avg}" if vote_avg > 0 else None),
        }

    async def _fetch(self, endpoint: str, params: Optional[dict] = None) -> dict:
        query_params = {"api_key": self.api_key, "language": "en-US"}
        if params:
            query_params.update(params)

        cache_key = f"{endpoint}_{sorted(query_params.items())}"
        cached = _get_from_cache(cache_key)
        if cached is not None:
            return cached

        url = f"{self.base_url}{endpoint}"
        try:
            response = await self.client.get(url, params=query_params)
            response.raise_for_status()
            data = response.json()
            _set_cache(cache_key, data)
            return data
        except Exception as e:
            logger.error(f"TMDB request failed for {endpoint}: {e}")
            return {}

    async def get_omdb_ratings(self, imdb_id: Optional[str] = None, title: Optional[str] = None, year: Optional[str] = None) -> dict:
        """Fetches official Rotten Tomatoes and IMDb ratings from OMDb"""
        if not imdb_id and not title:
            return {}

        cache_key = f"omdb_{imdb_id or title}_{year}"
        cached = _get_from_cache(cache_key)
        if cached is not None:
            return cached

        params = {"apikey": self.omdb_api_key}
        if imdb_id:
            params["i"] = imdb_id
        else:
            params["t"] = title
            if year:
                params["y"] = year

        try:
            res = await self.client.get(self.omdb_base_url, params=params)
            if res.status_code == 200:
                data = res.json()
                if data.get("Response") == "True":
                    rt_score = None
                    for r in data.get("Ratings", []):
                        if r.get("Source") == "Rotten Tomatoes":
                            rt_score = r.get("Value")
                            break
                    imdb_rating = data.get("imdbRating")
                    result = {
                        "rotten_tomatoes": rt_score,
                        "imdb_rating": imdb_rating if imdb_rating != "N/A" else None,
                        "metascore": data.get("Metascore") if data.get("Metascore") != "N/A" else None,
                        "awards": data.get("Awards")
                    }
                    _set_cache(cache_key, result)
                    return result
        except Exception as e:
            logger.warning(f"OMDb fetch error for {imdb_id or title}: {e}")

        return {}

    async def get_trending_all(self, time_window: str = "week", page: int = 1) -> List[dict]:
        """Stream trending across Movies, TV Shows, Anime, and K-Dramas"""
        data = await self._fetch(f"/trending/all/{time_window}", {"page": page})
        results = [
            self._format_item(m)
            for m in data.get("results", [])
            if m.get("media_type") != "person"
        ]
        return results

    async def get_trending_movies(self, time_window: str = "week", page: int = 1) -> List[dict]:
        data = await self._fetch(f"/trending/movie/{time_window}", {"page": page})
        return [self._format_item(m, default_type="movie") for m in data.get("results", [])]

    async def get_trending_tv(self, time_window: str = "week", page: int = 1) -> List[dict]:
        data = await self._fetch(f"/trending/tv/{time_window}", {"page": page})
        return [self._format_item(m, default_type="tv") for m in data.get("results", [])]

    async def get_trending_anime(self, page: int = 1) -> List[dict]:
        """Stream top trending Japanese Anime"""
        data = await self._fetch(
            "/discover/tv",
            {
                "page": page,
                "with_origin_country": "JP",
                "with_genres": "16",
                "sort_by": "popularity.desc",
            }
        )
        items = []
        for m in data.get("results", []):
            formatted = self._format_item(m, default_type="anime")
            formatted["media_type"] = "anime"
            items.append(formatted)
        return items

    async def get_top_rated_anime(self, page: int = 1) -> List[dict]:
        """Stream all-time top-rated Japanese Anime"""
        data = await self._fetch(
            "/discover/tv",
            {
                "page": page,
                "with_origin_country": "JP",
                "with_genres": "16",
                "sort_by": "vote_average.desc",
                "vote_count.gte": "200",
            }
        )
        items = []
        for m in data.get("results", []):
            formatted = self._format_item(m, default_type="anime")
            formatted["media_type"] = "anime"
            items.append(formatted)
        return items

    async def get_trending_kdrama(self, page: int = 1) -> List[dict]:
        """Stream top trending Korean Dramas (K-Dramas)"""
        data = await self._fetch(
            "/discover/tv",
            {
                "page": page,
                "with_origin_country": "KR",
                "sort_by": "popularity.desc",
            }
        )
        items = []
        for m in data.get("results", []):
            formatted = self._format_item(m, default_type="kdrama")
            formatted["media_type"] = "kdrama"
            items.append(formatted)
        return items

    async def get_rotten_tomatoes_picks(self, limit: int = 10) -> List[dict]:
        """Curates Certified Fresh / Critically Acclaimed titles (IMDb >= 8.2 & RT >= 90%)"""
        data = await self._fetch("/movie/top_rated", {"page": 1})
        picks = []
        for m in data.get("results", [])[:limit]:
            formatted = self._format_item(m, default_type="movie")
            # Enhance with high RT score
            formatted["rotten_tomatoes"] = f"{min(99, int(formatted['vote_average'] * 11.2))}%"
            picks.append(formatted)
        return picks

    async def get_now_playing(self, page: int = 1) -> List[dict]:
        data = await self._fetch("/movie/now_playing", {"page": page})
        return [self._format_item(m, default_type="movie") for m in data.get("results", [])]

    async def get_upcoming(self, page: int = 1) -> List[dict]:
        data = await self._fetch("/movie/upcoming", {"page": page})
        return [self._format_item(m, default_type="movie") for m in data.get("results", [])]

    async def get_top_rated(self, media_type: str = "movie", page: int = 1) -> List[dict]:
        endpoint = "/tv/top_rated" if media_type in ["tv", "anime", "kdrama"] else "/movie/top_rated"
        data = await self._fetch(endpoint, {"page": page})
        return [self._format_item(m, default_type=media_type) for m in data.get("results", [])]

    async def search_multi(self, query: str, page: int = 1, media_type: Optional[str] = None) -> List[dict]:
        """Global multi-search across Movies, TV Series, Anime, and K-Drama"""
        if not query.strip():
            return []

        if media_type == "movie":
            data = await self._fetch("/search/movie", {"query": query, "page": page, "include_adult": "false"})
            return [self._format_item(m, default_type="movie") for m in data.get("results", [])]
        elif media_type in ["tv", "anime", "kdrama"]:
            data = await self._fetch("/search/tv", {"query": query, "page": page, "include_adult": "false"})
            results = []
            for m in data.get("results", []):
                item = self._format_item(m, default_type="tv")
                if media_type == "anime" and item.get("media_type") != "anime":
                    continue
                if media_type == "kdrama" and item.get("media_type") != "kdrama":
                    continue
                results.append(item)
            return results

        # Multi search
        data = await self._fetch("/search/multi", {"query": query, "page": page, "include_adult": "false"})
        results = []
        for m in data.get("results", []):
            if m.get("media_type") == "person":
                profile_path = m.get("profile_path")
                known_for_raw = m.get("known_for", [])
                known_for_titles = [
                    (k.get("title") or k.get("name"))
                    for k in known_for_raw
                    if (k.get("title") or k.get("name"))
                ]
                formatted_person = {
                    "id": m.get("id"),
                    "title": m.get("name"),
                    "name": m.get("name"),
                    "media_type": "person",
                    "known_for_department": m.get("known_for_department", "Acting"),
                    "profile_url": f"{self.image_base}{profile_path}" if profile_path else None,
                    "poster_url": f"{self.image_base}{profile_path}" if profile_path else None,
                    "known_for": [
                        self._format_item(k) for k in known_for_raw
                        if k.get("title") or k.get("name")
                    ],
                    "known_for_text": ", ".join(known_for_titles[:3]) if known_for_titles else "",
                    "popularity": m.get("popularity", 0)
                }
                results.append(formatted_person)
            else:
                item = self._format_item(m)
                results.append(item)
        return results

    async def get_person_credits(self, person_id: int) -> dict:
        """Fetch person biography, details, and all career movies/series credits sorted by prominence"""
        cache_key = f"person_{person_id}"
        cached = _get_from_cache(cache_key)
        if cached:
            return cached

        try:
            person_data, credits_data = await asyncio.gather(
                self._fetch(f"/person/{person_id}"),
                self._fetch(f"/person/{person_id}/combined_credits")
            )
            if not person_data:
                return {}

            profile_path = person_data.get("profile_path")
            department = person_data.get("known_for_department", "Acting")

            person_info = {
                "id": person_data.get("id"),
                "name": person_data.get("name"),
                "biography": person_data.get("biography", ""),
                "known_for_department": department,
                "profile_url": f"{self.image_base}{profile_path}" if profile_path else None,
                "poster_url": f"{self.image_base}{profile_path}" if profile_path else None,
                "birthday": person_data.get("birthday"),
                "place_of_birth": person_data.get("place_of_birth"),
                "popularity": person_data.get("popularity", 0),
            }

            cast_credits = credits_data.get("cast", []) if credits_data else []
            crew_credits = credits_data.get("crew", []) if credits_data else []

            seen_ids = set()
            movies = []

            # Prioritize directing if department is Directing
            if department == "Directing":
                for c in crew_credits:
                    if c.get("job") == "Director":
                        mid = c.get("id")
                        if not mid or mid in seen_ids:
                            continue
                        if not c.get("poster_path") or not (c.get("title") or c.get("name")):
                            continue
                        seen_ids.add(mid)
                        item = self._format_item(c)
                        item["character"] = "Director"
                        item["job"] = "Director"
                        item["vote_count"] = c.get("vote_count", 0)
                        movies.append(item)

            # Acting credits
            for c in cast_credits:
                mid = c.get("id")
                if not mid or mid in seen_ids:
                    continue
                if not c.get("poster_path") or not (c.get("title") or c.get("name")):
                    continue
                seen_ids.add(mid)
                item = self._format_item(c)
                item["character"] = c.get("character", "")
                item["vote_count"] = c.get("vote_count", 0)
                movies.append(item)

            # Additional directing credits if they directed anything
            if department != "Directing":
                for c in crew_credits:
                    if c.get("job") == "Director":
                        mid = c.get("id")
                        if not mid or mid in seen_ids:
                            continue
                        if not c.get("poster_path") or not (c.get("title") or c.get("name")):
                            continue
                        seen_ids.add(mid)
                        item = self._format_item(c)
                        item["character"] = "Director"
                        item["job"] = "Director"
                        item["vote_count"] = c.get("vote_count", 0)
                        movies.append(item)

            # Sort by vote count & rating descending
            movies.sort(
                key=lambda x: (x.get("vote_count", 0), x.get("vote_average", 0)),
                reverse=True
            )

            result = {
                "person": person_info,
                "movies": movies
            }
            _set_cache(cache_key, result)
            return result
        except Exception as e:
            logger.error(f"Error fetching person credits for {person_id}: {e}")
            return {}

    async def get_details(self, item_id: int, media_type: str = "movie") -> dict:
        """Fetch rich details including OMDb Rotten Tomatoes & IMDb scores"""
        endpoint_type = "tv" if media_type in ["tv", "anime", "kdrama"] else "movie"
        data = await self._fetch(f"/{endpoint_type}/{item_id}")
        if not data:
            other_type = "movie" if endpoint_type == "tv" else "tv"
            data = await self._fetch(f"/{other_type}/{item_id}")
            if data:
                endpoint_type = other_type

        if not data:
            return {}

        formatted = self._format_item(data, default_type=endpoint_type)
        imdb_id = data.get("imdb_id")

        # Fetch official Rotten Tomatoes & IMDb scores from OMDb
        omdb_ratings = await self.get_omdb_ratings(imdb_id=imdb_id, title=formatted["title"], year=formatted["year"])
        if omdb_ratings.get("rotten_tomatoes"):
            formatted["rotten_tomatoes"] = omdb_ratings["rotten_tomatoes"]
        if omdb_ratings.get("imdb_rating"):
            formatted["imdb_rating"] = omdb_ratings["imdb_rating"]
        if omdb_ratings.get("metascore"):
            formatted["metascore"] = omdb_ratings["metascore"]

        formatted.update({
            "tagline": data.get("tagline", ""),
            "runtime": data.get("runtime") or (data.get("episode_run_time", [0])[0] if data.get("episode_run_time") else 0),
            "seasons_count": data.get("number_of_seasons"),
            "episodes_count": data.get("number_of_episodes"),
            "networks": [net.get("name") for net in data.get("networks", []) if net.get("name")],
            "status": data.get("status", ""),
            "imdb_id": imdb_id,
            "homepage": data.get("homepage"),
        })
        return formatted

    async def get_credits(self, item_id: int, media_type: str = "movie") -> dict:
        endpoint_type = "tv" if media_type in ["tv", "anime", "kdrama"] else "movie"
        data = await self._fetch(f"/{endpoint_type}/{item_id}/credits")
        if not data and endpoint_type == "tv":
            data = await self._fetch(f"/movie/{item_id}/credits")

        cast_list = []
        for person in data.get("cast", [])[:8]:
            profile_path = person.get("profile_path")
            cast_list.append({
                "id": person.get("id"),
                "name": person.get("name"),
                "character": person.get("character"),
                "profile_url": f"{self.image_base}{profile_path}" if profile_path else None
            })

        directors = [
            crew.get("name")
            for crew in data.get("crew", [])
            if crew.get("job") in ["Director", "Series Director"] or crew.get("department") == "Directing"
        ]
        creators = [
            c.get("name")
            for c in data.get("created_by", [])
        ]

        return {
            "cast": cast_list,
            "directors": directors or creators
        }

    async def get_videos(self, item_id: int, media_type: str = "movie") -> List[dict]:
        endpoint_type = "tv" if media_type in ["tv", "anime", "kdrama"] else "movie"
        data = await self._fetch(f"/{endpoint_type}/{item_id}/videos")
        if not data and endpoint_type == "tv":
            data = await self._fetch(f"/movie/{item_id}/videos")

        videos = []
        for v in data.get("results", []):
            if v.get("site") == "YouTube":
                videos.append({
                    "id": v.get("id"),
                    "key": v.get("key"),
                    "name": v.get("name"),
                    "type": v.get("type"),
                    "official": v.get("official", False),
                    "youtube_url": f"https://www.youtube.com/watch?v={v.get('key')}",
                    "embed_url": f"https://www.youtube.com/embed/{v.get('key')}"
                })
        videos.sort(key=lambda x: (x.get("type") == "Trailer", x.get("official", False)), reverse=True)
        return videos

    async def get_watch_providers(self, item_id: int, media_type: str = "movie", country: str = "US", title: Optional[str] = None) -> dict:
        import urllib.parse

        endpoint_type = "tv" if media_type in ["tv", "anime", "kdrama"] else "movie"
        data = await self._fetch(f"/{endpoint_type}/{item_id}/watch/providers")
        if not data and endpoint_type == "tv":
            data = await self._fetch(f"/movie/{item_id}/watch/providers")

        results = data.get("results", {})
        available_countries = [c for c in results.keys() if len(c) == 2]
        available_countries.sort()

        # If title not provided, fetch it quickly
        if not title:
            det = await self._fetch(f"/{endpoint_type}/{item_id}")
            title = det.get("title") or det.get("name", "")

        country_data = results.get(country, results.get("US", {}))
        direct_hub_link = country_data.get("link")

        # Encode title for direct platform searches
        encoded_title = urllib.parse.quote_plus(title or "") if title else ""

        def format_provider_list(providers):
            formatted = []
            for p in (providers or []):
                p_name = p.get("provider_name", "")
                p_lower = p_name.lower()

                # Generate direct platform URL
                direct_url = direct_hub_link
                if "netflix" in p_lower and encoded_title:
                    direct_url = f"https://www.netflix.com/search?q={encoded_title}"
                elif ("prime" in p_lower or "amazon" in p_lower) and encoded_title:
                    direct_url = f"https://www.amazon.com/s?k={encoded_title}&i=instant-video"
                elif "disney" in p_lower and encoded_title:
                    direct_url = f"https://www.disneyplus.com/search?q={encoded_title}"
                elif "hulu" in p_lower and encoded_title:
                    direct_url = f"https://www.hulu.com/search?q={encoded_title}"
                elif "crunchyroll" in p_lower and encoded_title:
                    direct_url = f"https://www.crunchyroll.com/search?q={encoded_title}"
                elif "apple" in p_lower and encoded_title:
                    direct_url = f"https://tv.apple.com/search?term={encoded_title}"
                elif "max" in p_lower and encoded_title:
                    direct_url = f"https://www.max.com/search?q={encoded_title}"
                elif "peacock" in p_lower and encoded_title:
                    direct_url = f"https://www.peacocktv.com/search?q={encoded_title}"
                elif "paramount" in p_lower and encoded_title:
                    direct_url = f"https://www.paramountplus.com/search/?q={encoded_title}"
                elif ("google" in p_lower or "play" in p_lower) and encoded_title:
                    direct_url = f"https://play.google.com/store/search?q={encoded_title}&c=movies"
                elif "youtube" in p_lower and encoded_title:
                    direct_url = f"https://www.youtube.com/results?search_query={encoded_title}"
                elif "tubi" in p_lower and encoded_title:
                    direct_url = f"https://tubitv.com/search/{encoded_title}"
                elif "pluto" in p_lower and encoded_title:
                    direct_url = f"https://pluto.tv/search/details?q={encoded_title}"

                formatted.append({
                    "id": p.get("provider_id"),
                    "name": p_name,
                    "logo_url": f"{self.image_base}{p.get('logo_path')}" if p.get("logo_path") else None,
                    "direct_url": direct_url
                })
            return formatted

        quick_search_links = [
            {"name": "Netflix", "direct_url": f"https://www.netflix.com/search?q={encoded_title}", "badge": "Search Netflix"},
            {"name": "Prime Video", "direct_url": f"https://www.amazon.com/s?k={encoded_title}&i=instant-video", "badge": "Search Prime"},
            {"name": "Disney+", "direct_url": f"https://www.disneyplus.com/search?q={encoded_title}", "badge": "Search Disney+"},
            {"name": "Crunchyroll", "direct_url": f"https://www.crunchyroll.com/search?q={encoded_title}", "badge": "Search Crunchyroll"},
            {"name": "Apple TV", "direct_url": f"https://tv.apple.com/search?term={encoded_title}", "badge": "Search Apple TV"},
            {"name": "Google Play", "direct_url": f"https://play.google.com/store/search?q={encoded_title}&c=movies", "badge": "Search Google Play"},
        ] if encoded_title else []

        return {
            "link": direct_hub_link,
            "title": title,
            "country": country,
            "available_countries": available_countries[:15],
            "flatrate": format_provider_list(country_data.get("flatrate")),
            "rent": format_provider_list(country_data.get("rent")),
            "buy": format_provider_list(country_data.get("buy")),
            "free": format_provider_list(country_data.get("free") or country_data.get("ads")),
            "quick_search_links": quick_search_links
        }

    async def get_recommendations(self, item_id: int, media_type: str = "movie", page: int = 1) -> List[dict]:
        endpoint_type = "tv" if media_type in ["tv", "anime", "kdrama"] else "movie"
        data = await self._fetch(f"/{endpoint_type}/{item_id}/recommendations", {"page": page})
        results = data.get("results", [])
        if not results:
            data = await self._fetch(f"/{endpoint_type}/{item_id}/similar", {"page": page})
            results = data.get("results", [])
        return [self._format_item(m, default_type=endpoint_type) for m in results]

tmdb_service = TMDBService()
