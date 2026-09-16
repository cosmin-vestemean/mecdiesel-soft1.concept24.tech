# MIN/MAX: restanțe interne (nu necesită beneficiarul)

Data ultimei actualizări: 16.09.2026.

**Ce conține**: puncte în care cerința beneficiarului este deja declarată — în `SPEC_MINMAX_v5_implementare.docx` (S), în `config_minmax.docx` (C) sau confirmată în runda din august — iar codul deviază sau nu o implementează. Nu există decizie de business de luat; este muncă rămasă la noi. Zonele Z0/Z1 din [PLAN_ALINIERE_2026-09-10.md](10.09.2026/PLAN_ALINIERE_2026-09-10.md) §1.

**Ce nu conține**: orice punct unde septembrie contrazice august sau unde specificația tace. Acelea sunt în [INTREBARI_BENEFICIAR.md](INTREBARI_BENEFICIAR.md) și nu se implementează prin default ales de noi.

**Regulă**: un rând iese de aici numai când este implementat, validat pe o rulare și consemnat cu RUNID-ul probei. Valoarea efectivă a oricărui parametru apare în foaia PARAMETRI a rulării — nimic nu se adoptă tacit.

## Închise

| ID | Subiect | Autoritate | Probă |
| --- | --- | --- | --- |
| P1 | Netting independent per (SKU, scope, client, fereastră); seria săptămânală rămâne separată pentru sigma | I3 ✅ 14.08 + S 4.4 | RUNID 12 |
| P2 | HQ este scope propriu al cererii: compensare pe același client între filiale înainte de clip | I5/I6 + S 2 | RUNID 12, 0 abateri pe 50.565 rânduri |
| P3 | ABC pe populația STANDARD, cumul inclusiv, tie-break pe CODE | I0 3.3 + S 4.8 | RUNID 11 |
| P5 | `LIFECYCLE='OD'` ⇒ `BUY_RAW = BUY_QTY = 0`, inclusiv după podea | E1 ✅ 14.08 + S 4.7 + X | RUNID 15: 2.945 rânduri → 0; toate erau BUCUREȘTI cu `PODEA_APLICATA=1` |
| P7 | Praguri și ponderi citite din snapshot, nimic hardcodat | ambele runde | RUNID 11 |
| P8 | `SIGMA_MIN = 0` valid și distinct de absent | A2, partea de implementare | RUNID 11 |
| P11 | TREND pe `13S/52S` (S 7), parametrizat prin `TREND_BAZA`; NOU/OD au status propriu | S 7 explicit; august avea 13S/26S doar în text, fără marcaj de decizie | RUNID 16: `TREND_BAZA='13_52'` în snapshot, 0 abateri pe 708.554 rânduri |
| D15a | `SAPT_FARA = round(zile de la ULT_VANZ / 7)`, simetric SKU/grupă | S 4.6 | RUNID 15, 0 abateri — dar vezi nota de calendar |
| — | `ClassifyGroup`: `NR_SKU_GRP` pe populația filtrată | perimetru confirmat 08.09 | RUNID 7: 504/602 → 0/602 |

> Nota de calendar (D15a): `DATEDIFF(WEEK, …)` și `round(zile/7)` coincid **exact când AZI cade miercurea** (0/365 lag-uri diferă; 52/365 marți-joi, 104/365 luni-vineri, 156/365 sâmbătă-duminică). RUNID 15 are `AZI=2026-09-16`, miercuri, deci proba live nu putea arăta diferența. Nu deduce de aici că formula veche era echivalentă.

> Nota de efect (P11), măsurată 15 → 16 pe `AZI` identic: pe cele 25.367 rânduri `STANDARD` în ambele rulări, **7.875 (31,0%) schimbă `STATUS_TREND`** — schimbarea bazei nu este cosmetică. Migrarea nu are un sens unic: 2.336 `STABLE → ACTIVE`, dar și 504 `STABLE → DECLINE` și 589 `STABLE → TREND_DOWN`. Separat, prioritatea lifecycle mută 682.472 rânduri `OD` pe `OK` și 705 `NOU` pe `NOU`; pe RUNID 15 acestea apăreau ca `DECLINE`.

> Consecință de citit înainte de a interpreta coloana: `STATUS_TREND='OK'` acoperă acum **96% din populație**, fiindcă 682.472 din 708.554 de rânduri sunt `OD`. Coloana Trend a devenit în practică un indicator de lifecycle, nu un discriminator de cerere. Este exact ce declară S 7 și nu am corectat-o, dar filtrarea utilă se face pe `LIFECYCLE='STANDARD'` împreună cu Trend, nu pe Trend singur.

## Deschise, în ordinea dependențelor

