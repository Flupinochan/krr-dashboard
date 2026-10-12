import asyncio
import sys
from pathlib import Path

from dashboard.krr_runner import KrrRunner

SAMPLE_CSV = Path(__file__).resolve().parent / "krr.csv"

COPY_SAMPLE = [
    sys.executable,
    "-c",
    f"import sys; sys.stdout.write(open(r'{SAMPLE_CSV}', encoding='utf-8').read())",
]


def make_runner(tmp_path, command, timeout=30.0):
    return KrrRunner(
        data_dir=tmp_path, command=command, workdir=str(tmp_path), timeout_seconds=timeout
    )


def test_success_replaces_csv(tmp_path):
    runner = make_runner(tmp_path, COPY_SAMPLE)

    assert asyncio.run(runner.run_once()) is True

    assert runner.state == "idle"
    assert runner.csv_path.read_text(encoding="utf-8") == SAMPLE_CSV.read_text(
        encoding="utf-8"
    )
    assert not (tmp_path / "krr.csv.tmp").exists()


def test_failure_keeps_old_csv(tmp_path):
    old = tmp_path / "krr.csv"
    old.write_text("old", encoding="utf-8")
    runner = make_runner(
        tmp_path, [sys.executable, "-c", "import sys; sys.stderr.write('boom'); sys.exit(2)"]
    )

    assert asyncio.run(runner.run_once()) is False

    assert runner.state == "failed"
    assert "boom" in runner.error
    assert old.read_text(encoding="utf-8") == "old"
    assert not (tmp_path / "krr.csv.tmp").exists()


def test_invalid_header_keeps_old_csv(tmp_path):
    old = tmp_path / "krr.csv"
    old.write_text("old", encoding="utf-8")
    runner = make_runner(
        tmp_path, [sys.executable, "-c", "print('not,a,krr,csv'); print('1,2,3,4')"]
    )

    assert asyncio.run(runner.run_once()) is False

    assert runner.state == "failed"
    assert old.read_text(encoding="utf-8") == "old"


def test_timeout_marks_failed(tmp_path):
    runner = make_runner(
        tmp_path, [sys.executable, "-c", "import time; time.sleep(30)"], timeout=0.5
    )

    assert asyncio.run(runner.run_once()) is False

    assert runner.state == "failed"
    assert runner.error == "timeout"


def test_second_start_while_running_is_rejected(tmp_path):
    runner = make_runner(tmp_path, COPY_SAMPLE)

    async def scenario():
        first = runner.start()
        second = runner.start()
        await runner._task
        return first, second

    assert asyncio.run(scenario()) == (True, False)
