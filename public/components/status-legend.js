import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class StatusLegend extends LitElement {
  static get properties() {
    return {
      stockStatusFilter: { type: String },
      statusCounts: { type: Object }, // { critical: N, optimal: N, ... }
      disabled: { type: Boolean } // Disable if no data
    };
  }

  createRenderRoot() { return this; } // Render in light DOM

  _dispatchUpdate(value) {
    this.dispatchEvent(new CustomEvent('update-property', {
      detail: { property: 'stockStatusFilter', value },
      bubbles: true, composed: true
    }));
  }

  render() {
    const statuses = [
        { key: 'critical', label: 'Under Min', iconClass: 'critical', tooltip: 'Stock is below minimum threshold' },
        { key: 'optimal', label: 'Optimal', iconClass: 'optimal', tooltip: 'Stock is between minimum and maximum thresholds' },
        { key: 'high', label: 'Over Max', iconClass: 'high', tooltip: 'Stock is above maximum threshold' },
        { key: 'undefined', label: 'No Limits', iconClass: 'undefined', tooltip: 'No minimum or maximum thresholds defined' },
        { key: 'all', label: 'All Items', iconClass: 'all', tooltip: 'Show all items regardless of stock status' }
    ];

    const counts = this.statusCounts || {};

    return html`
      <div class="status-legend mb-3 ${this.disabled ? 'disabled-panel' : ''}">
        ${statuses.map(status => html`
          <div class="legend-item ${this.stockStatusFilter === status.key ? 'active' : ''}"
               @click=${() => !this.disabled && this._dispatchUpdate(status.key)}
               title="${status.tooltip}">
            <div class="legend-indicator ${status.iconClass}"></div>
            <span class="legend-label">${status.label}</span>
            <span class="legend-count">
              ${counts[status.key] ?? 0}
            </span>
          </div>
        `)}
      </div>
    `;
  }
}
customElements.define('status-legend', StatusLegend);
