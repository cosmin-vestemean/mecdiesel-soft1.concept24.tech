# Current Focus

## Last Updated
- 10.09.2026 (I7 inchis prin selector per rulare; urmeaza Faza 0)

> Fara alte modificari de implementare si fara scrieri in baza de date pana la inceperea Fazei 1.
> Nu executa CalculMinMax.js: este vechea interfata si scrie limite in ERP.
> Faza 4 applyToErp ramane amanata pana la aprobare explicita.

## Current Goal
- Alinierea motorului v5 la cerintele beneficiarului, corectand presupunerile proprii, cu
  implicare minima a beneficiarului. Plan aprobat ca directie:
  [PLAN_ALINIERE_2026-09-10.md](../../new_min_max/10.09.2026/PLAN_ALINIERE_2026-09-10.md).
- Partitia de lucru dupa AUTORITATE (inlocuieste categoriile 1/2/3 din CONTRADICTII pentru cod):
  Z0 = ambele surse concorda, codul deviaza -> intern acum; Z1 = doar septembrie declara -> intern,
  parametrizat; Z2 = septembrie contrazice confirmare august (A1-A4, B2) -> beneficiar;
  Z3 = neclar in S (N01/N02/N06/N05) -> beneficiar doar fara default defensabil.
- Registrul P1-P15 (plan §3) = presupunerile proprii din cod, cu testele T1-T6 ca regresie.
- Matrice (56 reguli), contradictii (A/B/C/N) si referinta beneficiarului raman documentele de baza.
- Nu exista inca decizie ca pachetul nou inlocuieste confirmarile consemnate in august.

## Active Area
- Analiza/documentatie, plus exceptia izolata I7 implementata local la cererea utilizatorului.
  Doua SELECT-uri de metadate pe prod:default, baza mecdiesel:
  definitia ufn_vanzariWksOptimized si dependinte. Fara executarea calculului sau scrieri DB.
- Implementarea din workspace a fost citita; parametrii live si deploy-ul nu au fost verificati.
- Verificarea locala SQL-AJS: 13/13 blocuri sincronizate. Contraexemple aritmetice offline verificate.

## Relevant Files
- [Plan de aliniere](../../new_min_max/10.09.2026/PLAN_ALINIERE_2026-09-10.md): Z0-Z3, registru P1-P15, Fazele 0-3, pachetul de 8 intrebari.
- [Contradictii si directii de clarificare](../../new_min_max/10.09.2026/CONTRADICTII_SI_DIRECTII_DE_CLARIFICARE_2026-09-10.md): separa confirmarile in conflict de diferentele de configuratie si erorile noastre; directii aprobate de utilizator ca obiective, nu formule aprobate.
- [Matrice comparativa](../../new_min_max/10.09.2026/MATRICE_COMPARATIVA_MINMAX_2026-09-10.md).
- [Referinta beneficiarului](../../new_min_max/10.09.2026/REFERINTA_BENEFICIAR_MINMAX_2026-09-10.md).
- [Sumar teoretic anterior](../../new_min_max/SUMAR_TEORETIC_CONFIRMARE.md), [contract Compute](../../new_min_max/FAZA3_HANDOFF.md).
- [SalesLines](../../new_min_max/sql/00c_sales_lines.sql), [Classify](../../new_min_max/sql/01_classify.sql), [Compute](../../new_min_max/sql/03_compute.sql).
- [Validator intern](../../new_min_max/tools/validate-minmax-invariants.cjs), [starea tehnica Faza 5](../../new_min_max/FAZA5_REMEDIERI_PLAN.md).

## Confirmed Understanding
- Patru niveluri distincte: S/C declarat, X observat static, interpretari interne, cod efectiv.
- Diferentele nu se reduc la parametri: netting saptamanal vs per fereastra, univers din vanzari,
  ABC pe toate lifecycle-urile/cumul precedent, SSF flat vs z(ABC), sigma zero -> 1.3,
  LT/frecventa globale fara resolver prefix/filiala, pack numai BUY, flags informative,
  BUY fara exceptie OD dupa podea, alta formula TREND; lipsesc costuri/AltRef/export complet.
