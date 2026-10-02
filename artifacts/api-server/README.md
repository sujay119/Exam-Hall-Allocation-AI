# ExamAI Hall Allocation

ExamAI manages exam rosters and rooms, then assigns students to seats using a
real Python constraint-satisfaction solver. Records are stored as JSON files.
The browser interface is vanilla JavaScript; its forms and results use the
Flask REST API, not mock data.

## Run locally

```bash
cd artifacts/api-server
python -m pip install -r requirements.txt
python run.py
```

Open <http://127.0.0.1:5000>. The first run loads 30 fictional students, three
30-seat rooms, two exam schedules, and default constraint settings. The API
listens on the Replit-assigned `PORT` when started by the workspace workflow.

The frontend can also run from the workspace's web workflow while the API
workflow is running. The API paths are rooted at `/api`.

## AI Concepts Used

| AI concept | How the application uses it |
| --- | --- |
| Constraint Satisfaction Problem (CSP) | Each student is a variable; possible physical seats form that student's domain. Hard seat uniqueness and special-seat requirements are enforced in `ai/csp_solver.py` and `ai/constraints.py`. |
| Variables | Student IDs are the variables; see `CSPSolver` in `ai/csp_solver.py`. |
| Domains | `build_seat_domains()` in `ai/constraints.py` enumerates each student's legal room-row-column seats. Front-row and accessible requirements remove unsuitable seats from the domain. |
| Constraints | `is_consistent()` enforces one student per seat and domain membership. `find_soft_conflicts()` measures same-section and same-subject adjacency separately as preferences. |
| Constraint propagation | `forward_checking()` removes an occupied seat from every remaining variable's domain. A domain wipeout immediately fails that branch. |
| Backtracking search | `CSPSolver.backtracking_search()` and its recursive `_backtrack()` method assign one variable at a time and undo choices when a branch fails. |
| MRV | `select_unassigned_variable()` chooses the unassigned student with the fewest legal seats remaining. |
| Degree heuristic | Tied MRV candidates are prioritized by their unassigned pairwise section/subject relationships in `_soft_degree()`. |
| Least Constraining Value | `order_domain_values()` prefers seats that preserve more remaining choices and are less likely to create soft adjacency conflicts. |
| Heuristic search | MRV, degree tie-breaking, and LCV reduce search effort; measured choices and checks are returned to the AI Analysis view. |
| Min-Conflicts local search | `ai/heuristics.py` chooses a student in a current soft conflict and evaluates legal seat moves/swaps, retaining an improving assignment. |
| Intelligent agent | The allocation workflow observes roster/room/constraint data, proposes a seating plan, and reports its result and limitations in `ai/allocation.py`. |
| Problem-solving agent | `run_exam_allocation()` formulates the problem, searches, optimizes, validates hard constraints, and returns room maps and solver statistics. |

### Solver statistics

Variables, seat-domain values, variable selections, candidate assignments,
backtracks, constraint checks, forward checks, pruned values, local-search
iterations, conflict counts, and elapsed time are measured during the current
run and returned to the application. No allocation or metric is hardcoded.

## Data files

- `data/students.json` — current roster
- `data/rooms.json` — room dimensions and accessible-seat coordinates
- `data/exams.json` — exam schedule
- `data/constraints.json` — weighted soft preferences
- `data/allocation.json` — most recent solver response
- `data/sample_*.json` — first-run sample records and reloadable students

## Main API

- `GET /api/dashboard`
- `GET|POST /api/students`, `PUT|DELETE /api/students/<student_id>`
- `POST /api/students/import`, `POST /api/students/load-sample`
- `GET|POST /api/rooms`, `PUT|DELETE /api/rooms/<room_id>`
- `GET|POST /api/exams`, `PUT|DELETE /api/exams/<exam_id>`
- `GET|PATCH /api/constraints`
- `POST /api/allocation/run`, `GET /api/allocation/result`
- `GET /api/student/<student_id_or_roll_number>`
