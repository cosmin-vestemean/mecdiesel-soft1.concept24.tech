/**
 * MIN/MAX Results Table (Faza 5 — UI de confirmare)
 *
 * Server-side filters/sort/paging over CCCMINMAXDET, contract §5. Filters are
 * edited locally as a draft and only sent to the store (which triggers
 * loadResults()) when the user applies them — the store itself never
 * re-fetches on its own (see minmax-engine-store.js), so this component owns
 * the explicit reload-after-dispatch step for filters/sort/page.
 *
 * @element minmax-results-table
 */

import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { ContextConsumer } from 'https://cdn.jsdelivr.net/npm/@lit/context@1.1.0/index.js';
import { MinmaxEngineStoreContext } from '../../stores/minmax-engine-store.js';
import { CLASA_OPTIONS, renderBool } from './minmax-engine-constants.js';

// Sort whitelist mirrored from DET_COLUMNS in minmax-engine.class.js — shapes
// the UI only; the backend re-validates independently and is the real guard.
const FLAG_TXT_OPTIONS = ['OK', 'UP', 'DOWN', 'MAJOR_UP', 'SUPRASTOC', 'FARA_REFERINTA'];
const STATUS_TREND_OPTIONS = ['ACTIVE', 'STABLE', 'TREND_DOWN', 'DECLINE'];
const LIFECYCLE_OPTIONS = ['STANDARD', 'NOU', 'OD'];
// Anexa §A2: ABC/XYZ separate filters removed — CLASA (11 values) is already
// their cartesian product and keeping both allowed contradictory selections.

// Tri-state filters (true/false/unset) — contract §5 "Booleeni tri-state".
// Keys must match TRI_STATE_FILTER_KEYS in minmax-engine-store.js.
// Split per Anexa §A1: the four Warn* + the ERP flags are "advanced" (Nivel 3).
const TRI_STATE_WARN_FIELDS = [
  { key: 'warnVz26Zero', label: 'Warn VZ26=0' },
  { key: 'warnStocNeg', label: 'Warn stoc negativ' },
  { key: 'warnStocMort', label: 'Warn stoc mort' },
  { key: 'warnGrupaMica', label: 'Warn grupa mica' }
];

const TRI_STATE_ERP_FIELDS = [
  { key: 'esteHq', label: 'HQ' },
  { key: 'hqCapAplicat', label: 'HQ cap aplicat' },
  { key: 'podeaAplicata', label: 'Podea aplicata' },
  { key: 'arePozitieErp', label: 'Are pozitie ERP' },
  { key: 'discFlag', label: 'Discontinuat' },
  { key: 'flagLichidare', label: 'Lichidare' },
  { key: 'flagBlocat', label: 'Blocat' },
  { key: 'flagExclus', label: 'Exclus' }
];

// Interval filters ({min,max}) — contract §5. Keys must match INTERVAL_FILTER_KEYS.
const INTERVAL_FIELDS = [
  { key: 'engMin', label: 'Eng Min' },
  { key: 'engMax', label: 'Eng Max' },
  { key: 'buyQty', label: 'Buy Qty' },
  { key: 'stocQty', label: 'Stoc' },
  { key: 'ordFurn', label: 'Ord.Furn' },
  { key: 'acopCur', label: 'Acop. curenta' },
  { key: 'flagRatio', label: 'Flag ratio' },
  { key: 'cv', label: 'CV' },
  { key: 'avg', label: 'AVG' },
  { key: 'vz52s', label: 'Vz 52S' },
  { key: 'vz26s', label: 'Vz 26S' },
  { key: 'val52s', label: 'Val 52S' }
];

