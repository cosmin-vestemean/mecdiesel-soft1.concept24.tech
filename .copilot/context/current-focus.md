# Current Focus

## Last Updated
- 16.09.2026 (N04a si N04b inchise si probate live; productia e RUNID 25)

## Current Goal
- **N04b este inchis si probat live pe RUNID 19-25**, factoriala completa pe trei axe. Configuratia de productie este **RUNID 25** (`FERESTRE_VZ='ZILE'` + `GRILA_SAPT='ROLLING'` + `BAZA_SAPT_VZ='ISO'`), `ESTE_CURENT=1`, 15/15 invariante PASS. Grila saptamanala e despartita in `WEEK_BUCKET` (7 zile rolling, ancorat pe `AZI`, pentru sigma si lunile 4-4-5) si `ISO_WEEK` (luni-duminica, pentru `SAPT_VZ`/`SAPT_8S`/`ULT_VANZ`).
- **N04a este închis**: ferestrele VZ trec de la bucket-uri de săptămână la zile calendaristice (28/91/182/365). Efectul predicatului a fost reconfirmat independent de doua ori dupa N04a (20 -> 21 si 22 -> 24), cu aceleasi cifre.
- Punctul **1c este implementat in SQL si in oglinda AJS, dar NU este inca deployat si nici probat live**: `ClassifyGroup` trece pe aceeasi grila dubla `WEEK_BUCKET`/`ISO_WEEK` si pe aceleasi ferestre VZ in zile ca `Classify`. Urmatorul pas este deploy + o rulare noua care sa arate reconcilierea `VZ` de grupa cu suma SKU-urilor.
- P1 branch-scope este implementat, deployat și validat: VZ-urile se netează independent pe toată fereastra per `BRANCH × TRDR × MTRL`, iar seria săptămânală rămâne separată.
- P2 este decis, implementat, deployat și **validat live pe RUNID 12**: HQ este scope propriu al cererii și compensează același `TRDR × MTRL` între filiale înainte de clip-ul la zero. Extensia P6 longest-prefix rămâne blocată până la lista N5.

