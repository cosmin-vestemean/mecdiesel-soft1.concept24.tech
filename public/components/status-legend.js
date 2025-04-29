import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import './status-legend.css'; // Import CSS

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
        { key: 'critical', label: 'Under Min', iconClass: 'critical' },
        { key: 'optimal', label: 'Optimal', iconClass: 'optimal' },
        { key: 'high', label: 'Over Max', iconClass: 'high' },
        { key: 'undefined', label: 'No Limits', iconClass: 'undefined' },
        { key: 'all', label: 'All Items', iconClass: 'all' }
    ];

    const counts = this.statusCounts || {};

    return html`
      <div class="status-legend mb-3 ${this.disabled ? 'disabled-panel' : ''}">
        ${statuses.map(status => html`
          <div class="legend-item ${this.stockStatusFilter === status.key ? 'active' : ''}"
               @click=${() => !this.disabled && this._dispatchUpdate(status.key)}>
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
