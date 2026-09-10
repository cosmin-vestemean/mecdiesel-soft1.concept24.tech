# Current Focus

## Last Updated
- 10.09.2026 (session 2)

## Current Goal
- Faza 0 de reconciliere documentară C1-C5 este finalizată; următoarea etapă este pregătirea Fazei 1.
- Până la reluarea explicită a implementării: fără modificări de cod, scrieri S1 sau aplicări ERP.

## Active Area
- MIN/MAX v5: I7/D05 este implementat per rulare; `DOC`/`AGENT`/`CLIENT` se salvează în `PARAMSJSON` și este consumat de fazele de clasificare. Selectorul nu a fost încă exercitat printr-o rulare nouă.
- Ultima lucrare a fost documentară: C1-C5 sunt corecții editoriale, nu aprobări de formule sau autorizații de cod. Workspace-ul este curat după commitul `bbd7ad4`.

## Relevant Files
- [Plan de aliniere](../../new_min_max/10.09.2026/PLAN_ALINIERE_2026-09-10.md): Z0-Z3, P1-P15 și succesiunea Fazelor 1-3.
- [Contradicții](../../new_min_max/10.09.2026/CONTRADICTII_SI_DIRECTII_DE_CLARIFICARE_2026-09-10.md): sursa pentru C1-C5 și întrebările de autoritate.
- [Sumar reconciliat](../../new_min_max/SUMAR_TEORETIC_CONFIRMARE.md): C1-C5 aplicate în commitul `bbd7ad4`.
- [Model wiki](../wiki/minmax-engine-model.md) și [formule wiki](../wiki/minmax-engine-formulas.md): arhitectură și formule durabile.
- [Open items wiki](../wiki/minmax-engine-open-items.md): întrebări business încă neînchise.
- [AJS NewMinMax](../../S1-MEC/AJS/NewMinMax.js): implementare deployată; nu a fost modificată în această fază.

## Confirmed Decisions
- C1-C5 repară documentația; nu schimbă codul și nu înlocuiesc automat confirmările din august.
- I7/D05: atribuirea vânzărilor este selector per rulare, validată la `StartRun`, înghețată în snapshot și folosită de `Classify`/`ClassifyGroup`.
- SQL Server Agent rulează fazele grele, evitând plafonul de 60 s al apelurilor AJS; `applyToErp` rămâne amânat.
- Acceptanța S8 folosește banda `FLAG_RATIO 0,50–2,00`, nu eticheta strictă `FLAG=OK` și nu numere fixe de rânduri.

## Open Questions
- Autoritatea A1-A4/B2 (Z2) și N01/N02/N06/N05 (Z3) se închide doar prin răspunsul beneficiarului.
- Rămân de clarificat `LT_ZILE`/`FRECVENTA_ZILE`, `COV_MEDIU`, `σ_LT`, `FLAGS_ZERO_LA_APPLY` și formula ABC pe grupă.
- Intenția matricei COV rămâne deschisă, deși comparația numerică este corectată la `CX = BY = 2,00 > BZ = 1,75`.

## Next Step
- Pregătește Faza 1 prin revizuirea parametrilor P1-P15 și a testelor T1-T6, fără rulare sau scriere în S1 până la aprobarea explicită.

