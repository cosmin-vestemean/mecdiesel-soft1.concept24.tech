# Faza 3 — `sp_MinMaxEngine_Compute` · Handoff pentru sesiunea Implement

> **Agent recomandat:** `Implement` (Claude Sonnet). Proiectarea e încheiată — ce urmează e muncă multi-fișier.
> **Produs de:** sesiunea de planificare 03.09.2026 (Opus).
> **Citește întâi:** `.copilot/context/current-focus.md`. Acest document îl detaliază, nu îl înlocuiește.

---

## 0. Ce s-a schimbat față de ce scrie în `PLAN_IMPLEMENTARE.md`

Trei corecții obținute prin verificare pe producție. Fără ele, Faza 3 se implementează pe premise false.

### 0.1 „HQ" nu este o locație fizică

| Fapt verificat (03.09.2026, prod) | Valoare |
|---|---|
| `WHOUSE` 1000 „HQ", company 1000 | `ISACTIVE = 0`, 26 SKU, stoc total **0** |
| Linii de vânzare branch 1000 / 52S | **163** (0,17% din valoare) |
| Rânduri `MTRBRNLIMITS` pentru branch 1000 | **0** |
| `MTRBRNLIMITS` pentru branch 2200 | **10.367** (de 5× următoarea filială) |
| Stoc București 2200 | 113.534 SKU, 208.953 buc ≈ 50% național |
| Valoare vânzări 2200 / 52S | 33,7 mil RON = **26,5%** din total |

**Rândul HQ din motor = stratul de companie**, persistat în `MTRL`:

```
MTRL.REMAINLIMMIN / REMAINLIMMAX          → min/max MANUAL la nivel companie (9.625 SKU)
MTRL.CCCMINAUTOCOMP / CCCMAXAUTOCOMP      → min/max AUTO la nivel companie (azi 0 SKU)
```

Materializarea fizică a acestui strat este depozitul central **București 2200**. Regula „podea București" este puntea dintre straturi: *din minimul de companie, cel puțin 30% trebuie să stea fizic în depozitul central*. Nu este tautologică.

> ⛔ **Nu muta `ESTE_HQ = 1` pe branch 2200.** `Classify` §4 exclude liniile filialelor cu `ESTE_HQ = 1` (`WHERE b.ESTE_HQ = 0 OR @HqDinAgregatCompanie = 0`), iar §6 construiește agregatul din `sourceBranch.ESTE_HQ = 0`. Rezultatul ar fi: București pierde propriile 53.845 de linii și primește profilul de cerere al celorlalte filiale. Rândul virtual 1000 rămâne exact unde este.

### 0.2 Compania 1001 este baza demo SoftOne

`COMPANY 1001 = "Demo S.R.L."`, `ISACTIVE = 0`, **0 articole**, depozite `Magazin 1/2`, `Restaurant Baneasa`, `Restaurant Afi Cotroceni`. Afirmația din sesiuni anterioare — „depozitul real al HQ este `WHOUSE` 1000 pe compania 1001" — era falsă. Orice interogare din Faza 3 filtrează `COMPANY = @Company` strict.

### 0.3 Parametrii „inventați" sunt confirmați de practica manuală

Pe cele 9.472 SKU cu MAX manual atât la companie cât și pe filiale:

| Mărime | Medie |
|---|---|
| `MTRL.REMAINLIMMAX` (companie) | 11,92 |
| Σ `MTRBRNLIMITS.REMAINLIMMAX` (13 filiale) | 8,44 |
| `MTRBRNLIMITS(2200).REMAINLIMMAX` | 4,57 |

→ companie / Σ filiale = **1,41** vs. `HQ_CAP_FACTOR = 1.5`
→ București / companie = **38,3%** vs. `PROCENT_PODEA_BUC = 0.30`

Merită comunicat clientului: motorul reproduce practica existentă, nu o înlocuiește.

---

## 1. Pasul 0 — bug blocant în `sp_MinMaxEngine_Classify`

`new_min_max/sql/01_classify.sql` §3:

```sql
AND (w.COMPANY = @Company OR b.ESTE_HQ = 1)
```

Filiala 1000 trece filtrul `EXISTS` **doar** pentru că `WHOUSE` 1000 din compania **demo 1001** este activ (cel din compania 1000 are `ISACTIVE = 0`). Dacă cineva dezactivează acel depozit demo, HQ dispare tăcut din motor.

