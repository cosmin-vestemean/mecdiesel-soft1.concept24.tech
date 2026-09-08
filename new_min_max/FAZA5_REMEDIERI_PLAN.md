# Faza 5 — plan de remediere (execuție)

> **Sursa de adevăr rămâne [FAZA5_CONTRACT.md](FAZA5_CONTRACT.md) §12.** Acest document nu
> redefinește soluțiile, ci le transformă în pași executabili, în ordinea din §12.15. Dacă cele două
> diferă, contractul câștigă.

**Destinatar:** agentul `Implement` (Claude Sonnet 4.6). Pașii marcați altfel se execută cu modelul
indicat — vezi `.github/instructions/model-policy.instructions.md`.

## Reguli care nu se negociază

1. **Nu porni scrierea.** `MINMAX_ENGINE_WRITES_ENABLED` rămâne `false` până la pasul 6 inclusiv.
2. **Nu relaxa garda SQL.** Whitelist-ul de tabele și `classifySql()` nu se slăbesc pentru a face un
   statement să treacă; se schimbă statement-ul, nu garda (§12.2).
3. **Fiecare remediere primește un test pe răspuns, nu doar pe cererea emisă** (§12.14). Un pas nu e
   terminat dacă testul lui verifică doar SQL-ul generat.
4. **Un pas = un commit.** Nu comasa pași; pașii grupați explicit mai jos (1, 2, 4) sunt deja
   comasările intenționate.
5. Nu porni sesiuni noi în S1 și nu atinge procedurile stocate. Faza 5 e strict UI + serviciu.

## Fișiere atinse

| Fișier | Rol |
|---|---|
| `src/services/minmax-engine/minmax-engine.class.js` | compunere SQL, transport, `saveParams` |
| `src/services/minmax-engine/sql-guard.js` | clasificare verb + whitelist tabele |
| `src/services/minmax-engine/minmax-engine.js` | înregistrare serviciu + hooks (autorizare) |
| `public/stores/minmax-engine-store.js` | stare, orchestrare apeluri, secvențiere |
| `public/components/minmax-engine/*.js` | selectoare, filtre, activare lazy |
| `test/services/minmax-engine/*.test.js` | suita unit |

---

## Pasul 0 — kill-switch de scriere *(model: bază / Haiku — agentul `Mechanical`)*

- [x] Adaugă flag-ul `minmaxEngine.writesEnabled` (env `MINMAX_ENGINE_WRITES_ENABLED`), **implicit
      `false`**, în configurația serviciului.
- [x] `saveParams()` aruncă `Forbidden` când flag-ul e oprit, **înainte** de orice validare de payload.
- [x] `params-panel` afișează starea read-only și dezactivează „Salveaza" pe baza flag-ului expus de
      serviciu, nu a unei constante din browser.

**Test:** cu flag-ul oprit, `saveParams` respinge chiar și un payload perfect valid.
**Definiție de terminat:** niciun apel de scriere nu ajunge la S1 în starea implicită.

## Pasul 1 — §12.1 + §12.2: contract tranzacțional + payload JSON *(model: Sonnet)*

- [x] `_execStatements()` interpretează rândul de stare din `response.data`: dacă `__ok`/`__OK` este
      `0`, aruncă o eroare cu `failedStep`, `errNum`, `errMsg`. Absența unui rezultat valid este
      eroare, nu succes.
- [x] `saveParams()` nu mai întoarce `success: true` necondiționat.
- [x] Rescrie cele trei colecții pe `OPENJSON(:1)`, cu tabela **imediat după `UPDATE`** (fără alias —
      vezi §12.2, altfel `referencedTable()` extrage aliasul și blochează statement-ul).
- [x] Validează și limitează numărul de rânduri din fiecare colecție **înainte** de a compune SQL.
- [x] `loadParams()` capătă un mod care propagă eroarea; store-ul golește drafturile doar după
      tranzacție reușită **și** read-back care coincide cu payload-ul normalizat.
