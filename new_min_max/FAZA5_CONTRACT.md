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

## 12. Soluții pentru constatările review-ului din 07.09.2026

Constatările 12.1–12.9 provin din review-ul pe intervalul de commit-uri al Fazei 5 și din simulări
autentificate pe `RUNID = 5`. Constatările 12.10–12.14 au fost adăugate de review-ul secundar pe
cod (07.09.2026, sesiune nouă cu context mic), care a confirmat primele nouă și a corectat trei
detalii de proiectare din soluțiile lor — vezi §12.2 (forma `UPDATE` acceptată de garda SQL), §12.4
(binding pe proprietate, nu pe atribut) și §12.15 (write flag oprit înainte de repararea scrierii).

12.1–12.4 rămân blocante pentru acceptanță. Implementarea remedierilor este un task multi-fișier
*(model recomandat: Claude Sonnet 4.6)*, urmat de review pe diff și retestare live într-o sesiune
nouă, cu context mic *(model recomandat: Opus)*.

### 12.1. Rollback-ul `saveParams` nu trebuie raportat ca succes — blocant

**Soluție:** `_execStatements()` trebuie să interpreteze și rezultatul tranzacțional din
`response.data`, nu doar `response.success`. Dacă rândul de stare are `__ok = 0`, metoda aruncă o
eroare care include `failedStep`, `errNum` și `errMsg`; `saveParams()` nu mai poate întoarce
`success: true` după `ROLLBACK`. Citirea câmpurilor trebuie să tolereze capitalizarea returnată de
driver (`__ok`/`__OK`), dar nu absența unui rezultat valid.

Store-ul golește drafturile numai după trei condiții îndeplinite: tranzacția a răspuns cu succes,
`loadParams()` a reușit, iar valorile recitite coincid cu payload-ul normalizat trimis. Pentru acest
flux, `loadParams()` trebuie să poată propaga eroarea către `saveParams()` în loc să o consume și să
rezolve promisiunea. La eroare, drafturile rămân intacte și mesajul afișează pasul care a eșuat.

**Acceptanță:** test HTTP mockat pentru `{success:true,data:[{__ok:0,...}]}` care trebuie să
respingă promisiunea; test UI/store care confirmă că drafturile nu se golesc după rollback sau după
eșecul recitirii. Se adaugă și cazul `__ok = 1` pentru a fixa forma răspunsului de succes.

### 12.2. Salvarea trebuie să suporte matricea completă fără depășirea limitei de 20 — blocant

**Amploarea reală:** limita nu se atinge la 20 de modificări, ci mult mai devreme, pentru că fiecare
rând generează mai mulți parametri poziționali: un parametru global costă 9 (4 pentru `UPDATE` + 5
pentru `INSERT`), o celulă COV costă 3, o filială costă 4. Salvarea se rupe deci de la **3 parametri
globali**, **7 celule COV** sau **6 filiale** — praguri pe care un utilizator le atinge la prima
sesiune reală de configurare.

**Soluție:** nu se fragmentează salvarea în tranzacții succesive, deoarece asta ar pierde garanția
all-or-nothing. Fiecare colecție se serializează server-side într-un singur parametru JSON, validat
și limitat ca număr de rânduri înainte de SQL. Pe SQL Server 2016, compat level 130, `OPENJSON`
transformă payload-ul în rânduri folosind tipurile exacte din schema tabelei:

- `paramsUpdates`: un `UPDATE ... FROM OPENJSON(:1)` și un
   `INSERT ... SELECT ... FROM OPENJSON(:1) WHERE NOT EXISTS`, fără `MERGE`;
- `covUpdates`: un singur `UPDATE CCCMINMAXCOV ... FROM OPENJSON(:1)`;
- `branchUpdates`: un singur `UPDATE CCCMINMAXBRANCH ... FROM OPENJSON(:1)`.

