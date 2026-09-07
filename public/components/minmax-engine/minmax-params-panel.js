/**
 * MIN/MAX Params Panel (Faza 5 — UI de confirmare)
 *
 * Parametri globali (CCCMINMAXPARAMS), matricea COV_TGT (CCCMINMAXCOV,
 * CLASA x MARIME) si configurarea filialelor (CCCMINMAXBRANCH). Singura
 * scriere din interfata (contract §7), prin store.saveParams(), atomic via
 * `statements`. CCCMINMAXTEMPLATE ramane in afara iteratiei 1.
 *
 * Editarile stau local (draft, sparse maps cheiate pe identitatea din
 * contract) pana la "Salveaza"; store.saveParams() reincarca automat
 * params() la succes, moment in care draft-urile se sterg. ESTE_HQ nu este
 * editabil — defineste stratul de companie, nu o preferinta (contract §7).
 *
 * @element minmax-params-panel
 */

import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { ContextConsumer } from 'https://cdn.jsdelivr.net/npm/@lit/context@1.1.0/index.js';
import { MinmaxEngineStoreContext } from '../../stores/minmax-engine-store.js';

// Ordinea fixa a matricei COV (00_params.sql §6): 11 clase x 3 marimi = 33 randuri.
const CLASA_ORDER = ['AX', 'AY', 'AZ', 'BX', 'BY', 'BZ', 'CX', 'CY', 'CZ', 'NOU', 'OD'];
const MARIME_ORDER = ['MARE', 'MEDIU', 'MIC'];

function paramRowKey (row) {
  return `${row.PARAMKEY}|${row.SCOPE}|${row.SCOPEKEY}`;
}

function covRowKey (row) {
  return `${row.CLASA}|${row.MARIME}`;
}

export class MinmaxParamsPanel extends LitElement {
  static get properties () {
    return {
      branches: { type: Array },
      cov: { type: Array },
      loading: { type: Boolean },
      params: { type: Array },
      saveError: { type: String },
      saving: { type: Boolean },
      writesEnabled: { type: Boolean },
      _branchEdits: { state: true, type: Object },
      _covEdits: { state: true, type: Object },
      _paramEdits: { state: true, type: Object }
    };
  }

  constructor () {
    super();

    this.branches = [];
    this.cov = [];
    this.loading = false;
    this.params = [];
    this.saveError = '';
    this.saving = false;
    this.writesEnabled = false;
    this._branchEdits = {};
    this._covEdits = {};
    this._paramEdits = {};

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
    this.branches = state.params.branches;
    this.cov = state.params.cov;
    this.loading = state.params.loading;
    this.params = state.params.params;
    this.saveError = state.params.saveError;
    this.writesEnabled = state.params.writesEnabled;

    // A save just completed (saving flipped back to false with no error):
    // the store already reloaded fresh data, so drop the now-stale drafts.
    if (this.saving && !state.params.saving && !state.params.saveError) {
      this._paramEdits = {};
      this._covEdits = {};
      this._branchEdits = {};
    }
    this.saving = state.params.saving;
  }

  get _dirtyCount () {
    return Object.keys(this._paramEdits).length + Object.keys(this._covEdits).length + Object.keys(this._branchEdits).length;
  }

  // --- Draft edits (local until Salveaza) ---
  _setParamValue (row, value) {
    this._paramEdits = { ...this._paramEdits, [paramRowKey(row)]: value };
  }

  _setCovValue (row, value) {
    this._covEdits = { ...this._covEdits, [covRowKey(row)]: value };
  }

  _branchDraft (row) {
    const key = String(row.BRANCH);
    return {
      estePodea: Boolean(row.ESTE_PODEA),
      inclus: Boolean(row.INCLUS),
      marime: row.MARIME,
      ...(this._branchEdits[key] || {})
    };
  }

  _setBranchField (row, field, value) {
    const key = String(row.BRANCH);
    this._branchEdits = { ...this._branchEdits, [key]: { ...this._branchDraft(row), [field]: value } };
  }