- [x] `params-panel` nu mai șterge drafturile pe tranziția `saving → false`, ci pe confirmarea
      explicită întoarsă de store.

**Teste:** `{success:true,data:[{__ok:0,...}]}` respinge promisiunea; `__ok:1` fixează forma de
succes; 24 parametri + 33 COV + 18 filiale într-un singur save produc **cel mult 4 parametri
poziționali** și o singură tranzacție; drafturile supraviețuiesc rollback-ului și eșecului de recitire.
**Verificare live:** `OPENJSON(:1)` prin canalul WSMCP, înainte de a activa scrierea în UI.

## Pasul 2 — §12.3 + §12.4: sortare și selectoare *(model: Sonnet)*

- [x] `buildOrderBy()` primește tie-break-ul ca listă de identificatori validați și elimină coloana
      deja aleasă. Direcția se aplică doar coloanei principale; tie-break-ul rămâne `ASC`.
- [x] Înlocuiește `.value` pe `<select>` cu binding pe proprietate `.selected` per `<option>`
      (params-panel `MARIME`, page size în results-table și group-abc). **Nu** `?selected` — scrie
      atributul și se rupe după prima interacțiune (§12.4).

**Teste:** SQL exact pentru coliziunea cu fiecare coloană din tie-break (`branch`, `mtrl`, `engMax`;
`branch`, `mtrgroup` la group ABC) — nicio expresie repetată în `ORDER BY`; test de componentă cu
`MARE/MEDIU/MIC` și 50/100/200/500, inclusiv un re-render după interacțiunea utilizatorului.
**Verificare live:** click pe toate antetele sortabile; toate cele 18 filiale afișează `MARIME`.

## Pasul 3 — §12.5 + §12.12 + §12.13: corectitudinea filtrelor și a drill-down-ului *(model: Sonnet)*

- [x] `CLASA_VALUES` (backend) și ambele `CLASA_OPTIONS` (UI) devin cele 11 clase, inclusiv `NOU` și
      `OD`; mulțimea din UI se definește **o singură dată**, într-un modul comun.
- [x] `codeLike` escapează `%`, `_`, `[` și adaugă `ESCAPE`.
- [x] `explain()` trece prin `_resolveRunId()`, ca `results()`.

**Teste:** `clasa=['NOU','OD']` acceptat de backend și prezent în UI; cod cu `%` și cod cu `_`
tratate literal; `explain` pe o sesiune neîncheiată → `RUN_NOT_READY`.

## Pasul 4 — §12.6 + §12.10 + §12.11: cheia de populație *(model: Sonnet)*

Se proiectează o singură dată: total, RUNID rezolvat și totalul group ABC folosesc **aceeași** cheie
de invalidare `{resolvedRunId, filters}`. Sortarea și pagina nu fac parte din cheie.

- [x] `loadResults()` primește `withTotal` explicit: `true` la încărcare inițială, schimbare/reset de
      filtre, schimbare de sesiune și refresh; `false` la paginare, sortare și page size.
- [x] Reducer-ul păstrează totalul existent când răspunsul nu conține `total`.
- [x] RUNID-ul rezolvat se cache-uiește pe aceeași cheie; refresh-ul în modul „sesiunea curentă"
      rerulează `ESTE_CURENT` și invalidează ambele valori dacă RUNID-ul diferă.
- [x] `groupAbc()` întoarce `total` sub același contract; paginarea group ABC folosește `totalPages`
      în locul euristicii `rows.length < pageSize`.

**Teste:** paginile 2/3 și sortarea nu produc nici count, nici rezolvare de sesiune; schimbarea unui
filtru produce exact un count; încărcarea inițială rezolvă sesiunea o singură dată deși două fluxuri
o cer; „Urmator" e dezactivat pe ultima pagină plină exact.
**Măsurare:** latența unei paginări înainte și după.

