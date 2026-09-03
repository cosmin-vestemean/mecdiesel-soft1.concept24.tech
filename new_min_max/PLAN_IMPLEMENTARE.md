# Plan de implementare — MIN/MAX Engine v5 HYBRID

**Data:** 13.08.2026 · **Revizuit:** 14.08.2026 (iterații de feedback client)
**Sursă cerințe, în ordinea autorității:** [SUMAR_TEORETIC_CONFIRMARE.md](SUMAR_TEORETIC_CONFIRMARE.md) (confirmările clientului din 14.08.2026 — **prevalează**), [analiza/SINTEZA_FINALA.md](analiza/SINTEZA_FINALA.md), [analiza/analiza_clarificari_primite.md](analiza/analiza_clarificari_primite.md)
**Scop:** implementarea în ERP (SoftOne / MSSQL) a motorului MIN/MAX v5 HYBRID, incluzând clasificarea nouă ABC-XYZ per grupă de produs, expusă printr-o aplicație nouă în secțiunea „Achizitii".

> **Notă de revizie (14.08.2026).** Planul a fost aliniat la confirmările clientului consemnate în [SUMAR_TEORETIC_CONFIRMARE.md](SUMAR_TEORETIC_CONFIRMARE.md). Modificări cu impact asupra implementării: ordinea de pre-procesare este `winsorizare → netting` (I11), nu invers; `PRAG_REC` diferă pe locație (F1); plancher `σ_WK = 1,3` (E3); `cycle = 0` strict pentru clasa CZ (E7); `ENG_MAX_BUC = ENG_MIN_BUC` la aplicarea podelei (E11/E12); winsorizare și sub pragul de 8 linii (E2); atribuirea vânzării pe filială devine parametru (I7); HQ se dimensionează pe vânzările agregate la nivel de companie (I6).

---

## 0. Decizii de arhitectură

| Decizie | Alegere |
|---|---|
| Locul calculului | Stored procedures MSSQL + wrapper AJS (consistent cu `sp_TopAbcAnalysis` și `sp_GetMtrlsData`) |
| UI | Tab nou dedicat în „Achizitii" |
| Persistență | Tabele `CCC*` proprii (staging + audit), rulări versionate |
| Scriere în ERP | **Manuală**, declanșată de utilizator după validare vizuală — nu automată |
| Parametri | Integral în DB, cu default-uri din spec; nimic hardcodat |
| Integrare Branch Replenishment | Coloane noi alături de `abc_class`/`salesperc` existente, fără regresie |

---

## 1. Constatări din baza de date (validare a documentației)

Verificări rulate direct pe ERP-ul de producție (`DUBHE ROMANIA SRL`, company 1000).

### 1.1 Lista de filiale — rezolvat: cele 4 diferențe sunt depozite închise

`BRANCH` conține **18 înregistrări active** (`ISACTIVE = 1`), dar engine-ul Python calculează 13. Verificarea join-ului cu `WHOUSE` (`WHOUSE.CCCBRANCH = BRANCH.BRANCH`) **închide itemul deschis #1**: cele 4 filiale lipsă au **depozitul dezactivat** (`WHOUSE.ISACTIVE = 0`) — sunt locații închise fizic, ale căror înregistrări `BRANCH` au rămas active.

| BRANCH | NAME | `BRANCH.ISACTIVE` | `WHOUSE.ISACTIVE` | Stoc rămas (FISCPRD 2026) | Concluzie |
|---|---|---|---|---|---|
| 2300 | ARAD | 1 | **0** | 4 SKU, total −8 | închis — rezidual negativ |
| 2400 | VOLUNTARI | 1 | **0** | 1 SKU, total −16 | închis — rezidual negativ |
| 2600 | MIHAILESTI | 1 | **0** | 3 SKU, total −476 | închis — rezidual negativ |
| 2900 | RAMNICU VALCEA | 1 | **0** | 0 SKU | închis — curat |

Chiar dacă cererea istorică a VOLUNTARI (1.161 linii) și RM. VÂLCEA (1.611 linii) ar fi motiv de includere, **nu există depozit activ** în care să se dimensioneze stoc — cererea lor a fost onorată prin cross-shipping sau înainte de închidere. `INCLUS = 0` nu mai e un default precaut, ci starea de fapt.

> **Sursa de adevăr pentru motor:** lista filialelor **fizice** se obține din `WHOUSE.ISACTIVE = 1 AND CCCBRANCH IS NOT NULL AND WHOUSE.COMPANY = 1000`, **nu** din `BRANCH.ISACTIVE = 1`. Prima dă exact cele 13 filiale pe care le calculează engine-ul Python; a doua dă 18, din care 4 sunt moarte. Diferența de 4 nu era o decizie de business, ci o inconsecvență de date între `BRANCH` și `WHOUSE`. Rândul HQ (1000) se adaugă **separat**, ca rând virtual — nu trece prin acest filtru.

> **Notă HQ — corectat 03.09.2026, verificat pe producție:** „HQ" (branch 1000) **nu este o locație fizică**. `WHOUSE` 1000 „HQ" (company 1000) are `ISACTIVE = 0`, 26 SKU cu stoc total 0, 163 linii de vânzare în 52S (0,17% din valoare) și **zero poziții în `MTRBRNLIMITS`**. Rândul HQ din motor este **stratul de companie**, persistat în `MTRL` (`REMAINLIMMIN`/`REMAINLIMMAX` manual, `CCCMINAUTOCOMP`/`CCCMAXAUTOCOMP` auto), iar materializarea lui fizică este depozitul central **București 2200** (50% din stocul național, 113.534 SKU, 10.367 poziții `MTRBRNLIMITS` — de 5× următoarea filială). Regula „podea București" este exact puntea dintre cele două straturi.
>
> **Afirmație anterioară invalidată:** compania **1001** nu este a MEC — este `Demo S.R.L.`, `ISACTIVE = 0`, 0 articole, cu depozite `Magazin 1/2`, `Restaurant Baneasa`, `Restaurant Afi Cotroceni`. `WHOUSE` 1000 „Depozit Central" de acolo este un artefact al bazei demo SoftOne. La `applyToErp`, HQ **nu** folosește niciun `WHOUSE` și **nu** primește rânduri în `MTRBRNLIMITS`; se scrie exclusiv în `MTRL`.
>
> **Bug latent rezultat:** clauza `(w.COMPANY = @Company OR b.ESTE_HQ = 1)` din `sp_MinMaxEngine_Classify` §3 face ca filiala 1000 să treacă filtrul `EXISTS` **doar** datorită depozitului activ din compania demo. Eligibilitatea HQ trebuie să nu depindă deloc de `WHOUSE`.

