# MIN/MAX Engine v5 — Model de domeniu

> Fapte durabile despre arhitectura motorului MIN/MAX. Nu se editează cu un log datat per sesiune —
> secțiunile se rescriu in-place când o înțelegere se schimbă. Pentru starea sesiunii curente, vezi
> `.copilot/context/current-focus.md`.

## Cadență și sesiuni

- **Rularea este LUNARĂ** (confirmat client 03.09.2026), acoperă fiecare filială + agregatul HQ.
  Câțiva parametri se ajustează per rulare, apoi rezultatul se îngheață până luna următoare. Nu
  există tiparul „reclasifici rar / recalculezi zilnic" — performanța per sesiune (~2 min) e
  irelevantă, iar storage-ul pentru ~20 de sesiuni păstrate nu e o problemă.
- **`RUNID` = sesiune de calcul imutabilă.** `sp_MinMaxEngine_StartRun` o deschide
  (`SESSION_STATUS='OPEN'`, `SCOPE` ∈ `FULL`/`SKU`/`GROUP`); fazele scriu doar în sesiuni `OPEN`;
  `sp_MinMaxEngine_FinishRun` o închide și mută `ESTE_CURENT` — doar pe sesiuni `FULL` complete.
  **Recalcularea înseamnă sesiune nouă, nu rescriere** — ramurile de re-rulare au fost eliminate din
  `Classify`/`ClassifyGroup`, zero `DELETE` pe tabele persistate. Fără scenarii what-if (decizie de
  business). Risc real: coerența parametrilor *în interiorul* unei sesiuni — de-asta `runEngine`
  deschide sincron sesiunea prin endpoint-ul AJS `startRun`, apoi **așteaptă** endpoint-ul AJS
  `runPhases`, care sub arhitectura SQL Server Agent doar validează sesiunea și pornește jobul
  companiei (`msdb.dbo.sp_start_job`), în milisecunde — nu mai e un apel fire-and-forget de ~2
  minute. Execuția reală (`Classify → ClassifyGroup → Compute → FinishRun`) rulează în jobul Agent,
  ca `dbo.sp_MinMaxEngine_RunPhases @Company`; browserul urmărește starea persistentă prin
  `history()`, la fel ca înainte.
- **Atribuirea vânzărilor se decide per RUNID.** Panoul de rulare oferă `CLIENT` (`TRDBRANCH`),
  `DOC` (`FINDOC.BRANCH`) și `AGENT` (`PRSN.BRANCH`). `StartRun` validează alegerea și o salvează
  imediat în `PARAMSJSON`; `Classify` și `ClassifyGroup` citesc snapshot-ul sesiunii și îl transmit
  explicit către `ufn_MinMaxSalesLines`, deci schimbarea ulterioară a parametrului global nu poate
  altera rularea deschisă.
- **Estimarea de ~2 minute pentru o sesiune nu este o limită operațională garantată.** La prima
  lansare completă din UI, `RUNID=6` a rămas `OPEN/RUNNING` deoarece `runPhases` a primit de la S1
  `Ole Error 80040E31: Query timeout expired`. Sesiunea a fost închisă explicit prin `AbandonRun`, iar
  `RUNID=5` a rămas `DONE` și `ESTE_CURENT=1`; o sesiune eșuată nu se reia prin același `RUNID`.
