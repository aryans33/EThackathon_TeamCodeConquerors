from app.routes.stocks import router as stocks_router
from app.routes.signals import router as signals_router
from app.routes.patterns import router as patterns_router
from app.routes.portfolio import router as portfolio_router
from app.routes.chat import router as chat_router

__all__ = [
    "stocks_router",
    "signals_router",
    "patterns_router",
    "portfolio_router",
    "chat_router",
]
