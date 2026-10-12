import os
import shlex
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .csv_parser import parse_csv
from .krr_runner import DEFAULT_COMMAND, KrrRunner

STATIC_DIR = Path(__file__).parent / "static"

command_env = os.environ.get("KRR_COMMAND")
runner = KrrRunner(
    data_dir=Path(os.environ.get("DATA_DIR", "/data")),
    command=shlex.split(command_env) if command_env else DEFAULT_COMMAND,
    workdir=os.environ.get("KRR_WORKDIR", "/app"),
    timeout_seconds=float(os.environ.get("KRR_TIMEOUT_SECONDS", "1800")),
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not runner.csv_path.exists():
        runner.start()
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/api/status")
def get_status() -> dict:
    return runner.status()


@app.get("/api/recommendations")
def get_recommendations() -> dict:
    if not runner.csv_path.exists():
        return {"generated_at": None, "rows": [], "status": runner.status()}
    generated_at = datetime.fromtimestamp(
        runner.csv_path.stat().st_mtime, tz=timezone.utc
    ).isoformat(timespec="seconds")
    return {
        "generated_at": generated_at,
        "rows": parse_csv(runner.csv_path),
        "status": runner.status(),
    }


@app.post("/api/regenerate")
async def regenerate() -> JSONResponse:
    if not runner.start():
        return JSONResponse({"detail": "already running"}, status_code=409)
    return JSONResponse(runner.status(), status_code=202)


@app.get("/api/download")
def download() -> Response:
    if not runner.csv_path.exists():
        return JSONResponse({"detail": "csv not generated"}, status_code=404)
    return FileResponse(runner.csv_path, media_type="text/csv", filename="krr.csv")


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
