import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { connectToS1 } from '../../dataFetching.js';
import { client } from '../../socketConfig.js';

/**
 * Batch Processing Container - LitElement Component
 * Manages persistent batch processing for "Move items online" and "Stock evidence" operations
 * 
 * Features:
 * - Excel file upload and parsing
 * - Persistent queue (survives browser refresh)
 * - Real-time progress tracking
 * - Cancel/Retry functionality
 * - Export results to Excel
 */
export class BatchProcessingContainer extends LitElement {
  static get properties() {
    return {
      // Queue type selection
      queueType: { type: String },
      
      // File upload
      selectedFile: { type: Object },
      parsedCodes: { type: Array },
      
      // Current batch state
      currentBatchId: { type: String },
      isProcessing: { type: Boolean },
      isPaused: { type: Boolean },
      
      // Progress stats
      summary: { type: Object },
      
      // Recent batches list
      recentBatches: { type: Array },
      
      // Batch details (codes list)
      batchDetails: { type: Array },
      showDetails: { type: Boolean },
      
      // UI state
      loading: { type: Boolean },
      error: { type: String },
      statusMessage: { type: String },
      
      // Polling
      _pollInterval: { type: Object },
      
      // Setup state
      _isSetupComplete: { type: Boolean }
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
        padding: 1rem;
        font-family: var(--bs-font-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif);
      }
      
      .batch-container {
        max-width: 1200px;
        margin: 0 auto;
      }
      
      .section-card {
        background: var(--bs-body-bg, white);
        border: 1px solid var(--bs-border-color, #dee2e6);
        border-radius: var(--bs-border-radius, 0.375rem);
        padding: 1.25rem;
        margin-bottom: 1rem;
        box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
      }
      
      .section-title {
        font-size: 1.1rem;
        font-weight: 600;
        margin-bottom: 1rem;
        color: var(--bs-body-color, #212529);
      }
      
      /* Radio buttons */
      .queue-type-selector {
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }
      
      .queue-type-option {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.25rem;
        border: 2px solid var(--bs-border-color, #dee2e6);
        border-radius: var(--bs-border-radius, 0.375rem);
        cursor: pointer;
        transition: all 0.2s ease;
        background: var(--bs-body-bg, white);
      }
      
      .queue-type-option:hover {
        border-color: var(--bs-primary, #0d6efd);
        background: var(--bs-light, #f8f9fa);
      }
      
      .queue-type-option.selected {
        border-color: var(--bs-primary, #0d6efd);
        background: rgba(13, 110, 253, 0.1);
      }
      
      .queue-type-option input {
        margin: 0;
        accent-color: var(--bs-primary, #0d6efd);
      }
      
      /* File upload */
      .upload-section {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
      }
      
      .file-input-wrapper {
        position: relative;
      }
      
      .file-input {
        padding: 0.5rem;
        border: 1px solid var(--bs-border-color, #dee2e6);
        border-radius: var(--bs-border-radius, 0.375rem);
        background: var(--bs-body-bg, white);
        color: var(--bs-body-color, #212529);
      }
      
      .file-info {
        color: var(--bs-secondary, #6c757d);
        font-size: 0.9rem;
      }
      
      /* Buttons - using Bootstrap-like styles */
      .btn {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: var(--bs-border-radius, 0.375rem);
        cursor: pointer;
        font-weight: 500;
        transition: all 0.15s ease-in-out;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
      }
      
      .btn:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
      
      .btn-primary {
        background: var(--bs-primary, #0d6efd);
        color: white;
      }
      
      .btn-primary:hover:not(:disabled) {
        background: #0b5ed7;
      }
      
      .btn-danger {
        background: var(--bs-danger, #dc3545);
        color: white;
      }
      
      .btn-danger:hover:not(:disabled) {
        background: #bb2d3b;
      }
      
      .btn-warning {
        background: var(--bs-warning, #ffc107);
        color: #000;
      }
      
      .btn-warning:hover:not(:disabled) {
        background: #ffca2c;
      }
      
      .btn-success {
        background: var(--bs-success, #198754);
        color: white;
      }
      
      .btn-success:hover:not(:disabled) {
        background: #157347;
      }
      
      .btn-secondary {
        background: var(--bs-secondary, #6c757d);
        color: white;
      }
      
      .btn-secondary:hover:not(:disabled) {
        background: #5c636a;
      }
      
      .btn-outline-primary {
        background: transparent;
        color: var(--bs-primary, #0d6efd);
        border: 1px solid var(--bs-primary, #0d6efd);
      }
      
      .btn-outline-primary:hover:not(:disabled) {
        background: var(--bs-primary, #0d6efd);
        color: white;
      }
      
      /* Progress section */
      .progress-section {
        margin-top: 1rem;
      }
      
      .progress-bar-container {
        height: 24px;
        background: var(--bs-secondary-bg, #e9ecef);
        border-radius: var(--bs-border-radius, 0.375rem);
        overflow: hidden;
        margin-bottom: 0.75rem;
        position: relative;
      }
      
      .progress-bar {
        height: 100%;
        background: #5c9ead;
        transition: width 0.3s ease;
      }
      
      .progress-bar-container::after {
        content: attr(data-progress);
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
        font-weight: 600;
        color: #333;
        text-shadow: 0 0 2px white, 0 0 2px white;
      }
      
      .progress-stats {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
      }
      
      .stat-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
      }
      
      .stat-badge {
        padding: 0.25rem 0.625rem;
        border-radius: var(--bs-border-radius-sm, 0.25rem);
        font-weight: 600;
        font-size: 0.875rem;
      }
      
      .stat-success { background: rgba(25, 135, 84, 0.15); color: var(--bs-success, #198754); }
      .stat-error { background: rgba(220, 53, 69, 0.15); color: var(--bs-danger, #dc3545); }
      .stat-pending { background: rgba(108, 117, 125, 0.15); color: var(--bs-secondary, #6c757d); }
      .stat-processing { background: rgba(255, 193, 7, 0.15); color: #997404; }
      .stat-cancelled { background: rgba(108, 117, 125, 0.15); color: var(--bs-secondary, #6c757d); }
      
      /* Batches table */
      .batches-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
      }
      
      .batches-table th,
      .batches-table td {
        padding: 0.75rem;
        text-align: left;
        border-bottom: 1px solid var(--bs-border-color, #dee2e6);
        vertical-align: middle;
      }
      
      .batches-table th {
        background: var(--bs-tertiary-bg, #f8f9fa);
        font-weight: 600;
        color: var(--bs-body-color, #212529);
      }
      
      .batches-table tr:hover {
        background: var(--bs-tertiary-bg, #f8f9fa);
      }
      
      .status-badge {
        padding: 0.25rem 0.625rem;
        border-radius: var(--bs-border-radius-pill, 50rem);
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.025em;
      }
      
      .status-in-progress { 
        background: rgba(255, 193, 7, 0.15); 
        color: #997404; 
      }
      .status-completed { 
        background: rgba(25, 135, 84, 0.15); 
        color: var(--bs-success, #198754); 
      }
      
      /* Action buttons in table */
      .action-btns {
        display: flex;
        gap: 0.375rem;
      }
      
      .btn-sm {
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
      }
      
      /* Details modal/section */
      .details-section {
        margin-top: 1rem;
        border-top: 1px solid var(--bs-border-color, #dee2e6);
        padding-top: 1rem;
      }
      
      .details-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }
      
      .codes-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.8rem;
        max-height: 400px;
        overflow-y: auto;
        display: block;
      }
      
      .codes-table th,
      .codes-table td {
        padding: 0.5rem;
        text-align: left;
        border-bottom: 1px solid var(--bs-border-color-translucent, rgba(0,0,0,0.1));
      }
      
      /* Status message */
      .status-message {
        padding: 0.75rem 1rem;
        border-radius: var(--bs-border-radius, 0.375rem);
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      .status-message.info { 
        background: rgba(13, 110, 253, 0.1); 
        color: var(--bs-primary, #0d6efd);
        border: 1px solid rgba(13, 110, 253, 0.25);
      }
      .status-message.success { 
        background: rgba(25, 135, 84, 0.1); 
        color: var(--bs-success, #198754);
        border: 1px solid rgba(25, 135, 84, 0.25);
      }
      .status-message.error { 
        background: rgba(220, 53, 69, 0.1); 
        color: var(--bs-danger, #dc3545);
        border: 1px solid rgba(220, 53, 69, 0.25);
      }
      .status-message.warning { 
        background: rgba(255, 193, 7, 0.1); 
        color: #997404;
        border: 1px solid rgba(255, 193, 7, 0.25);
      }
      
      /* Loading spinner */
      .spinner {
        display: inline-block;
        width: 1rem;
        height: 1rem;
        border: 2px solid var(--bs-border-color, #dee2e6);
        border-top: 2px solid var(--bs-primary, #0d6efd);
        border-radius: 50%;
        animation: spin 0.75s linear infinite;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      /* Resume banner */
      .resume-banner {
        background: rgba(255, 193, 7, 0.1);
        border: 1px solid rgba(255, 193, 7, 0.5);
        border-radius: var(--bs-border-radius, 0.375rem);
        padding: 1rem;
        margin-bottom: 1rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
      }
      
      .resume-banner-text {
        color: #997404;
      }
      
      .resume-banner-actions {
        display: flex;
        gap: 0.5rem;
      }
      
      /* Empty state */
      .empty-state {
        text-align: center;
        padding: 2rem;
        color: var(--bs-secondary, #6c757d);
      }
        margin-bottom: 1rem;
        opacity: 0.5;
      }
      
      /* Responsive */
      @media (max-width: 768px) {
        .queue-type-selector {
          flex-direction: column;
        }
        
        .upload-section {
          flex-direction: column;
          align-items: stretch;
        }
        
        .progress-stats {
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .resume-banner {
          flex-direction: column;
          align-items: stretch;
        }
      }
    `;
  }

  constructor() {
    super();
    
    // Initialize state
    this.queueType = '';
    this.selectedFile = null;
    this.parsedCodes = [];
    this.currentBatchId = null;
    this.isProcessing = false;
    this.isPaused = false;
    this.summary = null;
    this.recentBatches = [];
    this.batchDetails = [];
    this.showDetails = false;
    this.loading = false;
    this.error = '';
    this.statusMessage = '';
    this._pollInterval = null;
    this._isSetupComplete = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this._initializeComponent();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopPolling();
  }

  async _initializeComponent() {
    try {
      // Setup table on first load
      await this._setupBatchQueue();
      
      // Check for pending batches (resume after refresh)
      await this._checkPendingBatches();
      
      // Load recent batches
      await this._loadRecentBatches();
    } catch (err) {
      console.error('Failed to initialize batch processing:', err);
      this.error = 'Failed to initialize. Please refresh the page.';
    }
  }

  async _setupBatchQueue() {
    if (this._isSetupComplete) return;
    
    try {
      const token = await this._getToken();
      await client.service('batch-queue').initialize({ token });
      this._isSetupComplete = true;
      console.log('✅ Batch queue setup complete');
    } catch (err) {
      console.warn('Batch queue setup warning:', err.message);
      // Continue anyway - table might already exist
      this._isSetupComplete = true;
    }
  }

  async _getToken() {
    return new Promise((resolve, reject) => {
      connectToS1((token) => {
        if (token) resolve(token);
        else reject(new Error('Failed to get authentication token'));
      });
    });
  }

  // --- File Upload ---
  _handleFileChange(e) {
    const files = e.target.files;
    if (!files || files.length === 0) {
      this.selectedFile = null;
      this.parsedCodes = [];
      return;
    }
    
    const file = files[0];
    
    // Validate file
    if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      this.error = 'Only .xlsx files are allowed';
      return;
    }
    
    if (file.size > 1000000) {
      this.error = 'File size must be less than 1MB';
      return;
    }
    
    this.selectedFile = file;
    this.error = '';
    this._parseExcelFile(file);
  }

  _parseExcelFile(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet);
        
        if (rows.length === 0) {
          this.error = 'Excel file is empty';
          return;
        }
        
        // Extract codes from first column
        const codes = rows.map(row => {
          const firstKey = Object.keys(row)[0];
          return String(row[firstKey]).trim();
        }).filter(code => code && code.length > 0);
        
        this.parsedCodes = codes;
        this.statusMessage = `Loaded ${codes.length} codes from ${file.name}`;
        console.log(`📥 Parsed ${codes.length} codes from Excel`);
      } catch (err) {
        this.error = 'Failed to parse Excel file: ' + err.message;
      }
    };
    
    reader.onerror = () => {
      this.error = 'Failed to read file';
    };
    
    reader.readAsArrayBuffer(file);
  }

  // --- Queue Type Selection ---
  _handleQueueTypeChange(type) {
    this.queueType = type;
  }

  // --- Process Start ---
  async _startProcessing() {
    if (!this.queueType) {
      this.error = 'Please select a processing type';
      return;
    }
    
    if (this.parsedCodes.length === 0) {
      this.error = 'Please upload an Excel file with codes';
      return;
    }
    
    this.loading = true;
    this.error = '';
    
    try {
      const token = await this._getToken();
      
      // Generate unique batch ID
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Insert codes into queue
      const result = await client.service('batch-queue').create({
        token,
        batchId,
        queueType: this.queueType,
        codes: this.parsedCodes,
        filename: this.selectedFile?.name || 'unknown',
        usr: 0 // TODO: Get from auth
      });
      
      if (result.success) {
        this.currentBatchId = batchId;
        this.isProcessing = true;
        this.statusMessage = `Started processing ${result.insertedCount} codes (batch size: ${this._getBatchSize()})`;
        
        // Set initial summary to show progress bar immediately
        this.summary = {
          total: result.insertedCount,
          success: 0,
          error: 0,
          pending: result.insertedCount,
          processing: 0,
          cancelled: 0
        };
        
        // Clear file input
        this.parsedCodes = [];
        this.selectedFile = null;
        
        // Start processing loop (batch mode) - no polling during processing
        this._processNextBatch();
        
        // Don't start polling - summary is updated after each batch completes
        // this._startPolling();
      } else {
        this.error = result.error || 'Failed to create batch';
      }
    } catch (err) {
      this.error = 'Failed to start processing: ' + err.message;
    } finally {
      this.loading = false;
    }
  }

  // --- Process Loop (Batch Mode) ---
  _getBatchSize() {
    // Read batchSize from the input element in the main interface
    const batchSizeInput = document.getElementById('batchSize');
    if (batchSizeInput) {
      const size = parseInt(batchSizeInput.value, 10);
      if (size >= 1 && size <= 100) {
        return size;
      }
    }
    return 10; // Default batch size (conservative for ERP stability)
  }

  async _processNextBatch() {
    if (!this.isProcessing || this.isPaused || !this.currentBatchId) {
      return;
    }
    
    try {
      const token = await this._getToken();
      const batchSize = this._getBatchSize();
      
      // Get next batch of pending codes
      const nextResult = await client.service('batch-queue').nextBatch({
        token,
        batchId: this.currentBatchId,
        limit: batchSize
      });
      
      if (!nextResult.hasNext || !nextResult.codes || nextResult.codes.length === 0) {
        // All done!
        this.isProcessing = false;
        this._stopPolling();
        await this._loadSummary();
        await this._loadRecentBatches();
        this.statusMessage = 'Batch processing completed!';
        return;
      }
      
      const codes = nextResult.codes;
      console.log(`📦 Processing batch of ${codes.length} codes (batchSize: ${batchSize})`);
      
      // Process entire batch in one ERP call
      const processResult = await client.service('batch-queue').processBatch({
        token,
        codes: codes,
        batchId: this.currentBatchId,
        queueType: this.queueType
      });
      
      console.log(`✅ Batch processed: ${processResult.processedCount} codes in ${processResult.durationMs}ms`);
      
      // Update summary (skip if ERP might be busy)
      try {
        await this._loadSummary();
      } catch (e) {
        console.warn('Summary update skipped (ERP busy)');
      }
      
      // Process next batch with delay (2 seconds to let ERP breathe)
      setTimeout(() => this._processNextBatch(), 2000);
      
    } catch (err) {
      console.error('Error processing batch:', err);
      // Continue with next batch after longer delay on error
      setTimeout(() => this._processNextBatch(), 5000);
    }
  }

  // Legacy single-code processing (kept for fallback)
  async _processNextCode() {
    if (!this.isProcessing || this.isPaused || !this.currentBatchId) {
      return;
    }
    
    try {
      const token = await this._getToken();
      
      // Get next pending code
      const nextResult = await client.service('batch-queue').next({
        token,
        batchId: this.currentBatchId
      });
      
      if (!nextResult.hasNext) {
        // All done!
        this.isProcessing = false;
        this._stopPolling();
        await this._loadSummary();
        await this._loadRecentBatches();
        this.statusMessage = 'Batch processing completed!';
        return;
      }
      
      // Process this code
      const processResult = await client.service('batch-queue').process({
        token,
        id: nextResult.id,
        code: nextResult.code,
        batchId: this.currentBatchId,
        queueType: this.queueType
      });
      
      console.log(`✅ Processed code ${nextResult.code}:`, processResult.status);
      
      // Update summary
      await this._loadSummary();
      
      // Process next
      setTimeout(() => this._processNextCode(), 100);
      
    } catch (err) {
      console.error('Error processing code:', err);
      // Continue with next code
      setTimeout(() => this._processNextCode(), 1000);
    }
  }

  // --- Stop/Cancel ---
  async _stopProcessing() {
    this.isPaused = true;
    this.statusMessage = 'Processing paused';
  }

  async _resumeProcessing() {
    this.isPaused = false;
    this.statusMessage = 'Resuming processing...';
    this._processNextBatch();
  }

  async _cancelBatch(batchId = null) {
    const targetBatchId = batchId || this.currentBatchId;
    if (!targetBatchId) return;
    
    this.loading = true;
    
    try {
      const token = await this._getToken();
      const result = await client.service('batch-queue').cancel({
        token,
        batchId: targetBatchId
      });
      
      if (result.success) {
        this.statusMessage = `Cancelled ${result.cancelledCount} pending codes`;
        this.isProcessing = false;
        this.isPaused = false;
        this._stopPolling();
        await this._loadSummary();
        await this._loadRecentBatches();
      }
    } catch (err) {
      this.error = 'Failed to cancel: ' + err.message;
    } finally {
      this.loading = false;
    }
  }

  // --- Retry Errors ---
  async _retryErrors(batchId = null) {
    const targetBatchId = batchId || this.currentBatchId;
    if (!targetBatchId) return;
    
    this.loading = true;
    
    try {
      const token = await this._getToken();
      const result = await client.service('batch-queue').retry({
        token,
        batchId: targetBatchId
      });
      
      if (result.success) {
        this.statusMessage = `Reset ${result.retriedCount} error codes to pending`;
        
        // If this is the current batch, resume processing
        if (targetBatchId === this.currentBatchId) {
          this.isProcessing = true;
          this.isPaused = false;
          this._processNextCode();
          this._startPolling();
        }
        
        await this._loadSummary();
        await this._loadRecentBatches();
      }
    } catch (err) {
      this.error = 'Failed to retry: ' + err.message;
    } finally {
      this.loading = false;
    }
  }

  // --- Data Loading ---
  async _loadSummary() {
    if (!this.currentBatchId) return;
    
    try {
      const token = await this._getToken();
      const result = await client.service('batch-queue').summary({
        token,
        batchId: this.currentBatchId
      });
      
      if (result.success !== false) {
        this.summary = result;
      }
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  }

  async _loadRecentBatches() {
    try {
      const token = await this._getToken();
      const result = await client.service('batch-queue').find({
        query: { token, limit: 10 }
      });
      
      if (result.success !== false && result.batches) {
        this.recentBatches = result.batches;
      }
    } catch (err) {
      console.error('Failed to load recent batches:', err);
    }
  }

  async _checkPendingBatches() {
    try {
      const token = await this._getToken();
      const result = await client.service('batch-queue').find({
        query: { token, pending: true }
      });
      
      if (result.success !== false && result.batches && result.batches.length > 0) {
        // Found pending batch - offer to resume
        const pendingBatch = result.batches[0];
        this.currentBatchId = pendingBatch.batchId;
        this.queueType = pendingBatch.queueType;
        this.summary = pendingBatch;
        this.statusMessage = `Found incomplete batch: ${pendingBatch.filename}. ${pendingBatch.pending} codes pending.`;
      }
    } catch (err) {
      console.error('Failed to check pending batches:', err);
    }
  }

  async _loadBatchDetails(batchId) {
    this.loading = true;
    
    try {
      const token = await this._getToken();
      const result = await client.service('batch-queue').find({
        query: { token, batchId }
      });
      
      if (result.success !== false && result.codes) {
        this.batchDetails = result.codes;
        this.showDetails = true;
        this.currentBatchId = batchId;
        await this._loadSummary();
      }
    } catch (err) {
      this.error = 'Failed to load batch details: ' + err.message;
    } finally {
      this.loading = false;
    }
  }

  // --- Export ---
  _exportResults() {
    if (!this.batchDetails || this.batchDetails.length === 0) {
      this.error = 'No data to export';
      return;
    }
    
    try {
      // Prepare data for export
      const exportData = this.batchDetails.map(item => ({
        'Code': item.code,
        'Status': item.status,
        'Message': item.message || '',
        'MTRL': item.mtrl || '',
        'Duration (ms)': item.durationMs || '',
        'Completed At': item.completedAt || ''
      }));
      
      // Create workbook
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Results');
      
      // Generate filename
      const filename = `batch_results_${this.currentBatchId || 'export'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Download
      XLSX.writeFile(wb, filename);
      
      this.statusMessage = `Exported ${exportData.length} records`;
    } catch (err) {
      this.error = 'Failed to export: ' + err.message;
    }
  }

  // --- Polling ---
  _startPolling() {
    // Don't poll during active processing - summary is updated after each batch
    // Only poll when paused or for monitoring
    this._stopPolling();
    this._pollInterval = setInterval(() => {
      // Only poll if paused (not actively processing)
      if (this.isPaused) {
        this._loadSummary();
      }
    }, 5000); // Every 5 seconds when paused
  }

  _stopPolling() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  // --- Render ---
  render() {
    return html`
      <div class="batch-container">
        <!-- Resume Banner (if pending batch found) -->
        ${this._renderResumeBanner()}
        
        <!-- Status Messages -->
        ${this._renderStatusMessages()}
        
        <!-- Queue Type Selection & Upload -->
        <div class="section-card">
          <div class="section-title">
            Batch Processing
          </div>
          
          <!-- Queue Type -->
          <div class="queue-type-selector">
            <label class="queue-type-option ${this.queueType === 'MOVE_ONLINE' ? 'selected' : ''}"
                   @click=${() => this._handleQueueTypeChange('MOVE_ONLINE')}>
              <input type="radio" name="queueType" value="MOVE_ONLINE"
                     ?checked=${this.queueType === 'MOVE_ONLINE'}
                     ?disabled=${this.isProcessing}>
              Move items online
            </label>
            
            <label class="queue-type-option ${this.queueType === 'STOCK_EVIDENCE' ? 'selected' : ''}"
                   @click=${() => this._handleQueueTypeChange('STOCK_EVIDENCE')}>
              <input type="radio" name="queueType" value="STOCK_EVIDENCE"
                     ?checked=${this.queueType === 'STOCK_EVIDENCE'}
                     ?disabled=${this.isProcessing}>
              Stock evidence
            </label>
          </div>
          
          <!-- File Upload & Actions -->
          <div class="upload-section">
            <div class="file-input-wrapper">
              <input type="file" 
                     class="file-input"
                     accept=".xlsx"
                     ?disabled=${this.isProcessing}
                     @change=${this._handleFileChange}>
            </div>
            
            ${this.parsedCodes.length > 0 ? html`
              <span class="file-info">
                ${this.parsedCodes.length} codes loaded
              </span>
            ` : ''}
            
            <button class="btn btn-primary"
                    ?disabled=${this.isProcessing || this.loading || this.parsedCodes.length === 0 || !this.queueType}
                    @click=${this._startProcessing}>
              ${this.loading ? html`<span class="spinner"></span>` : ''}
              Process
            </button>
            
            ${this.isProcessing && !this.isPaused ? html`
              <button class="btn btn-warning" @click=${this._stopProcessing}>
                Pause
              </button>
            ` : ''}
            
            ${this.isPaused ? html`
              <button class="btn btn-success" @click=${this._resumeProcessing}>
                Resume
              </button>
            ` : ''}
            
            ${this.isProcessing || this.isPaused ? html`
              <button class="btn btn-danger" @click=${() => this._cancelBatch()}>
                Cancel
              </button>
            ` : ''}
          </div>
        </div>
        
        <!-- Progress Section -->
        ${this._renderProgress()}
        
        <!-- Recent Batches -->
        ${this._renderRecentBatches()}
        
        <!-- Batch Details -->
        ${this._renderBatchDetails()}
      </div>
    `;
  }

  _renderResumeBanner() {
    if (!this.currentBatchId || this.isProcessing || !this.summary || this.summary.pending === 0) {
      return '';
    }
    
    return html`
      <div class="resume-banner">
        <div class="resume-banner-text">
          <strong>Incomplete batch found:</strong>
          ${this.summary.filename || this.currentBatchId} - ${this.summary.pending} codes pending
        </div>
        <div class="resume-banner-actions">
          <button class="btn btn-success btn-sm" @click=${() => {
            this.isProcessing = true;
            this._processNextBatch();
          }}>
            Resume
          </button>
          <button class="btn btn-danger btn-sm" @click=${() => this._cancelBatch()}>
            Cancel
          </button>
        </div>
      </div>
    `;
  }

  _renderStatusMessages() {
    return html`
      ${this.error ? html`
        <div class="status-message error">
          ${this.error}
          <button class="btn btn-sm btn-outline-primary" style="margin-left: auto;" @click=${() => this.error = ''}>
            ✕
          </button>
        </div>
      ` : ''}
      
      ${this.statusMessage && !this.error ? html`
        <div class="status-message info">
          ${this.statusMessage}
        </div>
      ` : ''}
    `;
  }

  _renderProgress() {
    if (!this.summary) return '';
    
    const total = this.summary.total || 0;
    const success = this.summary.success || 0;
    const error = this.summary.error || 0;
    const pending = this.summary.pending || 0;
    const processing = this.summary.processing || 0;
    const cancelled = this.summary.cancelled || 0;
    
    const completed = success + error + cancelled;
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return html`
      <div class="section-card progress-section">
        <div class="section-title">
          Progress: ${completed}/${total} (${progressPct}%)
          ${this.isProcessing ? html`<span class="spinner" style="margin-left: 0.5rem;"></span>` : ''}
        </div>
        
        <div class="progress-bar-container" data-progress="${progressPct}%">
          <div class="progress-bar" style="width: ${progressPct}%"></div>
        </div>
        
        <div class="progress-stats">
          <div class="stat-item">
            <span class="stat-badge stat-success">
              ✓ Success: ${success}
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-badge stat-error">
              ✗ Error: ${error}
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-badge stat-pending">
              ⏳ Pending: ${pending}
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-badge stat-processing">
              ↻ Processing: ${processing}
            </span>
          </div>
          ${cancelled > 0 ? html`
            <div class="stat-item">
              <span class="stat-badge stat-cancelled">
                ⊘ Cancelled: ${cancelled}
              </span>
            </div>
          ` : ''}
        </div>
        
        ${error > 0 ? html`
          <div style="margin-top: 1rem;">
            <button class="btn btn-warning btn-sm" @click=${() => this._retryErrors()}>
              Retry ${error} Errors
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  _renderRecentBatches() {
    if (this.recentBatches.length === 0) {
      return html`
        <div class="section-card">
          <div class="section-title">
            Recent Sessions
          </div>
          <div class="empty-state">
            <p>No batch sessions yet. Upload an Excel file to get started.</p>
          </div>
        </div>
      `;
    }
    
    return html`
      <div class="section-card">
        <div class="section-title">
          Recent Sessions
        </div>
        
        <table class="batches-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>File</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.recentBatches.map(batch => html`
              <tr>
                <td>${this._formatDate(batch.createdAt)}</td>
                <td>
                  ${batch.queueType === 'MOVE_ONLINE' 
                    ? 'Move Online' 
                    : 'Stock Evidence'}
                </td>
                <td>${batch.filename || '-'}</td>
                <td>${batch.total}</td>
                <td>
                  <span class="status-badge ${batch.isComplete ? 'status-completed' : 'status-in-progress'}">
                    ${batch.isComplete 
                      ? '✓ Completed' 
                      : '↻ In Progress'}
                  </span>
                  ${batch.error > 0 ? html`<span class="stat-badge stat-error" style="margin-left:0.5rem">${batch.error} errors</span>` : ''}
                </td>
                <td>
                  <div class="action-btns">
                    <button class="btn btn-secondary btn-sm" @click=${() => this._loadBatchDetails(batch.batchId)}>
                      Details
                    </button>
                    ${batch.error > 0 ? html`
                      <button class="btn btn-warning btn-sm" @click=${() => this._retryErrors(batch.batchId)}>
                        Retry
                      </button>
                    ` : ''}
                    ${!batch.isComplete ? html`
                      <button class="btn btn-danger btn-sm" @click=${() => this._cancelBatch(batch.batchId)}>
                        Cancel
                      </button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  }

  _renderBatchDetails() {
    if (!this.showDetails || this.batchDetails.length === 0) return '';
    
    return html`
      <div class="section-card details-section">
        <div class="details-header">
          <div class="section-title">
            Batch Details (${this.batchDetails.length} codes)
          </div>
          <div>
            <button class="btn btn-success btn-sm" @click=${this._exportResults}>
              Export to Excel
            </button>
            <button class="btn btn-secondary btn-sm" @click=${() => this.showDetails = false}>
              Close
            </button>
          </div>
        </div>
        
        <div style="max-height: 400px; overflow-y: auto;">
          <table class="codes-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Code</th>
                <th>Status</th>
                <th>Message</th>
                <th>MTRL</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              ${this.batchDetails.map((item, idx) => html`
                <tr>
                  <td>${idx + 1}</td>
                  <td><code>${item.code}</code></td>
                  <td>
                    <span class="stat-badge stat-${item.status.toLowerCase()}">
                      ${item.status}
                    </span>
                  </td>
                  <td>${item.message || '-'}</td>
                  <td>${item.mtrl || '-'}</td>
                  <td>${item.durationMs ? `${item.durationMs}ms` : '-'}</td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  _formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('ro-RO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  }
}

customElements.define('batch-processing-container', BatchProcessingContainer);
