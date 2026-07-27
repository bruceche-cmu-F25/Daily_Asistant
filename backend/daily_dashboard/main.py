"""FastAPI entry point for the React-based Daily Dashboard."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .api_applications import router as applications_router
from .api_application_signals import router as application_signals_router
from .api_attempts import router as attempts_router
from .api_job_leads import router as job_leads_router
from .api_life_tasks import router as life_tasks_router
from .api_pi_web import router as pi_web_router
from .api_trip_plan import router as trip_plan_router
from .api_todos import router as todos_router
from .legacy import PROJECT_ROOT
from .repository import neetcode_snapshot
from .snapshot import load_dashboard_snapshot


app = FastAPI(title="Daily Dashboard", version="2.0.0-dev")
app.include_router(applications_router)
app.include_router(application_signals_router)
app.include_router(job_leads_router)
app.include_router(life_tasks_router)
app.include_router(pi_web_router)
app.include_router(trip_plan_router)
app.include_router(attempts_router)
app.include_router(todos_router)
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
ASSETS_DIR = FRONTEND_DIST / "assets"

if ASSETS_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


@app.get("/api/v1/health")
def health() -> dict[str, str | bool]:
    return {"ok": True, "version": app.version, "mode": "local-first"}


@app.get("/api/v1/neetcode")
def neetcode() -> dict:
    return neetcode_snapshot()


@app.get("/api/v1/dashboard")
def dashboard() -> dict:
    return load_dashboard_snapshot()


@app.get("/todo-favicon.svg", include_in_schema=False)
def favicon():
    return FileResponse(
        FRONTEND_DIST / "todo-favicon.svg",
        media_type="image/svg+xml",
        headers={"Cache-Control": "no-cache"},
    )


@app.get("/todo-favicon.png", include_in_schema=False)
def favicon_png():
    return FileResponse(
        FRONTEND_DIST / "todo-favicon.png",
        media_type="image/png",
        headers={"Cache-Control": "no-cache"},
    )


@app.get("/favicon.ico", include_in_schema=False)
def favicon_ico():
    return FileResponse(
        FRONTEND_DIST / "favicon.ico",
        media_type="image/x-icon",
        headers={"Cache-Control": "no-cache"},
    )


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
