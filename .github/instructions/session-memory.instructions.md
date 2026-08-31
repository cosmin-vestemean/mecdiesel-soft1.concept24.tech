---
applyTo: "**"
---

# Session Memory Instructions

## Purpose

- Use the session-memory workflow to keep ongoing architectural decisions and next steps discoverable across Copilot sessions.
- Treat `.copilot/context/current-focus.md` as the canonical handoff snapshot for the current state of work.

## When To Update

- Update the handoff snapshot when a session changes the current architecture understanding, working decisions, or next recommended step.
- Prefer updating the handoff snapshot after meaningful progress, not after every small edit.

## What To Record

- Record only the current goal, active area, relevant files, confirmed decisions, open questions, and next step.
- Keep the snapshot short and operational; avoid long narrative logs.
- Put durable, cross-session facts in repo memory, not in the handoff snapshot.

## Workflow

- At the start of a new session, read `.copilot/context/current-focus.md` before making architectural assumptions.
- At the start of a new session, scan `.copilot/context/open-threads.md` for tangential threads worth picking up.
- When the session ends with a new stable understanding, update the handoff snapshot so the next session can resume without reconstructing context from scratch.
- After session analysis (`session-analysis.prompt.md`), append any tangential or unclear open threads to `.copilot/context/open-threads.md`. Do not duplicate threads that already exist there.
