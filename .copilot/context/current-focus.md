# Current Focus

## Last Updated
- 02.09.2026 (session 6)

## Current Goal
- `PLAN_IMPLEMENTARE.md` fully revised with all client confirmations from 14.08.2026 (I5–I14, E1–E15, F1/F5/F10, L3/L4) — plan is now the implementation source of truth.
- Faza 0 delivered and verified live in S1: `new_min_max/sql/00_params.sql` ran clean — 4 tables (`CCCMINMAXPARAMS` 23 rows, `CCCMINMAXCOV` 33, `CCCMINMAXBRANCH` 18, `CCCMINMAXTEMPLATE` 0 + index), all seed values correct.
- Item #1 (4 branches) resolved via DB: ARAD/VOLUNTARI/MIHAILESTI/RM VALCEA have `WHOUSE.ISACTIVE=0` — closed warehouses, not business decisions. `INCLUS=0` is de facto.
- Effort estimate produced: ~200h total (175–215 range), phase breakdown calibrated on `DEVIZ_IUNIE_2026.md` rates.
- Faza 1a deployed and verified live in S1: `/JS/NewMinMax/setup` installed `dbo.ufn_MinMaxSalesLines(@Company)` successfully. On company 1000 / mode `CLIENT`: 237,057 lines, 18 attributed branch codes, 0 NULL branches, 0 excluded-customer/prefix leaks, 0 duplicate source keys; window 08.09.2025–01.09.2026.
- Faza 1b implemented and installed in production S1: `/JS/NewMinMax/setup` created/updated `dbo.sp_MinMaxEngine_Prepare`; metadata confirms the stored procedure and full `#WeeklySeries` → `#MinMaxBase` pipeline. Diagnostic parameters `@Mtrl` and `@SummaryOnly` are deployed, avoiding the invalid nested `INSERT EXEC` validation pattern. Smoke test for MTRL 1360919 passed on all 14 branches: 14 sales rows, 0 null/invalid metrics, AZI 01.09.2026, SIGMA_WK 1.1260993–25.0436949. Read-only checks estimate 50,769 included items, 710,766 output rows and 36,959,832 dense weekly rows; full runtime/performance is not yet verified.
- Branch Replenishment outage diagnosed live: production `sp_GetMtrlsData` is missing `GROUP BY A.mtrl, C.BRANCH, B.BRANCHSEC` in the `#PendingOrders` INSERT, causing `MTRLINES.MTRL` aggregate error for `2200 → 1200,1300,1400`. The local `reumplere/sp_GetMtrlsDat.sql` includes the correct grouping and active-warehouse filter; deploy it to S1 and retest the endpoint.

## Active Area
- `new_min_max/` / `S1-MEC/AJS/NewMinMax.js` — Faza 0, Faza 1a and Faza 1b implementation/setup complete; next target is a controlled runtime smoke test and performance measurement for `sp_MinMaxEngine_Prepare`.

## Relevant Files
- `new_min_max/PLAN_IMPLEMENTARE.md` — implementation plan, revised 14.08.2026; §1.1 (closed warehouses), §1.8 (branch attribution), §1.9 (HQ aggregator), §10 (open items) are current.
- `new_min_max/sql/00_params.sql` — Faza 0 DDL + idempotent seed; **executed in production S1, verified**.
- `new_min_max/SUMAR_TEORETIC_CONFIRMARE.md` — client confirmation doc; provenance tags `[S]/[E]/[D]`; most items now ✅.
- `DEVIZ_IUNIE_2026.md` — effort-rate reference for estimates.
- `S1-MEC/AJS/NewMinMax.js` — AJS container for all new MIN/MAX SQL objects; `ufn_MinMaxSalesLines` and `sp_MinMaxEngine_Prepare` setup are deployed in production.

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
- Cross-mode count comparison for `DOC` / `AGENT` / `CLIENT` is still pending: production parameter changes are blocked while project `S1_WRITE_MODE=off`. The active `CLIENT` mode is fully validated read-only.
- `sp_MinMaxEngine_Prepare` full execution is pending: `/JS/WSMCP/execSql` blocks `EXEC` even for read-only procedures. The single-MTRL smoke test passed; current dense full-run design materializes an estimated 36,959,832 weekly rows, so runtime/tempdb must be measured before proceeding to Classify.

## Next Step
- Run `dbo.sp_MinMaxEngine_Prepare @Company=1000, @Mtrl=NULL, @SummaryOnly=1` directly in S1 SQL tooling, capture duration and validate the estimated 710,766-row summary before implementing `sp_MinMaxEngine_Classify`.