> **Notă de scop (implementare 07.09.2026):** cache-ul pe cheie de populație rezolvă „paginile 2/3
> nu cer rezolvare/count" și „schimbarea unui filtru cere exact un count" — verificat prin teste de
> store. Clauza „încărcarea inițială rezolvă sesiunea o singură dată deși două fluxuri o cer" rămâne
> **doar parțial acoperită**: `results()` și `groupAbc()` au cache-uri separate (filtre diferite) și
> nu împrumută rezolvarea una de la alta la primul apel — asta cere un proprietar unic al apelurilor
> inițiale, care e exact scopul Pasului 7 (§12.9, `activate()`). Verificarea live din 08.09.2026 a
> confirmat câte un singur apel pentru `history`, `params`, `results` și `groupAbc` la prima activare
> și zero apeluri suplimentare la revenirea în tab.

## Pasul 5 — §12.7: concurență în store *(model: Sonnet)*

- [x] Câte un request sequence monoton pentru `results`, `groupAbc`, `explain`, `history`, `params`.
- [x] Dispatch (date, eroare, `loading=false`) numai dacă apelul e încă ultimul din fluxul său.
- [x] Închiderea drawer-ului incrementează secvența `explain`.
- [x] Salvarea are flux separat; butonul rămâne dezactivat până la tranzacție **plus** recitire.

**Teste:** promisiuni controlate rezolvate în ordine inversă (pagina 2/3, două articole, două seturi
group ABC) — numai ultima cerere modifică starea.

## Pasul 6 — §12.8: autorizare completă *(model: Opus pentru decizie, Sonnet pentru implementare)*

**Decizie luată 07.09.2026** *(Opus, context mic)*: rolurile vin din **configurație server-side**,
nu dintr-o tabelă administrată — vezi motivarea în [FAZA5_CONTRACT.md](FAZA5_CONTRACT.md) §12.8.
Forma: `minmaxEngine.readers` / `minmaxEngine.editors` în `config/default.json`, suprascrise prin
`MINMAX_ENGINE_READERS` / `MINMAX_ENGINE_EDITORS` (CSV de REFID); implicit `editors: []`,
`readers: "*"`; `minmax.edit` include `minmax.read`; comparația REFID se face ca `String`.

- [x] Tot lookup-ul de roluri într-un singur `resolveRoles(refid)` (`src/services/minmax-engine/roles.js`),
      singurul loc care știe de unde vine lista.
- [x] Token de aplicație semnat după `validateUserPwd`, `sub = REFID`, **durată absolută 8 ore**, fără
      refresh și fără sliding expiration. Semnare cu `authentication.secret` (`FEATHERS_SECRET`, deja
      mapat setat în `.env` — a fost generat înainte de implementare), prin
      `@feathersjs/authentication` cu `entity: null` + `JWTStrategy`, ca să nu fie nevoie de un
      serviciu `users` local.
- [x] Token păstrat **doar în memoria paginii**; orice reload trece prin login. Token-ul S1 nu poate
      restaura sesiunea de aplicație.
- [x] Hook `authenticate` pe toate metodele; `minmax.read` la citiri, `minmax.edit` la `saveParams`.
- [ ] Audit pentru save: REFID, timestamp, cheile logice modificate — fără valori secrete.
- [ ] Abia acum poate fi comutat `MINMAX_ENGINE_WRITES_ENABLED` pe `true`, deliberat.

**Teste:** socket anonim → 401; `minmax.read` → citiri da, save 403; `minmax.edit` → save permis;
REFID falsificat în payload nu schimbă identitatea; token emis acum e respins după exact 8 ore și nu
își prelungește expirarea prin activitate; reload → login.

## Pasul 7 — §12.9: activare lazy *(model: Sonnet)*

- [x] `connectedCallback()` al containerului nu mai face fetch.
- [x] Handler-ul tabului apelează `activate()` idempotent, care la prima activare pornește `history`,
      `params`, `results`, `groupAbc`; apelurile ulterioare doar afișează.
- [x] `activate()` reține aceeași promisiune cât timp inițializarea e în curs.
- [x] `minmax-group-abc` nu mai lansează fetch din `_subscribeToStore()`.

