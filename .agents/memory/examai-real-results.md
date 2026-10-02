---
name: ExamAI real solver outputs
description: Product requirement against fabricated or placeholder seat plans and algorithm metrics.
---

**Rule:** Seat plans, conflicts, and solver statistics shown to users must come from the actual solver and current persisted inputs. If no valid arrangement exists, report the solver's explanation rather than substituting a result.

**Why:** The ExamAI brief explicitly forbids fabricated results and placeholder features.

**How to apply:** Keep sample records separate from computed allocations, invalidate stale allocations after relevant input changes, and report measured statistics only.