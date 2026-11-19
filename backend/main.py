import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import conf
from backend.core.db import connect, disconnect
from backend.core.errors import register_error_handlers
from backend.middlewares.request_logging import request_logging
from backend.routers.health import router as health_router

logging.basicConfig(
    level=conf.log_level,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect()
    try:
        yield
    finally:
        await disconnect()


app = FastAPI(title="Hotel Booking API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=conf.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
    expose_headers=["X-Request-ID"],
)
app.middleware("http")(request_logging)
register_error_handlers(app)
app.include_router(health_router)

from backend.routers import auth, users, rooms, bookings, payments, reviews

for module in (auth, users, rooms, bookings, payments, reviews):
    app.include_router(module.router, prefix="/api/v1")
