"""
Celery task & beat configuration for ET Radar.
"""

from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery(
    "etradar",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.fetch_prices",
        "app.tasks.fetch_filings",
        "app.tasks.fetch_bulk_deals",
        "app.tasks.run_radar",
    ],
)

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
