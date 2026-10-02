"""Flask REST API and local single-command entry point for ExamAI."""

from __future__ import annotations

import csv
import io
import logging
import re
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException

from ai.allocation import run_exam_allocation
from data_store import (
    invalidate_allocation,
    initialize,
    read,
    read_sample,
    write,
)
from models.exam import normalize_exam
from models.room import normalize_room
from models.student import normalize_student

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024
app.json.sort_keys = False
app.logger.setLevel(logging.INFO)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_ROOT = PROJECT_ROOT / "exam-hall-ai"
initialize()


def _body() -> dict[str, Any]:
    payload = request.get_json(silent=False)
    if not isinstance(payload, dict):
        raise ValueError("Send a JSON object in the request body.")
    return payload


def _duplicate_record(
    records: list[dict[str, Any]],
    record: dict[str, Any],
    current_id: str | None = None,
) -> str | None:
    for existing in records:
        if existing.get("id") == current_id:
            continue
        if str(existing.get("id", "")).casefold() == str(record.get("id", "")).casefold():
            return f"ID '{record['id']}' is already in use."
        if "roll_number" in record and str(existing.get("roll_number", "")).casefold() == str(
            record["roll_number"]
        ).casefold():
            return f"Roll number '{record['roll_number']}' is already in use."
    return None


def _find_record(name: str, record_id: str) -> tuple[list[dict[str, Any]], int]:
    records = read(name)
    index = next(
        (position for position, record in enumerate(records) if record["id"] == record_id),
        -1,
    )
    return records, index


@app.get("/")
def home() -> Any:
    """Serve the same vanilla-JS app for the documented `python run.py` workflow."""
    if not (FRONTEND_ROOT / "index.html").is_file():
        return jsonify({"error": "The ExamAI frontend files are missing."}), 404
    return send_from_directory(FRONTEND_ROOT, "index.html")


@app.get("/src/<path:filename>")
def frontend_source(filename: str) -> Any:
    return send_from_directory(FRONTEND_ROOT / "src", filename)


@app.get("/favicon.svg")
def favicon() -> Any:
    return send_from_directory(FRONTEND_ROOT / "public", "favicon.svg")


@app.get("/robots.txt")
def robots() -> Any:
    return send_from_directory(FRONTEND_ROOT / "public", "robots.txt")


@app.get("/api/healthz")
def health_check() -> Any:
    return jsonify({"status": "ok"})


@app.get("/api/dashboard")
def dashboard() -> Any:
    students = read("students")
    rooms = read("rooms")
    exams = read("exams")
    latest = read("allocation")
    total_seats = sum(room["capacity"] for room in rooms)
    occupied = len(latest.get("assignments", [])) if latest else 0
    conflicts = len(latest.get("conflicts", [])) if latest else 0
    status = (
        "Awaiting allocation"
        if latest is None
        else "Allocation ready"
        if latest.get("success")
        else "Solver needs attention"
    )
    return jsonify(
        {
            "students": len(students),
            "rooms": len(rooms),
            "total_seats": total_seats,
            "occupied_seats": occupied,
            "available_seats": max(0, total_seats - occupied),
            "conflict_count": conflicts,
            "allocation_status": status,
            "exam_count": len(exams),
            "latest_allocation": latest,
        }
    )


@app.get("/api/students")
def list_students() -> Any:
    students = read("students")
    query = request.args.get("search", "").strip().casefold()
    if query:
        students = [
            student
            for student in students
            if query
            in " ".join(str(value or "") for value in student.values()).casefold()
        ]
    return jsonify(students)


@app.post("/api/students")
def create_student() -> Any:
    record = normalize_student(_body())
    students = read("students")
    duplicate = _duplicate_record(students, record)
    if duplicate:
        return jsonify({"error": duplicate}), 409
    students.append(record)
    write("students", students)
    invalidate_allocation()
    return jsonify(record), 201


@app.put("/api/students/<student_id>")
def update_student(student_id: str) -> Any:
    record = normalize_student(_body())
    if record["id"] != student_id:
        return jsonify({"error": "The student ID in the URL cannot be changed."}), 400
    students, index = _find_record("students", student_id)
    if index < 0:
        return jsonify({"error": "Student not found."}), 404
    duplicate = _duplicate_record(students, record, current_id=student_id)
    if duplicate:
        return jsonify({"error": duplicate}), 409
    students[index] = record
    write("students", students)
    invalidate_allocation()
    return jsonify(record)


