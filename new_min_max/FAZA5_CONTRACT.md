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

| Endpoint | Stare | Motiv |
|---|---|---|
| `setup` | **există** | DDL; neatins |
| `runEngine` | **NU există** | ar cere `EXEC StartRun / Classify / ClassifyGroup / Compute / FinishRun` |
| `applyToErp`, `revertApply` | **NU există** | Faza 4 — tranzacții și scrieri în `MTRBRNLIMITS`/`MTRL` |

`applyToErp` rămâne în AJS **chiar și după** `ALLOW_WRITE = 1`: sunt singurele scrieri în tabele ERP
reale, cer tranzacție și audit, și sunt exact ce exclude lista albă de tabele din serviciu.

`explainRow` **nu** apare în acest tabel, deși planul îl pusese în AJS. Vezi §6: nu are nevoie de
procedură, deci nu are nevoie de `EXEC`.

### Decupaj — ce intră în prima iterație

`S1-MEC/AJS/NewMinMax.js` are astăzi **un singur endpoint**, `setup`. Deci `runEngine` nu este „de
cablat", ci de scris de la zero, cu deploy AJS și commit în submodul — exact lanțul lent pe care
această fază îl evită.

**Iterația 1 nu include `runEngine`.** Obiectivul declarat este ca beneficiarul să *confirme ce
calculăm deja*, nu să lanseze rulări. Sesiunile se deschid și se închid în continuare manual în S1,
ca azi. Consecință pentru UI: fără buton „Rulează" în prima livrare.

### Merg prin `execSql` (`SELECT` curat pe tabele de rezultate)

| Metodă | Sursă |
|---|---|
| `getRunResults` | `CCCMINMAXDET` |
| `getRunHistory` | `CCCMINMAXRUN` |
| `getGroupAbc` | `CCCMINMAXGRP` |
| `getParams` | `CCCMINMAXPARAMS`, `CCCMINMAXCOV`, `CCCMINMAXBRANCH` |
| `explainRow` | `CCCMINMAXDET` + `CCCMINMAXRUN` + `CCCMINMAXWINSOR` + `CCCMINMAXWEEK` |
| `saveParams` | `INSERT`/`UPDATE` pe `CCCMINMAXPARAMS`, `CCCMINMAXCOV`, `CCCMINMAXBRANCH`, `CCCMINMAXTEMPLATE` |

Consecință practică: ecranul de confirmare se poate construi **fără niciun deploy AJS**, iterând
doar în Feathers și UI.

### Transportul Feathers → `execSql`

Forma de mai jos este citită din AJS-ul **deployat în producție** (`CSTINFO`, `CSTTYPE = 16`,
`CSTNAME = 'WSMCP'`), nu dedusă din client:

```js
POST ${S1_BASE_URL}/JS/WSMCP/execSql
{
  appId:     S1_APP_ID,
  clientID:  token,              // token-ul S1 primit de la UI
  authKey:   S1_WS_SHARED_SECRET, // exclusiv server-side
  sqlQuery:  sql,                // string, o singură instrucțiune
  sqlParams: params,             // array pozițional pentru :1, :2, ...
  returnMode: 'dataset'          // implicit
}
```

**Cheile sunt `sqlQuery` și `sqlParams`.** Clientul MCP trimite și variantele `SQL`/`PARAMS`/`sql`/
`params` doar pentru că este generic peste mai multe proiecte; `WSMCP/execSql` le **ignoră**. Serviciul
nostru trimite exact forma de mai sus.

**Plafon dur: 20 de parametri poziționali.** `WSMCP_applyGETSQLDATASET` enumeră cazurile de la 1 la
20 și aruncă `Too many SQL parameters` peste. Este constrângerea care modelează compunerea SQL (§5).

**Tranzacții — `obj.statements`.** Alternativ, `statements: [{sql, params}, ...]` este împachetat
server-side în `BEGIN TRAN ... COMMIT`, cu urmărire pe `@step`, `ROLLBACK` la eroare și rând de
eroare structurat (`__ok`, `failedStep`, `errNum`, `errMsg`). Aceeași limită de 20 de parametri, pe
toată tranzacția. Este calea corectă pentru `saveParams`, care trebuie să fie atomic.

**Eșec de autentificare** → `{ success: false, error: 'Access denied', code: 401 }`.

Există și `/JS/WSMCP/queryDataset`, strict o singură instrucțiune read-only; `execSql` îl acoperă,
deci serviciul folosește un singur endpoint.

`authKey` nu este un secret verificat doar de client. Este validat în S1 față de o tabelă dedicată,
citită pe producție (07.09.2026):

