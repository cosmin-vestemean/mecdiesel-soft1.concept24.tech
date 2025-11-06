import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { ContextConsumer } from 'https://cdn.jsdelivr.net/npm/@lit/context@1.1.0/index.js';
import { ReplenishmentStoreContext } from '../stores/replenishment-store.js';

export class StrategyBar extends LitElement {
  static get properties() {
    return {
      selectedReplenishmentStrategy: { type: String },
      isSuccessiveStrategy: { type: Boolean },
      loading: { type: Boolean },
      disabled: { type: Boolean }
    };
  }

  constructor() {
    super();
    
    this.disabled = false;
    this.selectedReplenishmentStrategy = 'none';
    this.isSuccessiveStrategy = true;
    this.loading = false;
    
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
    this.disabled = !state.data || state.data.length === 0;
  }

  createRenderRoot() { return this; } // Render in light DOM

  _dispatchUpdate(property, value) {
    if (this._store) {
      if (property === 'selectedReplenishmentStrategy') {
        this._store.setReplenishmentStrategy(value);
      } else if (property === 'isSuccessiveStrategy') {
        this._store.setSuccessiveStrategy(value);
      }
    }
  }

  _emitAction(actionName) {
    this.dispatchEvent(new CustomEvent(actionName, { bubbles: true, composed: true }));
  }

  render() {
    const isStrategySelected = this.selectedReplenishmentStrategy !== 'none';

    return html`
      <div class="d-flex align-items-center gap-2 p-2 bg-light border rounded">
        <label class="mb-0 fw-bold text-nowrap">Auto Replenish:</label>
        
        <select class="form-select form-select-sm" style="width: auto; min-width: 180px;"
                .value=${this.selectedReplenishmentStrategy}
                @change=${e => this._dispatchUpdate('selectedReplenishmentStrategy', e.target.value)}
                ?disabled=${this.loading || this.disabled}>
          <option value="none">Select Strategy...</option>
          <option value="min">Apply Min Quantities</option>
          <option value="max">Apply Max Quantities</option>
          <option value="skip_blacklisted">Skip Blacklisted (Sets Tx=0)</option>
          <option value="apply_zero">Apply 0 Quantities</option>
        </select>
        
        <button class="btn btn-sm btn-primary"
                @click=${() => this._emitAction('apply-strategy')}
                ?disabled=${this.loading || this.disabled || !isStrategySelected}>
          Apply Strategy
        </button>

        <button class="btn btn-sm btn-outline-danger"
                title="Clear all transfer quantities"
                @click=${() => this._emitAction('clear-transfers')}
                ?disabled=${this.loading || this.disabled}>
          Clear All Transfers
        </button>
        
        <div class="form-check form-switch mb-0 ms-2" 
             data-bs-toggle="tooltip" data-bs-placement="bottom"
             title="When enabled, strategies are applied only to items currently filtered with zero transfers, allowing successive strategy application. If disabled, applies to all filtered items regardless of current transfer value.">
          <input class="form-check-input" type="checkbox" id="successiveStrategy"
                 .checked=${this.isSuccessiveStrategy}
                 @change=${e => this._dispatchUpdate('isSuccessiveStrategy', e.target.checked)}
                 ?disabled=${this.loading || this.disabled}>
          <label class="form-check-label text-nowrap" for="successiveStrategy">Apply to Zeros Only</label>
        </div>
      </div>
    `;
  }
  
  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._unsubscribeFromStore) {
      this._unsubscribeFromStore();
    }
  }
}
customElements.define('strategy-bar', StrategyBar);