- COV/marimi/podea sunt furnizate in noul config; prioritatea lor trebuie aprobata, nu inventata.
- IMPORTANT: validatorul intern numara banda FLAG_RATIO 0.50-2.00 pe populatie curata,
  nu FLAG=OK (0.77-1.30). Procentele istorice 85.3%/85.5% NU demonstreaza acceptanta S 8.
- DEFAULT = fallback prefix nerecunoscut; FSOP are furnizor ERP OPET FUCHS conform clarificarii
  utilizatorului, fara a autoriza maparea prin MTRSUP. DEFAULT 14 vs 30 ramane neclar.
- ALL legacy/72235 este separat: definitia DB citita la 10.09 confirma dezactivarea filtrului
  MTRSUP si NULL -> 72235. Nu dovedeste versiunea istorica din august.
- Clarificari utilizator: vechiul UI single-select obligatoriu, LT per rulare/filiala; motor
  independent inseamna web, nu decuplare de ERP; HQ = companie, Bucuresti = centru logistic.
- I7/D05 inchis 10.09: `DOC`/`AGENT`/`CLIENT` se aleg in selector la fiecare rulare. Alegerea este
  validata pe toate straturile, salvata in `PARAMSJSON` la StartRun si consumata din snapshot de
  Classify/ClassifyGroup. Deploy AJS + `setup` + `pm2 restart 0` finalizate de utilizator si
  verificate read-only: obiectele SQL au semnaturile noi, jobul Agent este activ pe `mecdiesel`,
  procesul PM2 este online. Selectorul nu a fost inca exercitat printr-o rulare noua.
- AltRef exista in exportul local ZeroMinMax.js ca MTRL.CODE1. Wrapper-ul vechi si UDF instalata
  nu folosesc AltRef/stoc echivalente; dependinte UDF numai MTRTRN/FINDOC/TPRMS/MTRL/PRSN.
- Validarea tehnica Faza 5/6 consemnata la 08.09 nu este invalidata global, dar nu dovedeste
  conformitatea cu pachetul 10.09. Nu s-a schimbat codul pentru a forta concordanta cu Excel.
- Sectiunea 3 din CONTRADICTII (C1-C5) este strict editoriala; nu atinge codul. Presupunerile
  proprii din cod sunt in matrice (P1-P15 in plan), majoritatea reparabile fara beneficiar.
- A1/A2/A4/B2 devin comutabile prin parametri fara beneficiar; A3 (pack) NU are parametrizare
  ieftina si se implementeaza doar dupa raspuns. MTRPACK este 100% gol, deci E14 produce zero pack.
- Cererea de confirmare catre beneficiar = foaia PARAMETRI a primei rulari aliniate (cerut oricum
  de S 7/S 8) + max 8 intrebari. Fara raspuns, configuratia ramane pe valorile din august.

## Open Questions
- Autoritatea punctuala A1-A4/B2 (Z2) si N01/N02/N06/N05 (Z3) — se inchid numai in Faza 2.
- Raspunsurile originale L4/E3/E7/E14/E2 pot reclasifica A1-A4 in consemnare gresita proprie.

## Next Step
- **Faza 0** (fara cod): aplica C1-C5 in SUMAR_TEORETIC_CONFIRMARE.md cu note de reconciliere
  datate (model Sonnet); utilizatorul strange raspunsurile originale L4/E3/E7/E14/E2.
- **Faza 1** (dupa Faza 0, fara beneficiar): parametri noi in seed -> resolver prefix/LT filiala ->
  univers prin uniuni -> netting per fereastra pe cod client -> ABC STANDARD/cumul inclusiv ->
  Compute (z(ABC), SIGMA_MIN=0, CZ pe clasa, garda OD, FLAGS_MODE, TREND) -> indicatori lipsa ->
  T1-T6 ca teste. Respecta plafonul 60 s X.RUNSQL (batch-uri Classify). sync-check.cjs dupa SQL.
  Scriptul COV din C este SEPARAT de seed si ruleaza doar in Faza 3.
- **Faza 2**: pachet unic catre beneficiar (PARAMETRI + 8 intrebari din plan §4). Review Opus.
- **Faza 3**: config semnata, RUNID nou, acceptanta pe S 8 FLAG=OK (nu banda 0.50-2.00, nu X).
- Restrictia anterioara ramane: minmaxEngine.editors="*" era temporar pentru testare; de restrans
  inainte de utilizare de beneficiar. Nu deduce flagurile live din fisierele config/.env.