  _cancel () {
    this._paramEdits = {};
    this._covEdits = {};
    this._branchEdits = {};
  }

  _save () {
    if (!this._store) return;

    const paramsUpdates = [];
    for (const row of this.params) {
      const key = paramRowKey(row);
      if (!Object.prototype.hasOwnProperty.call(this._paramEdits, key)) continue;
      const paramValue = this._paramEdits[key];
      if (paramValue !== row.PARAMVALUE) {
        paramsUpdates.push({
          paramKey: row.PARAMKEY, paramType: row.PARAMTYPE, paramValue, scope: row.SCOPE, scopeKey: row.SCOPEKEY
        });
      }
    }

    const covUpdates = [];
    for (const row of this.cov) {
      const key = covRowKey(row);
      if (!Object.prototype.hasOwnProperty.call(this._covEdits, key)) continue;
      const cov = Number(this._covEdits[key]);
      if (Number.isFinite(cov) && cov !== Number(row.COV)) {
        covUpdates.push({ clasa: row.CLASA, cov, marime: row.MARIME });
      }
    }

    const branchUpdates = [];
    for (const row of this.branches) {
      const key = String(row.BRANCH);
      const edit = this._branchEdits[key];
      if (!edit) continue;
      const draft = this._branchDraft(row);
      if (draft.marime !== row.MARIME || draft.inclus !== Boolean(row.INCLUS) || draft.estePodea !== Boolean(row.ESTE_PODEA)) {
        branchUpdates.push({ branch: row.BRANCH, estePodea: draft.estePodea, inclus: draft.inclus, marime: draft.marime });
      }
    }

    if (!paramsUpdates.length && !covUpdates.length && !branchUpdates.length) return;

    this._store.saveParams({ branchUpdates, covUpdates, paramsUpdates });
  }

