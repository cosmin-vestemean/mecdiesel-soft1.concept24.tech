# Faza 5 — contract UI de confirmare

> **Obiectiv:** o interfață prin care beneficiarul inspectează și confirmă rezultatele **deja
> calculate** (`RUNID = 4`), fără nicio scriere în ERP. Este pasul care precede deliberat Faza 4
> ([FAZA4_CONTRACT.md](FAZA4_CONTRACT.md)): validarea vizuală înaintea pasului ireversibil.

Referințe: [PLAN_IMPLEMENTARE.md](PLAN_IMPLEMENTARE.md) §6 (backend Node) și §7 (UI),
[../mcp-server/src/softone-client.ts](../mcp-server/src/softone-client.ts) pentru transportul
`execSql` deja securizat.

---

## 1. Ce există deja și ce nu

`S1-MEC/AJS/NewMinMax.js` are astăzi **un singur endpoint**: `setup(obj)`. Celelalte opt funcții
din fișier sunt generatoare de text SQL consumate de `setup`, nu endpoint-uri. Toate endpoint-urile
din tabelul §5 al planului (`getRunResults`, `runEngine`, `explainRow` etc.) sunt **enumerate, nu
scrise**.

Prin urmare Faza 5 nu migrează nimic. Nu este o mutare de cod din AJS în Feathers, ci decizia unde
se scriu pentru prima oară endpoint-urile de citire. Procedurile stocate rămân neatinse, în baza S1,
instalate de `setup`.

## 2. Arhitectura — trei straturi pentru citire

```
UI (obiect de filtre tipat) → Feathers (compune SQL) → /JS/WSMCP/execSql → S1
```

Pentru citiri, stratul AJS dispare. Motivul nu este eleganța, ci ciclul de iterație: fără `execSql`,
fiecare coloană sau filtru nou cere editare AJS → commit în submodul → commit de pointer → deploy
`/JS/NewMinMax/setup` → pereche în `sync-check.cjs`. Cu `execSql`, interogarea trăiește în serviciul
Feathers și se schimbă printr-un restart. Pentru un ecran care se va rescrie sub feedback-ul
beneficiarului, diferența este de un ordin de mărime.

## 3. Împărțirea AJS vs `execSql`

Granița **nu este o preferință**, ci consecința gărzii din [../mcp-server/src/sql-guard.ts](../mcp-server/src/sql-guard.ts):
`READ_VERBS = {SELECT, WITH}`, iar `ALWAYS_BLOCKED_VERBS` conține `EXEC`, `EXECUTE`, `CREATE`,
`ALTER`. `execSql` nu poate lansa o procedură și nu poate instala nimic, prin construcție.

### Rămân AJS (execută proceduri sau DDL)

| Endpoint | Motiv |
|---|---|
| `setup` | DDL; există deja, neatins |
| `runEngine` | `EXEC sp_MinMaxEngine_Prepare / Classify / ClassifyGroup / Compute` |
| `explainRow` | `EXEC sp_MinMaxEngine_Explain` |
| `saveParams` | scriere în `CCCMINMAXPARAMS`; oricum blocată de `ALLOW_WRITE = 0` |
| `applyToErp`, `revertApply` | Faza 4 — tranzacții |

### Merg prin `execSql` (`SELECT` curat pe tabele de rezultate)

| Metodă | Sursă |
|---|---|
| `getRunResults` | `CCCMINMAXDET` |
| `getRunHistory` | `CCCMINMAXRUN` |
| `getGroupAbc` | `CCCMINMAXGRP` |
| `getParams` | `CCCMINMAXPARAMS`, `CCCMINMAXCOV`, `CCCMINMAXBRANCH` |

Consecință practică: ecranul de confirmare se poate construi **fără niciun deploy AJS**, iterând
doar în Feathers și UI.

### Transportul Feathers → `execSql`

Serviciul Feathers reproduce exact transportul folosit de `s1-api MCP`, nu inventează un client
S1 separat:

```js
POST ${S1_BASE_URL}/JS/WSMCP/execSql
{
   appId: S1_APP_ID,
   clientID: token,
   authKey: S1_WS_SHARED_SECRET,
   SQL: sql,
   PARAMS: params,
   sql,
   params,
   sqlParams: params,
   sqlQuery: sql
}
```

`token` vine din apelul UI și devine `clientID`; serviciul nu autentifică din nou utilizatorul.
`authKey` rămâne exclusiv pe server. Aliasurile duplicate sunt obligatorii: endpoint-urile AJS
custom nu sunt standardizate, iar `WSMCP/execSql` citește forma sa proprie.

## 4. Securitate

