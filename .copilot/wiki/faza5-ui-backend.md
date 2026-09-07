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
| `results` | `CCCMINMAXDET` | Contract complet §5: filtre, `STRING_SPLIT` pentru liste, intervale, tri-state, sortare cu whitelist + tie-break `(BRANCH,MTRL)`, paginare (plafon 500), total separat opțional (`withTotal`); `vz26s`/`d.VZ_26S` adăugat 07.09.2026 la intervale — lipsea, deși necesar pentru filtrul implicit al UI (vezi [faza5-ui-frontend.md](faza5-ui-frontend.md)) |
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
  scrierea întoarce `data:[{affected:N}]`. **Corecție ulterioară aceeași zi:** asta e adevărat doar
  pentru răspunsuri mici (ex. `COUNT(*)`) — vezi bug-ul gzip mai jos, găsit la testarea live a UI.
- Cheia MCP: `SELECT` OK; `UPDATE` respins server-side (`ALLOW_WRITE=0 in CCC_WSMCP_AUTH`).
- Cheia aplicație: `SELECT` OK; `UPDATE` pe `CCCMINMAXCOV` OK (`{"affected":1}`); `EXEC` respins
  server-side indiferent de `ALLOW_WRITE` (`WSMCP_classifyStatement` blochează verbul, nu doar
  scrierile).
- PM2 (`pm2 restart 0 --update-env`) repornit cu variabilele noi.

## Bug-uri găsite și corectate la testarea live a UI (07.09.2026)

Descoperite abia când UI-ul complet (store + toate cele 6 componente + navigare) a fost testat
autentificat, cu date reale, în browser — vezi [faza5-ui-frontend.md](faza5-ui-frontend.md) pentru
contextul complet al sesiunii de testare.

1. **OFFSET/FETCH/TOP cu parametri bindăți nu merg peste `/JS/WSMCP/execSql`.** Eroare OLE
   confirmată direct (nu doar dedusă): "row count parameter must be an integer". `buildPaging()`
   (folosit de `results()`/`groupAbc()`) și `TOP (${limitPh})` din `history()` legau offset/fetch/
   limit ca parametri poziționali `:N`; acum sunt interpolați ca literali (deja validați prin
   `sqlInt()`/`Math.min`/`Math.max`, deci sigur, nu e input brut).
2. **Răspunsurile mari de la `/JS/WSMCP/execSql` vin gzip; `request-promise` nu le decomprima**
   fără `gzip: true` în opțiunile `rp({...})`. `COUNT(*)` (răspuns mic) mergea normal, dar
   `SELECT d.*` paginat (răspuns mare, multe coloane) venea ca octeți gzip bruți — `extractRows()`
   nu găsea niciun array valid și returna `[]` în tăcere, fără nicio eroare. Simptom: `total`
   corect, `rows: []` — exact ce s-a observat în `results()` și `history()` live (24360+ rânduri
   raportate, tabel gol). Fixat adăugând `gzip: true` în ambele apeluri `rp()` din
   `_execSql`/`_execStatements`.

Ambele confirmate prin apel direct al serviciului Feathers din sesiunea autentificată de browser
(`page.evaluate(() => import('/socketConfig.js')...)`), nu doar din citirea codului — o sesiune S1
separată (alt login) poate avea alt scope de companie/filială și nu e un substitut fiabil pentru
reproducere.

## Teste (unit, HTTP mocat)

`test/services/minmax-engine/` — 41 teste mocha, fără DB și fără S1 real:

- `sql-guard.test.js` — matricea completă `classifySql`: verbe read/write/mereu-blocate, whitelist
  de tabele pentru scriere, string/comment stripping, input malformat.
- `minmax-engine.class.test.js` — clasa serviciului instanțiată direct (fără `app` Feathers), cu
  apelul `POST /JS/WSMCP/execSql` interceptat prin `nock` (`nock.disableNetConnect()` cât rulează
  suita, deci un apel real ar eșua zgomotos, nu ar trece neobservat). Acoperă: token/auth key
  lipsă, rezoluția `ESTE_CURENT=1` vs. `runId` explicit (`NO_CURRENT_RUN`/`RUN_NOT_READY`), filtru
  enum invalid, sortare în afara whitelist-ului, codarea unei liste ca un singur parametru CSV
  (`STRING_SPLIT`), plafonul de 20 de parametri, paginare, `history`/`groupAbc`/`params`/`explain`,
  și `saveParams` — fiecare instrucțiune generată e re-verificată cu `classifySql`.
- `minmax-engine.test.js` — smoke test de înregistrare (`app.service('minmax-engine')`), tiparul
  existent din restul suitei (`test/services/mec_item/` etc.); import-ul `src/app.js` nu deschide
  conexiune DB, deci rulează fără o bază reală.

Rulare izolată: `NODE_ENV=test npx mocha test/services/minmax-engine --recursive --exit`.
`nock@14` a fost adăugat ca devDependency; cere Node ≥18.20, repo-ul are `engines` pe 18.12.1 —
`npm install` dă un warning `EBADENGINE`, dar pachetul funcționează normal la runtime. Testul
`history() clamps the limit` a fost actualizat 07.09.2026 pentru a reflecta fix-ul de mai sus
(limit-ul nu mai apare în `sqlParams`, ci interpolat literal în `sqlQuery`); toate cele 41 de teste
trec după ambele fix-uri de mai sus.

## Stadiu (vs. todo-ul din `FAZA5_CONTRACT.md` §10)

Pași 1-7 **făcuți**: sesiune `FULL` validată (`RUNID=5`), chei separate în `CCC_WSMCP_AUTH`,
config environment, serviciul Feathers, compunerea SQL + whitelist coloane, `classifySql` + whitelist
tabele, înregistrare `services/index.js`/`socketConfig.js`.

Pasul 8 (**în lucru**): componentele UI + store (`public/components/minmax-engine/*`,
`public/stores/minmax-engine-store.js`) — store, container și primul consumator
(`minmax-run-panel.js`) există deja; vezi [faza5-ui-frontend.md](faza5-ui-frontend.md) pentru
stadiul detaliat. Pașii 9-10 (măsurare sortări, review) rămân după el.
