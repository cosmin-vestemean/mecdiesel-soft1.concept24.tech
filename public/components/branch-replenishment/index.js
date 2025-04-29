import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { BranchReplenishmentState } from './utils/state-management.js'; // Corrected path
import { branchReplenishmentStyles } from './styles.js';
import { filterData, getStockClass, getStockStatusCounts, getUniqueDestinations, getValueClass } from './utils/dataUtils.js'; // Assuming utils exist
import { exportToExcel } from './utils/exportUtils.js'; // Assuming utils exist
import { columnMask, getVisibleColumns } from './utils/columnConfig.js'; // Import the mask

/**
 * Branch Replenishment Component
 * 
 * Provides interface for managing stock replenishment between branches
 */
export class BranchReplenishment extends LitElement {
  static get styles() {
    return branchReplenishmentStyles;
  }

  static get properties() {
    return {
      branchesEmit: { type: String },
      branchesDest: { type: String },
      selectedDestBranches: { type: Array },
      fiscalYear: { type: Number },
      data: { type: Array },
      token: { type: String },
      loading: { type: Boolean },
      error: { type: String },
      searchTerm: { type: String },
      destSearchTerm: { type: String },
      showDestDropdown: { type: Boolean },
      setConditionForNecesar: { type: Boolean },
      setConditionForLimits: { type: Boolean },
      selectedReplenishmentStrategy: { type: String },
      transferFilter: { type: String },
      destinationFilter: { type: String },
      isSuccessiveStrategy: { type: Boolean },
      branches: { type: Object },
      stockStatusFilter: { type: String },
      viewMode: { type: String }, // 'normal' or 'zen' mode
      columnFilters: { type: Object } // Numerical column filters
    };
  }