Garda actuală este sigură pentru că apelantul este un dezvoltator. Sub un ecran de utilizator final
modelul de amenințare se schimbă, deci:

- **`authKey` nu ajunge niciodată în browser.** Stă în configurația backend-ului Feathers, ca restul
  secretelor. În client ar însemna acces de citire la toată baza ERP pentru orice utilizator.
- **Secretele nu se adaugă în `config/default.json`.** Se declară numai prin variabile de mediu,
   în [../config/custom-environment-variables.json](../config/custom-environment-variables.json):
   `S1_BASE_URL`, `S1_APP_ID` și `S1_WS_SHARED_SECRET`. Valorile de producție rămân în mediul de
   deploy, nu în git.
- **Read-only nu înseamnă autorizat.** `classifySql` oprește mutația, nu exfiltrarea: un `SELECT`
  valid poate citi salarii, prețuri de achiziție sau date de client. Browserul trimite **doar un
  obiect de filtre tipat**; SQL-ul se compune în serviciu.
- **Nicio metodă generică** de tip `query` / `sql` în [../public/socketConfig.js](../public/socketConfig.js).
  Doar `results`, `history`, `groupAbc`, `params`, `explain`. Altfel reproducem gaura din
  `getSqlDataset`, unde SQL-ul se construiește în browser
  ([../public/dataFetching.js](../public/dataFetching.js)).
- **`classifySql` se portează în serviciu** ca a doua plasă — ieftin, și prinde greșeli de compunere,
  nu doar atacuri.

## 5. Contract `getRunResults`

### Filtre

| Grup | Câmpuri |
|---|---|
| Scope | `runId` (int, opțional), `branches` (int[], max 50), `esteHq` (tri-state) |
| Articol | `codeLike` (prefix), `mtrl` (int[]), `mtrgroup` (int[]) |
| Clasificare | `lifecycle`, `abc`, `xyz`, `clasa` (string[], validate față de mulțimea posibilă) |
| Indicatori | `flagTxt` (`OK`/`UP`/`DOWN`/`MAJOR_UP`/`SUPRASTOC`/`FARA_REFERINTA`), `statusTrend` (`ACTIVE`/`STABLE`/`TREND_DOWN`/`DECLINE`) |
| Booleeni tri-state | `hqCapAplicat`, `podeaAplicata`, `arePozitieErp`, `discFlag`, `flagLichidare`, `flagBlocat`, `flagExclus`, `warnVz26Zero`, `warnStocNeg`, `warnStocMort`, `warnGrupaMica` |
| Intervale `{min,max}` | `engMin`, `engMax`, `buyQty`, `stocQty`, `ordFurn`, `acopCur`, `flagRatio`, `cv`, `avg`, `vz52s`, `val52s` |

Tri-state înseamnă `true` / `false` / absent = filtrul nu se aplică.

Fără `runId`, serviciul selectează **o singură sesiune**, nu `MAX(RUNID)`: `COMPANY = 1000`,
`SCOPE = 'FULL'`, `SESSION_STATUS = 'DONE'`, `ESTE_CURENT = 1` și `COMPUTE_STATUS = 'DONE'`.
Cererea fără un astfel de rând răspunde explicit „nu există încă sesiune curentă", nu face fallback
pe rulările legacy. Cu `runId` explicit, serviciul verifică aceeași companie, `SCOPE = 'FULL'`,
`SESSION_STATUS = 'DONE'` și `COMPUTE_STATUS = 'DONE'` înainte să livreze datele.

Filtrul implicit al UI este `flagTxt` în `DOWN`, `OK`, `UP`, `MAJOR_UP`, `SUPRASTOC`, plus
`VZ_26S > 0`; utilizatorul poate elimina filtrele. Acesta evită deschiderea implicită peste cei
95,6% de rânduri `FARA_REFERINTA`, fără să ascundă definitiv niciun rezultat.

### Sortare și paginare

- `sort: {field, dir}` — `field` din whitelist, `dir` ∈ `ASC` / `DESC`
- `page` 1-based, `pageSize` implicit 100, **plafon dur 500**

### Reguli de implementare

1. **Numele de coloane nu se pot parametriza.** Sortarea și filtrele trec printr-o mapare explicită
   câmp API → coloană, singura sursă de identificatori acceptată. Maparea rezolvă și `[AVG]`, care
   cere paranteze drepte, și `ad`, scris cu literă mică în `CCCMINMAXDET`.
2. **Ordonarea are nevoie de departajare.** Cheia clustered este `(RUNID, BRANCH, MTRL)`; orice
   sortare pe altă coloană produce egalități, iar fără `, BRANCH, MTRL` la coadă paginile pot repeta
   sau sări rânduri.