> **Atenție la `sp_GetMtrlsDat`:** dacă filtrează pe `BRANCH.ISACTIVE`, Branch Replenishment expune și cele 4 locații moarte în UI. De verificat la Faza 6 — nu e blocant pentru v5.

### 1.2 Excluderi clienți — C0.1 confirmat, plus o entitate nouă

| CODE | TRDR | NAME | Acțiune |
|---|---|---|---|
| `INTE79` | 59039 | INTER CARS ROMANIA | **NU se exclude** — client extern real, confirmă corecția C0.1 |
| `C.000003` | 52710 | DUBHE ROMANIA S.R.L. | se exclude (intern) |
| `MECDIS` | 61167 | DUBHE S.R.L. | se exclude (intern, Italia) |
| `MECDI2` | 61159 | **DUBHE BULGARIA EOOD** | **NU se exclude — confirmat de client (14.08.2026), tratată comercial** |

> **Constrângere de implementare:** niciunul dintre aceste coduri nu este unic în `TRDR` — `MECDIS`, `MECDI2` și `INTE79` au **câte două înregistrări** de partener fiecare (ex. `MECDIS` = 53900 **și** 61167). Excluderea se face pe **`TRDR.CODE`**, nu pe `TRDR` (identificatorul intern), altfel o parte din tranzacții rămân în calcul. `EXCLUDERI_CLIENTI` conține deci coduri, iar `ufn_MinMaxSalesLines` face join pe cod.

### 1.3 `MTRL.MTRPACK` — câmpul nativ pentru `N_PACK`

Există deja pe fișa articolului și este **100% gol** (0 din 2.576.884 articole active cu `MTRACN=101`). Nu e nevoie de câmp nou (secțiunea 3.5.1 din spec) — doar de populare prin import Excel.

**Confirmat de client (14.08.2026):** dacă `MTRPACK` nu e completat pentru un SKU, `N_PACK = 1` — fără rotunjire, fără fallback pe regulile hardcodate de categorie (DISC, BUCȘĂ, INJECTOR, PISTON/CĂMAȘĂ). `N_PACK` înlocuiește complet acele reguli, nu coexistă cu ele.

### 1.4 `MTRBRNLIMITS` este golit

26.449 rânduri / 10.516 SKU, dar `CCCMINAUTO` și `CCCMAXAUTO` sunt **zero peste tot** (Zero Min/Max a rulat). Consecință: coloanele „VS ERP" din output se compară cu `REMAINLIMMIN`/`REMAINLIMMAX` (valorile manuale), nu cu cele auto — ceea ce coincide cu confirmarea clientului că `ERP_MAX = MAX_MANUAL` (F10).

Alte flag-uri disponibile: `MTRBRNLIMITS.CCCISBLACKLISTED` (129 poziții), `MTRL.cccblockpur` (149.999 articole blocate la achiziție).

### 1.5 `ufn_vanzariWksOptimized` NU poate fi reutilizată

Funcția existentă (folosită de Top ABC) are trei incompatibilități cu v5:

1. **Nu filtrează pe client** — nu are niciun mecanism de excludere a entităților interne.
2. **Emite doar săptămânile cu vânzări** — `SIGMA_WK` cere toate cele 52 de bucket-uri, **inclusiv zerourile** (excluderea lor subestimează masiv variabilitatea la cerere sporadică).
3. **Agregă pe săptămână înainte de a expune liniile** — winsorizarea p95 se aplică per linie de tranzacție.

Rămâne neatinsă pentru Top ABC existent. v5 primește propria funcție.

### 1.6 Scara problemei

| Metrică | Valoare |
|---|---|
| Grupe de produs (`MTRGROUP`) | 46 definite, 44 cu vânzări |
| Linii vânzare / 52 săptămâni | 667.688 |
| SKU distincte cu vânzări / 52S | 54.091 |
| Filiale cu vânzări | 16 |
| **Rânduri ABC-XYZ per grupă** | **max. 46 × 18 = 828** — trivial |
| Rânduri ABC-XYZ per SKU | ~54K × 18 |
| Bucket-uri săptămânale de materializat | ~54K × 18 × 52 |

Efortul real este la nivel de SKU; nivelul de grupă este neglijabil ca volum.

### 1.7 Diferența față de Top ABC existent

| | Top ABC existent | v5: ABC-XYZ per SKU | v5: ABC-XYZ per grupă |
|---|---|---|---|
| Granularitate | SKU × branch | SKU × branch | `MTRGROUP` × branch |
| Cumulativ partiționat pe | `branch` | **`branch, mtrgroup`** | `branch` |
| XYZ (CV lunar, 12 buckets) | nu există | da | da |
| Excludere clienți interni | nu | da | da |
| Winsorizare p95 | nu | da | da |
| Consumator | afișare în Branch Replenishment | `COV_TGT` → formula MIN/MAX | Branch Replenishment (nou) |
| Persistență | `CCCTOPABC` + `CCCTOPABCSUMMARY` | `CCCMINMAXDET` | `CCCMINMAXGRP` |

Sunt calcule **paralele, nu înlocuitoare**. Top ABC existent rămâne complet neatins.

Azi, Branch Replenishment consumă ABC pasiv: [reumplere/sp_GetMtrlsDat.sql](../reumplere/sp_GetMtrlsDat.sql) construiește `#LatestAbcData` din `CCCTOPABC` și expune `salesperc` + `abc_class`, folosite exclusiv ca **afișare și filtru** ([public/config/table-column-config.js](../public/config/table-column-config.js), `abcFilter` din [public/stores/replenishment-store.js](../public/stores/replenishment-store.js)). **Nicio strategie de reumplere nu folosește ABC în calcul.**

