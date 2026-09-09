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
      _paramEdits: { state: true, type: Object },
      _activeTab: { state: true, type: String }
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
    this._activeTab = 'params';

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

  _selectTab (tab) {
    this._activeTab = tab;
  }

  // --- Render helpers ---
  _renderParamsSection () {
    return html`
      <div class="table-responsive">
        <table class="table table-sm table-hover align-middle mb-0 minmax-params-table">
          <thead>
            <tr>
              <th>Cheie</th>
              <th style="width: 140px;">Valoare</th>
              <th>Descriere</th>
              <th>Scope</th>
              <th>Scope key</th>
            </tr>
          </thead>
          <tbody>
            ${this.params.length === 0
              ? html`<tr><td colspan="5" class="text-center text-muted py-2">Niciun parametru.</td></tr>`
              : ''}
            ${this.params.map((row) => {
              const key = paramRowKey(row);
              const value = Object.prototype.hasOwnProperty.call(this._paramEdits, key) ? this._paramEdits[key] : row.PARAMVALUE;
              const dirty = Object.prototype.hasOwnProperty.call(this._paramEdits, key) && value !== row.PARAMVALUE;
              return html`
                <tr class="${dirty ? 'table-warning' : ''}">
                  <td>${row.PARAMKEY}</td>
                  <td class="minmax-value">
                    <input type="text" class="form-control form-control-sm minmax-value" .value="${value}"
                           @change="${(e) => this._setParamValue(row, e.target.value)}">
                  </td>
                  <td class="text-muted">${row.DESCRIERE || ''}</td>
                  <td>${row.SCOPE}</td>
                  <td>${row.SCOPEKEY || '-'}</td>
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
      <div class="table-responsive">
        <table class="table table-sm table-hover align-middle mb-0 minmax-params-table">
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
                      <input type="number" step="0.01" class="form-control form-control-sm" style="width: 76px;" .value="${value}"
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
        <table class="table table-sm table-hover align-middle mb-0 minmax-params-table">
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
              ? html`<tr><td colspan="5" class="text-center text-muted py-2">Nicio filiala.</td></tr>`
              : ''}
            ${this.branches.map((row) => {
              const draft = this._branchDraft(row);
              const dirty = Boolean(this._branchEdits[String(row.BRANCH)]);
              return html`
                <tr class="${dirty ? 'table-warning' : ''}">
                  <td>${row.BRANCH}</td>
                  <td>
                    <select class="form-select form-select-sm" style="width: 96px;" aria-label="Marime filiala"
                            @change="${(e) => this._setBranchField(row, 'marime', e.target.value)}">
                      ${MARIME_ORDER.map((m) => html`<option value="${m}" .selected="${m === draft.marime}">${m}</option>`)}
                    </select>
                  </td>
                  <td>
                    <input type="checkbox" class="form-check-input" .checked="${draft.inclus}"
                           @change="${(e) => this._setBranchField(row, 'inclus', e.target.checked)}">
                  </td>
                  <td>${row.ESTE_HQ ? html`<span class="badge bg-primary">HQ</span>` : html`<span class="text-muted">-</span>`}</td>
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
      <style>
        .minmax-params-panel .card-header {
          padding: 0.25rem 0.5rem;
          font-size: 0.8125rem;
        }

        .minmax-params-panel .card-body {
          padding: 0.5rem;
        }

        .minmax-params-panel .nav-tabs {
          margin-bottom: 0.25rem;
        }

        .minmax-params-panel .nav-link {
          padding: 0.1rem 0.4rem;
          font-size: 0.75rem;
        }

        .minmax-params-panel .btn-sm {
          padding: 0.1rem 0.4rem;
          font-size: 0.75rem;
        }

        .minmax-params-panel .alert {
          margin-bottom: 0.25rem;
          padding: 0.2rem 0.4rem;
          font-size: 0.75rem;
        }

        .minmax-params-table {
          font-size: 0.78rem;
        }

        .minmax-params-table th,
        .minmax-params-table td {
          padding: 0.1rem 0.4rem;
          vertical-align: middle;
          white-space: nowrap;
        }

        .minmax-params-table thead th {
          padding: 0.2rem 0.4rem;
          font-size: 0.72rem;
        }

        .minmax-params-table td:nth-child(3) {
          white-space: normal;
        }

        .minmax-params-table .minmax-value {
          color: var(--accent-primary);
        }

        /* Inputs render as plain text (same row height as the results table).
           No border/background change on hover — a hover state that alters the
           input's box makes the row look taller and, at scrollbar boundaries,
           triggers a hover/normal flicker loop. Editability is signalled only
           by a subtle underline on focus, which never changes the box size. */
        .minmax-params-table .form-control,
        .minmax-params-table .form-select {
          height: 1.35rem;
          min-height: 0;
          padding: 0 0.25rem;
          font-size: 0.78rem;
          line-height: 1.2;
          background-color: transparent;
          border: 1px solid transparent;
          box-shadow: none;
        }

        .minmax-params-table .form-control:focus,
        .minmax-params-table .form-select:focus {
          background-color: transparent;
          border-color: transparent;
          border-bottom-color: var(--bs-primary);
          border-radius: 0;
          box-shadow: none;
          outline: none;
        }

        .minmax-params-table .form-check-input {
          width: 0.85rem;
          height: 0.85rem;
          margin-top: 0;
        }

        .minmax-params-table .badge {
          padding: 0.15em 0.4em;
          font-size: 0.68rem;
        }
      </style>
      <div class="minmax-params-panel card mb-2">
        <div class="card-header d-flex align-items-center justify-content-between">
          <span><i class="fas fa-sliders-h me-2"></i>Parametri MIN/MAX</span>
          <div class="d-flex gap-1">
            <button class="btn btn-sm btn-outline-secondary" ?disabled="${this.saving || !dirtyCount}" @click="${this._cancel}">
              <i class="fas fa-undo me-1"></i>Anuleaza
            </button>
            <button class="btn btn-sm btn-primary" ?disabled="${this.saving || !dirtyCount || !this.writesEnabled}" @click="${this._save}">
              <i class="fas fa-save me-1"></i>Salveaza${dirtyCount ? ` (${dirtyCount})` : ''}
            </button>
          </div>
        </div>
        <div class="card-body">
          ${!this.writesEnabled ? html`<div class="alert alert-warning"><i class="fas fa-lock me-2"></i>Panou read-only: scrierea parametrilor este dezactivata pe server.</div>` : ''}
          ${this.saveError ? html`<div class="alert alert-danger">${this.saveError}</div>` : ''}

          ${this.loading
            ? html`<div class="text-muted py-1"><i class="fas fa-spinner fa-spin"></i> Se incarca parametrii...</div>`
            : html`
              <ul class="nav nav-tabs" role="tablist" aria-label="Configurare MIN/MAX">
                ${[
                  ['params', 'fa-sliders-h', 'Parametri globali'],
                  ['cov', 'fa-th', 'Matricea COV_TGT'],
                  ['branches', 'fa-code-branch', 'Configurare filiale']
                ].map(([tab, icon, label]) => html`
                  <li class="nav-item" role="presentation">
                    <button
                      id="minmax-${tab}-tab-button"
                      class="nav-link ${this._activeTab === tab ? 'active' : ''}"
                      type="button"
                      role="tab"
                      aria-selected="${this._activeTab === tab}"
                      aria-controls="minmax-${tab}-tab"
                      @click="${() => this._selectTab(tab)}"
                    >
                      <i class="fas ${icon} me-1"></i>${label}
                    </button>
                  </li>
                `)}
              </ul>

              <div class="tab-content">
                <div id="minmax-params-tab" class="tab-pane fade ${this._activeTab === 'params' ? 'show active' : ''}"
                     role="tabpanel" aria-labelledby="minmax-params-tab-button" ?hidden="${this._activeTab !== 'params'}">
                  ${this._renderParamsSection()}
                </div>
                <div id="minmax-cov-tab" class="tab-pane fade ${this._activeTab === 'cov' ? 'show active' : ''}"
                     role="tabpanel" aria-labelledby="minmax-cov-tab-button" ?hidden="${this._activeTab !== 'cov'}">
                  ${this._renderCovSection()}
                </div>
                <div id="minmax-branches-tab" class="tab-pane fade ${this._activeTab === 'branches' ? 'show active' : ''}"
                     role="tabpanel" aria-labelledby="minmax-branches-tab-button" ?hidden="${this._activeTab !== 'branches'}">
                  ${this._renderBranchesSection()}
                </div>
              </div>
            `}
        </div>
      </div>
    `;
  }
}

customElements.define('minmax-params-panel', MinmaxParamsPanel);
