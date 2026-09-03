# Current Focus

## Last Updated
- 03.09.2026 (session 8)

## Current Goal
- `PLAN_IMPLEMENTARE.md` fully revised with all client confirmations from 14.08.2026 (I5–I14, E1–E15, F1/F5/F10, L3/L4) — plan is now the implementation source of truth.
- Faza 0 delivered and verified live in S1: `new_min_max/sql/00_params.sql` ran clean — 4 tables (`CCCMINMAXPARAMS` 23 rows, `CCCMINMAXCOV` 33, `CCCMINMAXBRANCH` 18, `CCCMINMAXTEMPLATE` 0 + index), all seed values correct.
- Item #1 (4 branches) resolved via DB: ARAD/VOLUNTARI/MIHAILESTI/RM VALCEA have `WHOUSE.ISACTIVE=0` — closed warehouses, not business decisions. `INCLUS=0` is de facto.
- Effort estimate produced: ~200h total (175–215 range), phase breakdown calibrated on `DEVIZ_IUNIE_2026.md` rates.
- Faza 1a deployed and verified live in S1: `/JS/NewMinMax/setup` installed `dbo.ufn_MinMaxSalesLines(@Company)` successfully. On company 1000 / mode `CLIENT`: 237,057 lines, 18 attributed branch codes, 0 NULL branches, 0 excluded-customer/prefix leaks, 0 duplicate source keys; window 08.09.2025–01.09.2026.
- Faza 1b implementată, instalată și verificată complet pe date reale de producție: `/JS/NewMinMax/setup` a creat/actualizat `dbo.sp_MinMaxEngine_Prepare`. Execuția completă pe producție (`@Company=1000, @Mtrl=NULL, @SummaryOnly=1`) a rulat în 180s (~3 min) și a validat 713.370 rânduri (50.955 articole unice x 14 filiale active, 50.955 HQ, 50.955 Podea, 144.709 cu vânzări). Toate verificările de integritate sunt impecabile: 0 NULL_SIGMA, 0 NULL_MIN_DOC, 0 INVALID_WINDOW, 0 INVALID_WEEK, 0 INVALID_LAST_SALE. Monotonia ferestrelor este 100% respectată.
- Faza 2 implementată, instalată și validată live în producție: `/JS/NewMinMax/setup` a creat/actualizat `dbo.sp_MinMaxEngine_Classify`. Smoke test pe MTRL 1360919 (14 filiale) a demonstrat funcționarea completă și corectă a algoritmului:
  - HQ agregat (1000): Clasa `AY`, `COV_TGT=2.0`, `SL=95%`, `AVG=103.61`, `ad=3.45`, `CV=0.573`.
  - București Podea (2200): Clasa `AX` (CV=0.448 <= 0.5), `COV_TGT=3.0`, `SL=95%`, `AVG=27.27`, `ad=0.909`.
  - Filiale mici (ex. 1500, 1600, 1800): Clasa `AY`, `MARIME=MIC` -> `COV_TGT=1.0` (diferențiere corectă conform matricei de acoperire `CCCMINMAXCOV`).
  - Filiale cu variație mare (ex. 2800): CV=1.047 -> Clasa `AZ`, `COV_TGT=2.0`.
  - Toate politicile de stoc, SL, SSF (1.28), LT (30 zile), FRECVENȚĂ (14 zile), calcul ponderat AVG (`0.30*VZ_4S + 0.40*(VZ_13S/3) + 0.15*(VZ_26S/6) + 0.15*(VZ_52S/12)`) și Pareto ABC funcționează impecabil.