- **Cauza confirmată (08.09.2026): AJS `X.RUNSQL`/`X.GETSQLDATASET` au un ADO CommandTimeout fix de
  60 secunde**, la nivelul runtime-ului S1 — nu e configurabil din cod (niciun apel din acest repo nu
  expune un parametru de timeout). Reprodus izolat, cu un script AJS throwaway (`WAITFOR DELAY`): 45s
  reușește, 90s cerute eșuează la exact 60009ms, cu același text de eroare ca `RUNID=6`.
  `sp_MinMaxEngine_Classify` are nevoie de ~90-93s pe date de producție (măsurat pe `RUNID=5`, rulat
  manual în dbexplorer, care nu are acest plafon) — deci depășește mereu cele 60s când rulează *prin*
  `X.RUNSQL`. **Remediere aleasă: SQL Server Agent, nu spargerea lui `Classify` în batch-uri.**
  Executarea fazelor grele s-a mutat complet în afara procesului care răspunde la request-ul AJS:
  `dbo.sp_MinMaxEngine_RunPhases @Company` rulează ca job Agent (creat/aliniat idempotent de
  `dbo.sp_MinMaxEngine_EnsureAgentJob`, pornit de `runPhases` via `sp_start_job`), deci nu trece
  niciodată prin ADO și nu are niciun plafon de 60s. Alternativa evaluată — spargerea lui `Classify`
  în 2-3 batch-uri `X.RUNSQL` secvențiale sub 60s, folosind faptul confirmat că un `#temp` supraviețuiește
  peste apeluri separate în aceeași invocare AJS — a fost respinsă: ar fi cerut o restructurare
  fragilă a unei proceduri de producție doar ca să ocolească o limită de transport, în timp ce
  SQL Server Agent e infrastructură deja disponibilă (Agent rulează, login AJS e `sa`/sysadmin) și
  păstrează procedurile de fază neschimbate ca formă.

- **O singură sesiune `OPEN` per companie.** `StartRun` verifică sub `UPDLOCK, HOLDLOCK` și aruncă
  `50039` înainte de insert; UI-ul blochează dublu-click-ul, iar backend-ul traduce conflictul într-o
  stare „deja în curs”. O rulare eșuată rămâne descriptibilă și se închide explicit cu
  `AbandonRun`; nu există abandon automat după timeout.
- **Rezoluția „sesiune curentă" e mereu `ESTE_CURENT=1 AND SCOPE='FULL' AND SESSION_STATUS='DONE'
  AND COMPUTE_STATUS='DONE'`, niciodată `MAX(RUNID)`.** Precedent de evitat: `#LatestAbcData` din
  `reumplere/sp_GetMtrlsDat.sql` ia `MAX(DATACALCUL)` per rând și compune un colaj din rulări
  diferite.
- **`sp_MinMaxEngine_Prepare` NU e o fază de pipeline** — propriul antet spune „același pipeline ca
  Classify, oprit înainte de clasificare"; n-are `@Persist`, nu scrie în niciun `CCC*`, nimic n-o
  consumă. E doar oracolul de validare din Faza 1b; cei ~180s ai ei nu intră în costul unei sesiuni.
- **Codurile `THROW` alocate:** `50004/50007/50008` Classify sesiune, `50005/50006/50015`
  ClassifyGroup, `50017` Compute sesiune, `50030-50032` StartRun, `50033-50038` FinishRun,
  `50020-50024` rezervate pentru Faza 4 (`applyToErp`), `50039-50044` ciclul de viață
  (StartRun/AbandonRun/PurgeRun, FAZA6_CONTRACT.md §9), `50045-50051` arhitectura SQL Server Agent,
  `50052` modul de atribuire al vânzărilor invalid
  (job/setup lipsă, Agent oprit, sesiune OPEN absentă/ambiguă, runner activ, launch eșuat,
  readiness neverificabil, setup refuzat cât jobul rulează — detaliat în
  FAZA6_CONTRACT.md §4.1/§9).
- **`AZI` rămâne pe rândurile copil**, antetul rulării nu stochează un `AZI` autoritar (Opțiunea A,
  confirmată). Fereastra de analiză vine din `MAX(TRNDATE)` pe date vii, deci populația poate crește
  în aceeași zi — **numărul de rânduri nu e criteriu de acceptanță**; se verifică invariantele
  (`TOTAL_ROWS = DISTINCT_ITEMS × DISTINCT_BRANCHES`, `DISTINCT_BRANCHES = 14`, `HQ_ROWS =
  DISTINCT_ITEMS`, controale la zero).

## Modelul de operare — centrul de greutate e sesiunea curentă

