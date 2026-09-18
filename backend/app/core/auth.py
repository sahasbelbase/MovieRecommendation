import os
import logging
from typing import Optional
from fastapi import Header, HTTPException, status
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

from .config import settings

logger = logging.getLogger("auth")

# Initialize Firebase Admin if credentials are provided, or use default application credentials if available
firebase_initialized = False
try:
    service_account_raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if service_account_raw:
        import json
        cred_dict = json.loads(service_account_raw)
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
        firebase_initialized = True
        logger.info("Firebase Admin initialized with raw JSON environment variable.")
    elif settings.FIREBASE_CREDENTIALS_PATH and os.path.exists(settings.FIREBASE_CREDENTIALS_PATH):
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred)
        firebase_initialized = True
        logger.info("Firebase Admin initialized with certificate file.")
    elif os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        firebase_admin.initialize_app()
        firebase_initialized = True
        logger.info("Firebase Admin initialized with application default credentials.")
    else:
        # Development mode without service account key
        logger.warning("Firebase Admin not configured with credentials. Running with mock/client-token validation fallback.")
except Exception as e:
    logger.error(f"Error initializing Firebase Admin: {e}")

async def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """
    Extracts user info from Authorization: Bearer <firebase_id_token> if present.
    Returns None for guest/unauthenticated users.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.split("Bearer ")[1].strip()
    if not token:
        return None

    if firebase_initialized:
        try:
            decoded_token = firebase_auth.verify_id_token(token)
            return {
                "uid": decoded_token.get("uid"),
                "email": decoded_token.get("email"),
                "name": decoded_token.get("name", "User"),
                "picture": decoded_token.get("picture", ""),
            }
        except Exception as e:
            logger.warning(f"Failed to verify Firebase token: {e}")
            return None
    else:
        # Fallback for dev mode: if token is present, allow testing
        # Can accept custom dev tokens or parse unverified payload for demo purposes
        return {
            "uid": f"dev_{token[:12]}",
            "email": "dev_user@example.com",
            "name": "Dev User",
            "picture": "",
        }

async def get_current_user_required(authorization: Optional[str] = Header(None)) -> dict:
    """
    Guarantees user is authenticated. Raises 401 if missing or invalid.
    """
    user = await get_current_user_optional(authorization)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Firebase Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
