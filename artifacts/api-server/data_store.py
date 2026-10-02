"""Atomic JSON-file persistence for the sample exam allocation application."""

from __future__ import annotations

import json
import os
from pathlib import Path
from threading import RLock
from typing import Any

DATA_DIR = Path(__file__).resolve().parent / "data"
_lock = RLock()

_DEFAULTS: dict[str, Any] = {
    "students": [],
    "rooms": [],
    "exams": [],
    "constraints": {
        "avoid_same_section": True,
        "avoid_same_subject": True,
        "section_weight": 1,
        "subject_weight": 1,
    },
    "allocation": None,
    "metadata": {"sample_data_initialized": False},
}


def _path(name: str) -> Path:
    if name not in _DEFAULTS:
        raise ValueError(f"Unknown data file: {name}")
    return DATA_DIR / f"{name}.json"


def read(name: str) -> Any:
    """Read persisted JSON and fail explicitly if the file is malformed."""
    path = _path(name)
    with _lock:
        try:
            with path.open("r", encoding="utf-8") as handle:
                return json.load(handle)
        except FileNotFoundError:
            return _DEFAULTS[name]
        except json.JSONDecodeError as error:
            raise RuntimeError(
                f"Could not parse {path.name} at line {error.lineno}: {error.msg}"
            ) from error


def read_sample(name: str) -> Any:
    """Read immutable sample fixtures stored beside the mutable JSON data."""
    if name not in {"students", "rooms", "exams"}:
        raise ValueError(f"Unknown sample data file: {name}")
    path = DATA_DIR / f"sample_{name}.json"
    with _lock:
        try:
            with path.open("r", encoding="utf-8") as handle:
                return json.load(handle)
        except FileNotFoundError:
            return []
        except json.JSONDecodeError as error:
            raise RuntimeError(
                f"Could not parse {path.name} at line {error.lineno}: {error.msg}"
            ) from error


def write(name: str, value: Any) -> None:
    """Persist JSON with an atomic replace so interrupted writes do not corrupt it."""
    path = _path(name)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with _lock:
        temporary = path.with_suffix(".json.tmp")
        with temporary.open("w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        temporary.replace(path)


def initialize() -> None:
    """Load the included sample workspace exactly once on first startup."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    metadata = read("metadata")
    if metadata.get("sample_data_initialized"):
        return

    for name in ("students", "rooms", "exams"):
        if not read(name):
            sample_path = DATA_DIR / f"sample_{name}.json"
            if sample_path.exists():
                write(name, read_sample(name))
    metadata["sample_data_initialized"] = True
    write("metadata", metadata)


def invalidate_allocation() -> None:
    """Prevent an old seat plan from appearing current after input changes."""
    write("allocation", None)