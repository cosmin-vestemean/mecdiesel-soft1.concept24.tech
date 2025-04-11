import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { branchReplenishmentStyles } from './styles.js';
import { connectToS1 } from '../../dataFetching.js';
import { client } from '../../socketConfig.js';
import { getStockClass, getValueClass, renderStockValue } from './utils/stock-calculations.js';
import { filterData, getUniqueDestinations, getStockStatusCounts } from './utils/filtering.js';
import { exportToExcel } from './utils/export.js';
import { BranchReplenishmentState } from './utils/state-management.js';

/**
 * Branch Replenishment Component
 * 
 * Provides interface for managing stock replenishment between branches
 */
export class BranchReplenishment extends LitElement {
  static get styles() {
    return [branchReplenishmentStyles];
  }

  createRenderRoot() {
    const root = super.createRenderRoot();
    return root;
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
    let filtered = this.data;

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        (item.Cod && item.Cod.toLowerCase().includes(term)) ||
        (item.Descriere && item.Descriere.toLowerCase().includes(term))
      );
    }

    if (this.transferFilter !== 'all') {
      filtered = filtered.filter(item => {
        const transfer = parseFloat(item.transfer || 0);
        return this.transferFilter === 'positive' ? transfer > 0 : transfer === 0;
      });
    }

    if (this.destinationFilter !== 'all') {
      filtered = filtered.filter(item =>
        item.Destinatie === this.destinationFilter
      );
    }

    if (this.stockStatusFilter !== 'all') {
      filtered = filtered.filter(item => {
        const stockClass = getStockClass(item.stoc_dest, item.min_dest, item.max_dest);
        switch (this.stockStatusFilter) {
          case 'critical':
            return stockClass.includes('stock-critical');
          case 'optimal':
            return stockClass.includes('stock-optimal');
          case 'high':
            return stockClass.includes('stock-high');
          case 'undefined':
            return stockClass.includes('stock-undefined');
          default:
            return true;
        }
      });
    }

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
   * Setup tooltips after component update
   */
  updated() {
    const tooltipTriggerList = [].slice.call(this.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.forEach(tooltipTriggerEl => {
      new bootstrap.Tooltip(tooltipTriggerEl);
    });
  }

  /**
   * Render a single table row
   */
  renderRow(item, index) {
    const descriere = (item.Descriere || '').substring(0, 50);
    
    return html`
      <tr>
        <td class="text-center">${index + 1}</td>
        <td style="display:none">${item.keyField}</td>
        <td style="display:none">${item.mtrl}</td>
        <td>${item.Cod}</td>
        <td class="text-truncate" style="max-width: 200px;" title="${item.Descriere}">${descriere}</td>
        <td style="display:none">${item.branchD}</td>
        <td>${item.Destinatie}</td>
        <td class="${item.Blacklisted === 'Da' ? 'text-danger fw-bold' : ''}">${item.Blacklisted}</td>
        <td class="${item.InLichidare === 'Da' ? 'text-warning fw-bold' : ''}">${item.InLichidare}</td>
        <td class="group-source ${getStockClass(item.stoc_emit, item.min_emit, item.max_emit)}">${item.stoc_emit}</td>
        <td class="group-source ${getValueClass(item.min_emit)}">${item.min_emit}</td>
        <td class="group-source ${getValueClass(item.max_emit)}">${item.max_emit}</td>
        <td class="group-source vertical-divider ${getValueClass(item.disp_min_emit)}">${item.disp_min_emit}</td>
        <td class="group-source ${getValueClass(item.disp_max_emit)}">${item.disp_max_emit}</td>
        <td class="group-destination vertical-divider ${getStockClass(item.stoc_dest, item.min_dest, item.max_dest)}">${item.stoc_dest}</td>
        <td class="group-destination ${getValueClass(item.min_dest)}">${item.min_dest}</td>
        <td class="group-destination ${getValueClass(item.max_dest)}">${item.max_dest}</td>
        <td class="group-destination vertical-divider ${getValueClass(item.comenzi)}">${item.comenzi}</td>
        <td class="group-destination ${getValueClass(item.transf_nerec)}">${item.transf_nerec}</td>
        <td class="group-necessity vertical-divider ${getValueClass(item.nec_min)}">${item.nec_min}</td>
        <td class="group-necessity ${getValueClass(item.nec_max)}">${item.nec_max}</td>
        <td class="group-necessity ${getValueClass(item.nec_min_comp)}">${item.nec_min_comp}</td>
        <td class="group-necessity ${getValueClass(item.nec_max_comp)}">${item.nec_max_comp}</td>
        <td class="group-action vertical-divider ${getValueClass(item.cant_min)}">${item.cant_min}</td>
        <td class="group-action ${getValueClass(item.cant_max)}">${item.cant_max}</td>
        <td class="group-action">
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
        </td>
      </tr>
    `;
  }

  /**
   * Render destination dropdown
   */
  renderDestinationDropdown() {
    const filteredBranches = this.destSearchTerm
      ? Object.entries(this.branches).filter(([code, name]) =>
        code.includes(this.destSearchTerm) ||
        name.toLowerCase().includes(this.destSearchTerm.toLowerCase()))
      : Object.entries(this.branches);

    return html`
      <div class="fancy-dropdown-menu" @click="${this.handleDropdownClick}">
        <div class="fancy-dropdown-header">
          <div class="input-group input-group-sm">
            <input type="text" class="form-control" placeholder="Search branches..." 
                   .value="${this.destSearchTerm}" 
                   @input="${e => this.destSearchTerm = e.target.value}" />
          </div>
        </div>
        <div class="fancy-dropdown-actions">
          <button class="btn btn-sm btn-link" @click="${this.selectAllDestBranches}">Select All</button>
          <button class="btn btn-sm btn-link" @click="${this.clearDestBranches}">Clear All</button>
        </div>
        <div class="fancy-dropdown-items">
          ${filteredBranches.map(([code, name]) => html`
            <div class="fancy-dropdown-item">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="dest-${code}"
                       .checked="${this.selectedDestBranches.includes(code)}"
                       @click="${e => this.toggleDestBranch(code, e)}" />
                <label class="form-check-label" for="dest-${code}">
                  ${code} - ${name}
                </label>
              </div>
            </div>
          `)}
        </div>
      </div>
    `;
  }
  
  /**
   * Render the stock status legend with clickable filters
   */
  renderStockStatusLegend(filteredData) {
    const statusCounts = getStockStatusCounts(filteredData, getStockClass);
    
    return html`
      <div class="status-legend mb-3">
        <div class="legend-item ${this.stockStatusFilter === 'critical' ? 'active' : ''}" 
             @click="${() => { this.stockStatusFilter = 'critical'; this.requestUpdate(); }}">
          <div class="legend-indicator critical"></div>
          <span>Under Min Stock</span>
          <span class="legend-count">${statusCounts.critical}</span>
        </div>
        <div class="legend-item ${this.stockStatusFilter === 'optimal' ? 'active' : ''}" 
             @click="${() => { this.stockStatusFilter = 'optimal'; this.requestUpdate(); }}">
          <div class="legend-indicator optimal"></div>
          <span>Optimal Stock (Min-Max)</span>
          <span class="legend-count">${statusCounts.optimal}</span>
        </div>
        <div class="legend-item ${this.stockStatusFilter === 'high' ? 'active' : ''}" 
             @click="${() => { this.stockStatusFilter = 'high'; this.requestUpdate(); }}">
          <div class="legend-indicator high"></div>
          <span>Over Max Stock</span>
          <span class="legend-count">${statusCounts.high}</span>
        </div>
        <div class="legend-item ${this.stockStatusFilter === 'undefined' ? 'active' : ''}" 
             @click="${() => { this.stockStatusFilter = 'undefined'; this.requestUpdate(); }}">
          <div class="legend-indicator"></div>
          <span>No Min/Max Defined</span>
          <span class="legend-count">${statusCounts.undefined}</span>
        </div>
        <div class="legend-item ${this.stockStatusFilter === 'all' ? 'active' : ''}" 
             @click="${() => { this.stockStatusFilter = 'all'; this.requestUpdate(); }}">
          <div class="legend-indicator"></div>
          <span>All Items</span>
          <span class="legend-count">${statusCounts.all}</span>
        </div>
      </div>
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

    return html`
      <div class="container-fluid ${zenModeClass}">
        ${this.error ? html`<div class="alert alert-danger">${this.error}</div>` : ''}
        
        <div class="card mb-3 border-light shadow-sm">
          <div class="card-body p-3">
            <div class="row">
              <div class="col-md-9">
                <div class="row align-items-center">
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
                  
                  <div class="col-md-4 d-flex align-items-center">
                    <div class="form-check form-switch me-3" data-bs-toggle="tooltip" data-bs-placement="top" 
                         data-bs-trigger="hover"
                         title="Affects data loading: filters items based on necessity conditions at destination">
                      <input class="form-check-input" type="checkbox"
                             id="setConditionForNecesar"
                             .checked="${this.setConditionForNecesar}"
                             @change="${e => this.setConditionForNecesar = e.target.checked}"
                             ?disabled="${this.loading}">
                      <label class="form-check-label" for="setConditionForNecesar">
                          Conditie Necesar
                      </label>
                    </div>
                    
                    <div class="form-check form-switch me-3" data-bs-toggle="tooltip" data-bs-placement="top" 
                         data-bs-trigger="hover"
                         title="Affects data loading: only shows items with min/max limits defined">
                      <input class="form-check-input" type="checkbox"
                             id="setConditionForLimits"
                             .checked="${this.setConditionForLimits}"
                             @change="${e => this.setConditionForLimits = e.target.checked}"
                             ?disabled="${this.loading}">
                      <label class="form-check-label" for="setConditionForLimits">
                          Limite Min/Max
                      </label>
                    </div>
                    
                    <button class="btn btn-sm btn-primary" @click="${this.loadData}" ?disabled="${this.loading}">
                      ${this.loading ?
        html`<span class="spinner-border spinner-border-sm me-1"></span> Loading...` :
        html`<i class="bi bi-arrow-repeat me-1"></i> Load Data`}
                    </button>
                  </div>
                </div>
              </div>
              
              <div class="col-md-3 text-end">
                <button class="btn btn-sm btn-outline-secondary me-1" @click="${this.toggleZenMode}" ?disabled="${this.loading}">
                  <i class="bi bi-fullscreen me-1"></i> ${this.viewMode === 'zen' ? 'Normal View' : 'Zen Mode'}
                </button>
                <button class="btn btn-sm btn-success me-1" @click="${this.saveData}" ?disabled="${this.loading}">
                  <i class="bi bi-save me-1"></i> Save
                </button>
                <button class="btn btn-sm btn-secondary" @click="${this.exportToExcel}" ?disabled="${this.loading}">
                  <i class="bi bi-file-excel me-1"></i> Export
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="d-flex justify-content-between mb-3">
          <div class="d-flex gap-2 flex-grow-1">
            <div class="input-group input-group-sm" style="max-width: 400px;">
              <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
              <input type="text" class="form-control" placeholder="Search by code or description..."
                     .value="${this.searchTerm}" 
                     @input="${e => { this.searchTerm = e.target.value; this.requestUpdate(); }}" />
              ${this.searchTerm ? html`
                <button class="btn btn-outline-secondary" @click="${() => { this.searchTerm = ''; this.requestUpdate(); }}">
                  <i class="bi bi-x"></i>
                </button>` : ''}
            </div>
            
            <div class="btn-group btn-group-sm" role="group">
              <input type="radio" class="btn-check" name="transferFilter" id="all"
                     .checked="${this.transferFilter === 'all'}"
                     @change="${() => { this.transferFilter = 'all'; this.requestUpdate(); }}"
                     autocomplete="off">
              <label class="btn btn-outline-secondary" for="all">All Items</label>
              
              <input type="radio" class="btn-check" name="transferFilter" id="positive"
                     .checked="${this.transferFilter === 'positive'}"
                     @change="${() => { this.transferFilter = 'positive'; this.requestUpdate(); }}"
                     autocomplete="off">
              <label class="btn btn-outline-secondary" for="positive">With Transfer</label>
              
              <input type="radio" class="btn-check" name="transferFilter" id="zero"
                     .checked="${this.transferFilter === 'zero'}"
                     @change="${() => { this.transferFilter = 'zero'; this.requestUpdate(); }}"
                     autocomplete="off">
              <label class="btn btn-outline-secondary" for="zero">No Transfer</label>
            </div>
          </div>
          
          <div class="text-muted small align-self-center">
            ${filteredCount === totalCount
        ? html`Showing all <span class="fw-bold">${totalCount}</span> items`
        : html`Showing <span class="fw-bold">${filteredCount}</span> of <span class="fw-bold">${totalCount}</span> items`}
          </div>
        </div>
        
        <div class="card mb-3 bg-light border-light">
          <div class="card-body p-2">
            <div class="row align-items-center">
              <div class="col-auto">
                <label class="col-form-label-sm fw-bold">Auto Replenishment:</label>
              </div>
              <div class="col-auto">
                <select class="form-select form-select-sm" 
                        .value="${this.selectedReplenishmentStrategy}"
                        @change="${e => this.selectedReplenishmentStrategy = e.target.value}"
                        ?disabled="${this.loading}"
                        style="width: auto;">
                  <option value="none">Select Strategy</option>
                  <option value="min">Apply Min Quantities</option>
                  <option value="max">Apply Max Quantities</option>
                  <option value="skip_blacklisted">Skip Blacklisted Items</option>
                  <option value="clear">Clear All Transfers</option>
                </select>
              </div>
              <div class="col-auto">
                <button class="btn btn-sm btn-primary" @click="${this.applyReplenishmentStrategy}" ?disabled="${this.loading}">
                  Apply
                </button>
              </div>
              <div class="col-auto ms-2">
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" id="successiveStrategy"
                         .checked="${this.isSuccessiveStrategy}"
                         @change="${e => this.isSuccessiveStrategy = e.target.checked}">
                  <label class="form-check-label" for="successiveStrategy">
                    Apply only to remaining zeros
                  </label>
                  <i class="bi bi-info-circle text-muted ms-1" 
                     data-bs-toggle="tooltip" 
                     title="When enabled, strategies are applied only to items with zero transfers, allowing successive strategy application"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Stock Status Legend -->
        ${this.renderStockStatusLegend(filteredData)}
        
        <!-- Table Container with Sticky Header -->
        <div class="table-container">
          <table class="table table-sm table-hover table-responsive modern-table compact-table">
            <thead class="sticky-top bg-light">
              <tr>
                <th>#</th>
                <th style="display:none;">keyField</th>
                <th style="display:none;">mtrl</th>
                <th>Cod</th>
                <th>Descriere</th>
                <th style="display:none">Branch</th>
                <th>
                  <div class="input-group input-group-sm">
                    <select class="form-select form-select-sm border-0 bg-light"
                            .value="${this.destinationFilter}"
                            @change="${e => {
        this.destinationFilter = e.target.value;
        this.requestUpdate();
      }}">
                      <option value="all">All Dest.</option>
                      ${uniqueDestinations.map(dest => html`
                        <option value="${dest}">${dest}</option>
                      `)}
                    </select>
                  </div>
                </th>
                <th>Blacklisted</th>
                <th>In Lichidare</th>
                <th class="group-source">Stoc Emit</th>
                <th class="group-source">Min Emit</th>
                <th class="group-source">Max Emit</th>
                <th class="group-source vertical-divider">Disp Min</th>
                <th class="group-source">Disp Max</th>
                <th class="group-destination vertical-divider">Stoc Dest</th>
                <th class="group-destination">Min Dest</th>
                <th class="group-destination">Max Dest</th>
                <th class="group-destination vertical-divider">Com.</th>
                <th class="group-destination">In transf.</th>
                <th class="group-necessity vertical-divider">Nec Min</th>
                <th class="group-necessity">Nec Max</th>
                <th class="group-necessity">Nec Min Comp</th>
                <th class="group-necessity">Nec Max Comp</th>
                <th class="group-action vertical-divider">Cant Min</th>
                <th class="group-action">Cant Max</th>
                <th class="group-action">Transf.</th>
              </tr>
            </thead>
            <tbody>
              ${filteredData.map((item, index) => this.renderRow(item, index))}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}

customElements.define('branch-replenishment', BranchReplenishment);