import logging
import re
import urllib.parse
import httpx

logger = logging.getLogger("vidlink_resolver")

VIDLINK_BASE = "https://vidlink.pro"
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

async def resolve_vidlink_stream(tmdb_id: str, media_type: str = "movie", season: int = 1, episode: int = 1):
    """
    Resolves TMDB ID for movie or TV show to direct MP4/HLS stream URLs and subtitles from VidLink.
    Returns stream qualities, direct URLs, required referrer headers, and captions.
    """
    target_page = (
        f"{VIDLINK_BASE}/tv/{tmdb_id}/{season}/{episode}"
        if media_type == "tv"
        else f"{VIDLINK_BASE}/movie/{tmdb_id}"
    )

    headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Referer": target_page,
        "Accept": "*/*",
        "X-Playback-Environment": "dash-hevc",
    }

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        # First, request page to extract Next.js static session tokens or obfuscated API route if needed
        logger.info(f"Fetching VidLink page: {target_page}")
        page_res = await client.get(target_page, headers={"User-Agent": DEFAULT_USER_AGENT})
        
        # Extract API request path token from page source if present
        api_path_match = re.search(r'/api/b/(?:movie|tv)/([A-Za-z0-9_\-]+)', page_res.text)
        obfuscated_id = api_path_match.group(1) if api_path_match else None

        if obfuscated_id:
            api_url = (
                f"{VIDLINK_BASE}/api/b/tv/{obfuscated_id}/{season}/{episode}?multiLang=0"
                if media_type == "tv"
                else f"{VIDLINK_BASE}/api/b/movie/{obfuscated_id}?multiLang=0"
            )
        else:
            api_url = (
                f"{VIDLINK_BASE}/api/b/tv/{tmdb_id}/{season}/{episode}?multiLang=0"
                if media_type == "tv"
                else f"{VIDLINK_BASE}/api/b/movie/{tmdb_id}?multiLang=0"
            )

        logger.info(f"Querying VidLink API: {api_url}")
        res = await client.get(api_url, headers=headers)

        if res.status_code != 200:
            logger.warning(f"VidLink API returned status {res.status_code}")
            raise ValueError(f"VidLink API responded with HTTP {res.status_code}")

        data = res.json()
        stream_payload = data.get("stream", {})
        qualities = stream_payload.get("qualities", {})
        captions = stream_payload.get("captions", [])

        if not qualities:
            raise ValueError("No video stream qualities found in VidLink API response.")

        # Find best playable quality format
        chosen_quality_key = None
        for q in ["1080", "720", "480", "360"]:
            if q in qualities:
                chosen_quality_key = q
                break

        if not chosen_quality_key:
            chosen_quality_key = list(qualities.keys())[0]

        quality_data = qualities[chosen_quality_key]
        direct_url = quality_data.get("url")
        req_headers = quality_data.get("headers", {
            "referer": "https://filmboom.top/",
            "origin": "https://filmboom.top"
        })

        return {
            "status": "success",
            "media_type": media_type,
            "tmdb_id": tmdb_id,
            "quality": chosen_quality_key,
            "direct_url": direct_url,
            "headers": req_headers,
            "all_qualities": qualities,
            "captions": captions
        }
