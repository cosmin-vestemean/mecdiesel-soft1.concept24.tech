# Current Focus

## Last Updated
- 17.09.2026 (P16 deployed; RUNID 30 confirms DET-GRP reconciliation)

## Current Goal
- P16 (frozen sales-line snapshot per `RUNID`) is implemented, deployed, and live-validated on RUNID 30.
- Formal closure still needs a deliberate inter-phase ERP-change proof (see Open Questions).

## Active Area
- Deployed SQL: `new_min_max/sql/00b_persist.sql`, `01_classify.sql`, `02_classify_group.sql`, `00h_purge_run.sql`, `00k_purge_selector.sql`, `00l_purge_retention.sql`.
- Mirror: `S1-MEC/AJS/NewMinMax.js`. Validation: `new_min_max/tools/validate-minmax-invariants.cjs`, `test/tools/validate-minmax-invariants.test.js`.

## Relevant Files
- [minmax-engine-model.md](../wiki/minmax-engine-model.md): P16 architecture, retention policy, and the `#SalesLines` duplicate-declaration gotcha.
- [RESTANTE_INTERNE.md](../../new_min_max/RESTANTE_INTERNE.md): P16 backlog row and closure evidence (RUNID 27/28/30).

## Confirmed Decisions
- Durable P16 architecture and decisions live in [minmax-engine-model.md](../wiki/minmax-engine-model.md) (sections "Cadență și sesiuni" and "Retenția sesiunilor").
- RUNID 30 is the deployment smoke test: all structural invariants PASS, `vz_grp_det = 0/602`.
- Local static validation before deploy: 56 passing; all 15 SQL-AJS blocks in sync.

## Open Questions
- Execute a controlled ERP change between `Classify` and `ClassifyGroup` on a fresh session to close P16 formally; a quiet interval is inconclusive.
- `ferestre_zile`/`grila_sapt` validators still re-derive from the live UDF, not `CCCMINMAXSALES`; their RUNID 30 deviations are source drift, not evidence against P16.
- The production read-only duplicate check on source lines (`MTRTRN`/`LINENUM`) could not authenticate with the configured S1 credentials; do not assume uniqueness.
- Measure `CCCMINMAXSALES` data/log footprint before pinning more proof runs.

## Next Step
- Execute the deliberate inter-phase ERP-change proof on a new session; record the resulting `RUNID` and `vz_grp_det` outcome in `RESTANTE_INTERNE.md`.