- Branch Replenishment fix deployed & verified live: production `sp_GetMtrlsData` updated with `GROUP BY A.mtrl, C.BRANCH, B.BRANCHSEC` in `#PendingOrders` and active warehouse filter from `reumplere/sp_GetMtrlsDat.sql`. Tested and working correctly for `2200 → 1200,1300,1400`.
- Faza 2b implementată (cod scris, **încă neinstalată/nevalidată în S1**): `dbo.sp_MinMaxEngine_ClassifyGroup` în `new_min_max/sql/02_classify_group.sql`, oglindit în `S1-MEC/AJS/NewMinMax.js` (`getClassifyGroupProcedureSql`, adăugat în `setup`). Același pipeline ca Faza 2 (winsorizare p95 per SKU → netting → serie 52S cu zerouri → 12 bucket-uri lunare), cu două diferențe de granularitate: seria se însumează pe `MTRGROUP`, iar cumulativul ABC se partiționează pe `BRANCH` (grupele concurează între ele în filială). Parametri: `@Company`, `@Mtrgroup` (NULL = toate), `@SummaryOnly`.

## Active Area
- `new_min_max/` / `S1-MEC/AJS/NewMinMax.js` — Faza 0, 1a, 1b și 2 (SKU Classify) sunt complete și validate în producție; Faza 2b este scrisă dar neinstalată; următorul pas este rularea `/JS/NewMinMax/setup` + validarea Fazei 2b, apoi **Faza 3: `dbo.sp_MinMaxEngine_Compute`** (buffer, cycle, cap HQ, podea București, pack rules și BUY_QTY).

## Relevant Files
- `new_min_max/PLAN_IMPLEMENTARE.md` — implementation plan, revised 14.08.2026; §1.1 (closed warehouses), §1.8 (branch attribution), §1.9 (HQ aggregator), §10 (open items) are current.
- `new_min_max/sql/00_params.sql` — Faza 0 DDL + idempotent seed; **executed in production S1, verified**.
- `new_min_max/sql/01_classify.sql` — Faza 2, `sp_MinMaxEngine_Classify` (per SKU); instalat și validat în producție.
- `new_min_max/sql/02_classify_group.sql` — Faza 2b, `sp_MinMaxEngine_ClassifyGroup` (per `MTRGROUP` × branch); **scris, neinstalat**.
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
- Faza 2b: formula exactă de agregare ABC pe grupă rămâne de confirmat cu clientul (§3.3.1, item deschis). Implementarea curentă partiționează cumulativul pe `BRANCH`, cu ordonare secundară deterministă pe `MTRGROUP_CODE`.
- `MOD_ATRIBUIRE_FILIALA` final choice (DOC/AGENT/CLIENT) — default `CLIENT`, changes ~35% of line attribution; decide via comparison run.
- `FLAGS_ZERO_LA_APPLY` (E15) — spec says informational-only; default zeroes at ERP write.
- `COV_MEDIU` values — fallback `MEDIU=MIC` until client fills them (editable in UI).
- `CX=2.00 > BY=2.00` deliberate? — spec values kept.
- σ_LT (lead-time variability, L1) absent from formula; receipt history availability unknown.
- σ_WK for NOU class: full 52-week series vs. from-first-sale (E5) — default full series.
- `LT_ZILE=30` / `FRECVENTA_ZILE=14` are invented fallbacks pending per-prefix mapping.
- `00_params.sql` idempotency not yet re-tested (ran once on fresh tables).
- Cross-mode count comparison for `DOC` / `AGENT` / `CLIENT` is still pending: production parameter changes are blocked while project `S1_WRITE_MODE=off`. The active `CLIENT` mode is fully validated read-only.

## Next Step
- Rulează `/JS/NewMinMax/setup` pentru a instala `dbo.sp_MinMaxEngine_ClassifyGroup`, apoi validează cu `EXEC dbo.sp_MinMaxEngine_ClassifyGroup @Company=1000, @SummaryOnly=1` (așteptat: ~46 grupe × 14 filiale ≈ 644 rânduri, 0 NULL pe `LIFECYCLE`/`ABC`/`XYZ`/`CLASA`, 0 `FORCED_Z_MISMATCH_ROWS`).
- Apoi Faza 3 (`dbo.sp_MinMaxEngine_Compute` - buffer, cycle, capuri, podea București, pack rules și BUY_QTY) conform §2.4 din `PLAN_IMPLEMENTARE.md`.
