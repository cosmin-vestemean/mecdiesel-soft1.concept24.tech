# Current Focus

## Last Updated
- 07.09.2026 (sesiunea 28 — review secundar pe cod: cele 9 constatări confirmate, 3 soluții
  corectate, 5 constatări noi adăugate; plan de execuție scris)

## Current Goal
- Faza 5: implementarea backend/frontend este cablată și fluxul read-only funcționează live, dar
  acceptanța este blocată de 4 defecte. Cele 14 remedieri și testele sunt în
  `new_min_max/FAZA5_CONTRACT.md` §12; ordinea executabilă este în
  `new_min_max/FAZA5_REMEDIERI_PLAN.md`.
- Poarta reală către Faza 4 nu sunt remedierile, ci **pasul 8 din plan** — validarea numerică
  (invariante pe toată populația + recalcul manual pe eșantion stratificat înghețat) plus
  confirmarea beneficiarului pe formule. Nu poate începe înainte de §12.3, §12.4, §12.5 și §12.13.
- Fazele 0-3 ale motorului deployate și validate; `RUNID=5` e sesiunea curentă. Vezi
  [minmax-engine-model.md](../wiki/minmax-engine-model.md).

## Active Area
- Review-ul secundar a confirmat toate cele 9 constatări inițiale și a corectat trei detalii de
  proiectare: garda SQL respinge forma `UPDATE alias ... FROM` cerută de OPENJSON, `?selected` nu
  rezolvă §12.4 (trebuie `.selected`), iar write flag-ul trebuie oprit **înainte** de repararea
  scrierii. S-au adăugat §12.10-12.14 (cache RUNID, total group ABC, escape `LIKE`, validare
  `explain`, acoperire de teste pe răspuns). Nu s-au aplicat încă fixuri de cod.

## Relevant Files
- `new_min_max/FAZA5_CONTRACT.md` §12 — sursa canonică pentru cele 14 remedieri și acceptanță.
- `new_min_max/FAZA5_REMEDIERI_PLAN.md` — pașii de execuție în ordine, cu model recomandat per pas.
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
  trebuie aleasă înainte de pasul 6 din planul de remediere (§12.8).
- Vezi [minmax-engine-open-items.md](../wiki/minmax-engine-open-items.md) și
  `.copilot/context/open-threads.md` pentru firele de business/tangențiale existente.

## Next Step
- Rulează `FAZA5_REMEDIERI_PLAN.md` cu agentul `Implement`, începând cu **pasul 0** (kill-switch
  `MINMAX_ENGINE_WRITES_ENABLED=false`), pentru că serviciul este astăzi complet neautentificat
  (`around: { all: [] }`). Abia apoi pasul 1 (§12.1 + §12.2).

