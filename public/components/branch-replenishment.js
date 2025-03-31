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
            setConditionForNecesar: { type: Boolean },
            selectedReplenishmentStrategy: { type: String },
            transferFilter: { type: String }
        };
    }

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.branchesEmit = '';
        this.branchesDest = '';
        this.fiscalYear = new Date().getFullYear(); // Keep for internal use but remove from UI
        this.data = [];
        this.token = '';
        this.loading = false;
        this.error = '';
        this.searchTerm = '';
        this.setConditionForNecesar = true;
        this.selectedReplenishmentStrategy = 'none';
        this.transferFilter = 'all';
    }

    async loadData() {
        this.loading = true;
        this.error = '';
        
        try {
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
                branchesDest: this.branchesDest,
                fiscalYear: this.fiscalYear,
                company: 1000,
                setConditionForNecesar: this.setConditionForNecesar
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
        this.filterData().forEach(item => {
            if (item.Blacklisted === '-') {
                const minQty = parseFloat(item.cant_min);
                item.transfer = minQty > 0 ? minQty : 0;
            }
        });
    }

    applyMaxQuantities() {
        this.filterData().forEach(item => {
            if (item.Blacklisted === '-') {
                const maxQty = parseFloat(item.cant_max);
                item.transfer = maxQty > 0 ? maxQty : 0;
            }
        });
    }

    skipBlacklisted() {
        this.data.forEach(item => {
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

        return filtered;
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

    render() {
        const filteredData = this.filterData();
        const totalCount = this.data.length;
        const filteredCount = filteredData.length;
        
        return html`
      <div class="container-fluid">
        ${this.error ? html`<div class="alert alert-danger">${this.error}</div>` : ''}
        <div class="row mb-3">
          <div class="col-md-6">
            <div class="card">
              <div class="card-header bg-light p-2">
                <strong><i class="bi bi-building"></i> Branch Configuration</strong>
              </div>
              <div class="card-body p-2">
                <div class="input-group input-group-sm mb-2">
                  <span class="input-group-text">Source Branches</span>
                  <input type="text" class="form-control form-control-sm" 
                         .value="${this.branchesEmit}" 
                         @change="${e => this.branchesEmit = e.target.value}"
                         ?disabled="${this.loading}" />
                </div>
                <div class="input-group input-group-sm">
                  <span class="input-group-text">Destination Branches</span>
                  <input type="text" class="form-control form-control-sm" 
                         .value="${this.branchesDest}" 
                         @change="${e => this.branchesDest = e.target.value}"
                         ?disabled="${this.loading}" />
                </div>
                <div class="form-check form-switch mt-2" data-bs-toggle="tooltip" data-bs-placement="top" 
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
            </div>
          </div>
          
          <div class="col-md-6">
            <div class="card">
              <div class="card-header bg-light p-2">
                <strong><i class="bi bi-gear"></i> Actions</strong>
              </div>
              <div class="card-body p-2">
                <div class="d-flex gap-2 mb-2">
                  <button class="btn btn-sm btn-primary flex-grow-1" @click="${this.loadData}" ?disabled="${this.loading}">
                    ${this.loading ? html`<span class="spinner-border spinner-border-sm"></span> Loading...` : 'Load Data'}
                  </button>
                  <button class="btn btn-sm btn-success" @click="${this.saveData}" ?disabled="${this.loading}">Save</button>
                  <button class="btn btn-sm btn-secondary" @click="${this.exportToExcel}" ?disabled="${this.loading}">Export to Excel</button>
                </div>
                
                <div class="input-group input-group-sm">
                  <span class="input-group-text">Auto Replenishment</span>
                  <select class="form-select form-select-sm" 
                          .value="${this.selectedReplenishmentStrategy}"
                          @change="${e => this.selectedReplenishmentStrategy = e.target.value}"
                          ?disabled="${this.loading}">
                    <option value="none">Select Strategy</option>
                    <option value="min">Apply Min Quantities</option>
                    <option value="max">Apply Max Quantities</option>
                    <option value="skip_blacklisted">Skip Blacklisted Items</option>
                    <option value="clear">Clear All Transfers</option>
                  </select>
                  <button class="btn btn-sm btn-outline-secondary" 
                          @click="${this.applyReplenishmentStrategy}"
                          ?disabled="${this.loading || this.selectedReplenishmentStrategy === 'none'}">
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div class="col-12 mt-3">
            <div class="d-flex gap-2">
              <div class="input-group input-group-sm">
                <span class="input-group-text"><i class="bi bi-search"></i> Search</span>
                <input type="text" class="form-control form-control-sm" placeholder="Filter by Code or Description"
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
                <label class="btn btn-outline-primary" for="all">All</label>

                <input type="radio" class="btn-check" name="transferFilter" id="positive"
                       .checked="${this.transferFilter === 'positive'}"
                       @change="${() => {this.transferFilter = 'positive'; this.requestUpdate();}}"
                       autocomplete="off">
                <label class="btn btn-outline-primary" for="positive">&gt; 0</label>

                <input type="radio" class="btn-check" name="transferFilter" id="zero"
                       .checked="${this.transferFilter === 'zero'}"
                       @change="${() => {this.transferFilter = 'zero'; this.requestUpdate();}}"
                       autocomplete="off">
                <label class="btn btn-outline-primary" for="zero">= 0</label>
              </div>
            </div>
          </div>
        </div>
        
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
            <thead class="sticky-top bg-light">
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

/*
To Copilot: Do not remove the comments below. They are important for future reference.
TODO:
26.03.2025:
stategie distribuie marfa insuficienta in emit conform Top ABC vanzari per sucursale (produsele care nu au min max calculat nu are vanzari) (ABC se face dupa valoare vanzari => un procent si o etcheta), poate in formula de calcul vanzari in SQL; salvez info procent + eticheta (A, B, C) in mtrbrnlimits in doua coloane noi; necesar companie < necesar sucursala => transfer conform ABC
filtre: afiseaza cele cu transfer > 0 sau 0 (in acp tabel)
cap de tabel sticky
tooltips pe th cu descriere formula
linia 309: WHERE (bl_dest.MaxLimit > 0 OR bl_dest.MinLimit > 0) devine parametrizata in UI
filtru destinatie in cap tabel cu sucursalele + toate => vizualizare doar a celor selectate
strategiile se aplica succesiv (cu istoric aplicare?)
ranking sucursala (se va discuta in viitor)
fiscal year erased from UI
*/