Toate instrucțiunile rămân în același apel `statements`, deci într-o singură tranzacție WSMCP.
Payload-ul de parametri consumă maximum patru poziții (JSON-ul de parametri apare în două
instrucțiuni, COV într-una și filiale într-una), indiferent dacă se modifică o celulă sau toate cele
33. Garda SQL trebuie să recunoască în continuare explicit tabela țintă din fiecare `UPDATE`/
`INSERT`; nu se relaxează whitelist-ul.

**Constrângere obligatorie de formă SQL:** `referencedTable()` din `sql-guard.js` extrage tabela cu
`UPDATE\s+([A-Za-z0-9_]+)`, deci forma idiomatică `UPDATE c SET ... FROM CCCMINMAXCOV c JOIN
OPENJSON(:1)` ar returna **aliasul** `C` și ar fi respinsă de propria gardă. Se scrie deci
obligatoriu cu tabela imediat după `UPDATE`:
`UPDATE CCCMINMAXCOV SET COV = j.COV, UPDATEDAT = GETDATE() FROM CCCMINMAXCOV INNER JOIN OPENJSON(:1)
WITH (...) j ON j.CLASA = CCCMINMAXCOV.CLASA AND j.MARIME = CCCMINMAXCOV.MARIME`. Nu se relaxează
regex-ul gărzii pentru a accepta aliasuri: ar fi o slăbire a whitelist-ului, nu o adaptare.

**Acceptanță:** test cu 24 parametri globali + 33 COV + 18 filiale în același save, cel mult patru
parametri poziționali pe request, o singură tranzacție și rollback integral dacă ultimul statement
eșuează. Se verifică live `OPENJSON(:1)` prin canalul WSMCP înainte de activarea scrierii în UI.

### 12.3. Sortarea nu trebuie să dubleze coloanele din tie-break — blocant

**Soluție:** `buildOrderBy()` primește tie-break-ul ca listă de identificatori validați, nu ca text
opac, și elimină din listă coloana deja aleasă pentru sortare. Exemplele obligatorii sunt:

- sort `branch` → `ORDER BY d.BRANCH <dir>, d.MTRL`;
- sort `mtrl` → `ORDER BY d.MTRL <dir>, d.BRANCH`;
- sort `engMax` → `ORDER BY d.ENG_MAX <dir>, d.BRANCH, d.MTRL`;
- în `groupAbc`, aceeași regulă pentru `BRANCH` și `MTRGROUP`.

Direcția utilizatorului se aplică numai coloanei principale; tie-break-ul rămâne `ASC` pentru o
paginare deterministă. Whitelist-ul de sortare rămâne unica sursă de identificatori SQL.

**Acceptanță:** teste unitare pe SQL-ul exact pentru coliziunea cu fiecare coloană din tie-break,
apoi click live pe toate antetele sortabile; nicio interogare nu conține aceeași expresie de două
ori în `ORDER BY`.

### 12.4. Selectoarele trebuie să afișeze starea persistată — blocant

**Soluție:** nu se mai setează `.value` pe `<select>` înainte ca opțiunile Lit să existe. Fiecare
`<option>` primește binding pe **proprietate** — `.selected="${...}"` — comparat cu valoarea din
store, atât pentru `MARIME`, cât și pentru page size în rezultate și group ABC. Nu se folosește
`?selected`: acela scrie *atributul*, adică `defaultSelected`, iar după prima interacțiune a
utilizatorului elementul `<select>` devine „dirty" și ignoră schimbările de atribut, deci un
re-render din store nu s-ar mai reflecta în DOM. Alternativa acceptabilă este păstrarea `.value`,
dar mutată în `updated()`, după ce opțiunile au fost randate.

După randare, DOM-ul trebuie să fie o proiecție a store-ului; payload-ul de salvare se construiește
în continuare din draft, niciodată citind selectoarele din DOM.

**Acceptanță:** test de componentă cu filiale `MARE/MEDIU/MIC` și page size 50/100/200/500, plus
verificare live că toate cele 18 filiale afișează `MARIME` din `CCCMINMAXBRANCH`. Modificarea unui
checkbox nu trebuie să schimbe implicit mărimea filialei.

