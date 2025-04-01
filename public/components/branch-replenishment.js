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
            branches: { type: Object }
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
            'Code': item.Cod,
            'Description': item.Descriere,
            'Destination': item.Destinatie,
            'Stock Emit': item.stoc_emit,
            'Min Emit': item.min_emit,
            'Max Emit': item.max_emit,
            'Disp Min': item.disp_min_emit,
            'Disp Max': item.disp_max_emit,
            'Stock Dest': item.stoc_dest,
            'Min Dest': item.min_dest,
            'Max Dest': item.max_dest,
            'Orders': item.comenzi,
            'In Transfer': item.transf_nerec,
            'Nec Min': item.nec_min,
            'Nec Max': item.nec_max,
            'Nec Min Comp': item.nec_min_comp,
            'Nec Max Comp': item.nec_max_comp,
            'Qty Min': item.cant_min,
            'Qty Max': item.cant_max,
            'Transfer': item.transfer || 0
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
        
        switch(this.selectedReplenishmentStrategy) {
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
        const getValueClass = (value) => {
            const num = parseFloat(value);
            return num < 0 ? 'text-danger fw-bold' : '';
        };

        return html`
          <tr class="${item.Blacklisted === '-' ? '' : 'table-danger'}">
            <td class="text-center">${index + 1}</td>
            <td style="display:none">${item.keyField}</td>
            <td style="display:none">${item.mtrl}</td>
            <td>${item.Cod}</td>
            <td class="text-truncate" style="max-width: 200px;" title="${item.Descriere}">${descriere}</td>
            <td style="display:none">${item.branchD}</td>
            <td>${item.Destinatie}</td>
            <td class="${getValueClass(item.stoc_emit)}">${item.stoc_emit}</td>
            <td class="${getValueClass(item.min_emit)}">${item.min_emit}</td>
            <td class="${getValueClass(item.max_emit)}">${item.max_emit}</td>
            <td class="${getValueClass(item.disp_min_emit)}">${item.disp_min_emit}</td>
            <td class="${getValueClass(item.disp_max_emit)}">${item.disp_max_emit}</td>
            <td class="${getValueClass(item.stoc_dest)}">${item.stoc_dest}</td>
            <td class="${getValueClass(item.min_dest)}">${item.min_dest}</td>
            <td class="${getValueClass(item.max_dest)}">${item.max_dest}</td>
            <td class="${getValueClass(item.comenzi)}">${item.comenzi}</td>
            <td class="${getValueClass(item.transf_nerec)}">${item.transf_nerec}</td>
            <td class="${getValueClass(item.nec_min)}">${item.nec_min}</td>
            <td class="${getValueClass(item.nec_max)}">${item.nec_max}</td>
            <td class="${getValueClass(item.nec_min_comp)}">${item.nec_min_comp}</td>
            <td class="${getValueClass(item.nec_max_comp)}">${item.nec_max_comp}</td>
            <td class="${getValueClass(item.cant_min)}">${item.cant_min}</td>
            <td class="${getValueClass(item.cant_max)}">${item.cant_max}</td>
            <td>
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
                     @input="${e => {this.searchTerm = e.target.value; this.requestUpdate();}}" />
              ${this.searchTerm ? html`
                <button class="btn btn-outline-secondary" @click="${() => {this.searchTerm = ''; this.requestUpdate();}}">
                  <i class="bi bi-x"></i>
                </button>` : ''}
            </div>
            
            <div class="btn-group btn-group-sm" role="group">
              <input type="radio" class="btn-check" name="transferFilter" id="all"
                     .checked="${this.transferFilter === 'all'}"
                     @change="${() => {this.transferFilter = 'all'; this.requestUpdate();}}"
                     autocomplete="off">
              <label class="btn btn-outline-secondary" for="all">All Items</label>
              
              <input type="radio" class="btn-check" name="transferFilter" id="positive"
                     .checked="${this.transferFilter === 'positive'}"
                     @change="${() => {this.transferFilter = 'positive'; this.requestUpdate();}}"
                     autocomplete="off">
              <label class="btn btn-outline-secondary" for="positive">With Transfer</label>
              
              <input type="radio" class="btn-check" name="transferFilter" id="zero"
                     .checked="${this.transferFilter === 'zero'}"
                     @change="${() => {this.transferFilter = 'zero'; this.requestUpdate();}}"
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
                <button class="btn btn-sm btn-outline-primary" 
                        @click="${this.applyReplenishmentStrategy}"
                        ?disabled="${this.loading || this.selectedReplenishmentStrategy === 'none'}">
                  Apply Strategy
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
        
        <div class="table-responsive">
          <table class="table table-sm table-responsive modern-table compact-table">
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
                <th data-bs-toggle="tooltip" data-bs-placement="top" title="Current stock at source branch">Stoc Emit</th>
                <th data-bs-toggle="tooltip" data-bs-placement="top" title="Minimum stock limit at source branch">Min Emit</th>
                <th data-bs-toggle="tooltip" data-bs-placement="top" title="Maximum stock limit at source branch">Max Emit</th>
                <th data-bs-toggle="tooltip" data-bs-placement="top" title="Stock at source - Min limit at source">Disp Min</th>
                <th data-bs-toggle="tooltip" data-bs-placement="top" title="Stock at source - Max limit at source">Disp Max</th>
                <th data-bs-toggle="tooltip" data-bs-placement="top" title="Current stock at destination branch">Stoc Dest</th>
                <th data-bs-toggle="tooltip" data-bs-placement="top" title="Minimum stock limit at destination branch">Min Dest</th>
                <th data-bs-toggle="tooltip" data-bs-placement="top" title="Maximum stock limit at destination branch">Max Dest</th>
                <th data-bs-toggle="tooltip" data-bs-placement="top" title="Pending orders for destination branch">Com.</th>
                <th data-bs-toggle="tooltip" data-bs-placement="top" title="Quantities in transfer not yet received">In transf.</th>
                <th data-bs-toggle="tooltip" data-bs-placement="top" title="Min limit at destination - Stock at destination - Pending orders - Quantities in transfer">Nec Min</th>
                <th data-bs-toggle="tooltip" data-bs-placement="top" title="Max limit at destination - Stock at destination - Pending orders - Quantities in transfer">Nec Max</th>
                <th data-bs-toggle="tooltip" data-bs-placement="top" title="Sum of all minimum limits across all branches">Nec Min Comp</th>
                <th data-bs-toggle="tooltip" data-bs-placement="top" title="Sum of all maximum limits across all branches">Nec Max Comp</th>
                <th data-bs-toggle="tooltip" data-bs-placement="top" title="Calculated minimum quantity that can be transferred based on stock availability at source and necessity at destination">Cant Min</th>
                <th data-bs-toggle="tooltip" data-bs-placement="top" title="Calculated maximum quantity that can be transferred based on stock availability at source and necessity at destination">Cant Max</th>
                <th>Transf.</th>
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
*/