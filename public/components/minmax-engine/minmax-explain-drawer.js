/**
 * MIN/MAX Explain Drawer (Faza 5 — UI de confirmare)
 *
 * Drill-down pentru un rand (RUNID, BRANCH, MTRL): citeste EXCLUSIV stare
 * persistata (CCCMINMAXDET/RUN/WINSOR/WEEK), fara sa recalculeze nimic.
 * Vezi FAZA5_CONTRACT.md §6. Datele vin deja asamblate din
 * store.openExplain(branch, mtrl) (state.explain); acest component doar le
 * afiseaza.
 *
 * @element minmax-explain-drawer
 */

import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { ContextConsumer } from 'https://cdn.jsdelivr.net/npm/@lit/context@1.1.0/index.js';
import { MinmaxEngineStoreContext } from '../../stores/minmax-engine-store.js';

// Ordinea exacta din contract §6: intrarile lantului de calcul.
const INPUT_FIELDS = [
  { key: 'SIGMA_WK', label: 'SIGMA_WK' },
  { key: 'SSF', label: 'SSF' },
  { key: 'LT_ZILE', label: 'LT_ZILE' },
  { key: 'SL', label: 'SL' },
  { key: 'ad', label: 'ad' },
  { key: 'AVG', label: 'AVG' },
  { key: 'COV_TGT', label: 'COV_TGT' },
  { key: 'FRECVENTA_ZILE', label: 'FRECVENTA_ZILE' },
  { key: 'N_PACK', label: 'N_PACK' },
  { key: 'STOC_QTY', label: 'STOC_QTY' },
  { key: 'ORD_FURN', label: 'ORD_FURN' }
];

// Ordinea exacta din contract §6: pasii lantului de calcul, in ordinea in care se aplica.
const CHAIN_FIELDS = [
  { key: 'SAFETY', label: 'SAFETY' },
  { key: 'LT_STOCK', label: 'LT_STOCK' },
  { key: 'SLTS', label: 'SLTS' },
  { key: 'BUF', label: 'BUF' },
  { key: 'CYCLE', label: 'CYCLE' },
  { key: 'MAX_RAW', label: 'MAX_RAW' },
  { key: 'MAX_INF', label: 'MAX_INF' },
  { key: 'CAP6', label: 'CAP6' },
  { key: 'VZ26_CAP', label: 'VZ26_CAP' },
  { key: 'SUM_BR_MAX', label: 'SUM_BR_MAX' },
  { key: 'ENG_MIN', label: 'ENG_MIN' },
  { key: 'ENG_MAX', label: 'ENG_MAX' },
  { key: 'BUY_RAW', label: 'BUY_RAW' },
  { key: 'BUY_QTY', label: 'BUY_QTY' },
  { key: 'HQ_CAP_APLICAT', label: 'HQ_CAP_APLICAT', type: 'boolean' },
  { key: 'PODEA_APLICATA', label: 'PODEA_APLICATA', type: 'boolean' }
];

const WINSOR_FIELDS = [
  { key: 'POSITIVE_LINE_COUNT', label: 'Linii pozitive' },
  { key: 'P95_QTY', label: 'P95 QTY' },
  { key: 'MEDIAN_QTY', label: 'Mediana QTY' },
  { key: 'PRAG_APLICAT', label: 'Prag aplicat', type: 'text' },
  { key: 'NR_LINII_PLAFONATE', label: 'Linii plafonate' },
  { key: 'QTY_BRUT', label: 'QTY brut' },
  { key: 'QTY_WINSORIZAT', label: 'QTY winsorizat' }
];

export class MinmaxExplainDrawer extends LitElement {
  static get properties () {
    return {
      branch: { type: Number },
      data: { type: Object },
      error: { type: String },
      loading: { type: Boolean },
      mtrl: { type: Number },
      open: { type: Boolean }
    };
  }

  constructor () {
    super();

    this.branch = null;
    this.data = null;
    this.error = '';
    this.loading = false;
    this.mtrl = null;
    this.open = false;

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
    this.open = state.explain.open;
    this.loading = state.explain.loading;
    this.error = state.explain.error;
    this.data = state.explain.data;
    this.branch = state.explain.branch;
    this.mtrl = state.explain.mtrl;
  }

  // --- Actions ---
  _close () {
    if (this._store) this._store.closeExplain();
  }

  // --- Rendering Helpers ---
  _formatNumber (value) {
    if (value === null || value === undefined || value === '') return '-';
    return Number(value).toLocaleString('ro-RO', { maximumFractionDigits: 4 });
  }

  _formatDateTime (value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('ro-RO', {
      day: '2-digit', hour: '2-digit', minute: '2-digit', month: '2-digit', year: 'numeric'
    });
  }

  _formatValue (row, field) {
    const value = row[field.key];
    if (field.type === 'boolean') {
      return value ? html`<span class="badge bg-success">Da</span>` : html`<span class="text-muted">-</span>`;
    }
    if (field.type === 'text') {
      return value ?? '-';
    }
    return this._formatNumber(value);
  }

