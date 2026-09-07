# Current Focus

## Last Updated
- 07.09.2026 (sesiunea 29 — pasul 2 din planul de remediere implementat: sortare fara
  dublarea tie-break-ului + `.selected` pe cele 3 selecturi, cu teste de componenta LitElement/jsdom;
  in plus, proiectul a fost migrat pe Node.js 20.20.2 via nvm, izolat de celelalte site-uri de pe server)

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
- 07.09.2026 — rolurile `minmax.read`/`minmax.edit` vin din **configurație server-side**, nu dintr-o
  tabelă administrată: o tabelă ACL administrabilă din aplicație ar trebui adăugată în whitelist-ul
  de scriere `execSql`, iar canalul protejat de `minmax.edit` și-ar putea acorda singur dreptul.
  Implicit `editors: []`, `readers: "*"`; lookup izolat în `resolveRoles(refid)`. Detalii în
  `FAZA5_CONTRACT.md` §12.8 și pasul 6 din planul de remediere.

## Open Questions
- Vezi [minmax-engine-open-items.md](../wiki/minmax-engine-open-items.md) și
  `.copilot/context/open-threads.md` pentru firele de business/tangențiale existente.

## Next Step
- **Node.js 20.20.2 via `nvm`** (07.09.2026): doar acest proiect a fost migrat (pm2 recreat cu
  interpreter explicit spre binarul `nvm`), Node-ul de sistem (18.12.1, folosit de celelalte 4
  site-uri Forge) a rămas neatins. A permis adăugarea `jsdom`/`lit`/`@lit/context` ca devDependencies
  și prima infrastructură de test pentru componente LitElement din acest repo
  (`test/helpers/browser-env.mjs` + `cdn-module-loader.mjs`, detalii în memoria de repo). Deploy
  script-ul Forge (nevăzut ca fișier) poate încă rula `npm install` sub Node 18 dacă nu sursează
  `nvm` — inofensiv (zero dependințe native), dar de aliniat quando se atinge.
- **Pasul 0 este făcut** (07.09.2026): `MINMAX_ENGINE_WRITES_ENABLED` implicit `false`, `saveParams`
  aruncă `Forbidden` ca primă instrucțiune, `params()` expune `writesEnabled` către store și
  `minmax-params-panel` afișează read-only. 44 teste minmax-engine verzi.
- **Pasul 1 este făcut** (07.09.2026, §12.1+§12.2): `_execStatements()`/`_checkTransactionResult()`
  respinge rollback-ul (`response.success===false` SAU rând de stare `__ok`/`__OK` = 0, tolerant la
  capitalizare, absența rândului = eroare); `saveParams()` compune `OPENJSON(:1)` per colecție
  (paramsUpdates/covUpdates/branchUpdates), tabelă imediat după `UPDATE`, exact 4 parametri
  poziționali indiferent de numărul de rânduri (validat cu 24+33+18). 60 teste minmax-engine verzi.
  **Verificare live FĂCUTĂ** (cu confirmarea utilizatorului): `OPENJSON(:1)` confirmat funcțional prin
  canalul WSMCP real (cheia app, ALLOW_WRITE=1) pe toate cele 3 tabele, no-op, plus un rollback
  declanșat de o eroare de runtime reală (conversie NVARCHAR→FLOAT) — ACID confirmat live. Bug real
  găsit și corectat în același pas: `findSaveMismatch()` din store nu normaliza `SCOPEKEY` la fel pe
  partea "fresh" ca pe partea "sent" — un `''` real se serializează ca JSON `null` prin execSql,
  ceea ce ar fi produs un fals mismatch la orice salvare reușită de parametru GLOBAL. Corectat.
- **Pasul 2 este făcut** (07.09.2026, §12.3+§12.4): `buildOrderBy()` primește tie-break-ul ca listă
  de field-uri și elimină coloana deja folosită ca sort principal (tie-break rămâne `ASC`); cele 3
  selecturi fixe (`params-panel` MARIME, page size în results-table/group-abc) folosesc `.selected`
  per `<option>`, nu `.value`/`?selected`. 68 teste verzi (63 backend + 5 componentă, noi). Rămâne
  **verificarea live** din plan (click pe toate anteturile sortabile; toate cele 18 filiale afișează
  `MARIME`) — nefăcută încă, nu blochează pasul 3.
  Urmează **pasul 3** (§12.5 + §12.12 + §12.13 — corectitudinea filtrelor CLASA/`codeLike`/`explain`)
  cu agentul `Implement`. Serviciul rămâne complet neautentificat (`around: { all: [] }`) până la
  pasul 6, a cărui decizie de proiectare este acum luată.

