import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class QuickPanel extends LitElement {
  static get properties() {
    return {
      selectedReplenishmentStrategy: { type: String, state: true },
      isSuccessiveStrategy: { type: Boolean, state: true },
      loading: { type: Boolean, state: true },
      disabled: { type: Boolean, state: true }, // Disable if no data
      expanded: { type: Boolean, state: true }, // Track if floating panel is expanded
      queryPanelVisible: { type: Boolean } // Whether the query panel is currently visible
    };
  }

  constructor() {
    super();
    this.selectedReplenishmentStrategy = 'none';
    this.isSuccessiveStrategy = true;
    this.loading = false;
    this.disabled = false;
    this.expanded = false; // Start collapsed
    this.queryPanelVisible = true; // Initially visible
  }

  createRenderRoot() { return this; } // Render in light DOM

  _dispatchUpdate(property, value) {
    console.log(`QuickPanel dispatching ${property}:`, value);
    this.dispatchEvent(new CustomEvent('update-property', {
      detail: { property, value },
      bubbles: true, composed: true
    }));
    
    // Also dispatch specific property-changed events like we did for manipulation panel
    if (property === 'selectedReplenishmentStrategy') {
      console.log('Dispatching specific selectedReplenishmentStrategy-changed event:', value);
      this.dispatchEvent(new CustomEvent('selectedReplenishmentStrategy-changed', {
        detail: { value },
        bubbles: true,
        composed: true
      }));
    }
  }

  _emitAction(actionName) {
    console.log(`QuickPanel emitting action: ${actionName}`);
    this.dispatchEvent(new CustomEvent(actionName, { bubbles: true, composed: true }));
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
              <option value="clear">Clear All Transfers (Sets Tx=0)</option>
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
}
customElements.define('quick-panel', QuickPanel);
