import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { ContextConsumer } from 'https://cdn.jsdelivr.net/npm/@lit/context@1.1.0/index.js';
import { ReplenishmentStoreContext } from '../stores/replenishment-store.js';

export class QuickPanel extends LitElement {
  static get properties() {
    return {
      // UI state
      expanded: { type: Boolean, state: true }, // Track if floating panel is expanded
      disabled: { type: Boolean, state: true }, // Disable if no data
      
      // Store-driven properties (no longer state: true)
      selectedReplenishmentStrategy: { type: String },
      isSuccessiveStrategy: { type: Boolean },
      loading: { type: Boolean },
      queryPanelVisible: { type: Boolean }
    };
  }

  constructor() {
    super();
    
    // Initialize UI state
    this.expanded = false; // Start collapsed
    this.disabled = false;
    
    // Initialize store-driven properties (will be updated by store)
    this.selectedReplenishmentStrategy = 'none';
    this.isSuccessiveStrategy = true;
    this.loading = false;
    this.queryPanelVisible = true;
    
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
        console.log('🎯 QuickPanel received store update:', action.type);
        this._syncStateFromStore(newState);
      });
      
      // Initial sync
      this._syncStateFromStore(this._store.getState());
    }
  }

  _syncStateFromStore(state) {
    this.selectedReplenishmentStrategy = state.selectedReplenishmentStrategy;
    this.isSuccessiveStrategy = state.isSuccessiveStrategy;
    this.loading = state.loading;
    this.queryPanelVisible = state.queryPanelVisible;
    this.disabled = !state.data || state.data.length === 0;
  }

  createRenderRoot() { return this; } // Render in light DOM

  _dispatchUpdate(property, value) {
    console.log(`QuickPanel updating ${property}:`, value);
    
    // Update store directly instead of emitting events
    if (this._store) {
      if (property === 'selectedReplenishmentStrategy') {
        this._store.setReplenishmentStrategy(value);
      } else if (property === 'isSuccessiveStrategy') {
        this._store.setSuccessiveStrategy(value);
      }
    } else {
      console.warn('Store not available yet for QuickPanel');
    }
  }

  _emitAction(actionName) {
    console.log(`QuickPanel emitting action: ${actionName}`);
    
    // Handle actions that should go through the store
    if (actionName === 'apply-strategy') {
      // Apply strategy is handled by the container's _handleApplyStrategy method
      // We still need to emit the event for the container to handle
      this.dispatchEvent(new CustomEvent(actionName, { bubbles: true, composed: true }));
    } else if (actionName === 'toggle-query-panel') {
      // Update query panel visibility through store
      if (this._store) {
        this._store.setQueryPanelVisible(!this.queryPanelVisible);
      }
    } else {
      this.dispatchEvent(new CustomEvent(actionName, { bubbles: true, composed: true }));
    }
  }

  togglePanel() {
    this.expanded = !this.expanded;
  }
  
  toggleQueryPanel() {
    this._emitAction('toggle-query-panel');
  }

  render() {
    const isStrategySelected = this.selectedReplenishmentStrategy !== 'none';

    return html`
      <div class="floating-quick-panel ${this.expanded ? 'expanded' : 'collapsed'} ${this.disabled ? 'disabled-panel' : ''}">
        <!-- Floating tab toggle button -->
        <div class="floating-tab" @click=${this.togglePanel} title="${this.expanded ? 'Collapse panel' : 'Expand quick panel'}">
          <i class="bi ${this.expanded ? 'bi-chevron-right' : 'bi-sliders'}"></i>
        </div>
        
        <!-- Panel content -->
        <div class="panel-content">
          <div class="panel-header d-flex justify-content-between align-items-center mb-3">
            <h6 class="mb-0">Quick Panel</h6>
            <button class="btn btn-sm btn-outline-secondary" @click=${this.togglePanel} title="Close panel">
              <i class="bi bi-x"></i>
            </button>
          </div>
          
          <!-- Toggle Query Panel Button -->
          <div class="mb-3">
            <button class="btn btn-sm ${this.queryPanelVisible ? 'btn-outline-secondary' : 'btn-outline-primary'} w-100" 
                    @click=${this.toggleQueryPanel}>
              <i class="bi ${this.queryPanelVisible ? 'bi-chevron-up' : 'bi-chevron-down'}"></i>
              ${this.queryPanelVisible ? 'Hide Query Panel' : 'Show Query Panel'}
            </button>
          </div>
          
          <div class="mb-3">
            <label class="form-label mb-1 fw-bold">Auto Replenish:</label>
            <select class="form-select form-select-sm strategy-select mb-2"
                    .value=${this.selectedReplenishmentStrategy}
                    @change=${e => this._dispatchUpdate('selectedReplenishmentStrategy', e.target.value)}
                    ?disabled=${this.loading || this.disabled}>
              <option value="none">Select Strategy...</option>
              <option value="min">Apply Min Quantities</option>
              <option value="max">Apply Max Quantities</option>
              <option value="skip_blacklisted">Skip Blacklisted (Sets Tx=0)</option>
              <option value="apply_zero">Apply 0 Quantities</option>
            </select>
            
            <button class="btn btn-sm btn-primary apply-button w-100 mb-3"
                    @click=${() => { 
                      this._emitAction('apply-strategy');
                      // Auto-collapse panel after applying strategy
                      if (isStrategySelected) setTimeout(() => this.expanded = false, 500);
                    }}
                    ?disabled=${this.loading || this.disabled || !isStrategySelected}>
              Apply Strategy
            </button>

            <button class="btn btn-sm btn-outline-danger w-100 mb-3"
                    title="Clear all transfer quantities"
                    @click=${() => this._emitAction('clear-transfers')}
                    ?disabled=${this.loading || this.disabled}>
              Clear All Transfers
            </button>
          </div>
          
          <div class="form-check form-switch successive-switch" data-bs-toggle="tooltip" data-bs-placement="left"
               title="When enabled, strategies are applied only to items currently filtered with zero transfers, allowing successive strategy application. If disabled, applies to all filtered items regardless of current transfer value.">
            <input class="form-check-input" type="checkbox" id="successiveStrategy"
                   .checked=${this.isSuccessiveStrategy}
                   @change=${e => this._dispatchUpdate('isSuccessiveStrategy', e.target.checked)}
                   ?disabled=${this.loading || this.disabled}>
            <label class="form-check-label" for="successiveStrategy">Apply to Zeros Only</label>
          </div>
        </div>
      </div>
    `;
  }
  
  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up store subscription
    if (this._unsubscribeFromStore) {
      this._unsubscribeFromStore();
    }
  }
}
customElements.define('quick-panel', QuickPanel);
