# Current Focus

## Last Updated
- 03.09.2026 (session 9)

## Current Goal
- `PLAN_IMPLEMENTARE.md` fully revised with all client confirmations from 14.08.2026 (I5–I14, E1–E15, F1/F5/F10, L3/L4) — plan is now the implementation source of truth.
- Faza 0 delivered and verified live in S1: `new_min_max/sql/00_params.sql` ran clean — 4 tables (`CCCMINMAXPARAMS` 23 rows, `CCCMINMAXCOV` 33, `CCCMINMAXBRANCH` 18, `CCCMINMAXTEMPLATE` 0 + index), all seed values correct.
- Item #1 (4 branches) resolved via DB: ARAD/VOLUNTARI/MIHAILESTI/RM VALCEA have `WHOUSE.ISACTIVE=0` — closed warehouses, not business decisions. `INCLUS=0` is de facto.
- Effort estimate produced: ~200h total (175–215 range), phase breakdown calibrated on `DEVIZ_IUNIE_2026.md` rates.
- Faza 1a deployed and verified live in S1: `/JS/NewMinMax/setup` installed `dbo.ufn_MinMaxSalesLines(@Company)` successfully. On company 1000 / mode `CLIENT`: 237,057 lines, 18 attributed branch codes, 0 NULL branches, 0 excluded-customer/prefix leaks, 0 duplicate source keys; window 08.09.2025–01.09.2026.
- Faza 1b implementată, instalată și verificată complet pe date reale de producție: `/JS/NewMinMax/setup` a creat/actualizat `dbo.sp_MinMaxEngine_Prepare`. Execuția completă pe producție (`@Company=1000, @Mtrl=NULL, @SummaryOnly=1`) a rulat în 180s (~3 min) și a validat 713.370 rânduri (50.955 articole unice x 14 filiale active, 50.955 HQ, 50.955 Podea, 144.709 cu vânzări). Toate verificările de integritate sunt impecabile: 0 NULL_SIGMA, 0 NULL_MIN_DOC, 0 INVALID_WINDOW, 0 INVALID_WEEK, 0 INVALID_LAST_SALE. Monotonia ferestrelor este 100% respectată.
- Faza 2 implementată, instalată și validată live în producție: `/JS/NewMinMax/setup` a creat/actualizat `dbo.sp_MinMaxEngine_Classify`. Smoke test pe MTRL 1360919 (14 filiale) a demonstrat funcționarea completă și corectă a algoritmului:
  - HQ agregat (1000): Clasa `AY`, `COV_TGT=2.50` (AY×MARE), `SL=95%`, `AVG=103.61`, `ad=3.4536`, `CV=0.5734`.
  - București Podea (2200): Clasa `AX` (CV=0.448 <= 0.5), `COV_TGT=2.75` (AX×MARE), `SL=95%`, `AVG=27.27`, `ad=0.909`.
  - Filiale mici (ex. 1500): Clasa `AY`, `MARIME=MIC` -> `COV_TGT=1.10` (diferențiere corectă conform matricei `CCCMINMAXCOV`).
  - Filiale cu variație mare (ex. 2800): CV=1.047 -> Clasa `AZ`, `COV_TGT=2.00`.
  - Toate politicile de stoc, SL, SSF (1.28), LT (30 zile), FRECVENȚĂ (14 zile), calcul ponderat AVG (`0.30*VZ_4S + 0.40*(VZ_13S/3) + 0.15*(VZ_26S/6) + 0.15*(VZ_52S/12)`) și Pareto ABC funcționează impecabil.
