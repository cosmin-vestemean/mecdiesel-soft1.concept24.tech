# Current Focus

## Last Updated
- 07.09.2026 (sesiunea 32 — Pasul 4 din FAZA5_REMEDIERI_PLAN.md implementat și testat)

## Current Goal
- Faza 5 este cablată și fluxul read-only funcționează live; acceptanța urmează planul din
  [FAZA5_CONTRACT.md](../../new_min_max/FAZA5_CONTRACT.md) §12 și [FAZA5_REMEDIERI_PLAN.md](../../new_min_max/FAZA5_REMEDIERI_PLAN.md).
- Fazele 0-3 ale motorului sunt deployate și validate; `RUNID=5` este sesiunea curentă.
- Poarta către Faza 4 rămâne pasul 8: invariante pe populație, eșantion numeric înghețat și confirmarea beneficiarului pe formule.

## Active Area
- Pasul 4 (§12.6+§12.10+§12.11) este FĂCUT (cod + teste, 96 verzi): `loadResults()`/`loadGroupAbc()`
  primesc `withTotal` explicit; cache pe cheie de populație (`_resultsCache`/`_groupAbcCache`, sloturi
  separate) pentru RUNID rezolvat; `groupAbc()` backend întoarce `total`; `minmax-group-abc.js`
  folosește `totalPages` în loc de euristica `rows.length < pageSize`.
- GAP DE SCOP asumat: `results()`/`groupAbc()` încă rezolvă „current” independent la primul apel
  (fără împrumut între cache-uri) — coalescarea completă e scopul Pasului 7 (§12.9 `activate()`), nu
  al Pasului 4. Verificare live a pasului 4 NEFĂCUTĂ încă (doar teste unitare cu service mockat).
- Urmează pasul 5 (§12.7): request sequence monoton per flux (results/groupAbc/explain/history/params)
  în store, ca răspunsurile async vechi să nu suprascrie starea nouă.

## Relevant Files
- [FAZA5_REMEDIERI_PLAN.md](../../new_min_max/FAZA5_REMEDIERI_PLAN.md) — ordine și teste pentru remedieri.
- [faza5-ui-backend.md](../wiki/faza5-ui-backend.md) / [faza5-ui-frontend.md](../wiki/faza5-ui-frontend.md) — implementare și verificări live.
- [minmax-engine-model.md](../wiki/minmax-engine-model.md) / [minmax-engine-formulas.md](../wiki/minmax-engine-formulas.md) — domeniu și formule.
- [minmax-engine-open-items.md](../wiki/minmax-engine-open-items.md) / [open-threads.md](open-threads.md) — întrebări și fire tangențiale.
- [FAZA4_CONTRACT.md](../../new_min_max/FAZA4_CONTRACT.md) — `applyToErp`, amânat după Faza 5.

## Confirmed Decisions
- `saveParams` rămâne atomic cu payload JSON + `OPENJSON`, maximum 4 parametri și verificare `__ok` plus read-back.
- Scrierea rămâne oprită până la autorizare; rolurile vin din configurație server-side, cu `editors: []` implicit.
- Sesiunea aplicației va avea 8 ore absolute, fără refresh/sliding expiration, doar în memoria paginii.
- Rezoluția sesiunii curente folosește `ESTE_CURENT` și statusurile DONE, niciodată `MAX(RUNID)`.
- CLASA are 11 valori posibile (9 combinații ABC×XYZ + NOU + OD), nu 9 — definite o singură dată
  per parte (backend `CLASA_VALUES`, UI `minmax-engine-constants.js`).

## Open Questions
- Pașii 4-8 din §12 rămân de implementat înaintea validării numerice.
- Întrebările de business și firele tangențiale sunt în [minmax-engine-open-items.md](../wiki/minmax-engine-open-items.md) și [open-threads.md](open-threads.md).

## Next Step
- Implementarea pasului 5 (§12.7), cu teste de store pe promisiuni controlate rezolvate în ordine
  inversă (pagina 2/3, două articole, două seturi group ABC).
- Menține Node.js 20.20.2 pentru acest proiect; celelalte site-uri rămân pe Node-ul de sistem 18.12.1.