**Fix:** HQ este virtual, deci nu se testează deloc contra `WHOUSE`.

```sql
SELECT b.BRANCH, b.MARIME, b.ESTE_HQ, b.ESTE_PODEA
INTO #ActiveBranches
FROM CCCMINMAXBRANCH b
WHERE b.INCLUS = 1
    AND (
        b.ESTE_HQ = 1
        OR EXISTS (
            SELECT 1 FROM WHOUSE w
            WHERE w.CCCBRANCH = b.BRANCH
                AND w.COMPANY = @Company
                AND w.ISACTIVE = 1
        )
    );
```

**După fix:** `node new_min_max/tools/sync-check.cjs` → `/JS/NewMinMax/setup` → re-rulare `@Company=1000, @SummaryOnly=1`. Rezultatul așteptat este identic cu cel validat (713.370 rânduri, 14 filiale). Dacă diferă, oprește-te și raportează.

---

## 2. Decizii de închis înainte de a scrie procedura

Toate se rezolvă read-only (`S1_WRITE_MODE=off` nu blochează `SELECT`). Nu implementa `STOC_QTY` / `ORD_FURN` pe presupuneri.

| # | Întrebare | Opțiuni | Recomandare |
|---|---|---|---|
| **D1** | Sursa `STOC_QTY` | `MTRFINDATA.QTY1` per `WHOUSE` (folosit de `NecesarAchizitie.js`) vs. `MTRBALSHEET` `SUM(IMPQTY1−EXPQTY1)` (folosit de `Stocuri.js`, `sp_GetMtrlsDat.sql`) | `MTRFINDATA` — sursa modulului de achiziții. **Validează pe 5 SKU față de ecranul de stoc S1 înainte de a fixa.** |
| **D2** | `ORD_FURN` | `RESTCATEG = 1` prin `FNSOGETLINEPEND` (tiparul `getPending` din `NecesarAchizitie.js`) vs. `SOSOURCE=1151 / FPRMS=3153` | `RESTCATEG=1`. La comenzi de achiziție `SALESMAN=0`, deci atribuirea se reduce la `WHOUSE.CCCBRANCH` — confirmă pe date. |
| **D3** | `LAST_RECEIPT` | `SOSOURCE` pentru recepții de achiziție neconfirmat în repo | Dacă rămâne neclar: `DISC_FLAG = NULL`, **nu** `0`. Un fals „nu e discontinuat" e mai rău decât un necunoscut. |
| **D4** | Sentinela `VZ26_CAP = 9999` | valoare fixă moștenită din motorul Python | Devine parametru `VZ26_CAP_SENTINEL` (default `9999`, păstrează paritatea). Ca valoare fixă **capează real** orice SKU cu `MAX_inf > 9999` — plafon accidental. |
| **D5** | Normalizarea `TREND` | $2\,VZ_{13S}/VZ_{26S}-1$ vs. $VZ_{13S}/(VZ_{26S}-VZ_{13S})-1$ | Prima. Pragurile ±10% / −30% nu sunt invariante la alegere — de confirmat cu clientul. |

D1–D3 se închid de tine, prin interogări. D4–D5 se ridică la client.

**Nivelul companie (rândul HQ) nu are depozit**, deci:

- `STOC_QTY` HQ = **suma stocului național** peste filialele incluse
- `ORD_FURN` HQ = **total comenzi furnizor**, la nivel de companie
- `ERP_MIN` / `ERP_MAX` HQ = `MTRL.REMAINLIMMIN` / `MTRL.REMAINLIMMAX`
- `ERP_MIN_AUTO` / `ERP_MAX_AUTO` HQ = `MTRL.CCCMINAUTOCOMP` / `MTRL.CCCMAXAUTOCOMP`
- pe filiale, aceleași patru vin din `MTRBRNLIMITS`

---

## 3. Model matematic

### 3.1 Unități (verificate — nu le rederiva)

