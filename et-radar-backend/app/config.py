from pydantic_settings import BaseSettings, SettingsConfigDict  # type: ignore[import]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",   # silently ignore PYTHONPATH and any other unknown env vars
    )

    DATABASE_URL: str
    REDIS_URL: str
    GROQ_API_KEY: str
    NSE_SYMBOLS: str
    FRONTEND_URL: str = "http://localhost:3000"
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str

    @property
    def symbols_list(self) -> list[str]:
        return [s.strip() for s in self.NSE_SYMBOLS.split(",")]


settings = Settings()
