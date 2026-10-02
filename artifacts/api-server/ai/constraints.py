"""Hard seat constraints and soft adjacency preferences for the CSP."""

from __future__ import annotations

from typing import Any, TypeAlias

from models.room import room_seat_id

Seat: TypeAlias = tuple[str, int, int]


def seat_id(seat: Seat) -> str:
    """Return the canonical room-row-column ID for a seat."""
    return room_seat_id(seat[0], seat[1], seat[2])


def all_seats(rooms: list[dict[str, Any]]) -> list[Seat]:
    """Expand room dimensions into the CSP's finite set of seat values."""
    return [
        (room["id"], row, column)
        for room in rooms
        for row in range(1, room["rows"] + 1)
        for column in range(1, room["columns"] + 1)
    ]


def build_seat_domains(
    students: list[dict[str, Any]], rooms: list[dict[str, Any]]
) -> dict[str, list[Seat]]:
    """Create each student's legal seat domain, including special requirements."""
    seats_by_room = {
        room["id"]: [
            (room["id"], row, column)
            for row in range(1, room["rows"] + 1)
            for column in range(1, room["columns"] + 1)
        ]
        for room in rooms
    }
    room_by_id = {room["id"]: room for room in rooms}
    domains: dict[str, list[Seat]] = {}

    for student in students:
        requirement = (student.get("special_requirement") or "").casefold()
        domain: list[Seat] = []
        for room_id, room_seats in seats_by_room.items():
            room = room_by_id[room_id]
            for seat in room_seats:
                if is_suitable_seat(student, room, seat):
                    domain.append(seat)
        domains[student["id"]] = domain
    return domains


def is_suitable_seat(
    student: dict[str, Any], room: dict[str, Any], seat: Seat
) -> bool:
    """Treat front-row and accessible needs as hard domain restrictions."""
    requirement = (student.get("special_requirement") or "").casefold()
    if any(word in requirement for word in ("front", "board", "vision")) and seat[1] != 1:
        return False
    if any(word in requirement for word in ("access", "wheelchair", "mobility")):
        return seat_id(seat) in set(room.get("accessible_seats") or [])
    return True


def seats_are_adjacent(first: Seat, second: Seat) -> bool:
    """Seats are adjacent when they share a row/column edge in the same room."""
    return first[0] == second[0] and (
        abs(first[1] - second[1]) + abs(first[2] - second[2]) == 1
    )


def shared_soft_reasons(
    first: dict[str, Any],
    second: dict[str, Any],
    settings: dict[str, Any],
) -> list[str]:
    """List enabled preferences that make this student pair a soft conflict."""
    reasons: list[str] = []
    same_class_section = (
        str(first.get("class_name", "")).casefold()
        == str(second.get("class_name", "")).casefold()
        and str(first.get("section", "")).casefold()
        == str(second.get("section", "")).casefold()
    )
    if settings.get("avoid_same_section", True) and same_class_section:
        reasons.append("same class and section")
    if (
        settings.get("avoid_same_subject", True)
        and str(first.get("subject", "")).casefold()
        == str(second.get("subject", "")).casefold()
    ):
        reasons.append("same subject")
    return reasons


def conflict_score_for_pair(
    reasons: list[str], settings: dict[str, Any]
) -> float:
    """Weight each soft violation using the administrator's current preferences."""
    score = 0.0
    for reason in reasons:
        if reason == "same class and section":
            score += float(settings.get("section_weight", 1))
        elif reason == "same subject":
            score += float(settings.get("subject_weight", 1))
    return score


def find_soft_conflicts(
    assignment: dict[str, Seat],
    students_by_id: dict[str, dict[str, Any]],
    settings: dict[str, Any],
) -> list[dict[str, Any]]:
    """Report every adjacent pair with a real enabled preference violation."""
    assigned_ids = sorted(assignment)
    conflicts: list[dict[str, Any]] = []
    for index, first_id in enumerate(assigned_ids):
        for second_id in assigned_ids[index + 1 :]:
            if not seats_are_adjacent(assignment[first_id], assignment[second_id]):
                continue
            first = students_by_id[first_id]
            second = students_by_id[second_id]
            reasons = shared_soft_reasons(first, second, settings)
            if not reasons:
                continue
            conflicts.append(
                {
                    "student_ids": [first_id, second_id],
                    "roll_numbers": [first["roll_number"], second["roll_number"]],
                    "reasons": reasons,
                    "score": conflict_score_for_pair(reasons, settings),
                }
            )
    return conflicts
