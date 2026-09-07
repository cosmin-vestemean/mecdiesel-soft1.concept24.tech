# Current Focus

## Last Updated
- 07.09.2026 (sesiunea 20 — `minmax-results-table.js` construit și cablat în container)

## Current Goal
- Faza 5 (UI de confirmare, fără scriere în ERP): backend complet, deployat și testat — vezi
  [faza5-ui-backend.md](../wiki/faza5-ui-backend.md). Frontend în lucru: store, container și
  primul consumator real (`minmax-run-panel.js`) există și funcționează — vezi
  [faza5-ui-frontend.md](../wiki/faza5-ui-frontend.md) pentru fișiere, decizii de design și stadiu.
- Fazele 0-3 ale motorului deployate și validate; `RUNID=5` e sesiunea curentă. Vezi
  [minmax-engine-model.md](../wiki/minmax-engine-model.md).

## Active Area
- Construim componentele de vizualizare din `FAZA5_CONTRACT.md` §9, în ordine: run-panel (gata),
  results-table (gata), **group-abc (următorul)**, explain-drawer, params-panel. Nimic cablat încă
  în `index.html`/`userInteractions.js` (niciun tab nou).

## Relevant Files
- `new_min_max/FAZA5_CONTRACT.md` — contractul UI complet; punctul de intrare pentru orice sesiune.
- [faza5-ui-backend.md](../wiki/faza5-ui-backend.md) — backend Feathers (fișiere, endpoint-uri, teste).
- [faza5-ui-frontend.md](../wiki/faza5-ui-frontend.md) — store + componente (fișiere, decizii, stadiu).
- `public/components/data-table.js` / `query-panel.js` / `minmax-run-panel.js` — tipar
  `ContextConsumer` de urmat (ultimul e deja minmax-specific și funcțional).
- [minmax-engine-model.md](../wiki/minmax-engine-model.md) / [minmax-engine-formulas.md](../wiki/minmax-engine-formulas.md) /
  [minmax-engine-open-items.md](../wiki/minmax-engine-open-items.md) — domeniu, formule, decizii în așteptare.
- `new_min_max/FAZA4_CONTRACT.md` — `applyToErp`, amânat deliberat după Faza 5.

## Confirmed Decisions
- Vezi [minmax-engine-model.md](../wiki/minmax-engine-model.md),
  [minmax-engine-formulas.md](../wiki/minmax-engine-formulas.md),
  [faza5-ui-backend.md](../wiki/faza5-ui-backend.md) și
  [faza5-ui-frontend.md](../wiki/faza5-ui-frontend.md) pentru toate deciziile durabile (chei WSMCP
  separate, store cu orchestrare de service proprie, filtrul implicit + `vz26s`, pattern CDN).

## Open Questions
- Vezi [minmax-engine-open-items.md](../wiki/minmax-engine-open-items.md) pentru decizii de
  business neconfirmate.

## Next Step
- `minmax-group-abc.js`: CCCMINMAXGRP (ABC/XYZ per `MTRGROUP × BRANCH`), același tipar
  `ContextConsumer` din `minmax-results-table.js`. Filtrele pentru `groupAbc()` sunt tranzitorii
  (nu persistate pe store ca la `results()`), transmise de apelant — vezi semnatura
  `loadGroupAbc(filters)` în `minmax-engine-store.js`.

