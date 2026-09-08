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
- `src/services/minmax-engine/roles.js` — singurul loc care rezolvă rolurile (§12.8): `resolveRoles(app, refid)`
  citește `minmaxEngine.readers`/`editors` din `config/default.json`, implicit `readers: "*"` și
  `editors: []` (fail-closed); `minmax.edit` include mereu `minmax.read`; comparație REFID ca `String`.
- `src/services/minmax-engine/authorize.js` — `requireRole(role)`, hook `around` (trebuie să apeleze
  `next()` — omisiunea asta a rupt tăcut rezultatul serviciului, fără nicio eroare, la implementare).
  Citește exclusiv `context.params.authentication.payload.roles`, niciodată `data`; apelurile fără
  `provider` (server-side, de încredere) trec direct, la fel ca `authenticate` însuși.
- Înregistrat în `src/services/index.js` și `public/socketConfig.js`.

## Autorizare (§12.8) — cablaj complet

Emiterea tokenului **nu** trece prin `authentication.create()` (care ar cere o strategie ce
validează credențiale brute — redundant, `validateUserPwd` deja face asta contra S1). În schimb,
`s1Service.validateUserPwd()` (`src/app.js`), după ce validarea parolei reușește, apelează direct
`app.service('authentication').createAccessToken({ sub: String(REFID), roles })` — `roles` din
`resolveRoles`. `s1Service` are acum `setup(app)` (lipsea) ca să poată ajunge la `app.service(...)`.
Eșecul semnării întoarce `success:false`, nu succes fără token.

Verificarea trece prin lanțul standard `around` de pe serviciul `minmax-engine`:
`all: [authenticate('jwt'), requireRole(ROLE_READ)]`, `saveParams: [requireRole(ROLE_EDIT)]` — ambele
rulează pentru `saveParams` (all + specific), deci un editor trece prin ambele verificări din același
token. Apelurile fără `params.provider` (server-side) ocolesc autorizarea, ca și `authenticate` însuși.

Frontend: `public/stores/app-auth.js` ține `appToken` **doar în memoria paginii** (variabilă de
modul, niciodată storage). Autorizarea Socket.IO se face pe **conexiune**, nu ca al doilea argument
la apelurile de serviciu: clientul Feathers trimite din `params` numai `params.query`, deci
`params.authentication` s-ar pierde. După login, `ensureConnectionAuth()` emite
`authentication.create({ strategy: 'jwt', accessToken })`; `JWTStrategy.handleConnection()` reține
tokenul în `connection.authentication` și deconectează exact la expirare. Aceeași funcție este
apelată înaintea fiecăreia dintre cele șase metode MIN/MAX și din `socket.on('connect')`, deoarece o
reconectare creează o conexiune nouă fără autentificarea celei anterioare. Promisiunea de autentificare
este partajată până la schimbarea tokenului; după eșec se resetează pentru reîncercare. Serviciul
`authentication` este înregistrat explicit în `public/socketConfig.js`. Reload-ul golește tokenul
automat (pagina se reîncarcă), fără cod explicit de curățare.
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

### Precizie și indexare în `explain` (găsite la verificarea Nivel B, 08.09.2026)

- **`DECIMAL(10, 4)` nu supraviețuiește transportului.** WSMCP rotunjește la întreg coloanele
  declarate `DECIMAL(10, 4)` (`2.7500 → 3`, `1.2800 → 1`), în timp ce `DECIMAL(28, 8)` circulă
  intact. În `CCCMINMAXDET` doar `COV_TGT`, `SL` și `SSF` au acest tip, deci lanțul calculat era
  corect și doar aceste intrări erau greșite. `results()` și `explain()` le recitesc acum
  `CONVERT(DECIMAL(28, 8), ...)` sub aliasul `<COL>__EXACT`, iar `mergeExactDecimals()` le pliază
  înapoi peste numele reale — clientul nu vede niciodată aliasul. **Nu reintroduce `SELECT *` simplu
  pe `CCCMINMAXDET`**, și dacă apar coloane noi `DECIMAL(10, 4)`, adaugă-le în `EXACT_DECIMAL_COLUMNS`.
- **`WEEK_INDEX` începe la 0.** Seria densă trebuie să acopere `0..51`, pentru că `0` este săptămâna
  lui `AZI` și așa persistă `Classify` în `CCCMINMAXWEEK`. CTE-ul genera inițial `1..52`, deci omitea
  săptămâna curentă (date nenule în 5 din cele 31 de triplete verificate) și adăuga o săptămână 52
  artificială.

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

