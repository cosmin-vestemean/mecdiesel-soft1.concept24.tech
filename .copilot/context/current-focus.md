# Current Focus

## Last Updated
- 08.09.2026 (sesiunea 45)

## Current Goal
- Faza 6 este implementată, deployată și instalată; Nivelul B pentru `RUNID=5` rămâne înghețat și închis.
- Kill-switch-ul a fost validat live: `saveParams` și `runEngine` au răspuns `403` cu `MINMAX_ENGINE_WRITES_ENABLED=false` și rol `minmax.edit` prezent.
- După activare deliberată, UI-ul a creat `RUNID=6`; `runPhases` a eșuat la timeout S1, apoi `AbandonRun` a închis sesiunea.
- `RUNID=5` rămâne `DONE` și `ESTE_CURENT=1`; nu s-au validat invariante pe `RUNID=6`.

## Active Area
- Se investighează timeout-ul `S1:Exception: Ole Error 80040E31. Query timeout expired` din pipeline-ul AJS `runPhases`; vezi [minmax-engine-model.md](../wiki/minmax-engine-model.md).
- Kill-switch-ul este activat în producție după validare; nu se pornește o sesiune nouă până la clarificarea timeout-ului.

## Relevant Files
- [FAZA6_CONTRACT.md](../../new_min_max/FAZA6_CONTRACT.md) — contractul lifecycle și orchestration.
- [minmax-engine-model.md](../wiki/minmax-engine-model.md) — modelul sesiunii și constrângerea de timing observată live.
- [NewMinMax.js](../../S1-MEC/AJS/NewMinMax.js) — endpoint-urile AJS `startRun`, `runPhases` și `AbandonRun`.
- [minmax-engine.class.js](../../src/services/minmax-engine/minmax-engine.class.js) — clientul Feathers și traducerea erorilor.
- [minmax-engine-store.js](../../public/stores/minmax-engine-store.js) — lansare, polling și recuperarea sesiunii.

## Confirmed Decisions
- Baseline-ul și explicațiile de verificare folosesc doar starea persistentă din `RUNID=5`, nu ERP live.
- `runEngine` păstrează separarea `startRun` sincron / `runPhases` fire-and-forget; progresul se citește din `history()`.
- `AbandonRun` este calea explicită pentru o fază eșuată; `RUNID=6` nu este reutilizat și nu devine curent.
- Sesiunea curentă se rezolvă prin `ESTE_CURENT` și statusuri `DONE`, niciodată prin `MAX(RUNID)`.
- `PurgeRun` păstrează antetele `RUN`/`GRP` și refuză sesiunea curentă sau `OPEN`.

## Open Questions
- Timeout-ul este în AJS/WSMCP sau în procedura SQL; trebuie identificată limita exactă și remedierea minimă.
- După remediere, este necesară o nouă lansare deliberată și validarea celor 9 invariante.
- Suita are încă eșecul preexistent pentru serviciul lipsă `mec-item-producer-relation`.
- Rămâne confirmarea beneficiarului pe formule și comportamentul butonului după prima rulare completă.

## Next Step
- Determină sursa timeout-ului `runPhases` și validează remedierea fără a lansa o nouă sesiune; apoi pornește următoarea rulare din UI și verifică invariantele 9/9.
