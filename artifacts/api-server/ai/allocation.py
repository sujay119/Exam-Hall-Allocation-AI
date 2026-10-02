"""Allocation orchestration: CSP, local optimization, and result explanation."""

from __future__ import annotations

from datetime import datetime, timezone
from time import perf_counter
from typing import Any

from ai.constraints import (
    Seat,
    build_seat_domains,
    find_soft_conflicts,
    is_suitable_seat,
    seat_id,
)
from ai.csp_solver import backtracking_search
from ai.heuristics import min_conflicts_optimize


def _seat_is_special(
    student: dict[str, Any], seat: Seat, room_by_id: dict[str, dict[str, Any]]
) -> bool:
    room = room_by_id[seat[0]]
    return bool(
        student.get("special_requirement")
        or seat_id(seat) in set(room.get("accessible_seats") or [])
    )


def _hard_constraint_violations(
    assignment: dict[str, Seat],
    students_by_id: dict[str, dict[str, Any]],
    room_by_id: dict[str, dict[str, Any]],
) -> list[str]:
    violations: list[str] = []
    seats_seen: set[Seat] = set()
    for student_id, seat in assignment.items():
        if seat in seats_seen:
            violations.append(f"Seat {seat_id(seat)} is assigned more than once.")
        seats_seen.add(seat)
        if seat[0] not in room_by_id or not is_suitable_seat(
            students_by_id[student_id], room_by_id[seat[0]], seat
        ):
            violations.append(
                f"Seat {seat_id(seat)} does not satisfy "
                f"{students_by_id[student_id]['roll_number']}'s hard requirement."
            )
    return violations


