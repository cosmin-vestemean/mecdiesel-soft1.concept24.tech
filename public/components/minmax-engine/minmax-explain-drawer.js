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
// NOTE: not 'lit@3/directives/...' — that shim re-exports via a bare
// specifier ('lit-html/directives/...') that browsers can't resolve without
// an import map. This URL points at the real file, which uses relative
// imports only.
import { unsafeHTML } from 'https://cdn.jsdelivr.net/npm/lit-html@3/directives/unsafe-html.js';
import { ContextConsumer } from 'https://cdn.jsdelivr.net/npm/@lit/context@1.1.0/index.js';
import { MinmaxEngineStoreContext } from '../../stores/minmax-engine-store.js';
import { renderBool } from './minmax-engine-constants.js';
import katex from 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.mjs';

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
    this._pageOverflow = null;
    this._handleKeydown = (event) => {
      if (event.key === 'Escape' && this.open) {
        event.preventDefault();
        this._close();
      }
    };

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

  connectedCallback () {
    super.connectedCallback();
    document.addEventListener('keydown', this._handleKeydown);
    if (this.open) this._lockPageScroll();
  }

  disconnectedCallback () {
    document.removeEventListener('keydown', this._handleKeydown);
    this._unlockPageScroll();
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

  updated (changedProperties) {
    if (!changedProperties.has('open')) return;
    if (this.open) this._lockPageScroll();
    else this._unlockPageScroll();
  }

  // --- Actions ---
  _close () {
    if (this._store) this._store.closeExplain();
  }

  _lockPageScroll () {
    if (this._pageOverflow) return;
    this._pageOverflow = {
      body: document.body.style.overflow,
      root: document.documentElement.style.overflow
    };
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }

  _unlockPageScroll () {
    if (!this._pageOverflow) return;
    document.body.style.overflow = this._pageOverflow.body;
    document.documentElement.style.overflow = this._pageOverflow.root;
    this._pageOverflow = null;
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

  _formatDuration (value) {
    if (value === null || value === undefined || value === '') return '-';
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds < 0) return '-';
    const rounded = Math.round(seconds);
    const minutes = Math.floor(rounded / 60);
    const remainder = rounded % 60;
    return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
  }

  _formatValue (row, field) {
    const value = row[field.key];
    if (field.type === 'boolean') {
      // Green dot instead of text/badge (see renderBool in constants).
      return renderBool(value);
    }
    if (field.type === 'text') {
      return value ?? '-';
    }
    return this._formatNumber(value);
  }

  // Anexa §B11: render the ENG_MIN/ENG_MAX formula chain with the actual
  // values substituted, above the raw parameter tables. Formulas transcribed
  // from new_min_max/sql/03_compute.sql Step1-Step6 + §7a-7c (read-only
  // display; the authoritative calculation stays in the stored procedure).
  // Constants (InflatieHq, HqCapFactor, ...) come from the CCCMINMAXRUNPARAM
  // snapshot (BRANCH=0/PREFIX=''), with the same fallbacks as 03_compute.sql,
  // since they aren't persisted per-row on CCCMINMAXDET.
  _paramsMap (runParams) {
    const rows = Array.isArray(runParams) ? runParams : [];
    return Object.fromEntries(rows.map((row) => [row.PARAMKEY, row.PARAMVALUE]));
  }

  // KaTeX renders the symbolic/substituted math (Anexa feedback 08.09.2026:
  // Unicode approximations of √/⌈⌉/σ read as amateurish). throwOnError:false
  // means a malformed TeX string degrades to a visible red error span instead
  // of throwing — safe for production.
  _katex (tex) {
    return unsafeHTML(katex.renderToString(tex, { throwOnError: false }));
  }

  // LaTeX-safe numeric literal: period decimal separator, trimmed to 4
  // decimals (the ro-RO comma separator used elsewhere would be parsed by
  // KaTeX as punctuation with its own spacing rules, not a decimal point).
  _texNum (v) {
    const num = Number(v);
    if (!Number.isFinite(num)) return '0';
    return String(Math.round(num * 10000) / 10000);
  }

  _renderFormula (det, runParams) {
    if (!det) return '';
    const n = (v) => this._formatNumber(v);
    const t = (v) => this._texNum(v);
    const k = (tex) => this._katex(tex);
    const num = (v) => (v === null || v === undefined ? 0 : Number(v));
    const lifecycle = det.LIFECYCLE;
    const cp = this._paramsMap(runParams);

    const inflatieHq = num(cp.INFLATIE_HQ) || 1.30;
    const hqCapFactor = num(cp.HQ_CAP_FACTOR) || 1.5;
    const capLuni = num(cp.CAP_LUNI) || 6;
    const czCycleZero = cp.CZ_CYCLE_ZERO === undefined ? true : Boolean(Number(cp.CZ_CYCLE_ZERO));

    const avg = num(det.AVG);
    const covTgt = num(det.COV_TGT);
    const ad = num(det.ad);
    const frecventaZile = num(det.FRECVENTA_ZILE);
    const safety = num(det.SAFETY);
    const ltStock = num(det.LT_STOCK);
    const slts = num(det.SLTS);
    const buf = num(det.BUF);
    const cycle = num(det.CYCLE);
    const maxRaw = num(det.MAX_RAW);
    const maxInf = num(det.MAX_INF);
    const cap6 = num(det.CAP6);
    const vz26Cap = num(det.VZ26_CAP);
    const sumBrMax = (det.SUM_BR_MAX === null || det.SUM_BR_MAX === undefined) ? null : num(det.SUM_BR_MAX);
    const engMax = num(det.ENG_MAX);
    const engMin = num(det.ENG_MIN);
    const minDoc = num(det.MIN_DOC);
    const minBase = Math.max(Math.ceil(buf), minDoc);
    const buyRaw = num(det.BUY_RAW);
    const buyQty = num(det.BUY_QTY);
    const stocQty = num(det.STOC_QTY);
    const ordFurn = num(det.ORD_FURN);
    const nPack = num(det.N_PACK) || 1;

    const cycleShortCircuit = covTgt === 0 && czCycleZero;
    const isOd = lifecycle === 'OD';
    const engMaxEqualsMin = Math.abs(engMax - engMin) < 0.00005;

    return html`
      <div class="mb-3">
        <h6 class="text-muted">Formula de calcul (valori înlocuite)</h6>
        <div class="minmax-formula-block border rounded p-2 bg-light small" style="line-height: 2.1;">
          <div>${k('\\text{SAFETY} = \\sigma_{wk} \\times SSF \\times \\sqrt{\\dfrac{LT}{7}}')} = <strong>${n(safety)}</strong></div>
          <div>${k('\\text{LT\\_STOCK} = ad \\times LT_{zile}')} = <strong>${n(ltStock)}</strong></div>
          <div>${k('\\text{SLTS} = LT\\_STOCK \\times \\left(\\dfrac{100}{SL} - 1\\right)')} = <strong>${n(slts)}</strong></div>
          <div>${k('\\text{BUF} = SAFETY + SLTS + LT\\_STOCK')} = <strong>${n(buf)}</strong></div>
          <div>${cycleShortCircuit
            ? k('\\text{CYCLE} = 0 \\quad (COV\\_TGT = 0)')
            : k(`\\text{CYCLE} = \\max(AVG \\times COV\\_TGT,\\ ad \\times FRECVENTA\\_ZILE) = \\max(${t(avg * covTgt)}, ${t(ad * frecventaZile)})`)} = <strong>${n(cycle)}</strong></div>
          <div>${k(`\\text{MAX\\_RAW} = \\left\\lceil BUF + CYCLE \\right\\rceil = \\left\\lceil ${t(buf)} + ${t(cycle)} \\right\\rceil`)} = <strong>${n(maxRaw)}</strong></div>
          <div>${det.ESTE_HQ
            ? k(`\\text{MAX\\_INF} = \\left\\lceil MAX\\_RAW \\times InflatieHQ \\right\\rceil = \\left\\lceil ${t(maxRaw)} \\times ${t(inflatieHq)} \\right\\rceil`)
            : k('\\text{MAX\\_INF} = MAX\\_RAW')} = <strong>${n(maxInf)}</strong></div>
          <div>${k(`\\text{CAP6} = \\left\\lceil AVG \\times CapLuni \\right\\rceil = \\left\\lceil ${t(avg)} \\times ${t(capLuni)} \\right\\rceil`)} = <strong>${n(cap6)}</strong></div>
          <div>${det.VZ_26S > 0
            ? k('\\text{VZ26\\_CAP} = VZ\\_26S')
            : k('\\text{VZ26\\_CAP} = \\text{sentinelă} \\ (VZ\\_26S = 0)')} = <strong>${n(vz26Cap)}</strong></div>
          <div class="border-top pt-2 mt-1">
            ${isOd
              ? k('\\text{ENG\\_MAX} = 0 \\quad (OD)')
              : (det.HQ_CAP_APLICAT && sumBrMax !== null)
                ? html`${k(`\\text{ENG\\_MAX} = \\left\\lceil SUM\\_BR\\_MAX \\times HqCapFactor \\right\\rceil = \\left\\lceil ${t(sumBrMax)} \\times ${t(hqCapFactor)} \\right\\rceil`)} <span class="text-muted">(cap HQ aplicat)</span>`
                : (det.PODEA_APLICATA && engMaxEqualsMin)
                  ? html`${k('\\text{ENG\\_MAX} = ENG\\_MIN')} <span class="text-muted">(podea aplicată)</span>`
                  : k(`\\text{ENG\\_MAX} = \\min(MAX\\_INF, CAP6, VZ26\\_CAP) = \\min(${t(maxInf)}, ${t(cap6)}, ${t(vz26Cap)})`)
            } = <strong class="text-primary">${n(engMax)}</strong>
          </div>
          <div class="mt-1">
            ${k(`\\text{MIN\\_BASE} = \\max\\!\\left(\\left\\lceil BUF \\right\\rceil, MIN\\_DOC\\right) = \\max(${Math.ceil(buf)}, ${t(minDoc)})`)} = <strong>${n(minBase)}</strong>
          </div>
          <div class="mt-1">
            ${isOd
              ? k('\\text{ENG\\_MIN} = 0 \\quad (OD)')
              : det.PODEA_APLICATA
                ? html`<span class="text-muted">podea aplicată (procent din ENG_MIN al rândului HQ, indisponibil pe acest rând)</span>`
                : k(`\\text{ENG\\_MIN} = \\min(MIN\\_BASE, ENG\\_MAX) = \\min(${t(minBase)}, ${t(engMax)})`)
            } = <strong class="text-primary">${n(engMin)}</strong>
          </div>
          <div class="border-top pt-2 mt-1">
            ${k(`\\text{BUY\\_RAW} = \\max(0,\\ ENG\\_MAX - STOC^{+} - ORD\\_FURN) = \\max(0,\\ ${t(engMax)} - ${stocQty > 0 ? t(stocQty) : '0'} - ${t(ordFurn)})`)} = <strong>${n(buyRaw)}</strong>
          </div>
          <div class="mt-1">
            ${k(`\\text{BUY\\_QTY} = \\left\\lceil \\dfrac{BUY\\_RAW}{N\\_PACK} \\right\\rceil \\times N\\_PACK = \\left\\lceil \\dfrac{${t(buyRaw)}}{${t(nPack)}} \\right\\rceil \\times ${t(nPack)}`)} = <strong class="text-success">${n(buyQty)}</strong>
          </div>
        </div>
      </div>
    `;
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

  _renderRunHeader (run, runParams) {
    if (!run) return '';
    const rows = Array.isArray(runParams) ? runParams : [];
    return html`
      <div class="mb-3">
        <h6 class="text-muted">Sesiune (CCCMINMAXRUN)</h6>
        <table class="table table-sm table-bordered mb-2">
          <tbody>
            <tr><th class="w-50">RUNID</th><td>${run.RUNID}</td></tr>
            <tr><th>Companie</th><td>${run.COMPANY}</td></tr>
            <tr><th>Azi (referinta)</th><td>${run.AZI ?? '-'}</td></tr>
            <tr><th>Start clasificare</th><td>${this._formatDateTime(run.STARTEDAT)}</td></tr>
            <tr><th>Final procesare</th><td>${run.SESSION_STATUS === 'OPEN' ? '-' : this._formatDateTime(run.FINISHEDAT)}</td></tr>
            <tr><th>Durata procesare</th><td>${this._formatDuration(run.SESSION_DURATA_SEC)}</td></tr>
            <tr><th>Clasificare</th><td>${this._formatDateTime(run.STARTEDAT)} – ${this._formatDateTime(run.GROUP_STARTEDAT)} · ${this._formatDuration(run.CLASSIFY_DURATA_SEC)}</td></tr>
            <tr><th>Clasificare grupe</th><td>${this._formatDateTime(run.GROUP_STARTEDAT)} – ${this._formatDateTime(run.GROUP_FINISHEDAT)} · ${this._formatDuration(run.GROUP_DURATA_SEC)}</td></tr>
            <tr><th>Compute</th><td>${this._formatDateTime(run.COMPUTE_STARTEDAT)} – ${this._formatDateTime(run.COMPUTE_FINISHEDAT)} · ${this._formatDuration(run.COMPUTE_DURATA_SEC)}</td></tr>
          </tbody>
        </table>
        <details>
          <summary class="small text-muted" style="cursor: pointer;">Parametri (CCCMINMAXRUNPARAM, snapshot)</summary>
          <table class="table table-sm table-bordered mb-0">
            <tbody>
              ${rows.map((row) => html`<tr><th>${row.PARAMKEY}</th><td>${row.PARAMVALUE}</td></tr>`)}
            </tbody>
          </table>
        </details>
      </div>
    `;
  }

  _renderWeeklySeries (weeklySeries) {
    const rows = Array.isArray(weeklySeries) ? weeklySeries : [];
    return html`
      <div class="mb-3">
        <h6 class="text-muted">Serie saptamanala (52 saptamani, densa)</h6>
        <div class="table-responsive">
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
         role="dialog" aria-modal="true" aria-label="Explicatie calcul MIN/MAX"
         style="position: fixed; top: 0; right: 0; bottom: 0; width: 520px; max-width: 95vw; z-index: 1051; overflow-y: auto; overscroll-behavior: contain; border-radius: 0;">
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

            ${this._renderRunHeader(this.data.run, this.data.runParams)}
            ${this._renderFormula(det, this.data.runParams)}
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