## Active Area
- **Ortogonalitatea celor trei axe este dovedita pe date, nu postulata** (vezi tabelul din RESTANTE_INTERNE.md): sigma depinde exclusiv de `GRILA_SAPT` (798.853,03 pe toate rularile ROLLING, 799.660,93 pe CALENDAR); `STANDARD` depinde exclusiv de `BAZA_SAPT_VZ` (25.497 pe GRILA, 25.404 pe ISO); `FERESTRE_VZ` lasa sigma/`SAPT_VZ`/`LIFECYCLE`/XYZ cu **0 diferente**, masurat de doua ori.
- **Rezultatul cel mai important, de retinut inaintea oricarei discutii despre `SAPT_VZ`**: N04b are efect **net zero** pe `SAPT_VZ` (RUNID 19 vs 24: 0 diferente pe `SAPT_VZ`/`SAPT_8S`/`LIFECYCLE`/`ABC`/`AVG`). Inainte de N04b `SAPT_VZ` era deja pe saptamani calendaristice, accidental, fiindca imparte grila `DATEDIFF(WEEK)` cu sigma. `BAZA_SAPT_VZ='ISO'` nu il schimba, il **protejeaza** de mutarea lui sigma pe grila rolling.
- **Predictia despre directia lui sigma este INFIRMATA** — nu o repeta. Mecanismul s-a aplicat (bucket 0: 5.123,55 -> 8.257,00, +61%), agregatul scade 0,101%, dar sigma **creste** pe toate benzile cu cerere regulata (+3,31% pe 45-52 sapt, +1,05% pe 30-44, +0,77% pe 13-29); scaderea vine doar din banda 0-3 (-31,97%). Migrarea XYZ e zgomot (net 26 randuri din 712.236). Corectitudinea N04b sta pe S 5.1 si pe invarianta `grila_sapt` (0 abateri din 189.694 perechi re-derivate), **nu** pe directia lui sigma.
- **Echivalenta ISO vs CALENDAR este data-dependenta, nu structurala**: 0 linii duminica si 5 sambata din 240.270. Daca apar vanzari in weekend, cele doua grile diverg. Aceeasi clasa de capcana ca „AZI miercuri" de la D15a.
- **Determinism confirmat de doua ori**: RUNID 22 <-> 23 (4 minute) si 22 <-> 25 (24 de minute, cu o rulare pe alta configuratie intre ele), 0 diferente pe toate coloanele. Probeaza si ca ancora `AZI` inghetata izoleaza sesiunea de datele vii.
- **Reconcilierea serie <-> ferestre s-a imbunatatit**: seria weekly minus `VZ_52S` trece de la -5.713,85 (RUNID 17, patru zile lipsa) la -1.921,25 (RUNID 25, o zi). Nereconcilierea documentata „ziua cu lag 364" **abia acum devine adevarata**.
- **Capcana N04b, de retinut**: ramura de cerere constanta din sigma compara un contor cu extremele `MIN_WEEK_QTY`/`MAX_WEEK_QTY`. Cu `SAPT_VZ` mutat pe ISO, comparația ar fi fost **intre doua grile** cu cardinalitati diferite (52 rolling vs 53 ISO) si ar fi trecut tacit de la "rar adevarata" la "niciodata adevarata", fara ca vreun test sa pice. De aceea exista `BUCKETS_VZ`, numarat pe grila rolling, folosit in ambele parti ale conditiei. Linia e exact obiectul punctului 2 din documentul beneficiarului — nu o contamina.
- **Persistenta nu schimba schema**: `CCCMINMAXWEEK` pastreaza numele coloanei `WEEK_INDEX` in PK, dar o alimenteaza din `WEEK_BUCKET`. Seria persistata exista ca sa auditeze sigma, deci grila rolling e cea corecta de persistat.
- **Lectie de protocol, confirmata pe date**: decizia de a avea **doi** martori separati (nu unul) s-a validat — efectul lui `ROLLING` pe `SAPT_VZ` (11.986 randuri) si cel al lui `ISO` (aceleasi 11.986, in sens invers) se anuleaza exact. Cu un singur martor s-ar fi anulat in interiorul aceleiasi rulari si regresia intermediara n-ar fi fost vizibila.
- **Capcana operationala intalnita de doua ori in seara asta**: parametrul editat in UI nu ajunge automat in rulare. RUNID 19 a mostenit `FERESTRE_VZ='SAPT'` de la rularea precedenta (martorul asteptat era 17, dar comparatia corecta a fost 18), iar RUNID 23 a rulat cu aceeasi configuratie ca 22 fiindca schimbarea spre `SAPT` nu s-a salvat. **Verifica intotdeauna snapshot-ul `CCCMINMAXRUNPARAM` al rularii, nu ce ai crezut ca ai setat.**
- **N04a, diagnosticul care justifica schimbarea**: marginea dreapta a ferestrei era ziua exacta `AZI`, dar cea stanga era cuantizata la duminica de `DATEDIFF(WEEK, ...)`. Ferestrele erau deci sistematic mai scurte decat cele declarate, cu `6 - index_zi` zile, si variau cu ziua saptamanii: `VZ_4S` acoperea 22-28 de zile in loc de 28.
- **Ancora `AZI` este inghetata pe sesiune**: `Classify` o stabileste si o scrie in `CCCMINMAXRUN.AZI`, iar `ClassifyGroup` o citeste si o paseaza functiei, cu `THROW 50080` daca lipseste. Nu s-a pus in `StartRun`, care e apel sincron sub plafonul ADO de 60 s.
- **Parametri noi, in seed idempotent deci automat in snapshot**: `NRZILE=365`, `FERESTRE_VZ_ZILE='28,91,182,365'`, `FERESTRE_VZ='ZILE'`, `FERESTRE_CAPAT='[0,N)'`, `GRILA_SAPT='ROLLING'`, `BAZA_SAPT_VZ='ISO'`. Garzi: `THROW 50078` (capat nedeclarat), `50079` (ferestre peste `NRZILE`), `50081` (lista malformata), `50080` (ancora lipsa), `50082`/`50083` (grila/baza necunoscuta).
- **Nedecis tacit**: `FERESTRE_CAPAT` exista ca sa fie **declarat** in PARAMETRI, nu ca sa aiba doua implementari netestate — orice alta valoare decat `[0,N)` este refuzata.
- **Efect cumulat N04a+N04b fata de RUNID 16**, pe 708.554 perechi comune: `AVG` +4,92%, `ENG_MIN` +2,65%, `ENG_MAX` +3,20%, `BUY_QTY` +6,08%. Aproape tot vine din N04a. Calibrare RUNID 25: A 90,9%, B 48,8%, C 43,5%.
- **RUNID 16 (16.09.2026, ultimul reper pre-N04)**: 708.554 randuri, 50.611 itemi, 14 filiale, 13/13 invariante PASS, calibrare A 90,8% / B 48,9% / C 43,4%.
- **P11 este inchis pe RUNID 16**: `TREND_BAZA` (`13_26`/`13_52`, default `13_52`) e in seed-ul idempotent si ajunge automat in snapshot. `Compute` ramifica `TREND_PCT`: `13_52` -> `4*VZ_13S/VZ_52S-1`. `STATUS_TREND` da `NOU -> 'NOU'` si `OD -> 'OK'` inaintea pragurilor. Unitatea ramane **fractie**, deliberat neschimbata.
- **Observatie de interpretare, nu bug**: cu prioritatea lifecycle, `STATUS_TREND='OK'` acopera 96% din randuri, deci coloana Trend a devenit in practica un indicator de lifecycle. Asa declara S 7; filtrarea utila se face pe `LIFECYCLE='STANDARD'` impreuna cu Trend.
- **Consecinta in UI, obligatorie**: `STATUS_TREND` are doua valori noi, deci `STATUS_TREND_VALUES` din serviciu si `STATUS_TREND_OPTIONS` din tabel includ `NOU` si `OK`.
- P5 (garda OD pe BUY) si recenta S 4.6 sunt implementate, deployate si validate live pe RUNID 15: `BUY_RAW` are `WHEN LIFECYCLE = 'OD' THEN 0` inaintea clamp-ului de stoc, iar `SAPT_FARA` este `round(zile de la ULT_VANZ / 7)`, simetric in `Classify` si `ClassifyGroup`.
- Perimetru refuzat deliberat: „un retur ulterior anuleaza saptamana de cerere" ramane neimplementat — este exact definitia trimisa spre confirmare beneficiarului. La fel, `MIN_DOC` per filiala (depinde de P4) si valorile DEFAULT de prefix (N01/N02).
- Afisarea filialelor in MIN/MAX foloseste denumirea ERP: `params()` alatura `BRANCH.NAME` ca `BRANCH_NAME`, iar filtrele, tabelele si exporturile Excel afiseaza denumirea cu fallback la cod.
- Export Excel pentru MIN/MAX este implementat pentru tabelul de rezultate si clasificarea pe grupe, cu filtrele active, RUNID-ul afisat si citire paginata in loturi de 500.
- D1/D2 scope decis 16.09.2026: HQ este agregatul virtual al retelei, distinct de filiala fizica Bucuresti/depozitul central. `STOC_QTY = STOC_FIZIC_QTY + TRANSFER_IN_QTY`, unde transferul este documentul 3153 nereceptionat (`FULLYTRANSF=0`, `WHOUSESEC=9999`) atribuit filialei destinatie prin `MTRDOC.BRANCHSEC`.
- Sigma, frecventa, recenta, bucket-urile lunare, `VAL_52S`, persistenta weekly si baza `IS_FORCED_Z` raman pe seria saptamanala (acum pe grila rolling).

