# Current Focus

## Last Updated
- 08.09.2026 (sesiunea 47)

## Current Goal
- Finalizează deploy-ul hardening-ului SQL Server Agent pentru Faza 6 fără a crea încă o sesiune.
- Starea live confirmată: `RUNID=5` este `DONE`/`ESTE_CURENT=1`; `RUNID=6` este
  `ABANDONED`/`ERROR`; jobul `MEC_MinMaxEngine_RunPhases_1000` este enabled și inactiv.

## Active Area
- Codul local finalizat mută `Classify → ClassifyGroup → Compute → FinishRun` în SQL Server Agent,
  eliminând plafonul AJS de 60s. Prima versiune Agent este instalată în producție; revizia locală
  post-review nu este încă redeployată. Vezi [minmax-engine-model.md](../wiki/minmax-engine-model.md).

## Relevant Files
- [FAZA6_CONTRACT.md](../../new_min_max/FAZA6_CONTRACT.md) — contract, ordine de livrare și criterii de readiness.
- [minmax-engine-model.md](../wiki/minmax-engine-model.md) — arhitectura durabilă, timeout-ul confirmat și lifecycle-ul.
- [00i_run_phases.sql](../../new_min_max/sql/00i_run_phases.sql) — wrapperul Agent pentru unica sesiune `OPEN`.
- [00j_ensure_agent_job.sql](../../new_min_max/sql/00j_ensure_agent_job.sql) — recrearea tranzacțională a jobului per companie.
- [NewMinMax.js](../../S1-MEC/AJS/NewMinMax.js) — installer, readiness, lansare Agent și protecția abandonului.
- [minmax-engine.class.js](../../src/services/minmax-engine/minmax-engine.class.js) — lansare sincronă și traducerea erorilor AJS.
- [minmax-engine-store.js](../../public/stores/minmax-engine-store.js) / [minmax-run-panel.js](../../public/components/minmax-engine/minmax-run-panel.js) — polling, erori și protecția UI.

## Confirmed Decisions
- `X.RUNSQL`/`X.GETSQLDATASET` au un CommandTimeout ADO fix de 60s; SQL Server Agent este remedierea aleasă, nu fragmentarea procedurii `Classify`.
- `runEngine` așteaptă doar lansarea rapidă a jobului. Baza de date rămâne sursa de adevăr pentru progres, iar UI face polling.
- `sp_MinMaxEngine_RunPhases` identifică strict unica sesiune `OPEN`; rezoluția sesiunii curente nu folosește niciodată `MAX(RUNID)`.
- Setup-ul nu realiniază jobul activ; start-ul cere readiness complet înainte de a crea un `RUNID`; abandonul este blocat cât jobul este activ sau cerut.
- `sync-check.cjs` confirmă 13/13 perechi SQL/AJS. `node --check` și suita focalizată au trecut cu 144 teste.

## Open Questions
- Este necesar redeploy-ul manual al versiunii curente din `NewMinMax.js`, urmat imediat de `setup()`.
- Statusul deploy-ului aplicației Feathers/UI pentru protecțiile de polling și abandon trebuie confirmat înainte de primul run UI.
- După setup, execuția Agent completă pe producție nu este încă validată; scriptul AJS diagnostic temporar trebuie eliminat din S1.

## Next Step
- După confirmarea redeploy-ului AJS, rulează `NewMinMax/setup` și verifică read-only jobul/procedurile; nu porni un `RUNID` până acea verificare nu reușește.