3. **Sortarea implicită este `BRANCH, MTRL`** — coincide cu ordinea clustered, deci gratuită. Orice
   altă sortare pe un `runId` fără filtru de filială înseamnă sortarea a ~713.818 rânduri; de
   măsurat înainte de a fi expusă, nu de presupus.
4. **Listele `IN` se leagă, nu se interpolează** — câte un placeholder per valoare (`IN (:3, :4, :5)`),
   chiar și după validarea că sunt întregi.
5. **Numărul total de rânduri se calculează separat**, nu cu `COUNT(*) OVER ()`, și doar când se
   schimbă filtrul — altfel fiecare pagină plătește scanarea întregului set.

## 6. Precondiție — persistența `ClassifyGroup`

`getGroupAbc` citește `CCCMINMAXGRP`. Persistența este implementată local: tabelul are cheia
`(RUNID, BRANCH, MTRGROUP)`, iar `ClassifyGroup` persistă pe o sesiune `OPEN`. Înainte de UI,
această modificare trebuie deployată și validată pe o sesiune `FULL` nouă, închisă prin
`sp_MinMaxEngine_FinishRun` cu `GROUP_STATUS = 'DONE'`.

## 7. Straturi și fișiere

| Strat | Locație | Tipar de urmat |
|---|---|---|
| Feathers | `src/services/minmax-engine/` (`.js`, `.class.js`, `.shared.js`) | [../src/services/zero-minmax/](../src/services/zero-minmax/) |
| Înregistrare | `app.configure(...)` în [../src/services/index.js](../src/services/index.js) | idem |
| Client | [../public/socketConfig.js](../public/socketConfig.js) | `client.use("minmax-engine", ...)` |
| UI | `public/components/minmax-engine/` | store după [../public/stores/replenishment-store.js](../public/stores/replenishment-store.js) |

Serviciul se scrie ca **folder generat**, nu ca o clasă inline în [../src/app.js](../src/app.js) —
acolo trăiesc `necesar-achizitii`, `top-abc` și `batch-queue`, care au dus fișierul peste 1.500 de linii.

### Componente

| Componentă | Rol |
|---|---|
| `minmax-engine-container.js` | container, provider de store |
| `minmax-results-table.js` | rezultate, filtre server-side pe contractul §5 |
| `minmax-run-panel.js` | selecția rulării + istoric |
| `minmax-group-abc.js` | ABC-XYZ per grupă |
| `minmax-params-panel.js` | parametri, read-only în prima iterație |

Tabelul refolosește configurarea pe coloane din
[../public/config/table-column-config.js](../public/config/table-column-config.js).

## 8. Todo list, cu model recomandat

- [ ] 1. Deploy + validare sesiune `FULL` nouă pentru `CCCMINMAXGRP` și modelul imutabil *(utilizator)*
- [ ] 2. Configurare server-side prin environment pentru transportul `execSql` *(Claude Sonnet 4.6)*
- [ ] 3. Serviciu Feathers `src/services/minmax-engine/` cu clientul `execSql` *(Claude Sonnet 4.6)*
- [ ] 4. Compunerea SQL din contractul de filtre + whitelist de coloane *(Claude Sonnet 4.6)*
- [ ] 5. Portarea `classifySql` în serviciu *(model de bază)*
- [ ] 6. Înregistrare în `services/index.js` și `socketConfig.js` *(model de bază)*
- [ ] 7. Componentele UI + store *(Claude Sonnet 4.6)*
- [ ] 8. Măsurarea sortărilor non-implicite pe prima sesiune curentă *(Claude Sonnet 4.6)*
- [ ] 9. Review pe diff, sesiune nouă context mic *(Opus)*

## 9. Constrângeri de respectat

- Faza 5 nu scrie nimic în ERP. Orice buton de aplicare aparține Fazei 4.
- `authKey` rămâne server-side; browserul trimite filtre tipate, niciodată SQL.
- `execSql` primește transportul MCP complet (`SQL`/`PARAMS` și aliasurile lor), cu token-ul
   utilizatorului drept `clientID`.
- Fără metode generice de interogare în `socketConfig.js`.
- Identificatorii SQL vin exclusiv din whitelist; valorile, exclusiv din parametri legați.
- Endpoint-urile care fac `EXEC` sau DDL rămân în AJS — garda le respinge prin construcție.
- Ecranul citește starea persistată a rulării; nu recalculează și nu interoghează `MTRTRN`/`FINDOC`.
- Sesiunea curentă este `ESTE_CURENT = 1` pe o sesiune `FULL` închisă cu faza solicitată `DONE`;
   niciun consumator nu deduce „ultima" prin `MAX(RUNID)`.
