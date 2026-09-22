from .movies import router as movies_router
from .recommendations import router as recommendations_router
from .users import router as users_router
from .rooms import router as rooms_router
from .streams import router as streams_router

__all__ = ["movies_router", "recommendations_router", "users_router", "rooms_router", "streams_router"]