**Teste:** pornirea aplicației fără deschiderea tabului → zero apeluri `minmax-engine`; prima activare
→ exact setul planificat; revenirea în tab → fără repetare; refresh → o singură repetare.

> **Validare 07.09.2026:** testul de componentă montează containerul înainte de autentificare și
> confirmă zero apeluri; două activări concurente primesc aceeași promisiune și produc exact cele
> patru fluxuri, iar activările ulterioare nu repetă încărcarea. Suita MIN/MAX relevantă: 108 teste
> verzi. Aceasta elimină cererile anonime care lăsau în UI erorile `Not authenticated` înainte de
> login.
>
> **Validare live 08.09.2026:** într-o filă nouă, containerul a rămas neactivat înainte de login și
> nu a afișat `Not authenticated`; după login, prima deschidere a produs exact cele patru fluxuri,
> iar revenirea în tab nu le-a repetat. Reconectarea Socket.IO a păstrat autorizarea, iar
> `loadHistory()` a întors cele 5 sesiuni fără eroare.

## Pasul 8 — validarea numerică a rezultatelor *(nivel A: Sonnet; proiectare + interpretare: Opus)*

Abia acesta este **scopul declarat al Fazei 5**; pașii 0–7 sunt precondiții. Nu poate începe înainte
de pașii 2 și 3, din motive de bias, nu de comoditate: fără §12.5, `CLASA = OD` (680.918 rânduri) și
`CLASA = NOU` (659) nu pot fi selectate deloc, deci orice eșantion ar exclude sistematic cea mai mare
populație; fără §12.4 validezi formula cu parametrul greșit afișat; fără §12.3 nu poți naviga sortat;
fără §12.13 poți face drill-down pe o sesiune neîncheiată.

**Două întrebări distincte, care nu se confundă:**

- *Numărul afișat este numărul calculat, conform formulei documentate?* — răspundem noi, prin
  nivelurile A și B de mai jos.
- *Formula documentată este ce vrea businessul?* — răspunde beneficiarul. Aceasta este poarta către
  Faza 4, nu un rezultat tehnic.

Referință pentru formule și definiții: [minmax-engine-formulas.md](../.copilot/wiki/minmax-engine-formulas.md)
și [minmax-engine-model.md](../.copilot/wiki/minmax-engine-model.md).

### Nivel A — invariante pe toată populația, în SQL

Ieftin, fără UI, fără eșantion; prinde erorile sistematice. Se scrie ca script versionat în
`new_min_max/tools/`, parametrizat pe `RUNID`, rulabil după fiecare sesiune.

**Regula de aur:** invariante, niciodată numere fixe de rânduri. Fereastra vine din `MAX(TRNDATE)` pe
date vii, deci populația crește în aceeași zi (vezi thread-ul `criterii-numerice-nereproductibile`).

- [ ] **Structurale:** `TOTAL_ROWS = DISTINCT_ITEMS × DISTINCT_BRANCHES`; `DISTINCT_BRANCHES = 14`;
      `HQ_ROWS = DISTINCT_ITEMS`.
- [ ] **Ordine și domeniu:** `MIN_GT_MAX = 0` (`ENG_MIN <= ENG_MAX` pe toate rândurile);
      `ENG_MIN >= 0`; `BUY_QTY >= 0`.
- [ ] **Rotunjire la ambalaj:** pentru `N_PACK > 1`,
      `BUY_QTY - FLOOR(BUY_QTY / N_PACK) * N_PACK = 0`. **Nu** folosi `%` — modulo pe `DECIMAL` nu
      există în T-SQL.
- [x] **Plafon HQ:** unde `HQ_CAP_APLICAT = 1`, `ENG_MAX` este exact plafonul; unde este `0`, `ENG_MAX`
      este strict sub plafon. Verificare în ambele sensuri, nu doar implicație.
