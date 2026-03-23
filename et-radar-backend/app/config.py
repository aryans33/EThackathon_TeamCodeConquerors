from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    ANTHROPIC_API_KEY: str
    GROQ_API_KEY: str = ""
    NSE_SYMBOLS: str
    FRONTEND_URL: str = "http://localhost:3000"
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str

    @property
    def symbols_list(self) -> list[str]:
        return [s.strip() for s in self.NSE_SYMBOLS.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
