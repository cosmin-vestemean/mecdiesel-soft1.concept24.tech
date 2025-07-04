import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { client } from '../socketConfig.js';

export class S1TransferModal extends LitElement {
  static properties = {
    visible: { type: Boolean },
    state: { type: String }, // 'confirmation', 'processing', 'results'
    transferOrders: { type: Array },
    currentResults: { type: Array },
    processingIndex: { type: Number },
    overallProgress: { type: Number },
    currentToken: { type: String },
    successfulOrders: { type: Array },
    failedOrders: { type: Array }
  };

  constructor() {
    super();
    this.visible = false;
    this.state = 'confirmation';
    this.transferOrders = [];
    this.currentResults = [];
    this.processingIndex = 0;
    this.overallProgress = 0;
    this.currentToken = '';
    this.successfulOrders = [];
    this.failedOrders = [];
  }

  createRenderRoot() {
    // Disable shadow DOM to allow global styles to affect this component
    return this;
  }

  render() {
    if (!this.visible) return html``;

    return html`
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1055; max-width: 90vw; max-height: 90vh;">
        <div class="modal-dialog modal-dialog-scrollable" style="margin: 0; max-width: 600px; width: 100%;">
          <div class="modal-content" style="max-height: 80vh; overflow: hidden;">
            ${this._renderCurrentState()}
          </div>
        </div>
      </div>
    `;
  }

  _renderCurrentState() {
    switch (this.state) {
      case 'confirmation':
        return this._renderConfirmation();
      case 'processing':
        return this._renderProcessing();
      case 'results':
        return this._renderResults();
      default:
        return html`<div>Unknown state: ${this.state}</div>`;
    }
  }

