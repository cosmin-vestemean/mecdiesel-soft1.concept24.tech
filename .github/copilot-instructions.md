# Copilot Instructions

## Model Policy

- Model-selection guard rules live in `.github/instructions/model-policy.instructions.md` (always-on, `applyTo: "**"`).
- Right model for the task, not the cheapest: Opus = planning/architecture/review (small context), Sonnet = multi-file implementation, base/cheap = isolated/boilerplate.
- Treat session length as a context-cost signal; checkpoint via `session-handoff` and review on a fresh small-context session.

## Phase Agents

- Phase agents bind the recommended model to the workflow stage (switching agent switches model). They live in `.github/agents/`.
- `Plan` (Opus) → architecture and a model-annotated todo list; `Implement` (Sonnet) → multi-file work; `Mechanical` (Haiku) → isolated/boilerplate edits; `Review` (Opus, fresh small context) → validation/diff, read-only.
- The always-on model policy is the safety net when working in the default agent; the phase agents are the low-friction path that switches the model for you.

## Session Memory

- Session-memory workflow rules live in `.github/instructions/session-memory.instructions.md`.
- Session handoff state lives in `.copilot/context/current-focus.md`.
- Cross-session open threads backlog lives in `.copilot/context/open-threads.md`.

## Session Prompt Workflows

- Use `session-resume` prompt to restart work from the current session state.
- Use `session-handoff` prompt to produce the next session snapshot.
- Use `session-analysis` prompt to analyse session quality and feed tangential open threads into `.copilot/context/open-threads.md`.
- Keep `.copilot/context/current-focus.md` aligned with the latest stable session outcome so the memory workflow stays useful.
