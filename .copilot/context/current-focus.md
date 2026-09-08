# Current Focus

## Last Updated
- 08.09.2026 (sesiunea 43)

## Current Goal
- Faza 6 are pașii 1-11 implementați/executați și este deployată; scrierile nu sunt încă activate.
- Baseline-ul Nivel B pentru `RUNID=5` este înghețat: 31 triplete, 35 criterii și 31/31
  recalculări independente PASS; nu s-a pornit `RUNID=6`.
- Nivel B este ÎNCHIS: cele 31 de triplete au fost reverificate live după redeploy, fără diferențe.
- `runEngine`, lifecycle-ul, auditul și butonul UI sunt acoperite de 139 teste; scrierile rămân oprite.
- Artefactele legacy `RUNID 1-4` au fost șterse complet; toate cele cinci tabele verificate au zero rânduri.
- `NewMinMax/setup` a reușit după separarea procedurilor lifecycle în batch-uri distincte.
- Fazele 0-3 sunt deployate, `RUNID=5` rămâne sesiunea curentă, iar scrierile sunt oprite.

## Active Area
- Orchestrarea Fazei 6 este în cod: endpoint-uri AJS fixe, transport Feathers separat de WSMCP,
  lifecycle explicit și polling UI; vezi [minmax-engine-model.md](../wiki/minmax-engine-model.md).
- `ClassifyGroup` folosește populația filialelor incluse; verificarea read-only a găsit 0 din 43
  grupe exclusiv pe filiale excluse.

## Relevant Files
- [FAZA5_REMEDIERI_PLAN.md](../../new_min_max/FAZA5_REMEDIERI_PLAN.md) — poarta Nivel B și starea Fazei 5.
- [FAZA6_CONTRACT.md](../../new_min_max/FAZA6_CONTRACT.md) — contractul și checklist-ul Fazei 6.
- [minmax-engine.class.js](../../src/services/minmax-engine/minmax-engine.class.js) — proiecții exacte și CTE `0..51`.
- [NewMinMax.js](../../S1-MEC/AJS/NewMinMax.js) — installer SQL și endpoint-urile lifecycle/run.
- [minmax-engine-store.js](../../public/stores/minmax-engine-store.js) — lansare și polling browser.

## Confirmed Decisions
- Modelul de operare și retenția rămân cele din [minmax-engine-model.md](../wiki/minmax-engine-model.md).
- Baseline-ul folosește numai stare persistentă `RUNID=5`; nu regenerează selecția din ERP live.
- Sunt relevante 22 celule `CLASA × MARIME`: `MARE/MIC`; `MEDIU` lipsește complet din RUNID=5.
- `N_PACK=1` pe toate rândurile RUNID=5, deci ramura de rotunjire pack nu poate fi exercitată.
- `WEEK_INDEX=0` este săptămâna lui `AZI`; orice materializare densă trebuie să acopere `0..51`.
- `COV_TGT`/`SL`/`SSF` se proiectează ca `DECIMAL(28,8)` sub alias și se pliază înapoi; nu se
  reintroduce `SELECT *` simplu pe `CCCMINMAXDET`.
- `saveParams` rămâne atomic, iar `MINMAX_ENGINE_WRITES_ENABLED=false` până la audit și activare deliberată.
- `runEngine` separă `startRun` sincron de `runPhases` fire-and-forget; progresul vine din `history()`.
- `PurgeRun` păstrează `RUN`/`GRP` și refuză sesiunea curentă sau `OPEN`.
- Endpoint-urile AJS lifecycle cer cheia app `ALLOW_WRITE=1`; retenția N este enforcată prin `50044`.
- Sesiunea curentă se rezolvă prin `ESTE_CURENT` plus statusurile DONE, niciodată prin `MAX(RUNID)`.

## Open Questions
- Validarea endpoint-urilor cu kill-switch oprit, apoi activarea deliberată și prima rulare din UI.
- Suita de teste are un eșec preexistent, fără legătură cu MIN/MAX: `mec-item-producer-relation`
  are test, dar niciun serviciu în `src/`. Blochează bifa „suită unit/component verde" din poartă.
- Confirmarea beneficiarului pe formule și pe butonul de lansare din Faza 6.
- Fixul `NR_SKU_GRP` este implementat local în pachetul Fazei 6 și așteaptă deploy-ul unic.

## Next Step
- Validează că operațiile de scriere răspund 403 cu kill-switch-ul oprit; apoi activează deliberat
  flag-ul și pornește prima sesiune din UI (`RUNID=6`), urmată de invariantele 9/9.
