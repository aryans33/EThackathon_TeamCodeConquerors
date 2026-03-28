from __future__ import annotations

import datetime
from typing import Optional, List

from sqlalchemy import (  # type: ignore[import]
    String,
    Text,
    JSON,
    Float,
    Integer,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Index,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship  # type: ignore[import]

from app.database import Base  # type: ignore[import]


class Stock(Base):
    __tablename__ = "stocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    exchange: Mapped[str] = mapped_column(String(10), default="NSE", nullable=False)
    sector: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    ohlcv_records: Mapped[List["OHLCV"]] = relationship(
        "OHLCV", back_populates="stock", cascade="all, delete-orphan"
    )
    filings: Mapped[List["Filing"]] = relationship(
        "Filing", back_populates="stock"
    )
    bse_filings: Mapped[List["BSEFiling"]] = relationship(
        "BSEFiling", back_populates="stock"
    )
    bulk_deals: Mapped[List["BulkDeal"]] = relationship(
        "BulkDeal", back_populates="stock"
    )
    signals: Mapped[List["Signal"]] = relationship(
        "Signal", back_populates="stock"
    )

    def __repr__(self) -> str:
        return f"<Stock(id={self.id}, symbol='{self.symbol}')>"


class OHLCV(Base):
    __tablename__ = "ohlcv"
    __table_args__ = (
        UniqueConstraint("stock_id", "date", name="uq_ohlcv_stock_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    stock_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    open: Mapped[float] = mapped_column(Float, nullable=False)
    high: Mapped[float] = mapped_column(Float, nullable=False)
    low: Mapped[float] = mapped_column(Float, nullable=False)
    close: Mapped[float] = mapped_column(Float, nullable=False)
    volume: Mapped[int] = mapped_column(BigInteger, nullable=False)

    # Relationships
    stock: Mapped["Stock"] = relationship("Stock", back_populates="ohlcv_records")

    def __repr__(self) -> str:
        return f"<OHLCV(stock_id={self.stock_id}, date={self.date})>"


class Filing(Base):
    __tablename__ = "filings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    stock_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stocks.id"), nullable=True
    )
    date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    source_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    stock: Mapped[Optional["Stock"]] = relationship("Stock", back_populates="filings")
    signals: Mapped[List["Signal"]] = relationship("Signal", back_populates="filing")

    def __repr__(self) -> str:
        return f"<Filing(id={self.id}, category='{self.category}')>"


class BulkDeal(Base):
    __tablename__ = "bulk_deals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    stock_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stocks.id"), nullable=True
    )
    date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    deal_type: Mapped[str] = mapped_column(String(10), nullable=False)  # "buy" or "sell"
    quantity: Mapped[int] = mapped_column(BigInteger, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    stock: Mapped[Optional["Stock"]] = relationship("Stock", back_populates="bulk_deals")

    def __repr__(self) -> str:
        return f"<BulkDeal(id={self.id}, client='{self.client_name}', type='{self.deal_type}')>"


class Signal(Base):
    __tablename__ = "signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    stock_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stocks.id"), nullable=False
    )
    filing_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("filings.id"), nullable=True
    )
    signal_type: Mapped[str] = mapped_column(String(50), nullable=False)
    confidence: Mapped[int] = mapped_column(Integer, nullable=False)
    one_line_summary: Mapped[str] = mapped_column(String(200), nullable=False)
    action_hint: Mapped[str] = mapped_column(String(50), nullable=False)
    reason: Mapped[str] = mapped_column(String(1000), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    # Relationships
    stock: Mapped["Stock"] = relationship("Stock", back_populates="signals")
    filing: Mapped[Optional["Filing"]] = relationship("Filing", back_populates="signals")
    bse_filings: Mapped[List["BSEFiling"]] = relationship("BSEFiling", back_populates="signal")
    alerts: Mapped[List["Alert"]] = relationship(
        "Alert", back_populates="signal", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Signal(id={self.id}, type='{self.signal_type}', confidence={self.confidence})>"


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    signal_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("signals.id"), nullable=False
    )
    triggered_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    signal: Mapped["Signal"] = relationship("Signal", back_populates="alerts")

    def __repr__(self) -> str:
        return f"<Alert(id={self.id}, signal_id={self.signal_id}, sent={self.sent})>"


class Portfolio(Base):
    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    raw_json: Mapped[str] = mapped_column(Text, nullable=False)
    total_value: Mapped[float] = mapped_column(Float, nullable=False)
    xirr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<Portfolio(id={self.id}, session='{self.session_id}')>"


class BSEFiling(Base):
    __tablename__ = "bse_filings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    stock_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stocks.id"), nullable=True
    )
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    source_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    published_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    signal_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("signals.id"), nullable=True
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    stock: Mapped[Optional["Stock"]] = relationship("Stock", back_populates="bse_filings")
    signal: Mapped[Optional["Signal"]] = relationship("Signal", back_populates="bse_filings")

    def __repr__(self) -> str:
        return f"<BSEFiling(id={self.id}, category='{self.category}')>"


class PortfolioReport(Base):
    __tablename__ = "portfolio_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    raw_result: Mapped[dict] = mapped_column(JSON, nullable=False)
    total_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    xirr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    fund_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    def __repr__(self) -> str:
        return f"<PortfolioReport(id={self.id}, session_id='{self.session_id}')>"


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # "user" or "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<ChatMessage(id={self.id}, role='{self.role}')>"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}')>"
