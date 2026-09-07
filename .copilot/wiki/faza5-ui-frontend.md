# Faza 5 — UI de confirmare: frontend (store + componente)

> Stare durabilă a stratului frontend. Contractul complet e `new_min_max/FAZA5_CONTRACT.md` §9/§10
> (nu se duplică aici); backend-ul e documentat separat în
> [faza5-ui-backend.md](faza5-ui-backend.md). Acest fișier reține ce s-a construit și convențiile
> care nu sunt evidente doar din cod.

## Fișiere

- `public/stores/minmax-engine-store.js` — stare + orchestrare Feathers într-un singur loc (vezi
  „Decizii de design" mai jos pentru motiv).
- `public/components/minmax-engine/minmax-engine-container.js` — `ContextProvider`, încărcare
  inițială (`loadHistory`/`loadParams`/`loadResults` în paralel), randează un placeholder cât timp
  nu există componente montate.
- `public/components/minmax-engine/minmax-run-panel.js` — primul `ContextConsumer` real, cablat în
  container. Selecție sesiune + istoric (`CCCMINMAXRUN`), **fără buton de lansare** — `runEngine`
  e exclus din iterația 1 (contract §3).
- `public/components/minmax-engine/minmax-results-table.js` — al doilea `ContextConsumer`, cablat
  în container. Filtre server-side complete (contract §5: liste, tri-state, intervale, `codeLike`,
  `mtrl`/`mtrgroup` ca liste text), sortare (whitelist + click pe antet, tie-break implicit din
  store) și paginare (plafon 500). Filtrele se editează într-un draft local; se trimit la store
  (`setFilters`/`resetFilters` + `loadResults()` explicit) doar la "Aplica filtre"/"Reseteaza",
  consistent cu regula "store nu re-declanșează automat".

## Decizii de design

- **Store-ul deține atât starea, cât și apelurile de service** (`loadResults`/`loadHistory`/
  `loadGroupAbc`/`loadParams`/`saveParams`/`openExplain`), spre deosebire de
  `replenishment-store.js`, care e stare pură (containerul face fetch-ul). Motiv: la MIN/MAX
  filtrarea/sortarea/paginarea sunt server-side (`execSql`), nu client-side, deci fiecare
  componentă are nevoie de același ciclu fetch/loading/error, nu doar de stare partajată.
- **Store-ul NU re-declanșează automat `loadResults()`** când un consumator schimbă `runId`/
  filtre/sortare/pagină prin `dispatch`. Componenta care face schimbarea răspunde și de a apela
  explicit metoda de reload după (vezi `minmax-run-panel.js` → `_selectRun`/`_selectCurrent`).
- **Filtrul implicit UI** (`flagTxt IN (DOWN,OK,UP,MAJOR_UP,SUPRASTOC)` + `VZ_26S > 0`, contract
  §5) trăiește în `getDefaultFilters()` din store. `VZ_26S > 0` e aproximat cu `min: 0.00000001`
  pentru că serviciul (`addInterval`) suportă doar `>=`/`<=`, nu `>` strict.
- **Gap de backend găsit și corectat în această etapă:** `vz26s`/`d.VZ_26S` lipsea din
  `DET_COLUMNS`/`buildDetWhereClauses` (`minmax-engine.class.js`), deși coloana e reală în
  `CCCMINMAXDET` și necesară pentru filtrul implicit de mai sus. Vezi
  [faza5-ui-backend.md](faza5-ui-backend.md) pentru detalii; cele 41 de teste backend trec în
  continuare după adăugare.
- **Pattern CDN, nu npm:** tot frontend-ul (inclusiv fișierele noi) importă `lit`/`@lit/context`
  din `cdn.jsdelivr.net`. `public/` nu are build step (fără Vite/webpack/import maps), deci un
  bare specifier de tip `import ... from '@lit/context'` nu s-ar rezolva în browser — nu instala
  aceste pachete via npm pentru acest strat.

## Stadiu (vs. `FAZA5_CONTRACT.md` §9/§10, pasul 8)

Construite: store, container (cablat cu ambele componente de mai jos), `minmax-run-panel.js` și
`minmax-results-table.js` — ambele funcționale.

Rămân, în ordine: `minmax-group-abc.js` (**următorul**), `minmax-explain-drawer.js`,
`minmax-params-panel.js`. Fiecare se conectează la `minmaxEngineStore` prin `ContextConsumer`,
tipar din `public/components/data-table.js`/`query-panel.js` (plus `minmax-run-panel.js`/
`minmax-results-table.js`, deja funcționale în acest repo, ca exemple minmax-specifice).

Nu e cablat încă în `public/index.html`/`userInteractions.js` — niciun tab nou, nicio integrare de
navigație; planificat abia când există ceva vizibil de arătat beneficiarului.