- [x] **Podea:** `PODEA_APLICATA = 1` apare numai pe filiale cu `ESTE_PODEA = 1` în
      `CCCMINMAXBRANCH`, iar valoarea rezultată respectă podeaua.
- [x] **Consistența clasificării:** pentru `LIFECYCLE = 'STANDARD'`, `CLASA = ABC || XYZ`;
      `CLASA ∈ {NOU, OD}` exact când `LIFECYCLE ∈ {NOU, OD}`. Echivalență, nu incluziune.
- [x] **Warning-uri, ca echivalențe:** `WARN_STOC_MORT ⇔ (ENG_MAX = 0 AND STOC_QTY > 0)`;
      `WARN_STOC_NEG ⇔ (STOC_QTY < 0)`; `WARN_VZ26_ZERO ⇔ (VZ_26S <= 0)`.
- [x] **Coerență `DET` ↔ `GRP`:** fiecare pereche `(BRANCH, MTRGROUP)` din `CCCMINMAXDET` există în
      `CCCMINMAXGRP`, iar `NR_SKU_GRP` egalează numărul distinct de `MTRL` din `DET`.
- [x] **Filiale excluse:** filialele cu `INCLUS = 0` nu produc recomandări de cumpărare *(de confirmat
      ca invariant înainte de a-l impune — nu presupune comportamentul)*.
- [x] **Calibrare `FLAG` — raportare, nu pass/fail:** pe populația curată (`STANDARD/NOU`, cu
      `ERP_MAX`, fără lichidare/blocare/excludere), procentul din banda necritică `0,50–2,00`. Pragul
      acceptat de client este **>80% în bandă**, nu >80% etichetă `OK` strictă.

**Rezultate măsurate 08.09.2026 (`node new_min_max/tools/validate-minmax-invariants.cjs 5`, RUNID=5,
706.734 = 50.481 × 14 rânduri):** toate invariantele PASS cu o singură excepție — `NR_SKU_GRP`.
Calibrare FLAG: 15.115/17.682 = 85,5% în bandă (peste pragul de 80% al clientului).

#### Singura abatere: `NR_SKU_GRP` — defect cosmetic în `ClassifyGroup`, nu întrebare de business

