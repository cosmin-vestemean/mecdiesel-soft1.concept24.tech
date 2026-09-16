# Current Focus

## Last Updated
- 16.09.2026 (RUNID 12 rulat și validat; P1/P2 confirmate live pe el)

## Current Goal
- P1 branch-scope este implementat, deployat și validat: VZ-urile se netează independent pe toată fereastra per `BRANCH × TRDR × MTRL`, iar seria săptămânală rămâne separată.
- P2 este decis, implementat, deployat și **validat live pe RUNID 12**: HQ este scope propriu al cererii și compensează același `TRDR × MTRL` între filiale înainte de clip-ul la zero. Extensia P6 longest-prefix rămâne blocată până la lista N5.

## Active Area
- P1/P2: `#ClientWeekly` păstrează netul brut și clipul săptămânal; `#ClientWindowTotals` calculează independent 4S/13S/26S/52S pentru fiecare filială și pentru HQ. HQ însumează neturile brute ale aceluiași client din toate filialele înainte de clip; `#BranchWindowTotals` agregă apoi clienții.
- D1/D2 scope decis 16.09.2026: HQ este agregatul virtual al rețelei, distinct de filiala fizică București/depozitul central. Numai filialele active și depozitele active mapate intră în stoc și comenzi; depozitele fără filială, inclusiv 8002 „BONURI VALORICE", sunt excluse. `STOC_QTY = STOC_FIZIC_QTY + TRANSFER_IN_QTY`, unde transferul este documentul 3153 nerecepționat (`FULLYTRANSF=0`, `WHOUSESEC=9999`) atribuit filialei destinație prin `MTRDOC.BRANCHSEC`; HQ însumează stocurile efective ale filialelor. Proba live: 43 documente, 1.672 linii și 3.626 bucăți către toate cele 13 filiale active. Soldul brut 9999 este 3.642 și nu se folosește, deoarece nu păstrează sigur destinația. Cele trei valori sunt persistate și expuse în tabel/popup. Implementarea locală și oglinda AJS sunt actualizate; 131 teste focalizate trec, iar suita completă are 229 passing plus eșecul preexistent `mec-item-producer-relation`. Necesită deploy și validare live.
- Verificare read-only după Setup: procedura live `dbo.sp_MinMaxEngine_Classify` are `modify_date=2026-09-16 11:08:40`, conține inserarea HQ în `#ClientWindowTotals` din `#ClientWeekly` și nu mai conține vechiul `FROM #BranchWindowTotals totals`. Nu există sesiuni OPEN; sesiunea curentă este RUNID 12.
- **RUNID 12 (16.09.2026, `FULL`, `CLIENT`, calibrare `C`, `DONE`, curent)**: 707.910 rânduri, 50.565 itemi, 14 filiale, durată 130s (Classify ~59s, Group 30s, Compute 41s). Toate invariantele PASS (10/10). Calibrare: A 90,9%, B 49,0%, C 43,5%.
- **Contract P2 confirmat live pe RUNID 12**: pe toate cele 50.565 rânduri HQ, `VZ_4S/13S/26S/52S` = EXACT `SUM(VZ filiale)` per `MTRL` (0 abateri pe toate cele 4 ferestre) — comportamentul așteptat cu zero retururi eligibile (`NEG_QTY_LINES=0` în weekly). Totodată `HQ VZ <= SUM(filiale)` peste tot, deci clip-ul la zero nu e nicăieri violat.
- **Diferențe 11 → 12 sunt drift de fereastră, nu efect de cod**: RUNID 11 are `AZI=2026-09-10`, RUNID 12 `AZI=2026-09-16` (fereastra mutată 6 zile). Pe perechile comune: filiale 15.195 VZ_DIFF / 5.073 VAL_52S / 5.834 sigma / 10.843 CV / 4.470 clasificare / 5.687 output; HQ 9.324 VZ_DIFF / 3.490 VAL_52S / 3.342 sigma / 8.228 CV / 2.851 clasificare / 4.461 output. Esantionul arată semnătura clasică (±1 pe VZ_4S, fracții pe 52S). Populația: 11.844 rânduri doar în 11, 6.650 doar în 12 — articole intrate/ieșite din univers odată cu fereastra. Weekly RUNID 12: 335.240 observații pe 50.565 itemi.
- Sigma, frecvența, recența, bucket-urile lunare, `VAL_52S`, persistența weekly și baza `IS_FORCED_Z` rămân pe seria săptămânală pre-P1.
- T1 executat read-only în SQL Server cu două săptămâni (`+7,+3` și `-5,-3`): `VZ_4S=2`, seria weekly `10/0`, `WEEK_QTY_SUM=10`, `SIGMA_WK_SUMSQ=100`.
- MIN/MAX v5 este live pe RUNID 11 (`FULL`, `CLIENT`, calibrare `C`, `DONE`, curent): 713.104 rânduri, 50.936 itemi, 14 filiale, durată totală 128s (Classify 58s, Group 30s, Compute 40s).
- RUNID 11, produs după recompilarea procedurii prin ultimul setup, este identic cu RUNID 10 pe VZ, seria weekly, sigma, lifecycle/ABC/XYZ/clasă și rezultatele ENG_MIN/ENG_MAX/BUY_QTY: zero diferențe din 713.104 rânduri.
- Datele eligibile live au 238.304 linii și zero cantități negative; de aceea RUNID 9→10 are zero diferențe VZ, weekly, sigma, lifecycle și XYZ. RUNID 9 avea 6 override-uri branch în snapshot, RUNID 10 are 0; diferențele MIN/MAX dintre ele nu sunt efect P1.
- Toate invariantele RUNID 11 sunt PASS. Calibrare: A 85,2%, B 39,5%, C 34,6%. Pentru P2 local: 9/9 teste contractuale, toate blocurile SQL/AJS `IN SYNC`, calea `S1-MEC` este symlink către artefactul AJS din `external/MEC`, iar `node --check` este curat. Suita completă rămâne la ultima validare cu 225 passing și un eșec preexistent/necorelat la `mec-item-producer-relation`.
- T9 pe RUNID 9 a confirmat `BRANCH > GLOBAL`: HQ `21/7`, Cluj `28/10`, București `35/12`, Constanța fallback global `30/14`, zero abateri pe 713.104 rânduri.
- Override-urile de test au fost șterse după rulare: configurația activă are 0 rânduri, iar snapshot-ul RUNID 9 păstrează cele 6 rânduri branch. Toate invariantele sunt PASS.

