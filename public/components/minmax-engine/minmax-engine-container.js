/**
 * MIN/MAX Engine Container (Faza 5 — UI de confirmare)
 *
 * Provides the MinmaxEngineStore over Lit context (pattern: see
 * branch-replenishment-container.js) and orchestrates the lazy initial load
 * (run history, params, current-session results and group ABC). Child view components
 * (results table, run panel, group ABC, explain drawer, params panel —
 * FAZA5_CONTRACT.md §9) consume the store via ContextConsumer and are all
 * wired in below, in the order given in that contract.
 *
 * @element minmax-engine-container
 */

import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { ContextProvider } from 'https://cdn.jsdelivr.net/npm/@lit/context@1.1.0/index.js';
import { minmaxEngineStore, MinmaxEngineStoreContext } from '../../stores/minmax-engine-store.js';
import './minmax-run-panel.js';
import './minmax-results-table.js';
import './minmax-group-abc.js';
import './minmax-explain-drawer.js';
import './minmax-params-panel.js';

export class MinmaxEngineContainer extends LitElement {
  static get properties () {
    return {
      // Synced from store
      error: { type: String },
      loading: { type: Boolean },
      resolvedRunId: { type: Number },
      runId: { type: Number },
      total: { type: Number },
      activeTab: { type: String }
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

    this._activationPromise = null;
    this.activeTab = 'results';
    this._syncStateFromStore(minmaxEngineStore.getState());
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
  _syncStateFromStore (state) {
    this.loading = state.loading;
    this.error = state.error;
    this.runId = state.runId;
    this.resolvedRunId = state.resolvedRunId;
    this.total = state.total;
  }

  activate () {
    if (!this._activationPromise) {
      this._activationPromise = this._loadInitialData();
    }
    return this._activationPromise;
  }

  async _loadInitialData () {
    await Promise.all([
      minmaxEngineStore.loadHistory(),
      minmaxEngineStore.loadParams(),
      minmaxEngineStore.loadResults({ withTotal: true }),
      minmaxEngineStore.loadGroupAbc({}, { withTotal: true })
    ]);
  }

  _setActiveTab (tab) {
    if (tab === 'results' || tab === 'groups') {
      this.activeTab = tab;
    }
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

        <minmax-run-panel></minmax-run-panel>

        <ul class="nav nav-tabs mb-3" role="tablist" aria-label="Rezultate MIN/MAX">
          <li class="nav-item" role="presentation">
            <button class="nav-link ${this.activeTab === 'results' ? 'active' : ''}"
                    id="minmax-results-tab" type="button" role="tab"
                    aria-controls="minmax-results-panel" aria-selected="${this.activeTab === 'results'}"
                    @click="${() => this._setActiveTab('results')}">
              <i class="fas fa-table me-1"></i>Rezultate MIN/MAX
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link ${this.activeTab === 'groups' ? 'active' : ''}"
                    id="minmax-groups-tab" type="button" role="tab"
                    aria-controls="minmax-groups-panel" aria-selected="${this.activeTab === 'groups'}"
                    @click="${() => this._setActiveTab('groups')}">
              <i class="fas fa-layer-group me-1"></i>Clasificare ABC-XYZ pe grupe
            </button>
          </li>
        </ul>

        <div class="tab-content">
          <div id="minmax-results-panel" class="tab-pane ${this.activeTab === 'results' ? 'show active' : ''}"
               role="tabpanel" aria-labelledby="minmax-results-tab" ?hidden="${this.activeTab !== 'results'}">
            <minmax-results-table></minmax-results-table>
          </div>
          <div id="minmax-groups-panel" class="tab-pane ${this.activeTab === 'groups' ? 'show active' : ''}"
               role="tabpanel" aria-labelledby="minmax-groups-tab" ?hidden="${this.activeTab !== 'groups'}">
            <minmax-group-abc></minmax-group-abc>
          </div>
        </div>

        <minmax-explain-drawer></minmax-explain-drawer>
        <minmax-params-panel></minmax-params-panel>
      </div>
    `;
  }
}

customElements.define('minmax-engine-container', MinmaxEngineContainer);