- Branch Replenishment fix deployed & verified live: production `sp_GetMtrlsData` updated with `GROUP BY A.mtrl, C.BRANCH, B.BRANCHSEC` in `#PendingOrders` and active warehouse filter from `reumplere/sp_GetMtrlsDat.sql`. Tested and working correctly for `2200 → 1200,1300,1400`.
- Faza 2b implementată, instalată și verificată live în producție: `/JS/NewMinMax/setup` a creat/actualizat `dbo.sp_MinMaxEngine_ClassifyGroup` (`new_min_max/sql/02_classify_group.sql` și `S1-MEC/AJS/NewMinMax.js`). Execuția de test pe date reale (`@Company=1000, @SummaryOnly=1`) a rulat cu succes complet:
  - 588 rânduri rezultate (42 grupe de produs distincte cu vânzări x 14 filiale active).
  - 500 rânduri `STANDARD`, 3 `NOU`, 85 `OD`.
  - Distribuție clase `STANDARD`: AX=117, AY=40, AZ=20, BX=58, BY=56, BZ=23, CX=21, CY=72, CZ=93, NOU=3, OD=85 (total 588).
  - Integritate perfectă: 0 NULL_LIFECYCLE, 0 NULL_ABC, 0 NULL_XYZ, 0 NULL_CLASA, 0 FORCED_Z_MISMATCH, 0 NEGATIVE_VZ, 0 NULL_SIGMA.
  - Același pipeline ca Faza 2 (winsorizare p95 per SKU -> netting -> serie 52S cu zerouri -> 12 bucket-uri lunare), agregat pe `MTRGROUP` x `BRANCH` cu Pareto ABC concurent per filială.
- Stratul de persistență adus în față (înainte de Faza 3), implementat și verificat live în producție:
  - `new_min_max/sql/00b_persist.sql` (nou) — `CCCMINMAXRUN` (antet versionat) + `CCCMINMAXDET` (46 coloane de clasificare, PK clustered `(RUNID, BRANCH, MTRL)`), plus o secțiune de **aliniere idempotentă** (`ALTER` ghidat de `INFORMATION_SCHEMA`) pentru instalări deja existente.
  - `sp_MinMaxEngine_Classify` are acum `@Persist BIT = 0` și `@RunId INT = NULL OUTPUT`. Cu `@Persist=0` comportamentul e identic cu cel validat anterior; cu `@Persist=1` scrie rândurile, marchează antetul `DONE` (durată + nr. rânduri) și returnează doar antetul, nu setul complet. Cu `@RunId` existent re-rulează peste aceeași rulare. Eroare -> antet `STATUS='ERROR'` + `THROW` (gardă `XACT_STATE()`).
  - `setup()` creează acum **toate** tabelele custom (`CCCMINMAXPARAMS/COV/BRANCH/TEMPLATE/RUN/DET`), nu doar procedurile; precondiția manuală „rulează întâi Faza 0" a fost eliminată. Seed-urile rămân non-distructive (23/33/18 rânduri neatinse la re-rulare).
  - Deployed și rulat `/JS/NewMinMax/setup` live în producție cu succes: JSON returnat `{"success":true,"tables":["CCCMINMAXPARAMS","CCCMINMAXCOV","CCCMINMAXBRANCH","CCCMINMAXTEMPLATE","CCCMINMAXRUN","CCCMINMAXDET"],"objects":["dbo.ufn_MinMaxSalesLines","dbo.sp_MinMaxEngine_Prepare","dbo.sp_MinMaxEngine_Classify","dbo.sp_MinMaxEngine_ClassifyGroup"]}`.
  - Smoke tests live pe `@Mtrl=1360919` rulate și validate în S1:
    - `RUNID=1` (via batch DECLARE/EXEC): 14 rânduri inserate în `CCCMINMAXDET`, `STATUS=DONE`, 21s. Valorile persistate coincid exact cu clasificarea teoretică (HQ: AY / CV 0.5734 / COV 2.50 / AVG 103.61 / ad 3.4536; 2200: AX / COV 2.75; 1500: AY×MIC / COV 1.10; 2800: AZ / COV 2.00). Tipurile text aliniate la `varchar(128/10/50)`.
    - `RUNID=2` (execuție directă procedură în DBExplorer): antetul s-a afișat direct în interfață, 14 rânduri, `STATUS=DONE`, 21s; a confirmat versionarea (nu a suprascris RUNID 1).
  - `new_min_max/tools/sync-check.cjs` + `sql-to-js.cjs` — SQL-ul embedat în AJS este verificat linie cu linie față de `new_min_max/sql/*.sql`; toate cele 4 blocuri sunt IN SYNC.

