"""Exam schedule records."""

from datetime import date
from typing import Any


def normalize_exam(payload: dict[str, Any]) -> dict[str, Any]:
    """Validate exam schedule data stored alongside the allocation inputs."""
    record = {
        field: str(payload.get(field, "")).strip()
        for field in ("id", "name", "subject", "date", "time")
    }
    missing = [field for field, value in record.items() if not value]
    if missing:
        raise ValueError(f"Missing required exam fields: {', '.join(missing)}")
    try:
        date.fromisoformat(record["date"])
        duration = int(payload.get("duration", 0))
    except (TypeError, ValueError) as error:
        raise ValueError("Use a valid exam date and whole-number duration.") from error
    if duration < 1 or duration > 24 * 60:
        raise ValueError("Exam duration must be between 1 and 1440 minutes.")
    record["duration"] = duration
    return record