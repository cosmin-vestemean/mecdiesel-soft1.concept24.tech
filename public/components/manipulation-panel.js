import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class ManipulationPanel extends LitElement {
  static get properties() {
    return {
      searchTerm: { type: String, state: true },
      transferFilter: { type: String, state: true },
      totalCount: { type: Number, state: true },
      filteredCount: { type: Number, state: true },
    };
  }

  constructor() {
    super();
    this.searchTerm = '';
    this.transferFilter = 'all';
    this.totalCount = 0;
    this.filteredCount = 0;
  }

  createRenderRoot() { return this; } // Render in light DOM

  _dispatchUpdate(property, value) {
    console.log(`ManipulationPanel dispatching ${property}:`, value);
    
    // Dispatch the generic update-property event
    this.dispatchEvent(new CustomEvent('update-property', {
      detail: { property, value },
      bubbles: true,
      composed: true
    }));
    
    // Also dispatch specific property-changed events that the container is now listening for
    if (property === 'searchTerm') {
      this.dispatchEvent(new CustomEvent('searchTerm-changed', {
        detail: { value },
        bubbles: true,
        composed: true
      }));
    } else if (property === 'transferFilter') {
      this.dispatchEvent(new CustomEvent('transferFilter-changed', {
        detail: { value },
        bubbles: true,
        composed: true
      }));
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
