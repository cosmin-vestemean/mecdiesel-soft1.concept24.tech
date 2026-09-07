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
- `public/components/minmax-engine/minmax-group-abc.js` — al treilea `ContextConsumer`, construit
  dar **încă necablat** în container. `CCCMINMAXGRP` (ABC/XYZ per `MTRGROUP × BRANCH`, contract
  §8); fără sortare (backend-ul `groupAbc()` acceptă `sort`, dar `loadGroupAbc()` din store nu-l
  transmite încă). Vezi "Decizii de design" pentru tiparul de filtre tranzitorii.
- `public/components/minmax-engine/minmax-explain-drawer.js` — al patrulea `ContextConsumer`,
  construit dar **încă necablat** (nici în container, nici ca trigger din
  `minmax-results-table.js`, care nu are încă niciun hook de row-click). Randează
  `state.explain` (deja implementat integral în store: `openExplain`/`closeExplain`/
  `SET_EXPLAIN_DATA`/`SET_EXPLAIN_ERROR`) ca un drawer fix pe partea dreaptă, vizibil doar când
  `state.explain.open`. Afișează exact câmpurile din contract §6, în ordinea din contract
  (`INPUT_FIELDS`, `CHAIN_FIELDS`), plus antetul `CCCMINMAXRUN`, `CCCMINMAXWINSOR` și seria
  densă de 52 de săptămâni — nu recalculează nimic, doar formatează.
- `public/components/minmax-engine/minmax-params-panel.js` — al cincilea `ContextConsumer`,
  construit dar **încă necablat**. Singura scriere din interfață (contract §7): parametri globali
  (`CCCMINMAXPARAMS`), matricea COV_TGT (`CCCMINMAXCOV`, grid `CLASA_ORDER × MARIME_ORDER`, 11×3=33
  celule fixe) și configurarea filialelor (`CCCMINMAXBRANCH` — `MARIME`/`INCLUS`/`ESTE_PODEA`
  editabile, `ESTE_HQ` doar afișat). `CCCMINMAXTEMPLATE` rămâne în afara iterației 1. Editările stau
  în drafturi locale sparse (map cheiat pe identitatea din contract per tabelă) până la "Salveaza";
  `store.saveParams()` reîncarcă `params()` la succes, moment în care componenta detectează
  tranziția `saving: true → false` fără `saveError` și golește drafturile (nu există alt semnal de
  "succes" explicit din store).

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

## Stadiu (vs. `FAZA5_CONTRACT.md` §9/§10, pasul 8)

Construite: store, container (cablat cu `minmax-run-panel.js`/`minmax-results-table.js`),
`minmax-group-abc.js`, `minmax-explain-drawer.js` și `minmax-params-panel.js` — toate cele 6
componente din §9 există acum, ultimele trei funcționale dar încă necablate în container.

Rămâne: cablarea propriu-zisă — un row-click în `minmax-results-table.js` care apeleze
`store.openExplain(branch, mtrl)`, apoi montarea celor trei componente necablate în
`minmax-engine-container.js` (dezlocuind comentariul placeholder existent).

Nu e cablat încă în `public/index.html`/`userInteractions.js` — niciun tab nou, nicio integrare de
navigație; planificat abia când există ceva vizibil de arătat beneficiarului.
