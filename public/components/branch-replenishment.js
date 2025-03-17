import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { connectToS1 } from '../dataFetching.js';
import { client } from '../socketConfig.js';

export class BranchReplenishment extends LitElement {
    static get properties() {
        return {
            branchesEmit: { type: String },
            branchesDest: { type: String },
            fiscalYear: { type: Number },
            data: { type: Array },
            token: { type: String },
            loading: { type: Boolean },
            error: { type: String },
            searchTerm: { type: String },
            setConditionForNecesar: { type: Boolean } // Add this property
        };
    }

    createRenderRoot() {
        // Disable shadow DOM to allow global styles to affect this component
        return this;
    }

    constructor() {
        super();
        this.branchesEmit = '';
        this.branchesDest = '';
        this.fiscalYear = new Date().getFullYear();
        this.data = [];
        this.token = ''; // Set this after authentication if needed
        this.loading = false;
        this.error = '';
        this.searchTerm = '';
        this.setConditionForNecesar = true; // Default value
    }

    async loadData() {
        this.loading = true;
        this.error = '';
        
        try {
            // Wrap connectToS1 callback in a Promise
            const token = await new Promise((resolve, reject) => {
                connectToS1((token) => {
                    if (!token) {
                        reject(new Error('Failed to get token'));
                        return;
                    }
                    resolve(token);
                });
            });
    
            // Make the API call using the token
            const response = await client.service('s1').getAnalyticsForBranchReplenishment({
                clientID: token,
                branchesEmit: this.branchesEmit,
                branchesDest: this.branchesDest,
                fiscalYear: this.fiscalYear,
                company: 1000,
                setConditionForNecesar: this.setConditionForNecesar
            });
    
            // Process response
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
        // Use document.querySelectorAll since we disabled shadow DOM
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
                        nextCell.select(); // Select the text when focusing
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
                // Let default tab behavior work
                break;
        }
    }

    saveData() {
        console.log('Transfers to process:', this.data.map(item => item.transfer));
        // Implement actual save as desired
    }

    exportToExcel() {
        if (!this.data.length) {
            console.warn('No data to export');
            return;
        }

        // Prepare data for export
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

        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(exportData);

        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Branch Replenishment');

        // Generate filename with current date
        const date = new Date().toISOString().split('T')[0];
        const filename = `branch_replenishment_${date}.xlsx`;

        // Save file
        XLSX.writeFile(wb, filename);
    }

    filterData() {
        if (!this.searchTerm || !this.data.length) return this.data;
        
        const term = this.searchTerm.toLowerCase();
        return this.data.filter(item => 
            (item.Cod && item.Cod.toLowerCase().includes(term)) || 
            (item.Descriere && item.Descriere.toLowerCase().includes(term))
        );
    }

    // Update the renderRow method to include row numbers
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

    render() {
        const filteredData = this.filterData();
        const totalCount = this.data.length;
        const filteredCount = filteredData.length;
        
        return html`
      <div class="container-fluid">
        ${this.error ? html`<div class="alert alert-danger">${this.error}</div>` : ''}
        <div class="row mb-3">
          <div class="col">
            <div class="input-group input-group-sm">
              <span class="input-group-text">Source Branches</span>
              <input type="text" class="form-control form-control-sm" 
                     .value="${this.branchesEmit}" 
                     @change="${e => this.branchesEmit = e.target.value}"
                     ?disabled="${this.loading}" />
            </div>
          </div>
          <div class="col">
            <div class="input-group input-group-sm">
              <span class="input-group-text">Destination Branches</span>
              <input type="text" class="form-control form-control-sm" 
                     .value="${this.branchesDest}" 
                     @change="${e => this.branchesDest = e.target.value}"
                     ?disabled="${this.loading}" />
            </div>
          </div>
          <div class="col">
            <div class="input-group input-group-sm">
              <span class="input-group-text">Fiscal Year</span>
              <input type="number" class="form-control form-control-sm" 
                     .value="${this.fiscalYear}" 
                     @change="${e => this.fiscalYear = parseInt(e.target.value)}"
                     ?disabled="${this.loading}" />
            </div>
          </div>
          <div class="col-12 mt-3">
            <div class="input-group input-group-sm">
              <span class="input-group-text">Search</span>
              <input type="text" class="form-control form-control-sm" placeholder="Filter by Code or Description"
                     .value="${this.searchTerm}" 
                     @input="${e => {this.searchTerm = e.target.value; this.requestUpdate();}}" />
              ${this.searchTerm ? html`
                <button class="btn btn-outline-secondary" @click="${() => {this.searchTerm = ''; this.requestUpdate();}}">
                  <i class="bi bi-x"></i>
                </button>` : ''}
            </div>
          </div>
          <div class="col">
            <div class="form-check form-switch" data-bs-toggle="tooltip" data-bs-placement="top" 
                 title="The filter is essentially asking: 'Does this branch have defined inventory limits?' AND Either: 'Are we ignoring necessity checks?' (when unchecked) OR 'Is there a genuine need for more stock?' (when stock + pending + transfers < required limits)">
                <input class="form-check-input" type="checkbox"
                       id="setConditionForNecesar"
                       .checked="${this.setConditionForNecesar}"
                       @change="${e => this.setConditionForNecesar = e.target.checked}"
                       ?disabled="${this.loading}">
                <label class="form-check-label" for="setConditionForNecesar">
                    Conditie Necesar Dest
                </label>
            </div>
          </div>
          <div class="col-auto">
            <button class="btn btn-sm btn-primary" @click="${this.loadData}" ?disabled="${this.loading}">
              ${this.loading ? html`<span class="spinner-border spinner-border-sm"></span> Loading...` : 'Load Data'}
            </button>
            <button class="btn btn-sm btn-success ms-2" @click="${this.saveData}" ?disabled="${this.loading}">Save</button>
            <button class="btn btn-sm btn-secondary ms-2" @click="${this.exportToExcel}" ?disabled="${this.loading}">Export to Excel</button>
          </div>
        </div>
        
        <!-- Add count information row -->
        <div class="row mb-2">
          <div class="col">
            <small class="text-muted">
              ${filteredCount === totalCount 
                ? html`Showing all <strong>${totalCount}</strong> items` 
                : html`Showing <strong>${filteredCount}</strong> of <strong>${totalCount}</strong> items`}
            </small>
          </div>
        </div>
        
        <div class="table-responsive">
          <table class="table table-sm table-responsive modern-table compact-table">
            <thead>
              <tr>
                <th>#</th>
                <th style="display:none;">keyField</th>
                <th style="display:none;">mtrl</th>
                <th>Cod</th>
                <th>Descriere</th>
                <th style="display:none">Branch</th>
                <th>Dest.</th>
                <th>Stoc Emit</th>
                <th>Min Emit</th>
                <th>Max Emit</th>
                <th>Disp Min</th>
                <th>Disp Max</th>
                <th>Stoc Dest</th>
                <th>Min Dest</th>
                <th>Max Dest</th>
                <th>Com.</th>
                <th>In transf.</th>
                <th>Nec Min</th>
                <th>Nec Max</th>
                <th>Nec Min Comp</th>
                <th>Nec Max Comp</th>
                <th>Cant Min</th>
                <th>Cant Max</th>
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