def _format_assignments(
    assignment: dict[str, Seat],
    students_by_id: dict[str, dict[str, Any]],
    room_by_id: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    formatted = []
    for student_id, seat in assignment.items():
        student = students_by_id[student_id]
        room = room_by_id[seat[0]]
        formatted.append(
            {
                "student_id": student_id,
                "student_name": student["name"],
                "roll_number": student["roll_number"],
                "class_name": student["class_name"],
                "section": student["section"],
                "subject": student["subject"],
                "special_requirement": student.get("special_requirement"),
                "room_id": room["id"],
                "room_name": room["name"],
                "row": seat[1],
                "column": seat[2],
                "seat_id": seat_id(seat),
                "special": _seat_is_special(student, seat, room_by_id),
            }
        )
    return sorted(
        formatted,
        key=lambda item: (
            item["room_id"].casefold(),
            item["row"],
            item["column"],
        ),
    )


def run_exam_allocation(
    exam: dict[str, Any],
    all_students: list[dict[str, Any]],
    rooms: list[dict[str, Any]],
    settings: dict[str, Any],
) -> dict[str, Any]:
    """Allocate students for one exam and return measured solver evidence."""
    started = perf_counter()
    exam_subject = str(exam.get("subject", "")).casefold()
    if exam_subject in {"all subjects", "all", "combined"}:
        students = list(all_students)
    else:
        students = [
            student
            for student in all_students
            if str(student.get("subject", "")).casefold() == exam_subject
        ]

    students_by_id = {student["id"]: student for student in students}
    room_by_id = {room["id"]: room for room in rooms}
    solver_result = backtracking_search(students, rooms, settings)
    if not solver_result["success"]:
        return {
            "success": False,
            "exam": exam,
            "assignments": [],
            "rooms": [],
            "conflicts": [],
            "statistics": {
                **solver_result["statistics"],
                "algorithm": "CSP backtracking with MRV, degree heuristic, and forward checking",
                "execution_time_seconds": round(perf_counter() - started, 6),
                "final_conflicts": 0,
                "hard_constraint_violations": 0,
            },
            "totals": {
                "students": len(students),
                "seats_total": sum(room["capacity"] for room in rooms),
                "students_allocated": 0,
                "empty_seats": sum(room["capacity"] for room in rooms),
                "hard_constraint_violations": 0,
                "soft_constraint_violations": 0,
                "conflict_score": 0,
            },
            "explanation": solver_result["explanation"],
            "steps": [
                {
                    "title": "Problem formulation",
                    "detail": (
                        f"{len(students)} student variables and "
                        f"{sum(room['capacity'] for room in rooms)} physical seats."
                    ),
                    "count": len(students),
                },
                {
                    "title": "Domains and hard constraints",
                    "detail": solver_result["explanation"],
                    "count": solver_result["statistics"]["initial_domain_values"],
                },
            ],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

    initial_assignment: dict[str, Seat] = solver_result["assignment"]
    domains = build_seat_domains(students, rooms)
    initial_conflicts = find_soft_conflicts(
        initial_assignment, students_by_id, settings
    )
    optimized_assignment, optimization_stats = min_conflicts_optimize(
        initial_assignment,
        students,
        domains,
        settings,
    )
    conflicts = find_soft_conflicts(optimized_assignment, students_by_id, settings)
    hard_violations = _hard_constraint_violations(
        optimized_assignment, students_by_id, room_by_id
    )
    assignments = _format_assignments(
        optimized_assignment, students_by_id, room_by_id
    )
    assignments_by_room = {
        room["id"]: [] for room in rooms
    }
    for item in assignments:
        assignments_by_room[item["room_id"]].append(item)
    room_results = [
        {
            "room_id": room["id"],
            "room_name": room["name"],
            "rows": room["rows"],
            "columns": room["columns"],
            "capacity": room["capacity"],
            "accessible_seats": room.get("accessible_seats", []),
            "seats": assignments_by_room[room["id"]],
        }
        for room in rooms
    ]

    conflict_score = round(sum(item["score"] for item in conflicts), 2)
    seat_count = sum(room["capacity"] for room in rooms)
    statistics: dict[str, Any] = {
        **solver_result["statistics"],
        **optimization_stats,
        "algorithm": "CSP backtracking + Min-Conflicts",
        "initial_soft_conflicts": len(initial_conflicts),
        "final_conflicts": len(conflicts),
        "hard_constraint_violations": len(hard_violations),
        "execution_time_seconds": round(perf_counter() - started, 6),
    }
    return {
        "success": len(hard_violations) == 0,
        "exam": exam,
        "assignments": assignments,
        "rooms": room_results,
        "conflicts": conflicts,
        "hard_constraint_violations": hard_violations,
        "statistics": statistics,
        "totals": {
            "students": len(students),
            "seats_total": seat_count,
            "students_allocated": len(assignments),
            "empty_seats": max(0, seat_count - len(assignments)),
            "hard_constraint_violations": len(hard_violations),
            "soft_constraint_violations": len(conflicts),
            "conflict_score": conflict_score,
            "conflict_score_before_optimization": round(
                float(optimization_stats["conflict_score_before_optimization"]), 2
            ),
        },
        "explanation": (
            f"Backtracking assigned {len(assignments)} students to unique suitable "
            f"seats. Min-Conflicts reduced the weighted adjacency score from "
            f"{float(optimization_stats['conflict_score_before_optimization']):g} "
            f"to {conflict_score:g}; {len(hard_violations)} hard constraints were "
            "violated."
        ),
        "steps": [
            {
                "title": "Problem formulation",
                "detail": (
                    f"{len(students)} student variables, "
                    f"{seat_count} physical seats across {len(rooms)} rooms."
                ),
                "count": len(students),
            },
            {
                "title": "Domains generated",
                "detail": (
                    f"Built {solver_result['statistics']['initial_domain_values']} "
                    "legal student-seat values, excluding seats incompatible with "
                    "special requirements."
                ),
                "count": solver_result["statistics"]["initial_domain_values"],
            },
            {
                "title": "Constraints applied",
                "detail": (
                    "Seat uniqueness and suitable-seat requirements are hard "
                    "constraints. Same-section and same-subject adjacency are "
                    "weighted soft preferences."
                ),
                "count": solver_result["statistics"]["constraint_checks"],
            },
            {
                "title": "MRV and degree heuristic",
                "detail": (
                    f"Selected a variable {solver_result['statistics']['variable_selections']} "
                    "times, breaking minimum-domain ties by pairwise constraint degree."
                ),
                "count": solver_result["statistics"]["variable_selections"],
            },
            {
                "title": "Forward checking",
                "detail": (
                    f"Propagated {solver_result['statistics']['forward_checks']} "
                    "assignments and removed "
                    f"{solver_result['statistics']['domain_values_pruned']} "
                    "occupied seat values from remaining domains."
                ),
                "count": solver_result["statistics"]["domain_values_pruned"],
            },
            {
                "title": "Backtracking search",
                "detail": (
                    f"Tried {solver_result['statistics']['assignments_tried']} "
                    f"seat values and backtracked "
                    f"{solver_result['statistics']['backtracks']} times."
                ),
                "count": solver_result["statistics"]["backtracks"],
            },
            {
                "title": "Valid assignment found",
                "detail": (
                    f"{len(assignments)} unique assignments passed all hard checks."
                ),
                "count": len(assignments),
            },
            {
                "title": "Min-Conflicts optimization",
                "detail": (
                    f"Ran {optimization_stats['optimization_iterations']} local-search "
                    f"steps; weighted conflict score is {conflict_score:g}."
                ),
                "count": optimization_stats["optimization_iterations"],
            },
        ],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }