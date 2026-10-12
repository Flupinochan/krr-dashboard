from pathlib import Path

import pytest

from dashboard.csv_parser import parse_csv, parse_metric

SAMPLE_CSV = Path(__file__).resolve().parent / "krr.csv"


def test_parse_metric_distinguishes_unset_and_unknown():
    assert parse_metric("0.05") == {"value": 0.05, "state": "set"}
    assert parse_metric("unset") == {"value": None, "state": "unset"}
    assert parse_metric("?") == {"value": None, "state": "unknown"}


def test_parse_sample_csv():
    rows = parse_csv(SAMPLE_CSV)

    assert len(rows) == 67
    first = rows[0]
    assert first["namespace"] == "argo-rollouts"
    assert first["type"] == "Deployment"
    assert first["cpu_limits_recommended"]["state"] == "unset"
    assert first["memory_requests_recommended"]["value"] == 104857600

    unknown = [row for row in rows if row["severity"] == "UNKNOWN"]
    assert unknown[0]["cpu_requests_recommended"]["state"] == "unknown"


def test_rejects_unexpected_header(tmp_path):
    bad = tmp_path / "bad.csv"
    bad.write_text("a,b,c\n1,2,3\n", encoding="utf-8")

    with pytest.raises(ValueError):
        parse_csv(bad)
