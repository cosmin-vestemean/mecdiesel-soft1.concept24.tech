# MIN/MAX: restanțe interne (nu necesită beneficiarul)

Data ultimei actualizări: 16.09.2026.

**Ce conține**: puncte în care cerința beneficiarului este deja declarată — în `SPEC_MINMAX_v5_implementare.docx` (S), în `config_minmax.docx` (C) sau confirmată în runda din august — iar codul deviază sau nu o implementează. Nu există decizie de business de luat; este muncă rămasă la noi. Zonele Z0/Z1 din [PLAN_ALINIERE_2026-09-10.md](10.09.2026/PLAN_ALINIERE_2026-09-10.md) §1.

**Ce nu conține**: orice punct unde septembrie contrazice august sau unde specificația tace. Acelea sunt în [INTREBARI_BENEFICIAR.md](INTREBARI_BENEFICIAR.md) și nu se implementează prin default ales de noi.

**Regulă**: un rând se marchează închis numai când este implementat, validat pe o rulare și consemnat cu RUNID-ul probei. Valoarea efectivă a oricărui parametru apare în foaia PARAMETRI a rulării — nimic nu se adoptă tacit.

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
| N04a | Ferestre VZ în zile calendaristice (28/91/182/365) | S 4.2; august I1 ✅ / I12 ✅ | RUNID 17/18, cauze separate; efectul predicatului reconfirmat independent pe 20 → 21 și 22 → 24 |
| N04b | σ pe exact 52 de bucket-uri egale; `SAPT_VZ` pe săptămâni ISO | S 5.1 (52 bucket-uri) + S 4.6 (ISO) | RUNID 19–25, factorială completă pe trei axe; la închiderea N04b producția era RUNID 25 |
| D15a | `SAPT_FARA = round(zile de la ULT_VANZ / 7)`, simetric SKU/grupă | S 4.6 | RUNID 15, 0 abateri — dar vezi nota de calendar |
| — | `ClassifyGroup`: `NR_SKU_GRP` pe populația filtrată | perimetru confirmat 08.09 | RUNID 7: 504/602 → 0/602 |
| 1c | Simetria ferestrelor **și a grilei** în `ClassifyGroup` | aceeași ca N04a + S 5.1 | RUNID 26: 16/16 invariante PASS; SUM(CCCMINMAXDET.VZ_4S/13S/26S/52S, VAL_52S)=CCCMINMAXGRP: 0/602 diferențe vs 313/602 RUNID 25; snapshot RUNID 25/26 identic, SKU bit-cu-bit identic |

> Nota de calendar (D15a): `DATEDIFF(WEEK, …)` și `round(zile/7)` coincid **exact când AZI cade miercurea** (0/365 lag-uri diferă; 52/365 marți-joi, 104/365 luni-vineri, 156/365 sâmbătă-duminică). RUNID 15 are `AZI=2026-09-16`, miercuri, deci proba live nu putea arăta diferența. Nu deduce de aici că formula veche era echivalentă.

> Nota de efect (P11), măsurată 15 → 16 pe `AZI` identic: pe cele 25.367 rânduri `STANDARD` în ambele rulări, **7.875 (31,0%) schimbă `STATUS_TREND`** — schimbarea bazei nu este cosmetică. Migrarea nu are un sens unic: 2.336 `STABLE → ACTIVE`, dar și 504 `STABLE → DECLINE` și 589 `STABLE → TREND_DOWN`. Separat, prioritatea lifecycle mută 682.472 rânduri `OD` pe `OK` și 705 `NOU` pe `NOU`; pe RUNID 15 acestea apăreau ca `DECLINE`.

> Consecință de citit înainte de a interpreta coloana: `STATUS_TREND='OK'` acoperă acum **96% din populație**, fiindcă 682.472 din 708.554 de rânduri sunt `OD`. Coloana Trend a devenit în practică un indicator de lifecycle, nu un discriminator de cerere. Este exact ce declară S 7 și nu am corectat-o, dar filtrarea utilă se face pe `LIFECYCLE='STANDARD'` împreună cu Trend, nu pe Trend singur.

## Deschise, în ordinea dependențelor