| Mărime | Unitate |
|---|---|
| `AVG` | buc/**lună** (toți termenii formulei sunt rate lunare) |
| `ad` = `AVG`/30 | buc/**zi** |
| `SIGMA_WK` | buc/**săptămână** (deja plancherat la `SIGMA_MIN`) |
| `COV_TGT`, `CAP_LUNI`, `ACOP_CUR` | **luni** |
| `LT_ZILE`, `FRECVENTA_ZILE` | **zile** |

### 3.2 Nivel rând — `(RUNID, BRANCH, MTRL)`

```
safety   = SIGMA_WK * SSF * SQRT(LT_ZILE / 7.0)
lt_stock = ad * LT_ZILE
slts     = lt_stock * (100.0 / SL - 1)
buf      = safety + slts + lt_stock

cycle    = CASE WHEN COV_TGT = 0 AND @CzCycleZero = 1 THEN 0                    -- E7
                ELSE MAX(AVG * COV_TGT, ad * FRECVENTA_ZILE) END

MAX_RAW  = CEILING(buf + cycle)
MAX_INF  = CASE WHEN ESTE_HQ = 1 THEN CEILING(MAX_RAW * @InflatieHq) ELSE MAX_RAW END
CAP6     = CEILING(AVG * @CapLuni)
VZ26_CAP = CASE WHEN VZ_26S > 0 THEN VZ_26S ELSE @Vz26CapSentinel END           -- WARN_VZ26_ZERO

ENG_MAX0 = MIN(MAX_INF, CAP6, VZ26_CAP)
ENG_MIN0 = MIN(MAX(CEILING(buf), MIN_DOC), ENG_MAX0)
```

**Scurtcircuit `OD`** (E1): `LIFECYCLE = 'OD'` → `ENG_MIN = ENG_MAX = BUY_QTY = 0`, explicit. Formula ajunge acolo oricum prin `CAP6 = 0`, dar scurtcircuitul elimină dependența de `AVG = 0` și împiedică planșeul `SIGMA_MIN = 1.3` să producă `buf > 0` pe un articol declarat fără cerere.

**Gărzi de împărțire la zero, toate obligatorii:** `SL` (→ `100/SL`), `AVG` (→ `ACOP_CUR`), `ERP_MAX` (→ `FLAG_RATIO`), `N_PACK` (→ pack), `VZ_26S` (→ `TREND`). `NULLIF` + `COALESCE` cu valoare neutră explicită.

### 3.3 Post-procesare — ordinea este obligatorie

**Pas 1 — HQ CAP**

```
SUM_BR_MAX(MTRL) = SUM(ENG_MAX0) peste filialele cu ESTE_HQ = 0

IF SUM_BR_MAX > 0 AND ENG_MAX_HQ > SUM_BR_MAX * @HqCapFactor
    ENG_MAX_HQ = CEILING(SUM_BR_MAX * @HqCapFactor);  HQ_CAP_APLICAT = 1

ENG_MIN_HQ = MIN(ENG_MIN_HQ, ENG_MAX_HQ)      -- re-clamp, ABSENT din §2.4 al planului
```

Re-clamp-ul nu e opțional: fără el, caparea poate lăsa `MIN > MAX` pe rândul HQ — exact inconsistența pe care E11/E12 o elimină la podea.

**Pas 2 — Podea (`ESTE_PODEA = 1`), doar unde `ENG_MIN_HQ > 0`**

```
P = CEILING(ENG_MIN_HQ * @ProcentPodeaBuc)

IF ENG_MIN_P < P
    ENG_MIN_P = P;  PODEA_APLICATA = 1

IF ENG_MIN_P > ENG_MAX_P
    ENG_MAX_P = ENG_MIN_P            -- E11/E12: egalitate STRICTĂ, nu MAX(...)
```

Set-based, ca să suporte N filiale-podea. `SUM_BR_MAX` rămâne **snapshot pre-podea**, intenționat — ordinea din spec (HQ CAP → podea) rupe circularitatea „podea ridică `ENG_MAX_BUC` → crește `SUM_BR_MAX` → relaxează capul HQ". De documentat în comentariu, nu de corectat.

**Pas 3 — `BUY_QTY`**

```
N_PACK   = CASE WHEN ISNULL(MTRL.MTRPACK, 0) <= 0 THEN 1 ELSE MTRL.MTRPACK END
BUY_RAW  = MAX(0, ENG_MAX - MAX(0, STOC_QTY) - ORD_FURN)                        -- E10
BUY_QTY  = CEILING(BUY_RAW / N_PACK) * N_PACK                                   -- E13
```

> ⚠️ **Corecție față de `PLAN_IMPLEMENTARE.md` §2.4:** acolo `BUY_QTY` apare în blocul de formule pe rând, *înaintea* post-procesării. Este imposibil — `ENG_MAX` se schimbă la HQ CAP (pasul 1) și la podea (pasul 2). `BUY_QTY` se calculează obligatoriu **după** pasul 2.

### 3.4 Indicatori de raportare

```
ACOP_CUR   = STOC_QTY / AVG                                    -- luni
FLAG_RATIO = ENG_MAX / ERP_MAX,  ERP_MAX = MAX_MANUAL (F10)
TREND_PCT  = 2.0 * VZ_13S / VZ_26S - 1                         -- D5
DISC_FLAG  = CASE WHEN DATEDIFF(DAY, LAST_RECEIPT, AZI) > 365 THEN 1 ELSE 0 END
```

| `FLAG_RATIO` | `FLAG_TXT` |
|---|---|
| 0,77 – 1,30 | `OK` |
| 1,30 – 2,00 | `UP` |
| 0,50 – 0,77 | `DOWN` |
| > 2,00 | `MAJOR_UP` |
| < 0,50 | `SUPRASTOC` |
| `ERP_MAX = 0` / lipsă | `FARA_REFERINTA` |

`FARA_REFERINTA` nu e cosmetic: fără el, cele ~2,89 mil SKU fără MAX manual ajung toate în `MAJOR_UP` și raportul devine inutilizabil.

`STATUS_TREND`: `ACTIVE` > +10% · `STABLE` [−10%, +10%] · `TREND_DOWN` [−30%, −10%) · `DECLINE` < −30%; `VZ_26S = 0` → `DECLINE`.

---

## 4. Arhitectura procedurii

### 4.1 Semnătură

```sql
CREATE OR ALTER PROCEDURE dbo.sp_MinMaxEngine_Compute
    @Company     SMALLINT,
    @RunId       INT,            -- obligatoriu; sursa = CCCMINMAXDET
    @Mtrl        INT  = NULL,    -- filtru de smoke test
    @SummaryOnly BIT  = 0,
    @Persist     BIT  = 0        -- 0 = returnează setul, 1 = UPDATE în CCCMINMAXDET
```

**Precondiții** (altfel `THROW`): `RUNID` există, `COMPANY = @Company`, `STATUS = 'DONE'`, `FAZA IN ('CLASSIFY','COMPUTE')`. Re-rularea pe același `RUNID` este idempotentă — nu se creează rulare nouă, clasificarea e aceeași.

### 4.2 Pipeline

```
1. Validare @RunId + citire parametri
   INFLATIE_HQ, HQ_CAP_FACTOR, CAP_LUNI, PROCENT_PODEA_BUC, CZ_CYCLE_ZERO,
   VZ26_CAP_SENTINEL   (+ COALESCE-uri defensive, exact ca în Classify §1)

2. #Src        ← CCCMINMAXDET WHERE RUNID=@RunId [AND MTRL=@Mtrl]
                 clustered index (BRANCH, MTRL)
3. #Stock      ← stoc per (BRANCH, MTRL)         -- D1; HQ = suma națională
4. #PendingSup ← ORD_FURN per (BRANCH, MTRL)     -- D2; HQ = total companie
5. #ErpLimits  ← MTRBRNLIMITS (filiale) + MTRL (HQ) + flags + MTRPACK + LAST_RECEIPT

6. #Calc       ← calcul pe rând (§3.2), join cu 3/4/5

7. Post-procesare ÎN #Calc, în ordine:
   7a. HQ CAP + re-clamp ENG_MIN_HQ
   7b. Podea (set-based)
   7c. BUY_RAW + rotunjire N_PACK
   7d. Indicatori de raportare + WARN_*

8. IF @Persist = 1:
      UPDATE CCCMINMAXDET SET ... FROM #Calc JOIN ON (RUNID,BRANCH,MTRL)   -- O SINGURĂ trecere
      UPDATE CCCMINMAXRUN SET FAZA='COMPUTE', COMPUTE_STATUS='DONE', ...
      BEGIN CATCH → COMPUTE_STATUS='ERROR' + THROW, cu garda XACT_STATE() <> -1

9. @SummaryOnly = 1 → rapoarte de integritate; altfel → setul complet
```

> **Decizia de performanță centrală:** toată post-procesarea stă în `#Calc`; `CCCMINMAXDET` se atinge o **singură dată**. Varianta naivă — patru `UPDATE`-uri succesive direct pe tabel — înseamnă 4 treceri × ~713.000 rânduri × ~30 coloane, cu logare completă la fiecare pas.

### 4.3 Extinderi de schemă — `new_min_max/sql/00b_persist.sql`

Fiecare coloană se adaugă în **două** locuri: `CREATE TABLE` (instalări noi) **și** secțiunea de aliniere `INFORMATION_SCHEMA` (instalări existente — DDL-ul e `IF NOT EXISTS`, tabelele nu se auto-alterează).

**`CCCMINMAXRUN`** — faza compute nu are voie să calce peste auditul clasificării:

```
COMPUTE_STATUS VARCHAR(10) NULL, COMPUTE_STARTEDAT DATETIME NULL,
COMPUTE_FINISHEDAT DATETIME NULL, COMPUTE_DURATA_SEC INT NULL,
COMPUTE_PARAMSJSON NVARCHAR(MAX) NULL, COMPUTE_ERRORMSG NVARCHAR(500) NULL
```

`FAZA` avansează `CLASSIFY → COMPUTE` (ultima fază încheiată).

**`CCCMINMAXDET`** — coloane noi, aceeași granularitate, fără tabel nou:

| Grup | Coloane |
|---|---|
| Snapshot ERP | `STOC_QTY`, `ORD_FURN`, `N_PACK`, `ERP_MIN`, `ERP_MAX`, `ERP_MIN_AUTO`, `ERP_MAX_AUTO`, `LAST_RECEIPT`, `ARE_POZITIE_ERP` |
| Flags externe | `FLAG_LICHIDARE` (`MTRL.CCCITEMOUTLET`), `FLAG_BLOCAT` (`MTRL.CCCBLOCKPUR`), `FLAG_EXCLUS` (`MTRL.CCCEXSTAT`) |
| Intermediari | `SAFETY`, `LT_STOCK`, `SLTS`, `BUF`, `CYCLE`, `MAX_RAW`, `MAX_INF`, `CAP6`, `VZ26_CAP`, `SUM_BR_MAX` |
| Rezultat | `ENG_MIN`, `ENG_MAX`, `BUY_RAW`, `BUY_QTY`, `HQ_CAP_APLICAT`, `PODEA_APLICATA` |
| Raportare | `ACOP_CUR`, `FLAG_RATIO`, `FLAG_TXT`, `TREND_PCT`, `STATUS_TREND`, `DISC_FLAG` |
| Warnings | `WARN_VZ26_ZERO`, `WARN_STOC_NEG`, `WARN_STOC_MORT` |

Tipuri: cantități și rapoarte `DECIMAL(28,8)`; bit-uri `BIT`; text `VARCHAR(n)` explicit (nu `NVARCHAR` — restul tabelului e `VARCHAR`).

Numele `STATUS` și `FLAG` sunt evitate deliberat: `STATUS` se ciocnește semantic cu `CCCMINMAXRUN.STATUS`, iar `FLAG` e ambiguu față de `FLAG_LICHIDARE`.

Coloanele intermediare nu sunt lux: fără ele, un `ENG_MAX` contestat de client nu poate fi explicat decât re-rulând motorul cu breakpoint-uri.

**`CCCMINMAXPARAMS`** — cheie nouă în seed-ul din `00_params.sql`:

```
('VZ26_CAP_SENTINEL', '9999', 'NUM', 'GLOBAL', '', 'Plafon aplicat cand VZ_26S = 0 (D4)')
```

---

## 5. Fișiere de atins

| Fișier | Ce |
|---|---|
| `new_min_max/sql/01_classify.sql` | **Pasul 0** — fix eligibilitate HQ (§1) |
| `new_min_max/sql/00_params.sql` | seed `VZ26_CAP_SENTINEL` |
| `new_min_max/sql/00b_persist.sql` | ~35 coloane noi × 2 locuri (`CREATE TABLE` + aliniere) |
| `new_min_max/sql/03_compute.sql` | **nou** — procedura, ~500–600 linii |
| `S1-MEC/AJS/NewMinMax.js` | `getComputeSql()` + înregistrare în `setup()` |
| `new_min_max/tools/sync-check.cjs` | extindere la al 5-lea bloc SQL |

`S1-MEC/AJS/NewMinMax.js` și `external/MEC/SyncItalia/S1/AJS/NewMinMax.js` sunt **același inode** (hardlink) — editezi unul, se actualizează ambele. Fără `cp`.

---

## 6. Capcane specifice

1. **`MIN`/`MAX` scalar nu există** în T-SQL sub SQL Server 2022 (`LEAST`/`GREATEST`). Minim în 3 termeni: `(SELECT MIN(v) FROM (VALUES (a),(b),(c)) t(v))`.
2. **Podea nu inserează rânduri.** În `Classify`, `#WeeklySeries` = `#Items CROSS JOIN #ActiveBranches` — fiecare SKU are deja rând pe fiecare filială inclusă. „Crearea codului dacă lipsește" (E20) e o problemă de `MTRBRNLIMITS` la `applyToErp`, nu de `CCCMINMAXDET`. Aici se marchează doar `ARE_POZITIE_ERP = 0`.
3. **`sync-check.cjs` după fiecare editare SQL** (`node new_min_max/tools/sync-check.cjs`), altfel oglinda din AJS divergează silențios. `sql-to-js.cjs <fisier>` generează forma JS.
4. **Verificare prin s1-api cu `CONVERT(VARCHAR, …)`** pe orice zecimal — altfel `COV_TGT`, `FLAG_RATIO`, `CV` se citesc rotunjite la întreg.
5. **„Database explorer" din S1 rulează doar o instrucțiune** și nu afișează result set pentru un batch `DECLARE`/`EXEC`. Verifică rezultatele cu `SELECT`-uri separate prin s1-api MCP.
6. **s1-api MCP:** `s1_login` → `s1_authenticate` (company 1000, branch 1000, refid 104) înainte de orice query.

---

## 7. Plan de validare

1. **Smoke test** pe `@Mtrl = 1360919`, `@RunId` existent (1 sau 2), `@Persist = 0` → verificare manuală a celor 14 rânduri: `buf`, `cycle`, `ENG_MIN`, `ENG_MAX`, `BUY_QTY`.
2. **Verificare HQ CAP**: pe un SKU cu `ENG_MAX_HQ` mare, confirmă `ENG_MAX_HQ <= SUM_BR_MAX * 1.5` și că `ENG_MIN_HQ <= ENG_MAX_HQ` după re-clamp.
3. **Verificare podea**: pe un SKU cu `ENG_MIN_HQ > 0`, confirmă `ENG_MIN_2200 >= CEILING(ENG_MIN_HQ * 0.30)` și `ENG_MAX_2200 >= ENG_MIN_2200`.
4. **Rulare completă** `@Persist = 1, @SummaryOnly = 1` pe `RUNID` nou din `Classify`. Verificări de integritate așteptate — toate zero:
   - `ENG_MIN > ENG_MAX`
   - `ENG_MIN < 0` sau `ENG_MAX < 0` sau `BUY_QTY < 0`
   - `LIFECYCLE = 'OD'` cu `ENG_MAX <> 0`
   - `BUY_QTY % N_PACK <> 0`
   - `NULL` pe `ENG_MIN` / `ENG_MAX` / `BUY_QTY`
5. **Calibrare `FLAG`**: distribuția `FLAG_TXT` pe cele ~10.000 SKU cu `ERP_MAX <> 0`. Pragul de accept „>80% `OK`" din spec a fost calibrat pe proxy-ul `σ = AVG × 0.30` și **trebuie recalibrat** pe `SIGMA_WK` real înainte de a fi folosit ca criteriu.

---

## 8. Ce rămâne pentru client

- **D4** — sentinela `VZ26_CAP`: 9999 capează accidental SKU-urile cu cerere mare.
- **D5** — normalizarea `TREND` și pragurile ±10% / −30%.
- **Formula ABC pe grupă** (Faza 2b, §3.3.1) — încă deschisă.
- **Cererea filialelor închise**: 2300/2400/2600/2900 poartă **7,25 mil RON (5,7%)** de cerere atribuită în modul `CLIENT`, pe care `#IncludedLines` o elimină prin `INNER JOIN #ActiveBranches`. Dispare din **ambele** agregate, inclusiv din cel de companie care conduce achiziția de la furnizori → ținta națională e subdimensionată cu ~5,7%. De decis: reatribuire către filiala care servește azi, sau măcar includere în agregatul de companie.
- **`COV_MEDIU`**, **`LT_ZILE`**, **`FRECVENTA_ZILE`** — încă pe fallback.

---

## 9. Cerință de transparență — wiki HTML în aplicație

**Cerință (03.09.2026):** toate formulele și deciziile din `Compute` și fazele conexe se publică într-un **wiki HTML atașat aplicației**, pentru transparență față de utilizator.

### 9.1 Tiparul existent în repo

`public/help/zero-minmax-help.html`, încărcat prin `<iframe>` într-un modal Bootstrap din `public/components/zero-minmax/zero-minmax-panel.js`. Wiki-ul MIN/MAX urmează același tipar: `public/help/minmax-engine-help.html`, buton de ajutor în `minmax-engine-container.js` (Faza 5).

### 9.2 Riscul principal — divergența

Formulele ar ajunge în **trei** locuri: procedura SQL, acest handoff, wiki-ul HTML. Wiki-ul e singurul pe care utilizatorul îl citește și îl crede. Un wiki desincronizat este mai rău decât lipsa lui: îl consulți **tocmai** ca să nu verifici codul.

Repo-ul are deja disciplina potrivită — `new_min_max/tools/sync-check.cjs` verifică linie cu linie SQL-ul embedat în AJS față de `sql/*.sql`. Aceeași abordare:

- sursă unică structurată în `new_min_max/wiki/` (blocuri de formule + tag-uri de provenență)
- generator `new_min_max/tools/wiki-gen.cjs` → `public/help/minmax-engine-help.html`
- wiki-ul **nu** se editează direct; se regenerează

### 9.3 Parametrii se citesc live, nu se hardcodează

`SSF`, `SL_A/B/C`, `INFLATIE_HQ`, `HQ_CAP_FACTOR`, `CAP_LUNI`, `PROCENT_PODEA_BUC`, matricea `CCCMINMAXCOV` sunt **editabile de client** din UI. Un wiki care scrie „SSF = 1,28" în timp ce `CCCMINMAXPARAMS` conține 1,40 dezinformează activ.

→ Wiki-ul afișează formulele **simbolic**, iar valorile curente se injectează din `getParams` la deschidere. Ce e static: structura formulei și decizia. Ce e dinamic: valoarea parametrului.

### 9.4 Transparența reală = drill-down pe rând, nu pagina statică

Coloanele intermediare din §4.3 (`SAFETY`, `LT_STOCK`, `SLTS`, `BUF`, `CYCLE`, `MAX_RAW`, `MAX_INF`, `CAP6`, `VZ26_CAP`, `SUM_BR_MAX`) au fost proiectate pentru auditabilitate. Cu cerința de transparență ele devin **mecanismul**, nu un lux:

- pagina de wiki spune *care e formula*
- drill-down-ul „explică acest calcul" pe rândul din grilă spune *de ce acest SKU a primit 47*, substituind valorile reale în formulă

A doua parte convinge utilizatorul; prima doar îl informează. Nu tăia coloanele intermediare la vreo optimizare de spațiu.

### 9.5 Provenența deciziilor se păstrează

`SUMAR_TEORETIC_CONFIRMARE.md` folosește deja identificatori (`I` ipoteză, `F` formulă, `E` caz-limită, `L` lacună) și tag-uri de sursă (`[S]` spec, `[E]` extern, `[D]` documentele noastre). Wiki-ul le poartă mai departe: un utilizator care citește „la podea, `MAX` devine egal cu `MIN`" trebuie să vadă **E11/E12, confirmat de client 14.08.2026** — altfel pare un bug al motorului.

### 9.6 Randarea matematicii — decizie deschisă (D6)

Nu există `katex` / `mathjax` în proiect. Wiki-ul rulează în `<iframe>`, într-o rețea ERP posibil izolată → **CDN-ul e o dependență fragilă**. Opțiuni: KaTeX bundle-uit local, sau **MathML pre-randat** la generare (nativ în browser, zero dependențe runtime, funcționează offline). Recomandare: MathML pre-randat.

> Wiki-ul se construiește în **Faza 5** (UI), dar sursa de conținut se scrie **acum**, pe măsură ce se implementează `Compute`. Fiecare bloc de formulă din `03_compute.sql` primește comentariul cu identificatorul (`E7`, `E10`, `E11/E12`, `E13`, `F10`) care va deveni ancora din wiki.

