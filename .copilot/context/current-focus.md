# Current Focus

## Last Updated
- 08.09.2026 (sesiunea 49)

> **⚠️ A NU SE SALVA ÎN ERP DATELE MIN/MAX PÂNĂ NU AVEM APROBARE DE LA BENEFICIAR.** `applyToErp`
> (Faza 4) NU e implementat, deliberat, până la confirmarea beneficiarului pe formule.

## Current Goal
- Faza 5: poarta de acceptanță §12.15 rămâne **tehnic complet închisă** — singurul punct rămas e
  confirmarea beneficiarului pe formule (decizie de business).
- Anexa de ergonomie UI (11 puncte, filtre/culori/KaTeX) **implementată și verificată live** —
  vezi [FAZA5_REMEDIERI_PLAN.md](../../new_min_max/FAZA5_REMEDIERI_PLAN.md) secțiunea Anexă
  („Rezultat implementare"), [faza5-ui-frontend.md](../wiki/faza5-ui-frontend.md).

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
  §12.15 + Anexa (ergonomie UI, implementată 08.09.2026).
- [faza5-ui-frontend.md](../wiki/faza5-ui-frontend.md) — arhitectura frontend, la zi (KaTeX pentru
  formula din drawer, gotcha CDN `unsafeHTML`).
- [faza5-ui-backend.md](../wiki/faza5-ui-backend.md) — arhitectura backend, la zi.
- [softone-error-codes.md](../wiki/softone-error-codes.md) — helper comun coduri eroare SoftOne
  (`public/shared/softone-error-codes.js`), reutilizat de branch-replenishment și minmax-engine.
- [minmax-engine-model.md](../wiki/minmax-engine-model.md) — arhitectura durabilă a motorului.
- [minmax-engine-open-items.md](../wiki/minmax-engine-open-items.md) — întrebări de business
  deschise.

## Confirmed Decisions
- Faza 6 finalizată: `Classify → ClassifyGroup → Compute → FinishRun` rulează în SQL Server Agent.
- Poarta §12.15 a Fazei 5 tehnic închisă (vezi Active Area + link-urile de mai sus).
- Anexa de ergonomie UI implementată: filtre pe 3 niveluri, contor filtre active, sticky header,
  culori WCAG AA, formula din drawer randată cu KaTeX — 186/186 teste relevante verzi.
- KaTeX e folosit doar pentru drawer-ul „explică calcul" (valori substituite live), nu pentru
  wiki-ul HTML static (D6 din `FAZA3_HANDOFF.md` §9.6, neconstruit, rămâne deschisă separat).
- Faza 4 (`applyToErp`) rămâne deliberat amânată până la confirmarea beneficiarului.

## Open Questions
- Niciuna tehnică; singurul punct deschis e o decizie de business (confirmare beneficiar pe
  formule).

## Next Step
- Obține confirmarea beneficiarului pe formulele MIN/MAX (deschide Faza 4). Înainte de utilizare
  de către beneficiar, restrânge `minmaxEngine.editors` de la `"*"` la o listă explicită.