## Active Area
- `new_min_max/` / `S1-MEC/AJS/NewMinMax.js` — Faza 0, 1a, 1b, 2 (SKU Classify), 2b (Group Classify) și stratul de persistență (`CCCMINMAXRUN` + `CCCMINMAXDET`) sunt complete, instalate și validate pe date reale de producție în S1; următorul pas este **Faza 3: `dbo.sp_MinMaxEngine_Compute`** (calcul parametrii de buffer, cycle, cap HQ, podea București, pack rules și BUY_QTY), care va citi din `CCCMINMAXDET` pe `RUNID` și își va adăuga coloanele prin secțiunea de aliniere din `00b_persist.sql`.

## Relevant Files
- `new_min_max/FAZA3_HANDOFF.md` — **punctul de intrare pentru sesiunea Implement**: corecțiile HQ/company 1001, bug-ul de eligibilitate din Classify, formulele Faza 3, arhitectura procedurii, planul de validare.
- `new_min_max/PLAN_IMPLEMENTARE.md` — implementation plan, revised 14.08.2026; §1.1 (closed warehouses), §1.8 (branch attribution), §1.9 (HQ aggregator), §10 (open items) are current.
- `new_min_max/sql/00_params.sql` — Faza 0 DDL + idempotent seed; **executed in production S1, verified**. Oglindit în `getParamTablesSql()`.
- `new_min_max/sql/00b_persist.sql` — `CCCMINMAXRUN` + `CCCMINMAXDET` + secțiunea de aliniere idempotentă; instalat și validat în producție.
- `new_min_max/tools/sync-check.cjs` / `sql-to-js.cjs` — verifică/generează oglinda SQL din `S1-MEC/AJS/NewMinMax.js`. **De rulat după fiecare editare de SQL.**
- `new_min_max/sql/01_classify.sql` — Faza 2, `sp_MinMaxEngine_Classify` (per SKU); instalat și validat în producție.
- `new_min_max/sql/02_classify_group.sql` — Faza 2b, `sp_MinMaxEngine_ClassifyGroup` (per `MTRGROUP` × branch); instalat și validat în producție.
- `new_min_max/SUMAR_TEORETIC_CONFIRMARE.md` — client confirmation doc; provenance tags `[S]/[E]/[D]`; most items now ✅.
- `DEVIZ_IUNIE_2026.md` — effort-rate reference for estimates.
- `S1-MEC/AJS/NewMinMax.js` — AJS container for all new MIN/MAX SQL objects; `ufn_MinMaxSalesLines` and `sp_MinMaxEngine_Prepare` setup are deployed in production.

