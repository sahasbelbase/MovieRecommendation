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
        """Ensures all items have high-resolution TMDB posters and RT scores using parallel fetching"""
        async def enrich_one(m):
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
            return m

        await asyncio.gather(*[enrich_one(m) for m in items], return_exceptions=True)
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
            trending_anime = await self.tmdb.get_trending_anime()
            top_anime = await self.tmdb.get_top_rated_anime()
            combined = trending_anime + top_anime
            for item in combined:
                if item["id"] not in excluded_ids and not any(d["id"] == item["id"] for d in deck):
                    deck.append(item)
                if len(deck) >= limit:
                    break
            return deck

        if genre and genre.lower() in ["k-drama", "kdrama"]:
            kdramas = await self.tmdb.get_trending_kdrama()
            for item in kdramas:
                if item["id"] not in excluded_ids and not any(d["id"] == item["id"] for d in deck):
                    deck.append(item)
                if len(deck) >= limit:
                    break
            return deck

        # Standard iconic seeds
        unwatched_seeds = [s for s in ICONIC_SWIPE_SEEDS if s["id"] not in excluded_ids]
        for item in unwatched_seeds:
            details = await self.tmdb.get_details(item["id"], media_type=item["media_type"])
            if details:
                if genre and genre.lower() != "all":
                    item_genres = [g.lower() for g in details.get("genres", [])]
                    if not any(genre.lower() in g for g in item_genres):
                        continue
                deck.append(details)
            if len(deck) >= limit:
                break

        # If user has already swiped most seeds or genre filter needs more items
        if len(deck) < 8:
            trending = await self.tmdb.get_trending_all(time_window="week")
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
        Recommends similar movies, TV series, or Anime.
        Strictly excludes any item in the user's watched or skipped list.
        """
        excluded_ids = []
        if user_id:
            excluded_ids = await self.user_data.get_all_excluded_ids(user_id)

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

    async def get_tailored_feed(self, user_id: str, media_type: Optional[str] = None, genre: Optional[str] = None) -> Dict[str, Any]:
        """
        Generates personalized FYP recommendation feed for authenticated user.
        Adaptively detects tastes (e.g. K-Drama, Anime, skipping action, Rotten Tomatoes favorites),
        strictly excludes all watched titles, and honors genre fatigue suppression.
        """
        watched_list = await self.user_data.get_watched_list(user_id)
        watched_ids = [m["id"] for m in watched_list]
        all_excluded_ids = set(await self.user_data.get_all_excluded_ids(user_id))

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

        # If user explicitly requested Anime category
        if media_type == "anime":
            trending_anime = await self.tmdb.get_trending_anime()
            top_anime = await self.tmdb.get_top_rated_anime()
            unwatched_trending = [m for m in trending_anime if m["id"] not in all_excluded_ids]
            unwatched_top = [m for m in top_anime if m["id"] not in all_excluded_ids]
            return {
                "is_cold_start": False,
                "needs_calibration": len(watched_list) < 3,
                "watched_count": len(watched_list),
                "sections": [
                    {"title": "Anime For You", "subtitle": "Curated Japanese animation based on your taste", "movies": unwatched_trending[:10]},
                    {"title": "All-Time Masterpiece Anime", "subtitle": "Highest rated anime you haven't watched yet", "movies": unwatched_top[:10]},
                ]
            }

        # If user explicitly requested TV category
        if media_type == "tv":
            trending_tv = await self.tmdb.get_trending_tv()
            top_tv = await self.tmdb.get_top_rated(media_type="tv")
            unwatched_tv = [m for m in trending_tv if m["id"] not in all_excluded_ids]
            unwatched_top_tv = [m for m in top_tv if m["id"] not in all_excluded_ids]
            return {
                "is_cold_start": False,
                "needs_calibration": len(watched_list) < 3,
                "watched_count": len(watched_list),
                "sections": [
                    {"title": "Trending TV Series", "subtitle": "Top shows streaming this week", "movies": unwatched_tv[:10]},
                    {"title": "Critically Acclaimed Television", "subtitle": "Highest rated TV series (IMDb & RT)", "movies": unwatched_top_tv[:10]},
                ]
            }

        # If user explicitly requested Movies category
        if media_type == "movie":
            trending_movies, top_movies, rt_picks = await asyncio.gather(
                self.tmdb.get_trending_movies(),
                self.tmdb.get_top_rated(media_type="movie"),
                self.tmdb.get_rotten_tomatoes_picks(limit=15)
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
                    {"title": "Trending Feature Films", "subtitle": "Blockbusters and popular movies worldwide", "movies": unwatched_trending[:10]},
                    {"title": "Critically Acclaimed Cinema", "subtitle": "85%+ Rotten Tomatoes & IMDb Elite", "movies": unwatched_rt[:10]},
                    {"title": "All-Time Top Rated Movies", "subtitle": "Highest rated films you haven't watched yet", "movies": unwatched_top[:10]},
                ]
            }

        if len(watched_list) < 3:
            # Under-calibrated user: Return onboarding FYP prompt + top trending (run in parallel)
            trending, anime, rt_picks = await asyncio.gather(
                self.tmdb.get_trending_all(time_window="day"),
                self.tmdb.get_trending_anime(),
                self.tmdb.get_rotten_tomatoes_picks(limit=10)
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
                    {"title": "Trending Right Now", "subtitle": "Movies, Series & Anime", "movies": unwatched_trending[:10]},
                    {"title": "Rotten Tomatoes & IMDb Elite", "subtitle": "Critically acclaimed cinema (85%+ Fresh)", "movies": unwatched_rt[:10]},
                    {"title": "Top Anime Series", "subtitle": "High-rated animation", "movies": unwatched_anime[:10]},
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

        # Fetch Not Interested list to compute negative preferences & genre fatigue
        not_interested_list = await self.user_data.get_not_interested_list(user_id)
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

        # A genre is FATIGUED/REJECTED if marked not-interested >= 5 times,
        # or >= 3 times when user has watched <= 1 title in that genre.
        rejected_genres = set()
        for g, neg_cnt in genre_negative_frequency.items():
            pos_cnt = genre_frequency.get(g, 0)
            if neg_cnt >= 5 or (pos_cnt <= 1 and neg_cnt >= 3):
                rejected_genres.add(g.lower())
                if g == "Action":
                    action_count += 1

        top_genres = sorted(genre_frequency.items(), key=lambda x: x[1], reverse=True)
        primary_genre = top_genres[0][0] if top_genres else "Drama"

        # Franchise definitions for anti-clustering & alternate universe discovery
        franchise_definitions = {
            "batman": {
                "name": "Batman",
                "tokens": ["batman", "dark knight", "gotham", "joker", "bruce wayne"],
                "alternates": ["Iron Man", "Superman", "Spider-Man", "The Avengers", "Logan", "John Wick", "Mad Max: Fury Road", "Watchmen", "Captain America", "Deadpool"]
            },
            "spider-man": {
                "name": "Spider-Man",
                "tokens": ["spider-man", "spiderman", "peter parker", "miles morales"],
                "alternates": ["Iron Man", "The Dark Knight", "Superman", "The Avengers", "Logan", "Guardians of the Galaxy", "Deadpool", "Doctor Strange"]
            },
            "superman": {
                "name": "Superman",
                "tokens": ["superman", "man of steel", "clark kent"],
                "alternates": ["The Dark Knight", "Iron Man", "Spider-Man", "Wonder Woman", "Logan", "The Avengers", "Captain America"]
            },
            "iron man": {
                "name": "Iron Man",
                "tokens": ["iron man", "tony stark"],
                "alternates": ["The Dark Knight", "Spider-Man", "Superman", "Captain America: The Winter Soldier", "Logan", "John Wick", "Deadpool"]
            },
            "star wars": {
                "name": "Star Wars",
                "tokens": ["star wars", "jedi", "skywalker", "darth vader"],
                "alternates": ["Dune", "Interstellar", "Blade Runner 2049", "The Matrix", "Avatar", "Star Trek"]
            },
            "fast & furious": {
                "name": "Fast & Furious",
                "tokens": ["fast & furious", "fast and furious", "dominic toretto", "tokyo drift"],
                "alternates": ["Mad Max: Fury Road", "Baby Driver", "John Wick", "Mission: Impossible", "The Italian Job", "Drive"]
            },
            "harry potter": {
                "name": "Harry Potter",
                "tokens": ["harry potter", "hogwarts", "fantastic beasts"],
                "alternates": ["The Lord of the Rings: The Fellowship of the Ring", "Pan's Labyrinth", "The Chronicles of Narnia", "Percy Jackson", "Stardust"]
            },
            "lord of the rings": {
                "name": "The Lord of the Rings",
                "tokens": ["lord of the rings", "hobbit", "middle-earth", "frodo", "gandalf", "tolkien"],
                "alternates": ["Harry Potter and the Sorcerer's Stone", "Dune", "Gladiator", "The Princess Bride", "The Chronicles of Narnia"]
            },
            "james bond": {
                "name": "James Bond",
                "tokens": ["james bond", "007", "skyfall", "casino royale", "spectre"],
                "alternates": ["Mission: Impossible - Fallout", "The Bourne Identity", "Kingsman: The Secret Service", "John Wick", "Atomic Blonde"]
            }
        }

        # Exclude all watched AND skipped/unwatched IDs
        all_excluded_ids = set(await self.user_data.get_all_excluded_ids(user_id))

        # Detect saturated franchise (user watched >= 2 titles from same franchise)
        saturated_franchise = None
        for f_key, f_info in franchise_definitions.items():
            matches = 0
            for item in watched_list:
                t = (item.get("title") or "").lower()
                if any(tok in t for tok in f_info["tokens"]):
                    matches += 1
            if matches >= 2:
                saturated_franchise = f_info
                break

        # Favorites (rated >= 7 or most recently watched)
        favorites = [m for m in watched_list if m.get("rating") and float(m["rating"]) >= 7.0]
        if not favorites:
            favorites = watched_list[:5]

        anchor_item = favorites[0]
        anchor_media_type = anchor_item.get("media_type", "movie")

        # 1. Tailored Vector Centroid (Movies) with Franchise Anti-Clustering
        liked_movie_ids = [f["id"] for f in favorites if f.get("media_type", "movie") == "movie"]
        tailored_movies = []
        suppress_terms = saturated_franchise["tokens"] if saturated_franchise else None

        if liked_movie_ids:
            tailored_movies = self.vector_store.get_tailored_recommendations(
                liked_movie_ids=liked_movie_ids,
                excluded_ids=all_excluded_ids,
                suppress_franchise_terms=suppress_terms,
                limit=12
            )

        # If user has a saturated franchise (e.g. Batman), inject diverse alternate heroes (Iron Man, Superman, etc.) at the top
        if saturated_franchise:
            alt_movies = []
            seen_alts = set()
            for alt in saturated_franchise["alternates"]:
                matches = self.vector_store.df[self.vector_store.df["title"].str.contains(alt, case=False, na=False)]
                for _, row in matches.iterrows():
                    mid = int(row["id"])
                    if mid not in all_excluded_ids and row.get("vote_average", 0) >= 7.0 and alt not in seen_alts:
                        alt_movies.append(self.vector_store._format_row(row))
                        seen_alts.add(alt)
                        break

            # Combine alternate heroes first, followed by diverse tailored vector picks
            combined = []
            seen_ids = set()
            for m in alt_movies + tailored_movies:
                if m["id"] not in seen_ids and m["id"] not in all_excluded_ids:
                    combined.append(m)
                    seen_ids.add(m["id"])
            tailored_movies = combined[:10]

        if tailored_movies:
            tailored_movies = await self._enrich_with_tmdb_posters(tailored_movies)

        # 2. Anchor item similarity (avoid echoing the saturated franchise)
        non_franchise_favorites = [
            f for f in favorites
            if not any(tok in (f.get("title") or "").lower() for tok in saturated_franchise["tokens"])
        ] if saturated_franchise else favorites

        if non_franchise_favorites:
            diverse_anchor = non_franchise_favorites[0]
            anchor_recs = await self.get_similar(
                diverse_anchor["id"],
                media_type=diverse_anchor.get("media_type", "movie"),
                user_id=user_id,
                limit=10
            )
            anchor_section_title = f"Because You Watched {diverse_anchor.get('title')}"
            anchor_section_subtitle = f"Similar to your favorite {diverse_anchor.get('media_type', 'movie').upper()}"
        else:
            anchor_recs = await self.get_similar(anchor_item["id"], media_type=anchor_media_type, user_id=user_id, limit=10)
            anchor_section_title = "Next Evolution: High-Stakes Action & Vigilante Thrillers"
            anchor_section_subtitle = "Gritty heroes, justice, and adrenaline-fueled cinema beyond Gotham City"

        # 3. Rotten Tomatoes & IMDb Elite Picks (Unwatched)
        rt_picks = await self.tmdb.get_rotten_tomatoes_picks(limit=15)
        unwatched_rt = [m for m in rt_picks if m["id"] not in all_excluded_ids][:10]

        # 4. Construct personalized sections
        sections = []

        if tailored_movies:
            if saturated_franchise:
                sections.append({
                    "title": "FYP: Top Alternates For You",
                    "subtitle": f"Because you love {saturated_franchise['name']}, explore alternate iconic heroes (Iron Man, Superman, Logan & more)",
                    "movies": tailored_movies
                })
            else:
                sections.append({
                    "title": "FYP: Tailored For You",
                    "subtitle": f"Curated algorithm based on your {len(watched_list)} watched titles",
                    "movies": tailored_movies
                })

        if anchor_recs:
            sections.append({
                "title": anchor_section_title,
                "subtitle": anchor_section_subtitle,
                "movies": anchor_recs
            })

        # 4. Format-Specific & Taste Rows with Genre Fatigue Guards:
        # Only show K-Drama section if user has watched >= 2 K-Dramas AND has not rejected them
        is_kdrama_rejected = kdrama_negative_count >= 4 or (kdrama_count <= 1 and kdrama_negative_count >= 2)
        if kdrama_count >= 2 and not is_kdrama_rejected:
            kdrama_recs = await self.tmdb.get_trending_kdrama()
            unwatched_kdrama = [m for m in kdrama_recs if m["id"] not in all_excluded_ids][:10]
            if unwatched_kdrama:
                sections.append({
                    "title": "Because You Watched K-Drama",
                    "subtitle": "Emotional storylines & character-driven series from Korea",
                    "movies": unwatched_kdrama
                })

        # Anime curation: only show if user has not repeatedly marked anime as not interested
        is_anime_rejected = anime_negative_count >= 5 or (anime_count <= 1 and anime_negative_count >= 3)
        if not is_anime_rejected:
            anime_recs = await self.tmdb.get_trending_anime()
            unwatched_anime = [m for m in anime_recs if m["id"] not in all_excluded_ids][:10]
            if unwatched_anime:
                if anime_count > 0:
                    anime_title = "Anime For You"
                    anime_sub = "Top series matching your animation viewing history"
                elif action_count > 0:
                    anime_title = "High-Octane Anime & Animation"
                    anime_sub = "Top-tier action animation you haven't watched yet"
                elif "Romance" in genre_frequency or "Drama" in genre_frequency:
                    anime_title = "Story-Rich & Emotional Anime"
                    anime_sub = "Character-driven storytelling and world-class animation"
                else:
                    anime_title = "Top-Rated Anime Series"
                    anime_sub = "Critically acclaimed Japanese animation"

                sections.append({
                    "title": anime_title,
                    "subtitle": anime_sub,
                    "movies": unwatched_anime
                })

        # 5. Dedicated Franchise Row Below (for completionists)
        if saturated_franchise:
            franchise_lore = []
            for _, row in self.vector_store.df.iterrows():
                row_title = str(row.get("title", "")).lower()
                row_id = int(row["id"])
                if row_id not in all_excluded_ids:
                    if any(tok in row_title for tok in saturated_franchise["tokens"]):
                        franchise_lore.append(self.vector_store._format_row(row))
                        if len(franchise_lore) >= 10:
                            break
            if franchise_lore:
                franchise_lore = await self._enrich_with_tmdb_posters(franchise_lore)
                sections.append({
                    "title": f"Because You Watched {saturated_franchise['name']}: Extended Lore & Universe",
                    "subtitle": f"For {saturated_franchise['name']} completionists — animated masterworks & uncompleted chapters",
                    "movies": franchise_lore
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
                self.tmdb.get_trending_anime(),
                self.tmdb.get_top_rated_anime()
            )
            result = {
                "is_guest": True,
                "sections": [
                    {"title": "Top Trending Anime", "subtitle": "Most popular Japanese animation right now", "movies": anime},
                    {"title": "All-Time Masterpiece Anime", "subtitle": "Highest rated Japanese animation (IMDb & Critic Elite)", "movies": top_anime},
                ]
            }
            _guest_feed_cache[cache_key] = (time.time(), result)
            return result

        elif media_type == "tv":
            tv, top_tv = await asyncio.gather(
                self.tmdb.get_trending_tv(),
                self.tmdb.get_top_rated(media_type="tv")
            )
            result = {
                "is_guest": True,
                "sections": [
                    {"title": "Trending TV Series", "subtitle": "Most watched shows this week", "movies": tv[:10]},
                    {"title": "Highest Rated TV Series (IMDb & RT Elite)", "subtitle": "Critically acclaimed television", "movies": top_tv[:10]},
                ]
            }
            _guest_feed_cache[cache_key] = (time.time(), result)
            return result

        elif media_type == "movie":
            rt_picks, trending_movies, now_playing = await asyncio.gather(
                self.tmdb.get_rotten_tomatoes_picks(limit=10),
                self.tmdb.get_trending_movies(),
                self.tmdb.get_now_playing()
            )
            result = {
                "is_guest": True,
                "sections": [
                    {"title": "Rotten Tomatoes & IMDb Certified Fresh", "subtitle": "85%+ Fresh critical favorites", "movies": rt_picks},
                    {"title": "Trending Movies", "subtitle": "Popular films worldwide", "movies": trending_movies[:10]},
                    {"title": "In Theaters & Fresh Cinema", "subtitle": "Current 2025–2026 releases", "movies": now_playing[:10]},
                ]
            }
            _guest_feed_cache[cache_key] = (time.time(), result)
            return result

        # Combined "All" Feed - run all 5 requests concurrently in parallel
        trending_all, rt_picks, anime, tv, now_playing = await asyncio.gather(
            self.tmdb.get_trending_all(time_window="day"),
            self.tmdb.get_rotten_tomatoes_picks(limit=10),
            self.tmdb.get_trending_anime(),
            self.tmdb.get_trending_tv(),
            self.tmdb.get_now_playing()
        )

        result = {
            "is_guest": True,
            "sections": [
                {"title": "Trending Across Movies, TV & Anime", "subtitle": "What the world is streaming right now", "movies": trending_all[:10]},
                {"title": "Rotten Tomatoes & IMDb Certified Fresh", "subtitle": "Top critic & audience scores (85%+ Fresh)", "movies": rt_picks},
                {"title": "Top Trending Anime", "subtitle": "Essential & fresh Japanese animation", "movies": anime[:10]},
                {"title": "Popular TV Series", "subtitle": "Drama, Sci-Fi, and mystery series", "movies": tv[:10]},
            ]
        }
        _guest_feed_cache[cache_key] = (time.time(), result)
        return result

recommender_service = RecommenderService()
