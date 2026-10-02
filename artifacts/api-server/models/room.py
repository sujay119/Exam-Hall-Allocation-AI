"""Room records and their derived seating capacity."""

from __future__ import annotations

import re
from typing import Any


def room_seat_id(room_id: str, row: int, column: int) -> str:
    """Create a stable identifier for a physical seat."""
    safe_room_id = re.sub(r"[^A-Za-z0-9_-]+", "-", room_id).strip("-").upper()
    return f"{safe_room_id}-R{row}-C{column}"


def normalize_room(payload: dict[str, Any]) -> dict[str, Any]:
    """Validate a room and convert its accessible coordinates to seat IDs.

    Accessible coordinates may be supplied as `1-1`, `R1-C1`, or an existing
    seat ID. The API stores canonical seat IDs to make hard-domain checks exact.
    """
    room_id = str(payload.get("id", "")).strip()
    name = str(payload.get("name", "")).strip()
    if not room_id or not name:
        raise ValueError("Room ID and room name are required.")
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,30}", room_id):
        raise ValueError("Room ID can contain only letters, numbers, underscores, and hyphens.")

    try:
        rows = int(payload.get("rows", 0))
        columns = int(payload.get("columns", 0))
    except (TypeError, ValueError) as error:
        raise ValueError("Rows and columns must be whole numbers.") from error
    if rows < 1 or columns < 1 or rows > 30 or columns > 30:
        raise ValueError("Rows and columns must each be between 1 and 30.")

    available_ids = {
        room_seat_id(room_id, row, column): (row, column)
        for row in range(1, rows + 1)
        for column in range(1, columns + 1)
    }
    raw_accessible = payload.get("accessible_seats") or []
    if isinstance(raw_accessible, str):
        raw_accessible = [part.strip() for part in raw_accessible.split(",") if part.strip()]
    if not isinstance(raw_accessible, list):
        raise ValueError("Accessible seats must be a list of seat coordinates.")

    accessible_ids: list[str] = []
    for item in raw_accessible:
        token = str(item).strip()
        if not token:
            continue
        normalized = token.upper()
        if normalized in available_ids:
            seat_id = normalized
        else:
            match = re.fullmatch(r"(?:R)?(\d+)\s*[-,:]\s*(?:C)?(\d+)", normalized)
            if not match:
                raise ValueError(
                    f"Accessible seat '{token}' is invalid. Use coordinates such as 1-1, 2-1."
                )
            row, column = int(match.group(1)), int(match.group(2))
            seat_id = room_seat_id(room_id, row, column)
            if seat_id not in available_ids:
                raise ValueError(f"Accessible seat {row}-{column} is outside {name}'s grid.")
        if seat_id not in accessible_ids:
            accessible_ids.append(seat_id)

    return {
        "id": room_id,
        "name": name,
        "rows": rows,
        "columns": columns,
        "capacity": rows * columns,
        "accessible_seats": accessible_ids,
    }