> Formulat explicit 08.09.2026, după ce o dezbatere despre istoric a arătat că designul începuse să
> graviteze în jurul păstrării trecutului. **Nu acolo e valoarea.**

**Ciclul real:** rulezi sesiunea → evaluezi → ajustezi parametrii → re-rulezi → când rezultatele sunt
mulțumitoare, le scrii în ERP pentru a fi folosite în achiziție. Sesiunea curentă, **reiterată până
la satisfacție**, este produsul. Istoricul e un produs secundar.

Consecințe de proiectare care decurg direct:

- `explain` are sens **doar pe sesiunea curentă** — acolo se ia decizia.
- `CCCMINMAXDET` e **memorie de lucru**, nu arhivă.
- Parametrii și randamentul sunt **memorie de lungă durată**, la cost neglijabil.

**Corecție de cerință (08.09.2026):** mecanismul `explain` și wiki-ul de transparență **nu au fost
cerute de client** — sunt inițiativa echipei, ca beneficiarul să poată verifica în loc să ne creadă
pe cuvânt. Cerința clientului este **calculul MIN/MAX**. Nici istoricul nu a fost cerut. Distincția
contează: un mecanism de construire a încrederii are valoare mare devreme și descrescătoare pe măsură
ce încrederea se așază, deci nu are nevoie de permanență — spre deosebire de o cerință de audit.

## Retenția sesiunilor

Cost măsurat pe date reale (08.09.2026): **~730 MB per sesiune completă**, din care `CCCMINMAXDET`
reprezintă 96% (~700 MB / 706.734 rânduri). Antetul `CCCMINMAXRUN` costă ~7 KB.

| Strat | Retenție | Rol |
|---|---|---|
| `CCCMINMAXRUN` + `PARAMSJSON` | pentru totdeauna | *ce am setat* |
| rezumat per sesiune *(electiv, de construit)* | pentru totdeauna | *ce am obținut* — bucla de învățare |
| `CCCMINMAXAPPLY` (Faza 4) | pentru totdeauna | *ce am aplicat*, la nivel de rând |
| `CCCMINMAXDET` | **curentă + precedenta** | `explain` + comparația dinaintea apply-ului |
| `CCCMINMAXWEEK` / `WINSOR` | **doar curenta** | substratul lui `explain` |

Regim staționar ~1,5 GB, aproape plat, plus ~100 MB/an din auditul de apply. Pentru comparație, 42 de
sesiuni păstrate integral ar însemna ~30 GB într-o bază ERP de producție partajată, unde costul real
e fereastra de backup, nu discul.

**De ce `DET` la 2 și nu la 1:** când rulezi sesiunea nouă, ai nevoie de cea veche ca să vezi ce s-a
mișcat înainte de a decide dacă aplici. Purjarea la `FinishRun` ar șterge reperul exact când e cerut.
Regula se auto-întreține într-o buclă de reglaj: fiecare rulare o împinge afară pe cea mai veche, dar
toate își păstrează parametrii și randamentul.

`PurgeRun` este mecanismul explicit: refuză sesiunea curentă (`50042`), orice sesiune `OPEN`
(`50043`) și ultimele `RETENTIE_DET_SESIUNI` sesiuni `FULL/DONE` (`50044`), apoi șterge în loturi
numai `WEEK`/`WINSOR`/`DET`. Antetul `RUN` și agregatul `GRP` rămân; nicio fază nu purjează implicit.
Installerul AJS execută `AbandonRun` și `PurgeRun` în batch-uri `X.RUNSQL` separate: SQL Server cere
ca fiecare `CREATE OR ALTER PROCEDURE` să fie primul statement al batch-ului.

**De ce nu „fixăm" sesiunile aplicate:** `CCCMINMAXAPPLY` ([FAZA4_CONTRACT.md](../../new_min_max/FAZA4_CONTRACT.md) §7)
păstrează deja `OLD_*`/`NEW_*`/`ENG_MIN`/`ENG_MAX` per poziție scrisă, cu `RUNID` și autor — ~78.000
rânduri înguste per apply, față de 706.734 late în `DET`. Apply-ul își ține singur dovada.

