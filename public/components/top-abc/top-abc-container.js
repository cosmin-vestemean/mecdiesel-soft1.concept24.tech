// Top ABC Analysis Container Component
import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { client } from '../../socketConfig.js';
import './top-abc-chart.js';
import './top-abc-control-panel.js';

export class TopAbcContainer extends LitElement {
  static get properties() {
    return {
      data: { type: Array },
      token: { type: String },
      loading: { type: Boolean },
      error: { type: String },
      params: { type: Object },
      activeTab: { type: String },
      showSettings: { type: Boolean }
    };
  }

  constructor() {
    super();
    this.data = [];
    this.token = '';
    this.loading = false;
    this.error = '';
    this.params = {
      dataReferinta: new Date().toISOString().slice(0, 10),
      nrSaptamani: 52,
      seriesL: '',
      branch: '',
      supplier: null,
      mtrl: null,
      cod: '',
      searchType: 1,
      modFiltrareBranch: 'AGENT',
      thresholdA: 80,
      thresholdB: 15
    };
    this.activeTab = 'chart';
    this.showSettings = true;
  }

  connectedCallback() {
    super.connectedCallback();
    this.token = sessionStorage.getItem('s1Token');
    if (!this.token) {
      console.error('No token available');
      this.error = 'No authentication token found. Please log in.';
      return;
    }

    this.fetchData();
  }

  async fetchData() {
    try {
      this.loading = true;
      this.error = '';

      // Create a copy of params and ensure date is properly quoted for SQL
      const params = { ...this.params };
      
      // Ensure dataReferinta is correctly formatted for SQL (needs to be quoted)
      if (params.dataReferinta) {
        // Make sure we're sending the date in quotes (SQL format)
        params.dataReferinta = `'${params.dataReferinta}'`;
      }
      
      const response = await client.service('top-abc').getTopAbcAnalysis({
        token: this.token,
        ...params
      });

      console.log('API Response:', response);

      if (response.success) {
        this.data = response.rows || [];
      } else {
        this.error = response.message || 'An error occurred while fetching data';
        console.error('Error fetching data:', response);
      }
    } catch (error) {
      this.error = `Error: ${error.message}`;
      console.error('Exception:', error);
    } finally {
      this.loading = false;
    }
  }

  handleParamsChanged(e) {
    this.params = { ...e.detail };
  }

  handleApplyFilters(e) {
    this.params = { ...e.detail };
    this.fetchData();
    
    // Also notify the chart component to refresh with new data
    const chartComponent = this.renderRoot.querySelector('top-abc-chart');
    if (chartComponent) {
      chartComponent.params = { ...this.params };
      chartComponent.fetchData();
    }
  }

  toggleSettings() {
    this.showSettings = !this.showSettings;
  }

  switchTab(tab) {
    this.activeTab = tab;
  }

  render() {
    return html`

      <div class="abc-container">
        <div class="abc-header">
          <h2>TOP ABC Analysis</h2>
          <button class="abc-settings-toggle" @click=${this.toggleSettings}>
            ${this.showSettings ? 'Hide Settings' : 'Show Settings'}
          </button>
        </div>

        ${this.showSettings ? html`
          <top-abc-control-panel 
            .token=${this.token}
            @params-changed=${this.handleParamsChanged}
            @apply-filters=${this.handleApplyFilters}>
          </top-abc-control-panel>
        ` : ''}

        ${this.error ? html`<div class="abc-error-message">${this.error}</div>` : ''}
        ${this.loading ? html`<div class="abc-loading">Loading data...</div>` : ''}

        <div class="abc-tabs">
          <div class="abc-tab ${this.activeTab === 'chart' ? 'active' : ''}" @click=${() => this.switchTab('chart')}>
            Chart View
          </div>
          <div class="abc-tab ${this.activeTab === 'table' ? 'active' : ''}" @click=${() => this.switchTab('table')}>
            Table View
          </div>
        </div>

        <div class="abc-tab-content">
          ${this.activeTab === 'chart' ? html`
            <top-abc-chart 
              .token=${this.token}
              .data=${this.data}
              .params=${this.params}>
            </top-abc-chart>
          ` : html`
            <div class="abc-table-view">
              <table class="abc-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Description</th>
                    <th>Class</th>
                    <th>Value</th>
                    <th>Cumulative %</th>
                    <th>Items %</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.data.map(item => {
                    const abcClass = item.ABC || 'Unknown';
                    return html`
                      <tr class=${`abc-class-${abcClass.toLowerCase()}`}>
                        <td>${item.Code || item.Cod}</td>
                        <td>${item.Description || item.Descriere || ''}</td>
                        <td>
                          <span class=${`abc-badge abc-badge-${abcClass.toLowerCase()}`}>${abcClass}</span>
                        </td>
                        <td>${item.Value ? item.Value.toLocaleString() : ''}</td>
                        <td>${item.CumulativePerc ? item.CumulativePerc.toFixed(2) + '%' : ''}</td>
                        <td>${item.ItemsPerc ? item.ItemsPerc.toFixed(2) + '%' : ''}</td>
                      </tr>
                    `;
                  })}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;
  }
}

// Register the custom element
customElements.define('top-abc-container', TopAbcContainer);
