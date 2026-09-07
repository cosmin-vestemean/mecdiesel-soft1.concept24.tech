import { createContext } from 'https://cdn.jsdelivr.net/npm/@lit/context@1.1.0/index.js';
import { client } from '../socketConfig.js';

/**
 * MIN/MAX Engine Store (Faza 5 — UI de confirmare)
 *
 * Centralized state + service orchestration for the minmax-engine confirmation
 * screen. Modeled after replenishment-store.js (subscribe/dispatch pattern),
 * but unlike it, filtering/sorting/paging happen server-side (Feathers
 * `minmax-engine` service -> execSql), per FAZA5_CONTRACT.md §5. This store
 * therefore also owns the service calls, not just the state, so every planned
 * component (results table, run panel, group ABC, explain drawer, params
 * panel) can share one fetch/error/loading lifecycle instead of duplicating it.
 *
 * Constraints this store must respect (FAZA5_CONTRACT.md §11):
 * - No ERP writes. saveParams() only touches CCCMINMAXPARAMS/COV/BRANCH.
 * - Never send raw SQL/column identifiers from the browser — only the typed
 *   filter object the Feathers service already validates against its
 *   whitelist.
 * - "Current run" is resolved server-side (ESTE_CURENT=1); this store never
 *   assumes MAX(runId) client-side either.
 */

export const MinmaxEngineStoreContext = createContext('minmax-engine-store');

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;
const DEFAULT_HISTORY_LIMIT = 20;

// VZ_26S is DECIMAL(28,8) and the service only supports >=/<= intervals, so
// the contract's "VZ_26S > 0" default is approximated with its smallest unit.
const MIN_POSITIVE = 0.00000001;

const LIST_FILTER_KEYS = ['branches', 'mtrl', 'mtrgroup', 'lifecycle', 'abc', 'xyz', 'clasa', 'flagTxt', 'statusTrend'];
const TRI_STATE_FILTER_KEYS = [
  'esteHq', 'hqCapAplicat', 'podeaAplicata', 'arePozitieErp', 'discFlag',
  'flagLichidare', 'flagBlocat', 'flagExclus', 'warnVz26Zero', 'warnStocNeg',
  'warnStocMort', 'warnGrupaMica'
];
const INTERVAL_FILTER_KEYS = [
  'engMin', 'engMax', 'buyQty', 'stocQty', 'ordFurn', 'acopCur',
  'flagRatio', 'cv', 'avg', 'vz52s', 'vz26s', 'val52s'
];

// Default UI filter per FAZA5_CONTRACT.md §5: keeps the table off the ~95.6%
// FARA_REFERINTA rows without permanently hiding anything; user can clear it.
function getDefaultFilters () {
  return {
    abc: [],
    acopCur: {},
    arePozitieErp: null,
    avg: {},
    branches: [],
    buyQty: {},
    clasa: [],
    codeLike: '',
    cv: {},
    discFlag: null,
    engMax: {},
    engMin: {},
    esteHq: null,
    flagBlocat: null,
    flagExclus: null,
    flagLichidare: null,
    flagRatio: {},
    flagTxt: ['DOWN', 'OK', 'UP', 'MAJOR_UP', 'SUPRASTOC'],
    hqCapAplicat: null,
    lifecycle: [],
    mtrgroup: [],
    mtrl: [],
    ordFurn: {},
    podeaAplicata: null,
    stocQty: {},
    statusTrend: [],
    val52s: {},
    vz26s: { min: MIN_POSITIVE },
    vz52s: {},
    warnGrupaMica: null,
    warnStocMort: null,
    warnStocNeg: null,
    warnVz26Zero: null,
    xyz: []
  };
}

function isEmptyInterval (range) {
  return !range || ((range.min === undefined || range.min === null) && (range.max === undefined || range.max === null));
}

