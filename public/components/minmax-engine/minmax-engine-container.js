/**
 * MIN/MAX Engine Container (Faza 5 — UI de confirmare)
 *
 * Provides the MinmaxEngineStore over Lit context (pattern: see
 * branch-replenishment-container.js) and orchestrates the initial load
 * (run history, params, current-session results). Child view components
 * (results table, run panel, group ABC, explain drawer, params panel —
 * FAZA5_CONTRACT.md §9) consume the store via ContextConsumer and are wired
 * in separately, in the order given in that contract.
 *
 * @element minmax-engine-container
 */

import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { ContextProvider } from 'https://cdn.jsdelivr.net/npm/@lit/context@1.1.0/index.js';
import { minmaxEngineStore, MinmaxEngineStoreContext } from '../stores/minmax-engine-store.js';

export class MinmaxEngineContainer extends LitElement {
  static get properties () {
    return {
      // Synced from store
      error: { type: String },
      loading: { type: Boolean },
      resolvedRunId: { type: Number },
      runId: { type: Number },
      total: { type: Number }
    };
  }

  constructor () {
    super();

    this._storeProvider = new ContextProvider(this, {
      context: MinmaxEngineStoreContext,
      initialValue: minmaxEngineStore
    });

    this._unsubscribeFromStore = minmaxEngineStore.subscribe((newState) => {
      this._syncStateFromStore(newState);
    });

    this._syncStateFromStore(minmaxEngineStore.getState());
  }

  // Render in light DOM (Bootstrap compatibility, same as sibling components)
  createRenderRoot () {
    return this;
  }

  connectedCallback () {
    super.connectedCallback();
    this._loadInitialData();
  }

  disconnectedCallback () {
    super.disconnectedCallback();
    if (this._unsubscribeFromStore) {
      this._unsubscribeFromStore();
    }
  }

  // --- Store Integration ---
  _syncStateFromStore (state) {
    this.loading = state.loading;
    this.error = state.error;
    this.runId = state.runId;
    this.resolvedRunId = state.resolvedRunId;
    this.total = state.total;
  }

  async _loadInitialData () {
    // History/params don't depend on each other or on results; run in parallel.
    await Promise.all([
      minmaxEngineStore.loadHistory(),
      minmaxEngineStore.loadParams(),
      minmaxEngineStore.loadResults()
    ]);
  }

  render () {
    return html`
      <div class="minmax-engine-container">
        ${this.error
          ? html`<div class="alert alert-danger" role="alert">${this.error}</div>`
          : ''}

        ${this.loading
          ? html`<div class="text-muted"><i class="fas fa-spinner fa-spin"></i> Se incarca datele MIN/MAX...</div>`
          : ''}

        <!--
          FAZA5_CONTRACT.md §9 components, wired in once built:
          <minmax-run-panel></minmax-run-panel>
          <minmax-results-table></minmax-results-table>
          <minmax-group-abc></minmax-group-abc>
          <minmax-explain-drawer></minmax-explain-drawer>
          <minmax-params-panel></minmax-params-panel>
        -->
        ${!this.loading && !this.error
          ? html`<div class="text-muted">Sesiune curenta: RUNID ${this.resolvedRunId ?? '—'} · ${this.total ?? 0} randuri.</div>`
          : ''}
      </div>
    `;
  }
}

customElements.define('minmax-engine-container', MinmaxEngineContainer);
