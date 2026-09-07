# Current Focus

## Last Updated
- 07.09.2026 (sesiunea 37)

## Current Goal
- Faza 5 are pașii 0-5 și 7 implementați; cablajul de autorizare din Pasul 6 este funcțional.
- Remedierea acestei sesiuni elimină cererile MIN/MAX anonime făcute înainte de login și mesajele
  `Not authenticated` rezultate din ele.
- Fazele 0-3 ale motorului sunt deployate; `RUNID=5` este sesiunea curentă. Scrierile rămân oprite.

## Active Area
- Pasul 7 (§12.9) este complet: containerul se montează fără fetch, iar clickul pe tab apelează
  `activate()` idempotent pentru `history`, `params`, `results` și `groupAbc`.
- Autentificarea JWT Socket.IO după login/reconnect rămâne proprietarul accesului la serviciu;
  detalii în [faza5-ui-backend.md](../wiki/faza5-ui-backend.md) și [faza5-ui-frontend.md](../wiki/faza5-ui-frontend.md).
- Validare: 108 teste MIN/MAX verzi; retestarea vizuală după logout/login nu a fost făcută deoarece
  pagina browserului nu a fost partajată.

## Relevant Files
- [FAZA5_REMEDIERI_PLAN.md](../../new_min_max/FAZA5_REMEDIERI_PLAN.md) — progresul canonic și poarta de acceptanță.
- [faza5-ui-frontend.md](../wiki/faza5-ui-frontend.md) — activare lazy, store și componente.
- [faza5-ui-backend.md](../wiki/faza5-ui-backend.md) — transport, autorizare și contractul serviciului.
- `public/components/minmax-engine/minmax-engine-container.js`, `minmax-group-abc.js` — activarea lazy.
- `public/userInteractions.js` — activarea la click pe tab; `test/components/minmax-engine/minmax-engine-container.test.js` — regresie.
- [minmax-engine-formulas.md](../wiki/minmax-engine-formulas.md) / [minmax-engine-open-items.md](../wiki/minmax-engine-open-items.md) — Pasul 8 și întrebări business.

## Confirmed Decisions
- Datele protejate nu se încarcă în `connectedCallback()`; prima deschidere a tabului este limita de activare.
- `activate()` păstrează aceeași promisiune și nu repetă inițializarea la revenirea în tab.
- Rolurile sunt server-side, tokenul aplicației rămâne numai în memoria paginii, iar Socket.IO se autentifică pe conexiune.
- `saveParams` rămâne atomic, iar `MINMAX_ENGINE_WRITES_ENABLED=false` până la audit și activare deliberată.
- Sesiunea curentă se rezolvă prin `ESTE_CURENT` plus statusurile DONE, niciodată prin `MAX(RUNID)`.

## Open Questions
- Pasul 6: audit la save, apoi decizia explicită de activare a scrierilor.
- Pasul 8: invariante SQL, eșantion numeric înghețat și confirmarea beneficiarului pe formule.
- Retestare live după login pentru dispariția erorii; garda `FEATHERS_SECRET` rămâne în [open-threads.md](open-threads.md).

## Next Step
- Retestează live prin logout/login și deschiderea tabului MIN/MAX; apoi implementează auditul `saveParams` cu REFID, timestamp și cheile logice modificate, fără valori secrete.
