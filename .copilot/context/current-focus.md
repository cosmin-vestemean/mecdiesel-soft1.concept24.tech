# Current Focus

## Last Updated
- 08.09.2026 (sesiunea 48)

## Current Goal
- Faza 6 (motor pe SQL Server Agent) e finalizată și confirmată live (vezi
  [minmax-engine-model.md](../wiki/minmax-engine-model.md)); focusul revine la poarta de acceptanță
  a Fazei 5.
- Pasul 8 Nivel A este acum complet bifat: toate cele 9 invariante PASS, reverificate live pe
  `RUNID=7` (708.876 rânduri, 50.634 itemi × 14 filiale), inclusiv `NR_SKU_GRP` (0 abateri — fixul
  Fazei 6 confirmat). Calibrare FLAG: 85,3% în bandă.

## Active Area
- [FAZA5_REMEDIERI_PLAN.md](../../new_min_max/FAZA5_REMEDIERI_PLAN.md) rămâne sursa de adevăr pentru
  pașii rămași ai Fazei 5.
- Ce mai blochează poarta §12.15: Pasul 6 (audit de save — REFID, timestamp, chei logice modificate
  — abia apoi comutarea `MINMAX_ENGINE_WRITES_ENABLED` pe `true`) și patru puncte de acceptanță:
  suită unit/component verde, o salvare cu read-back, o simulare de rollback fără succes fals, 403
  pentru utilizator read-only, plus confirmarea beneficiarului pe formule (singura care deschide
  Faza 4).

## Relevant Files
- [FAZA5_REMEDIERI_PLAN.md](../../new_min_max/FAZA5_REMEDIERI_PLAN.md) — planul de execuție pas cu
  pas, sursă de adevăr pentru ce rămâne.
- [validate-minmax-invariants.cjs](../../new_min_max/tools/validate-minmax-invariants.cjs) —
  scriptul de invariante Nivel A, rulabil pe orice `RUNID`.
- [minmax-engine-model.md](../wiki/minmax-engine-model.md) — arhitectura durabilă a motorului.
- [minmax-engine-open-items.md](../wiki/minmax-engine-open-items.md) — întrebările de business încă
  deschise.

## Confirmed Decisions
- Faza 6 e finalizată: `Classify → ClassifyGroup → Compute → FinishRun` rulează în SQL Server Agent.
- Pasul 8 Nivel A al Fazei 5 e închis: 9/9 invariante PASS, verificate live pe `RUNID=7`, nu doar pe
  SQL-ul generat.
- Faza 4 (`applyToErp`) rămâne deliberat amânată până trece poarta §12.15 a Fazei 5.

## Open Questions
- Niciuna nouă; vezi [FAZA5_REMEDIERI_PLAN.md](../../new_min_max/FAZA5_REMEDIERI_PLAN.md) §12.15
  pentru lista de blocaje rămase.

## Next Step
- Pasul 6: implementează auditul de save (REFID, timestamp, chei logice modificate), apoi comută
  `MINMAX_ENGINE_WRITES_ENABLED` pe `true`.
