"""Student records used as CSP variables."""

from typing import Any


REQUIRED_FIELDS = ("id", "name", "roll_number", "class_name", "section", "subject")


def normalize_student(payload: dict[str, Any]) -> dict[str, Any]:
    """Validate and normalize a student record before it enters the CSP."""
    record = {
        field: str(payload.get(field, "")).strip()
        for field in REQUIRED_FIELDS
    }
    missing = [field for field, value in record.items() if not value]
    if missing:
        raise ValueError(f"Missing required student fields: {', '.join(missing)}")

    special = str(payload.get("special_requirement") or "").strip()
    record["special_requirement"] = special or None
    return record