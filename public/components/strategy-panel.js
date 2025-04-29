import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import './strategy-panel.css'; // Import CSS

export class StrategyPanel extends LitElement {
  static get properties() {
    return {
      selectedReplenishmentStrategy: { type: String },
      isSuccessiveStrategy: { type: Boolean },
      loading: { type: Boolean },
      disabled: { type: Boolean } // Disable if no data
    };
  }

  createRenderRoot() { return this; } // Render in light DOM

  _dispatchUpdate(property, value) {
    this.dispatchEvent(new CustomEvent('update-property', {
      detail: { property, value },
      bubbles: true, composed: true
    }));
  }

  _emitAction(actionName) {
      this.dispatchEvent(new CustomEvent(actionName, { bubbles: true, composed: true }));
  }

  render() {
    const isStrategySelected = this.selectedReplenishmentStrategy !== 'none';

    return html`
      <div class="card mb-3 bg-light border-light strategy-panel-card ${this.disabled ? 'disabled-panel' : ''}">
        <div class="card-body p-2">
          <div class="row g-2 align-items-center">
            <div class="col-auto">
              <label class="col-form-label-sm fw-bold">Auto Replenish:</label>
            </div>
            <div class="col-auto">
              <select class="form-select form-select-sm strategy-select"
                      .value=${this.selectedReplenishmentStrategy}
                      @change=${e => this._dispatchUpdate('selectedReplenishmentStrategy', e.target.value)}
                      ?disabled=${this.loading || this.disabled}>
                <option value="none">Select Strategy...</option>
                <option value="min">Apply Min Quantities</option>
                <option value="max">Apply Max Quantities</option>
                <option value="skip_blacklisted">Skip Blacklisted (Sets Tx=0)</option>
                <option value="clear">Clear All Transfers (Sets Tx=0)</option>
              </select>
            </div>
            <div class="col-auto">
              <button class="btn btn-sm btn-primary apply-button"
                      @click=${() => this._emitAction('apply-strategy')}
                      ?disabled=${this.loading || this.disabled || !isStrategySelected}>
                Apply
              </button>
            </div>
            <div class="col-auto ms-2">
              <div class="form-check form-switch successive-switch" data-bs-toggle="tooltip" data-bs-placement="top"
                   title="When enabled, strategies are applied only to items currently filtered with zero transfers, allowing successive strategy application. If disabled, applies to all filtered items regardless of current transfer value.">
                <input class="form-check-input" type="checkbox" id="successiveStrategy"
                       .checked=${this.isSuccessiveStrategy}
                       @change=${e => this._dispatchUpdate('isSuccessiveStrategy', e.target.checked)}
                       ?disabled=${this.loading || this.disabled}>
                <label class="form-check-label small" for="successiveStrategy">Apply to Zeros Only</label>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
customElements.define('strategy-panel', StrategyPanel);
