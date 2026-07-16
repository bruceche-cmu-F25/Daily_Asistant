"""FastAPI entry point for the React-based Daily Dashboard."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .api_attempts import router as attempts_router
from .api_todos import router as todos_router
from .legacy import PROJECT_ROOT, load_dashboard_snapshot
from .repository import neetcode_snapshot


app = FastAPI(title="Daily Dashboard", version="2.0.0-dev")
app.include_router(attempts_router)
app.include_router(todos_router)
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
ASSETS_DIR = FRONTEND_DIST / "assets"

if ASSETS_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


@app.get("/api/v1/health")
def health() -> dict[str, str | bool]:
    return {"ok": True, "version": app.version, "mode": "parallel-preview"}


@app.get("/api/v1/neetcode")
def neetcode() -> dict:
    return neetcode_snapshot()


@app.get("/api/v1/dashboard")
def dashboard() -> dict:
    return load_dashboard_snapshot()


@app.get("/todo-favicon.svg", include_in_schema=False)
def favicon():
    return FileResponse(FRONTEND_DIST / "todo-favicon.svg", media_type="image/svg+xml")


@app.get("/{path:path}", include_in_schema=False)
def react_app(path: str):
    index = FRONTEND_DIST / "index.html"
    if index.is_file():
        return FileResponse(index)
    return JSONResponse(
        status_code=503,
        content={
            "error": "frontend_not_built",
            "detail": "Run npm install and npm run build in frontend/.",
        },
    )
