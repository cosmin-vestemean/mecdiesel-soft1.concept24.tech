/**
 * Zero Min/Max Panel Component
 * 
 * LitElement component for resetting CCCMINAUTO/CCCMAXAUTO values to 0
 * for filtered articles across selected branches.
 * 
 * Features:
 * - Material code filter with default "FS" prefix
 * - Multi-select branch dropdown (all active branches pre-selected, excluding HQ 1000)
 * - Preview functionality with pagination
 * - Reset confirmation with history tracking
 * - Real-time notifications via FeathersJS Channels
 * 
 * @element zero-minmax-panel
 */

import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class ZeroMinMaxPanel extends LitElement {
  static get properties() {
    return {
      // Filter state
      materialCodeFilter: { type: String },
      
      // Branch selection
      branches: { type: Object },
      selectedBranches: { type: Array },
      showBranchDropdown: { type: Boolean, state: true },
      branchSearchTerm: { type: String, state: true },
      
      // Preview state
      previewData: { type: Array },
      previewCount: { type: Number },
      currentPage: { type: Number },
      pageSize: { type: Number },
      totalPages: { type: Number },
      
      // History state
      historyData: { type: Array },
      showHistory: { type: Boolean, state: true },
      
      // Loading states
      loading: { type: Boolean },
      loadingPreview: { type: Boolean },
      loadingReset: { type: Boolean },
      loadingHistory: { type: Boolean },
      
      // Progress tracking for reset
      resetProgress: { type: Object },
      
      // Messages
      error: { type: String },
      success: { type: String },
      
      // Service reference
      _service: { type: Object, state: true },
    };
  }

  constructor() {
    super();
    
    // Filter defaults
    this.materialCodeFilter = 'FS';
    
    // Branch state
    this.branches = {};
    this.selectedBranches = [];
    this.showBranchDropdown = false;
    this.branchSearchTerm = '';
    
    // Preview state
    this.previewData = [];
    this.previewCount = 0;
    this.currentPage = 1;
    this.pageSize = 50;
    this.totalPages = 0;
    
    // History state
    this.historyData = [];
    this.showHistory = false;
    
    // Loading states
    this.loading = false;
    this.loadingPreview = false;
    this.loadingReset = false;
    this.loadingHistory = false;
    
    // Progress
    this.resetProgress = null;
    
    // Messages
    this.error = '';
    this.success = '';
    
    // Bind methods
    this.closeBranchDropdown = this.closeBranchDropdown.bind(this);
    this._handleRealtimeEvent = this._handleRealtimeEvent.bind(this);
  }

  // Use Light DOM for Bootstrap compatibility
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
    this._cleanupRealtimeListeners();
  }

  // === Service Initialization ===
  
  async _initService() {
    try {
      // Wait for socket to be ready
      if (window.socketReady) {
        await window.socketReady;
      }
      
      if (window.client) {
        this._service = window.client.service('zero-minmax');
        this._setupRealtimeListeners();
        console.log('✅ ZeroMinMaxPanel: Service initialized');
      } else {
        console.warn('⚠️ ZeroMinMaxPanel: Feathers client not available');
      }
    } catch (err) {
      console.error('❌ ZeroMinMaxPanel: Failed to initialize service', err);
    }
  }

  _setupRealtimeListeners() {
    if (!this._service) return;
    
    // Listen for real-time events
    this._service.on('progress', this._handleRealtimeEvent);
    this._service.on('completed', this._handleRealtimeEvent);
    this._service.on('error', this._handleRealtimeEvent);
    
    console.log('✅ ZeroMinMaxPanel: Real-time listeners set up');
  }

  _cleanupRealtimeListeners() {
    if (!this._service) return;
    
    this._service.off('progress', this._handleRealtimeEvent);
    this._service.off('completed', this._handleRealtimeEvent);
    this._service.off('error', this._handleRealtimeEvent);
  }

  _handleRealtimeEvent(data) {
    console.log('📡 ZeroMinMaxPanel: Real-time event received', data);
    
    if (data.type === 'progress') {
      this.resetProgress = {
        current: data.current,
        total: data.total,
        percent: data.percent,
        currentBranch: data.currentBranch
      };
      this.requestUpdate();
    } else if (data.type === 'completed') {
      this.resetProgress = null;
      this.loadingReset = false;
      this.success = `Reset complet! ${data.totalReset} înregistrări actualizate în ${data.branchCount} sucursale.`;
      this._loadPreview(); // Refresh preview
      this._loadHistory(); // Refresh history
      this.requestUpdate();
    } else if (data.type === 'error') {
      this.resetProgress = null;
      this.loadingReset = false;
      this.error = data.message || 'A apărut o eroare la procesare';
      this.requestUpdate();
    }
  }

  // === Data Loading ===
  
  async _loadBranches() {
    this.loading = true;
    this.error = '';
    
    try {
      if (!this._service) {
        await this._initService();
      }
      
      if (!this._service) {
        throw new Error('Service not available');
      }
      
      const result = await this._service.getActiveBranches({});
      
      if (result.success && result.data) {
        // Build branches object
        this.branches = {};
        result.data.forEach(branch => {
          this.branches[branch.code] = branch.name;
        });
        
        // Pre-select all branches (HQ already excluded by backend)
        this.selectedBranches = result.data.map(b => b.code).sort();
        
        console.log(`✅ ZeroMinMaxPanel: Loaded ${result.data.length} branches`);
      } else {
        throw new Error(result.error || 'Failed to load branches');
      }
    } catch (err) {
      console.error('❌ ZeroMinMaxPanel: Error loading branches', err);
      this.error = `Eroare la încărcarea sucursalelor: ${err.message}`;
    } finally {
      this.loading = false;
    }
  }

  async _loadPreview() {
    if (!this.materialCodeFilter || this.selectedBranches.length === 0) {
      this.error = 'Introduceți un filtru de cod material și selectați cel puțin o sucursală';
      return;
    }
    
    this.loadingPreview = true;
    this.error = '';
    this.success = '';
    
    try {
      if (!this._service) {
        throw new Error('Service not available');
      }
      
      // First get the count
      const countResult = await this._service.getPreviewCount({
        codeFilter: this.materialCodeFilter,
        branchCodes: this.selectedBranches
      });
      
      if (!countResult.success) {
        throw new Error(countResult.error || 'Failed to get preview count');
      }
      
      this.previewCount = countResult.data.count;
      this.totalPages = Math.ceil(this.previewCount / this.pageSize);
      
      // Then get the data for current page
      const dataResult = await this._service.getPreviewData({
        codeFilter: this.materialCodeFilter,
        branchCodes: this.selectedBranches,
        page: this.currentPage,
        pageSize: this.pageSize
      });
      
      if (!dataResult.success) {
        throw new Error(dataResult.error || 'Failed to get preview data');
      }
      
      this.previewData = dataResult.data || [];
      
      console.log(`✅ ZeroMinMaxPanel: Preview loaded - ${this.previewCount} total records`);
      
    } catch (err) {
      console.error('❌ ZeroMinMaxPanel: Error loading preview', err);
      this.error = `Eroare la încărcarea previzualizării: ${err.message}`;
      this.previewData = [];
      this.previewCount = 0;
    } finally {
      this.loadingPreview = false;
    }
  }

  async _loadHistory() {
    this.loadingHistory = true;
    
    try {
      if (!this._service) {
        throw new Error('Service not available');
      }
      
      const result = await this._service.getResetHistory({
        limit: 20
      });
      
      if (result.success && result.data) {
        this.historyData = result.data;
      }
    } catch (err) {
      console.error('❌ ZeroMinMaxPanel: Error loading history', err);
    } finally {
      this.loadingHistory = false;
    }
  }

  // === Actions ===
  
  async _handlePreview() {
    this.currentPage = 1;
    await this._loadPreview();
  }

  async _handleReset() {
    if (!this.materialCodeFilter || this.selectedBranches.length === 0) {
      this.error = 'Introduceți un filtru de cod material și selectați cel puțin o sucursală';
      return;
    }
    
    if (this.previewCount === 0) {
      this.error = 'Nu există înregistrări de resetat. Efectuați mai întâi o previzualizare.';
      return;
    }
    
    // Confirm dialog
    const confirmed = confirm(
      `Sunteți sigur că doriți să resetați MIN/MAX la 0 pentru:\n\n` +
      `• ${this.previewCount} înregistrări\n` +
      `• ${this.selectedBranches.length} sucursale\n` +
      `• Filtru cod: "${this.materialCodeFilter}%"\n\n` +
      `Această acțiune nu poate fi anulată!`
    );
    
    if (!confirmed) return;
    
    this.loadingReset = true;
    this.error = '';
    this.success = '';
    this.resetProgress = { current: 0, total: this.selectedBranches.length, percent: 0 };
    
    try {
      if (!this._service) {
        throw new Error('Service not available');
      }
      
      const result = await this._service.processZeroMinMax({
        codeFilter: this.materialCodeFilter,
        branchCodes: this.selectedBranches,
        userId: window.currentUserId || null // Will be set by login
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Reset operation failed');
      }
      
      // Success message will come from real-time event
      // but set a backup message in case
      if (!this.success) {
        this.success = `Reset complet! ${result.data?.totalReset || 0} înregistrări actualizate.`;
      }
      
      // Refresh preview and history
      await this._loadPreview();
      await this._loadHistory();
      
    } catch (err) {
      console.error('❌ ZeroMinMaxPanel: Error during reset', err);
      this.error = `Eroare la resetare: ${err.message}`;
    } finally {
      this.loadingReset = false;
      this.resetProgress = null;
    }
  }

  // === Pagination ===
  
  async _goToPage(page) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    await this._loadPreview();
  }

  // === Branch Dropdown Logic ===
  
  getBranchDisplayText() {
    const count = this.selectedBranches?.length || 0;
    if (count === 0) return 'Selectați sucursale';
    if (count === 1) {
      const code = this.selectedBranches[0];
      return `${code} - ${this.branches[code] || 'Unknown'}`;
    }
    const totalBranches = Object.keys(this.branches).length;
    if (count === totalBranches) {
      return 'Toate sucursalele selectate';
    }
    return `${count} sucursale selectate`;
  }

  toggleBranchDropdown(e) {
    this.showBranchDropdown = !this.showBranchDropdown;
    e.stopPropagation();
    if (this.showBranchDropdown) {
      document.addEventListener('click', this.closeBranchDropdown, { capture: true, once: true });
      setTimeout(() => this.querySelector('.fancy-dropdown-header input')?.focus(), 0);
    }
  }

  closeBranchDropdown(e) {
    const dropdownMenu = this.querySelector('.fancy-dropdown-menu');
    if (dropdownMenu && dropdownMenu.contains(e?.target)) {
      document.addEventListener('click', this.closeBranchDropdown, { capture: true, once: true });
      return;
    }
    this.showBranchDropdown = false;
  }

  toggleBranch(branch, e) {
    e.stopPropagation();
    const index = this.selectedBranches.indexOf(branch);
    if (index > -1) {
      this.selectedBranches = this.selectedBranches.filter(b => b !== branch);
    } else {
      this.selectedBranches = [...this.selectedBranches, branch].sort();
    }
  }

  selectAllBranches(e) {
    e.stopPropagation();
    this.selectedBranches = [...Object.keys(this.branches)].sort();
  }

  clearBranches(e) {
    e.stopPropagation();
    this.selectedBranches = [];
  }

  handleDropdownClick(e) {
    e.stopPropagation();
  }

  // === Utility ===
  
  _formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('ro-RO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  _truncate(str, maxLen = 30) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
  }

  // === Render Methods ===
  
  renderBranchDropdown() {
    const filteredBranches = this.branchSearchTerm
      ? Object.entries(this.branches).filter(([code, name]) =>
          code.includes(this.branchSearchTerm) || 
          name.toLowerCase().includes(this.branchSearchTerm.toLowerCase()))
      : Object.entries(this.branches);

    return html`
      <div class="fancy-dropdown-menu" 
           style="position: absolute; z-index: 99999 !important; top: 100%; left: 0; right: 0;"
           @click=${this.handleDropdownClick}>
        <div class="fancy-dropdown-header" style="z-index: 99998 !important;">
          <input type="text" class="form-control form-control-sm" 
                 placeholder="Caută sucursală..."
                 .value=${this.branchSearchTerm}
                 @input=${e => this.branchSearchTerm = e.target.value}
                 @keydown=${e => e.stopPropagation()}>
        </div>
        <div class="fancy-dropdown-actions">
          <button class="btn btn-sm btn-link py-0" @click=${this.selectAllBranches}>Selectează tot</button>
          <button class="btn btn-sm btn-link py-0" @click=${this.clearBranches}>Șterge tot</button>
        </div>
        <div class="fancy-dropdown-items">
          ${filteredBranches.length > 0 ? filteredBranches.map(([code, name]) => html`
            <div class="fancy-dropdown-item">
              <div class="form-check">
                <input type="checkbox" id="branch-${code}" class="form-check-input"
                       .checked=${this.selectedBranches.includes(code)}
                       @change=${e => this.toggleBranch(code, e)}>
                <label class="form-check-label" for="branch-${code}">${code} - ${name}</label>
              </div>
            </div>
          `) : html`<div class="text-muted text-center small p-2">Nu s-au găsit rezultate.</div>`}
        </div>
      </div>
    `;
  }

  renderFilterPanel() {
    const branchCount = this.selectedBranches?.length || 0;
    const totalBranches = Object.keys(this.branches).length;
    const allSelected = branchCount > 0 && branchCount === totalBranches;

    return html`
      <div class="card mb-3 shadow-sm">
        <div class="card-header bg-primary text-white">
          <i class="fas fa-filter me-2"></i>Filtre
        </div>
        <div class="card-body">
          <div class="row g-3 align-items-end">
            <!-- Material Code Filter -->
            <div class="col-md-4">
              <label class="form-label fw-semibold">
                <i class="fas fa-barcode me-1"></i>Cod Material (prefix)
              </label>
              <div class="input-group">
                <input type="text" class="form-control" 
                       placeholder="ex: FS"
                       .value=${this.materialCodeFilter}
                       @input=${e => this.materialCodeFilter = e.target.value.toUpperCase()}
                       ?disabled=${this.loadingReset}>
                <span class="input-group-text">%</span>
              </div>
              <small class="text-muted">Implicit: FS (filtre)</small>
            </div>
            
            <!-- Branch Selection -->
            <div class="col-md-5">
              <label class="form-label fw-semibold">
                <i class="fas fa-building me-1"></i>Sucursale
              </label>
              <div class="input-group fancy-dropdown">
                <button class="form-select fancy-dropdown-toggle text-start ${allSelected ? 'text-success fw-bold' : ''}"
                        @click=${this.toggleBranchDropdown} 
                        ?disabled=${this.loading || this.loadingReset}>
                  ${this.getBranchDisplayText()}
                  <span class="badge bg-secondary ms-auto">${branchCount}</span>
                </button>
                ${this.showBranchDropdown ? this.renderBranchDropdown() : ''}
              </div>
              <small class="text-muted">Selectați sucursalele afectate (HQ 1000 exclus)</small>
            </div>
            
            <!-- Action Buttons -->
            <div class="col-md-3">
              <div class="d-grid gap-2">
                <button class="btn btn-info" 
                        @click=${this._handlePreview}
                        ?disabled=${this.loadingPreview || this.loadingReset || !this.materialCodeFilter || branchCount === 0}>
                  ${this.loadingPreview 
                    ? html`<span class="spinner-border spinner-border-sm me-1"></span>Se încarcă...`
                    : html`<i class="fas fa-search me-1"></i>Previzualizare`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderPreviewTable() {
    if (this.previewData.length === 0 && !this.loadingPreview) {
      return html`
        <div class="alert alert-info">
          <i class="fas fa-info-circle me-2"></i>
          Utilizați butonul "Previzualizare" pentru a vedea articolele ce vor fi afectate.
        </div>
      `;
    }

    return html`
      <div class="card mb-3 shadow-sm">
        <div class="card-header bg-secondary text-white d-flex justify-content-between align-items-center">
          <span>
            <i class="fas fa-table me-2"></i>Previzualizare 
            <span class="badge bg-light text-dark ms-2">${this.previewCount} înregistrări</span>
          </span>
          ${this.previewCount > 0 ? html`
            <button class="btn btn-danger btn-sm" 
                    @click=${this._handleReset}
                    ?disabled=${this.loadingReset}>
              ${this.loadingReset 
                ? html`<span class="spinner-border spinner-border-sm me-1"></span>Se procesează...`
                : html`<i class="fas fa-eraser me-1"></i>Reset MIN/MAX la 0`}
            </button>
          ` : ''}
        </div>
        <div class="card-body p-0">
          ${this.resetProgress ? this.renderProgress() : ''}
          <div class="table-responsive">
            <table class="table table-sm table-striped table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th>Cod</th>
                  <th>Denumire</th>
                  <th>Sucursală</th>
                  <th class="text-end">MIN Auto</th>
                  <th class="text-end">MAX Auto</th>
                  <th class="text-end">Remain MIN</th>
                  <th class="text-end">Remain MAX</th>
                </tr>
              </thead>
              <tbody>
                ${this.previewData.map(row => html`
                  <tr>
                    <td><code>${row.CODE}</code></td>
                    <td title="${row.NAME}">${this._truncate(row.NAME, 30)}</td>
                    <td><span class="badge bg-info">${row.BRANCH}</span></td>
                    <td class="text-end ${row.CCCMINAUTO > 0 ? 'text-danger fw-bold' : ''}">${row.CCCMINAUTO}</td>
                    <td class="text-end ${row.CCCMAXAUTO > 0 ? 'text-danger fw-bold' : ''}">${row.CCCMAXAUTO}</td>
                    <td class="text-end">${row.REMAINLIMMIN || 0}</td>
                    <td class="text-end">${row.REMAINLIMMAX || 0}</td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
          ${this.renderPagination()}
        </div>
      </div>
    `;
  }

  renderProgress() {
    const progress = this.resetProgress;
    return html`
      <div class="p-3 bg-light border-bottom">
        <div class="d-flex justify-content-between mb-1">
          <span>Procesare sucursală: <strong>${progress.currentBranch || '...'}</strong></span>
          <span>${progress.current}/${progress.total} (${progress.percent}%)</span>
        </div>
        <div class="progress" style="height: 20px;">
          <div class="progress-bar progress-bar-striped progress-bar-animated bg-primary" 
               role="progressbar" 
               style="width: ${progress.percent}%"
               aria-valuenow="${progress.percent}" 
               aria-valuemin="0" 
               aria-valuemax="100">
          </div>
        </div>
      </div>
    `;
  }

  renderPagination() {
    if (this.totalPages <= 1) return '';

    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return html`
      <div class="card-footer bg-light">
        <nav aria-label="Preview pagination">
          <ul class="pagination pagination-sm justify-content-center mb-0">
            <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
              <button class="page-link" @click=${() => this._goToPage(1)}>
                <i class="fas fa-angle-double-left"></i>
              </button>
            </li>
            <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
              <button class="page-link" @click=${() => this._goToPage(this.currentPage - 1)}>
                <i class="fas fa-angle-left"></i>
              </button>
            </li>
            ${pages.map(page => html`
              <li class="page-item ${page === this.currentPage ? 'active' : ''}">
                <button class="page-link" @click=${() => this._goToPage(page)}>${page}</button>
              </li>
            `)}
            <li class="page-item ${this.currentPage === this.totalPages ? 'disabled' : ''}">
              <button class="page-link" @click=${() => this._goToPage(this.currentPage + 1)}>
                <i class="fas fa-angle-right"></i>
              </button>
            </li>
            <li class="page-item ${this.currentPage === this.totalPages ? 'disabled' : ''}">
              <button class="page-link" @click=${() => this._goToPage(this.totalPages)}>
                <i class="fas fa-angle-double-right"></i>
              </button>
            </li>
          </ul>
        </nav>
        <div class="text-center text-muted small mt-1">
          Pagina ${this.currentPage} din ${this.totalPages} (${this.previewCount} total)
        </div>
      </div>
    `;
  }

  renderHistory() {
    return html`
      <div class="card shadow-sm">
        <div class="card-header bg-dark text-white d-flex justify-content-between align-items-center">
          <span>
            <i class="fas fa-history me-2"></i>Istoric Resetări
          </span>
          <button class="btn btn-sm btn-outline-light" 
                  @click=${() => { this.showHistory = !this.showHistory; if (this.showHistory) this._loadHistory(); }}>
            ${this.showHistory ? 'Ascunde' : 'Afișează'}
          </button>
        </div>
        ${this.showHistory ? html`
          <div class="card-body p-0">
            ${this.loadingHistory 
              ? html`<div class="text-center p-3"><span class="spinner-border"></span></div>`
              : this.historyData.length === 0 
                ? html`<div class="text-muted text-center p-3">Nu există istoric.</div>`
                : html`
                  <div class="table-responsive">
                    <table class="table table-sm table-striped mb-0">
                      <thead class="table-light">
                        <tr>
                          <th>Data</th>
                          <th>Utilizator</th>
                          <th>Filtru</th>
                          <th>Sucursale</th>
                          <th class="text-end">Articole</th>
                          <th class="text-end">Total Reset</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${this.historyData.map(h => html`
                          <tr>
                            <td>${this._formatDate(h.CREATED_AT)}</td>
                            <td>${h.USERNAME || h.USER_ID || '-'}</td>
                            <td><code>${h.CODE_FILTER}%</code></td>
                            <td>${h.BRANCH_COUNT} sucursale</td>
                            <td class="text-end">${h.ARTICLE_COUNT}</td>
                            <td class="text-end fw-bold">${h.TOTAL_RESET}</td>
                          </tr>
                        `)}
                      </tbody>
                    </table>
                  </div>
                `}
          </div>
        ` : ''}
      </div>
    `;
  }

  renderMessages() {
    return html`
      ${this.error ? html`
        <div class="alert alert-danger alert-dismissible fade show" role="alert">
          <i class="fas fa-exclamation-triangle me-2"></i>${this.error}
          <button type="button" class="btn-close" @click=${() => this.error = ''}></button>
        </div>
      ` : ''}
      ${this.success ? html`
        <div class="alert alert-success alert-dismissible fade show" role="alert">
          <i class="fas fa-check-circle me-2"></i>${this.success}
          <button type="button" class="btn-close" @click=${() => this.success = ''}></button>
        </div>
      ` : ''}
    `;
  }

  render() {
    if (this.loading) {
      return html`
        <div class="d-flex justify-content-center align-items-center p-5">
          <div class="spinner-border text-primary me-3" role="status"></div>
          <span>Se încarcă...</span>
        </div>
      `;
    }

    return html`
      <div class="zero-minmax-panel p-3">
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h4 class="mb-0">
            <i class="fas fa-eraser text-primary me-2"></i>
            Reset Min/Max Auto
          </h4>
          <small class="text-muted">
            Resetare valori CCCMINAUTO și CCCMAXAUTO la 0
          </small>
        </div>
        
        <!-- Messages -->
        ${this.renderMessages()}
        
        <!-- Filter Panel -->
        ${this.renderFilterPanel()}
        
        <!-- Preview Table -->
        ${this.renderPreviewTable()}
        
        <!-- History -->
        ${this.renderHistory()}
      </div>
    `;
  }
}

customElements.define('zero-minmax-panel', ZeroMinMaxPanel);