| Coloană | Tip | Observație |
|---|---|---|
| `AUTHKEY` | `varchar(128)` | cheie primară, deci sunt permise **mai multe** chei distincte |
| `ISACTIVE` | `bit`, default `1` | întrerupător: revocă o cheie fără să o șteargă |
| `ALLOW_WRITE` | `bit`, default `0` | permite scrierile prin acest canal |
| `INSDATE` | `datetime`, default `getdate()` | fără expirare automată |

Starea de azi: **o singură cheie**, de 128 de caractere, `ISACTIVE = 1`, `ALLOW_WRITE = 0`. Aceasta
din urmă este motivul pentru care deploy-ul AJS din agent a fost refuzat server-side.

Rezultă o apărare pe **trei** niveluri, nu două, toate verificate în sursa deployată:

1. `classifySql` în procesul Node — whitelist de verbe, înainte de apel;
2. `WSMCP_classifyStatement` **server-side** — același set blocat
   (`DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|GRANT|REVOKE|DBCC|BACKUP|RESTORE|SHUTDOWN|MERGE`, plus
   prefixele `SP_`/`XP_`), aplicat după ce comentariile și literalii sunt îndepărtați, deci un cuvânt
   ascuns într-un șir nu poate păcăli verificarea;
3. `ALLOW_WRITE` pe cheie — evaluat **per instrucțiune**, prin `isWrite`.

Al doilea strat este cel care contează cu adevărat: chiar dacă stratul Node ar fi ocolit sau
compromis, S1 refuză singur DDL și `EXEC`.

**Decizie (07.09.2026): cheia aplicației primește `ALLOW_WRITE = 1`.** Motivul este panoul de
parametri: editarea `CCCMINMAXPARAMS` / `CCCMINMAXCOV` / `CCCMINMAXBRANCH` / `CCCMINMAXTEMPLATE`
este CRUD pe tabele de configurare, iar trecerea lui prin `execSql` păstrează același ciclu rapid de
iterație ca la citiri, fără deploy AJS la fiecare modificare de formular.

Ce **nu** se deblochează: `EXEC`, `EXECUTE`, `CREATE`, `ALTER` rămân în `ALWAYS_BLOCKED_VERBS`,
indiferent de flag. `runEngine`, `explainRow` și `applyToErp` rămân obligatoriu în AJS.

Ce se deblochează: `INSERT` / `UPDATE` / `DELETE` — **pe orice tabelă**. Verificat în sursă:
`WSMCP_classifyStatement` nu are nicio listă de tabele, deci un `UPDATE` valid sintactic poate atinge
`MTRL`, `MTRBRNLIMITS` sau `FINDOC` la fel de ușor ca `CCCMINMAXPARAMS`. Până acum o eroare de
compunere scurgea date; de acum poate corupe ERP-ul.

**Control compensatoriu obligatoriu — listă albă de tabele în serviciul Feathers.** Scrierile se
acceptă exclusiv către `CCCMINMAXPARAMS`, `CCCMINMAXCOV`, `CCCMINMAXBRANCH` și `CCCMINMAXTEMPLATE`.
Nu poate fi implementat în WSMCP, al cărui cod nu se află în acest repo, deci stă lângă
`classifySql`: verb whitelist **și** table whitelist, ambele verificate înainte de apel.

**Cheie separată pentru aplicație.** Cum `AUTHKEY` este cheie primară, aplicația primește rândul ei,
distinct de cel al MCP-ului de dezvoltare. Separarea rămâne necesară și după această decizie:
domeniile de acces diferă, iar rotația uneia nu o afectează pe cealaltă.

Două limite de reținut, fără soluție în schema actuală, ambele mai grele odată cu scrierile: nu
există tabelă de audit server-side (`CCC_WSMCP_AUTH` este singura `CCC_WSMCP*`, iar jurnalul din
`mcp-server/src/audit-log.ts` este local procesului), deci mutațiile prin acest canal rămân
neatribuibile; și nu există expirare. Rotația se face fără întrerupere prin `ISACTIVE`: se inserează
cheia nouă, se comută variabila de mediu, apoi se dezactivează cea veche.

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
| Scope | `runId` (int, opțional), `branches` (int[], max 14), `esteHq` (tri-state) |
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
4. **Listele `IN` trec printr-un singur parametru CSV**, nu prin câte un placeholder per valoare.
   Plafonul server-side este de **20 de parametri poziționali** pe apel, iar un filtru cu 14 filiale
   plus clase l-ar depăși imediat. Forma corectă:
   `INNER JOIN STRING_SPLIT(:1, ',') s ON s.value = CONVERT(VARCHAR(20), d.BRANCH)`. `STRING_SPLIT`
   există pe SQL Server 2016 la compat 130. Bugetul de parametri se ține explicit sub 20.
