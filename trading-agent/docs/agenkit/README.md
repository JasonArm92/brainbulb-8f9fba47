# AgenKit build plan: six gated phases

AgenKit ([agenkit.xyz](https://agenkit.xyz/)) is a guided harness for Claude Code, Cursor and
Codex. It runs brainstorm → architecture → test-first build → review → ship through the
`/agenkit` command and pauses for operator approval at each step.

**Status:** AgenKit was **not** installed in this build. agenkit.xyz was blocked by the build
environment's network policy. The six phase documents below are the gate artifacts, written so
you can run `/agenkit` against this directory yourself. Every phase ends in an explicit operator
approval, and no phase is allowed to loosen a hard limit.

| # | Phase | Artifact | Gate: operator approves when… |
|---|---|---|---|
| 1 | Spec | `01-spec.md` | every research number is re-verified against a primary source |
| 2 | Architecture | `02-architecture.md` | Brain/Reflex split and risk invariants are accepted |
| 3 | Plan | `03-plan.md` | file-by-file tasks and test list are accepted |
| 4 | Test-first build | `04-build.md` + `tests/` | `pytest` is green and each invariant has a test |
| 5 | Review | `05-review.md` | adversarial review has no open blocker |
| 6 | Ship | `06-ship.md` | paper → shadow → capped-live ladder criteria are met |

Install and run (on your machine, where agenkit.xyz is reachable), following the site's own
instructions, then run `/agenkit` and point it at `trading-agent/docs/agenkit/01-spec.md`.