  _renderConfirmation() {
    const totalOrders = this.transferOrders.length;
    const totalItems = this.transferOrders.reduce((sum, order) => sum + order.totalItems, 0);
    const totalQuantity = this.transferOrders.reduce((sum, order) => sum + order.totalQuantity, 0);
    const totalBlacklistedItems = this.transferOrders.reduce((sum, order) => sum + order.blacklistedItemsCount, 0);

    return html`
      <div class="modal-header bg-primary text-white">
        <h5 class="modal-title">
          <i class="fas fa-rocket me-2"></i>
          Confirmare Transfer SoftOne
        </h5>
      </div>
      
      <div class="modal-body bg-primary bg-opacity-10" style="max-height: 60vh; overflow-y: auto;">
        <!-- Summary cards -->
        <div class="row g-2 mb-3">
          <div class="col-md-3">
            <div class="card bg-primary text-white">
              <div class="card-body text-center py-2">
                <i class="fas fa-list-ol fa-lg mb-1"></i>
                <h5>${totalOrders}</h5>
                <small>Comenzi</small>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card bg-primary text-white">
              <div class="card-body text-center py-2">
                <i class="fas fa-boxes fa-lg mb-1"></i>
                <h5>${totalItems}</h5>
                <small>Produse</small>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card bg-primary text-white">
              <div class="card-body text-center py-2">
                <i class="fas fa-weight fa-lg mb-1"></i>
                <h5>${totalQuantity.toFixed(1)}</h5>
                <small>Cantitate</small>
              </div>
            </div>
          </div>
          ${totalBlacklistedItems > 0 ? html`
            <div class="col-md-3">
              <div class="card bg-warning text-dark">
                <div class="card-body text-center py-2">
                  <i class="fas fa-exclamation-triangle fa-lg mb-1"></i>
                  <h5>${totalBlacklistedItems}</h5>
                  <small>Blacklisted</small>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
        
        <!-- Order list -->
        <div class="list-group">
          ${this.transferOrders.map(order => html`
            <div class="list-group-item">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h6 class="mb-1">
                    <i class="fas fa-arrow-right text-primary me-2"></i>
                    ${order.sourceName} → ${order.destinationName}
                  </h6>
                  <p class="mb-1">${order.totalItems} produse • ${order.totalQuantity.toFixed(2)} cantitate</p>
                </div>
                <div>
                  ${order.blacklistedItemsCount > 0 ? html`
                    <span class="badge bg-warning">
                      <i class="fas fa-exclamation-triangle me-1"></i>
                      ${order.blacklistedItemsCount} blacklisted
                    </span>
                  ` : ''}
                </div>
              </div>
            </div>
          `)}
        </div>

        <!-- Production reminder -->
        <div class="alert alert-warning mt-2 py-2">
          <h6 class="mb-2"><i class="fas fa-exclamation-triangle me-2"></i>Reminder pentru producție:</h6>
          <p class="mb-0 small">
            <strong>A se șterge comentariul de test din comenzi înainte de deployment în producție:</strong><br>
            <code>"TEST TEST TEST A NU SE PROCESA"</code>
          </p>
        </div>
      </div>
      
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" @click="${this._handleCancel}">
          <i class="fas fa-times me-2"></i>Anulează
        </button>
        <button type="button" class="btn btn-primary" @click="${this._handleConfirm}">
          <i class="fas fa-rocket me-2"></i>Începe Transferul
        </button>
      </div>
    `;
  }

  _renderProcessing() {
    const completedCount = this.currentResults.filter(r => r && (r.status === 'success' || r.status === 'failed')).length;
    const totalCount = this.transferOrders.length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return html`
      <div class="modal-header bg-info text-white">
        <h5 class="modal-title">
          <i class="fas fa-sync fa-spin me-2"></i>
          Transfer în curs...
        </h5>
      </div>
      
      <div class="modal-body bg-info bg-opacity-10" style="max-height: 60vh; overflow-y: auto;">
        <!-- Overall progress -->
        <div class="mb-4">
          <div class="d-flex justify-content-between mb-2">
            <span><strong>Progres general</strong></span>
            <span><strong>${completedCount}/${totalCount} (${progressPercent}%)</strong></span>
          </div>
          <div class="progress mb-2" style="height: 8px;">
            <div class="progress-bar bg-success progress-bar-striped progress-bar-animated" 
                 style="width: ${progressPercent}%"></div>
          </div>
          <small class="text-muted">
            <i class="fas fa-info-circle me-1"></i>
            Progres bazat pe numărul de comenzi procesate
          </small>
        </div>
        
        <!-- Individual order status -->
        <div class="list-group">
          ${this.transferOrders.map((order, index) => this._renderOrderStatus(order, index))}
        </div>
        
        <!-- Production reminder -->
        <div class="alert alert-warning mt-3 py-2">
          <i class="fas fa-exclamation-triangle me-2"></i>
          <strong>Reminder:</strong> A se șterge comentariul de test din producție: <code>"TEST TEST TEST A NU SE PROCESA"</code>
        </div>
      </div>
      
      <div class="modal-footer">
        <button type="button" class="btn btn-outline-danger" @click="${this._handleCancelRemaining}">
          <i class="fas fa-stop me-2"></i>Oprește transferurile rămase
        </button>
      </div>
    `;
  }

  _renderOrderStatus(order, index) {
    const result = this.currentResults[index];
    
    if (!result) {
      // Waiting
      return html`
        <div class="list-group-item">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <h6 class="mb-1">
                <i class="fas fa-clock text-secondary me-2"></i>
                ${order.destinationName}
              </h6>
              <small class="text-muted">În așteptare...</small>
            </div>
            <div>
              <span class="badge bg-secondary">În așteptare</span>
            </div>
          </div>
        </div>
      `;
    }

    if (result.status === 'processing') {
      // Currently processing
      return html`
        <div class="list-group-item border-warning bg-warning bg-opacity-10">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <h6 class="mb-1">
                <i class="fas fa-sync fa-spin text-warning me-2"></i>
                ${order.destinationName}
              </h6>
              <small class="text-warning">Se trimite...</small>
            </div>
            <div class="text-end">
              <span class="badge bg-warning">În curs</span>
              <br>
              <small class="text-muted">
                <i class="fas fa-stopwatch me-1"></i>${this._formatDuration(result.duration || 0)}
              </small>
            </div>
          </div>
        </div>
      `;
    }

    if (result.status === 'success') {
      // Completed successfully
      return html`
        <div class="list-group-item border-success">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <h6 class="mb-1">
                <i class="fas fa-check-circle text-success me-2"></i>
                ${order.destinationName}
              </h6>
              <small class="text-success">ID: #${result.data?.id || 'unknown'}</small>
            </div>
            <div class="text-end">
              <span class="badge bg-success">Complet</span>
              <br>
              <small class="text-muted">
                <i class="fas fa-stopwatch me-1"></i>${this._formatDuration(result.duration || 0)}
              </small>
            </div>
          </div>
        </div>
      `;
    }

    if (result.status === 'failed') {
      // Failed
      return html`
        <div class="list-group-item border-danger">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <h6 class="mb-1">
                <i class="fas fa-exclamation-circle text-danger me-2"></i>
                ${order.destinationName}
              </h6>
              <small class="text-danger">${result.data?.message || 'Eroare necunoscută'}</small>
            </div>
            <div class="text-end">
              <span class="badge bg-danger">Eșuat</span>
              <br>
              <small class="text-muted">
                <i class="fas fa-stopwatch me-1"></i>${this._formatDuration(result.duration || 0)}
              </small>
            </div>
          </div>
        </div>
      `;
    }

    return html``;
  }

  _renderResults() {
    const totalOrders = this.transferOrders.length;
    const successCount = this.successfulOrders.length;
    const errorCount = this.failedOrders.length;
    const successRate = totalOrders > 0 ? Math.round((successCount / totalOrders) * 100) : 0;

    return html`
      <div class="modal-header ${successCount === totalOrders ? 'bg-success' : 'bg-warning'} text-white">
        <h5 class="modal-title">
          <i class="fas fa-${successCount === totalOrders ? 'check-circle' : 'exclamation-triangle'} me-2"></i>
          Transfer ${successCount === totalOrders ? 'Completat' : 'Completat cu Erori'}
        </h5>
      </div>
      
      <div class="modal-body ${successCount === totalOrders ? 'bg-success' : 'bg-warning'} bg-opacity-10" style="max-height: 60vh; overflow-y: auto;">
        <!-- Results summary -->
        <div class="row g-2 mb-3">
          <div class="col-md-4">
            <div class="card border-success">
              <div class="card-body text-center py-2">
                <i class="fas fa-check-circle text-success fa-lg mb-1"></i>
                <h5 class="text-success">${successCount}</h5>
                <small>Reușite</small>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="card border-danger">
              <div class="card-body text-center py-2">
                <i class="fas fa-exclamation-circle text-danger fa-lg mb-1"></i>
                <h5 class="text-danger">${errorCount}</h5>
                <small>Eșuate</small>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="card border-info">
              <div class="card-body text-center py-2">
                <i class="fas fa-percentage text-info fa-lg mb-1"></i>
                <h5 class="text-info">${successRate}%</h5>
                <small>Rata de succes</small>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Detailed results -->
        <div class="list-group">
          ${this.currentResults.map((result, index) => this._renderDetailedResult(this.transferOrders[index], result, index))}
        </div>

        <!-- Show friendly IDs section if we have successful orders -->
        ${this.successfulOrders.length > 0 ? html`
          <div class="alert alert-info mt-3 py-2">
            <h6 class="mb-2"><i class="fas fa-info-circle me-2"></i>Comenzi create cu succes:</h6>
            <div id="friendly-ids-container" class="small">
              <i class="fas fa-spinner fa-spin me-2"></i>Se încarcă ID-urile prietenoase...
            </div>
          </div>
        ` : ''}
      </div>
      
      <div class="modal-footer">
        ${this.failedOrders.length > 0 ? html`
          <button type="button" class="btn btn-primary" @click="${this._retryAllFailed}">
            <i class="fas fa-redo me-2"></i>
            Reîncearcă toate eșuatele (${this.failedOrders.length})
          </button>
        ` : ''}
        <button type="button" class="btn btn-secondary" @click="${this._handleClose}">
          <i class="fas fa-times me-2"></i>Închide
        </button>
      </div>
    `;
  }

  _renderDetailedResult(order, result, index) {
    if (result.status === 'success') {
      return html`
        <div class="list-group-item border-success">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <h6 class="mb-1">
                <i class="fas fa-check-circle text-success me-2"></i>
                ${order.destinationName}
              </h6>
              <p class="mb-1">${order.totalItems} produse • ${order.totalQuantity.toFixed(2)} cantitate</p>
              <small class="text-success">ID S1: #${result.data?.id || 'unknown'}</small>
            </div>
            <div class="text-end">
              <span class="badge bg-success">Reușit</span>
              <br>
              <small class="text-muted">⏱️ ${this._formatDuration(result.duration || 0)}</small>
            </div>
          </div>
        </div>
      `;
    }

    if (result.status === 'failed') {
      return html`
        <div class="list-group-item border-danger">
          <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
              <h6 class="mb-1">
                <i class="fas fa-exclamation-circle text-danger me-2"></i>
                ${order.destinationName}
              </h6>
              <p class="mb-1">${order.totalItems} produse • ${order.totalQuantity.toFixed(2)} cantitate</p>
              
              <!-- Error details (expandable) -->
              <div class="mt-2">
                <button class="btn btn-sm btn-outline-secondary" 
                        @click="${() => this._toggleErrorDetails(index)}">
                  <i class="fas fa-chevron-down me-1"></i>
                  Detalii eroare
                </button>
                
                <div class="collapse mt-2" id="error-details-${index}">
                  <div class="alert alert-danger">
                    <div class="d-flex align-items-start">
                      <i class="fas fa-exclamation-triangle text-danger me-2 mt-1"></i>
                      <div class="flex-grow-1">
                        <strong class="d-block mb-2">${result.data?.message || 'Eroare necunoscută'}</strong>
                        
                        <!-- Multiple error messages if available -->
                        ${result.data?.messages && Array.isArray(result.data.messages) && result.data.messages.length > 1 ? html`
                          <div class="mb-3">
                            <small class="text-muted d-block mb-1">Mesaje detaliate:</small>
                            ${result.data.messages.map((msg, i) => html`
                              <div class="small mb-1">
                                <i class="fas fa-circle text-danger me-1" style="font-size: 0.5rem;"></i>
                                ${msg}
                              </div>
                            `)}
                          </div>
                        ` : ''}
                        
                        <!-- Order context information -->
                        ${result.data?.orderInfo ? html`
                          <div class="mb-3 p-2 bg-light rounded">
                            <small class="text-muted d-block mb-1">Context comandă:</small>
                            <div class="small">
                              <strong>Destinație:</strong> ${result.data.orderInfo.destination}<br>
                              <strong>Articole:</strong> ${result.data.orderInfo.items}<br>
                              <strong>Cantitate totală:</strong> ${result.data.orderInfo.totalQuantity || 'N/A'}
                              ${result.data.orderInfo.maxRetries ? html`<br><strong>Încercări max:</strong> ${result.data.orderInfo.maxRetries}` : ''}
                            </div>
                          </div>
                        ` : ''}
                      </div>
                    </div>
                    
                    <!-- SoftOne Documentation Section -->
                    ${result.data?.softOneDocumentation ? html`
                      <div class="mt-3 border-top pt-3">
                        <button class="btn btn-sm btn-outline-info" 
                                @click="${() => this._toggleDocumentation(index)}">
                          <i class="fas fa-book me-1"></i>
                          Documentație SoftOne
                        </button>
                        <div class="collapse mt-2" id="docs-${index}">
                          <div class="bg-info bg-opacity-10 p-3 rounded">
                            <pre class="mb-0 small text-dark" style="white-space: pre-wrap; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">${result.data.softOneDocumentation}</pre>
                          </div>
                        </div>
                      </div>
                    ` : ''}
                    
                    <!-- Technical details toggle -->
                    ${result.data?.error || result.data?.code ? html`
                      <div class="mt-3 border-top pt-3">
                        <button class="btn btn-sm btn-outline-warning" 
                                @click="${() => this._toggleTechnicalDetails(index)}">
                          <i class="fas fa-code me-1"></i>
                          Detalii tehnice (pentru dezvoltatori)
                        </button>
                        <div class="collapse mt-2" id="tech-details-${index}">
                          <div class="bg-warning bg-opacity-10 p-3 rounded">
                            <pre class="small mb-0">
<strong>Cod eroare:</strong> ${result.data?.error || 'N/A'}
<strong>Cod HTTP:</strong> ${result.data?.code || 'N/A'}
<strong>Timestamp:</strong> ${result.data?.enhancedAt || new Date().toISOString()}

${result.data?.originalResponse ? html`<strong>Răspuns original:</strong>
${JSON.stringify(result.data.originalResponse, null, 2)}` : ''}

${result.data?.originalError ? html`<strong>Eroare originală:</strong>
${result.data.originalError.toString()}` : ''}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ` : ''}
                  </div>
                </div>
              </div>
            </div>
            
            <div class="text-end ms-3">
              <span class="badge bg-danger mb-2">Eșuat</span>
              <br>
              <!-- Inline retry button -->
              <button class="btn btn-sm btn-outline-primary" 
                      @click="${() => this._retryOrder(index)}"
                      ?disabled="${result.retrying}">
                <i class="fas fa-${result.retrying ? 'spinner fa-spin' : 'redo'} me-1"></i>
                ${result.retrying ? 'Se reîncearcă...' : 'Reîncearcă'}
              </button>
            </div>
          </div>
        </div>
      `;
    }

    return html``;
  }

  // Public methods for parent component
  showConfirmation(orders, token) {
    this.transferOrders = orders;
    this.currentToken = token;
    this.state = 'confirmation';
    this.visible = true;
    this.currentResults = [];
    this.processingIndex = 0;
    this.successfulOrders = [];
    this.failedOrders = [];
  }

  startProcessing() {
    this.state = 'processing';
    this.currentResults = new Array(this.transferOrders.length).fill(null);
    this.requestUpdate();
  }

  updateProgress(orderIndex, status, data = {}) {
    const startTime = this.currentResults[orderIndex]?.startTime || Date.now();
    const duration = Date.now() - startTime;
    
    this.currentResults[orderIndex] = {
      status,
      data,
      duration,
      startTime: this.currentResults[orderIndex]?.startTime || startTime
    };
    
    if (status === 'processing') {
      this.currentResults[orderIndex].startTime = Date.now();
    }
    
    this.requestUpdate();
  }

  showResults() {
    this.state = 'results';
    
    // Categorize results
    this.successfulOrders = [];
    this.failedOrders = [];
    
    this.currentResults.forEach((result, index) => {
      if (result?.status === 'success') {
        this.successfulOrders.push({ order: this.transferOrders[index], result, index });
      } else if (result?.status === 'failed') {
        this.failedOrders.push({ order: this.transferOrders[index], result, index });
      }
    });
    
    this.requestUpdate();
    
    // Fetch friendly IDs for successful orders
    if (this.successfulOrders.length > 0) {
      this._fetchFriendlyIds();
    }
  }

  // Event handlers
  _handleCancel() {
    this.visible = false;
    this.dispatchEvent(new CustomEvent('cancelled', { 
      bubbles: true, 
      composed: true 
    }));
  }

  _handleConfirm() {
    this.dispatchEvent(new CustomEvent('confirmed', { 
      bubbles: true, 
      composed: true 
    }));
  }

  _handleClose() {
    this.visible = false;
    this.dispatchEvent(new CustomEvent('closed', { 
      bubbles: true, 
      composed: true 
    }));
  }

  _handleCancelRemaining() {
    this.dispatchEvent(new CustomEvent('cancel-remaining', { 
      bubbles: true, 
      composed: true 
    }));
  }

  async _retryOrder(orderIndex) {
    const result = this.currentResults[orderIndex];
    if (!result || result.retrying) return;

    // Mark as retrying
    this.currentResults[orderIndex] = { 
      ...result, 
      retrying: true 
    };
    this.requestUpdate();

    // Dispatch retry event
    this.dispatchEvent(new CustomEvent('retry-order', { 
      bubbles: true, 
      composed: true,
      detail: { orderIndex, order: this.transferOrders[orderIndex] }
    }));
  }

  async _retryAllFailed() {
    // Dispatch retry all event
    this.dispatchEvent(new CustomEvent('retry-all-failed', { 
      bubbles: true, 
      composed: true,
      detail: { failedOrders: this.failedOrders }
    }));
  }

  _toggleErrorDetails(index) {
    const element = this.querySelector(`#error-details-${index}`);
    if (element) {
      element.classList.toggle('show');
    }
  }