| # | ID | Subiect | Autoritate | Ce lipsește | Dependențe / risc |
| --- | --- | --- | --- | --- | --- |
| 1 | N04a | Ferestre VZ în zile calendaristice (28/91/182/365) | S 4.2; august I1 ✅ / I12 ✅ | **Închis și probat live.** RUNID 17 (`FERESTRE_VZ='ZILE'`) și RUNID 18 (`FERESTRE_VZ='SAPT'`), ambele `AZI=2026-09-16`, aceeași populatie 716.240 rânduri/51.160 itemi între ele | Calibrarea RUNID 16 încetează să fie reper direct pentru RUNID ≥ 17 |
| 1b | N04b | σ pe exact 52 de bucket-uri egale; `SAPT_VZ` pe săptămâni ISO | S 5.1 (52 bucket-uri) + S 4.6 (ISO) | Despărțirea grilei săptămânale în două: `WEEK_BUCKET` (7 zile rolling, pentru σ și lunile 4-4-5) și `ISO_WEEK` (pentru `SAPT_VZ`/`SAPT_8S`) | **Contaminat de punctul 8 din documentul beneficiarului**: atinge `SAPT_VZ`, exact mărimea despre care e întrebat. Regula nu se schimbă, dar baza de măsurare da. De făcut secvențial, nu simultan |
| 1c | — | Simetria ferestrelor în `ClassifyGroup` | aceeași ca N04a | Grupele rămân pe ferestre săptămânale cât timp SKU-urile trec pe zile | Asimetrie temporară asumată: pe RUNID 18, `VZ` de grupă nu se mai reconciliază cu suma SKU-urilor. RUNID 17 nu e afectat (ambele pe săptămâni) |
| 2 | P6b | Resolver longest-prefix pentru `LT_ZILE`/`FRECVENTA_ZILE`, cu normalizarea spațiilor | S 3.8 + tabelul de parametri din august („LT per prefix furnizor") | Mecanismul; `BRANCH > GLOBAL` e deja live | **Doar mecanismul.** Lista și valorile DEFAULT sunt N01/N02 → document beneficiar |
| 3 | P4 | Univers per scope prin uniuni (stoc, limite ERP, manual, vânzări) în loc de „numai vânzări" | S 4.1 | `#Items` se construiește exclusiv din liniile de vânzare | Cea mai mare schimbare structurală; crește `CCCMINMAXDET` (azi ~700 MB per sesiune, 96% din spațiu) și durata rulării. Articolele doar în transfer intră automat, fiindcă `STOC_QTY` include transferul |
| 4 | P13 | `MIN_DOC` per scope, nu global pe companie | S 4.6 („per SKU și scope") | Azi e calculat per `MTRL` și copiat tuturor filialelor | **După P4.** Numai varianta literală; corecțiile de robustețe sunt propunerea noastră → document beneficiar |
| 5 | P15 | Indicatori și livrabile declarate, absente: `ALTREF`, `STOC_TOTAL_ALTREF` per scope, `COST_MED_RON`/`STOC_VAL_EUR`/`BUY_VALUE_EUR` cu lanțul de fallback, cele 41 de coloane, SUMMARY cu HQ separat, raportul obligatoriu de rulare | S 7, S 8, S 9 | Tot blocul | Raportul S 8 este și vehiculul prin care declarăm ce default am folosit la fiecare punct de mai sus |
| 6 | P10 | `STOC_NEG_CA_ZERO` expus ca parametru, păstrând comportamentul actual | E10 (august, propunere) = comportamentul de azi; S 5.6 e formula literală fără clamp | Doar parametrul + apariția în PARAMETRI | Nu schimbă nimic numeric; face alternativa o decizie vizibilă, nu una ascunsă în cod |
| 7 | — | Schelet de parametri pentru răspunsurile așteptate: `Z_A/Z_B/Z_C/Z_NOU`, `SL_NOU`, `FLAGS_MODE`, `CZ_CYCLE_ZERO` legat de `CLASA` | pregătire pentru A1/A4/B2/N06 | Seed idempotent cu valorile de azi | Zero efect numeric; transformă răspunsul beneficiarului într-o editare de configurare, nu într-un commit |

> Nota de diagnostic (N04a), de citit înainte de a interpreta rularea de probă: marginea dreaptă a ferestrei era o zi exactă (`AZI`), dar cea stângă era cuantizată la duminică de `DATEDIFF(WEEK, …)`. Ferestrele efective erau deci **sistematic mai scurte** decât cele declarate, cu `6 − index_zi` zile, și variau cu ziua în care cade `AZI`: `VZ_4S` acoperea **22–28 de zile**, nu 28. Deficitul relativ e invers proporțional cu lungimea ferestrei, deci lovea cel mai tare exact fereastra cu ponderea cea mai mare în `AVG` (`AVG_WEIGHT_4S = 0,30`). Pentru `AZI` miercuri, la cerere uniformă, `AVG` ar trebui să crească cu ~5,4%, deci `MIN`/`MAX`/`BUY` cresc pe tot portofoliul, iar `FLAG_RATIO` se mută spre `UP`. **Aceasta este predicția falsificabilă a lui RUNID 18**: dacă `AVG` nu crește, predicatul nu s-a aplicat.

> Nota de protocol (N04a): cele două cauze se separă cu `FERESTRE_VZ`, care **nu** este o replică a comportamentului vechi, ci un martor. RUNID 17 rulează cu `FERESTRE_VZ='SAPT'`: populația sursei e deja la 365 de zile, dar predicatul rămâne pe săptămâni, deci izolează **cauza A** — plafoanele p95, `MIN_DOC` și articolele intrate în univers, care se propagă mai departe în `SIGMA_WK`/`SAPT_VZ`/XYZ. RUNID 18 comută pe `'ZILE'` și izolează **cauza B**, predicatul. Așteptarea e ca 17 să fie aproape plat și 18 să miște portofoliul; inversul înseamnă că ceva nu s-a aplicat.

> Nota de perimetru (N04a): plafoanele de winsorizare, `#Items` și `MIN_DOC` se calculează deliberat pe întreaga populație de 365 de zile, nu pe cele 52 de bucket-uri. Este lectura literală a lui S 4.5 — o singură populație winsorizată, după excluderi și înaintea ferestrelor. Consecința asumată: „seria săptămânală nu se schimbă" este adevărat pentru **grila** de bucket-uri, nu pentru **populația** care o alimentează; σ și XYZ se pot mișca indirect, prin plafoane. De aceea cauza A se măsoară separat.
> **Rezultat măsurat, RUNID 16 → 17/18, cauzele separate** (16.09.2026). Validator: RUNID 18 (`SAPT`) 13/13 PASS; RUNID 17 (`ZILE`) 12/13 — `ferestre_zile` semnalează 8 abateri din 665.080 perechi (0,0012%), verificate individual: diferențe de 1–4 bucăți, 7 din 8 cu valoare live mai mare decât cea înghețată, semnătura documentelor introduse în ERP după `Classify` cu dată în interiorul ferestrei, fără să mute `MAX(TRNDATE)`. Nu e regresie, e exact avertismentul din `label`-ul invariantei.
>
> **Cauza A** (RUNID 16 → 18, populație + winsor; 18 și 17 au aceeași populație — 716.240 rânduri, 51.160 itemi — deci comparația e izolată curat): `AVG` +0,49%, `ENG_MIN` +0,27%, `ENG_MAX` +0,33%, `BUY_QTY` +0,57%. Aproape plat, cum era de așteptat.
>
> **Cauza B** (RUNID 18 → 17, predicatul zile, populație identică): `AVG` +4,38% (predicție ~5,4%, diferența vine din cererea reală neuniformă), `ENG_MIN` +2,07%, `ENG_MAX` +2,79%, `BUY_QTY` +5,21%. `FLAG_TXT` migrează net spre `UP` (351 intră, 70 ies) și din `DOWN` (404 ies, 120 intră), pe cele 31.907 rânduri cu `ERP_MAX > 0`. Direcția prezisă în plan se confirmă.
>
> Calibrarea C se mișcă nesemnificativ pe banda largă: 43,4% (RUNID 16) → 43,4% (18) → 43,5% (17) — benzile de acceptanță sunt prea largi ca să arate o mișcare de ~4-5% pe `AVG`; direcția se vede în `FLAG_TXT`, nu în procentul agregat.
> Nota de unitate (P11): `TREND_PCT` rămâne **fracție** pe ambele baze, ca până acum; pragurile `+0,10 / −0,10 / −0,30` sunt citite în aceeași unitate. S 7 scrie formula înmulțită cu 100, dar alegerea unității nu este marcată nicăieri ca decizie, deci nu se schimbă tacit odată cu baza. `VZ_13S = 0 ⇒ DECLINE` rezultă din formulă (−1), nu dintr-o ramură separată.

## Constrângeri care se aplică tuturor

- Orice element de mai sus produce **RUNID nou**; sesiunile sunt imutabile. Calibrarea rulării anterioare încetează să fie reper direct.
- Plafonul ADO de 60 s al lui `X.RUNSQL` **nu se mai aplică fazelor**: `runPhases` doar pornește jobul `MEC_MinMaxEngine_RunPhases_<company>`, iar `Classify → ClassifyGroup → Compute → FinishRun` rulează sub SQL Server Agent. Dovada: RUNID 15 are Classify la 148 s. Plafonul rămâne valabil numai pentru apelurile sincrone din AJS — `setup()`, `StartRun`, `explain`/preview, `PurgeRun` — deci acolo nu se adaugă lucru greu.
- Limita reală pentru punctele 2 și 4 este **durata și volumul rulării** (tempdb, dimensiunea `CCCMINMAXDET`, fereastra de backup), nu un plafon de execuție.
- După orice editare SQL: `node new_min_max/tools/sync-check.cjs`; deploy AJS manual (MCP-ul `s1-api` este read-only prin design).
- Fiecare punct închis primește o invariantă în `new_min_max/tools/validate-minmax-invariants.cjs` și un test de contract în `test/tools/validate-minmax-invariants.test.js`.
