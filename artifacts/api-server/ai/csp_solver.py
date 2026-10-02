"""CSP formulation and recursive backtracking with MRV and forward checking.

Variables are student IDs, each domain is the student's legal set of physical
seats, and the all-different-seat plus special-seat rules are hard constraints.
Section/subject adjacency is deliberately soft and is scored by Min-Conflicts
after a valid hard-constraint assignment has been found.
"""

from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter
from typing import Any

from ai.constraints import (
    Seat,
    build_seat_domains,
    shared_soft_reasons,
)


@dataclass
class SolverStats:
    variables: int
    available_seats: int
    initial_domain_values: int
    variable_selections: int = 0
    assignments_tried: int = 0
    backtracks: int = 0
    constraint_checks: int = 0
    forward_checks: int = 0
    domain_values_pruned: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "variables": self.variables,
            "available_seats": self.available_seats,
            "initial_domain_values": self.initial_domain_values,
            "variable_selections": self.variable_selections,
            "assignments_tried": self.assignments_tried,
            "backtracks": self.backtracks,
            "constraint_checks": self.constraint_checks,
            "forward_checks": self.forward_checks,
            "domain_values_pruned": self.domain_values_pruned,
        }


def is_consistent(
    student_id: str,
    seat: Seat,
    assignment: dict[str, Seat],
    domains: dict[str, list[Seat]],
    stats: SolverStats,
) -> bool:
    """Enforce the hard all-different-seat and student-domain constraints."""
    stats.constraint_checks += 1
    if seat not in domains[student_id]:
        return False
    return seat not in assignment.values()


def forward_checking(
    domains: dict[str, list[Seat]],
    assignment: dict[str, Seat],
    stats: SolverStats,
) -> dict[str, list[Seat]] | None:
    """Propagate a new seat choice by removing that occupied seat everywhere.

    Returning None signals a domain wipeout, which makes the caller backtrack
    immediately instead of exploring a branch that can no longer succeed.
    """
    stats.forward_checks += 1
    occupied = set(assignment.values())
    reduced: dict[str, list[Seat]] = {}
    for student_id, domain in domains.items():
        if student_id in assignment:
            reduced[student_id] = domain
            continue
        remaining = [seat for seat in domain if seat not in occupied]
        stats.domain_values_pruned += len(domain) - len(remaining)
        if not remaining:
            return None
        reduced[student_id] = remaining
    return reduced


def _soft_degree(
    student_id: str,
    unassigned: set[str],
    students_by_id: dict[str, dict[str, Any]],
    settings: dict[str, Any],
) -> int:
    """Count pairwise soft constraints to break MRV ties with degree heuristic.

    The global all-different constraint connects every remaining student, so it
    gives every variable the same degree. This tie-break counts the additional
    pairwise section/subject edges that make one choice more influential.
    """
    first = students_by_id[student_id]
    return sum(
        bool(shared_soft_reasons(first, students_by_id[other_id], settings))
        for other_id in unassigned
        if other_id != student_id
    )


def select_unassigned_variable(
    assignment: dict[str, Seat],
    domains: dict[str, list[Seat]],
    students_by_id: dict[str, dict[str, Any]],
    settings: dict[str, Any],
) -> str:
    """Choose the smallest current domain (MRV), then highest soft degree."""
    unassigned = set(domains) - set(assignment)
    return min(
        unassigned,
        key=lambda student_id: (
            len(domains[student_id]),
            -_soft_degree(student_id, unassigned, students_by_id, settings),
            student_id,
        ),
    )


def order_domain_values(
    student_id: str,
    assignment: dict[str, Seat],
    domains: dict[str, list[Seat]],
    students_by_id: dict[str, dict[str, Any]],
    settings: dict[str, Any],
) -> list[Seat]:
    """Order seats by least-constraining impact and expected soft conflicts.

    Values that would collide with a student's last remaining seat are least
    constraining only in name, so they sort last. Among otherwise equal choices,
    prefer seats with fewer likely adjacent students from the same section or
    subject, and then stable room/row/column order.
    """
    unassigned = set(domains) - set(assignment) - {student_id}
    student = students_by_id[student_id]
    choices = []
    for seat in domains[student_id]:
        # Every other domain containing this seat loses that value. A domain of
        # size one is a forced variable, so blocking its only value is costly.
        forced_blockers = sum(
            len(domains[other_id]) == 1 and seat in domains[other_id]
            for other_id in unassigned
        )

        # Estimate soft impact using the remaining seat values of related
        # students. This is an ordering preference, not a hard rejection.
        soft_impact = 0.0
        for other_id in unassigned:
            other = students_by_id[other_id]
            reasons = shared_soft_reasons(student, other, settings)
            if not reasons:
                continue
            adjacent_options = sum(
                1
                for other_seat in domains[other_id]
                if other_seat[0] == seat[0]
                and abs(other_seat[1] - seat[1])
                + abs(other_seat[2] - seat[2])
                == 1
            )
            soft_impact += adjacent_options / max(1, len(domains[other_id]))

        # Least-constraining values preserve more options for other variables.
        remaining_options = sum(
            seat not in domains[other_id] for other_id in unassigned
        )
        choices.append(
            (
                forced_blockers,
                soft_impact,
                -remaining_options,
                seat[0],
                seat[1],
                seat[2],
                seat,
            )
        )
    return [item[-1] for item in sorted(choices)]


