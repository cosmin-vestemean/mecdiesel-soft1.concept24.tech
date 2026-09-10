# Current Focus

## Last Updated
- 10.09.2026 (comparatie referinta beneficiar / analiza interna / cod)

> Fara modificari de implementare si fara scrieri in baza de date in etapa curenta.
> Nu executa CalculMinMax.js: este vechea interfata si scrie limite in ERP.
> Faza 4 applyToErp ramane amanata pana la aprobare explicita.

## Current Goal
- Reconcilierea pachetului beneficiarului din 10.09 cu interpretarile anterioare si codul.
- Matrice comparativa livrata: 56 reguli, surse, diferente si decizii necesare.
- Nu exista inca decizie ca pachetul nou inlocuieste toate confirmarile consemnate in august.

## Active Area
- Doar analiza/documentatie. Nicio interogare sau scriere DB in aceasta sesiune.
- Implementarea din workspace a fost citita; parametrii live si deploy-ul nu au fost verificati.
- Verificarea locala SQL-AJS: 13/13 blocuri sincronizate. Contraexemple aritmetice offline verificate.

## Relevant Files
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
- ALL legacy/72235 este separat; semantica in ufn_vanzariWksOptimized ramane neverificata.
- Validarea tehnica Faza 5/6 consemnata la 08.09 nu este invalidata global, dar nu dovedeste
  conformitatea cu pachetul 10.09. Nu s-a schimbat codul pentru a forta concordanta cu Excel.

## Open Questions
- Autoritatea punctuala a pachetului nou fata de deciziile consemnate anterior; N01-N16 din referinta.
- Contract comun al datelor, reguli finale si baza reprezentativa pentru acceptanta.

## Next Step
- Obtine deciziile din matrice inaintea unui plan de aliniere; nu incepe implementarea automat.
- Apoi, numai cu autorizare, compara pe inputuri/config inghetate, separat de etalonul static X.
- Restrictia anterioara ramane: minmaxEngine.editors="*" era temporar pentru testare; de restrans
  inainte de utilizare de beneficiar. Nu deduce flagurile live din fisierele config/.env.

