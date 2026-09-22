import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .services.vector_store import vector_store
from .routers import movies_router, recommendations_router, users_router, rooms_router, streams_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing vector store from movie catalog...")
    vector_store.initialize()
    logger.info("Vector store is warm and ready for fast recommendations.")
    yield
    logger.info("Shutting down CineMatch API.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Next-generation Movie Recommendation & Discovery API with watched movie filtering and TMDB live streaming",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers under /api prefix and root for universal compatibility
app.include_router(movies_router, prefix=settings.API_V1_PREFIX)
app.include_router(recommendations_router, prefix=settings.API_V1_PREFIX)
app.include_router(users_router, prefix=settings.API_V1_PREFIX)
app.include_router(rooms_router, prefix=settings.API_V1_PREFIX)
app.include_router(streams_router, prefix=settings.API_V1_PREFIX)

# Fallback root endpoints to prevent 404 when baseURL lacks /api
app.include_router(movies_router)
app.include_router(recommendations_router)
app.include_router(users_router)
app.include_router(rooms_router)
app.include_router(streams_router)

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs"
    }

@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "catalog_size": len(vector_store.df) if vector_store.df is not None else 0,
        "vector_ready": vector_store.is_ready
    }
