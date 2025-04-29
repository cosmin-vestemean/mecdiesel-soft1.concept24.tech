import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import './manipulation-panel.css'; // Import CSS

export class ManipulationPanel extends LitElement {
  static get properties() {
    return {
      searchTerm: { type: String },
      transferFilter: { type: String },
      totalCount: { type: Number },
      filteredCount: { type: Number },
    };
  }

  createRenderRoot() { return this; } // Render in light DOM

  _dispatchUpdate(property, value) {
    this.dispatchEvent(new CustomEvent('update-property', {
      detail: { property, value },
      bubbles: true,
      composed: true
    }));
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
          <div class="btn-group btn-group-sm transfer-filter-group" role="group">
            ${[
                { value: 'all', label: 'All Items' },
                { value: 'positive', label: 'With Transfer' },
                { value: 'zero', label: 'No Transfer' }
            ].map(filter => html`
              <input type="radio" class="btn-check" name="transferFilter" id="tf-${filter.value}"
                     .checked=${this.transferFilter === filter.value}
                     @change=${() => this._dispatchUpdate('transferFilter', filter.value)}
                     autocomplete="off">
              <label class="btn btn-outline-secondary" for="tf-${filter.value}">
                ${filter.label}
              </label>
            `)}
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
