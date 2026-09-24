import asyncio
import logging
import time
from typing import List, Optional, Dict, Any
from .vector_store import vector_store
from .tmdb import tmdb_service
from .user_data import user_data_service

logger = logging.getLogger("recommender")

# In-memory TTL cache for public discovery feeds (10 minute TTL)
_guest_feed_cache: Dict[str, tuple[float, dict]] = {}
GUEST_FEED_TTL = 600  # 10 minutes

# Iconic seed catalog for taste calibration swipe deck
ICONIC_SWIPE_SEEDS = [
    # Movies
    {"id": 278, "title": "The Shawshank Redemption", "media_type": "movie"},
    {"id": 27205, "title": "Inception", "media_type": "movie"},
    {"id": 155, "title": "The Dark Knight", "media_type": "movie"},
    {"id": 157336, "title": "Interstellar", "media_type": "movie"},
    {"id": 129, "title": "Spirited Away", "media_type": "movie"},
    {"id": 550, "title": "Fight Club", "media_type": "movie"},
    {"id": 238, "title": "The Godfather", "media_type": "movie"},
    {"id": 496243, "title": "Parasite", "media_type": "movie"},
    {"id": 372058, "title": "Your Name.", "media_type": "movie"},
    {"id": 389, "title": "12 Angry Men", "media_type": "movie"},
    # TV Series
    {"id": 1396, "title": "Breaking Bad", "media_type": "tv"},
    {"id": 1399, "title": "Game of Thrones", "media_type": "tv"},
    {"id": 66732, "title": "Stranger Things", "media_type": "tv"},
    {"id": 87108, "title": "Chernobyl", "media_type": "tv"},
    {"id": 93405, "title": "Squid Game", "media_type": "tv"},
    # Anime
    {"id": 1429, "title": "Attack on Titan", "media_type": "anime"},
    {"id": 85937, "title": "Demon Slayer: Kimetsu no Yaiba", "media_type": "anime"},
    {"id": 46260, "title": "Naruto Shippuden", "media_type": "anime"},
    {"id": 30984, "title": "Bleach", "media_type": "anime"},
    {"id": 127532, "title": "Solo Leveling", "media_type": "anime"},
    # K-Drama
    {"id": 96648, "title": "Crash Landing on You", "media_type": "kdrama"},
    {"id": 117376, "title": "Vincenzo", "media_type": "kdrama"},
    {"id": 67915, "title": "Goblin", "media_type": "kdrama"},
]

