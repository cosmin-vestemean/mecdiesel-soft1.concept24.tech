/**
 * MIN/MAX Group ABC (Faza 5 — UI de confirmare)
 *
 * ABC/XYZ classification per MTRGROUP x BRANCH, read from CCCMINMAXGRP
 * (contract §8). Unlike minmax-results-table.js, these filters are
 * transient: they live only in this component's local state and are passed
 * directly to store.loadGroupAbc(filters) on every call — never dispatched
 * to (or read back from) the store, unlike results() filters. Page/pageSize
 * are the only pieces of state shared with the store (state.groupAbc), so
 * paging still goes through setGroupAbcPage/setGroupAbcPageSize before
 * reloading. This view has no container-level initial load (unlike
 * results()), so it triggers its own first fetch on mount.
 *
 * @element minmax-group-abc
 */

import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { ContextConsumer } from 'https://cdn.jsdelivr.net/npm/@lit/context@1.1.0/index.js';
import { MinmaxEngineStoreContext } from '../../stores/minmax-engine-store.js';
import { CLASA_OPTIONS } from './minmax-engine-constants.js';

// Enum options mirrored from GRP_COLUMNS/LIFECYCLE_VALUES etc. in minmax-engine.class.js.
const LIFECYCLE_OPTIONS = ['STANDARD', 'NOU', 'OD'];
const ABC_OPTIONS = ['A', 'B', 'C'];
const XYZ_OPTIONS = ['X', 'Y', 'Z'];

// Columns rendered from CCCMINMAXGRP (subset, per 00b_persist.sql).
const GROUP_COLUMNS = [
  { key: 'BRANCH', label: 'Filiala' },
  { key: 'MTRGROUP_CODE', label: 'Grupa' },
  { key: 'MTRGROUP_NAME', label: 'Denumire' },
  { key: 'LIFECYCLE', label: 'Lifecycle' },
  { key: 'ABC', label: 'ABC' },
  { key: 'XYZ', label: 'XYZ' },
  { key: 'CLASA', label: 'Clasa' },
  { key: 'NR_SKU_GRP', label: 'Nr. SKU', type: 'number' },
  { key: 'NR_SKU_VZ', label: 'Nr. SKU vandute', type: 'number' },
  { key: 'VZ_26S', label: 'Vz 26S', type: 'number' },
  { key: 'VZ_52S', label: 'Vz 52S', type: 'number' },
  { key: 'VAL_52S', label: 'Val 52S', type: 'number' },
  { key: 'CV', label: 'CV', type: 'number' },
  { key: 'ESTE_HQ', label: 'HQ', type: 'boolean' }
];

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500];

// Keys/order match the groupAbc() filter handling in minmax-engine.class.js.
function getDefaultFilters () {
  return { abc: [], branches: [], clasa: [], esteHq: null, lifecycle: [], mtrgroup: [], xyz: [] };
}

export class MinmaxGroupAbc extends LitElement {
  static get properties () {
    return {
      error: { type: String },
      loading: { type: Boolean },
      page: { type: Number },
      pageSize: { type: Number },
      rows: { type: Array },
      total: { type: Number },
      _branches: { state: true, type: Array },
      _filters: { state: true, type: Object }
    };
  }

  constructor () {
    super();

    this.error = '';
    this.loading = false;
    this.page = 1;
    this.pageSize = 100;
    this.rows = [];
    this.total = null;
    this._branches = [];
    this._filters = getDefaultFilters();
    this._loaded = false; // guards the one-time initial fetch below

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

    if (!this._loaded) {
      this._loaded = true;
      this._store.loadGroupAbc(this._filters, { withTotal: true });
    }
  }

  _syncStateFromStore (state) {
    this.error = state.groupAbc.error;
    this.loading = state.groupAbc.loading;
    this.page = state.groupAbc.page;
    this.pageSize = state.groupAbc.pageSize;
    this.rows = state.groupAbc.rows;
    this.total = state.groupAbc.total;
    this._branches = state.params.branches;
  }

  // --- Actions (filters stay local; only page/pageSize round-trip the store) ---
  _applyFilters () {
    if (!this._store) return;
    this._store.setGroupAbcPage(1);
    this._store.loadGroupAbc(this._filters, { withTotal: true });
  }

  _resetFilters () {
    if (!this._store) return;
    this._filters = getDefaultFilters();
    this._store.setGroupAbcPage(1);
    this._store.loadGroupAbc(this._filters, { withTotal: true });
  }

  _goToPage (page) {
    if (!this._store || page < 1) return;
    this._store.setGroupAbcPage(page);
    this._store.loadGroupAbc(this._filters, { withTotal: false });
  }

  _changePageSize (size) {
    if (!this._store) return;
    this._store.setGroupAbcPageSize(Number(size));
    this._store.loadGroupAbc(this._filters, { withTotal: false });
  }