@app.delete("/api/students/<student_id>")
def delete_student(student_id: str) -> Any:
    students, index = _find_record("students", student_id)
    if index < 0:
        return jsonify({"error": "Student not found."}), 404
    removed = students.pop(index)
    write("students", students)
    invalidate_allocation()
    return jsonify({"success": True, "message": f"Deleted {removed['name']}."})


@app.post("/api/students/load-sample")
def load_sample_students() -> Any:
    students = read("students")
    existing_ids = {student["id"].casefold() for student in students}
    existing_rolls = {student["roll_number"].casefold() for student in students}
    added = [
        student
        for student in read_sample("students")
        if student["id"].casefold() not in existing_ids
        and student["roll_number"].casefold() not in existing_rolls
    ]
    students.extend(added)
    if added:
        write("students", students)
        invalidate_allocation()
    return jsonify(
        {
            "success": True,
            "count": len(added),
            "message": f"Loaded {len(added)} sample student(s).",
        }
    )


@app.post("/api/students/import")
def import_students_csv() -> Any:
    payload = _body()
    csv_text = payload.get("csv")
    if not isinstance(csv_text, str) or not csv_text.strip():
        return jsonify({"error": "Choose a non-empty CSV file to import."}), 400

    reader = csv.DictReader(io.StringIO(csv_text.lstrip("\ufeff")))
    if not reader.fieldnames:
        return jsonify({"error": "The CSV needs a header row."}), 400
    column_map = {
        str(name).strip().casefold(): str(name)
        for name in reader.fieldnames
        if name is not None
    }
    students = read("students")
    imported: list[dict[str, Any]] = []
    errors: list[str] = []
    known_ids = {student["id"].casefold() for student in students}
    known_rolls = {student["roll_number"].casefold() for student in students}

    for row_number, row in enumerate(reader, start=2):
        normalized_columns = {
            alias: original
            for alias, original in column_map.items()
        }
        values: dict[str, Any] = {}
        for field in (
            "id",
            "name",
            "roll_number",
            "class_name",
            "section",
            "subject",
            "special_requirement",
        ):
            source_column = normalized_columns.get(field)
            if field == "class_name" and source_column is None:
                source_column = normalized_columns.get("class")
            values[field] = row.get(source_column, "") if source_column else ""
        if not str(values["id"]).strip() and str(values["roll_number"]).strip():
            values["id"] = "CSV-" + re.sub(
                r"[^A-Za-z0-9_-]+", "-", str(values["roll_number"]).strip()
            ).strip("-")
        try:
            record = normalize_student(values)
            if record["id"].casefold() in known_ids:
                raise ValueError(f"Student ID '{record['id']}' already exists.")
            if record["roll_number"].casefold() in known_rolls:
                raise ValueError(f"Roll number '{record['roll_number']}' already exists.")
            imported.append(record)
            known_ids.add(record["id"].casefold())
            known_rolls.add(record["roll_number"].casefold())
        except ValueError as error:
            errors.append(f"Row {row_number}: {error}")

    if imported:
        students.extend(imported)
        write("students", students)
        invalidate_allocation()
    return jsonify(
        {
            "success": len(errors) == 0,
            "imported": len(imported),
            "errors": errors,
        }
    )


@app.get("/api/rooms")
def list_rooms() -> Any:
    return jsonify(read("rooms"))


@app.post("/api/rooms")
def create_room() -> Any:
    record = normalize_room(_body())
    rooms = read("rooms")
    duplicate = _duplicate_record(rooms, record)
    if duplicate:
        return jsonify({"error": duplicate}), 409
    rooms.append(record)
    write("rooms", rooms)
    invalidate_allocation()
    return jsonify(record), 201


@app.put("/api/rooms/<room_id>")
def update_room(room_id: str) -> Any:
    record = normalize_room(_body())
    if record["id"] != room_id:
        return jsonify({"error": "The room ID in the URL cannot be changed."}), 400
    rooms, index = _find_record("rooms", room_id)
    if index < 0:
        return jsonify({"error": "Room not found."}), 404
    rooms[index] = record
    write("rooms", rooms)
    invalidate_allocation()
    return jsonify(record)


@app.delete("/api/rooms/<room_id>")
def delete_room(room_id: str) -> Any:
    rooms, index = _find_record("rooms", room_id)
    if index < 0:
        return jsonify({"error": "Room not found."}), 404
    removed = rooms.pop(index)
    write("rooms", rooms)
    invalidate_allocation()
    return jsonify({"success": True, "message": f"Deleted {removed['name']}."})


@app.get("/api/exams")
def list_exams() -> Any:
    return jsonify(read("exams"))