  _toggleTechnicalDetails(index) {
    const element = this.querySelector(`#tech-details-${index}`);
    if (element) {
      element.classList.toggle('show');
    }
  }

  _toggleDocumentation(index) {
    const element = this.querySelector(`#docs-${index}`);
    if (element) {
      element.classList.toggle('show');
    }
  }

  // Helper methods
  _formatDuration(milliseconds) {
    if (milliseconds < 1000) return `${milliseconds}ms`;
    const seconds = (milliseconds / 1000).toFixed(1);
    return `${seconds}s`;
  }

  async _fetchFriendlyIds() {
    try {
      const ids = this.successfulOrders.map(item => item.result.data.id).join(',');
      
      const response = await client.service('s1').getSqlDataset({
        token: this.currentToken,
        SQL: `SELECT findoc, fincode FROM findoc WHERE findoc IN (${ids})`
      });

      if (response.succes && response.rows) {
        const container = this.querySelector('#friendly-ids-container');
        if (container) {
          const idMap = new Map();
          response.rows.forEach(row => {
            idMap.set(row.findoc.toString(), row.fincode);
          });

          container.innerHTML = this.successfulOrders.map(item => {
            const friendlyId = idMap.get(item.result.data.id.toString()) || item.result.data.id;
            return `<div><strong>${item.order.destinationName}:</strong> ${friendlyId}</div>`;
          }).join('');
        }
      }
    } catch (error) {
      console.error('Error fetching friendly IDs:', error);
      const container = this.querySelector('#friendly-ids-container');
      if (container) {
        container.innerHTML = '<span class="text-danger">Eroare la încărcarea ID-urilor prietenoase</span>';
      }
    }
  }

  async _lookupErrorCode(errorCode) {
    // This would lookup error codes in SoftOne documentation
    // For now, return a placeholder
    return `Error code ${errorCode} - verificați documentația SoftOne`;
  }
}

customElements.define('s1-transfer-modal', S1TransferModal);