### 12.5. Filtrul `CLASA` trebuie să includă `NOU` și `OD`

**Soluție:** mulțimea backend `CLASA_VALUES` și ambele liste UI `CLASA_OPTIONS` devin
`AX, AY, AZ, BX, BY, BZ, CX, CY, CZ, NOU, OD`. Aceeași mulțime se definește într-un modul comun
frontend pentru a evita divergența dintre rezultate și group ABC; backend-ul rămâne autoritatea de
validare. Filtrul `lifecycle` rămâne separat — cele două câmpuri nu sunt sinonime chiar dacă
override-urile actuale produc frecvent aceeași valoare.

**Acceptanță:** teste backend pentru `clasa=['NOU','OD']`, teste UI pentru prezența opțiunilor și
simulare live pe `RUNID = 5`. La review s-au măsurat 659 rânduri `CLASA=NOU` și 680.918 rânduri
`CLASA=OD`; ambele populații trebuie să poată fi selectate direct.

### 12.6. `COUNT(*)` se recalculează numai când se schimbă populația

**Soluție:** `loadResults()` primește explicit opțiunea `withTotal`. Încărcarea inițială,
schimbarea/resetarea filtrelor, schimbarea sesiunii și refresh-ul explicit trimit `withTotal:true`.
Paginarea, sortarea și schimbarea page size trimit `withTotal:false`, iar reducer-ul păstrează
totalul existent când răspunsul nu conține `total`. Store-ul memorează cheia populației
`{resolvedRunId, filters}` pentru a invalida totalul; sortarea și pagina nu fac parte din cheie.

Pentru modul „sesiunea curentă", refresh-ul explicit rezolvă din nou `ESTE_CURENT`; dacă RUNID-ul
rezolvat diferă, totalul se invalidează și se recalculează chiar dacă filtrele sunt identice.

**Acceptanță:** test de store care numără apelurile: paginile 2/3 și sortarea nu cer count;
schimbarea unui filtru sau trecerea la alt RUNID cere exact un count. Se măsoară live latența unei
paginări înainte și după remediere.

### 12.7. Răspunsurile asincrone vechi nu trebuie să suprascrie starea nouă

**Soluție:** store-ul menține câte un request sequence monoton pentru `results`, `groupAbc`,
`explain`, `history` și `params`. Fiecare apel capturează ID-ul curent și poate face dispatch pentru
date, eroare sau `loading=false` numai dacă este încă ultimul apel din fluxul respectiv. Închiderea
drawer-ului incrementează secvența `explain`, invalidând răspunsul aflat în zbor. Salvarea are flux
separat și dezactivează butonul până la tranzacție plus recitire.

Se preferă această gardă față de `AbortController`: apelul Feathers/socket nu oferă anularea
fiabilă a lucrului deja pornit în S1, dar răspunsul expirat poate fi ignorat determinist.

**Acceptanță:** teste cu promisiuni controlate care rezolvă cererile în ordine inversă pentru
pagina 2/3, două articole deschise rapid și două seturi group ABC. Numai ultima cerere modifică
datele, eroarea și loading state-ul.

### 12.8. Scrierea cere identitate și rol server-side, nu doar un token S1

**Soluție imediată:** `saveParams` este dezactivat implicit prin
`MINMAX_ENGINE_WRITES_ENABLED=false`; UI-ul afișează panoul read-only. Flag-ul devine `true` numai
după instalarea autorizării de mai jos. Citirile pot rămâne disponibile utilizatorilor autentificați.

**Soluție definitivă:** după succesul existentului `validateUserPwd(sessionToken, REFID,
password)`, backend-ul emite un token de aplicație semnat, cu durată absolută de **8 ore**, care
conține identitatea verificată (`sub = REFID`) și rolurile stabilite server-side. Expirarea nu este
glisantă: activitatea utilizatorului nu prelungește sesiunea și nu există refresh token sau
reînnoire transparentă. După 8 ore este obligatoriu un login complet nou.

