import logging
from typing import List, Optional, Dict, Any
from .vector_store import vector_store
from .tmdb import tmdb_service
from .user_data import user_data_service

logger = logging.getLogger("recommender")

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
        """Ensures all items have high-resolution TMDB posters and RT scores"""
        for m in items:
            if not m.get("poster_url"):
                media_type = m.get("media_type", "movie")
                details = await self.tmdb.get_details(m["id"], media_type=media_type)
                if details:
                    if details.get("poster_url"):
                        m["poster_url"] = details["poster_url"]
                    if details.get("backdrop_url"):
                        m["backdrop_url"] = details["backdrop_url"]
                    if details.get("rotten_tomatoes"):
                        m["rotten_tomatoes"] = details["rotten_tomatoes"]
                    if details.get("imdb_rating"):
                        m["imdb_rating"] = details["imdb_rating"]
        return items

    async def get_swipe_deck(self, user_id: str, limit: int = 20) -> List[dict]:
        """
        Returns a curated deck of iconic movies, series, and anime for taste calibration.
        Strictly excludes any titles the user has already swiped or marked as watched.
        """
        watched_ids = set(await self.user_data.get_watched_ids(user_id))

        unwatched_seeds = [s for s in ICONIC_SWIPE_SEEDS if s["id"] not in watched_ids]

        deck = []
        for item in unwatched_seeds[:limit]:
            details = await self.tmdb.get_details(item["id"], media_type=item["media_type"])
            if details:
                deck.append(details)

        # If user has already swiped most seeds, pull top trending across all formats
        if len(deck) < 8:
            trending = await self.tmdb.get_trending_all(time_window="week")
            for t in trending:
                if t["id"] not in watched_ids and not any(d["id"] == t["id"] for d in deck):
                    deck.append(t)
                if len(deck) >= limit:
                    break

        return deck

    async def get_similar(self, item_id: int, media_type: str = "movie", user_id: Optional[str] = None, limit: int = 12) -> List[dict]:
        """
        Recommends similar movies, TV series, or Anime.
        Strictly excludes any item in the user's watched list.
        """
        excluded_ids = []
        if user_id:
            excluded_ids = await self.user_data.get_watched_ids(user_id)

        results = []

        if media_type in ["tv", "anime", "kdrama"]:
            tmdb_recs = await self.tmdb.get_recommendations(item_id, media_type=media_type)
            excluded_set = set(excluded_ids) | {item_id}
            results = [m for m in tmdb_recs if m["id"] not in excluded_set]
        else:
            # 1. Try vector store for movies
            results = self.vector_store.search_similar(item_id, excluded_ids=excluded_ids, limit=limit)
            if len(results) < 3:
                tmdb_recs = await self.tmdb.get_recommendations(item_id, media_type="movie")
                excluded_set = set(excluded_ids) | {item_id}
                fresh_recs = [m for m in tmdb_recs if m["id"] not in excluded_set]
                existing_ids = {r["id"] for r in results}
                for m in fresh_recs:
                    if m["id"] not in existing_ids:
                        results.append(m)
                    if len(results) >= limit:
                        break

        return await self._enrich_with_tmdb_posters(results[:limit])

    async def get_tailored_feed(self, user_id: str) -> Dict[str, Any]:
        """
        Generates personalized FYP recommendation feed for authenticated user.
        Adaptively detects tastes (e.g. K-Drama, Anime, skipping action, Rotten Tomatoes favorites)
        and strictly excludes all watched titles.
        """
        watched_list = await self.user_data.get_watched_list(user_id)
        watched_ids = [m["id"] for m in watched_list]

        if len(watched_list) < 3:
            # Under-calibrated user: Return onboarding FYP prompt + top trending
            trending = await self.tmdb.get_trending_all(time_window="day")
            anime = await self.tmdb.get_trending_anime()
            rt_picks = await self.tmdb.get_rotten_tomatoes_picks(limit=10)
            return {
                "is_cold_start": True,
                "needs_calibration": True,
                "watched_count": len(watched_list),
                "message": f"You've marked {len(watched_list)} titles. Swipe {3 - len(watched_list)} more to calibrate your personalized FYP!",
                "sections": [
                    {"title": "Trending Right Now", "subtitle": "Movies, Series & Anime", "movies": trending[:10]},
                    {"title": "Rotten Tomatoes & IMDb Elite", "subtitle": "Critically acclaimed cinema (85%+ Fresh)", "movies": rt_picks},
                    {"title": "Top Anime Series", "subtitle": "High-rated animation", "movies": anime[:10]},
                ]
            }

        # Analyze User Taste Profile
        genre_frequency = {}
        kdrama_count = 0
        anime_count = 0
        action_count = 0

        for item in watched_list:
            m_type = item.get("media_type", "movie")
            if m_type == "kdrama":
                kdrama_count += 1
            elif m_type == "anime":
                anime_count += 1

            for g in item.get("genres", []):
                genre_frequency[g] = genre_frequency.get(g, 0) + 1
                if g == "Action":
                    action_count += 1

        top_genres = sorted(genre_frequency.items(), key=lambda x: x[1], reverse=True)
        primary_genre = top_genres[0][0] if top_genres else "Drama"

        # Favorites (rated >= 7 or most recently watched)
        favorites = [m for m in watched_list if m.get("rating") and float(m["rating"]) >= 7.0]
        if not favorites:
            favorites = watched_list[:5]

        anchor_item = favorites[0]
        anchor_media_type = anchor_item.get("media_type", "movie")

        # 1. Tailored Vector Centroid (Movies)
        liked_movie_ids = [f["id"] for f in favorites if f.get("media_type", "movie") == "movie"]
        tailored_movies = []
        if liked_movie_ids:
            tailored_movies = self.vector_store.get_tailored_recommendations(
                liked_movie_ids=liked_movie_ids,
                excluded_ids=watched_ids,
                limit=10
            )
            tailored_movies = await self._enrich_with_tmdb_posters(tailored_movies)

        # 2. Anchor item similarity
        anchor_recs = await self.get_similar(anchor_item["id"], media_type=anchor_media_type, user_id=user_id, limit=10)

        # 3. Rotten Tomatoes & IMDb Elite Picks (Unwatched)
        rt_picks = await self.tmdb.get_rotten_tomatoes_picks(limit=15)
        unwatched_rt = [m for m in rt_picks if m["id"] not in set(watched_ids)][:10]

        # 4. Adaptive Taste Shifts:
        # If user watches K-drama / Romance / Drama and action is low -> recommend romantic / drama anime!
        sections = []

        if tailored_movies:
            sections.append({
                "title": "FYP: Tailored For You",
                "subtitle": f"Curated algorithm based on your {len(watched_list)} watched titles",
                "movies": tailored_movies
            })

        sections.append({
            "title": f"Because You Watched {anchor_item.get('title')}",
            "subtitle": f"Similar to your favorite {anchor_media_type.upper()}",
            "movies": anchor_recs
        })

        if kdrama_count > 0 or "Romance" in genre_frequency:
            # Taste transition: Show them Anime or K-Drama that matches their romance/drama taste!
            kdrama_recs = await self.tmdb.get_trending_kdrama()
            unwatched_kdrama = [m for m in kdrama_recs if m["id"] not in set(watched_ids)][:10]
            if unwatched_kdrama:
                sections.append({
                    "title": "Because You Love K-Drama & Romance",
                    "subtitle": "Emotional storylines & character-driven dramas",
                    "movies": unwatched_kdrama
                })

            # Transition to Anime with emotional/drama focus
            anime_recs = await self.tmdb.get_trending_anime()
            unwatched_anime = [m for m in anime_recs if m["id"] not in set(watched_ids)][:10]
            if unwatched_anime:
                sections.append({
                    "title": "Taste Transition: Story-Rich Anime For You",
                    "subtitle": "Intense character depth and emotional storytelling",
                    "movies": unwatched_anime
                })
        else:
            # General anime section
            anime_recs = await self.tmdb.get_trending_anime()
            unwatched_anime = [m for m in anime_recs if m["id"] not in set(watched_ids)][:10]
            sections.append({
                "title": "Anime You Haven't Seen",
                "subtitle": "Top rated Japanese animation",
                "movies": unwatched_anime
            })

        # Rotten Tomatoes Section
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

    async def get_guest_feed(self, media_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Public discovery feed for guests across Movies, TV Series, and Anime,
        including Rotten Tomatoes Certified Fresh selections.
        """
        rt_picks = await self.tmdb.get_rotten_tomatoes_picks(limit=10)

        if media_type == "anime":
            anime = await self.tmdb.get_trending_anime()
            return {
                "is_guest": True,
                "sections": [
                    {"title": "Top Trending Anime", "subtitle": "Most popular Japanese animation right now", "movies": anime},
                    {"title": "Certified Fresh Anime & Cinema", "subtitle": "Highest rated by critics and fans", "movies": rt_picks},
                ]
            }
        elif media_type == "tv":
            tv = await self.tmdb.get_trending_tv()
            top_tv = await self.tmdb.get_top_rated(media_type="tv")
            return {
                "is_guest": True,
                "sections": [
                    {"title": "Trending TV Series", "subtitle": "Most watched shows this week", "movies": tv[:10]},
                    {"title": "Highest Rated TV Series (IMDb & RT Elite)", "subtitle": "Critically acclaimed television", "movies": top_tv[:10]},
                ]
            }
        elif media_type == "movie":
            now_playing = await self.tmdb.get_now_playing()
            trending_movies = await self.tmdb.get_trending_movies()
            return {
                "is_guest": True,
                "sections": [
                    {"title": "Rotten Tomatoes & IMDb Certified Fresh", "subtitle": "85%+ Fresh critical favorites", "movies": rt_picks},
                    {"title": "Trending Movies", "subtitle": "Popular films worldwide", "movies": trending_movies[:10]},
                    {"title": "In Theaters & Fresh Cinema", "subtitle": "Current 2025–2026 releases", "movies": now_playing[:10]},
                ]
            }

        # Combined "All" Feed
        trending_all = await self.tmdb.get_trending_all(time_window="day")
        anime = await self.tmdb.get_trending_anime()
        tv = await self.tmdb.get_trending_tv()
        now_playing = await self.tmdb.get_now_playing()

        return {
            "is_guest": True,
            "sections": [
                {"title": "Trending Across Movies, TV & Anime", "subtitle": "What the world is streaming right now", "movies": trending_all[:10]},
                {"title": "Rotten Tomatoes & IMDb Certified Fresh", "subtitle": "Top critic & audience scores (85%+ Fresh)", "movies": rt_picks},
                {"title": "Top Trending Anime", "subtitle": "Essential & fresh Japanese animation", "movies": anime[:10]},
                {"title": "Popular TV Series", "subtitle": "Drama, Sci-Fi, and mystery series", "movies": tv[:10]},
            ]
        }

recommender_service = RecommenderService()
