import base64
import logging
import re
import struct
import time
import urllib.parse
import httpx

logger = logging.getLogger("vidlink_resolver")

VIDLINK_BASE = "https://vidlink.pro"
KEY_HEX = "c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd"
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)

def encrypt_vidlink_token(media_id: str) -> str:
    """
    Encrypts media_id with timestamp for VidLink authenticated API endpoint.
    Uses XSalsa20-Poly1305 if PyNaCl is installed; otherwise returns media_id.
    """
    try:
        import nacl.secret
        key = bytes.fromhex(KEY_HEX)
        box = nacl.secret.SecretBox(key)
        nonce = bytes(24)
        timestamp = int(time.time() + 480)
        message = media_id.encode("utf-8") + struct.pack(">Q", timestamp)
        encrypted = box.encrypt(message, nonce)
        full_payload = nonce + encrypted.ciphertext
        return base64.urlsafe_b64encode(full_payload).decode("utf-8").rstrip("=")
    except Exception as e:
        logger.debug(f"PyNaCl not available or token encryption failed: {e}")
        return media_id

async def resolve_vidlink_stream(tmdb_id: str, media_type: str = "movie", season: int = 1, episode: int = 1):
    """
    Resolves TMDB ID for movie or TV show to direct MP4/HLS stream URLs and subtitles from VidLink.
    Supports anime movies, series, and auto-fallback between movie and tv endpoints.
    """
    is_tv = media_type == "tv"
    token = encrypt_vidlink_token(tmdb_id)

    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        # Candidate API URLs with target page for referer and auto-fallback
        candidates = []
        if is_tv:
            if token != tmdb_id:
                candidates.append((f"{VIDLINK_BASE}/api/b/tv/{token}/{season}/{episode}?multiLang=1", f"{VIDLINK_BASE}/tv/{tmdb_id}/{season}/{episode}"))
            candidates.append((f"{VIDLINK_BASE}/api/b/tv/{tmdb_id}/{season}/{episode}?multiLang=0", f"{VIDLINK_BASE}/tv/{tmdb_id}/{season}/{episode}"))
            # Fallback for anime movie misclassified as tv
            if season == 1:
                if token != tmdb_id:
                    candidates.append((f"{VIDLINK_BASE}/api/b/movie/{token}?multiLang=1", f"{VIDLINK_BASE}/movie/{tmdb_id}"))
                candidates.append((f"{VIDLINK_BASE}/api/b/movie/{tmdb_id}?multiLang=0", f"{VIDLINK_BASE}/movie/{tmdb_id}"))
        else:
            if token != tmdb_id:
                candidates.append((f"{VIDLINK_BASE}/api/b/movie/{token}?multiLang=1", f"{VIDLINK_BASE}/movie/{tmdb_id}"))
            candidates.append((f"{VIDLINK_BASE}/api/b/movie/{tmdb_id}?multiLang=0", f"{VIDLINK_BASE}/movie/{tmdb_id}"))
            # Fallback for tv series requested as movie
            if token != tmdb_id:
                candidates.append((f"{VIDLINK_BASE}/api/b/tv/{token}/1/1?multiLang=1", f"{VIDLINK_BASE}/tv/{tmdb_id}/1/1"))
            candidates.append((f"{VIDLINK_BASE}/api/b/tv/{tmdb_id}/1/1?multiLang=0", f"{VIDLINK_BASE}/tv/{tmdb_id}/1/1"))

        for api_url, target_page in candidates:
            headers = {
                "User-Agent": DEFAULT_USER_AGENT,
                "Referer": target_page,
                "Origin": VIDLINK_BASE,
                "Accept": "*/*",
                "X-Playback-Environment": "dash-hevc",
            }
            try:
                logger.info(f"Querying VidLink API candidate: {api_url}")
                res = await client.get(api_url, headers=headers)
                if res.status_code != 200:
                    continue

                data = res.json()
                if not data or not isinstance(data, dict):
                    continue

                stream_payload = data.get("stream", {})
                if not stream_payload or not isinstance(stream_payload, dict):
                    continue

                qualities = stream_payload.get("qualities", {})
                captions = stream_payload.get("captions", [])

                if not qualities:
                    continue

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
                if not direct_url:
                    continue

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
            except Exception as candidate_err:
                logger.debug(f"Candidate {api_url} failed: {candidate_err}")
                continue

    return None