### 1.8 Atribuirea vânzării pe filială — parametru nou, impact pe o treime din date

O linie de vânzare are **trei** filiale posibile, iar specificația nu precizează care se folosește. Pe cele 241.486 de linii statistice din ultimele 52 de săptămâni:

| Mod | Sursă în ERP | Suprapunere |
|---|---|---|
| **A** — filiala documentului | `FINDOC.BRANCH` | A = B în 65,3% |
| **B** — filiala agentului | `PRSN.BRANCH` (modul implicit al Top ABC) | B = C în **87,7%** |
| **C** — filiala clientului | `FINDOC.TRDBRANCH` → `TRDBRANCH.BRANCH` (mapare manuală, cheie `TRDR` + `SODTYPE=13` + `TRDBRANCH`) | A = C în 60,5%; acoperire **99,99%** |

**34,7% din linii se atribuie unei filiale diferite** în funcție de mod — schimbă direct `VZ_*`, `ABC`, `SIGMA_WK` și MIN/MAX-ul fiecărei filiale. Filiala documentului reflectă din ce depozit s-a onorat fizic comanda (cross-shipping), nu unde este cererea.

**Consecință de implementare:** modul devine parametru `MOD_ATRIBUIRE_FILIALA` ∈ {`DOC`, `AGENT`, `CLIENT`}, aplicat în `ufn_MinMaxSalesLines`. **Default recomandat: `CLIENT`** (`TRDBRANCH`), fiind maparea explicită de business, nu un proxy. Reconcilierea cu Top ABC (§9) trebuie făcută pe același mod, altfel cele două rapoarte diferă structural cu circa o treime.

### 1.9 HQ nu are cerere proprie — se dimensionează pe agregatul de companie

HQ (1000) are 26.128 de linii în 52 de săptămâni, dar doar **92** (0,4%) intră în statistici, iar acelea sunt servicii (`7090`) și vouchere (`7471`), nu marfă. Restul sunt tipuri `9999`/`9902` — „fără tranzacție".

**Consecință de implementare — nu un item deschis:** cererea HQ **nu poate fi calculată** din liniile atribuite locației 1000; ar rezulta `AVG ≈ 0`, deci `ENG_MIN`, `ENG_MAX` și `BUY_QTY` zero pe întreg portofoliul HQ. HQ se dimensionează pe **vânzările agregate la nivel de companie** (toate filialele însumate per SKU), exact ca modul „companie" al raportului Top ABC. Inflația +30% și HQ CAP își păstrează justificarea. Controlat prin `HQ_DIN_AGREGAT_COMPANIE = 1`.

---

## 2. Faza 0 — Fundație parametri

Obiectiv: „nimic hardcodat în engine" (cerința din secțiunea 5 a spec-ului).

### Tabele

**`CCCMINMAXPARAMS`** — parametri globali, cheie-valoare tipizată cu scope.

| Coloană | Tip | Rol |
|---|---|---|
| `PARAMKEY` | varchar(50) | cheia |
| `PARAMVALUE` | varchar(255) | valoarea serializată |
| `PARAMTYPE` | varchar(10) | `NUM` / `STR` / `LIST` / `BOOL` |
| `SCOPE` | varchar(20) | `GLOBAL` / `PREFIX` / `BRANCH` |
| `SCOPEKEY` | varchar(50) | prefix furnizor sau branch, când e cazul |
| `DESCRIERE` | varchar(255) | text pentru UI |

Seed:

| Cheie | Default | Sursă |
|---|---|---|
| `SSF` | 1.28 | secțiunea 3.4 — **flat, confirmat 14.08.2026** (L4) |
| `WINSOR_PCT` | 0.95 | secțiunea 3.1 |
| `WINSOR_MIN_LINII` | 8 | secțiunea 3.1 |
| `WINSOR_SUB_PRAG` | `MEDIANA` | **nou (E2)** — tratamentul SKU cu < `WINSOR_MIN_LINII` linii: `NONE` (comportamentul din spec) / `MEDIANA` (plafon secundar la mediana istorică) |
| `SIGMA_MIN` | 1.3 | **nou (E3)** — plancher pentru `SIGMA_WK` când deviația calculată este 0 |
| `PRAG_REC_HQ` | 39 | secțiunea 3.5 — recență maximă pentru `STANDARD`, HQ |
| `PRAG_REC_BR` | 26 | secțiunea 3.5 — **idem, filiale (prag mai strict)** |
| `CZ_CYCLE_ZERO` | 1 | **nou (E7)** — clasa CZ are `cycle = 0` strict, fără termenul `ad × FRECVENTA` |
| `MOD_ATRIBUIRE_FILIALA` | `CLIENT` | **nou (I7)** — `DOC` / `AGENT` / `CLIENT` (`TRDBRANCH`) |
| `HQ_DIN_AGREGAT_COMPANIE` | 1 | **nou (I6)** — HQ se dimensionează pe vânzările însumate ale filialelor |
| `FLAGS_ZERO_LA_APPLY` | 1 | **nou (E15)** — flag-urile rămân informative în raport, dar zero-uiesc `MIN`/`MAX` la scrierea în ERP |
| `PROCENT_PODEA_BUC` | 0.30 | secțiunea 3.5.2 |
| `INFLATIE_HQ` | 1.30 | secțiunea 3.4 |
| `HQ_CAP_FACTOR` | 1.5 | secțiunea 3.5 |
| `SL_A` / `SL_B` / `SL_C` | 95 / 85 / 75 | secțiunea 3.4 |
| `CAP_LUNI` | 6 | secțiunea 3.4 |
| `EXCLUDERI_CLIENTI` | `C.000003,MECDIS` | §1.2 de mai sus — **coduri, nu `TRDR`** |
| `EXCLUDERI_PREFIXE` | `DISC.,OTHER.` | secțiunea 2.1 |
| `NRSAPT` | 52 | secțiunea 5 |
| `LT_ZILE` / `FRECVENTA_ZILE` | **per prefix cod articol** | secțiunea 3.6 + I14 |

