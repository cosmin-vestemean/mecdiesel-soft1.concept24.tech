# Current Focus

## Last Updated
- 08.09.2026 (sesiunea 39)

## Current Goal
- Faza 5 are pașii 0-5 și 7 implementați; cablajul de autorizare din Pasul 6 este funcțional.
- Activarea lazy a fost confirmată live: zero cereri MIN/MAX înainte de login, exact cele patru
  fluxuri la prima deschidere și zero repetări la revenirea în tab.
- Fazele 0-3 ale motorului sunt deployate; `RUNID=5` este sesiunea curentă. Scrierile rămân oprite.
- Restanțele au fost reconciliate cu `PLAN_IMPLEMENTARE.md`, `FAZA5_REMEDIERI_PLAN.md` și
  `analiza/SINTEZA_FINALA.md`; recomandările vechi pentru winsorizare, `SIGMA_WK`, HQ CAP, podea și
  `N_PACK` în calcul sunt deja implementate, nu lucrări noi.

## Active Area
- Pasul 7 (§12.9) este complet: containerul se montează fără fetch, iar clickul pe tab apelează
  `activate()` idempotent pentru `history`, `params`, `results` și `groupAbc`.
- Autentificarea JWT Socket.IO după login/reconnect rămâne proprietarul accesului la serviciu;
  detalii în [faza5-ui-backend.md](../wiki/faza5-ui-backend.md) și [faza5-ui-frontend.md](../wiki/faza5-ui-frontend.md).
- Validare: 108 teste MIN/MAX verzi; test live 08.09.2026 pe login, activare, reconnect Socket.IO,
  toate sortările, selectoarele, paginarea și drawer-ul `explain`, fără `Not authenticated`.
- Mai rămân auditul `saveParams`, poarta de validare live/numerică și confirmarea beneficiarului;
  Faza 4 `applyToErp` rămâne amânată până la trecerea porții Fazei 5.

## Relevant Files
- [FAZA5_REMEDIERI_PLAN.md](../../new_min_max/FAZA5_REMEDIERI_PLAN.md) — progresul canonic și poarta de acceptanță.
- [faza5-ui-frontend.md](../wiki/faza5-ui-frontend.md) — activare lazy, store și componente.
- [faza5-ui-backend.md](../wiki/faza5-ui-backend.md) — transport, autorizare și contractul serviciului.
- `public/components/minmax-engine/minmax-engine-container.js`, `minmax-group-abc.js` — activarea lazy.
- `public/userInteractions.js` — activarea la click pe tab; `test/components/minmax-engine/minmax-engine-container.test.js` — regresie.
- [minmax-engine-formulas.md](../wiki/minmax-engine-formulas.md) / [minmax-engine-open-items.md](../wiki/minmax-engine-open-items.md) — Pasul 8 și întrebări business.

## Confirmed Decisions
- **Centrul de greutate e sesiunea curentă, reiterată până la satisfacție, apoi scrisă în ERP.**
  Istoricul e produs secundar — vezi [minmax-engine-model.md](../wiki/minmax-engine-model.md),
  secțiunea „Modelul de operare".
- `explain` și wiki-ul de transparență sunt **inițiativa echipei, nu cerință de client**; cerința e
  calculul MIN/MAX. Nici istoricul nu a fost cerut.
- Retenție: `DET` curentă + precedenta, `WEEK`/`WINSOR` doar curenta, antet + `PARAMSJSON` + `GRP`
  pentru totdeauna. ERP nu poate fi arhivă (doar 10,4% din rânduri îl ating, iar valorile se
  suprascriu la fiecare apply).
- Filialele inactive / cu depozite inactive **nu prezintă interes** (beneficiar, 08.09.2026) — deci
  `INNER JOIN #ActiveBranches` din `Classify` e specificația, iar `NR_SKU_GRP` e defect cosmetic.
- Datele protejate nu se încarcă în `connectedCallback()`; prima deschidere a tabului e limita de activare.
- `activate()` păstrează aceeași promisiune și nu repetă inițializarea la revenirea în tab.
- Rolurile sunt server-side, tokenul aplicației rămâne numai în memoria paginii, iar Socket.IO se autentifică pe conexiune.
- `saveParams` rămâne atomic, iar `MINMAX_ENGINE_WRITES_ENABLED=false` până la audit și activare deliberată.
- Sesiunea curentă se rezolvă prin `ESTE_CURENT` plus statusurile DONE, niciodată prin `MAX(RUNID)`.

## Open Questions
- Pasul 6: audit la save, apoi salvare/read-back, rollback, control 403 și decizia explicită de
  activare a scrierilor.
- Pasul 8 nivel A: **încheiat** (08.09.2026). 8/9 invariante PASS pe RUNID=5, calibrare FLAG 85,5%
  (prag client >80%). Singura abatere, `NR_SKU_GRP`, e defect cosmetic în `ClassifyGroup`.
- Pasul 8 nivel B: eșantionul numeric înghețat rămâne de făcut — **precondiție pentru orice sesiune
  nouă**, altfel se pierde baseline-ul `RUNID=5`.
- Faza 6 (`runEngine` din UI + ciclul de viață al sesiunii) e propusă și contractată în
  [FAZA6_CONTRACT.md](../../new_min_max/FAZA6_CONTRACT.md); așteaptă confirmarea beneficiarului pe
  butonul de lansare.

## Next Step
- Pasul 8 nivel B: construiește eșantionul stratificat înghețat în `new_min_max/analiza/`
  (triplete `RUNID, BRANCH, MTRL`), pe `RUNID=5`. Nu porni sesiuni noi până nu e înghețat.