class RecommenderService:
    def __init__(self):
        self.vector_store = vector_store
        self.tmdb = tmdb_service
        self.user_data = user_data_service

    async def _enrich_with_tmdb_posters(self, items: List[dict]) -> List[dict]:
        """Items fetched via TMDB API already have posters. Ensures fallback poster_url if missing."""
        for m in items:
            if not m.get("poster_url") and m.get("id"):
                m["poster_url"] = f"https://image.tmdb.org/t/p/w500/{m['id']}.jpg"
        return items

    async def get_swipe_deck(self, user_id: str, limit: int = 20, genre: Optional[str] = None) -> List[dict]:
        """
        Returns a curated deck of iconic movies, series, and anime for taste calibration in Swipe Mode.
        Strictly excludes any titles the user has already swiped, skipped, or marked as watched.
        Supports filtering by specific genre or format (Anime, Action, Sci-Fi, K-Drama, etc.).
        """
        excluded_ids = set(await self.user_data.get_all_excluded_ids(user_id))
        deck = []

        if genre and genre.lower() == "anime":
            trending_anime, top_anime = await asyncio.gather(
                self.tmdb.get_trending_anime(pages=3),
                self.tmdb.get_top_rated_anime(pages=3)
            )
            for item in trending_anime + top_anime:
                if item["id"] not in excluded_ids and not any(d["id"] == item["id"] for d in deck):
                    deck.append(item)
                if len(deck) >= limit:
                    break
            return deck

        if genre and genre.lower() in ["k-drama", "kdrama"]:
            kdramas = await self.tmdb.get_trending_kdrama(pages=3)
            for item in kdramas:
                if item["id"] not in excluded_ids and not any(d["id"] == item["id"] for d in deck):
                    deck.append(item)
                if len(deck) >= limit:
                    break
            return deck

        # Standard iconic seeds
        unwatched_seeds = [s for s in ICONIC_SWIPE_SEEDS if s["id"] not in excluded_ids]
        for item in unwatched_seeds:
            details = await self.tmdb.get_details(item["id"], media_type=item["media_type"], include_omdb=False)
            if details:
                if genre and genre.lower() != "all":
                    item_genres = [g.lower() for g in details.get("genres", [])]
                    if not any(genre.lower() in g for g in item_genres):
                        continue
                deck.append(details)
            if len(deck) >= limit:
                break

        if len(deck) < 8:
            trending = await self.tmdb.get_trending_all(time_window="week", pages=3)
            for t in trending:
                if t["id"] not in excluded_ids and not any(d["id"] == t["id"] for d in deck):
                    if genre and genre.lower() != "all":
                        t_genres = [g.lower() for g in t.get("genres", [])]
                        if not any(genre.lower() in g for g in t_genres):
                            continue
                    deck.append(t)
                if len(deck) >= limit:
                    break

        return deck

    async def get_similar(self, item_id: int, media_type: str = "movie", user_id: Optional[str] = None, limit: int = 12) -> List[dict]:
        """
        Recommends similar movies, TV series, or Anime via direct TMDB API query.
        Strictly excludes any item in the user's watched or skipped list.
        """
        excluded_ids = []
        if user_id:
            excluded_ids = await self.user_data.get_all_excluded_ids(user_id)

        tmdb_recs = await self.tmdb.get_recommendations(item_id, media_type=media_type)
        excluded_set = set(excluded_ids) | {item_id}
        results = [m for m in tmdb_recs if m["id"] not in excluded_set]
        return results[:limit]

    async def get_tailored_feed(self, user_id: str, media_type: Optional[str] = None, genre: Optional[str] = None) -> Dict[str, Any]:
        """
        Generates personalized FYP recommendation feed for authenticated user via live API calls.
        Multi-page TMDB fetching ensures unwatched titles are ALWAYS found even for power users (200+ titles).
        """
        watched_list, all_excluded_list, not_interested_list = await asyncio.gather(
            self.user_data.get_watched_list(user_id),
            self.user_data.get_all_excluded_ids(user_id),
            self.user_data.get_not_interested_list(user_id)
        )
        all_excluded_ids = set(all_excluded_list)

        # Handle specific genre filter (e.g. "Comedy", "Sci-Fi", "Action", etc.)
        if genre and genre.strip().lower() != "all":
            clean_g = genre.strip()
            target_type = media_type or "all"
            pop_items, top_items = await asyncio.gather(
                self.tmdb.discover_by_genre(clean_g, media_type=target_type, sort_by="popularity.desc"),
                self.tmdb.discover_by_genre(clean_g, media_type=target_type, sort_by="vote_average.desc")
            )
            unwatched_pop = [m for m in pop_items if m["id"] not in all_excluded_ids]
            seen_pop_ids = {m["id"] for m in unwatched_pop}
            unwatched_top = [m for m in top_items if m["id"] not in all_excluded_ids and m["id"] not in seen_pop_ids]

            type_label = "Movies & Shows" if target_type == "all" else "Movies" if target_type == "movie" else "TV Series" if target_type == "tv" else "Anime"
            return {
                "is_cold_start": False,
                "needs_calibration": False,
                "watched_count": len(watched_list),
                "sections": [
                    {
                        "title": f"Trending {clean_g} {type_label}",
                        "subtitle": f"Popular {clean_g.lower()} titles streaming right now",
                        "movies": unwatched_pop[:12]
                    },
                    {
                        "title": f"Critically Acclaimed {clean_g}",
                        "subtitle": f"Highest-rated {clean_g.lower()} titles (IMDb & Rotten Tomatoes Elite)",
                        "movies": unwatched_top[:12]
                    }
                ]
            }

        # Explicit Anime category
        if media_type == "anime":
            trending_anime, top_anime = await asyncio.gather(
                self.tmdb.get_trending_anime(pages=3),
                self.tmdb.get_top_rated_anime(pages=3)
            )
            unwatched_trending = [m for m in trending_anime if m["id"] not in all_excluded_ids]
            unwatched_top = [m for m in top_anime if m["id"] not in all_excluded_ids]
            return {
                "is_cold_start": False,
                "needs_calibration": len(watched_list) < 3,
                "watched_count": len(watched_list),
                "sections": [
                    {"title": "Anime For You", "subtitle": "Curated Japanese animation based on your taste", "movies": unwatched_trending[:12]},
                    {"title": "All-Time Masterpiece Anime", "subtitle": "Highest rated anime you haven't watched yet", "movies": unwatched_top[:12]},
                ]
            }

        # Explicit TV category
        if media_type == "tv":
            trending_tv, top_tv = await asyncio.gather(
                self.tmdb.get_trending_tv(pages=3),
                self.tmdb.get_top_rated(media_type="tv", pages=3)
            )
            unwatched_tv = [m for m in trending_tv if m["id"] not in all_excluded_ids]
            unwatched_top_tv = [m for m in top_tv if m["id"] not in all_excluded_ids]
            return {
                "is_cold_start": False,
                "needs_calibration": len(watched_list) < 3,
                "watched_count": len(watched_list),
                "sections": [
                    {"title": "Trending TV Series", "subtitle": "Top shows streaming this week", "movies": unwatched_tv[:12]},
                    {"title": "Critically Acclaimed Television", "subtitle": "Highest rated TV series (IMDb & RT)", "movies": unwatched_top_tv[:12]},
                ]
            }

        # Explicit Movies category
        if media_type == "movie":
            trending_movies, top_movies, rt_picks = await asyncio.gather(
                self.tmdb.get_trending_movies(pages=3),
                self.tmdb.get_top_rated(media_type="movie", pages=3),
                self.tmdb.get_rotten_tomatoes_picks(limit=30, pages=3)
            )
            unwatched_trending = [m for m in trending_movies if m["id"] not in all_excluded_ids]
            seen_movie_ids = {m["id"] for m in unwatched_trending}
            unwatched_top = [m for m in top_movies if m["id"] not in all_excluded_ids and m["id"] not in seen_movie_ids]
            unwatched_rt = [m for m in rt_picks if m["id"] not in all_excluded_ids and m["id"] not in seen_movie_ids]
            return {
                "is_cold_start": False,
                "needs_calibration": len(watched_list) < 3,
                "watched_count": len(watched_list),
                "sections": [
                    {"title": "Trending Feature Films", "subtitle": "Blockbusters and popular movies worldwide", "movies": unwatched_trending[:12]},
                    {"title": "Critically Acclaimed Cinema", "subtitle": "85%+ Rotten Tomatoes & IMDb Elite", "movies": unwatched_rt[:12]},
                    {"title": "All-Time Top Rated Movies", "subtitle": "Highest rated films you haven't watched yet", "movies": unwatched_top[:12]},
                ]
            }

        # Explicit Trending category (Dedicated Trending Now view)
        if media_type == "trending":
            trending_all, trending_movies, trending_tv, trending_anime = await asyncio.gather(
                self.tmdb.get_trending_all(time_window="day", pages=3),
                self.tmdb.get_trending_movies(time_window="day", pages=3),
                self.tmdb.get_trending_tv(time_window="day", pages=3),
                self.tmdb.get_trending_anime(pages=3)
            )
            unwatched_all = [m for m in trending_all if m["id"] not in all_excluded_ids]
            unwatched_movies = [m for m in trending_movies if m["id"] not in all_excluded_ids]
            unwatched_tv = [m for m in trending_tv if m["id"] not in all_excluded_ids]
            unwatched_anime = [m for m in trending_anime if m["id"] not in all_excluded_ids]
            return {
                "is_cold_start": False,
                "needs_calibration": len(watched_list) < 3,
                "watched_count": len(watched_list),
                "sections": [
                    {"title": "🔥 Top Trending Today", "subtitle": "Most watched movies and series streaming right now (Watched filtered)", "movies": unwatched_all[:18]},
                    {"title": "🎬 Trending Movies", "subtitle": "Top films buzzing worldwide today", "movies": unwatched_movies[:18]},
                    {"title": "📺 Trending TV Series", "subtitle": "Binge-worthy shows dominating screens right now", "movies": unwatched_tv[:18]},
                    {"title": "⚡ Trending Anime", "subtitle": "Top trending Japanese animation right now", "movies": unwatched_anime[:18]},
                ]
            }

        if len(watched_list) < 3:
            # Under-calibrated user: Return onboarding FYP prompt + top trending across 3 pages
            trending, anime, rt_picks = await asyncio.gather(
                self.tmdb.get_trending_all(time_window="day", pages=3),
                self.tmdb.get_trending_anime(pages=3),
                self.tmdb.get_rotten_tomatoes_picks(limit=25, pages=3)
            )
            unwatched_trending = [m for m in trending if m["id"] not in all_excluded_ids]
            unwatched_rt = [m for m in rt_picks if m["id"] not in all_excluded_ids]
            unwatched_anime = [m for m in anime if m["id"] not in all_excluded_ids]
            return {
                "is_cold_start": True,
                "needs_calibration": True,
                "watched_count": len(watched_list),
                "message": f"You've marked {len(watched_list)} titles. Swipe {3 - len(watched_list)} more to calibrate your personalized FYP!",
                "sections": [
                    {"title": "Trending Right Now", "subtitle": "Movies, Series & Anime", "movies": unwatched_trending[:12]},
                    {"title": "Rotten Tomatoes & IMDb Elite", "subtitle": "Critically acclaimed cinema (85%+ Fresh)", "movies": unwatched_rt[:12]},
                    {"title": "Top Anime Series", "subtitle": "High-rated animation", "movies": unwatched_anime[:12]},
                ]
            }

        # Analyze User Taste Profile
        genre_frequency = {}
        kdrama_count = 0
        anime_count = 0
        action_count = 0

        for item in watched_list:
            m_type = item.get("media_type", "movie")
            item_genres = item.get("genres", [])
            if m_type == "kdrama" or "K-Drama" in item_genres:
                kdrama_count += 1
            elif m_type == "anime" or "Anime" in item_genres:
                anime_count += 1

            for g in item_genres:
                genre_frequency[g] = genre_frequency.get(g, 0) + 1
                if g == "Action":
                    action_count += 1

        genre_negative_frequency = {}
        kdrama_negative_count = 0
        anime_negative_count = 0

        for item in not_interested_list:
            m_type = item.get("media_type", "movie")
            item_genres = item.get("genres", [])
            if m_type == "kdrama" or "K-Drama" in item_genres:
                kdrama_negative_count += 1
            if m_type == "anime" or "Anime" in item_genres:
                anime_negative_count += 1
            for g in item_genres:
                genre_negative_frequency[g] = genre_negative_frequency.get(g, 0) + 1

        top_genres = sorted(genre_frequency.items(), key=lambda x: x[1], reverse=True)
        primary_genre = top_genres[0][0] if top_genres else "Drama"

        # Favorites (rated >= 7 or most recently watched)
        favorites = [m for m in watched_list if m.get("rating") and float(m["rating"]) >= 7.0]
        if not favorites:
            favorites = watched_list[:5]

        # Fetch TMDB recommendations based on user's top favorites
        liked_movie_ids = [f["id"] for f in favorites if f.get("id")]
        tailored_movies = await self.vector_store.get_tailored_recommendations(
            liked_movie_ids=liked_movie_ids,
            excluded_ids=all_excluded_ids,
            limit=12
        )

        # Diverse anchor item similarity
        anchor_item = favorites[0]
        anchor_recs = await self.get_similar(
            anchor_item["id"],
            media_type=anchor_item.get("media_type", "movie"),
            user_id=user_id,
            limit=12
        )

        # Multi-page Rotten Tomatoes & IMDb Elite picks (3 pages = 60 candidates)
        rt_picks = await self.tmdb.get_rotten_tomatoes_picks(limit=30, pages=3)
        unwatched_rt = [m for m in rt_picks if m["id"] not in all_excluded_ids][:12]

        sections = []

        if tailored_movies:
            sections.append({
                "title": "FYP: Tailored For You",
                "subtitle": f"Curated recommendations based on your {len(watched_list)} watched titles",
                "movies": tailored_movies
            })

        if anchor_recs:
            sections.append({
                "title": f"Because You Watched {anchor_item.get('title')}",
                "subtitle": f"Similar to your favorite {anchor_item.get('media_type', 'movie').upper()}",
                "movies": anchor_recs
            })

        # K-Drama curation
        is_kdrama_rejected = kdrama_negative_count >= 4 or (kdrama_count <= 1 and kdrama_negative_count >= 2)
        if (kdrama_count >= 2 or primary_genre == "Romance") and not is_kdrama_rejected:
            kdrama_recs = await self.tmdb.get_trending_kdrama(pages=3)
            unwatched_kdrama = [m for m in kdrama_recs if m["id"] not in all_excluded_ids][:12]
            if unwatched_kdrama:
                sections.append({
                    "title": "Because You Watched K-Drama",
                    "subtitle": "Emotional storylines & character-driven series from Korea",
                    "movies": unwatched_kdrama
                })

        # Anime curation
        is_anime_rejected = anime_negative_count >= 5 or (anime_count <= 1 and anime_negative_count >= 3)
        if not is_anime_rejected:
            anime_recs = await self.tmdb.get_trending_anime(pages=3)
            unwatched_anime = [m for m in anime_recs if m["id"] not in all_excluded_ids][:12]
            if unwatched_anime:
                anime_title = "Anime For You" if anime_count > 0 else "Top-Rated Anime Series"
                anime_sub = "Top series matching your animation viewing history" if anime_count > 0 else "Critically acclaimed Japanese animation"
                sections.append({
                    "title": anime_title,
                    "subtitle": anime_sub,
                    "movies": unwatched_anime
                })

        # Multi-page Rotten Tomatoes section
        sections.append({
            "title": "Rotten Tomatoes & IMDb Elite",
            "subtitle": "Certified Fresh masterpieces you haven't watched yet (85%+ Fresh)",
            "movies": unwatched_rt
        })

        return {
            "is_cold_start": False,
            "needs_calibration": False,
            "watched_count": len(watched_list),
            "primary_genre": primary_genre,
            "sections": sections
        }

    async def get_guest_feed(self, media_type: Optional[str] = None, genre: Optional[str] = None) -> Dict[str, Any]:
        """
        Public discovery feed for guests across Movies, TV Series, and Anime,
        including Rotten Tomatoes Certified Fresh selections.
        Sub-millisecond latency via in-memory caching and parallel async TMDB querying.
        """
        clean_g = (genre or "").strip()
        if clean_g and clean_g.lower() != "all":
            target_type = media_type or "all"
            pop_items, top_items = await asyncio.gather(
                self.tmdb.discover_by_genre(clean_g, media_type=target_type, sort_by="popularity.desc"),
                self.tmdb.discover_by_genre(clean_g, media_type=target_type, sort_by="vote_average.desc")
            )
            seen_pop_ids = {m["id"] for m in pop_items}
            top_filtered = [m for m in top_items if m["id"] not in seen_pop_ids]
            type_label = "Movies & Shows" if target_type == "all" else "Movies" if target_type == "movie" else "TV Series" if target_type == "tv" else "Anime"
            return {
                "is_guest": True,
                "sections": [
                    {
                        "title": f"Trending {clean_g} {type_label}",
                        "subtitle": f"Popular {clean_g.lower()} titles right now",
                        "movies": pop_items[:12]
                    },
                    {
                        "title": f"Critically Acclaimed {clean_g}",
                        "subtitle": f"Highest-rated {clean_g.lower()} titles",
                        "movies": top_filtered[:12]
                    }
                ]
            }

        cache_key = f"guest_feed_{media_type or 'all'}"
        if cache_key in _guest_feed_cache:
            ts, val = _guest_feed_cache[cache_key]
            if time.time() - ts < GUEST_FEED_TTL:
                return val

        if media_type == "anime":
            anime, top_anime = await asyncio.gather(
                self.tmdb.get_trending_anime(pages=3),
                self.tmdb.get_top_rated_anime(pages=3)
            )
            result = {
                "is_guest": True,
                "sections": [
                    {"title": "Top Trending Anime", "subtitle": "Most popular Japanese animation right now", "movies": anime[:12]},
                    {"title": "All-Time Masterpiece Anime", "subtitle": "Highest rated Japanese animation (IMDb & Critic Elite)", "movies": top_anime[:12]},
                ]
            }
            _guest_feed_cache[cache_key] = (time.time(), result)
            return result

        elif media_type == "tv":
            tv, top_tv = await asyncio.gather(
                self.tmdb.get_trending_tv(pages=3),
                self.tmdb.get_top_rated(media_type="tv", pages=3)
            )
            result = {
                "is_guest": True,
                "sections": [
                    {"title": "Trending TV Series", "subtitle": "Most watched shows this week", "movies": tv[:12]},
                    {"title": "Highest Rated TV Series (IMDb & RT Elite)", "subtitle": "Critically acclaimed television", "movies": top_tv[:12]},
                ]
            }
            _guest_feed_cache[cache_key] = (time.time(), result)
            return result

        elif media_type == "movie":
            rt_picks, trending_movies, now_playing = await asyncio.gather(
                self.tmdb.get_rotten_tomatoes_picks(limit=15, pages=3),
                self.tmdb.get_trending_movies(pages=3),
                self.tmdb.get_now_playing()
            )
            result = {
                "is_guest": True,
                "sections": [
                    {"title": "Rotten Tomatoes & IMDb Certified Fresh", "subtitle": "85%+ Fresh critical favorites", "movies": rt_picks[:12]},
                    {"title": "Trending Movies", "subtitle": "Popular films worldwide", "movies": trending_movies[:12]},
                    {"title": "In Theaters & Fresh Cinema", "subtitle": "Current 2025–2026 releases", "movies": now_playing[:12]},
                ]
            }
            _guest_feed_cache[cache_key] = (time.time(), result)
            return result

        elif media_type == "trending":
            trending_all, trending_movies, trending_tv, trending_anime = await asyncio.gather(
                self.tmdb.get_trending_all(time_window="day", pages=3),
                self.tmdb.get_trending_movies(time_window="day", pages=3),
                self.tmdb.get_trending_tv(time_window="day", pages=3),
                self.tmdb.get_trending_anime(pages=3)
            )
            result = {
                "is_guest": True,
                "sections": [
                    {"title": "🔥 Top Trending Today", "subtitle": "Most watched movies and series streaming right now", "movies": trending_all[:18]},
                    {"title": "🎬 Trending Movies", "subtitle": "Top films buzzing worldwide today", "movies": trending_movies[:18]},
                    {"title": "📺 Trending TV Series", "subtitle": "Binge-worthy shows dominating screens right now", "movies": trending_tv[:18]},
                    {"title": "⚡ Trending Anime", "subtitle": "Top trending Japanese animation right now", "movies": trending_anime[:18]},
                ]
            }
            _guest_feed_cache[cache_key] = (time.time(), result)
            return result

        # Combined "All" Feed - run all 5 requests concurrently in parallel
        trending_all, rt_picks, anime, tv = await asyncio.gather(
            self.tmdb.get_trending_all(time_window="day", pages=3),
            self.tmdb.get_rotten_tomatoes_picks(limit=15, pages=3),
            self.tmdb.get_trending_anime(pages=3),
            self.tmdb.get_trending_tv(pages=3)
        )

        result = {
            "is_guest": True,
            "sections": [
                {"title": "Trending Across Movies, TV & Anime", "subtitle": "What the world is streaming right now", "movies": trending_all[:12]},
                {"title": "Rotten Tomatoes & IMDb Certified Fresh", "subtitle": "Top critic & audience scores (85%+ Fresh)", "movies": rt_picks[:12]},
                {"title": "Top Trending Anime", "subtitle": "Essential & fresh Japanese animation", "movies": anime[:12]},
                {"title": "Popular TV Series", "subtitle": "Drama, Sci-Fi, and mystery series", "movies": tv[:12]},
            ]
        }
        _guest_feed_cache[cache_key] = (time.time(), result)
        return result

recommender_service = RecommenderService()
