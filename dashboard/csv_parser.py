import csv
from pathlib import Path

EXPECTED_HEADER = [
    "Namespace",
    "Name",
    "Pods",
    "Old Pods",
    "Type",
    "Container",
    "Severity",
    "CPU Requests Current",
    "CPU Requests Recommended",
    "CPU Limits Current",
    "CPU Limits Recommended",
    "Memory Requests Current",
    "Memory Requests Recommended",
    "Memory Limits Current",
    "Memory Limits Recommended",
]

METRIC_KEYS = {
    "CPU Requests Current": "cpu_requests_current",
    "CPU Requests Recommended": "cpu_requests_recommended",
    "CPU Limits Current": "cpu_limits_current",
    "CPU Limits Recommended": "cpu_limits_recommended",
    "Memory Requests Current": "memory_requests_current",
    "Memory Requests Recommended": "memory_requests_recommended",
    "Memory Limits Current": "memory_limits_current",
    "Memory Limits Recommended": "memory_limits_recommended",
}


def parse_metric(raw: str) -> dict:
    text = raw.strip()
    if text == "unset":
        return {"value": None, "state": "unset"}
    if text == "?":
        return {"value": None, "state": "unknown"}
    try:
        return {"value": float(text), "state": "set"}
    except ValueError:
        return {"value": None, "state": "unknown"}


def parse_int(raw: str) -> int:
    try:
        return int(float(raw))
    except ValueError:
        return 0


def has_expected_header(header: list[str]) -> bool:
    return [column.strip() for column in header] == EXPECTED_HEADER


def parse_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames is None or not has_expected_header(reader.fieldnames):
            raise ValueError("unexpected csv header")
        rows = []
        for record in reader:
            row = {
                "namespace": record["Namespace"],
                "name": record["Name"],
                "pods": parse_int(record["Pods"]),
                "old_pods": parse_int(record["Old Pods"]),
                "type": record["Type"],
                "container": record["Container"],
                "severity": record["Severity"],
            }
            for column, key in METRIC_KEYS.items():
                row[key] = parse_metric(record[column])
            rows.append(row)
    return rows