5. **Numărul total de rânduri se calculează separat**, nu cu `COUNT(*) OVER ()`, și doar când se
   schimbă filtrul — altfel fiecare pagină plătește scanarea întregului set.

## 6. Contract `explainRow`

Este mecanismul prin care beneficiarul **verifică** o cifră, nu doar o vede. Face parte din
iterația 1: fără el, ecranul cere încredere în loc să o producă.

**Nu are nevoie de procedură stocată.** Citește exclusiv stare persistată, deci este `SELECT` curat
și trece prin `execSql` ca orice altă citire. Planul îl așezase în AJS presupunând un
`sp_MinMaxEngine_Explain`; presupunerea era inutilă.

**Lanțul este deja pe rând.** `SAFETY`, `LT_STOCK`, `SLTS`, `BUF`, `CYCLE`, `MAX_RAW`, `MAX_INF`,
`CAP6`, `VZ26_CAP`, `SUM_BR_MAX`, `ENG_MIN`, `ENG_MAX`, `BUY_RAW`, `BUY_QTY`, `HQ_CAP_APLICAT`,
`PODEA_APLICATA`, împreună cu intrările `SIGMA_WK`, `SSF`, `LT_ZILE`, `SL`, `ad`, `AVG`, `COV_TGT`,
`FRECVENTA_ZILE`, `N_PACK`, `STOC_QTY`, `ORD_FURN` — toate sunt coloane în `CCCMINMAXDET`. Drawer-ul
**nu recalculează nimic**; afișează ce s-a persistat și etichetează pașii.

Trei interogări suplimentare, toate punctuale:

| Ce | De unde |
|---|---|
| antetul sesiunii + `PARAMSJSON` / `COMPUTE_PARAMSJSON` | `CCCMINMAXRUN` unde `RUNID` |
| statisticile de winsorizare ale articolului | `CCCMINMAXWINSOR` unde `(RUNID, MTRL)` |
| seria de 52 de săptămâni, reconstruită dens | CTE de 52 de rânduri `LEFT JOIN CCCMINMAXWEEK` pe `(RUNID, BRANCH, MTRL)` |

Seria se reconstruiește dens la afișare pentru că `CCCMINMAXWEEK` este rară prin definiție: absența
unei săptămâni **înseamnă** zero. Utilizatorul trebuie să vadă cele 52 de săptămâni, inclusiv golurile.

**Regula dură, nenegociabilă:** `explainRow` nu atinge `MTRTRN`, `FINDOC` sau `MTRL`. `AZI` vine din
date vii și populația crește în cursul zilei, deci o explicație care reinteroghează ERP-ul ar afișa
alte cifre decât rularea pe care pretinde că o explică.

### Ce **nu** este `explainRow`

Planul §4.1 folosește același nume pentru două lucruri diferite. Drawer-ul de mai sus **citește**
valori persistate. Separat, planul cere un **oracol de corectitudine** — o reimplementare densă,
naivă, care recalculează de la zero și verifică calea rapidă (§9 din plan, harness-ul sparse vs dens).

Acela este instrument de dezvoltare, nu de interfață, și rămâne în afara Fazei 5. Confundarea lor ar
introduce formule duplicate în stratul Node, cu risc de divergență față de motor.

## 7. Contract `saveParams`

Singura cale de scriere din interfață. Merge prin `statements`, deci toată salvarea este atomică:
ori se aplică tot setul, ori niciunul.

| Tabelă | Cheie de identitate | Semantică |
|---|---|---|
| `CCCMINMAXPARAMS` | `(PARAMKEY, SCOPE, SCOPEKEY)` | upsert; `SCOPE='GLOBAL'`, `SCOPEKEY=''` în iterația 1 |
| `CCCMINMAXCOV` | `(CLASA, MARIME)` | doar `UPDATE` — matricea are 33 de rânduri fixe |
| `CCCMINMAXBRANCH` | `BRANCH` | doar `UPDATE` pe `MARIME`, `INCLUS`, `ESTE_PODEA` |
| `CCCMINMAXTEMPLATE` | `(FURNIZOR, BRANCH, PREFIX)` | **în afara iterației 1** — vezi Open Questions din handoff |

