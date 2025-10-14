#!/usr/bin/env python3
"""
Distill Webhook Visualiser
Main application entry point.
"""

import os
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

from app.core import settings, startup_manager, get_logger
from app.core.middleware import ErrorHandlerMiddleware
from app.api.webhook import router as webhook_router
from app.api.data import router as data_router
from app.api.alerts import router as alerts_router
from app.api.constants import router as constants_router
from app.api.auth import router as auth_router
from app.api.dex import router as dex_router

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan event handler for application startup and shutdown.
    Replaces deprecated on_event("startup") and on_event("shutdown").
    """
    # Startup
    await startup_manager.initialize()
    yield
    # Shutdown
    await startup_manager.shutdown()


# Initialize FastAPI app
app = FastAPI(
    title="Distill Webhook Visualiser",
    description="Receive, store, and visualise Distill Web Monitor data",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Add error handling middleware (first, to catch all errors)
app.add_middleware(ErrorHandlerMiddleware)

# Add CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Templates for old HTML pages
templates = Jinja2Templates(directory="templates")

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(webhook_router, prefix="/webhook", tags=["webhooks"])
app.include_router(data_router, prefix="/api", tags=["data"])
app.include_router(alerts_router, prefix="/api", tags=["alerts"])
app.include_router(constants_router, prefix="/api", tags=["constants"])
app.include_router(dex_router, prefix="/api", tags=["dex"])


# Old HTML template pages (kept for reference)
@app.get("/old", response_class=HTMLResponse)
async def home(request: Request):
    """Home page with overview."""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/old/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    """Dashboard page with data visualization."""
    return templates.TemplateResponse("dashboard.html", {"request": request})


@app.get("/old/deploy", response_class=HTMLResponse)
async def deploy(request: Request):
    """Deploy and management page."""
    return templates.TemplateResponse("deploy.html", {"request": request})


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "distill-webhook-visualiser"}


# Mount static files and serve React app
import os
from fastapi.responses import FileResponse

# Mount the nested static directory from React build
if os.path.exists("static/static"):
    app.mount("/static", StaticFiles(directory="static/static"), name="static")

# Mount sounds directory
if os.path.exists("static/sounds"):
    app.mount("/sounds", StaticFiles(directory="static/sounds"), name="sounds")

# Serve favicon
@app.get("/favicon.ico")
async def serve_favicon():
    """Serve favicon."""
    favicon_path = "static/favicon.ico"
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path)
    return HTMLResponse(content="", status_code=404)

# Serve React app for specific frontend routes only
@app.get("/", response_class=HTMLResponse)
async def serve_home():
    """Serve React app home page."""
    index_path = "static/index.html"
    if os.path.exists(index_path):
        with open(index_path, "r") as f:
            return f.read()
    return HTMLResponse(content="<h1>App not found</h1>", status_code=404)


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=False,
        log_level="info"
    )