import logging
import urllib.parse
from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
import httpx

from ..services.vidlink_resolver import resolve_vidlink_stream

logger = logging.getLogger("streams_router")
router = APIRouter(prefix="/streams", tags=["streams"])

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

@router.get("/resolve")
async def resolve_stream(
    request: Request,
    tmdb_id: str = Query(..., description="TMDB ID of movie or show"),
    media_type: str = Query("movie", description="Type: movie or tv"),
    season: int = Query(1, description="Season number for TV shows"),
    episode: int = Query(1, description="Episode number for TV shows")
):
    """
    Resolves TMDB ID to a direct playable MP4 stream URL and proxied URL for Smart TV playback.
    """
    try:
        data = await resolve_vidlink_stream(tmdb_id, media_type, season, episode)
        
        # Build local proxy stream URL
        base_url = str(request.base_url).rstrip("/")
        target_url = data["direct_url"]
        encoded_target = urllib.parse.quote(target_url, safe="")
        proxy_url = f"{base_url}/api/streams/proxy?url={encoded_target}"

        data["proxy_url"] = proxy_url
        return data
    except Exception as e:
        logger.error(f"Error resolving stream for {media_type} {tmdb_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/proxy")
async def proxy_stream(request: Request, url: str = Query(..., description="Encoded target video URL")):
    """
    Proxies MP4/HLS video stream bytes with required Referer/Origin headers to prevent 427 Forbidden errors.
    Supports Range requests for TV seeking and progressive streaming without loading full video into RAM.
    """
    target_url = urllib.parse.unquote(url)
    if not target_url.startswith("http://") and not target_url.startswith("https://"):
        raise HTTPException(status_code=400, detail="Invalid target stream URL")

    req_headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Referer": "https://filmboom.top/",
        "Origin": "https://filmboom.top"
    }

    # Forward incoming Range header for TV video seeking (e.g. bytes=0- / bytes=1048576-)
    incoming_range = request.headers.get("range")
    if incoming_range:
        req_headers["Range"] = incoming_range

    client = httpx.AsyncClient(timeout=30.0, follow_redirects=True)
    
    try:
        upstream_req = client.build_request("GET", target_url, headers=req_headers)
        upstream_res = await client.send(upstream_req, stream=True)

        # Forward critical headers to client
        response_headers = {}
        for h in ["content-type", "content-length", "content-range", "accept-ranges"]:
            if h in upstream_res.headers:
                response_headers[h] = upstream_res.headers[h]

        if "accept-ranges" not in response_headers:
            response_headers["accept-ranges"] = "bytes"

        async def stream_generator():
            try:
                async for chunk in upstream_res.aiter_bytes(chunk_size=65536):
                    yield chunk
            finally:
                await upstream_res.aclose()
                await client.aclose()

        return StreamingResponse(
            stream_generator(),
            status_code=upstream_res.status_code,
            headers=response_headers,
            media_type=upstream_res.headers.get("content-type", "video/mp4")
        )

    except Exception as e:
        await client.aclose()
        logger.error(f"Error proxying stream chunk: {e}")
        raise HTTPException(status_code=502, detail=f"Proxy error: {str(e)}")
