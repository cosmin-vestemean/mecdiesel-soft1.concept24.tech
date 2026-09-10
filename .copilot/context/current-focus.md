# Current Focus

## Last Updated
- 10.09.2026 (validare live RUNID 9)

## Current Goal
- Subpasul P6 branch-only pentru `LT_ZILE`/`FRECVENTA_ZILE` este implementat, deployat și validat live prin RUNID 9.
- Următorul obiectiv de implementare este P1; extensia P6 longest-prefix rămâne blocată până la lista N5.

## Active Area
- MIN/MAX v5 este live pe RUNID 9 (`FULL`, `CLIENT`, calibrare `C`, `DONE`, curent): 713.104 rânduri, 50.936 itemi, 14 filiale, durată totală 123s.
- T9 a confirmat `BRANCH > GLOBAL`: HQ `21/7`, Cluj `28/10`, București `35/12`, Constanța fallback global `30/14`, zero abateri pe 713.104 rânduri.
- Override-urile de test au fost șterse după rulare: configurația activă are 0 rânduri, iar snapshot-ul RUNID 9 păstrează cele 6 rânduri branch. Toate invariantele sunt PASS.
- 202 teste MIN/MAX trec; `sync-check.cjs`, `git diff --check`, `node --check` și diagnosticele editorului sunt curate.

## Relevant Files
- [Model și operare](../wiki/minmax-engine-model.md): sesiuni, snapshot, Agent, retenție, observabilitate, transport și reperul RUNID 9.
- [Formule](../wiki/minmax-engine-formulas.md): formulele și ordinea de calcul.
- [Întrebări business](../wiki/minmax-engine-open-items.md): deciziile încă neconfirmate.
- [Matrice P1-P15](../../new_min_max/10.09.2026/MATRICE_EXECUTABILA_P1-P15_2026-09-10.md) și [plan](../../new_min_max/10.09.2026/PLAN_ALINIERE_2026-09-10.md): ordinea autorizată de implementare.
- [SQL params](../../new_min_max/sql/00_params.sql), [StartRun](../../new_min_max/sql/00e_start_run.sql) și [Classify](../../new_min_max/sql/01_classify.sql): schema, snapshot-ul și resolverul P6.
- [Serviciu](../../src/services/minmax-engine/minmax-engine.class.js), [parametri UI](../../public/components/minmax-engine/minmax-params-panel.js), [store](../../public/stores/minmax-engine-store.js) și [validator](../../new_min_max/tools/validate-minmax-invariants.cjs): API, editare și T9.

## Confirmed Decisions
- Snapshot-ul unic este `CCCMINMAXRUNPARAM`; fazele persistate refuză snapshot-ul lipsă prin 50074-50076, iar coloanele JSON legacy sunt eliminate.
- SQL Server Agent execută `Classify → ClassifyGroup → Compute → FinishRun`; browserul doar lansează și urmărește starea persistentă.
- P3/P7 sunt simetrice între SKU și grupe; P8 permite `SIGMA_MIN=0`; P14 evidențiază A/B/C fără să schimbe motorul. Detaliile sunt în [model](../wiki/minmax-engine-model.md).
- P6 păstrează globali parametrii de clasificare și permite override numai pentru `LT_ZILE`/`FRECVENTA_ZILE`, cu precedența `BRANCH+PREFIX > BRANCH > PREFIX > GLOBAL`.
- Etapa implementată rezolvă numai `BRANCH > GLOBAL`; preview-ul citește override-urile live, rularea persistentă numai snapshot-ul. Valori nepozitive și chei rigide sunt refuzate defensiv.
- `MOD_ATRIBUIRE_FILIALA` rămâne `CLIENT`; `applyToErp` rămâne amânat.

## Open Questions
- P2, P4/N9-N10, P5 și P10-P13 rămân blocate de decizii business; vezi [întrebările deschise](../wiki/minmax-engine-open-items.md).
- P6 branch-only este închis; extensia longest-prefix așteaptă lista N5. Plancherul `σ_WK=1,3` rămâne fără confirmare documentară.

## Next Step
- Implementează P1 (netting separat pe toată fereastra per `MTRL × scope × TRDR`), păstrând seria săptămânală distinctă pentru sigma.
- Nu implementa longest-prefix înainte de lista N5 și nu modifica atribuirea `CLIENT` implicită.