> **Precizare client (14.08.2026, I14):** `LT`, `SSF`, `FRECVENTA_zile`, `SL` și overmax se mapează pe **prefix de cod articol** (`FEBI%`, `MEC%`), nu doar per furnizor — exact ca ecranul legacy „Scrie min MAX" din S1. `SCOPE = 'PREFIX'` cu `SCOPEKEY` = prefixul de cod acoperă cerința; furnizorul rămâne filtru opțional în șabloane.

**`CCCMINMAXCOV`** — matricea de acoperire.

| Coloană | Tip |
|---|---|
| `CLASA` | varchar(3) — `AX`…`CZ`, `NOU` |
| `MARIME` | varchar(6) — `MARE` / `MEDIU` / `MIC` |
| `COV` | float |

Seed: `MARE` = tabelul COV_HQ, `MIC` = tabelul COV_BR (secțiunea 3.6). **`MEDIU` pornește egal cu `MIC`** — astfel comportamentul implicit este identic cu alocarea binară actuală, exact fallback-ul cerut în secțiunea 3.6.1, fără a bloca implementarea.

**`CCCMINMAXBRANCH`** — configurare filiale.

| Coloană | Tip | Rol |
|---|---|---|
| `BRANCH` | smallint | |
| `MARIME` | varchar(6) | `MARE`/`MEDIU`/`MIC` |
| `INCLUS` | bit | intră în calcul |
| `ESTE_HQ` | bit | aplică inflația ×1.30 și HQ CAP |
| `ESTE_PODEA` | bit | ținta regulii de podea (azi București) |

Seed: `MARE` = 2200, 1400, 1300, 2800, 1200; restul incluse = `MIC`; cele 4 nedecise (2300, 2400, 2600, 2900) cu `INCLUS = 0` până la confirmare.

> **Confirmat de client (14.08.2026):** atât valorile din `CCCMINMAXCOV`, cât și **maparea filială → `MARE`/`MEDIU`/`MIC`** din `CCCMINMAXBRANCH` sunt editabile manual din UI, oricând. Nu există o regulă de încadrare derivată automat din date — beneficiarul mută o filială între categorii pe baza propriei evaluări de business. `ESTE_PODEA` este de asemenea parametru (azi 2200), nu constantă (E16).