## Relevant Files
- [Restante interne](../../new_min_max/RESTANTE_INTERNE.md): ce implementam fara beneficiar (Z0/Z1), cu stare, autoritate si dependente. Prima sursa la reluarea lucrului; contine tabelul factorialei N04b si nota de predictie infirmata.
- [Intrebari beneficiar](../../new_min_max/INTREBARI_BENEFICIAR.md): cele 9 puncte + foaia PARAMETRI care nu se pot decide intern. Document destinat clientului.
- [Model și operare](../wiki/minmax-engine-model.md): sesiuni, snapshot, Agent, retenție, observabilitate, transport și reperul RUNID 9.
- [Formule](../wiki/minmax-engine-formulas.md): formulele și ordinea de calcul. **Posibil stale** — ultima atingere 08.09, iar `01_classify.sql`/`03_compute.sql` s-au schimbat prin N04a/N04b.
- [Întrebări business](../wiki/minmax-engine-open-items.md): deciziile încă neconfirmate.
- [Matrice P1-P15](../../new_min_max/10.09.2026/MATRICE_EXECUTABILA_P1-P15_2026-09-10.md) și [plan](../../new_min_max/10.09.2026/PLAN_ALINIERE_2026-09-10.md): ordinea autorizată de implementare.
- [SQL params](../../new_min_max/sql/00_params.sql), [StartRun](../../new_min_max/sql/00e_start_run.sql) și [Classify](../../new_min_max/sql/01_classify.sql): schema, snapshot-ul, resolverul P6, netting-ul P1 si grila dubla N04b.
- [ClassifyGroup](../../new_min_max/sql/02_classify_group.sql): aliniat la 1c — grila dubla, ferestre pe zile, netting per client pe fereastra, `#GroupRollingStats` (sigma) separat de `#GroupIsoWeeklyStats` (SAPT_VZ/SAPT_8S/ULT_VANZ). Garzi proprii: `50084`-`50088`.
- [Serviciu](../../src/services/minmax-engine/minmax-engine.class.js), [parametri UI](../../public/components/minmax-engine/minmax-params-panel.js), [store](../../public/stores/minmax-engine-store.js) și [validator](../../new_min_max/tools/validate-minmax-invariants.cjs): API, editare și invariantele.
- [Tabele si export](../../public/components/minmax-engine/minmax-results-table.js) si [clasificare grupe](../../public/components/minmax-engine/minmax-group-abc.js): afisare si export XLSX paginat.
- [Teste contract SQL](../../test/tools/validate-minmax-invariants.test.js): regresiile executabile P1/P2 și contractele snapshot/P6.


