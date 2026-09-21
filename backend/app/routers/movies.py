from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional
from ..services.tmdb import tmdb_service

router = APIRouter(prefix="/movies", tags=["Movies, TV & Anime"])

@router.get("/trending")
async def get_trending(
    time_window: str = Query("day", pattern="^(day|week)$"),
    media_type: str = Query("all", pattern="^(all|movie|tv|anime)$"),
    page: int = Query(1, ge=1)
):
    if media_type == "anime":
        return await tmdb_service.get_trending_anime(page=page)
    elif media_type == "tv":
        return await tmdb_service.get_trending_tv(time_window=time_window, page=page)
    elif media_type == "movie":
        return await tmdb_service.get_trending_movies(time_window=time_window, page=page)
    return await tmdb_service.get_trending_all(time_window=time_window, page=page)

@router.get("/anime")
async def get_anime(page: int = Query(1, ge=1)):
    return await tmdb_service.get_trending_anime(page=page)

@router.get("/tv")
async def get_tv(page: int = Query(1, ge=1)):
    return await tmdb_service.get_trending_tv(page=page)

@router.get("/now-playing")
async def get_now_playing(page: int = Query(1, ge=1)):
    return await tmdb_service.get_now_playing(page=page)

@router.get("/upcoming")
async def get_upcoming(page: int = Query(1, ge=1)):
    return await tmdb_service.get_upcoming(page=page)

@router.get("/top-rated")
async def get_top_rated(media_type: str = Query("movie", pattern="^(movie|tv)$"), page: int = Query(1, ge=1)):
    return await tmdb_service.get_top_rated(media_type=media_type, page=page)

@router.get("/top-250")
async def get_top_250(
    category: str = Query("movies", pattern="^(movies|tv|anime)$"),
    page: int = Query(1, ge=1, le=10),
    limit: int = Query(50, ge=1, le=250)
):
    """
    Returns curated All-Time Top 250 items for Movies, TV Series, or Anime.
    Includes canonical rank (#1 to #250), IMDb score, Rotten Tomatoes, and genres.
    """
    return await tmdb_service.get_top_250(category=category, page=page, limit=limit)

@router.get("/search")
async def search_media(
    query: str = Query(..., min_length=1),
    media_type: Optional[str] = Query(None, pattern="^(movie|tv|anime)$"),
    page: int = Query(1, ge=1)
):
    return await tmdb_service.search_multi(query=query, page=page, media_type=media_type)

@router.get("/person/{person_id}/credits")
async def get_person_credits(person_id: int):
    data = await tmdb_service.get_person_credits(person_id)
    if not data or not data.get("person"):
        raise HTTPException(status_code=404, detail="Person not found")
    return data

@router.get("/{movie_id}/details")
async def get_details(movie_id: int, media_type: str = Query("movie", pattern="^(movie|tv|anime)$")):
    details = await tmdb_service.get_details(movie_id, media_type=media_type)
    if not details:
        raise HTTPException(status_code=404, detail="Media item not found")
    return details

@router.get("/{movie_id}/credits")
async def get_credits(movie_id: int, media_type: str = Query("movie", pattern="^(movie|tv|anime)$")):
    return await tmdb_service.get_credits(movie_id, media_type=media_type)

@router.get("/{movie_id}/trailers")
async def get_trailers(movie_id: int, media_type: str = Query("movie", pattern="^(movie|tv|anime)$")):
    return await tmdb_service.get_videos(movie_id, media_type=media_type)

@router.get("/{movie_id}/providers")
async def get_watch_providers(
    movie_id: int,
    media_type: str = Query("movie", pattern="^(movie|tv|anime|kdrama)$"),
    country: str = Query("US", min_length=2, max_length=2),
    title: Optional[str] = Query(None)
):
    return await tmdb_service.get_watch_providers(
        movie_id,
        media_type=media_type,
        country=country,
        title=title
    )

@router.get("/{tv_id}/season/{season_number}")
async def get_tv_season_episodes(tv_id: int, season_number: int = 1):
    return await tmdb_service.get_tv_season_episodes(tv_id, season_number)

@router.get("/{movie_id}/stream-status")
async def get_stream_status(movie_id: int, media_type: str = Query("movie", pattern="^(movie|tv|anime|kdrama)$")):
    return await tmdb_service.get_movie_stream_status(movie_id, media_type=media_type)

@router.get("/anime/{anime_id}/sources")
async def get_anime_sources(anime_id: int, episode: int = Query(1, ge=1)):
    return await tmdb_service.get_anime_streaming_sources(anime_id, episode_number=episode)