Token-ul de aplicație se păstrează numai în memoria paginii, nu în `localStorage`, `sessionStorage`
sau alt mecanism restaurabil. Orice reload/reinițializare a paginii pierde sesiunea de aplicație și
trece obligatoriu prin fluxul de login, chiar dacă intervalul de 8 ore nu a expirat încă și în
`sessionStorage` mai există un token S1. Token-ul S1 nu este dovadă suficientă de autentificare sau
autorizare în aplicație și nu poate restaura direct sesiunea MIN/MAX.

Nu se acceptă un REFID sau rol trimis ulterior de browser ca dovadă. Serviciul MIN/MAX primește
hook `authenticate` pe toate metodele, rol `minmax.read` pentru citiri și `minmax.edit` pentru
`saveParams`; lista editorilor vine din configurație server-side sau dintr-o tabelă administrată,
nu din JavaScript-ul public. Token-ul S1 rămâne separat și este folosit doar ca `clientID` pentru
transportul WSMCP.

**Decis 07.09.2026 (alternativa era tabela administrată):** sursa rolurilor este **configurația
server-side** — `minmaxEngine.readers` / `minmaxEngine.editors`, suprascrise prin
`MINMAX_ENGINE_READERS` / `MINMAX_ENGINE_EDITORS`. Motivul decisiv nu este comoditatea, ci că
singurul canal de scriere al aplicației în baza S1 este `execSql` cu cheia `ALLOW_WRITE=1`, limitat
de whitelist-ul de tabele; o tabelă ACL administrabilă din aplicație ar trebui adăugată în acel
whitelist, iar atunci exact canalul protejat de `minmax.edit` și-ar putea acorda singur
`minmax.edit`. Implicit `editors: []` (fail-closed) și `readers: "*"` (orice utilizator autentificat
contra S1); `minmax.edit` include `minmax.read`. Tot lookup-ul stă într-un singur `resolveRoles(refid)`,
astfel încât înlocuirea cu o tabelă administrată să rămână o schimbare într-un fișier.

Whitelist-ul celor patru tabele și cheia dedicată `ALLOW_WRITE=1` rămân obligatorii: autorizarea
utilizatorului și limitarea capabilității SQL sunt controale independente. Se adaugă audit pentru
save cu REFID, timestamp și cheile logice modificate, fără valori secrete.

**Acceptanță:** socket anonim → 401; utilizator cu `minmax.read` → citiri permise și save → 403;
utilizator cu `minmax.edit` → save permis; REFID falsificat în payload nu schimbă identitatea din
token; flag-ul de producție oprește scrierea indiferent de rol. Un token emis acum este respins
după exact 8 ore și nu își modifică expirarea prin activitate. Reload-ul paginii, inclusiv înainte
de expirare, deschide login-ul și nu poate recupera sesiunea din token-ul S1 sau din browser