class CSPSolver:
    """Backtracking solver for one exam's student-to-seat assignment."""

    def __init__(
        self,
        students: list[dict[str, Any]],
        rooms: list[dict[str, Any]],
        settings: dict[str, Any],
    ) -> None:
        self.students = students
        self.rooms = rooms
        self.settings = settings
        self.students_by_id = {student["id"]: student for student in students}
        self.domains = build_seat_domains(students, rooms)
        physical_seats = sum(room["rows"] * room["columns"] for room in rooms)
        self.stats = SolverStats(
            variables=len(students),
            available_seats=physical_seats,
            initial_domain_values=sum(len(domain) for domain in self.domains.values()),
        )

    def backtracking_search(self) -> dict[str, Any]:
        """Run recursive backtracking and return an assignment or explanation."""
        empty_domains = [
            student_id
            for student_id, domain in self.domains.items()
            if not domain
        ]
        if empty_domains:
            reasons = [
                self._empty_domain_explanation(student_id)
                for student_id in empty_domains
            ]
            return {
                "success": False,
                "assignment": {},
                "conflicts": [],
                "statistics": self.stats.as_dict(),
                "explanation": " ".join(reasons),
            }

        if len(self.students) > self.stats.available_seats:
            return {
                "success": False,
                "assignment": {},
                "conflicts": [],
                "statistics": self.stats.as_dict(),
                "explanation": (
                    f"There are {len(self.students)} students but only "
                    f"{self.stats.available_seats} seats. Add rooms or reduce "
                    "the student list before running allocation."
                ),
            }

        assignment: dict[str, Seat] = {}
        solved = self._backtrack(assignment, self.domains)
        if not solved:
            return {
                "success": False,
                "assignment": {},
                "conflicts": [],
                "statistics": self.stats.as_dict(),
                "explanation": (
                    "No valid seating arrangement satisfies the seat and "
                    "special-requirement constraints. Add suitable seats or "
                    "change room capacity."
                ),
            }
        return {
            "success": True,
            "assignment": assignment,
            "conflicts": [],
            "statistics": self.stats.as_dict(),
            "explanation": (
                f"Assigned all {len(assignment)} students to unique suitable "
                "seats using MRV, degree tie-breaking, least-constraining values, "
                "and forward checking."
            ),
        }

    def _backtrack(
        self,
        assignment: dict[str, Seat],
        current_domains: dict[str, list[Seat]],
    ) -> bool:
        if len(assignment) == len(self.students):
            return True
        student_id = select_unassigned_variable(
            assignment,
            current_domains,
            self.students_by_id,
            self.settings,
        )
        self.stats.variable_selections += 1
        for seat in order_domain_values(
            student_id,
            assignment,
            current_domains,
            self.students_by_id,
            self.settings,
        ):
            self.stats.assignments_tried += 1
            if not is_consistent(
                student_id, seat, assignment, current_domains, self.stats
            ):
                continue
            assignment[student_id] = seat
            next_domains = forward_checking(
                current_domains, assignment, self.stats
            )
            if next_domains is not None and self._backtrack(
                assignment, next_domains
            ):
                return True
            assignment.pop(student_id)
            self.stats.backtracks += 1
        return False

    def _empty_domain_explanation(self, student_id: str) -> str:
        student = self.students_by_id[student_id]
        requirement = student.get("special_requirement")
        if requirement:
            return (
                f"{student['name']} ({student['roll_number']}) has no seat "
                f"matching the special requirement '{requirement}'. Configure "
                "suitable room seats or update the requirement."
            )
        return f"{student['name']} ({student['roll_number']}) has no available seat."


def backtracking_search(
    students: list[dict[str, Any]],
    rooms: list[dict[str, Any]],
    settings: dict[str, Any],
) -> dict[str, Any]:
    """Public entry point used by the allocation workflow."""
    return CSPSolver(students, rooms, settings).backtracking_search()