// Result columns rendered in the table body (subset of CCCMINMAXDET, per
// 00b_persist.sql); `sortField` maps to the API field name (DET_COLUMNS key).
const RESULT_COLUMNS = [
  { key: 'BRANCH', label: 'Filiala', sortField: 'branch' },
  { key: 'CODE', label: 'Cod', sortField: 'code' },
  { key: 'MTRL_NAME', label: 'Denumire' },
  { key: 'MTRGROUP_CODE', label: 'Grupa' },
  { key: 'LIFECYCLE', label: 'Lifecycle', sortField: 'lifecycle' },
  { key: 'CLASA', label: 'Clasa', sortField: 'clasa' },
  { key: 'FLAG_TXT', badge: true, label: 'Flag', sortField: 'flagTxt' },
  { key: 'STATUS_TREND', label: 'Trend', sortField: 'statusTrend' },
  { key: 'STOC_QTY', label: 'Stoc', sortField: 'stocQty', type: 'number' },
  { key: 'ORD_FURN', label: 'Ord.Furn', sortField: 'ordFurn', type: 'number' },
  { key: 'ENG_MIN', label: 'Eng Min', sortField: 'engMin', type: 'number' },
  { key: 'ENG_MAX', label: 'Eng Max', sortField: 'engMax', type: 'number' },
  { key: 'BUY_QTY', label: 'Buy Qty', sortField: 'buyQty', type: 'number' },
  { key: 'ACOP_CUR', label: 'Acop. curenta', sortField: 'acopCur', type: 'number' },
  { key: 'VZ_26S', label: 'Vz 26S', sortField: 'vz26s', type: 'number' },
  { key: 'VZ_52S', label: 'Vz 52S', sortField: 'vz52s', type: 'number' },
  { key: 'CV', label: 'CV', sortField: 'cv', type: 'number' },
  { key: 'VAL_52S', label: 'Val 52S', sortField: 'val52s', type: 'number' },
  { key: 'HQ_CAP_APLICAT', label: 'HQ Cap', type: 'boolean' },
  { key: 'PODEA_APLICATA', label: 'Podea', type: 'boolean' }
];

const FLAG_BADGE_CLASS = {
  DOWN: 'bg-danger',
  FARA_REFERINTA: 'bg-secondary',
  MAJOR_UP: 'bg-warning',
  OK: 'bg-success',
  SUPRASTOC: 'bg-warning',
  UP: 'bg-primary'
};

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500];

// Anexa §A3: counts the draft filters that differ from the store's neutral
// defaults, so the user sees how many filters are about to be applied.
function _countActiveFilters (filters) {
  if (!filters) return 0;
  let count = 0;
  const hasValue = (v) => v !== null && v !== undefined && v !== '' &&
    !(Array.isArray(v) && v.length === 0);
  for (const [key, value] of Object.entries(filters)) {
    if (key === 'branches') continue; // default = all branches selected
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (hasValue(value.min) || hasValue(value.max)) count += 1;
    } else if (hasValue(value)) {
      count += 1;
    }
  }
  return count;
}

export class MinmaxResultsTable extends LitElement {
  static get properties () {
    return {
      error: { type: String },
      loading: { type: Boolean },
      page: { type: Number },
      pageSize: { type: Number },
      rows: { type: Array },
      sort: { type: Object },
      total: { type: Number },
      _branches: { state: true, type: Array },
      _draftFilters: { state: true, type: Object }
    };
  }

  constructor () {
    super();

    this.error = '';
    this.loading = false;
    this.page = 1;
    this.pageSize = 100;
    this.rows = [];
    this.sort = { dir: 'ASC', field: null };
    this.total = null;
    this._branches = [];
    this._draftFilters = null; // seeded from store's filters on first sync

    this._storeConsumer = new ContextConsumer(this, {
      callback: (store) => {
        this._store = store;
        this._subscribeToStore();
      },
      context: MinmaxEngineStoreContext
    });
  }

  // Render in light DOM (Bootstrap compatibility, same as sibling components)
  createRenderRoot () {
    return this;
  }

  disconnectedCallback () {
    super.disconnectedCallback();
    if (this._unsubscribeFromStore) {
      this._unsubscribeFromStore();
    }
  }

  // --- Store Integration ---
  _subscribeToStore () {
    if (!this._store || this._unsubscribeFromStore) return;

    this._unsubscribeFromStore = this._store.subscribe((newState) => {
      this._syncStateFromStore(newState);
    });

    this._syncStateFromStore(this._store.getState());
  }

  _syncStateFromStore (state) {
    this.error = state.error;
    this.loading = state.loading;
    this.page = state.page;
    this.pageSize = state.pageSize;
    this.rows = state.rows;
    this.sort = state.sort;
    this.total = state.total;
    this._branches = state.params.branches;

    // Seed the draft once so unrelated store updates don't clobber in-progress edits.
    if (!this._draftFilters) {
      this._draftFilters = { ...state.filters };
    }
  }

