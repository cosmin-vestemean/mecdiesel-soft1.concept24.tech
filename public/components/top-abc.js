import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { connectToS1 } from '../dataFetching.js';
import { client } from '../socketConfig.js';

export class TopAbc extends LitElement {
  static get properties() {
    return {
      // Filter parameters
      filterColumnName: { type: String },
      doarStocZero: { type: Boolean },
      doarDeblocate: { type: Boolean },
      valTxt: { type: String },
      signTxt: { type: Number },
      
      // Branch selection
      branches: { type: Object },
      selectedBranches: { type: Array },
      branchSearchTerm: { type: String },
      showBranchDropdown: { type: Boolean },
      
      // Config parameters
      overstockBehavior: { type: Number },
      salesHistoryMonths: { type: Number },
      adjustOrderWithPending: { type: Boolean },
      
      // UI state
      step: { type: Number },
      loading: { type: Boolean },
      error: { type: String },
      filteredItems: { type: Array },
      selectedItems: { type: Array },
      calculatedResults: { type: Array },
      searchTerm: { type: String }
    };
  }

  createRenderRoot() {
    return this; // Disable Shadow DOM for simplicity
  }

  constructor() {
    super();
    this.filterColumnName = "CODE";
    this.doarStocZero = false;
    this.doarDeblocate = true;
    this.valTxt = "";
    this.signTxt = 1;
    this.branches = {
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
    this.selectedBranches = [];
    this.branchSearchTerm = "";
    this.showBranchDropdown = false;
    this.overstockBehavior = 0;
    this.salesHistoryMonths = 6;
    this.adjustOrderWithPending = false;
    this.step = 1;
    this.loading = false;
    this.error = '';
    this.filteredItems = [];
    this.selectedItems = [];
    this.calculatedResults = [];
    this.searchTerm = '';
  }

  // Get branches as a comma separated string
  getBranchesString() {
    return this.selectedBranches.join(',');
  }

  // Get display text for branches
  getBranchesDisplayText() {
    if (this.selectedBranches.length === 0) {
      return 'Select branches';
    }
    if (this.selectedBranches.length === 1) {
      return `${this.selectedBranches[0]} - ${this.branches[this.selectedBranches[0]]}`;
    }
    return `${this.selectedBranches.length} branches selected`;
  }

  toggleBranchDropdown(e) {
    this.showBranchDropdown = !this.showBranchDropdown;
    if (this.showBranchDropdown) {
      document.addEventListener('click', this.closeBranchDropdown);
    } else {
      document.removeEventListener('click', this.closeBranchDropdown);
    }
    e.stopPropagation();
  }

  closeBranchDropdown = () => {
    this.showBranchDropdown = false;
    document.removeEventListener('click', this.closeBranchDropdown);
  }

  toggleBranch(branch, e) {
    e.stopPropagation();
    const index = this.selectedBranches.indexOf(branch);
    if (index === -1) {
      this.selectedBranches = [...this.selectedBranches, branch];
    } else {
      this.selectedBranches = this.selectedBranches.filter(b => b !== branch);
    }
  }

  selectAllBranches(e) {
    e.stopPropagation();
    this.selectedBranches = Object.keys(this.branches);
  }

  clearBranches(e) {
    e.stopPropagation();
    this.selectedBranches = [];
  }

  handleDropdownClick(e) {
    e.stopPropagation();
  }

  async searchArticles() {
    this.loading = true;
    this.error = '';
    this.filteredItems = [];
    
    try {
      if (this.selectedBranches.length === 0) {
        throw new Error('Please select at least one branch');
      }

      const token = await new Promise((resolve, reject) => {
        connectToS1((token) => {
          if (!token) {
            reject(new Error('Failed to get token'));
            return;
          }
          resolve(token);
        });
      });

      const response = await client.service('top-abc').getArticoleCfFiltre({
        token,
        filterColumnName: this.filterColumnName,
        doarStocZero: this.doarStocZero,
        doarDeblocate: this.doarDeblocate,
        valTxt: this.valTxt,
        signTxt: this.signTxt,
        sucursalaSqlInCondition: this.getBranchesString()
      });

      if (response.success) {
        // Add a selected flag to each item
        this.filteredItems = response.items.map(item => ({
          ...item,
          selected: true
        }));
        this.selectedItems = [...this.filteredItems];
        this.step = 2;
      } else {
        throw new Error(response.messages.join('. '));
      }
    } catch (error) {
      console.error('Error searching articles:', error);
      this.error = error.message || 'Failed to search articles';
    } finally {
      this.loading = false;
    }
  }

  async calculateNeeds() {
    this.loading = true;
    this.error = '';
    this.calculatedResults = [];
    
    try {
      if (this.selectedItems.length === 0) {
        throw new Error('No items selected');
      }

      const token = await new Promise((resolve, reject) => {
        connectToS1((token) => {
          if (!token) {
            reject(new Error('Failed to get token'));
            return;
          }
          resolve(token);
        });
      });

      // Get MTRLs of selected items
      const mtrlInput = this.selectedItems.map(item => item.MTRL).join(',');

      const response = await client.service('top-abc').getCalculatedNeeds({
        token,
        mtrlInput,
        overstockBehavior: this.overstockBehavior,
        salesHistoryMonths: this.salesHistoryMonths,
        adjustOrderWithPending: this.adjustOrderWithPending,
        sucursalaSqlInCondition: this.getBranchesString()
      });

      if (response.success) {
        this.calculatedResults = response.items || [];
        this.step = 3;
      } else {
        throw new Error(response.messages.join('. '));
      }
    } catch (error) {
      console.error('Error calculating needs:', error);
      this.error = error.message || 'Failed to calculate needs';
    } finally {
      this.loading = false;
    }
  }

  toggleItemSelection(mtrl) {
    this.filteredItems = this.filteredItems.map(item => {
      if (item.MTRL === mtrl) {
        return { ...item, selected: !item.selected };
      }
      return item;
    });
    this.selectedItems = this.filteredItems.filter(item => item.selected);
  }

  resetToStep1() {
    this.step = 1;
    this.filteredItems = [];
    this.selectedItems = [];
    this.calculatedResults = [];
    this.error = '';
  }

  backToStep2() {
    this.step = 2;
    this.calculatedResults = [];
    this.error = '';
  }

  exportToExcel() {
    if (!this.calculatedResults.length) {
      alert('No data to export.');
      return;
    }

    // Create a worksheet
    const worksheet = XLSX.utils.json_to_sheet(this.calculatedResults);
    
    // Create a workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Top ABC Results');
    
    // Generate Excel file
    const filename = `top_abc_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }

  get filteredItemsList() {
    if (!this.searchTerm) return this.filteredItems;
    
    const term = this.searchTerm.toLowerCase();
    return this.filteredItems.filter(item => 
      (item.CODE?.toLowerCase().includes(term) || 
       item.NAME?.toLowerCase().includes(term))
    );
  }

  renderBranchDropdown() {
    const filteredBranches = this.branchSearchTerm
      ? Object.entries(this.branches).filter(([code, name]) =>
        code.includes(this.branchSearchTerm) ||
        name.toLowerCase().includes(this.branchSearchTerm.toLowerCase()))
      : Object.entries(this.branches);

    return html`
      <div class="fancy-dropdown-menu" @click="${this.handleDropdownClick}">
        <div class="fancy-dropdown-header">
          <div class="input-group input-group-sm">
            <input type="text" class="form-control" placeholder="Search branches..." 
                   .value="${this.branchSearchTerm}" 
                   @input="${e => this.branchSearchTerm = e.target.value}" />
          </div>
        </div>
        <div class="fancy-dropdown-actions">
          <button class="btn btn-sm btn-link" @click="${this.selectAllBranches}">Select All</button>
          <button class="btn btn-sm btn-link" @click="${this.clearBranches}">Clear All</button>
        </div>
        <div class="fancy-dropdown-content">
          ${filteredBranches.map(([code, name]) => html`
            <div class="fancy-dropdown-item">
              <label class="d-flex align-items-center">
                <input type="checkbox" 
                       ?checked="${this.selectedBranches.includes(code)}"
                       @change="${(e) => this.toggleBranch(code, e)}" />
                <span class="ms-2">${code} - ${name}</span>
              </label>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  renderStep1() {
    return html`
      <div class="card mb-3 border-light shadow-sm">
        <div class="card-body p-3">
          <h5 class="card-title mb-3">Step 1: Search Articles</h5>
          
          <div class="row mb-3">
            <div class="col-md-6">
              <div class="input-group input-group-sm fancy-dropdown mb-3">
                <span class="input-group-text">Branches</span>
                <button class="form-select fancy-dropdown-toggle text-start" 
                        @click="${this.toggleBranchDropdown}"
                        ?disabled="${this.loading}">
                  ${this.getBranchesDisplayText()}
                </button>
                ${this.showBranchDropdown ? this.renderBranchDropdown() : ''}
              </div>
            </div>
            
            <div class="col-md-6">
              <div class="input-group input-group-sm mb-3">
                <span class="input-group-text">Filter Column</span>
                <select class="form-select" 
                        .value="${this.filterColumnName}"
                        @change="${e => this.filterColumnName = e.target.value}"
                        ?disabled="${this.loading}">
                  <option value="CODE">Code</option>
                  <option value="NAME">Name</option>
                </select>
              </div>
            </div>
          </div>
          
          <div class="row mb-3">            
            <div class="col-md-6">
              <div class="input-group input-group-sm mb-3">
                <span class="input-group-text">Search Type</span>
                <select class="form-select" 
                        .value="${this.signTxt}"
                        @change="${e => this.signTxt = parseInt(e.target.value)}"
                        ?disabled="${this.loading}">
                  <option value="1">Starts with</option>
                  <option value="2">Contains</option>
                  <option value="3">Ends with</option>
                </select>
              </div>
            </div>
            <div class="col-md-6">
              <div class="input-group input-group-sm mb-3">
                <span class="input-group-text">Search Value</span>
                <input type="text" class="form-control" placeholder="Enter search value"
                       .value="${this.valTxt}" 
                       @input="${e => this.valTxt = e.target.value}"
                       ?disabled="${this.loading}" />
              </div>
            </div>
          </div>
          
          <div class="row mb-3">
            <div class="col">
              <div class="form-check form-check-inline">
                <input class="form-check-input" type="checkbox" id="doarStocZero"
                       ?checked="${this.doarStocZero}"
                       @change="${e => this.doarStocZero = e.target.checked}"
                       ?disabled="${this.loading}" />
                <label class="form-check-label" for="doarStocZero">Zero Stock Only</label>
              </div>
              
              <div class="form-check form-check-inline">
                <input class="form-check-input" type="checkbox" id="doarDeblocate"
                       ?checked="${this.doarDeblocate}"
                       @change="${e => this.doarDeblocate = e.target.checked}"
                       ?disabled="${this.loading}" />
                <label class="form-check-label" for="doarDeblocate">Unblocked Items Only</label>
              </div>
            </div>
          </div>
          
          <button class="btn btn-primary" 
                  @click="${this.searchArticles}" 
                  ?disabled="${this.loading}">
            ${this.loading ? html`<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Searching...` : 'Search Articles'}
          </button>
        </div>
      </div>
    `;
  }

  renderStep2() {
    return html`
      <div class="card mb-3 border-light shadow-sm">
        <div class="card-body p-3">
          <h5 class="card-title mb-3">Step 2: Select Items for Calculation</h5>
          
          <div class="row mb-3">
            <div class="col-md-6">
              <div class="input-group input-group-sm mb-3">
                <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
                <input type="text" class="form-control" placeholder="Search by code or name..."
                       .value="${this.searchTerm}" 
                       @input="${e => { this.searchTerm = e.target.value; this.requestUpdate(); }}" />
                ${this.searchTerm ? html`
                  <button class="btn btn-outline-secondary" @click="${() => { this.searchTerm = ''; this.requestUpdate(); }}">
                    <i class="bi bi-x"></i>
                  </button>` : ''}
              </div>
            </div>
            
            <div class="col-md-6">
              <div class="d-flex align-items-center justify-content-end">
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="checkbox" id="selectAll"
                         ?checked="${this.filteredItems.length > 0 && this.selectedItems.length === this.filteredItems.length}"
                         @change="${e => {
                           const checked = e.target.checked;
                           this.filteredItems = this.filteredItems.map(item => ({...item, selected: checked}));
                           this.selectedItems = checked ? [...this.filteredItems] : [];
                         }}" />
                  <label class="form-check-label" for="selectAll">Select All</label>
                </div>
                
                <span class="ms-3 badge rounded-pill bg-primary">
                  ${this.selectedItems.length} of ${this.filteredItems.length} items selected
                </span>
              </div>
            </div>
          </div>
          
          <div class="table-responsive">
            <table class="table table-sm table-hover">
              <thead class="table-light">
                <tr>
                  <th>Select</th>
                  <th>Code</th>
                  <th>Name</th>
                </tr>
              </thead>
              <tbody>
                ${this.filteredItemsList.map(item => html`
                  <tr class="${item.selected ? 'table-active' : ''}">
                    <td>
                      <div class="form-check">
                        <input class="form-check-input" type="checkbox" 
                               ?checked="${item.selected}"
                               @change="${() => this.toggleItemSelection(item.MTRL)}" />
                      </div>
                    </td>
                    <td>${item.CODE}</td>
                    <td>${item.NAME}</td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
          
          <div class="mt-3 d-flex justify-content-between">
            <button class="btn btn-outline-secondary" @click="${this.resetToStep1}">
              Back to Step 1
            </button>
            <div>
              <h6 class="mb-3">Calculation Settings</h6>
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text">Sales History Months</span>
                <input type="number" class="form-control" min="1" max="36"
                       .value="${this.salesHistoryMonths}" 
                       @change="${e => this.salesHistoryMonths = parseInt(e.target.value)}" />
              </div>
              
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text">Overstock Behavior</span>
                <select class="form-select" 
                        .value="${this.overstockBehavior}"
                        @change="${e => this.overstockBehavior = parseInt(e.target.value)}">
                  <option value="0">Compensate</option>
                  <option value="1">No Compensation</option>
                </select>
              </div>
              
              <div class="form-check mb-3">
                <input class="form-check-input" type="checkbox" id="adjustOrderWithPending"
                       ?checked="${this.adjustOrderWithPending}"
                       @change="${e => this.adjustOrderWithPending = e.target.checked}" />
                <label class="form-check-label" for="adjustOrderWithPending">Adjust Order with Pending</label>
              </div>
              
              <button class="btn btn-primary" 
                      @click="${this.calculateNeeds}"
                      ?disabled="${this.loading || this.selectedItems.length === 0}">
                ${this.loading ? html`<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Calculating...` : 'Calculate Needs'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderStep3() {
    return html`
      <div class="card mb-3 border-light shadow-sm">
        <div class="card-body p-3">
          <h5 class="card-title mb-3">Step 3: Calculation Results</h5>
          
          <div class="mb-3 d-flex justify-content-between">
            <button class="btn btn-outline-secondary" @click="${this.backToStep2}">
              Back to Step 2
            </button>
            
            <button class="btn btn-success" @click="${this.exportToExcel}">
              <i class="bi bi-file-earmark-excel"></i> Export to Excel
            </button>
          </div>
          
          <div class="table-responsive">
            <table class="table table-sm table-hover">
              <thead class="table-light sticky-top">
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Stock</th>
                  <th>Reserved</th>
                  <th>Pending</th>
                  <th>Min Need</th>
                  <th>Max Need</th>
                  <th>Order Min</th>
                  <th>Order Max</th>
                  <th>Sales History</th>
                  <th>Coverage (Months)</th>
                </tr>
              </thead>
              <tbody>
                ${this.calculatedResults.map(item => html`
                  <tr>
                    <td>${item.CODE}</td>
                    <td>${item.NAME}</td>
                    <td>${item.CCCQTYSTOC}</td>
                    <td>${item.CCCQTYREZERVAT}</td>
                    <td>${item.CCCQTYASTEPTAT}</td>
                    <td>${item.CCCQTY1}</td>
                    <td>${item.CCCQTY2}</td>
                    <td>${item.CCCORDERMIN}</td>
                    <td>${item.CCCORDERMAX}</td>
                    <td>${item.CCC3MSALES}</td>
                    <td>${item.CCCACOPLUN}</td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <style>
        .fancy-dropdown {
          position: relative;
        }
        .fancy-dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          max-height: 300px;
          z-index: 1050;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .fancy-dropdown-header {
          padding: 8px;
          border-bottom: 1px solid #eee;
        }
        .fancy-dropdown-actions {
          display: flex;
          justify-content: space-between;
          padding: 8px;
          border-bottom: 1px solid #eee;
        }
        .fancy-dropdown-content {
          overflow-y: auto;
          max-height: 200px;
        }
        .fancy-dropdown-item {
          padding: 6px 8px;
          cursor: pointer;
        }
        .fancy-dropdown-item:hover {
          background: #f8f9fa;
        }
        .sticky-top {
          position: sticky;
          top: 0;
          background: white;
          z-index: 10;
        }
      </style>
      
      <div class="container-fluid">
        <h3 class="mb-3">Top ABC Analysis</h3>
        
        ${this.error ? html`<div class="alert alert-danger">${this.error}</div>` : ''}
        
        <div class="progress mb-3" style="${this.step > 1 ? '' : 'display: none;'}">
          <div class="progress-bar" role="progressbar" style="width: ${(this.step - 1) * 50}%"></div>
        </div>
        
        ${this.step === 1 ? this.renderStep1() : ''}
        ${this.step === 2 ? this.renderStep2() : ''}
        ${this.step === 3 ? this.renderStep3() : ''}
      </div>
    `;
  }
}

customElements.define('top-abc', TopAbc);