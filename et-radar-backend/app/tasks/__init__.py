"""
Celery task & beat configuration for ET Radar.
"""

import os

if os.getenv("ETRADAR_ENABLE_EVENTLET_MONKEY_PATCH", "0") == "1":
    try:
        import eventlet

        # Helps avoid "RLock(s) were not greened" when worker runs with -P eventlet.
        eventlet.monkey_patch()
    except Exception:
        pass

from celery import Celery
from celery.schedules import crontab
from app.config import settings


def _normalize_redis_url(url: str) -> str:
    if "upstash.io" in url and url.startswith("redis://"):
        return url.replace("redis://", "rediss://", 1)
    return url


broker_url = _normalize_redis_url(settings.CELERY_BROKER_URL)
backend_url = _normalize_redis_url(settings.CELERY_RESULT_BACKEND)

celery_app = Celery(
    "etradar",
    broker=broker_url,
    backend=backend_url,
    include=[
        "app.tasks.fetch_prices",
        "app.tasks.fetch_filings",
        "app.tasks.fetch_bulk_deals",
        "app.tasks.run_radar",
    ],
)

is_secure_redis = broker_url.startswith("rediss://") or backend_url.startswith("rediss://")
if is_secure_redis:
    celery_app.conf.broker_use_ssl = {"ssl_cert_reqs": "none"}
    celery_app.conf.redis_backend_use_ssl = {"ssl_cert_reqs": "none"}

# Future-proof against Celery 6 warning and keep startup retry behavior.
celery_app.conf.broker_connection_retry_on_startup = True

celery_app.conf.beat_schedule = {
    "fetch-prices-daily": {
        "task": "app.tasks.fetch_prices.fetch_all_prices",
        "schedule": crontab(hour=18, minute=30, day_of_week="mon-fri"),
    },
    "fetch-filings-every-2h": {
        "task": "app.tasks.fetch_filings.fetch_filings",
        "schedule": crontab(minute=0, hour="9-18/2", day_of_week="mon-fri"),
    },
    "fetch-bulk-deals-daily": {
        "task": "app.tasks.fetch_bulk_deals.fetch_bulk_deals",
        "schedule": crontab(hour=19, minute=0, day_of_week="mon-fri"),
    },
    "run-radar-every-2h": {
        "task": "app.tasks.run_radar.run_opportunity_radar",
        "schedule": crontab(minute=30, hour="9-18/2", day_of_week="mon-fri"),
    },
}

celery_app.conf.timezone = "Asia/Kolkata"