**ERP nu poate fi arhivă**, deși pare tentant: (1) `MTRBRNLIMITS.REMAINLIMMAX` e o valoare curentă,
suprascrisă la fiecare apply — `CCCZEROMINMAX` stochează `OLD_*` exact din acest motiv, iar
`revertApply` e posibil numai fiindcă reținem noi valorile anterioare; (2) ERP primește două numere
per rând, nu `BUY_QTY`, `CLASA`, derivarea sau indicatorii; (3) **doar 10,4% din rânduri ating
ERP-ul** — măsurat pe RUNID=5: 23.004 din 656.253 rânduri de filială au poziție `MTRBRNLIMITS`, plus
cele 50.481 de HQ care merg în `MTRL`.

## „HQ" și filialele

- **Branch 1000 = stratul de companie, NU o locație fizică.** Persistat în `MTRL`
  (`REMAINLIMMIN`/`REMAINLIMMAX`, `CCCMINAUTOCOMP`/`CCCMAXAUTOCOMP`). Materializarea fizică e
  **București 2200** (50% din stocul național, 26,5% din valoarea vânzărilor 52S). Compania 1001 e
  `Demo S.R.L.` (`ISACTIVE=0`, 0 articole) — nu e depozitul real al HQ. `ESTE_HQ` rămâne pe branch
  1000; mutarea pe 2200 ar elimina din calcul propriile vânzări ale Bucureștiului.
  - **Bug latent corectat (03.09.2026):** eligibilitatea HQ depindea de `WHOUSE` din compania demo
    1001 în `#ActiveBranches` din toate cele trei proceduri (`Classify`/`Prepare`/`ClassifyGroup`).
    Fix deployat live pe toate trei, fără schimbare de rezultat funcțional.
- **Branch list, sursă de adevăr: `WHOUSE.ISACTIVE=1 AND CCCBRANCH IS NOT NULL`** (13 filiale fizice
  + HQ), NU `BRANCH.ISACTIVE` (18, din care 4 sunt moarte: ARAD 2300, VOLUNTARI 2400, MIHAILESTI
  2600, RM VALCEA 2900 — depozite închise, `INCLUS=0` de facto).
- **Filialele închise pierd cerere reală:** 2300/2400/2600/2900 au 7,25 mil RON (5,7% din valoarea
  52S) atribuiți `CLIENT`, dar `#IncludedLines` face `INNER JOIN #ActiveBranches` → dispar din
  ambele agregate. Deschis: reatribuire către filiala care servește azi, sau măcar includere în
  agregatul de companie.

## Performanță / serie săptămânală

- **Seria săptămânală nu se materializează dens.** `#WeeklySeries` ar fi `#Items × 14 filiale × 52`
  ≈ 37M rânduri, din care doar 0,5% observații reale (măsurat). Decizie: agregatele se calculează
  din serie rară; `SIGMA_WK`/`SIGMA_MTH` din momentele de ordin 1-2 cu `n` constant (52/12) —
  rezultat identic cu `STDEV()` pe seria densă (validat la 8 zecimale pe RUNID 3).
  `CCCMINMAXWEEK` (rar, ~350k rânduri/rulare) + `CCCMINMAXWINSOR` (~52,7k) sunt substratul de audit,
  citit de `explainRow`/`sp_MinMaxEngine_Explain`.
- `MTRL.ISACTIVE` nu e un filtru util: doar 12 din 52.700 articole cu vânzări 52S au `ISACTIVE=0`.

## Sursele D1-D3 (Compute)

- **`STOC_QTY`** = `MTRFINDATA.QTY1`, identic cu soldul `MTRBALSHEET` la 8 zecimale.
- **`ORD_FURN`** = `MTRLINES`, `SOSOURCE=1251`, `PENDING=1`, `RESTCATEG=1`, document neanulat,
  cantitate `QTY1-QTY1COV-QTY1CANC`, filială din `WHOUSE.CCCBRANCH`. Coincide cu
  `FNSOGETLINEPEND` pe toate liniile verificate. 25 linii pe depozitul 8002 „BONURI VALORICE" nu au
  `CCCBRANCH` — incluse azi doar în rândul HQ, excluse de pe filiale (deschis: de exclus complet?).
