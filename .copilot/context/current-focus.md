# Current Focus

## Last Updated
- 07.09.2026 (sesiunea 19 — `minmax-run-panel.js` construit și cablat în container)

## Current Goal
- Stratul backend al Fazei 5 (UI de confirmare) e complet, deployat local, **testat end-to-end
  pe producție** și are acum o **suită de teste unit** (`test/services/minmax-engine/`, 41 teste,
  mocha + `nock`, fără DB/S1 real). Vezi [faza5-ui-backend.md](../wiki/faza5-ui-backend.md) pentru
  detalii complete (fișiere, endpoint-uri, rezultate de test, teste).
- Fazele 0-3 ale motorului (Prepare/Classify/ClassifyGroup/Compute) și modelul de sesiune imutabilă
  sunt deployate și validate; **`RUNID=5` e sesiunea curentă** (`ESTE_CURENT=1`, toate fazele
  `DONE`). Vezi [minmax-engine-model.md](../wiki/minmax-engine-model.md).

## Active Area
- Se implementează Faza 5 (UI de confirmare, fără scriere în ERP) conform
  `new_min_max/FAZA5_CONTRACT.md`. Backend-ul, store-ul și containerul există; **primul
  consumator real (`minmax-run-panel.js`) e construit și cablat în container** — selecție sesiune
  + istoric, fără lansare. Rămân 4 componente de vizualizare
  (`minmax-results-table.js`, `minmax-group-abc.js`, `minmax-explain-drawer.js`,
  `minmax-params-panel.js`) — asta e pasul curent.

## Relevant Files
- `new_min_max/FAZA5_CONTRACT.md` — contractul UI complet (transport, filtre, securitate). Punctul
  de intrare pentru orice sesiune de implementare UI.
- `src/services/minmax-engine/` — backend-ul Feathers (vezi wiki pentru detalii).
- `test/services/minmax-engine/` — suita de teste unit (`sql-guard.test.js`,
  `minmax-engine.class.test.js`, `minmax-engine.test.js`); rulare izolată fără DB:
  `NODE_ENV=test npx mocha test/services/minmax-engine --recursive --exit`.
- `.env` / `config/custom-environment-variables.json` — cheile `S1_WS_SHARED_SECRET` (MCP) vs.
  `S1_APP_WS_SHARED_SECRET` (aplicație); nu le confunda, nu adăuga fallback între ele.
- `public/components/zero-minmax/` + `public/stores/replenishment-store.js` — tiparele de urmat
  pentru componentele/store-ul noi.
- [minmax-engine-model.md](../wiki/minmax-engine-model.md) — model de domeniu (sesiuni, HQ, D1-D3).
- [minmax-engine-formulas.md](../wiki/minmax-engine-formulas.md) — reguli de business, warning-uri.
- [minmax-engine-open-items.md](../wiki/minmax-engine-open-items.md) — decizii de business în
  așteptare.
- `new_min_max/FAZA4_CONTRACT.md` — `applyToErp`, închis, amânat deliberat după Faza 5.

## Confirmed Decisions
- Vezi [minmax-engine-model.md](../wiki/minmax-engine-model.md) și
  [minmax-engine-formulas.md](../wiki/minmax-engine-formulas.md) pentru toate deciziile durabile.
- **Sesiune (07.09.2026):** separarea cheilor `CCC_WSMCP_AUTH` (MCP vs. aplicație) e obligatorie și
  fără fallback între ele — vezi `faza5-ui-backend.md`.
- **Sesiune (07.09.2026):** `nock` e devDependency standard pentru testarea serviciilor care fac
  apeluri HTTP ieșite (`request-promise` etc.) — instanțiere directă a clasei serviciului cu un
  `app` fals, fără a porni Feathers/DB. Vezi convenția în memoria de repo (`conventions.md` §5).
- **Sesiune (07.09.2026):** store-ul `minmax-engine-store.js` deține și starea, și apelurile către
  serviciul Feathers (spre deosebire de `replenishment-store.js`, care e stare pură) — justificat
  prin faptul că filtrarea/paginarea motorului MIN/MAX se face server-side, nu client-side.
- **Sesiune (07.09.2026):** backend-ul nu expunea `vz26s` (`d.VZ_26S`) ca filtru, deși contractul
  cere `VZ_26S > 0` ca filtru implicit și coloana există real în `CCCMINMAXDET` — adăugat în
  `DET_COLUMNS`/`buildDetWhereClauses`. Store-ul aproximează „> 0” cu `min: 0.00000001` (serviciul
  suportă doar >=/<=).
- **Sesiune (07.09.2026):** store-ul NU reface automat `loadResults()` când un consumator schimbă
  `runId`/filtre/sortare/pagină — componenta care apelează `setRunId`/`setFilters`/etc. răspunde
  și de a apela explicit `loadResults()` după. Vezi `minmax-run-panel.js` (`_selectRun`).

## Open Questions
- Vezi [minmax-engine-open-items.md](../wiki/minmax-engine-open-items.md) pentru lista completă de
  decizii de business neconfirmate.

## Next Step
- **Pasul 8 din `FAZA5_CONTRACT.md` §10 (continuare):** `minmax-run-panel.js` e gata; urmează
  `minmax-results-table.js` (cel mai greu — filtre server-side complete, sortare, paginare,
  filtrul implicit e deja în store), apoi `minmax-group-abc.js`, `minmax-explain-drawer.js`,
  `minmax-params-panel.js`. Fiecare se conectează la `minmaxEngineStore` prin `ContextConsumer`,
  tipar după `data-table.js`/`query-panel.js` (vezi și `minmax-run-panel.js` ca exemplu deja
  functional în acest repo). Integrarea în `index.html`/`userInteractions.js` (tab nou) rămâne de
  făcut abia când există ceva vizibil de arătat.

