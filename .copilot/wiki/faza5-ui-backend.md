# Faza 5 — UI de confirmare: backend Feathers

> Stare durabilă a stratului backend. Contractul complet e `new_min_max/FAZA5_CONTRACT.md` (nu se
> duplică aici); acest fișier reține ce s-a construit, ce s-a verificat live și convențiile care nu
> sunt evidente doar din cod.

## Fișiere

- `src/services/minmax-engine/minmax-engine.class.js` — clientul `execSql`, rezoluția sesiunii
  curente, cele 6 metode de mai jos.
- `src/services/minmax-engine/sql-guard.js` — `classifySql`, portat din `mcp-server/src/sql-guard.ts`
  **plus** o listă albă de tabele pentru scrieri (`CCCMINMAXPARAMS/COV/BRANCH/TEMPLATE`) — server-ul
  WSMCP restricționează doar verbe, nu tabele, deci această listă e singura barieră reală.
- `src/services/minmax-engine/minmax-engine.js` / `.shared.js` — înregistrare, tipar după
  `src/services/zero-minmax/`.
- Înregistrat în `src/services/index.js` și `public/socketConfig.js`.
- `src/load-env.js` — încarcă `.env` din root în `process.env` înainte de `@feathersjs/configuration`
  (nu exista niciun mecanism de `.env` pe partea Feathers înainte de Faza 5; `dotenv` nu e
  dependință a proiectului principal, doar a `mcp-server/`). Importat din `src/app.js` și
  `src/index.js`.

## Endpoint-uri (toate în `MinmaxEngineService`)

| Metodă | Sursă | Notă |
|---|---|---|
| `results` | `CCCMINMAXDET` | Contract complet §5: filtre, `STRING_SPLIT` pentru liste, intervale, tri-state, sortare cu whitelist + tie-break `(BRANCH,MTRL)`, paginare (plafon 500), total separat opțional (`withTotal`) |
| `history` | `CCCMINMAXRUN` | cele 29 de coloane ale antetului, cele mai recente primele |
| `groupAbc` | `CCCMINMAXGRP` | ABC/XYZ per `MTRGROUP × BRANCH` |
| `params` | `CCCMINMAXPARAMS`+`COV`+`BRANCH` | 3 interogări paralele |
| `explain` | `CCCMINMAXDET`+`RUN`+`WINSOR`+`WEEK` | drill-down persistat, 4 interogări punctuale; serie de 52 săptămâni reconstruită dens (CTE recursiv) din `CCCMINMAXWEEK` rar |
| `saveParams` | scriere pe `PARAMS/COV/BRANCH` | singura scriere, via `statements` (atomic, `BEGIN TRAN/COMMIT` server-side) |

„Sesiune curentă" se rezolvă **mereu** `ESTE_CURENT=1 AND SCOPE='FULL' AND SESSION_STATUS='DONE'
AND COMPUTE_STATUS='DONE'` (`_resolveRunId`/`_resolveCurrentRunId`), niciodată `MAX(RUNID)`.

Plafonul de 20 de parametri poziționali per apel e enforcat în cod (`bind()` aruncă eroare clară
dacă se depășește) — nu doar documentat.

## Separarea cheilor `CCC_WSMCP_AUTH` (07.09.2026)

Există **două chei distincte**, cu scopuri diferite, în `.env`:

| Variabilă | Cine o folosește | `ALLOW_WRITE` |
|---|---|---|
| `S1_WS_SHARED_SECRET` | `mcp-server/` (dezvoltare, Copilot) | `0` |
| `S1_APP_WS_SHARED_SECRET` | `src/services/minmax-engine/` (Feathers, UI) | `1` |

Mapate în `config/custom-environment-variables.json` → `minmaxEngine.{s1BaseUrl,s1AppId,s1AuthKey}`.
**Nu există fallback între ele** — `minmax-engine.class.js` `_config()` aruncă eroare explicită dacă
`S1_APP_WS_SHARED_SECRET` lipsește, în loc să reutilizeze tăcut cheia MCP (bug de review corectat
07.09.2026, nu reintroduce fallback-ul).

## Verificat live pe producție (07.09.2026)

- Forma răspunsului `execSql` confirmată: `{success:true, data:[...], total:N}` pentru `SELECT`;
  scrierea întoarce `data:[{affected:N}]`. `extractRows()` din `minmax-engine.class.js` e corectă,
  nu mai e o presupunere.
- Cheia MCP: `SELECT` OK; `UPDATE` respins server-side (`ALLOW_WRITE=0 in CCC_WSMCP_AUTH`).
- Cheia aplicație: `SELECT` OK; `UPDATE` pe `CCCMINMAXCOV` OK (`{"affected":1}`); `EXEC` respins
  server-side indiferent de `ALLOW_WRITE` (`WSMCP_classifyStatement` blochează verbul, nu doar
  scrierile).
- PM2 (`pm2 restart 0 --update-env`) repornit cu variabilele noi.

## Stadiu (vs. todo-ul din `FAZA5_CONTRACT.md` §10)

Pași 1-7 **făcuți**: sesiune `FULL` validată (`RUNID=5`), chei separate în `CCC_WSMCP_AUTH`,
config environment, serviciul Feathers, compunerea SQL + whitelist coloane, `classifySql` + whitelist
tabele, înregistrare `services/index.js`/`socketConfig.js`.

Pasul 8 (**următorul**): componentele UI + store (`public/components/minmax-engine/*`,
`public/stores/minmax-engine-store.js`), tipar după `public/components/zero-minmax/` +
`public/stores/replenishment-store.js`. Pașii 9-10 (măsurare sortări, review) rămân după el.
