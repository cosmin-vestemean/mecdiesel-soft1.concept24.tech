/**
 * MIN/MAX Run Panel (Faza 5 — UI de confirmare)
 *
 * Session selection + history — deliberately NO launch button. FAZA5_CONTRACT.md
 * §3 excludes `runEngine` from iteration 1: sessions are opened/closed manually
 * in S1, this panel only lets the user look at CCCMINMAXRUN and pick which
 * closed FULL session's results to view.
 *
 * @element minmax-run-panel
 */

import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { ContextConsumer } from 'https://cdn.jsdelivr.net/npm/@lit/context@1.1.0/index.js';
import { MinmaxEngineStoreContext } from '../../stores/minmax-engine-store.js';

const STATUS_BADGE_CLASS = {
  DONE: 'bg-success',
  ERROR: 'bg-danger',
  OPEN: 'bg-warning text-dark'
};

export class MinmaxRunPanel extends LitElement {
  static get properties () {
    return {
      historyError: { type: String },
      loading: { type: Boolean },
      loadingHistory: { type: Boolean },
      resolvedRunId: { type: Number },
      runHistory: { type: Array },
      runId: { type: Number }
    };
  }

  constructor () {
    super();

    this.historyError = '';
    this.loading = false;
    this.loadingHistory = false;
    this.resolvedRunId = null;
    this.runHistory = [];
    this.runId = null;

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
    this.runId = state.runId;
    this.resolvedRunId = state.resolvedRunId;
    this.runHistory = state.runHistory;
    this.loadingHistory = state.loadingHistory;
    this.historyError = state.historyError;
    this.loading = state.loading;
  }

  // --- Actions ---
  // No early-return on "already following current": re-clicking is the
  // explicit refresh from §12.6/§12.10 — it must re-resolve ESTE_CURENT even
  // when the selector doesn't change, since the underlying session can drift.
  _selectCurrent () {
    if (!this._store) return;
    this._store.setRunId(null);
    this._store.loadResults({ withTotal: true });
  }

  _selectRun (runId) {
    if (!this._store || this.runId === runId) return;
    this._store.setRunId(runId);
    this._store.loadResults({ withTotal: true });
  }

  _refreshHistory () {
    if (this._store) this._store.loadHistory();
  }

  // --- Rendering Helpers ---
  _formatDate (dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('ro-RO', {
      day: '2-digit', hour: '2-digit', minute: '2-digit', month: '2-digit', year: 'numeric'
    });
  }

  _statusBadge (status) {
    if (!status) return html`<span class="badge bg-secondary">-</span>`;
    const cls = STATUS_BADGE_CLASS[status] || 'bg-secondary';
    return html`<span class="badge ${cls}">${status}</span>`;
  }

  render () {
    const isCurrentSelected = this.runId === null;

    return html`
      <div class="minmax-run-panel card mb-3">
        <div class="card-header d-flex align-items-center justify-content-between">
          <span><i class="fas fa-history me-2"></i>Sesiuni MIN/MAX</span>
          <button
            class="btn btn-sm btn-outline-secondary"
            ?disabled="${this.loadingHistory}"
            @click="${this._refreshHistory}"
          >
            <i class="fas fa-sync-alt ${this.loadingHistory ? 'fa-spin' : ''}"></i> Reincarca
          </button>
        </div>
        <div class="card-body">
          ${this.historyError
            ? html`<div class="alert alert-danger py-2 mb-2">${this.historyError}</div>`
            : ''}

          <div class="form-check mb-2">
            <input
              class="form-check-input"
              type="radio"
              id="minmax-run-current"
              name="minmax-run-selection"
              ?checked="${isCurrentSelected}"
              ?disabled="${this.loading}"
              @change="${this._selectCurrent}"
            />
            <label class="form-check-label" for="minmax-run-current">
              Sesiunea curenta (ESTE_CURENT=1)
              ${isCurrentSelected && this.resolvedRunId !== null
                ? html`<span class="badge bg-primary ms-1">RUNID ${this.resolvedRunId}</span>`
                : ''}
            </label>
          </div>

          <div class="table-responsive">
            <table class="table table-sm table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th></th>
                  <th>RUNID</th>
                  <th>Data</th>
                  <th>Scope</th>
                  <th>Sesiune</th>
                  <th>Compute</th>
                  <th>Grup</th>
                  <th>Randuri</th>
                  <th>Pornit</th>
                  <th>Finalizat</th>
                </tr>
              </thead>
              <tbody>
                ${this.loadingHistory
                  ? html`<tr><td colspan="10" class="text-center text-muted py-3">
                      <i class="fas fa-spinner fa-spin"></i> Se incarca istoricul...
                    </td></tr>`
                  : ''}
                ${!this.loadingHistory && this.runHistory.length === 0
                  ? html`<tr><td colspan="10" class="text-center text-muted py-3">Nicio sesiune gasita.</td></tr>`
                  : ''}
                ${this.runHistory.map((run) => html`
                  <tr
                    class="${this.runId === run.RUNID ? 'table-primary' : ''}"
                    style="cursor: pointer;"
                    @click="${() => this._selectRun(run.RUNID)}"
                  >
                    <td>
                      <input
                        type="radio"
                        name="minmax-run-selection"
                        ?checked="${this.runId === run.RUNID}"
                        ?disabled="${this.loading}"
                        @click="${(e) => e.stopPropagation()}"
                        @change="${() => this._selectRun(run.RUNID)}"
                      />
                    </td>
                    <td>
                      ${run.RUNID}
                      ${run.ESTE_CURENT ? html`<span class="badge bg-primary ms-1">CURENT</span>` : ''}
                    </td>
                    <td>${this._formatDate(run.AZI)}</td>
                    <td>${run.SCOPE || '-'}</td>
                    <td>${this._statusBadge(run.SESSION_STATUS)}</td>
                    <td>${this._statusBadge(run.COMPUTE_STATUS)}</td>
                    <td>${this._statusBadge(run.GROUP_STATUS)}</td>
                    <td>${run.NR_RANDURI ?? '-'}</td>
                    <td>${this._formatDate(run.STARTEDAT)}</td>
                    <td>${this._formatDate(run.FINISHEDAT)}</td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('minmax-run-panel', MinmaxRunPanel);