## Confirmed Decisions
- Snapshot-ul unic este `CCCMINMAXRUNPARAM`; fazele persistate refuză snapshot-ul lipsă prin 50074-50076, iar coloanele JSON legacy sunt eliminate.
- SQL Server Agent execută `Classify → ClassifyGroup → Compute → FinishRun`; browserul doar lansează și urmărește starea persistentă.
- P3/P7 sunt simetrice între SKU și grupe; P8 permite `SIGMA_MIN=0`; P14 evidențiază A/B/C fără să schimbe motorul. Detaliile sunt în [model](../wiki/minmax-engine-model.md).
- P6 păstrează globali parametrii de clasificare și permite override numai pentru `LT_ZILE`/`FRECVENTA_ZILE`, cu precedența `BRANCH+PREFIX > BRANCH > PREFIX > GLOBAL`.
- Etapa implementată rezolvă numai `BRANCH > GLOBAL`; preview-ul citește override-urile live, rularea persistentă numai snapshot-ul. Valori nepozitive și chei rigide sunt refuzate defensiv.
- P1 schimbă numai VZ-urile SKU: netting independent 4S/13S/26S/52S per client și filială. Nu schimbă `VAL_52S`, seria weekly, XYZ lunar sau pipeline-ul de grupă. Totalul weekly intern rămâne baza varianței și a regulii lunii dominante.
- P2: HQ este scope propriu al cererii; pentru fiecare `TRDR × MTRL × fereastră`, neturile brute ale filialelor se compensează înainte de clip-ul la zero. Seria weekly, `VAL_52S`, sigma și CV nu se schimbă direct. `LIFECYCLE`, `ABC`, `XYZ`/`IS_FORCED_Z`, `CLASA` și MIN/MAX pot deriva legitim în HQ prin noile `VZ_26S`/`VZ_52S`; filialele trebuie să rămână identice. Pipeline-ul de grupă rămâne intenționat în afara P1/P2.
- HQ nu este București: București este filiala fizică de vânzări și depozitul central, iar HQ este suma filialelor active. Pentru stoc și comenzi se includ numai depozite active mapate la filialele active ale rulării; liniile fără filială nu intră nici în HQ. Marfa din transfer 3153 este deja scăzută din sursă și se adaugă stocului destinației până la recepție.
- `MOD_ATRIBUIRE_FILIALA` rămâne `CLIENT`; `applyToErp` rămâne amânat.
- P11: baza TREND este parametrizată (`TREND_BAZA`), nu hardcodată; default `13_52` conform S 7. Unitatea rămâne fracție — S 7 scrie formula înmulțită cu 100, dar unitatea nu este marcată nicăieri ca decizie, deci nu se schimbă tacit odată cu baza. `VZ_13S = 0 ⇒ DECLINE` rezultă din formulă (−1), nu dintr-o ramură separată.