// Strips defaults/empties so payloads stay well under the 20-positional-param
// cap and match the "tri-state absent = not applied" contract (§5).
function buildResultsFilterPayload (filters) {
  const f = filters || {};
  const out = {};

  for (const key of LIST_FILTER_KEYS) {
    if (Array.isArray(f[key]) && f[key].length) out[key] = f[key];
  }
  for (const key of TRI_STATE_FILTER_KEYS) {
    if (f[key] === true || f[key] === false) out[key] = f[key];
  }
  for (const key of INTERVAL_FILTER_KEYS) {
    if (!isEmptyInterval(f[key])) out[key] = f[key];
  }
  if (typeof f.codeLike === 'string' && f.codeLike.trim()) out.codeLike = f.codeLike.trim();

  return out;
}

// Population key for the results()/groupAbc() total+resolvedRunId caches
// (§12.6+§12.10): a canonical (sorted-key) JSON signature of the runId
// selector plus the filters actually sent to the service. Sort and page are
// deliberately excluded — they never change which rows exist, only their
// order/slice.
function canonicalJSON (value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

function populationKey (runId, filters) {
  return canonicalJSON({ filters, runId: runId === undefined ? null : runId });
}

// Read-back verification for saveParams() (§12.1): compares what params()
// returns AFTER the save against the normalized payload that was sent, using
// the same row identities the service uses server-side. Returns a short
// description of the first mismatch found, or null when everything matches.
// NOTE (confirmed live 07.09.2026): a genuinely empty-string SCOPEKEY comes
// back from execSql/WSMCP as JSON `null`, not `''` (DATALENGTH=0 but the
// column is NOT NULL) — both sides must coerce with `|| ''`, or every GLOBAL
// param save would spuriously report a mismatch.
function findSaveMismatch (fresh, { branchUpdates, covUpdates, paramsUpdates } = {}) {
  const paramsByKey = new Map(
    (fresh.params || []).map((r) => [`${r.PARAMKEY}|${r.SCOPE}|${r.SCOPEKEY || ''}`, String(r.PARAMVALUE)])
  );
  for (const p of (paramsUpdates || [])) {
    const key = `${p.paramKey}|${p.scope || 'GLOBAL'}|${p.scopeKey || ''}`;
    if (!paramsByKey.has(key) || paramsByKey.get(key) !== String(p.paramValue)) {
      return `parametru ${key}`;
    }
  }

  const covByKey = new Map((fresh.cov || []).map((r) => [`${r.CLASA}|${r.MARIME}`, Number(r.COV)]));
  for (const c of (covUpdates || [])) {
    const key = `${c.clasa}|${c.marime}`;
    if (!covByKey.has(key) || covByKey.get(key) !== Number(c.cov)) {
      return `COV ${key}`;
    }
  }

  const branchByKey = new Map((fresh.branches || []).map((r) => [String(r.BRANCH), {
    estePodea: Boolean(r.ESTE_PODEA), inclus: Boolean(r.INCLUS), marime: r.MARIME
  }]));
  for (const b of (branchUpdates || [])) {
    const key = String(b.branch);
    const row = branchByKey.get(key);
    if (!row || row.estePodea !== Boolean(b.estePodea) || row.inclus !== Boolean(b.inclus) || row.marime !== b.marime) {
      return `filiala ${key}`;
    }
  }

  return null;
}

export class MinmaxEngineStore {
  constructor () {
    this._listeners = new Set();
    this._state = this._getInitialState();
    this._service = null;

    // Per-population caches for results()/groupAbc() (§12.6+§12.10): each
    // remembers the last population's resolvedRunId, so a same-population
    // paginate/sort can pin to it instead of asking the service to
    // (re-)resolve "current". Separate slots because results() filters
    // (persisted store state) and groupAbc() filters (transient, caller-
    // supplied) are different populations even when runId matches.
    this._resultsCache = { key: null, resolvedRunId: null };
    this._groupAbcCache = { key: null, resolvedRunId: null };

    // Monotonic request sequence per async flow (§12.7): each load*/open*
    // call increments its flow's counter and captures the new value; the
    // response is only dispatched (data, error, or loading=false) while that
    // captured value is still the current one, so an older request that
    // resolves after a newer one can never clobber fresher state. `explain`
    // is also incremented on drawer close, so a response for an already-
    // closed drawer is discarded too.
    this._sequences = { explain: 0, groupAbc: 0, history: 0, params: 0, results: 0 };

    this.subscribe = this.subscribe.bind(this);
    this.unsubscribe = this.unsubscribe.bind(this);
    this.getState = this.getState.bind(this);
    this.dispatch = this.dispatch.bind(this);
  }

  // --- Initial State ---
  _getInitialState () {
    return {
      // Results (CCCMINMAXDET) — contract §5
      error: '',
      explain: { branch: null, data: null, error: '', loading: false, mtrl: null, open: false },
      filters: getDefaultFilters(),
      groupAbc: { error: '', loading: false, page: 1, pageSize: DEFAULT_PAGE_SIZE, rows: [], total: null },
      historyError: '',
      loading: false,
      loadingHistory: false,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,

      // Params/COV/branches (CCCMINMAXPARAMS et al.) — contract §7
      params: { branches: [], cov: [], error: '', params: [], saveError: '', saving: false, writesEnabled: false },
      resolvedRunId: null, // actual RUNID the last successful results() call used
      rows: [],

      // Scope selection — null runId means "follow current session" (§5)
      runHistory: [],
      runId: null,
      sort: { dir: 'ASC', field: null },
      total: null
    };
  }

  // --- State Access ---
  getState () {
    return { ...this._state };
  }

  // --- Subscription Management ---
  subscribe (listener) {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  unsubscribe (listener) {
    this._listeners.delete(listener);
  }

  _notifyListeners (action, previousState, newState) {
    this._listeners.forEach((listener) => {
      try {
        listener(newState, previousState, action);
      } catch (err) {
        console.error('Error in minmax-engine-store listener:', err);
      }
    });
  }

  // --- State Updates (Dispatch) ---
  dispatch (action) {
    if (!action || !action.type) {
      throw new Error('Action must have a type property');
    }

    const previousState = this._state;
    const newState = { ...this._state };

    switch (action.type) {
      case 'SET_LOADING':
        newState.loading = Boolean(action.payload);
        break;

      case 'SET_ERROR':
        newState.error = action.payload || '';
        break;

      case 'SET_RESULTS':
        newState.rows = Array.isArray(action.payload.rows) ? action.payload.rows : [];
        newState.page = action.payload.page || newState.page;
        newState.pageSize = action.payload.pageSize || newState.pageSize;
        newState.total = action.payload.total !== undefined ? action.payload.total : newState.total;
        newState.resolvedRunId = action.payload.runId !== undefined ? action.payload.runId : newState.resolvedRunId;
        break;

      case 'SET_FILTERS':
        newState.filters = { ...newState.filters, ...(action.payload || {}) };
        newState.page = 1;
        break;

      case 'RESET_FILTERS':
        newState.filters = getDefaultFilters();
        newState.page = 1;
        break;

      case 'SET_SORT':
        newState.sort = {
          dir: action.payload && action.payload.dir === 'DESC' ? 'DESC' : 'ASC',
          field: (action.payload && action.payload.field) || null
        };
        newState.page = 1;
        break;

      case 'SET_PAGE':
        newState.page = Math.max(1, Number(action.payload) || 1);
        break;

      case 'SET_PAGE_SIZE':
        newState.pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(action.payload) || DEFAULT_PAGE_SIZE));
        newState.page = 1;
        break;

      case 'SET_RUN_ID':
        newState.runId = (action.payload === null || action.payload === undefined) ? null : Number(action.payload);
        newState.page = 1;
        break;

      case 'SET_LOADING_HISTORY':
        newState.loadingHistory = Boolean(action.payload);
        break;

      case 'SET_HISTORY_ERROR':
        newState.historyError = action.payload || '';
        break;

      case 'SET_RUN_HISTORY':
        newState.runHistory = Array.isArray(action.payload) ? action.payload : [];
        break;

      case 'SET_GROUP_ABC_LOADING':
        newState.groupAbc = { ...newState.groupAbc, loading: Boolean(action.payload) };
        break;

      case 'SET_GROUP_ABC_ERROR':
        newState.groupAbc = { ...newState.groupAbc, error: action.payload || '' };
        break;

      case 'SET_GROUP_ABC_PAGE':
        newState.groupAbc = { ...newState.groupAbc, page: Math.max(1, Number(action.payload) || 1) };
        break;

      case 'SET_GROUP_ABC_PAGE_SIZE':
        newState.groupAbc = {
          ...newState.groupAbc,
          page: 1,
          pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Number(action.payload) || DEFAULT_PAGE_SIZE))
        };
        break;

      case 'SET_GROUP_ABC_RESULTS':
        newState.groupAbc = {
          ...newState.groupAbc,
          page: action.payload.page || newState.groupAbc.page,
          pageSize: action.payload.pageSize || newState.groupAbc.pageSize,
          rows: Array.isArray(action.payload.rows) ? action.payload.rows : [],
          total: action.payload.total !== undefined ? action.payload.total : newState.groupAbc.total
        };
        break;

      case 'SET_PARAMS_LOADING':
        newState.params = { ...newState.params, loading: Boolean(action.payload) };
        break;

      case 'SET_PARAMS_ERROR':
        newState.params = { ...newState.params, error: action.payload || '' };
        break;

      case 'SET_PARAMS_DATA':
        newState.params = {
          ...newState.params,
          branches: Array.isArray(action.payload.branches) ? action.payload.branches : [],
          cov: Array.isArray(action.payload.cov) ? action.payload.cov : [],
          params: Array.isArray(action.payload.params) ? action.payload.params : [],
          writesEnabled: action.payload.writesEnabled === true
        };
        break;

      case 'SET_PARAMS_SAVING':
        newState.params = { ...newState.params, saving: Boolean(action.payload) };
        break;

      case 'SET_PARAMS_SAVE_ERROR':
        newState.params = { ...newState.params, saveError: action.payload || '' };
        break;

      case 'OPEN_EXPLAIN':
        newState.explain = {
          branch: action.payload.branch,
          data: null,
          error: '',
          loading: true,
          mtrl: action.payload.mtrl,
          open: true
        };
        break;

      case 'CLOSE_EXPLAIN':
        newState.explain = { branch: null, data: null, error: '', loading: false, mtrl: null, open: false };
        break;

      case 'SET_EXPLAIN_ERROR':
        newState.explain = { ...newState.explain, error: action.payload || '', loading: false };
        break;

      case 'SET_EXPLAIN_DATA':
        newState.explain = { ...newState.explain, data: action.payload, loading: false };
        break;

      case 'RESET_ALL':
        this._state = this._getInitialState();
        this._resultsCache = { key: null, resolvedRunId: null };
        this._groupAbcCache = { key: null, resolvedRunId: null };
        this._notifyListeners(action, previousState, this._state);
        return;

      default:
        console.warn(`Unknown action type: ${action.type}`);
        return;
    }

    this._state = newState;
    this._notifyListeners(action, previousState, newState);
  }

  // --- Action Creators (State Only) ---
  setLoading (loading) { this.dispatch({ type: 'SET_LOADING', payload: loading }); }
  setError (error) { this.dispatch({ type: 'SET_ERROR', payload: error }); }
  setFilters (patch) { this.dispatch({ type: 'SET_FILTERS', payload: patch }); }
  resetFilters () { this.dispatch({ type: 'RESET_FILTERS' }); }
  setSort (field, dir) { this.dispatch({ type: 'SET_SORT', payload: { dir, field } }); }
  setPage (page) { this.dispatch({ type: 'SET_PAGE', payload: page }); }
  setPageSize (pageSize) { this.dispatch({ type: 'SET_PAGE_SIZE', payload: pageSize }); }
  setRunId (runId) { this.dispatch({ type: 'SET_RUN_ID', payload: runId }); }
  setGroupAbcPage (page) { this.dispatch({ type: 'SET_GROUP_ABC_PAGE', payload: page }); }
  setGroupAbcPageSize (pageSize) { this.dispatch({ type: 'SET_GROUP_ABC_PAGE_SIZE', payload: pageSize }); }

  // Drawer close also retires the in-flight explain() request, if any, so a
  // late response for a closed (or reopened-on-a-different-row) drawer never
  // dispatches (\u00a712.7).
  closeExplain () {
    this._sequences.explain += 1;
    this.dispatch({ type: 'CLOSE_EXPLAIN' });
  }

  reset () { this.dispatch({ type: 'RESET_ALL' }); }

  // --- Request Sequencing (\u00a712.7) ---
  // Call at the start of an async flow to obtain this request's sequence
  // number; pass it to `_isCurrent` before every dispatch that follows an
  // await, so a stale (superseded) response never overwrites newer state.
  _beginRequest (flow) {
    this._sequences[flow] += 1;
    return this._sequences[flow];
  }

  _isCurrent (flow, seq) {
    return this._sequences[flow] === seq;
  }

  // --- Service Wiring ---
  _getService () {
    if (!this._service) {
      if (!client) {
        throw new Error('Feathers client not available.');
      }
      this._service = client.service('minmax-engine');
    }
    return this._service;
  }

  _token () {
    // window.token is never set anywhere in this app; sessionStorage's s1Token
    // (set by login.js) is the actual source of truth (see top-abc-container.js).
    const token = sessionStorage.getItem('s1Token');
    if (typeof token !== 'string' || !token) {
      throw new Error('Missing S1 session token (sessionStorage.s1Token).');
    }
    return token;
  }

  // --- Async Orchestration: results() — contract §5 ---
  // `withTotal` is explicit (§12.6), passed by the caller: true for initial
  // load, filter change/reset, session change and explicit refresh; false
  // for paging, sorting and page-size changes. A population change (runId
  // selector or filters different from the last successful load) always
  // forces withTotal regardless of what was asked — a total cached for a
  // different population would silently be wrong. When the population is
  // unchanged and withTotal is false, the previously resolved RUNID is
  // pinned explicitly instead of re-asking the service to resolve "current"
  // (§12.10) — this also means a "current session" refresh (withTotal:true)
  // always re-resolves ESTE_CURENT for real, never reuses a stale pin.
  async loadResults (options = {}) {
    const state = this._state;
    const requestedWithTotal = options.withTotal !== undefined ? Boolean(options.withTotal) : true;
    const filterPayload = buildResultsFilterPayload(state.filters);
    const key = populationKey(state.runId, filterPayload);
    const sameCachedPopulation = key === this._resultsCache.key;
    const withTotal = requestedWithTotal || !sameCachedPopulation;
    const pinnedRunId = (!requestedWithTotal && sameCachedPopulation) ? this._resultsCache.resolvedRunId : null;
    const requestRunId = pinnedRunId !== null ? pinnedRunId : (state.runId === null ? undefined : state.runId);

    const seq = this._beginRequest('results');
    this.setLoading(true);
    this.setError('');
    try {
      const response = await this._getService().results({
        filters: filterPayload,
        page: state.page,
        pageSize: state.pageSize,
        runId: requestRunId,
        sort: state.sort.field ? state.sort : undefined,
        token: this._token(),
        withTotal
      });
      if (!this._isCurrent('results', seq)) return; // superseded by a newer results() call
      this._resultsCache = { key, resolvedRunId: response.runId };
      this.dispatch({ type: 'SET_RESULTS', payload: response });
    } catch (err) {
      if (!this._isCurrent('results', seq)) return;
      console.error('minmax-engine-store: loadResults failed', err);
      this.setError((err && err.message) || 'Nu s-au putut incarca rezultatele.');
    } finally {
      if (this._isCurrent('results', seq)) this.setLoading(false);
    }
  }

  // --- Async Orchestration: history() ---
  async loadHistory (limit = DEFAULT_HISTORY_LIMIT) {
    const seq = this._beginRequest('history');
    this.dispatch({ type: 'SET_LOADING_HISTORY', payload: true });
    this.dispatch({ type: 'SET_HISTORY_ERROR', payload: '' });
    try {
      const response = await this._getService().history({ limit, token: this._token() });
      if (!this._isCurrent('history', seq)) return;
      this.dispatch({ type: 'SET_RUN_HISTORY', payload: response.rows });
    } catch (err) {
      if (!this._isCurrent('history', seq)) return;
      console.error('minmax-engine-store: loadHistory failed', err);
      this.dispatch({ type: 'SET_HISTORY_ERROR', payload: (err && err.message) || 'Nu s-a putut incarca istoricul.' });
    } finally {
      if (this._isCurrent('history', seq)) this.dispatch({ type: 'SET_LOADING_HISTORY', payload: false });
    }
  }

  // --- Async Orchestration: groupAbc() — CCCMINMAXGRP, contract §8 ---
  // `filters` here is transient (branches/mtrgroup/esteHq/lifecycle/abc/xyz/clasa),
  // supplied by the caller rather than persisted on this store. `withTotal`
  // follows the same explicit contract and same-population pin as
  // loadResults() (§12.6+§12.10+§12.11), in its own cache slot since this
  // filter shape is independent of results()'s.
  async loadGroupAbc (filters = {}, options = {}) {
    const state = this._state;
    const requestedWithTotal = options.withTotal !== undefined ? Boolean(options.withTotal) : true;
    const key = populationKey(state.runId, filters);
    const sameCachedPopulation = key === this._groupAbcCache.key;
    const withTotal = requestedWithTotal || !sameCachedPopulation;
    const pinnedRunId = (!requestedWithTotal && sameCachedPopulation) ? this._groupAbcCache.resolvedRunId : null;
    const requestRunId = pinnedRunId !== null ? pinnedRunId : (state.runId === null ? undefined : state.runId);

    const seq = this._beginRequest('groupAbc');
    this.dispatch({ type: 'SET_GROUP_ABC_LOADING', payload: true });
    this.dispatch({ type: 'SET_GROUP_ABC_ERROR', payload: '' });
    try {
      const response = await this._getService().groupAbc({
        filters,
        page: state.groupAbc.page,
        pageSize: state.groupAbc.pageSize,
        runId: requestRunId,
        token: this._token(),
        withTotal
      });
      if (!this._isCurrent('groupAbc', seq)) return; // superseded by a newer groupAbc() call
      this._groupAbcCache = { key, resolvedRunId: response.runId };
      this.dispatch({ type: 'SET_GROUP_ABC_RESULTS', payload: response });
    } catch (err) {
      if (!this._isCurrent('groupAbc', seq)) return;
      console.error('minmax-engine-store: loadGroupAbc failed', err);
      this.dispatch({ type: 'SET_GROUP_ABC_ERROR', payload: (err && err.message) || 'Nu s-a putut incarca clasificarea ABC.' });
    } finally {
      if (this._isCurrent('groupAbc', seq)) this.dispatch({ type: 'SET_GROUP_ABC_LOADING', payload: false });
    }
  }

  // --- Async Orchestration: params() — contract §7 precondition ---
  async loadParams () {
    const seq = this._beginRequest('params');
    this.dispatch({ type: 'SET_PARAMS_LOADING', payload: true });
    this.dispatch({ type: 'SET_PARAMS_ERROR', payload: '' });
    try {
      const response = await this._fetchParams();
      if (!this._isCurrent('params', seq)) return; // superseded by a newer loadParams() call
      this.dispatch({ type: 'SET_PARAMS_DATA', payload: response });
    } catch (err) {
      if (!this._isCurrent('params', seq)) return;
      console.error('minmax-engine-store: loadParams failed', err);
      this.dispatch({ type: 'SET_PARAMS_ERROR', payload: (err && err.message) || 'Nu s-au putut incarca parametrii.' });
    } finally {
      if (this._isCurrent('params', seq)) this.dispatch({ type: 'SET_PARAMS_LOADING', payload: false });
    }
  }

  // Raw fetch, no dispatch, no try/catch: shared by loadParams() (gated by
  // the `params` request sequence, §12.7) and saveParams() (its own separate
  // flow, never gated by that sequence — a save's read-back must land
  // regardless of any concurrent loadParams() call). saveParams() also needs
  // the rejection to propagate (§12.1) instead of being swallowed the way
  // the public loadParams() does.
  async _fetchParams () {
    return this._getService().params({ token: this._token() });
  }

  // --- Async Orchestration: saveParams() — the ONLY write path, contract §7 ---
  // Drafts are only cleared by the caller (minmax-params-panel) once this
  // resolves `true`. Per §12.1, that requires three things to all succeed:
  // the transaction itself, the params() reload, and a read-back match
  // against what was sent — a reload failure or a mismatch must surface as
  // a save error, not a silent success.
  async saveParams ({ branchUpdates, covUpdates, paramsUpdates } = {}) {
    this.dispatch({ type: 'SET_PARAMS_SAVING', payload: true });
    this.dispatch({ type: 'SET_PARAMS_SAVE_ERROR', payload: '' });
    try {
      await this._getService().saveParams({
        branchUpdates,
        covUpdates,
        paramsUpdates,
        token: this._token()
      });

      const fresh = await this._fetchParams();
      this.dispatch({ type: 'SET_PARAMS_DATA', payload: fresh });
      const mismatch = findSaveMismatch(fresh, { branchUpdates, covUpdates, paramsUpdates });
      if (mismatch) {
        throw new Error(`Salvarea a reusit dar recitirea nu corespunde (${mismatch}).`);
      }

      return true;
    } catch (err) {
      console.error('minmax-engine-store: saveParams failed', err);
      this.dispatch({ type: 'SET_PARAMS_SAVE_ERROR', payload: (err && err.message) || 'Salvarea parametrilor a esuat.' });
      return false;
    } finally {
      this.dispatch({ type: 'SET_PARAMS_SAVING', payload: false });
    }
  }


  // --- Async Orchestration: explain() drawer — read-only, contract §6 ---
  // Uses resolvedRunId (the actual RUNID the last results() call resolved to),
  // never a client-guessed "latest" run.
  async openExplain (branch, mtrl) {
    const seq = this._beginRequest('explain');
    this.dispatch({ type: 'OPEN_EXPLAIN', payload: { branch, mtrl } });

    const runId = this._state.resolvedRunId;
    if (runId === null || runId === undefined) {
      if (this._isCurrent('explain', seq)) {
        this.dispatch({ type: 'SET_EXPLAIN_ERROR', payload: 'Nicio sesiune rezolvata inca; incarca rezultatele mai intai.' });
      }
      return;
    }

    try {
      const response = await this._getService().explain({ branch, mtrl, runId, token: this._token() });
      if (!this._isCurrent('explain', seq)) return; // superseded by a newer openExplain()/closeExplain()
      this.dispatch({ type: 'SET_EXPLAIN_DATA', payload: response });
    } catch (err) {
      if (!this._isCurrent('explain', seq)) return;
      console.error('minmax-engine-store: openExplain failed', err);
      this.dispatch({ type: 'SET_EXPLAIN_ERROR', payload: (err && err.message) || 'Nu s-a putut incarca explicatia.' });
    }
  }
}

// Create and export a singleton instance
export const minmaxEngineStore = new MinmaxEngineStore();