  _formatJson (raw) {
    if (!raw) return '-';
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  _renderFieldTable (title, fields, row) {
    return html`
      <div class="mb-3">
        <h6 class="text-muted">${title}</h6>
        <table class="table table-sm table-bordered mb-0">
          <tbody>
            ${fields.map((field) => html`
              <tr>
                <th class="w-50">${field.label}</th>
                <td>${this._formatValue(row, field)}</td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  }

  _renderRunHeader (run) {
    if (!run) return '';
    return html`
      <div class="mb-3">
        <h6 class="text-muted">Sesiune (CCCMINMAXRUN)</h6>
        <table class="table table-sm table-bordered mb-2">
          <tbody>
            <tr><th class="w-50">RUNID</th><td>${run.RUNID}</td></tr>
            <tr><th>Companie</th><td>${run.COMPANY}</td></tr>
            <tr><th>Azi (referinta)</th><td>${run.AZI ?? '-'}</td></tr>
            <tr><th>Pornit</th><td>${this._formatDateTime(run.STARTEDAT)}</td></tr>
            <tr><th>Compute pornit</th><td>${this._formatDateTime(run.COMPUTE_STARTEDAT)}</td></tr>
          </tbody>
        </table>
        <details>
          <summary class="small text-muted" style="cursor: pointer;">Parametri (JSON)</summary>
          <pre class="small bg-light p-2 mb-0">PARAMSJSON: ${this._formatJson(run.PARAMSJSON)}

COMPUTE_PARAMSJSON: ${this._formatJson(run.COMPUTE_PARAMSJSON)}

GROUP_PARAMSJSON: ${this._formatJson(run.GROUP_PARAMSJSON)}</pre>
        </details>
      </div>
    `;
  }

  _renderWeeklySeries (weeklySeries) {
    const rows = Array.isArray(weeklySeries) ? weeklySeries : [];
    return html`
      <div class="mb-3">
        <h6 class="text-muted">Serie saptamanala (52 saptamani, densa)</h6>
        <div class="table-responsive" style="max-height: 320px;">
          <table class="table table-sm table-bordered mb-0">
            <thead class="sticky-top bg-white">
              <tr>
                <th>Saptamana</th>
                <th>QTY</th>
                <th>Valoare vanzari</th>
                <th>Ultima vanzare pozitiva</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((week) => html`
                <tr>
                  <td>${week.WEEK_INDEX}</td>
                  <td>${this._formatNumber(week.QTY)}</td>
                  <td>${this._formatNumber(week.SALES_VALUE)}</td>
                  <td>${this._formatDateTime(week.LAST_POSITIVE_SALE)}</td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  render () {
    if (!this.open) return html``;

    const det = this.data && this.data.det;

    return html`
      <div class="minmax-explain-backdrop" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1050;" @click="${this._close}"></div>
      <div class="minmax-explain-drawer card shadow-lg"
           style="position: fixed; top: 0; right: 0; bottom: 0; width: 520px; max-width: 95vw; z-index: 1051; overflow-y: auto; border-radius: 0;">
        <div class="card-header d-flex align-items-center justify-content-between">
          <span>
            <i class="fas fa-magnifying-glass-chart me-2"></i>Explicatie
            ${det ? html`&mdash; ${det.CODE || det.MTRL} @ filiala ${det.BRANCH}` : ''}
          </span>
          <button type="button" class="btn-close" aria-label="Close" @click="${this._close}"></button>
        </div>
        <div class="card-body">
          ${this.error ? html`<div class="alert alert-danger py-2">${this.error}</div>` : ''}

          ${this.loading
            ? html`<div class="text-center text-muted py-4"><i class="fas fa-spinner fa-spin"></i> Se incarca explicatia...</div>`
            : ''}

          ${(!this.loading && !this.error && det) ? html`
            <div class="mb-3">
              <h6 class="text-muted">Articol</h6>
              <table class="table table-sm table-bordered mb-0">
                <tbody>
                  <tr><th class="w-50">Cod</th><td>${det.CODE ?? '-'}</td></tr>
                  <tr><th>Denumire</th><td>${det.MTRL_NAME ?? '-'}</td></tr>
                  <tr><th>Grupa</th><td>${det.MTRGROUP_CODE ?? '-'} ${det.MTRGROUP_NAME ?? ''}</td></tr>
                  <tr><th>Lifecycle</th><td>${det.LIFECYCLE ?? '-'}</td></tr>
                  <tr><th>Clasa (ABC/XYZ)</th><td>${det.ABC ?? '-'}${det.XYZ ?? ''} (${det.CLASA ?? '-'})</td></tr>
                  <tr><th>Marime filiala</th><td>${det.MARIME ?? '-'}</td></tr>
                </tbody>
              </table>
            </div>

            ${this._renderRunHeader(this.data.run)}
            ${this._renderFieldTable('Intrari', INPUT_FIELDS, det)}
            ${this._renderFieldTable('Lant de calcul', CHAIN_FIELDS, det)}
            ${this.data.winsor
              ? this._renderFieldTable('Winsorizare (CCCMINMAXWINSOR)', WINSOR_FIELDS, this.data.winsor)
              : html`<div class="text-muted small mb-3">Nicio inregistrare de winsorizare pentru acest articol.</div>`}
            ${this._renderWeeklySeries(this.data.weeklySeries)}
          ` : ''}

          ${(!this.loading && !this.error && !det) ? html`<div class="text-muted">Niciun rand gasit.</div>` : ''}
        </div>
      </div>
    `;
  }
}

customElements.define('minmax-explain-drawer', MinmaxExplainDrawer);
