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
import { client } from '../../socketConfig.js';

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
      
      // Batch processing
      currentBatchId: { type: String },
      
      // Messages
      error: { type: String },
      success: { type: String },
      
      // Debug mode
      debugMode: { type: Boolean },
      
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
    
    // Batch processing
    this.currentBatchId = null;
    
    // Messages
    this.error = '';
    this.success = '';
    
    // Debug mode
    this.debugMode = false;
    
    // Bind methods
    this.closeBranchDropdown = this.closeBranchDropdown.bind(this);
    this._handleRealtimeEvent = this._handleRealtimeEvent.bind(this);
    this._handleBatchEvent = this._handleBatchEvent.bind(this);
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
      // Use imported client directly
      if (client) {
        this._service = client.service('zero-minmax');
        
        // Call initialize to ensure table exists
        try {
          console.log('🔧 ZeroMinMaxPanel: Calling initialize to ensure CCCZEROMINMAX table exists...');
          const setupResult = await this._service.initialize({ token: window.token });
          if (setupResult.success) {
            console.log('✅ ZeroMinMaxPanel: Table initialized successfully');
          } else {
            console.warn('⚠️ ZeroMinMaxPanel: Initialize warning', setupResult.message || setupResult.error);
          }
        } catch (setupErr) {
          console.error('❌ ZeroMinMaxPanel: Failed to initialize table', setupErr);
          this.error = 'Failed to initialize database table. Please contact administrator.';
        }
        
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
    
    // Listen for real-time events (regular processing)
    this._service.on('progress', this._handleRealtimeEvent);
    this._service.on('completed', this._handleRealtimeEvent);
    this._service.on('error', this._handleRealtimeEvent);
    
    // Listen for batch processing events
    this._service.on('batch-started', this._handleBatchEvent);
    this._service.on('batch-progress', this._handleBatchEvent);
    this._service.on('batch-completed', this._handleBatchEvent);
    this._service.on('batch-cancelled', this._handleBatchEvent);
    this._service.on('batch-failed', this._handleBatchEvent);
    
    console.log('✅ ZeroMinMaxPanel: Real-time listeners set up (including batch events)');
  }

  _cleanupRealtimeListeners() {
    if (!this._service) return;
    
    this._service.off('progress', this._handleRealtimeEvent);
    this._service.off('completed', this._handleRealtimeEvent);
    this._service.off('error', this._handleRealtimeEvent);
    
    this._service.off('batch-started', this._handleBatchEvent);
    this._service.off('batch-progress', this._handleBatchEvent);
    this._service.off('batch-completed', this._handleBatchEvent);
    this._service.off('batch-cancelled', this._handleBatchEvent);
    this._service.off('batch-failed', this._handleBatchEvent);
  }

  _handleRealtimeEvent(data) {
    console.log('📡 ZeroMinMaxPanel: Real-time event received', data);
    
    if (data.type === 'progress') {
      this.resetProgress = {
        current: data.current,
        total: data.total,
        percent: data.percent,
        currentBranch: data.currentBranch,
        mode: 'regular'
      };
      this.requestUpdate();
    } else if (data.type === 'completed') {
      this.resetProgress = null;
      this.loadingReset = false;
      this.currentBatchId = null;
      this.success = `Reset complet! ${data.totalReset} înregistrări actualizate în ${data.branchCount} sucursale.`;
      this._loadPreview(); // Refresh preview
      this._loadHistory(); // Refresh history
      this.requestUpdate();
    } else if (data.type === 'error') {
      this.resetProgress = null;
      this.loadingReset = false;
      this.currentBatchId = null;
      this.error = data.message || 'A apărut o eroare la procesare';
      this.requestUpdate();
    }
  }

  _handleBatchEvent(data) {
    console.log('📦 ZeroMinMaxPanel: Batch event received', data);
    
    // Store batchId if this is our job
    if (data.batchId && !this.currentBatchId) {
      this.currentBatchId = data.batchId;
    }
    
    // Only handle events for our current batch
    if (data.batchId && data.batchId !== this.currentBatchId) {
      console.log('ℹ️ Ignoring event for different batch:', data.batchId);
      return;
    }
    
    if (data.batchId) {
      // batch-started
      this.resetProgress = {
        current: 0,
        total: data.totalCount || 0,
        percent: 0,
        currentChunk: 0,
        totalChunks: Math.ceil((data.totalCount || 0) / 500),
        mode: 'batch'
      };
      this.requestUpdate();
    } else if (data.processed !== undefined) {
      // batch-progress
      this.resetProgress = {
        current: data.processed,
        total: data.total,
        percent: data.percent,
        currentChunk: data.currentChunk || 0,
        totalChunks: data.totalChunks || 0,
        mode: 'batch'
      };
      this.requestUpdate();
    } else if (data.totalReset !== undefined) {
      // batch-completed
      this.resetProgress = null;
      this.loadingReset = false;
      this.currentBatchId = null;
      this.success = `✅ Procesare batch completă! ${data.totalReset} înregistrări resetate.`;
      this._loadPreview(); // Refresh preview
      this._loadHistory(); // Refresh history
      this.requestUpdate();
    } else if (data.processedCount !== undefined && data.cancelledAt) {
      // batch-cancelled
      this.resetProgress = null;
      this.loadingReset = false;
      this.currentBatchId = null;
      this.success = `⚠️ Procesare anulată. ${data.processedCount} din ${data.totalCount || 0} înregistrări au fost resetate.`;
      this._loadPreview(); // Refresh preview
      this._loadHistory(); // Refresh history
      this.requestUpdate();
    } else if (data.error) {
      // batch-failed
      this.resetProgress = null;
      this.loadingReset = false;
      this.currentBatchId = null;
      this.error = `❌ Eroare în procesarea batch: ${data.error}`;
      this.requestUpdate();
    }
  }

  async _handleCancelBatch() {
    if (!this.currentBatchId) {
      console.warn('No batch to cancel');
      return;
    }
    
    const confirmed = confirm(
      'Sigur doriți să anulați procesarea?\n\n' +
      'Articolele procesate până acum vor rămâne resetate.\n' +
      'Procesarea va fi oprită după batch-ul curent.'
    );
    
    if (!confirmed) return;
    
    try {
      const result = await this._service.cancelBatch({
        token: window.token,
        batchId: this.currentBatchId
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel batch');
      }
      
      console.log('✅ Batch cancellation requested');
    } catch (err) {
      console.error('❌ Failed to cancel batch:', err);
      this.error = `Eroare la anularea procesării: ${err.message}`;
    }
  }

  // === Data Loading ===
  
  // Fallback branches data (same as branch-replenishment-container.js)
  static FALLBACK_BRANCHES = {
    '1200': 'CLUJ', '1300': 'CONSTANTA', '1400': 'GALATI',
    '1500': 'PLOIESTI', '1600': 'IASI', '1700': 'SIBIU', '1800': 'CRAIOVA',
    '1900': 'ORADEA', '2000': 'PITESTI', '2100': 'BRASOV', '2200': 'BUCURESTI',
    '2300': 'ARAD', '2400': 'VOLUNTARI', '2600': 'MIHAILESTI', '2700': 'TG. MURES',
    '2800': 'TIMISOARA', '2900': 'RAMNICU VALCEA'
  };
  
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
      
      const result = await this._service.branches({ token: window.token });
      
      if (result.success && result.data) {
        // Build branches object
        this.branches = {};
        result.data.forEach(branch => {
          this.branches[String(branch.code)] = branch.name;
        });
        
        // Pre-select all branches (HQ already excluded by backend)
        this.selectedBranches = result.data.map(b => String(b.code)).sort();
        
        console.log(`✅ ZeroMinMaxPanel: Loaded ${result.data.length} branches from API`);
      } else {
        // Use fallback branches if API fails
        console.warn('⚠️ ZeroMinMaxPanel: API failed, using fallback branches');
        this._useFallbackBranches();
      }
    } catch (err) {
      console.warn('⚠️ ZeroMinMaxPanel: Error loading branches from API, using fallback:', err.message);
      this._useFallbackBranches();
    } finally {
      this.loading = false;
    }
  }
  
  _useFallbackBranches() {
    this.branches = { ...ZeroMinMaxPanel.FALLBACK_BRANCHES };
    this.selectedBranches = Object.keys(this.branches).sort();
    console.log(`✅ ZeroMinMaxPanel: Using ${this.selectedBranches.length} fallback branches`);
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
      const countResult = await this._service.count({
        token: window.token,
        filter: this.materialCodeFilter,
        branches: this.selectedBranches
      });
      
      if (!countResult.success) {
        throw new Error(countResult.error || 'Failed to get preview count');
      }
      
      this.previewCount = countResult.data.count;
      this.totalPages = Math.ceil(this.previewCount / this.pageSize);
      
      // Then get the data for current page
      const dataResult = await this._service.preview({
        token: window.token,
        filter: this.materialCodeFilter,
        branches: this.selectedBranches,
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
      
      const result = await this._service.summary({
        token: window.token,
        limit: 20
      });
      
      if (result.success && result.batches) {
        this.historyData = result.batches;
        console.log('✅ ZeroMinMaxPanel: Loaded history', result.batches.length, 'batches');
      } else {
        console.warn('⚠️ ZeroMinMaxPanel: No batches in history response', result);
        this.historyData = [];
      }
    } catch (err) {
      console.error('❌ ZeroMinMaxPanel: Error loading history', err);
      this.historyData = [];
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
    
    // Check if batch processing is needed (>500 articles)
    const useBatchProcessing = this.previewCount > 500;
    const estimatedTime = useBatchProcessing 
      ? Math.ceil(this.previewCount / 500) * 2 // ~2 seconds per 500 articles
      : Math.ceil(this.previewCount / 100); // ~1 second per 100 articles
    
    // Confirm dialog
    const confirmMessage = useBatchProcessing
      ? `⚠️ PROCESARE ÎN BATCH-URI\n\n` +
        `Sunteți sigur că doriți să resetați MIN/MAX la 0 pentru:\n\n` +
        `• ${this.previewCount} înregistrări\n` +
        `• ${this.selectedBranches.length} sucursale\n` +
        `• Filtru cod: "${this.materialCodeFilter}%"\n\n` +
        `Datorită numărului mare de înregistrări (>${500}),\n` +
        `procesarea se va face în batch-uri de câte 500 articole.\n\n` +
        `Timp estimat: ~${estimatedTime} secunde\n\n` +
        `Această acțiune nu poate fi anulată!\n` +
        `Veți putea anula procesarea între batch-uri.`
      : `Sunteți sigur că doriți să resetați MIN/MAX la 0 pentru:\n\n` +
        `• ${this.previewCount} înregistrări\n` +
        `• ${this.selectedBranches.length} sucursale\n` +
        `• Filtru cod: "${this.materialCodeFilter}%"\n\n` +
        `Această acțiune nu poate fi anulată!`;
    
    const confirmed = confirm(confirmMessage);
    
    if (!confirmed) return;
    
    // DEBUG MODE: Show query instead of executing
    if (this.debugMode) {
      const branchList = this.selectedBranches.map(b => `'${b}'`).join(', ');
      const estimatedSQL = 
        `UPDATE MTRBRNLIMITS\n` +
        `SET CCCMINAUTO = 0,\n` +
        `    CCCMAXAUTO = 0,\n` +
        `    CCCLASTUPDATE = GETDATE()\n` +
        `WHERE COMPANY = '1000'\n` +
        `  AND MTRL LIKE '${this.materialCodeFilter}%'\n` +
        `  AND BRANCH IN (${branchList})\n` +
        `  AND (CCCMINAUTO > 0 OR CCCMAXAUTO > 0);\n\n` +
        `-- Estimare: ~${this.previewCount} rânduri afectate\n` +
        `-- User: ${window.appUserName || 'unknown'}`;
      
      const debugInfo = {
        service: 'zero-minmax',
        method: useBatchProcessing ? 'processBatch' : 'process',
        payload: {
          token: '***HIDDEN***',
          filter: this.materialCodeFilter,
          branches: this.selectedBranches,
          username: window.appUserName || 'unknown'
        },
        stats: {
          previewCount: this.previewCount,
          branchCount: this.selectedBranches.length,
          branchCodes: this.selectedBranches.join(', '),
          useBatchProcessing,
          estimatedTime: `${estimatedTime}s`
        },
        estimatedSQL: estimatedSQL
      };
      
      console.log('🐛 DEBUG MODE - Query would be:', debugInfo);
      console.log('\n📝 SQL Query:\n' + estimatedSQL);
      
      alert(
        '🐛 DEBUG MODE ACTIVAT\n\n' +
        'Query-ul NU va fi executat!\n\n' +
        '═══════════════════════════════\n' +
        'SERVICE CALL:\n' +
        '═══════════════════════════════\n' +
        `zero-minmax.${useBatchProcessing ? 'processBatch' : 'process'}()\n\n` +
        'Parametri:\n' +
        `• Filtru: "${this.materialCodeFilter}%"\n` +
        `• Sucursale: ${this.selectedBranches.length} (${this.selectedBranches.slice(0, 5).join(', ')}${this.selectedBranches.length > 5 ? '...' : ''})\n` +
        `• Înregistrări: ${this.previewCount}\n` +
        `• Batch processing: ${useBatchProcessing ? 'DA (>500)' : 'NU'}\n` +
        `• Timp estimat: ${estimatedTime}s\n` +
        `• User: ${window.appUserName || 'unknown'}\n\n` +
        '═══════════════════════════════\n' +
        'SQL QUERY (estimat):\n' +
        '═══════════════════════════════\n\n' +
        estimatedSQL + '\n\n' +
        '═══════════════════════════════\n\n' +
        'Verifică consola pentru detalii complete și SQL formatat.'
      );
      return;
    }
    
    this.loadingReset = true;
    this.error = '';
    this.success = '';
    
    try {
      if (!this._service) {
        throw new Error('Service not available');
      }
      
      if (useBatchProcessing) {
        // Use batch processing for large datasets
        this.resetProgress = { 
          current: 0, 
          total: this.previewCount, 
          percent: 0,
          currentChunk: 0,
          totalChunks: Math.ceil(this.previewCount / 500),
          mode: 'batch'
        };
        
        const result = await this._service.processBatch({
          token: window.token,
          filter: this.materialCodeFilter,
          branches: this.selectedBranches,
          userId: window.appUserId || 0
        });
        
        if (!result.success && !result.cancelled) {
          throw new Error(result.error || 'Batch reset operation failed');
        }
        
        if (result.cancelled) {
          this.success = `Procesare anulată. ${result.processedCount || 0} din ${this.previewCount} înregistrări au fost resetate.`;
        }
      } else {
        // Use regular processing for small datasets
        this.resetProgress = { 
          current: 0, 
          total: this.selectedBranches.length, 
          percent: 0,
          mode: 'regular'
        };
        
        const result = await this._service.process({
          token: window.token,
          filter: this.materialCodeFilter,
          branches: this.selectedBranches,
          username: window.appUserName || 'unknown'
        });
        
        if (!result.success) {
          throw new Error(result.error || 'Reset operation failed');
        }
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
    e.stopPropagation();
    this.showBranchDropdown = !this.showBranchDropdown;
    if (this.showBranchDropdown) {
      document.addEventListener('click', this.closeBranchDropdown, { capture: true, once: true });
      setTimeout(() => this.querySelector('.fancy-dropdown-header input')?.focus(), 0);
    }
  }



  closeBranchDropdown(e) {
    const dropdownMenu = this.querySelector('.fancy-dropdown-menu');
    if (dropdownMenu && dropdownMenu.contains(e?.target)) {
      // Click was inside dropdown, re-add listener
      document.addEventListener('click', this.closeBranchDropdown, { capture: true, once: true });
      return;
    }
    this.showBranchDropdown = false;
  }

  toggleBranch(branch, e) {
    e.stopPropagation();
    const branchStr = String(branch);
    const index = this.selectedBranches.indexOf(branchStr);
    if (index > -1) {
      this.selectedBranches = this.selectedBranches.filter(b => b !== branchStr);
    } else {
      this.selectedBranches = [...this.selectedBranches, branchStr].sort();
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

  _openHelpModal() {
    // Create modal if not exists
    let modal = document.getElementById('zeroMinMaxHelpModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'zeroMinMaxHelpModal';
      modal.className = 'modal fade';
      modal.tabIndex = -1;
      modal.innerHTML = `
        <div class="modal-dialog modal-xl modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="fas fa-question-circle text-primary me-2"></i>
                Documentație Zero Min/Max
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-0">
              <iframe 
                src="help/zero-minmax-help.html" 
                style="width: 100%; height: 70vh; border: none;"
                title="Documentație Zero Min/Max">
              </iframe>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Închide</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    
    // Show modal using Bootstrap 5 API without backdrop
    const bsModal = new bootstrap.Modal(modal, {
      backdrop: false
    });
    bsModal.show();
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
           style="position: absolute; z-index: 1001 !important; top: 100%; left: 0; right: 0;"
           @click=${this.handleDropdownClick}>
        <div class="fancy-dropdown-header" style="z-index: 10001 !important; position: sticky; top: 0; background: #fff; padding: 10px; border-bottom: 1px solid #eee;">
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
          ${filteredBranches.length > 0 ? filteredBranches.map(([code, name]) => {
            const isChecked = this.selectedBranches.includes(code);
            return html`
              <div class="fancy-dropdown-item">
                <div class="form-check">
                  <input type="checkbox" id="branch-${code}" class="form-check-input"
                         ?checked=${isChecked}
                         @change=${e => this.toggleBranch(code, e)}>
                  <label class="form-check-label" for="branch-${code}">${code} - ${name}</label>
                </div>
              </div>
            `;
          }) : html`<div class="text-muted text-center small p-2">Nu s-au găsit rezultate.</div>`}
        </div>
      </div>
    `;
  }

  renderFilterPanel() {
    const branchCount = this.selectedBranches?.length || 0;
    const totalBranches = Object.keys(this.branches).length;
    const allSelected = branchCount > 0 && branchCount === totalBranches;

    return html`
      <div class="card mb-3 shadow-sm" style="overflow: visible; position: relative; z-index: 1000;">
        <div class="card-header bg-primary text-white">
          <i class="fas fa-filter me-2"></i>Filtre
        </div>
        <div class="card-body" style="overflow: visible;">
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
            <div class="col-md-5" style="position: relative; z-index: 100;">
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
          
          <!-- Debug Mode Toggle -->
          <div class="row mt-3">
            <div class="col-12">
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="debugModeToggle"
                       .checked=${this.debugMode}
                       @change=${e => this.debugMode = e.target.checked}>
                <label class="form-check-label" for="debugModeToggle">
                  <i class="fas fa-bug me-1 text-warning"></i>
                  <strong>Debug Mode</strong> - Afișează query-ul fără a-l executa
                  ${this.debugMode ? html`<span class="badge bg-warning text-dark ms-2">ACTIVAT</span>` : ''}
                </label>
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
                  <th class="text-end">Min manual</th>
                  <th class="text-end">Max manual</th>
                </tr>
              </thead>
              <tbody>
                ${this.previewData.map(row => html`
                  <tr>
                    <td><code>${row.code}</code></td>
                    <td title="${row.name}">${this._truncate(row.name, 30)}</td>
                    <td><span class="badge bg-info">${row.branchName || row.branch}</span></td>
                    <td class="text-end ${row.cccminauto > 0 ? 'text-danger fw-bold' : ''}">${row.cccminauto}</td>
                    <td class="text-end ${row.cccmaxauto > 0 ? 'text-danger fw-bold' : ''}">${row.cccmaxauto}</td>
                    <td class="text-end">${row.remainlimmin || 0}</td>
                    <td class="text-end">${row.remainlimmax || 0}</td>
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
    
    // Batch processing progress
    if (progress.mode === 'batch') {
      const batchInfo = progress.totalChunks > 0 
        ? `Batch ${progress.currentChunk}/${progress.totalChunks}` 
        : 'Procesare...';
      
      return html`
        <div class="p-3 bg-light border-bottom">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span>
              📦 <strong>${batchInfo}</strong>
            </span>
            ${this.currentBatchId ? html`
              <button class="btn btn-sm btn-warning" @click="${this._handleCancelBatch}">
                ✖ Anulează
              </button>
            ` : ''}
          </div>
          <div class="d-flex justify-content-between mb-1">
            <span>Procesate: <strong>${progress.current}/${progress.total} articole</strong></span>
            <span><strong>${progress.percent}%</strong></span>
          </div>
          <div class="progress" style="height: 24px;">
            <div class="progress-bar progress-bar-striped progress-bar-animated bg-primary" 
                 role="progressbar" 
                 style="width: ${progress.percent}%"
                 aria-valuenow="${progress.percent}" 
                 aria-valuemin="0" 
                 aria-valuemax="100">
              ${progress.percent}%
            </div>
          </div>
          ${progress.totalChunks > 0 ? html`
            <div class="text-muted small mt-1">
              Timp estimat rămas: ~${Math.ceil((progress.totalChunks - progress.currentChunk) * 2)}s
            </div>
          ` : ''}
        </div>
      `;
    }
    
    // Regular processing progress
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
        <div class="card-header d-flex justify-content-between align-items-center">
          <span>
            <i class="fas fa-history me-2"></i>Istoric Resetări
          </span>
          <button class="btn btn-sm btn-outline-primary" 
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
                    <table class="table table-striped table-hover mb-0">
                      <thead class="table-dark">
                        <tr>
                          <th style="min-width: 140px;">Data</th>
                          <th style="min-width: 120px;">Batch ID</th>
                          <th style="min-width: 100px;">Filtru</th>
                          <th style="min-width: 100px;">Sucursale</th>
                          <th class="text-end" style="min-width: 100px;">Total Reset</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${this.historyData.map(h => html`
                          <tr>
                            <td style="font-size: 0.9rem;">${this._formatDate(h.resetatLa)}</td>
                            <td style="font-size: 0.85rem;"><code>${h.batchId}</code></td>
                            <td><code style="font-size: 0.95rem; background: #f8f9fa; padding: 2px 6px; border-radius: 3px;">${h.filtruFolosit || '-'}</code></td>
                            <td><span class="badge bg-info">${h.branchCount} sucursale</span></td>
                            <td class="text-end"><span class="badge bg-success fs-6">${h.totalRecords}</span></td>
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
          <div>
            <h4 class="mb-0">
              <i class="fas fa-eraser text-primary me-2"></i>
              Reset Min/Max Auto
            </h4>
          </div>
          <div class="d-flex gap-2 align-items-center">
            <small class="text-muted me-2">
              Resetare valori CCCMINAUTO și CCCMAXAUTO la 0
            </small>
            <button class="btn btn-outline-primary btn-sm" 
                    @click=${this._openHelpModal}
                    title="Ajutor și documentație">
              <i class="fas fa-question-circle me-1"></i>
              Ajutor
            </button>
          </div>
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