@app.post("/api/exams")
def create_exam() -> Any:
    record = normalize_exam(_body())
    exams = read("exams")
    duplicate = _duplicate_record(exams, record)
    if duplicate:
        return jsonify({"error": duplicate}), 409
    exams.append(record)
    write("exams", exams)
    return jsonify(record), 201


@app.put("/api/exams/<exam_id>")
def update_exam(exam_id: str) -> Any:
    record = normalize_exam(_body())
    if record["id"] != exam_id:
        return jsonify({"error": "The exam ID in the URL cannot be changed."}), 400
    exams, index = _find_record("exams", exam_id)
    if index < 0:
        return jsonify({"error": "Exam not found."}), 404
    exams[index] = record
    write("exams", exams)
    invalidate_allocation()
    return jsonify(record)


@app.delete("/api/exams/<exam_id>")
def delete_exam(exam_id: str) -> Any:
    exams, index = _find_record("exams", exam_id)
    if index < 0:
        return jsonify({"error": "Exam not found."}), 404
    removed = exams.pop(index)
    write("exams", exams)
    latest = read("allocation")
    if latest and latest.get("exam", {}).get("id") == exam_id:
        invalidate_allocation()
    return jsonify({"success": True, "message": f"Deleted {removed['name']}."})


@app.get("/api/constraints")
def get_constraints() -> Any:
    return jsonify(read("constraints"))


@app.patch("/api/constraints")
def update_constraints() -> Any:
    values = _body()
    settings = read("constraints")
    for field in ("avoid_same_section", "avoid_same_subject"):
        if field in values:
            if not isinstance(values[field], bool):
                return jsonify({"error": f"{field} must be true or false."}), 400
            settings[field] = values[field]
    for field in ("section_weight", "subject_weight"):
        if field in values:
            try:
                weight = float(values[field])
            except (TypeError, ValueError):
                return jsonify({"error": f"{field} must be a number between 0 and 10."}), 400
            if not 0 <= weight <= 10:
                return jsonify({"error": f"{field} must be a number between 0 and 10."}), 400
            settings[field] = weight
    write("constraints", settings)
    invalidate_allocation()
    return jsonify(settings)


@app.post("/api/allocation/run")
def allocate() -> Any:
    payload = _body()
    exam_id = str(payload.get("exam_id", "")).strip()
    exam = next((item for item in read("exams") if item["id"] == exam_id), None)
    if not exam:
        return jsonify({"error": "Choose an existing exam before running allocation."}), 400

    students = read("students")
    rooms = read("rooms")
    if exam["subject"].casefold() not in {"all subjects", "all", "combined"}:
        students = [
            student
            for student in students
            if student["subject"].casefold() == exam["subject"].casefold()
        ]
    if not students:
        return (
            jsonify(
                {
                    "error": (
                        f"No students match the subject '{exam['subject']}'. "
                        "Add eligible students or use an all-subject exam."
                    )
                }
            ),
            422,
        )

    result = run_exam_allocation(
        exam,
        students,
        rooms,
        read("constraints"),
    )
    write("allocation", result)
    # The request was processed successfully even if the CSP is unsatisfiable;
    # return the solver's explanation and measured statistics to the UI.
    return jsonify(result), 200


@app.get("/api/allocation/result")
def allocation_result() -> Any:
    result = read("allocation")
    if result is None:
        return jsonify({"error": "No allocation result exists yet. Run the CSP solver first."}), 404
    return jsonify(result)


@app.get("/api/student/<student_id>")
def student_lookup(student_id: str) -> Any:
    query = student_id.casefold()
    student = next(
        (
            item
            for item in read("students")
            if item["id"].casefold() == query
            or item["roll_number"].casefold() == query
        ),
        None,
    )
    if not student:
        return jsonify({"error": f"No student found for '{student_id}'."}), 404
    latest = read("allocation")
    assignment = next(
        (
            item
            for item in latest.get("assignments", [])
            if item["student_id"] == student["id"]
        ),
        None,
    ) if latest else None
    return jsonify({"student": student, "assignment": assignment})


@app.errorhandler(ValueError)
def handle_validation_error(error: ValueError) -> Any:
    return jsonify({"error": str(error)}), 400


@app.errorhandler(HTTPException)
def handle_http_error(error: HTTPException) -> Any:
    if request.path.startswith("/api/"):
        return jsonify({"error": error.description}), error.code
    return error


@app.errorhandler(Exception)
def handle_unexpected_error(error: Exception) -> Any:
    app.logger.exception("Unhandled ExamAI request error", exc_info=error)
    return jsonify({"error": "The server could not complete this request."}), 500