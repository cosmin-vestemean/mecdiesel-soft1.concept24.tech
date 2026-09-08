# Current Focus

## Last Updated
- 08.09.2026 (sesiunea 48)

> **⚠️ A NU SE SALVA ÎN ERP DATELE MIN/MAX PÂNĂ NU AVEM APROBARE DE LA BENEFICIAR.** `applyToErp`
> (Faza 4) NU e implementat, deliberat, până la confirmarea beneficiarului pe formule.

## Current Goal
- Faza 6 (motor SQL Server Agent) finalizată și confirmată live.
- Faza 5: poarta de acceptanță §12.15 e acum **tehnic complet închisă** (08.09.2026) — suită
  verde, 403 read-only pe lanțul de hook-uri real, salvare+read-back și simulare de rollback
  verificate LIVE contra S1 producție. Detalii → [FAZA5_REMEDIERI_PLAN.md](../../new_min_max/FAZA5_REMEDIERI_PLAN.md) §12.15,
  [faza5-ui-backend.md](../wiki/faza5-ui-backend.md).

## Active Area
- Singurul punct rămas pentru Faza 5: **confirmarea beneficiarului pe formule** (decizie de
  business, nu tehnică) — deschide Faza 4.
- `minmaxEngine.editors="*"` e o deviere temporară deliberată ("deocamdată") pentru testare — de
  restrâns la o listă explicită înainte de utilizare de beneficiar
  ([FAZA5_CONTRACT.md](../../new_min_max/FAZA5_CONTRACT.md) §12.8).
- Nu presupune starea flagurilor de scriere din `config/default.json`/`.env` — procesul pm2 live
  își setează mediul direct (vezi [faza5-ui-backend.md](../wiki/faza5-ui-backend.md)).

## Relevant Files
- [FAZA5_REMEDIERI_PLAN.md](../../new_min_max/FAZA5_REMEDIERI_PLAN.md) — plan de execuție + poarta
  §12.15 (sursă de adevăr pentru ce rămâne).
- [faza5-ui-backend.md](../wiki/faza5-ui-backend.md) — arhitectura backend, la zi.
- [softone-error-codes.md](../wiki/softone-error-codes.md) — helper comun coduri eroare SoftOne
  (`public/shared/softone-error-codes.js`), reutilizat de branch-replenishment și minmax-engine.
- [minmax-engine-model.md](../wiki/minmax-engine-model.md) — arhitectura durabilă a motorului.
- [minmax-engine-open-items.md](../wiki/minmax-engine-open-items.md) — întrebări de business
  deschise.

## Confirmed Decisions
- Faza 6 finalizată: `Classify → ClassifyGroup → Compute → FinishRun` rulează în SQL Server Agent.
- Poarta §12.15 a Fazei 5 tehnic închisă 08.09.2026 (vezi Active Area + link-urile de mai sus).
- Faza 4 (`applyToErp`) rămâne deliberat amânată până la confirmarea beneficiarului.

## Open Questions
- Niciuna tehnică; singurul punct deschis e o decizie de business (confirmare beneficiar pe
  formule).

## Next Step
- Obține confirmarea beneficiarului pe formulele MIN/MAX (deschide Faza 4). Înainte de utilizare
  de către beneficiar, restrânge `minmaxEngine.editors` de la `"*"` la o listă explicită.