## Relevant Files
- [Model și operare](../wiki/minmax-engine-model.md): sesiuni, snapshot, Agent, retenție, observabilitate, transport și reperul RUNID 9.
- [Formule](../wiki/minmax-engine-formulas.md): formulele și ordinea de calcul.
- [Întrebări business](../wiki/minmax-engine-open-items.md): deciziile încă neconfirmate.
- [Matrice P1-P15](../../new_min_max/10.09.2026/MATRICE_EXECUTABILA_P1-P15_2026-09-10.md) și [plan](../../new_min_max/10.09.2026/PLAN_ALINIERE_2026-09-10.md): ordinea autorizată de implementare.
- [SQL params](../../new_min_max/sql/00_params.sql), [StartRun](../../new_min_max/sql/00e_start_run.sql) și [Classify](../../new_min_max/sql/01_classify.sql): schema, snapshot-ul, resolverul P6 și netting-ul P1.
- [Serviciu](../../src/services/minmax-engine/minmax-engine.class.js), [parametri UI](../../public/components/minmax-engine/minmax-params-panel.js), [store](../../public/stores/minmax-engine-store.js) și [validator](../../new_min_max/tools/validate-minmax-invariants.cjs): API, editare și T9.
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

## Open Questions
- P4/N9-N10, P5 și P10-P13 rămân blocate de decizii business; vezi [întrebările deschise](../wiki/minmax-engine-open-items.md).
- P6 branch-only este închis; extensia longest-prefix așteaptă lista N5. Plancherul `σ_WK=1,3` rămâne fără confirmare documentară.

## Next Step
- RUNID 12 a încheiat validarea P1/P2. P1/P2 pot fi considerate închise. Următorul pas rămâne blocat pe decizii business: P4/N9-N10, P5, P10-P13 și lista N5 pentru longest-prefix.
- Nu implementa longest-prefix înainte de lista N5 și nu modifica atribuirea `CLIENT` implicită.