- **`LAST_RECEIPT`** = `MAX(MTRTRN.TRNDATE)` per companie/SKU, `SOSOURCE=1251`, `TPRMS.FLG01=1`;
  lipsă rămâne `NULL`, la fel `DISC_FLAG`.
- Stock per warehouse: `MTRBALSHEET` (`FISCPRD`, `PERIOD`, `IMPQTY1-EXPQTY1`); `MTRSTATS`/
  `MTRWHSTOCK` nu există.

## Versionare AJS

- `S1-MEC/AJS/NewMinMax.js` **nu** e urmărit de repo-ul principal — hardlink către
  `external/MEC/SyncItalia/S1/AJS/NewMinMax.js`, urmărit de submodul. Hardlink-ul propagă conținutul,
  nu commit-ul: orice modificare AJS cere commit în submodul **și** commit de pointer în repo.
- CCC* tables trăiesc în baza S1, create via AJS `setup()` + `X.RUNSQL` (`IF NOT EXISTS ...
  sysobjects`), NU via knex migrations (acelea țintesc baza aplicației Feathers). DDL fiind `IF NOT
  EXISTS`, modificările de coloană merg prin secțiunea ghidată de `INFORMATION_SCHEMA` din
  `00b_persist.sql`.

## Istoric livrare (fazele 0-3, toate deployate și validate live)

- **Faza 0** (`00_params.sql`): `CCCMINMAXPARAMS`/`COV`/`BRANCH`/`TEMPLATE` + seed idempotent.
- **Faza 1a** (`ufn_MinMaxSalesLines`): atribuire linii de vânzare pe filială, mod `CLIENT`.
- **Faza 1b** (`sp_MinMaxEngine_Prepare`): oracol de validare, nu fază de pipeline (vezi mai sus).
- **Faza 2** (`sp_MinMaxEngine_Classify`, per SKU): clasificare ABC-XYZ, `COV_TGT`, `SL`, `SSF`,
  `AVG` ponderat, Pareto. Smoke test pe MTRL 1360919 × 14 filiale — toate valorile teoretice
  confirmate.
- **Faza 2b** (`sp_MinMaxEngine_ClassifyGroup`): același pipeline, agregat pe `MTRGROUP × BRANCH`.
- **Faza 3** (`sp_MinMaxEngine_Compute`): D1-D3 (stoc/comenzi/ultima recepție) → `SAFETY`/`BUF`/
  `CYCLE`/`CAP6`/`ENG_MIN`/`ENG_MAX`/`BUY_QTY` → indicatori (`FLAG_RATIO`, `TREND_PCT`). Smoke test
  pe MTRL 1360919 corect pe toate valorile verificabile manual.
- **Sesiuni persistate** (`RUNID`, `CCCMINMAXRUN`/`DET`/`GRP`/`WEEK`/`WINSOR`): stratul de
  persistență + modelul de sesiune imutabilă (`StartRun`/`FinishRun`) — vezi secțiunea „Cadență și
  sesiuni" mai sus. **`RUNID=5` este sesiunea curentă validată** (07.09.2026): `StartRun → Classify
  → ClassifyGroup → Compute → FinishRun`, toate `DONE`, `706.734 = 50.481 × 14` rânduri,
  `MIN_GT_MAX=0`, `ESTE_CURENT=1`. `RUNID≤4` sunt legacy (`SESSION_STATUS` NULL, înghețate prin
  construcție).
- **Instrumente de sincronizare:** `new_min_max/tools/sync-check.cjs` verifică SQL-ul embedat în AJS
  linie cu linie față de `new_min_max/sql/*.sql` — de rulat după fiecare editare de SQL.
