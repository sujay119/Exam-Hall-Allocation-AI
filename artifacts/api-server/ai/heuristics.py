"""Optional Min-Conflicts local-search pass over a valid CSP assignment."""

from __future__ import annotations

import random
from typing import Any

from ai.constraints import (
    Seat,
    find_soft_conflicts,
)


def _score(
    assignment: dict[str, Seat],
    students_by_id: dict[str, dict[str, Any]],
    settings: dict[str, Any],
) -> float:
    return sum(
        conflict["score"]
        for conflict in find_soft_conflicts(assignment, students_by_id, settings)
    )


def min_conflicts_optimize(
    assignment: dict[str, Seat],
    students: list[dict[str, Any]],
    domains: dict[str, list[Seat]],
    settings: dict[str, Any],
    max_iterations: int | None = None,
) -> tuple[dict[str, Seat], dict[str, int | float]]:
    """Reduce adjacent section/subject violations by swapping legal seats.

    Each step chooses a student currently involved in a soft conflict, then
    evaluates the legal seat values reachable by a move or seat swap. The move
    with the fewest remaining weighted conflicts is retained only when it
    improves the objective. Seat swaps keep the CSP's all-different constraint
    intact; domain membership keeps special-seat constraints intact.
    """
    students_by_id = {student["id"]: student for student in students}
    current = dict(assignment)
    initial_score = _score(current, students_by_id, settings)
    stats: dict[str, int | float] = {
        "optimization_iterations": 0,
        "candidate_evaluations": 0,
        "optimization_improvements": 0,
        "conflicts_before_optimization": len(
            find_soft_conflicts(current, students_by_id, settings)
        ),
    }
    if initial_score == 0 or not current:
        stats["conflicts_after_optimization"] = stats[
            "conflicts_before_optimization"
        ]
        return current, stats

    # A fixed seed makes the same data produce the same optimization trace.
    rng = random.Random(42)
    limit = max_iterations if max_iterations is not None else max(100, len(current) * 20)
    for _ in range(limit):
        conflicts = find_soft_conflicts(current, students_by_id, settings)
        if not conflicts:
            break
        conflicted_ids = sorted(
            {
                student_id
                for conflict in conflicts
                for student_id in conflict["student_ids"]
            }
        )
        selected_id = rng.choice(conflicted_ids)
        selected_seat = current[selected_id]
        occupied_by = {
            seat: student_id for student_id, seat in current.items()
        }
        current_score = sum(conflict["score"] for conflict in conflicts)
        best_score = current_score
        best_assignment: dict[str, Seat] | None = None
        best_moves: list[dict[str, Seat]] = []

        for target_seat in domains[selected_id]:
            if target_seat == selected_seat:
                continue
            partner_id = occupied_by.get(target_seat)
            if partner_id is not None and selected_seat not in domains[partner_id]:
                continue

            candidate = dict(current)
            candidate[selected_id] = target_seat
            if partner_id is not None:
                candidate[partner_id] = selected_seat
            score = _score(candidate, students_by_id, settings)
            stats["candidate_evaluations"] += 1
            if score < best_score:
                best_score = score
                best_assignment = candidate
                best_moves = [candidate]
            elif score == best_score and score < current_score:
                best_moves.append(candidate)

        stats["optimization_iterations"] += 1
        if best_moves:
            current = rng.choice(best_moves)
            stats["optimization_improvements"] += 1
        else:
            # This assignment is at a local minimum under single-student moves
            # and legal seat swaps; stopping avoids cycling through equal scores.
            break

    stats["conflicts_after_optimization"] = len(
        find_soft_conflicts(current, students_by_id, settings)
    )
    stats["conflict_score_before_optimization"] = initial_score
    stats["conflict_score_after_optimization"] = _score(
        current, students_by_id, settings
    )
    return current, stats