## Confirmed Decisions- **Transparență (03.09.2026):** toate formulele și deciziile din `Compute` și fazele conexe se publică într-un **wiki HTML atașat aplicației** (tipar: `public/help/zero-minmax-help.html` în `<iframe>`/modal). Wiki-ul se **generează** dintr-o sursă unică, nu se editează manual; parametrii se injectează live din `CCCMINMAXPARAMS`, nu se hardcodează. Coloanele intermediare din `CCCMINMAXDET` (`SAFETY`/`BUF`/`CYCLE`/`CAP6`/...) devin astfel load-bearing — susțin drill-down-ul „explică acest calcul" pe rând. Detalii: `new_min_max/FAZA3_HANDOFF.md` §9.- CCC* tables live in the S1 DB, created via AJS `setup()` + `X.RUNSQL` (`IF NOT EXISTS ... sysobjects`), NOT via knex migrations (those target the Feathers app DB). Din 03.09.2026, `setup()` creează **toate** tabelele custom, nu doar procedurile.
- DDL-ul fiind `IF NOT EXISTS`, un tabel deja creat nu își schimbă singur schema: modificările de coloane se fac prin secțiunea de aliniere ghidată de `INFORMATION_SCHEMA` din `00b_persist.sql`.
- Rulările sunt versionate în `CCCMINMAXRUN`; `sp_MinMaxEngine_Classify @Persist=1` este contractul prin care fazele următoare primesc datele (nu temp tables partajate).
- Engine branch list source of truth: `WHOUSE.ISACTIVE=1 AND CCCBRANCH IS NOT NULL` (13+HQ), not `BRANCH.ISACTIVE` (18, 4 dead).
- **CORECTAT 03.09.2026 (verificat pe producție):** „HQ" (branch 1000) nu este o locație fizică, ci **stratul de companie**, persistat în `MTRL` (`REMAINLIMMIN`/`REMAINLIMMAX`, `CCCMINAUTOCOMP`/`CCCMAXAUTOCOMP`). Materializarea fizică = **București 2200**. Compania **1001 este `Demo S.R.L.`** (`ISACTIVE=0`, 0 articole) — afirmația anterioară „depozitul real al HQ e pe compania 1001" era falsă. `ESTE_HQ` **rămâne** pe branch 1000; mutarea lui pe 2200 ar elimina din calcul propriile vânzări ale Bucureștiului (26,5% din valoarea națională).
- Stock per warehouse: `MTRBALSHEET` (`FISCPRD`, `PERIOD`, `IMPQTY1-EXPQTY1`); `MTRSTATS`/`MTRWHSTOCK` don't exist.
- All 14.08.2026 client confirmations incorporated (plan §10 "Confirmări încorporate"): winsor→netting order, σ_WK real + plancher 1.3, CZ cycle=0, E11/E12 MAX=MIN at floor, N_PACK replaces pack rules, ERP_MAX=MAX_MANUAL, SSF flat 1.28, MECDI2 not excluded, exclusion by TRDR.CODE.
- New params in seed: `MOD_ATRIBUIRE_FILIALA=CLIENT`, `HQ_DIN_AGREGAT_COMPANIE=1`, `FLAGS_ZERO_LA_APPLY=1`, `SIGMA_MIN=1.3`, `CZ_CYCLE_ZERO=1`, `WINSOR_SUB_PRAG=MEDIANA`, `PRAG_REC_HQ=39`/`PRAG_REC_BR=26`.

## Open Questions
- **BUG deschis (03.09.2026):** `sp_MinMaxEngine_Classify` §3 folosește `(w.COMPANY = @Company OR b.ESTE_HQ = 1)`. Filiala 1000 trece filtrul `EXISTS` **doar** pentru că `WHOUSE` 1000 din compania demo 1001 este activ (cel din 1000 are `ISACTIVE=0`). Necesită fix + `sync-check` + redeploy + re-validarea celor 713.370 rânduri.
- **Pierdere de cerere pe filialele închise (03.09.2026):** 2300/2400/2600/2900 au 7,25 mil RON (5,7% din valoarea 52S) atribuiți în mod `CLIENT`, dar `#IncludedLines` face `INNER JOIN #ActiveBranches` → dispar din **ambele** agregate, inclusiv din cel de companie care conduce achiziția de la furnizori. De decis: reatribuire către filiala care servește azi, sau măcar includere în agregatul de companie.
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
- Faza 3 este **proiectată** (formule + arhitectură procedură) — vezi `new_min_max/FAZA3_HANDOFF.md`. Sesiunea următoare pornete pe agentul **Implement (Sonnet)** și execută pașii din acel document, în ordine.
- Primul pas obligatoriu: corecția bug-ului de eligibilitate HQ din `01_classify.sql` §3 (dependență de compania demo 1001), apoi închiderea deciziilor D1–D3 (sursă `STOC_QTY`, `ORD_FURN`, `LAST_RECEIPT`) prin interogări read-only.