**Confirmarea beneficiarului (08.09.2026) — „filialele inactive și cele cu depozite inactive nu
prezintă interes" — schimbă natura abaterii, nu doar prioritatea ei.** Înainte de confirmare,
discrepanța părea o întrebare deschisă de business („cine are dreptate, `Classify` sau
`ClassifyGroup`?"). După confirmare, `Classify` **este** specificația: eliminarea articolelor ale
căror singure vânzări sunt pe filiale `INCLUS=0` e comportamentul dorit, nu o pierdere. Rămâne un
singur vinovat: `ClassifyGroup` numără o populație pe care businessul a declarat-o în afara
perimetrului.

**Consecință directă:** itemul de business „filialele închise pierd 7,25 mil RON" se **închide** —
nu e o pierdere, e o graniță de perimetru asumată. Vezi
[minmax-engine-open-items.md](../.copilot/wiki/minmax-engine-open-items.md).

**Severitate: cosmetică, dar măsurată, nu presupusă.** Pe cele 559 rânduri de grupă non-HQ
comparabile din `RUNID=5`:

| Câmp | Diferențe față de agregarea `CCCMINMAXDET` |
|---|---|
| `VZ_52S` | **0** |
| `VAL_52S` | **0** |
| `NR_SKU_GRP` | **468** |

Vânzările la nivel de grupă coincid la bănuț, pentru că `#WeeklySeries` face
`LEFT JOIN #GroupWeekly ON gw.BRANCH = b.BRANCH` cu `b` din `#ActiveBranches` — liniile filialelor
excluse pur și simplu nu găsesc pereche și cad. Doar `NR_SKU_GRP` scapă, fiindcă vine din
`#Groups`/`#ItemGroups`, construite din `#SalesLines` **nefiltrat**, și e purtat mai departe prin
`MAX(NR_SKU_GRP)` fără să intre vreodată într-un calcul: `LIFECYCLE` folosește
`SAPT_VZ`/`SAPT_FARA`/`VZ_52S`, `ABC` folosește Pareto pe `VAL_52S`, `XYZ` folosește `CV`.
Contoarele care **chiar** contează — `GRP_ITEM_COUNT` și `GRP_TOTAL_VAL`, care produc
`WARN_GRUPA_MICA` și pragul Pareto — stau în `CCCMINMAXDET` și sunt calculate de `Classify` cu
`COUNT(*) OVER (PARTITION BY BRANCH, MTRGROUP)` peste populația corectă. **Clasificarea ABC per SKU
nu este contaminată.**

**Cosmetic în matematică nu înseamnă cosmetic în încredere.** `NR_SKU_GRP` se afișează în ecranul
group ABC: un utilizator care citește „3.384 SKU în grupă" și apoi face drill-down în 3.321 vede un
număr care nu se reconciliază cu nimic. Într-un proiect al cărui scop declarat include un wiki de
transparență pentru beneficiar, asta e un cost real, chiar dacă nu mișcă niciun MIN/MAX.

**Remedierea nu se face acum:** ar însemna modificarea `sp_MinMaxEngine_ClassifyGroup`, interzisă de
regula #5 („Faza 5 e strict UI + serviciu"). **Nu este „o singură clauză"** — afirmația inițială a
fost greșită: `#IncludedLines` (§5) se construiește **din** `#ItemGroups` și `#Groups` (§3), deci
„`#ItemGroups` peste `#IncludedLines`" ar fi un ciclu. Fixul real cere mutarea blocului
`#ActiveBranches` (§4) înaintea §3 plus rescrierea subinterogării de filtrare, ceea ce inversează și
ordinea `THROW`-urilor (`50002` ajunge înaintea lui `50003`). De verificat înainte de implementare: o
grupă ale cărei articole s-ar vinde exclusiv pe filiale închise ar dispărea complet din `#Groups`, nu
doar și-ar corecta contorul.

> **Corecție a analizei inițiale din această sesiune, păstrată deliberat ca avertisment
> metodologic.** Prima trasare a cauzei a comparat `RUNID=5` (înghețat) cu `ufn_MinMaxSalesLines`
> interogat **live**, și a concluzionat că toate cele 7 articole „fantomă" din eșantion vin de pe
> filiale închise. Fals: 6 din 7 sunt într-adevăr pe 2300/2400, dar `MTRL 2747063` vinde pe **2200 și
> 2700, ambele incluse**, cu `TRNDATE = 2026-09-07` — exact `AZI`-ul rulării. Este o vânzare intrată
> în fereastră *după* ce rularea se încheiase, adică fix thread-ul
> `criterii-numerice-nereproductibile` manifestându-se în chiar analiza care îl invoca. Invarianta în
> sine rămâne curată (compară `GRP` cu `DET`, ambele din `RUNID=5`); doar *explicația* fusese
> contaminată. **Regulă de reținut: când explici o abatere dintr-o rulare înghețată, folosește doar
> stare persistată; orice interogare live introduce drift în raționament, nu doar în cifre.**

**Definiție de terminat pentru nivel A — ÎNDEPLINITĂ:** scriptul rulează pe `RUNID = 5`, fiecare
invariant are un verdict explicit, iar singura abatere este explicată, cuantificată și limitată la un
câmp necalculat, cu remedierea programată în afara perimetrului Fazei 5.

### Nivel B — recalcul manual pe eșantion stratificat

20–40 de rânduri, recalculate cu creionul din drawer-ul `explain` (§6), care expune seria de 52 de
săptămâni, statisticile winsor și `PARAMSJSON`-ul rulării — exact substratul necesar refacerii
formulei.

**Eșantionul nu este aleator.** Pe ~50.481 SKU × 14 filiale, majoritatea covârșitoare a rândurilor
este `FARA_REFERINTA` (95,6% măsurat pe RUNID 4), deci eșantionarea uniformă ar cheltui efortul uman
pe cazuri care nu exercită formula. Se construiește pe patru criterii:

- [x] **Stratificare pe axele care schimbă formula:** produsul `CLASA` (11) × `MARIME` (3), plus
      `LIFECYCLE`, `ESTE_HQ` vs. non-HQ, `HQ_CAP_APLICAT`, `PODEA_APLICATA`. Câteva rânduri per celulă
      relevantă, **nu** proporțional cu populația.
- [x] **Ramuri de cod, deliberat:** câte un caz în care s-a activat winsorizarea, rotunjirea la
      `N_PACK`, `ORD_FURN > 0`, stoc negativ, `VZ_26S = 0` (sentinela `9999`), grupă mică,
      discontinuat / lichidare / blocat / exclus. Fiecare ramură care poate fi luată se ia cel puțin o
      dată.
- [x] **Impact material:** top N după `VAL_52S` și după `BUY_QTY` — acolo o eroare costă bani și acolo
      Faza 4 va scrie în ERP.
- [x] **Eșantion înghețat, nu regenerat:** triplete `(RUNID, BRANCH, MTRL)` fixate o dată și
      versionate în `new_min_max/analiza/`. Fără asta nu poți compara „înainte/după" un fix.

Înghețat 08.09.2026 în `analiza/esantion_minmax_run5.json`: 31 triplete unice, 22 celule relevante
`CLASA × MARIME` (`MARIME=MEDIU` nu există în RUNID=5), 35 criterii, lifecycle
`STANDARD/NOU/OD`, 19 HQ + 12 non-HQ și serii explicite de câte 52 săptămâni. Ramura
`N_PACK > 1` este indisponibilă (`N_PACK=1` pe toate rândurile). Recalculul independent al celor
13 câmpuri din lanțul `SAFETY → BUY_QTY` este 31/31 PASS atât în generatorul Node, cât și într-o
verificare separată Python `Decimal`. Compararea manuală cu valorile afișate în drawer rămâne de
făcut, deci definiția de terminat și poarta de mai jos nu se bifează încă.

Pentru fiecare rând se consemnează: valoarea așteptată (calculată manual), valoarea afișată,
diferența și verdictul. O diferență neexplicată blochează poarta.

**Definiție de terminat pentru nivel B:** fiecare celulă de stratificare și fiecare ramură din listă
au cel puțin un rând verificat, iar toate diferențele sunt zero sau explicate.

---

## Poarta de acceptanță (§12.15)

Faza 5 se declară acceptată numai după toate cele de mai jos, verificate într-o **sesiune nouă de
review, cu context mic** *(model: Opus, agentul `Review`)*:

- [ ] suită unit/component verde;
- [x] retestare live a sortărilor și a selectoarelor (08.09.2026: toate antetele sortabile,
      page size rezultate/group ABC și `MARIME` verificate cu rerandare);
- [ ] o salvare controlată urmată de read-back;
- [ ] o simulare de rollback care **nu** raportează succes;
- [ ] utilizator read-only primește 403 la `saveParams`;
- [x] pasul 8 nivel A: toate invariantele au verdict, abaterile sunt corectate sau documentate
      (08.09.2026: 8/9 PASS + calibrare FLAG 85,5%; `NR_SKU_GRP` documentat ca defect cosmetic în
      `ClassifyGroup`, fără efect asupra vreunei valori calculate);
- [ ] pasul 8 nivel B: eșantionul înghețat e verificat, fără diferențe neexplicate;
- [ ] **confirmarea beneficiarului pe formule**, nu doar pe cifre — este întrebarea a doua din pasul 8
      și singura care deschide Faza 4.

## După finalizare

- Actualizează `.copilot/context/current-focus.md` cu noul pas următor.
- Faza 4 (`applyToErp`, [FAZA4_CONTRACT.md](FAZA4_CONTRACT.md)) rămâne deliberat amânată până la
  trecerea acestei porți.
