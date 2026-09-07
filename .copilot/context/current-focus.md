# Current Focus

## Last Updated
- 07.09.2026 (sesiunea 31 — Pasul 3 din FAZA5_REMEDIERI_PLAN.md implementat și testat)

## Current Goal
- Faza 5 este cablată și fluxul read-only funcționează live; acceptanța urmează planul din
  [FAZA5_CONTRACT.md](../../new_min_max/FAZA5_CONTRACT.md) §12 și [FAZA5_REMEDIERI_PLAN.md](../../new_min_max/FAZA5_REMEDIERI_PLAN.md).
- Fazele 0-3 ale motorului sunt deployate și validate; `RUNID=5` este sesiunea curentă.
- Poarta către Faza 4 rămâne pasul 8: invariante pe populație, eșantion numeric înghețat și confirmarea beneficiarului pe formule.

## Active Area
- Pasul 3 (§12.5+§12.12+§12.13) este FĂCUT (cod + teste, 60 verzi): `CLASA_VALUES`/`CLASA_OPTIONS`
  extinse la 11 clase (inclusiv `NOU`/`OD`) într-un modul UI comun
  (`public/components/minmax-engine/minmax-engine-constants.js`); `codeLike` escapează `%`, `_`, `[`
  cu `ESCAPE '\'`; `explain()` trece prin `_resolveRunId()` ca `results()` (implicit sesiunea curentă,
  `RUN_NOT_READY` pe o sesiune neîncheiată).
- Verificare live a pasului 3 NEFĂCUTĂ încă (doar teste unitare cu HTTP mockat).
- Urmează pasul 4 (§12.6+§12.10+§12.11): cheia unică de invalidare `{resolvedRunId, filters}` pentru
  total/RUNID rezolvat/total group ABC.

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
- Implementarea pasului 4 (§12.6 + §12.10 + §12.11), cu teste backend și componentă.
- Menține Node.js 20.20.2 pentru acest proiect; celelalte site-uri rămân pe Node-ul de sistem 18.12.1.

