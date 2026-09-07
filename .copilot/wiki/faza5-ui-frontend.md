# Faza 5 — UI de confirmare: frontend (store + componente)

> Stare durabilă a stratului frontend. Contractul complet e `new_min_max/FAZA5_CONTRACT.md` §9/§10
> (nu se duplică aici); backend-ul e documentat separat în
> [faza5-ui-backend.md](faza5-ui-backend.md). Acest fișier reține ce s-a construit și convențiile
> care nu sunt evidente doar din cod.

## Fișiere

- `public/stores/minmax-engine-store.js` — stare + orchestrare Feathers într-un singur loc (vezi
  „Decizii de design" mai jos pentru motiv).
- `public/components/minmax-engine/minmax-engine-container.js` — `ContextProvider`, încărcare
  inițială (`loadHistory`/`loadParams`/`loadResults` în paralel), montează acum toate cele 6
  componente din contract în ordine (run-panel, results-table, group-abc, explain-drawer,
  params-panel).
- `public/components/minmax-engine/minmax-run-panel.js` — primul `ContextConsumer` real, cablat în
  container. Selecție sesiune + istoric (`CCCMINMAXRUN`), **fără buton de lansare** — `runEngine`
  e exclus din iterația 1 (contract §3).
- `public/components/minmax-engine/minmax-results-table.js` — al doilea `ContextConsumer`, cablat
  în container. Filtre server-side complete (contract §5: liste, tri-state, intervale, `codeLike`,
  `mtrl`/`mtrgroup` ca liste text), sortare (whitelist + click pe antet, tie-break implicit din
  store) și paginare (plafon 500). Filtrele se editează într-un draft local; se trimit la store
  (`setFilters`/`resetFilters` + `loadResults()` explicit) doar la "Aplica filtre"/"Reseteaza",
  consistent cu regula "store nu re-declanșează automat". Row-click →
  `store.openExplain(row.BRANCH, row.MTRL)`.
- `public/components/minmax-engine/minmax-group-abc.js` — al treilea `ContextConsumer`, cablat în
  container. `CCCMINMAXGRP` (ABC/XYZ per `MTRGROUP × BRANCH`, contract §8); fără sortare
  (backend-ul `groupAbc()` acceptă `sort`, dar `loadGroupAbc()` din store nu-l transmite încă).
  Vezi "Decizii de design" pentru tiparul de filtre tranzitorii.
- `public/components/minmax-engine/minmax-explain-drawer.js` — al patrulea `ContextConsumer`,
  cablat în container și declanșat prin row-click din `minmax-results-table.js`. Randează
  `state.explain` (`openExplain`/`closeExplain`/`SET_EXPLAIN_DATA`/`SET_EXPLAIN_ERROR`) ca un
  drawer fix pe partea dreaptă, vizibil doar când `state.explain.open` (randează `html\`\`` gol
  altfel, deci montarea permanentă nu afectează layout-ul). Afișează exact câmpurile din contract
  §6, în ordinea din contract (`INPUT_FIELDS`, `CHAIN_FIELDS`), plus antetul `CCCMINMAXRUN`,
  `CCCMINMAXWINSOR` și seria densă de 52 de săptămâni — nu recalculează nimic, doar formatează.
- `public/components/minmax-engine/minmax-params-panel.js` — al cincilea `ContextConsumer`, cablat
  în container. Singura scriere din interfață (contract §7): parametri globali
  (`CCCMINMAXPARAMS`), matricea COV_TGT (`CCCMINMAXCOV`, grid `CLASA_ORDER × MARIME_ORDER`, 11×3=33
  celule fixe) și configurarea filialelor (`CCCMINMAXBRANCH` — `MARIME`/`INCLUS`/`ESTE_PODEA`
  editabile, `ESTE_HQ` doar afișat). `CCCMINMAXTEMPLATE` rămâne în afara iterației 1. Editările stau
  în drafturi locale sparse (map cheiat pe identitatea din contract per tabelă) până la "Salveaza";
  `store.saveParams()` reîncarcă `params()` la succes, moment în care componenta detectează
  tranziția `saving: true → false` fără `saveError` și golește drafturile (nu există alt semnal de
  "succes" explicit din store). **Netestat live cu o salvare reală** —
  `CCCMINMAXPARAMS`/`COV` erau goale la testarea din 07.09.2026 (`Niciun parametru.`).

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
- **Filtre tranzitorii pentru `groupAbc()`** (`minmax-group-abc.js`): spre deosebire de
  `results()`, filtrele nu trec prin `store.setFilters()`/`state.filters` — trăiesc doar ca stare
  locală a componentei și se transmit direct la `store.loadGroupAbc(filters)` la fiecare apel
  (apply/reset/paginare). Motiv: `loadGroupAbc(filters)` primește filtrele ca parametru explicit
  (nu le citește din store), deci nu există alt consumator care să aibă nevoie de ele partajate.
  Doar `page`/`pageSize` (`state.groupAbc`) rămân pe store, prin `setGroupAbcPage`/
  `setGroupAbcPageSize`. Componenta își declanșează și propriul fetch inițial la montare (spre
  deosebire de `results()`, care e încărcat de container) — `groupAbc()` nu face parte din
  `_loadInitialData()` al containerului.

## Bug-uri găsite și corectate la testarea live (07.09.2026)

- **Import path greșit** în `minmax-engine-container.js`: importa store-ul din `'../stores/...'`
  în loc de `'../../stores/...'` (același nivel de adâncime ca celelalte componente din
  `components/minmax-engine/`) — căuta `public/components/stores/` în loc de `public/stores/`,
  404 care bloca randarea întregului container.
- **`window.token` nu e setat nicăieri în `public/`** (verificat exhaustiv) — `_token()` din
  `minmax-engine-store.js` încă îl citea. Fixat să folosească
  `sessionStorage.getItem('s1Token')`, tiparul funcțional din `top-abc-container.js`.
  `zero-minmax-panel.js`/`export-minmax-panel.js` au același bug latent, netratat în această
  sesiune (vezi `.copilot/context/open-threads.md`).

Bug-uri de backend (OFFSET/FETCH bindăți, răspunsuri gzip nedecomprimate) găsite în aceeași
sesiune de testare — vezi [faza5-ui-backend.md](faza5-ui-backend.md).

## Stadiu (vs. `FAZA5_CONTRACT.md` §9/§10, pasul 8)

**Complet și verificat live** (07.09.2026, autentificat, date reale, `RUNID=5`): toate cele 6
componente din §9 construite, cablate în `minmax-engine-container.js`, și integrate în navigare
(tab "MIN/MAX Engine" în app-ul `achizitii` — buton + content div în `index.html`, handler în
`userInteractions.js`, înregistrare în `hierarchical-navigation.js`). Fluxul filtre → rezultate →
click rând → explain drawer → group-abc → istoric confirmat funcțional în browser.

Rămas netestat: `saveParams()` cu o salvare reală (params-panel) — tabelele `CCCMINMAXPARAMS`/
`COV` erau goale la testare, deci fluxul de editare n-a fost exersat cu date.