  // --- Actions (dispatch + explicit reload, per store contract) ---
  _applyFilters () {
    if (!this._store) return;
    this._store.setFilters(this._draftFilters);
    this._store.loadResults({ withTotal: true });
  }

  _resetFilters () {
    if (!this._store) return;
    this._store.resetFilters();
    this._draftFilters = { ...this._store.getState().filters };
    this._store.loadResults({ withTotal: true });
  }

  _sortBy (field) {
    if (!this._store) return;
    const dir = (this.sort.field === field && this.sort.dir === 'ASC') ? 'DESC' : 'ASC';
    this._store.setSort(field, dir);
    this._store.loadResults({ withTotal: false });
  }

  _goToPage (page) {
    if (!this._store || page < 1) return;
    this._store.setPage(page);
    this._store.loadResults({ withTotal: false });
  }

  _changePageSize (size) {
    if (!this._store) return;
    this._store.setPageSize(Number(size));
    this._store.loadResults({ withTotal: false });
  }

  _openExplain (row) {
    if (!this._store) return;
    this._store.openExplain(row.BRANCH, row.MTRL);
  }

  // --- Draft filter helpers (local edits, not yet sent to the store) ---
  _toggleListValue (key, value) {
    const current = Array.isArray(this._draftFilters[key]) ? this._draftFilters[key] : [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    this._draftFilters = { ...this._draftFilters, [key]: next };
  }

  _setIntList (key, rawValue) {
    const list = rawValue
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isFinite(n));
    this._draftFilters = { ...this._draftFilters, [key]: list };
  }

  _cycleTriState (key) {
    const current = this._draftFilters[key];
    const next = (current === null || current === undefined) ? true : (current === true ? false : null);
    this._draftFilters = { ...this._draftFilters, [key]: next };
  }

  _setInterval (key, bound, rawValue) {
    const current = this._draftFilters[key] || {};
    const value = rawValue === '' ? null : Number(rawValue);
    this._draftFilters = { ...this._draftFilters, [key]: { ...current, [bound]: Number.isNaN(value) ? null : value } };
  }

  _setCodeLike (value) {
    this._draftFilters = { ...this._draftFilters, codeLike: value };
  }

  _toggleBranch (branch) {
    const current = Array.isArray(this._draftFilters.branches) ? this._draftFilters.branches : [];
    const next = current.includes(branch) ? current.filter((b) => b !== branch) : [...current, branch];
    this._draftFilters = { ...this._draftFilters, branches: next };
  }

  // --- Render helpers ---
  _renderEnumFilter (key, label, options) {
    const selected = Array.isArray(this._draftFilters[key]) ? this._draftFilters[key] : [];
    return html`
      <div class="col-auto">
        <div class="small text-muted mb-1">${label}</div>
        <div class="btn-group btn-group-sm flex-wrap" role="group">
          ${options.map((opt) => html`
            <button type="button"
                    class="btn btn-outline-secondary btn-sm ${selected.includes(opt) ? 'active' : ''}"
                    @click="${() => this._toggleListValue(key, opt)}">${opt}</button>
          `)}
        </div>
      </div>
    `;
  }

  _renderIntListFilter (key, label) {
    const list = Array.isArray(this._draftFilters[key]) ? this._draftFilters[key] : [];
    return html`
      <div class="col-auto">
        <div class="small text-muted mb-1">${label}</div>
        <input type="text" class="form-control form-control-sm" style="width: 140px;" placeholder="ex: 123,456"
               .value="${list.join(',')}"
               @change="${(e) => this._setIntList(key, e.target.value)}">
      </div>
    `;
  }

  _renderTriStateFilter ({ key, label }) {
    const value = this._draftFilters[key];
    const text = value === true ? 'Da' : (value === false ? 'Nu' : 'Oricare');
    const cls = value === true ? 'btn-success' : (value === false ? 'btn-danger' : 'btn-outline-secondary');
    return html`
      <div class="col-auto">
        <button type="button" class="btn btn-sm ${cls}" @click="${() => this._cycleTriState(key)}">
          ${label}: ${text}
        </button>
      </div>
    `;
  }

