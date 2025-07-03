import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { ContextConsumer } from 'https://cdn.jsdelivr.net/npm/@lit/context@1.1.0/index.js';
import { ReplenishmentStoreContext } from '../stores/replenishment-store.js';

export class ManipulationPanel extends LitElement {
  static get properties() {
    return {
      // Store-driven properties
      searchTerm: { type: String },
      transferFilter: { type: String },
      totalCount: { type: Number },
      filteredCount: { type: Number },
    };
  }

  constructor() {
    super();
    
    // Initialize properties (will be updated by store)
    this.searchTerm = '';
    this.transferFilter = 'all';
    this.totalCount = 0;
    this.filteredCount = 0;
    
    // Set up store context consumer
    this._storeConsumer = new ContextConsumer(this, {
      context: ReplenishmentStoreContext,
      callback: (store) => {
        this._store = store;
        this._subscribeToStore();
      }
    });
  }

  _subscribeToStore() {
    if (this._store && !this._unsubscribeFromStore) {
      this._unsubscribeFromStore = this._store.subscribe((newState, previousState, action) => {
        console.log('🔍 ManipulationPanel received store update:', action.type);
        this._syncStateFromStore(newState);
      });
      
      // Initial sync
      this._syncStateFromStore(this._store.getState());
    }
  }

  _syncStateFromStore(state) {
    this.searchTerm = state.searchTerm;
    this.transferFilter = state.transferFilter;
    this.totalCount = state.data.length;
    this.filteredCount = this._store.getFilteredData().length;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up store subscription
    if (this._unsubscribeFromStore) {
      this._unsubscribeFromStore();
    }
  }

  createRenderRoot() { return this; } // Render in light DOM

  _dispatchUpdate(property, value) {
    console.log(`ManipulationPanel updating ${property}:`, value);
    
    // Update store directly instead of emitting events
    if (this._store) {
      if (property === 'searchTerm') {
        this._store.setSearchTerm(value);
      } else if (property === 'transferFilter') {
        this._store.setTransferFilter(value);
      }
    } else {
      console.warn('Store not available yet for ManipulationPanel');
    }
  }

  render() {
    return html`
      <div class="d-flex justify-content-between align-items-center mb-3 manipulation-panel">
        <div class="d-flex gap-2 flex-grow-1">
          <div class="input-group input-group-sm search-input-group">
            <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
            <input type="text" class="form-control" placeholder="Search code/description..."
                   .value=${this.searchTerm || ''}
                   @input=${e => this._dispatchUpdate('searchTerm', e.target.value)}>
            ${this.searchTerm ? html`
              <button class="btn btn-outline-secondary btn-clear-search" @click=${() => this._dispatchUpdate('searchTerm', '')} title="Clear search">
                <i class="bi bi-x"></i>
              </button>` : ''}
          </div>
        </div>
        <div class="text-muted small item-count-display ms-3">
          ${this.filteredCount === this.totalCount
            ? html`Showing all <span class="fw-bold">${this.totalCount}</span>`
            : html`Showing <span class="fw-bold">${this.filteredCount}</span> of ${this.totalCount}`
          } items
        </div>
      </div>
    `;
  }
}
customElements.define('manipulation-panel', ManipulationPanel);
