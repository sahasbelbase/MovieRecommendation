import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directory for the repository
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "Movie Recommendation Engine"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"

    # TMDB API Configuration (Default is the working project key, override via .env)
    TMDB_API_KEY: str = os.getenv("TMDB_API_KEY", "c7ec19ffdd3279641fb606d19ceb9bb1")
    TMDB_BASE_URL: str = "https://api.themoviedb.org/3"
    TMDB_IMAGE_BASE_URL: str = "https://image.tmdb.org/t/p/w500"
    TMDB_BACKDROP_BASE_URL: str = "https://image.tmdb.org/t/p/original"

    # OMDb API Configuration for Rotten Tomatoes & IMDb Ratings
    OMDB_API_KEY: str = os.getenv("OMDB_API_KEY", "trilogy")
    OMDB_BASE_URL: str = "https://www.omdbapi.com"

    # Dataset & Vectorization Paths
    DATASET_PATH: str = str(BASE_DIR / "dataset.csv")
    CACHE_DIR: str = str(BASE_DIR / "backend" / "cache")

    # Firebase Authentication & Firestore (optional for guest mode)
    FIREBASE_CREDENTIALS_PATH: str = os.getenv("FIREBASE_CREDENTIALS_PATH", "")
    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "movierecomandation-60b84")

    # Qdrant Cloud (Optional, for hosted cloud vector storage)
    QDRANT_URL: str = os.getenv("QDRANT_URL", "")
    QDRANT_API_KEY: str = os.getenv("QDRANT_API_KEY", "")

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