## Open Questions
- P4/N9-N10, P5 și P10-P13 rămân blocate de decizii business; vezi [întrebările deschise](../wiki/minmax-engine-open-items.md).
- P6 branch-only este închis; extensia longest-prefix așteaptă lista N5. Plancherul `σ_WK=1,3` rămâne fără confirmare documentară.

## Next Step
- **1c: deploy si proba live.** Codul e scris (`02_classify_group.sql` + oglinda din `S1-MEC/AJS/NewMinMax.js`, 12/12 IN SYNC, 197 teste de contract PASS). Ce ramane: deploy prin setup, o rulare noua, apoi comparatia care justifica intreaga schimbare — `SUM(CCCMINMAXDET.VZ_52S)` per `(BRANCH, MTRGROUP)` fata de `CCCMINMAXGRP.VZ_52S`. Pe RUNID 25 cele doua nu se reconciliaza; dupa 1c trebuie sa coincida.
- **Ce se asteapta sa se mute la prima rulare dupa 1c**, ca sa nu fie citit ca regresie: `VAL_52S` de grupa trece de la suma seriei saptamanale la fereastra de zile, deci **ABC de grupa se poate muta**; `SAPT_VZ`/`SAPT_8S`/`ULT_VANZ` de grupa trec pe grila ISO; `NR_SKU_VZ` se numara acum pe `VZ_52S > 0` din ferestre, nu pe seria saptamanala (elimina bucket-ul de capat). `SIGMA_WK` de grupa se muta o data cu grila rolling, la fel cum s-a mutat sigma de SKU la N04b.
- **Invarianta `det_grp` NU acopera reconcilierea VZ** — verifica doar existenta perechii si `NR_SKU_GRP`. Reconcilierea `VZ_52S` grupa vs suma SKU nu are inca invarianta; de adaugat daca proba live iese curat.
- **De verificat inainte de a interpreta orice rulare noua**: snapshot-ul `CCCMINMAXRUNPARAM` al rularii, nu ce s-a intentionat in UI. Capcana a aparut de doua ori in seara de 16.09: RUNID 19 a mostenit `FERESTRE_VZ='SAPT'` de la rularea precedenta (deci martorul corect a fost 18, nu 17), iar RUNID 23 a rulat identic cu 22 fiindca schimbarea nu s-a salvat.
- **Nu repeta predictia ca sigma scade pe cerere regulata** — este infirmata pe date (vezi Active Area si tabelul din RESTANTE_INTERNE.md). Ramane deschisa explicatia pentru +3,31% pe banda densa; ipoteza celor 3 zile in plus (364 vs 361) **nu poate fi testata** prin `FERESTRE_VZ`, fiindca sigma nu depinde de ferestre.
- **N04b inchis, probat live pe RUNID 19-25 (16.09.2026)**, factoriala completa pe trei axe. Productia: **RUNID 25**, `ESTE_CURENT=1`, 15/15 PASS.
  - Martor de control (19, `CALENDAR`+`GRILA`) reproduce 18 cu 6 randuri diferite din 716.240, toate drift ERP atribuit nominal (doua inserari la 17:49/18:04, un document editat la 17:35 devenit neeligibil).
  - Ortogonalitate: sigma depinde exclusiv de `GRILA_SAPT`, `STANDARD` exclusiv de `BAZA_SAPT_VZ`, iar `FERESTRE_VZ` lasa sigma/`SAPT_VZ`/`LIFECYCLE`/XYZ cu 0 diferente (masurat de doua ori).
  - Efect net zero pe `SAPT_VZ` (19 vs 24): `ISO` nu schimba `SAPT_VZ`, il protejeaza de mutarea lui sigma.
  - Determinism: 22 <-> 23 si 22 <-> 25, 0 diferente.
  - Efect cumulat fata de RUNID 16: `AVG` +4,92%, `ENG_MIN` +2,65%, `ENG_MAX` +3,20%, `BUY_QTY` +6,08%. Calibrare RUNID 25: A 90,9% / B 48,8% / C 43,5%.
