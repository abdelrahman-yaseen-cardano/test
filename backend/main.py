from __future__ import annotations
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from routers import videos, similarity, groups, export


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up similarity cache from persisted nodes
    videos.warm_similarity_cache()
    yield


app = FastAPI(title="Loop-Engine API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files (videos + frames) as static assets
Path("uploads/videos").mkdir(parents=True, exist_ok=True)
Path("uploads/frames").mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Serve the CDN-based frontend from the static/ directory
Path("static").mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(videos.router)
app.include_router(similarity.router)
app.include_router(groups.router)
app.include_router(export.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/")
async def serve_spa():
    """Serve the single-page application shell."""
    return FileResponse("static/index.html")
