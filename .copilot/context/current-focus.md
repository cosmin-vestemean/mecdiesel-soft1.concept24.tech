# Current Focus

## Last Updated
- 07.09.2026 (sesiunea 36 — Pasul 6 §12.8: Socket.IO JWT reparat)

## Current Goal
- Faza 5 este cablată și fluxul read-only funcționează live; acceptanța urmează planul din
  [FAZA5_CONTRACT.md](../../new_min_max/FAZA5_CONTRACT.md) §12 și [FAZA5_REMEDIERI_PLAN.md](../../new_min_max/FAZA5_REMEDIERI_PLAN.md).
- Fazele 0-3 ale motorului sunt deployate și validate; `RUNID=5` este sesiunea curentă.
- Poarta către Faza 4 rămâne pasul 8: invariante pe populație, eșantion numeric înghețat și confirmarea beneficiarului pe formule.

## Active Area
- Pasul 6 (§12.8) are autentificarea complet cablată: token emis la `validateUserPwd`, roluri server-side,
  hook-uri pe `minmax-engine`, și autentificare JWT a conexiunii Socket.IO după login/reconnect. Vezi
  [faza5-ui-backend.md](../wiki/faza5-ui-backend.md#autorizare-128--cablaj-complet).
- **Comportament live neschimbat**: `MINMAX_ENGINE_WRITES_ENABLED` rămâne `false`; nimic nu s-a
  deblocat pentru utilizatori reali.
- Mai rămân auditul save și flip-ul deliberat al flagului. Pasul 7 va coalesca rezoluția inițială de
  sesiune pentru `results()`/`groupAbc()`.

## Relevant Files
- [FAZA5_REMEDIERI_PLAN.md](../../new_min_max/FAZA5_REMEDIERI_PLAN.md) — ordine și teste pentru remedieri.
- [faza5-ui-backend.md](../wiki/faza5-ui-backend.md) / [faza5-ui-frontend.md](../wiki/faza5-ui-frontend.md) — implementare și verificări live.
- [minmax-engine-model.md](../wiki/minmax-engine-model.md) / [minmax-engine-formulas.md](../wiki/minmax-engine-formulas.md) — domeniu și formule.
- [minmax-engine-open-items.md](../wiki/minmax-engine-open-items.md) / [open-threads.md](open-threads.md) — întrebări și fire tangențiale.
- Autorizare: `src/services/minmax-engine/{roles,authorize}.js`, `src/authentication.js`, `src/app.js`,
  `public/stores/app-auth.js`, `public/socketConfig.js`, `public/login/login.js`, `minmax-engine-store.js`.
- Teste: `test/services/minmax-engine/{roles,authorize}.test.js`,
  `test/services/s1-validate-user-pwd.test.js`, `test/stores/app-auth.test.js`.
- [FAZA4_CONTRACT.md](../../new_min_max/FAZA4_CONTRACT.md) — `applyToErp`, amânat după Faza 5.

## Confirmed Decisions
- Rolurile vin din configurație server-side (`minmaxEngine.readers`/`editors`), nu tabelă ACL —
  motivul e în [FAZA5_CONTRACT.md](../../new_min_max/FAZA5_CONTRACT.md) §12.8.
- Convenție unificată: orice pereche cheie-config/variabilă-env pentru minmax-engine — env-ul
  câștigă când e definit, chiar și cu valoare goală explicită.
- Tokenul de aplicație se emite direct (`createAccessToken`), nu prin `authentication.create()`;
  clientul folosește apoi `authentication.create()` exclusiv pentru a-l atașa conexiunii Socket.IO.
  Apelurile server-side fără `params.provider` ocolesc autorizarea, deliberat.
- `saveParams` rămâne atomic cu payload JSON + `OPENJSON`, maximum 4 parametri și verificare `__ok` plus read-back.
- Scrierea rămâne oprită până la audit + flip deliberat al flagului (ultimele 2 bife ale Pasului 6).
- Sesiunea aplicației are 8 ore absolute, fără refresh/sliding expiration, doar în memoria paginii;
  reconectarea Socket.IO cere reautentificare cu același token neexpirat.
- Rezoluția sesiunii curente folosește `ESTE_CURENT` și statusurile DONE, niciodată `MAX(RUNID)`.
- CLASA are 11 valori posibile (9 combinații ABC×XYZ + NOU + OD), nu 9 — definite o singură dată
  per parte (backend `CLASA_VALUES`, UI `minmax-engine-constants.js`).

## Open Questions
- Restul Pasului 6: audit la save, apoi flip deliberat `MINMAX_ENGINE_WRITES_ENABLED=true`.
- Garda fail-fast pentru `FEATHERS_SECRET` placeholder este în [open-threads.md](open-threads.md).
- Pașii 7-8 din §12 rămân de implementat înaintea validării numerice.
- Întrebările de business și firele tangențiale sunt în [minmax-engine-open-items.md](../wiki/minmax-engine-open-items.md) și [open-threads.md](open-threads.md).

## Next Step
- Audit la `saveParams`: REFID, timestamp, cheile logice modificate — fără valori secrete. Abia apoi
  flip-ul flagului de scriere. Folosește Node.js 20.20.2; pentru suita completă cu PM2 activ:
  `PORT=3999 npx mocha test/ --recursive` (121 verzi, un eșec preexistent).
