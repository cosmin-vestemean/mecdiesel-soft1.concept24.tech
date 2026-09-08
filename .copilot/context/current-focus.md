# Current Focus

## Last Updated
- 08.09.2026 (sesiunea 40)

## Current Goal
- Faza 5 are pașii 0-5 și 7 implementați; cablajul de autorizare din Pasul 6 este funcțional.
- Baseline-ul Nivel B pentru `RUNID=5` este înghețat: 31 triplete, 35 criterii și 31/31
  recalculări independente PASS; nu s-a pornit `RUNID=6`.
- Fazele 0-3 sunt deployate, `RUNID=5` rămâne sesiunea curentă, iar scrierile sunt oprite.

## Active Area
- UI-ul, activarea lazy și autentificarea JWT Socket.IO sunt validate live; vezi
  [faza5-ui-frontend.md](../wiki/faza5-ui-frontend.md) și [faza5-ui-backend.md](../wiki/faza5-ui-backend.md).
- Nivel B are selecția și referințele persistente complete; comparația manuală cu drawer-ul
  `explain` rămâne deschisă înaintea porții Fazei 5.

## Relevant Files
- [FAZA5_REMEDIERI_PLAN.md](../../new_min_max/FAZA5_REMEDIERI_PLAN.md) — progresul canonic și poarta de acceptanță.
- `new_min_max/analiza/esantion_minmax_run5.json` — baseline-ul versionat, cu serii de 52 săptămâni.
- `new_min_max/tools/freeze-minmax-sample.cjs` — generator read-only și recalcul independent.
- [minmax-engine-formulas.md](../wiki/minmax-engine-formulas.md) — formule și metodologia Nivelului B.
- [FAZA6_CONTRACT.md](../../new_min_max/FAZA6_CONTRACT.md) — următoarea fază propusă.

## Confirmed Decisions
- Modelul de operare și retenția rămân cele din [minmax-engine-model.md](../wiki/minmax-engine-model.md).
- Baseline-ul folosește numai stare persistentă `RUNID=5`; nu regenerează selecția din ERP live.
- Sunt relevante 22 celule `CLASA × MARIME`: `MARE/MIC`; `MEDIU` lipsește complet din RUNID=5.
- `N_PACK=1` pe toate rândurile RUNID=5, deci ramura de rotunjire pack nu poate fi exercitată.
- Seria sparse persistată este materializată în snapshot la 52 săptămâni, cu zerouri explicite.
- `saveParams` rămâne atomic, iar `MINMAX_ENGINE_WRITES_ENABLED=false` până la audit și activare deliberată.
- Sesiunea curentă se rezolvă prin `ESTE_CURENT` plus statusurile DONE, niciodată prin `MAX(RUNID)`.

## Open Questions
- Nivel B: comparația manuală a celor 31 triplete cu drawer-ul `explain`.
- Pasul 6: audit `saveParams`, salvare/read-back, rollback, control 403 și activarea deliberată.
- Confirmarea beneficiarului pe formule și pe butonul de lansare din Faza 6.
- `NR_SKU_GRP` rămâne defect cosmetic, programat în pachetul Fazei 6.

## Next Step
- Compară valorile celor 31 triplete înghețate cu drawer-ul `explain` și consemnează diferențele;
  nu declara Nivelul B închis înaintea verificării manuale.
