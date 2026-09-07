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

export class MinmaxEngineStore {
  constructor () {
    this._listeners = new Set();
    this._state = this._getInitialState();
    this._service = null;

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
      params: { branches: [], cov: [], error: '', params: [], saveError: '', saving: false },
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
          params: Array.isArray(action.payload.params) ? action.payload.params : []
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
  closeExplain () { this.dispatch({ type: 'CLOSE_EXPLAIN' }); }
  reset () { this.dispatch({ type: 'RESET_ALL' }); }

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
    const token = window.token;
    if (typeof token !== 'string' || !token) {
      throw new Error('Missing S1 session token (window.token).');
    }
    return token;
  }

  // --- Async Orchestration: results() — contract §5 ---
  async loadResults () {
    const state = this._state;
    this.setLoading(true);
    this.setError('');
    try {
      const response = await this._getService().results({
        filters: buildResultsFilterPayload(state.filters),
        page: state.page,
        pageSize: state.pageSize,
        runId: state.runId === null ? undefined : state.runId,
        sort: state.sort.field ? state.sort : undefined,
        token: this._token(),
        withTotal: true
      });
      this.dispatch({ type: 'SET_RESULTS', payload: response });
    } catch (err) {
      console.error('minmax-engine-store: loadResults failed', err);
      this.setError((err && err.message) || 'Nu s-au putut incarca rezultatele.');
    } finally {
      this.setLoading(false);
    }
  }

  // --- Async Orchestration: history() ---
  async loadHistory (limit = DEFAULT_HISTORY_LIMIT) {
    this.dispatch({ type: 'SET_LOADING_HISTORY', payload: true });
    this.dispatch({ type: 'SET_HISTORY_ERROR', payload: '' });
    try {
      const response = await this._getService().history({ limit, token: this._token() });
      this.dispatch({ type: 'SET_RUN_HISTORY', payload: response.rows });
    } catch (err) {
      console.error('minmax-engine-store: loadHistory failed', err);
      this.dispatch({ type: 'SET_HISTORY_ERROR', payload: (err && err.message) || 'Nu s-a putut incarca istoricul.' });
    } finally {
      this.dispatch({ type: 'SET_LOADING_HISTORY', payload: false });
    }
  }

  // --- Async Orchestration: groupAbc() — CCCMINMAXGRP, contract §8 ---
  // `filters` here is transient (branches/mtrgroup/esteHq/lifecycle/abc/xyz/clasa),
  // supplied by the caller rather than persisted on this store.
  async loadGroupAbc (filters = {}) {
    const state = this._state;
    this.dispatch({ type: 'SET_GROUP_ABC_LOADING', payload: true });
    this.dispatch({ type: 'SET_GROUP_ABC_ERROR', payload: '' });
    try {
      const response = await this._getService().groupAbc({
        filters,
        page: state.groupAbc.page,
        pageSize: state.groupAbc.pageSize,
        runId: state.runId === null ? undefined : state.runId,
        token: this._token()
      });
      this.dispatch({ type: 'SET_GROUP_ABC_RESULTS', payload: response });
    } catch (err) {
      console.error('minmax-engine-store: loadGroupAbc failed', err);
      this.dispatch({ type: 'SET_GROUP_ABC_ERROR', payload: (err && err.message) || 'Nu s-a putut incarca clasificarea ABC.' });
    } finally {
      this.dispatch({ type: 'SET_GROUP_ABC_LOADING', payload: false });
    }
  }

  // --- Async Orchestration: params() — contract §7 precondition ---
  async loadParams () {
    this.dispatch({ type: 'SET_PARAMS_LOADING', payload: true });
    this.dispatch({ type: 'SET_PARAMS_ERROR', payload: '' });
    try {
      const response = await this._getService().params({ token: this._token() });
      this.dispatch({ type: 'SET_PARAMS_DATA', payload: response });
    } catch (err) {
      console.error('minmax-engine-store: loadParams failed', err);
      this.dispatch({ type: 'SET_PARAMS_ERROR', payload: (err && err.message) || 'Nu s-au putut incarca parametrii.' });
    } finally {
      this.dispatch({ type: 'SET_PARAMS_LOADING', payload: false });
    }
  }

  // --- Async Orchestration: saveParams() — the ONLY write path, contract §7 ---
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
      await this.loadParams();
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
    this.dispatch({ type: 'OPEN_EXPLAIN', payload: { branch, mtrl } });

    const runId = this._state.resolvedRunId;
    if (runId === null || runId === undefined) {
      this.dispatch({ type: 'SET_EXPLAIN_ERROR', payload: 'Nicio sesiune rezolvata inca; incarca rezultatele mai intai.' });
      return;
    }

    try {
      const response = await this._getService().explain({ branch, mtrl, runId, token: this._token() });
      this.dispatch({ type: 'SET_EXPLAIN_DATA', payload: response });
    } catch (err) {
      console.error('minmax-engine-store: openExplain failed', err);
      this.dispatch({ type: 'SET_EXPLAIN_ERROR', payload: (err && err.message) || 'Nu s-a putut incarca explicatia.' });
    }
  }
}

// Create and export a singleton instance
export const minmaxEngineStore = new MinmaxEngineStore();
