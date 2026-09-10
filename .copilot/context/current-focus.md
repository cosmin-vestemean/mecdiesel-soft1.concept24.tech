# Current Focus

## Last Updated
- 10.09.2026 (session 6)

## Current Goal
- Primul bloc aprobat al Fazei 1 este implementat, deployat și verificat end-to-end prin RUNID 8, prima sesiune cu snapshot complet; toate fazele și invariantele sunt valide.
- Observabilitatea MIN/MAX este completată: progres per fază, timestamp-uri/durate în istoric și Explain, scroll modal corect, fără 404 CSS și cu WebSocket funcțional prin Nginx.

## Active Area
- MIN/MAX v5 este live pe RUNID 8 (`FULL`, `CLIENT`, calibrare `C`, `DONE`, curent), cu snapshot `CCCMINMAXRUNPARAM` și execuție SQL Server Agent.
- Modificările acestei sesiuni sunt locale/necomise; backend-ul a fost restartat, frontend-ul este servit direct, iar Top ABC nu are diff.

## Relevant Files
- [Model și operare](../wiki/minmax-engine-model.md): sesiuni, snapshot, Agent, retenție, observabilitate, transport și reperul RUNID 8.
- [Formule](../wiki/minmax-engine-formulas.md): formulele și ordinea de calcul.
- [Întrebări business](../wiki/minmax-engine-open-items.md): deciziile încă neconfirmate.
- [Matrice P1-P15](../../new_min_max/10.09.2026/MATRICE_EXECUTABILA_P1-P15_2026-09-10.md) și [plan](../../new_min_max/10.09.2026/PLAN_ALINIERE_2026-09-10.md): ordinea autorizată de implementare.
- [Serviciu](../../src/services/minmax-engine/minmax-engine.class.js), [panou rulare](../../public/components/minmax-engine/minmax-run-panel.js) și [Explain](../../public/components/minmax-engine/minmax-explain-drawer.js): suprafața schimbată în sesiunea 6.

## Confirmed Decisions
- Snapshot-ul unic este `CCCMINMAXRUNPARAM`; fazele persistate refuză snapshot-ul lipsă prin 50074-50076, iar coloanele JSON legacy sunt eliminate.
- SQL Server Agent execută `Classify → ClassifyGroup → Compute → FinishRun`; browserul doar lansează și urmărește starea persistentă.
- P3/P7 sunt simetrice între SKU și grupe; P8 permite `SIGMA_MIN=0`; P14 evidențiază A/B/C fără să schimbe motorul. Detaliile sunt în [model](../wiki/minmax-engine-model.md).
- P6 păstrează globali parametrii de clasificare și permite override numai pentru `LT_ZILE`/`FRECVENTA_ZILE`, cu precedența `BRANCH+PREFIX > BRANCH > PREFIX > GLOBAL`.
- `MOD_ATRIBUIRE_FILIALA` rămâne `CLIENT`; `applyToErp` rămâne amânat.

## Open Questions
- P2, P4/N9-N10, P5 și P10-P13 rămân blocate de decizii business; vezi [întrebările deschise](../wiki/minmax-engine-open-items.md).
- P6 poate avansa pe override branch; extensia longest-prefix așteaptă lista N5. Plancherul `σ_WK=1,3` rămâne fără confirmare documentară.

## Next Step
- Implementă P6 pentru override branch al `LT_ZILE`/`FRECVENTA_ZILE`, fără longest-prefix până la primirea listei N5; apoi continuă cu P1.

