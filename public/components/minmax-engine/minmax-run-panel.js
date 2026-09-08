/**
 * MIN/MAX Run Panel (Faza 6 — sesiuni si lansare)
 *
 * Session selection, history and guarded launch of the next FULL session.
 *
 * @element minmax-run-panel
 */

import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { ContextConsumer } from 'https://cdn.jsdelivr.net/npm/@lit/context@1.1.0/index.js';
import { MinmaxEngineStoreContext } from '../../stores/minmax-engine-store.js';
import { getAppTokenRoles } from '../../stores/app-auth.js';

const STATUS_BADGE_CLASS = {
  DONE: 'bg-success',
  ERROR: 'bg-danger',
  OPEN: 'bg-warning'
};

// Anexa §B7: only OPEN/ERROR render as coloured badges; DONE is plain muted
// text so the three green "DONE" badges per row stop diluting the signal.
const QUIET_STATUSES = new Set(['DONE']);

export class MinmaxRunPanel extends LitElement {
  static get properties () {
    return {
      historyError: { type: String },
      canEdit: { type: Boolean },
      loading: { type: Boolean },
      loadingHistory: { type: Boolean },
      runLaunch: { type: Object },
      resolvedRunId: { type: Number },
      runHistory: { type: Array },
      runId: { type: Number },
      writesEnabled: { type: Boolean }
    };
  }

  constructor () {
    super();

    this.historyError = '';
    this.canEdit = false;
    this.loading = false;
    this.loadingHistory = false;
    this.runLaunch = { error: '', polling: false, runId: null, starting: false };
    this.resolvedRunId = null;
    this.runHistory = [];
    this.runId = null;
    this.writesEnabled = false;

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
    this.runLaunch = state.runLaunch;
    this.writesEnabled = Boolean(state.params && state.params.writesEnabled);
    this.canEdit = getAppTokenRoles().includes('minmax.edit');
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

  _isReadableRun (run) {
    return run && run.SESSION_STATUS === 'DONE' && run.COMPUTE_STATUS === 'DONE';
  }

  _refreshHistory () {
    if (this._store) this._store.loadHistory();
  }

  _startRun () {
    if (!this._store) return;
    if (!window.confirm('Pornesti o sesiune MIN/MAX noua pentru toate filialele?')) return;
    this._store.runEngine();
  }

  _abandonRun (runId) {
    if (!this._store) return;
    if (!window.confirm(`Abandonezi sesiunea RUNID ${runId}?`)) return;
    this._store.abandonRun(runId);
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
    if (QUIET_STATUSES.has(status)) {
      return html`<span class="text-muted small">${status}</span>`;
    }
    const cls = STATUS_BADGE_CLASS[status] || 'bg-secondary';
    return html`<span class="badge ${cls}">${status}</span>`;
  }

  render () {
    const isCurrentSelected = this.runId === null;
    const openRun = this.runHistory.find((run) => run.SESSION_STATUS === 'OPEN');
    const runDisabled = !this.writesEnabled || !this.canEdit || Boolean(openRun) || this.runLaunch.starting || this.runLaunch.polling;

    return html`
      <div class="minmax-run-panel card mb-3">
        <div class="card-header d-flex align-items-center justify-content-between">
          <span><i class="fas fa-history me-2"></i>Sesiuni MIN/MAX</span>
          <div class="d-flex gap-2">
            <button
              class="btn btn-sm btn-primary"
              title="Porneste o sesiune MIN/MAX noua"
              ?disabled="${runDisabled}"
              @click="${this._startRun}"
            >
              <i class="fas ${this.runLaunch.starting || this.runLaunch.polling ? 'fa-spinner fa-spin' : 'fa-play'}"></i>
              ${this.runLaunch.starting ? 'Pornire...' : (this.runLaunch.polling ? `RUNID ${this.runLaunch.runId} in curs` : 'Ruleaza')}
            </button>
            ${openRun && this.writesEnabled && this.canEdit
              ? html`<button
                  class="btn btn-sm btn-outline-danger"
                  title="Abandoneaza sesiunea blocata"
                  ?disabled="${this.runLaunch.starting || this.runLaunch.polling}"
                  @click="${() => this._abandonRun(openRun.RUNID)}"
                ><i class="fas fa-ban"></i> Abandoneaza RUNID ${openRun.RUNID}</button>`
              : ''}
            <button
              class="btn btn-sm btn-outline-secondary"
              title="Reincarca istoricul"
              ?disabled="${this.loadingHistory}"
              @click="${this._refreshHistory}"
            >
              <i class="fas fa-sync-alt ${this.loadingHistory ? 'fa-spin' : ''}"></i>
            </button>
          </div>
        </div>
        <div class="card-body">
          ${this.runLaunch.error
            ? html`<div class="alert alert-danger py-2 mb-2">${this.runLaunch.error}</div>`
            : ''}
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

          <!-- Anexa §B6: the full history table collapses; the summary line keeps
               the current session visible without permanent vertical cost. -->
          <details>
            <summary class="small text-muted" style="cursor:pointer;">
              Istoric sesiuni (${this.runHistory.length})${this.resolvedRunId !== null
                ? ` — curenta: RUNID ${this.resolvedRunId}`
                : ''}
            </summary>
            <div class="table-responsive mt-2">
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
                    style="cursor: ${this._isReadableRun(run) ? 'pointer' : 'default'};"
                    @click="${() => this._isReadableRun(run) && this._selectRun(run.RUNID)}"
                  >
                    <td>
                      <input
                        type="radio"
                        name="minmax-run-selection"
                        ?checked="${this.runId === run.RUNID}"
                        ?disabled="${this.loading || !this._isReadableRun(run)}"
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
          </details>
        </div>
      </div>
    `;
  }
}

customElements.define('minmax-run-panel', MinmaxRunPanel);
