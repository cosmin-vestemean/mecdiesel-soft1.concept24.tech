# Current Focus

## Last Updated
- 08.09.2026 (sesiunea 41)

## Current Goal
- Faza 5 are pașii 0-5 și 7 implementați; cablajul de autorizare din Pasul 6 este funcțional.
- Baseline-ul Nivel B pentru `RUNID=5` este înghețat: 31 triplete, 35 criterii și 31/31
  recalculări independente PASS; nu s-a pornit `RUNID=6`.
- Comparația live a celor 31 de triplete în drawer este executată; a găsit două defecte de transport
  în `explain()`, ambele remediate, iar reverificarea de după redeploy este 31/31 fără diferențe.
- Nivel B este ÎNCHIS; poarta Fazei 5 rămâne deschisă pe Pasul 6 și pe confirmarea beneficiarului.
- Fazele 0-3 sunt deployate, `RUNID=5` rămâne sesiunea curentă, iar scrierile sunt oprite.

## Active Area
- UI-ul, activarea lazy și autentificarea JWT Socket.IO sunt validate live; vezi
  [faza5-ui-frontend.md](../wiki/faza5-ui-frontend.md) și [faza5-ui-backend.md](../wiki/faza5-ui-backend.md).
- `explain()` și `results()` recitesc `COV_TGT`/`SL`/`SSF` ca `DECIMAL(28, 8)`; WSMCP rotunjește
  `DECIMAL(10, 4)` la întreg, deci `SELECT *` simplu pe `CCCMINMAXDET` nu mai este acceptabil.
- Seria densă din `explain()` acoperă `0..51`, aliniat la `CCCMINMAXWEEK`. Detaliile complete sunt
  în planul de remedieri, Pasul 8, și în [faza5-ui-backend.md](../wiki/faza5-ui-backend.md).

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
- `WEEK_INDEX=0` este săptămâna lui `AZI`; orice materializare densă trebuie să acopere `0..51`.
- `saveParams` rămâne atomic, iar `MINMAX_ENGINE_WRITES_ENABLED=false` până la audit și activare deliberată.
- Sesiunea curentă se rezolvă prin `ESTE_CURENT` plus statusurile DONE, niciodată prin `MAX(RUNID)`.

## Open Questions
- Pasul 6: audit `saveParams`, salvare/read-back, rollback, control 403 și activarea deliberată.
- Suita de teste are un eșec preexistent, fără legătură cu MIN/MAX: `mec-item-producer-relation`
  are test, dar niciun serviciu în `src/`. Blochează bifa „suită unit/component verde" din poartă.
- Confirmarea beneficiarului pe formule și pe butonul de lansare din Faza 6.
- `NR_SKU_GRP` rămâne defect cosmetic, programat în pachetul Fazei 6.

## Next Step
- Atacă Pasul 6: audit `saveParams` cu salvare controlată, read-back, rollback care nu raportează
  succes și 403 pentru utilizator read-only; scrierile rămân oprite până la activarea deliberată.
