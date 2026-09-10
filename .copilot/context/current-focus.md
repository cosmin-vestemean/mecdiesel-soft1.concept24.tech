# Current Focus

## Last Updated
- 10.09.2026 (P1 deployat și validat live prin RUNID 10)

## Current Goal
- P1 branch-scope este implementat, deployat și validat: VZ-urile se netează independent pe toată fereastra per `BRANCH × TRDR × MTRL`, iar seria săptămânală rămâne separată.
- Următorul pas metodologic este decizia P2 pentru scope-ul HQ; extensia P6 longest-prefix rămâne blocată până la lista N5.

## Active Area
- P1: `#ClientWeekly` păstrează netul brut și clipul săptămânal; `#ClientWindowTotals` calculează independent 4S/13S/26S/52S din netul brut, iar `#BranchWindowTotals` agregă clienții. HQ continuă să însumeze filialele, fără decizia P2.
- Sigma, frecvența, recența, bucket-urile lunare, `VAL_52S`, persistența weekly și baza `IS_FORCED_Z` rămân pe seria săptămânală pre-P1.
- T1 executat read-only în SQL Server cu două săptămâni (`+7,+3` și `-5,-3`): `VZ_4S=2`, seria weekly `10/0`, `WEEK_QTY_SUM=10`, `SIGMA_WK_SUMSQ=100`.
- MIN/MAX v5 este live pe RUNID 10 (`FULL`, `CLIENT`, calibrare `C`, `DONE`, curent): 713.104 rânduri, 50.936 itemi, 14 filiale, durată totală 126s (Classify 55s, Group 28s, Compute 43s).
- Datele eligibile live au 238.304 linii și zero cantități negative; de aceea RUNID 9→10 are zero diferențe VZ, weekly, sigma, lifecycle și XYZ. RUNID 9 avea 6 override-uri branch în snapshot, RUNID 10 are 0; diferențele MIN/MAX dintre ele nu sunt efect P1.
- Toate invariantele RUNID 10 sunt PASS. Calibrare: A 85,2%, B 39,5%, C 34,6%. Local: 8/8 teste focalizate, toate blocurile SQL/AJS `IN SYNC`, `node --check`, `git diff --check` și diagnostice editor curate; suita completă are 225 passing și un eșec preexistent/necorelat la `mec-item-producer-relation`.
- T9 pe RUNID 9 a confirmat `BRANCH > GLOBAL`: HQ `21/7`, Cluj `28/10`, București `35/12`, Constanța fallback global `30/14`, zero abateri pe 713.104 rânduri.
- Override-urile de test au fost șterse după rulare: configurația activă are 0 rânduri, iar snapshot-ul RUNID 9 păstrează cele 6 rânduri branch. Toate invariantele sunt PASS.

## Relevant Files
- [Model și operare](../wiki/minmax-engine-model.md): sesiuni, snapshot, Agent, retenție, observabilitate, transport și reperul RUNID 9.
- [Formule](../wiki/minmax-engine-formulas.md): formulele și ordinea de calcul.
- [Întrebări business](../wiki/minmax-engine-open-items.md): deciziile încă neconfirmate.
- [Matrice P1-P15](../../new_min_max/10.09.2026/MATRICE_EXECUTABILA_P1-P15_2026-09-10.md) și [plan](../../new_min_max/10.09.2026/PLAN_ALINIERE_2026-09-10.md): ordinea autorizată de implementare.
- [SQL params](../../new_min_max/sql/00_params.sql), [StartRun](../../new_min_max/sql/00e_start_run.sql) și [Classify](../../new_min_max/sql/01_classify.sql): schema, snapshot-ul, resolverul P6 și netting-ul P1.
- [Serviciu](../../src/services/minmax-engine/minmax-engine.class.js), [parametri UI](../../public/components/minmax-engine/minmax-params-panel.js), [store](../../public/stores/minmax-engine-store.js) și [validator](../../new_min_max/tools/validate-minmax-invariants.cjs): API, editare și T9.
- [Teste contract SQL](../../test/tools/validate-minmax-invariants.test.js): regresia executabilă P1 și contractele snapshot/P6.

## Confirmed Decisions
- Snapshot-ul unic este `CCCMINMAXRUNPARAM`; fazele persistate refuză snapshot-ul lipsă prin 50074-50076, iar coloanele JSON legacy sunt eliminate.
- SQL Server Agent execută `Classify → ClassifyGroup → Compute → FinishRun`; browserul doar lansează și urmărește starea persistentă.
- P3/P7 sunt simetrice între SKU și grupe; P8 permite `SIGMA_MIN=0`; P14 evidențiază A/B/C fără să schimbe motorul. Detaliile sunt în [model](../wiki/minmax-engine-model.md).
- P6 păstrează globali parametrii de clasificare și permite override numai pentru `LT_ZILE`/`FRECVENTA_ZILE`, cu precedența `BRANCH+PREFIX > BRANCH > PREFIX > GLOBAL`.
- Etapa implementată rezolvă numai `BRANCH > GLOBAL`; preview-ul citește override-urile live, rularea persistentă numai snapshot-ul. Valori nepozitive și chei rigide sunt refuzate defensiv.
- P1 schimbă numai VZ-urile SKU: netting independent 4S/13S/26S/52S per client și filială. Nu schimbă `VAL_52S`, seria weekly, XYZ lunar sau pipeline-ul de grupă. Totalul weekly intern rămâne baza varianței și a regulii lunii dominante.
- HQ rămâne suma rezultatelor filialelor în P1. Netting-ul HQ ca scope propriu aparține P2 și nu este decis implicit.
- `MOD_ATRIBUIRE_FILIALA` rămâne `CLIENT`; `applyToErp` rămâne amânat.

## Open Questions
- P2, P4/N9-N10, P5 și P10-P13 rămân blocate de decizii business; vezi [întrebările deschise](../wiki/minmax-engine-open-items.md).
- P6 branch-only este închis; extensia longest-prefix așteaptă lista N5. Plancherul `σ_WK=1,3` rămâne fără confirmare documentară.

## Next Step
- Obține decizia P2: HQ se netează ca scope propriu per client sau rămâne suma filialelor deja netate. Nu schimba implementarea HQ înaintea acestei decizii.
- Nu implementa longest-prefix înainte de lista N5 și nu modifica atribuirea `CLIENT` implicită.

