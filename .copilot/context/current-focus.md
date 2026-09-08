# Current Focus

## Last Updated
- 08.09.2026 (sesiunea 47)

## Current Goal
- Deploy-ul AJS și `NewMinMax/setup` pentru hardening-ul SQL Server Agent din Faza 6 sunt finalizate.
- Starea live confirmată: `RUNID=5` este `DONE`/`ESTE_CURENT=1`; `RUNID=6` este
  `ABANDONED`/`ERROR`; zero sesiuni `OPEN`; jobul `MEC_MinMaxEngine_RunPhases_1000` este enabled,
  valid și inactiv, iar SQL Server Agent este `Running`/`Automatic`.

## Active Area
- Codul local finalizat mută `Classify → ClassifyGroup → Compute → FinishRun` în SQL Server Agent,
  eliminând plafonul AJS de 60s. Revizia post-review este instalată în producție; `setup()` păstrează
  acum jobul valid prin early-return, evitând eroarea de realiniere a unui job raportat de Agent ca
  provenit de la MSX. Vezi [minmax-engine-model.md](../wiki/minmax-engine-model.md).

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
- Statusul deploy-ului aplicației Feathers/UI pentru protecțiile de polling și abandon trebuie confirmat înainte de primul run UI.
- Execuția Agent completă pe producție nu este încă validată; scriptul AJS diagnostic temporar trebuie eliminat din S1.

## Next Step
- Confirmă deploy-ul Feathers/UI, apoi pornește primul run complet din UI și urmărește polling-ul până la `DONE`; nu lansa manual procedura Agent.
