# Current Focus

## Last Updated
- 07.09.2026 (sesiunea 27 — review Faza 5 finalizat; 9 remedieri proiectate și documentate)

## Current Goal
- Faza 5: implementarea backend/frontend este cablată și fluxul read-only funcționează live, dar
  acceptanța este blocată de 4 defecte; toate cele 9 remedieri și testele sunt în
  `new_min_max/FAZA5_CONTRACT.md` §12.
- Fazele 0-3 ale motorului deployate și validate; `RUNID=5` e sesiunea curentă. Vezi
  [minmax-engine-model.md](../wiki/minmax-engine-model.md).

## Active Area
- Review-ul pe cod și browser a confirmat: rollback raportat ca succes, plafonul de 20 care rupe
  salvările, sortare invalidă și selectoare care afișează altă stare. Nu s-au aplicat încă fixuri de
  cod; cele 41 de teste backend existente trec, dar nu acoperă aceste cazuri.

## Relevant Files
- `new_min_max/FAZA5_CONTRACT.md` §12 — sursa canonică pentru cele 9 remedieri, acceptanță și ordine.
- [faza5-ui-backend.md](../wiki/faza5-ui-backend.md) / [faza5-ui-frontend.md](../wiki/faza5-ui-frontend.md) —
  implementare, constatări live și deciziile backend/frontend durabile.
- [minmax-engine-model.md](../wiki/minmax-engine-model.md) / [minmax-engine-formulas.md](../wiki/minmax-engine-formulas.md) /
  [minmax-engine-open-items.md](../wiki/minmax-engine-open-items.md) — domeniu, formule, decizii în așteptare.
- `new_min_max/FAZA4_CONTRACT.md` — `applyToErp`, amânat deliberat după Faza 5.

## Confirmed Decisions
- `saveParams` rămâne atomic: payload JSON + `OPENJSON`, maximum 4 parametri într-un singur
  `statements`; succes numai după verificarea `__ok` și read-back.
- Scrierea rămâne oprită până la autorizare. Sesiunea aplicației: 8 ore absolut, fără refresh sau
  sliding expiration, doar în memorie; orice reload trece prin login. Vezi wiki-urile Fazei 5.

## Open Questions
- Sursa server-side pentru rolurile `minmax.read`/`minmax.edit` (config vs. tabelă administrată)
  trebuie aleasă la implementarea §12.8.
- Vezi [minmax-engine-open-items.md](../wiki/minmax-engine-open-items.md) și
  `.copilot/context/open-threads.md` pentru firele de business/tangențiale existente.

## Next Step
- Implementează împreună §12.1 + §12.2: validarea rollback-ului și salvarea atomică prin JSON/
  `OPENJSON`, cu testele pentru payload complet și read-back; abia apoi retestează scrierea live.

