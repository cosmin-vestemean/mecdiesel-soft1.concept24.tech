/**
 * Export Min/Max Panel Component
 * 
 * LitElement component for exporting min/max data from:
 * - HQ (MTRL table) 
 * - Branches (MTRBRNLIMITS table)
 * 
 * Features:
 * - Two sections: Export HQ and Export Branches
 * - Multi-select branch dropdown for branch export
 * - Preview tables with pagination
 * - Excel export (XLSX)
 * - Includes MTRGROUP and MTRMODEL names
 * 
 * @element export-minmax-panel
 */

import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { client } from '../../socketConfig.js';

export class ExportMinMaxPanel extends LitElement {
  static get properties() {
    return {
      // Branch selection (for branch export)
      branches: { type: Array },
      selectedBranches: { type: Array },
      showBranchDropdown: { type: Boolean, state: true },
      branchSearchTerm: { type: String, state: true },

      // HQ data
      hqData: { type: Array },
      hqCount: { type: Number },
      hqPage: { type: Number },
      hqPageSize: { type: Number },
      hqTotalPages: { type: Number },
      hqTotalCount: { type: Number },

      // Branch data
      branchData: { type: Array },
      branchCount: { type: Number },
      branchPage: { type: Number },
      branchPageSize: { type: Number },
      branchTotalPages: { type: Number },
      branchTotalCount: { type: Number },

      // Loading states
      loadingBranches: { type: Boolean },
      loadingHQ: { type: Boolean },
      loadingBranchData: { type: Boolean },
      exportingHQ: { type: Boolean },
      exportingBranches: { type: Boolean },

      // Counts
      hqExportCount: { type: Number },
      branchExportCount: { type: Number },

      // Messages
      error: { type: String },
      success: { type: String },

      // Active tab
      activeTab: { type: String },

      // Service reference
      _service: { type: Object, state: true },
    };
  }

  constructor() {
    super();

    // Branch state
    this.branches = [];
    this.selectedBranches = [];
    this.showBranchDropdown = false;
    this.branchSearchTerm = '';

    // HQ state
    this.hqData = [];
    this.hqCount = 0;
    this.hqPage = 1;
    this.hqPageSize = 50;
    this.hqTotalPages = 0;
    this.hqTotalCount = 0;

    // Branch data state
    this.branchData = [];
    this.branchCount = 0;
    this.branchPage = 1;
    this.branchPageSize = 50;
    this.branchTotalPages = 0;
    this.branchTotalCount = 0;

    // Loading states
    this.loadingBranches = false;
    this.loadingHQ = false;
    this.loadingBranchData = false;
    this.exportingHQ = false;
    this.exportingBranches = false;

    // Counts
    this.hqExportCount = 0;
    this.branchExportCount = 0;

    // Messages
    this.error = '';
    this.success = '';

    // Active tab
    this.activeTab = 'hq';

    // Bind
    this.closeBranchDropdown = this.closeBranchDropdown.bind(this);
  }