- **N04a inchis, probat live pe RUNID 17/18 (16.09.2026).** RUNID 17 = `FERESTRE_VZ='ZILE'`, RUNID 18 = `'SAPT'`, aceeasi populatie, deci 18 -> 17 izoleaza curat cauza B.
  - **Cauza A** (RUNID 16 -> 18, populatie + winsor): `AVG` +0,49%, `ENG_MIN` +0,27%, `ENG_MAX` +0,33%, `BUY_QTY` +0,57%. Aproape plat, cum era asteptat.
  - **Cauza B** (RUNID 18 -> 17, predicatul zile): `AVG` +4,38% (predictie ~5,4%), `ENG_MIN` +2,07%, `ENG_MAX` +2,79%, `BUY_QTY` +5,21%. `FLAG_TXT` migreaza net spre `UP` (+281) si dinspre `DOWN` (-284). Reconfirmat independent de doua ori dupa aceea (20 -> 21 si 22 -> 24), cu aceleasi cifre.
  - Validator: RUNID 18 13/13 PASS; RUNID 17 12/13, `ferestre_zile` semnaleaza 8 abateri din 665.080 perechi (0,0012%) — documente introduse in ERP dupa Classify, cu data in fereastra, fara sa mute `MAX(TRNDATE)`. Nu e regresie.
- Invariantele esueaza **intentionat** pe rulari vechi care nu au cheile in snapshot: `trend` pe RUNID <= 15, `ferestre_zile` pe <= 16, `grila_sapt` pe <= 18. Nu le "repara" retroactiv.
- Wiki-ul [Formule](../wiki/minmax-engine-formulas.md) nu a mai fost atins din 08.09, desi `01_classify.sql`/`03_compute.sql` s-au schimbat de doua ori prin N04a/N04b. Candidat pentru `wiki-gc`, nu pentru sesiunea curenta.
- Restul ramane blocat pe decizii business: P4/N9-N10, P10, P13 si lista N5 pentru longest-prefix. Nu implementa longest-prefix inainte de lista N5 si nu modifica atribuirea `CLIENT` implicita.

