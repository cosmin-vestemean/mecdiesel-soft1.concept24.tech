import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { connectToS1 } from '../dataFetching.js';
import { client } from '../socketConfig.js';

export class BranchReplenishment extends LitElement {
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
      stockStatusFilter: { type: String } // New property for stock status filtering
    };
  }

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    this.branchesEmit = '';
    this.branchesDest = '';
    this.selectedDestBranches = [];
    this.fiscalYear = new Date().getFullYear();
    this.data = [];
    this.token = '';
    this.loading = false;
    this.error = '';
    this.searchTerm = '';
    this.destSearchTerm = '';
    this.showDestDropdown = false;
    this.setConditionForNecesar = true;
    this.setConditionForLimits = true;
    this.selectedReplenishmentStrategy = 'none';
    this.transferFilter = 'all';
    this.destinationFilter = 'all';
    this.isSuccessiveStrategy = true;
    this.stockStatusFilter = 'all'; // Initialize stock status filter to show all items
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
  }

  // Moved to class level for reuse in filtering
  getStockClass(value, minLimit, maxLimit) {
    const stock = parseFloat(value);
    const min = parseFloat(minLimit);
    const max = parseFloat(maxLimit);
    
    // Handle NaN cases
    if (isNaN(stock)) return '';
    
    // Critical under-stock situation (below minimum)
    if (!isNaN(min) && stock < min) {
      return 'text-danger stock-critical';
    }
    
    // Optimal stock level (between min and max)
    if (!isNaN(min) && !isNaN(max) && stock >= min && stock <= max) {
      return 'text-dark stock-optimal';
    }
    
    // Over-stock situation (above maximum)
    if (!isNaN(max) && stock > max) {
      return 'text-success stock-high';
    }
    
    // If min/max not defined but stock exists - use text-warning
    if (stock > 0) {
      return 'text-warning stock-undefined';
    }
    
    // No stock
    return 'text-muted';
  }

  getValueClass(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return '';
    return num < 0 ? 'text-danger fw-bold' : (num > 0 ? 'text-success' : 'text-muted');
  }

  getDestBranchesString() {
    return this.selectedDestBranches.join(',');
  }

  getDestBranchesDisplayText() {
    if (this.selectedDestBranches.length === 0) return 'Select branches';
    if (this.selectedDestBranches.length === 1) {
      const code = this.selectedDestBranches[0];
      return `${code} - ${this.branches[code] || ''}`;
    }
    return `${this.selectedDestBranches.length} branches selected`;
  }

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

  closeDestDropdown = () => {
    this.showDestDropdown = false;
    document.removeEventListener('click', this.closeDestDropdown);
  }

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

  selectAllDestBranches(e) {
    e.stopPropagation();
    const allBranchCodes = Object.keys(this.branches);
    this.selectedDestBranches = [...allBranchCodes];
  }

  clearDestBranches(e) {
    e.stopPropagation();
    this.selectedDestBranches = [];
  }

  handleDropdownClick(e) {
    e.stopPropagation(); // Keep dropdown open when clicking inside
  }

  async loadData() {
    this.loading = true;
    this.error = '';

    try {
      if (!this.branchesEmit) {
        throw new Error('Please select a source branch');
      }

      if (this.selectedDestBranches.length === 0) {
        throw new Error('Please select at least one destination branch');
      }

      const branchesDest = this.getDestBranchesString();

      const token = await new Promise((resolve, reject) => {
        connectToS1((token) => {
          if (!token) {
            reject(new Error('Failed to get token'));
            return;
          }
          resolve(token);
        });
      });

      const response = await client.service('s1').getAnalyticsForBranchReplenishment({
        clientID: token,
        branchesEmit: this.branchesEmit,
        branchesDest: branchesDest,
        fiscalYear: this.fiscalYear,
        company: 1000,
        setConditionForNecesar: this.setConditionForNecesar,
        setConditionForLimits: this.setConditionForLimits
      });

      this.data = Array.isArray(response) ? response : [];

    } catch (error) {
      console.error('Error loading branch replenishment data:', error);
      this.error = `Error loading data: ${error.message}`;
      this.data = [];
    } finally {
      this.loading = false;
      this.requestUpdate();
    }
  }

  onTransferChange(e, item) {
    item.transfer = parseFloat(e.target.value || 0);
    this.requestUpdate();
  }

  handleKeyNav(e) {
    const cell = e.target;
    const row = parseInt(cell.dataset.rowIndex);
    const col = parseInt(cell.dataset.colIndex);
    const tableCells = document.querySelectorAll('.compact-input[data-row-index]');

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
      case 'Tab':
        break;
    }
  }

  saveData() {
    console.log('Transfers to process:', this.data.map(item => item.transfer));
  }

  exportToExcel() {
    if (!this.data.length) {
      console.warn('No data to export');
      return;
    }

    const exportData = this.filterData().map(item => ({
      'mtrl': item.mtrl,
      'Code': item.Cod,
      'Description': item.Descriere,
      'Destination': item.Destinatie,
      'Blacklisted': item.Blacklisted,
      'InLichidare': item.InLichidare,
      'Stock Emit': parseFloat(item.stoc_emit) || 0,
      'Min Emit': parseFloat(item.min_emit) || 0,
      'Max Emit': parseFloat(item.max_emit) || 0,
      'Disp Min': parseFloat(item.disp_min_emit) || 0,
      'Disp Max': parseFloat(item.disp_max_emit) || 0,
      'Stock Dest': parseFloat(item.stoc_dest) || 0,
      'Min Dest': parseFloat(item.min_dest) || 0,
      'Max Dest': parseFloat(item.max_dest) || 0,
      'Orders': parseFloat(item.comenzi) || 0,
      'In Transfer': parseFloat(item.transf_nerec) || 0,
      'Nec Min': parseFloat(item.nec_min) || 0,
      'Nec Max': parseFloat(item.nec_max) || 0,
      'Nec Min Comp': parseFloat(item.nec_min_comp) || 0,
      'Nec Max Comp': parseFloat(item.nec_max_comp) || 0,
      'Qty Min': parseFloat(item.cant_min) || 0,
      'Qty Max': parseFloat(item.cant_max) || 0,
      'Transfer': parseFloat(item.transfer) || 0
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Branch Replenishment');
    const date = new Date().toISOString().split('T')[0];
    const filename = `branch_replenishment_${date}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

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

  clearTransfers() {
    this.filterData().forEach(item => {
      item.transfer = 0;
    });
  }

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
        const stockClass = this.getStockClass(item.stoc_dest, item.min_dest, item.max_dest);
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

  getUniqueDestinations() {
    if (!this.data || this.data.length === 0) {
      return [];
    }

    const destinations = [...new Set(this.data.map(item => item.Destinatie))];
    return destinations.sort();
  }

  updated() {
    const tooltipTriggerList = [].slice.call(this.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.forEach(tooltipTriggerEl => {
      new bootstrap.Tooltip(tooltipTriggerEl);
    });
  }

  renderRow(item, index) {
    const descriere = (item.Descriere || '').substring(0, 50);
    
    // Function to wrap stock values in span for optimal stock styling
    const renderStockValue = (value, minLimit, maxLimit) => {
      const stockClass = this.getStockClass(value, minLimit, maxLimit);
      if (stockClass.includes('stock-optimal')) {
        return html`<span>${value}</span>`;
      }
      return value;
    };

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
            <td class="group-source ${this.getStockClass(item.stoc_emit, item.min_emit, item.max_emit)}">${renderStockValue(item.stoc_emit, item.min_emit, item.max_emit)}</td>
            <td class="group-source ${this.getValueClass(item.min_emit)}">${item.min_emit}</td>
            <td class="group-source ${this.getValueClass(item.max_emit)}">${item.max_emit}</td>
            <td class="group-source vertical-divider ${this.getValueClass(item.disp_min_emit)}">${item.disp_min_emit}</td>
            <td class="group-source ${this.getValueClass(item.disp_max_emit)}">${item.disp_max_emit}</td>
            <td class="group-destination vertical-divider ${this.getStockClass(item.stoc_dest, item.min_dest, item.max_dest)}">${renderStockValue(item.stoc_dest, item.min_dest, item.max_dest)}</td>
            <td class="group-destination ${this.getValueClass(item.min_dest)}">${item.min_dest}</td>
            <td class="group-destination ${this.getValueClass(item.max_dest)}">${item.max_dest}</td>
            <td class="group-destination vertical-divider ${this.getValueClass(item.comenzi)}">${item.comenzi}</td>
            <td class="group-destination ${this.getValueClass(item.transf_nerec)}">${item.transf_nerec}</td>
            <td class="group-necessity vertical-divider ${this.getValueClass(item.nec_min)}">${item.nec_min}</td>
            <td class="group-necessity ${this.getValueClass(item.nec_max)}">${item.nec_max}</td>
            <td class="group-necessity ${this.getValueClass(item.nec_min_comp)}">${item.nec_min_comp}</td>
            <td class="group-necessity ${this.getValueClass(item.nec_max_comp)}">${item.nec_max_comp}</td>
            <td class="group-action vertical-divider ${this.getValueClass(item.cant_min)}">${item.cant_min}</td>
            <td class="group-action ${this.getValueClass(item.cant_max)}">${item.cant_max}</td>
            <td class="group-action">
              <input
                class="compact-input ${this.getValueClass(item.transfer)}"
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

  render() {
    const filteredData = this.filterData();
    const totalCount = this.data.length;
    const filteredCount = filteredData.length;
    const uniqueDestinations = this.getUniqueDestinations();

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
          padding: 5px 8px;
          border-bottom: 1px solid #eee;
          background: #f8f9fa;
        }
        .fancy-dropdown-items {
          overflow-y: auto;
          max-height: 230px;
        }
        .fancy-dropdown-item {
          padding: 6px 12px;
          cursor: pointer;
        }
        .fancy-dropdown-item:hover {
          background: #f8f9fa;
        }
        .fancy-dropdown-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }
        .fancy-dropdown-toggle:after {
          content: '';
          border-top: 0.3em solid;
          border-right: 0.3em solid transparent;
          border-left: 0.3em solid transparent;
          margin-left: 8px;
        }
        
        /* Add vertical dividers between logical column groups */
        .vertical-divider {
          border-left: 1px solid #dee2e6;
        }
        
        /* Add subtle background color to group columns visually */
        .group-source {
          background-color: rgba(240, 249, 255, 0.5);
        }
        
        .group-destination {
          background-color: rgba(240, 255, 240, 0.5);
        }
        
        .group-necessity {
          background-color: rgba(255, 248, 240, 0.5);
        }
        
        .group-action {
          background-color: rgba(249, 240, 255, 0.5);
        }
        
        /* Status indicator legend */
        .status-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          padding: 10px;
          background-color: #f8f9fa;
          border-radius: 5px;
          margin-bottom: 10px;
          border: 1px solid #dee2e6;
        }
        
        .legend-item {
          display: flex;
          align-items: center;
          font-size: 0.85rem;
          cursor: pointer;
          padding: 4px 10px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        
        .legend-item:hover {
          background-color: rgba(0,0,0,0.05);
        }
        
        .legend-item.active {
          background-color: rgba(13, 110, 253, 0.1);
          border: 1px solid rgba(13, 110, 253, 0.3);
        }
        
        .legend-item:not(.active) {
          opacity: 0.85;
        }
        
        .legend-count {
          margin-left: 5px;
          background-color: rgba(0,0,0,0.1);
          border-radius: 10px;
          min-width: 20px;
          height: 20px;
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 6px;
        }
        
        .legend-indicator {
          width: 22px;
          height: 22px;
          margin-right: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #dee2e6;
          background-color: white;
          position: relative;
        }
        
        .legend-indicator.critical::before {
          content: "▼";
          color: #dc3545;
          font-size: 10px;
          position: relative;
          top: -2px;
        }
        
        .legend-indicator.optimal {
          background-color: rgba(25, 135, 84, 0.2);
          border-radius: 3px;
          position: relative;
          border: 1px solid rgba(25, 135, 84, 0.4);
        }
        
        .legend-indicator.optimal::after {
          content: "✓";
          position: absolute;
          color: #0f5132;
          font-size: 12px;
          font-weight: bold;
          z-index: 1;
        }
        
        .legend-indicator.high::before {
          content: "▲";
          color: #198754;
          font-size: 10px;
          position: relative;
          top: -1px;
        }
        
        /* New improved stock status indicator styles */
        .stock-critical {
          position: relative;
        }
        .stock-critical::before {
          content: "▼";
          position: absolute;
          top: -2px;
          right: 2px;
          color: #dc3545;
          font-size: 10px;
        }
        
        .stock-optimal {
          position: relative;
          font-weight: 500;
          color: #0f5132 !important;
        }
        
        .stock-optimal::after {
          content: "✓";
          position: absolute;
          top: 0;
          right: 2px;
          color: rgba(25, 135, 84, 0.7);
          font-size: 10px;
          font-weight: bold;
        }
        
        .stock-high {
          position: relative;
        }
        .stock-high::before {
          content: "▲";
          position: absolute;
          top: -1px;
          right: 2px;
          color: #198754;
          font-size: 10px;
        }
      </style>
      <div class="container-fluid">
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
        
        <!-- Status Legend -->
        <div class="status-legend mb-3">
          <div class="legend-item ${this.stockStatusFilter === 'critical' ? 'active' : ''}" @click="${() => { this.stockStatusFilter = 'critical'; this.requestUpdate(); }}">
            <div class="legend-indicator critical"></div>
            <span>Under Min Stock</span>
            <span class="legend-count">${this.filterData().filter(item => this.getStockClass(item.stoc_dest, item.min_dest, item.max_dest).includes('stock-critical')).length}</span>
          </div>
          <div class="legend-item ${this.stockStatusFilter === 'optimal' ? 'active' : ''}" @click="${() => { this.stockStatusFilter = 'optimal'; this.requestUpdate(); }}">
            <div class="legend-indicator optimal"></div>
            <span>Optimal Stock (Min-Max)</span>
            <span class="legend-count">${this.filterData().filter(item => this.getStockClass(item.stoc_dest, item.min_dest, item.max_dest).includes('stock-optimal')).length}</span>
          </div>
          <div class="legend-item ${this.stockStatusFilter === 'high' ? 'active' : ''}" @click="${() => { this.stockStatusFilter = 'high'; this.requestUpdate(); }}">
            <div class="legend-indicator high"></div>
            <span>Over Max Stock</span>
            <span class="legend-count">${this.filterData().filter(item => this.getStockClass(item.stoc_dest, item.min_dest, item.max_dest).includes('stock-high')).length}</span>
          </div>
          <div class="legend-item ${this.stockStatusFilter === 'undefined' ? 'active' : ''}" @click="${() => { this.stockStatusFilter = 'undefined'; this.requestUpdate(); }}">
            <div class="legend-indicator"></div>
            <span>No Min/Max Defined</span>
            <span class="legend-count">${this.filterData().filter(item => this.getStockClass(item.stoc_dest, item.min_dest, item.max_dest).includes('stock-undefined')).length}</span>
          </div>
          <div class="legend-item ${this.stockStatusFilter === 'all' ? 'active' : ''}" @click="${() => { this.stockStatusFilter = 'all'; this.requestUpdate(); }}">
            <div class="legend-indicator"></div>
            <span>All Items</span>
            <span class="legend-count">${this.filterData().length}</span>
          </div>
        </div>
        
        <div class="table-responsive">
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
              ${this.filterData().map((item, index) => this.renderRow(item, index))}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}

customElements.define('branch-replenishment', BranchReplenishment);

/*
To Copilot: Do not remove the comments below. They are important for future reference.
TODO:
26.03.2025:
stategie distribuie marfa insuficienta in emit conform Top ABC vanzari per sucursale (produsele care nu au min max calculat nu are vanzari) (ABC se face dupa valoare vanzari => un procent si o etcheta), poate in formula de calcul vanzari in SQL; salvez info procent + eticheta (A, B, C) in mtrbrnlimits in doua coloane noi; necesar companie < necesar sucursala => transfer conform ABC
filtre: afiseaza cele cu transfer > 0 sau 0 (in acp tabel)
cap de tabel sticky
tooltips pe th cu descriere formula, colo unde este cazul
linia 309: WHERE (bl_dest.MaxLimit > 0 OR bl_dest.MinLimit > 0) devine parametrizata in UI
filtru destinatie in cap tabel cu sucursalele + toate => vizualizare doar a celor selectate
strategiile se aplica succesiv (cu istoric aplicare?)
ranking sucursala (se va discuta in viitor)
fiscal year erased from UI

Predat in etapa 1 de facturare, a se folosi la predari incrementale:

Q: Creaza o lista succinta cu cele mai importante aspecte ale modulului branch replenishment.

A:
Key Aspects of the Branch Replenishment Module
Purpose: Manages inventory transfers between branches based on stock levels, min/max limits, and demand

Core Functionality:

Source to multiple destination branch transfers
Real-time stock availability and necessity calculations
Smart transfer quantity recommendations (min/max)
Blacklisted item management
Intelligent Stock Analysis:

Current stock levels at source and destination branches
Min/max stock limits for all locations
Available stock calculations (disp_min, disp_max)
Pending orders and in-transit inventory tracking
Automated Replenishment Strategies:

Min quantities application
Max quantities application
Blacklisted item handling
Successive strategy application (targeting only zero transfers)
User Experience Features:

Multi-destination branch selection
Advanced filtering options (by transfer status, destination)
Real-time search capabilities
Keyboard navigation for efficient data entry
Data export to Excel
Technical Integration:

Direct connection with ERP system (S1)
Complex SQL calculations for stock availability
Transfer necessity algorithms based on multiple parameters
Real-time data updates using Lit Element framework

02.04.2025:
-export Excel coloanele de la D-T sa fie de tip numeric, acum este text OK
-pending orders: tip: 3130 (stocuri) + toate comenzile transfer spre destinatiile alese in intefata (ignor emitentul) OK
-la fel la transfer, nu tine cont de emitent, doar destinatii + ia in considerare branchsec drept destinatie (whousesec este null tot timpul) OK
-nec min max comp trebuie sa exclud emitent si NU este suma din mtrbrnlimits ci suma de Nec Min sau Nec Max calculat (indiferent de selectie destinatie, suma este per companie = total branches, excluzand branch emitere) OK
-adauga in cautarea in baza de date un mtrl pentru teste: nice to have
---TOP ABC:
70, 20, 10 parametrizabil per companie si sucursala
-calculul TOP ABC va scrie rezultatele intr-o tabela dedicata, astfel incat daac un reper nu are min max in MTRBRNLIMITS, poate totusi avea ABC
-ABC se va face pe baza de vanzari in perioada 1 an, 6 luni, 3 luni, 1 luna si custom
-calcul top ABC genereaza atat rank (A,B,C) cat si procentul de vanzari
-companie este HQ (1000)
-se tine doar ultimul calcul (se sterg cele vechi)
-selectia coduri ca si la algoritmul de min max (anume docs si reguli ca la min max)

11.04.2025:
PRIORITAR:
-daca disponibil > 0 && disponibil - necesar < 0 => disponibil in cantitate (min/max) OK
-adauga mtrl inainte de cod in tabel si export OK
-sortare pe calup destinatii cu vizualizare in interfata calupuri destinatii
-filtre per coloanele numerice OK
-freeze la capul de tabel
-zen view OK (quick panel)
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!Login cu S1 credentials, doar ca o poarta, fara drepturi si asa!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!


1. bug dropdown destinatie
2. login poarta in platforma
3. TOP ABC per companie si sucursala
*/