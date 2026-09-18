from .movies import router as movies_router
from .recommendations import router as recommendations_router
from .users import router as users_router

__all__ = ["movies_router", "recommendations_router", "users_router"]