Upsert-ul se scrie ca `UPDATE` urmat de `INSERT ... WHERE NOT EXISTS`, nu `MERGE`: `MERGE` este în
`ALWAYS_BLOCKED_VERBS`, atât în `classifySql` cât și în `WSMCP_classifyStatement`.

Bugetul de parametri rămâne sub 20 pe apel; un set mare de parametri se salvează în mai multe
tranzacții succesive, nu într-una singură.

`ESTE_HQ` nu este editabil din interfață: definește stratul de companie, nu o preferință.

## 8. Precondiție — persistența `ClassifyGroup`

`getGroupAbc` citește `CCCMINMAXGRP`. Persistența este implementată local: tabelul are cheia
`(RUNID, BRANCH, MTRGROUP)`, iar `ClassifyGroup` persistă pe o sesiune `OPEN`. Înainte de UI,
această modificare trebuie deployată și validată pe o sesiune `FULL` nouă, închisă prin
`sp_MinMaxEngine_FinishRun` cu `GROUP_STATUS = 'DONE'`.

## 9. Straturi și fișiere

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
| `minmax-run-panel.js` | selecția sesiunii + istoric (**doar selecție**, fără lansare) |
| `minmax-group-abc.js` | ABC-XYZ per grupă |
| `minmax-explain-drawer.js` | drill-down pe un rând — lanțul de calcul și seria de 52 de săptămâni |
| `minmax-params-panel.js` | parametri, matrice COV, filiale, șabloane — **singura scriere** |

Tabelul refolosește configurarea pe coloane din
[../public/config/table-column-config.js](../public/config/table-column-config.js).

## 10. Todo list, cu model recomandat

- [x] 1. Deploy + validare sesiune `FULL` nouă pentru `CCCMINMAXGRP` și modelul imutabil *(utilizator — validat pe RUNID=5)*
- [x] 2. Cheie dedicată aplicației în `CCC_WSMCP_AUTH`, cu `ALLOW_WRITE = 1` *(utilizator — inserat 07.09.2026)*
- [x] 3. Configurare server-side prin environment pentru transportul `execSql` *(Claude Sonnet 4.6 — custom-environment-variables.json)*
- [x] 4. Serviciu Feathers `src/services/minmax-engine/` cu clientul `execSql` *(Claude Sonnet 4.6)*
- [x] 5. Compunerea SQL din contractul de filtre + whitelist de coloane *(Claude Sonnet 4.6)*
- [x] 6. Portarea `classifySql` în serviciu *(model de bază — adăugat și table whitelist)*
- [x] 7. Înregistrare în `services/index.js` și `socketConfig.js` *(model de bază)*
- [ ] 8. Componentele UI + store, inclusiv drawer-ul `explainRow` *(Claude Sonnet 4.6)*
- [ ] 9. Măsurarea sortărilor non-implicite pe prima sesiune curentă *(Claude Sonnet 4.6)*
- [ ] 10. Review pe diff, sesiune nouă context mic *(Opus)*

**În afara iterației 1**, fiecare pentru că cere AJS nou plus deploy: `runEngine` (lansarea unei
sesiuni din UI), CRUD-ul de șabloane, și oracolul dens de validare (§6, distinct de drawer). Niciunul
nu blochează confirmarea rezultatelor de către beneficiar.

## 11. Constrângeri de respectat

- Faza 5 nu scrie nimic în ERP. Orice buton de aplicare aparține Fazei 4.
- `authKey` rămâne server-side; browserul trimite filtre tipate, niciodată SQL.
- `execSql` primește transportul MCP complet (`SQL`/`PARAMS` și aliasurile lor), cu token-ul
  utilizatorului drept `clientID`.
- Aplicația folosește o cheie proprie din `CCC_WSMCP_AUTH`, distinctă de cea a MCP-ului de
  dezvoltare și menținută permanent cu `ALLOW_WRITE = 0`.
- Fără metode generice de interogare în `socketConfig.js`.
- Identificatorii SQL vin exclusiv din whitelist; valorile, exclusiv din parametri legați.
- Endpoint-urile care fac `EXEC` sau DDL rămân în AJS — garda le respinge prin construcție.
- Ecranul citește starea persistată a rulării; nu recalculează și nu interoghează `MTRTRN`/`FINDOC`.
- `explainRow` afișează valori persistate și nu reimplementează nicio formulă în stratul Node.
- Sesiunea curentă este `ESTE_CURENT = 1` pe o sesiune `FULL` închisă cu faza solicitată `DONE`;
  niciun consumator nu deduce „ultima" prin `MAX(RUNID)`.
