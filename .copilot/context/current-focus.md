# Current Focus

## Last Updated
- 07.09.2026 (sesiunea 16 — Faza 5 UI: backend Feathers implementat, testat live, chei separate)

## Current Goal
- Stratul backend al Fazei 5 (UI de confirmare) e complet, deployat local și **testat end-to-end
  pe producție**: `results`/`history`/`groupAbc`/`params`/`explain`/`saveParams` prin
  `src/services/minmax-engine/`, transport `execSql` cu chei separate (MCP read-only vs. aplicație
  scriere pe config). Vezi [faza5-ui-backend.md](../wiki/faza5-ui-backend.md) pentru detalii
  complete (fișiere, endpoint-uri, rezultate de test).
- Fazele 0-3 ale motorului (Prepare/Classify/ClassifyGroup/Compute) și modelul de sesiune imutabilă
  sunt deployate și validate; **`RUNID=5` e sesiunea curentă** (`ESTE_CURENT=1`, toate fazele
  `DONE`). Vezi [minmax-engine-model.md](../wiki/minmax-engine-model.md).

## Active Area
- Se implementează Faza 5 (UI de confirmare, fără scriere în ERP) conform
  `new_min_max/FAZA5_CONTRACT.md`. Backend-ul e gata; **componentele UI + store-ul nu sunt
  începute** — asta e pasul curent.

## Relevant Files
- `new_min_max/FAZA5_CONTRACT.md` — contractul UI complet (transport, filtre, securitate). Punctul
  de intrare pentru orice sesiune de implementare UI.
- `src/services/minmax-engine/` — backend-ul Feathers (vezi wiki pentru detalii).
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

## Open Questions
- Vezi [minmax-engine-open-items.md](../wiki/minmax-engine-open-items.md) pentru lista completă de
  decizii de business neconfirmate.

## Next Step
- **Pasul 8 din `FAZA5_CONTRACT.md` §10:** componentele UI + store
  (`public/stores/minmax-engine-store.js`, `minmax-engine-container.js`,
  `minmax-results-table.js` cu filtrul implicit `flagTxt IN (DOWN,OK,UP,MAJOR_UP,SUPRASTOC)` +
  `VZ_26S>0`, `minmax-run-panel.js`, `minmax-group-abc.js`, `minmax-explain-drawer.js`,
  `minmax-params-panel.js`), tipar după `zero-minmax`/`replenishment-store`.