**`CCCMINMAXTEMPLATE`** — șabloane numite de parametri per prefix (cerere client 14.08.2026, mimează ecranul legacy „Scrie min MAX").

| Coloană | Tip | Rol |
|---|---|---|
| `TEMPLATEID` | int identity | |
| `NUME` | varchar(100) | numele șablonului (ex. „FEBI standard") |
| `PREFIX` | varchar(50) | `FEBI%`, `MEC%` etc. — același câmp „Cod, de la" din ecranul legacy |
| `FURNIZOR` | int NULL | opțional, filtrare suplimentară pe furnizor |
| `PARAMSJSON` | nvarchar(max) | snapshot complet al valorilor `SSF`, `LT_ZILE`, `FRECVENTA_ZILE`, `SL_A/B/C`, overmax, `NRSAPT` etc. pentru acest prefix |
| `CREATEDBY` / `CREATEDAT` | varchar / datetime | audit |

Un șablon se **încarcă** în panoul de parametri (populează câmpurile), se editează dacă e nevoie, apoi se poate rula direct sau resalva. Nu înlocuiește `CCCMINMAXPARAMS` (care rămâne sursa de adevăr pentru rularea curentă) — e un strat de conveniență pentru reutilizarea rapidă a seturilor de parametri per prefix.

### Livrabile

- ✅ [new_min_max/sql/00_params.sql](sql/00_params.sql) — DDL + seed, idempotent (`IF NOT EXISTS` pe `sysobjects`, seed prin `WHERE NOT EXISTS` → re-rularea nu suprascrie valorile editate de utilizator)
- același DDL, replicat în acțiunea `setup` din `S1-MEC/AJS/MinMaxEngine.js` (Faza 3)

> **Corecție de convenție:** tabelele `CCC*` **nu** se creează prin migrări knex. Migrările din [migrations/](../migrations/) vizează baza aplicației Feathers (`mec-item-altref` etc.), în timp ce `CCC*` trăiesc în baza S1 și se creează din AJS, prin `X.RUNSQL` cu `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name=... AND xtype='U')` — tiparul din [S1-MEC/AJS/ZeroMinMax.js](../S1-MEC/AJS/ZeroMinMax.js) (`CCCZEROMINMAX`).

---

## 3. Faza 1 — Motorul SQL

### `ufn_MinMaxSalesLines`

Linii brute de vânzare, la nivel de tranzacție (nu agregat).

- filtre de bază preluate din `ufn_vanzariWksOptimized`: `SOSOURCE=1351`, `ISCANCEL=0`, `TPRMS.flg04=1`, `TPRMS.flg10=1`, `MTRL.SODTYPE=51`, `MTRL.MTRACN=101`, `FPRMS NOT IN (1)`
- **nou:** excludere clienți pe **`TRDR.CODE`** (nu pe `TRDR`) pe baza `EXCLUDERI_CLIENTI` — vezi constrângerea din §1.2
- **nou:** excludere prefixe `CODE` pe baza `EXCLUDERI_PREFIXE`
- **nou (I7):** filiala de atribuire se rezolvă după `MOD_ATRIBUIRE_FILIALA`:
  - `DOC` → `FINDOC.BRANCH`
  - `AGENT` → `PRSN.BRANCH`
  - `CLIENT` (default) → `JOIN TRDBRANCH ON TRDR + SODTYPE=13 + TRDBRANCH` → `TRDBRANCH.BRANCH`, cu fallback pe `FINDOC.BRANCH` pentru cele ~0,01% linii fără mapare
- cantitate normalizată `QTY1 / MU41`, valoare `LTRNVAL`
- `AZI = MAX(TRNDATE)` din tranzacții, **nu** `GETDATE()`

### `sp_MinMaxEngine_Prepare`

**Ordinea este obligatorie** (spec §3.2–3.3, confirmată de client 14.08.2026 — I11):

```
excluderi → winsorizare p95 → netting → bucket-uri săptămânale (cu zerouri) → SIGMA_WK + ferestre VZ
```

Ordinea nu e negociabilă: winsorizarea este definită **per linie de vânzare**. Dacă nettingul se aplică primul, liniile individuale nu mai există și percentila 95 nu mai are pe ce să fie calculată. (Versiunile anterioare ale acestui plan inversau pașii — corectat.)

1. **Winsorizare p95**: `PERCENTILE_CONT(0.95)` per SKU, aplicată liniilor pozitive. Pentru SKU cu ≥ `WINSOR_MIN_LINII` linii — plafon la p95. Pentru SKU sub prag, comportamentul e dat de `WINSOR_SUB_PRAG` (**E2, cerere client**): implicit `MEDIANA` — plafon secundar la mediana istorică a articolului, ca o comandă unică de proiect să nu devină „norma" unui articol care se vinde în câteva bucăți. Nu afectează valoarea netă → ABC rămâne corect.
2. **Netting** per (SKU, client, fereastră): `SUM(...)`, apoi `CASE WHEN < 0 THEN 0`.
3. **Bucket-uri săptămânale**: `DATEDIFF(wk, TRNDATE, @AZI)` 0..51, materializate prin `CROSS JOIN` cu un tally de 52 poziții pentru a **include săptămânile cu 0 vânzări** (I12 — confirmat: zerourile intră în `σ`).
4. **Agregate**: `VZ_4S`, `VZ_13S`, `VZ_26S`, `VZ_52S`, `VAL_52S`, `SAPT_VZ`, `SAPT_8S`, `SAPT_FARA`, `ULT_VANZ`, `MIN_DOC`, `SIGMA_WK = STDEV(...)` (eșantion, numitor `n−1`, pe seria winsorizată p95 cu zerouri).
5. **Plancher de variabilitate (E3)**: `SIGMA_WK = CASE WHEN SIGMA_WK = 0 THEN @SIGMA_MIN ELSE SIGMA_WK END` — articolele cu istoric perfect constant primesc totuși o rezervă minimă, nu zero.
6. **Agregat HQ (I6)**: când `HQ_DIN_AGREGAT_COMPANIE = 1`, rândurile pentru branch-ul cu `ESTE_HQ = 1` se construiesc din însumarea pe SKU a tuturor filialelor incluse, nu din liniile atribuite locației 1000.

`MIN_DOC` = cea mai mică cantitate de vânzare a articolului din ultimele 52 de săptămâni (unitatea minimă tipică de livrare), default 1 — se calculează din date, nu e parametru.

Output în `#MinMaxBase` sau tabelă de staging persistentă.

### `sp_MinMaxEngine_Classify` (per SKU)

- **Eligibilitate** (secțiunea 3.2): `STANDARD` dacă `SAPT_VZ ≥ 3 AND SAPT_FARA ≤ PRAG_REC AND VZ_52S > 0`, unde **`PRAG_REC = 39` pentru HQ și `26` pentru filiale** (F1 — planul anterior folosea 39 peste tot); `NOU/REACTIVAT` dacă `SAPT_8S ≥ 2 AND VZ_26S > 0`; restul `ON DEMAND`. Articolele la care retururile anulează vânzările (`VZ_52S = 0` după netting) cad pe `ON DEMAND` → `MIN = MAX = BUY = 0` (E1, confirmat).
- **ABC**: cumulativ pe `VAL_52S`, `PARTITION BY branch, mtrgroup` — praguri 80% / 95%. **Ordonare secundară după `MTRL.CODE`** pentru rezultate reproductibile la egalități de valoare (E19).
- **XYZ**: `CV = STDEV(vânzări_lunare_12) / AVG(vânzări_lunare_12)`; X ≤ 0.5, Y ≤ 1.0, Z > 1.0.
- **Forțat Z**: lună dominantă > 60% din `VZ_52S`, sau < 2 luni cu vânzări, sau clasă `NOU`/`OD`. Cele trei criterii acoperă și cazul `μ = 0` (împărțire la zero în `CV`) — nu se adaugă regulă separată (E4, confirmat).
- **Grupă lipsă**: SKU fără `MTRGROUP` se tratează ca grupă distinctă `NEDEFINIT` (E18).
- **Override**: `NOU/REACTIVAT` → `CLASA = 'NOU'`; `ON DEMAND` → `CLASA = 'OD'`.

### `sp_MinMaxEngine_ClassifyGroup` (per grupă)

Același algoritm ABC-XYZ, agregat pe `MTRGROUP` × `BRANCH`. Volum: max. 828 rânduri. Output → `CCCMINMAXGRP`.

> Formula exactă de agregare (cumulativ pe valoarea grupei în sucursală) rămâne de confirmat cu clientul — secțiunea 3.3.1, item deschis. Implementarea implicită urmează analogia cu secțiunea 3.3.

### `sp_MinMaxEngine_Compute`

```
AVG      = VZ_4S×0.30 + (VZ_13S/3)×0.40 + (VZ_26S/6)×0.15 + (VZ_52S/12)×0.15   -- STANDARD
AVG      = VZ_13S / 3                                                            -- NOU/REACTIVAT
ad       = AVG / 30
safety   = SIGMA_WK × SSF × SQRT(LT/7.0)          -- SIGMA_WK deja plancherat la SIGMA_MIN
lt_stock = ad × LT
slts     = lt_stock × (100.0/SL - 1)
buf      = safety + slts + lt_stock
cycle    = CASE WHEN COV_TGT = 0 AND @CZ_CYCLE_ZERO = 1                          -- E7
                THEN 0
                ELSE MAX(AVG × COV_TGT, ad × FRECVENTA_zile) END
MAX_raw  = CEILING(buf + cycle)
MAX_inf  = CEILING(MAX_raw × INFLATIE_HQ)        -- doar unde ESTE_HQ = 1
CAP6     = CEILING(AVG × CAP_LUNI)
VZ26_CAP = CASE WHEN VZ_26S > 0 THEN VZ_26S ELSE 9999 END
ENG_MAX  = MIN(MAX_inf, CAP6, VZ26_CAP)
ENG_MIN  = MIN(MAX(CEILING(buf), MIN_DOC), ENG_MAX)
BUY_QTY  = MAX(0, ENG_MAX - MAX(0, STOC_QTY) - ORD_FURN)                         -- E10
```

Note de coerență cu confirmările clientului:

- `safety` este în bucăți: `SIGMA_WK` e în bucăți/săptămână, iar `SQRT(LT/7.0)` e adimensional pe bază săptămânală — aceeași unitate cu `lt_stock` și `cycle`.
- **E7:** pentru clasa `CZ` (`COV_TGT = 0`), `cycle = 0` strict — `ENG_MAX` se reduce la componenta de buffer. Se renunță la termenul `ad × FRECVENTA_zile` pentru această clasă.
- **E10:** stocul negativ din ERP (erori de gestiune) se tratează ca `MAX(0, STOC_QTY)` la calculul `BUY_QTY`, altfel comanda ar depăși `ENG_MAX`. Articolul se semnalează în `STATUS`.
- **E8:** `MIN_DOC > ENG_MAX` conduce, prin formulă, la `MIN = MAX` — articol „tot sau nimic". Comportament acceptat.
- **E13:** rotunjirea la `N_PACK` poate împinge stocul final peste `ENG_MAX`; se acceptă (ambalarea e o constrângere fizică). Rotunjirea în jos ar produce `BUY_QTY = 0` la pachete mari.

Post-procesare, **strict în această ordine** (spec: podeaua și pack rules se re-aplică *după* HQ CAP):

1. **HQ CAP**: `IF ENG_MAX_HQ > SUM_BR_MAX × HQ_CAP_FACTOR → ENG_MAX_HQ = CEILING(SUM_BR_MAX × HQ_CAP_FACTOR)`. SKU cu `SUM_BR_MAX = 0` nu se capează.
2. **Podea București** (filiala-țintă = `ESTE_PODEA = 1`, parametrizată — E16): dacă SKU există pe HQ cu `ENG_MIN_HQ > 0` — inserează codul dacă lipsește, sau ridică `ENG_MIN_BUC` la `CEILING(ENG_MIN_HQ × PROCENT_PODEA_BUC)` dacă e sub prag. **Nu scade niciodată** o valoare calculată independent.
   **Completare confirmată de client (14.08.2026, E11 + E12):** ori de câte ori podeaua ridică `ENG_MIN_BUC` peste `ENG_MAX_BUC` — inclusiv la articolele auto-create, care nu au `ENG_MAX` calculat — se setează `ENG_MAX_BUC = ENG_MIN_BUC` (strict egal, **nu** `MAX(ENG_MAX_BUC, ENG_MIN_BUC)`). Elimină inconsistența `MIN > MAX`.
3. **Pack rules**: `BUY_QTY = CEILING(BUY_QTY / MTRPACK) × MTRPACK`, cu `MTRPACK` default 1. **`N_PACK` înlocuiește complet regulile hardcodate pe categorie** (DISC, BUCȘĂ, INJECTOR, PISTON/CĂMAȘĂ) — `MTRPACK` gol → `N_PACK = 1`, fără rotunjire și fără regulă de prag de rezervă (E14, confirmat).
4. **Flags externe** (`LICHIDARE`, `BLOCAT` / `cccblockpur`, `EXCLUDE`) — **E15, item deschis**: spec §3.11 le declară strict informative. Implementarea implicită (`FLAGS_ZERO_LA_APPLY = 1`): valorile **rămân calculate în raport**, ca §3.11, dar articolele cu flag primesc `MIN = MAX = 0` **la scrierea în ERP** (Faza 3). Astfel raportarea rămâne completă, iar comenzile automate din `CCCMINAUTO`/`CCCMAXAUTO` nu reaprovizionează articole în lichidare sau blocate. Cu `FLAGS_ZERO_LA_APPLY = 0` se obține comportamentul literal din spec.

Coloane derivate pentru output: `ACOP_CUR = STOC_QTY / AVG`, `FLAG` (raportul `ENG_MAX / ERP_MAX`, praguri din secțiunea 4), `STATUS` (trend `VZ_13S` vs `VZ_26S`), `DISC_FLAG` (`AZI − LAST_RECEIPT > 365`).

**`ERP_MAX = MAX_MANUAL`** — strict valoarea introdusă manual (`MTRBRNLIMITS.REMAINLIMMAX`), **nu** `MAX(MAX_MANUAL, MAX_CALCULAT)` (F10, confirmat 14.08.2026). Comparația se face față de decizia umană, nu față de ce a scris motorul auto la o rulare anterioară.

Coloane suplimentare de semnalare, pentru revizuire manuală:

| Coloană | Condiție | Caz |
|---|---|---|
| `WARN_VZ26_ZERO` | `VZ_26S = 0` la un SKU `STANDARD` → `VZ26_CAP = 9999`, plafonul „realitate recentă" se dezactivează | E6 |
| `WARN_STOC_NEG` | `STOC_QTY < 0` în ERP | E10 |
| `WARN_STOC_MORT` | `ENG_MAX = 0` dar `STOC_QTY > 0` | E9 |
| `WARN_GRUPA_MICA` | grupa are < 5 articole (cumulativul ABC devine degenerat) | E17 |

---

## 4. Faza 2 — Persistență

| Tabel | Rol |
|---|---|
| `CCCMINMAXRUN` | antet rulare: `RUNID`, `AZI`, parametri folosiți (JSON), durată, user, status |
| `CCCMINMAXDET` | rezultat per SKU × branch — cele 39 de coloane din secțiunea 4, plus coloanele `WARN_*` de semnalare (§3) |
| `CCCMINMAXGRP` | ABC-XYZ per `MTRGROUP` × branch |
| `CCCMINMAXAPPLY` | audit scrieri în ERP: valori vechi + noi, user, timestamp, `RUNID` |

Rulările sunt **versionate, nu suprascrise** — necesar pentru rularea paralelă de validare (1-2 săptămâni) și pentru comparații între versiuni de parametri.

`CCCMINMAXAPPLY` urmează modelul `CCCZEROMINMAX` (snapshot valori vechi) → scrierile în ERP sunt reversibile.

---

## 5. Faza 3 — AJS

Fișier nou `S1-MEC/AJS/MinMaxEngine.js`, după tiparul din [S1-MEC/AJS/ZeroMinMax.js](../S1-MEC/AJS/ZeroMinMax.js) (`obj.JSONDATA` la intrare, `JSON.stringify({success, ...})` la ieșire, `X.GETSQLDATASET` / `X.RUNSQL`). Oglindit în `external/MEC/SyncItalia/S1/AJS/`.

| Endpoint | Rol |
|---|---|
| `setup` | creează tabelele + seed parametri |
| `getParams` / `saveParams` | citire/scriere `CCCMINMAXPARAMS`, `CCCMINMAXCOV`, `CCCMINMAXBRANCH` |
| `getTemplates` / `saveTemplate` / `deleteTemplate` | CRUD `CCCMINMAXTEMPLATE` — șabloane de parametri per prefix |
| `runEngine` | lansează pipeline-ul complet, returnează `RUNID` |
| `getRunResults` | rezultate paginate + filtrate din `CCCMINMAXDET` |
| `getGroupAbc` | `CCCMINMAXGRP` pentru o rulare |
| `getRunHistory` | istoric rulări |
| `applyToErp` | scriere manuală în ERP (vezi mai jos) |
| `importPackFromExcel` | populare `MTRL.MTRPACK` din Excel (tipar `MTRBRNLIMITS.js`) |

### `applyToErp`

- `MTRBRNLIMITS.CCCMINAUTO` / `CCCMAXAUTO` pentru filiale
- `MTRL.CCCMINAUTOCOMP` / `CCCMAXAUTOCOMP` pentru HQ (branch 1000 / whouse 1000)
- `CCCDATACALCMINMAX = GETDATE()`
- **E20:** dacă SKU-ul are cerere într-o filială dar nu are fișă de stoc acolo, poziția se **creează** în `MTRBRNLIMITS` la scriere — analog mecanismului podelei București
- **E15:** când `FLAGS_ZERO_LA_APPLY = 1`, articolele cu `LICHIDARE` / `BLOCAT` (`cccblockpur`) / `EXCLUDE` se scriu cu `MIN = MAX = 0`, deși în `CCCMINMAXDET` rămân valorile calculate. Raportarea nu se mutilează, dar reaprovizionarea automată nu se declanșează.
- totul în tranzacție, cu snapshot al valorilor vechi în `CCCMINMAXAPPLY`
- acceptă selecție parțială (subset de branch-uri / SKU-uri)

---

## 6. Faza 4 — Backend Node

Serviciu Feathers `src/services/minmax-engine/` (`.js`, `.class.js`, `.shared.js`), după tiparul [src/services/zero-minmax/](../src/services/zero-minmax/). Proxy către `/JS/MinMaxEngine/*`.

Înregistrare în [public/socketConfig.js](../public/socketConfig.js):

```javascript
client.use("minmax-engine", socketClient.service("minmax-engine"), {
  methods: ["params", "saveParams", "run", "results", "groupAbc", "history", "apply", "importPack"]
});
```

Rularea completă este de durată → refolosim `CCCBATCHQUEUE` și serviciul `batch-queue` existent pentru progres și anulare.

---

## 7. Faza 5 — UI („Achizitii" → tab nou)

### Wiring

1. buton tab în [public/index.html](../public/index.html), lângă `exportMinMaxButton`
2. container `<div id="minmaxEngineContent"><minmax-engine-container></minmax-engine-container></div>`
3. `<script type="module" src="components/minmax-engine/minmax-engine-container.js">`
4. adăugare în `appConfigs.achizitii.tabs` din [public/hierarchical-navigation.js](../public/hierarchical-navigation.js)

### Componente — `public/components/minmax-engine/`

| Componentă | Rol |
|---|---|
| `minmax-engine-container.js` | container, provider de store |
| `minmax-params-panel.js` | editare parametri + matrice COV + configurare filiale + șabloane per prefix (`CCCMINMAXTEMPLATE`, salvare/încărcare, analog ecranului legacy „Scrie min MAX") |
| `minmax-run-panel.js` | lansare rulare, progres, istoric |
| `minmax-results-table.js` | rezultate, filtre pe `FLAG` / `CLASA` / `STATUS` / branch / coloanele `WARN_*` |
| `minmax-group-abc.js` | ABC-XYZ per grupă |
| `minmax-apply-modal.js` | confirmare scriere în ERP |

Store după tiparul [public/stores/replenishment-store.js](../public/stores/replenishment-store.js) (pub/sub + Lit Context). Tabelul refolosește configurarea pe coloane din [public/config/table-column-config.js](../public/config/table-column-config.js).

### Flux utilizator

```
parametri → rulare → inspecție rezultate (read-only)
   → validare vizuală / calcul pe hârtie
   → „Apply to S1" → confirmare cu delta → scriere + audit
```

Modalul de confirmare afișează câte poziții se modifică, pe ce filiale, și delta față de valorile curente din ERP.

Export Excel echivalent `minmax_union.xlsx` (39 coloane × sheet per filială + SUMMARY) prin `XLSX`, ca în [public/components/export-minmax/export-minmax-panel.js](../public/components/export-minmax/export-minmax-panel.js).

---

## 8. Faza 6 — Integrare Branch Replenishment

Modificare minimală, fără regresie, în [reumplere/sp_GetMtrlsDat.sql](../reumplere/sp_GetMtrlsDat.sql):

- `LEFT JOIN CCCMINMAXGRP` pe (`mtrgroup`, `branch`), pentru ultima rulare
- trei coloane noi în `SELECT`: `grp_abc`, `grp_xyz`, `grp_clasa`
- `#LatestAbcData`, `abc_class`, `salesperc` și filtrul `abcFilter` rămân **neatinse**

Coloane noi în [public/config/table-column-config.js](../public/config/table-column-config.js), grup `destination`, cu `isHeaderFilter: true`.

---

## 9. Validare

Conform secțiunii 5 din spec: rulare paralelă Python vs. ERP, 1-2 săptămâni, criteriu `>80% SKU cu FLAG = ✓ OK`.

> ⚠️ Pragul de 80% a fost stabilit pentru formula cu proxy `σ = AVG × 0.30`. Trecerea la `SIGMA_WK` real deplasează safety-ul **în sus** pentru SKU volatile (clasa Z) și **în jos** pentru cele stabile (clasa X), deci distribuția `FLAG` se schimbă structural. Pragul trebuie **recalibrat** pe prima rulare cu formula nouă, înainte de a fi folosit ca criteriu de accept.

Verificări suplimentare:

- **reconciliere `VZ_*` cu Top ABC existent pe același interval și pe același mod de atribuire.** Top ABC rulează implicit pe filiala **agentului**; dacă v5 rulează pe `CLIENT` (`TRDBRANCH`) diferența e mică (87,7% suprapunere), dar dacă rulează pe `DOC` cele două rapoarte diferă structural cu circa o treime — reconcilierea trebuie făcută cu `MOD_ATRIBUIRE_FILIALA` identic (I7)
- validarea că winsorizarea nu modifică `VAL_52S` (deci ABC rămâne identic)
- comparație `ENG_MIN`/`ENG_MAX` cu output-ul Python pe un eșantion agreat

Scrierea în ERP **nu este automată**: rezultatele se calculează și se inspectează, aplicarea în `MTRBRNLIMITS`/`MTRL` se declanșează manual, cu confirmare și cu revenire posibilă (valorile anterioare se salvează în `CCCMINMAXAPPLY`).

---

## 10. Itemi deschiși — de confirmat cu clientul

| # | Item | Blochează? | Default aplicat |
|---|---|---|---|
| 1 | ~~Filialele VOLUNTARI, RM. VÂLCEA, ARAD, MIHĂILEȘTI~~ | — | ✅ **rezolvat 01.09.2026: toate 4 au `WHOUSE.ISACTIVE = 0` — depozite închise fizic, nu decizii de business. `INCLUS = 0` este starea de fapt** (vezi §1.1) |
| 2 | ~~Valorile `COV_MEDIU` + maparea MARE/MEDIU/MIC~~ | nu | ✅ **rezolvat 14.08.2026: matricea și maparea filială→categorie sunt editabile manual de beneficiar oricând** (`MEDIU = MIC` doar ca fallback inițial, până la completare) |
| 3 | ~~`SSF` flat 1.28 vs. per clasă ABC (item L4)~~ | — | ✅ **rezolvat 14.08.2026: rămâne flat 1.28** |
| 4 | `CX = 2.00 > BY = 2.00` (item I2) | nu | valorile din spec |
| 5 | Formula de agregare ABC per grupă (secțiunea 3.3.1) | nu | analogie cu secțiunea 3.3 |
| 6 | ~~`MTRPACK` înlocuiește complet Pack Rules hardcodate?~~ | — | ✅ **rezolvat 14.08.2026: da, fără excepții — `MTRPACK` gol → `N_PACK = 1`** |
| 7 | ~~Confirmarea excluderii `MECDI2` (Dubhe Bulgaria)~~ | — | ✅ **rezolvat 14.08.2026: NU se exclude** |
| 8 | **`MOD_ATRIBUIRE_FILIALA` — document / agent / client (`TRDBRANCH`)?** (I7) | nu, dar **schimbă rezultatele numeric** | `CLIENT` (recomandarea noastră) |
| 9 | **Flag-urile externe zero-uiesc `MIN`/`MAX` la scrierea în ERP?** (E15) | nu | `FLAGS_ZERO_LA_APPLY = 1` |
| 10 | Confirmarea că HQ se dimensionează pe agregatul de companie (I6) | nu — altfel HQ iese integral zero | `HQ_DIN_AGREGAT_COMPANIE = 1` |
| 11 | Există istoric recepții pentru `σ_LT`? (I14 / lacuna L1 — variabilitatea lead time-ului rămâne ignorată) | nu | termen absent din formulă |
| 12 | Pentru clasa `NOU`: `σ_WK` calculat doar de la prima vânzare încoace? (E5) | nu | seria completă de 52 de săptămâni |

Niciunul nu blochează Fazele 0-3 — toate sunt parametri cu valoare implicită.

### Confirmări încorporate în plan (14.08.2026)

| Ref | Decizie | Unde s-a reflectat |
|---|---|---|
| I11 | ordinea `winsorizare → netting` (nu invers) | §3, `sp_MinMaxEngine_Prepare` |
| F5 + I12 | `σ_WK` real, pe date winsorizate p95, cu zerouri | §3, `Prepare` + `Compute` |
| E3 | plancher `σ_WK = 1,3` când deviația e 0 | `SIGMA_MIN`, §2 + §3 |
| E7 | `cycle = 0` strict pentru clasa CZ | `CZ_CYCLE_ZERO`, §3 |
| E2 | winsorizare și pentru SKU cu < 8 linii | `WINSOR_SUB_PRAG`, §2 + §3 |
| F1 | `PRAG_REC` = 39 (HQ) / 26 (filiale) | `PRAG_REC_HQ` / `PRAG_REC_BR`, §3 `Classify` |
| E11 + E12 | `ENG_MAX_BUC = ENG_MIN_BUC` la podea și la auto-creare | §3, post-procesare pasul 2 |
| E14 | `N_PACK` înlocuiește Pack Rules; gol → 1 | §3, post-procesare pasul 3 |
| F10 | `ERP_MAX = MAX_MANUAL` | §1.4 + §3, coloane derivate |
| E1, E4 | retururi care anulează → `ON DEMAND`; `μ = 0` → forțat `Z` | §3, `Classify` |
| L3, L4 | `slts` rămâne ca atare; `SSF` flat 1.28 | fără modificare de comportament |
| I5 | excluderea se face pe **cod**, nu pe `TRDR` | §1.2 + §3, `ufn_MinMaxSalesLines` |
| I6 | HQ pe agregatul de companie | §1.9 |
| I14 | parametri pe **prefix de cod articol**, cu șabloane numite | §2, `CCCMINMAXPARAMS` + `CCCMINMAXTEMPLATE` |

---

## 11. Ordinea de execuție

```
Faza 0 (parametri)
   └→ Faza 1 (motor SQL) ──┬→ Faza 2 (persistență)
                            └→ Faza 3 (AJS)
                                  └→ Faza 4 (backend Node)
                                        └→ Faza 5 (UI)
                                              └→ Faza 6 (Branch Replenishment)
                                                    └→ Faza 9 (validare paralelă)
```

Fazele 1 și 2 se pot dezvolta în paralel după definirea schemei. Faza 6 este independentă de Faza 5 și poate fi livrată imediat după Faza 2.