Din Faza 6, aceeași cheie de aplicație este trimisă server-side către endpoint-urile fixe
`/JS/NewMinMax/startRun|runPhases|abandonRun|purgeRun`. Fiecare endpoint verifică direct în
`CCC_WSMCP_AUTH` că cheia este activă și are `ALLOW_WRITE=1`; un `clientID` S1 singur nu autorizează
operații lifecycle. Cheia nu este expusă browserului.

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

Pasul 8 este construit și integrat, iar review-ul din pasul 10 a fost efectuat. Faza 5 nu este însă
acceptată încă: review-ul și simulările live au identificat nouă remedieri, definite canonic în
`new_min_max/FAZA5_CONTRACT.md` §12. Dintre ele, următoarele backend sunt blocante:

- `_execStatements()` ignoră rândul tranzacțional `__ok=0`, deci un rollback poate fi raportat ca
  succes și poate determina UI-ul să arunce drafturile;
- `saveParams()` consumă 9 parametri per parametru global, 3 per COV și 4 per filială; șapte celule
  COV au fost respinse live cu `21 > 20`;
- sortarea după `BRANCH`/`MTRL` dublează coloana deja prezentă în tie-break; click-ul live pe
  „Filiala" a produs eroarea SQL 80040E14;
- serviciul nu are încă autentificare/autorizare Feathers pentru cheia cu `ALLOW_WRITE=1`.

Decizia pentru salvare este un singur apel tranzacțional `statements`, cu colecțiile serializate în
JSON și expandate prin `OPENJSON` (SQL Server 2016, compat 130): maximum patru parametri pentru
întregul formular, fără fragmentarea atomicității. Rezultatul `__ok/failedStep/errNum/errMsg` se
validează înainte de succes, apoi configurația se recitește și se compară cu payload-ul normalizat.

Scrierea rămâne oprită implicit prin `MINMAX_ENGINE_WRITES_ENABLED=false` până la autorizare.
Soluția decisă este o sesiune de aplicație semnată, cu expirare absolută la 8 ore, fără refresh sau
sliding expiration, păstrată numai în memoria paginii; orice reload trece din nou prin login.
Citirile cer rol `minmax.read`, iar `saveParams` cere `minmax.edit`; token-ul S1 rămâne separat și
nu poate restaura sesiunea aplicației. Lista editorilor și auditul sunt server-side.

**Convenție de precedență (07.09.2026):** peste tot unde o cheie de config poate fi suprascrisă
printr-o variabilă de mediu (`writesEnabled`/`MINMAX_ENGINE_WRITES_ENABLED`, `readers`/`editors` din
`roles.js`), **variabila de mediu câștigă când e definită** — inclusiv un string gol, care înseamnă
"dezactivat"/"listă goală" explicit, nu "override absent". Config-ul e doar valoarea implicită de
deploy. `_writesEnabled()` a fost corectat 07.09.2026 să respecte asta (înainte, config-ul câștiga,
deci `MINMAX_ENGINE_WRITES_ENABLED=true` nu putea porni scrierea dacă `config/default.json` avea
`false` — exact ultima bifă a Pasului 6).

Cele 41 de teste backend existente trec, dar nu acoperă rollback-ul structurat, payload-ul complet
sau coliziunea sortării cu tie-break-ul. Următorul pas backend este implementarea împreună a
remedierilor §12.1 + §12.2, cu testele de acceptanță descrise în contract.

## Verificare autorizare frontend (07.09.2026)

`test/stores/app-auth.test.js` acoperă lipsa tokenului, autentificarea o singură dată cu strategia
JWT, curățarea tokenului și reîncercarea după eșec. `test/services/minmax-engine/authorize.test.js`
acoperă separat lanțul server-side (401 anonim, 403 pentru read-only la save, editor permis și
payload REFID/rol falsificat ignorat). Rularea completă pe un port liber:
`PORT=3999 npx mocha test/ --recursive` are 121 teste verzi; rămâne numai eșecul preexistent al
serviciului lipsă `mec-item-producer-relation`. Portul implicit 3030 este ocupat de PM2 și produce
un `EADDRINUSE` în `test/app.test.js`, fără legătură cu autorizarea.