  // Light DOM for Bootstrap compatibility
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this._initService();
    this._loadBranches();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this.closeBranchDropdown);
  }

  // === Service Initialization ===

  async _initService() {
    try {
      if (client) {
        this._service = client.service('export-minmax');
        console.log('✅ ExportMinMaxPanel: Service initialized');
      } else {
        console.warn('⚠️ ExportMinMaxPanel: Feathers client not available');
      }
    } catch (err) {
      console.error('❌ ExportMinMaxPanel: Failed to initialize service', err);
    }
  }

  // === Branch Loading ===

  async _loadBranches() {
    this.loadingBranches = true;
    try {
      const result = await this._service.branches({ token: window.token });
      if (result.success && result.data) {
        this.branches = result.data;
        // Pre-select all branches
        this.selectedBranches = result.data.map(b => b.code);
      } else {
        console.warn('⚠️ ExportMinMaxPanel: No branches returned');
      }
    } catch (err) {
      console.error('❌ ExportMinMaxPanel: Failed to load branches', err);
      this.error = 'Failed to load branches: ' + (err.message || 'Unknown error');
    }
    this.loadingBranches = false;
    this.requestUpdate();
  }

  // === Branch Dropdown Logic ===

  toggleBranchDropdown(e) {
    e.stopPropagation();
    this.showBranchDropdown = !this.showBranchDropdown;
    if (this.showBranchDropdown) {
      setTimeout(() => document.addEventListener('click', this.closeBranchDropdown), 0);
    } else {
      document.removeEventListener('click', this.closeBranchDropdown);
    }
  }

  closeBranchDropdown(e) {
    const dropdown = this.querySelector('.export-branch-dropdown-container');
    if (dropdown && !dropdown.contains(e.target)) {
      this.showBranchDropdown = false;
      document.removeEventListener('click', this.closeBranchDropdown);
      this.requestUpdate();
    }
  }

  toggleBranch(branchCode) {
    const idx = this.selectedBranches.indexOf(branchCode);
    if (idx > -1) {
      this.selectedBranches = this.selectedBranches.filter(b => b !== branchCode);
    } else {
      this.selectedBranches = [...this.selectedBranches, branchCode];
    }
    this.requestUpdate();
  }

  selectAllBranches() {
    this.selectedBranches = this.branches.map(b => b.code);
    this.requestUpdate();
  }

  clearAllBranches() {
    this.selectedBranches = [];
    this.requestUpdate();
  }

  get filteredBranches() {
    if (!this.branchSearchTerm) return this.branches;
    const term = this.branchSearchTerm.toLowerCase();
    return this.branches.filter(b =>
      b.name.toLowerCase().includes(term) || String(b.code).includes(term)
    );
  }

  // === Data Loading ===

  async loadHQPreview(page = 1) {
    this.loadingHQ = true;
    this.error = '';
    this.hqPage = page;
    try {
      const result = await this._service.exportHQ({
        token: window.token,
        page: page,
        pageSize: this.hqPageSize
      });
      if (result.success) {
        this.hqData = result.data;
        this.hqTotalCount = result.totalCount;
        this.hqTotalPages = result.totalPages;
        this.hqCount = result.count;
      } else {
        this.error = result.error || 'Failed to load HQ data';
      }
    } catch (err) {
      this.error = 'Error loading HQ data: ' + (err.message || 'Unknown error');
    }
    this.loadingHQ = false;
    this.requestUpdate();
  }

  async loadBranchPreview(page = 1) {
    if (this.selectedBranches.length === 0) {
      this.error = 'Selectați cel puțin o filială';
      return;
    }
    this.loadingBranchData = true;
    this.error = '';
    this.branchPage = page;
    try {
      const result = await this._service.exportBranches({
        token: window.token,
        branches: this.selectedBranches,
        page: page,
        pageSize: this.branchPageSize
      });
      if (result.success) {
        this.branchData = result.data;
        this.branchTotalCount = result.totalCount;
        this.branchTotalPages = result.totalPages;
        this.branchCount = result.count;
      } else {
        this.error = result.error || 'Failed to load branch data';
      }
    } catch (err) {
      this.error = 'Error loading branch data: ' + (err.message || 'Unknown error');
    }
    this.loadingBranchData = false;
    this.requestUpdate();
  }

  // === Excel Export ===

  async exportHQToExcel() {
    this.exportingHQ = true;
    this.error = '';
    this.success = '';
    try {
      const result = await this._service.exportHQ({
        token: window.token,
        exportAll: true,
        pageSize: 50000
      });
      if (result.success && result.data) {
        const exportData = result.data.map(item => ({
          'Cod': item.code,
          'AltRef': item.altRef,
          'Denumire': item.name,
          'Grup Cod': item.mtrgroupCode,
          'Grup Denumire': item.mtrgroupName,
          'MaFa Cod': item.mtrmodelCode,
          'MaFa Denumire': item.mtrmodelName,
          'Min Manual': item.minManual,
          'Max Manual': item.maxManual,
          'Min Calculat': item.minCalculat,
          'Max Calculat': item.maxCalculat,
          'Data Calcul': item.dataCalcul
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'HQ MinMax');

        const today = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Export_MinMax_HQ_${today}.xlsx`);

        this.success = `Export HQ: ${result.data.length} rânduri exportate cu succes`;
      } else {
        this.error = result.error || 'Failed to export HQ data';
      }
    } catch (err) {
      this.error = 'Error exporting HQ data: ' + (err.message || 'Unknown error');
    }
    this.exportingHQ = false;
    this.requestUpdate();
  }

  async exportBranchesToExcel() {
    if (this.selectedBranches.length === 0) {
      this.error = 'Selectați cel puțin o filială';
      return;
    }
    this.exportingBranches = true;
    this.error = '';
    this.success = '';
    try {
      const result = await this._service.exportBranches({
        token: window.token,
        branches: this.selectedBranches,
        exportAll: true,
        pageSize: 50000
      });
      if (result.success && result.data) {
        const exportData = result.data.map(item => ({
          'Cod': item.code,
          'AltRef': item.altRef,
          'Denumire': item.name,
          'Grup Cod': item.mtrgroupCode,
          'Grup Denumire': item.mtrgroupName,
          'MaFa Cod': item.mtrmodelCode,
          'MaFa Denumire': item.mtrmodelName,
          'Filiala': item.branch,
          'Nume Filiala': item.branchName,
          'Depozit': item.whouse,
          'Nivel MIN': item.nivelMin,
          'Nivel MAX': item.nivelMax,
          'Minim Calculat': item.minimCalculat,
          'Maxim Calculat': item.maximCalculat,
          'IS Blacklist': item.isBlacklist,
          'Was Blacklist': item.wasBlacklist,
          'Data Calcul': item.dataCalcul
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Filiale MinMax');

        const today = new Date().toISOString().slice(0, 10);
        const branchNames = this.selectedBranches.length <= 3
          ? this.selectedBranches.join('_')
          : `${this.selectedBranches.length}filiale`;
        XLSX.writeFile(wb, `Export_MinMax_Filiale_${branchNames}_${today}.xlsx`);

        this.success = `Export Filiale: ${result.data.length} rânduri exportate cu succes`;
      } else {
        this.error = result.error || 'Failed to export branch data';
      }
    } catch (err) {
      this.error = 'Error exporting branch data: ' + (err.message || 'Unknown error');
    }
    this.exportingBranches = false;
    this.requestUpdate();
  }

  // === Rendering ===

  render() {
    return html`
      <div class="container-fluid px-3 py-2">
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="mb-0">
            <i class="fas fa-file-export me-2 text-success"></i>Export Min/Max
          </h5>
        </div>

        <!-- Messages -->
        ${this.error ? html`
          <div class="alert alert-danger alert-dismissible fade show py-2" role="alert">
            <i class="fas fa-exclamation-circle me-1"></i>${this.error}
            <button type="button" class="btn-close btn-sm" @click=${() => { this.error = ''; this.requestUpdate(); }}></button>
          </div>
        ` : ''}
        ${this.success ? html`
          <div class="alert alert-success alert-dismissible fade show py-2" role="alert">
            <i class="fas fa-check-circle me-1"></i>${this.success}
            <button type="button" class="btn-close btn-sm" @click=${() => { this.success = ''; this.requestUpdate(); }}></button>
          </div>
        ` : ''}

        <!-- Tab Selector -->
        <ul class="nav nav-pills mb-3" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link ${this.activeTab === 'hq' ? 'active' : ''}"
              @click=${() => { this.activeTab = 'hq'; this.requestUpdate(); }}>
              <i class="fas fa-building me-1"></i>Export HQ
              ${this.hqTotalCount > 0 ? html`<span class="badge bg-secondary ms-1">${this.hqTotalCount.toLocaleString()}</span>` : ''}
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link ${this.activeTab === 'branches' ? 'active' : ''}"
              @click=${() => { this.activeTab = 'branches'; this.requestUpdate(); }}>
              <i class="fas fa-code-branch me-1"></i>Export Filiale
              ${this.branchTotalCount > 0 ? html`<span class="badge bg-secondary ms-1">${this.branchTotalCount.toLocaleString()}</span>` : ''}
            </button>
          </li>
        </ul>

        <!-- HQ Tab -->
        ${this.activeTab === 'hq' ? this._renderHQTab() : ''}
        
        <!-- Branches Tab -->
        ${this.activeTab === 'branches' ? this._renderBranchesTab() : ''}
      </div>
    `;
  }

  _renderHQTab() {
    return html`
      <div class="card">
        <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center py-2">
          <span><i class="fas fa-building me-2"></i>Min/Max HQ (tabela MTRL)</span>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-light" ?disabled=${this.loadingHQ}
              @click=${() => this.loadHQPreview(1)}>
              <i class="fas fa-eye me-1"></i>Previzualizare
              ${this.loadingHQ ? html`<span class="spinner-border spinner-border-sm ms-1"></span>` : ''}
            </button>
            <button class="btn btn-sm btn-success" ?disabled=${this.exportingHQ}
              @click=${() => this.exportHQToExcel()}>
              <i class="fas fa-file-excel me-1"></i>Export Excel
              ${this.exportingHQ ? html`<span class="spinner-border spinner-border-sm ms-1"></span>` : ''}
            </button>
          </div>
        </div>
        <div class="card-body p-0">
          ${this.loadingHQ ? html`
            <div class="text-center py-4">
              <span class="spinner-border text-primary"></span>
              <p class="mt-2 text-muted">Se încarcă datele HQ...</p>
            </div>
          ` : this.hqData.length > 0 ? html`
            <div class="table-responsive" style="max-height: 500px; overflow-y: auto;">
              <table class="table table-sm table-striped table-hover mb-0">
                <thead class="table-light sticky-top">
                  <tr>
                    <th>Cod</th>
                    <th>AltRef</th>
                    <th>Denumire</th>
                    <th>Grup</th>
                    <th>MaFa</th>
                    <th class="text-end">Min Manual</th>
                    <th class="text-end">Max Manual</th>
                    <th class="text-end">Min Calculat</th>
                    <th class="text-end">Max Calculat</th>
                    <th>Data Calcul</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.hqData.map(item => html`
                    <tr>
                      <td><code>${item.code}</code></td>
                      <td>${item.altRef || '-'}</td>
                      <td class="text-truncate" style="max-width: 200px;" title="${item.name}">${item.name}</td>
                      <td title="${item.mtrgroupName}">${item.mtrgroupCode || '-'}</td>
                      <td title="${item.mtrmodelName}">${item.mtrmodelCode || '-'}</td>
                      <td class="text-end">${item.minManual}</td>
                      <td class="text-end">${item.maxManual}</td>
                      <td class="text-end">${item.minCalculat}</td>
                      <td class="text-end">${item.maxCalculat}</td>
                      <td>${this._formatDate(item.dataCalcul)}</td>
                    </tr>
                  `)}
                </tbody>
              </table>
            </div>
            ${this._renderPagination('hq')}
          ` : html`
            <div class="text-center py-4 text-muted">
              <i class="fas fa-info-circle me-1"></i>
              Apăsați "Previzualizare" pentru a încărca datele HQ
            </div>
          `}
        </div>
      </div>
    `;
  }

  _renderBranchesTab() {
    return html`
      <div class="card">
        <div class="card-header bg-info text-white py-2">
          <div class="d-flex justify-content-between align-items-center">
            <span><i class="fas fa-code-branch me-2"></i>Min/Max Filiale (tabela MTRBRNLIMITS)</span>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-light" 
                ?disabled=${this.loadingBranchData || this.selectedBranches.length === 0}
                @click=${() => this.loadBranchPreview(1)}>
                <i class="fas fa-eye me-1"></i>Previzualizare
                ${this.loadingBranchData ? html`<span class="spinner-border spinner-border-sm ms-1"></span>` : ''}
              </button>
              <button class="btn btn-sm btn-success" 
                ?disabled=${this.exportingBranches || this.selectedBranches.length === 0}
                @click=${() => this.exportBranchesToExcel()}>
                <i class="fas fa-file-excel me-1"></i>Export Excel
                ${this.exportingBranches ? html`<span class="spinner-border spinner-border-sm ms-1"></span>` : ''}
              </button>
            </div>
          </div>
        </div>
        <div class="card-body">
          <!-- Branch Selection -->
          <div class="mb-3">
            <label class="form-label fw-bold">
              <i class="fas fa-store me-1"></i>Filiale selectate
              <span class="badge bg-primary ms-1">${this.selectedBranches.length}/${this.branches.length}</span>
            </label>
            <div class="export-branch-dropdown-container position-relative">
              <div class="form-control d-flex align-items-center justify-content-between cursor-pointer"
                style="cursor: pointer; min-height: 38px;"
                @click=${(e) => this.toggleBranchDropdown(e)}>
                <span class="text-truncate">
                  ${this.selectedBranches.length === 0 ? 'Selectați filiale...' :
                    this.selectedBranches.length === this.branches.length ? 'Toate filialele' :
                    `${this.selectedBranches.length} filiale selectate`}
                </span>
                <i class="fas fa-chevron-${this.showBranchDropdown ? 'up' : 'down'} ms-2"></i>
              </div>
              ${this.showBranchDropdown ? html`
                <div class="position-absolute w-100 bg-white border rounded shadow-sm mt-1"
                  style="z-index: 1050; max-height: 300px; overflow-y: auto;" @click=${(e) => e.stopPropagation()}>
                  <!-- Search -->
                  <div class="p-2 border-bottom sticky-top bg-white">
                    <input type="text" class="form-control form-control-sm" placeholder="Caută filială..."
                      .value=${this.branchSearchTerm}
                      @input=${(e) => { this.branchSearchTerm = e.target.value; this.requestUpdate(); }}>
                    <div class="d-flex gap-1 mt-1">
                      <button class="btn btn-outline-primary btn-sm flex-fill" @click=${() => this.selectAllBranches()}>
                        <i class="fas fa-check-double me-1"></i>Toate
                      </button>
                      <button class="btn btn-outline-secondary btn-sm flex-fill" @click=${() => this.clearAllBranches()}>
                        <i class="fas fa-times me-1"></i>Niciuna
                      </button>
                    </div>
                  </div>
                  <!-- Branch list -->
                  ${this.filteredBranches.map(branch => html`
                    <div class="form-check px-3 py-1 border-bottom" style="cursor: pointer;"
                      @click=${() => this.toggleBranch(branch.code)}>
                      <input class="form-check-input" type="checkbox"
                        .checked=${this.selectedBranches.includes(branch.code)}
                        @click=${(e) => e.stopPropagation()}>
                      <label class="form-check-label w-100" style="cursor: pointer;">
                        <span class="badge bg-secondary me-1">${branch.code}</span>${branch.name}
                      </label>
                    </div>
                  `)}
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Branch Data Table -->
        <div class="card-body p-0 border-top">
          ${this.loadingBranchData ? html`
            <div class="text-center py-4">
              <span class="spinner-border text-info"></span>
              <p class="mt-2 text-muted">Se încarcă datele filialelor...</p>
            </div>
          ` : this.branchData.length > 0 ? html`
            <div class="table-responsive" style="max-height: 500px; overflow-y: auto;">
              <table class="table table-sm table-striped table-hover mb-0">
                <thead class="table-light sticky-top">
                  <tr>
                    <th>Cod</th>
                    <th>AltRef</th>
                    <th>Denumire</th>
                    <th>Grup</th>
                    <th>MaFa</th>
                    <th>Filiala</th>
                    <th class="text-end">Depozit</th>
                    <th class="text-end">Nivel MIN</th>
                    <th class="text-end">Nivel MAX</th>
                    <th class="text-end">Min Calculat</th>
                    <th class="text-end">Max Calculat</th>
                    <th>Blacklist</th>
                    <th>Data Calcul</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.branchData.map(item => html`
                    <tr>
                      <td><code>${item.code}</code></td>
                      <td>${item.altRef || '-'}</td>
                      <td class="text-truncate" style="max-width: 180px;" title="${item.name}">${item.name}</td>
                      <td title="${item.mtrgroupName}">${item.mtrgroupCode || '-'}</td>
                      <td title="${item.mtrmodelName}">${item.mtrmodelCode || '-'}</td>
                      <td><span class="badge bg-secondary">${item.branch}</span> ${item.branchName}</td>
                      <td class="text-end">${item.whouse}</td>
                      <td class="text-end">${item.nivelMin}</td>
                      <td class="text-end">${item.nivelMax}</td>
                      <td class="text-end">${item.minimCalculat}</td>
                      <td class="text-end">${item.maximCalculat}</td>
                      <td>
                        ${item.isBlacklist ? html`<span class="badge bg-danger">IS</span>` : ''}
                        ${item.wasBlacklist ? html`<span class="badge bg-warning text-dark">WAS</span>` : ''}
                        ${!item.isBlacklist && !item.wasBlacklist ? '-' : ''}
                      </td>
                      <td>${this._formatDate(item.dataCalcul)}</td>
                    </tr>
                  `)}
                </tbody>
              </table>
            </div>
            ${this._renderPagination('branches')}
          ` : html`
            <div class="text-center py-4 text-muted">
              <i class="fas fa-info-circle me-1"></i>
              Selectați filiale și apăsați "Previzualizare" pentru a încărca datele
            </div>
          `}
        </div>
      </div>
    `;
  }

  _renderPagination(type) {
    const page = type === 'hq' ? this.hqPage : this.branchPage;
    const totalPages = type === 'hq' ? this.hqTotalPages : this.branchTotalPages;
    const totalCount = type === 'hq' ? this.hqTotalCount : this.branchTotalCount;
    const count = type === 'hq' ? this.hqCount : this.branchCount;
    const loadFn = type === 'hq'
      ? (p) => this.loadHQPreview(p)
      : (p) => this.loadBranchPreview(p);

    if (totalPages <= 1) {
      return html`
        <div class="card-footer bg-light py-1 px-3 text-muted small">
          Total: ${totalCount.toLocaleString()} rânduri
        </div>
      `;
    }

    return html`
      <div class="card-footer bg-light py-1 px-3 d-flex justify-content-between align-items-center">
        <span class="text-muted small">
          Pagina ${page} / ${totalPages} (${totalCount.toLocaleString()} total)
        </span>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-secondary" ?disabled=${page <= 1}
            @click=${() => loadFn(1)}>
            <i class="fas fa-angle-double-left"></i>
          </button>
          <button class="btn btn-outline-secondary" ?disabled=${page <= 1}
            @click=${() => loadFn(page - 1)}>
            <i class="fas fa-angle-left"></i>
          </button>
          <button class="btn btn-outline-secondary" ?disabled=${page >= totalPages}
            @click=${() => loadFn(page + 1)}>
            <i class="fas fa-angle-right"></i>
          </button>
          <button class="btn btn-outline-secondary" ?disabled=${page >= totalPages}
            @click=${() => loadFn(totalPages)}>
            <i class="fas fa-angle-double-right"></i>
          </button>
        </div>
      </div>
    `;
  }

  _formatDate(val) {
    if (!val) return '-';
    try {
      // S1 may return date as number (yyyymmdd) or string
      const str = String(val);
      if (str.length === 8 && !str.includes('-')) {
        return `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
      }
      if (str.length >= 10) {
        return str.substring(0, 10);
      }
      return str;
    } catch (e) {
      return String(val);
    }
  }
}

customElements.define('export-minmax-panel', ExportMinMaxPanel);
