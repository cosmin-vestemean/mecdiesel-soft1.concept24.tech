# Current Focus

## Last Updated
- 07.09.2026 (sesiunea 25 — tab nou "MIN/MAX Engine" cablat în navigarea ierarhică;
  `<minmax-engine-container>` e acum accesibil din UI, sub app-ul `achizitii`)

## Current Goal
- Faza 5 (UI de confirmare, fără scriere în ERP): backend complet, deployat și testat — vezi
  [faza5-ui-backend.md](../wiki/faza5-ui-backend.md). Frontend în lucru: store, container și patru
  consumatori reali (`minmax-run-panel.js`, `minmax-results-table.js`, `minmax-group-abc.js`,
  `minmax-explain-drawer.js`) — vezi [faza5-ui-frontend.md](../wiki/faza5-ui-frontend.md) pentru
  fișiere, decizii de design și stadiu.
- Fazele 0-3 ale motorului deployate și validate; `RUNID=5` e sesiunea curentă. Vezi
  [minmax-engine-model.md](../wiki/minmax-engine-model.md).

## Active Area
- Toate cele 6 componente din `FAZA5_CONTRACT.md` §9 sunt construite, cablate în
  `minmax-engine-container.js` ȘI integrate în navigare: buton `minmaxEngineButton` +
  div `minmaxEngineContent` (`index.html`), handler `hideAllButArray`/`setActiveTab`
  (`userInteractions.js`), tab înregistrat în `appConfigs.achizitii.tabs`
  (`hierarchical-navigation.js`). Niciun test manual în browser încă pe fluxul complet.

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
- Test manual în browser (autentificat, cu date reale): app `achizitii` → tab "MIN/MAX
  Engine" → verifică fluxul complet filtre → rezultate → click rând → explain drawer →
  params-panel → salvare. Dacă apar erori de consolă/randare, acela e primul lucru de reparat.