  // --- Local filter helpers (transient — no store dispatch) ---
  _toggleListValue (key, value) {
    const current = Array.isArray(this._filters[key]) ? this._filters[key] : [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    this._filters = { ...this._filters, [key]: next };
  }

  _setIntList (key, rawValue) {
    const list = rawValue
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isFinite(n));
    this._filters = { ...this._filters, [key]: list };
  }

  _cycleTriState (key) {
    const current = this._filters[key];
    const next = (current === null || current === undefined) ? true : (current === true ? false : null);
    this._filters = { ...this._filters, [key]: next };
  }

  _toggleBranch (branch) {
    const current = Array.isArray(this._filters.branches) ? this._filters.branches : [];
    const next = current.includes(branch) ? current.filter((b) => b !== branch) : [...current, branch];
    this._filters = { ...this._filters, branches: next };
  }

  // --- Render helpers ---
  _renderEnumFilter (key, label, options) {
    const selected = Array.isArray(this._filters[key]) ? this._filters[key] : [];
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
    const list = Array.isArray(this._filters[key]) ? this._filters[key] : [];
    return html`
      <div class="col-auto">
        <div class="small text-muted mb-1">${label}</div>
        <input type="text" class="form-control form-control-sm" style="width: 140px;" placeholder="ex: 123,456"
               .value="${list.join(',')}"
               @change="${(e) => this._setIntList(key, e.target.value)}">
      </div>
    `;
  }

  _renderTriStateFilter (key, label) {
    const value = this._filters[key];
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

  _renderBranchFilter () {
    const selected = Array.isArray(this._filters.branches) ? this._filters.branches : [];
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

  _formatCell (row, col) {
    const value = row[col.key];
    if (col.type === 'boolean') {
      return value ? html`<span class="badge bg-success">Da</span>` : html`<span class="text-muted">-</span>`;
    }
    if (col.type === 'number') {
      return (value === null || value === undefined) ? '-' : Number(value).toLocaleString('ro-RO', { maximumFractionDigits: 2 });
    }
    return value ?? '-';
  }

  render () {
    const totalPages = this.total ? Math.max(1, Math.ceil(this.total / this.pageSize)) : null;

    return html`
      <div class="minmax-group-abc card mb-3">
        <div class="card-header d-flex align-items-center justify-content-between">
          <span><i class="fas fa-layer-group me-2"></i>Clasificare ABC-XYZ pe grupe</span>
          <span class="text-muted small">${this.total !== null ? `${this.total} randuri` : ''}</span>
        </div>
        <div class="card-body">
          ${this.error ? html`<div class="alert alert-danger py-2">${this.error}</div>` : ''}

          <div class="filters-panel border rounded p-2 mb-3 bg-light">
            <div class="row g-2 align-items-end mb-2">
              ${this._renderIntListFilter('mtrgroup', 'Grupa (MTRGROUP)')}
              ${this._renderBranchFilter()}
              ${this._renderEnumFilter('lifecycle', 'Lifecycle', LIFECYCLE_OPTIONS)}
              ${this._renderEnumFilter('abc', 'ABC', ABC_OPTIONS)}
              ${this._renderEnumFilter('xyz', 'XYZ', XYZ_OPTIONS)}
              ${this._renderEnumFilter('clasa', 'Clasa', CLASA_OPTIONS)}
              ${this._renderTriStateFilter('esteHq', 'HQ')}
            </div>

            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-primary" ?disabled="${this.loading}" @click="${this._applyFilters}">
                <i class="fas fa-filter me-1"></i>Aplica filtre
              </button>
              <button class="btn btn-sm btn-outline-secondary" ?disabled="${this.loading}" @click="${this._resetFilters}">
                <i class="fas fa-undo me-1"></i>Reseteaza
              </button>
            </div>
          </div>

          <div class="table-responsive">
            <table class="table table-sm table-hover align-middle mb-0">
              <thead>
                <tr>
                  ${GROUP_COLUMNS.map((col) => html`<th>${col.label}</th>`)}
                </tr>
              </thead>
              <tbody>
                ${this.loading
                  ? html`<tr><td colspan="${GROUP_COLUMNS.length}" class="text-center text-muted py-3">
                      <i class="fas fa-spinner fa-spin"></i> Se incarca clasificarea...
                    </td></tr>`
                  : ''}
                ${(!this.loading && this.rows.length === 0)
                  ? html`<tr><td colspan="${GROUP_COLUMNS.length}" class="text-center text-muted py-3">Niciun rezultat pentru filtrele curente.</td></tr>`
                  : ''}
                ${this.rows.map((row) => html`
                  <tr>
                    ${GROUP_COLUMNS.map((col) => html`<td>${this._formatCell(row, col)}</td>`)}
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

customElements.define('minmax-group-abc', MinmaxGroupAbc);
