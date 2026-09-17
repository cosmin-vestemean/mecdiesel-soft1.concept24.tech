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
  OPEN: 'bg-warning',
  RUNNING: 'bg-primary'
};

// Anexa §B7: only OPEN/ERROR render as coloured badges; DONE is plain muted
// text so the three green "DONE" badges per row stop diluting the signal.
const QUIET_STATUSES = new Set(['DONE']);
const BRANCH_ASSIGNMENT_MODES = new Set(['DOC', 'AGENT', 'CLIENT']);
const CALIBRARE_MODES = new Set(['A', 'B', 'C']);

export class MinmaxRunPanel extends LitElement {
  static get properties () {
    return {
      historyError: { type: String },
      branchAssignmentMode: { type: String },
      calibrareMod: { type: String },
      canEdit: { type: Boolean },
      loading: { type: Boolean },
      loadingHistory: { type: Boolean },
      purgeSelectorRows: { type: Array },
      purgeSelectorLoading: { type: Boolean },
      purgeSelectorError: { type: String },
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
    this.branchAssignmentMode = 'AGENT';
    this.calibrareMod = 'C';
    this.canEdit = false;
    this.loading = false;
    this.loadingHistory = false;
    this.purgeSelectorRows = [];
    this.purgeSelectorLoading = false;
    this.purgeSelectorError = '';
    this.runLaunch = { error: '', polling: false, runId: null, starting: false };
    this.resolvedRunId = null;
    this.runHistory = [];
    this.runId = null;
    this.writesEnabled = false;
    this._branchAssignmentModeTouched = false;
    this._calibrareModTouched = false;

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
    this.purgeSelectorRows = (state.purgeSelector && state.purgeSelector.rows) || [];
    this.purgeSelectorLoading = Boolean(state.purgeSelector && state.purgeSelector.loading);
    this.purgeSelectorError = (state.purgeSelector && state.purgeSelector.error) || '';
    this.writesEnabled = Boolean(state.params && state.params.writesEnabled);
    this.canEdit = getAppTokenRoles().includes('minmax.edit');

    if (!this._branchAssignmentModeTouched) {
      const configuredMode = (state.params && state.params.params || []).find((param) =>
        param.PARAMKEY === 'MOD_ATRIBUIRE_FILIALA' && param.SCOPE === 'GLOBAL' && !param.SCOPEKEY
      );
      const normalizedMode = configuredMode && String(configuredMode.PARAMVALUE).trim().toUpperCase();
      if (BRANCH_ASSIGNMENT_MODES.has(normalizedMode)) {
        this.branchAssignmentMode = normalizedMode;
      }
    }
    if (!this._calibrareModTouched) {
      const configuredMode = (state.params && state.params.params || []).find((param) =>
        param.PARAMKEY === 'CALIBRARE_MOD' && param.SCOPE === 'GLOBAL' && !param.SCOPEKEY
      );
      const normalizedMode = configuredMode && String(configuredMode.PARAMVALUE).trim().toUpperCase();
      if (CALIBRARE_MODES.has(normalizedMode)) {
        this.calibrareMod = normalizedMode;
      }
    }
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
    if (!this._store) return;
    this._store.loadHistory();
    // Same manual trigger also re-reads the read-only retention selector
    // (P17) so a PINNED/PURGED label never lags the history refresh.
    this._store.loadPurgeSelector();
  }

  _startRun () {
    if (!this._store) return;
    if (!window.confirm(`Pornesti o sesiune MIN/MAX noua cu atribuirea vanzarilor dupa ${this.branchAssignmentMode} si metrica ${this.calibrareMod}?`)) return;
    this.dispatchEvent(new CustomEvent('run-start', { bubbles: true, composed: true }));
    this._store.runEngine({ branchAssignmentMode: this.branchAssignmentMode, calibrareMod: this.calibrareMod });
  }

  _setBranchAssignmentMode (event) {
    const mode = String(event.target.value || '').trim().toUpperCase();
    if (!BRANCH_ASSIGNMENT_MODES.has(mode)) return;
    this._branchAssignmentModeTouched = true;
    this.branchAssignmentMode = mode;
  }

  _setCalibrareMod (event) {
    const mode = String(event.target.value || '').trim().toUpperCase();
    if (!CALIBRARE_MODES.has(mode)) return;
    this._calibrareModTouched = true;
    this.calibrareMod = mode;
  }

  _notifyRunHoverStart () {
    this.dispatchEvent(new CustomEvent('run-hover-start', { bubbles: true, composed: true }));
  }

  _notifyRunHoverEnd () {
    this.dispatchEvent(new CustomEvent('run-hover-end', { bubbles: true, composed: true }));
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

  _formatDuration (value) {
    if (value === null || value === undefined || value === '') return '-';
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds < 0) return '-';
    const rounded = Math.round(seconds);
    const minutes = Math.floor(rounded / 60);
    const remainder = rounded % 60;
    return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
  }

  _activePhase (run) {
    if (run && run.STATUS === 'ERROR') return 'Eroare clasificare articole';
    if (!run || run.STATUS !== 'DONE') return 'Clasificare articole';
    if (run.GROUP_STATUS === 'ERROR') return 'Eroare clasificare grupe';
    if (run.GROUP_STATUS !== 'DONE') return 'Clasificare grupe';
    if (run.COMPUTE_STATUS === 'ERROR') return 'Eroare calcul MIN/MAX';
    if (run.COMPUTE_STATUS !== 'DONE') return 'Calcul MIN/MAX';
    return 'Finalizare';
  }

  _runError (run) {
    if (!run) return '';
    return run.COMPUTE_ERRORMSG || run.GROUP_ERRORMSG || run.ERRORMSG || '';
  }

  _statusWithDuration (status, duration) {
    return html`
      ${this._statusBadge(status)}
      ${duration === null || duration === undefined
        ? ''
        : html`<span class="d-block text-muted small mt-1">${this._formatDuration(duration)}</span>`}
    `;
  }

  _statusBadge (status) {
    if (!status) return html`<span class="badge bg-secondary">-</span>`;
    if (QUIET_STATUSES.has(status)) {
      return html`<span class="text-muted small">${status}</span>`;
    }
    const cls = STATUS_BADGE_CLASS[status] || 'bg-secondary';
    return html`<span class="badge ${cls}">${status}</span>`;
  }

  // Read-only retention label (P17): only PINNED/PURGED add information the
  // rest of the row doesn't already show (CURENT/OPEN are already badged).
  // PROTECTED/ELIGIBLE stay silent on purpose — there is no purge button
  // here, so surfacing them would just be noise without an action to take.
  _purgeBadge (runId) {
    const row = this.purgeSelectorRows.find((r) => Number(r.runId) === Number(runId));
    if (!row) return '';
    if (row.purgeStatus === 'PINNED') {
      return html`<span class="badge bg-info text-dark ms-1" title="Reper: pastrat manual, exclus din retentia automata (ESTE_REPER)">REPER</span>`;
    }
    if (row.purgeStatus === 'PURGED') {
      return html`<span class="text-muted small ms-1" title="Detaliile (CCCMINMAXDET/WEEK/WINSOR) au fost eliberate de politica de retentie">date eliberate</span>`;
    }
    return '';
  }

  render () {
    const isCurrentSelected = this.runId === null;
    const openRun = this.runHistory.find((run) => run.SESSION_STATUS === 'OPEN');
    const openRunError = this._runError(openRun);
    const runDisabled = !this.writesEnabled || !this.canEdit || Boolean(openRun) || this.runLaunch.starting || this.runLaunch.polling;

    return html`
      <div class="minmax-run-panel card mb-3">
        <div class="card-header d-flex align-items-center justify-content-between">
          <span><i class="fas fa-history me-2"></i>Sesiuni MIN/MAX</span>
          <div class="d-flex gap-2">
            <label class="d-flex align-items-center gap-2 mb-0 small" for="minmax-branch-assignment-mode">
              Atribuire vanzari
              <select
                id="minmax-branch-assignment-mode"
                class="form-select form-select-sm"
                style="width:auto;"
                title="Filiala folosita pentru atribuirea vanzarilor. CLIENT: filiala din TRDBRANCH a clientului (fallback filiala documentului); DOC: filiala documentului de vanzare; AGENT: filiala agentului de vanzare. Alegerea muta liniile intre filiale si schimba VZ, ABC, sigma si MIN/MAX."
                .value="${this.branchAssignmentMode}"
                ?disabled="${Boolean(openRun) || this.runLaunch.starting || this.runLaunch.polling}"
                @change="${this._setBranchAssignmentMode}"
              >
                <option value="CLIENT" title="Atribuie vanzarea filialei din TRDBRANCH a clientului; daca lipseste, foloseste filiala documentului.">Client (TRDBRANCH)</option>
                <option value="DOC" title="Atribuie vanzarea filialei documentului de vanzare (FINDOC.BRANCH).">Document (FINDOC)</option>
                <option value="AGENT" title="Atribuie vanzarea filialei agentului de vanzare (PRSN.BRANCH), ca in jobul legacy. Implicit.">Agent (PRSN)</option>
              </select>
            </label>
            <label class="d-flex align-items-center gap-2 mb-0 small" for="minmax-calibrare-mod">
              Calibrare
              <select
                id="minmax-calibrare-mod"
                class="form-select form-select-sm"
                style="width:auto;"
                title="Metrica de calibrare evidentiata pentru sesiune. Alegerea schimba doar metrica raportata ca principala; nu schimba formulele, populatia sau rezultatele MIN/MAX."
                .value="${this.calibrareMod}"
                ?disabled="${Boolean(openRun) || this.runLaunch.starting || this.runLaunch.polling}"
                @change="${this._setCalibrareMod}"
              >
                <option value="A" title="Banda FLAG_RATIO 0.50-2.00 pe populatia curata a validatorului; numara DOWN+OK+UP. Test intern, nu criteriul clientului.">A</option>
                <option value="B" title="FLAG_TXT='OK' (raport 0.77-1.30) pe populatia curata a validatorului; izoleaza efectul benzii de acceptanta.">B</option>
                <option value="C" title="FLAG_TXT='OK' (raport 0.77-1.30) pe toate randurile cu ERP_MAX>0 (MAX manual), fara alte filtre. Criteriul literal S 8 al beneficiarului. Implicit.">C</option>
              </select>
            </label>
            <button
              class="btn btn-sm btn-primary"
              title="Porneste o sesiune MIN/MAX noua"
              ?disabled="${runDisabled}"
              @mouseenter="${this._notifyRunHoverStart}"
              @mouseleave="${this._notifyRunHoverEnd}"
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
          ${openRun
            ? html`<div class="minmax-run-progress alert ${openRunError ? 'alert-danger' : 'alert-primary'} py-2 mb-3 d-flex flex-wrap align-items-center gap-3" role="status">
                <span><i class="fas ${openRunError ? 'fa-exclamation-triangle' : 'fa-spinner fa-spin'} me-1"></i><strong>RUNID ${openRun.RUNID}</strong></span>
                <span>Faza: <strong>${this._activePhase(openRun)}</strong></span>
                <span>Total: ${this._formatDuration(openRun.SESSION_DURATA_SEC)}</span>
                <span>Clasificare: ${this._formatDuration(openRun.CLASSIFY_DURATA_SEC)}</span>
                <span>Grupe: ${this._formatDuration(openRun.GROUP_DURATA_SEC)}</span>
                <span>Compute: ${this._formatDuration(openRun.COMPUTE_DURATA_SEC)}</span>
                ${openRunError ? html`<span class="w-100 small">${openRunError}</span>` : ''}
              </div>`
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
              ${this.purgeSelectorLoading ? html`<i class="fas fa-spinner fa-spin ms-1" title="Se verifica retentia..."></i>` : ''}
            </summary>
            ${this.purgeSelectorError
              ? html`<div class="small text-muted mt-1">Retentie neverificata: ${this.purgeSelectorError}</div>`
              : ''}
            <div class="table-responsive mt-2">
              <table class="table table-sm table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th></th>
                  <th>RUNID</th>
                  <th>Data</th>
                  <th>Scope</th>
                  <th>Sesiune</th>
                  <th>Clasificare</th>
                  <th>Grup</th>
                  <th>Compute</th>
                  <th>Randuri</th>
                  <th>Durata</th>
                  <th>Start clasificare</th>
                  <th>Final procesare</th>
                </tr>
              </thead>
              <tbody>
                ${this.loadingHistory
                  ? html`<tr><td colspan="12" class="text-center text-muted py-3">
                      <i class="fas fa-spinner fa-spin"></i> Se incarca istoricul...
                    </td></tr>`
                  : ''}
                ${!this.loadingHistory && this.runHistory.length === 0
                  ? html`<tr><td colspan="12" class="text-center text-muted py-3">Nicio sesiune gasita.</td></tr>`
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
                      ${this._purgeBadge(run.RUNID)}
                    </td>
                    <td>${this._formatDate(run.AZI)}</td>
                    <td>${run.SCOPE || '-'}</td>
                    <td>${this._statusBadge(run.SESSION_STATUS)}</td>
                    <td>${this._statusWithDuration(run.STATUS, run.CLASSIFY_DURATA_SEC)}</td>
                    <td>${this._statusWithDuration(run.GROUP_STATUS, run.GROUP_DURATA_SEC)}</td>
                    <td>${this._statusWithDuration(run.COMPUTE_STATUS, run.COMPUTE_DURATA_SEC)}</td>
                    <td>${run.NR_RANDURI ?? '-'}</td>
                    <td>${this._formatDuration(run.SESSION_DURATA_SEC ?? run.DURATA_SEC)}</td>
                    <td>${this._formatDate(run.STARTEDAT)}</td>
                    <td>${run.SESSION_STATUS === 'OPEN' ? '-' : this._formatDate(run.FINISHEDAT)}</td>
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