  // --- Render helpers ---
  _renderParamsSection () {
    return html`
      <div class="table-responsive mb-4">
        <table class="table table-sm table-hover align-middle mb-0">
          <thead>
            <tr>
              <th>Cheie</th>
              <th>Scope</th>
              <th>Scope key</th>
              <th>Descriere</th>
              <th style="width: 160px;">Valoare</th>
            </tr>
          </thead>
          <tbody>
            ${this.params.length === 0
              ? html`<tr><td colspan="5" class="text-center text-muted py-3">Niciun parametru.</td></tr>`
              : ''}
            ${this.params.map((row) => {
              const key = paramRowKey(row);
              const value = Object.prototype.hasOwnProperty.call(this._paramEdits, key) ? this._paramEdits[key] : row.PARAMVALUE;
              const dirty = Object.prototype.hasOwnProperty.call(this._paramEdits, key) && value !== row.PARAMVALUE;
              return html`
                <tr class="${dirty ? 'table-warning' : ''}">
                  <td>${row.PARAMKEY}</td>
                  <td>${row.SCOPE}</td>
                  <td>${row.SCOPEKEY || '-'}</td>
                  <td class="small text-muted">${row.DESCRIERE || ''}</td>
                  <td>
                    <input type="text" class="form-control form-control-sm" .value="${value}"
                           @change="${(e) => this._setParamValue(row, e.target.value)}">
                  </td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
    `;
  }

  _renderCovSection () {
    const byKey = new Map(this.cov.map((row) => [covRowKey(row), row]));
    return html`
      <div class="table-responsive mb-4">
        <table class="table table-sm table-hover align-middle mb-0">
          <thead>
            <tr>
              <th>Clasa</th>
              ${MARIME_ORDER.map((m) => html`<th>${m}</th>`)}
            </tr>
          </thead>
          <tbody>
            ${CLASA_ORDER.map((clasa) => html`
              <tr>
                <td>${clasa}</td>
                ${MARIME_ORDER.map((marime) => {
                  const row = byKey.get(`${clasa}|${marime}`);
                  if (!row) return html`<td class="text-muted">-</td>`;
                  const key = covRowKey(row);
                  const value = Object.prototype.hasOwnProperty.call(this._covEdits, key) ? this._covEdits[key] : row.COV;
                  const dirty = Object.prototype.hasOwnProperty.call(this._covEdits, key) && Number(value) !== Number(row.COV);
                  return html`
                    <td class="${dirty ? 'table-warning' : ''}">
                      <input type="number" step="0.01" class="form-control form-control-sm" style="width: 90px;" .value="${value}"
                             @change="${(e) => this._setCovValue(row, e.target.value)}">
                    </td>
                  `;
                })}
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  }

  _renderBranchesSection () {
    return html`
      <div class="table-responsive">
        <table class="table table-sm table-hover align-middle mb-0">
          <thead>
            <tr>
              <th>Filiala</th>
              <th>Marime</th>
              <th>Inclus</th>
              <th>HQ</th>
              <th>Podea</th>
            </tr>
          </thead>
          <tbody>
            ${this.branches.length === 0
              ? html`<tr><td colspan="5" class="text-center text-muted py-3">Nicio filiala.</td></tr>`
              : ''}
            ${this.branches.map((row) => {
              const draft = this._branchDraft(row);
              const dirty = Boolean(this._branchEdits[String(row.BRANCH)]);
              return html`
                <tr class="${dirty ? 'table-warning' : ''}">
                  <td>${row.BRANCH}</td>
                  <td>
                    <select class="form-select form-select-sm" style="width: 110px;"
                            .value="${draft.marime}"
                            @change="${(e) => this._setBranchField(row, 'marime', e.target.value)}">
                      ${MARIME_ORDER.map((m) => html`<option value="${m}">${m}</option>`)}
                    </select>
                  </td>
                  <td>
                    <input type="checkbox" class="form-check-input" .checked="${draft.inclus}"
                           @change="${(e) => this._setBranchField(row, 'inclus', e.target.checked)}">
                  </td>
                  <td>${row.ESTE_HQ ? html`<span class="badge bg-info text-dark">HQ</span>` : html`<span class="text-muted">-</span>`}</td>
                  <td>
                    <input type="checkbox" class="form-check-input" .checked="${draft.estePodea}"
                           @change="${(e) => this._setBranchField(row, 'estePodea', e.target.checked)}">
                  </td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
    `;
  }

  render () {
    const dirtyCount = this._dirtyCount;

    return html`
      <div class="minmax-params-panel card mb-3">
        <div class="card-header d-flex align-items-center justify-content-between">
          <span><i class="fas fa-sliders-h me-2"></i>Parametri MIN/MAX</span>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" ?disabled="${this.saving || !dirtyCount}" @click="${this._cancel}">
              <i class="fas fa-undo me-1"></i>Anuleaza
            </button>
            <button class="btn btn-sm btn-primary" ?disabled="${this.saving || !dirtyCount || !this.writesEnabled}" @click="${this._save}">
              <i class="fas fa-save me-1"></i>Salveaza${dirtyCount ? ` (${dirtyCount})` : ''}
            </button>
          </div>
        </div>
        <div class="card-body">
          ${!this.writesEnabled ? html`<div class="alert alert-warning py-2"><i class="fas fa-lock me-2"></i>Panou read-only: scrierea parametrilor este dezactivata pe server.</div>` : ''}
          ${this.saveError ? html`<div class="alert alert-danger py-2">${this.saveError}</div>` : ''}

          ${this.loading
            ? html`<div class="text-muted py-3"><i class="fas fa-spinner fa-spin"></i> Se incarca parametrii...</div>`
            : html`
              <h6 class="text-muted">Parametri globali</h6>
              ${this._renderParamsSection()}

              <h6 class="text-muted">Matricea COV_TGT (clasa x marime filiala)</h6>
              ${this._renderCovSection()}

              <h6 class="text-muted">Configurare filiale</h6>
              ${this._renderBranchesSection()}
            `}
        </div>
      </div>
    `;
  }
}

customElements.define('minmax-params-panel', MinmaxParamsPanel);