  _renderIntervalFilter ({ key, label }) {
    const range = this._draftFilters[key] || {};
    return html`
      <div class="col-auto">
        <div class="small text-muted mb-1">${label}</div>
        <div class="input-group input-group-sm" style="width: 160px;">
          <input type="number" class="form-control" placeholder="min" .value="${range.min ?? ''}"
                 @change="${(e) => this._setInterval(key, 'min', e.target.value)}">
          <input type="number" class="form-control" placeholder="max" .value="${range.max ?? ''}"
                 @change="${(e) => this._setInterval(key, 'max', e.target.value)}">
        </div>
      </div>
    `;
  }

  _renderBranchFilter () {
    const selected = Array.isArray(this._draftFilters.branches) ? this._draftFilters.branches : [];
    return html`
      <div class="col-auto">
        <div class="small text-muted mb-1">Filiale</div>
        <div class="btn-group btn-group-sm flex-wrap" role="group">
          ${(this._branches || []).map((b) => html`
            <button type="button"
                    class="btn btn-outline-secondary btn-sm ${selected.includes(b.BRANCH) ? 'active' : ''}"
                    title="${b.MARIME || ''}"
                    @click="${() => this._toggleBranch(b.BRANCH)}">${b.BRANCH}</button>
          `)}
        </div>
      </div>
    `;
  }

  _renderSortIcon (field) {
    if (this.sort.field !== field) return html`<i class="fas fa-sort ms-1 text-muted" style="opacity:.5;"></i>`;
    return this.sort.dir === 'ASC'
      ? html`<i class="fas fa-sort-up ms-1 text-success"></i>`
      : html`<i class="fas fa-sort-down ms-1 text-danger"></i>`;
  }

  _formatCell (row, col) {
    const value = row[col.key];
    if (col.type === 'boolean') {
      // Green dot instead of text/badge (see renderBool in constants).
      return renderBool(value);
    }
    if (col.badge && value) {
      // SUPRASTOC and MAJOR_UP share the amber bg-warning (both WCAG-safe with
      // white text) — differentiate by icon so they stay visually distinct.
      const icon = value === 'SUPRASTOC' ? html`<i class="fas fa-boxes me-1"></i>`
        : value === 'MAJOR_UP' ? html`<i class="fas fa-arrow-trend-up me-1"></i>` : '';
      return html`<span class="badge ${FLAG_BADGE_CLASS[value] || 'bg-secondary'}">${icon}${value}</span>`;
    }
    if (col.type === 'number') {
      return (value === null || value === undefined) ? '-' : Number(value).toLocaleString('ro-RO', { maximumFractionDigits: 2 });
    }
    return value ?? '-';
  }

