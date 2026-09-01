# Current Focus

## Last Updated
- 01.09.2026 (session 3)

## Current Goal
- `PLAN_IMPLEMENTARE.md` fully revised with all client confirmations from 14.08.2026 (I5–I14, E1–E15, F1/F5/F10, L3/L4) — plan is now the implementation source of truth.
- Faza 0 delivered and verified live in S1: `new_min_max/sql/00_params.sql` ran clean — 4 tables (`CCCMINMAXPARAMS` 23 rows, `CCCMINMAXCOV` 33, `CCCMINMAXBRANCH` 18, `CCCMINMAXTEMPLATE` 0 + index), all seed values correct.
- Item #1 (4 branches) resolved via DB: ARAD/VOLUNTARI/MIHAILESTI/RM VALCEA have `WHOUSE.ISACTIVE=0` — closed warehouses, not business decisions. `INCLUS=0` is de facto.
- Effort estimate produced: ~200h total (175–215 range), phase breakdown calibrated on `DEVIZ_IUNIE_2026.md` rates.
- Faza 1a implemented locally in `S1-MEC/AJS/NewMinMax.js`: `setup()` installs `dbo.ufn_MinMaxSalesLines(@Company)`; not deployed to S1 yet.

## Active Area
- `new_min_max/` / `S1-MEC/AJS/NewMinMax.js` — Faza 0 complete; Faza 1a implemented locally and awaiting S1 deployment/validation.

## Relevant Files
- `new_min_max/PLAN_IMPLEMENTARE.md` — implementation plan, revised 14.08.2026; §1.1 (closed warehouses), §1.8 (branch attribution), §1.9 (HQ aggregator), §10 (open items) are current.
- `new_min_max/sql/00_params.sql` — Faza 0 DDL + idempotent seed; **executed in production S1, verified**.
- `new_min_max/SUMAR_TEORETIC_CONFIRMARE.md` — client confirmation doc; provenance tags `[S]/[E]/[D]`; most items now ✅.
- `DEVIZ_IUNIE_2026.md` — effort-rate reference for estimates.
- `S1-MEC/AJS/NewMinMax.js` — AJS container for all new MIN/MAX SQL objects; currently contains `ufn_MinMaxSalesLines` setup only.

## Confirmed Decisions
- CCC* tables live in the S1 DB, created via AJS `setup()` + `X.RUNSQL` (`IF NOT EXISTS ... sysobjects`), NOT via knex migrations (those target the Feathers app DB).
- Engine branch list source of truth: `WHOUSE.ISACTIVE=1 AND CCCBRANCH IS NOT NULL` (13+HQ), not `BRANCH.ISACTIVE` (18, 4 dead).
- Real HQ warehouse: `WHOUSE` 1000 "Depozit Central" on company **1001**; `WHOUSE` 1000 "HQ" (company 1000) is inactive.
- Stock per warehouse: `MTRBALSHEET` (`FISCPRD`, `PERIOD`, `IMPQTY1-EXPQTY1`); `MTRSTATS`/`MTRWHSTOCK` don't exist.
- All 14.08.2026 client confirmations incorporated (plan §10 "Confirmări încorporate"): winsor→netting order, σ_WK real + plancher 1.3, CZ cycle=0, E11/E12 MAX=MIN at floor, N_PACK replaces pack rules, ERP_MAX=MAX_MANUAL, SSF flat 1.28, MECDI2 not excluded, exclusion by TRDR.CODE.
- New params in seed: `MOD_ATRIBUIRE_FILIALA=CLIENT`, `HQ_DIN_AGREGAT_COMPANIE=1`, `FLAGS_ZERO_LA_APPLY=1`, `SIGMA_MIN=1.3`, `CZ_CYCLE_ZERO=1`, `WINSOR_SUB_PRAG=MEDIANA`, `PRAG_REC_HQ=39`/`PRAG_REC_BR=26`.

## Open Questions
- `MOD_ATRIBUIRE_FILIALA` final choice (DOC/AGENT/CLIENT) — default `CLIENT`, changes ~35% of line attribution; decide via comparison run.
- `FLAGS_ZERO_LA_APPLY` (E15) — spec says informational-only; default zeroes at ERP write.
- `COV_MEDIU` values — fallback `MEDIU=MIC` until client fills them (editable in UI).
- `CX=2.00 > BY=2.00` deliberate? — spec values kept.
- σ_LT (lead-time variability, L1) absent from formula; receipt history availability unknown.
- σ_WK for NOU class: full 52-week series vs. from-first-sale (E5) — default full series.
- `LT_ZILE=30` / `FRECVENTA_ZILE=14` are invented fallbacks pending per-prefix mapping.
- `00_params.sql` idempotency not yet re-tested (ran once on fresh tables).
- `ufn_MinMaxSalesLines` JavaScript and SQL contract were validated locally/read-only, but SQL DDL compilation awaits deployment through `/JS/NewMinMax/setup`.

## Next Step
- Deploy `S1-MEC/AJS/NewMinMax.js`, call `/JS/NewMinMax/setup`, then validate `dbo.ufn_MinMaxSalesLines(1000)` counts and all 3 attribution modes before starting `sp_MinMaxEngine_Prepare`.