| # | ID | Subiect | Autoritate | Ce lipsește | Dependențe / risc |
| --- | --- | --- | --- | --- | --- |
| 1 | P6b | Resolver longest-prefix pentru `LT_ZILE`/`FRECVENTA_ZILE`, cu normalizarea spațiilor | S 3.8 + tabelul de parametri din august („LT per prefix furnizor") | Mecanismul; `BRANCH > GLOBAL` e deja live | **Doar mecanismul.** Lista și valorile DEFAULT sunt N01/N02 → document beneficiar |
| 2 | P13 | `MIN_DOC` per scope, nu global pe companie | S 4.6 („per SKU și scope") | Azi e calculat per `MTRL` și copiat tuturor filialelor | **După P4.** Se implementează numai varianta literală, fără corecții de robustețe adăugate de noi |
| 3 | P15 | Indicatori și livrabile declarate, absente: `ALTREF`, `STOC_TOTAL_ALTREF` per scope, `COST_MED_RON`/`STOC_VAL_EUR`/`BUY_VALUE_EUR` cu lanțul de fallback, cele 41 de coloane, SUMMARY cu HQ separat, raportul obligatoriu de rulare | S 7, S 8, S 9 | Tot blocul | Raportul S 8 este și vehiculul prin care declarăm ce default am folosit la fiecare punct de mai sus |
| 4 | P10 | `STOC_NEG_CA_ZERO` expus ca parametru, păstrând comportamentul actual | E10 (august, propunere) = comportamentul de azi; S 5.6 e formula literală fără clamp | Doar parametrul + apariția în PARAMETRI | Nu schimbă nimic numeric; face alternativa o decizie vizibilă, nu una ascunsă în cod |
| 5 | — | Schelet de parametri pentru răspunsurile așteptate: `Z_A/Z_B/Z_C/Z_NOU`, `SL_NOU`, `FLAGS_MODE`, `CZ_CYCLE_ZERO` legat de `CLASA` | pregătire pentru A1/A4/B2/N06 | Seed idempotent cu valorile de azi | Zero efect numeric; transformă răspunsul beneficiarului într-o editare de configurare, nu într-un commit |

P4 (universul per scope) este mutat în
[INTREBARI_BENEFICIAR.md](INTREBARI_BENEFICIAR.md), punctul 9, pentru clarificările de integrare din
S 4.1. P13 rămâne autorizat de S 4.6 și se implementează după P4.

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

> Nota de diagnostic (N04b): este **aceeași eroare ca N04a, o treaptă mai jos**. `DATEDIFF(WEEK, TRNDATE, AZI)` numără treceri peste duminică, deci bucket-ul 0 se întinde doar de duminica dinaintea lui `AZI` până la `AZI` — între 1 și 7 zile, după ziua săptămânii — în timp ce bucket-urile 1–51 au 7 zile pline. σ se calcula deci pe 52 de bucket-uri **inegale**, cu bucket-ul 0 sistematic subumplut, contrar lui S 5.1. Fixul (`WEEK_BUCKET = DAY_LAG / 7`) a devenit posibil **abia după N04a**, fiindcă depinde de `AZI` înghețat în `CCCMINMAXRUN.AZI`: cu ancora recalculată per fază, o grilă rolling s-ar fi deplasat între `Classify` și `ClassifyGroup`. Secvențierea N04a → N04b nu era igienă, era dependență.

> Nota de capcană (N04b), de citit înainte de a atinge σ: ramura de cerere constantă compara `SAPT_VZ = @NrSaptamani` cu `MIN_WEEK_QTY = MAX_WEEK_QTY`. După despărțire, `SAPT_VZ` este pe grila ISO, iar extremele pe cea rolling — **o comparație între două grile**, care nici măcar nu au aceeași cardinalitate (365 de zile = 52 de bucket-uri rolling, dar 53 de săptămâni ISO). Condiția ar fi trecut tăcut de la „rar adevărată" la „niciodată adevărată", fără ca vreun test să pice. De aceea s-a introdus `BUCKETS_VZ`, numărat pe grila rolling, folosit în ambele părți ale condiției; `SAPT_VZ` rămâne doar mărime de lifecycle/frecvență. Linia este exact obiectul punctului 2 din documentul beneficiarului (σ=0 vs plancherul 1,3), deci trebuie să rămână curată până la răspuns.

> Nota de convenție (N04b): peste 365 de zile grila ISO dă 53 de bucket-uri, două parțiale. Se păstrează cel mai nou parțial (săptămâna ISO care conține `AZI`, indexul 0) și se elimină cel mai vechi, prin filtrul `ISO_WEEK < @NrSaptamani` — aceeași convenție `[0,N)` ca `FERESTRE_CAPAT`. Consecință utilă: `SAPT_VZ` rămâne în 0..52, deci praguri ca `STANDARD_MIN_SAPT` nu își schimbă înțelesul odată cu grila. Indexul ISO se calculează ancorat pe 1900-01-01 (o zi de luni), **nu** prin `DATEPART(WEEKDAY)`, care ar depinde de `SET DATEFIRST` — o setare de sesiune pe care procedura nu o controlează.

> Nota de martor (N04b): `GRILA_SAPT` (`ROLLING`/`CALENDAR`) și `BAZA_SAPT_VZ` (`ISO`/`GRILA`) sunt **doi** martori separați, ca să se poată atribui independent efectul grilei σ și cel al bazei `SAPT_VZ`; cu un singur martor cele două efecte ar cădea în aceeași rulare. Spre deosebire de `FERESTRE_VZ`, o valoare necunoscută **aruncă** (50082/50083) în loc să cadă pe default: un fallback tăcut ar raporta grila nouă sub eticheta celei vechi, exact eroarea pe care martorul există ca s-o excludă.
>
> **Decizia celor doi martori s-a validat pe date** (16.09.2026): efectul lui `ROLLING` asupra lui `SAPT_VZ` (11.986 rânduri) și cel al lui `ISO` (aceleași 11.986 rânduri, în sens invers) se anulează exact. Cu un singur martor s-ar fi anulat în interiorul aceleiași rulări, iar regresia intermediară n-ar fi fost niciodată vizibilă.

> **Rezultat măsurat N04b, factorială completă pe trei axe** (16.09.2026, șapte rulări, `AZI=2026-09-16` pe toate, populație 716.240 rânduri / 51.160 itemi). La închiderea N04b, configurația de producție era **RUNID 25** (`ZILE` + `ROLLING` + `ISO`), 15/15 invariante PASS.
>
> | RUNID | FERESTRE | GRILĂ | BAZĂ | Σ total | AVG total | STANDARD |
> | --- | --- | --- | --- | --- | --- | --- |
> | 19 | SAPT | CALENDAR | GRILA | 799.660,93 | 47.061,88 | 25.404 |
> | 20 | SAPT | ROLLING | GRILA | 798.853,03 | 47.198,34 | 25.497 |
> | 21 | ZILE | ROLLING | GRILA | 798.853,03 | 49.267,19 | 25.497 |
> | 22/23/25 | ZILE | ROLLING | ISO | 798.853,03 | 49.136,59 | 25.404 |
> | 24 | SAPT | ROLLING | ISO | 798.853,03 | 47.061,88 | 25.404 |
>
> **Ortogonalitate dovedită, nu postulată.** σ depinde exclusiv de `GRILA_SAPT`; `STANDARD` exclusiv de `BAZA_SAPT_VZ`. `FERESTRE_VZ` lasă σ/`SAPT_VZ`/`SAPT_8S`/`LIFECYCLE`/XYZ cu **0 diferențe** (măsurat de două ori, 20 → 21 și 22 → 24, cu σ identic la ultima zecimală). `BAZA_SAPT_VZ` lasă VZ/σ/XYZ cu 0 diferențe și produce exact aceleași contoare sub ambele ferestre (21 → 22 și 20 → 24: 11.986 `SAPT_VZ`, 1.234 `LIFECYCLE`).
>
> **Martorul de control** (RUNID 19, `CALENDAR` + `GRILA`) reproduce RUNID 18 cu 6 rânduri diferite din 716.240, toate atribuite nominal: două articole cu linii inserate în ERP la 17:49 și 18:04, unul cu document editat la 17:35 care a devenit neeligibil (TPRMS 7152, `FLG04=0`). Nu e regresie, este drift în fereastra dintre rulări.
>
> **Efect net zero pe `SAPT_VZ`** (RUNID 19 vs 24, ambele pe `SAPT`): `SAPT_VZ`, `SAPT_8S`, `LIFECYCLE`, `ABC` și `AVG` au **0 diferențe**. Înainte de N04b `SAPT_VZ` era deja pe săptămâni calendaristice — accidental, fiindcă împărțea grila `DATEDIFF(WEEK)` cu σ. `BAZA_SAPT_VZ='ISO'` nu îl schimbă, îl **protejează** de mutarea lui σ pe grila rolling. Acesta este rezultatul corect, nu o coincidență fericită.
>
> **Determinism confirmat de două ori**: RUNID 22 ↔ 23 (la 4 minute) și 22 ↔ 25 (la 24 de minute, cu o rulare pe altă configurație între ele) — 0 diferențe pe toate coloanele, 0 rânduri orfane. Probează și că ancora `AZI` înghețată izolează efectiv sesiunea de datele vii.
>
> **Reconcilierea serie ↔ ferestre se îmbunătățește**: seria weekly minus `VZ_52S` trece de la −5.713,85 (RUNID 17, patru zile lipsă) la −1.921,25 (RUNID 25, o zi). Nereconcilierea documentată — ziua cu lag 364 intră în `VZ_52S` dar nu în σ — **abia acum devine adevărată**; înainte de N04b lipseau patru zile, nu una. Verificat pe sursă: 2025-09-17 are 2.197 buc brut pe 1.062 linii, iar 1.921,25 este valoarea winsorizată.
>
> Efect cumulat N04a + N04b față de RUNID 16, pe 708.554 perechi comune: `AVG` +4,92%, `ENG_MIN` +2,65%, `ENG_MAX` +3,20%, `BUY_QTY` +6,08%. Aproape tot vine din N04a; N04b adaugă sub 0,5% și corectează grila.

> **Nota de predicție infirmată (N04b)** — de citit înaintea oricărei afirmații despre direcția lui σ. Raționamentul „bucket-ul 0 era subumplut ⇒ varianța era supraestimată ⇒ σ scade pe cerere regulată" **nu se confirmă pe date**. Mecanismul s-a aplicat (bucket-ul 0 trece de la 5.123,55 la 8.257,00, +61%, aliniat cu restul grilei), agregatul scade cu 0,101%, dar descompunerea pe densitate arată opusul exact acolo unde predicția era cea mai puternică:
>
> | Bandă `SAPT_VZ` | Rânduri | Scade | Crește | Δσ |
> | --- | --- | --- | --- | --- |
> | 45–52 | 189 | 65 | 124 | **+3,31%** |
> | 30–44 | 537 | 236 | 301 | +1,05% |
> | 13–29 | 2.545 | 1.147 | 1.398 | +0,77% |
> | 4–12 | 5.383 | 2.329 | 3.054 | +1,32% |
> | 0–3 | 4.557 | 2.531 | 2.026 | **−31,97%** |
>
> σ **crește** pe toate benzile cu cerere regulată; scăderea agregată vine exclusiv din banda foarte rară, unde regruparea unei serii sparse mută vânzări izolate între bucket-uri. Migrarea XYZ este zgomot: Z→Y 337 vs Y→Z 311, net 26 rânduri din 712.236. O explicație candidată — grila `ROLLING` acoperă 364 de zile față de 361 la `CALENDAR`, deci include 3 zile în plus (+3.792,60 în serie) — **rămâne netestată**, fiindcă nu există configurație în care cele două grile să acopere aceleași zile; σ nu depinde de `FERESTRE_VZ` (dovedit: `D_SIGMA = 0` pe 20 → 21), deci schimbarea ferestrelor nu poate discrimina ipoteza.
>
> Asta **nu** invalidează N04b: corectitudinea stă pe S 5.1 (52 de bucket-uri egale) și pe invarianta `grila_sapt`, care re-derivă grila din sursă cu 0 abateri din 189.694 perechi. Dar direcția lui σ nu este un argument disponibil, iar cine reia subiectul trebuie să pornească de la tabelul de mai sus, nu de la raționamentul intuitiv.

> **Nota de echivalență data-dependentă (N04b)**: grila `DATEDIFF(WEEK)` (săptămâni de duminică) și grila ISO (de luni) dau `SAPT_VZ` identic pe toate cele 716.240 de rânduri — dar **nu din motive structurale**. Pe fereastra de 365 de zile există **0 linii duminica și 5 sâmbăta** din 240.270 (Luni 48.710 / Marți 50.579 / Miercuri 48.345 / Joi 48.805 / Vineri 43.826), deci granița duminică-vs-luni cade într-o zonă moartă. Dacă MEC începe să vândă în weekend, cele două grile diverg și `BAZA_SAPT_VZ='ISO'` încetează să fie echivalent cu comportamentul pre-N04b. Aceeași clasă de capcană ca nota de calendar de la D15a: o coincidență de date luată drept echivalență de formulă.

## Constrângeri care se aplică tuturor

- Orice element de mai sus produce **RUNID nou**; sesiunile sunt imutabile. Calibrarea rulării anterioare încetează să fie reper direct.
- Plafonul ADO de 60 s al lui `X.RUNSQL` **nu se mai aplică fazelor**: `runPhases` doar pornește jobul `MEC_MinMaxEngine_RunPhases_<company>`, iar `Classify → ClassifyGroup → Compute → FinishRun` rulează sub SQL Server Agent. Dovada: RUNID 15 are Classify la 148 s. Plafonul rămâne valabil numai pentru apelurile sincrone din AJS — `setup()`, `StartRun`, `explain`/preview, `PurgeRun` — deci acolo nu se adaugă lucru greu.
- Limita reală pentru punctele 2 și 4 este **durata și volumul rulării** (tempdb, dimensiunea `CCCMINMAXDET`, fereastra de backup), nu un plafon de execuție.
- După orice editare SQL: `node new_min_max/tools/sync-check.cjs`; deploy AJS manual (MCP-ul `s1-api` este read-only prin design).
- Fiecare punct închis primește o invariantă în `new_min_max/tools/validate-minmax-invariants.cjs` și un test de contract în `test/tools/validate-minmax-invariants.test.js`.
