// Top ABC Analysis Container Component
import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { client } from '../../socketConfig.js';
import './top-abc-chart.js';
import './top-abc-control-panel.js';
import './top-abc-table.js';

export class TopAbcContainer extends LitElement {
  static get properties() {
    return {
      data: { type: Array },
      summary: { type: Array }, // Added for summary data
      totalSales: { type: Number }, // Added for total sales
      token: { type: String },
      loading: { type: Boolean },
      error: { type: String },
      params: { type: Object },
      activeTab: { type: String },
      showSettings: { type: Boolean }
    };
  }

  createRenderRoot() {
    return this; // Render in light DOM to use global styles
  }

  constructor() {
    super();
    this.data = [];
    this.summary = []; // Initialize summary
    this.totalSales = 0; // Initialize totalSales
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
    this.activeTab = 'table';
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
      // Validate that a branch is selected before proceeding
      if (!this.params.branch || this.params.branch.trim() === '') {
        this.error = 'Please select a branch. Branch selection is mandatory.';
        return;
      }
    
      this.loading = true;
      this.error = '';

      // Create a copy of params and ensure date is properly quoted for SQL
      const params = { ...this.params };
      
      // Ensure dataReferinta is correctly formatted for SQL (needs to be quoted)
      if (params.dataReferinta) {
        // Make sure we're sending the date in quotes (SQL format)
        params.dataReferinta = `'${params.dataReferinta}'`;
      }

      //ensure supplier and mtrl are numbers and if null, set mtrl to 2606178 and supplier to 72235
        if (params.supplier === null) {
            params.supplier = 72235;
        }
        if (params.mtrl === null) {
            params.mtrl = 2606178;
        }
      
      const response = await client.service('top-abc').getTopAbcAnalysis({
        token: this.token,
        ...params
      });

      console.log('API Response:', response);

      if (response.success) {
        // Assuming the combined endpoint returns data in response.data
        if (response.data && response.data.DetailedRows) {
          this.data = response.data.DetailedRows || [];
          this.summary = response.data.SummaryRows || [];
          this.totalSales = response.data.TotalPositiveSales || 0;
        } else {
          // Fallback for the older structure if needed, or handle error
          this.data = response.rows || [];
          this.summary = []; // Clear summary if not using combined endpoint
          this.totalSales = 0; // Clear totalSales if not using combined endpoint
          // Optionally, set an error if the expected structure is missing
          // this.error = 'Unexpected response structure from server.';
        }
      } else {
        this.error = response.message || 'An error occurred while fetching data';
        console.error('Error fetching data:', response);
      }
    } catch (error) {
      this.error = `Error: ${error.message || 'Unknown error occurred'}`;
      console.error('Exception:', error);
    } finally {
      this.loading = false;
      
      // Show no data message if there's no error but also no data
      if (!this.error && (!this.data || this.data.length === 0)) {
        this.error = 'No data found for the specified criteria. Try adjusting your filters.';
      }
    }
  }

  calculateSummary(data) {
    // Implement your summary calculation logic here
    // For now, returning an empty array as a placeholder
    return [];
  }

  calculateTotalSales(data) {
    // Implement your total sales calculation logic here
    // For now, returning 0 as a placeholder
    return 0;
  }

  exportToExcel() {
    if (!window.XLSX) {
      this.error = 'XLSX library is not loaded. Cannot export to Excel.';
      console.error('XLSX library not found.');
      return;
    }

    try {
      // Main data sheet
      const mainDataWs = XLSX.utils.json_to_sheet(this.data.map(item => ({
        'Code': item.CODE,
        'Description': item.DESCRIPTION,
        'Class': item.ABC,
        'Value': typeof item.VALUE === 'number' ? item.VALUE : parseFloat(item.VALUE || 0),
        'Cumulative %': typeof item.CUMULATIVEPERC === 'number' ? item.CUMULATIVEPERC : parseFloat(item.CUMULATIVEPERC || 0),
        'Sales %': typeof item.SALESPERC === 'number' ? item.SALESPERC : parseFloat(item.SALESPERC || 0),
        'Branch': item.BRANCH,
        'Supplier': item.MTRSUP // Assuming MTRSUP is supplier ID
      })));

      // Summary data sheet
      const summaryWs = XLSX.utils.json_to_sheet(this.summary.map(item => ({
        'Class': item.ABC,
        'Item Count': item.ITEMCOUNT,
        'Class Total Value': item.CLASSTOTAL,
        'Items %': item.ITEMSPERC,
        'Value %': item.VALUEPERC
      })));

      // Total Sales (could be a small separate sheet or added to summary)
      const totalSalesData = [
        { 'Metric': 'Total Positive Sales', 'Value': this.totalSales }
      ];
      const totalSalesWs = XLSX.utils.json_to_sheet(totalSalesData);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, mainDataWs, 'ABC Details');
      XLSX.utils.book_append_sheet(wb, summaryWs, 'ABC Summary');
      XLSX.utils.book_append_sheet(wb, totalSalesWs, 'Total Sales');

      // Generate a filename with the current date
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `TopABC_Analysis_${today}.xlsx`);

    } catch (exportError) {
      this.error = `Error exporting to Excel: ${exportError.message}`;
      console.error('Excel export error:', exportError);
    }
  }

  handleParamsChanged(e) {
    this.params = { ...e.detail };
  }

  handleApplyFilters(e) {
    this.params = { ...e.detail };
    this.fetchData();
  }
  
  // Handle the refresh-data event from the chart component
  handleRefreshData() {
    this.fetchData();
  }

  toggleSettings() {
    this.showSettings = !this.showSettings;
  }

  switchTab(tab) {
    this.activeTab = tab;
  }
  
  // Helper method to get branch display text (code + name)
  getBranchDisplay() {
    if (!this.params.branch) return '';
    
    // Define the branch mapping here to have direct access
    const branches = {
      '1000': 'HQ',
      '1200': 'CLUJ',
      '1300': 'CONSTANTA',
      '1400': 'GALATI',
      '1500': 'PLOIESTI',
      '1600': 'IASI',
      '1700': 'SIBIU',
      '1800': 'CRAIOVA',
      '1900': 'ORADEA',
      '2000': 'PITESTI',
      '2100': 'BRASOV',
      '2200': 'BUCURESTI',
      '2300': 'ARAD',
      '2400': 'VOLUNTARI',
      '2600': 'MIHAILESTI',
      '2700': 'TG. MURES',
      '2800': 'TIMISOARA',
      '2900': 'RAMNICU VALCEA'
    };
    
    // Handle multi-branch case
    const branchCodes = this.params.branch.split(',').map(b => b.trim());
    if (branchCodes.length > 1) {
      return `${branchCodes.length} branches selected`;
    }
    
    // Single branch case: show code + name
    const branchCode = branchCodes[0];
    const branchName = branches[branchCode] || '';
    return branchName ? `${branchCode} - ${branchName}` : branchCode;
  }

  // Simple period info calculation - not reactive, just utility
  getAnalysisPeriod() {
    if (!this.params.dataReferinta || !this.params.nrSaptamani) {
      return 'Nu sunt definite parametrii de analiză';
    }

    const referenceDate = new Date(this.params.dataReferinta);
    const weeksAgo = this.params.nrSaptamani;
    
    // Calculate start date (reference date minus number of weeks)
    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() - (weeksAgo * 7));
    
    // Format dates
    const formatDate = (date) => {
      return date.toLocaleDateString('ro-RO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    };

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(referenceDate);
    
    return `${startDateStr} - ${endDateStr} (${weeksAgo} săptămâni)`;
  }

  render() {
    return html`

      <div class="abc-container">
        <div class="abc-header d-flex justify-content-between align-items-center mb-3">
          <div>
            <button @click=${this.toggleSettings} class="btn btn-sm btn-outline-secondary">
              <i class="fas ${this.showSettings ? 'fa-eye-slash' : 'fa-eye'}"></i>
              ${this.showSettings ? 'Hide Settings' : 'Show Settings'}
            </button>
            <button @click=${this.exportToExcel} class="btn btn-sm btn-success ms-2" ?disabled=${this.data.length === 0}>
              <i class="fas fa-file-excel"></i> Export
            </button>
          </div>
          ${!this.loading && this.totalSales > 0 && this.params.branch ? html`
            <div class="badge bg-info text-light p-2 fs-6 d-flex align-items-center">
              <i class="fas fa-chart-line me-2"></i>
              <span class="text-light">
                Total Sales: ${this.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span class="ms-2 badge bg-light text-dark">
                  Branch: ${this.getBranchDisplay()}
                </span>
              </span>
            </div>
          ` : ''}
        </div>

        ${this.showSettings ? html`
          <top-abc-control-panel 
            .token=${this.token}
            @params-changed=${this.handleParamsChanged}
            @apply-filters=${this.handleApplyFilters}>
          </top-abc-control-panel>
        ` : ''}

        <!-- Period Info - Shared by Chart and Table -->
        <div class="alert alert-light border d-flex align-items-center mb-3" role="info">
          <i class="fas fa-calendar-alt me-2 text-primary"></i>
          <div>
            <strong>📅 Perioada analizată: ${this.getAnalysisPeriod()}</strong>
            <br><small class="text-muted">Data referință: ${this.params.dataReferinta} | Săptămâni analizate: ${this.params.nrSaptamani}</small>
          </div>
        </div>

        ${this.error ? html`
          <div class="alert alert-danger d-flex align-items-center mt-3 mb-3" role="alert">
            <i class="fas fa-exclamation-circle me-2"></i>
            <div>${this.error}</div>
          </div>
        ` : ''}
        
        ${this.loading ? html`
          <div class="alert alert-info d-flex align-items-center mt-3 mb-3" role="alert">
            <div class="spinner-border spinner-border-sm me-2" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <div>Loading data...</div>
          </div>
        ` : ''}

        <!-- Total Sales now displayed in header -->

        ${!this.loading && this.summary.length > 0 ? html`
          <div class="card mb-4 border-light shadow-sm">
            <div class="card-header bg-light d-flex justify-content-between align-items-center">
              <h5 class="card-title mb-0">Summary by Class</h5>
              <div class="badge bg-secondary">
                ${this.summary.length} Categories
              </div>
            </div>
            <div class="card-body p-0">
              <table class="table table-sm table-bordered table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Class</th>
                    <th>Item Count</th>
                    <th>Class Total</th>
                    <th>Items %</th>
                    <th>Value %</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.summary.map(item => html`
                    <tr>
                      <td>
                        <span class="badge ${item.ABC === 'A' ? 'bg-success' : 
                                          item.ABC === 'B' ? 'bg-primary' : 
                                          'bg-warning text-light'}">${item.ABC}</span>
                      </td>
                      <td class="text-end">${item.ITEMCOUNT}</td>
                      <td class="text-end">${item.CLASSTOTAL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td class="text-end">${item.ITEMSPERC.toFixed(2)}%</td>
                      <td class="text-end">${item.VALUEPERC.toFixed(2)}%</td>
                    </tr>
                  `)}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        <ul class="nav nav-tabs mb-3">
          <li class="nav-item">
            <a class="nav-link ${this.activeTab === 'chart' ? 'active' : ''}" href="#" @click=${(e) => {e.preventDefault(); this.switchTab('chart');}}>
              <i class="fas fa-chart-pie me-1"></i> Chart View
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link ${this.activeTab === 'table' ? 'active' : ''}" href="#" @click=${(e) => {e.preventDefault(); this.switchTab('table');}}>
              <i class="fas fa-table me-1"></i> Table View
            </a>
          </li>
        </ul>

        <div class="tab-content">
          <div class="tab-pane fade ${this.activeTab === 'chart' ? 'show active' : ''}" id="chart-tab">
            ${this.activeTab === 'chart' ? html`
              <top-abc-chart 
                .token=${this.token}
                .data=${this.data}
                .params=${this.params}
                @refresh-data=${this.handleRefreshData}>
              </top-abc-chart>
            ` : ''}
          </div>
          <div class="tab-pane fade ${this.activeTab === 'table' ? 'show active' : ''}" id="table-tab">
            ${this.activeTab === 'table' ? html`
              <top-abc-table .data=${this.data}></top-abc-table>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }
}

// Register the custom element
customElements.define('top-abc-container', TopAbcContainer);
