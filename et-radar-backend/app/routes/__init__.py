from app.routes.stocks import router as stocks_router
from app.routes.signals import router as signals_router
from app.routes.patterns import router as patterns_router
from app.routes.portfolio import router as portfolio_router
from app.routes.chat import router as chat_router
from app.routes.status import router as status_router
from app.routes.filings import router as filings_router
from app.routes.demo import router as demo_router

__all__ = [
    "stocks_router",
    "signals_router",
    "patterns_router",
    "portfolio_router",
    "chat_router",
    "status_router",
    "filings_router",
    "demo_router",
]
