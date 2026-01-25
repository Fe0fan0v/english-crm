from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import api_router
from app.config import settings
from app.database import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup - store engine for WebSocket connections
    app.state.engine = engine
    yield
    # Shutdown - dispose engine
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    description="CRM system for English learning center",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")

# Create uploads directories and mount static files
photos_path = Path(settings.storage_path) / "photos"
photos_path.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads/photos", StaticFiles(directory=str(photos_path)), name="photos")

chat_uploads_path = Path(settings.storage_path) / "chat"
chat_uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads/chat", StaticFiles(directory=str(chat_uploads_path)), name="chat")

materials_path = Path(settings.storage_path) / "materials"
materials_path.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads/materials", StaticFiles(directory=str(materials_path)), name="materials")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
