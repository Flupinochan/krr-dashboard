import asyncio
import csv
import os
from datetime import datetime, timezone
from pathlib import Path

from .csv_parser import has_expected_header

DEFAULT_COMMAND = [
    "python",
    "krr.py",
    "simple",
    "-f",
    "csv-raw",
    "--logtostderr",
    "--max-workers",
    "3",
    "-n",
    ".*",
]
STDERR_TAIL_BYTES = 500


class RunError(Exception):
    pass


def validate_csv(path: Path) -> None:
    with path.open(newline="", encoding="utf-8") as stream:
        reader = csv.reader(stream)
        header = next(reader, None)
        if header is None or not has_expected_header(header):
            raise RunError("csv header mismatch")
        if next(reader, None) is None:
            raise RunError("csv has no data rows")


class KrrRunner:
    def __init__(
        self,
        data_dir: Path,
        command: list[str],
        workdir: str,
        timeout_seconds: float,
    ) -> None:
        self.csv_path = data_dir / "krr.csv"
        self._tmp_path = data_dir / "krr.csv.tmp"
        self._command = command
        self._workdir = workdir
        self._timeout_seconds = timeout_seconds
        self.state = "idle"
        self.started_at: str | None = None
        self.finished_at: str | None = None
        self.error: str | None = None
        self._task: asyncio.Task | None = None

    def start(self) -> bool:
        # 単一のイベントループ内で確認と状態更新を同期的に行うため、ロックは不要
        if self.state == "running":
            return False
        self.state = "running"
        self._task = asyncio.create_task(self._execute())
        return True

    async def run_once(self) -> bool:
        if not self.start():
            return False
        await self._task
        return self.state == "idle"

    def status(self) -> dict:
        return {
            "state": self.state,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "error": self.error,
        }

    async def _execute(self) -> None:
        self.started_at = _now()
        self.error = None
        try:
            await self._run_krr()
            validate_csv(self._tmp_path)
            os.replace(self._tmp_path, self.csv_path)
            self.state = "idle"
        except Exception as exc:
            self.state = "failed"
            self.error = str(exc) or type(exc).__name__
        finally:
            self.finished_at = _now()
            self._tmp_path.unlink(missing_ok=True)

    async def _run_krr(self) -> None:
        self._tmp_path.parent.mkdir(parents=True, exist_ok=True)
        with self._tmp_path.open("wb") as out:
            proc = await asyncio.create_subprocess_exec(
                *self._command,
                cwd=self._workdir,
                stdout=out,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                _, stderr = await asyncio.wait_for(
                    proc.communicate(), self._timeout_seconds
                )
            except TimeoutError:
                proc.kill()
                await proc.wait()
                raise RunError("timeout") from None
        if proc.returncode != 0:
            tail = stderr[-STDERR_TAIL_BYTES:].decode("utf-8", errors="replace")
            raise RunError(f"krr exited with {proc.returncode}: {tail.strip()}")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
