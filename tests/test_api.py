import importlib
import sys
from pathlib import Path

from fastapi.testclient import TestClient

SAMPLE_CSV = Path(__file__).resolve().parent / "krr.csv"


def load_app(monkeypatch, data_dir):
    monkeypatch.setenv("DATA_DIR", str(data_dir))
    monkeypatch.setenv("KRR_WORKDIR", str(data_dir))
    python = Path(sys.executable).as_posix()
    sample = SAMPLE_CSV.as_posix()
    command = (
        f'"{python}" -c "import sys; '
        f"sys.stdout.write(open('{sample}', encoding='utf-8').read())\""
    )
    monkeypatch.setenv("KRR_COMMAND", command)
    import dashboard.main as main

    return importlib.reload(main)


def test_recommendations_and_regenerate(monkeypatch, tmp_path):
    main = load_app(monkeypatch, tmp_path)

    with TestClient(main.app) as client:
        # 起動時に CSV がなければ自動生成が走る
        for _ in range(100):
            if main.runner.state != "running":
                break
            import time

            time.sleep(0.1)

        body = client.get("/api/recommendations").json()
        assert len(body["rows"]) == 67
        assert body["generated_at"] is not None

        assert client.post("/api/regenerate").status_code == 202
        assert client.post("/api/regenerate").status_code == 409

        assert client.get("/api/download").status_code == 200
