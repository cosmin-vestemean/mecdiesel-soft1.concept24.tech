# Current Focus

## Last Updated
- 07.09.2026 (sesiunea 26 — testat live în browser; 3 bug-uri reale găsite și reparate;
  fluxul complet filtre → rezultate → explain drawer → group-abc → istoric confirmat funcțional)

## Current Goal
- Faza 5 (UI de confirmare, fără scriere în ERP): backend + frontend complete, cablate, integrate
  în navigare și **verificate live** — vezi [faza5-ui-backend.md](../wiki/faza5-ui-backend.md) și
  [faza5-ui-frontend.md](../wiki/faza5-ui-frontend.md) pentru stadiu detaliat, bug-urile găsite la
  testare și convenții.
- Fazele 0-3 ale motorului deployate și validate; `RUNID=5` e sesiunea curentă. Vezi
  [minmax-engine-model.md](../wiki/minmax-engine-model.md).

## Active Area
- Toate cele 6 componente din `FAZA5_CONTRACT.md` §9 sunt construite, cablate și integrate în
  navigare (tab „MIN/MAX Engine" în app-ul `achizitii`), verificate live cu date reale. 3 bug-uri
  reale (nu de UI) găsite și reparate în această sesiune — vezi wiki-urile de mai sus pentru
  detalii; convențiile generale despre `/JS/WSMCP/execSql` (aplicabile oricărui serviciu care îl
  folosește) sunt în `/memories/repo/conventions.md` §6.

## Relevant Files
- `new_min_max/FAZA5_CONTRACT.md` — contractul UI complet; punctul de intrare pentru orice sesiune.
- [faza5-ui-backend.md](../wiki/faza5-ui-backend.md) / [faza5-ui-frontend.md](../wiki/faza5-ui-frontend.md) —
  fișiere, endpoint-uri, decizii de design, bug-uri găsite live, stadiu.
- [minmax-engine-model.md](../wiki/minmax-engine-model.md) / [minmax-engine-formulas.md](../wiki/minmax-engine-formulas.md) /
  [minmax-engine-open-items.md](../wiki/minmax-engine-open-items.md) — domeniu, formule, decizii în așteptare.
- `new_min_max/FAZA4_CONTRACT.md` — `applyToErp`, amânat deliberat după Faza 5.

## Confirmed Decisions
- Vezi [minmax-engine-model.md](../wiki/minmax-engine-model.md),
  [minmax-engine-formulas.md](../wiki/minmax-engine-formulas.md),
  [faza5-ui-backend.md](../wiki/faza5-ui-backend.md) și
  [faza5-ui-frontend.md](../wiki/faza5-ui-frontend.md) pentru toate deciziile durabile.

## Open Questions
- Vezi [minmax-engine-open-items.md](../wiki/minmax-engine-open-items.md) pentru decizii de
  business neconfirmate, și `.copilot/context/open-threads.md` pentru firul tangențial
  `window.token` (bug latent similar în `zero-minmax-panel.js`/`export-minmax-panel.js`).

## Next Step
- Testare live a `saveParams()` (params-panel, singura scriere din interfață): completează și
  salvează un parametru global / o valoare COV_TGT, confirmă că `params()` se reîncarcă și
  drafturile locale se golesc. `CCCMINMAXPARAMS`/`COV` erau goale la ultima testare.