  render () {
    if (!this._draftFilters) {
      return html`<div class="text-muted"><i class="fas fa-spinner fa-spin"></i> Se incarca filtrele...</div>`;
    }

    const totalPages = this.total ? Math.max(1, Math.ceil(this.total / this.pageSize)) : null;

    return html`
      <div class="minmax-results-table card mb-3">
        <div class="card-header d-flex align-items-center justify-content-between">
          <span><i class="fas fa-table me-2"></i>Rezultate MIN/MAX</span>
          <span class="text-muted small">${this.total !== null ? `${this.total} randuri` : ''}</span>
        </div>
        <div class="card-body">
          ${this.error ? html`<div class="alert alert-danger py-2">${this.error}</div>` : ''}

          <div class="filters-panel border rounded p-2 mb-3 bg-light">
            <!-- Nivel 1: mereu vizibil (Anexa §A1) -->
            <div class="row g-2 align-items-end mb-2">
              <div class="col-auto">
                <div class="small text-muted mb-1">Cod (prefix)</div>
                <input type="text" class="form-control form-control-sm" style="width: 160px;"
                       .value="${this._draftFilters.codeLike || ''}"
                       @change="${(e) => this._setCodeLike(e.target.value)}">
              </div>
              ${this._renderBranchFilter()}
              ${this._renderEnumFilter('flagTxt', 'Flag', FLAG_TXT_OPTIONS)}
              ${this._renderEnumFilter('statusTrend', 'Trend', STATUS_TREND_OPTIONS)}
              ${this._renderEnumFilter('clasa', 'Clasa', CLASA_OPTIONS)}
            </div>

            <!-- Nivel 2: Excepții de verificat (Anexa §A1) -->
            <details class="mb-2" open>
              <summary class="small fw-semibold text-primary" style="cursor:pointer;">
                <i class="fas fa-exclamation-triangle me-1"></i>Excepții de verificat
              </summary>
              <div class="row g-2 align-items-end mt-1">
                ${this._renderEnumFilter('lifecycle', 'Lifecycle', LIFECYCLE_OPTIONS)}
                ${TRI_STATE_WARN_FIELDS.map((f) => this._renderTriStateFilter(f))}
              </div>
            </details>

            <!-- Nivel 3: Filtre avansate (Anexa §A1) -->
            <details class="mb-2">
              <summary class="small fw-semibold text-muted" style="cursor:pointer;">
                <i class="fas fa-sliders-h me-1"></i>Filtre avansate
              </summary>
              <div class="mt-2">
                <div class="row g-2 align-items-end mb-2">
                  ${this._renderIntListFilter('mtrl', 'MTRL')}
                  ${this._renderIntListFilter('mtrgroup', 'Grupa (MTRGROUP)')}
                  ${TRI_STATE_ERP_FIELDS.map((f) => this._renderTriStateFilter(f))}
                </div>
                <div class="row g-2 align-items-end">
                  ${INTERVAL_FIELDS.map((f) => this._renderIntervalFilter(f))}
                </div>
              </div>
            </details>

            <div class="d-flex gap-2 align-items-center">
              <button class="btn btn-sm btn-primary" ?disabled="${this.loading}" @click="${this._applyFilters}">
                <i class="fas fa-filter me-1"></i>Aplica filtre
              </button>
              <button class="btn btn-sm btn-outline-secondary" ?disabled="${this.loading}" @click="${this._resetFilters}">
                <i class="fas fa-undo me-1"></i>Reseteaza
              </button>
              ${_countActiveFilters(this._draftFilters) > 0
                ? html`<span class="badge bg-primary ms-1">${_countActiveFilters(this._draftFilters)} filtre active</span>`
                : ''}
            </div>
          </div>

          <div class="table-responsive">
            <table class="table table-sm table-hover align-middle mb-0">
              <thead class="sticky-top bg-white" style="z-index: 1;">
                <tr>
                  ${RESULT_COLUMNS.map((col) => html`
                    <th style="${col.sortField ? 'cursor:pointer;' : ''}"
                        @click="${col.sortField ? () => this._sortBy(col.sortField) : null}">
                      ${col.label}${col.sortField ? this._renderSortIcon(col.sortField) : ''}
                    </th>
                  `)}
                </tr>
              </thead>
              <tbody>
                ${this.loading
                  ? html`<tr><td colspan="${RESULT_COLUMNS.length}" class="text-center text-muted py-3">
                      <i class="fas fa-spinner fa-spin"></i> Se incarca rezultatele...
                    </td></tr>`
                  : ''}
                ${(!this.loading && this.rows.length === 0)
                  ? html`<tr><td colspan="${RESULT_COLUMNS.length}" class="text-center text-muted py-3">Niciun rezultat pentru filtrele curente.</td></tr>`
                  : ''}
                ${this.rows.map((row) => html`
                  <tr style="cursor:pointer;" title="Vezi explicatia calculului"
                      @click="${() => this._openExplain(row)}">
                    ${RESULT_COLUMNS.map((col) => html`<td>${this._formatCell(row, col)}</td>`)}
                  </tr>
                `)}
              </tbody>
            </table>
          </div>

          <div class="d-flex align-items-center justify-content-between mt-2">
            <div class="d-flex align-items-center gap-2">
              <span class="small text-muted">Pagina ${this.page}${totalPages ? ` / ${totalPages}` : ''}</span>
              <select class="form-select form-select-sm" style="width: auto;" aria-label="Marime pagina"
                      @change="${(e) => this._changePageSize(e.target.value)}">
                ${PAGE_SIZE_OPTIONS.map((size) => html`<option value="${size}" .selected="${size === this.pageSize}">${size}/pagina</option>`)}
              </select>
            </div>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary" ?disabled="${this.loading || this.page <= 1}"
                      @click="${() => this._goToPage(this.page - 1)}">
                <i class="fas fa-chevron-left"></i> Anterior
              </button>
              <button class="btn btn-outline-secondary" ?disabled="${this.loading || (totalPages !== null && this.page >= totalPages)}"
                      @click="${() => this._goToPage(this.page + 1)}">
                Urmator <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('minmax-results-table', MinmaxResultsTable);