  createRenderRoot() {
    // Use light DOM, but ensure styles are properly applied
    const root = this;
    
    // Apply component styles to document
    if (!document.querySelector('#branch-replenishment-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'branch-replenishment-styles';
      styleElement.textContent = branchReplenishmentStyles.cssText;
      document.head.appendChild(styleElement);
    }
    
    return root;
  }

  constructor() {
    super();
    // Initialize with state management
    const state = new BranchReplenishmentState();
    
    // Copy state properties to component properties
    this.branchesEmit = state.branchesEmit;
    this.branchesDest = state.branchesDest;
    this.selectedDestBranches = state.selectedDestBranches;
    this.fiscalYear = state.fiscalYear;
    this.data = state.data;
    this.loading = state.loading;
    this.error = state.error;
    
    // Setup filters
    this.searchTerm = state.filters.searchTerm;
    this.destSearchTerm = state.filters.destSearchTerm;
    this.transferFilter = state.filters.transferFilter;
    this.destinationFilter = state.filters.destinationFilter;
    this.stockStatusFilter = state.filters.stockStatusFilter;
    
    // Configuration
    this.setConditionForNecesar = state.config.setConditionForNecesar;
    this.setConditionForLimits = state.config.setConditionForLimits;
    this.selectedReplenishmentStrategy = state.config.selectedReplenishmentStrategy;
    this.isSuccessiveStrategy = state.config.isSuccessiveStrategy;
    this.showDestDropdown = state.config.showDestDropdown;
    this.viewMode = state.config.viewMode;
    
    // Branch data
    this.branches = state.branches;
    
    // Initialize column filters
    this.columnFilters = {
      'stoc_dest': { min: null, max: null, active: false },
      'min_dest': { min: null, max: null, active: false },
      'max_dest': { min: null, max: null, active: false },
      'comenzi': { min: null, max: null, active: false },
      'transf_nerec': { min: null, max: null, active: false }
    };
  }

  /**
   * First updated lifecycle callback
   * Used to force apply styles to elements after first render
   */
  firstUpdated() {
    // Force style application after first render
    this.applyStockIndicatorStyles();
  }

  /**
   * Updated lifecycle callback
   * Used to reapply styles when data changes
   */
  updated(changedProperties) {
    // Call parent method to setup tooltips
    const tooltipTriggerList = [].slice.call(this.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.forEach(tooltipTriggerEl => {
      new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Re-apply styles when data changes
    if (changedProperties.has('data') || 
        changedProperties.has('stockStatusFilter') || 
        changedProperties.has('transferFilter') ||
        changedProperties.has('destinationFilter')) {
      this.applyStockIndicatorStyles();
    }
  }

  /**
   * Force browser to apply stock indicator styles
   * This is needed because sometimes the CSS pseudo-elements don't get applied correctly in light DOM
   */
  applyStockIndicatorStyles() {
    // Force DOM repaint for stock indicators
    setTimeout(() => {
      // Get all elements with stock indicator classes
      const stockElements = this.querySelectorAll('.stock-critical, .stock-optimal, .stock-high');
      
      // Trigger browser reflow for each element
      stockElements.forEach(element => {
        // Reading offsetHeight triggers reflow
        void element.offsetHeight;
      });
      
      // Ensure legend indicators are styled
      const legendIndicators = this.querySelectorAll('.legend-indicator');
      legendIndicators.forEach(indicator => {
        void indicator.offsetHeight;
      });
    }, 0);
  }

  /**
   * Get destination branches string for API calls
   */
  getDestBranchesString() {
    return this.selectedDestBranches.join(',');
  }

  /**
   * Get display text for destination dropdown
   */
  getDestBranchesDisplayText() {
    if (this.selectedDestBranches.length === 0) return 'Select branches';
    if (this.selectedDestBranches.length === 1) {
      const code = this.selectedDestBranches[0];
      return `${code} - ${this.branches[code] || ''}`;
    }
    return `${this.selectedDestBranches.length} branches selected`;
  }

  /**
   * Toggle destination dropdown visibility
   */
  toggleDestinationDropdown(e) {
    this.showDestDropdown = !this.showDestDropdown;
    e.stopPropagation();

    if (this.showDestDropdown) {
      // Add click event listener to close dropdown when clicking outside
      setTimeout(() => {
        document.addEventListener('click', this.closeDestDropdown);
      }, 0);
    }
  }

  /**
   * Close destination dropdown
   */
  closeDestDropdown = () => {
    this.showDestDropdown = false;
    document.removeEventListener('click', this.closeDestDropdown);
  }

  /**
   * Toggle selection of a destination branch
   */
  toggleDestBranch(branch, e) {
    e.stopPropagation(); // Prevent dropdown from closing

    const index = this.selectedDestBranches.indexOf(branch);
    if (index > -1) {
      this.selectedDestBranches = [
        ...this.selectedDestBranches.slice(0, index),
        ...this.selectedDestBranches.slice(index + 1)
      ];
    } else {
      this.selectedDestBranches = [...this.selectedDestBranches, branch];
    }
  }

  /**
   * Select all destination branches
   */
  selectAllDestBranches(e) {
    e.stopPropagation();
    const allBranchCodes = Object.keys(this.branches);
    this.selectedDestBranches = [...allBranchCodes];
  }

  /**
   * Clear all destination branches
   */
  clearDestBranches(e) {
    e.stopPropagation();
    this.selectedDestBranches = [];
  }

  /**
   * Handle dropdown click
   */
  handleDropdownClick(e) {
    e.stopPropagation(); // Keep dropdown open when clicking inside
  }

  /**
   * Load data from API
   */
  async loadData() {
    this.loading = true;
    this.error = '';

    try {
      // Validate inputs
      this.validateInputs();
      
      // Get token for API authentication
      const token = await this.getToken();
      
      // Call API to get replenishment data
      const response = await this.fetchReplenishmentData(token);
      
      // Process response
      this.processResponse(response);
    } catch (error) {
      this.handleError(error);
    } finally {
      this.loading = false;
      this.requestUpdate();
    }
  }
  
  /**
   * Validate user inputs before data loading
   */
  validateInputs() {
    if (!this.branchesEmit) {
      throw new Error('Please select a source branch');
    }

    if (this.selectedDestBranches.length === 0) {
      throw new Error('Please select at least one destination branch');
    }
  }
  
  /**
   * Get authentication token for API
   */
  async getToken() {
    return new Promise((resolve, reject) => {
      connectToS1((token) => {
        if (!token) {
          reject(new Error('Failed to get token'));
          return;
        }
        resolve(token);
      });
    });
  }
  
  /**
   * Fetch replenishment data from API
   */
  async fetchReplenishmentData(token) {
    return client.service('s1').getAnalyticsForBranchReplenishment({
      clientID: token,
      branchesEmit: this.branchesEmit,
      branchesDest: this.getDestBranchesString(),
      fiscalYear: this.fiscalYear,
      company: 1000,
      setConditionForNecesar: this.setConditionForNecesar,
      setConditionForLimits: this.setConditionForLimits
    });
  }
  
  /**
   * Process API response
   */
  processResponse(response) {
    this.data = Array.isArray(response) ? response : [];
  }
  
  /**
   * Handle error during data loading
   */
  handleError(error) {
    console.error('Error loading branch replenishment data:', error);
    this.error = `Error loading data: ${error.message}`;
    this.data = [];
  }

  /**
   * Handle transfer value change
   */
  onTransferChange(e, item) {
    item.transfer = parseFloat(e.target.value || 0);
    this.requestUpdate();
  }

  /**
   * Handle keyboard navigation in transfer inputs
   */
  handleKeyNav(e) {
    const cell = e.target;
    const row = parseInt(cell.dataset.rowIndex);
    const col = parseInt(cell.dataset.colIndex);

    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowDown': {
        e.preventDefault();
        const nextRow = e.key === 'ArrowUp' ? row - 1 : row + 1;
        if (nextRow >= 0 && nextRow < this.data.length) {
          const nextCell = document.querySelector(`.compact-input[data-row-index="${nextRow}"][data-col-index="${col}"]`);
          if (nextCell) {
            nextCell.focus();
            nextCell.select();
          }
        }
        break;
      }
      case 'Enter':
        e.preventDefault();
        const nextRow = row + 1;
        if (nextRow < this.data.length) {
          const nextCell = document.querySelector(`.compact-input[data-row-index="${nextRow}"][data-col-index="${col}"]`);
          if (nextCell) {
            nextCell.focus();
            nextCell.select();
          }
        }
        break;
      case 'Escape':
        cell.blur();
        break;
    }
  }

  /**
   * Save data to backend
   */
  saveData() {
    console.log('Transfers to process:', this.filterData().map(item => item.transfer));
    // TODO: Implement actual data saving functionality
  }

  /**
   * Export filtered data to Excel
   */
  exportToExcel() {
    exportToExcel(this.filterData());
  }

  /**
   * Apply selected replenishment strategy
   */
  applyReplenishmentStrategy() {
    if (!this.data.length) return;

    switch (this.selectedReplenishmentStrategy) {
      case 'min':
        this.applyMinQuantities();
        break;
      case 'max':
        this.applyMaxQuantities();
        break;
      case 'skip_blacklisted':
        this.skipBlacklisted();
        break;
      case 'clear':
        this.clearTransfers();
        break;
    }

    this.requestUpdate();
  }

  /**
   * Apply minimum quantities strategy
   */
  applyMinQuantities() {
    const targetItems = this.isSuccessiveStrategy
      ? this.filterData().filter(item => parseFloat(item.transfer || 0) === 0)
      : this.filterData();

    targetItems.forEach(item => {
      if (item.Blacklisted === '-') {
        const minQty = parseFloat(item.cant_min);
        item.transfer = minQty > 0 ? minQty : 0;
      }
    });
  }

  /**
   * Apply maximum quantities strategy
   */
  applyMaxQuantities() {
    const targetItems = this.isSuccessiveStrategy
      ? this.filterData().filter(item => parseFloat(item.transfer || 0) === 0)
      : this.filterData();

    targetItems.forEach(item => {
      if (item.Blacklisted === '-') {
        const maxQty = parseFloat(item.cant_max);
        item.transfer = maxQty > 0 ? maxQty : 0;
      }
    });
  }

  /**
   * Skip blacklisted items strategy
   */
  skipBlacklisted() {
    const targetItems = this.isSuccessiveStrategy
      ? this.data.filter(item => parseFloat(item.transfer || 0) === 0)
      : this.data;

    targetItems.forEach(item => {
      if (item.Blacklisted !== '-') {
        item.transfer = 0;
      }
    });
  }

  /**
   * Clear all transfers
   */
  clearTransfers() {
    this.filterData().forEach(item => {
      item.transfer = 0;
    });
  }

  /**
   * Filter data based on current filter settings
   */
  filterData() {
    const filters = {
      searchTerm: this.searchTerm,
      transferFilter: this.transferFilter,
      destinationFilter: this.destinationFilter,
      stockStatusFilter: this.stockStatusFilter
    };
    
    // Start with basic filtering
    let filtered = filterData(this.data, filters, getStockClass);
    
    // Apply numerical column filters
    Object.entries(this.columnFilters).forEach(([column, filter]) => {
      if (filter.active) {
        filtered = filtered.filter(item => {
          const value = parseFloat(item[column]);
          const min = filter.min !== null ? filter.min : -Infinity;
          const max = filter.max !== null ? filter.max : Infinity;
          return value >= min && value <= max;
        });
      }
    });
    
    return filtered;
  }

  /**
   * Get unique destination values from data
   */
  getUniqueDestinations() {
    return getUniqueDestinations(this.data);
  }

  /**
   * Toggle zen mode
   */
  toggleZenMode() {
    this.viewMode = this.viewMode === 'zen' ? 'normal' : 'zen';
  }

  /**
   * Render a single table row
   */
  renderRow(item, index) {
    const descriere = (item.Descriere || '').substring(0, 50);
    const visibleColumns = getVisibleColumns(); // Get visible columns based on mask

    // Helper to render a cell based on mask visibility
    const renderCell = (columnKey, content, classes = '', title = '') => {
      if (columnMask[columnKey]?.visible) {
        return html`<td class="${classes}" title="${title}">${content}</td>`;
      }
      return ''; // Return empty string if column is not visible
    };

    return html`
      <tr>
        ${renderCell('index', index + 1, 'text-center')} {/* Assuming index is always needed */}
        ${renderCell('Cod', item.Cod)}
        ${renderCell('Descriere', descriere, 'text-truncate', item.Descriere)}
        ${renderCell('Destinatie', item.Destinatie)}
        ${renderCell('Blacklisted', item.Blacklisted, item.Blacklisted === 'Da' ? 'text-danger fw-bold' : '')}
        ${renderCell('InLichidare', item.InLichidare, item.InLichidare === 'Da' ? 'text-warning fw-bold' : '')}
        
        <!-- Source Group -->
        ${renderCell('stoc_emit', html`<span class="${getStockClass(item.stoc_emit, item.min_emit, item.max_emit)}">${item.stoc_emit}</span>`, 'group-source')}
        ${renderCell('min_emit', item.min_emit, `group-source ${getValueClass(item.min_emit)}`)}
        ${renderCell('max_emit', item.max_emit, `group-source ${getValueClass(item.max_emit)}`)}
        ${renderCell('disp_min_emit', item.disp_min_emit, `group-source vertical-divider ${getValueClass(item.disp_min_emit)}`)}
        ${renderCell('disp_max_emit', item.disp_max_emit, `group-source ${getValueClass(item.disp_max_emit)}`)}

        <!-- Destination Group -->
        ${renderCell('stoc_dest', html`<span class="${getStockClass(item.stoc_dest, item.min_dest, item.max_dest)}">${item.stoc_dest}</span>`, 'group-destination vertical-divider')}
        ${renderCell('min_dest', item.min_dest, `group-destination ${getValueClass(item.min_dest)}`)}
        ${renderCell('max_dest', item.max_dest, `group-destination ${getValueClass(item.max_dest)}`)}
        ${renderCell('comenzi', item.comenzi, `group-destination vertical-divider ${getValueClass(item.comenzi)}`)}
        ${renderCell('transf_nerec', item.transf_nerec, `group-destination ${getValueClass(item.transf_nerec)}`)}

        <!-- Necessity Group -->
        ${renderCell('nec_min', item.nec_min, `group-necessity vertical-divider ${getValueClass(item.nec_min)}`)}
        ${renderCell('nec_max', item.nec_max, `group-necessity ${getValueClass(item.nec_max)}`)}
        ${renderCell('nec_min_comp', item.nec_min_comp, `group-necessity ${getValueClass(item.nec_min_comp)}`)}
        ${renderCell('nec_max_comp', item.nec_max_comp, `group-necessity ${getValueClass(item.nec_max_comp)}`)}

        <!-- Action Group -->
        ${renderCell('cant_min', item.cant_min, `group-action vertical-divider ${getValueClass(item.cant_min)}`)}
        ${renderCell('cant_max', item.cant_max, `group-action ${getValueClass(item.cant_max)}`)}
        ${renderCell('transfer', html`
          <input
            class="compact-input ${getValueClass(item.transfer)}"
            data-row-index="${index}"
            data-col-index="0"
            type="number"
            min="0"
            .value="${item.transfer || 0}"
            @keydown="${this.handleKeyNav}"
            @change="${(e) => this.onTransferChange(e, item)}"
          />
        `, 'group-action')}
      </tr>
    `;
  }

  /**
   * Main render method
   */
  render() {
    const filteredData = this.filterData();
    const totalCount = this.data.length;
    const filteredCount = filteredData.length;
    const uniqueDestinations = this.getUniqueDestinations();
    const zenModeClass = this.viewMode === 'zen' ? 'zen-mode' : '';
    const visibleColumns = getVisibleColumns(); // Get visible columns for header

    // Helper to render table headers based on mask
    const renderHeaders = () => {
      // Group columns for multi-level headers (optional, but good for complex tables)
      const groups = {
        'Info': ['Cod', 'Descriere', 'Destinatie', 'Blacklisted', 'InLichidare'],
        'Source': ['stoc_emit', 'min_emit', 'max_emit', 'disp_min_emit', 'disp_max_emit'],
        'Destination': ['stoc_dest', 'min_dest', 'max_dest', 'comenzi', 'transf_nerec'],
        'Necessity': ['nec_min', 'nec_max', 'nec_min_comp', 'nec_max_comp'],
        'Action': ['cant_min', 'cant_max', 'transfer']
      };

      // Calculate colspan for each group based on visible columns
      const groupColspans = Object.entries(groups).reduce((acc, [groupName, cols]) => {
        acc[groupName] = cols.filter(colKey => columnMask[colKey]?.visible).length;
        return acc;
      }, {});

      return html`
        <thead>
          {/* Optional: Group Headers */}
          <tr>
            <th rowspan="2" class="text-center">#</th> {/* Index column */}
            ${Object.entries(groupColspans).map(([groupName, colspan]) => 
              colspan > 0 ? html`<th colspan="${colspan}" class="text-center group-header">${groupName}</th>` : ''
            )}
          </tr>
          {/* Individual Column Headers */}
          <tr>
            ${visibleColumns.map(col => html`
              <th class="text-center ${col.group ? `group-${col.group.toLowerCase()}` : ''}">
                ${col.label}
                {/* Add filter inputs here if needed based on col.filterable and col.type */}
              </th>
            `)}
          </tr>
        </thead>
      `;
    };

    return html`
      <div class="branch-replenishment-container ${zenModeClass}">
        ${this.loading ? html`<div class="text-center p-5"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>` : ''}
        ${this.error ? html`<div class="alert alert-danger">${this.error}</div>` : ''}

        ${!this.loading && !this.error && this.data.length > 0 ? html`
          <div class="table-responsive">
            <table class="table table-bordered table-hover table-sm data-table">
              ${renderHeaders()}
              <tbody>
                ${filteredData.map((item, index) => this.renderRow(item, index))}
              </tbody>
            </table>
          </div>
          <div class="text-muted small mt-2">
            Showing ${filteredCount} of ${totalCount} items.
          </div>
        ` : ''}

        ${!this.loading && !this.error && this.data.length === 0 && !this.branchesEmit ? html`
          <div class="alert alert-info">Please select source and destination branches and click Load Data.</div>
        ` : ''}
         ${!this.loading && !this.error && this.data.length === 0 && this.branchesEmit ? html`
          <div class="alert alert-warning">No data found for the selected criteria.</div>
        ` : ''}

        <!-- Control Area - Can be collapsed in Zen mode -->
        <div class="control-area">
          <div class="card mb-2 border-light shadow-sm">
            <div class="card-body p-2">
              <div class="row g-2 align-items-center">
                <div class="col-md-9">
                  <div class="row g-2 align-items-center">
                    <div class="col-md-4">
                      <div class="input-group input-group-sm">
                        <span class="input-group-text">Source</span>
                        <select class="form-select" 
                               .value="${this.branchesEmit}"
                               @change="${e => this.branchesEmit = e.target.value}"
                               ?disabled="${this.loading}">
                          <option value="">Select source branch</option>
                          ${Object.entries(this.branches).map(([code, name]) => html`
                            <option value="${code}">${code} - ${name}</option>
                          `)}
                        </select>
                      </div>
                    </div>
                    
                    <div class="col-md-4">
                      <div class="input-group input-group-sm fancy-dropdown">
                        <span class="input-group-text">Destination</span>
                        <button class="form-select fancy-dropdown-toggle text-start" 
                                @click="${this.toggleDestinationDropdown}"
                                ?disabled="${this.loading}">
                          ${this.getDestBranchesDisplayText()}
                        </button>
                        ${this.showDestDropdown ? this.renderDestinationDropdown() : ''}
                      </div>
                    </div>
                    
                    <div class="col-md-4 d-flex gap-1 align-items-center">
                      <div class="form-check form-switch" data-bs-toggle="tooltip" data-bs-placement="top" 
                           data-bs-trigger="hover"
                           title="Affects data loading: filters items based on necessity conditions at destination">
                        <input class="form-check-input" type="checkbox"
                               id="setConditionForNecesar"
                               .checked="${this.setConditionForNecesar}"
                               @change="${e => this.setConditionForNecesar = e.target.checked}"
                               ?disabled="${this.loading}">
                        <label class="form-check-label small" for="setConditionForNecesar">
                            Necesar
                        </label>
                      </div>
                      
                      <div class="form-check form-switch" data-bs-toggle="tooltip" data-bs-placement="top" 
                           data-bs-trigger="hover"
                           title="Affects data loading: only shows items with min/max limits defined">
                        <input class="form-check-input" type="checkbox"
                               id="setConditionForLimits"
                               .checked="${this.setConditionForLimits}"
                               @change="${e => this.setConditionForLimits = e.target.checked}"
                               ?disabled="${this.loading}">
                        <label class="form-check-label small" for="setConditionForLimits">
                            Min/Max
                        </label>
                      </div>
                      
                      <button class="btn btn-sm btn-primary" @click="${this.loadData}" ?disabled="${this.loading}">
                        ${this.loading ?
                          html`<span class="spinner-border spinner-border-sm me-1"></span> Loading...` :
                          html`<i class="bi bi-arrow-repeat me-1"></i> Load`}
                      </button>
                    </div>
                  </div>
                </div>
                
                <div class="col-md-3 text-end">
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-success" @click="${this.saveData}" ?disabled="${this.loading}">
                      <i class="bi bi-save"></i> Save
                    </button>
                    <button class="btn btn-secondary" @click="${this.exportToExcel}" ?disabled="${this.loading}">
                      <i class="bi bi-file-excel"></i> Export
                    </button>
                    <button class="btn btn-outline-secondary" @click="${this.toggleZenMode}" title="Toggle zen mode">
                      <i class="bi ${this.viewMode === 'zen' ? 'bi-fullscreen-exit' : 'bi-fullscreen'}"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('branch-replenishment', BranchReplenishment);