**DEVIERE TEMPORARĂ 08.09.2026 (decizie utilizator, „deocamdata"):** `editors` a fost comutat de la
`[]` (fail-closed) la `"*"` — orice REFID autentificat contra S1 primește acum `minmax.edit`, nu
doar `minmax.read`. Motivul este validarea live a poarții §12.15 (salvare + read-back, simulare de
rollback) fără a administra încă o listă de editori reali. Rămâne o relaxare deliberată a
raționamentului de mai sus, nu o revizuire a lui — de restrâns la o listă explicită (sau revenit la
`[]`) înainte de a considera Faza 5 utilizabilă de beneficiar, nu doar de echipa de dezvoltare.
storage; numai un login reușit emite o sesiune de aplicație nouă.

### 12.9. Datele se încarcă la prima activare a tabului, nu la pornirea aplicației

**Soluție:** `connectedCallback()` al containerului nu mai face fetch. Handler-ul tabului
„MIN/MAX Engine" apelează o metodă idempotentă `activate()`, care la prima activare pornește
`history`, `params`, `results` și `groupAbc`; apelurile ulterioare doar afișează starea existentă.
Butonul „Reîncarcă"/refresh poate forța explicit o nouă încărcare. Componenta group ABC nu mai
lansează independent fetch din `_subscribeToStore()`, pentru ca toate apelurile inițiale să aibă
un singur proprietar.

`activate()` păstrează aceeași promisiune cât timp inițializarea este în curs, astfel încât două
click-uri rapide pe tab să nu dubleze request-urile. Dacă inițializarea eșuează, starea permite retry
la următoarea activare sau prin refresh.

**Acceptanță:** încărcarea aplicației fără deschiderea tabului produce zero apeluri
`minmax-engine`; prima activare produce exact setul planificat; revenirea în tab nu repetă apelurile;
refresh-ul le repetă o singură dată.

### 12.10. RUNID-ul rezolvat se cache-uiește pe aceeași cheie ca `COUNT(*)`

**Constatare:** `results()` și `groupAbc()` apelează `_resolveRunId()` la **fiecare** invocare, deci
o simplă schimbare de pagină costă trei apeluri S1: rezolvarea sesiunii, `COUNT(*)` și datele. La
încărcarea inițială, containerul lansează `results()` și `groupAbc()` în paralel, deci sesiunea se
rezolvă de două ori pentru același RUNID.

**Soluție:** RUNID-ul rezolvat se memorează pe aceeași cheie de populație introdusă la §12.6, alături
de total. Paginarea și sortarea îl refolosesc; schimbarea filtrelor, a sesiunii sau refresh-ul
explicit îl invalidează. În modul „sesiunea curentă", refresh-ul rerulează `ESTE_CURENT` conform
§12.6 — regula rămâne unică pentru ambele valori cache-uite.

**Acceptanță:** test de store care numără apelurile: paginile 2/3 nu declanșează nici rezolvare, nici
count; încărcarea inițială rezolvă sesiunea o singură dată, deși două fluxuri o cer.

### 12.11. `groupAbc()` trebuie să întoarcă `total` sau să nu-l afișeze

**Constatare:** serviciul nu calculează niciodată `total` pentru `CCCMINMAXGRP`, deci
`state.groupAbc.total` rămâne `null` permanent: antetul „N rânduri" este mereu gol, iar butonul
„Urmator" se bazează pe euristica `rows.length < pageSize`, care ascunde ultima pagină exact plină.

**Soluție:** se extinde contractul `withTotal` din §12.6 și la `groupAbc()`, cu aceeași regulă de
invalidare, iar `SET_GROUP_ABC_RESULTS` primește totalul. Paginarea folosește apoi `totalPages`, ca
în tabela de rezultate. Dacă totalul nu se implementează, se elimină atât afișajul, cât și euristica.

**Acceptanță:** antetul group ABC arată același număr ca un `COUNT(*)` rulat direct pe filtrele
curente; „Urmator" este dezactivat pe ultima pagină chiar când aceasta are exact `pageSize` rânduri.

### 12.12. `codeLike` trebuie să escapeze wildcard-urile `LIKE`

**Constatare:** filtrul se compune ca `d.CODE LIKE :N` cu valoarea `input + '%'`. Valoarea este
legată ca parametru, deci nu există injecție SQL, dar `%`, `_` și `[` introduse de utilizator sunt
interpretate ca wildcard-uri: filtrul returnează rânduri care nu corespund prefixului cerut și poate
forța un scan.

**Soluție:** se escapează `%`, `_` și `[` în valoarea utilizatorului și se adaugă
`ESCAPE '\'` la clauză. Prefixul `%` final rămâne adăugat de server, nu de client.

**Acceptanță:** test unitar pentru un cod care conține `%` și unul care conține `_`; ambele trebuie
tratate literal.

### 12.13. `explain()` trebuie să valideze sesiunea, nu doar să o caste la întreg

**Constatare:** `explain()` face `sqlInt(data.runId)` și interoghează direct, fără `_resolveRunId()`.
Acceptă deci orice RUNID, inclusiv o sesiune `OPEN` sau `ERROR`, contrazicând regula din §5/§11 după
care sesiunea se validează server-side.

**Soluție:** `explain()` trece prin aceeași validare ca `results()`. Nu este blocant — calea este
read-only — dar elimină o cale prin care UI-ul poate afișa numere dintr-o sesiune neîncheiată.

**Acceptanță:** test care cere `explain` pe un RUNID cu `SESSION_STATUS <> 'DONE'` și primește
`RUN_NOT_READY`.

### 12.14. Testele trebuie să acopere interpretarea răspunsului, nu doar SQL-ul generat

**Constatare:** cele 27 de teste existente validează aproape exclusiv **SQL-ul emis** (whitelist,
`STRING_SPLIT`, plafoane, clamping). De aceea §12.1 a putut trece nedetectat: nu există niciun test
pe *forma răspunsului*. Similar, testul „un singur batch atomic" pentru `saveParams` nu numără
parametrii, ceea ce a lăsat §12.2 invizibil.

**Soluție:** fiecare metodă a serviciului primește cel puțin un test pe răspuns (succes și eșec), iar
testele de scriere afirmă explicit numărul de parametri poziționali, nu doar structura. Regula
devine parte din poarta de acceptanță: o remediere nu se consideră terminată dacă testul ei verifică
doar cererea.

**Acceptanță:** suita conține, pentru fiecare metodă, o pereche răspuns-valid / răspuns-invalid; niciun
test de scriere nouă nu trece fără o aserțiune pe numărul de parametri.

### 12.15. Ordinea implementării și poarta de acceptanță

0. **Kill-switch-ul de scriere (`MINMAX_ENGINE_WRITES_ENABLED=false`) intră primul**, separat de
   restul §12.8. Motiv: pașii 1 și 2 fac scrierea să funcționeze corect și pe matricea completă, iar
   serviciul este astăzi complet neautentificat (`around: { all: [] }`). A repara scrierea înaintea
   opririi ei ar deschide o fereastră în care oricine poate salva parametri.
1. Remedieri 12.1 + 12.2 împreună: contractul tranzacțional și payload-ul JSON nu se separă.
2. Remedieri 12.3 + 12.4: defectele live care pot afișa eroare sau configurație falsă.
3. Remedieri 12.5, 12.12, 12.13: completitudinea și corectitudinea filtrelor și a drill-down-ului.
4. Remedieri 12.6 + 12.10 + 12.11 împreună: costul paginării, cache-ul de populație și totalul
   group ABC folosesc aceeași cheie de invalidare, deci se proiectează o singură dată.
5. Remedierea 12.7: concurența din store.
6. Remedierea 12.8 completă: autorizarea; write flag rămâne oprit până la finalizarea ei.
7. Remedierea 12.9: lazy activation, apoi măsurarea sortărilor și a paginării.

Regula din 12.14 se aplică transversal, la fiecare pas, nu ca etapă separată.

Faza 5 poate fi declarată acceptată numai după: suită unit/component verde, retestarea live a
sortărilor și selectoarelor, o salvare controlată urmată de read-back, o simulare de rollback și
confirmarea că utilizatorul read-only primește 403 la `saveParams`.

Aceste condiții sunt însă doar **precondiții tehnice**. Poarta reală către Faza 4 este validarea
numerică a rezultatelor — invariante pe toată populația plus recalcul manual pe un eșantion
stratificat și înghețat — urmată de confirmarea beneficiarului pe formule, nu doar pe cifre. Nu poate
începe înainte de remedierile 12.3, 12.4, 12.5 și 12.13, pentru că fiecare dintre ele introduce bias
sau împiedică navigarea sistematică prin date. Pașii concreți sunt în
[FAZA5_REMEDIERI_PLAN.md](FAZA5_REMEDIERI_PLAN.md) §„Pasul 8".
